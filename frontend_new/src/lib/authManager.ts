/**
 * CLOUD-286: AuthManager with OAuth support
 * Manages authentication state including OAuth sessions
 */

const JWT_KEY = 'jwt';
const USER_DATA_KEY = 'userData';
const IS_OAUTH_USER_KEY = 'isOAuthUser';
const ACTIVE_TENANT_KEY = 'activeTenantId';
const ACTIVE_COMPANY_KEY = 'activeCompanyId';

export interface UserData {
  id: number;
  username: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
  customerId?: number;
  companyId?: number;
  onboardingCompleted?: boolean;
}

export interface OAuthTokenResponse {
  token: string;
  user: UserData;
  isNewUser?: boolean;
}

class AuthManager {
  /**
   * Save JWT token to localStorage
   */
  saveJwt(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(JWT_KEY, token);
    }
  }

  /**
   * Get JWT token from localStorage
   */
  getJwt(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(JWT_KEY);
    }
    return null;
  }

  /**
   * Save user data to localStorage
   */
  saveUserData(user: UserData): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    }
  }

  /**
   * Get user data from localStorage
   */
  getUserData(): UserData | null {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(USER_DATA_KEY);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Save OAuth session (JWT + user + OAuth flag)
   */
  saveOAuthSession(token: string, user: UserData, isOAuthUser: boolean): void {
    this.saveJwt(token);
    this.saveUserData(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem(IS_OAUTH_USER_KEY, String(isOAuthUser));
    }
  }

  /**
   * Check if current user authenticated via OAuth
   */
  isOAuthUser(): boolean {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(IS_OAUTH_USER_KEY) === 'true';
    }
    return false;
  }

  /**
   * Set active tenant ID
   */
  setActiveTenant(tenantId: number): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_TENANT_KEY, String(tenantId));
    }
  }

  /**
   * Get active tenant ID
   */
  getActiveTenant(): number | null {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem(ACTIVE_TENANT_KEY);
      return val ? Number(val) : null;
    }
    return null;
  }

  /**
   * Set active company ID
   */
  setActiveCompany(companyId: number): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_COMPANY_KEY, String(companyId));
    }
  }

  /**
   * Get active company ID
   */
  getActiveCompany(): number | null {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem(ACTIVE_COMPANY_KEY);
      return val ? Number(val) : null;
    }
    return null;
  }

  /**
   * Login with Google OAuth
   * Calls backend to validate Google ID token and get JWT
   */
  async loginWithGoogle(idToken: string): Promise<OAuthTokenResponse> {
    const response = await fetch('/api/v2/auth/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error de autenticación con Google' }));
      throw new Error(error.message || 'Error de autenticación con Google');
    }

    const data: OAuthTokenResponse = await response.json();
    this.saveOAuthSession(data.token, data.user, true);
    return data;
  }

  /**
   * Login with Facebook OAuth
   * Calls backend to validate Facebook access token and get JWT
   */
  async loginWithFacebook(accessToken: string): Promise<OAuthTokenResponse> {
    const response = await fetch('/api/v2/auth/oauth/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error de autenticación con Facebook' }));
      throw new Error(error.message || 'Error de autenticación con Facebook');
    }

    const data: OAuthTokenResponse = await response.json();
    this.saveOAuthSession(data.token, data.user, true);
    return data;
  }

  /**
   * Traditional login (email + password)
   */
  async login(email: string, password: string): Promise<OAuthTokenResponse> {
    const response = await fetch('/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Credenciales inválidas' }));
      throw new Error(error.message || 'Credenciales inválidas');
    }

    const data: OAuthTokenResponse = await response.json();
    this.saveOAuthSession(data.token, data.user, false);
    return data;
  }

  /**
   * Traditional register
   */
  async register(userData: {
    username: string;
    email: string;
    password: string;
    name?: string;
  }): Promise<OAuthTokenResponse> {
    const response = await fetch('/api/v2/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error en el registro' }));
      throw new Error(error.message || 'Error en el registro');
    }

    const data: OAuthTokenResponse = await response.json();
    this.saveOAuthSession(data.token, data.user, false);
    return data;
  }

  /**
   * Logout - clears all auth data from localStorage
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(JWT_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      localStorage.removeItem(IS_OAUTH_USER_KEY);
      // Keep tenant/company for next login
    }
  }

  /**
   * Check if user is authenticated (has valid JWT)
   */
  isAuthenticated(): boolean {
    const token = this.getJwt();
    if (!token) return false;

    try {
      // Check if token is expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < exp;
    } catch {
      return false;
    }
  }

  /**
   * Get authorization headers for API calls
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getJwt();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }
}

// Singleton instance
const authManager = new AuthManager();
export default authManager;
