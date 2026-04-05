import os
import shutil
import json
import asyncio
import uuid
import socket
import subprocess
import contextlib
from urllib.parse import urlparse
from tempfile import NamedTemporaryFile
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import FileResponse
import yt_dlp
from moviepy.editor import VideoFileClip

from ai_service import extract_transcript_and_metrics, chat_with_transcript

app = FastAPI(title="ReelAnalyzer SSE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve processed video files so the frontend can play them
MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
os.makedirs(MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

# Frontend serving
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

class URLRequest(BaseModel):
    url: str

class ChatRequest(BaseModel):
    transcript_text: str
    question: str

@contextlib.contextmanager
def dns_override(host_map: dict):
    """Temporarily patches socket.getaddrinfo to resolve specific hosts to given IPs."""
    original_getaddrinfo = socket.getaddrinfo
    
    def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if host in host_map:
            # We return a list containing a single 5-tuple matching the getaddrinfo format
            # (family, type, proto, canonname, sockaddr)
            # sockaddr for IPv4 is (address, port)
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (host_map[host], port))]
        return original_getaddrinfo(host, port, family, type, proto, flags)
    
    socket.getaddrinfo = patched_getaddrinfo
    try:
        yield
    finally:
        socket.getaddrinfo = original_getaddrinfo

def resolve_hostname_robustly(hostname: str) -> str:
    """Try multiple methods to resolve a hostname to an IP."""
    # Method 1: Standard socket (fastest)
    try:
        return socket.gethostbyname(hostname)
    except:
        pass
    
    # Method 2: nslookup via subprocess (often bypasses Python-specific blocks)
    try:
        res = subprocess.check_output(["nslookup", hostname], stderr=subprocess.DEVNULL, timeout=10).decode()
        addresses = []
        for line in res.splitlines():
            if "Address:" in line and "#" not in line:
                addresses.append(line.split("Address:")[1].strip())
        if addresses:
            return addresses[-1]
    except:
        pass

    # Method 3: Check global connectivity to 8.8.8.8 to diagnose
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(("8.8.8.8", 53))
        s.close()
        # Fallback to confirmed global IPs if all else fails
        fallbacks = {
            "www.youtube.com": "173.194.208.91",
            "youtube.com": "173.194.208.91",
            "www.instagram.com": "57.144.200.34",
            "instagram.com": "57.144.200.34",
            "www.tiktok.com": "161.117.71.74",
            "tiktok.com": "161.117.71.74",
        }
        if hostname in fallbacks:
            return fallbacks[hostname]
    except:
        pass
    
    return None

def format_sse(event_name: str, payload: dict) -> str:
    """Format data as Server-Sent Event string."""
    return f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"

