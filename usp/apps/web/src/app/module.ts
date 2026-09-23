import type { ComponentType, LazyExoticComponent } from 'react';
import type { LocalizedText } from '@usp/i18n';

/** A feature page contributed by a module. `serviceId` links a catalogue service to its coded page. */
export interface AppRoute { path: string; feature: string; serviceId?: string; name: LocalizedText; Component: LazyExoticComponent<ComponentType> }

/** A tile a module adds to the Me screen's widget grid (prototype C-UX-87); lower {@code order} first. */
export interface MeWidget { key: string; order: number; Component: ComponentType<{ delay: number }> }

/** Module manifest: the only thing the app imports from a module (modules/<key>/index.ts). */
export interface AppModule { key: string; name: LocalizedText; routes: AppRoute[]; meWidgets?: MeWidget[] }
