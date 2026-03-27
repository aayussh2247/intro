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
  Plus,
  ArrowRight,
  TrendingUp,
  Cpu,
  Fingerprint
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

interface Payment {
  _id: string;
  userId: { _id: string; name: string; email: string };
  plan: string;
  amount: number;
  duration: string;
  status: 'pending' | 'verified' | 'rejected';
  message: string;
  createdAt: string;
}

// --- Main App ---
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [view, setView] = useState<'dashboard' | 'users' | 'payments' | 'activity'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
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

  useEffect(() => {
    if (token && view === 'payments') {
      fetchPayments();
    }
  }, [token, view]);

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

  const fetchPayments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, loginData);
      if (res.data.user.role !== 'admin') {
        throw new Error('Access denied: Unauthorized identity.');
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
      fetchData();
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert('Failed to transmit data to core.');
    }
  };

  const verifyPayment = async (id: string, status: string, userId: string, plan: string) => {
    try {
      await axios.put(`${API_BASE}/admin/payments/${id}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (status === 'verified') {
        // Upgrade User
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 1);
        await axios.put(`${API_BASE}/admin/users/${userId}`, { 
          plan, 
          subscriptionEnabled: true,
          subscriptionExpires: expires.toISOString(),
          fuel: 100, // Refill fuel on payment
          credits: plan === 'premium' ? 999 : 50
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchData();
      fetchPayments();
    } catch (err) {
      alert('Verification failed');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 grid-bg bg-black relative">
        <div className="absolute inset-0 scanline opacity-30 pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-panel p-10 rounded-3xl border border-cyan-400/20 shadow-[0_0_50px_rgba(34,213,238,0.05)] relative z-10"
        >
          <div className="text-center mb-10">
            <div className="inline-block p-4 rounded-full border border-cyan-400/30 mb-6 neon-border-blue animate-pulse-border">
              <ShieldCheck className="w-10 h-10 text-cyan-400" />
            </div>
            <h1 className="text-4xl font-black italic neon-text-blue mb-2 tracking-tighter uppercase">CORE ACCESS</h1>
            <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase opacity-80">Encryption Level 42 // Scribes Admin Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <Fingerprint className="absolute right-4 top-11 text-zinc-700 group-focus-within:text-cyan-400 transition-colors" size={16} />
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">System Identifier</label>
              <input 
                type="email" 
                placeholder="EMAIL@CORE.API"
                className="w-full bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl outline-none focus:border-cyan-400 text-cyan-50 transition-all font-mono text-sm placeholder:text-zinc-800"
                value={loginData.email}
                onChange={e => setLoginData({...loginData, email: e.target.value})}
                required
              />
            </div>
            <div className="relative group">
              <Cpu className="absolute right-4 top-11 text-zinc-700 group-focus-within:text-cyan-400 transition-colors" size={16} />
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">Calyx Keyphrase</label>
              <input 
                type="password" 
                placeholder="********"
                className="w-full bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl outline-none focus:border-cyan-400 text-cyan-50 transition-all font-mono text-sm placeholder:text-zinc-800"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                required
              />
            </div>
            {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-tighter text-center">{loginError}</p>}
            <button className="neon-button w-full bg-cyan-400 py-4 rounded-xl text-black font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:bg-white flex items-center justify-center gap-3">
              INITIALIZE SYNC <ArrowRight size={16}/>
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // --- Dashboard View ---
  const Dashboard = () => (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-black italic neon-text-blue tracking-tighter uppercase mb-2">SYSTEM OVERVIEW</h1>
          <p className="text-zinc-500 text-xs font-bold tracking-[0.3em] uppercase opacity-60">Real-time data visualization // Live Core Pulse</p>
        </div>
        <div className="text-right glass-panel px-6 py-4 rounded-2xl border-l-4 border-l-cyan-400">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Network Status</p>
          <p className="text-sm font-black text-green-400 animate-pulse uppercase tracking-tighter">● SYNCHRONIZED</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[
          { icon: Users, label: 'TOTAL SOULS', val: users.length, color: 'text-cyan-400', cls: 'neon-border-blue' },
          { icon: Zap, label: 'GLOBAL ENERGY', val: users.reduce((acc, u) => acc + (u.fuel || 0), 0), color: 'text-yellow-400', cls: 'border-[#fbbf2433]' },
          { icon: CreditCard, label: 'ACTIVE PLANS', val: users.filter(u => u.subscriptionEnabled).length, color: 'text-purple-400', cls: 'neon-border-purple' },
          { icon: TrendingUp, label: 'CORE SCRIBES', val: interviews.length, color: 'text-green-400', cls: 'border-[#4ade8033]' }
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-panel p-8 rounded-3xl ${item.cls} flex flex-col justify-between h-48 group hover:-translate-y-2 transition-transform cursor-pointer`}
          >
            <div className={`p-3 rounded-2xl bg-zinc-900 w-fit ${item.color}`}>
              <item.icon size={24} />
            </div>
            <div>
              <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{item.label}</h3>
              <p className={`text-4xl font-black ${item.color}`}>{item.val.toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="glass-panel p-10 rounded-[3rem] border border-cyan-400/10">
          <h2 className="text-2xl font-black neon-text-blue uppercase mb-8 flex items-center gap-4 italic">
            <Clock className="w-8 h-8"/> NEW LIFEFORMS
          </h2>
          <div className="space-y-6">
            {users.slice(0, 5).map(u => (
              <div key={u._id} className="flex items-center justify-between border-b border-zinc-900 pb-6 group cursor-pointer hover:pl-2 transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-400/10 flex items-center justify-center font-black text-cyan-400 border border-cyan-400/30">
                     {u.name[0]}
                   </div>
                   <div>
                    <p className="text-lg font-black group-hover:text-cyan-400 transition-colors">{u.name}</p>
                    <p className="text-zinc-600 font-mono text-[10px] uppercase">{u.email}</p>
                   </div>
                </div>
                <div className="text-right">
                   <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-500">{u.plan}</span>
                   <p className="text-zinc-800 text-[10px] font-mono mt-1 font-bold">{new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setView('users')} className="w-full mt-8 py-4 bg-zinc-950 border border-zinc-900 rounded-2xl text-[10px] font-black uppercase hover:bg-cyan-400 hover:text-black transition-all">Expand Matrix</button>
        </div>

        <div className="glass-panel p-10 rounded-[3rem] border border-green-400/10 bg-gradient-to-br from-zinc-950/20 to-transparent">
          <h2 className="text-2xl font-black neon-text-green uppercase mb-8 flex items-center gap-4 italic tracking-tighter">
            <Activity className="w-8 h-8"/> RECENT SIGNAL BURSTS
          </h2>
          <div className="space-y-6">
            {interviews.slice(0, 4).map(inv => (
              <div key={inv._id} className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-900 hover:border-green-400/30 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight group-hover:text-green-400 transition-colors">{inv.title}</h3>
                    <p className="text-zinc-600 text-[10px] uppercase font-bold mt-1 tracking-widest">{inv.userId?.name || 'Unknown'}</p>
                  </div>
                  <span className="text-zinc-800 text-[10px] font-black">{new Date(inv.createdAt).getHours()}:{new Date(inv.createdAt).getMinutes()} UTC</span>
                </div>
                <p className="text-zinc-500 text-[11px] leading-relaxed line-clamp-2 italic font-medium">"{inv.summary}"</p>
              </div>
            ))}
          </div>
          <button onClick={() => setView('activity')} className="w-full mt-8 py-4 bg-zinc-950 border border-zinc-900 rounded-2xl text-[10px] font-black uppercase hover:bg-green-400 hover:text-black transition-all">Access Signal Repository</button>
        </div>
      </div>
    </div>
  );

  const UserList = () => (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
        <div>
          <h1 className="text-6xl font-black italic neon-text-blue tracking-tighter uppercase mb-2">ENTITY DATABASE</h1>
          <p className="text-zinc-500 text-[10px] font-black tracking-[0.4em] uppercase opacity-80">Cataloging all active lifeforms in the network</p>
        </div>
        <div className="relative w-full md:w-80 h-14">
          <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by ID or Key String..."
            className="w-full h-full bg-zinc-950/50 border border-zinc-900 rounded-2xl pl-14 pr-8 py-2 outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,243,255,0.1)] transition-all text-sm font-bold placeholder:text-zinc-800"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto pb-12">
        <table className="w-full border-separate border-spacing-y-4">
          <thead>
            <tr className="text-left text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] px-8 mb-4 block">
              <th className="px-8 py-2 w-[40%]">ENTITY IDENTITY</th>
              <th className="px-4 py-2 w-[15%]">ACCESS TIER</th>
              <th className="px-4 py-2 w-[15%]">MATRIX POWER</th>
              <th className="px-4 py-2 w-[20%]">LIFE STATUS</th>
              <th className="px-4 py-2 w-[10%] text-right pr-12">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="block space-y-4">
            {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
              <tr key={u._id} className="glass-panel rounded-[2rem] border border-zinc-900 group hover:border-cyan-400 transition-all flex items-center p-2">
                <td className="px-8 py-6 rounded-l-2xl w-[40%] flex items-center gap-6">
                   <div className="w-16 h-16 rounded-3xl bg-black border-2 border-zinc-900 flex items-center justify-center font-black text-2xl text-cyan-400 group-hover:border-cyan-400/50 group-hover:neon-border-blue transition-all">
                      {u.name[0]}
                   </div>
                   <div>
                    <p className="text-xl font-black group-hover:text-cyan-400 transition-all uppercase tracking-tighter leading-none mb-1">{u.name}</p>
                    <p className="text-zinc-500 font-mono text-[10px] uppercase font-bold tracking-widest">{u.email}</p>
                   </div>
                </td>
                <td className="px-4 w-[15%]">
                  <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full border ${u.plan === 'free' ? 'border-zinc-800 text-zinc-600 bg-zinc-950' : 'neon-border-purple text-purple-400 bg-purple-400/10 shadow-[0_0_10px_rgba(157,0,255,0.1)]'}`}>
                    {u.plan}
                  </span>
                </td>
                <td className="px-4 w-[15%]">
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-black text-yellow-400 flex items-center gap-2 uppercase tracking-tight">
                       <Zap size={14} className="fill-yellow-400"/> {u.fuel} FUEL
                    </span>
                    <span className="text-[11px] font-black text-cyan-400 flex items-center gap-2 uppercase tracking-tight">
                       <CreditCard size={14}/> {u.credits} SES
                    </span>
                  </div>
                </td>
                <td className="px-4 w-[20%]">
                  {u.subscriptionEnabled ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle size={14} className="fill-green-400/20" />
                        <span className="text-[10px] font-black uppercase tracking-widest">ACTIVE SYNC</span>
                      </div>
                      <p className="text-zinc-600 text-[9px] font-black uppercase tracking-tighter pl-6">Ends: {u.subscriptionExpires ? new Date(u.subscriptionExpires).toLocaleDateString() : 'IMMEDIATE'}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-700 grayscale">
                      <XCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest italic font-medium opacity-50">Inactive Pulse</span>
                    </div>
                  )}
                </td>
                <td className="px-4 rounded-r-2xl w-[10%] text-right pr-8">
                  <button 
                    onClick={() => setEditingUser(u)}
                    className="p-4 bg-zinc-950 border border-zinc-900 hover:neon-border-blue hover:text-cyan-400 transition-all rounded-2xl group-hover:shadow-[0_0_15px_rgba(0,243,255,0.1)]"
                  >
                    <Settings size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PaymentView = () => (
    <div className="space-y-12">
      <div className="mb-12">
        <h1 className="text-6xl font-black italic neon-text-purple tracking-tighter uppercase mb-2">SUBSCRIPTION HUB</h1>
        <p className="text-zinc-500 text-[10px] font-black tracking-[0.4em] uppercase opacity-80">Economic flow and manual authorization center</p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {payments.length === 0 && <p className="text-center text-zinc-500 py-20 font-black uppercase">No Pulse Requests Found</p>}
        {payments.map(p => (
          <div key={p._id} className={`glass-panel p-8 rounded-[2.5rem] border-l-8 ${p.status === 'pending' ? 'border-l-yellow-400' : p.status === 'verified' ? 'border-l-green-400' : 'border-l-red-400'} flex items-center justify-between group hover:pl-10 transition-all`}>
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${p.status === 'pending' ? 'text-yellow-400 border-yellow-400/30' : 'text-purple-400 border-purple-400/30'}`}>
                    <CreditCard size={28}/>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase mb-1 tracking-tight">{p.userId?.name}'s Request</h3>
                  <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">{p.userId?.email} // {p.duration}</p>
                  <p className="text-zinc-400 text-xs mt-2 italic">"{p.message}"</p>
                </div>
              </div>
              <div className="flex items-center gap-12 text-right">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-600 mb-1">Status</p>
                  <p className={`text-sm font-black uppercase tracking-tighter ${p.status === 'pending' ? 'text-yellow-400' : 'text-green-400'}`}>{p.status.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-600 mb-1">Tier / Amount</p>
                  <p className="text-sm font-black text-purple-400 uppercase tracking-tighter">₹{p.amount} ({p.plan})</p>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => verifyPayment(p._id, 'verified', p.userId?._id, p.plan)} className="bg-green-500 text-black px-6 py-3 rounded-xl font-black uppercase text-[10px]">Approve</button>
                    <button onClick={() => verifyPayment(p._id, 'rejected', p.userId?._id, p.plan)} className="bg-red-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px]">Reject</button>
                  </div>
                )}
              </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ActivityView = () => (
    <div className="space-y-12">
      <div className="mb-12">
        <h1 className="text-6xl font-black italic neon-text-green tracking-tighter uppercase mb-2">SIGNAL REPOSITORY</h1>
        <p className="text-zinc-500 text-[10px] font-black tracking-[0.4em] uppercase opacity-80">Deep-dive logs of all artificial interactions</p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {interviews.map(inv => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            key={inv._id} 
            className="glass-panel p-10 rounded-[3rem] border-l-8 border-l-green-400 group hover:bg-zinc-950/40 transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic mb-1 group-hover:text-green-400 transition-colors">{inv.title}</h3>
                <p className="text-zinc-500 text-[10px] uppercase font-black bg-zinc-900 px-3 py-1 rounded inline-block mt-2 tracking-widest border border-zinc-800">Origin: {inv.userId?.name || 'ERR'} ({inv.userId?.email || 'N/A'})</p>
              </div>
              <span className="text-zinc-700 text-[10px] font-black uppercase tracking-widest font-mono border border-zinc-800 px-4 py-2 rounded-xl">{new Date(inv.createdAt).toLocaleString()}</span>
            </div>
            <div className="p-6 bg-black/40 rounded-3xl border border-zinc-900/50">
              <p className="text-zinc-400 text-sm leading-relaxed font-medium italic opacity-80">"{inv.summary}"</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-black font-sans text-cyan-50 relative overflow-hidden grid-bg">
      <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />
      
      {/* Sidebar */}
      <div className="w-80 glass-panel border-r border-cyan-400/10 flex flex-col items-center p-10 relative z-20">
        <div className="mb-16 text-center">
            <h1 className="text-3xl font-black italic neon-text-blue tracking-tighter uppercase mb-1">CORE 1.0</h1>
            <p className="text-[8px] font-black tracking-[0.5em] text-zinc-500 uppercase opacity-60">Admin Interlink // intro-ai</p>
        </div>
        
        <nav className="w-full space-y-4 flex-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'CORE OVERVIEW' },
            { id: 'users', icon: Users, label: 'LIFEFORM MATRIX' },
            { id: 'payments', icon: CreditCard, label: 'SUB FLOW CONTROL' },
            { id: 'activity', icon: Activity, label: 'SURVEILLANCE GRID' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`w-full group flex items-center gap-5 px-6 h-16 rounded-2xl font-black tracking-widest text-xs uppercase transition-all border ${view === item.id ? 'bg-cyan-400 text-black neon-border-blue shadow-[0_0_20px_rgba(0,243,255,0.2)]' : 'text-zinc-600 border-transparent hover:border-zinc-800 hover:text-white hover:bg-zinc-950/50'}`}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-4 h-16 rounded-2xl font-black text-xs uppercase text-zinc-600 hover:text-red-500 transition-all border border-zinc-900/50 hover:border-red-500/40 bg-zinc-950/20 group"
        >
          <LogOut size={18} className="group-hover:rotate-180 transition-transform duration-500" /> DISCONNECT
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-16 h-screen overflow-y-auto relative z-10 custom-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center">
             <div className="w-16 h-16 border-[6px] border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin neon-glow"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "circOut" }}
            >
              {view === 'dashboard' && <Dashboard />}
              {view === 'users' && <UserList />}
              {view === 'payments' && <PaymentView />}
              {view === 'activity' && <ActivityView />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="w-full max-w-2xl glass-panel rounded-[3.5rem] p-12 overflow-hidden relative border border-cyan-400/20"
            >
              <button 
                onClick={() => setEditingUser(null)}
                className="absolute top-10 right-10 text-zinc-600 hover:text-white transition-all transform hover:rotate-90 duration-500"
              >
                <X size={32} />
              </button>

              <div className="mb-12">
                <h2 className="text-4xl font-black neon-text-blue uppercase tracking-tighter italic mb-2">METRIC MODES</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Calibrating identity: {editingUser.name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-10 mb-12">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 block">Energy Source (Fuel)</label>
                  <div className="flex items-center gap-4">
                     <input 
                      type="number" 
                      className="w-full h-16 bg-black border border-zinc-900 p-6 rounded-2xl outline-none focus:border-cyan-400 text-xl font-black transition-all"
                      value={editingUser.fuel}
                      onChange={e => setEditingUser({...editingUser, fuel: parseInt(e.target.value) || 0})}
                    />
                    <button 
                      onClick={() => updateUser(editingUser._id, { fuel: editingUser.fuel })}
                      className="h-16 aspect-square bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-center hover:neon-border-blue hover:text-cyan-400 transition-all text-zinc-600"
                    >
                      <Check size={24} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 block">Scribe Credits (Free)</label>
                  <div className="flex items-center gap-4">
                     <input 
                      type="number" 
                      className="w-full h-16 bg-black border border-zinc-900 p-6 rounded-2xl outline-none focus:border-cyan-400 text-xl font-black transition-all"
                      value={editingUser.credits}
                      onChange={e => setEditingUser({...editingUser, credits: parseInt(e.target.value) || 0})}
                    />
                    <button 
                      onClick={() => updateUser(editingUser._id, { credits: editingUser.credits })}
                      className="h-16 aspect-square bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-center hover:neon-border-blue hover:text-cyan-400 transition-all text-zinc-600"
                    >
                      <Check size={24} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-400/20 flex flex-col md:flex-row items-center justify-between gap-8 mb-4 group relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-6">
                   <div className={`p-5 rounded-3xl ${editingUser.subscriptionEnabled ? 'bg-red-500/10 text-red-500' : 'bg-purple-500/10 text-purple-400'} border border-current opacity-70`}>
                      <CreditCard size={32}/>
                   </div>
                   <div>
                    <h4 className={`text-2xl font-black uppercase tracking-tighter ${editingUser.subscriptionEnabled ? 'text-red-500' : 'neon-text-purple'}`}>Manual Sync Pulse</h4>
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-1">Status: {editingUser.subscriptionEnabled ? 'OVERRIDE ENABLED' : 'RESTRICTED'}</p>
                   </div>
                </div>
                <div className="relative z-10">
                  <button 
                    onClick={() => updateUser(editingUser._id, { 
                      subscriptionEnabled: !editingUser.subscriptionEnabled,
                      plan: !editingUser.subscriptionEnabled ? 'premium' : 'free',
                      subscriptionExpires: !editingUser.subscriptionEnabled ? new Date(Date.now() + 2592000000).toISOString() : null
                    })}
                    className={`px-12 h-16 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border duration-500 ${editingUser.subscriptionEnabled ? 'bg-black text-red-500 border-red-500/50 hover:bg-red-500 hover:text-black' : 'bg-purple-500 text-white border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:bg-white hover:text-black hover:neon-border-purple'}`}
                  >
                    {editingUser.subscriptionEnabled ? 'TERMINATE PULSE' : 'INITIALIZE SYNC'}
                  </button>
                </div>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 p-8 text-white/5 font-black text-6xl tracking-tighter select-none pointer-events-none uppercase italic translate-x-1/4 -translate-y-1/4 rotate-12">
                    {editingUser.subscriptionEnabled ? 'ACTIVE' : 'LOCKED'}
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
