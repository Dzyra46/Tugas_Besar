import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireRole, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { validateUUID, validateTextField } from '@/lib/validation/validators';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/ratelimit/ratelimiter';

// Interface untuk medical record
interface MedicalRecordInput {
  patientId: string;
  doctorId?: string;
  visitDate: string; // ISO format: YYYY-MM-DD
  weight?: number;
  diagnosis: string;
  treatment: string;
  medication: string;
  notes?: string;
  nextVisit?: string;
}

// GET /api/medical-records - Fetch records dengan filter
export async function GET(request: NextRequest) {
  try {
    // 1. Check rate limit (100 read requests per minute)
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

    // 2. Check authentication
    const { user, error, status } = await withAuth(request);
    if (error) {
      return authError(error, status);
    }

    // 3. Get query parameters
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const doctorId = searchParams.get('doctorId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 4. Validate query parameters
    if (patientId) {
      const uuidValidation = validateUUID(patientId, 'Patient ID');
      if (!uuidValidation.isValid) {
        return authError(uuidValidation.error!, 400);
      }
    }

    // 5. Fetch from database
    const supabase = createAdminClient();
    let query = supabase
      .from('medical_records_detailed')
      .select('*', { count: 'exact' })
      .order('visit_date', { ascending: false });

    // Filter by patient if provided
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    // Filter by doctor id if provided
    if (doctorId) {
      const uuidValidation = validateUUID(doctorId, 'Doctor ID');
      if (!uuidValidation.isValid) {
        return authError(uuidValidation.error!, 400);
      }
      query = query.eq('doctor_id', doctorId);
    }

    // For pet-owner role, only show records for their pets
    if (user!.role === 'pet-owner') {
      // Assuming pet-owners have a relationship to their pets
      // This would need proper RLS policy in Supabase
      query = query.eq('patient_owner_id', user!.id);
    }

    // For doctor role, only show records for their assigned patients
    if (user!.role === 'doctor') {
      // First, get the doctor's ID from the doctors table
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (doctorError || !doctorData) {
        console.error('Doctor lookup error:', doctorError);
        return authError('Doctor not found', 404);
      }

      // Filter medical records to only show:
      // 1. Records created by this doctor (doctor_id matches)
      // 2. OR records for patients assigned to this doctor
      // We need to join with patients table to check assigned_doctor_id
      
      // Since we're using medical_records_detailed view which already includes patient info,
      // we can check if the patient is assigned to this doctor
      // However, the view might not include assigned_doctor_id, so we need alternative approach:
      
      // Option 1: Filter by doctor_id (records this doctor created)
      query = query.eq('doctor_id', doctorData.id);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: records, error: dbError, count } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return authError('Failed to fetch medical records', 500);
    }

    // 6. Log audit
    const getClientIP = (request: NextRequest) => {
      return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    };

    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'view',
      resource: 'medical_records_detailed',
      details: `Retrieved ${records?.length || 0} medical records`,
      ip_address: getClientIP(request),
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      records: records || [],
      count: records?.length || 0,
      pagination: { total: count || 0, limit, offset, hasMore: (offset + limit) < (count || 0) },
    });

  } catch (error) {
    console.error('GET /api/medical-records error:', error);
    return authError('Failed to fetch medical records', 500);
  }
}

