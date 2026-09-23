import { useQuery } from '@tanstack/react-query';
import { getPayslips } from '@usp/api-client';

/** Read live from SAP as the signed-in employee (kept in memory briefly so Me and this screen share one read). */
export function usePayslips() {
  return useQuery({ queryKey: ['me', 'payslips'], queryFn: getPayslips, staleTime: 60_000 });
}
