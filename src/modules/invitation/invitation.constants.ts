export const EVENT_TYPES = ['wedding', 'engagement', 'birthday', 'party', 'other'] as const;
export const EVENT_THEMES = ['blush', 'classic', 'minimal', 'night', 'garden'] as const;
export const RSVP_STATUSES = ['attending', 'maybe', 'declined'] as const;

export const MAX_RSVP_COUNT = 20;
export const MAX_WISHES_SHOWN = 100;
export const MAX_GUESTS_PER_REQUEST = 500;
export const EVENT_MUSIC = ['none', 'canon'] as const;
export const GIFT_SIDES = ['groom', 'bride', 'host'] as const;
export const MAX_GIFT_ACCOUNTS = 2;
export const MAX_PHOTOS = 12;
// Photos guests took at the party, shared on everyone's card
export const MAX_GUEST_PHOTOS = 200;
export const MAX_GUEST_PHOTOS_EACH = 10;
export const GUEST_PHOTOS_BEFORE_MS = 2 * 3600_000;
export const GUEST_PHOTOS_AFTER_MS = 30 * 24 * 3600_000;
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAX_GROUP_NAME = 40;
// The gift ledger (sổ mừng): amounts in VND
export const MAX_GIFT_AMOUNT = 10_000_000_000;
export const MAX_GIFT_NOTE = 100;
// Seating: "12", "VIP", "Bàn 3 nhà trai"...
export const MAX_TABLE_NAME = 20;
export const MAX_SEATS_PER_TABLE = 30;
// "Bạn muốn nghe bài gì?" with the RSVP
export const MAX_SONG = 100;
// "Bạn ngồi bàn nào?" on the shared link: open from a little before the party to its end
export const SEAT_FINDER_BEFORE_MS = 6 * 3600_000;
export const SEAT_FINDER_AFTER_MS = 12 * 3600_000;
export const SEAT_FINDER_RESULTS = 5;
// "Mình đã đến": a guest checks themselves in on their card, around the party
export const SELF_CHECKIN_BEFORE_MS = 3 * 3600_000;
export const SELF_CHECKIN_AFTER_MS = 8 * 3600_000;
// The program of the day: "17:00 Đón khách", "18:00 Khai tiệc"...
export const MAX_PROGRAM_ITEMS = 8;
export const MAX_PROGRAM_LABEL = 60;
// "Chuyện tình yêu": a few moments of the couple's story on the invitation
export const MAX_STORY_ITEMS = 8;
export const MAX_STORY_WHEN = 30;
export const MAX_STORY_TITLE = 60;
export const MAX_STORY_TEXT = 300;

// Buses the hosts lay on for guests (xe đưa đón), e.g. from the city to a wedding in the countryside
export const MAX_SHUTTLES = 6;
export const MAX_SHUTTLE_LABEL = 60;
export const MAX_SHUTTLE_FROM = 120;
export const MAX_SHUTTLE_SEATS = 60;

// "Lưu ý cho khách": short notes by topic (dress code, parking, kids, a place to stay) or the host's own
export const NOTE_KINDS = ['dress', 'parking', 'kids', 'stay', 'other'];
export const MAX_NOTES = 6;
export const MAX_NOTE_TITLE = 60;
export const MAX_NOTE_TEXT = 300;

// A short link for the shared card (/c/minh-lan): 3 to 40 of a-z, 0-9 and
// single hyphens, not at either end
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MIN_SLUG = 3;
export const MAX_SLUG = 40;
// Deleted events, guests and wishes are kept this long (to undo a mistake
// on request), then MongoDB removes them for good.
export const PURGE_AFTER_SECONDS = 30 * 24 * 60 * 60;
// The budget (thu chi): what the host spends, next to the gift ledger
// Who pays a line of the budget: one family, or both halves
export const EXPENSE_PAYERS = ['groom', 'bride', 'shared'] as const;
export const EXPENSE_CATEGORIES = [
  'venue', 'photo', 'attire', 'rings', 'ceremony', 'decor', 'cards', 'music', 'travel', 'honeymoon', 'other',
] as const;
export const MAX_EXPENSES = 100;
export const MAX_EXPENSE_LABEL = 60;
export const MAX_EXPENSE_NOTE = 100;
// The checklist (việc cần làm) before and after the day
export const MAX_TASKS = 60;
export const MAX_TASK_LABEL = 80;
// The page a task leads to, if any. One the app knows and this list does
// not yet is dropped, keeping the task: the app may ship first.
export const TASK_LINKS = [
  'date', 'budget', 'guests', 'send', 'remind', 'program', 'photos', 'seating', 'desk', 'screen', 'ledger', 'thanks', 'guestbook',
  'labels', 'dayof', 'draw',
] as const;
// People who manage an event with its host (the other half of the couple, a parent)
export const MAX_COHOSTS = 3;

// Languages of the guest card: Vietnamese (the default, stored as nothing) or English
export const CARD_LANGS = ['vi', 'en'];
