import { api } from '$lib/api/client';
import { ws } from '$lib/api/ws';
import type { User } from '@harmony/shared/types/user';
import type { LoginResponse, RegisterResponse } from '@harmony/shared/types/api';

class AuthStore {
  user = $state<User | null>(null);
  isLoading = $state(true);

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  constructor() {
    // Set up API callbacks
    api.onRefresh((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    });

    api.onFailure(() => {
      this.logout();
    });

    // Restore session from localStorage (only in browser)
    if (typeof window !== 'undefined') {
      this.restore();
    } else {
      this.isLoading = false;
    }
  }

  private restore(): void {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userData = localStorage.getItem('user');

    if (accessToken && refreshToken && userData) {
      try {
        api.setTokens(accessToken, refreshToken);
        this.user = JSON.parse(userData) as User;
        ws.connect(accessToken);
      } catch {
        // Corrupt data — clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }

    this.isLoading = false;
  }

  async login(username: string, password: string): Promise<void> {
    const res = await api.post<LoginResponse>('/auth/login', { username, password });
    this.setSession(res);
  }

  async register(username: string, displayName: string, password: string): Promise<void> {
    const res = await api.post<RegisterResponse>('/auth/register', { username, displayName, password });
    this.setSession(res);
  }

  private setSession(res: LoginResponse | RegisterResponse): void {
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    api.setTokens(res.accessToken, res.refreshToken);
    this.user = res.user;
    ws.connect(res.accessToken);
  }

  updateUser(updated: User): void {
    if (this.user) {
      this.user = { ...this.user, ...updated };
      localStorage.setItem('user', JSON.stringify(this.user));
    }
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    api.clearTokens();
    ws.disconnect();
    this.user = null;
  }
}

export const auth = new AuthStore();
