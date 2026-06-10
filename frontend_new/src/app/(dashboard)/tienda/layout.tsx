// CLOUD-335 - Layout para el módulo de Tienda/Catálogo en Línea
// Extiende el dashboard layout con configuración específica para el módulo de catálogo

// Type Imports
import type { ChildrenType } from '@core/types'

// Component Imports
import { PermissionGate } from '@/components/rbac/PermissionGate'

interface TiendaLayoutProps extends ChildrenType {}

const TiendaLayout = ({ children }: TiendaLayoutProps) => {
  return (
    <PermissionGate permission='catalog.view'>
      <div className='flex flex-col gap-6 p-6'>
        {children}
      </div>
    </PermissionGate>
  )
}

export default TiendaLayout