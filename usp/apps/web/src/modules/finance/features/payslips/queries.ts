import { useQuery } from '@tanstack/react-query';
import { getPayslips } from '@usp/api-client';

export function usePayslips() {
  return useQuery({ queryKey: ['me', 'payslips'], queryFn: getPayslips, staleTime: 60_000 });
}

/** yyyy-MM as "September 2026" in the reader's language. */
export const monthOf = (period: string) => `${period}-01`;
