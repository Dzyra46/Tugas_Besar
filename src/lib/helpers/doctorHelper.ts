import { createAdminClient } from '@/lib/supabase/server';

/**
 * Get doctor.id from user.id
 * @param userId - The user ID from session
 * @returns doctor.id or null if not found
 */
export async function getDoctorIdFromUserId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to get doctor_id from user_id:', error);
    return null;
  }

  return data.id;
}

/**
 * Get user.id from doctor.id
 * @param doctorId - The doctor ID
 * @returns user.id or null if not found
 */
export async function getUserIdFromDoctorId(doctorId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('doctors')
    .select('user_id')
    .eq('id', doctorId)
    .single();

  if (error || !data) {
    console.error('Failed to get user_id from doctor_id:', error);
    return null;
  }

  return data.user_id;
}