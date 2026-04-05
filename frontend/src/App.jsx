import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';

// Strip ANSI escape codes from backend error messages
const stripAnsi = (str) => str.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[0;[0-9]+m/g, '').replace(/\[0m/g, '');

function App() {
  const [url, setUrl] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Progress State
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  // Countdown timer — starts at BASE_TIME, driven by progress %
  const BASE_TIME = 60; // base countdown in seconds
  const [displaySecs, setDisplaySecs] = useState(BASE_TIME);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (loading) {
      // Target remaining = BASE_TIME mapped inversely to progress
      const targetSecs = Math.max(0, Math.ceil(BASE_TIME * (1 - progressPct / 100)));
      
      // Smoothly animate toward target (tick down fast when target drops quickly)
      const animate = () => {
        setDisplaySecs(prev => {
          if (prev <= targetSecs) return targetSecs;
          // Drop by 1 each frame-tick, creating the countdown feel
          return prev - 1;
        });
      };

      // Clear any existing timer and set new one
      if (animFrameRef.current) clearInterval(animFrameRef.current);
      
      // Speed: count faster as we approach completion
      // Early (0-40%): slow, steady countdown
      // Mid (40-70%): picking up
      // Late (70-90%): fast
      // Final (90%+): blazing fast rush to zero
      let speed = 800;
      if (progressPct >= 95) speed = 50;
      else if (progressPct >= 90) speed = 50;
      else if (progressPct >= 80) speed = 80;
      else if (progressPct >= 70) speed = 150;
      else if (progressPct > 40) speed = 400;

      animFrameRef.current = setInterval(animate, speed);
    } else {
      if (animFrameRef.current) clearInterval(animFrameRef.current);
      setDisplaySecs(0);
    }
    return () => { if (animFrameRef.current) clearInterval(animFrameRef.current); };
  }, [loading, progressPct]);

  // Reset countdown when starting a new extraction
  useEffect(() => {
    if (loading && progressPct === 0) setDisplaySecs(BASE_TIME);
  }, [loading]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Data State
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const videoRef = useRef(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Analysis complete. Would you like me to summarize the key technical points or identify specific action items?' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ─── SSE Stream Consumer ───
  const processSSEStream = async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const match = block.match(/event: (.*)\ndata: (.*)/s);
        if (match && match.length === 3) {
          const eventName = match[1].trim();
          const data = JSON.parse(match[2]);

          if (eventName === 'progress') {
            setProgressMsg(data.message);
            setProgressPct(data.percentage);
          } else if (eventName === 'error') {
            setError(stripAnsi(data.detail || 'Unknown error'));
            setLoading(false);
          } else if (eventName === 'complete') {
            setInsights(data);
            // Use the server-provided video URL if no blob was created (URL extraction)
            if (data.video_url && !videoSrc) {
              setVideoSrc(data.video_url);
            }
            setLoading(false);
          }
        }
      }
    }
  };

  // ─── API Calls ───
  const fetchInsightsFromURL = async () => {
    if (!url) return;
    setLoading(true); setError(null); setInsights(null);
    setProgressPct(0); setProgressMsg('Connecting to engine...');
    try {
      const res = await fetch('https://theuntoldcreator1999-reelanalyzer.hf.space/api/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      await processSSEStream(res);
    } catch (err) { setError(stripAnsi(err.message)); setLoading(false); }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Create a local blob URL so we can play the video immediately
    const blobUrl = URL.createObjectURL(file);
    setVideoSrc(blobUrl);
    
    setLoading(true); setError(null); setInsights(null);
    setProgressPct(0); setProgressMsg('Uploading file data...');
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('https://theuntoldcreator1999-reelanalyzer.hf.space/api/analyze/upload', {
        method: 'POST', body: fd
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      await processSSEStream(res);
    } catch (err) { setError(stripAnsi(err.message)); setLoading(false); }
  };

  const submitChat = async () => {
    if (!chatInput.trim() || !insights) return;
    const userMsg = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput(''); setChatLoading(true);
    try {
      const fullText = insights.transcript.map(t => `[${t.timestamp}] ${t.text}`).join('\n');
      const res = await fetch('https://theuntoldcreator1999-reelanalyzer.hf.space/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript_text: fullText, question: userMsg })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Sorry, I had an error responding.' }]);
    } finally { setChatLoading(false); }
  };

  const resetToHome = () => {
    setInsights(null); setError(null); setUrl('');
    setProgressPct(0); setProgressMsg('');
    if (videoSrc && videoSrc.startsWith('blob:')) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setChatHistory([
      { role: 'ai', text: 'Analysis complete. Would you like me to summarize the key technical points or identify specific action items?' }
    ]);
    setMobileMenuOpen(false);
  };

  // ─── Animation Variants ───
  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } }
  };
  const itemVars = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } }
  };

  // ─── Sidebar content ───
  const SidebarContent = ({ collapsed = false }) => {
    const linkBase = `flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-all duration-200 ${collapsed ? 'justify-center' : ''}`;
    const labelClass = `font-headline uppercase text-[10px] tracking-widest ${collapsed ? 'hidden' : ''}`;

    return (
      <>
        {/* Core Processor Widget */}
        <div className={`px-3 py-4 mb-4 bg-surface-container-low rounded-xl ${collapsed ? 'px-2 py-3' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-[8px] bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            </div>
            {!collapsed && (
              <div>
                <p className="font-headline uppercase text-[10px] tracking-widest text-on-surface font-bold">Core Processor</p>
                <p className="text-[10px] text-on-surface-variant">Active Nodes: 12</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <a href="#" className={`${linkBase} text-on-surface-variant hover:bg-surface-container-high/50`} title="Projects">
            <span className="material-symbols-outlined text-[20px] shrink-0">folder</span>
            <span className={labelClass}>Projects</span>
          </a>
          <a href="#" className={`${linkBase} bg-primary/5 text-primary`} title="Neural Net">
            <span className="material-symbols-outlined text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            <span className={labelClass}>Neural Net</span>
          </a>
          <a href="#" className={`${linkBase} text-on-surface-variant hover:bg-surface-container-high/50`} title="Batch Process">
            <span className="material-symbols-outlined text-[20px] shrink-0">layers</span>
            <span className={labelClass}>Batch Process</span>
          </a>
          <a href="#" className={`${linkBase} text-on-surface-variant hover:bg-surface-container-high/50`} title="Export">
            <span className="material-symbols-outlined text-[20px] shrink-0">ios_share</span>
            <span className={labelClass}>Export</span>
          </a>
          <a href="#" className={`${linkBase} text-on-surface-variant hover:bg-surface-container-high/50`} title="Team">
            <span className="material-symbols-outlined text-[20px] shrink-0">group</span>
            <span className={labelClass}>Team</span>
          </a>
        </nav>

        <button onClick={resetToHome}
          className={`w-full bg-gradient-to-br from-primary to-primary-container text-white py-3 rounded-xl font-headline text-[11px] uppercase tracking-[0.1em] font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform ${collapsed ? 'px-0' : ''}`}
          title="New Analysis">
          {collapsed ? (
            <span className="material-symbols-outlined text-[20px]">add</span>
          ) : 'New Analysis'}
        </button>

        <div className="pt-4 mt-4 border-t border-outline-variant/10">
          <a href="#" className={`${linkBase} text-on-surface-variant hover:bg-surface-container-high/50`} title="Support">
            <span className="material-symbols-outlined text-[20px] shrink-0">help</span>
            <span className={labelClass}>Support</span>
          </a>
          <a href="#" className={`${linkBase} text-on-surface-variant hover:bg-surface-container-high/50`} title="Account">
            <span className="material-symbols-outlined text-[20px] shrink-0">account_circle</span>
            <span className={labelClass}>Account</span>
          </a>
        </div>
      </>
    );
  };

  // ─── Render ───
  return (
    <div className="min-h-screen bg-surface text-on-background">

      {/* ══════════ Top Nav — fixed height, links vertically centered ══════════ */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-[0px_1px_0px_rgba(171,173,175,0.1)] h-16">
        <div className="flex justify-between items-center h-full px-6">
          <div className="flex items-center gap-8 h-full">
            {/* Mobile hamburger */}
            <button className="lg:hidden material-symbols-outlined text-on-surface-variant"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? 'close' : 'menu'}
            </button>

            <span className="text-xl font-bold text-on-background font-headline tracking-tight cursor-pointer" onClick={resetToHome}>Aetheris Vision</span>

            {/* Desktop nav links — each link fills the full nav height so underline sits flush on bottom */}
            <div className="hidden md:flex gap-6 h-full">
              <a href="#" className="h-full flex items-center text-on-surface-variant font-headline tracking-tight hover:text-primary transition-colors text-sm">Dashboard</a>
              <a href="#" className="h-full flex items-center text-primary font-headline tracking-tight text-sm border-b-2 border-primary">Analytics</a>
              <a href="#" className="h-full flex items-center text-on-surface-variant font-headline tracking-tight hover:text-primary transition-colors text-sm">Library</a>
              <a href="#" className="h-full flex items-center text-on-surface-variant font-headline tracking-tight hover:text-primary transition-colors text-sm">Archive</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">notifications</button>
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">settings</button>
            <div className="w-8 h-8 rounded-[50%] overflow-hidden border border-outline-variant/20">
              <img alt="User" src="https://ui-avatars.com/api/?name=PV&background=4647d3&color=fff&bold=true" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════ Mobile Sidebar Overlay ══════════ */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-surface z-50 flex flex-col p-4 space-y-2 lg:hidden shadow-xl">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ══════════ Desktop Sidebar ══════════ */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-64px)] bg-[#f0f2f5] flex-col p-4 space-y-2 border-r-0 hidden lg:flex z-10 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[68px] items-center px-2' : 'w-64'
        }`}>
        <SidebarContent collapsed={sidebarCollapsed} />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center py-2 text-on-surface-variant hover:text-primary transition-colors rounded-[8px] hover:bg-surface-container-high/50"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <span className="material-symbols-outlined text-[18px]">
            {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </aside>

      {/* ══════════ Main Content Canvas ══════════ */}
      <main className={`mt-16 p-8 min-h-[calc(100vh-64px)] transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'ml-0 lg:ml-[68px]' : 'ml-0 lg:ml-64'
      }`}>
        <div className="max-w-[1400px] mx-auto">

          {/* ──── Pre-Extraction: Input Gateway ──── */}
          {!insights && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto mt-[15vh]">
              <div className="bg-surface-container-lowest rounded-2xl p-10 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] flex flex-col items-center gap-8">
                <div className="w-20 h-20 rounded-[50%] bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-4xl">hub</span>
                </div>
                <div className="text-center space-y-2">
                  <h1 className="text-3xl font-headline font-bold tracking-tight text-on-background">Initiate Neural Extraction</h1>
                  <p className="text-sm text-on-surface-variant font-body leading-relaxed max-w-md">
                    Provide a video URL or upload a file to begin high-fidelity transcription via local Whisper engine.
                  </p>
                </div>
                <div className="w-full flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-surface-container-low rounded-xl px-4 py-2 flex items-center gap-3 ghost-border focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary transition-shadow">
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">link</span>
                    <input
                      type="text" value={url} onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') fetchInsightsFromURL(); }}
                      placeholder="Enter video URL..."
                      className="bg-transparent border-none outline-none w-full text-sm font-body font-medium text-on-surface placeholder:text-on-surface-variant/60"
                    />
                  </div>
                  <button onClick={fetchInsightsFromURL}
                    className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded-xl font-headline text-[11px] uppercase tracking-[0.1em] font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform whitespace-nowrap">
                    Extract
                  </button>
                  <label className="bg-surface-container-low ghost-border rounded-xl px-4 py-3 flex justify-center items-center cursor-pointer hover:bg-surface-container-high transition-colors active:scale-95">
                    <span className="material-symbols-outlined text-on-surface-variant">upload_file</span>
                    <input type="file" className="hidden" accept="video/*,audio/*" onChange={uploadFile} ref={fileInputRef} />
                  </label>
                </div>
                {error && (
                  <div className="w-full p-4 bg-error/5 text-error rounded-xl text-sm font-body font-medium ghost-border">
                    {error}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ──── Loading: Countdown Timer ──── */}
          {loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto mt-[20vh]">
              <div className="bg-surface-container-lowest rounded-2xl p-12 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] flex flex-col items-center gap-8">
                <div className="w-24 h-24 rounded-[50%] bg-primary/10 flex flex-col items-center justify-center text-primary">
                  <span className="font-headline font-bold text-3xl tracking-tight text-primary leading-none">{formatTime(displaySecs)}</span>
                  <span className="text-[9px] font-headline uppercase tracking-widest text-primary/60 mt-1">remaining</span>
                </div>
                <div className="w-full space-y-4">
                  <p className="text-center text-sm font-body font-semibold text-on-background">{progressMsg || 'Initializing...'}</p>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-[9999px] overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-primary-container rounded-[9999px]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ ease: 'easeInOut', duration: 0.5 }}
                    />
                  </div>
                  <p className="text-center text-[10px] font-headline uppercase tracking-widest text-on-surface-variant/50">Estimated time remaining — do not close tab</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──── Post-Extraction: Full Dashboard ──── */}
          {insights && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
              className="grid grid-cols-12 gap-6">

              {/* Header across full width */}
              <header className="col-span-12 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-[9999px] text-[10px] font-headline font-bold tracking-wider uppercase">Neural Processing</span>
                  <span className="text-on-surface-variant text-[10px] font-headline tracking-widest uppercase opacity-60">ID: VX-9902</span>
                </div>
                <h1 className="text-4xl font-headline font-bold tracking-tight text-on-background">Video-to-Text Analysis</h1>
              </header>

              {/* ═══ Left Column: Video + Metrics ═══ */}
              <section className="col-span-12 lg:col-span-8 space-y-6">
                {/* Video Player — Real Playback */}
                <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm relative">
                  <div className="w-full relative bg-black flex items-center justify-center">
                    {videoSrc ? (
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        controls
                        className="w-full max-h-[60vh] object-contain rounded-2xl bg-black"
                        playsInline
                      />
                    ) : (
                      <div className="aspect-video w-full flex items-center justify-center bg-surface-container-highest/30">
                        <div className="text-center text-on-surface-variant/40 space-y-2">
                          <span className="material-symbols-outlined text-5xl">videocam_off</span>
                          <p className="text-xs font-headline uppercase tracking-widest">No video loaded</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hardware Diagnostics — Real Data from Whisper */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Audio Composition */}
                  <div className="bg-surface-container-low p-6 rounded-2xl ghost-border">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-headline text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Audio Composition</span>
                      <span className="material-symbols-outlined text-primary text-sm">equalizer</span>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-semibold font-body">Background Noise</span>
                          <span className="text-sm font-headline text-primary">{insights.metrics?.background_noise ?? 0}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-[9999px] overflow-hidden">
                          <motion.div
                            className="h-full bg-primary-container rounded-[9999px]"
                            initial={{ width: 0 }}
                            animate={{ width: `${insights.metrics?.background_noise ?? 0}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-semibold font-body">Text Content Density</span>
                          <span className="text-sm font-headline text-primary">{insights.metrics?.text_density ?? 0}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-[9999px] overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-[9999px]"
                            initial={{ width: 0 }}
                            animate={{ width: `${insights.metrics?.text_density ?? 0}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Signal Quality */}
                  <div className="bg-surface-container-low p-6 rounded-2xl ghost-border flex flex-col justify-center">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="font-headline text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Signal Quality</p>
                        <h3 className="text-2xl font-headline font-bold text-on-background">{insights.metrics?.quality_label ?? 'Analyzing...'}</h3>
                        <p className="text-xs text-on-surface-variant leading-relaxed mt-1 font-body">{insights.metrics?.quality_desc ?? ''}</p>
                      </div>
                      <div className="w-16 h-16 rounded-[50%] border-4 border-primary/20 border-t-primary flex items-center justify-center shrink-0">
                        <span className="text-xs font-headline font-bold">{insights.metrics?.signal_quality ?? 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ═══ Right Column: Transcript + Chat ═══ */}
              <section className="col-span-12 lg:col-span-4 space-y-6 flex flex-col">

                {/* Transcription Output — fixed frame, scroll inside */}
                <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="font-headline font-bold text-on-background flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">description</span>
                      Transcription Output
                    </h2>
                    <button
                      onClick={() => {
                        const text = insights.transcript.map(t => `[${t.timestamp}] ${t.text}`).join('\n');
                        navigator.clipboard.writeText(text);
                      }}
                      className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors" title="Copy to clipboard">
                      content_copy
                    </button>
                  </div>
                  <motion.div variants={containerVars} initial="hidden" animate="show"
                    className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 min-h-0">
                    {insights.transcript.map((item, i) => (
                      <motion.p key={i} variants={itemVars} className="text-sm leading-8 text-on-surface-variant font-body">
                        <span className="text-primary font-bold">[{item.timestamp}]</span>{' '}
                        {item.text}
                      </motion.p>
                    ))}
                    {insights.transcript.length === 0 && (
                      <p className="text-sm text-on-surface-variant italic font-body">No dialogue detected in this content.</p>
                    )}
                  </motion.div>
                  <div className="mt-4 pt-4 border-t border-outline-variant/10 flex gap-2">
                    <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-[9999px] text-[10px] font-headline tracking-wider uppercase font-bold cursor-pointer hover:bg-surface-container-high transition-colors">Export PDF</span>
                    <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-[9999px] text-[10px] font-headline tracking-wider uppercase font-bold cursor-pointer hover:bg-surface-container-high transition-colors">JSON Mapping</span>
                  </div>
                </div>

                {/* Context Discussion */}
                <div className="bg-surface-container-low rounded-2xl p-6 shadow-sm ghost-border flex flex-col max-h-[350px]">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
                    <h2 className="font-headline font-bold text-on-background">Context Discussion</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 pr-2">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-[50%] flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-secondary-container' : 'bg-primary'}`}>
                          <span className={`material-symbols-outlined text-sm ${msg.role === 'ai' ? 'text-on-secondary-container' : 'text-white'}`}>
                            {msg.role === 'ai' ? 'smart_toy' : 'person'}
                          </span>
                        </div>
                        <div className={`p-3 rounded-2xl shadow-sm max-w-[80%] ${
                          msg.role === 'ai'
                            ? 'bg-white border border-outline-variant/5 rounded-tl-none'
                            : 'bg-primary-container/20 rounded-tr-none'
                        }`}>
                          <p className="text-xs leading-relaxed text-on-surface font-body">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-[50%] bg-secondary-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-sm text-on-secondary-container">smart_toy</span>
                        </div>
                        <div className="bg-white border border-outline-variant/5 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5 h-10">
                          <div className="w-1.5 h-1.5 rounded-[50%] bg-primary/40 animate-bounce"></div>
                          <div className="w-1.5 h-1.5 rounded-[50%] bg-primary/40 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1.5 h-1.5 rounded-[50%] bg-primary/40 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef}></div>
                  </div>
                  <div className="relative">
                    <input
                      type="text" value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitChat(); }}
                      placeholder="Ask about the content..."
                      disabled={chatLoading}
                      className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-10 font-body transition-shadow"
                    />
                    <button onClick={submitChat} disabled={chatLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary disabled:opacity-40">
                      send
                    </button>
                  </div>
                </div>
              </section>

            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
