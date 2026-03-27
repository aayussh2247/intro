import { useState, useEffect } from 'react';
import { api } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { InterviewAssistant } from './components/InterviewAssistant';
import { ErrorBoundary } from './components/ErrorBoundary';
import Auth from './components/Auth';
import { Loader2, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);

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
  }, []);

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
