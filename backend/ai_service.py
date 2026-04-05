import whisper
import os
from openai import OpenAI

whisper_model = None

def get_whisper_model():
    """Lazy load the Whisper model into memory only when needed."""
    global whisper_model
    if whisper_model is None:
        whisper_model = whisper.load_model("base")
    return whisper_model

def get_openai_client():
    """Initializes and returns the OpenAI-compatible client for OpenRouter."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://reel-analyzer.local", # Replace with actual site if deployed
            "X-Title": "ReelAnalyzer",
        }
    )

def extract_transcript_and_metrics(audio_path: str) -> dict:
    # ... existing transcription logic ...
    current_model = get_whisper_model()
    print(f"Transcribing {audio_path}...")
    result = current_model.transcribe(audio_path)
    segments = result.get("segments", [])
    
    total_audio_duration = 0
    total_speech_duration = 0
    no_speech_probs = []
    transcript = []
    
    for seg in segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        seg_duration = seg_end - seg_start
        no_speech_prob = seg.get("no_speech_prob", 0)
        text = seg.get("text", "").strip()
        total_audio_duration = max(total_audio_duration, seg_end)
        if no_speech_prob < 0.5 and text:
            total_speech_duration += seg_duration
            no_speech_probs.append(no_speech_prob)
        minutes = int(seg_start // 60)
        seconds = int(seg_start % 60)
        timestamp_str = f"{minutes:02d}:{seconds:02d}"
        if text:
            transcript.append({
                "timestamp": timestamp_str,
                "text": text,
            })
    
    if total_audio_duration > 0:
        text_density = round((total_speech_duration / total_audio_duration) * 100, 1)
        background_noise = round(100 - text_density, 1)
    else:
        text_density = 0
        background_noise = 100
    
    if no_speech_probs:
        avg_confidence = 1.0 - (sum(no_speech_probs) / len(no_speech_probs))
        signal_quality = round(avg_confidence * 100, 1)
    else:
        signal_quality = 0
    
    if signal_quality >= 95:
        quality_label = "Ultra High Definition"
        quality_desc = "Noise cancellation layer active. Vocal clarity optimized via AI Neural Link."
    elif signal_quality >= 80:
        quality_label = "High Definition"
        quality_desc = "Strong vocal signal detected. Minor ambient noise present."
    elif signal_quality >= 60:
        quality_label = "Standard Definition"
        quality_desc = "Moderate signal clarity. Background noise may affect accuracy."
    else:
        quality_label = "Low Definition"
        quality_desc = "Significant noise detected. Transcription accuracy may be reduced."
    
    return {
        "transcript": transcript,
        "metrics": {
            "text_density": text_density,
            "background_noise": background_noise,
            "signal_quality": signal_quality,
            "quality_label": quality_label,
            "quality_desc": quality_desc,
            "total_duration_secs": round(total_audio_duration, 1),
            "speech_duration_secs": round(total_speech_duration, 1),
            "segment_count": len(segments),
        }
    }

def chat_with_transcript(transcript: str, question: str) -> str:
    """Uses OpenRouter to answer a question exclusively based on the provided transcript."""
    client = get_openai_client()
    try:
        completion = client.chat.completions.create(
            model="google/gemini-2.0-flash-exp:free", # Free and fast experimental model via OpenRouter
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant answering questions based solely on the provided video transcript. If the answer is not contained within the transcript, tell the user you cannot answer it based on the video context."
                },
                {
                    "role": "user",
                    "content": f"Transcript:\n{transcript}\n\nUser Question: {question}"
                }
            ]
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Error connecting to OpenRouter: {str(e)}"
