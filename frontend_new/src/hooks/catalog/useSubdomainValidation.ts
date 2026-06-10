// CLOUD-342 - Hook de React Query para validar disponibilidad de subdominio
// Consume el endpoint GET /api/v1/website/validate-subdomain del Backend API

import { useQuery } from '@tanstack/react-query';
import websiteService from '@/services/catalog/websiteService';
import type { SubdomainValidation } from '@/types/catalog';

export function useSubdomainValidation(subdomain: string) {
  return useQuery<SubdomainValidation>({
    queryKey: ['validateSubdomain', subdomain],
    queryFn: () => websiteService.validateSubdomain(subdomain),
    enabled: subdomain.length >= 3,
    staleTime: 30000,
    retry: 1,
  });
}