# Harmony

A self-hosted chat and voice platform for small groups of friends.

---

**This project is fully vibe-coded** using Claude Opus 4.6. It's a fun side project and not built for robustness, scalability, or reliability.

---

## What is this?

Harmony is a single-server communication app. Think of it like running your own TeamSpeak or Mumble server, except it also has text channels, DMs, emoji, GIFs, and a modern web UI.

Every instance of Harmony represents one server for one group of people. There's no multi-tenancy, no server discovery, no federation. You spin it up, invite your friends, and use it. That's the whole product.

With Discord's increasingly frequent outages and the general direction major platforms are heading, sometimes it's nice to just have your own thing running on a cheap VPS that works for your group of 10-20 people without depending on someone else's infrastructure.

It won't scale to thousands of users. The database is a single SQLite file. But for a handful of friends who want a private space to hang out — it does the job.

## Features

- **Text channels** with categories, message editing, replies, and search
- **Voice channels** with multi-party audio/video (mediasoup SFU)
- **Screen sharing** in voice channels
- **Direct messages**
- **Custom emoji** and emoji reactions
- **GIF picker** via Giphy
- **Soundboard** with custom sound clips
- **File attachments** and image/video embeds
- **Role-based permissions**
- **User presence** (online / do not disturb / invisible)
- **Push notifications**
- **Typing indicators**, read receipts, unread tracking
- **Message search** with filters
- **Desktop app** for Windows, macOS, and Linux

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Bun |
| Database | SQLite (Prisma + libSQL) |
| Frontend | SvelteKit + Tailwind CSS |
| Voice/Video | mediasoup SFU (Node.js subprocess) |
| Desktop | Tauri |
| Deployment | Single Docker container |

The entire application runs as a single process. The database is an SQLite file. Redis is mocked in-memory. The frontend is served as static files by the backend. The SFU runs as a managed subprocess. Everything fits in one container.

## Running locally

```sh
bun install
cp .env.example .env

# Create the database
cd backend && DATABASE_URL="file:$(pwd)/harmony.db" bunx prisma migrate dev && cd ..

# Start the backend (auto-starts the media server)
bun --env-file .env backend/src/index.ts

# In another terminal — frontend dev server with hot reload
bun run dev:frontend
```

Or use the VS Code launch config — **Dev** starts both.

## Deployment

One container. Two files on your server.

```sh
mkdir -p /opt/harmony
# Place docker-compose.yml and .env in /opt/harmony
# Update the image in docker-compose.yml to your GHCR image
# Fill in .env with production values (see .env.example)

docker compose up -d
```

CI pushes to GHCR on every merge to `main` and SSHes into the server to `docker compose pull && docker compose up -d`.

### Required ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 3000 | TCP | HTTP (reverse proxy this) |
| 40000-40100 | UDP + TCP | WebRTC media (mediasoup) |

Set `MEDIASOUP_ANNOUNCED_IP` in `.env` to your server's public IP.

## Desktop app

Tauri builds are produced by CI for every push to `main`:
- **Windows** — `.exe` (NSIS) and `.msi`
- **macOS** — `.dmg`
- **Linux** — `.deb`, `.AppImage`, `.rpm`

Check the Actions tab for downloadable artifacts.
