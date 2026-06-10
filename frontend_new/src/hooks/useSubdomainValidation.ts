import { useState, useCallback, useRef } from 'react';
import websiteService from '@/services/catalog/websiteService';

interface UseSubdomainValidationReturn {
  isValid: boolean | null;
  isAvailable: boolean | null;
  isChecking: boolean;
  error: string | null;
  validate: (subdomain: string) => void;
}

export function useSubdomainValidation(debounceMs: number = 500): UseSubdomainValidationReturn {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const validate = useCallback((subdomain: string) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset state
    setIsValid(null);
    setIsAvailable(null);
    setError(null);

    if (!subdomain || subdomain.trim().length === 0) {
      return;
    }

    const cleaned = subdomain.trim().toLowerCase();

    // Client-side format validation
    const pattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!pattern.test(cleaned)) {
      setIsValid(false);
      setError('El subdominio solo puede contener letras min\u00fasculas, n\u00fameros y guiones (3-63 caracteres)');
      return;
    }

    setIsValid(true);
    setIsChecking(true);

    // Debounced server validation
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await websiteService.validateSubdomain(cleaned);
        setIsAvailable(available);
        if (!available) {
          setError('Este subdominio ya est\u00e1 en uso');
        }
      } catch (err: any) {
        setError('Error al validar el subdominio');
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  return { isValid, isAvailable, isChecking, error, validate };
}

export default useSubdomainValidation;