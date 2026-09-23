import { useQuery } from '@tanstack/react-query';
import { getMyDocuments } from '@usp/api-client';

/** Read live from SAP as the signed-in employee (kept in memory briefly so Me and this screen share one read). */
export function useMyDocuments() {
  return useQuery({ queryKey: ['me', 'documents'], queryFn: getMyDocuments, staleTime: 60_000 });
}
