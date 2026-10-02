'use client'

// React Imports
import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'

// Next Imports
import { useRouter, useSearchParams } from 'next/navigation'

import { signIn, getSession } from 'next-auth/react'

// React Hook Form
import { useForm } from 'react-hook-form'

// MUI Imports
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import CheckIcon from '@mui/icons-material/Check'
import DangerousIcon from '@mui/icons-material/Dangerous'

import { Alert } from '@mui/material'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'

// Config Imports
import themeConfig from '@configs/themeConfig'

// CLOUD-281/CLOUD-282: OAuth imports
import { AuthManager } from '@/utils/authManager'
import { triggerFacebookLogin } from '@/components/OAuthProvider'

// ============================================================
// CloudFly landing palette (landing/styles.css)
// Applied locally on this screen so the auth flow matches the
// marketing site: Electric Blue + Neon Violet over Space Black.
// ============================================================
const landingPalette = {
  // Tailwind aliases (resolved per element, not only on :root)
  '--primary-color': '#00A3FF',
  '--border-color': 'rgba(0, 163, 255, 0.2)',
  '--background-color': '#03010A',
  '--background-color-rgb': '3 1 10',
  '--backdrop-color': 'rgba(3, 1, 10, 0.6)',

  // MUI primary (brand electric blue instead of template violet)
  '--mui-palette-primary-main': '#00A3FF',
  '--mui-palette-primary-light': '#4CC9F0',
  '--mui-palette-primary-dark': '#0082CC',
  '--mui-palette-primary-contrastText': '#FFFFFF',
  '--mui-palette-primary-mainChannel': '0 163 255',
  '--mui-palette-primary-lightChannel': '76 201 240',
  '--mui-palette-primary-darkChannel': '0 130 204',
  '--mui-palette-primary-lighterOpacity': 'rgba(0, 163, 255, 0.08)',
  '--mui-palette-primary-lightOpacity': 'rgba(0, 163, 255, 0.16)',
  '--mui-palette-primary-mainOpacity': 'rgba(0, 163, 255, 0.24)',
  '--mui-palette-primary-darkOpacity': 'rgba(0, 163, 255, 0.32)',
  '--mui-palette-primary-darkerOpacity': 'rgba(0, 163, 255, 0.38)',

  // Accent (landing neon violet)
  '--mui-palette-secondary-main': '#7B2CBF',

  // Text over space black
  '--mui-palette-text-primary': '#F0F4FF',
  '--mui-palette-text-secondary': '#8A9FC4',
  '--mui-palette-text-disabled': 'rgba(240, 244, 255, 0.5)',
  '--mui-palette-text-primaryChannel': '240 244 255',
  '--mui-palette-text-secondaryChannel': '138 159 196',

  // Neon blue borders & surfaces
  '--mui-palette-divider': 'rgba(0, 163, 255, 0.2)',
  '--mui-palette-background-default': '#03010A',
  '--mui-palette-background-paper': '#0A0616',
  '--mui-palette-background-paperChannel': '10 6 22',

  // Actions
  '--mui-palette-action-active': 'rgba(240, 244, 255, 0.65)',
  '--mui-palette-action-hover': 'rgba(0, 163, 255, 0.08)',
  '--mui-palette-action-selected': 'rgba(0, 163, 255, 0.12)',
  '--mui-palette-action-focus': 'rgba(0, 163, 255, 0.16)',
  '--mui-palette-action-disabled': 'rgba(240, 244, 255, 0.3)',
  '--mui-palette-action-disabledBackground': 'rgba(240, 244, 255, 0.12)',

  // Inputs & chrome
  '--mui-palette-customColors-inputBorder': 'rgba(0, 163, 255, 0.35)',
  '--mui-palette-customColors-bodyBg': '#03010A',
  '--mui-palette-customColors-greyLightBg': '#0A0616',
  '--mui-palette-customColors-tableHeaderBg': '#0A0616',

  // Native controls & scrollbars follow the dark scheme
  colorScheme: 'dark',

  // Neon glow shadows
  '--mui-customShadows-primary-sm': '0 4px 20px rgba(0, 163, 255, 0.4)',
  '--mui-customShadows-primary-md': '0 6px 24px rgba(0, 163, 255, 0.5)',
  '--mui-customShadows-primary-lg': '0 8px 30px rgba(0, 163, 255, 0.6)'
} as CSSProperties

const meshBackground: CSSProperties = {
  backgroundColor: '#03010A',
  backgroundImage:
    'radial-gradient(circle at 20% 30%, rgba(0, 163, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(123, 44, 191, 0.18) 0%, transparent 50%)'
}

const glassSurface: CSSProperties = {
  backgroundColor: 'rgba(10, 6, 22, 0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(0, 163, 255, 0.2)',
  borderRadius: 24
}

