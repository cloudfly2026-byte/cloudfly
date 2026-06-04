'use client';

/**
 * CLOUD-286: OAuth Provider Component
 * Initializes Google Identity Services and Facebook SDK dynamically
 * Renders OAuth buttons for Login and Register pages
 */

import React, { useEffect, useState, useCallback } from 'react';
import authManager from '@/lib/authManager';

// Extend Window interface for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleInitConfig) => void;
          renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
          prompt: (callback?: (notification: GooglePromptNotification) => void) => void;
        };
      };
    };
    fbAsyncInit?: () => void;
    FB?: {
      init: (config: FacebookInitConfig) => void;
      login: (callback: (response: FacebookLoginResponse) => void, config: FacebookLoginConfig) => void;
      getLoginStatus: (callback: (response: FacebookLoginResponse) => void) => void;
    };
  }
}

interface GoogleInitConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
}

interface GoogleButtonConfig {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

interface GooglePromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
  getDismissedReason: () => string;
}

interface FacebookInitConfig {
  appId: string;
  cookie: boolean;
  xfbml: boolean;
  version: string;
}

interface FacebookLoginConfig {
  scope: string;
  return_scopes: boolean;
}

interface FacebookLoginResponse {
  authResponse?: {
    accessToken: string;
    userID: string;
    expiresIn: number;
    signedRequest: string;
    graphDomain: string;
    data_access_expiration_time: number;
  };
  status: 'connected' | 'not_authorized' | 'unknown';
}

