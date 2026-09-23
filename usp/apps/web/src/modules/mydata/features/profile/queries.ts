import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@usp/api-client';

/** My data, read live from SAP (kept in memory briefly so the Me screen and its pages share one read). */
export function useProfile() {
  return useQuery({ queryKey: ['me', 'profile'], queryFn: getProfile, staleTime: 60_000 });
}
