'use client'

import { useEffect, ReactNode } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (element: HTMLElement, config: any) => void
          prompt: () => void
        }
      }
    }
    fbAsyncInit?: () => void
    FB?: {
      init: (params: any) => void
      login: (callback: (response: any) => void, params: any) => void
      getLoginStatus: (callback: (response: any) => void) => void
    }
  }
}

interface OAuthProviderProps {
  children: ReactNode
  onGoogleSuccess?: (credential: string) => void
  onGoogleError?: (error: any) => void
  onFacebookSuccess?: (accessToken: string, userId: string) => void
  onFacebookError?: (error: any) => void
}

/**
 * CLOUD-281/CLOUD-282: OAuth Provider Component
 * Initializes Google Identity Services and Facebook SDK.
 * Provides callback handlers for OAuth success/error events.
 */
export default function OAuthProvider({
  children,
  onGoogleSuccess,
  onGoogleError,
  onFacebookSuccess,
  onFacebookError
}: OAuthProviderProps) {

  useEffect(() => {
    // ============================================================
    // CLOUD-281: Initialize Google Identity Services
    // ============================================================
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

        if (!googleClientId) {
          console.warn('⚠️ [OAUTH] NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured')
          return
        }

        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response: any) => {
              console.log('✅ [GOOGLE-OAUTH] Credential received')
              if (onGoogleSuccess && response.credential) {
                onGoogleSuccess(response.credential)
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          })
          console.log('✅ [GOUTH] Google Identity Services initialized')
        } catch (error) {
          console.error('❌ [GOOGLE-OAUTH] Initialization error:', error)
          onGoogleError?.(error)
        }
      } else {
        console.warn('⚠️ [GOOGLE-OAUTH] Google Identity Services not loaded yet')
      }
    }

    // ============================================================
    // CLOUD-282: Initialize Facebook SDK
    // ============================================================
    const initFacebook = () => {
      const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || ''

      if (!facebookAppId) {
        console.warn('⚠️ [OAUTH] NEXT_PUBLIC_FACEBOOK_APP_ID not configured')
        return
      }

      // Set up the Facebook SDK async init
      window.fbAsyncInit = () => {
        if (window.FB) {
          window.FB.init({
            appId: facebookAppId,
            cookie: true,
            xfbml: true,
            version: 'v19.0'
          })
          console.log('✅ [FACEBOOK-OAUTH] Facebook SDK initialized')
        }
      }

      // Load Facebook SDK script
      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script')
        script.id = 'facebook-jssdk'
        script.src = 'https://connect.facebook.net/en_US/sdk.js'
        script.async = true
        script.defer = true
        script.crossOrigin = 'anonymous'
        script.onload = () => {
          console.log('✅ [FACEBOOK-OAUTH] Facebook SDK script loaded')
        }
        script.onerror = (error) => {
          console.error('❌ [FACEBOOK-OAUTH] Failed to load Facebook SDK:', error)
          onFacebookError?.(error)
        }
        document.body.appendChild(script)
      }
    }

    // Initialize both providers
    initGoogle()
    initFacebook()

    // Re-initialize Google if script loads after component mounts
    const timer = setTimeout(() => {
      if (!window.google?.accounts?.id) {
        initGoogle()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [onGoogleSuccess, onGoogleError, onFacebookSuccess, onFacebookError])

  return <>{children}</>
}

/**
 * CLOUD-282: Trigger Facebook Login popup.
 * Can be called from any component after SDK is initialized.
 */
export function triggerFacebookLogin(
  onSuccess: (accessToken: string, userId: string) => void,
  onError: (error: any) => void
) {
  if (!window.FB) {
    console.error('❌ [FACEBOOK-OAUTH] Facebook SDK not initialized')
    onError(new Error('Facebook SDK not initialized'))
    return
  }

  window.FB.login((response: any) => {
    if (response.authResponse) {
      console.log('✅ [FACEBOOK-OAUTH] Login successful')
      onSuccess(response.authResponse.accessToken, response.authResponse.userID)
    } else {
      console.warn('⚠️ [FACEBOOK-OAUTH] User cancelled login or did not fully authorize')
      onError(new Error('Facebook login cancelled or not authorized'))
    }
  }, { scope: 'email,public_profile' })
}
