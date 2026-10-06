# Pharmacy POS — Deploy Guide (Google Apps Script + Google Sheets)

## What you get
- `Code.gs` — backend (runs in Google Apps Script, stores everything in your Google Sheet)
- `deploy/index.html` — the full modern web app (single file)

## Deploy (one time, ~5 minutes)
1. Create a new Google Sheet (any name, e.g. "Pharmacy POS DB").
2. In the Sheet: **Extensions → Apps Script**. Delete the default `Code.gs` content,
   paste this project's `Code.gs`, save.
3. In the Apps Script editor: **+ → HTML**, name the file `index`,
   paste the contents of `deploy/index.html`, save.
4. In the toolbar function dropdown pick **`setupSheet`** → **Run**.
   Grant the requested permissions (it needs to read/write your Sheet).
   This creates all 25 data tabs + an admin user + demo medicines.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (or "Anyone with Google account")
   - Deploy → copy the Web app URL. That's your Pharmacy POS.
6. Sign in with **admin / admin123** (change the password in Users after first login).

## Local preview (no Google account needed)
Open `deploy/index.html` directly in a browser — it runs on a built-in demo
database (localStorage). Login: admin / admin123. Everything works except the
AI chat (needs a key in Settings) and WhatsApp API sending (uses wa.me links).

## Notes
- The app auto-detects where it runs: inside Apps Script it calls the Sheet
  backend; opened as a file it uses the local demo database.
- Thermal receipt printing: Settings → Receipt → 80mm.
- WhatsApp bill sharing uses wa.me links (no API key needed).
- AI chat: Settings → AI → choose Gemini, paste a (free) Gemini API key.
- Rebuild `deploy/index.html` after editing sources: `python3 build.py`.
