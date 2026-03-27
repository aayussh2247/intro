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
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Fetch user resume context
    const fetchContext = async () => {
      try {
        const userData = await api.getUser();
        setResumeContext(userData.resumeText || '');
      } catch (error) {
        console.error('Error fetching context:', error);
      }
    };
    fetchContext();

    // Setup Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
          
          // Reset silence timer
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          
          // If silence for 2 seconds, process the buffered transcript
          silenceTimerRef.current = setTimeout(() => {
            if (transcriptBufferRef.current.trim()) {
              handleProcessQuestion(transcriptBufferRef.current.trim());
              transcriptBufferRef.current = '';
              setCurrentTranscript('');
            }
          }, 2000);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error === 'aborted') return;
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        // Auto-restart if still supposed to be listening
        if (isListening) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Restart error', e);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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
      const { text: answerText } = await api.generateAIResponse(question, resumeContext);

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
      const { summary } = await api.summarizeInterview(transcriptText);

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
        "fixed z-50 bg-zinc-900/80 backdrop-blur-2xl border border-zinc-700/50 shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
        isFullScreen || isMobile ? "!inset-0 !w-full !h-full !max-h-full !transform-none rounded-none" : 
        isMinimized ? "w-72 h-16 rounded-2xl" : "w-[400px] h-[600px] max-h-[80vh] rounded-2xl"
      )} style={isFullScreen || isMobile ? { top: 0, left: 0 } : { top: '20px', right: '20px' }}>
        
        {/* Header (Draggable) */}
        <div className={cn(
          "flex items-center justify-between p-3 bg-zinc-800/50 border-b border-zinc-700/50 select-none",
          !(isFullScreen || isMobile) && "drag-handle cursor-move"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isListening ? "bg-red-500 animate-pulse" : "bg-zinc-500")} />
            <span className="font-semibold text-sm text-zinc-200">INTRO AI</span>
          </div>
          <div className="flex items-center gap-1">
            {!isMobile && (
              <>
                <button onClick={() => {
                  setIsFullScreen(!isFullScreen);
                  if (isMinimized) setIsMinimized(false);
                }} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 rounded-md transition-colors">
                  {isFullScreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                </button>
                <button onClick={() => {
                  setIsMinimized(!isMinimized);
                  if (isFullScreen) setIsFullScreen(false);
                }} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 rounded-md transition-colors">
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
              </>
            )}
            <button onClick={handleEndSession} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && !currentTranscript && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center space-y-3">
                  <Bot className="w-10 h-10 opacity-50" />
                  <p className="text-sm">Click the microphone to start listening to the interview.</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "flex flex-col max-w-[90%]",
                      msg.role === 'transcript' ? "items-start" : "items-end self-end ml-auto"
                    )}
                  >
                    <span className="text-[10px] text-zinc-500 mb-1 px-1 uppercase tracking-wider font-medium">
                      {msg.role === 'transcript' ? 'Heard' : 'Say This'}
                    </span>
                    <div className={cn(
                      "p-3 rounded-2xl text-sm relative group",
                      msg.role === 'transcript' 
                        ? "bg-zinc-800/80 text-zinc-200 rounded-tl-sm border border-zinc-700/50" 
                        : "bg-indigo-500/20 text-indigo-100 rounded-tr-sm border border-indigo-500/30"
                    )}>
                      <div className="whitespace-pre-wrap font-sans leading-relaxed">
                        {msg.content}
                      </div>
                      
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="absolute -left-8 top-2 p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800 rounded-md opacity-0 group-hover:opacity-100 transition-all border border-zinc-700"
                        >
                          {copiedId === msg.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
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
                  <span className="text-[10px] text-zinc-500 mb-1 px-1 uppercase tracking-wider font-medium">Listening...</span>
                  <div className="p-3 bg-zinc-800/40 text-zinc-400 rounded-2xl rounded-tl-sm border border-zinc-700/30 text-sm italic">
                    {currentTranscript}
                  </div>
                </motion.div>
              )}

              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-end self-end ml-auto max-w-[90%]"
                >
                  <div className="p-3 bg-indigo-500/10 rounded-2xl rounded-tr-sm border border-indigo-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Controls */}
            <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-zinc-800/30 border-t border-zinc-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleListening}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    isListening 
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" 
                      : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20"
                  )}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isListening ? 'Stop' : 'Listen'}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={exportPDF}
                    className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 rounded-lg transition-colors"
                    title="Export PDF"
                  >
                    <FileText className="w-4 h-4" />
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
