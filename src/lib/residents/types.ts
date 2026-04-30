export type ResidentStatus = 'active' | 'checked_out' | 'suspended';

export type AssignmentStatus = 'active' | 'ended';

export interface ResidentRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  national_id_or_iqama: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  university_or_workplace: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profile_image: string | null;
  documents: string[] | null;
  status: ResidentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResidentAssignmentRow {
  id: string;
  resident_id: string;
  room_id: string;
  building_id: string;
  check_in_date: string;
  check_out_date: string | null;
  status: AssignmentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResidentListItem extends ResidentRow {
  current_assignment: {
    id: string;
    room_id: string;
    building_id: string;
    check_in_date: string;
    check_out_date: string | null;
    room_number: string | null;
    floor: number | null;
    apartment_id: string | null;
    apartment_number: string | null;
    building_city_en: string;
    building_city_ar: string;
    building_neighborhood_en: string;
    building_neighborhood_ar: string;
  } | null;
}

export interface ResidentMaintenanceItem {
  id: string;
  title: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
}

export interface ResidentAssignmentHistoryItem {
  id: string;
  room_id: string;
  building_id: string;
  check_in_date: string;
  check_out_date: string | null;
  status: AssignmentStatus;
  created_at: string;
  room_number: string | null;
  floor: number | null;
  apartment_id: string | null;
  apartment_number: string | null;
  building_city_en: string;
  building_city_ar: string;
  building_neighborhood_en: string;
  building_neighborhood_ar: string;
}

export interface ResidentDetailPayload extends ResidentRow {
  current_assignment: ResidentListItem['current_assignment'];
  assignment_history: ResidentAssignmentHistoryItem[];
  maintenance_history: ResidentMaintenanceItem[];
}
