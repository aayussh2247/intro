import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, X, Maximize2, Minimize2, Copy, CheckCircle2, Settings, FileText, Bot, Expand, Shrink } from 'lucide-react';
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [resumeContext, setResumeContext] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'openai' | 'kimi' | 'grok'>('gemini');
  
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

    // Fetch user resume context (combined)
    const fetchContext = async () => {
      try {
        const userData = await api.getUser();
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
    // Setup Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
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
            }, 1200);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          if (event.error === 'aborted') return;
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          if (isListening) {
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
  }, [isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      // Process whatever is left in buffer
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
      const { text: answerText } = await api.generateAIResponse(question, resumeContext, provider);

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
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Error generating response. Please check your connection or API key.',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
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
      // Generate summary via backend
      const transcriptText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const { summary } = await api.summarizeInterview(transcriptText, provider);

      // Save to our new backend API
      await api.createInterview({
        title: `Interview Session - ${new Date().toLocaleDateString()}`,
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
      alert(error.message || 'Failed to save session. Check your credits.');
      onClose();
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Interview Transcript', 20, 20);
    
    doc.setFontSize(10);
    let y = 30;
    
    messages.forEach((msg) => {
      const role = msg.role === 'transcript' ? 'Heard:' : 'Answer:';
      const text = doc.splitTextToSize(`${role} ${msg.content}`, 170);
      
      if (y + (text.length * 5) > 280) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(text, 20, y);
      y += (text.length * 5) + 5;
    });

    doc.save('interview-transcript.pdf');
  };

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle" bounds="parent" disabled={isFullScreen || isMobile}>
      <div ref={nodeRef} className={cn(
        "fixed z-50 bg-white hand-drawn shadow-sketch overflow-hidden flex flex-col transition-all duration-300 font-body",
        isFullScreen || isMobile ? "!inset-0 !w-full !h-full !max-h-full !transform-none" : 
        isMinimized ? "w-80 h-20" : "w-[500px] h-[700px] max-h-[90vh]"
      )} style={isFullScreen || isMobile ? { top: 0, left: 0 } : { top: '40px', right: '40px' }}>
        
        {/* Header (Draggable) */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-white border-b-4 border-black select-none",
          !(isFullScreen || isMobile) && "drag-handle cursor-move"
        )}>
          <div className="flex items-center gap-3">
            <span className="font-accent text-3xl font-bold italic tracking-tight">
              . <span className="marker px-2">INK</span> SESSION
            </span>
            {isListening && (
              <span className="text-xs font-bold text-red-600 animate-pulse">[ LISTENING ]</span>
            )}
            <div className="flex items-center gap-2 ml-4 border-2 border-black px-2 py-1 rotate-1 bg-zinc-50">
              <span className="text-[10px] font-bold uppercase">Provider:</span>
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value as any)}
                className="text-xs font-bold bg-transparent border-none outline-none cursor-pointer uppercase"
              >
                <option value="gemini">Gemini</option>
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="kimi">Kimi</option>
                <option value="grok">Grok</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={handleEndSession} 
              className="font-accent text-2xl font-bold hover:text-red-600"
              title="Close"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar paper-dots bg-white">
              {messages.length === 0 && !currentTranscript && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-300 text-center space-y-4">
                  <p className="text-3xl font-accent">The sheet is clean.<br/>Start speaking to begin.</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "flex flex-col max-w-[90%]",
                      msg.role === 'transcript' ? "items-start" : "items-end self-end ml-auto"
                    )}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest mb-2 px-1">
                      {msg.role === 'transcript' ? 'Heard:' : 'Scribe Suggests:'}
                    </span>
                    <div className={cn(
                      "p-3 text-lg hand-drawn",
                      msg.role === 'transcript' 
                        ? "bg-white rotate-0.5" 
                        : "bg-yellow-100 shadow-sketch -rotate-0.5 font-semibold"
                    )}>
                      <div className="whitespace-pre-wrap leading-tight">
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
                  className="flex flex-col items-start max-w-[90%]"
                >
                  <div className="p-4 bg-white border-4 border-black border-dashed text-zinc-400 text-xl italic rotate-1">
                    "{currentTranscript}..."
                  </div>
                </motion.div>
              )}

              {isProcessing && (
                <div className="flex items-center gap-2 p-4">
                  <span className="font-accent text-xl italic text-zinc-400">Scribing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Controls */}
            <div className="p-4 bg-white border-t-4 border-black flex items-center justify-between">
              <button
                onClick={toggleListening}
                className={cn(
                  "px-10 py-4 font-accent text-3xl font-bold transition-all relative",
                  isListening 
                    ? "bg-red-600 text-white shadow-sketch -rotate-1" 
                    : "bg-black text-white hover:shadow-sketch rotate-1"
                )}
              >
                {isListening ? '[ STOP INK ]' : '[ START INK ]'}
              </button>
              
              <div className="flex items-center gap-6">
                {messages.length > 0 && (
                  <button
                    onClick={exportPDF}
                    className="font-accent text-2xl font-bold hover:underline"
                    title="Export Sketch"
                  >
                    Export
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Draggable>
  );
}
