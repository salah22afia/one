// Shared by web and mobile for module `needs`: types and formatters.
/** The six segments the requester sees (prototype need.ts). */
export type NeedSegment = 'request' | 'approval' | 'store' | 'purchase' | 'supply' | 'handover';
export type NeedLineStatus = 'open' | 'reserved' | 'issued' | 'purchasing' | 'received' | 'delivered' | 'cancelled' | 'provided';
