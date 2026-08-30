const Parser = require('rss-parser');
const parser = new Parser();

// Add/remove feeds here. Keep it to sources that actually cover the
// beats US BCSD cares about — swap in narrower trade feeds as you find them.
const FEEDS = [
  'https://www.greenbiz.com/rss.xml',
  'https://www.esgtoday.com/feed/',
  'https://news.google.com/rss/search?q=sustainability+policy+when:7d&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=corporate+sustainability+regulation+when:7d&hl=en-US&gl=US&ceid=US:en',
];

/**
 * Pulls recent items from all configured RSS feeds.
 * Returns a flat array of { title, link, contentSnippet, isoDate, source }
 */
async function fetchRssItems() {
  const results = [];

  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = (feed.items || []).map((item) => ({
        title: item.title,
        link: item.link,
        contentSnippet: (item.contentSnippet || item.content || '').slice(0, 500),
        isoDate: item.isoDate || item.pubDate || new Date().toISOString(),
        source: feed.title || feedUrl,
      }));
      results.push(...items);
    } catch (err) {
      // Don't let one bad feed kill the whole run
      console.error(`RSS fetch failed for ${feedUrl}:`, err.message);
    }
  }

  // Only keep items from the last 8 days to avoid stale re-surfacing
  const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
  return results.filter((item) => new Date(item.isoDate).getTime() >= cutoff);
}

module.exports = { fetchRssItems };
