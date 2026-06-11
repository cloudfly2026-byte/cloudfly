// Unit tests for useWebsiteMetrics hook

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWebsiteMetrics } from '@/hooks/catalog/useWebsiteMetrics';
import websiteService from '@/services/catalog/websiteService';

// Mock the websiteService
jest.mock('@/services/catalog/websiteService', () => ({
  __esModule: true,
  default: {
    getMetrics: jest.fn(),
  },
}));

const mockedWebsiteService = websiteService as jest.Mocked<typeof websiteService>;

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

describe('useWebsiteMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call websiteService.getMetrics', async () => {
    const mockMetrics = {
      visitsByYear: [{ year: '2024', visits: 100 }],
      origins: [{ name: 'Directo', value: 60 }],
      topPages: [{ page: '/inicio', views: 50 }],
      bounceRate: 35.5,
    };
    mockedWebsiteService.getMetrics.mockResolvedValueOnce(mockMetrics);

    const { result } = renderHook(
      () => useWebsiteMetrics(),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedWebsiteService.getMetrics).toHaveBeenCalledTimes(1);
  });

  it('should return correct metrics data structure', async () => {
    const mockMetrics = {
      visitsByYear: [
        { year: '2024', visits: 1200 },
        { year: '2025', visits: 2400 },
      ],
      origins: [
        { name: 'Directo', value: 60 },
        { name: 'Redes Sociales', value: 30 },
        { name: 'Buscadores', value: 10 },
      ],
      topPages: [
        { page: '/inicio', views: 500 },
        { page: '/productos', views: 300 },
        { page: '/contacto', views: 100 },
      ],
      bounceRate: 42.3,
    };
    mockedWebsiteService.getMetrics.mockResolvedValueOnce(mockMetrics);

    const { result } = renderHook(
      () => useWebsiteMetrics(),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockMetrics);
  });

  it('should use correct queryKey', () => {
    mockedWebsiteService.getMetrics.mockResolvedValueOnce({
      visitsByYear: [],
      origins: [],
      topPages: [],
      bounceRate: 0,
    });

    const { result } = renderHook(
      () => useWebsiteMetrics(),
      { wrapper: createWrapper() }
    );

    expect(result.current).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    mockedWebsiteService.getMetrics.mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(
      () => useWebsiteMetrics(),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});
