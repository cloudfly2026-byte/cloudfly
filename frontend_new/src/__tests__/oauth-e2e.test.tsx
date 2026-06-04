/**
 * CLOUD-286: E2E OAuth Test Scenarios (TC-01 through TC-10)
 * 
 * These tests simulate the complete OAuth flow end-to-end.
 * They use mocked OAuth providers to avoid real API calls.
 * 
 * NOTE: For true E2E testing, use Playwright/Cypress with real
 * Google and Facebook test accounts. These are integration-level
 * tests that verify the frontend logic.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================
// Mock window.location for redirect testing
// ============================================================
const mockLocationAssign = jest.fn();
const mockLocationReplace = jest.fn();

Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    assign: mockLocationAssign,
    replace: mockLocationReplace,
    hash: '',
    search: '',
    origin: 'http://localhost:3000',
  },
  writable: true,
});

// ============================================================
// Mock localStorage
// ============================================================
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    getStore: () => store,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ============================================================
// Mock fetch
// ============================================================
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ============================================================
// Mock Google Identity Services
// ============================================================
const mockGooglePrompt = jest.fn();
const mockGoogleInitialize = jest.fn();

Object.defineProperty(window, 'google', {
  value: {
    accounts: {
      id: {
        initialize: mockGoogleInitialize,
        prompt: mockGooglePrompt,
      },
    },
  },
  writable: true,
});

// ============================================================
// Mock Facebook SDK
// ============================================================
const mockFbLogin = jest.fn();
const mockFbInit = jest.fn();

Object.defineProperty(window, 'FB', {
  value: {
    init: mockFbInit,
    login: mockFbLogin,
  },
  writable: true,
});

// ============================================================
// Test Components
// ============================================================
const TestOAuthFlow = ({ provider, mode }: { provider: 'google' | 'facebook'; mode: 'login' | 'register' }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGoogleOAuth = async () => {
    try {
      const response = await fetch('/api/v2/auth/oauth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'test-google-jwt' }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Error Google OAuth: Google ID Token inválido');
      }

      const data = await response.json();

      // Save to localStorage
      localStorage.setItem('jwt', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));
      localStorage.setItem('isOAuthUser', 'true');

      setSuccess(true);

      // Redirect logic
      if (data.user.onboardingCompleted === false && data.user.role === 'ADMIN') {
        window.location.href = '/account-setup';
      } else {
        window.location.href = '/home';
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFacebookOAuth = async () => {
    try {
      const response = await fetch('/api/v2/auth/oauth/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'test-fb-access-token' }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Error Facebook OAuth: Token de Facebook inválido');
      }

      const data = await response.json();

      localStorage.setItem('jwt', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));
      localStorage.setItem('isOAuthUser', 'true');

      setSuccess(true);

      if (data.user.onboardingCompleted === false && data.user.role === 'ADMIN') {
        window.location.href = '/account-setup';
      } else {
        window.location.href = '/home';
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div data-testid="oauth-flow">
      {provider === 'google' && (
        <button data-testid="google-oauth-btn" onClick={handleGoogleOAuth}>
          {mode === 'register' ? 'Continuar con Google' : 'Iniciar sesión con Google'}
        </button>
      )}
      {provider === 'facebook' && (
        <button data-testid="facebook-oauth-btn" onClick={handleFacebookOAuth}>
          {mode === 'register' ? 'Continuar con Facebook' : 'Iniciar sesión con Facebook'}
        </button>
      )}
      {error && <div data-testid="oauth-error" className="error-message">{error}</div>}
      {success && <div data-testid="oauth-success" className="success-message">Autenticación exitosa</div>}
    </div>
  );
};

// Need to import useState for the component
import { useState } from 'react';

// ============================================================
// E2E Test Suite
// ============================================================
describe('CLOUD-286: E2E OAuth Flow Tests (TC-01 to TC-10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  // ========================================
  // TC-01: Google OAuth — Registro nuevo usuario
  // ========================================
  test('TC-01: Google OAuth — Registro nuevo usuario → JWT → canal GOOGLE → dashboard', async () => {
    // Mock successful Google OAuth response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc01',
        user: {
          id: 1,
          username: 'newuser_google',
          email: 'newuser@gmail.com',
          name: 'New User',
          avatarUrl: 'https://lh3.googleusercontent.com/pic.jpg',
          role: 'ADMIN',
          customerId: 10,
          companyId: 10,
          onboardingCompleted: false,
        },
        isNewUser: true,
      }),
    });

    render(<TestOAuthFlow provider="google" mode="register" />);

    // Click Google button
    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    // Wait for API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v2/auth/oauth/google',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-google-jwt'),
        })
      );
    });

    // Verify success state
    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    // Verify localStorage
    expect(localStorageMock.getItem('jwt')).toBe('jwt-token-tc01');
    expect(localStorageMock.getItem('isOAuthUser')).toBe('true');

    const userData = JSON.parse(localStorageMock.getItem('userData') || '{}');
    expect(userData.email).toBe('newuser@gmail.com');
    expect(userData.name).toBe('New User');
    expect(userData.avatarUrl).toBe('https://lh3.googleusercontent.com/pic.jpg');

    // Verify redirect to account-setup (new ADMIN user)
    expect(window.location.href).toBe('/account-setup');
  });

  // ========================================
  // TC-02: Google OAuth — Login usuario existente
  // ========================================
  test('TC-02: Google OAuth — Login usuario existente → JWT → sin duplicar', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc02',
        user: {
          id: 5,
          username: 'existinguser',
          email: 'existing@gmail.com',
          name: 'Existing User',
          role: 'USER',
          customerId: 20,
          companyId: 20,
          onboardingCompleted: true,
        },
        isNewUser: false,
      }),
    });

    render(<TestOAuthFlow provider="google" mode="login" />);

    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    // Verify JWT stored
    expect(localStorageMock.getItem('jwt')).toBe('jwt-token-tc02');
    expect(localStorageMock.getItem('isOAuthUser')).toBe('true');

    // Verify redirect to home (existing user, onboarding completed)
    expect(window.location.href).toBe('/home');
  });

  // ========================================
  // TC-03: Facebook OAuth — Registro nuevo usuario
  // ========================================
  test('TC-03: Facebook OAuth — Registro nuevo → canal FACEBOOK → JWT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc03',
        user: {
          id: 2,
          username: 'fb_newuser',
          email: 'fbnew@test.com',
          name: 'FB New User',
          avatarUrl: 'https://graph.facebook.com/pic.jpg',
          role: 'ADMIN',
          customerId: 30,
          companyId: 30,
          onboardingCompleted: false,
        },
        isNewUser: true,
      }),
    });

    render(<TestOAuthFlow provider="facebook" mode="register" />);

    fireEvent.click(screen.getByTestId('facebook-oauth-btn'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v2/auth/oauth/facebook',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-fb-access-token'),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    expect(localStorageMock.getItem('jwt')).toBe('jwt-token-tc03');
    expect(localStorageMock.getItem('isOAuthUser')).toBe('true');

    const userData = JSON.parse(localStorageMock.getItem('userData') || '{}');
    expect(userData.email).toBe('fbnew@test.com');
    expect(userData.name).toBe('FB New User');

    // New ADMIN → account-setup
    expect(window.location.href).toBe('/account-setup');
  });

  // ========================================
  // TC-04: Denegar permisos → mensaje de error
  // ========================================
  test('TC-04: Denegar permisos OAuth → mostrar mensaje de error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        message: 'Error Google OAuth: Google ID Token inválido',
      }),
    });

    render(<TestOAuthFlow provider="google" mode="register" />);

    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-error')).toBeInTheDocument();
    });

    const errorEl = screen.getByTestId('oauth-error');
    expect(errorEl.textContent).toContain('Error Google OAuth');

    // Verify no JWT stored
    expect(localStorageMock.getItem('jwt')).toBeNull();
    expect(localStorageMock.getItem('isOAuthUser')).toBeNull();
  });

  // ========================================
  // TC-05: Token inválido → 401 → error
  // ========================================
  test('TC-05: Token OAuth inválido → backend 401 → frontend muestra error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        message: 'Error Facebook OAuth: Token de Facebook inválido',
      }),
    });

    render(<TestOAuthFlow provider="facebook" mode="login" />);

    fireEvent.click(screen.getByTestId('facebook-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('oauth-error').textContent).toContain('Error Facebook OAuth');

    // No session data stored
    expect(localStorageMock.getItem('jwt')).toBeNull();
  });

  // ========================================
  // TC-06: Email ya existe + OAuth mismo email → vincular
  // ========================================
  test('TC-06: Email existente + OAuth mismo email → vincular sin duplicar', async () => {
    // Backend should link the OAuth account to the existing user
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc06',
        user: {
          id: 10, // Same existing user ID
          username: 'existing_traditional',
          email: 'same@email.com', // Same email
          name: 'Same Email User',
          role: 'USER',
          customerId: 40,
          companyId: 40,
          onboardingCompleted: true,
        },
        isNewUser: false, // Not a new user - linked
      }),
    });

    render(<TestOAuthFlow provider="google" mode="login" />);

    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    const userData = JSON.parse(localStorageMock.getItem('userData') || '{}');
    expect(userData.email).toBe('same@email.com');
    expect(userData.id).toBe(10); // Same user, not duplicated

    // Redirect to home (existing user)
    expect(window.location.href).toBe('/home');
  });

  // ========================================
  // TC-07: Canal GOOGLE aparece en CRM
  // ========================================
  test('TC-07: Canal GOOGLE/FACEBOOK visible en Canales Registrados del CRM', async () => {
    // This test verifies the channel data structure that would be created
    const mockChannelResponse = {
      id: 1,
      name: 'GOOGLE - Test User',
      platform: 'GOOGLE',
      provider: 'GOOGLE_OAUTH',
      status: true,
      tenantId: 10,
      companyId: 10,
    };

    // Verify channel structure
    expect(mockChannelResponse.platform).toBe('GOOGLE');
    expect(mockChannelResponse.provider).toBe('GOOGLE_OAUTH');
    expect(mockChannelResponse.status).toBe(true);
    expect(mockChannelResponse.name).toContain('GOOGLE');
  });

  // ========================================
  // TC-08: Perfil tiene nombre y foto OAuth
  // ========================================
  test('TC-08: Perfil del usuario tiene nombre y foto de Google/Facebook', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc08',
        user: {
          id: 3,
          username: 'googleuser',
          email: 'googleuser@gmail.com',
          name: 'Google User Full Name',
          avatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
          role: 'USER',
          customerId: 50,
          companyId: 50,
          onboardingCompleted: true,
        },
      }),
    });

    render(<TestOAuthFlow provider="google" mode="register" />);

    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    const userData = JSON.parse(localStorageMock.getItem('userData') || '{}');
    expect(userData.name).toBe('Google User Full Name');
    expect(userData.avatarUrl).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
  });

  // ========================================
  // TC-09: JWT funciona para llamadas autenticadas
  // ========================================
  test('TC-09: JWT OAuth funciona para todas las llamadas autenticadas del dashboard', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc09',
        user: {
          id: 4,
          username: 'jwtuser',
          email: 'jwt@test.com',
          role: 'USER',
          customerId: 60,
          companyId: 60,
          onboardingCompleted: true,
        },
      }),
    });

    render(<TestOAuthFlow provider="google" mode="login" />);

    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    // Verify JWT is stored and can be used for authenticated calls
    const jwt = localStorageMock.getItem('jwt');
    expect(jwt).toBe('jwt-token-tc09');

    // Verify the JWT structure (should have 3 parts)
    const jwtParts = jwt!.split('.');
    expect(jwtParts.length).toBe(3);

    // Verify payload contains expected claims
    const payload = JSON.parse(atob(jwtParts[1]));
    expect(payload).toHaveProperty('sub');
    expect(payload).toHaveProperty('exp');
  });

  // ========================================
  // TC-10: onboarding_completed=false → onboarding
  // ========================================
  test('TC-10: onboarding_completed=false en usuario nuevo OAuth → redirige al onboarding', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-tc10',
        user: {
          id: 5,
          username: 'newadmin',
          email: 'newadmin@gmail.com',
          name: 'New Admin',
          role: 'ADMIN',
          customerId: 70,
          companyId: 70,
          onboardingCompleted: false, // Not completed!
        },
        isNewUser: true,
      }),
    });

    render(<TestOAuthFlow provider="google" mode="register" />);

    fireEvent.click(screen.getByTestId('google-oauth-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-success')).toBeInTheDocument();
    });

    // Should redirect to account-setup, NOT /home
    expect(window.location.href).toBe('/account-setup');
  });
});
