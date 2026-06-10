'use client';

import { useQuery } from '@tanstack/react-query';
import websiteService from '@/services/catalog/websiteService';
import type { WebsiteStatusResponse } from '@/types/catalog';

export function useWebsiteStatus() {
  return useQuery<WebsiteStatusResponse>({
    queryKey: ['websiteStatus'],
    queryFn: () => websiteService.getStatus(),
    refetchInterval: (query) => {
      const data = query.state.data?.data;
      if (data?.status === 'CONSTRUCTION') {
        return 30000;
      }
      return false;
    },
    staleTime: 15000,
    retry: 2,
  });
}
