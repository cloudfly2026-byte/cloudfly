'use client';

/**
 * CLOUD-286: Facebook OAuth Callback Page
 * Handles the redirect from Facebook OAuth consent screen
 * Exchanges the authorization code for an access token via the backend
 */

import { useEffect, useState, Suspense } from 'react';
import authManager from '@/lib/authManager';

function FacebookCallbackContent() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Facebook OAuth redirect response uses query parameters
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorParam) {
          setError(errorDescription || `Error de Facebook: ${errorParam}`);
          setProcessing(false);
          setTimeout(() => { window.location.href = '/login'; }, 5000);
          return;
        }

        if (!code) {
          setError('No se recibió código de autorización de Facebook');
          setProcessing(false);
          setTimeout(() => { window.location.href = '/login'; }, 5000);
          return;
        }

        // Exchange code for access token via backend
        const response = await fetch('/api/v2/auth/oauth/facebook/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Error procesando autenticación con Facebook');
        }

        const result = await response.json();
        authManager.saveOAuthSession(result.token, result.user, true);

        // Redirect based on user state
        const user = result.user;
        if (result.isNewUser && !user.onboardingCompleted && user.role === 'ADMIN') {
          window.location.href = '/account-setup';
        } else {
          window.location.href = '/home';
        }
      } catch (err: any) {
        const message = err.message || 'Error procesando autenticación con Facebook';
        setError(message);
        setProcessing(false);

        setTimeout(() => {
          window.location.href = '/login';
        }, 5000);
      }
    };

    handleCallback();
  }, []);

  if (processing) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <svg className="animate-spin w-12 h-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Verificando con Facebook...</h2>
          <p className="text-gray-400">Por favor espera mientras completamos tu autenticación.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Error de autenticación</h2>
          <p className="text-gray-400">{error}</p>
          <p className="text-gray-500 text-sm">Redirigiendo al inicio de sesión en 5 segundos...</p>
          <a
            href="/login"
            className="inline-block mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors duration-200 font-medium"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return null;
}

export default function FacebookCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <svg className="animate-spin w-12 h-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Cargando...</h2>
        </div>
      </div>
    }>
      <FacebookCallbackContent />
    </Suspense>
  );
}
