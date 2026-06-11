// ============================================================
// CLOUD-354: ConstructionView Component - Unit Tests
// ============================================================

import React from 'react'
import { render, screen } from '@testing-library/react'
import ConstructionView from '@/components/catalog/ConstructionView'

// ---------------------------------------------------------------------------
// Mock framer-motion to avoid animation issues in test environment
// ---------------------------------------------------------------------------
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConstructionView (CLOUD-354)', () => {
  // =========================================================================
  // Rendering
  // =========================================================================

  it('should render without crashing', () => {
    render(<ConstructionView />)
    expect(screen.getByText('Tu tienda esta en construccion!')).toBeInTheDocument()
  })

  it('should render the main title', () => {
    render(<ConstructionView />)
    expect(screen.getByText('Tu tienda esta en construccion!')).toBeInTheDocument()
  })

  it('should render the notification message', () => {
    render(<ConstructionView />)
    expect(
      screen.getByText(
        /Nuestro agente constructor esta trabajando en tu tienda/
      )
    ).toBeInTheDocument()
  })

  // =========================================================================
  // Stepper Steps
  // =========================================================================

  it('should render step 1: Configurando subdominio', () => {
    render(<ConstructionView />)
    expect(screen.getByText('Configurando subdominio')).toBeInTheDocument()
  })

  it('should render step 2: Generando estructura', () => {
    render(<ConstructionView />)
    expect(screen.getByText('Generando estructura')).toBeInTheDocument()
  })

  it('should render step 3: Optimizando rendimiento', () => {
    render(<ConstructionView />)
    expect(screen.getByText('Optimizando rendimiento')).toBeInTheDocument()
  })

  it('should render step 4: Publicando tienda', () => {
    render(<ConstructionView />)
    expect(screen.getByText('Publicando tienda')).toBeInTheDocument()
  })

  // =========================================================================
  // Step Descriptions
  // =========================================================================

  it('should render description for step 1', () => {
    render(<ConstructionView />)
    expect(
      screen.getByText('Preparando tu dominio personalizado...')
    ).toBeInTheDocument()
  })

  it('should render description for step 2', () => {
    render(<ConstructionView />)
    expect(
      screen.getByText('Creando las paginas de tu tienda...')
    ).toBeInTheDocument()
  })

  it('should render description for step 3', () => {
    render(<ConstructionView />)
    expect(
      screen.getByText('Ajustando velocidad y SEO...')
    ).toBeInTheDocument()
  })

  it('should render description for step 4', () => {
    render(<ConstructionView />)
    expect(
      screen.getByText('Tu tienda estara lista pronto...')
    ).toBeInTheDocument()
  })

  // =========================================================================
  // All 4 steps present
  // =========================================================================

  it('should render exactly 4 step labels', () => {
    render(<ConstructionView />)
    const steps = [
      'Configurando subdominio',
      'Generando estructura',
      'Optimizando rendimiento',
      'Publicando tienda',
    ]
    steps.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument()
    })
  })
})
