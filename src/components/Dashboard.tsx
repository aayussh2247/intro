import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, FileText, Plus, Settings, Trash2, Play, LogOut, CreditCard, User, Zap, Mic, MicOff, X } from 'lucide-react';
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
  const [loadingResume, setLoadingResume] = useState(false);
  const [activeTab, setActiveTab] = useState<'mind' | 'live' | 'fuel' | 'profile'>('mind');
  const [notification, setNotification] = useState<string | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<'basic' | 'premium' | null>(null);
  const [omniKey, setOmniKey] = useState('');
  const [building, setBuilding] = useState(false);
  const [selectedDefaultModel, setSelectedDefaultModel] = useState<string>(user.preferredProvider || 'gemini');

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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

      const newResume = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        text: fullText,
        createdAt: new Date().toISOString()
      };

      const updatedResumes = [...(user.resumes || []), newResume];
      await api.updateUser({ resumes: updatedResumes });
      setNotification('Context Absorbed! 🖊️');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      alert('Failed to parse PDF. Please try again.');
    } finally {
      setLoadingResume(false);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!confirm('Discard this resume context?')) return;
    try {
      const updatedResumes = user.resumes.filter((r: any) => r.id !== resumeId);
      await api.updateUser({ resumes: updatedResumes });
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete resume:', error);
    }
  };

  const [newName, setNewName] = useState(user.name);
  const handleUpdateProfile = async () => {
    try {
      await api.updateUser({ name: newName });
      setNotification('Identity updated! 🖋️');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Update error', err);
    }
  };
  
  const handleSetDefaultModel = async (model: string) => {
    try {
      await api.updateUser({ preferredProvider: model });
      setSelectedDefaultModel(model);
      setNotification(`${model.toUpperCase()} set as default! 🚀`);
    } catch (err) {
      alert('Failed to set default model');
    }
  };

  const handleBuildSystem = async () => {
    if (!omniKey) {
      setNotification('Please enter an API key! 🖊️');
      return;
    }
    setBuilding(true);
    try {
      const res = await api.verifyKey(null, omniKey);
      if (res.success) {
        const provider = res.provider;
        await api.updateUser({ 
          apiKeys: { ...user.apiKeys, [provider]: omniKey },
          preferredProvider: provider
        });
        setNotification(`System Synchronized with ${provider.toUpperCase()}! 🚀`);
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err: any) {
      setNotification(`Calibration Failed: ${err.message || 'Key invalid or blocked.'} ⚠️`);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="min-h-screen paper-dots text-black flex flex-col lg:flex-row font-body selection:bg-yellow-300">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 lg:top-8 left-1/2 -translate-x-1/2 z-[100] bg-yellow-400 border-4 border-black hand-drawn px-8 py-3 font-bold shadow-sketch whitespace-nowrap"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR (lg and up) */}
      <div className="hidden lg:flex w-80 h-screen border-r-4 border-black p-10 flex-col bg-white sticky top-0 shrink-0">
         <div className="mb-20">
            <h2 className="font-accent text-5xl font-bold italic">
               <span className="marker">INTRO</span> AI
            </h2>
            <p className="text-[10px] font-black uppercase opacity-30 mt-2 tracking-widest">Personal Scribe Terminal</p>
         </div>

         <nav className="flex-1 space-y-10">
            {[
              { id: 'mind', label: 'Mind Repository', icon: FileText },
              { id: 'live', label: 'Live Session', icon: Play },
              { id: 'fuel', label: 'Fuel & Matrix', icon: Zap },
              { id: 'profile', label: 'Scribe Profile', icon: User }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full text-left font-accent text-3xl font-bold transition-all flex items-center gap-4 group",
                  activeTab === tab.id ? "text-black translate-x-2" : "text-zinc-300 hover:text-black"
                )}
              >
                <tab.icon className={cn("w-8 h-8", activeTab === tab.id ? "text-black" : "text-zinc-200")} />
                <span className={cn(activeTab === tab.id ? "underline decoration-yellow-400 decoration-8 underline-offset-4" : "")}>
                  {tab.id.toUpperCase()}
                </span>
              </button>
            ))}
         </nav>

         <div className="mt-auto space-y-8">
            <div className="p-6 bg-yellow-50 hand-drawn -rotate-1 shadow-sketch">
               <span className="text-[10px] font-black uppercase tracking-widest block mb-2 opacity-50">Pulse Gauge</span>
               <div className="text-3xl font-accent font-bold">
                  {(user.apiKeys?.gemini || user.apiKeys?.anthropic) ? '∞ Unlimited' : `${user.fuel || 0}% Fuel`}
               </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full text-left font-accent text-2xl font-bold text-red-600 hover:underline hover:translate-x-1 transition-all"
            >
              [ Sign Out ]
            </button>
         </div>
      </div>

      {/* MOBILE HEADER (hidden on lg) */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b-4 border-black sticky top-0 z-50">
        <span className="font-accent text-3xl font-bold italic">
          <span className="marker px-2 text-2xl">INTRO</span> AI
        </span>
        <div className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-bold text-xs bg-yellow-400">
           {user.name?.[0]}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-32 lg:pb-16 custom-scrollbar">
        {/* Container for centering content on desktop */}
        <div className="max-w-4xl mx-auto">
          {activeTab === 'mind' && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 lg:p-12 space-y-12"
            >
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                  <h1 className="text-5xl lg:text-7xl font-accent font-bold leading-none">
                    <span className="marker lg:text-5xl">Mind</span> Repository
                  </h1>
                  <p className="text-zinc-500 text-lg lg:text-2xl italic mt-2 font-body">Manage multiple context sources.</p>
                </div>
                <div className="text-[10px] lg:text-xs font-black uppercase opacity-40 font-body">V2.4 — SYNC ACTIVE</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
                <div className="bg-white hand-drawn shadow-sketch p-8 rotate-1">
                  <h2 className="text-3xl font-accent font-bold mb-8 italic">Attach Context</h2>
                  <label className="flex flex-col items-center justify-center w-full h-56 border-4 border-black border-dashed cursor-pointer hover:bg-yellow-50 transition-all group">
                    <div className="flex flex-col items-center justify-center">
                      {loadingResume ? (
                        <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin mb-4" />
                      ) : (
                        <div className="text-6xl text-zinc-200 group-hover:text-black mb-4 transition-colors">+</div>
                      )}
                      <p className="font-bold text-xl text-zinc-400 group-hover:text-black transition-colors">Drop Resume PDF</p>
                    </div>
                    <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={loadingResume} />
                  </label>
                </div>

                <div className="space-y-6">
                  <h3 className="text-2xl font-accent font-bold border-b-4 border-black pb-2 inline-block">Active Memories</h3>
                  {(user.resumes || []).length === 0 ? (
                    <div className="p-12 bg-white border-2 border-dashed border-zinc-100 text-center rounded-2xl">
                      <p className="text-zinc-300 italic text-xl">The AI knows nothing yet.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {user.resumes.map((res: any) => (
                        <motion.div 
                          key={res.id} 
                          layout
                          className="bg-white hand-drawn p-5 flex items-center justify-between border-2 border-black hover:rotate-0 transition-transform shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                        >
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-yellow-50 border border-black rotate-[-4deg]">
                                <FileText className="w-6 h-6 text-black" />
                              </div>
                              <div>
                                <p className="font-bold text-lg leading-tight">{res.name}</p>
                                <p className="text-[10px] uppercase text-zinc-400 font-black tracking-tighter">
                                  Buffer Active {res.id ? `[ ${res.id.slice(0,4)} ]` : '[ NEW ]'}
                                </p>
                              </div>
                            </div>
                          <button 
                            onClick={() => handleDeleteResume(res.id)}
                            className="text-red-200 hover:text-red-600 p-2 transition-colors"
                          >
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'live' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 lg:p-12 space-y-12"
            >
              <div>
                <h1 className="text-5xl lg:text-7xl font-accent font-bold leading-none">
                  <span className="marker lg:text-5xl">Live</span> Session
                </h1>
                <p className="text-zinc-500 text-lg lg:text-2xl italic mt-2 font-body">Real-time interview support terminal.</p>
              </div>

              <div className="bg-white hand-drawn shadow-sketch p-12 lg:p-20 text-center rotate-1 relative overflow-hidden group">
                <div className="absolute inset-0 paper-dots opacity-20 pointer-events-none" />
                <Bot className="w-24 h-24 mx-auto mb-10 text-black/10 group-hover:text-black/20 transition-colors group-hover:scale-110 duration-500" />
                <h3 className="text-4xl font-accent font-bold mb-4">Initial Pulse Detected</h3>
                <p className="text-zinc-400 mb-12 font-body text-xl max-w-md mx-auto italic">The scribe is ready to analyze audio signals and output high-fidelity responses based on your loaded Mind.</p>
                <button
                  onClick={onLaunchAssistant}
                  className="w-full max-w-sm bg-black text-white font-bold text-3xl py-6 hover:shadow-sketch active:translate-y-2 transition-all hand-drawn rotate-[-1deg] mx-auto uppercase tracking-tighter"
                >
                  START NOW [ SYNC ]
                </button>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-accent font-bold border-b-4 border-black pb-2 inline-block">Session Log</h3>
                {interviews.length === 0 ? (
                  <p className="text-zinc-300 italic text-xl">No sessions recorded yet.</p>
                ) : (
                  <div className="grid gap-4">
                    {interviews.map((interview) => (
                      <div key={interview.id} className="bg-white border-2 border-black p-6 flex flex-col lg:flex-row lg:items-center justify-between shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-yellow-50 transition-colors">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-bold rotate-[-3deg]">
                               {interview.title[0]}
                            </div>
                            <div>
                               <div className="font-bold text-xl">{interview.title}</div>
                               <div className="text-xs text-zinc-400 font-bold uppercase tracking-tighter">Scribed on {new Date(interview.createdAt).toLocaleDateString()}</div>
                            </div>
                         </div>
                         <div className="mt-4 lg:mt-0 flex items-center gap-4">
                            <span className="text-[10px] font-black uppercase text-green-600 px-2 py-1 bg-green-50 border border-green-200">Verified</span>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'fuel' && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 lg:p-12 space-y-12"
            >
              <div>
                <h1 className="text-5xl lg:text-7xl font-accent font-bold leading-none">
                  <span className="marker lg:text-5xl">Fuel</span> & Matrix
                </h1>
                <p className="text-zinc-500 text-lg lg:text-2xl italic mt-2 font-body">Power source management.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 {/* BIG FUEL GAUGE */}
                 <div className="lg:col-span-2 bg-black text-white p-10 lg:p-16 relative overflow-hidden hand-drawn shadow-sketch -rotate-1">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                       <Zap size={200} />
                    </div>
                    <div className="relative z-10">
                       <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.5em] mb-4 opacity-50">Current Reservoir Efficiency</p>
                       <div className="flex items-baseline gap-4">
                          <span className="text-7xl lg:text-9xl font-accent font-bold">
                             {(user.apiKeys?.gemini || user.apiKeys?.anthropic) ? '∞' : `${user.fuel || 0}%`}
                          </span>
                          <span className="text-2xl lg:text-4xl font-accent font-bold opacity-40">FUEL</span>
                       </div>
                       <p className="mt-8 text-zinc-500 font-body text-xl max-w-lg">
                          {(user.apiKeys?.gemini || user.apiKeys?.anthropic) 
                            ? 'Your Matrix is directly synchronized with personal API keys. Free limits are bypassed.'
                            : 'You are using public reservoir fuel. Please attach your own provider key for high-fidelity unlimited sessions.'}
                       </p>
                    </div>
                 </div>

                 <div className="space-y-10">
                    <div className="bg-white hand-drawn border-2 border-black p-8 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
                      <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-b-2 border-black pb-2">Active Protocol</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'gemini', label: 'GEMINI V1' },
                          { id: 'anthropic', label: 'ANTHROPIC V1' }
                        ].map((m) => (
                          <button 
                            key={m.id}
                            onClick={() => handleSetDefaultModel(m.id)}
                            className={cn(
                              "py-4 lg:py-6 font-bold text-lg lg:text-xl border-2 transition-all",
                              selectedDefaultModel === m.id ? "bg-black text-white border-black" : "bg-white text-zinc-300 border-zinc-100 hover:text-black hover:border-black"
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-yellow-50 hand-drawn border-4 border-black p-8 shadow-sketch rotate-1">
                      <h3 className="text-2xl font-accent font-bold mb-4 uppercase italic">Super-Key Protocol</h3>
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Matrix Multi-Key [ Comma Separated ]</label>
                           <textarea 
                             placeholder="Paste your API keys here! You can add multiple keys (key1, key2, key3) to create a Super-Key and bypass all limits..."
                             value={omniKey}
                             onChange={(e) => setOmniKey(e.target.value)}
                             className="w-full bg-white border-2 border-black p-4 font-mono text-[10px] focus:ring-4 focus:ring-yellow-300/50 outline-none h-24"
                           />
                        </div>
                        <button 
                          onClick={handleBuildSystem}
                          disabled={building}
                          className={cn(
                            "w-full py-5 font-bold text-2xl transition-all border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 uppercase tracking-widest",
                            building ? "bg-zinc-200 text-zinc-400 cursor-wait" : "bg-black text-white"
                          )}
                        >
                          {building ? 'Calibrating Super-Key...' : 'Sync Super-Key'}
                        </button>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h3 className="text-2xl font-accent font-bold border-b-4 border-black pb-2 inline-block">Matrix Summary</h3>
                    <div className="grid gap-4">
                       {['gemini', 'anthropic'].map(p => (
                         <div key={p} className={cn(
                           "p-6 border-2 border-black bg-white flex items-center justify-between transition-opacity",
                           user.apiKeys?.[p] ? "opacity-100" : "opacity-40"
                         )}>
                            <div className="flex items-center gap-4">
                               <div className={cn("w-4 h-4 rounded-full border-2 border-black", user.apiKeys?.[p] ? "bg-green-500" : "bg-zinc-200")} />
                               <span className="font-bold text-xl uppercase font-accent">{p} Protocol</span>
                            </div>
                            {user.apiKeys?.[p] && (
                              <button 
                                onClick={async () => {
                                  const keys = { ...user.apiKeys };
                                  delete (keys as any)[p];
                                  await api.updateUser({ apiKeys: keys });
                                  window.location.reload();
                                }}
                                className="bg-red-50 text-red-600 hover:bg-black p-2 border border-red-200 transition-colors"
                              >
                                <Trash2 size={20}/>
                              </button>
                            )}
                         </div>
                       ))}
                    </div>
                    <div className="p-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl mt-6 font-body italic text-zinc-500">
                       <p>Note: Gemini keys typically start with 'AIza', Anthropic keys start with 'sk-ant'. The system will auto-detect your key type on sync.</p>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 lg:p-12 space-y-16"
            >
              <div className="flex items-center gap-10">
                <div className="w-32 h-32 lg:w-44 lg:h-44 border-4 lg:border-8 border-black bg-yellow-400 flex items-center justify-center font-accent text-7xl lg:text-9xl font-black -rotate-6 shadow-sketch shrink-0">
                  {user.name?.[0] || 'U'}
                </div>
                <div>
                  <h1 className="text-6xl lg:text-8xl font-accent font-bold leading-none">Profile</h1>
                  <p className="text-zinc-500 text-xl lg:text-3xl italic mt-3 font-body">Manage your scribe identity.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16 items-start">
                {/* IDENTITY FORM */}
                <div className="lg:col-span-2 space-y-12">
                  <section className="bg-white hand-drawn border-2 border-black p-10 space-y-10 rotate-1 shadow-sketch">
                    <h2 className="text-3xl font-accent font-bold border-b-4 border-black pb-2 inline-block italic">Identity Ledger</h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Full Scribe Name</label>
                        <input 
                          type="text" 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full bg-transparent border-b-4 border-black py-4 text-2xl lg:text-3xl font-bold focus:outline-none focus:border-yellow-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-4 opacity-50">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Permanent Email</label>
                        <input 
                          type="email" 
                          value={user.email}
                          disabled
                          className="w-full bg-transparent border-b-4 border-zinc-200 py-4 text-2xl lg:text-3xl font-bold cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="pt-6">
                       <button 
                        onClick={handleUpdateProfile}
                        className="w-full bg-black text-white font-bold text-3xl py-6 hover:bg-yellow-400 hover:text-black transition-all flex items-center justify-center gap-4 rotate-[-0.5deg]"
                      >
                        Update Identity [ WRITE ]
                      </button>
                    </div>
                  </section>

                  <section className="bg-white border-4 border-black p-10 space-y-8 -rotate-1">
                    <h2 className="text-3xl font-accent font-bold border-b-4 border-black pb-2 inline-block">Security Matrix</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Re-Inscribe Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          className="w-full bg-transparent border-b-4 border-black py-4 text-2xl font-bold focus:outline-none"
                        />
                      </div>
                      <button 
                        onClick={() => setNotification('Security credentials re-inscribed! 🔐')}
                        className="bg-zinc-100 text-black border-4 border-black font-bold text-2xl py-4 hover:bg-black hover:text-white transition-all active:scale-95"
                      >
                        Change Password
                      </button>
                    </div>
                  </section>
                </div>

                {/* PLANS & QUICK ACTIONS */}
                <div className="space-y-10">
                   <div className="bg-yellow-400 border-4 border-black p-8 shadow-sketch rotate-2 group">
                      <h3 className="text-2xl font-accent font-bold mb-4 flex items-center gap-3">
                         <CreditCard /> Plan: BASIC
                      </h3>
                      <p className="font-body text-black/60 mb-8 italic">Your notebook is currently on a legacy basic pulse.</p>
                      <button onClick={() => setUpgradePlan('premium')} className="w-full bg-white text-black border-2 border-black font-bold py-4 hover:bg-black hover:text-white transition-all shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:shadow-none translate-y-[-2px] active:translate-y-0">
                         Upgrade Reservoir
                      </button>
                   </div>

                   <div className="space-y-4">
                      <button onClick={onLogout} className="w-full flex items-center justify-between p-8 border-4 border-black bg-red-50 text-red-600 hand-drawn active:translate-y-1 transition-all group">
                        <div className="flex items-center gap-5">
                          <LogOut size={32}/>
                          <span className="font-accent text-3xl font-bold">Sign Out</span>
                        </div>
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse group-hover:scale-150 transition-transform" />
                      </button>
                   </div>

                   <div className="p-8 border-4 border-black border-dashed bg-white text-zinc-300 pointer-events-none">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2">Notebook ID</p>
                      <p className="font-mono text-[10px] break-all">ID-{user.id || Math.random().toString(36).slice(2)}</p>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* MOBILE FLOATING DOCK - 4 BUTTONS (hidden on lg) */}
      <div className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] bg-white/60 backdrop-blur-xl border-2 border-black/5 flex items-center justify-between p-2 z-50 rounded-[40px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
        {[
          { id: 'mind', label: 'Mind', icon: FileText },
          { id: 'live', label: 'Live', icon: Play },
          { id: 'fuel', label: 'Fuel', icon: Zap },
          { id: 'profile', label: 'User', icon: User }
        ].map((btn) => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className="relative flex flex-col items-center justify-center p-3 transition-all active:scale-90 flex-1 overflow-hidden"
          >
             {activeTab === btn.id && (
                <motion.div 
                   layoutId="active-pill"
                   className="absolute inset-0 bg-yellow-400 rounded-3xl -z-10"
                   transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
             )}
            <btn.icon size={22} className={cn("transition-colors", activeTab === btn.id ? "text-black" : "text-zinc-400")} strokeWidth={activeTab === btn.id ? 2.5 : 2} />
          </button>
        ))}
      </div>

      {/* Upgrade Modal */}
      <AnimatePresence>
          {upgradePlan && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                 onClick={() => setUpgradePlan(null)}
               />
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 exit={{ scale: 0.9, y: 20 }}
                 className="w-full max-w-sm bg-white hand-drawn border-4 border-black p-6 shadow-sketch relative z-10"
               >
                  <h2 className="text-2xl font-accent font-bold mb-6 uppercase">Ink <span className="marker">Subscription</span></h2>
                  
                  <div className="space-y-4">
                     <div className="p-4 border-2 border-black bg-yellow-50">
                        <p className="font-bold text-lg">Author Tier</p>
                        <p className="text-xs opacity-60">₹299/month • Unlimited Fuel</p>
                     </div>
                     <p className="text-[10px] font-bold italic text-zinc-400">Upgrade request will be sent to admin.</p>
                     <button 
                       onClick={() => {
                         setNotification('Upgrade Request Sent! 🖋️');
                         setUpgradePlan(null);
                       }}
                       className="w-full bg-black text-white py-4 font-bold text-xl hover:bg-yellow-400 hover:text-black transition-all"
                     >
                        Confirm Request
                     </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
}
