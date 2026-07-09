import { Client } from "@xhayper/discord-rpc";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fetch from "node-fetch";
import "dotenv/config";

const execAsync = promisify(exec);

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1524781530956693654";
if (!CLIENT_ID) {
  console.error(
    "Missing DISCORD_CLIENT_ID. Create a .env file (see .env.example) with your Discord application's client ID.",
  );
  process.exit(1);
}

// How often to poll Apple Music for changes (ms). Discord's own rate limit is
// roughly 1 presence update per 15s, so we only actually call setActivity
// when something meaningful changed, or every REFRESH_MS as a keepalive.
const POLL_MS = 3000;
const REFRESH_MS = 15000;

const rpc = new Client({ clientId: CLIENT_ID });

let lastSignature = null;
let lastUpdate = 0;
const artworkCache = new Map();

/**
 * Ask the Music app (via AppleScript/osascript) what's currently playing.
 * Returns null if Music isn't running or nothing is playing.
 */
async function getNowPlaying() {
  const script = `
    tell application "System Events"
      set isRunning to (name of processes) contains "Music"
    end tell
    if isRunning is false then
      return "NOT_RUNNING"
    end if
    tell application "Music"
      if player state is stopped then
        return "STOPPED"
      end if
      set trackName to name of current track
      set trackArtist to artist of current track
      set trackAlbum to album of current track
      set trackDuration to duration of current track
      set playerPos to player position
      set playerState to player state as string
      return trackName & "|||" & trackArtist & "|||" & trackAlbum & "|||" & trackDuration & "|||" & playerPos & "|||" & playerState
    end tell
  `;

  try {
    const { stdout } = await execAsync(
      `osascript -e '${script.replace(/'/g, "'\\''")}'`,
    );
    const result = stdout.trim();

    if (result === "NOT_RUNNING" || result === "STOPPED" || result === "") {
      return null;
    }

    const [title, artist, album, duration, position, state] =
      result.split("|||");

    return {
      title,
      artist,
      album,
      duration: parseFloat(duration), // seconds
      position: parseFloat(position), // seconds
      isPlaying: state === "playing",
    };
  } catch (err) {
    // Music app not installed / AppleScript denied / etc.
    return null;
  }
}

/**
 * Look up album art via the (public, keyless) iTunes Search API and return
 * a high-res artwork URL, or null if nothing is found.
 */
async function getArtworkUrl(track) {
  const key = `${track.artist}::${track.album}`;
  if (artworkCache.has(key)) return artworkCache.get(key);

  try {
    const term = encodeURIComponent(`${track.artist} ${track.album}`);
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const raw = data?.results?.[0]?.artworkUrl100;
    const artwork = raw ? raw.replace("100x100bb", "512x512bb") : null;
    artworkCache.set(key, artwork);
    return artwork;
  } catch {
    return null;
  }
}

async function updatePresence() {
  const track = await getNowPlaying();

  if (!track) {
    if (lastSignature !== null) {
      await rpc.user?.clearActivity();
      lastSignature = null;
    }
    return;
  }

  const signature = `${track.title}::${track.artist}::${track.isPlaying}`;
  const now = Date.now();

  // Only push an update if something actually changed, or enough time has
  // passed that we want to refresh the timestamps/progress bar anyway.
  if (signature === lastSignature && now - lastUpdate < REFRESH_MS) {
    return;
  }

  const artworkUrl = await getArtworkUrl(track);
  const startTimestamp = new Date(now - track.position * 1000);
  const endTimestamp = new Date(
    now - track.position * 1000 + track.duration * 1000,
  );

  await rpc.user?.setActivity({
    type: 2, // LISTENING
    details: track.title,
    state: track.artist,
    largeImageKey: artworkUrl || "apple_music_logo", // fallback: upload an asset with this key in the Dev Portal
    largeImageText: track.album,
    smallImageKey: track.isPlaying ? "play" : "pause",
    smallImageText: track.isPlaying ? "Playing" : "Paused",
    ...(track.isPlaying ? { startTimestamp, endTimestamp } : {}),
    instance: false,
  });

  lastSignature = signature;
  lastUpdate = now;
}

rpc.on("ready", () => {
  console.log(`Discord RPC connected as ${rpc.user?.username}`);
  updatePresence();
  setInterval(updatePresence, POLL_MS);
});

rpc.on("disconnected", () => {
  console.log("Disconnected from Discord. Is the Discord desktop app running?");
});

rpc.login().catch((err) => {
  console.error(
    "Failed to connect to Discord. Make sure the Discord desktop app is open, then try again.",
  );
  console.error(err);
  process.exit(1);
});
