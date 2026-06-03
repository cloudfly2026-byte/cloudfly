import { useState, useCallback } from 'react';
import { useLazySearchContactsQuery } from '@/redux/api/contactsApi';
import type { Contact } from '@/types/marketing/contactTypes';
import debounce from 'lodash/debounce';

/**
 * Hook for predictive contact search with debouncing.
 * Uses RTK Query's lazy query to trigger search only when needed.
 *
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns search state and handler
 */
export function useContactSearch(debounceMs: number = 300) {
  const [searchQuery, setSearchQuery] = useState('');
  const [trigger, { data: results, isLoading }] = useLazySearchContactsQuery();

  // Debounced search trigger
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.length >= 2) {
        trigger(query);
      }
    }, debounceMs),
    [trigger, debounceMs]
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  return {
    searchQuery,
    results: results ?? [],
    isLoading,
    handleSearch,
  };
}
