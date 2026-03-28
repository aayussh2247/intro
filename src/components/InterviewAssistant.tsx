import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  X, 
  Maximize2, 
  Minimize2, 
  Copy, 
  CheckCircle2, 
  Settings, 
  FileText, 
  Bot, 
  Expand, 
  Shrink,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Zap,
  RotateCcw,
  AlertCircle
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
  const [isFullScreen, setIsFullScreen] = useState(false);
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

  const isMutedRef = useRef(isMuted);
  const isListeningRef = useRef(isListening);

  useEffect(() => {
    isMutedRef.current = isMuted;
    isListeningRef.current = isListening;
  }, [isMuted, isListening]);
  
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          if (isMutedRef.current) return;

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          setCurrentTranscript(interimTranscript);

          if (finalTranscript) {
            transcriptBufferRef.current += ' ' + finalTranscript;
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (transcriptBufferRef.current.trim()) {
                handleProcessQuestion(transcriptBufferRef.current.trim());
                transcriptBufferRef.current = '';
                setCurrentTranscript('');
              }
            }, 800); // Wait for full question to complete
          }
        };

        recognitionRef.current.lang = 'en-IN'; // Better for Hinglish/Indian accents

        recognitionRef.current.onerror = (event: any) => {
          if (event.error === 'aborted') return;
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') {
            setIsListening(false);
            // This is likely the 'listening' problem they have
            setNotification('Microphone Blocked 🎤! Please check browser permissions.');
          }
        };

        recognitionRef.current.onend = () => {
          if (isListeningRef.current) {
            setTimeout(() => {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.error('Restart error', e);
                }
            }, 300); // 300ms delay for more robust browser restarts
          }
        };
      }
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [isListening, isMuted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcriptBufferRef.current.trim()) {
        handleProcessQuestion(transcriptBufferRef.current.trim());
        transcriptBufferRef.current = '';
        setCurrentTranscript('');
      }
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error('Start error', e);
      }
    }
  };

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

    // Auto-scroll to the top of this new thread
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

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error: any) {
      console.error('Error saving session:', error);
      // Still close the session even if save fails
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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
              <div className={cn("w-1.5 h-1.5 rounded-full", isListening ? "bg-red-500 animate-pulse" : "bg-zinc-600")} />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {isListening ? 'Pulse Active' : 'Pulse Muted'}
              </span>
              {isListening && !isMuted && (
                 <div className="flex gap-0.5 ml-1">
                    <motion.div animate={{ height: [2, 8, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-red-500 rounded-full" />
                    <motion.div animate={{ height: [4, 2, 8] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-0.5 bg-red-400 rounded-full" />
                    <motion.div animate={{ height: [8, 4, 2] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-red-500 rounded-full" />
                 </div>
              )}
            </div>
          )}
          {!isMinimized && isProcessing && (
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Thinking...</span>
            </div>
          )}
          {!isMinimized && !isProcessing && messages.length > 0 && messages[messages.length-1].role === 'assistant' && (
             <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Answering</span>
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
          {/* Main Workspace - Adaptive Layout */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white paper-dots font-body selection:bg-yellow-300">
            {/* Threaded Conversations */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-8 custom-scrollbar space-y-8 lg:space-y-12">
              <div className="max-w-4xl mx-auto space-y-12 pb-60">
                {/* We need to group messages by pairing transcript and following assistant response */}
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
                      // Data attribute for scroll targeting
                      id={thread.q ? `thread-${thread.q.id}` : undefined}
                    >
                      {/* Spline Wavy Thread (SVG) */}
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
                        {/* Question (from Mic) */}
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
                  <div className="p-4 lg:p-6 bg-zinc-50 border-2 border-black border-dashed opacity-50 max-w-[85%] rotate-1">
                    <p className="text-[11px] lg:text-lg font-medium italic">"{currentTranscript}..."</p>
                  </div>
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
                         onClick={toggleListening}
                         className="px-12 py-5 bg-black text-white font-bold text-2xl hover:bg-yellow-400 hover:text-black transition-all rotate-[-1deg] hand-drawn shadow-sketch uppercase"
                       >
                         START NOW [ SYNC ]
                       </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating Controls Overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] flex items-center gap-3 z-50">
             <div className="flex-1 flex gap-2 p-2 bg-white/40 backdrop-blur-2xl border-2 border-black/5 rounded-[30px] shadow-2xl ring-1 ring-black/5">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
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
             
             {!isListening && (
                <button 
                  onClick={toggleListening}
                  className="p-5 bg-black text-white rounded-full shadow-2xl active:scale-90 transition-all border-4 border-white"
                >
                   <Mic size={24}/>
                </button>
             )}
          </div>
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
