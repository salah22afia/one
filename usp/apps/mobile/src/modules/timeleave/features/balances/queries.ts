import { useQuery } from '@tanstack/react-query';
import { getBalances } from '@usp/api-client';

/** Read live from SAP as the signed-in employee (kept in memory briefly so Me and this screen share one read). */
export function useBalances() {
  return useQuery({ queryKey: ['me', 'balances'], queryFn: getBalances, staleTime: 60_000 });
}
