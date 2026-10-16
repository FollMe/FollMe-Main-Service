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
// The program of the day: "17:00 Đón khách", "18:00 Khai tiệc"...
export const MAX_PROGRAM_ITEMS = 8;
export const MAX_PROGRAM_LABEL = 60;
// Deleted events, guests and wishes are kept this long (to undo a mistake
// on request), then MongoDB removes them for good.
export const PURGE_AFTER_SECONDS = 30 * 24 * 60 * 60;
// The budget (thu chi): what the host spends, next to the gift ledger
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
