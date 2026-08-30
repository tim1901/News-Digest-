const { fetchRssItems } = require('./rss');
const {
  addToQueue,
  markUrgentPosted,
  getQueueForWeeklyDigest,
  markIncludedInDigest,
} = require('./store');
const { scoreItems, writeUrgentAlert, writeWeeklyDigest } = require('./claude');
const { postToSlack } = require('./slack');

const URGENT_THRESHOLD = 8;
const TOP_N = 5;

/**
 * Fetches fresh news, scores it, fires urgent alerts, queues the rest.
 * Shared by the daily scheduled run and the on-demand Slack "/digest check".
 *
 * @param {boolean} announceSummary - if true, posts a short confirmation
 *   to Slack even when nothing urgent fired (useful for on-demand triggers
 *   so the person who ran it gets visible confirmation something happened).
 */
async function runDailyCheck({ announceSummary = false } = {}) {
  const rssItems = await fetchRssItems();

  if (!rssItems.length) {
    if (announceSummary) {
      await postToSlack('Just checked — no new sustainability news items today.');
    }
    return { itemsProcessed: 0, urgentSent: 0 };
  }

  const scored = await scoreItems(rssItems);
  const queued = await addToQueue(scored);

  const urgentItems = queued.filter((i) => i.urgencyScore >= URGENT_THRESHOLD);
  for (const item of urgentItems) {
    const alertText = await writeUrgentAlert(item);
    await postToSlack(alertText);
    await markUrgentPosted(item.id);
  }

  if (announceSummary) {
    await postToSlack(
      `Just ran a check: reviewed ${rssItems.length} items, ${urgentItems.length} urgent alert(s) sent. The rest are queued for this week's roundup.`
    );
  }

  return { itemsProcessed: rssItems.length, urgentSent: urgentItems.length };
}

/**
 * Compiles the current queue into the weekly digest and posts it.
 * Shared by the weekly scheduled run and on-demand "/digest".
 */
async function runWeeklyDigest() {
  const queued = await getQueueForWeeklyDigest();

  if (!queued.length) {
    await postToSlack(
      "Good morning! Quiet week on the sustainability news front — nothing that cleared the bar for this week's roundup. Back with more next week."
    );
    return { posted: false, count: 0 };
  }

  const topItems = queued.slice(0, TOP_N);
  const digestText = await writeWeeklyDigest(topItems);
  await postToSlack(digestText);

  // Archive the whole week's queue, not just the top 5, so leftovers don't linger
  await markIncludedInDigest(queued.map((i) => i.id));

  return { posted: true, count: topItems.length };
}

module.exports = { runDailyCheck, runWeeklyDigest };
