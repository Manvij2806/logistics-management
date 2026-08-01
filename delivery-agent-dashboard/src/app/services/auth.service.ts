import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone_number?: string | null;
  status: 'Active' | 'Inactive';
  role: 'Admin' | 'Dispatcher' | 'Agent' | 'Customer';
  role_id: number | null;
  city?: string | null;
}

const TOKEN_KEY = 'agent_auth_token';
const USER_KEY = 'agent_auth_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.isLoggedIn());
  isLoggedIn$: Observable<boolean> = this.isLoggedInSubject.asObservable();

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

  login(usernameOrEmail: string, password: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/api/auth/login`, {
        username: usernameOrEmail,
        password,
      })
      .pipe(
        tap((res) => {
          sessionStorage.setItem(TOKEN_KEY, res.access_token);
          this.isLoggedInSubject.next(true);
        }),
      );
  }

  setTokenFromBridge(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
    this.isLoggedInSubject.next(true);
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<any>(`${this.apiUrl}/api/auth/me`).pipe(
      map((me) => {
        const ROLE_ID_TO_NAME: { [key: number]: string } = {
          1: 'Admin',
          2: 'Agent',
          3: 'Dispatcher',
        };
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
        this.isLoggedInSubject.next(true);
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
    this.clearSessionSilently();
    window.location.href = `${environment.adminAppUrl}/login?logout=true`;
  }

  clearSessionSilently(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.isLoggedInSubject.next(false);
  }

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
