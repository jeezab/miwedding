# Google Apps Script: RSVP -> Google Sheets + Telegram

## 1) Create Google Sheet
1. Create a spreadsheet, for example `Wedding RSVP`.
2. Copy spreadsheet ID from URL (`/d/<ID>/edit`).

## 2) Create Apps Script project
1. Open [script.new](https://script.new).
2. Replace default file content with `Code.gs` from this folder.
3. Save project.

## 3) Set Script Properties
Open `Project Settings` -> `Script properties` and add:
- `SHEET_ID` = your spreadsheet ID
- `BOT_TOKEN` = new token from BotFather
- `TG_CHAT_ID` = numeric personal chat ID
- `RSVP_API_KEY` = random long secret (optional but recommended)

## 4) Deploy as Web App
1. `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone`.
5. Deploy and copy `Web app URL` (`.../exec`).

## 5) Configure frontend
In `scripts/config.js` set:
- `rsvpEndpoint` = `https://script.google.com/macros/s/.../exec`
- `rsvpApiKey` = same value as `RSVP_API_KEY` (or empty if disabled)
- `rsvpApiKeyHeader` = `false` (recommended for Apps Script)

## 6) Test
1. Submit form on website.
2. Verify new row in sheet `Responses`.
3. Verify Telegram notification in your private chat.

## How to get personal `TG_CHAT_ID`
1. Start chat with your bot and send any message (for example `/start`).
2. Open in browser:
   `https://api.telegram.org/bot<NEW_BOT_TOKEN>/getUpdates`
3. Find `chat.id` in JSON response and use this number as `TG_CHAT_ID`.

## Notes
- Keep bot token only in Script Properties, never in client files.
- If old token was exposed, revoke it in BotFather and use a new one.
- The script returns success only if both destinations are successful.
