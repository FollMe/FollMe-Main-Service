export const EVENT_TYPES = ['wedding', 'engagement', 'birthday', 'party', 'other'] as const;
export const EVENT_THEMES = ['blush', 'classic', 'minimal', 'night'] as const;
export const RSVP_STATUSES = ['attending', 'maybe', 'declined'] as const;

export const MAX_RSVP_COUNT = 20;
export const MAX_WISHES_SHOWN = 100;
export const MAX_GUESTS_PER_REQUEST = 500;
export const EVENT_MUSIC = ['none', 'canon'] as const;
export const GIFT_SIDES = ['groom', 'bride', 'host'] as const;
export const MAX_GIFT_ACCOUNTS = 2;
export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAX_GROUP_NAME = 40;
// The gift ledger (sổ mừng): amounts in VND
export const MAX_GIFT_AMOUNT = 10_000_000_000;
export const MAX_GIFT_NOTE = 100;
// Seating: "12", "VIP", "Bàn 3 nhà trai"...
export const MAX_TABLE_NAME = 20;
export const MAX_SEATS_PER_TABLE = 30;
// Deleted events, guests and wishes are kept this long (to undo a mistake
// on request), then MongoDB removes them for good.
export const PURGE_AFTER_SECONDS = 30 * 24 * 60 * 60;
