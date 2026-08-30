const fetch = require('node-fetch');

const SLACK_API = 'https://slack.com/api/chat.postMessage';

async function postToSlack(text) {
  const res = await fetch(SLACK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: process.env.SLACK_CHANNEL_ID,
      text,
      unfurl_links: false,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack post failed: ${data.error}`);
  }
  return data;
}

module.exports = { postToSlack };
