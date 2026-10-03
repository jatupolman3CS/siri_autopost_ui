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
