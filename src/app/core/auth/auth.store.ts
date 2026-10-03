import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';

export interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
}

// Auth state as signals. The backend auth endpoint (/api/auth/login) is not built yet;
// keep environment.authEnabled false until it is.
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorageService);

  private readonly _token = signal<string | null>(this.storage.get());
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !environment.authEnabled || this._token() !== null);

  async login(req: LoginRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login`, req),
    );
    this.storage.set(res.accessToken);
    this._token.set(res.accessToken);
  }

  logout(): void {
    this.storage.clear();
    this._token.set(null);
  }
}
