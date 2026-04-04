import { isTauri, getServerUrl } from '$lib/utils/tauri';

/** Returns the base URL for API calls, accounting for Tauri vs browser. */
function getApiBase(): string {
  if (isTauri()) {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('No server URL configured. Please connect to a server first.');
    return `${serverUrl}/api`;
  }
  return '/api';
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshCallback: ((tokens: { accessToken: string; refreshToken: string }) => void) | null = null;
  private onAuthFailureCallback: (() => void) | null = null;

  setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  onRefresh(callback: (tokens: { accessToken: string; refreshToken: string }) => void): void {
    this.onTokenRefreshCallback = callback;
  }

  onFailure(callback: () => void): void {
    this.onAuthFailureCallback = callback;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isFormData?: boolean
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (!isFormData && body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      init.body = isFormData ? (body as FormData) : JSON.stringify(body);
    }

    const apiBase = getApiBase();
    let response = await fetch(`${apiBase}${path}`, init);

    // Attempt token refresh on 401
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${apiBase}${path}`, { ...init, headers });
      } else {
        this.onAuthFailureCallback?.();
        throw new Error('Authentication failed');
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errorMessage = errData?.message ?? errData?.error ?? errorMessage;
      } catch {
        // ignore parse errors
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${getApiBase()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.onTokenRefreshCallback?.({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>('POST', path, formData, true);
  }
}

export const api = new ApiClient();
