import bcrypt from 'bcryptjs';

// Salt rounds - higher = more secure but slower
// 12 adalah sweet spot antara security dan performance
const SALT_ROUNDS = 12;

/**
 * Hash password menggunakan bcrypt
 * @param plainPassword - Password asli dari user
 * @returns Hashed password yang aman untuk disimpan di database
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify password dengan hash yang tersimpan
 * @param plainPassword - Password dari user saat login
 * @param hashedPassword - Hash dari database
 * @returns true jika match, false jika tidak
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Validate password strength
 * @param password - Password untuk divalidasi
 * @returns Object dengan isValid dan error message
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Minimum 8 characters
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Maximum 128 characters (prevent DOS)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Must contain at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Must contain at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Must contain at least one number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Must contain at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}