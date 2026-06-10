import { useState, useEffect, useCallback } from 'react';
import websiteService, { WebsiteResponse } from '@/services/catalog/websiteService';

export type WebsiteState = 'NO_WEBSITE' | 'CONSTRUCTION' | 'ENABLED' | 'DISABLED' | 'LOADING';

interface UseWebsiteStatusReturn {
  website: WebsiteResponse | null;
  state: WebsiteState;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWebsiteStatus(pollInterval?: number): UseWebsiteStatusReturn {
  const [website, setWebsite] = useState<WebsiteResponse | null>(null);
  const [state, setState] = useState<WebsiteState>('LOADING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await websiteService.getWebsiteStatus();
      setWebsite(data);
      if (data === null) {
        setState('NO_WEBSITE');
      } else {
        setState(data.status as WebsiteState);
      }
    } catch (err: any) {
      setError(err.message || 'Error al verificar el estado de la tienda');
      setState('NO_WEBSITE');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Poll for status changes if in CONSTRUCTION mode
    if (pollInterval && state === 'CONSTRUCTION') {
      const interval = setInterval(fetchStatus, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, pollInterval, state]);

  return { website, state, loading, error, refresh: fetchStatus };
}

export default useWebsiteStatus;