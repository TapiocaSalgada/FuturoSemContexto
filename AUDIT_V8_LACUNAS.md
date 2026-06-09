# AUDIT_V8_LACUNAS - Futuro sem Contexto

Gerado em: 2026-06-04

## Resumo executivo

O projeto ja esta em uma V2 parcial: existe shell publica V2, admin V2, player V2, migrations canonicas, server-only para Supabase service key e protecao admin server-side. A aplicacao tambem ja foi publicada em producao recentemente com lint, typecheck e build passando.

A lacuna principal nao e mais criar a V2 do zero, mas concluir a migracao sem quebrar o produto: remover residuos visuais/operacionais da V1, trocar o acento laranja por roxo/ciano, tirar dependencias visuais de assets protegidos, dividir o player monolitico, completar admin/importacao com diff real e consolidar a ponte entre `Anime/Episode` e `Content/Season/CatalogEpisode/Source`.

## Stack real encontrada

- Next.js 14.2.35 com App Router.
- React 18.
- NextAuth Credentials com Prisma/Postgres.
- Prisma Client 5.22.0.
- Supabase JS/Storage usado como auxiliar, com anon client separado de service key server-only.
- Tailwind CSS 3.4.1 e CSS global/V2 em `src/styles/v2-theme.css`.
- Player com `hls.js`, embeds/iframes e fallback por provider.
- Deploy Vercel ja vinculado ao projeto `futuro-sem-contexto`.

## Rotas principais encontradas

Publicas/protegidas:

- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/`, `/explore`, `/favorites`, `/history`, `/social`
- `/anime/[id]`, `/watch/[id]`
- `/profile`, `/profile/[id]`, `/settings`
- `/mangas`, `/mangas/[id]`, `/mangas/[id]/chapter/[chapterId]`

Admin:

- `/admin`
- `/admin/catalogo`
- `/admin/temporadas`
- `/admin/episodios`
- `/admin/importar`
- `/admin/import`
- `/admin/bugs`
- `/admin/sugestoes`
- `/admin/usuarios`
- `/admin/sistema`
- `/admin/logs`

APIs relevantes:

- `/api/watch/[id]`, `/api/watch/proxy`, `/api/watch/telemetry`
- `/api/admin/*`, `/api/admin/anime/sync`, `/api/admin/search`
- `/api/profile/*`, `/api/favorites/*`, `/api/history`
- `/api/suggestions`, `/api/bug-reports`
- `/api/security/*`, `/api/upload`, `/api/image`

## Banco e dados

### Modelos legados ainda ativos

- `Anime`, `AnimeSeason`, `Episode`, `EpisodeSource`
- `WatchHistory`, `Favorite`, `FavoriteFolder`
- `BugReport`, `Suggestion`, `User`, `UserSettings`

### Modelos canonicos ja criados

- `Content`, `Season`, `CatalogEpisode`, `Source`
- `WatchProgress`, `Watchlist`, `WatchlistFolder`
- `AdminAuditLog`
- `AccountSession`, `SecurityEvent`, `UserSecuritySettings`

### Lacuna arquitetural

A UI publica e o admin ainda operam majoritariamente sobre `Anime/Episode`. A camada canonica existe, mas precisa de adapters em `lib/catalog` para permitir migracao gradual sem duplicar regras.

## APIs/fontes preservadas encontradas

- Kappa API em `lib/providers/search` e `/api/admin/anime/sync`.
- Sugoi API em `/api/admin/anime/sync`, `/api/watch/[id]` e provider dedicado.
- AnFire, AnimeFenix, PlayAnimes/ATV2, AnimesBrasil por fluxo de sync/watch.
- Zenshin para preview/imagens de episodio.
- EmbedMovies por `lib/embedmovies`.
- Fontes manuais por `EpisodeSource`.

## Problemas priorizados

| Severidade | Area | Problema | Evidencia | Solucao recomendada |
| --- | --- | --- | --- | --- |
| Critica | Identidade/Legal | Host `imgsrv.crunchyroll.com` estava permitido em `next.config.mjs` e `/api/image`. | Allowlist anterior aceitava asset Crunchyroll. | Remover allowlist e usar dados/placeholder proprios. |
| Alta | Visual V2 | Acento principal ainda era laranja, contrariando V7-V10. | `--v2-orange` e aliases globais dominavam header/admin/player. | Trocar tokens base para roxo/ciano mantendo alias para compatibilidade. |
| Alta | Player | `V2Player` ainda concentra fetch, HLS, controles, sheets, progresso e telemetria. | Arquivo monolitico em `components/v2/player/V2Player.tsx`. | Dividir em shell/surface/controls/drawer/hooks. |
| Alta | Admin Sync | Sync ja tem preview para episodios novos, mas nao diff completo de alteracoes/remocoes/conflitos. | `/api/admin/anime/sync` retorna candidates, mas nao matriz before/after. | Implementar diff com campos alterados e aplicacao seletiva. |
| Alta | Dados | Modelo canonico existe, mas nao e fonte principal da UI. | Paginas admin usam `prisma.anime`, `prisma.episode`. | Criar adapters `lib/catalog` e migrar tela por tela. |
| Media | Mobile | Shell usa safe area e `100dvh`, mas admin/player ainda precisam QA tela a tela. | V2 shell existe; player e admin usam sheets parciais. | Rodar QA em 360/390/430/768 e ajustar overflow. |
| Media | Segurança | Algumas APIs admin legadas ainda precisam confirmar `requireAdminActor` centralizado. | Muitas rotas em `src/app/api/admin`. | Auditar endpoint por endpoint e padronizar helpers. |
| Media | Password Reset | Rotas existem, mas devem ficar invisiveis se provider real nao estiver configurado. | Feature flags existem. | Manter UI publica condicionada a flags + Resend envs. |
| Baixa | Texto/encoding | Ainda existem textos com encoding quebrado em partes antigas. | `EpisÃ³dio` em watch API. | Corrigir strings gradualmente sem redesenhar fluxo. |

## Componentes V1 restantes ou removidos

Removidos/obsoletos no estado atual:

- `AnimeCard.tsx`
- `BottomNav.tsx`
- `Header.tsx`
- `HomeHeroRotator.tsx`
- `HorizontalCarousel.tsx`
- `TomatoVideoPlayer.tsx`

Componentes V2 ativos:

- `components/v2/layout/V2AppShell.tsx`
- `components/v2/navigation/V2Header.tsx`
- `components/v2/navigation/V2MobileNav.tsx`
- `components/v2/home/V2Hero.tsx`
- `components/v2/catalog/V2AnimeCard.tsx`
- `components/v2/details/V2DetailsClient.tsx`
- `components/v2/player/V2Player.tsx`
- `components/v2/admin/V2AdminShell.tsx`

## Estado mobile

Implementado:

- `100dvh` no shell e player.
- Safe area em shell, player e mobile sheets.
- Bottom nav oculta em `/watch` e `/admin`.
- Menu admin vira sheet no mobile.

Ainda pendente:

- Teste visual real nas larguras 360, 390, 430 e 768.
- Garantir que formularios admin extensos nao exigem tabela larga.
- Garantir que sheets de player nao excedem viewport com teclado/toolbar.

## Estado admin

Implementado:

- Dashboard operacional com metricas.
- Catalogo com criar conteudo, filtros, publicar/ocultar e links para temporadas/episodios.
- Temporadas com CRUD real basico via `AnimeSeason`.
- Episodios e sources com CRUD basico via `Episode` e `EpisodeSource`.
- Bugs, sugestoes, usuarios, sistema e logs com server actions/audit log.
- Protecao server-side no layout admin.

Ainda pendente:

- Editor completo de conteudo existente, nao so criacao/status.
- Duplicar/reordenar episodios.
- Mover episodio entre temporadas.
- Teste de source antes de salvar.
- Diff completo de import/sync antes de aplicar alteracoes.
- Acoes em massa e filtros persistentes robustos.

## Estado player

Implementado:

- HLS via `hls.js`.
- Iframe/embed fallback.
- Fullscreen via `requestFullscreen()`.
- Tentativa de orientation lock dentro de try/catch.
- Progresso a cada 15s e em pausa/saida.
- Header/bottom nav escondidos em `/watch`.

Ainda pendente:

- Dividir `V2Player` em componentes menores.
- Padronizar state machine nomeada.
- Telemetria padronizada para `episode_start`, `episode_complete`, `buffering_start/end`, `player_error`, `fullscreen_enter/exit`.
- Melhorar erro recuperavel com trocar fonte/retry.

## Segurança e RLS

Implementado:

- `src/lib/supabase.ts` contem apenas anon client.
- `src/lib/supabase.server.ts` contem service key com `server-only`.
- Middleware bloqueia admin por token role/owner.
- Layout admin valida admin no servidor.
- Server actions admin chamam `requireAdminActor()`.
- Migrations canonicas com RLS para tabelas sensiveis.

Ainda pendente:

- Revisao endpoint por endpoint de APIs admin legadas.
- Testes IDOR para profile, bugs, suggestions, watchlist/progress e admin.
- CSP mais restritiva quando providers reais estiverem consolidados.

## Ordem recomendada de execucao

1. Concluir identidade V2 roxa/ciano e remover assets/allowlists protegidas.
2. Criar adapters `lib/catalog` para ponte gradual legado/canonico.
3. Refatorar `V2Player` em componentes/hooks e padronizar eventos.
4. Completar admin CRUD/diff/sync/test source.
5. Migrar Home/Explore/Details para adapters e estados completos.
6. Auditar APIs admin e payloads de sources.
7. Rodar QA mobile visual com Browser/Playwright.
8. Criar Preview Vercel por fase e somente depois promover producao.
