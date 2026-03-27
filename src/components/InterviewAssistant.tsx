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
  RotateCcw
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
        setFuel(userData.fuel || 0);
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
            }, 600); // Instant processing
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          if (event.error === 'aborted') return;
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          if (isListeningRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error('Restart error', e);
            }
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

      onClose();
    } catch (error: any) {
      console.error('Error saving session:', error);
      alert(error.message || 'The paper was torn. (Save failed)');
      onClose();
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
    <Draggable nodeRef={nodeRef} handle=".drag-handle" bounds="parent" disabled={isFullScreen || isMobile}>
      <div 
        ref={nodeRef} 
        className={cn(
          "bg-white border-4 border-black shadow-sketch flex flex-col transition-all duration-300 z-[1001] fixed md:absolute",
          isFullScreen ? "inset-4" : "bottom-4 right-4 w-full md:w-[600px] h-[700px]",
          isMobile && "inset-0 border-0 shadow-none h-full w-full",
          isMinimized && "h-20 w-80 overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="drag-handle bg-black text-white p-4 flex items-center justify-between cursor-move shrink-0">
          <div className="flex items-center gap-4">
            <div className={cn("w-3 h-3 rounded-full animate-pulse", isListening ? (isMuted ? "bg-yellow-400" : "bg-red-500") : "bg-zinc-600")} />
            <span className="font-accent text-2xl font-bold tracking-tight">
              {isMinimized ? '[ INK STATUS ]' : 'SCRIBING LIVE...'}
            </span>
            {!isMinimized && (
              <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full">
                <Zap size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] font-bold uppercase">{fuel}% FUEL</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!isMinimized && (
              <>
                <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1 hover:text-yellow-400 transition-colors">
                  {isFullScreen ? <Shrink size={20}/> : <Expand size={20}/>}
                </button>
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:text-yellow-400 transition-colors">
                  <Minimize2 size={20}/>
                </button>
              </>
            )}
            {isMinimized && (
              <button onClick={() => setIsMinimized(false)} className="p-1 hover:text-yellow-400 transition-colors">
                <Maximize2 size={20}/>
              </button>
            )}
            <button 
              onClick={handleEndSession} 
              className="p-1 hover:text-red-500 transition-colors"
            >
              <X size={20}/>
            </button>
          </div>
        </div>

        {/* Status Bar for Muted */}
        <AnimatePresence>
          {isMuted && !isMinimized && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="bg-yellow-400 border-b-4 border-black py-2 px-4 flex items-center justify-center gap-3 font-bold text-xs uppercase overflow-hidden"
            >
              <VolumeX size={14} /> MIC MUTED — SCRIBE STILL ACTIVE
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white paper-dots custom-scrollbar">
              {messages.length === 0 && !currentTranscript && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-300 text-center space-y-4">
                  <Bot size={64} className="opacity-20 translate-y-4" />
                  <p className="text-3xl font-accent">The sheet is clean.<br/>Scribe is waiting for signal.</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.role === 'transcript' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex flex-col group",
                      msg.role === 'transcript' ? "items-start w-[85%]" : "items-end ml-auto w-[85%]"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2 px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {msg.role === 'transcript' ? 'Heard Signal' : 'Scribe Instruction'}
                      </span>
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedId === msg.id ? <CheckCircle2 size={14} className="text-green-600"/> : <Copy size={14}/>}
                        </button>
                      )}
                    </div>
                    <div className={cn(
                      "p-4 text-lg border-4 border-black hand-drawn relative",
                      msg.role === 'transcript' 
                        ? "bg-white -rotate-1" 
                        : "bg-yellow-100 shadow-sketch rotate-1 font-semibold"
                    )}>
                       {msg.role === 'assistant' && (
                          <div className="absolute -top-3 -left-3 bg-black text-white p-1 rounded-sm rotate-0">
                            <Sparkles size={14}/>
                          </div>
                       )}
                      <div className="whitespace-pre-wrap leading-snug">
                        {msg.content}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {currentTranscript && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-start w-[85%]"
                >
                  <div className="p-4 bg-zinc-50 border-4 border-black border-dashed text-zinc-400 text-xl italic rotate-1">
                    "{currentTranscript}..."
                  </div>
                </motion.div>
              )}

              {isProcessing && (
                <div className="flex items-center gap-3 p-4">
                   <div className="w-6 h-6 border-4 border-black border-t-yellow-400 rounded-full animate-spin"></div>
                   <span className="font-accent text-xl italic text-zinc-400">Ink flowing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Commands */}
            <div className="p-4 bg-zinc-900 border-t-4 border-black space-y-4 shrink-0">
               <div className="flex justify-center">
                  <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">--- SESSION COMMANDS ---</span>
               </div>
               
               <div className="flex items-center justify-between gap-3">
                {/* 1. START/STOP (MASSIVE RED) */}
                <button
                  onClick={toggleListening}
                  className={cn(
                    "flex-1 py-8 font-accent text-5xl font-bold transition-all flex items-center justify-center gap-3 border-4 border-black shadow-sketch active:translate-y-1",
                    isListening 
                      ? "bg-red-700 text-white animate-pulse" 
                      : "bg-red-500 text-white hover:bg-red-600"
                  )}
                >
                  {isListening ? <MicOff size={40}/> : <Mic size={40}/>}
                  <span>{isListening ? 'STOP' : 'START'}</span>
                </button>

                {/* 2. MUTE (YELLOW) */}
                <button 
                  onClick={() => setIsMuted(!isMuted)} 
                  className={cn(
                    "w-24 h-24 sm:w-32 sm:h-32 flex flex-col items-center justify-center border-4 border-black transition-all rotate-2 active:rotate-0",
                    isMuted ? "bg-yellow-400 text-black shadow-sketch" : "bg-white text-zinc-400"
                  )}
                >
                  {isMuted ? <VolumeX size={44} className="animate-bounce" /> : <Mic size={44}/>}
                  <span className="text-[10px] font-black mt-2">{isMuted ? 'SILENT' : 'MUTE'}</span>
                </button>
                
                {/* 3. END (BLACK) */}
                <button
                  onClick={handleEndSession}
                  className="w-24 h-24 sm:w-32 sm:h-32 bg-black text-white hover:bg-zinc-800 transition-all border-4 border-black flex flex-col items-center justify-center -rotate-2 shadow-sketch active:translate-x-1"
                >
                  <X size={44}/>
                  <span className="text-[10px] font-black mt-2">END</span>
                </button>
               </div>

               {/* Manual Input Bar */}
               <div className="flex gap-2 bg-zinc-800 p-2 rounded-sm border-2 border-zinc-700">
                  <input 
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSend()}
                    placeholder="Type backup transcript..."
                    className="flex-1 bg-transparent text-white p-2 font-bold text-xs outline-none placeholder:text-zinc-600"
                  />
                  <button 
                    onClick={handleManualSend}
                    disabled={!manualInput.trim() || isProcessing}
                    className="bg-zinc-700 text-white p-2 rounded hover:bg-zinc-600 transition-all"
                  >
                    <Send size={16}/>
                  </button>
               </div>
            </div>
          </>
        )}
      </div>
    </Draggable>
  );
}
