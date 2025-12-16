import {createAdminClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';

export interface Doctor {
  id: string;
  user_id: string;
  name: string;
  email: string;
  specialization: string;
  license_number: string;
  phone: string;
  status: 'active' | 'inactive';
  join_date: string;
}

export class DoctorService {
  // Get all doctors from database
  static async getAll(): Promise<Doctor[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('doctors_with_users')
        .select('id, user_id, name, email, specialization, license_number, phone, status, join_date, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doctors:', error);
        throw new Error('Failed to fetch doctors from supabase');
      }

      // Map database fields to Doctor interface
      return (data || []).map(row => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        specialization: row.specialization,
        license_number: row.license_number,
        phone: row.phone,
        status: row.status,
        join_date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    } catch (error) {
      console.error('DoctorService.getAll error:', error);
      throw error;
    }
  }

  // Get doctor by ID
  static async getById(id: string): Promise<Doctor | undefined> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('doctors_with_users')
        .select('id, user_id, name, email, specialization, license_number, phone, status, join_date, created_at, updated_at')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        return undefined;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        email: data.email,
        specialization: data.specialization,
        license_number: data.license_number,
        phone: data.phone,
        status: data.status,
        join_date: data.created_at ? new Date(data.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('DoctorService.getById error:', error);
      return undefined;
    }
  }

  // Create new doctor (User and Doctor records)
  static async create(data: Omit<Doctor, 'id' | 'join_date'> & { password: string }): Promise<Doctor> {
    try {
      const supabase = createAdminClient();

      // 1. Hash the password
      const passwordHash = await hashPassword(data.password);

      // 2. Create user account
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          name: data.name,
          email: data.email,
          password_hash: passwordHash, // Use hashed password
          role: 'doctor'
        })
        .select()
        .single();

      if (userError || !userData) {
        console.error('Error creating user:', userError);
        throw new Error(userError?.message || 'Failed to create doctor user account');
      }

      // 3. Create doctor record
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .insert({
          user_id: userData.id,
          specialization: data.specialization,
          license_number: data.license_number,
          phone: data.phone,
          status: data.status || 'active'
        })
        .select()
        .single();

      if (doctorError || !doctorData) {
        console.error('Error creating doctor:', doctorError);
        // Rollback: delete the user
        await supabase.from('users').delete().eq('id', userData.id);
        throw new Error(doctorError?.message || 'Failed to create doctor record');
      }

      // 4. Return the created doctor
      return {
        id: doctorData.id,
        user_id: userData.id,
        name: data.name,
        email: data.email,
        specialization: data.specialization,
        license_number: data.license_number,
        phone: data.phone,
        status: data.status || 'active',
        join_date: doctorData.join_date || new Date(doctorData.created_at).toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('DoctorService.create error:', error);
      throw error;
    }
  }

  // Update doctor
  static async update(id: string, data: Partial<Doctor>): Promise<Doctor | null> {
    try {
      const supabase = createAdminClient();

      // Prepare update data for doctors table
      const doctorUpdate: any = {};
      if (data.specialization) doctorUpdate.specialization = data.specialization;
      if (data.license_number) doctorUpdate.license_number = data.license_number;
      if (data.phone) doctorUpdate.phone = data.phone;
      if (data.status) doctorUpdate.status = data.status;

      // Update doctor record
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .update(doctorUpdate)
        .eq('id', id)
        .select()
        .single();

      if (doctorError || !doctorData) {
        console.error('Error updating doctor:', doctorError);
        return null;
      }

      // If name or email is being updated, update user record too
      if (data.name || data.email) {
        const userUpdate: any = {};
        if (data.name) userUpdate.name = data.name;
        if (data.email) userUpdate.email = data.email;

        await supabase
          .from('users')
          .update(userUpdate)
          .eq('id', doctorData.user_id);
      }

      // Fetch updated doctor with user info
      return await this.getById(id) || null;
    } catch (error) {
      console.error('DoctorService.update error:', error);
      return null;
    }
  }

  // Delete doctor
  static async delete(id: string): Promise<boolean> {
    try {
      const supabase = createAdminClient();

      // Get doctor to find associated user_id
      const { data: doctor, error: fetchError } = await supabase
        .from('doctors')
        .select('user_id')
        .eq('id', id)
        .single();
      
      if (fetchError || !doctor) {
        console.error('Doctor not found:', fetchError);
        return false;
      }

      // Delete doctor record (cascade will handle related records)
      const { error: doctorError } = await supabase
        .from('doctors')
        .delete()
        .eq('id', id);

      if (doctorError) {
        console.error('Error deleting doctor:', doctorError);
        return false;
      }

      // Delete user account
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', doctor.user_id);

      if (userError) {
        console.error('Error deleting user:', userError);
        // Doctor deleted but user remains - log this
      }

      return true;
    } catch (error) {
      console.error('DoctorService.delete error:', error);
      return false;
    }
  }

  // Seach doctors
  static async search(query: string): Promise<Doctor[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('doctors_with_users')
        .select('id, user_id, name, email, specialization, license_number, phone, status, join_date, created_at, updated_at')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,specialization.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching doctors:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        specialization: row.specialization,
        license_number: row.license_number,
        phone: row.phone,
        status: row.status,
        join_date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    } catch (error) {
      console.error('DoctorService.search error:', error);
      return [];
    }
  }

  // Filter doctors by status
  static async filterByStatus(status: Doctor['status']): Promise<Doctor[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('doctors_with_users')
        .select('id, user_id, name, email, specialization, license_number, phone, status, join_date, created_at, updated_at')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error filtering doctors:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        specialization: row.specialization,
        license_number: row.license_number,
        phone: row.phone,
        status: row.status,
        join_date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    } catch (error) {
      console.error('DoctorService.filterByStatus error:', error);
      return [];
    }
  }
}