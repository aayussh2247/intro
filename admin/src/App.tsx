import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  LayoutDashboard, 
  CreditCard, 
  Activity, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  Zap, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Edit3, 
  Search,
  Check,
  X,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// --- Types ---
interface User {
  _id: string;
  name: string;
  email: string;
  credits: number;
  fuel: number;
  plan: 'free' | 'basic' | 'premium';
  role: 'user' | 'admin';
  subscriptionEnabled: boolean;
  subscriptionExpires?: string;
  createdAt: string;
}

interface Interview {
  _id: string;
  userId: { _id: string; name: string; email: string };
  title: string;
  summary: string;
  createdAt: string;
}

// --- Main App ---
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [view, setView] = useState<'dashboard' | 'users' | 'payments' | 'activity'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Login Form
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const usersRes = await axios.get(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(usersRes.data);

      const intRes = await axios.get(`${API_BASE}/admin/interviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInterviews(intRes.data);
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, loginData);
      if (res.data.user.role !== 'admin') {
        throw new Error('Access denied: Admins only.');
      }
      localStorage.setItem('admin_token', res.data.token);
      setToken(res.data.token);
      setIsLoggedIn(true);
    } catch (err: any) {
      setLoginError(err.response?.data?.error || err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setIsLoggedIn(false);
  };

  const updateUser = async (id: string, updates: any) => {
    try {
      await axios.put(`${API_BASE}/admin/users/${id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh
      fetchData();
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update user');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 scanline relative overflow-hidden">
        <div className="w-full max-w-md glass p-8 rounded-2xl relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black italic neon-glow mb-2 tracking-tighter uppercase">Admin Core</h1>
            <p className="text-zinc-500 text-sm font-medium">Restricted Access // Authorization Required</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2 block">Calyx ID</label>
              <input 
                type="text" 
                placeholder="EMAIL"
                className="w-full bg-black/50 border border-zinc-700 p-4 rounded-xl outline-none focus:border-cyan-400 text-white transition-all shadow-lg"
                value={loginData.email}
                onChange={e => setLoginData({...loginData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2 block">Key Phrase</label>
              <input 
                type="password" 
                placeholder="PASSWORD"
                className="w-full bg-black/50 border border-zinc-700 p-4 rounded-xl outline-none focus:border-cyan-400 text-white transition-all shadow-lg"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                required
              />
            </div>
            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
            <button className="w-full bg-cyan-400 py-4 rounded-xl text-black font-black uppercase tracking-tighter hover:bg-white transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              INITIALIZE SESSION
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Sub-components ---
  const Dashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="neon-card p-6 rounded-2xl">
        <Users className="text-cyan-400 mb-4" />
        <h3 className="text-zinc-500 text-xs font-bold uppercase mb-1">Total Souls</h3>
        <p className="text-4xl font-black neon-glow">{users.length}</p>
      </div>
      <div className="neon-card p-6 rounded-2xl">
        <Zap className="text-yellow-400 mb-4" />
        <h3 className="text-zinc-500 text-xs font-bold uppercase mb-1">Total Fuel</h3>
        <p className="text-4xl font-black text-yellow-400">{users.reduce((acc, u) => acc + (u.fuel || 0), 0)}</p>
      </div>
      <div className="neon-card p-6 rounded-2xl">
        <CreditCard className="text-purple-400 mb-4" />
        <h3 className="text-zinc-500 text-xs font-bold uppercase mb-1">Active Plans</h3>
        <p className="text-4xl font-black text-purple-400">{users.filter(u => u.subscriptionEnabled).length}</p>
      </div>
      <div className="neon-card p-6 rounded-2xl">
        <Activity className="text-green-400 mb-4" />
        <h3 className="text-zinc-500 text-xs font-bold uppercase mb-1">Total scribes</h3>
        <p className="text-4xl font-black neon-green-glow">{interviews.length}</p>
      </div>

      <div className="md:col-span-3 neon-card p-8 rounded-3xl">
        <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3">
          <Clock className="text-cyan-400" /> Recent Lifeforms
        </h2>
        <div className="space-y-4">
          {users.slice(0, 5).map(u => (
            <div key={u._id} className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <p className="text-lg font-bold">{u.name}</p>
                <p className="text-zinc-500 text-xs">{u.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-black text-cyan-400">{u.plan}</p>
                <p className="text-zinc-600 text-[10px]">{new Date(u.createdAt).toDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const UserList = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black uppercase neon-glow tracking-tighter">Lifeform Management</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name/email..."
            className="bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-6 py-2 outline-none focus:border-cyan-400 transition-all text-sm w-64"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-4">
          <thead>
            <tr className="text-left text-zinc-500 text-[10px] font-black uppercase tracking-widest px-6">
              <th className="px-6 py-2">Info</th>
              <th className="px-6 py-2">Status</th>
              <th className="px-6 py-2">Fuel/Credits</th>
              <th className="px-6 py-2">Subscription</th>
              <th className="px-6 py-2">Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
              <tr key={u._id} className="glass rounded-2xl group hover:border-cyan-400 transition-all">
                <td className="px-6 py-6 rounded-l-2xl">
                  <p className="text-lg font-black group-hover:text-cyan-400 transition-all">{u.name}</p>
                  <p className="text-zinc-500 text-xs tracking-tight">{u.email}</p>
                </td>
                <td className="px-6">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${u.plan === 'free' ? 'border-zinc-700 text-zinc-500' : 'border-purple-400 text-purple-400'}`}>
                    {u.plan}
                  </span>
                </td>
                <td className="px-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                       <Zap size={10} /> Fuel: {u.fuel}
                    </span>
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                       <CreditCard size={10} /> Sessions: {u.credits}
                    </span>
                  </div>
                </td>
                <td className="px-6">
                  {u.subscriptionEnabled ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={14} />
                      <span className="text-[10px] font-bold">Expires: {u.subscriptionExpires ? new Date(u.subscriptionExpires).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[10px]">No Subscription</span>
                  )}
                </td>
                <td className="px-6 rounded-r-2xl">
                  <button 
                    onClick={() => setEditingUser(u)}
                    className="p-3 bg-zinc-800 hover:bg-cyan-400 hover:text-black transition-all rounded-xl"
                  >
                    <Edit3 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-black">
      {/* Sidebar */}
      <div className="w-72 bg-[#0a0a0a] border-r border-zinc-800 p-8 flex flex-col items-center">
        <h1 className="text-2xl font-black italic neon-glow mb-12 uppercase tracking-tighter">Core API</h1>
        
        <nav className="w-full space-y-2 flex-1">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold transition-all ${view === 'dashboard' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/20' : 'text-zinc-500 hover:text-white'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setView('users')}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold transition-all ${view === 'users' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/20' : 'text-zinc-500 hover:text-white'}`}
          >
            <Users size={20} /> Lifeforms
          </button>
          <button 
            onClick={() => setView('activity')}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold transition-all ${view === 'activity' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/20' : 'text-zinc-500 hover:text-white'}`}
          >
            <Activity size={20} /> Activity Web
          </button>
        </nav>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold text-zinc-500 hover:text-red-500 transition-all border border-zinc-800 hover:border-red-500/50"
        >
          <LogOut size={20} /> Terminate
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-12 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
             <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin neon-glow"></div>
          </div>
        ) : (
          <>
            {view === 'dashboard' && <Dashboard />}
            {view === 'users' && <UserList />}
            {view === 'activity' && (
              <div className="space-y-8">
                <h1 className="text-3xl font-black uppercase neon-glow tracking-tighter">Global Signal Web</h1>
                <div className="grid grid-cols-1 gap-6">
                  {interviews.map(inv => (
                    <div key={inv._id} className="glass p-8 rounded-3xl border-l-8 border-l-cyan-400">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-black uppercase tracking-tight">{inv.title}</h3>
                          <p className="text-zinc-400 text-xs">Generated by {inv.userId?.name} ({inv.userId?.email})</p>
                        </div>
                        <span className="text-zinc-600 text-[10px] font-bold">{new Date(inv.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-zinc-500 text-sm leading-relaxed italic">"{inv.summary}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl neon-card rounded-3xl p-10 overflow-hidden relative"
            >
              <button 
                onClick={() => setEditingUser(null)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-all"
              >
                <X size={24} />
              </button>

              <h2 className="text-3xl font-black neon-glow uppercase mb-8 tracking-tighter">Adjust Lifeform Metrics</h2>
              
              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Core Power (Fuel)</label>
                  <div className="flex items-center gap-4">
                     <input 
                      type="number" 
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-cyan-400"
                      value={editingUser.fuel}
                      onChange={e => setEditingUser({...editingUser, fuel: parseInt(e.target.value)})}
                    />
                    <button 
                      onClick={() => updateUser(editingUser._id, { fuel: editingUser.fuel })}
                      className="bg-zinc-800 p-4 rounded-xl hover:bg-cyan-400 hover:text-black transition-all"
                    >
                      <Check size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Free Tier (Scribes)</label>
                  <div className="flex items-center gap-4">
                     <input 
                      type="number" 
                      className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-cyan-400"
                      value={editingUser.credits}
                      onChange={e => setEditingUser({...editingUser, credits: parseInt(e.target.value)})}
                    />
                    <button 
                      onClick={() => updateUser(editingUser._id, { credits: editingUser.credits })}
                      className="bg-zinc-800 p-4 rounded-xl hover:bg-cyan-400 hover:text-black transition-all"
                    >
                      <Check size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass p-6 rounded-2xl border-l-8 border-l-purple-400 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tighter">Subscription Pulse</h4>
                  <p className="text-zinc-500 text-xs">Force status override or expiration date.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => updateUser(editingUser._id, { 
                      subscriptionEnabled: !editingUser.subscriptionEnabled,
                      plan: !editingUser.subscriptionEnabled ? 'premium' : 'free',
                      subscriptionExpires: !editingUser.subscriptionEnabled ? new Date(Date.now() + 2592000000).toISOString() : null
                    })}
                    className={`px-8 py-3 rounded-xl font-black uppercase tracking-tight transition-all ${editingUser.subscriptionEnabled ? 'bg-red-500 text-white' : 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]'}`}
                  >
                    {editingUser.subscriptionEnabled ? 'TERMINATE' : 'INITIALIZE'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
