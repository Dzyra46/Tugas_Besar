import { NextRequest, NextResponse } from 'next/server';
import { CorrectionService } from '@/server/services/correctionService';
import { withAuth, requireRole, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { validateUUID, validateTextField, validateEnum } from '@/lib/validation/validators';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/ratelimit/ratelimiter';
import { getDoctorIdFromUserId } from '@/lib/helpers/doctorHelper';

// GET /api/corrections - List corrections
export async function GET(request: NextRequest) {
  try {
    // 1. Check rate limit
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

    // 2. Check authotentication
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patient_id');
    const statusFilter = searchParams.get('status');
    const doctorId = searchParams.get('doctor_id');

    if (!patientId) {
      const { user, error, status } = await withAuth(request);
      if (error) {
        return authError(error, status);
      }

      if (statusFilter) {
        const statusValidation = validateEnum(statusFilter, ['pending', 'approved', 'rejected'], 'Status');
        if (!statusValidation.isValid) {
          return authError(statusValidation.error!, 400);
        }
      }

      // Get corrections for specific patient
      let corrections;

      if (user!.role === 'admin') {
        corrections = await CorrectionService.getAll();
        if (statusFilter) {
          corrections = corrections.filter((c: any) => c.status === statusFilter);
        }
      } else if (user!.role === 'doctor') {
        let effectiveDoctorId = doctorId;

        if (!effectiveDoctorId) {
          effectiveDoctorId = await getDoctorIdFromUserId(user!.id);
          if (!effectiveDoctorId) {
            return authError('Doctor record not found', 404);
          }
        }
        corrections = await CorrectionService.getByDoctor(effectiveDoctorId);
      } else {
        return authError('Unauthorized to view corrections', 403);
      }

      // Log audit
      const supabase = createAdminClient();
      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        user_name: user!.name,
        user_role: user!.role,
        action: 'view',
        resource: 'corrections',
        details: `Retrieved ${corrections.length} corrections`,
        status: 'success',
      });

      return NextResponse.json({
        success: true,
        corrections,
      });
    }

    // ADDED: Public access for pet owners via patient ID
    if (patientId) {
      const corrections = await CorrectionService.getAll();
      const filtered = corrections.filter((c: any) => c.patient_id === patientId && (statusFilter ? c.status === statusFilter : true));

      return NextResponse.json({
        success: true,
        corrections: filtered,
      });
    }

  } catch (error) {
    console.error('GET /api/corrections error:', error);
    return authError('Failed to fetch corrections', 500);
  }
}

// POST /api/corrections - Submit correction (doctor only)
export async function POST(request: NextRequest) {
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

    // 2. Check authorization (doctor only)
    const { authorized, user, error, status } = await requireRole(
      request,
      'doctor'
    );

    if (!authorized) {
      return authError(error!, status);
    }

    // 3. Parse request body
    const body = await request.json();
    const { recordId, patientId, field, currentValue, proposedValue, reason, patientName } = body;

    // 4. Validate required fields
    if (!recordId || !patientId || !field || !currentValue || !proposedValue || !reason) {
      return authError('Missing required fields: recordId, patientId, field, currentValue, proposedValue, reason', 400);
    }

    // 5. Validate field formats
    const recordIdValidation = validateTextField(recordId, 'Record ID', 1, 50);
    if (!recordIdValidation.isValid) {
      return authError(recordIdValidation.error!, 400);
    }

    const patientIdValidation = validateTextField(patientId, 'Patient ID', 1, 50);
    if (!patientIdValidation.isValid) {
      return authError(patientIdValidation.error!, 400);
    }

    const fieldValidation = validateTextField(field, 'Field', 1, 50);
    if (!fieldValidation.isValid) {
      return authError(fieldValidation.error!, 400);
    }

    const reasonValidation = validateTextField(reason, 'Reason', 5, 500);
    if (!reasonValidation.isValid) {
      return authError(reasonValidation.error!, 400);
    }

    // 6. Create correction
    const correction = await CorrectionService.create({
      recordId,
      patientId,
      patientName: patientName || 'Unknown',
      doctorName: user!.name,
      field,
      currentValue,
      proposedValue,
      reason,
    });

    // 7. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'create',
      resource: 'correction',
      details: `Submitted correction for record: ${recordId}`,
      status: 'success',
    });

    return NextResponse.json(
      { success: true, correction },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/corrections error:', error);
    return authError('Failed to submit correction', 500);
  }
}

// PATCH /api/corrections - Approve/Reject correction (admin only)
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

    // 2. Check authorization (admin only)
    const { authorized, user, error, status } = await requireRole(
      request,
      'admin'
    );

    if (!authorized) {
      return authError(error!, status);
    }

    // 3. Parse request body
    const body = await request.json();
    const { id, status: correctionStatus } = body;

    // 4. Validate required fields
    if (!id || !correctionStatus) {
      return authError('Missing correction ID or status', 400);
    }

    // 5. Validate status enum
    const statusValidation = validateEnum(correctionStatus, ['approved', 'rejected'], 'Correction status');
    if (!statusValidation.isValid) {
      return authError(statusValidation.error!, 400);
    }

    // 6. Update correction
    const correction = await CorrectionService.update(id, {
      status: correctionStatus,
      decidedAt: new Date().toISOString(),
      decidedBy: user!.name,
    });

    if (!correction) {
      return authError('Correction not found', 404);
    }

    // 7. If approved, apply changes to medical record
    const supabase = createAdminClient();
    
    if (correctionStatus === 'approved') {
      // Get current medical record for revision history
      const { data: currentRecord } = await supabase
        .from('medical_records')
        .select('*')
        .eq('id', correction.record_id)
        .single();

      // Update medical record with corrected value
      const { error: updateError } = await supabase
        .from('medical_records')
        .update({ 
          [correction.field]: correction.proposed_value,
          updated_at: new Date().toISOString()
        })
        .eq('id', correction.record_id);

      if (updateError) {
        console.error('Error updating medical record:', updateError);
        return authError('Failed to apply correction to medical record', 500);
      }

      // Log the correction in audit logs
      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        user_name: user!.name,
        user_role: user!.role,
        action: 'correction_applied',
        resource: 'medical_record',
        details: `Applied correction to record ${correction.record_id}: ${correction.field} changed from "${correction.current_value}" to "${correction.proposed_value}"`,
        status: 'success',
      });
    }

    return NextResponse.json({ success: true, correction });

  } catch (error) {
    console.error('PATCH /api/corrections error:', error);
    return authError('Failed to update correction', 500);
  }
}