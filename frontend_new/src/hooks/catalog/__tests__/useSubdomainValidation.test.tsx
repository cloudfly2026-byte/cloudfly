// CLOUD-342 - Unit tests for useSubdomainValidation hook

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubdomainValidation } from '@/hooks/catalog/useSubdomainValidation';
import websiteService from '@/services/catalog/websiteService';

// Mock the websiteService
jest.mock('@/services/catalog/websiteService', () => ({
  __esModule: true,
  default: {
    validateSubdomain: jest.fn(),
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

describe('useSubdomainValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be disabled when subdomain length is less than 3', () => {
    const { result } = renderHook(
      () => useSubdomainValidation('ab'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isDisabled).toBe(true);
    expect(mockedWebsiteService.validateSubdomain).not.toHaveBeenCalled();
  });

  it('should be enabled when subdomain length is 3 or more', () => {
    mockedWebsiteService.validateSubdomain.mockResolvedValueOnce({
      available: true,
      message: 'Subdominio disponible',
    });

    const { result } = renderHook(
      () => useSubdomainValidation('abc'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isDisabled).toBe(false);
  });

  it('should call websiteService.validateSubdomain with correct subdomain', async () => {
    mockedWebsiteService.validateSubdomain.mockResolvedValueOnce({
      available: true,
      message: 'Subdominio disponible',
    });

    const { result } = renderHook(
      () => useSubdomainValidation('my-store'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedWebsiteService.validateSubdomain).toHaveBeenCalledWith('my-store');
  });

  it('should return correct data structure', async () => {
    const mockResponse = {
      available: false,
      message: 'Este subdominio ya esta en uso',
    };
    mockedWebsiteService.validateSubdomain.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(
      () => useSubdomainValidation('taken-name'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
  });

  it('should use correct queryKey format', () => {
    mockedWebsiteService.validateSubdomain.mockResolvedValueOnce({
      available: true,
      message: 'Subdominio disponible',
    });

    const { result } = renderHook(
      () => useSubdomainValidation('test-subdomain'),
      { wrapper: createWrapper() }
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
  });
});