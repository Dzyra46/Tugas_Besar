import { NextRequest, NextResponse } from 'next/server';
import { DoctorService } from '@/server/services/doctorService';
import { withAuth, requireRole, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { validateName, validateEmail, validateTextField, validateEnum } from '@/lib/validation/validators';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/ratelimit/ratelimiter';

// GET /api/doctors - List doctors (authenticated users only)
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

    // 2. Check authentication
    const { user, error, status } = await withAuth(request);
    if (error) {
      return authError(error, status);
    }

    // 3. Get and validate query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status_filter = searchParams.get('status');

    if (search && search.length > 100) {
      return authError('Search query too long (max 100 characters)', 400);
    }

    if (status_filter) {
      const statusValidation = validateEnum(status_filter, ['active', 'inactive', 'on-leave'], 'Status');
      if (!statusValidation.isValid) {
        return authError(statusValidation.error!, 400);
      }
    }

    // 4. Get doctors
    let doctors;

    if (search) {
      doctors = await DoctorService.search(search);
    } else if (status_filter) {
      doctors = await DoctorService.filterByStatus(status_filter as any);
    } else {
      doctors = await DoctorService.getAll();
    }

    // 5. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'view',
      resource: 'doctors',
      details: `Retrieved ${doctors.length} doctors`,
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      doctors,
    });

  } catch (error) {
    console.error('GET /api/doctors error:', error);
    return authError('Failed to fetch doctors', 500);
  }
}

// POST /api/doctors - Create doctor (admin only)
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
    const { name, email, specialization, license_number, phone, password, status: doctorStatus } = body;

    // 4. Validate required fields
    if (!name || !email || !specialization || !license_number || !phone || !password) {
      return authError('Missing required fields: name, email, specialization, license_number, phone, password', 400);
    }

    // 4b. Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[^\s]{8,}$/;
    if (!passwordRegex.test(password)) {
      return authError('Password must be at least 8 characters with uppercase, lowercase, number, and special character', 400);
    }

    // 5. Validate field formats
    const nameValidation = validateName(name, 'Doctor name');
    if (!nameValidation.isValid) {
      return authError(nameValidation.error!, 400);
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return authError(emailValidation.error!, 400);
    }

    const specializationValidation = validateName(specialization, 'Specialization');
    if (!specializationValidation.isValid) {
      return authError(specializationValidation.error!, 400);
    }

    const licenseValidation = validateTextField(license_number, 'License number', 3, 50);
    if (!licenseValidation.isValid) {
      return authError(licenseValidation.error!, 400);
    }

    const phoneValidation = validateTextField(phone, 'Phone', 7, 20);
    if (!phoneValidation.isValid) {
      return authError(phoneValidation.error!, 400);
    }

    // 6. Validate status if provided
    if (doctorStatus) {
      const statusValidation = validateEnum(doctorStatus, ['active', 'inactive', 'on-leave'], 'Doctor status');
      if (!statusValidation.isValid) {
        return authError(statusValidation.error!, 400);
      }
    }

    // 7. Create doctor (with password for user account)
    const doctor = await DoctorService.create({
      name,
      user_id: user!.id,
      email,
      specialization,
      license_number,
      phone,
      password,
      status: doctorStatus || 'active',
    });

    // 8. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'create',
      resource: 'doctor',
      details: `Created doctor with license: ${license_number}`,
      status: 'success',
    });

    return NextResponse.json(
      { success: true, doctor },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/doctors error:', error);
    return authError('Failed to create doctor', 500);
  }
}

// PATCH /api/doctors - Update doctor (admin & doctor self)
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

    // 2. Check authentication
    const { user, error, status } = await withAuth(request);
    if (error) {
      return authError(error, status);
    }

    // 3. Parse request body
    const body = await request.json();
    const { id, ...data } = body;

    // 4. Validate doctor ID
    if (!id) {
      return authError('Doctor ID required', 400);
    }

    // 5. Check authorization (admin or self)
    if (user!.role !== 'admin') {
      const doctor = await DoctorService.getById(id);
      if (!doctor || doctor.user_id !== user!.id) {
        return authError('Unauthorized to update this doctor', 403);
      }
    }

    // 6. Validate update data (if provided)
    if (data.name) {
      const nameValidation = validateName(data.name, 'Doctor name');
      if (!nameValidation.isValid) {
        return authError(nameValidation.error!, 400);
      }
    }

    if (data.email) {
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.isValid) {
        return authError(emailValidation.error!, 400);
      }
    }

    if (data.phone) {
      const phoneValidation = validateTextField(data.phone, 'Phone', 7, 20);
      if (!phoneValidation.isValid) {
        return authError(phoneValidation.error!, 400);
      }
    }

    if (data.status) {
      const statusValidation = validateEnum(data.status, ['active', 'inactive', 'on-leave'], 'Status');
      if (!statusValidation.isValid) {
        return authError(statusValidation.error!, 400);
      }
    }

    // 7. Update doctor
    const doctor = await DoctorService.update(id, data);

    if (!doctor) {
      return authError('Doctor not found', 404);
    }

    // 8. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'update',
      resource: 'doctor',
      details: `Updated doctor: ${id}`,
      status: 'success',
    });

    return NextResponse.json({ success: true, doctor });

  } catch (error) {
    console.error('PATCH /api/doctors error:', error);
    return authError('Failed to update doctor', 500);
  }
}

// DELETE /api/doctors - Delete doctor (admin only)
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

    // 3. Get and validate doctor ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return authError('Doctor ID required', 400);
    }

    // 4. Delete doctor
    const success = await DoctorService.delete(id);

    if (!success) {
      return authError('Doctor not found', 404);
    }

    // 5. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'delete',
      resource: 'doctor',
      details: `Deleted doctor: ${id}`,
      status: 'success',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/doctors error:', error);
    return authError('Failed to delete doctor', 500);
  }
}