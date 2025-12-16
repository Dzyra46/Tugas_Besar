// Email validation
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long (max 254 characters)' };
  }
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return { isValid: true };
}

// Name validation (alphanumeric + spaces, 3-100 chars)
export function validateName(name: string, fieldName: string = 'Name'): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (name.length < 3) {
    return { isValid: false, error: `${fieldName} must be at least 3 characters` };
  }
  
  if (name.length > 100) {
    return { isValid: false, error: `${fieldName} must not exceed 100 characters` };
  }
  
  // Allow letters, numbers, spaces, hyphens and apostrophes
  const nameRegex = /^[a-zA-Z0-9\s\-'.]+$/;
  if (!nameRegex.test(name)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }

  // Prevent SQL injection patterns
  const sqlPattern = /(--|' OR '1'='1')/i;
  if (sqlPattern.test(name)) {
    return { isValid: false, error: `Invalid ${fieldName} pattern` };
  }
  
  return { isValid: true };
}

// Patient age validation
export function validateAge(age: number): { isValid: boolean; error?: string } {
  if (age === null || age === undefined) {
    return { isValid: false, error: 'Age is required' };
  }
  
  if (!Number.isInteger(age)) {
    return { isValid: false, error: 'Age must be an integer' };
  }
  
  if (age < 0 || age > 100) {
    return { isValid: false, error: 'Age must be between 0 and 100' };
  }
  
  return { isValid: true };
}

// Weight validation (in kg)
export function validateWeight(weight: number): { isValid: boolean; error?: string } {
  if (weight === null || weight === undefined) {
    return { isValid: false, error: 'Weight is required' };
  }
  
  if (typeof weight !== 'number' || weight <= 0) {
    return { isValid: false, error: 'Weight must be a positive number' };
  }
  
  if (weight > 500) {
    return { isValid: false, error: 'Weight exceeds maximum (500 kg)' };
  }

  if (isNaN(weight)) {
    return { isValid: false, error: 'Weight must be a valid number' };
  }
  
  return { isValid: true };
}

// Text field validation (general purpose)
export function validateTextField(value: string, fieldName: string, minLength: number = 3, maxLength: number = 500): { isValid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (value.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (value.length > maxLength) {
    return { isValid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
  }

  // Regex "Blacklist": Blokir karakter XSS, SQLi, dan Command Injection
  const dangerousChars = /[<>"'();]/;
  if (dangerousChars.test(value)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }

  // Blokir pola SQL Injection / Comment
  const sqlPattern = /(--|' OR '1'='1')/i;
  if (sqlPattern.test(value)) {
    return { isValid: false, error: `Invalid ${fieldName} pattern` };
  }
  
  return { isValid: true };
}

// UUID validation
export function validateUUID(id: string, fieldName: string = 'ID'): { isValid: boolean; error?: string } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (!uuidRegex.test(id)) {
    return { isValid: false, error: `Invalid ${fieldName} format` };
  }
  
  return { isValid: true };
}

// Enum validation
export function validateEnum(value: string, allowedValues: string[], fieldName: string = 'Field'): { isValid: boolean; error?: string } {
  if (!value) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (!allowedValues.includes(value)) {
    return { isValid: false, error: `${fieldName} must be one of: ${allowedValues.join(', ')}` };
  }
  
  return { isValid: true };
}