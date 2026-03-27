import { useState, useEffect } from 'react';
import { api } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { InterviewAssistant } from './components/InterviewAssistant';
import { ErrorBoundary } from './components/ErrorBoundary';
import Auth from './components/Auth';
import { Loader2, Bot, Download, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.getUser()
        .then(setUser)
        .catch(() => localStorage.removeItem('auth_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // PWA Install Prompt handling
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      const hasDismissed = localStorage.getItem('pwa_dismissed');
      
      if (!hasDismissed && !isStandalone) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_dismissed', 'true');
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen paper-dots flex flex-col items-center justify-center font-accent">
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="p-8 bg-white hand-drawn shadow-sketch mb-8"
        >
          <Bot className="w-16 h-16 text-black" />
        </motion.div>
        <p className="text-4xl font-bold italic tracking-tighter">
          <span className="marker px-2">Sketching</span> your notebook...
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Auth onSuccess={setUser} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <Dashboard 
              user={user} 
              onLogout={handleLogout} 
              onLaunchAssistant={() => setShowAssistant(true)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[100] bg-yellow-400 border-4 border-black hand-drawn shadow-sketch p-5 flex items-start gap-5"
          >
            <div className="w-12 h-12 bg-black flex items-center justify-center shrink-0 -rotate-3 hand-drawn">
              <Download className="w-7 h-7 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-accent text-xl font-bold leading-tight">Inscribe this notebook to your home screen! 🖋️</p>
              <div className="mt-4 flex items-center gap-4">
                <button 
                  onClick={handleInstallClick}
                  className="bg-black text-white px-6 py-2 font-bold text-sm hand-drawn hover:scale-105 transition-transform"
                >
                  Download App
                </button>
                <button 
                  onClick={dismissInstall} 
                  className="font-accent text-lg font-bold hover:text-red-600 transition-colors"
                >
                  [ Skip ]
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {showAssistant && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#fffef0]/80 z-40"
              onClick={() => setShowAssistant(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4 md:p-10"
            >
              <div className="pointer-events-auto w-full max-w-5xl h-full flex items-center justify-center">
                <InterviewAssistant onClose={() => setShowAssistant(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
