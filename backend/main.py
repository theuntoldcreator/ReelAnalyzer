import os
import shutil
import json
import asyncio
import uuid
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
            ydl_opts = {
                'format': 'best',
                'outtmpl': temp_video_path,
                'quiet': True,
                'no_warnings': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
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
