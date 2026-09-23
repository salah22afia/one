import { useQuery } from '@tanstack/react-query';
import { getMyFamily } from '@usp/api-client';

/** Read live from SAP as the signed-in employee (kept in memory briefly so Me and this screen share one read). */
export function useMyFamily() {
  return useQuery({ queryKey: ['me', 'family'], queryFn: getMyFamily, staleTime: 60_000 });
}
