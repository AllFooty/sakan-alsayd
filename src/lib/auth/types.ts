export type UserRole =
  | 'super_admin'
  | 'deputy_general_manager'
  | 'branch_manager'
  | 'maintenance_manager'
  | 'transportation_manager'
  | 'finance_manager'
  | 'maintenance_staff'
  | 'transportation_staff'
  | 'supervision_staff'
  | 'finance_staff';

export interface StaffProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}
