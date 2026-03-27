import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import nodemailer from 'nodemailer';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const SYSTEM_INSTRUCTION = "You are a human candidate in an interview. Respond with the exact spoken words you would use. Keep it extremely short, simple, and conversational.";

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

const User = mongoose.model('User', userSchema);
const Interview = mongoose.model('Interview', interviewSchema);

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
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword, name, credits: 3 });
    
    // Welcome Email
    if (process.env.EMAIL_USER) {
      transporter.sendMail({
        from: `INTRO AI <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to INTRO AI! 🖋️',
        text: `Hello ${name},\n\nWelcome to INTRO AI! Your account has been created successfully.\n\nYou have 3 free interview credits to get started.\n\nHappy Interviewing!`
      }).catch(err => console.error('Welcome email error:', err));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, credits: user.credits } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });

    // Login Alert
    if (process.env.EMAIL_USER) {
      transporter.sendMail({
        from: `INTRO AI <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Login Alert: New sign-in to INTRO AI',
        text: `Hello ${user.name},\n\nA new login was detected for your INTRO AI account at ${new Date().toLocaleString()}.\n\nIf this was not you, please secure your account immediately.`
      }).catch(err => console.error('Login email error:', err));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, credits: user.credits, plan: user.plan } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
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
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// User Profile & Keys
app.get('/api/user', authenticate, async (req: any, res: Response) => {
  res.json(req.user);
});

app.put('/api/user', authenticate, async (req: any, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/user/verify-key', authenticate, async (req: any, res: Response) => {
  const { provider, key } = req.body;
  try {
    if (provider === 'gemini') {
      const client = new GoogleGenAI({ apiKey: key });
      await client.models.generateContent({ model: 'gemini-1.5-flash', contents: 'Hi' });
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
app.get('/api/interviews', authenticate, async (req: any, res: Response) => {
  try {
    const interviews = await Interview.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create Interview & Trigger Notifications
app.post('/api/interviews', authenticate, async (req: any, res: Response) => {
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
app.post('/api/ai/generate', authenticate, async (req: any, res: Response) => {
  const { question, resumeContext, provider = AI_PROVIDER } = req.body;
  
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

    // Check Fuel
    if (user && (user.fuel || 0) <= 0) {
      return res.status(403).json({ error: 'Out of Fuel! Please add more in your profile.' });
    }

    // Use User's own key if available
    const userKey = user?.apiKeys?.[provider];

    if (provider === 'claude' || provider === 'anthropic') {
      const anthropicClient = userKey 
        ? new Anthropic({ apiKey: userKey })
        : anthropic;

      const message = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        system: SYSTEM_INSTRUCTION,
        messages: [{ role: 'user', content: prompt }],
      });
      text = (message.content[0] as any).text || '';
    } else if (provider === 'openai' || provider === 'kimi' || provider === 'grok') {
      // Logic for OpenAI compatible providers
      const baseUrl = provider === 'kimi' ? 'https://api.moonshot.cn/v1' 
                    : provider === 'grok' ? 'https://api.x.ai/v1'
                    : 'https://api.openai.com/v1';
      
      const key = userKey || process.env.OPENAI_API_KEY;
      if (!key) return res.status(400).json({ error: `API key for ${provider} not found.` });

      const response = await axios.post(`${baseUrl}/chat/completions`, {
        model: provider === 'kimi' ? 'moonshot-v1-8k' : provider === 'grok' ? 'grok-beta' : 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      text = response.data.choices[0].message.content;
    } else {
      // Gemini
      const geminiClients = userKey 
        ? [new GoogleGenAI({ apiKey: userKey })]
        : getGeminiClients();

      if (geminiClients.length === 0) {
        return res.status(500).json({ error: 'Gemini API not configured.' });
      }

      let lastError: any;
      for (const client of geminiClients) {
        try {
          const result = await client.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction: SYSTEM_INSTRUCTION }
          });
          text = (result.text || '').trim();
          if (text) break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!text && lastError) throw lastError;
    }
    
    // Decrease Fuel
    if (user) {
      user.fuel = Math.max(0, (user.fuel || 0) - 1); // 1 Fuel per turn
      await user.save();
    }

    res.json({ text, fuel: user?.fuel });
  } catch (err) {
    console.error('AI ERROR [Generate]:', (err as Error).message);
    if ((err as any).response) {
      console.error('API Response Error:', (err as any).response.data);
    }
    res.status(500).json({ error: 'AI Generation failed: ' + (err as Error).message });
  }
});

app.post('/api/ai/summarize', authenticate, async (req: any, res: Response) => {
  const { transcript, provider = AI_PROVIDER } = req.body;
  
  try {
    let summary = '';
    const prompt = `Summarize this interview session. Highlight key questions asked and areas for improvement.\n\nTranscript:\n${transcript}`;

    if (provider === 'claude') {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      summary = (message.content[0] as any).text || '';
    } else {
      const geminiClients = getGeminiClients();
      if (geminiClients.length === 0) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      let lastError: any;
      for (const client of geminiClients) {
        try {
          const result = await client.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });
          summary = result.text || '';
          if (summary) break;
        } catch (err) {
          console.error('Gemini Summarization Key Fail, trying next...', (err as Error).message);
          lastError = err;
        }
      }

      if (!summary && lastError) {
        throw lastError;
      }
    }
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
    const response = await clients[0].models.list();
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
