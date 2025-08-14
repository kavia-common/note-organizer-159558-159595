//
// PUBLIC_INTERFACE
export const getConfig = () => {
  /**
   * Returns app configuration derived from environment variables and defaults.
   * - VITE_API_BASE_URL: optional backend API base URL (e.g., https://api.example.com)
   * - VITE_APP_NAME: optional app display name
   */
  const apiBaseUrl = (import.meta?.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const appName = (import.meta?.env?.VITE_APP_NAME || 'Notes Organizer').trim();

  return {
    appName,
    apiBaseUrl: apiBaseUrl || null,
    theme: {
      primary: '#1976d2',
      secondary: '#424242',
      accent: '#ff9800',
    }
  };
};
