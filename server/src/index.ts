import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check
app.get('/', (req: Request, res: Response) => {
  res.send('INTRO AI Backend is Scribing! 🖊️');
});

// AI Setup helper
const getGeminiClients = () => {
  const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  return keys.map(apiKey => new GoogleGenAI({ apiKey }));
};
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const AI_PROVIDER = 'gemini'; // Forced gemini over claude to fix credit issues
const SYSTEM_INSTRUCTION = "You are a professional candidate. Answer instantly in ONE short sentence. Be conversational but concise. Use spoken human language.";

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://user:pass@cluster0.mongodb.net/intro-ai?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('MongoDB connection error. Server will continue in limited mode.');
    console.error(err.message);
  });

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  credits: { type: Number, default: 3 }, // Free tier: 3 interviews
  fuel: { type: Number, default: 100 }, // 100 energy units
  plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscriptionEnabled: { type: Boolean, default: false },
  subscriptionExpires: Date,
  apiKeys: {
    gemini: String,
    openai: String,
    anthropic: String,
    kimi: String,
    grok: String
  },
  lastInterviewDate: { type: Date, default: Date.now },
  interviewsToday: { type: Number, default: 0 },
  resumes: [{
    name: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

const interviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  transcript: [{
    speaker: String,
    text: String,
    timestamp: String
  }],
  summary: String,
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: String,
  amount: Number,
  duration: String, // e.g. "1 Month"
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  message: String,
  requestDate: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Interview = mongoose.model('Interview', interviewSchema);
const Payment = mongoose.model('Payment', paymentSchema);

// Transporter Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Auth Routes
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      email, 
      password: hashedPassword, 
      name, 
      credits: 3,
      fuel: 100 
    });
    
    // Welcome Email (non-blocking)
    if (process.env.EMAIL_USER) {
      transporter.sendMail({
        from: `INTRO AI <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to INTRO AI! 🖋️',
        text: `Hello ${name},\n\nWelcome to INTRO AI! Your account has been created successfully.\n\nYou have 3 free interview credits to get started.\n\nHappy Interviewing!`
      }).catch(err => console.error('Welcome email error:', err));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
    return res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        credits: user.credits,
        fuel: user.fuel,
        plan: user.plan 
      } 
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid password' });

    // Login Alert (non-blocking)
    if (process.env.EMAIL_USER) {
      transporter.sendMail({
        from: `INTRO AI <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Login Alert: New sign-in to INTRO AI',
        text: `Hello ${user.name},\n\nA new login was detected for your INTRO AI account at ${new Date().toLocaleString()}.\n\nIf this was not you, please secure your account immediately.`
      }).catch(err => console.error('Login email error:', err));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
    return res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        credits: user.credits,
        fuel: user.fuel,
        plan: user.plan,
        resumes: user.resumes || []
      } 
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'https://intro-ai.vercel.app';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    if (process.env.EMAIL_USER) {
      await transporter.sendMail({
        from: `INTRO AI <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request - INTRO AI',
        text: `Hello ${user.name},\n\nYou requested to reset your password. Click the link below to set a new one:\n\n${resetLink}\n\nThis link will expire in 1 hour.`
      });
    }

    res.json({ message: 'Reset email sent' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({ 
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    if (process.env.EMAIL_USER) {
      transporter.sendMail({
        from: `INTRO AI <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Password Changed Successfully',
        text: `Hello ${user.name},\n\nYour INTRO AI password has been updated successfully.\n\nIf you did not make this change, please contact support immediately.`
      }).catch(err => console.error('Reset success email error:', err));
    }

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Auth Middleware
const authenticate = (role?: 'user' | 'admin') => async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    
    if (role && req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// User Profile & Keys
app.get('/api/user', authenticate(), async (req: any, res: Response) => {
  res.json(req.user);
});

app.put('/api/user', authenticate(), async (req: any, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/user/verify-key', authenticate(), async (req: any, res: Response) => {
  const { provider, key } = req.body;
  try {
    if (provider === 'gemini') {
      const client = new GoogleGenAI({ apiKey: key });
      await client.models.generateContent({ 
        model: 'gemini-1.5-flash', 
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
      });
    } else if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: key });
      await client.messages.create({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] });
    } else if (provider === 'openai' || provider === 'kimi' || provider === 'grok') {
      const baseUrl = provider === 'kimi' ? 'https://api.moonshot.cn/v1' 
                    : provider === 'grok' ? 'https://api.x.ai/v1'
                    : 'https://api.openai.com/v1';
      await axios.get(`${baseUrl}/models`, { headers: { 'Authorization': `Bearer ${key}` } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Invalid API Key for ' + provider });
  }
});

