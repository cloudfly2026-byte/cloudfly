'use client';

import { useQuery } from '@tanstack/react-query';
import websiteService from '@/services/catalog/websiteService';
import type { WebsiteMetrics } from '@/types/catalog';

/**
 * Hook para obtener las métricas de la tienda en línea.
 * Usa React Query con staleTime de 60s para evitar llamadas excesivas.
 *
 * @returns Query result con datos de tipo WebsiteMetrics
 */
export function useWebsiteMetrics() {
  return useQuery<WebsiteMetrics>({
    queryKey: ['websiteMetrics'],
    queryFn: () => websiteService.getMetrics(),
    staleTime: 60000,
    retry: 2,
  });
}