async def process_video_generator(url: str = None, file_obj=None, file_ext='.mp4'):
    """Generator yielding progressive JSON chunks as SSE stream."""
    temp_video_path = None
    audio_path = None
    served_video_name = None
    
    try:
        # Step 1: Downloading / Saving Payload
        if url:
            yield format_sse("progress", {"percentage": 10, "message": "Downloading video from URL..."})
            await asyncio.sleep(0.5)
            temp_video_path = f"/tmp/reel_video_{hash(url)}.mp4"
            
            # Step 1.1: Systematic DNS Resolution for the provided platform
            parsed_url = urlparse(url)
            hostname = parsed_url.hostname or "www.youtube.com"
            
            # Identify secondary domain if it's a www variant
            alt_hostname = hostname[4:] if hostname.startswith("www.") else f"www.{hostname}"
            
            resolved_ip = resolve_hostname_robustly(hostname)
            if not resolved_ip:
                # Try the alternate hostname just in case 
                resolved_ip = resolve_hostname_robustly(alt_hostname)
            
            if not resolved_ip:
                yield format_sse("error", {"detail": f"DNS resolution failed for {hostname} even with fallbacks. Your local system is strictly blocking this process."})
                return
            
            print(f"Systematic DNS Resolution successful for {hostname}: {resolved_ip}")

            ydl_opts = {
                'format': 'best',
                'outtmpl': temp_video_path,
                'quiet': False,
                'no_warnings': False,
                'nocheckcertificate': True,
                'geo_bypass': True,
                'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'cookiefile': None,
                'source_address': '0.0.0.0',
                'noproxy': True,
                'extractor_args': {'youtube': {'player_client': ['ios']}},
            }

            # Map the target domain and its variant to the resolved IP for a total bypass
            overrides = {
                hostname: resolved_ip,
                alt_hostname: resolved_ip,
                "www.youtube.com": resolved_ip, # Keep defaults for common sub-requests
                "i.ytimg.com": resolved_ip,
            }

            try:
                with dns_override(overrides):
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([url])
            except Exception as download_error:
                print(f"yt-dlp download error: {str(download_error)}")
                raise Exception(f"Failed to download video from URL: {str(download_error)}")
        else:
            yield format_sse("progress", {"percentage": 10, "message": "Saving uploaded video file..."})
            await asyncio.sleep(0.5)
            with NamedTemporaryFile(delete=False, suffix=file_ext) as temp_video:
                shutil.copyfileobj(file_obj, temp_video)
                temp_video_path = temp_video.name
                
        # Step 2: Copy video to media dir so frontend can play it
        yield format_sse("progress", {"percentage": 30, "message": "Preparing video for playback..."})
        served_video_name = f"{uuid.uuid4().hex}{file_ext if not url else '.mp4'}"
        served_video_path = os.path.join(MEDIA_DIR, served_video_name)
        shutil.copy2(temp_video_path, served_video_path)

        # Step 3: Audio Extraction
        yield format_sse("progress", {"percentage": 40, "message": "Extracting audio layers from video..."})
        await asyncio.sleep(0.5)
        audio_path = temp_video_path + ".mp3"
        video_clip = VideoFileClip(temp_video_path)
        video_clip.audio.write_audiofile(audio_path, logger=None)
        video_clip.close()
        
        # Step 4: Transcribing with metrics
        yield format_sse("progress", {"percentage": 60, "message": "Initializing Local Whisper AI..."})
        await asyncio.sleep(0.3)
        
        yield format_sse("progress", {"percentage": 80, "message": "Transcribing audio & analyzing signal..."})
        
        result = extract_transcript_and_metrics(audio_path)

        # Cleanup temp files (keep the served copy in media/)
        if os.path.exists(temp_video_path): os.remove(temp_video_path)
        if os.path.exists(audio_path): os.remove(audio_path)
        
        # Step 5: Complete Payload with video_url for frontend playback
        result["video_url"] = f"https://theuntoldcreator1999-reelanalyzer.hf.space/media/{served_video_name}"
        
        yield format_sse("progress", {"percentage": 100, "message": "Extraction complete!"})
        yield format_sse("complete", result)

    except Exception as e:
        # Cleanup
        if temp_video_path and os.path.exists(temp_video_path): os.remove(temp_video_path)
        if audio_path and os.path.exists(audio_path): os.remove(audio_path)
        if served_video_name:
            p = os.path.join(MEDIA_DIR, served_video_name)
            if os.path.exists(p): os.remove(p)
        yield format_sse("error", {"detail": str(e)})


@app.post("/api/analyze/url")
async def analyze_url(req: Request):
    """Event Stream connection taking a URL."""
    body = await req.json()
    url = body.get("url")
    return StreamingResponse(process_video_generator(url=url), media_type="text/event-stream")

@app.post("/api/analyze/upload")
async def analyze_upload(file: UploadFile = File(...)):
    """Event Stream connection taking an upload file."""
    suffix = os.path.splitext(file.filename)[1]
    return StreamingResponse(process_video_generator(file_obj=file.file, file_ext=suffix), media_type="text/event-stream")


@app.post("/api/chat")
async def chat_interaction(req: ChatRequest):
    """Synchronous JSON endpoint returning Gemini's context-aware chat response."""
    reply = chat_with_transcript(req.transcript_text, req.question)
    return {"reply": reply}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# Serve frontend at root and handle SPA routing
if os.path.exists(FRONTEND_DIR):
    # Mount build assets (assets/, etc.)
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve API routes normally, but everything else gets the frontend index
        if full_path.startswith("api/") or full_path.startswith("media/"):
             raise HTTPException(status_code=404)
        
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "Frontend not found. Please build it first."}
else:
    @app.get("/")
    def home():
        return {
            "message": "Aetheris Vision API is online",
            "endpoints": {
                "extract_url": "/api/analyze/url",
                "extract_upload": "/api/analyze/upload",
                "chat": "/api/chat",
                "status": "/api/health"
            }
        }