const heroStats = [
  { icon: 'tabler-robot', value: '24/7', label: 'Atención automatizada', color: '#4CC9F0', tint: 'rgba(0, 163, 255, 0.12)' },
  { icon: 'tabler-chart-line', value: '+300%', label: 'Más conversiones', color: '#9D4EED', tint: 'rgba(157, 78, 237, 0.14)' },
  { icon: 'tabler-users', value: '10K+', label: 'Empresas activas', color: '#00A3FF', tint: 'rgba(0, 163, 255, 0.12)' }
]

const heroFeatures = [
  'Ver tus métricas de ventas y conversión en tiempo real',
  'Configurar tu chatbot IA en 5 minutos',
  'Automatizar respuestas y seguimiento de clientes'
]

interface FormInputs {
  username: string
  password: string
  remember: boolean
}

const LoginV2 = () => {
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

            window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=${scope}&nonce=${nonce}`
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

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=${scope}&nonce=${nonce}`
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
    <div
      className='relative flex bs-full justify-center min-bs-[100dvh] is-full'
      style={{ ...landingPalette, ...meshBackground }}
    >
      {/* Left: Landing-style hero panel */}
      <div className='hidden md:flex bs-full flex-1 relative overflow-y-auto'>
        {/* Ambient neon glows */}
        <div
          aria-hidden
          className='absolute pointer-events-none'
          style={{
            top: '-10%',
            left: '-5%',
            width: '55%',
            height: '55%',
            background: 'linear-gradient(135deg, rgba(0, 163, 255, 0.28), rgba(123, 44, 191, 0.22))',
            filter: 'blur(90px)',
            opacity: 0.5
          }}
        />
        <div
          aria-hidden
          className='absolute pointer-events-none'
          style={{
            bottom: '-15%',
            right: '-10%',
            width: '50%',
            height: '50%',
            background: 'linear-gradient(135deg, rgba(123, 44, 191, 0.3), rgba(0, 163, 255, 0.18))',
            filter: 'blur(100px)',
            opacity: 0.45
          }}
        />

        <div className='m-auto w-full max-w-4xl ps-10 pe-6 flex flex-col gap-7 py-10 relative z-10'>
          {/* Brand */}
          <div className='w-full max-is-[260px] [&_img]:w-full [&_img]:h-auto'>
            <Logo />
          </div>

          {/* Landing badges */}
          <div className='flex flex-wrap gap-3'>
            <span
              className='inline-block rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap'
              style={{
                background: 'rgba(0, 163, 255, 0.12)',
                color: '#4CC9F0',
                border: '1px solid rgba(0, 163, 255, 0.25)'
              }}
            >
              🤖 Inteligencia Artificial Omnicanal
            </span>
            <span
              className='inline-block rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap'
              style={{
                background: 'rgba(123, 44, 191, 0.15)',
                color: '#9D4EED',
                border: '1px solid rgba(157, 78, 237, 0.3)'
              }}
            >
              🏢 SaaS Cloud de Gestión
            </span>
          </div>

          {/* Gradient headline (landing hero style) */}
          <Typography
            variant='h2'
            component='h1'
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2.25rem', md: '3rem' },
              lineHeight: 1.2,
              letterSpacing: '-0.02em'
            }}
          >
            Bienvenido de vuelta a{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #4CC9F0, #9D4EED)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent'
              }}
            >
              CloudFly
            </span>
          </Typography>

          <Typography variant='body1' sx={{ color: '#8A9FC4', fontSize: '1.1rem', maxWidth: 560 }}>
            Gestiona tu negocio con IA, automatiza procesos y toma decisiones basadas en datos en tiempo real.
          </Typography>

          {/* Stats */}
          <div className='grid gap-5 sm:grid-cols-3'>
            {heroStats.map(stat => (
              <div
                key={stat.value}
                className='flex items-center gap-4 p-5 transition-all duration-300'
                style={glassSurface}
              >
                <div
                  className='w-12 h-12 rounded-xl flex items-center justify-center shrink-0'
                  style={{ background: stat.tint, border: `1px solid ${stat.color}44` }}
                >
                  <i className={stat.icon} style={{ color: stat.color, fontSize: '1.5rem' }} />
                </div>
                <div>
                  <Typography variant='h5' sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant='caption' sx={{ color: '#8A9FC4' }}>
                    {stat.label}
                  </Typography>
                </div>
              </div>
            ))}
          </div>

          {/* Feature checklist */}
          <div className='p-6' style={glassSurface}>
            <Typography variant='subtitle1' sx={{ color: '#F0F4FF', fontWeight: 700, mb: 2 }}>
              ✨ Lo que puedes hacer hoy:
            </Typography>
            <div className='flex flex-col gap-3'>
              {heroFeatures.map(feature => (
                <div key={feature} className='flex items-center gap-3'>
                  <i className='tabler-check' style={{ color: '#4CC9F0', fontSize: '1.25rem' }} />
                  <Typography variant='body2' sx={{ color: '#8A9FC4' }}>
                    {feature}
                  </Typography>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Glass auth card */}
      <div
        className='flex justify-center items-center bs-full !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px] relative'
        style={{ backgroundColor: 'rgba(5, 3, 12, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div
          aria-hidden
          className='absolute hidden md:block'
          style={{ top: 0, bottom: 0, left: 0, width: 1, background: 'rgba(0, 163, 255, 0.2)' }}
        />

        <div className='flex flex-col gap-6 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-6 md:mbs-0'>
          {/* Logo (mobile only, desktop shows it on the hero panel) */}
          <Link className='md:hidden block self-center max-is-[220px] [&_img]:w-full [&_img]:h-auto'>
            <Logo />
          </Link>

          {/* Header */}
          <div className='flex flex-col gap-2 text-center'>
            <div
              className='inline-flex items-center justify-center w-16 h-16 mx-auto mb-2 rounded-2xl'
              style={{
                background: 'linear-gradient(135deg, rgba(0, 163, 255, 0.2), rgba(123, 44, 191, 0.3))',
                border: '1px solid rgba(0, 163, 255, 0.4)',
                boxShadow: '0 0 30px rgba(0, 163, 255, 0.25)'
              }}
            >
              <i className='tabler-login' style={{ color: '#4CC9F0', fontSize: '2rem' }} />
            </div>
            <Typography variant='h4' className='font-bold'>
              ¡Bienvenido de vuelta! 👋
            </Typography>
            <Typography variant='body2'>
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
                    <i className='tabler-user' style={{ color: '#8A9FC4' }} />
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
                    <i className='tabler-lock' style={{ color: '#8A9FC4' }} />
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
                className='font-semibold hover:underline'
                sx={{ color: '#4CC9F0' }}
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
              sx={{
                py: 1.4,
                fontWeight: 700,
                fontSize: '1rem',
                color: '#FFFFFF',
                backgroundImage: 'linear-gradient(135deg, #00A3FF 0%, #7B2CBF 100%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 4px 20px rgba(0, 163, 255, 0.4)',
                borderRadius: '99px',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  backgroundImage: 'linear-gradient(135deg, #00A3FF 0%, #7B2CBF 100%)',
                  boxShadow: '0 8px 30px rgba(0, 163, 255, 0.7)',
                  transform: 'translateY(-2px)'
                },
                '&.Mui-disabled': {
                  backgroundImage: 'linear-gradient(135deg, #00A3FF 0%, #7B2CBF 100%)',
                  opacity: 0.6
                }
              }}
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
              <Typography variant='body2'>
                ¿Nuevo en {themeConfig.templateName}?
              </Typography>
              <Typography
                component={Link}
                href='/register'
                className='font-semibold hover:underline'
                sx={{ color: '#4CC9F0' }}
              >
                Prueba 14 días gratis
              </Typography>
            </div>

            <Divider className='gap-2'>
              <Typography variant='caption' sx={{ color: 'rgba(240, 244, 255, 0.5)' }}>
                O continúa con
              </Typography>
            </Divider>

            {/* CLOUD-281/CLOUD-282: OAuth Buttons with onClick handlers */}
            <div className='flex justify-center items-center gap-3'>
              <Button
                variant='outlined'
                className='flex-1 py-2.5'
                sx={{
                  color: '#F0F4FF',
                  borderColor: 'rgba(0, 163, 255, 0.35)',
                  borderRadius: '99px',
                  '&:hover': {
                    borderColor: '#00A3FF',
                    backgroundColor: 'rgba(0, 163, 255, 0.1)',
                    boxShadow: '0 4px 20px rgba(0, 163, 255, 0.25)'
                  }
                }}
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
                className='flex-1 py-2.5'
                sx={{
                  color: '#F0F4FF',
                  borderColor: 'rgba(157, 78, 237, 0.45)',
                  borderRadius: '99px',
                  '&:hover': {
                    borderColor: '#9D4EED',
                    backgroundColor: 'rgba(157, 78, 237, 0.12)',
                    boxShadow: '0 4px 20px rgba(157, 78, 237, 0.3)'
                  }
                }}
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
            <div
              className='mt-2 p-4'
              style={{
                background: 'rgba(0, 163, 255, 0.06)',
                borderRadius: 16,
                border: '1px solid rgba(0, 163, 255, 0.2)'
              }}
            >
              <div className='flex items-center gap-2'>
                <i className='tabler-shield-lock' style={{ color: '#4CC9F0', fontSize: '1.25rem' }} />
                <Typography variant='caption' sx={{ color: '#8A9FC4' }}>
                  <strong style={{ color: '#F0F4FF' }}>Conexión segura.</strong> Tus datos están protegidos con
                  encriptación SSL.
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
