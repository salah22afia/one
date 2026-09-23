import { useQuery } from '@tanstack/react-query';
import { getCatalog } from '@usp/api-client';

/** The catalogue as the signed-in person sees it (listed services, the Home dock, their "notify me" list). */
export function useCatalog(enabled = true) {
  return useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 60_000, enabled });
}
