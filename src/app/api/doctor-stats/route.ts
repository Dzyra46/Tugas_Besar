import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { getDoctorIdFromUserId } from '@/lib/helpers/doctorHelper';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { user, error, status } = await withAuth(request);
    if (error) {
      return authError(error, status);
    }

    // Check if user is a doctor
    if (user!.role !== 'doctor') {
      return authError('Access denied. Doctor role required.', 403);
    }

    const doctorId = await getDoctorIdFromUserId(user!.id);
    if (!doctorId) {
      return authError('Doctor record not found', 404);
    }

    const supabase = createAdminClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get today's patients count (patients with medical records created today)
    const { count: todayPatientsCount } = await supabase
      .from('medical_records')
      .select('patient_id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .gte('created_at', todayISO);

    // Get pending records count (you can adjust criteria)
    // For now, counting all medical records from this doctor
    const { count: pendingRecordsCount } = await supabase
      .from('medical_records')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId);

    // Get critical cases (patients with "critical" in diagnosis or notes)
    const { data: criticalRecords } = await supabase
      .from('medical_records')
      .select('patient_id')
      .eq('doctor_id', doctorId)
      .or('diagnosis.ilike.%critical%,treatment.ilike.%critical%,notes.ilike.%critical%');

    const criticalCases = criticalRecords?.length || 0;

    // Get completed today (records created today)
    const { count: completedTodayCount } = await supabase
      .from('medical_records')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .gte('created_at', todayISO);

    return NextResponse.json({
      todayPatients: todayPatientsCount || 0,
      pendingRecords: pendingRecordsCount || 0,
      criticalCases,
      completedToday: completedTodayCount || 0,
    });
  } catch (error) {
    console.error('Error fetching doctor stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}