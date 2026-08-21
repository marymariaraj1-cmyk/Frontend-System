import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { SessionUser } from '../models/session-user';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  readonly user = signal<SessionUser | null>(null);

  get isAuthenticated(): boolean {
    return this.user() !== null;
  }

  login(username: string, password: string): Observable<ApiResponse<SessionUser>> {
    return this.api.post<SessionUser>('/auth/login', { username, password }).pipe(
      tap((response) => {
        if (response.success) {
          this.user.set(response.data);
        }
      }),
    );
  }

  restore(): Observable<boolean> {
    if (this.user()) {
      return of(true);
    }
    return this.api.get<SessionUser>('/auth/me').pipe(
      map((response) => {
        if (response.success) {
          this.user.set(response.data);
          return true;
        }
        return false;
      }),
      catchError(() => {
        this.user.set(null);
        return of(false);
      }),
    );
  }

  logout(): void {
    this.api.post<void>('/auth/logout').subscribe({
      next: () => this.user.set(null),
      error: () => this.user.set(null),
    });
  }

  clear(): void {
    this.user.set(null);
  }
}
