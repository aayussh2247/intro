import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
  res.send('INTRO AI Backend is Scribing! 🖊️');
});

// AI Setup
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
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
  plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  lastInterviewDate: { type: Date, default: Date.now },
  interviewsToday: { type: Number, default: 0 },
  resumes: [{
    name: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
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

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword, name, credits: 3 });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, credits: user.credits } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, credits: user.credits, plan: user.plan } });
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

// User Profile
app.get('/api/user', authenticate, async (req: any, res) => {
  res.json(req.user);
});

app.put('/api/user', authenticate, async (req: any, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Interviews
app.get('/api/interviews', authenticate, async (req: any, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create Interview & Trigger Notifications
app.post('/api/interviews', authenticate, async (req: any, res) => {
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
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email, // Notify user
        subject: `Interview Success: ${interview.title}`,
        text: `Hello ${user.name},\n\nYour interview session "${interview.title}" has been saved successfully.\n\nSummary:\n${interview.summary}\n\nYou have ${user.credits} interviews left.\n\nTranscript is available in your dashboard.`
      };

      transporter.sendMail(mailOptions).catch(err => console.error('Email error:', err));
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
      axios.post(process.env.N8N_WEBHOOK_EMAIL, payload).catch(err => console.error('n8n Email Webhook error:', err));
    }
    
    if (process.env.N8N_WEBHOOK_WHATSAPP) {
      axios.post(process.env.N8N_WEBHOOK_WHATSAPP, payload).catch(err => console.error('n8n WhatsApp Webhook error:', err));
    }

    res.json({ interview, userCredits: user.credits });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Delete Interview
app.delete('/api/interviews/:id', async (req, res) => {
  try {
    await Interview.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// AI Endpoints
app.post('/api/ai/generate', async (req, res) => {
  const { question, resumeContext } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

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

    const result = await genAI.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    
    const text = (result.text || '').trim();
    
    res.json({ text });
  } catch (err) {
    console.error('AI Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  const { transcript } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const result = await genAI.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Summarize this interview session. Highlight key questions asked and areas for improvement.\n\nTranscript:\n${transcript}` }] }]
    });
    res.json({ summary: result.text || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to summarize' });
  }
});

app.get('/api/ai/models', async (req, res) => {
  try {
    const response = await (genAI as any).models.list();
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