interface OAuthProviderProps {
  mode: 'login' | 'register';
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

const OAuthProvider: React.FC<OAuthProviderProps> = ({ mode, onError, onSuccess }) => {
  const [googleReady, setGoogleReady] = useState(false);
  const [facebookReady, setFacebookReady] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';

  // ============================================================
  // Initialize Google Identity Services
  // ============================================================
  useEffect(() => {
    if (!googleClientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          auto_select: false,
        });
        setGoogleReady(true);
      }
    };
    script.onerror = () => {
      onError?.('Error al cargar Google Identity Services');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup not needed for GSI script
    };
  }, [googleClientId]);

  // ============================================================
  // Initialize Facebook SDK
  // ============================================================
  useEffect(() => {
    if (!facebookAppId) return;

    // Set up fbAsyncInit
    window.fbAsyncInit = () => {
      if (window.FB) {
        window.FB.init({
          appId: facebookAppId,
          cookie: true,
          xfbml: true,
          version: 'v18.0',
        });
        setFacebookReady(true);
      }
    };

    // Load Facebook SDK
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      onError?.('Error al cargar Facebook SDK');
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
    };
  }, [facebookAppId]);

  // ============================================================
  // Google OAuth Handler
  // ============================================================
  const handleGoogleResponse = useCallback(async (response: GoogleCredentialResponse) => {
    setLoading('google');
    try {
      const result = await authManager.loginWithGoogle(response.credential);

      // Redirect based on user state
      const user = result.user;
      if (!user.onboardingCompleted && user.role === 'ADMIN') {
        window.location.href = '/account-setup';
      } else {
        window.location.href = '/home';
      }

      onSuccess?.();
    } catch (error: any) {
      const message = error.message || 'Error de autenticación con Google';
      onError?.(message);
    } finally {
      setLoading(null);
    }
  }, [onError, onSuccess]);

  const handleGoogleClick = useCallback(() => {
    if (!window.google) {
      onError?.('Google Identity Services no está disponible');
      return;
    }

    // Use the One Tap prompt for login, or render button for register
    if (mode === 'login') {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason();
          if (reason === 'opt_out_or_no_session' || reason === 'secure_http_required') {
            // Fallback: redirect to Google OAuth
            fallbackGoogleOAuth();
          } else {
            onError?.(`Google One Tap no disponible: ${reason}`);
          }
        } else if (notification.isSkippedMoment()) {
          onError?.('Autenticación con Google cancelada');
        } else if (notification.isDismissedMoment()) {
          // User dismissed, no action needed
        }
      });
    } else {
      // For register, use prompt as well
      window.google.accounts.id.prompt();
    }
  }, [mode, onError]);

  const fallbackGoogleOAuth = () => {
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback/google`);
    const scope = encodeURIComponent('openid email profile');
    const state = mode === 'register' ? 'register' : 'login';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&state=${state}`;
    window.location.href = authUrl;
  };

  // ============================================================
  // Facebook OAuth Handler
  // ============================================================
  const handleFacebookClick = useCallback(() => {
    if (!window.FB) {
      onError?.('Facebook SDK no está disponible');
      return;
    }

    setLoading('facebook');

    window.FB.login(
      async (response: FacebookLoginResponse) => {
        if (response.status === 'connected' && response.authResponse) {
          try {
            const result = await authManager.loginWithFacebook(response.authResponse.accessToken);

            // Redirect based on user state
            const user = result.user;
            if (!user.onboardingCompleted && user.role === 'ADMIN') {
              window.location.href = '/account-setup';
            } else {
              window.location.href = '/home';
            }

            onSuccess?.();
          } catch (error: any) {
            const message = error.message || 'Error de autenticación con Facebook';
            onError?.(message);
          }
        } else if (response.status === 'not_authorized') {
          onError?.('Permisos de Facebook denegados');
        } else {
          onError?.('Autenticación con Facebook cancelada por el usuario');
        }
        setLoading(null);
      },
      {
        scope: 'email,public_profile',
        return_scopes: true,
      }
    );
  }, [onError, onSuccess]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="oauth-buttons-wrapper space-y-3">
      {/* Divider */}
      <div className="relative flex items-center my-6">
        <div className="flex-grow border-t border-gray-600/50"></div>
        <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">
          o {mode === 'register' ? 'regístrate' : 'inicia sesión'} con
        </span>
        <div className="flex-grow border-t border-gray-600/50"></div>
      </div>

      {/* OAuth Buttons Container */}
      <div className="oauth-buttons-container space-y-3">
        {/* Google Button */}
        <button
          type="button"
          className={`
            oauth-btn oauth-btn-google
            flex items-center justify-center gap-3 w-full
            py-3 px-4 rounded-xl
            border border-gray-600/60
            bg-gray-800/80 hover:bg-gray-700/90
            transition-all duration-200 ease-in-out
            text-white font-medium text-sm
            hover:border-gray-500 hover:shadow-lg hover:shadow-blue-500/10
            active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${loading === 'google' ? 'animate-pulse' : ''}
          `}
          onClick={handleGoogleClick}
          disabled={loading !== null}
          aria-label="Continuar con Google"
        >
          {loading === 'google' ? (
            <svg className="animate-spin w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>
            {loading === 'google'
              ? 'Conectando...'
              : mode === 'register'
                ? 'Continuar con Google'
                : 'Iniciar sesión con Google'}
          </span>
        </button>

        {/* Facebook Button */}
        <button
          type="button"
          className={`
            oauth-btn oauth-btn-facebook
            flex items-center justify-center gap-3 w-full
            py-3 px-4 rounded-xl
            border border-gray-600/60
            bg-gray-800/80 hover:bg-gray-700/90
            transition-all duration-200 ease-in-out
            text-white font-medium text-sm
            hover:border-gray-500 hover:shadow-lg hover:shadow-blue-600/10
            active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${loading === 'facebook' ? 'animate-pulse' : ''}
          `}
          onClick={handleFacebookClick}
          disabled={loading !== null}
          aria-label="Continuar con Facebook"
        >
          {loading === 'facebook' ? (
            <svg className="animate-spin w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )}
          <span>
            {loading === 'facebook'
              ? 'Conectando...'
              : mode === 'register'
                ? 'Continuar con Facebook'
                : 'Iniciar sesión con Facebook'}
          </span>
        </button>
      </div>

      {/* Status indicators (hidden, for accessibility) */}
      <div className="sr-only" role="status" aria-live="polite">
        {loading && `Autenticando con ${loading}...`}
        {!loading && !googleReady && !facebookReady && 'Cargando proveedores OAuth...'}
      </div>
    </div>
  );
};

export default OAuthProvider;
