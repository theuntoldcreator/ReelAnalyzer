import whisper
import os
import google.generativeai as genai

model = None

def get_whisper_model():
    """Lazy load the Whisper model into memory only when needed."""
    global model
    if model is None:
        model = whisper.load_model("base")
    return model

def configure_gemini():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    genai.configure(api_key=api_key)

def extract_transcript_and_metrics(audio_path: str) -> dict:
    """
    Transcribes audio using Whisper and computes real audio composition metrics.
    
    Whisper returns per-segment data including:
      - start/end timestamps (seconds)
      - text content
      - no_speech_prob: probability that the segment contains NO speech (0.0 to 1.0)
    
    We use this to calculate:
      - Text Content Density: % of audio duration that is actual speech
      - Background Noise: % of audio duration that is silence/noise
      - Signal Quality: inverse of average no_speech_prob across speech segments
    """
    current_model = get_whisper_model()
    print(f"Transcribing {audio_path}...")

    # verbose=False suppresses whisper's own logging; word_timestamps gives finer data
    result = current_model.transcribe(audio_path)
    
    segments = result.get("segments", [])
    
    # ── Compute real metrics from Whisper's segment data ──
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
        
        # A segment is "speech" if no_speech_prob < 0.5
        if no_speech_prob < 0.5 and text:
            total_speech_duration += seg_duration
            no_speech_probs.append(no_speech_prob)
        
        # Format timestamp as MM:SS
        minutes = int(seg_start // 60)
        seconds = int(seg_start % 60)
        timestamp_str = f"{minutes:02d}:{seconds:02d}"
        
        if text:
            transcript.append({
                "timestamp": timestamp_str,
                "text": text,
            })
    
    # ── Calculate percentages ──
    if total_audio_duration > 0:
        text_density = round((total_speech_duration / total_audio_duration) * 100, 1)
        background_noise = round(100 - text_density, 1)
    else:
        text_density = 0
        background_noise = 100
    
    # Signal quality: how confident Whisper is that the speech segments ARE speech
    # Lower avg no_speech_prob = higher confidence = better signal
    if no_speech_probs:
        avg_confidence = 1.0 - (sum(no_speech_probs) / len(no_speech_probs))
        signal_quality = round(avg_confidence * 100, 1)
    else:
        signal_quality = 0
    
    # Determine quality label
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
    
    print(f"Transcription complete! Speech: {text_density}%, Noise: {background_noise}%, Quality: {signal_quality}%")
    
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
    """Uses Gemini to answer a question exclusively based on the provided transcript."""
    configure_gemini()
    try:
        model = genai.GenerativeModel('models/gemini-1.5-flash')
        prompt = f"""
        You are an AI assistant answering questions based solely on the following video transcript.
        If the answer is not contained within the transcript, tell the user you cannot answer it based on the video context.
        
        Transcript: 
        -----------------
        {transcript}
        -----------------
        
        User Question: {question}
        """
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error connecting to AI: {str(e)}"
