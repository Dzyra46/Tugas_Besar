import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, validateSession, deleteSession } from '@/lib/auth/session';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'pet-owner';
  user_id?: string; // For doctors, this is their doctor_id
  created_at?: string;
  updated_at?: string;
}

export class AuthService {
  /**
   * Register new user
   */
  static async register(data: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'doctor' | 'pet-owner';
  }): Promise<User> {
    const supabase = createAdminClient();

    // 0. Validate and sanitize input
    const email = data.email.trim().toLowerCase();
    const password = data.password;
    const role = data.role;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[^\s]{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new Error('Password must be at least 8 characters and contain uppercase, lowercase, number, and special character');
    }

    // Validate role
    const validRoles = ['admin', 'doctor'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    // 1. Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name: data.name,
        email: email,
        password_hash: passwordHash,
        role: role,
      })
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (error) {
      console.error('Registration error:', error);
      throw new Error('Failed to register user');
    }

    return newUser;
  }

  /**
   * Login user
   */
  static async login(email: string, password: string): Promise<{
    user: User & { user_id?: string };
    session: { token: string; expires_at: string };
  }> {
    const supabase = createAdminClient();

    // 1. Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, password_hash, created_at, updated_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      throw new Error('Invalid email or password');
    }

    // 2. Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

     // 3. If user is a doctor, fetch their doctor_id (user_id in doctors table)
    let doctorId: string | undefined;
    if (user.role === 'doctor') {
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (doctorData) {
        doctorId = doctorData.id;
      }
    }

    // 4. Create session
    const session = await createSession(user.id);

    // 5. Return user (without password_hash) and session
    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        user_id: doctorId, // Add doctor_id for doctor users
      },
      session: {
        token: session.token,
        expires_at: session.expires_at,
      },
    };
  }

  /**
   * Validate session and get user
   */
  static async validateSession(token: string): Promise<User | null> {
    const session = await validateSession(token);

    if (!session || !session.users) {
      return null;
    }

    // Return user without password_hash
    const { password_hash, ...user } = session.users;
    
    // If user is a doctor, fetch their doctor_id
    if (user.role === 'doctor') {
      const supabase = createAdminClient();
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (doctorData) {
        return {
          ...user,
          user_id: doctorData.id,
        } as User;
      }
    }
    
    return user as User;
  }

  /**
   * Logout user
   */
  static async logout(token: string): Promise<void> {
    await deleteSession(token);
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const supabase = createAdminClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    // If user is a doctor, fetch their doctor_id
    if (user.role === 'doctor') {
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (doctorData) {
        return {
          ...user,
          user_id: doctorData.id,
        };
      }
    }

    return user;
  }

  /**
   * Create session response with cookie
   */
  static createSessionResponse(user: User, session: { token: string; expires_at: string }) {
    const response = NextResponse.json({ 
      success: true,
      user,
      session: {
        expires_at: session.expires_at
      }
    });

    // Set session token di cookie (HttpOnly untuk security)
    response.cookies.set({
      name: 'session_token',
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: new Date(session.expires_at),
    });

    return response;
  }

  /**
   * Clear session cookie
   */
  static clearSessionResponse() {
    const response = NextResponse.json({ success: true });
    
    response.cookies.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0, // Expire immediately
    });

    return response;
  }
}