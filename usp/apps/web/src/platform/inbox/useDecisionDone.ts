import { useQueryClient } from '@tanstack/react-query';

/** After a decision (or a refused one): the task lists, the done list and the requests lists show the new state. */
export function useDecisionDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: ['tasks-done'] });
    void qc.invalidateQueries({ queryKey: ['requests'] });
    void qc.invalidateQueries({ queryKey: ['request'] });
  };
}
