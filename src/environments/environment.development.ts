// `ng serve`: /api is proxied to the backend by proxy.conf.json, so the base URL stays empty.
export const environment = {
  production: false,
  apiBaseUrl: '',
  authEnabled: false,
};
