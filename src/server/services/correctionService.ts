import { createAdminClient } from '@/lib/supabase/server';

export interface CorrectionRequest {
  id: string;
  record_id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  doctor_name: string;
  field: string;
  current_value: string;
  proposed_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at?: string;
  decided_at?: string;
  decided_by?: string;
}

export class CorrectionService {
  // Get all correction requests
  static async getAll(): Promise<CorrectionRequest[]> {
    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase
        .from('corrections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching corrections:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        record_id: row.record_id,
        patient_id: row.patient_id,
        doctor_id: row.doctor_id,
        patient_name: row.patient_name,
        doctor_name: row.doctor_name,
        field: row.field,
        current_value: row.current_value,
        proposed_value: row.proposed_value,
        reason: row.reason,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        decided_at: row.decided_at,
        decided_by: row.decided_by
      }));
    } catch (error) {
      console.error('CorrectionService.getAll error:', error);
      return [];
    }
  }

  // Get by ID
  static async getById(id: string): Promise<CorrectionRequest | undefined> {
    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase
        .from('corrections')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return undefined;
      }

      return {
        id: data.id,
        record_id: data.record_id,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        patient_name: data.patient_name,
        doctor_name: data.doctor_name,
        field: data.field,
        current_value: data.current_value,
        proposed_value: data.proposed_value,
        reason: data.reason,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        decided_at: data.decided_at,
        decided_by: data.decided_by
      };
    } catch (error) {
      console.error('CorrectionService.getById error:', error);
      return undefined;
    }
  }

  // Get by status
  static async getByStatus(status: CorrectionRequest['status']): Promise<CorrectionRequest[]> {
    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase
        .from('corrections')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error filtering corrections by status:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        record_id: row.record_id,
        patient_id: row.patient_id,
        doctor_id: row.doctor_id,
        patient_name: row.patient_name,
        doctor_name: row.doctor_name,
        field: row.field,
        current_value: row.current_value,
        proposed_value: row.proposed_value,
        reason: row.reason,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        decided_at: row.decided_at,
        decided_by: row.decided_by
      }));
    } catch (error) {
      console.error('CorrectionService.getByStatus error:', error);
      return [];
    }
  }

  // Get by doctor ID
  static async getByDoctor(doctorId: string): Promise<CorrectionRequest[]> {
    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase
        .from('corrections')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching corrections by doctor:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        record_id: row.record_id,
        patient_id: row.patient_id,
        doctor_id: row.doctor_id,
        patient_name: row.patient_name,
        doctor_name: row.doctor_name,
        field: row.field,
        current_value: row.current_value,
        proposed_value: row.proposed_value,
        reason: row.reason,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        decided_at: row.decided_at,
        decided_by: row.decided_by
      }));
    } catch (error) {
      console.error('CorrectionService.getByDoctor error:', error);
      return [];
    }
  }

  // Create new correction request
  static async create(data: {
    recordId: string;
    patientId: string;
    patientName: string;
    doctorName: string;
    field: string;
    currentValue: string;
    proposedValue: string;
    reason: string;
  }): Promise<CorrectionRequest> {
    try {
      const supabase = createAdminClient();

      // Get doctor_id from doctor name (assuming doctor is authenticated)
      // For now, we'll use a placeholder. In production, get from session.
      const { data: doctor } = await supabase
        .from('doctors_with_users')
        .select('id')
        .eq('name', data.doctorName)
        .single();

      if (!doctor) {
        throw new Error('Doctor not found');
      }

      const { data: correctionData, error } = await supabase
        .from('corrections')
        .insert({
          record_id: data.recordId,
          patient_id: data.patientId,
          doctor_id: doctor.id,
          patient_name: data.patientName,
          doctor_name: data.doctorName,
          field: data.field,
          current_value: data.currentValue,
          proposed_value: data.proposedValue,
          reason: data.reason,
          status: 'pending'
        })
        .select()
        .single();

      if (error || !correctionData) {
        console.error('Error creating correction:', error);
        throw new Error('Failed to create correction request');
      }

      return {
        id: correctionData.id,
        record_id: correctionData.record_id,
        patient_id: correctionData.patient_id,
        doctor_id: correctionData.doctor_id,
        patient_name: correctionData.patient_name,
        doctor_name: correctionData.doctor_name,
        field: correctionData.field,
        current_value: correctionData.current_value,
        proposed_value: correctionData.proposed_value,
        reason: correctionData.reason,
        status: correctionData.status,
        created_at: correctionData.created_at,
        updated_at: correctionData.updated_at,
        decided_at: correctionData.decided_at,
        decided_by: correctionData.decided_by
      };
    } catch (error) {
      console.error('CorrectionService.create error:', error);
      throw error;
    }
  }

  // Update correction (approve/reject)
  static async update(
    id: string,
    data: { status: string; decidedAt: string; decidedBy: string }
  ): Promise<CorrectionRequest | null> {
    try {
      const supabase = createAdminClient();

      const { data: correctionData, error } = await supabase
        .from('corrections')
        .update({
          status: data.status,
          decided_at: data.decidedAt,
          decided_by: data.decidedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !correctionData) {
        console.error('Error updating correction:', error);
        return null;
      }

      return {
        id: correctionData.id,
        record_id: correctionData.record_id,
        patient_id: correctionData.patient_id,
        doctor_id: correctionData.doctor_id,
        patient_name: correctionData.patient_name,
        doctor_name: correctionData.doctor_name,
        field: correctionData.field,
        current_value: correctionData.current_value,
        proposed_value: correctionData.proposed_value,
        reason: correctionData.reason,
        status: correctionData.status,
        created_at: correctionData.created_at,
        updated_at: correctionData.updated_at,
        decided_at: correctionData.decided_at,
        decided_by: correctionData.decided_by
      };
    } catch (error) {
      console.error('CorrectionService.update error:', error);
      return null;
    }
  }

  // Search corrections
  static async search(query: string): Promise<CorrectionRequest[]> {
    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase
        .from('corrections')
        .select('*')
        .or(`patient_name.ilike.%${query}%,patient_id.ilike.%${query}%,record_id.ilike.%${query}%,field.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching corrections:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        record_id: row.record_id,
        patient_id: row.patient_id,
        doctor_id: row.doctor_id,
        patient_name: row.patient_name,
        doctor_name: row.doctor_name,
        field: row.field,
        current_value: row.current_value,
        proposed_value: row.proposed_value,
        reason: row.reason,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        decided_at: row.decided_at,
        decided_by: row.decided_by
      }));
    } catch (error) {
      console.error('CorrectionService.search error:', error);
      return [];
    }
  }
}
