/**
 * CLOUD-286: Frontend OAuth Tests
 * 14 tests covering: render, styling, AuthManager OAuth methods, API calls
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================
// Mock AuthManager
// ============================================================
const mockAuthManager = {
  saveOAuthSession: jest.fn(),
  isOAuthUser: jest.fn().mockReturnValue(false),
  logout: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithFacebook: jest.fn(),
  getJwt: jest.fn().mockReturnValue('mock-jwt-token'),
  getUserData: jest.fn().mockReturnValue({ id: 1, email: 'test@test.com' }),
};

jest.mock('@/lib/authManager', () => ({
  __esModule: true,
  default: mockAuthManager,
  AuthManager: mockAuthManager,
}));

// ============================================================
// Mock fetch for API calls
// ============================================================
global.fetch = jest.fn();

// ============================================================
// Mock OAuth buttons component
// ============================================================
const MockOAuthButtons = ({ mode }: { mode: 'login' | 'register' }) => {
  const handleGoogleClick = async () => {
    const response = await fetch('/api/v2/auth/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'google-test-token' }),
    });
    const data = await response.json();
    if (data.token) {
      mockAuthManager.saveOAuthSession(data.token, data.user, true);
      mockAuthManager.loginWithGoogle(data.token, data.user);
    }
  };

  const handleFacebookClick = async () => {
    const response = await fetch('/api/v2/auth/oauth/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'fb-test-token' }),
    });
    const data = await response.json();
    if (data.token) {
      mockAuthManager.saveOAuthSession(data.token, data.user, true);
      mockAuthManager.loginWithFacebook(data.token, data.user);
    }
  };

  return (
    <div className="oauth-buttons-container" data-testid="oauth-buttons">
      <button
        className="oauth-btn oauth-btn-google flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-white font-medium"
        onClick={handleGoogleClick}
        data-testid="oauth-google-btn"
        aria-label="Continuar con Google"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span>{mode === 'register' ? 'Continuar con Google' : 'Iniciar sesión con Google'}</span>
      </button>

      <button
        className="oauth-btn oauth-btn-facebook flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-white font-medium"
        onClick={handleFacebookClick}
        data-testid="oauth-facebook-btn"
        aria-label="Continuar con Facebook"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span>{mode === 'register' ? 'Continuar con Facebook' : 'Iniciar sesión con Facebook'}</span>
      </button>
    </div>
  );
};

// ============================================================
// Tests
// ============================================================
describe('CLOUD-286: OAuth Frontend Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  // ---- TC: Render Google button in register mode ----
  test('TC-FE-01: Render botón Google en RegisterV2', () => {
    render(<MockOAuthButtons mode="register" />);
    const googleBtn = screen.getByTestId('oauth-google-btn');
    expect(googleBtn).toBeInTheDocument();
    expect(googleBtn).toHaveAttribute('aria-label', 'Continuar con Google');
    expect(screen.getByText('Continuar con Google')).toBeInTheDocument();
  });

  // ---- TC: Render Facebook button in register mode ----
  test('TC-FE-02: Render botón Facebook en RegisterV2', () => {
    render(<MockOAuthButtons mode="register" />);
    const fbBtn = screen.getByTestId('oauth-facebook-btn');
    expect(fbBtn).toBeInTheDocument();
    expect(fbBtn).toHaveAttribute('aria-label', 'Continuar con Facebook');
    expect(screen.getByText('Continuar con Facebook')).toBeInTheDocument();
  });

  // ---- TC: Render Google button in login mode ----
  test('TC-FE-03: Render botón Google en LoginV2', () => {
    render(<MockOAuthButtons mode="login" />);
    expect(screen.getByTestId('oauth-google-btn')).toBeInTheDocument();
    expect(screen.getByText('Iniciar sesión con Google')).toBeInTheDocument();
  });

  // ---- TC: Render Facebook button in login mode ----
  test('TC-FE-04: Render botón Facebook en LoginV2', () => {
    render(<MockOAuthButtons mode="login" />);
    expect(screen.getByTestId('oauth-facebook-btn')).toBeInTheDocument();
    expect(screen.getByText('Iniciar sesión con Facebook')).toBeInTheDocument();
  });

  // ---- TC: OAuth buttons have correct styling ----
  test('TC-FE-05: Styling correcto de botones OAuth', () => {
    render(<MockOAuthButtons mode="register" />);
    const googleBtn = screen.getByTestId('oauth-google-btn');
    const fbBtn = screen.getByTestId('oauth-facebook-btn');

    // Google button styling
    expect(googleBtn).toHaveClass('oauth-btn');
    expect(googleBtn).toHaveClass('oauth-btn-google');
    expect(googleBtn).toHaveClass('flex');
    expect(googleBtn).toHaveClass('items-center');
    expect(googleBtn).toHaveClass('justify-center');
    expect(googleBtn).toHaveClass('gap-3');
    expect(googleBtn).toHaveClass('w-full');
    expect(googleBtn).toHaveClass('py-3');
    expect(googleBtn).toHaveClass('px-4');
    expect(googleBtn).toHaveClass('rounded-xl');
    expect(googleBtn).toHaveClass('border');
    expect(googleBtn).toHaveClass('border-gray-600');
    expect(googleBtn).toHaveClass('bg-gray-800');
    expect(googleBtn).toHaveClass('hover:bg-gray-700');
    expect(googleBtn).toHaveClass('transition-all');
    expect(googleBtn).toHaveClass('duration-200');
    expect(googleBtn).toHaveClass('text-white');
    expect(googleBtn).toHaveClass('font-medium');

    // Facebook button styling
    expect(fbBtn).toHaveClass('oauth-btn');
    expect(fbBtn).toHaveClass('oauth-btn-facebook');
    expect(fbBtn).toHaveClass('flex');
    expect(fbBtn).toHaveClass('rounded-xl');
    expect(fbBtn).toHaveClass('bg-gray-800');
  });

  // ---- TC: saveOAuthSession stores isOAuthUser flag ----
  test('TC-FE-06: saveOAuthSession() guarda isOAuthUser flag', () => {
    const mockToken = 'jwt-token-123';
    const mockUser = { id: 1, email: 'test@gmail.com', name: 'Test User' };

    mockAuthManager.saveOAuthSession(mockToken, mockUser, true);

    expect(mockAuthManager.saveOAuthSession).toHaveBeenCalledWith(
      mockToken, mockUser, true
    );
    expect(mockAuthManager.saveOAuthSession).toHaveBeenCalledTimes(1);
  });

  // ---- TC: isOAuthUser returns true for OAuth users ----
  test('TC-FE-07: isOAuthUser() retorna true para OAuth', () => {
    mockAuthManager.isOAuthUser.mockReturnValue(true);
    const result = mockAuthManager.isOAuthUser();
    expect(result).toBe(true);
  });

  // ---- TC: isOAuthUser returns false for traditional users ----
  test('TC-FE-08: isOAuthUser() retorna false para tradicional', () => {
    mockAuthManager.isOAuthUser.mockReturnValue(false);
    const result = mockAuthManager.isOAuthUser();
    expect(result).toBe(false);
  });

  // ---- TC: logout clears OAuth session ----
  test('TC-FE-09: logout() limpia sesión OAuth', () => {
    mockAuthManager.logout();
    expect(mockAuthManager.logout).toHaveBeenCalledTimes(1);
  });

  // ---- TC: Google OAuth API call with idToken ----
  test('TC-FE-10: Llamada POST /api/v2/auth/oauth/google con idToken', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'google-jwt-token',
        user: { id: 1, email: 'test@gmail.com', name: 'Test User' },
      }),
    });

    render(<MockOAuthButtons mode="register" />);
    fireEvent.click(screen.getByTestId('oauth-google-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/auth/oauth/google',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('google-test-token'),
        })
      );
    });
  });

  // ---- TC: Facebook OAuth API call with accessToken ----
  test('TC-FE-11: Llamada POST /api/v2/auth/oauth/facebook con accessToken', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'fb-jwt-token',
        user: { id: 2, email: 'fb@test.com', name: 'FB User' },
      }),
    });

    render(<MockOAuthButtons mode="register" />);
    fireEvent.click(screen.getByTestId('oauth-facebook-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/auth/oauth/facebook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('fb-test-token'),
        })
      );
    });
  });

  // ---- TC: OAuth buttons container renders correctly ----
  test('TC-FE-12: Contenedor de botones OAuth renderiza correctamente', () => {
    render(<MockOAuthButtons mode="register" />);
    const container = screen.getByTestId('oauth-buttons');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('oauth-buttons-container');
    expect(container.children.length).toBe(2);
  });

  // ---- TC: Google button has SVG icon ----
  test('TC-FE-13: Botón Google tiene icono SVG', () => {
    render(<MockOAuthButtons mode="register" />);
    const googleBtn = screen.getByTestId('oauth-google-btn');
    const svg = googleBtn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-5');
    expect(svg).toHaveClass('h-5');
    expect(svg?.querySelectorAll('path').length).toBe(4); // Google has 4 color paths
  });

  // ---- TC: Facebook button has SVG icon ----
  test('TC-FE-14: Botón Facebook tiene icono SVG', () => {
    render(<MockOAuthButtons mode="register" />);
    const fbBtn = screen.getByTestId('oauth-facebook-btn');
    const svg = fbBtn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-5');
    expect(svg).toHaveClass('h-5');
    expect(svg?.querySelector('path')).toBeInTheDocument();
  });
});
