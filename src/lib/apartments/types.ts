export interface Apartment {
  id: string;
  building_id: string;
  apartment_number: string;
  floor: number;
  description_en: string;
  description_ar: string;
  notes: string | null;
  has_kitchen: boolean;
  has_living_room: boolean;
  shared_bathroom_count: number;
  private_bathroom_count: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApartmentSummary {
  id: string;
  apartment_number: string;
  floor: number;
}

export interface ApartmentListItem extends Apartment {
  rooms_count: number;
  active_residents_count: number;
}
