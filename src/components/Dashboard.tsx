import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
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
  const [activeTab, setActiveTab] = useState<'interviews' | 'resume' | 'profile'>('interviews');
  const [notification, setNotification] = useState<string | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<'basic' | 'premium' | null>(null);

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
      
      // Update local user state if possible, or just refresh/wait for parent update
      // For now, let's assume we need to refresh or the parent handles it.
      // But usually we'd want to update the local 'user' prop if we can.
      // Since 'user' is a prop, we should ideally have an 'onUserUpdate' callback.
      window.location.reload(); // Quickest way to sync state for now without refactoring too much
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

  const handleDeleteInterview = async (id: string) => {
    if (!confirm('Tear this session from the notebook?')) return;
    try {
      await api.deleteInterview(id);
      setInterviews(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Failed to delete interview:', error);
    }
  };

  const [newName, setNewName] = useState(user.name);
  const handleUpdateProfile = async () => {
    try {
      await api.updateUser({ name: newName });
      setNotification('Identity updated on the paper! 🖋️');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Update error', err);
    }
  };

  const handleComingSoon = () => {
    setNotification('Feature coming soon to your notebook! 🖋️');
  };

  return (
    <div className="min-h-screen paper-dots text-black flex flex-col md:flex-row font-body selection:bg-yellow-300">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 md:top-8 left-1/2 -translate-x-1/2 z-[100] bg-yellow-400 border-4 border-black hand-drawn px-8 py-3 font-bold shadow-sketch"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex w-80 border-r-4 border-black p-8 flex-col bg-white">
        <div className="flex items-center gap-3 mb-16">
          <span className="font-accent text-5xl font-bold italic">
            <span className="marker">INTRO</span> AI
          </span>
        </div>

        <nav className="flex-1 space-y-8">
          <button
            onClick={() => setActiveTab('interviews')}
            className={cn(
              "w-full text-left font-accent text-3xl font-bold transition-all relative group",
              activeTab === 'interviews' ? "text-black underline decoration-yellow-400 decoration-8 underline-offset-4" : "text-zinc-400 hover:text-black"
            )}
          >
            . Sessions
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={cn(
              "w-full text-left font-accent text-3xl font-bold transition-all relative",
              activeTab === 'resume' ? "text-black underline decoration-yellow-400 decoration-8 underline-offset-4" : "text-zinc-400 hover:text-black"
            )}
          >
            . My Resumes
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full text-left font-accent text-3xl font-bold transition-all relative",
              activeTab === 'profile' ? "text-black underline decoration-yellow-400 decoration-8 underline-offset-4" : "text-zinc-400 hover:text-black"
            )}
          >
            . Profile
          </button>
        </nav>

        <div className="mt-auto space-y-10">
          <div className="p-6 bg-white hand-drawn rotate-1">
            <span className="text-sm font-bold uppercase tracking-widest block mb-2">Practice Ink</span>
            <p className="text-5xl font-accent font-bold tracking-tighter">
              {user?.credits || 0} <span className="text-xl">Left</span>
            </p>
          </div>

          <button 
            onClick={onLogout}
            className="w-full text-left font-accent text-2xl font-bold text-red-600 hover:underline"
          >
            [ Sign Out ]
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b-4 border-black sticky top-0 z-50">
        <span className="font-accent text-3xl font-bold italic">
          <span className="marker px-2 text-2xl">INTRO</span> AI
        </span>
        <button onClick={onLogout} className="p-2 bg-red-50 border-2 border-black rounded-sm active:translate-y-0.5 transition-transform">
          <LogOut className="w-5 h-5 text-red-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-5 md:p-16 overflow-y-auto pb-40 md:pb-16 custom-scrollbar">
        {activeTab === 'interviews' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-12"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mb-4">
              <div>
                <h1 className="text-5xl md:text-6xl font-accent font-bold leading-tight">
                  <span className="marker text-3xl md:text-4xl leading-none">Activity</span> Log
                </h1>
                <p className="text-zinc-500 text-lg md:text-xl italic mt-1 font-body">Recent interview doodles.</p>
              </div>
              <button
                onClick={onLaunchAssistant}
                className="w-full sm:w-auto bg-black text-white font-bold text-xl md:text-2xl px-8 md:px-10 py-4 md:py-5 hover:shadow-sketch active:translate-y-1 transition-all hand-drawn"
              >
                + Start Session
              </button>
            </div>

            <div className="grid gap-10">
              {interviews.length === 0 ? (
                <div className="bg-white hand-drawn shadow-sketch p-16 text-center rotate-1">
                  <h3 className="text-4xl font-accent font-bold text-zinc-300">Clean Sheet...</h3>
                  <p className="text-zinc-400 mt-2 text-xl font-body">Click the marker to start your first session.</p>
                </div>
              ) : (
                interviews.map((interview, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={interview.id}
                    className="bg-white hand-drawn shadow-sketch p-8 group relative"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-accent text-3xl font-bold group-hover:text-blue-900 transition-colors">
                           {interview.title}
                        </h3>
                        <p className="text-zinc-400 text-sm italic mt-2">
                           Scribed on {new Date(interview.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteInterview(interview.id)}
                        className="p-3 text-red-200 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </div>
                    {interview.summary && (
                      <div className="mt-8 p-6 bg-yellow-50/50 border-l-8 border-yellow-400 text-xl font-body italic leading-relaxed">
                        "{interview.summary}"
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'resume' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-8 md:space-y-12"
          >
            <div>
              <h1 className="text-5xl md:text-6xl font-accent font-bold"><span className="marker text-3xl md:text-4xl">Brain</span> Dump</h1>
              <p className="text-zinc-500 text-base md:text-xl italic mt-1 font-body">Upload resumes for AI training.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              <div className="space-y-8">
                <h2 className="text-3xl font-accent font-bold border-b-4 border-black pb-2 inline-block">Active Source</h2>
                <div className="space-y-6">
                  {(user.resumes || []).length === 0 ? (
                    <div className="p-12 bg-white hand-drawn border-dashed border-4 border-zinc-200 text-center">
                      <p className="text-zinc-400 text-xl">The AI knows nothing yet.</p>
                    </div>
                  ) : (
                    user.resumes.map((res: any) => (
                      <div key={res.id} className="bg-white hand-drawn p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <FileText className="w-8 h-8 text-black" />
                          <div>
                            <p className="font-bold text-xl">{res.name}</p>
                            <p className="text-xs uppercase tracking-tighter text-zinc-400">Memory Loaded</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteResume(res.id)}
                          className="text-red-300 hover:text-red-600 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white hand-drawn shadow-sketch p-10 rotate-1">
                 <h2 className="text-3xl font-accent font-bold mb-8">Add Context</h2>
                 <label className="flex flex-col items-center justify-center w-full h-56 border-4 border-black border-dashed cursor-pointer hover:bg-yellow-50 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {loadingResume ? (
                      <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin mb-4" />
                    ) : (
                      <div className="text-6xl text-zinc-300 group-hover:text-black mb-4">+</div>
                    )}
                    <p className="font-bold text-xl text-zinc-500 group-hover:text-black">Drop PDF Here</p>
                  </div>
                  <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={loadingResume} />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto space-y-12 md:space-y-20"
          >
            {/* 🖊️ IDENTITY SECTION */}
            <section>
              <h1 className="text-5xl md:text-6xl font-accent font-bold"><span className="marker text-3xl md:text-4xl">Identity</span> Card</h1>
              <p className="text-zinc-500 text-base md:text-xl italic mt-1 font-body">Manage your scribe profile.</p>
              
              <div className="mt-12 bg-white hand-drawn shadow-sketch p-8 md:p-12 flex flex-col md:flex-row gap-8 md:gap-16 items-center rotate-1">
                <div className="w-40 h-40 border-4 border-black flex items-center justify-center -rotate-3 bg-yellow-100 flex-shrink-0 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-full paper-dots opacity-30"></div>
                  <span className="text-8xl font-accent font-bold relative z-10">{user.name?.[0] || 'U'}</span>
                </div>
                
                <div className="flex-1 w-full space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <label className="text-sm font-bold uppercase tracking-widest text-zinc-400">Full Name</label>
                      <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-transparent border-b-4 border-black py-3 text-2xl font-bold focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-bold uppercase tracking-widest text-zinc-400">Email (Permanent)</label>
                      <input 
                        type="email" 
                        defaultValue={user.email} 
                        className="w-full bg-transparent border-b-4 border-zinc-200 py-3 text-2xl font-bold text-zinc-300"
                        disabled
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleUpdateProfile}
                    className="bg-black text-white font-bold text-2xl px-12 py-4 hover:shadow-sketch active:translate-y-1 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </section>

            {/* 🔋 FUEL & API KEYS SECTION */}
            <section className="relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-4xl md:text-5xl font-accent font-bold"><span className="marker text-2xl md:text-3xl">Fuel</span> & Keys</h2>
                  <p className="text-zinc-500 text-base md:text-lg italic mt-1 font-body">Add your own power source for unlimited scribing.</p>
                </div>
                <div className="text-right hand-drawn bg-white p-4 -rotate-2">
                   <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Current Fuel Gauge</p>
                   <p className="text-4xl font-accent font-bold text-black">{user.fuel || 0}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-white hand-drawn shadow-sketch p-10 rotate-1">
                   <h3 className="text-2xl font-accent font-bold mb-6 border-b-4 border-yellow-400 inline-block">LLM Key Matrix</h3>
                   <div className="space-y-6">
                      {['gemini', 'openai', 'anthropic', 'kimi', 'grok'].map((provider) => (
                        <div key={provider} className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                            {provider} KEY
                            {user.apiKeys?.[provider] && <span className="text-green-600 font-bold">[ SAVED ]</span>}
                          </label>
                          <div className="flex gap-2">
                             <input 
                              type="password"
                              placeholder={`Enter ${provider} key...`}
                              className="flex-1 bg-zinc-50 border-2 border-black p-2 text-sm font-bold outline-none focus:bg-yellow-50"
                              onBlur={async (e) => {
                                if (!e.target.value) return;
                                try {
                                  const res = await api.verifyKey(provider, e.target.value);
                                  if (res.success) {
                                    api.updateUser({ apiKeys: { ...user.apiKeys, [provider]: e.target.value } });
                                    setNotification(`${provider.toUpperCase()} Key Inscribed! 🖊️`);
                                    setTimeout(() => window.location.reload(), 1500);
                                  } else {
                                    alert('Invalid API key for ' + provider);
                                  }
                                } catch (err) {
                                  alert('Verification failed');
                                }
                              }}
                            />
                            {user.apiKeys?.[provider] && (
                              <button 
                                onClick={() => {
                                  const keys = { ...user.apiKeys };
                                  delete (keys as any)[provider];
                                  api.updateUser({ apiKeys: keys });
                                  window.location.reload();
                                }}
                                className="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all font-bold"
                              >
                                X
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="bg-yellow-50 hand-drawn p-8 border-4 border-black -rotate-1">
                      <h4 className="font-accent text-2xl font-bold mb-4 italic">The Fuel Logic 🧪</h4>
                      <ul className="space-y-4 text-lg font-body list-disc pl-5">
                        <li>Each generation costs 1 Fuel unit.</li>
                        <li>Using your **own API key** bypasses free limits.</li>
                        <li>Fuel recharges daily if you are on a Plan.</li>
                        <li>Keep your keys secret like ink on a locked notebook.</li>
                      </ul>
                   </div>
                   
                   <div className="bg-white hand-drawn p-8 border-4 border-black rotate-1">
                      <h4 className="font-accent text-xl font-bold mb-2">Need More?</h4>
                      <p className="text-zinc-500 font-body mb-6">If your fuel runs low, upgrade to Author tier for auto-refill.</p>
                      <button onClick={() => setUpgradePlan('premium')} className="bg-black text-white font-bold w-full py-3 hover:shadow-sketch">Upgrade Fuel Tank</button>
                   </div>
                </div>
              </div>
            </section>

            {/* 💰 PLANS & UPGRADE SECTION */}
            <section className="relative">
              <h2 className="text-4xl md:text-5xl font-accent font-bold mb-12"><span className="marker text-2xl md:text-3xl">Ink</span> Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                {/* FAQ / Help Desk */}
                <div className="md:col-span-1 bg-white hand-drawn shadow-sketch p-10 rotate-1 flex flex-col">
                  <h3 className="text-2xl font-accent font-bold mb-8 border-b-4 border-black pb-2 inline-block">Scribe Help Desk</h3>
                  <div className="space-y-6 flex-1">
                    <div>
                      <p className="font-bold text-lg mb-1 italic">Q: How do I upgrade?</p>
                      <p className="text-zinc-500 text-sm">Pick a plan, fill the request form, and our admin will manually verify your ink pulse.</p>
                    </div>
                    <div>
                      <p className="font-bold text-lg mb-1 italic">Q: Is it automatic?</p>
                      <p className="text-zinc-500 text-sm">Currently, we manually approve all scribes to ensure high-fidelity sessions.</p>
                    </div>
                    <div>
                      <p className="font-bold text-lg mb-1 italic">Q: Refund Logic?</p>
                      <p className="text-zinc-500 text-sm">Once the ink is on paper, it's permanent. Contact help if you have issues.</p>
                    </div>
                  </div>
                </div>

                {/* Plans */}
                <div className="bg-white hand-drawn shadow-sketch p-8 text-center -rotate-1 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 marker text-[10px] md:text-xs font-bold rotate-12 -mr-1 -mt-1 font-body">POPULAR</div>
                  <h3 className="text-2xl md:text-3xl font-accent font-bold mb-3 md:mb-4 group-hover:text-yellow-600 transition-colors">The Scribe</h3>
                  <p className="text-5xl md:text-6xl font-accent font-bold mb-6 md:mb-8 font-body">₹99</p>
                  <ul className="text-left space-y-3 mb-10 text-sm font-bold opacity-60 px-4">
                    <li>✓ 10 Deep Scribes / Day</li>
                    <li>✓ High Fidelity Mode</li>
                    <li>✓ PDF Exports enabled</li>
                  </ul>
                  <button 
                    onClick={() => setUpgradePlan('basic')}
                    className="w-full py-4 border-4 border-black font-bold text-xl hover:bg-black hover:text-white transition-all shadow-[0_4px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                  >
                    Request Upgrade
                  </button>
                </div>

                <div className="bg-yellow-100 hand-drawn shadow-sketch p-8 text-center rotate-1 group">
                  <h3 className="text-2xl md:text-3xl font-accent font-bold mb-3 md:mb-4 group-hover:text-blue-600 transition-colors font-body">The Author</h3>
                  <p className="text-5xl md:text-6xl font-accent font-bold mb-6 md:mb-8 font-body">₹299</p>
                  <ul className="text-left space-y-3 mb-10 text-sm font-bold opacity-60 px-4">
                    <li>✓ Unlimited Deep Scribes</li>
                    <li>✓ Full Reservoir Refill</li>
                    <li>✓ 1-on-1 Help Support</li>
                  </ul>
                  <button 
                    onClick={() => setUpgradePlan('premium')}
                    className="w-full py-4 bg-black text-white font-bold text-xl hover:shadow-sketch transition-all"
                  >
                    Request Access
                  </button>
                </div>
              </div>
            </section>

            {/* 📜 PAYMENT HISTORY */}
            <section className="pb-20">
               <h2 className="text-3xl font-accent font-bold mb-8">Pulse History</h2>
               <div className="bg-white hand-drawn shadow-sketch overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-zinc-50 border-b-4 border-black text-left">
                       <tr>
                          <th className="p-6 font-bold uppercase tracking-widest text-xs">Date</th>
                          <th className="p-6 font-bold uppercase tracking-widest text-xs">Plan</th>
                          <th className="p-6 font-bold uppercase tracking-widest text-xs">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-zinc-100">
                       <tr className="hover:bg-yellow-50 transition-colors">
                          <td className="p-6 text-sm font-bold font-mono">Today</td>
                          <td className="p-6 text-sm font-bold uppercase tracking-tighter">Initial Scribe</td>
                          <td className="p-6"><span className="text-[10px] font-bold uppercase px-2 py-1 bg-green-100 text-green-700 border-2 border-green-700">Verified</span></td>
                       </tr>
                    </tbody>
                  </table>
               </div>
            </section>
          </motion.div>
        )}

        {/* 🛠️ UPGRADE MODAL */}
        <AnimatePresence>
          {upgradePlan && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-[#fffef0]/90 backdrop-blur-sm"
                 onClick={() => setUpgradePlan(null)}
               />
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 exit={{ scale: 0.9, y: 20 }}
                 className="w-full max-w-xl bg-white hand-drawn border-4 border-black p-10 shadow-sketch relative z-10"
               >
                  <h2 className="text-4xl font-accent font-bold mb-2 uppercase">Request <span className="marker">Pulse</span></h2>
                  <p className="text-zinc-500 italic mb-8">Finalizing your ink for {upgradePlan.toUpperCase()}</p>
                  
                  <form className="space-y-6" onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    await api.requestPayment(Object.fromEntries(formData));
                    setNotification('Request Transmitted! Wait for Pulse. 🖊️');
                    setUpgradePlan(null);
                  }}>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest">Name</label>
                          <input name="name" readOnly defaultValue={user.name} className="w-full border-b-2 border-black bg-zinc-50 p-2 font-bold" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest">Email</label>
                          <input name="email" readOnly defaultValue={user.email} className="w-full border-b-2 border-zinc-200 bg-transparent p-2 text-zinc-400 font-bold" />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest">Plan</label>
                          <input name="plan" readOnly defaultValue={upgradePlan} className="w-full border-b-2 border-black bg-yellow-50 p-2 font-bold uppercase" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest">Amount</label>
                          <input name="amount" readOnly defaultValue={upgradePlan === 'basic' ? '99' : '299'} className="w-full border-b-2 border-black bg-zinc-50 p-2 font-bold" />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest">Select Time Range</label>
                        <select name="duration" className="w-full border-2 border-black p-3 font-bold bg-white">
                           <option value="1 Month">1 Month Pulse</option>
                           <option value="3 Months">3 Month Session</option>
                           <option value="1 Year">Full Year Ledger</option>
                        </select>
                     </div>

                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest">Custom Note / Transaction ID</label>
                        <textarea name="message" placeholder="Paste your receipt info or any message here..." className="w-full border-2 border-black p-4 h-32 font-bold focus:bg-yellow-50 outline-none" required></textarea>
                     </div>

                     <button type="submit" className="w-full bg-black text-white py-5 font-bold text-2xl hover:bg-yellow-400 hover:text-black transition-all rotate-1">
                        Transmit Pulse Request
                     </button>
                  </form>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black flex items-center justify-around p-4 z-50 bottom-nav-safe">
        <button 
          onClick={() => setActiveTab('interviews')} 
          className={cn(
            "flex flex-col items-center gap-1 font-accent text-2xl font-bold transition-transform active:scale-90", 
            activeTab === 'interviews' ? "text-black" : "text-zinc-300"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full border border-black", activeTab === 'interviews' ? "bg-black" : "bg-transparent")} />
          Log
        </button>
        <button 
          onClick={() => setActiveTab('resume')} 
          className={cn(
            "flex flex-col items-center gap-1 font-accent text-2xl font-bold transition-transform active:scale-90", 
            activeTab === 'resume' ? "text-black" : "text-zinc-300"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full border border-black", activeTab === 'resume' ? "bg-black" : "bg-transparent")} />
          Brain
        </button>
        <button 
          onClick={() => setActiveTab('profile')} 
          className={cn(
            "flex flex-col items-center gap-1 font-accent text-2xl font-bold transition-transform active:scale-90", 
            activeTab === 'profile' ? "text-black" : "text-zinc-300"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full border border-black", activeTab === 'profile' ? "bg-black" : "bg-transparent")} />
          Me
        </button>
      </div>
    </div>
  );
}
