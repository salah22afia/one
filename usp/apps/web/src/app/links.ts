import { modules } from './registry';

/** Where a module's feature page lives (from the module manifests), for links from platform screens; null if absent. */
export function featurePath(module: string, feature: string): string | null {
  return modules.find((m) => m.key === module)?.routes.find((r) => r.feature === feature)?.path ?? null;
}

/** The coded page of a catalogue service, if a module provides one (else the service runs as a configured service). */
export function servicePath(serviceId: string): string | null {
  return modules.flatMap((m) => m.routes).find((r) => r.serviceId === serviceId)?.path ?? null;
}

/** Where a startable catalogue service opens: its module's page when coded, the configured-service renderer otherwise. */
export function startPath(serviceId: string): string {
  return servicePath(serviceId) ?? `/new/${encodeURIComponent(serviceId)}`;
}
