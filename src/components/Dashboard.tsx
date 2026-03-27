import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { Bot, FileText, Plus, Settings, Trash2, Play, LogOut, CreditCard, User } from 'lucide-react';
import { cn } from '../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Interview {
  id: string;
  title: string;
  createdAt: string;
  summary?: string;
}

export function Dashboard({ 
  user, 
  onLogout, 
  onLaunchAssistant 
}: { 
  user: any; 
  onLogout: () => void; 
  onLaunchAssistant: () => void 
}) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [resumeText, setResumeText] = useState<string>(user.resumeText || '');
  const [loadingResume, setLoadingResume] = useState(false);
  const [activeTab, setActiveTab] = useState<'interviews' | 'resume'>('interviews');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const interviewData = await api.getInterviews();
        setInterviews(interviewData);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      }
    };
    fetchData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingResume(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      await api.updateUser({ resumeText: fullText });
      setResumeText(fullText);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      alert('Failed to parse PDF. Please try again.');
    } finally {
      setLoadingResume(false);
    }
  };

  const handleDeleteInterview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this interview?')) return;
    try {
      await api.deleteInterview(id);
      setInterviews(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Failed to delete interview:', error);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Sidebar (Desktop) / Top & Bottom Nav (Mobile) */}
      <div className="hidden md:flex w-64 border-r border-zinc-800/50 bg-zinc-900/20 p-4 flex-col">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-semibold tracking-tight text-lg">INTRO AI</span>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab('interviews')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'interviews' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            )}
          >
            <Play className="w-4 h-4" />
            Interviews
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'resume' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            )}
          >
            <FileText className="w-4 h-4" />
            Resume Context
          </button>
        </nav>

        <div className="mt-auto pt-4 border-t border-zinc-800/50 space-y-4">
          <div className="px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Interviews Left</span>
            </div>
            <p className="text-lg font-bold text-white">{user?.credits || 0}</p>
          </div>

          <div className="px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                 <User className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-semibold tracking-tight text-lg">INTRO AI</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
        {activeTab === 'interviews' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Your Interviews</h1>
                <p className="text-zinc-400 mt-1 text-sm">Review past sessions or start a new one.</p>
              </div>
              <button
                onClick={onLaunchAssistant}
                className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl sm:rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 w-full sm:w-auto"
              >
                <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                Launch Assistant
              </button>
            </div>

            {interviews.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-300">No interviews yet</h3>
                <p className="text-zinc-500 mt-1 text-sm">Launch the assistant to start your first session.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {interviews.map((interview) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={interview.id}
                    className="p-5 border border-zinc-800/50 bg-zinc-900/30 rounded-xl hover:border-zinc-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{interview.title}</h3>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(interview.createdAt).toLocaleDateString()} • {new Date(interview.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteInterview(interview.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {interview.summary && (
                      <div className="mt-4 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50 text-sm text-zinc-300">
                        <p className="font-medium text-zinc-400 mb-1 text-xs uppercase tracking-wider">Summary</p>
                        {interview.summary}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resume' && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Resume Context</h1>
              <p className="text-zinc-400 mt-1 text-sm">Upload your resume. The AI will use this context to personalize answers.</p>
            </div>

            <div className="p-6 border border-zinc-800/50 bg-zinc-900/30 rounded-xl">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-700 border-dashed rounded-lg cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-indigo-500/50 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {loadingResume ? (
                      <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-2" />
                    ) : (
                      <FileText className="w-8 h-8 text-zinc-500 mb-2" />
                    )}
                    <p className="mb-2 text-sm text-zinc-400">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-zinc-500">PDF (MAX. 5MB)</p>
                  </div>
                  <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={loadingResume} />
                </label>
              </div>

              {resumeText && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">Extracted Text Preview</h3>
                  <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/50 h-64 overflow-y-auto text-xs text-zinc-400 font-mono whitespace-pre-wrap">
                    {resumeText}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-lg border-t border-zinc-800/50 flex items-center justify-around p-3 pb-safe z-40">
        <button
          onClick={() => setActiveTab('interviews')}
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors flex-1",
            activeTab === 'interviews' ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Play className="w-5 h-5" />
          <span className="text-[10px] font-medium">Interviews</span>
        </button>
        <button
          onClick={() => setActiveTab('resume')}
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors flex-1",
            activeTab === 'resume' ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium">Resume</span>
        </button>
      </div>
    </div>
  );
}
