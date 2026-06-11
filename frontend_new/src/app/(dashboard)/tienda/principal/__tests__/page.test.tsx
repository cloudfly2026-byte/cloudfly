// Unit tests for TiendaPrincipalPage (CLOUD-329)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TiendaPrincipalPage from '../page';

// Mock the hooks
jest.mock('@/hooks/catalog/useWebsiteStatus', () => ({
  useWebsiteStatus: jest.fn(),
}));

// Mock the child components
jest.mock('@/components/catalog/WelcomeCard', () => {
  return function MockWelcomeCard({ onActivate }: { onActivate: () => void }) {
    return React.createElement('div', { 'data-testid': 'welcome-card' },
      React.createElement('button', { onClick: onActivate }, 'Crear Catálogo en Línea')
    );
  };
});

jest.mock('@/components/catalog/SubdomainForm', () => {
  return function MockSubdomainForm() {
    return React.createElement('div', { 'data-testid': 'subdomain-form' }, 'Subdomain Form');
  };
});

jest.mock('@/components/catalog/ConstructionView', () => {
  return function MockConstructionView() {
    return React.createElement('div', { 'data-testid': 'construction-view' }, 'Construction View');
  };
});

jest.mock('@/components/catalog/WebsiteDashboard', () => {
  return function MockWebsiteDashboard({ status }: { status: any }) {
    return React.createElement('div', { 'data-testid': 'website-dashboard' },
      `Dashboard - ${status.status}`
    );
  };
});

import { useWebsiteStatus } from '@/hooks/catalog/useWebsiteStatus';
const mockedUseWebsiteStatus = useWebsiteStatus as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };

  return Wrapper;
}

describe('TiendaPrincipalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    // CircularProgress should be shown
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render WelcomeCard when no website exists (NO_WEBSITE state)', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: {
        success: true,
        data: {
          exists: false,
          status: null,
          subdomain: null,
          siteName: null,
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('welcome-card')).toBeInTheDocument();
  });

  it('should render ConstructionView when status is CONSTRUCTION', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: {
        success: true,
        data: {
          exists: true,
          status: 'CONSTRUCTION',
          subdomain: 'mi-tienda',
          siteName: 'Mi Tienda',
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('construction-view')).toBeInTheDocument();
  });

  it('should render WebsiteDashboard when status is ENABLED', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: {
        success: true,
        data: {
          exists: true,
          status: 'ENABLED',
          subdomain: 'mi-tienda',
          siteName: 'Mi Tienda',
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('website-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard - ENABLED')).toBeInTheDocument();
  });

  it('should render WebsiteDashboard when status is DISABLED', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: {
        success: true,
        data: {
          exists: true,
          status: 'DISABLED',
          subdomain: 'mi-tienda',
          siteName: 'Mi Tienda',
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('website-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard - DISABLED')).toBeInTheDocument();
  });

  it('should render error alert when there is an error', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Error al cargar el estado de la tienda/)).toBeInTheDocument();
  });

  it('should render breadcrumb with correct structure', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: {
        success: true,
        data: {
          exists: false,
          status: null,
          subdomain: null,
          siteName: null,
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tienda')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('should render page title "Mi Tienda en Línea"', () => {
    mockedUseWebsiteStatus.mockReturnValue({
      data: {
        success: true,
        data: {
          exists: false,
          status: null,
          subdomain: null,
          siteName: null,
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      React.createElement(TiendaPrincipalPage),
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Mi Tienda en Línea')).toBeInTheDocument();
  });
});
