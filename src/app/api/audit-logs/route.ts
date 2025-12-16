import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireRole, authError } from '@/lib/auth/middleware';
import { createAdminClient } from '@/lib/supabase/server';
import { validateTextField, validateEnum } from '@/lib/validation/validators';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/ratelimit/ratelimiter';

// GET /api/audit-logs - Fetch audit logs (admin only)
export async function GET(request: NextRequest) {
  try {
    // 1. Check rate limit (30 read requests per minute)
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

    // 3. Check authorization (admin only)
    if (user!.role !== 'admin') {
      return authError('Only admins can view audit logs', 403);
    }

    // 4. Get query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const userRole = searchParams.get('userRole');
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 5. Validate query parameters
    const validActions = ['create', 'view', 'update', 'delete', 'approve', 'reject'];
    if (action && !validActions.includes(action)) {
      return authError(`Invalid action. Must be one of: ${validActions.join(', ')}`, 400);
    }

    const validRoles = ['admin', 'doctor', 'pet-owner'];
    if (userRole && !validRoles.includes(userRole)) {
      return authError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
    }

    const validStatuses = ['success', 'failure'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return authError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    if (search && search.length > 100) {
      return authError('Search query too long (max 100 characters)', 400);
    }

    // 6. Build query
    const supabase = createAdminClient();
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }

    if (resource) {
      query = query.eq('resource', resource);
    }

    if (userRole) {
      query = query.eq('user_role', userRole);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (search) {
      query = query.or(
        `user_name.ilike.%${search}%,details.ilike.%${search}%`
      );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // 7. Execute query
    const { data: logs, error: dbError, count } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return authError('Failed to fetch audit logs', 500);
    }

    const getClientIP = (request: NextRequest) => {
      return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    };

    // 8. Log audit (log the log view)
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'view',
      resource: 'audit_logs',
      details: `Viewed audit logs with filters: action=${action}, resource=${resource}, userRole=${userRole}`,
      ip_address: getClientIP(request),
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      logs: logs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      },
    });

  } catch (error) {
    console.error('GET /api/audit-logs error:', error);
    return authError('Failed to fetch audit logs', 500);
  }
}

// DELETE /api/audit-logs - Delete old audit logs (admin only)
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

    // 3. Get days parameter (delete logs older than X days)
    const { searchParams } = new URL(request.url);
    const daysStr = searchParams.get('olderThanDays');
    const days = parseInt(daysStr || '30');

    if (days < 7) {
      return authError('Cannot delete logs newer than 7 days for safety', 400);
    }

    // 4. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 5. Delete old logs
    const supabase = createAdminClient();
    const { error: dbError } = await supabase
      .from('audit_logs')
      .delete()
      .lt('timestamp', cutoffDate.toISOString());

    if (dbError) {
      console.error('Database error:', dbError);
      return authError('Failed to delete audit logs', 500);
    }

    const getClientIP = (request: NextRequest) => {
      return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    };

    // 6. Log audit
    await supabase.from('audit_logs').insert({
      user_id: user!.id,
      user_name: user!.name,
      user_role: user!.role,
      action: 'delete',
      resource: 'audit_logs',
      details: `Deleted audit logs older than ${days} days (before ${cutoffDate.toISOString()})`,
      ip_address: getClientIP(request),
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      message: `Deleted audit logs older than ${days} days`,
    });

  } catch (error) {
    console.error('DELETE /api/audit-logs error:', error);
    return authError('Failed to delete audit logs', 500);
  }
}