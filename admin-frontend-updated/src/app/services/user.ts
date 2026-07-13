import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Role ID mapping (must match DB) ──────────────────────────────────────────
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

// ── Public User interface (what the rest of the app uses) ────────────────────
export interface User {
  id: string;
  full_name: string; // mapped from backend's "fullname"
  username: string;
  email: string;
  phone_number?: string | null;
  role: 'Admin' | 'Dispatcher' | 'Agent' | 'Customer'; // derived from role_id/role.name
  role_id?: number | null;
  status: 'Active' | 'Inactive';
  created_at?: string;
}

// ── Backend response shapes ──────────────────────────────────────────────────
interface BackendUser {
  id: number;
  fullname: string;
  username: string;
  email: string;
  phone_number?: string | null;
  status: string;
  role_id?: number | null;
  role?: { id: number; name: string; description?: string | null } | null;
  created_at?: string;
}

function mapUser(u: BackendUser): User {
  const roleName = u.role?.name ?? (u.role_id ? ROLE_ID_TO_NAME[u.role_id] : undefined);
  return {
    id: String(u.id),
    full_name: u.fullname,
    username: u.username,
    email: u.email,
    phone_number: u.phone_number,
    status: u.status as 'Active' | 'Inactive',
    role: (roleName ?? 'Customer') as User['role'],
    role_id: u.role_id ?? null,
    created_at: u.created_at,
  };
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  sort_by?: 'fullname' | 'email' | 'phone_number' | 'status' | 'created_at';
  sort_order?: 'asc' | 'desc';
  search?: string;
}

export interface UserListResponse {
  total: number;
  page: number;
  page_size: number;
  users: User[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/users`;

  getUsers(params: UserListParams = {}): Observable<UserListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.page_size) httpParams = httpParams.set('page_size', params.page_size);
    if (params.sort_by) httpParams = httpParams.set('sort_by', params.sort_by);
    if (params.sort_order) httpParams = httpParams.set('sort_order', params.sort_order);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http
      .get<{ total: number; page: number; page_size: number; users: BackendUser[] }>(
        `${this.apiUrl}/`,
        { params: httpParams },
      )
      .pipe(
        map((res) => ({
          total: res.total,
          page: res.page,
          page_size: res.page_size,
          users: res.users.map(mapUser),
        })),
      );
  }

  createUser(userData: {
    full_name: string;
    username: string;
    email: string;
    phone_number: string;
    role: User['role'];
    password: string;
  }): Observable<User> {
    const payload = {
      fullname: userData.full_name,
      username: userData.username,
      email: userData.email,
      phone_number: userData.phone_number,
      role_id: ROLE_NAME_TO_ID[userData.role] ?? null,
      password: userData.password,
    };
    return this.http.post<BackendUser>(`${this.apiUrl}/`, payload).pipe(map(mapUser));
  }

  updateUserStatus(id: string, status: 'Active' | 'Inactive'): Observable<User> {
    return this.http
      .patch<BackendUser>(`${this.apiUrl}/${id}/status`, { status })
      .pipe(map(mapUser));
  }

  updateUser(
    id: string,
    userData: { full_name: string; phone_number: string; role: User['role']; email?: string },
  ): Observable<User> {
    const payload: Record<string, unknown> = {
      fullname: userData.full_name,
      phone_number: userData.phone_number,
      role_id: ROLE_NAME_TO_ID[userData.role] ?? null,
    };
    if (userData.email) payload['email'] = userData.email;

    return this.http.put<BackendUser>(`${this.apiUrl}/${id}`, payload).pipe(map(mapUser));
  }

  resetPassword(id: string, password: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/password`, { password });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
