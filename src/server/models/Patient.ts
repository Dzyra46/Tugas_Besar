export interface Patient {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  birth_date?: string;
  owner: string;
  owner_id: string;
  contact: string;
  qr_code: string;
  status: 'healthy' | 'under-treatment' | 'recovered';
  notes?: string;
  assigned_doctor_id?: string;
  assigned_at?: string;
  created_at?: string;
  updated_at?: string;
}
