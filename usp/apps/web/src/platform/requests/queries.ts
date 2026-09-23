import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getMyRequests, getRequest } from '@usp/api-client';

/** One request (detail, steps, audit); shared by the request page, the resubmit form and the task sheet. */
export function useRequest(id: string, enabled = true) {
  return useQuery({ queryKey: ['request', id], queryFn: () => getRequest(id), enabled: enabled && !!id });
}

/** My requests, a page at a time (the server's keyset cursor). */
export function useMyRequests(view: 'ongoing' | 'finished') {
  return useInfiniteQuery({
    queryKey: ['requests', view],
    queryFn: ({ pageParam }) => getMyRequests(view, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
}
