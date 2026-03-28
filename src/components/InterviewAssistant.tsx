import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  X, 
  Maximize2, 
  Minimize2, 
  Copy, 
  CheckCircle2, 
  Bot, 
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import jsPDF from 'jspdf';

interface Message {
  id: string;
  role: 'transcript' | 'assistant';
  content: string;
  timestamp: Date;
}

export function InterviewAssistant({ onClose }: { onClose: () => void }) {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [resumeContext, setResumeContext] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'openai' | 'kimi' | 'grok'>('gemini');
  const [fuel, setFuel] = useState<number>(100);
  const [notification, setNotification] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [micStatus, setMicStatus] = useState<'idle' | 'active' | 'error' | 'starting'>('idle');
  const [soundLevel, setSoundLevel] = useState(0);

  const isMutedRef = useRef(isMuted);
  const isListeningRef = useRef(isListening);
  const shouldBeListeningRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
    isListeningRef.current = isListening;
  }, [isMuted, isListening]);
  
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const restartAttemptsRef = useRef(0);
  const maxRestarts = 50; // Allow many restarts before giving up

  // Audio context for visual feedback
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const fetchContext = async () => {
      try {
        const userData = await api.getUser();
        setUser(userData);
        setFuel(userData.fuel || 0);
        if (userData.preferredProvider) {
          setProvider(userData.preferredProvider);
        }
        if (userData.resumes && userData.resumes.length > 0) {
          const combined = userData.resumes.map((r: any) => `[Resume: ${r.name}]\n${r.text}`).join('\n\n---\n\n');
          setResumeContext(combined);
        } else {
          setResumeContext(userData.resumeText || '');
        }
      } catch (error) {
        console.error('Error fetching context:', error);
      }
    };
    fetchContext();

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Setup audio visualizer for mic feedback
  const setupAudioVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setSoundLevel(Math.min(avg / 128, 1)); // Normalize 0-1
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('Audio visualizer setup failed:', e);
    }
  }, []);

  // Initialize Speech Recognition
  const initRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setNotification('⚠️ Speech Recognition not supported in this browser. Use Chrome/Edge.');
      setMicStatus('error');
      return null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Better for Indian accent + Hinglish
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[MIC] Recognition started');
      setMicStatus('active');
      restartAttemptsRef.current = 0;
    };

    recognition.onresult = (event: any) => {
      if (isMutedRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show interim results in real-time
      if (interimTranscript) {
        setCurrentTranscript(transcriptBufferRef.current + ' ' + interimTranscript);
      }

      if (finalTranscript) {
        transcriptBufferRef.current += ' ' + finalTranscript;
        setCurrentTranscript(transcriptBufferRef.current);
        
        // Reset silence timer - wait 2 seconds for complete sentence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (transcriptBufferRef.current.trim()) {
            const fullQuestion = transcriptBufferRef.current.trim();
            console.log('[MIC] Sending complete question:', fullQuestion);
            handleProcessQuestion(fullQuestion);
            transcriptBufferRef.current = '';
            setCurrentTranscript('');
          }
        }, 2000); // 2 seconds silence = question complete
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[MIC] Error:', event.error);
      
      if (event.error === 'aborted') {
        // Expected when we manually stop - don't show error
        return;
      }
      
      if (event.error === 'not-allowed') {
        setMicStatus('error');
        setIsListening(false);
        shouldBeListeningRef.current = false;
        setNotification('🎤 Microphone blocked! Allow mic access in browser settings.');
        return;
      }
      
      if (event.error === 'no-speech') {
        // Normal - no speech detected, will auto-restart
        console.log('[MIC] No speech detected, continuing...');
        return;
      }

      if (event.error === 'network') {
        setNotification('⚠️ Network error - check your internet connection.');
        return;
      }
    };

    recognition.onend = () => {
      console.log('[MIC] Recognition ended, shouldBe:', shouldBeListeningRef.current);
      
      if (shouldBeListeningRef.current && restartAttemptsRef.current < maxRestarts) {
        restartAttemptsRef.current++;
        const delay = Math.min(300 * restartAttemptsRef.current, 2000);
        
        setTimeout(() => {
          if (shouldBeListeningRef.current && recognitionRef.current) {
            try {
              console.log(`[MIC] Restarting (attempt ${restartAttemptsRef.current})...`);
              recognitionRef.current.start();
            } catch (e: any) {
              console.error('[MIC] Restart failed:', e.message);
              // If it's already started, that's fine
              if (!e.message?.includes('already started')) {
                setMicStatus('error');
                setNotification('⚠️ Mic restart failed. Tap the mic button to retry.');
              }
            }
          }
        }, delay);
      } else if (restartAttemptsRef.current >= maxRestarts) {
        setMicStatus('error');
        setIsListening(false);
        shouldBeListeningRef.current = false;
        setNotification('⚠️ Mic keeps disconnecting. Check permissions and try again.');
      } else {
        setMicStatus('idle');
      }
    };

    return recognition;
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    console.log('[MIC] Starting...');
    setMicStatus('starting');
    
    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }
    
    if (!recognitionRef.current) return;

    shouldBeListeningRef.current = true;
    restartAttemptsRef.current = 0;

    try {
      recognitionRef.current.start();
      setIsListening(true);
      setupAudioVisualizer();
    } catch (e: any) {
      console.error('[MIC] Start error:', e.message);
      if (e.message?.includes('already started')) {
        setIsListening(true);
        setMicStatus('active');
      } else {
        setMicStatus('error');
        setNotification('⚠️ Could not start mic. Check browser permissions.');
      }
    }
  }, [initRecognition, setupAudioVisualizer]);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[MIC] Stopping...');
    shouldBeListeningRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
    
    setIsListening(false);
    setMicStatus('idle');
    
    // Process any remaining buffer
    if (transcriptBufferRef.current.trim()) {
      handleProcessQuestion(transcriptBufferRef.current.trim());
      transcriptBufferRef.current = '';
      setCurrentTranscript('');
    }

    // Cleanup audio visualizer
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Toggle mute (keeps mic running but ignores input)
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    
    if (newMuted) {
      // Clear any pending buffer when muting
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      transcriptBufferRef.current = '';
      setCurrentTranscript('');
      setNotification('🔇 Muted - Mic paused');
    } else {
      setNotification('🔊 Unmuted - Listening again!');
      // If not currently listening, auto-start
      if (!isListening) {
        startListening();
      }
    }
    
    // Auto-dismiss notification
    setTimeout(() => setNotification(null), 2000);
  }, [isMuted, isListening, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript]);

  const handleProcessQuestion = async (question: string) => {
    if (!question) return;

    const newQuestionMsg: Message = {
      id: Date.now().toString(),
      role: 'transcript',
      content: question,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newQuestionMsg]);
    setIsProcessing(true);

    setTimeout(() => {
      const el = document.getElementById(`thread-${newQuestionMsg.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    try {
      const res = await api.generateAIResponse(question, resumeContext, provider);
      const answerText = res.text;
      if (res.fuel !== undefined) setFuel(res.fuel);

      if (answerText === 'IGNORE' || answerText.startsWith('IGNORE')) {
        setIsProcessing(false);
        return;
      }

      const newAnswerMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answerText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newAnswerMsg]);
    } catch (error: any) {
      console.error('AI Error:', error);
      const errorMsg = error.message?.includes('Fuel') 
        ? '⚠️ Out of Fuel! Refill in Profile or add your own Key.'
        : `⚠️ ${error.message || 'The scribe is stuck.'}`;

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSend = () => {
    if (!manualInput.trim()) return;
    handleProcessQuestion(manualInput.trim());
    setManualInput('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEndSession = async () => {
    // Stop recognition first
    stopListening();
    
    if (messages.length === 0) {
      onClose();
      return;
    }

    try {
      const transcriptText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const { summary } = await api.summarizeInterview(transcriptText, provider);

      await api.createInterview({
        title: `Draft Session - ${new Date().toLocaleTimeString()}`,
        transcript: messages.map(m => ({
          speaker: m.role,
          text: m.content,
          timestamp: m.timestamp.toISOString()
        })),
        summary: summary,
        language: 'en'
      });

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error: any) {
      console.error('Error saving session:', error);
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Interview Sketch', 20, 20);
    doc.setFontSize(10);
    let y = 30;
    messages.forEach((msg) => {
      const role = msg.role === 'transcript' ? 'Heard:' : 'Scribe:';
      const text = doc.splitTextToSize(`${role} ${msg.content}`, 170);
      if (y + (text.length * 5) > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += (text.length * 5) + 5;
    });
    doc.save('interview-sketch.pdf');
  };

  // Mic status indicator color
  const getMicColor = () => {
    switch (micStatus) {
      case 'active': return isMuted ? 'bg-yellow-500' : 'bg-green-500';
      case 'starting': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  const getMicStatusText = () => {
    if (isMuted) return '[ MUTED ] Tap unmute to listen';
    switch (micStatus) {
      case 'active': return '🟢 LIVE — Listening actively';
      case 'starting': return '🔵 Starting mic...';
      case 'error': return '🔴 Mic error — tap to retry';
      default: return '⚫ Mic off — tap to start';
    }
  };

  return (
    <div 
      ref={nodeRef} 
      className={cn(
        "bg-white flex flex-col transition-all duration-500 overflow-hidden relative",
        isMinimized ? "fixed bottom-20 right-4 w-40 h-56 border-4 border-black shadow-sketch z-50 rounded-lg" : "h-full w-full"
      )}
    >
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] bg-yellow-400 border-4 border-black hand-drawn px-6 py-2 font-bold shadow-sketch whitespace-nowrap text-xs"
          >
            {notification}
            <button onClick={() => setNotification(null)} className="ml-4 hover:scale-125 transition-transform">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header / Status Bar */}
      <div className="bg-black text-white p-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 px-2">
          {!isMinimized && (
            <div className="flex items-center gap-2">
              <div className={cn("w-2.5 h-2.5 rounded-full transition-colors", getMicColor(), micStatus === 'active' && !isMuted && "animate-pulse")} />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                {isMuted ? 'Muted' : micStatus === 'active' ? 'LIVE 🎙️' : micStatus === 'starting' ? 'Starting...' : 'Offline'}
              </span>
              {isListening && !isMuted && (
                 <div className="flex gap-0.5 ml-1 items-end h-3">
                    <motion.div animate={{ height: [2, 8 + soundLevel * 8, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-0.5 bg-green-500 rounded-full" />
                    <motion.div animate={{ height: [4, 2, 8 + soundLevel * 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-green-400 rounded-full" />
                    <motion.div animate={{ height: [6, 4 + soundLevel * 8, 2] }} transition={{ repeat: Infinity, duration: 0.3 }} className="w-0.5 bg-green-500 rounded-full" />
                    <motion.div animate={{ height: [3, 7 + soundLevel * 6, 5] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-green-400 rounded-full" />
                 </div>
              )}
            </div>
          )}
          {!isMinimized && isProcessing && (
            <div className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Thinking...</span>
            </div>
          )}
          {!isMinimized && !isProcessing && messages.length > 0 && messages[messages.length-1].role === 'assistant' && (
             <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Ready</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            {isMinimized ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}
          </button>
          {!isMinimized && (
            <button 
              onClick={handleEndSession} 
              className="p-1 hover:text-red-500 transition-colors"
            >
              <X size={20}/>
            </button>
          )}
        </div>
      </div>

      {isMinimized ? (
        <div className="flex-1 flex flex-col items-center justify-center p-2 text-center bg-yellow-400 paper-dots" onClick={() => setIsMinimized(false)}>
           <Zap className="w-6 h-6 mb-1 text-black" />
           <p className="text-[8px] font-black uppercase tracking-tighter text-black">Live Pulse</p>
           {isProcessing && <div className="mt-1 w-3 h-3 border-2 border-black border-t-white rounded-full animate-spin" />}
        </div>
      ) : (
        <>
          {/* Mic Status Banner - always visible */}
          <div className={cn(
            "px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
            isMuted ? "bg-yellow-100 text-yellow-800" :
            micStatus === 'active' ? "bg-green-100 text-green-800" : 
            micStatus === 'error' ? "bg-red-100 text-red-800" :
            "bg-zinc-100 text-zinc-600"
          )}>
            {getMicStatusText()}
          </div>

          {/* Main Workspace - Adaptive Layout */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white paper-dots font-body selection:bg-yellow-300">
            {/* Threaded Conversations */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-8 custom-scrollbar space-y-8 lg:space-y-12">
              <div className="max-w-4xl mx-auto space-y-12 pb-60">
                {(() => {
                  const threads: { q?: Message; a?: Message }[] = [];
                  let currentThread: { q?: Message; a?: Message } = {};
                  
                  messages.forEach(m => {
                    if (m.role === 'transcript') {
                      if (currentThread.q) {
                        threads.push(currentThread);
                        currentThread = { q: m };
                      } else {
                        currentThread.q = m;
                      }
                    } else if (m.role === 'assistant') {
                      currentThread.a = m;
                      threads.push(currentThread);
                      currentThread = {};
                    }
                  });
                  if (currentThread.q || currentThread.a) threads.push(currentThread);

                  return threads.map((thread, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative"
                      id={thread.q ? `thread-${thread.q.id}` : undefined}
                    >
                      <div className="absolute left-4 lg:left-8 top-10 bottom-0 w-4 group-last:hidden overflow-hidden opacity-5 lg:opacity-10 pointer-events-none">
                         <svg width="20" height="100%" viewBox="0 0 20 100" preserveAspectRatio="none">
                            <path 
                               d="M10 0 Q 15 25, 10 50 T 10 100" 
                               fill="none" 
                               stroke="black" 
                               strokeWidth="2" 
                               vectorEffect="non-scaling-stroke"
                               className="animate-[pulse_4s_infinite]"
                            />
                         </svg>
                      </div>
                      
                      <div className="space-y-4">
                        {thread.q && (
                          <div className="flex items-start gap-3 lg:gap-6 max-w-[95%] lg:max-w-[80%]">
                             <div className="w-8 h-8 lg:w-12 lg:h-12 shrink-0 bg-white border-2 border-black flex items-center justify-center font-bold text-[10px] lg:text-xs rotate-[-3deg] shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                               Q
                             </div>
                             <div className="p-3 lg:p-6 bg-white border-2 border-black hand-drawn rotate-1 shadow-sketch">
                                <p className="text-xs lg:text-xl font-bold leading-relaxed">{thread.q.content}</p>
                             </div>
                          </div>
                        )}

                        {thread.a && (
                          <div className="flex items-start justify-end gap-3 lg:gap-6 ml-auto max-w-[98%] lg:max-w-[90%]">
                             <div className={cn(
                               "p-5 lg:p-8 border-2 lg:border-4 border-black shadow-sketch rotate-[-1deg] font-medium grow group/answer",
                               thread.a.content.includes('[GoogleGenerativeAI Error]') ? "bg-red-50 border-red-500" : "bg-yellow-400"
                             )}>
                                {thread.a.content.includes('[GoogleGenerativeAI Error]') ? (
                                   <div className="space-y-4">
                                      <div className="flex items-center gap-2 text-red-600 mb-2">
                                         <AlertCircle size={18} />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Inscribed Signal Lost [ Quota Failure ]</span>
                                      </div>
                                      <p className="text-[11px] lg:text-sm text-red-800 leading-relaxed font-semibold italic">The matrix has severed the connection. Please provide a fresh Super-Key to restore synchronization.</p>
                                      
                                      <div className="space-y-2 mt-4 p-4 bg-white border-2 border-dashed border-red-200 hand-drawn">
                                         <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Matrix Pulse Input</label>
                                         <textarea 
                                            placeholder="Paste fresh Gemini API keys here (comma separated)..."
                                            className="w-full h-20 p-3 text-[10px] font-mono bg-zinc-50 border-2 border-black focus:ring-4 focus:ring-red-100 outline-none"
                                            id={`recovery-key-${thread.a.id}`}
                                         />
                                         <button 
                                            id={`btn-reboot-${thread.a.id}`}
                                            onClick={async () => {
                                               const btn = document.getElementById(`btn-reboot-${thread.a.id}`);
                                               const val = (document.getElementById(`recovery-key-${thread.a.id}`) as HTMLTextAreaElement).value;
                                               if (val && btn) {
                                                  btn.innerHTML = "SYNCHRONIZING...";
                                                  btn.style.opacity = "0.5";
                                                  try {
                                                     await api.updateUser({ apiKeys: { ...user?.apiKeys, gemini: val } });
                                                     setNotification('Matrix Pulse Restored! 🚀');
                                                     setTimeout(() => window.location.reload(), 1000);
                                                  } catch (e) {
                                                     btn.innerHTML = "REBOOT FAILED - TRY AGAIN";
                                                     btn.style.opacity = "1";
                                                  }
                                               }
                                            }}
                                            className="w-full py-3 bg-black text-white font-bold text-xs uppercase tracking-[0.3em] hover:bg-red-600 transition-all hover:shadow-sketch active:scale-95"
                                         >
                                            REBOOT MATRIX
                                         </button>
                                      </div>
                                   </div>
                                ) : (
                                   <>
                                      <div className="flex items-center gap-2 mb-3 lg:mb-4">
                                         <Sparkles size={14} className="text-black/60" />
                                         <span className="text-[9px] lg:text-[11px] font-black uppercase tracking-widest opacity-50">High-Fidelity Scribe</span>
                                      </div>
                                      <p className="text-[12px] lg:text-2xl leading-relaxed lg:leading-normal whitespace-pre-wrap text-black font-semibold selection:bg-black selection:text-yellow-400">{thread.a.content}</p>
                                      <button 
                                         onClick={() => handleCopy(thread.a!.id, thread.a!.content)}
                                         className="mt-4 lg:mt-6 text-[9px] lg:text-[11px] font-black uppercase text-black/50 hover:text-black hover:underline flex items-center gap-2 transition-all active:scale-90"
                                      >
                                        {copiedId === thread.a.id ? <CheckCircle2 size={12}/> : <Copy size={12}/>}
                                        {copiedId === thread.a.id ? 'Sequence Copied' : 'Transfer Response'}
                                      </button>
                                   </>
                                )}
                             </div>
                             <div className={cn(
                               "w-8 h-8 lg:w-12 lg:h-12 shrink-0 flex items-center justify-center font-bold rotate-[4deg]",
                               thread.a.content.includes('[GoogleGenerativeAI Error]') ? "bg-red-600 text-white" : "bg-black text-white shadow-[2px_2px_0_0_rgba(250,204,21,1)]"
                             )}>
                                {thread.a.content.includes('[GoogleGenerativeAI Error]') ? '!' : 'A'}
                             </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ));
                })()}

                {currentTranscript && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 lg:p-6 bg-green-50 border-2 border-green-400 border-dashed max-w-[85%] rotate-1"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-green-600">Hearing you...</span>
                    </div>
                    <p className="text-[11px] lg:text-lg font-medium italic text-green-900">"{currentTranscript}..."</p>
                  </motion.div>
                )}

                {isProcessing && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                     <span className="w-48 h-1 bg-black/5 relative overflow-hidden rounded-full">
                        <motion.div animate={{ left: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-yellow-400" />
                     </span>
                     <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30 animate-pulse">Processing Ink</span>
                  </div>
                )}
                
                {messages.length === 0 && !currentTranscript && (
                  <div className="h-96 flex flex-col items-center justify-center text-center p-10">
                    <motion.div 
                      initial={{ scale: 0.9 }} 
                      animate={{ scale: 1 }} 
                      transition={{ repeat: Infinity, repeatType: 'reverse', duration: 2 }}
                      className="mb-8"
                    >
                      <Bot className="w-20 h-20 mx-auto mb-4 opacity-10" />
                    </motion.div>
                    <h3 className="text-3xl font-accent font-bold mb-4 italic opacity-40 leading-none">START SESSION [ SYNC ]</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30 mb-12">The Matrix is Ready to Scribe</p>
                    
                    {!isListening && (
                       <button 
                         onClick={startListening}
                         className="px-12 py-5 bg-black text-white font-bold text-2xl hover:bg-yellow-400 hover:text-black transition-all rotate-[-1deg] hand-drawn shadow-sketch uppercase active:scale-95"
                       >
                         START NOW [ SYNC ]
                       </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Controls - Always visible */}
          <div className="absolute bottom-0 left-0 right-0 z-50 pb-4 px-3">
            {/* Manual Text Input - Always visible */}
            <div className="flex gap-2 mb-3 max-w-[90%] mx-auto">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSend()}
                placeholder="Type a question manually..."
                className="flex-1 px-4 py-3 bg-white/90 backdrop-blur-xl border-2 border-black/10 rounded-full text-xs font-medium focus:border-black focus:outline-none transition-all shadow-lg"
              />
              <button
                onClick={handleManualSend}
                disabled={!manualInput.trim()}
                className="p-3 bg-black text-white rounded-full shadow-lg disabled:opacity-30 active:scale-90 transition-all hover:bg-yellow-400 hover:text-black"
              >
                <Send size={16} />
              </button>
            </div>
            
            {/* Main Controls */}
            <div className="flex items-center gap-3 max-w-[90%] mx-auto">
               <div className="flex-1 flex gap-2 p-2 bg-white/40 backdrop-blur-2xl border-2 border-black/5 rounded-[30px] shadow-2xl ring-1 ring-black/5">
                  <button 
                    onClick={toggleMute}
                    className={cn(
                      "flex-1 py-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
                      isMuted 
                        ? "bg-yellow-400 text-black shadow-lg" 
                        : "bg-white/80 text-black hover:bg-white"
                    )}
                  >
                    {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button 
                    onClick={handleEndSession}
                    className="flex-1 py-4 rounded-full bg-red-600 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:bg-red-700"
                  >
                     <X size={18}/>
                     End
                  </button>
               </div>
               
               {/* Mic Toggle Button */}
               <button 
                 onClick={toggleListening}
                 className={cn(
                   "p-5 rounded-full shadow-2xl active:scale-90 transition-all border-4",
                   isListening 
                     ? "bg-green-500 text-white border-green-300 animate-pulse" 
                     : "bg-black text-white border-white hover:bg-green-500"
                 )}
               >
                  {isListening ? <Mic size={24}/> : <MicOff size={24}/>}
               </button>
            </div>
          </div>
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
