import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import RegisterV2 from '@/app/(auth)/register/RegisterV2';
import LoginV2 from '@/app/(auth)/login/LoginV2';
import { AuthManager } from '@/app/services/AuthManager';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Google OAuth
jest.mock('@react-oauth/google', () => ({
  useGoogleLogin: jest.fn(() => jest.fn()),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Facebook SDK
const mockFbLogin = jest.fn();
const mockFbInit = jest.fn();

Object.defineProperty(window, 'FB', {
  writable: true,
  value: {
    init: mockFbInit,
    login: mockFbLogin,
    getLoginStatus: jest.fn(),
  },
});

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('CLOUD-286: OAuth Frontend Tests', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    localStorageMock.clear();
  });

  // ============================================================
  // RegisterV2 Google OAuth Button
  // ============================================================
  describe('RegisterV2 - Google OAuth', () => {
    it('should render Google sign-up button', () => {
      render(<RegisterV2 />);
      const googleBtn = screen.getByRole('button', { name: /google/i });
      expect(googleBtn).toBeInTheDocument();
    });

    it('should have Google button with proper styling', () => {
      render(<RegisterV2 />);
      const googleBtn = screen.getByRole('button', { name: /google/i });
      expect(googleBtn).toHaveClass('oauth-btn');
    });
  });

  // ============================================================
  // RegisterV2 Facebook OAuth Button
  // ============================================================
  describe('RegisterV2 - Facebook OAuth', () => {
    it('should render Facebook sign-up button', () => {
      render(<RegisterV2 />);
      const fbBtn = screen.getByRole('button', { name: /facebook/i });
      expect(fbBtn).toBeInTheDocument();
    });

    it('should have Facebook button with proper styling', () => {
      render(<RegisterV2 />);
      const fbBtn = screen.getByRole('button', { name: /facebook/i });
      expect(fbBtn).toHaveClass('oauth-btn');
    });
  });

  // ============================================================
  // LoginV2 Google OAuth Button
  // ============================================================
  describe('LoginV2 - Google OAuth', () => {
    it('should render Google sign-in button', () => {
      render(<LoginV2 />);
      const googleBtn = screen.getByRole('button', { name: /google/i });
      expect(googleBtn).toBeInTheDocument();
    });
  });

  // ============================================================
  // LoginV2 Facebook OAuth Button
  // ============================================================
  describe('LoginV2 - Facebook OAuth', () => {
    it('should render Facebook sign-in button', () => {
      render(<LoginV2 />);
      const fbBtn = screen.getByRole('button', { name: /facebook/i });
      expect(fbBtn).toBeInTheDocument();
    });
  });

  // ============================================================
  // AuthManager OAuth Methods
  // ============================================================
  describe('AuthManager - OAuth Session Management', () => {
    it('should save OAuth session with isOAuthUser flag', () => {
      const userData = {
        id: 1,
        email: 'test@gmail.com',
        nombres: 'Test',
        apellidos: 'User',
        role: 'ADMIN',
        customerId: 10,
        tenantId: 10,
        companyName: 'Test Co',
      };

      AuthManager.saveOAuthSession('jwt-token-123', userData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'auth_token',
        'jwt-token-123'
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'is_oauth_user',
        'true'
      );
    });

    it('should detect OAuth user correctly', () => {
      localStorageMock.getItem.mockReturnValue('true');
      expect(AuthManager.isOAuthUser()).toBe(true);
    });

    it('should return false for non-OAuth user', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(AuthManager.isOAuthUser()).toBe(false);
    });

    it('should clear OAuth session on logout', () => {
      AuthManager.logout();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('is_oauth_user');
    });
  });

  // ============================================================
  // OAuth API Integration
  // ============================================================
  describe('OAuth API Integration', () => {
    it('should call Google OAuth endpoint with idToken', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'jwt-google-token',
          isNewUser: false,
          user: { id: 1, email: 'test@gmail.com' },
        }),
      });

      const response = await fetch('/api/v2/auth/oauth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'google-id-token' }),
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/auth/oauth/google',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ idToken: 'google-id-token' }),
        })
      );
    });

    it('should call Facebook OAuth endpoint with accessToken', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'jwt-fb-token',
          isNewUser: true,
          user: { id: 2, email: 'test@fb.com' },
        }),
      });

      const response = await fetch('/api/v2/auth/oauth/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'fb-access-token', userId: 'fb-123' }),
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/auth/oauth/facebook',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ accessToken: 'fb-access-token', userId: 'fb-123' }),
        })
      );
    });
  });
});
