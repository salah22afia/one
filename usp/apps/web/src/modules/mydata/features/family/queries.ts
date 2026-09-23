import { useQuery } from '@tanstack/react-query';
import { getMyFamily } from '@usp/api-client';

export function useMyFamily() {
  return useQuery({ queryKey: ['me', 'family'], queryFn: getMyFamily, staleTime: 60_000 });
}