// POST /api/medical-records - Create medical record (doctor only)
export async function POST(request: NextRequest) {
  try {
    // 1. Check rate limit (30 write requests per minute)
    const { allowed, remaining, resetTime } = checkRateLimit(
      request,
      RATE_LIMITS.API_WRITE.limit,
      RATE_LIMITS.API_WRITE.windowMs
    );

    if (!allowed) {
      const response = rateLimitResponse(resetTime, remaining);
      return NextResponse.json(response.body, {
        status: response.statusCode,
        headers: response.headers,
      });
    }

    // 2. Check authorization (doctor & admin only)
    const { authorized, user, error, status } = await requireRole(
      request,
      ['admin', 'doctor']
    );

    if (!authorized) {
      return authError(error!, status);
    }

    // 3. Parse request body
    const body: MedicalRecordInput = await request.json();
    const { patientId, doctorId, visitDate, weight,diagnosis, treatment, medication, notes, nextVisit } = body;

    // 4. Validate required fields
    if (!patientId || !visitDate || !weight || !diagnosis || !treatment || !medication) {
      return authError(
        'Missing required fields: patientId, visitDate, weight, diagnosis, treatment, medication',
        400
      );
    }

    // 5. Validate field formats
    const patientIdValidation = validateUUID(patientId, 'Patient ID');
    if (!patientIdValidation.isValid) {
      return authError(patientIdValidation.error!, 400);
    }

    let effectiveDoctorId = doctorId;

    // Jika doctorId tidak disediakan dan user adalah doctor, cari doctor.id dari user.id
    if (!effectiveDoctorId && user!.role === 'doctor') {
      const supabase = createAdminClient();
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (doctorError || !doctorData) {
        return authError('Doctor record not found for current user', 404);
      }

      effectiveDoctorId = doctorData.id;
    }

    // Validate doctor ID
    if (!effectiveDoctorId) {
      return authError('Doctor ID is required', 400);
    }

    const doctorIdValidation = validateUUID(effectiveDoctorId, 'Doctor ID');
    if (!doctorIdValidation.isValid) {
      return authError(doctorIdValidation.error!, 400);
    }

    // Validate weight if provided
    if (weight !== undefined && weight !== null) {
      if (typeof weight !== 'number' || weight < 0 || weight > 500) {
        return authError('Weight must be a number between 0 and 500 kg', 400);
      }
    }

    // Validate text fields
    const diagnosisValidation = validateTextField(diagnosis, 'Diagnosis', 3, 200);
    if (!diagnosisValidation.isValid) {
      return authError(diagnosisValidation.error!, 400);
    }

    const treatmentValidation = validateTextField(treatment, 'Treatment', 5, 1000);
    if (!treatmentValidation.isValid) {
      return authError(treatmentValidation.error!, 400);
    }

    const medicationValidation = validateTextField(medication, 'Medication', 3, 500);
    if (!medicationValidation.isValid) {
      return authError(medicationValidation.error!, 400);
    }

    // Validate ISO date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(visitDate)) {
      return authError('Visit date must be in ISO format (YYYY-MM-DD)', 400);
    }

    const visitDateObj = new Date(visitDate);
    if (visitDateObj > new Date()) {
      return authError('Visit date cannot be in the future', 400);
    }

    // Validate next visit if provided
    if (nextVisit) {
      if (!dateRegex.test(nextVisit)) {
        return authError('Next visit must be in ISO format (YYYY-MM-DD)', 400);
      }
      const nextVisitDate = new Date(nextVisit);
      if (nextVisitDate <= visitDateObj) {
        return authError('Next visit must be after visit date', 400);
      }
    }

    // 6. Create medical record in database
    const supabase = createAdminClient();

    const getClientIP = (request: NextRequest) => {
      return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    };
    
    const { data: newRecord, error: dbError } = await supabase
      .from('medical_records')
      .insert({
        patient_id: patientId,
        doctor_id: effectiveDoctorId,
        visit_date: visitDate,
        weight: weight || null,
        diagnosis,
        treatment,
        medication,
        notes: notes || null,
        next_visit: nextVisit || null,
        blockchain_hash: null,
        blockchain_tx_id: null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return authError('Failed to create medical record', 500);
    }

    const { data: existingRecords } = await supabase
      .from('medical_records')
      .select('id')
      .eq('patient_id', patientId);

    // Jika hanya ada 1 record (yang baru dibuat), assign doctor ke patient
    if (existingRecords && existingRecords.length === 1) {
      const { error: assignError } = await supabase
        .from('patients')
        .update({
          assigned_doctor_id: effectiveDoctorId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (assignError) {
        console.error('Failed to assign doctor to patient:', assignError);
        // Tidak return error karena medical record sudah berhasil dibuat
      }
    }

    // 7. Log audit
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'create',
      resource: 'medical_record',
      details: `Created medical record for patient ${patientId}: ${diagnosis}`,
      ip_address: getClientIP(request),
      status: 'success',
    });

    return NextResponse.json(
      { success: true, record: newRecord },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/medical-records error:', error);
    return authError('Failed to create medical record', 500);
  }
}

// PATCH /api/medical-records - Update medical record (doctor & admin)
export async function PATCH(request: NextRequest) {
  try {
    // 1. Check rate limit
    const { allowed, remaining, resetTime } = checkRateLimit(
      request,
      RATE_LIMITS.API_WRITE.limit,
      RATE_LIMITS.API_WRITE.windowMs
    );

    if (!allowed) {
      const response = rateLimitResponse(resetTime, remaining);
      return NextResponse.json(response.body, {
        status: response.statusCode,
        headers: response.headers,
      });
    }

    // 2. Check authorization
    const { authorized, user, error, status } = await requireRole(
      request,
      ['admin', 'doctor']
    );

    if (!authorized) {
      return authError(error!, status);
    }

    // 3. Parse request body
    const body = await request.json();
    const { id, ...updateData } = body;

    // 4. Validate record ID
    if (!id) {
      return authError('Record ID required', 400);
    }

    const idValidation = validateUUID(id, 'Record ID');
    if (!idValidation.isValid) {
      return authError(idValidation.error!, 400);
    }

    // 5. Validate update fields
    if (updateData.weight !== undefined && updateData.weight !== null) {
      if (typeof updateData.weight !== 'number' || updateData.weight < 0 || updateData.weight > 500) {
        return authError('Weight must be a number between 0 and 500 kg', 400);
      }
    }

    if (updateData.diagnosis) {
      const diagnosisValidation = validateTextField(updateData.diagnosis, 'Diagnosis', 3, 500);
      if (!diagnosisValidation.isValid) {
        return authError(diagnosisValidation.error!, 400);
      }
    }

    if (updateData.treatment) {
      const treatmentValidation = validateTextField(updateData.treatment, 'Treatment', 5, 1000);
      if (!treatmentValidation.isValid) {
        return authError(treatmentValidation.error!, 400);
      }
    }

    if (updateData.medication) {
      const medicationValidation = validateTextField(updateData.medication, 'Medication', 3, 500);
      if (!medicationValidation.isValid) {
        return authError(medicationValidation.error!, 400);
      }
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (updateData.visitDate && !dateRegex.test(updateData.visitDate)) {
      return authError('Visit date must be in ISO format (YYYY-MM-DD)', 400);
    }

    // 6. Update medical record
    const supabase = createAdminClient();

    const getClientIP = (request: NextRequest) => {
      return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    };
    
    const { data: updatedRecord, error: dbError } = await supabase
      .from('medical_records_detailed')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError || !updatedRecord) {
      return authError('Medical record not found', 404);
    }

    // 7. Log audit
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'update',
      resource: 'medical_record',
      details: `Updated medical record: ${id}`,
      ip_address: getClientIP(request),
      status: 'success',
    });

    return NextResponse.json({ success: true, record: updatedRecord });

  } catch (error) {
    console.error('PATCH /api/medical-records error:', error);
    return authError('Failed to update medical record', 500);
  }
}

