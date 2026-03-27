const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('auth_token');

export interface Resume {
  id: string;
  name: string;
  text: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: 'free' | 'basic' | 'premium';
  resumes: Resume[];
}

export const api = {
  // Auth
  signup: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Signup failed');
    }
    return res.json();
  },
  login: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
    return res.json();
  },

  getUser: async () => {
    const res = await fetch(`${API_BASE_URL}/user`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },
  updateUser: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/user`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },
  getInterviews: async () => {
    const res = await fetch(`${API_BASE_URL}/interviews`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Failed to fetch interviews');
    return res.json();
  },
  createInterview: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/interviews`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create interview');
    }
    return res.json();
  },
  deleteInterview: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/interviews/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Failed to delete interview');
    return res.json();
  },
  generateAIResponse: async (question: string, resumeContext: string) => {
    const res = await fetch(`${API_BASE_URL}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, resumeContext }),
    });
    if (!res.ok) throw new Error('AI Generation failed');
    return res.json();
  },
  summarizeInterview: async (transcript: string) => {
    const res = await fetch(`${API_BASE_URL}/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error('AI Summarization failed');
    return res.json();
  },
};