// Interviews
app.get('/api/interviews', authenticate(), async (req: any, res: Response) => {
  try {
    const interviews = await Interview.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create Interview & Trigger Notifications
app.post('/api/interviews', authenticate(), async (req: any, res: Response) => {
  try {
    const user = req.user;
    
    // Check Credits
    if (user.plan === 'premium') {
      const today = new Date().toDateString();
      if (user.lastInterviewDate.toDateString() !== today) {
        user.interviewsToday = 0;
      }
      if (user.interviewsToday >= 5) {
        return res.status(403).json({ error: 'Daily limit reached (Premium plan)' });
      }
      user.interviewsToday += 1;
      user.lastInterviewDate = new Date();
    } else {
      if (user.credits <= 0) {
        return res.status(403).json({ error: 'No credits left. Please upgrade to continue.' });
      }
      user.credits -= 1;
    }
    await user.save();

    const interview = await Interview.create({ ...req.body, userId: user._id });
    
    // Trigger Email Notification (Direct)
    if (process.env.EMAIL_USER) {
      const mailOptions = {
        from: `INTRO AI Success <${process.env.EMAIL_USER}>`,
        to: user.email, // Notify user
        subject: `Interview Success: ${interview.title}`,
        text: `Hello ${user.name},\n\nYour interview session "${interview.title}" has been saved successfully.\n\nSummary:\n${interview.summary}\n\nYou have ${user.credits} interviews left.\n\nTranscript is available in your dashboard.`
      };

      transporter.sendMail(mailOptions).catch((err: any) => console.error('Email error:', err));
    }

    // Trigger n8n Webhooks
    const payload = {
      id: interview._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      title: interview.title,
      summary: interview.summary,
      transcript: interview.transcript,
      timestamp: new Date()
    };

    if (process.env.N8N_WEBHOOK_EMAIL) {
      axios.post(process.env.N8N_WEBHOOK_EMAIL, payload).catch((err: any) => console.error('n8n Email Webhook error:', err));
    }
    
    if (process.env.N8N_WEBHOOK_WHATSAPP) {
      axios.post(process.env.N8N_WEBHOOK_WHATSAPP, payload).catch((err: any) => console.error('n8n WhatsApp Webhook error:', err));
    }

    res.json({ interview, userCredits: user.credits });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Delete Interview
app.delete('/api/interviews/:id', async (req: Request, res: Response) => {
  try {
    await Interview.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// AI Endpoints
app.post('/api/ai/generate', authenticate(), async (req: any, res: Response) => {
  const { question, resumeContext, provider: incomingProvider } = req.body;
  const provider = (incomingProvider || AI_PROVIDER || 'gemini') as string;
  
  try {
    const prompt = `
      You are an AI interview copilot.
      Live audio transcript: "${question}"
      
      Resume context: ${resumeContext ? resumeContext : 'None'}
      
      INSTRUCTIONS:
      1. If this transcript sounds like the candidate answering, or just agreement ("ok", "yes"), reply EXACTLY with: IGNORE
      2. If it's a question for the candidate, provide the EXACT words the candidate should speak.
      3. Keep the answer EXTREMELY SHORT (1-2 sentences).
      4. Use simple human language.
    `;

    let text = '';
    const user = (req as any).user;

    if (!user) {
        console.error('[AI] No user object in request');
        return res.status(401).json({ error: 'Identity matrix unreadable. Please re-sign.' });
    }

    // Use User's own key if available
    const userKey = user?.apiKeys?.[provider];

    // Check & Initialize Fuel for existing users
    if (user.fuel === undefined || user.fuel === null) {
        user.fuel = 100;
        await user.save();
    }
    
    // Only block if NO user key AND no fuel
    if (!userKey && user.fuel <= 0 && user.plan !== 'premium') {
      return res.status(403).json({ error: 'Out of Fuel! Please add more or provide your own API key in Profile.' });
    }

    console.log(`[AI] Generating with Gemini for ${user.email}`);

    // Gemini Implementation
    const geminiClients = userKey 
      ? [new GoogleGenAI({ apiKey: userKey })]
      : getGeminiClients();

    if (geminiClients.length === 0) {
      return res.status(500).json({ error: 'Gemini API not configured.' });
    }

    let lastError: any;
    for (const client of geminiClients) {
      try {
        const result = await (client as any).models.generateContent({
          model: 'gemini-2.0-flash-lite',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          system_instruction: SYSTEM_INSTRUCTION
        });
        text = (result.text || '').trim();
        if (text) break;
      } catch (err) {
        lastError = err;
        console.error('[Gemini Loop Error]', (err as Error).message);
      }
    }
    if (!text && lastError) throw lastError;
    
    // Decrease Fuel (Only if using platform keys)
    if (user && !userKey) {
      user.fuel = Math.max(0, (user.fuel || 0) - 1); // 1 Fuel per turn
      await user.save();
    }

    res.json({ text, fuel: user?.fuel });
  } catch (err) {
    console.error('AI ERROR [Generate]:', (err as Error).message);
    res.status(500).json({ error: 'AI Generation failed: ' + (err as Error).message });
  }
});

app.post('/api/ai/summarize', authenticate(), async (req: any, res: Response) => {
  const { transcript } = req.body;
  
  try {
    let summary = '';
    const prompt = `Summarize this interview session. Highlight key questions asked and areas for improvement.\n\nTranscript:\n${transcript}`;

    const geminiClients = getGeminiClients();
    if (geminiClients.length === 0) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    let lastError: any;
    for (const client of geminiClients) {
      try {
        const result = await (client as any).models.generateContent({
          model: 'gemini-2.0-flash-lite',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        summary = (result.text || '').trim();
        if (summary) break;
      } catch (err) {
        console.error('Gemini Summarization Key Fail, trying next...', (err as Error).message);
        lastError = err;
      }
    }

    if (!summary && lastError) throw lastError;
    res.json({ summary });
  } catch (err) {
    console.error('AI Summarization Error:', err);
    res.status(500).json({ error: 'Failed to summarize' });
  }
});

app.get('/api/ai/models', async (req: Request, res: Response) => {
  try {
    const clients = getGeminiClients();
    if (clients.length === 0) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }
    const response = await (clients[0] as any).models.list();
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin Routes
app.get('/api/admin/users', authenticate('admin'), async (req: any, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/users', authenticate('admin'), async (req: any, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/admin/users/:id', authenticate('admin'), async (req: any, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/interviews', authenticate('admin'), async (req: any, res: Response) => {
  try {
    const interviews = await Interview.find().populate('userId', 'name email').sort({ createdAt: -1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Payments
app.post('/api/payments/request', authenticate(), async (req: any, res: Response) => {
  try {
    const payment = await Payment.create({
      userId: req.user._id,
      ...req.body,
      status: 'pending'
    });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/payments', authenticate('admin'), async (req: any, res: Response) => {
  try {
    const payments = await Payment.find().populate('userId', 'name email').sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/admin/payments/:id', authenticate('admin'), async (req: any, res: Response) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/setup', async (req: Request, res: Response) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) return res.status(403).json({ error: 'Admin already initialized' });
    
    // Create Default Admin
    const hashedPassword = await bcrypt.hash('admin', 10);
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@intro.ai',
      password: hashedPassword,
      role: 'admin',
      credits: 999,
      fuel: 999
    });
    
    res.json({ message: 'Default Admin Created', email: 'admin@intro.ai', password: 'admin' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
