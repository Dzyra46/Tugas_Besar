'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  user_id?: string; // For doctors, this is their doctor_id
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'pet-owner';
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check for stored user data on mount
  useEffect(() => {
    // Pastikan hanya run di client side
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem('user');
        }
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Attempting login with:', { email, password });
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important for cookies
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      document.cookie = `user=${JSON.stringify(data.user)}; path=/`;

      // Redirect based on role - use replace instead of push to avoid back button issue
      switch (data.user.role) {
        case 'admin':
          router.replace('/admin/dashboard');
          break;
        case 'doctor':
          router.replace('/doctor/dashboard');
          break;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout API endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Clear local state
      setUser(null);
      localStorage.removeItem('user');
      document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      
      // Redirect to login - use replace to avoid back button issue
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear everything even if API call fails
      setUser(null);
      localStorage.removeItem('user');
      document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      router.replace('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}