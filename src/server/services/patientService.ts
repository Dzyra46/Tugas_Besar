import { createAdminClient } from '@/lib/supabase/server';

export interface Patient {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  birth_date?: string;
  owner: string;
  owner_id: string;
  contact: string;
  qr_code: string;
  status: 'healthy' | 'under-treatment' | 'recovered';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export class PatientService {
  // Get all patients from database
  static async getAll(): Promise<Patient[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('patients_with_owners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching patients:', error);
        throw new Error('Failed to fetch patients from database');
      }

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        species: row.species,
        breed: row.breed,
        age: row.age || 0,
        weight: row.weight || 0,
        birth_date: row.birth_date,
        owner: row.owner,
        owner_id: row.owner_id,
        contact: row.contact,
        qr_code: row.qr_code,
        status: row.status || 'healthy',
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('PatientService.getAll error:', error);
      throw error;
    }
  }

  // Get patient by ID
  static async getById(id: string): Promise<Patient | undefined> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('patients_with_owners')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return undefined;
      }

      return {
        id: data.id,
        name: data.name,
        species: data.species,
        breed: data.breed,
        age: data.age || 0,
        weight: data.weight || 0,
        birth_date: data.birth_date,
        owner: data.owner,
        owner_id: data.owner_id,
        contact: data.contact,
        qr_code: data.qr_code,
        status: data.status || 'healthy',
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      console.error('PatientService.getById error:', error);
      return undefined;
    }
  }

  // Create new patient with owner account
  static async create(data: Omit<Patient, 'id' | 'qr_code' | 'owner_id'> & { ownerEmail: string }): Promise<Patient> {
    try {
      const supabase = createAdminClient();

      // 1. Check if owner user exists by email
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', data.ownerEmail)
        .eq('role', 'pet-owner')
        .single();

      let ownerId: string;

      if (existingUser) {
        // Owner already exists
        ownerId = existingUser.id;
      } else {
        // 2. Create new owner user account
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            name: data.owner,
            email: data.ownerEmail,
            password_hash: await require('bcryptjs').hash('TempPass123!', 12), // Temporary password
            role: 'pet-owner'
          })
          .select()
          .single();

        if (userError || !newUser) {
          console.error('Error creating owner user:', userError);
          throw new Error('Failed to create owner account');
        }

        ownerId = newUser.id;
      }

      // 3. Calculate birth_date from age if provided
      let birthDate = data.birth_date;
      if (!birthDate && data.age) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - Math.floor(data.age);
        birthDate = `${birthYear}-01-01`;
      }

      // 4. Create patient record
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert({
          name: data.name,
          species: data.species,
          breed: data.breed,
          age: data.age,
          weight: data.weight,
          birth_date: birthDate,
          owner_id: ownerId,
          owner: data.owner,
          contact: data.contact,
          status: data.status || 'healthy',
          notes: data.notes || null,
          qr_code: 'PENDING' // Temporary, will update below
        })
        .select()
        .single();

      if (patientError || !patientData) {
        console.error('Error creating patient:', patientError);
        throw new Error('Failed to create patient record');
      }

      // 5. Generate and update QR code
      const qrCode = `PET|${patientData.id}|${data.name}|${data.owner}|${new Date().toISOString().split('T')[0]}`;
      
      const { error: qrUpdateError } = await supabase
        .from('patients')
        .update({ qr_code: qrCode })
        .eq('id', patientData.id);

      if (qrUpdateError) {
        console.error('Error updating QR code:', qrUpdateError);
      }

      // 6. Return created patient
      return {
        id: patientData.id,
        name: patientData.name,
        species: patientData.species,
        breed: patientData.breed,
        age: patientData.age || 0,
        weight: patientData.weight || 0,
        birth_date: patientData.birth_date,
        owner: patientData.owner,
        owner_id: ownerId,
        contact: patientData.contact,
        qr_code: qrCode,
        status: patientData.status || 'healthy',
        notes: patientData.notes,
        created_at: patientData.created_at,
        updated_at: patientData.updated_at
      };
    } catch (error) {
      console.error('PatientService.create error:', error);
      throw error;
    }
  }

  // Update patient
  static async update(id: string, data: Partial<Patient>): Promise<Patient | null> {
    try {
      const supabase = createAdminClient();

      // Prepare update data
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.species) updateData.species = data.species;
      if (data.breed) updateData.breed = data.breed;
      if (data.age !== undefined) updateData.age = data.age;
      if (data.weight !== undefined) updateData.weight = data.weight;
      if (data.birth_date) updateData.birth_date = data.birth_date;
      if (data.owner) updateData.owner = data.owner;
      if (data.contact) updateData.contact = data.contact;
      if (data.status) updateData.status = data.status;
      if (data.notes !== undefined) updateData.notes = data.notes;

      updateData.updated_at = new Date().toISOString();

      const { data: patientData, error } = await supabase
        .from('patients')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !patientData) {
        console.error('Error updating patient:', error);
        return null;
      }

      return await this.getById(id) || null;
    } catch (error) {
      console.error('PatientService.update error:', error);
      return null;
    }
  }

  // Delete patient
  static async delete(id: string): Promise<boolean> {
    try {
      const supabase = createAdminClient();

      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting patient:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('PatientService.delete error:', error);
      return false;
    }
  }

  // Search patients
  static async search(query: string): Promise<Patient[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('patients_with_owners')
        .select('*')
        .or(`name.ilike.%${query}%,owner.ilike.%${query}%,species.ilike.%${query}%,breed.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching patients:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        species: row.species,
        breed: row.breed,
        age: row.age || 0,
        weight: row.weight || 0,
        birth_date: row.birth_date,
        owner: row.owner,
        owner_id: row.owner_id,
        contact: row.contact,
        qr_code: row.qr_code,
        status: row.status || 'healthy',
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('PatientService.search error:', error);
      return [];
    }
  }

  // Filter by status
  static async filterByStatus(status: Patient['status']): Promise<Patient[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('patients_with_owners')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error filtering patients:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        species: row.species,
        breed: row.breed,
        age: row.age || 0,
        weight: row.weight || 0,
        birth_date: row.birth_date,
        owner: row.owner,
        owner_id: row.owner_id,
        contact: row.contact,
        qr_code: row.qr_code,
        status: row.status || 'healthy',
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('PatientService.filterByStatus error:', error);
      return [];
    }
  }

  // Get patients by owner
  static async getByOwner(ownerName: string): Promise<Patient[]> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('patients_with_owners')
        .select('*')
        .ilike('owner', ownerName)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching patients by owner:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        species: row.species,
        breed: row.breed,
        age: row.age || 0,
        weight: row.weight || 0,
        birth_date: row.birth_date,
        owner: row.owner,
        owner_id: row.owner_id,
        contact: row.contact,
        qr_code: row.qr_code,
        status: row.status || 'healthy',
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('PatientService.getByOwner error:', error);
      return [];
    }
  }
}
