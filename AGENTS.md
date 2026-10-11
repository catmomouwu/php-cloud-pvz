# Cloud PvZ — Agent Guide

Rules for anyone (human or agent) changing this repository. Read [README.md](README.md) for setup and [docs/design.md](docs/design.md) for the save model, cloud sync and editor design.

## Commits, branches and pull requests

- **Commit messages must be in English.** Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>: <summary>` with `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `build` or `style`, an optional scope (`feat(editor): …`), a short imperative summary, and an optional body explaining why.
- The type matters: release notes are generated from commit messages by git-cliff ([cliff.toml](cliff.toml)), grouped by type. Commits that don't follow the format are left out of the changelog.
- One logical change per commit. Don't mix refactors with behaviour changes.
- Pull request titles follow the same `<type>: <summary>` format, in English.
- Never rewrite published history on `main` (no force pushes).

## Releases and deployment

- Releases are made by pushing a tag `vX.Y.Z` (e.g. `v1.2.0`); a hyphen marks a pre-release (`v1.3.0-beta.1`). Bump `version` in `package.json` in the commit you tag.
- [release.yml](.github/workflows/release.yml) creates the GitHub Release with a generated changelog, then calls [deploy.yml](.github/workflows/deploy.yml), which builds, applies D1 migrations and deploys to Cloudflare Workers. Pushing to `main` does not deploy.
- Runtime configuration (`NITRO_*`) lives in Cloudflare Worker secrets; the only GitHub secret is `CLOUDFLARE_API_TOKEN`. Don't add runtime secrets to workflows or files.
- [update-engine.yml](.github/workflows/update-engine.yml) opens PRs when upstream PvZ-Portable releases a new version. Don't edit `web/public/game/pvz-portable.{js,wasm}` by hand; play-test engine PRs locally before merging.

## Game assets and secrets

- `main.pak` and any other game assets must never enter git, build output or the Docker image. `scripts/postbuild-web.mjs` fails the build on `*.pak`; keep that check.
- Deployed instances serve `main.pak` only to signed-in users (`server/routes/main.pak.ts`), from `NITRO_GAME_PAK_PATH` or `game/main.pak` in the S3 bucket.
- Never commit `.env`, tokens, keys or screenshots of the game. Test scripts and screenshots belong outside the repository.

## Code

- TypeScript everywhere; keep `pnpm type-check` clean. Run `pnpm type-check` and `pnpm build` before committing.
- `shared/` is used by both the frontend and the server: no DOM or Node-only APIs there.
- Save formats follow PvZ-Portable exactly (`shared/pvz/`). Values written by the save editor must match what the game itself writes; cite the engine function you mirror in a comment. Unknown bytes are preserved, never dropped (round-trips must be byte-identical).
- The server must stay portable: S3-compatible storage through `aws4fetch`, SQLite through Drizzle (`node:sqlite` locally / in Docker, D1 on Cloudflare). Don't use Cloudflare-specific SDKs or bindings beyond D1.
- Database changes: edit `server/db/schema.ts`, then run `pnpm db:generate` and commit the generated migration with a descriptive file name.
- Match the style of the surrounding code: naming, comment density and the existing language of comments (most code comments are Simplified Chinese).

## UI

- Read [packages/ui/AGENTS.md](packages/ui/AGENTS.md) (the @felinic/ui design rules) before UI work. Compose library components and use design tokens; no raw colors or hand-rolled widgets when a component exists.
- All user-facing text goes through i18n (`web/src/i18n/locales/`). Keep `zh-CN` and `en` in sync — every key must exist in both.
- Verify UI changes in a browser (light and dark, wide and narrow) before calling them done.
- Destructive or bulk actions need a confirmation dialog.
