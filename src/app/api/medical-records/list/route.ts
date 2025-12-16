import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/ratelimit/ratelimiter';

/**
 * GET /api/medical-records/list
 * Mengambil daftar medical records untuk doctor yang sedang login
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Rate limiting
    const { allowed, remaining, resetTime } = checkRateLimit(
      request,
      RATE_LIMITS.API_READ.limit,
      RATE_LIMITS.API_READ.windowMs
    );

    if (!allowed) {
      const response = rateLimitResponse(resetTime, remaining);
      return NextResponse.json(response.body, {
        status: response.statusCode,
        headers: response.headers,
      });
    }

    // 2. Authentication check
    const { user, error, status } = await withAuth(request);
    if (error) {
      return authError(error, status);
    }

    // 3. Hanya doctor yang bisa akses
    if (user?.role !== 'doctor') {
      return NextResponse.json(
        { error: 'Only doctors can access this endpoint' },
        { status: 403 }
      );
    }

    // 4. Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 5. Get supabase client
    const supabase = createAdminClient();

    // 6. Get doctor_id dari user
    const { data: doctorData, error: doctorError } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (doctorError || !doctorData) {
      console.error('Doctor lookup error:', doctorError);
      return NextResponse.json(
        { error: 'Doctor profile not found' },
        { status: 404 }
      );
    }

    console.log('Fetching records for doctor_id:', doctorData.id);

    // 7. Fetch medical records dari view medical_records_detailed
    const { data: records, error: recordsError, count } = await supabase
      .from('medical_records_detailed')
      .select('*', { count: 'exact' })
      .eq('doctor_id', doctorData.id)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      return NextResponse.json(
        { error: 'Failed to fetch medical records', details: recordsError.message },
        { status: 500 }
      );
    }

    console.log('Records found:', records?.length || 0);

    // 8. Return response
    return NextResponse.json({
      records: records || [],
      total: count || 0,
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/medical-records/list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}