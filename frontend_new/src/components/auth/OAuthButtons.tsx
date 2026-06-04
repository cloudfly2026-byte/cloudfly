'use client';

/**
 * CLOUD-286: Standalone OAuth Buttons Component
 * Lightweight version that can be embedded in any form
 * Uses AuthManager for API calls
 */

import React, { useState, useCallback } from 'react';
import authManager from '@/lib/authManager';

interface OAuthButtonsProps {
  mode: 'login' | 'register';
  onError?: (error: string) => void;
  className?: string;
}

const OAuthButtons: React.FC<OAuthButtonsProps> = ({ mode, onError, className = '' }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGoogleClick = useCallback(async () => {
    setLoading('google');
    try {
      // For Google, we use the GIS One Tap flow
      // The actual token handling is done via the callback page
      const redirectUri = `${window.location.origin}/oauth/callback/google`;
      const state = mode;
      const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      if (!googleClientId) {
        onError?.('Google Client ID no configurado');
        setLoading(null);
        return;
      }

      // Use Google Identity Services if available
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback: redirect flow
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent('openid email profile')}&state=${state}`;
            window.location.href = authUrl;
          }
          setLoading(null);
        });
      } else {
        // Fallback: redirect flow
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent('openid email profile')}&state=${state}`;
        window.location.href = authUrl;
      }
    } catch (error: any) {
      onError?.(error.message || 'Error iniciando autenticación con Google');
      setLoading(null);
    }
  }, [mode, onError]);

  const handleFacebookClick = useCallback(async () => {
    setLoading('facebook');
    try {
      const redirectUri = `${window.location.origin}/oauth/callback/facebook`;
      const state = mode;
      const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

      if (!facebookAppId) {
        onError?.('Facebook App ID no configurado');
        setLoading(null);
        return;
      }

      // Use Facebook SDK if available
      if (window.FB) {
        window.FB.login(
          (response) => {
            if (response.status === 'connected' && response.authResponse) {
              // Send access token to backend
              authManager.loginWithFacebook(response.authResponse.accessToken)
                .then((result) => {
                  const user = result.user;
                  if (!user.onboardingCompleted && user.role === 'ADMIN') {
                    window.location.href = '/account-setup';
                  } else {
                    window.location.href = '/home';
                  }
                })
                .catch((err) => {
                  onError?.(err.message || 'Error de autenticación con Facebook');
                });
            } else {
              onError?.('Autenticación con Facebook cancelada');
            }
            setLoading(null);
          },
          { scope: 'email,public_profile', return_scopes: true }
        );
      } else {
        // Fallback: redirect flow
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=email,public_profile`;
        window.location.href = authUrl;
      }
    } catch (error: any) {
      onError?.(error.message || 'Error iniciando autenticación con Facebook');
      setLoading(null);
    }
  }, [mode, onError]);

  return (
    <div className={`oauth-buttons-wrapper ${className}`}>
      {/* Divider */}
      <div className="relative flex items-center my-6">
        <div className="flex-grow border-t border-gray-600/50"></div>
        <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">
          o {mode === 'register' ? 'regístrate' : 'inicia sesión'} con
        </span>
        <div className="flex-grow border-t border-gray-600/50"></div>
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        {/* Google */}
        <button
          type="button"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-600/60 bg-gray-800/80 hover:bg-gray-700/90 transition-all duration-200 text-white font-medium text-sm hover:border-gray-500 hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleGoogleClick}
          disabled={loading !== null}
          aria-label="Continuar con Google"
        >
          {loading === 'google' ? (
            <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

        {/* Facebook */}
        <button
          type="button"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-600/60 bg-gray-800/80 hover:bg-gray-700/90 transition-all duration-200 text-white font-medium text-sm hover:border-gray-500 hover:shadow-lg hover:shadow-blue-600/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleFacebookClick}
          disabled={loading !== null}
          aria-label="Continuar con Facebook"
        >
          {loading === 'facebook' ? (
            <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    </div>
  );
};

export default OAuthButtons;
