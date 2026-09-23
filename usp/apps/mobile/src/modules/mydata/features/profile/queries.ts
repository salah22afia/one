import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@usp/api-client';

/** Read live from SAP as the signed-in employee (kept in memory briefly so Me and this screen share one read). */
export function useProfile() {
  return useQuery({ queryKey: ['me', 'profile'], queryFn: getProfile, staleTime: 60_000 });
}
