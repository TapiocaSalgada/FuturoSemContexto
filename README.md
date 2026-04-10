# Futuro sem Contexto - Web App

Streaming platform focused on anime discovery, watch continuity, profile/social features, and a full admin panel for content operations.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- NextAuth (credentials flow)
- Prisma + PostgreSQL (Supabase)
- Vercel deployment
- Video.js / HLS.js for direct playback

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Set environment variables in `.env.local` (see "Environment" section).

3. Generate Prisma client:

```bash
npx prisma generate
```

4. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Project Map

- `src/app`: pages and API routes (App Router)
- `src/components`: reusable UI and player components
- `src/lib`: auth, settings, source resolution, admin state, utility modules
- `prisma/schema.prisma`: core data model
- `docs/`: onboarding and operational documentation

## Main User Flows

- Home -> Anime detail -> Watch episode
- Continue watching/history/favorites sync by account
- Mobile immersive playback mode (fullscreen + landscape handling)
- Admin operations for anime catalog, metadata, bug triage, system controls

## Important Documentation

- `docs/CODEBASE_GUIDE.md` - complete architecture and code navigation map
- `docs/API_INDEX.md` - API endpoint index grouped by domain
- `docs/OPERATIONS.md` - production operation checklist
- `docs/SUPABASE_SECURITY.md` - security hardening notes

## Environment

Required variables (minimum):

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

Optional depending on features enabled:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `OWNER_EMAIL`

## Useful Commands

```bash
npm run lint
npm run build
npm run start
```

## Deploy

Production deployment is handled on Vercel. If deploying manually:

```bash
npx vercel --prod --yes
```
