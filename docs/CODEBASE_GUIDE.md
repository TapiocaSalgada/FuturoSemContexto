# Codebase Guide

This guide is the fastest way for a new developer to understand the project.

## 1) Architecture in one page

- Framework: Next.js App Router (`src/app`)
- UI layer: React components in `src/components`
- Data layer: Prisma (`src/lib/prisma.ts`) + PostgreSQL
- Auth layer: NextAuth credentials flow (`src/lib/auth.ts`)
- API layer: Route handlers under `src/app/api/**`
- Admin runtime settings: persisted in system announcement rows (maintenance, navigation, watch player config)

## 2) Directory map

### `src/app`

- `layout.tsx`: global HTML shell, theme bootstrap, providers, analytics
- `globals.css`: design tokens + global styles + mobile/fullscreen behavior classes
- `page.tsx`: home feed and discovery rails
- `anime/[id]/page.tsx`: anime detail page, season/episode listing, continue logic
- `watch/[id]/page.tsx`: watch experience (player, source fallback, autoplay, mobile immersive, history save)
- `profile/[id]/page.tsx`: profile and user activity
- `settings/page.tsx`: user settings and admin shortcut
- `social/page.tsx`: social stream surface
- `admin/page.tsx`: consolidated admin dashboard

### `src/app/api`

- `watch/[id]/route.ts`: watch payload resolver (episode selection + source normalization + user settings + player config)
- `history/route.ts`: watch progress read/write
- `settings/route.ts`: user visual/player preferences
- `admin/**`: catalog, metadata sync, bug triage, system toggles, watch player config

### `src/components`

- `AppLayout.tsx`: app frame, header/bottom nav and page transitions
- `Header.tsx`: search/profile/notifications UX with mobile overlays
- `BottomNav.tsx`: mobile persistent navigation
- `HomeHeroRotator.tsx`: homepage hero and primary CTAs
- `TomatoVideoPlayer.tsx`: custom direct video player controls (desktop + mobile)

### `src/lib`

- `auth.ts`: NextAuth options, credential validation, role/avatar sync in JWT
- `settings.ts`: default settings + normalization guard
- `theme.ts` / `theme-store.ts`: theme normalization and local state bridge
- `video.ts`: source detection, URL normalization, embeddable conversion
- `anime-metadata.ts`: MAL / external metadata aggregation for admin flows
- `maintenance.ts` / `navigation.ts`: persisted system toggles
- `watch-player-config.ts`: player timing schema and normalization
- `watch-player-config-store.ts`: persisted player config (read/write)

## 3) Core runtime flows

### Auth flow

1. User logs in via credentials (`/api/auth/[...nextauth]` using `src/lib/auth.ts`).
2. JWT stores user id, role, avatar, handoff hash.
3. Session callback exposes these fields to client components.
4. Middleware (`src/middleware.ts`) protects private routes.

### Watch flow

1. `/watch/[id]` page requests `/api/watch/[id]`.
2. API chooses target episode (resume or direct episode id), resolves available sources, and returns watch payload.
3. Client chooses direct player (`TomatoVideoPlayer`) or iframe fallback.
4. Progress is persisted to `/api/history` every 10s and on visibility/pagehide.
5. Next episode prompt/autoplay uses source-aware timing thresholds from watch player config.

### Admin system config flow

1. Admin page loads maintenance, navigation, and watch player config endpoints.
2. Edits are staged in local UI state.
3. Save action sends PATCH calls to related admin endpoints.
4. Data is persisted and reused by runtime APIs (not hardcoded in UI).

## 4) Data model quick map (Prisma)

- `User`: auth identity, role, profile, privacy
- `UserSettings`: per-user app/player preferences
- `Anime` + `Episode`: content catalog and playback metadata
- `WatchHistory`: progress checkpoints
- `Favorite` / `FavoriteFolder`: library organization
- `Comment` / `Suggestion` / `BugReport`: community + quality loops
- `Announcement`: generic system state storage (maintenance/navigation/player config)

## 5) Where to edit common requests

- Player controls UI: `src/components/TomatoVideoPlayer.tsx`
- Watch autoplay/threshold logic: `src/app/watch/[id]/page.tsx`
- Watch source resolution rules: `src/app/api/watch/[id]/route.ts` and `src/lib/video.ts`
- Hero CTA/button behavior: `src/components/HomeHeroRotator.tsx`
- Header/search mobile behavior: `src/components/Header.tsx`
- Admin system cards: `src/app/admin/page.tsx`
- Theme tokens and global classes: `src/app/globals.css`

## 6) Team conventions used in this repo

- Keep fallback behavior defensive (network and source failures are expected).
- Put cross-cutting rules in `src/lib` and keep pages thin where possible.
- Prefer normalized configuration objects over scattered magic numbers.
- For changes in watch/admin logic, run `npm run lint` and `npm run build` before deploy.

## 7) New developer checklist

1. Read this file and `docs/API_INDEX.md`.
2. Read `src/app/watch/[id]/page.tsx` and `src/app/api/watch/[id]/route.ts` first.
3. Read `src/app/admin/page.tsx` to understand operator workflow.
4. Validate local environment (`npm run lint`, `npm run build`).
5. Only then start feature edits.
