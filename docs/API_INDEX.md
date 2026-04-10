# API Index

This file maps the API routes by domain so new contributors can locate backend logic quickly.

## Auth and session

- `POST /api/auth/register` - create account
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET/DELETE /api/auth/accounts` - saved account/session helpers

## User settings and profile

- `GET/PATCH /api/settings` - user settings payload
- `GET/PATCH /api/profile` - profile update
- `POST /api/profile/change-email` - change email flow
- `POST /api/profile/change-password` - change password flow
- `GET/PATCH /api/profile/connections` - linked profile connections

## Content read APIs (user-facing)

- `GET /api/search` - anime/manga search
- `GET /api/anime/[id]` - anime details payload
- `GET /api/watch/[id]` - watch payload resolver (episode/source/settings/player config)
- `POST /api/watch/telemetry` - playback failure and source-switch telemetry
- `GET/POST /api/history` - latest anime progress and per-episode history writes
- `GET/POST/DELETE /api/favorites` - favorites
- `GET/POST /api/favorites/folders` - favorite folders
- `GET/POST /api/comments` - comment threads
- `GET/POST /api/ratings` - anime ratings
- `GET /api/feed` - activity feed
- `GET/POST /api/suggestions` - user suggestions
- `GET/POST /api/bug-reports` - user bug report submit and retrieval
- `GET /api/announcements` - public announcements
- `POST /api/announcements/read` - mark announcement read

## Social graph and presence

- `GET/POST/DELETE /api/follows` - follow/unfollow
- `GET /api/follows/list` - list follows/followers
- `POST /api/presence` - heartbeat ping
- `GET /api/notifications` - notification center

## Manga APIs

- `GET /api/mangas` - manga listing
- `GET /api/mangas/[id]` - manga details
- `GET /api/mangas/chapter/[chapterId]` - chapter payload
- `GET /api/mangas/chapter/[chapterId]/image` - chapter image proxy

## File and media support

- `POST /api/upload` - media upload
- `GET /api/download/[episodeId]` - episode download endpoint
- `GET /api/local-files` - local file index/support route

## Mobile support

- `POST /api/mobile/push/register` - register Expo push token

## Admin: dashboard and moderation

- `GET /api/admin/dashboard` - admin summary metrics
- `GET /api/admin/alerts` - bug/suggestion alert counters
- `GET/PATCH /api/admin/bug-reports` - triage state transitions
- `GET/PATCH/DELETE /api/admin/comments` - moderation helpers
- `GET /api/admin/users` + `PATCH/DELETE /api/admin/users` - user admin controls

## Admin: anime and metadata operations

- `GET/POST/PUT/DELETE /api/admin/anime` - anime CRUD
- `PATCH /api/admin/anime/media` - anime media update helpers
- `GET /api/admin/anime/metadata` - metadata lookup (MAL + fallback sources)
- `POST /api/admin/anime/sync` - batch sync updates
- `GET/POST/DELETE /api/admin/episode` - episode operations
- `GET /api/admin/categories` - category listing

## Admin: provider/proxy integrations

- `GET /api/admin/playanimes`
- `GET /api/admin/anisbr`
- `GET /api/admin/animefenix`
- `GET /api/admin/anfire`
- `GET /api/admin/sugoi`
- `GET /api/admin/mangadex/search`
- `GET /api/admin/proxy`
- `GET /api/admin/proxy/search`

## Admin: manga ingestion

- `GET/POST/PUT/DELETE /api/admin/manga`
- `POST /api/admin/manga/import`
- `POST /api/admin/manga/sync`

## Admin: system toggles and runtime config

- `GET/PATCH /api/admin/maintenance` - maintenance mode message/state
- `GET/PATCH /api/admin/navigation` - anime/manga tab toggles
- `GET/PATCH /api/admin/watch-player-config` - player timing thresholds and autoplay seconds

## Public system-state readers

- `GET /api/system/maintenance` - read maintenance state for public clients
- `GET /api/system/navigation` - read navigation tab state for public clients
