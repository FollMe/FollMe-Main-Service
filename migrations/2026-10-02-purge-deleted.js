// One-off: stamps deletedAt on what was deleted before purging existed, so
// MongoDB's TTL indexes (created by the service on start) remove it 30 days
// from now. Safe to run more than once.
//
//   mongosh "$DB_HOST" migrations/2026-10-02-purge-deleted.js

const now = new Date();

const events = db.events.updateMany({ isDeleted: true, deletedAt: { $exists: false } }, { $set: { deletedAt: now } });
const deletedEvents = db.events.find({ isDeleted: true }, { _id: 1 }).toArray().map(e => e._id);

const guests = db.guests.updateMany(
  { deletedAt: { $exists: false }, $or: [{ isDeleted: true }, { event: { $in: deletedEvents } }] },
  { $set: { deletedAt: now } },
);
const wishes = db.wishes.updateMany(
  { deletedAt: { $exists: false }, event: { $in: deletedEvents } },
  { $set: { deletedAt: now } },
);

print(`events: ${events.modifiedCount}, guests: ${guests.modifiedCount}, wishes: ${wishes.modifiedCount} marked for purge`);
