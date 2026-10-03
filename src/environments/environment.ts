// Production build. The UI is served behind the same origin as the API (reverse proxy).
export const environment = {
  production: true,
  apiBaseUrl: '',
  // Turn on once the backend has /api/auth endpoints; until then every route is open.
  authEnabled: false,
};
