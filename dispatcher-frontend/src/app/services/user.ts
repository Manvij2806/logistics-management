// ── Role ID mapping (must match DB) ──────────────────────────────────────────
// NOTE: roles.id = 3 was renamed from 'manager' to 'dispatcher' in the database
// to match this mapping. See routers/roles.py / database.py on the backend.
export const ROLE_NAME_TO_ID: Record<string, number> = {
  Admin: 1,
  Agent: 2,
  Dispatcher: 3,
  Customer: 4,
};

export const ROLE_ID_TO_NAME: Record<number, string> = {
  1: 'Admin',
  2: 'Agent',
  3: 'Dispatcher',
  4: 'Customer',
};

export interface User {
  id: string;
  full_name: string; // mapped from backend's "fullname"
  username: string;
  email: string;
  phone_number?: string | null;
  role: 'Admin' | 'Dispatcher' | 'Agent' | 'Customer';
  role_id?: number | null;
  status: 'Active' | 'Inactive';
  city?: string | null;
  created_at?: string;
}
