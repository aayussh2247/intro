const rawApiUrl = import.meta.env.VITE_API_URL || 'https://intro-ai-backend.onrender.com';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

// Debug logging for API configuration
if (typeof window !== 'undefined') {
  console.log('[API] Base URL:', API_BASE_URL);
  console.log('[API] Environment:', import.meta.env.MODE);
}

const getToken = () => {
  const token = localStorage.getItem('auth_token');
  return token;
};

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
  fuel: number;
  plan: 'free' | 'basic' | 'premium';
  resumes: Resume[];
  apiKeys?: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
    kimi?: string;
    grok?: string;
  };
}

export const api = {
  // Auth
  signup: async (data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Signup failed: ${res.statusText}`);
      }
      const result = await res.json();
      if (!result.token || !result.user) {
        throw new Error('Invalid response format from server');
      }
      return result;
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    }
  },
  login: async (data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Login failed: ${res.statusText}`);
      }
      const result = await res.json();
      if (!result.token || !result.user) {
        throw new Error('Invalid response format from server');
      }
      return result;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  },
  forgotPassword: async (email: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },
  resetPassword: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getUser: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
        }
        throw new Error(`Failed to fetch user: ${res.statusText}`);
      }
      return res.json();
    } catch (error: any) {
      console.error('Get user error:', error);
      throw error;
    }
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
  generateAIResponse: async (question: string, resumeContext: string, provider?: string) => {
    const res = await fetch(`${API_BASE_URL}/ai/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ question, resumeContext, provider }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'The scribe is paralyzed.');
    }
    return res.json();
  },
  summarizeInterview: async (transcript: string, provider?: string) => {
    const res = await fetch(`${API_BASE_URL}/ai/summarize`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ transcript, provider }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Summarization failed.');
    }
    return res.json();
  },
  verifyKey: async (provider: string, key: string) => {
    const res = await fetch(`${API_BASE_URL}/user/verify-key`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ provider, key }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Verification failed.');
    }
    return res.json();
  },
  requestPayment: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/payments/request`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Payment request failed.');
    }
    return res.json();
  },
};
