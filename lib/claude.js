const fetch = require('node-fetch');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// TODO: Tighten this to US BCSD's actual current focus areas — pull from
// their strategy docs / member priorities so scoring stays sharp.
const RELEVANCE_BRIEF = `
US BCSD (US Business Council for Sustainable Development) works with member
companies on corporate sustainability strategy, climate policy, circular
economy, ESG reporting/regulation, supply chain sustainability, and
sustainable business coalitions. Their audience is sustainability executives
at member companies.
`;

async function callClaude(system, userContent, maxTokens = 1500) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * Scores a batch of raw items for relevance (0-10) and urgency (0-10).
 * Urgency = "an exec would want to know about this today, not on Monday"
 * (e.g. a policy just passed, a major regulator announcement, breaking news
 * directly affecting a member company or sector).
 */
async function scoreItems(items) {
  if (!items.length) return [];

  const system = `You are a sustainability news analyst for US BCSD. Score each item on:
- relevanceScore (0-10): how relevant to US BCSD's focus areas and member audience
- urgencyScore (0-10): how time-sensitive — an 8+ means an exec should hear about it
  today, not in the weekly roundup (e.g. a policy just passed, a regulatory deadline,
  a major announcement directly affecting members)

${RELEVANCE_BRIEF}

Respond ONLY with a JSON array, no preamble, no markdown fences, in this exact shape:
[{"index": 0, "relevanceScore": 7, "urgencyScore": 2}, ...]`;

  const userContent = JSON.stringify(
    items.map((item, i) => ({
      index: i,
      title: item.title,
      snippet: item.contentSnippet,
      source: item.source,
    }))
  );

  const raw = await callClaude(system, userContent, 2000);
  const clean = raw.replace(/```json|```/g, '').trim();
  const scores = JSON.parse(clean);

  return items.map((item, i) => {
    const match = scores.find((s) => s.index === i) || {};
    return {
      ...item,
      relevanceScore: match.relevanceScore ?? 0,
      urgencyScore: match.urgencyScore ?? 0,
    };
  });
}

/**
 * Writes one urgent item as a short, human Slack alert — not a headline dump.
 */
async function writeUrgentAlert(item) {
  const system = `You write short, warm, direct Slack alerts for sustainability
executives at US BCSD. This is a single time-sensitive item, not the weekly digest.
Open like you're catching a colleague's attention (not a generic "Urgent:" label),
explain what happened in plain language, and say briefly why it matters to them.
Keep it to 3-5 sentences. No headline-and-link format — write it as digested,
human commentary. End with the source link on its own line.`;

  const userContent = `Item: ${item.title}\nSource: ${item.source}\nLink: ${item.link}\nDetails: ${item.contentSnippet}`;

  return callClaude(system, userContent, 400);
}

/**
 * Writes the full weekly digest across the top N items, in a warm,
 * "good morning, here's what's happening" voice — woven prose, not links.
 */
async function writeWeeklyDigest(items) {
  const system = `You write a weekly sustainability news digest for US BCSD
executives, posted to Slack. Voice: warm, direct, like a well-informed colleague
giving a morning update — not a news aggregator. Open with a brief, genuine greeting.
Then walk through each story as digested commentary: what happened, why it matters
to US BCSD/their members, and any judgment call worth flagging. Do NOT just list
headlines with links. Weave the stories into a few short paragraphs or a lightly
structured update. Close with a brief, natural sign-off. Include each item's source
link inline or at the end of its section (not as a bare bullet list).
Keep the whole thing readable in under 90 seconds.`;

  const userContent = JSON.stringify(
    items.map((item) => ({
      title: item.title,
      source: item.source,
      link: item.link,
      snippet: item.contentSnippet,
    }))
  );

  return callClaude(system, userContent, 1800);
}

module.exports = { scoreItems, writeUrgentAlert, writeWeeklyDigest };
