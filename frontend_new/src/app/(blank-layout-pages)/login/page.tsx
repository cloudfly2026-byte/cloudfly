// Component Imports
import LoginV2 from '@/views/pages/auth/LoginV2'
import RedirectIfAuthenticated from '@/components/auth/RedirectIfAuthenticated'

const LoginPage = () => {
  return (
    <>
      <RedirectIfAuthenticated />
      <LoginV2 />
    </>
  )
}

export default LoginPage
