import { NextRequest, NextResponse } from 'next/server';
import { PatientService } from '@/server/services/patientService';
import { withAuth, requireRole, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { validateName, validateAge, validateWeight, validateTextField, validateUUID, validateEnum, validateEmail } from '@/lib/validation/validators';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/ratelimit/ratelimiter';

// GET /api/patients - List patients (authenticated users only)
export async function GET(request: NextRequest) {
  try {
    // 1. Check rate limit (100 requests per minute)
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
    const owner = searchParams.get('owner');

    // Validate query parameters
    if (search && search.length > 100) {
      return authError('Search query too long (max 100 characters)', 400);
    }

    if (status_filter) {
      const statusValidation = validateEnum(status_filter, ['healthy', 'under-treatment', 'recovered'], 'Status');
      if (!statusValidation.isValid) {
        return authError(statusValidation.error!, 400);
      }
    }

    // 4. Get patients based on role
    let patients;

    if (user!.role === 'doctor') {
      // Step A: Get doctor.id dari user.id
      const supabase = createAdminClient();
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (doctorError || !doctorData) {
        return authError('Doctor record not found', 404);
      }

      // Step B: Query patients dengan filter
      const { data: filteredPatients, error: patientsError } = await supabase
        .from('patients_with_last_visit')
        .select('*')
        .or(`assigned_doctor_id.is.null,assigned_doctor_id.eq.${doctorData.id}`)
        .order('created_at', { ascending: false });

      if (patientsError) {
        console.error('Error fetching patients for doctor:', patientsError);
        return authError('Failed to fetch patients', 500);
      }

      patients = filteredPatients || [];

      // Apply search filter
      if (search && patients.length > 0) {
        const searchLower = search.toLowerCase();
        patients = patients.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.owner.toLowerCase().includes(searchLower) ||
          p.breed.toLowerCase().includes(searchLower) ||
          p.species.toLowerCase().includes(searchLower)
        );
      }

      // Apply status filter
      if (status_filter && patients.length > 0) {
        patients = patients.filter(p => p.status === status_filter);
      }

    } else if (user!.role === 'admin') {
      // Admin uses PatientService (no filtering)
      if (search) {
        patients = await PatientService.search(search);
      } else if (status_filter) {
        patients = await PatientService.filterByStatus(status_filter as any);
      } else {
        patients = await PatientService.getAll();
      }
    } else {
      // pet-owner role
      patients = await PatientService.getByOwner(user!.name);
    }

    // 5. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'view',
      resource: 'patients',
      details: `Retrieved ${patients.length} patients`,
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      patients,
    });

  } catch (error) {
    console.error('GET /api/patients error:', error);
    return authError('Failed to fetch patients', 500);
  }
}

// POST /api/patients - Create patient (admin & doctor only)
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

    // 2. Check authorization (only admin)
    const { authorized, user, error, status: authStatus } = await requireRole(
      request,
      ['admin']
    );

    if (!authorized) {
      return authError(error!, authStatus);
    }

    // 3. Parse request body
    const body = await request.json();
    const { name, species, breed, birth_date, age, weight, owner, ownerEmail, contact, status: patientStatus, notes } = body;

    // 4. Validate required fields presence
    if (!name || !species || !breed || !owner || !ownerEmail || !contact) {
      return authError('Missing required fields: name, species, breed, owner, ownerEmail, contact', 400);
    }

    // 4b. Validate email format
    const emailValidation = validateEmail(ownerEmail);
    if (!emailValidation.isValid) {
      return authError(emailValidation.error!, 400);
    }

    // 5. Validate field formats
    const nameValidation = validateName(name, 'Patient name');
    if (!nameValidation.isValid) {
      return authError(nameValidation.error!, 400);
    }

    const speciesValidation = validateName(species, 'Species');
    if (!speciesValidation.isValid) {
      return authError(speciesValidation.error!, 400);
    }

    const breedValidation = validateName(breed, 'Breed');
    if (!breedValidation.isValid) {
      return authError(breedValidation.error!, 400);
    }

    const ownerValidation = validateName(owner, 'Owner name');
    if (!ownerValidation.isValid) {
      return authError(ownerValidation.error!, 400);
    }

    const contactValidation = validateTextField(contact, 'Contact', 5, 20);
    if (!contactValidation.isValid) {
      return authError(contactValidation.error!, 400);
    }

    // Validate age if provided
    if (age !== null && age !== undefined) {
      const ageValidation = validateAge(parseInt(age));
      if (!ageValidation.isValid) {
        return authError(ageValidation.error!, 400);
      }
    }

    // Validate weight if provided
    if (weight !== null && weight !== undefined) {
      const weightValidation = validateWeight(parseFloat(weight));
      if (!weightValidation.isValid) {
        return authError(weightValidation.error!, 400);
      }
    }

    // 6. Create patient with owner email
    const patient = await PatientService.create({
      name,
      species,
      breed,
      age: parseInt(age) || 0,
      weight: parseFloat(weight) || 0,
      birth_date: birth_date || null,
      owner,
      ownerEmail,
      contact,
      status: patientStatus || 'healthy',
      notes: notes || '',
    });

    // 7. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'create',
      resource: 'patient',
      details: `Created patient: ${patient.name}`,
      status: 'success',
    });

    return NextResponse.json(
      { success: true, patient },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/patients error:', error);
    return authError('Failed to create patient', 500);
  }
}

// PATCH /api/patients - Update patient (admin & doctor only)
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
    const { authorized, user, error, status: authStatus } = await requireRole(
      request,
      ['admin', 'doctor']
    );

    if (!authorized) {
      return authError(error!, authStatus);
    }

    // 3. Parse request body
    const body = await request.json();
    const { id, ...data } = body;

    // 4. Validate patient ID
    if (!id) {
      return authError('Patient ID required', 400);
    }

    // 5. Validate update data (if provided)
    if (data.name) {
      const nameValidation = validateName(data.name, 'Patient name');
      if (!nameValidation.isValid) {
        return authError(nameValidation.error!, 400);
      }
    }

    if (data.age !== undefined) {
      const ageValidation = validateAge(parseInt(data.age));
      if (!ageValidation.isValid) {
        return authError(ageValidation.error!, 400);
      }
    }

    if (data.weight !== undefined) {
      const weightValidation = validateWeight(parseFloat(data.weight));
      if (!weightValidation.isValid) {
        return authError(weightValidation.error!, 400);
      }
    }

    // 6. Update patient
    const patient = await PatientService.update(id, data);

    if (!patient) {
      return authError('Patient not found', 404);
    }

    // 7. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'update',
      resource: 'patient',
      details: `Updated patient: ${patient.name}`,
      status: 'success',
    });

    return NextResponse.json({ success: true, patient });

  } catch (error) {
    console.error('PATCH /api/patients error:', error);
    return authError('Failed to update patient', 500);
  }
}

// DELETE /api/patients - Delete patient (admin only)
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
    const { authorized, user, error, status: authStatus } = await requireRole(
      request,
      'admin'
    );

    if (!authorized) {
      return authError(error!, authStatus);
    }

    // 3. Get and validate patient ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return authError('Patient ID required', 400);
    }

    // 4. Delete patient
    const success = await PatientService.delete(id);

    if (!success) {
      return authError('Patient not found', 404);
    }

    // 5. Log audit
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'delete',
      resource: 'patient',
      details: `Deleted patient: ${id}`,
      status: 'success',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/patients error:', error);
    return authError('Failed to delete patient', 500);
  }
}