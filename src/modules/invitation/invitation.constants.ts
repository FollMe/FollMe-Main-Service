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
