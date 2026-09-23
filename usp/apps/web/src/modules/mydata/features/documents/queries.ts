import { useQuery } from '@tanstack/react-query';
import { getMyDocuments } from '@usp/api-client';

export function useMyDocuments() {
  return useQuery({ queryKey: ['me', 'documents'], queryFn: getMyDocuments, staleTime: 60_000 });
}
