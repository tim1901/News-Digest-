const crypto = require('crypto');

/**
 * Verifies a Slack slash command request using the signing secret.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackRequest(event) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET is not set');
    return false;
  }

  const headers = event.headers || {};
  const timestamp = headers['x-slack-request-timestamp'] || headers['X-Slack-Request-Timestamp'];
  const signature = headers['x-slack-signature'] || headers['X-Slack-Signature'];

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes to guard against replay attacks
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${event.body}`;
  const mySignature =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

  const a = Buffer.from(mySignature, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifySlackRequest };
