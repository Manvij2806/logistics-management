import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  full_name: string;
  username: string;
  email: string;
  status: 'Active' | 'Inactive';
  role: 'Admin' | 'Dispatcher' | 'Agent' | 'Customer';
  role_id: number | null;
  phone_number?: string;
}

export const ROLE_ID_TO_NAME: Record<number, string> = {
  1: 'Admin',
  2: 'Agent',
  3: 'Dispatcher',
  4: 'Customer',
};

interface MeResponse {
  id: number;
  fullname: string;
  username: string;
  email: string;
  status: string;
  role_id: number | null;
  phone_number?: string;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = environment.apiUrl;

  currentUser = signal<User | null>(this.restoreCachedUser());

  private restoreCachedUser(): User | null {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<MeResponse>(`${this.apiUrl}/api/auth/me`).pipe(
      map((me) => {
        const role = (me.role_id ? ROLE_ID_TO_NAME[me.role_id] : undefined) ?? 'Customer';
        const user: User = {
          id: String(me.id),
          full_name: me.fullname,
          username: me.username,
          email: me.email,
          status: me.status as 'Active' | 'Inactive',
          role: role as User['role'],
          role_id: me.role_id ?? null,
          phone_number: me.phone_number,
        };
        return user;
      }),
      tap((user) => {
        this.currentUser.set(user);
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    window.location.href = `${environment.adminAppUrl}/login?logout=true`;
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/auth/change-password`, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  clearSessionSilently(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
