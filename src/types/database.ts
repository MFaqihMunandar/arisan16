export type UserRole = 'super_admin' | 'pengurus' | 'sekretaris' | 'bendahara' | 'anggota';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
  updated_at?: string;
}