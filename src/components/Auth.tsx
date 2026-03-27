import React, { useState } from 'react';
import { api } from '../lib/api';
import { LogIn, UserPlus, User, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

interface AuthProps {
  onSuccess: (user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (!isLogin && !formData.name) {
      setError('Name is required for signup');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = isLogin 
        ? await api.login({ email: formData.email, password: formData.password })
        : await api.signup(formData);
      
      if (!res || !res.token) {
        throw new Error('Invalid server response');
      }
      
      localStorage.setItem('auth_token', res.token);
      onSuccess(res.user);
    } catch (err: any) {
      console.error('Auth error:', err);
      const errorMsg = err.message || (isLogin ? 'Login failed' : 'Signup failed');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center paper-dots p-6 font-body selection:bg-yellow-300">
      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-4xl sm:text-5xl font-accent font-bold text-black mb-3">
            {isLogin ? (
              <>Welcome <span className="marker text-3xl sm:text-4xl">Back</span></>
            ) : (
              <>Start for <span className="marker text-3xl sm:text-4xl">Free</span></>
            )}
          </h1>
          <p className="text-zinc-600 text-lg sm:text-xl font-body italic underline decoration-yellow-400 underline-offset-4 px-4">
            {isLogin ? 'Sign in to your practice notebook.' : 'Create an account & get 3 free sessions!'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white hand-drawn shadow-sketch p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            {!isLogin && (
              <div className="space-y-2 group">
                <label className="text-sm font-bold uppercase tracking-widest text-black">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-transparent border-b-2 border-black py-2 text-xl font-bold focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="e.g. Alex Graham"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2 group">
              <label className="text-sm font-bold uppercase tracking-widest text-black">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-transparent border-b-2 border-black py-2 text-xl font-bold focus:outline-none focus:border-yellow-500 transition-colors"
                placeholder="name@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2 group">
              <label className="text-sm font-bold uppercase tracking-widest text-black">Notebook Password</label>
              <input
                type="password"
                required
                className="w-full bg-transparent border-b-2 border-black py-2 text-xl font-bold focus:outline-none focus:border-yellow-500 transition-colors"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && (
              <div className="p-4 border-2 border-black text-red-600 text-lg font-bold text-center bg-red-50 -rotate-1">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white font-bold text-2xl py-4 hover:shadow-sketch active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <Loader2 className="w-7 h-7 animate-spin text-white" />
              ) : (
                <>
                  {isLogin ? 'Open Notebook' : 'Join Practice'}
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full mt-10 text-zinc-500 font-bold hover:text-black transition-colors"
          >
            {isLogin ? "New here? Create your notebook" : "Already have one? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
