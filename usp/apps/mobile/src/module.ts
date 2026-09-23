import type { ComponentType } from 'react';
import type { LocalizedText } from '@usp/i18n';

/** A screen contributed by a module feature. The route file lives in app/<module>/<feature>.tsx. */
export interface MobileScreen { href: string; feature: string; serviceId?: string; name: LocalizedText }
/** A tile a module adds to the Me screen's widget grid (prototype C-UX-87); lower {@code order} first. */
export interface MobileMeWidget { key: string; order: number; Component: ComponentType }
/** Module manifest (src/modules/<key>/index.ts). */
export interface MobileModule { key: string; name: LocalizedText; screens: MobileScreen[]; meWidgets?: MobileMeWidget[] }
