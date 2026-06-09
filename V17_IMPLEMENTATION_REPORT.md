# FSC V17 Implementation Report

Data: 2026-06-08

## Implementado

- Rotas app-like em portugues: `/inicio`, `/explorar`, `/buscar`, `/minha-lista`, `/perfil`, `/perfil/editar`, `/perfil/[handle]`, `/configuracoes`, `/anime/[id]/temporadas`, `/anime/[id]/episodios`, `/assistir/[animeSlug]/[episodeSlug]`.
- Redirects de compatibilidade: `/explore`, `/favorites`, `/history`, `/profile`, `/settings`, `/watch/[id]`.
- Player refatorado em `PlayerShell`, `VideoSurface`, `PlayerControls`, `EpisodeDrawer`, hooks de fullscreen/orientacao/progresso/analytics.
- Suporte de player para MP4/HLS via `hls.js` e embed sandboxado.
- Atalhos do player: Space/K/Enter, setas/J/L com 5s, F, M e teclas 1-9.
- Progresso salvo em `/api/history` para legado (`WatchHistory`) e canônico (`WatchProgress`).
- Admin novo com shell SaaS escura e módulos: dashboard, catalogo, temporadas, episodios/sources, importar, sync, bugs, sugestoes, usuarios, sistema e logs.
- Server actions canônicas para `Content`, `Season`, `CatalogEpisode`, `Source`, `ProviderSyncLog` e `SystemSetting`.
- Middleware refeito com rotas públicas explícitas, proteção de rotas privadas e proteção de `/admin`/`/api/admin` por token.
- Script protegido de limpeza de catálogo em staging: `npm run cleanup:catalog:staging`.

## Banco e migration

Migration aplicada: `20260608193000_fsc_v17_app_like_mvp`.

Adições:
- `User.username` com índice único.
- `CatalogEpisode.slug` com índice único por conteúdo.
- `Source.quality`, `Source.language`, `Source.lastCheckedAt`.
- Nova tabela `provider_sync_logs`.
- Nova tabela `system_settings`.

Nenhum dado foi apagado. O script de limpeza não foi executado.

## Segurança

- `SUPABASE_SERVICE_KEY` continua restrita a `src/lib/supabase.server.ts` e `src/lib/env-check.ts`.
- Admin é validado no middleware e nas server actions via `requireAdminActor`/`requireAdminPage`.
- APIs admin retornam `401/403` quando chamadas sem permissão.
- Sources canônicas são entregues ao player apenas via `/api/watch/[id]`, após sessão e validação de publicação.
- 2FA não foi colocado no login comum.
- Reset de senha permanece condicionado às rotas/envs existentes.

## Validação executada

- `npx prisma generate`: passou.
- `npm run lint`: passou.
- `npx tsc --noEmit --pretty false --incremental false`: passou.
- `npx prisma migrate status`: passou, banco atualizado.
- `npm run build`: passou.
- Smoke HTTP local em `next start -p 3050`:
  - `/`: 200
  - `/explorar`: 200
  - `/buscar`: 200
  - `/login`: 200
  - `/admin`: 307 para `/login?callbackUrl=%2Fadmin`
  - `/inicio`: 307 para `/login?callbackUrl=%2Finicio`

## Limitações abertas

- O admin V17 entrega CRUD operacional canônico, mas edição completa inline de todos os campos ainda pode ser refinada com telas dedicadas de edição.
- Sync com diff registra preview e regras de proteção; integração automática profunda com cada provider deve ser evoluída por provider.
- Teste visual mobile real via navegador/dispositivo ainda deve ser feito antes de produção.
- O script de limpeza de catálogo deve ser usado apenas em staging/preview com variáveis de confirmação.
