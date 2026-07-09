# Apple Music Discord Rich Presence

Shows what you're listening to in Apple Music (macOS) as a custom Discord
Rich Presence status — song title, artist, album art, and a progress bar —
similar to the built-in Spotify integration.

> Note: Discord reserves the exact "Listening to Spotify" badge/UI for a
> handful of whitelisted first-party integrations. This script instead
> creates a custom Rich Presence activity under **your own Discord
> application**, which looks very similar (title, artist, artwork, progress
> bar) but shows your app's name instead of "Spotify".

## Requirements

- macOS with the native **Music** app
- [Node.js](https://nodejs.org/) 18+
- The **Discord desktop app** running and logged in (Rich Presence talks to
  the local Discord client over IPC — it will not work in the browser)

## 1. Create a Discord Application

1. Go to https://discord.com/developers/applications and click **New
   Application**. Name it whatever you want (e.g. "Apple Music").
2. Copy the **Application ID / Client ID** from the General Information tab.
3. (Optional but recommended) Go to **Rich Presence → Art Assets** and
   upload two small icons with these exact keys:
   - `play` — a play icon
   - `pause` — a pause icon
   - `apple_music_logo` — an Apple Music logo, used as a fallback large
     image if album art can't be found
   These are referenced by key in `index.js`. Album art itself is fetched
   automatically from Apple's public iTunes Search API at runtime, so you
   don't need to upload art per-song.

## 2. Install and configure

```bash
npm install
cp .env.example .env
```

Open `.env` and paste in your client ID:

```
DISCORD_CLIENT_ID=1234567890123456789
```

## 3. Run it

Make sure Discord and Apple Music are both open, then:

```bash
npm start
```

Play a song in Apple Music — within a few seconds your Discord status should
update. Pausing switches the small icon to a pause symbol and removes the
countdown; stopping/quitting Music clears the status entirely.

## How it works

- `index.js` polls the Music app every few seconds using AppleScript
  (`osascript`) to read the current track, artist, album, position, and
  play state — no special permissions or Apple Music API key needed.
- Album artwork is looked up via Apple's free iTunes Search API
  (`itunes.apple.com/search`), no API key required.
- Presence updates are sent to your local Discord client over IPC via the
  [`@xhayper/discord-rpc`](https://www.npmjs.com/package/@xhayper/discord-rpc)
  library (an actively maintained fork of the now-archived official
  `discord-rpc` package).

## Running it in the background

To keep it running without a terminal window open, you can use `pm2`:

```bash
npm install -g pm2
pm2 start index.js --name apple-music-rpc
pm2 save
```

Or wrap it in a simple `launchd` plist if you want it to start on login —
happy to put that together if you want it.

## Troubleshooting

- **"Failed to connect to Discord"** — Discord desktop app must be open and
  you must be logged in.
- **Nothing shows up** — make sure "Display current activity as a status
  message" is enabled in Discord → Settings → Activity Privacy.
- **Wrong/missing artwork** — the iTunes lookup matches on artist + album
  name; very obscure or mistagged albums may not be found, in which case it
  falls back to the `apple_music_logo` asset key.
