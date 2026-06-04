'use client';

/**
 * CLOUD-286: Google OAuth Callback Page
 * Handles the redirect from Google OAuth consent screen
 * Extracts the ID token from the URL fragment and sends it to the backend
 */

import { useEffect, useState, Suspense } from 'react';
import authManager from '@/lib/authManager';

function GoogleCallbackContent() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Google OAuth redirect response is in the URL fragment (#)
        const hash = window.location.hash;
        if (!hash) {
          setError('No se recibió respuesta de Google');
          setProcessing(false);
          return;
        }

        // Parse the fragment
        const params = new URLSearchParams(hash.substring(1));
        const credential = params.get('credential'); // JWT ID token from Google
        const state = params.get('state');

        if (!credential) {
          setError('Token de Google no recibido');
          setProcessing(false);
          return;
        }

        // Send to backend for validation
        const result = await authManager.loginWithGoogle(credential);

        // Redirect based on user state
        const user = result.user;
        if (result.isNewUser && !user.onboardingCompleted && user.role === 'ADMIN') {
          window.location.href = '/account-setup';
        } else {
          window.location.href = '/home';
        }
      } catch (err: any) {
        const message = err.message || 'Error procesando autenticación con Google';
        setError(message);
        setProcessing(false);

        // Redirect back to login after 5 seconds
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
            <svg className="animate-spin w-12 h-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Verificando con Google...</h2>
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

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <svg className="animate-spin w-12 h-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Cargando...</h2>
        </div>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
