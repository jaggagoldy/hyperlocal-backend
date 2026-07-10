# Monitoring & Alerting (RG-001 item 7)

> The operational-detection layer: not "do logs exist" (they do — pino + `reqId`,
> `/health`, `errorHandler`) but **"is someone automatically notified when
> production is failing."** Required — with at least one alert path verified
> firing — before Code Freeze.

## Division of responsibility

| Signal | Owner | Mechanism |
|---|---|---|
| **Full outage / process down** | External uptime monitor | Polls `/health` from outside; alerts when unreachable or `degraded`. An in-process alert cannot fire once the process is dead — this must be external. |
| **Unhandled exception** | App | `process.on('uncaughtException'|'unhandledRejection')` → best-effort `sendAlert` before exit ([`server.js`](../../src/server.js)). |
| **Sustained 5xx error rate** | App | Response-finish hook counts 5xx in a rolling window; alerts once per cooldown ([`alertOn5xx.js`](../../src/middlewares/alertOn5xx.js)). |

All app alerts fan out to **both** configured channels — a Slack/Discord webhook
(`ALERT_WEBHOOK_URL`) and email (`ALERT_EMAIL`, via Resend) — see
[`alert.service.js`](../../src/services/alert.service.js). Unset channels are
skipped; unset entirely = alerting disabled (no crash).

## Configure the channels

Set in the Render dashboard (and locally in `.env` to test):
- `ALERT_WEBHOOK_URL` — a Slack or Discord **incoming webhook** URL.
  - Slack: create an app → Incoming Webhooks → add to a channel → copy the URL.
  - Discord: channel → Edit → Integrations → Webhooks → New Webhook → copy URL.
- `ALERT_EMAIL` — the address to receive alerts (uses the existing `RESEND_API_KEY`).
- `ALERT_5XX_THRESHOLD` — optional; server errors within 5 min that trip the alert (default 5).

## Provision the external monitor (health / outage)

Any uptime monitor with a free tier works (UptimeRobot, BetterStack, Healthchecks.io):
1. Add an HTTP(s) monitor on `https://<prod-host>/health`, interval ≤ 5 min.
2. Alert condition: non-200 **or** response body `status` ≠ `success` (some monitors
   support keyword match — alert if `degraded` is present).
3. Route its notification to the same channel(s) as above.

> This is a founder/ops action (it needs an account this repo can't create). Once
> live, it covers signals #1 (outage) — the app covers #2 and #3.

## Fire-test (required — evidence, not just config)

A configured-but-never-fired alert does **not** satisfy item 7. Verify each path:

1. **Delivery (webhook + email):**
   ```bash
   ALERT_WEBHOOK_URL="..." ALERT_EMAIL="you@example.com" RESEND_API_KEY="..." \
   node scripts/alert-test.js
   ```
   Confirm the message arrives in the channel and inbox.
2. **Outage:** pause the service (or point the monitor at a bad path) and confirm the
   uptime monitor notifies; then restore.
3. **5xx rate:** (staging/local) drive ≥ `ALERT_5XX_THRESHOLD` 5xx responses within 5
   min and confirm one alert fires (not one per error).

Record the evidence (message links / screenshots) against RG-001 item 7.
