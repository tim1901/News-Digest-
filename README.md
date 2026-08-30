# US BCSD Sustainability Digest

Fully automatic weekly Slack roundup of sustainability news, written in a
human voice — plus same-day alerts for anything urgent, and an on-demand
Slack slash command to trigger either one whenever you want.

## How it works

- **News source**: RSS feeds (GreenBiz, ESG Today, Google News RSS
  searches for sustainability/policy terms), pulled automatically via
  the `rss-parser` library. See `lib/rss.js` to add/remove feeds.
- **`daily-check`** (runs daily on a schedule): pulls fresh RSS items,
  scores each for relevance and urgency via Claude, immediately posts a
  Slack alert for anything urgent (score ≥ 8), and queues everything else.
- **`weekly-digest`** (runs weekly on a schedule): pulls the week's queue,
  takes the top 5 by relevance, has Claude write it up as one warm, human
  digest (not a link list), posts it to Slack, and archives the queue.
- **`slack-command-background`**: a Slack slash command handler. Type
  `/digest` in Slack to trigger the weekly digest right now, or
  `/digest check` to trigger a fresh news check right now. Same logic as
  the scheduled runs — just callable on demand.
- **Storage**: Netlify Blobs — a key-value store built into Netlify,
  already available on your account. No third-party service, sign-up,
  or extra API key needed. It just holds the running weekly queue
  between runs.

## 1. Environment variables (set in Netlify site settings)

| Variable | Value |
|---|---|
| `SLACK_BOT_TOKEN` | Your `xoxb-...` bot token |
| `SLACK_CHANNEL_ID` | Target channel ID (e.g. `C03AXN77GPP`) |
| `SLACK_SIGNING_SECRET` | Your Slack app's Signing Secret (see step 2) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

Never commit these — set them in Netlify's dashboard under
Site settings → Environment variables.

## 2. Add the slash command to your Slack app

In your existing Slack app config (api.slack.com/apps → your app):

1. Go to **Basic Information** and copy the **Signing Secret** — this is
   what proves incoming requests actually came from Slack. Add it as
   `SLACK_SIGNING_SECRET` above.
2. Go to **Slash Commands** → **Create New Command**:
   - Command: `/digest`
   - Request URL: `https://<your-site>.netlify.app/.netlify/functions/slack-command-background`
   - Short description: "Run the sustainability digest on demand"
   - Usage hint: `[check]`
3. Save, and reinstall the app to the workspace if Slack prompts you to
   (adding a new command requires a re-install for the scope to take
   effect).

Once deployed, typing `/digest` in the channel compiles and posts the
weekly digest immediately; `/digest check` runs a fresh news scan and
posts any urgent items (plus a summary either way).

## 3. Deploy

```bash
npm install
netlify deploy --prod
```

Netlify picks up the schedules from `netlify.toml` automatically. You can
adjust the cron times there — currently daily check at 12:00 UTC and
weekly digest Mondays at 13:00 UTC.

## 4. Tuning the voice

The tone lives entirely in `lib/claude.js` — `writeWeeklyDigest` and
`writeUrgentAlert`. If the output doesn't sound right yet, the fastest
fix is feeding it 2-3 real examples of the tone you want directly in
that system prompt rather than just describing it.

## 5. Tuning relevance and sources

`RELEVANCE_BRIEF` in `lib/claude.js` and the `FEEDS` list in `lib/rss.js`
are the two levers for keeping signal-to-noise high. Worth revisiting
after the first couple of weeks once you see what's clearing the bar —
and worth adding more targeted feeds as you find good sustainability/
policy sources beyond the starter list.
