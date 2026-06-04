'use client'

// React Imports
import { useEffect, useState, useCallback } from 'react'

// Next Imports
import { useRouter, useSearchParams } from 'next/navigation'

import { signIn, getSession } from 'next-auth/react'

// React Hook Form
import { useForm } from 'react-hook-form'

// MUI Imports
import useMediaQuery from '@mui/material/useMediaQuery'
import { styled, useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import CheckIcon from '@mui/icons-material/Check'
import DangerousIcon from '@mui/icons-material/Dangerous'

// Classnames and Utils
import classnames from 'classnames'

import { Alert } from '@mui/material'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'
import type { SystemMode } from '@/@core/types'

// CLOUD-281/CLOUD-282: OAuth imports
import { AuthManager } from '@/utils/authManager'
import { triggerFacebookLogin } from '@/components/OAuthProvider'

// Styled Custom Components
const MaskImg = styled('img')({
  blockSize: 'auto',
  maxBlockSize: 355,
  inlineSize: '100%',
  position: 'absolute',
  insetBlockEnd: 0,
  zIndex: -1
})

interface FormInputs {
  username: string
  password: string
  remember: boolean
}

const LoginV2 = ({ mode }: { mode: SystemMode }) => {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormInputs>()

  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  useEffect(() => { setDisabled(false) }, [])

  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const { settings } = useSettings()
  const theme = useTheme()
  const hidden = useMediaQuery(theme.breakpoints.down('md'))

  const authBackground = useImageVariant(mode, '/images/pages/auth-mask-light.png', '/images/pages/auth-mask-dark.png')

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  // ============================================================
  // CLOUD-281: Google OAuth Handler for Login
  // ============================================================
  const handleGoogleOAuth = useCallback(async () => {
    setOauthLoading('google')
    setError(null)

    let googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    if (!googleClientId || googleClientId.includes('your-google-client-id')) {
      googleClientId = await AuthManager.getGoogleClientId()
    }

    // @ts-ignore
    if (window.google?.accounts?.id) {
      // @ts-ignore
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.warn('⚠️ [GOOGLE-OAUTH] One Tap not displayed, using redirect flow')
          if (googleClientId) {
            const redirectUri = encodeURIComponent(window.location.origin + '/login')
            const scope = encodeURIComponent('openid email profile')
            const nonce = Math.random().toString(36).substring(2)
            window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=${scope}&nonce=${nonce}&include_granted_scopes=true`
          } else {
            setError('Google OAuth no está configurado. Por favor, contacta al administrador.')
            setOauthLoading(null)
          }
        }
      })
    } else {
      console.warn('⚠️ [GOOGLE-OAUTH] Google Identity Services not loaded, using redirect flow')
      if (googleClientId) {
        const redirectUri = encodeURIComponent(window.location.origin + '/login')
        const scope = encodeURIComponent('openid email profile')
        const nonce = Math.random().toString(36).substring(2)
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=${scope}&nonce=${nonce}&include_granted_scopes=true`
      } else {
        setError('Google OAuth no está configurado. Por favor, contacta al administrador.')
        setOauthLoading(null)
      }
    }
  }, [])

  /**
   * Handle Google credential response for login.
   */
  const handleGoogleCredentialResponse = useCallback(async (credential: string) => {
    try {
      setOauthLoading('google')
      setError(null)

      const response = await AuthManager.loginWithGoogle(credential)

      if (response.status) {
        setSuccess(true)

        // Redirect based on user state
        const user = response.user
        if (user && !user.onboardingCompleted) {
          router.push('/account-setup')
        } else if (callbackUrl) {
          router.push(callbackUrl)
        } else {
          router.push('/home')
        }
      } else {
        setError(response.message || 'Error en autenticación con Google')
      }
    } catch (err: any) {
      console.error('❌ [GOOGLE-OAUTH] Error:', err)
      setError(err.response?.data?.message || 'Error en autenticación con Google')
    } finally {
      setOauthLoading(null)
    }
  }, [router, callbackUrl])

  // ============================================================
  // CLOUD-282: Facebook OAuth Handler for Login
  // ============================================================
  const handleFacebookOAuth = useCallback(() => {
    setOauthLoading('facebook')
    setError(null)

    triggerFacebookLogin(
      async (accessToken: string, userId: string) => {
        try {
          const response = await AuthManager.loginWithFacebook(accessToken, userId)

          if (response.status) {
            setSuccess(true)

            // Redirect based on user state
            const user = response.user
            if (user && !user.onboardingCompleted) {
              router.push('/account-setup')
            } else if (callbackUrl) {
              router.push(callbackUrl)
            } else {
              router.push('/home')
            }
          } else {
            setError(response.message || 'Error en autenticación con Facebook')
          }
        } catch (err: any) {
          console.error('❌ [FACEBOOK-OAUTH] Error:', err)
          setError(err.response?.data?.message || 'Error en autenticación con Facebook')
        } finally {
          setOauthLoading(null)
        }
      },
      (err) => {
        console.error('❌ [FACEBOOK-OAUTH] Login failed:', err)
        setError('Error en autenticación con Facebook: ' + (err.message || 'Cancelado por el usuario'))
        setOauthLoading(null)
      }
    )
  }, [router, callbackUrl])

  // ============================================================
  // Set up global Google callback and check for redirect response
  // ============================================================
  useEffect(() => {
    // @ts-ignore
    window.handleGoogleCredentialResponse = handleGoogleCredentialResponse

    // Check for OAuth redirect response (id_token in URL hash)
    const hash = window.location.hash
    if (hash && hash.includes('id_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const idToken = params.get('id_token')
      if (idToken) {
        setOauthLoading('google')
        AuthManager.loginWithGoogle(idToken)
          .then((response) => {
            if (response.status) {
              setSuccess(true)
              const user = response.user
              if (user && !user.onboardingCompleted) {
                router.push('/account-setup')
              } else if (callbackUrl) {
                router.push(callbackUrl)
              } else {
                router.push('/home')
              }
            } else {
              setError(response.message || 'Error al iniciar sesión con Google')
            }
          })
          .catch(err => {
            console.error('❌ [GOOGLE-OAUTH] Redirect flow error:', err)
            setError('Error procesando respuesta de Google')
          })
          .finally(() => {
            setOauthLoading(null)
          })
        window.location.hash = ''
      }
    }

    return () => {
      // @ts-ignore
      delete window.handleGoogleCredentialResponse
    }
  }, [handleGoogleCredentialResponse, router, callbackUrl])

  const onSubmit = async (data: FormInputs) => {
    try {
      setDisabled(true)

      const result = await signIn('credentials', {
        redirect: false,
        username: data.username,
        password: data.password
      })

      if (result?.error) {
        setError('Error de autenticación: credenciales inválidas')
        setSuccess(false)
        setDisabled(false)

        return
      }

      // Obtener datos del usuario desde la sesión de NextAuth
      const session = await getSession()
      const user = session?.user as any
      const jwt = (session as any)?.accessToken

      if (jwt && user) {
        localStorage.setItem('jwt', jwt)
        localStorage.setItem('userData', JSON.stringify(user))

        if (user.activeCompanyId) {
          localStorage.setItem('activeCompanyId', user.activeCompanyId.toString())
        }

        if (!user?.enabled && user?.verificationToken != null && user?.verificationToken !== '') {
          router.push('/verify-email')

          return false
        } else {
          setSuccess(true)
          setError(null)

          // Redirección inteligente por roles y callbackUrl
          const roles = user?.roles || []
          const hasRole = (role: string) => roles.some((r: any) => (r.name || r.role) === role)

          // Regla 1: Administradores de la Plataforma (Bypass de cliente)
          if (hasRole('MANAGER') || hasRole('SUPERADMIN')) {
            if (callbackUrl) {
              router.push(callbackUrl)
            } else {
              router.push('/home')
            }

            return true
          }

          // Regla 2: Dueños de Negocio (ADMIN) - Deben completar onboarding
          if (hasRole('ADMIN')) {
            if (!user?.customer || !user.onboardingCompleted) {
              console.log('🚧 [LOGIN] ADMIN onboarding incomplete. Redirecting to /account-setup')
              router.push('/account-setup')
            } else if (callbackUrl) {
              router.push(callbackUrl)
            } else {
              router.push('/home')
            }

            return true
          }

          // Regla 3: Colaboradores / Usuarios (USER, BIOMEDICAL, BIOEDICAL)
          if (hasRole('USER') || hasRole('BIOMEDICAL') || hasRole('BIOEDICAL')) {
            if (callbackUrl) {
              router.push(callbackUrl)
            } else {
              router.push('/accounts/user/view')
            }

            return true
          }

          // Regla 4: Fallback
          if (callbackUrl) {
            router.push(callbackUrl)
          } else {
            router.push('/home')
          }

          return true
        }
      } else {
        setError('Error al obtener la sesión de usuario')
        setSuccess(false)
        setDisabled(false)
      }
    } catch (error: any) {
      console.error('Error during login:', error.response?.data?.message || error.message)
      setError(error.response?.data?.message || 'Error de autenticación')
      setSuccess(false)
      setDisabled(false)
    }
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full flex-1 min-bs-[100dvh] relative max-md:hidden',
          { 'border-ie': settings.skin === 'bordered' }
        )}
      >
        <div className='m-auto w-full max-w-4xl ps-10 pe-6 flex flex-col gap-8'>
          {/* Hero Section */}
          <div className='text-left'>
            <div className='inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4'>
              <i className='tabler-trending-up text-xl' />
              <Typography variant='body2' className='font-semibold'>
                💼 Accede a tu panel de control
              </Typography>
            </div>

            <Typography variant='h2' component='h1' className='mb-3 font-bold leading-tight'>
              Bienvenido de vuelta a <span className='text-primary'>CloudFly</span>
            </Typography>

            <Typography variant='h6' className='text-textSecondary font-normal mb-6'>
              Gestiona tu negocio con IA, automatiza procesos y toma decisiones basadas en datos en tiempo real.
            </Typography>
          </div>

          {/* Stats Grid */}
          <div className='grid gap-6 lg:grid-cols-3'>
            <div className='bg-backgroundPaper rounded-2xl p-6 border border-divider'>
              <div className='flex items-center gap-4 mb-3'>
                <div className='w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center'>
                  <i className='tabler-robot text-2xl text-success' />
                </div>
                <div>
                  <Typography variant='h4' className='font-bold'>24/7</Typography>
                  <Typography variant='caption' className='text-textSecondary'>Atención automatizada</Typography>
                </div>
              </div>
            </div>

            <div className='bg-backgroundPaper rounded-2xl p-6 border border-divider'>
              <div className='flex items-center gap-4 mb-3'>
                <div className='w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center'>
                  <i className='tabler-chart-line text-2xl text-warning' />
                </div>
                <div>
                  <Typography variant='h4' className='font-bold'>+300%</Typography>
                  <Typography variant='caption' className='text-textSecondary'>Más conversiones</Typography>
                </div>
              </div>
            </div>

            <div className='bg-backgroundPaper rounded-2xl p-6 border border-divider'>
              <div className='flex items-center gap-4 mb-3'>
                <div className='w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center'>
                  <i className='tabler-users text-2xl text-info' />
                </div>
                <div>
                  <Typography variant='h4' className='font-bold'>10K+</Typography>
                  <Typography variant='caption' className='text-textSecondary'>Empresas activas</Typography>
                </div>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className='bg-backgroundPaper rounded-2xl p-6 border border-divider'>
            <Typography variant='h6' className='mb-4 font-semibold'>
              ✨ Lo que puedes hacer hoy:
            </Typography>
            <div className='grid gap-3'>
              <div className='flex items-center gap-3'>
                <i className='tabler-check text-success text-xl' />
                <Typography variant='body2' className='text-textSecondary'>
                  Ver tus métricas de ventas y conversión en tiempo real
                </Typography>
              </div>
              <div className='flex items-center gap-3'>
                <i className='tabler-check text-success text-xl' />
                <Typography variant='body2' className='text-textSecondary'>
                  Configurar tu chatbot IA en 5 minutos
                </Typography>
              </div>
              <div className='flex items-center gap-3'>
                <i className='tabler-check text-success text-xl' />
                <Typography variant='body2' className='text-textSecondary'>
                  Automatizar respuestas y seguimiento de clientes
                </Typography>
              </div>
            </div>
          </div>
        </div>

        {!hidden && (
          <MaskImg
            alt='mask'
            src={authBackground}
            className={classnames({ 'scale-x-[-1]': theme.direction === 'rtl' })}
          />
        )}
      </div>

      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <Link className='absolute block-start-5 sm:block-start-[33px] inline-start-6 sm:inline-start-[38px]'>
          <Logo />
        </Link>

        <div className='flex flex-col gap-6 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-11 sm:mbs-14 md:mbs-0'>
          {/* Header mejorado */}
          <div className='flex flex-col gap-2 text-center'>
            <div className='inline-flex items-center justify-center w-16 h-16 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20'>
              <i className='tabler-login text-4xl text-primary' />
            </div>
            <Typography variant='h4' className='font-bold'>
              ¡Bienvenido de vuelta! 👋
            </Typography>
            <Typography variant='body2' className='text-textSecondary'>
              Ingresa a tu cuenta y continúa automatizando tu negocio
            </Typography>
          </div>

          {success && (
            <Alert
              icon={<CheckIcon fontSize='inherit' />}
              severity='success'
              className='rounded-xl'
            >
              ✅ Acceso concedido. Redirigiendo...
            </Alert>
          )}

          {error && (
            <Alert
              icon={<DangerousIcon fontSize='inherit' />}
              severity='error'
              className='rounded-xl'
            >
              {error}
            </Alert>
          )}

          <form noValidate autoComplete='off' onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-5'>
            <CustomTextField
              fullWidth
              label='Nombre de usuario'
              placeholder='juanperez123'
              error={!!errors.username}
              helperText={errors.username?.message}
              {...register('username', { required: 'El nombre de usuario es requerido' })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='tabler-user text-textSecondary' />
                  </InputAdornment>
                )
              }}
            />

            <CustomTextField
              fullWidth
              label='Contraseña'
              placeholder='Ingresa tu contraseña'
              type={isPasswordShown ? 'text' : 'password'}
              error={!!errors.password}
              helperText={errors.password?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='tabler-lock text-textSecondary' />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position='end'>
                    <IconButton edge='end' onClick={handleClickShowPassword} onMouseDown={e => e.preventDefault()}>
                      <i className={isPasswordShown ? 'tabler-eye-off' : 'tabler-eye'} />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              {...register('password', { required: 'La contraseña es requerida' })}
            />

            <div className='flex justify-between items-center gap-x-3 gap-y-1 flex-wrap'>
              <FormControlLabel
                control={<Checkbox {...register('remember')} defaultChecked />}
                label={<Typography variant='body2'>Recordarme</Typography>}
              />
              <Typography
                variant='body2'
                className='text-primary font-semibold hover:underline'
                component={Link}
                href='/recover-password'
              >
                ¿Olvidaste tu contraseña?
              </Typography>
            </div>

            <Button
              fullWidth
              variant='contained'
              type='submit'
              disabled={disabled}
              size='large'
              className='py-3 font-semibold text-base rounded-lg shadow-lg hover:shadow-xl transition-all'
            >
              {disabled ? (
                <>
                  <i className='tabler-loader-2 animate-spin mr-2' />
                  Ingresando...
                </>
              ) : (
                <>
                  <i className='tabler-login mr-2' />
                  Iniciar sesión
                </>
              )}
            </Button>

            <div className='flex justify-center items-center flex-wrap gap-2'>
              <Typography variant='body2' className='text-textSecondary'>
                ¿Nuevo en {themeConfig.templateName}?
              </Typography>
              <Typography
                component={Link}
                href='/register'
                className='text-primary font-semibold hover:underline'
              >
                Prueba 14 días gratis
              </Typography>
            </div>

            <Divider className='gap-2 text-textPrimary'>
              <Typography variant='caption' className='text-textSecondary'>
                O continúa con
              </Typography>
            </Divider>

            {/* CLOUD-281/CLOUD-282: OAuth Buttons with onClick handlers */}
            <div className='flex justify-center items-center gap-3'>
              <Button
                variant='outlined'
                className='flex-1 py-2.5 rounded-lg hover:bg-backgroundPaper/50'
                startIcon={<i className='tabler-brand-google' />}
                onClick={handleGoogleOAuth}
                disabled={oauthLoading !== null}
              >
                {oauthLoading === 'google' ? (
                  <i className='tabler-loader-2 animate-spin' />
                ) : (
                  'Google'
                )}
              </Button>
              <Button
                variant='outlined'
                className='flex-1 py-2.5 rounded-lg hover:bg-backgroundPaper/50'
                startIcon={<i className='tabler-brand-meta' />}
                onClick={handleFacebookOAuth}
                disabled={oauthLoading !== null}
              >
                {oauthLoading === 'facebook' ? (
                  <i className='tabler-loader-2 animate-spin' />
                ) : (
                  'Meta'
                )}
              </Button>
            </div>

            {/* Seguridad footer */}
            <div className='mt-2 p-4 bg-info/5 rounded-xl border border-info/20'>
              <div className='flex items-center gap-2'>
                <i className='tabler-shield-lock text-info text-xl' />
                <Typography variant='caption' className='text-textSecondary'>
                  <strong>Conexión segura.</strong> Tus datos están protegidos con encriptación SSL.
                </Typography>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginV2
