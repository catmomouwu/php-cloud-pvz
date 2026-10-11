# Cloud PvZ

Play Plants vs. Zombies right in your browser. Cloud PvZ runs [PvZ-Portable](https://github.com/wszqkzqk/PvZ-Portable), an open-source cross-platform reimplementation of the game, compiled to WebAssembly, and wraps it with an account system, cloud-synced saves and a save editor.

## Features

- **Play in the browser**: the game runs in the page; music, sound and scaling can be adjusted next to it, and mute applies instantly.
- **Cloud saves**: sign in and every in-game player syncs to your account on its own, with conflict handling across devices.
- **Backups**: the last 20 sync versions of each player are kept and can be restored; up to 10 manual snapshots per player can be created, exported and restored.
- **Save editor**: adventure level, mini-games / puzzles / survival, shop purchases, coins and the Zen Garden (with a rendered garden view), plus quick actions such as "unlock everything".
- **Almanac and achievements**: animated plant and zombie cards and the 20 achievements, rendered from your local game resources.
- **Import and export**: import saves exported by this site or the `userdata` folder of the original game / PvZ-Portable.
- **Languages**: Simplified Chinese and English.

## Game resources

The game needs its resource file `main.pak`. Once you have it, put it here:

| Setup | Location |
|---|---|
| Local development | `web/public/main.pak` |
| Docker | mount it to `/app/game/main.pak` in the container (see below) |

`*.pak` files are git-ignored and kept out of build output and the Docker image. In Docker the server only hands `main.pak` to signed-in users.

## Local development

Requirements: Node.js 24, pnpm, Docker (for the local S3 server).

```bash
git clone --recurse-submodules https://github.com/sheepbox8646/cloud-pvz.git
cd cloud-pvz
pnpm install
cp .env.example .env        # set NITRO_AUTH_SECRET, e.g. openssl rand -base64 32
pnpm dev:s3                 # local S3 (MinIO): API on :9100, console on :9101
# put main.pak at web/public/main.pak
pnpm dev                    # http://localhost:5173
```

`pnpm dev` starts Vite (frontend, port 5173) and Nitro (backend, port 3000); Vite proxies `/api` to Nitro. The local database is `.data/cloud-pvz.sqlite` (Node's built-in `node:sqlite`) and is migrated on first start.

After changing `server/db/schema.ts`, run `pnpm db:generate` to create a migration.

Other scripts: `pnpm type-check`, `pnpm build`, `pnpm preview`.

## Docker

```bash
docker build -t cloud-pvz .
docker run -d -p 3000:3000 \
  --env-file .env \
  -v cloud-pvz-data:/app/.data \
  -v /path/to/main.pak:/app/game/main.pak:ro \
  cloud-pvz
```

- `/app/.data` holds the SQLite database; keep it on a volume.
- Set `NITRO_AUTH_BASE_URL` and `NITRO_AUTH_TRUSTED_ORIGINS` to the address you open in the browser, and point the `NITRO_S3_*` variables at your S3-compatible storage.

## Configuration

All settings are Nitro runtime config, read from environment variables prefixed with `NITRO_` (see [.env.example](.env.example)):

| Variable | Description |
|---|---|
| `NITRO_AUTH_SECRET` | better-auth secret, required |
| `NITRO_AUTH_BASE_URL` / `NITRO_AUTH_TRUSTED_ORIGINS` | the address users open in the browser |
| `NITRO_AUTH_IP_ADDRESS_HEADERS` | trusted client-IP header for rate limiting, e.g. `x-forwarded-for` behind a reverse proxy; leave empty otherwise |
| `NITRO_S3_ENDPOINT` / `NITRO_S3_REGION` / `NITRO_S3_BUCKET` / `NITRO_S3_ACCESS_KEY_ID` / `NITRO_S3_SECRET_ACCESS_KEY` | S3-compatible storage for saves |
| `NITRO_DATABASE_PATH` | SQLite file path |
| `NITRO_GAME_PAK_PATH` | path of `main.pak` when deployed (`/app/game/main.pak` in Docker) |

## Engine updates

The WebAssembly build of PvZ-Portable lives in `web/public/game/`, with its version in `web/public/game/VERSION`. The [Update engine](.github/workflows/update-engine.yml) workflow checks upstream releases daily; when a new version is published it builds it to WebAssembly from source and opens a pull request that replaces the engine files. It can also be started manually for a specific tag.

## Project structure

```
web/              frontend (Vite root)
  index.html      main app
  player.html     game iframe, loads the engine from public/game/
  public/game/    PvZ-Portable WebAssembly build
server/           Nitro backend (API, database schema and migrations, auth and storage)
shared/pvz/       save / registry formats, save editing and cloud packaging (shared by both sides)
packages/ui/      @felinic/ui (git submodule)
docs/             design notes
```

## Acknowledgements and disclaimer

- Thanks to wszqkzqk (Zhou Qiankang) and all contributors for [PvZ-Portable](https://github.com/wszqkzqk/PvZ-Portable), the open-source cross-platform reimplementation the game in this project runs on.
- Thanks to PopCap Games for creating Plants vs. Zombies.
- The Plants vs. Zombies name, trademarks and all game assets belong to PopCap Games / Electronic Arts. This project is not affiliated with, authorized or endorsed by PopCap Games or Electronic Arts.
- Game content is for study and discussion only, not for commercial use. Before using it, you must buy [Plants vs. Zombies: Game of the Year Edition on Steam](https://store.steampowered.com/app/3590/Plants_vs_Zombies_GOTY_Edition/).

## License

Cloud PvZ is released under the [GPL-3.0](LICENSE) license and provided "as is", without warranty of any kind. PvZ-Portable is licensed under LGPL-3.0-or-later.
