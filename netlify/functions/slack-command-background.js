const querystring = require('querystring');
const { verifySlackRequest } = require('../../lib/slack-verify');
const { runDailyCheck, runWeeklyDigest } = require('../../lib/jobs');
const { postToSlack } = require('../../lib/slack');

// NOTE the "-background" suffix in this file's name: Netlify treats any
// function named *-background as a background function. It automatically
// responds 202 to Slack within milliseconds (satisfying Slack's 3-second
// ack requirement) and then keeps running this handler for up to 15
// minutes in the background — plenty of time for the Claude calls + Slack
// post. The actual result gets posted to the channel via postToSlack, not
// returned in the HTTP response (Slack won't see the return value).
//
// Slash command setup (in your Slack app config, under "Slash Commands"):
//   Command:      /digest
//   Request URL:  https://<your-site>.netlify.app/.netlify/functions/slack-command-background
//   Usage hint:   [check]
//
// Usage in Slack:
//   /digest          -> compiles and posts the weekly digest right now
//   /digest check     -> runs a fresh news check right now (same as the
//                        daily job), posting urgent alerts if any, plus a
//                        summary confirmation either way

exports.handler = async (event) => {
  if (!verifySlackRequest(event)) {
    console.error('Rejected Slack command: signature verification failed');
    return;
  }

  const params = querystring.parse(event.body);
  const text = (params.text || '').trim().toLowerCase();

  try {
    if (text === 'check') {
      await runDailyCheck({ announceSummary: true });
    } else {
      await runWeeklyDigest();
    }
  } catch (err) {
    console.error('slack-command-background failed:', err);
    try {
      await postToSlack(`Tried to run that but hit an error: ${err.message}`);
    } catch (_) {
      // if even the error notification fails, it's already logged above
    }
  }
};