// DELETE /api/medical-records - Delete medical record (admin only)
export async function DELETE(request: NextRequest) {
  try {
    // 1. Check rate limit
    const { allowed, remaining, resetTime } = checkRateLimit(
      request,
      RATE_LIMITS.API_WRITE.limit,
      RATE_LIMITS.API_WRITE.windowMs
    );

    if (!allowed) {
      const response = rateLimitResponse(resetTime, remaining);
      return NextResponse.json(response.body, {
        status: response.statusCode,
        headers: response.headers,
      });
    }

    // 2. Check authorization (admin only)
    const { authorized, user, error, status } = await requireRole(
      request,
      'admin'
    );

    if (!authorized) {
      return authError(error!, status);
    }

    // 3. Get and validate record ID from query
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return authError('Record ID required', 400);
    }

    const idValidation = validateUUID(id, 'Record ID');
    if (!idValidation.isValid) {
      return authError(idValidation.error!, 400);
    }

    // 4. Delete medical record
    const supabase = createAdminClient();
    const getClientIP = (request: NextRequest) => {
      return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    };
    
    const { error: dbError } = await supabase
      .from('medical_records_detailed')
      .delete()
      .eq('id', id);

    if (dbError) {
      return authError('Medical record not found', 404);
    }

    // 5. Log audit
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'delete',
      resource: 'medical_record',
      details: `Deleted medical record: ${id}`,
      ip_address: getClientIP(request),
      status: 'success',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/medical-records error:', error);
    return authError('Failed to delete medical record', 500);
  }
}