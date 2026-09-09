export type UserRole = 'super_admin' | 'pengurus' | 'sekretaris' | 'bendahara' | 'anggota';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  email?: string;
  created_at?: string;
}

export interface ArisanGroup {
  id: string;
  group_code: string;
  group_name: string;
  description?: string;
  created_at?: string;
}

export interface GroupMemberView {
  id: string;
  group_id: string;
  user_id: string;
  group_code: string;
  group_name: string;
  full_name: string;
  email?: string;
  member_number: number;
  role: UserRole;
  status: string;
}