const TOKEN_KEY = 'ap-token';

// The API's bearer token, kept in localStorage so a reload stays signed in.
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Signed in for this visit only.
    }
  },
};

const ASSIST_KEY = 'ap-assist';

/** An admin seeing the app as a customer: the admin's own token waits here until they return. */
export interface AssistSession {
  adminToken: string;
  customerId: string;
  email: string;
  expiresAt: string;
}

export const assistStorage = {
  get(): AssistSession | null {
    try {
      const raw = localStorage.getItem(ASSIST_KEY);
      return raw ? (JSON.parse(raw) as AssistSession) : null;
    } catch {
      return null;
    }
  },
  set(value: AssistSession | null): void {
    try {
      if (value) localStorage.setItem(ASSIST_KEY, JSON.stringify(value));
      else localStorage.removeItem(ASSIST_KEY);
    } catch {
      // Kept for this visit only.
    }
  },
};
