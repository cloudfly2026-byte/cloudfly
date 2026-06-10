// CLOUD-335 - Página principal del módulo de Catálogo en Línea (Tienda)
// Muestra el dashboard de la tienda o el formulario de creación según el estado

'use client'

import WebsiteDashboard from '@/components/catalog/WebsiteDashboard'
import ConstructionView from '@/components/catalog/ConstructionView'
import WelcomeCard from '@/components/catalog/WelcomeCard'
import { useWebsiteStatus } from '@/hooks/useWebsiteStatus'

const TiendaPage = () => {
  const { website, state, loading, error, refresh } = useWebsiteStatus(30000)

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[400px] gap-4'>
        <p className='text-error'>{error}</p>
        <button onClick={refresh} className='text-primary underline'>
          Reintentar
        </button>
      </div>
    )
  }

  // No website exists - show welcome card with creation form
  if (state === 'NO_WEBSITE') {
    return (
      <div className='flex flex-col gap-6'>
        <WelcomeCard />
      </div>
    )
  }

  // Website is under construction
  if (state === 'CONSTRUCTION') {
    return (
      <div className='flex flex-col gap-6'>
        <ConstructionView />
      </div>
    )
  }

  // Website is enabled or disabled - show full dashboard
  return (
    <div className='flex flex-col gap-6'>
      <WebsiteDashboard website={website} status={state} onRefresh={refresh} />
    </div>
  )
}

export default TiendaPage
