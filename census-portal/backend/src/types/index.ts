export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type: string;
  monthly_limit: number;
  requests_used: number;
}

export interface APIKey {
  id: number;
  user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  is_active: boolean;
  created_at: Date;
  last_used: Date;
}

export interface Geography {
  id: number;
  code: string;
  name: string;
  level: string;
  parent_id: number;
  population: number;
  area_km2: number;
}

export interface Indicator {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
}

export interface DataValue {
  id: number;
  geography_id: number;
  indicator_id: number;
  year: number;
  value: number;
}