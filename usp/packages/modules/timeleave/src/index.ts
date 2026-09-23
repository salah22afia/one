// Shared by web and mobile for module `timeleave`: types, formatters and pure preview logic (the server stays authoritative).
export type LeaveSection = 'core' | 'medical' | 'family' | 'other';
export type CheckLevel = 'ok' | 'info' | 'warn' | 'block';
