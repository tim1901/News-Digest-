const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const QUEUE_KEY = 'queue.json';
const CLEANUP_AFTER_DAYS = 14; // prune old already-digested items so the blob doesn't grow forever

function store() {
  // Netlify auto-injects site ID/token into the function environment,
  // so no extra config is needed for this to work once deployed.
  return getStore('sustainability-digest');
}

async function readQueue() {
  const s = store();
  const data = await s.get(QUEUE_KEY, { type: 'json' });
  return data || [];
}

async function writeQueue(items) {
  const s = store();
  await s.setJSON(QUEUE_KEY, items);
}

/**
 * Adds freshly-scored items to the queue. Returns the same items with
 * generated ids attached, so callers can reference them (e.g. to mark
 * an urgent alert as posted).
 */
async function addToQueue(scoredItems) {
  const queue = await readQueue();

  const withIds = scoredItems.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    urgentPosted: false,
    includedInDigest: false,
    addedDate: new Date().toISOString().slice(0, 10),
  }));

  await writeQueue([...queue, ...withIds]);
  return withIds;
}

async function markUrgentPosted(id) {
  const queue = await readQueue();
  const updated = queue.map((item) =>
    item.id === id ? { ...item, urgentPosted: true } : item
  );
  await writeQueue(updated);
}

async function getQueueForWeeklyDigest() {
  const queue = await readQueue();
  return queue
    .filter((item) => !item.includedInDigest)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

async function markIncludedInDigest(ids) {
  const idSet = new Set(ids);
  const queue = await readQueue();

  const cutoff = Date.now() - CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const updated = queue
    .map((item) => (idSet.has(item.id) ? { ...item, includedInDigest: true } : item))
    // prune old items that already made it into a past digest, to keep the store small
    .filter((item) => {
      if (!item.includedInDigest) return true;
      return new Date(item.addedDate).getTime() >= cutoff;
    });

  await writeQueue(updated);
}

module.exports = {
  addToQueue,
  markUrgentPosted,
  getQueueForWeeklyDigest,
  markIncludedInDigest,
};
