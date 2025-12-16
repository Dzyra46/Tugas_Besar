import { NextRequest } from 'next/server';

// Simple in-memory rate limiter
// Dalam production, gunakan Redis untuk distributed rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Periodic cleanup configuration
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_STORE_SIZE = 5000; // Lower threshold for proactive cleanup

/**
 * Cleanup expired entries from rate limit store
 * Runs periodically to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[Rate Limiter] Cleaned up ${deletedCount} expired entries. Current size: ${rateLimitStore.size}`);
  }
}

// Start periodic cleanup
if (typeof global !== 'undefined') {
  // Only run in server context
  const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
  
  // Prevent cleanup timer from keeping process alive
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return request.headers.get('x-real-ip') || 
         request.ip || 
         'unknown';
}

/**
 * Rate limit checker
 * @param request - Next.js request object
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  request: NextRequest,
  limit: number = 30,
  windowMs: number = 60000 // 1 minute default
): { allowed: boolean; remaining: number; resetTime: number } {
  const clientIP = getClientIP(request);
  const key = clientIP;
  const now = Date.now();
  
  // Get or create entry for this IP
  let entry = rateLimitStore.get(key);
  
  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment request count
  entry.count++;
  
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const resetTime = entry.resetTime;
  
  // Aggressive cleanup if store grows too large
  // This is a safety mechanism in addition to periodic cleanup
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const entriesToDelete: string[] = [];
    
    // Find all expired entries
    for (const [key, entry] of Array.from(rateLimitStore.entries())) {
      if (now > entry.resetTime) {
        entriesToDelete.push(key);
      }
    }
    
    // Delete expired entries
    entriesToDelete.forEach(key => rateLimitStore.delete(key));
    
    // If still too large after cleanup, remove oldest entries (LRU-style)
    if (rateLimitStore.size > MAX_STORE_SIZE) {
      const sortedEntries = Array.from(rateLimitStore.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime);
      
      const toRemove = rateLimitStore.size - MAX_STORE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        rateLimitStore.delete(sortedEntries[i][0]);
      }
      
      console.warn(`[Rate Limiter] Emergency cleanup: removed ${toRemove} oldest entries`);
    }
    
    console.log(`[Rate Limiter] Inline cleanup completed. Current size: ${rateLimitStore.size}`);
  }
  
  return { allowed, remaining, resetTime };
}

/**
 * Rate limit response helper
 */
export function rateLimitResponse(resetTime: number, remaining: number) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return {
    statusCode: 429, // Too Many Requests
    headers: {
      'Retry-After': Math.max(0, retryAfter).toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    },
    body: {
      error: 'Too many requests. Please try again later.',
      retryAfter,
      resetTime: new Date(resetTime).toISOString(),
    },
  };
}

/**
 * Preset rate limits untuk berbagai endpoint types
 */
export const RATE_LIMITS = {
  // Authentication endpoints - ketat
  AUTH_LOGIN: { limit: 30, windowMs: 15 * 60 * 1000 }, // 30 requests per 15 minutes
  AUTH_REGISTER: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 requests per hour
  AUTH_LOGOUT: { limit: 10, windowMs: 60 * 1000 }, // 10 requests per minute
  
  // API endpoints - moderate
  API_READ: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  API_WRITE: { limit: 30, windowMs: 60 * 1000 }, // 30 requests per minute
  
  // General - permissive
  GENERAL: { limit: 1000, windowMs: 60 * 1000 }, // 1000 requests per minute
};

/**
 * Get rate limiter statistics for monitoring
 */
export function getRateLimiterStats() {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;
  
  for (const entry of Array.from(rateLimitStore.values())) {
    if (now <= entry.resetTime) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalEntries: rateLimitStore.size,
    activeEntries,
    expiredEntries,
    memoryUsageEstimate: `~${Math.round(rateLimitStore.size * 0.1)}KB`,
  };
}

/**
 * Manually trigger cleanup (useful for testing or admin endpoints)
 */
export function forceCleanup() {
  const sizeBefore = rateLimitStore.size;
  cleanupExpiredEntries();
  return {
    entriesRemoved: sizeBefore - rateLimitStore.size,
    currentSize: rateLimitStore.size,
  };
}