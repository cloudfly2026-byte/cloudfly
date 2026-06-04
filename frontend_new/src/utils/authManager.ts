import axios from 'axios'
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export const AuthManager = {
  get API_URL() {
    return `${API_BASE_URL}/auth/login`
  },

  async authorize(data: { username: string; password: string }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log(response.data)

      // ESTANDARIZADO: usar 'jwt'
      localStorage.setItem('jwt', response.data.jwt)
      localStorage.setItem('userData', JSON.stringify(response.data.user))

      // LOG PARA VERIFICACIÓN DE TENANT/COMPANY
      const decoded: any = jwtDecode(response.data.jwt)
      console.log('🔑 [AUTH] Token decodificado:', decoded)
      console.log('🏢 [AUTH] Company ID extraído del token:', decoded.company_id)
      
      if (response.data.user && response.data.user.activeCompanyId) {
        console.log('✅ [AUTH] activeCompanyId guardado en localStorage:', response.data.user.activeCompanyId)
        localStorage.setItem('activeCompanyId', response.data.user.activeCompanyId.toString())
      }

      return response.data
    } catch (error) {
      console.error('Error durante la autenticación:', error)
      throw error
    }
  },

  async register(data: { username: string; password: string; email: string; roles: string[] }) {
    try {
      const token = localStorage.getItem('jwt')
      const headers: any = {
        'Content-Type': 'application/json'
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await axios.post(`${API_BASE_URL}/auth/register`, data, { headers })

      // Solo guardar si vienen en la respuesta (el login los trae, el registro básico tal vez no)
      if (response.data.jwt) {
        localStorage.setItem('jwt', response.data.jwt)
      }
      if (response.data.user) {
        localStorage.setItem('userData', JSON.stringify(response.data.user))
      }

      return response.data
    } catch (error) {
      console.error('Error durante el registro:', error)
      throw error
    }
  },

  async validateUsername(data: { username: string }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/validate-username`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return response.data
    } catch (error) {
      console.error('Error durante la validación del username:', error)
      throw error
    }
  },

  async validateAccount(data: { validationToken: string }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/validate-account`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return true
    } catch (error) {
      console.error('Error durante la validación de la cuenta:', error)
      throw error
    }
  },

  async validateEmail(data: { email: string }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/validate-email`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return response.data
    } catch (error) {
      console.error('Error durante la validación del email:', error)
      throw error
    }
  },

  async logout() {
    try {
      // ESTANDARIZADO: limpiar 'jwt'
      localStorage.removeItem('jwt')
      localStorage.removeItem('userData')
      localStorage.removeItem('isOAuthUser')
    } catch (error: any) {
      console.log(error)
    }
  },

  async validateToken() {
    try {
      // ESTANDARIZADO: usar 'jwt'
      const token = localStorage.getItem('jwt')

      if (!token) {
        console.error('Token no encontrado')

        return false
      }

      const decodedToken: any = jwtDecode(token)
      const expirationDate = new Date(decodedToken.exp * 1000)
      const currentDate = new Date()

      if (expirationDate < currentDate) {
        console.error('Token expirado')

        return false
      }

      return true
    } catch (error) {
      console.error('Error durante la validación del token:', error)

      return false
    }
  },

  async forgotPassword(data: { email: string }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return response.data
    } catch (error) {
      console.error('Error durante la solicitud de recuperación:', error)
      throw error
    }
  },

  async resetPassword(data: any) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        newPassword: data.newPassword,
        token: data.token
      })

      return response.data
    } catch (error) {
      console.error('Error durante el reseteo de la contraseña:', error)
      throw error
    }
  },

  // ============================================================
  // CLOUD-283: OAuth Session Management
  // ============================================================

  /**
   * Save OAuth session data after successful Google/Facebook login.
   * Stores JWT, user data, and OAuth flag in localStorage.
   */
  saveOAuthSession(jwt: string, userData: any) {
    try {
      localStorage.setItem('jwt', jwt)
      localStorage.setItem('userData', JSON.stringify(userData))
      localStorage.setItem('isOAuthUser', 'true')

      if (userData && userData.activeCompanyId) {
        localStorage.setItem('activeCompanyId', userData.activeCompanyId.toString())
      }

      const decoded: any = jwtDecode(jwt)
      console.log('🔑 [OAUTH] Token decodificado:', decoded)
      console.log('🏢 [OAUTH] Company ID extraído del token:', decoded.company_id)
      console.log('✅ [OAUTH] Sesión OAuth guardada exitosamente')
    } catch (error) {
      console.error('❌ [OAUTH] Error guardando sesión OAuth:', error)
      throw error
    }
  },

  /**
   * Check if the current user authenticated via OAuth.
   */
  isOAuthUser(): boolean {
    return localStorage.getItem('isOAuthUser') === 'true'
  },

  /**
   * Fetch Google Client ID dynamically from the backend config endpoint.
   */
  async getGoogleClientId(): Promise<string> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v2/auth/oauth/google/config`)
      return response.data.clientId || ''
    } catch (error) {
      console.error('❌ [OAUTH] Error fetching Google Client ID:', error)
      return ''
    }
  },

  /**
   * Fetch Facebook App ID dynamically from the backend config endpoint.
   */
  async getFacebookAppId(): Promise<string> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v2/auth/oauth/facebook/config`)
      return response.data.appId || ''
    } catch (error) {
      console.error('❌ [OAUTH] Error fetching Facebook App ID:', error)
      return ''
    }
  },

  /**
   * CLOUD-281: Login with Google OAuth.
   * Sends the Google ID token credential to the backend.
   */
  async loginWithGoogle(credential: string) {
    try {
      console.log('🔐 [GOOGLE-OAUTH] Enviando credencial al backend...')

      const response = await axios.post(`${API_BASE_URL}/api/v2/auth/oauth/google`, {
        credential: credential,
        provider: 'GOOGLE'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.data.status && response.data.jwt) {
        this.saveOAuthSession(response.data.jwt, response.data.user)
        console.log('✅ [GOOGLE-OAUTH] Login exitoso:', response.data)
      }

      return response.data
    } catch (error: any) {
      console.error('❌ [GOOGLE-OAUTH] Error:', error.response?.data?.message || error.message)
      throw error
    }
  },

  /**
   * CLOUD-282: Login with Facebook OAuth.
   * Sends the Facebook access token and user ID to the backend.
   */
  async loginWithFacebook(accessToken: string, userId: string) {
    try {
      console.log('🔐 [FACEBOOK-OAUTH] Enviando access token al backend...')

      const response = await axios.post(`${API_BASE_URL}/api/v2/auth/oauth/facebook`, {
        credential: accessToken,
        userId: userId,
        provider: 'FACEBOOK'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.data.status && response.data.jwt) {
        this.saveOAuthSession(response.data.jwt, response.data.user)
        console.log('✅ [FACEBOOK-OAUTH] Login exitoso:', response.data)
      }

      return response.data
    } catch (error: any) {
      console.error('❌ [FACEBOOK-OAUTH] Error:', error.response?.data?.message || error.message)
      throw error
    }
  }
}
