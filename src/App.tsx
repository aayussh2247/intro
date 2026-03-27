import { useState, useEffect } from 'react';
import { api } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { InterviewAssistant } from './components/InterviewAssistant';
import { ErrorBoundary } from './components/ErrorBoundary';
import Auth from './components/Auth';
import { Loader2 } from 'lucide-react';

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

  // Hotkey to toggle assistant (Ctrl + Shift + I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowAssistant(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onSuccess={setUser} />;
  }

  return (
    <ErrorBoundary>
      <Dashboard 
        user={user} 
        onLogout={handleLogout} 
        onLaunchAssistant={() => setShowAssistant(true)} 
      />
      {showAssistant && (
        <InterviewAssistant onClose={() => setShowAssistant(false)} />
      )}
    </ErrorBoundary>
  );
}
