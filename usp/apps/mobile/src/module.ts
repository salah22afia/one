import type { LocalizedText } from '@usp/i18n';

/** A screen contributed by a module feature. The route file lives in app/<module>/<feature>.tsx. */
export interface MobileScreen { href: string; feature: string; serviceId?: string; name: LocalizedText }
/** Module manifest (src/modules/<key>/index.ts). */
export interface MobileModule { key: string; name: LocalizedText; screens: MobileScreen[] }
