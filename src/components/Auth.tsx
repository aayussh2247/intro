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
    setLoading(true);
    setError('');

    try {
      const res = isLogin 
        ? await api.login({ email: formData.email, password: formData.password })
        : await api.signup(formData);
      
      localStorage.setItem('auth_token', res.token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-48 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-0 -right-48 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />

      <div className="w-full max-w-md relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-4">
            <User className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Get Started Free'}
          </h1>
          <p className="text-gray-400">
            {isLogin ? 'Sign in to continue your interview prep' : 'Create an account and get 3 free interviews'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#121214] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="text"
                    required
                    className="w-full bg-[#1a1a1c] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="email"
                  required
                  className="w-full bg-[#1a1a1c] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="password"
                  required
                  className="w-full bg-[#1a1a1c] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full mt-6 text-gray-400 text-sm hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Signup" : "Already have an account? Signin"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
