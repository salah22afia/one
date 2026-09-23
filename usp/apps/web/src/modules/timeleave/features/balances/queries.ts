import { useQuery } from '@tanstack/react-query';
import { getBalances } from '@usp/api-client';

export function useBalances() {
  return useQuery({ queryKey: ['me', 'balances'], queryFn: getBalances, staleTime: 60_000 });
}
