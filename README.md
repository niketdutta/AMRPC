# AMRPC — Apple Music Rich Presence

**Turn your Discord status into a live now-playing ticker for Apple Music.**

Song title, artist, album art, and a real-time progress bar — the same kind
of presence Spotify users get, but for Apple Music. No Spotify account
required, no paid API, no background service from Apple. Just your Mac
talking to Discord.

---

## How it works

AMRPC is three small pieces glued together, polling in a loop:

```
 Music.app  ──AppleScript──▶  AMRPC  ──iTunes Search API──▶  album art
                                │
                                └──local IPC──▶  Discord client
```

**1. Ask Apple Music what's playing.**
Every few seconds, AMRPC runs a short AppleScript against the Music app —
the same scripting bridge that's powered Mac automation for over two
decades — asking for the track name, artist, album, playback position, and
whether it's playing or paused. No permissions dialog, no API key, because
this is just talking to an app that's already running on your machine.

**2. Find the artwork.**
Apple Music's local scripting interface doesn't hand over album art
directly, so AMRPC looks it up by artist + album name against Apple's free,
keyless iTunes Search API and caches the result so it's not re-fetched on
every poll.

**3. Hand it to Discord.**
AMRPC connects to your **local Discord desktop client** over IPC — the same
low-level channel games use to show "playing" statuses — and sets a Rich
Presence activity: title, artist, artwork, and a start/end timestamp pair
that Discord renders as a live progress bar. Pause the song and the bar
disappears and the icon flips to a pause glyph; quit Music and your status
clears itself entirely.

That's the whole loop. No server, no database, no account linking — it's a
script quietly relaying local state from one app to another.

> **Why doesn't it say "Listening to Spotify"-style with the exact same
> badge?** That specific badge is hard-coded by Discord to a short list of
> first-party partners. AMRPC runs as *your own* Discord application
> instead, so you get the identical layout — art, title, artist, progress
> bar — under a name you control.

---

## Requirements

- macOS with the native **Music** app
- [Node.js](https://nodejs.org/) 18+
- The **Discord desktop app**, open and logged in (browser Discord can't do
  local IPC)

## Quick start

**1. Register a Discord application**
Head to the [Discord Developer Portal](https://discord.com/developers/applications) →
**New Application** → copy the **Client ID**.

**2. Install**
```bash
npm install
cp .env.example .env
```
Paste your client ID into `.env`:
```
DISCORD_CLIENT_ID=1234567890123456789
```

**3. Run**
```bash
npm start
```
Play something in Apple Music — your Discord status updates within
seconds.

**4. (Optional) Make it start automatically**
See `com.local.apple-music-discord-rpc.plist` — a `launchd` LaunchAgent
that keeps AMRPC running quietly in the background from login onward, so
it's simply *there* whenever you open Apple Music. Setup steps are at the
bottom of this file.

---

## Custom art assets (optional)

Album art is fetched automatically. For polish, upload two small icons in
the Developer Portal under **Rich Presence → Art Assets**:

| Key | Used for |
|---|---|
| `play` | small icon shown while a track is playing |
| `pause` | small icon shown while paused |
| `apple_music_logo` | fallback large image if no artwork is found |

---

## Run it in the background

**Option A — `launchd` (native, recommended)**
```bash
# edit the paths inside the plist first
cp com.local.apple-music-discord-rpc.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.local.apple-music-discord-rpc.plist
```
Starts at login, restarts itself if it ever crashes, sits idle until Music
is playing something.

- Check it's alive: `launchctl list | grep apple-music`
- Logs: `/tmp/apple-music-discord-rpc.log` / `.error.log`
- Stop it: `launchctl unload ~/Library/LaunchAgents/com.local.apple-music-discord-rpc.plist`

**Option B — `pm2`**
```bash
npm install -g pm2
pm2 start index.js --name amrpc
pm2 save
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Failed to connect to Discord" | Open the Discord **desktop app** and log in — browser tabs don't expose local IPC |
| Status never appears | Discord → Settings → Activity Privacy → enable "Display current activity as a status message" |
| Wrong or missing artwork | Lookup is by artist + album name; obscure or mistagged albums fall back to the `apple_music_logo` asset |
| Works, then goes stale | Make sure Music is still the foreground *player* — AMRPC reads player state, not just app focus |

---

## Under the hood, one more level down

- **AppleScript bridge** — `osascript` invoked as a child process; a single
  `tell application "Music"` block returns everything needed in one
  round-trip.
- **Rate-limit friendly** — AMRPC only calls Discord's `setActivity` when
  the track or play state actually changes, or every 15s as a keepalive,
  rather than on every 3-second poll.
- **IPC client** — [`@xhayper/discord-rpc`](https://www.npmjs.com/package/@xhayper/discord-rpc),
  an actively maintained fork of Discord's original (now-archived)
  `discord-rpc` package.
- **Artwork** — Apple's public `itunes.apple.com/search` endpoint, no key,
  no auth, cached per artist/album for the life of the process.

---

*AMRPC is an unofficial, local-only script. It isn't affiliated with
Apple, Discord, or Spotify.*
