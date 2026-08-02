import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, ROLE_ID_TO_NAME } from './user';

interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface MeResponse {
  id: number;
  fullname: string;
  username: string;
  email: string;
  status: string;
  role_id: number | null;
  phone_number?: string | null;
  city?: string | null;
}

const TOKEN_KEY = 'dispatcher_auth_token';
const USER_KEY = 'dispatcher_auth_user';

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

  login(usernameOrEmail: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/api/auth/login`, {
        username: usernameOrEmail,
        password,
      })
      .pipe(
        tap((res) => {
          sessionStorage.setItem(TOKEN_KEY, res.access_token);
        }),
      );
  }

  /**
   * Stores a token that was handed off from the admin portal's login page
   * (single-login-page flow: a Dispatcher logging in on :4200 gets redirected
   * here with their token in the URL). Does NOT validate the token — the
   * caller must follow up with loadCurrentUser() to confirm it's valid and
   * belongs to a Dispatcher.
   */
  setTokenFromBridge(token: string): void {
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
          phone_number: me.phone_number,
          status: me.status as 'Active' | 'Inactive',
          role: role as User['role'],
          role_id: me.role_id ?? null,
          city: me.city ?? null,
        };
        return user;
      }),
      tap((user) => {
        this.currentUser.set(user);
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
    );
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/auth/change-password`, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    window.location.href = `${environment.adminAppUrl}/login?logout=true`;
  }

  /** Clears the session without navigating — used when a login succeeds but the account's role isn't permitted in this portal. */
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
  isAdmin(): boolean {
    return this.currentUser()?.role === 'Admin';
  }
  isDispatcher(): boolean {
    return this.currentUser()?.role === 'Dispatcher';
  }
  hasAnyRole(...roles: string[]): boolean {
    const role = this.getUserRole();
    return !!role && roles.includes(role);
  }
  getUserRole(): string | null {
    return this.currentUser()?.role ?? null;
  }
}
