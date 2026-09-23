import { useQuery } from '@tanstack/react-query';
import { getSession, type SessionView } from '@usp/api-client';

/** The signed-in user (loaded once by the shell; screens read the cached value). */
export function useSession(): SessionView | undefined {
  return useQuery({ queryKey: ['session'], queryFn: getSession, staleTime: Infinity }).data;
}
