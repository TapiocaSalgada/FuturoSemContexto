# AUDIT_REPORT - Futuro sem Contexto

Data: 2026-05-19
Escopo: auditoria tecnica de produto, arquitetura, player, mobile, admin, seguranca e deploy.

## Stack real encontrada

- Next.js 14.2.35 com App Router em `src/app`.
- React 18.
- NextAuth Credentials com Prisma/Postgres como autenticacao principal.
- Supabase JS usado principalmente para client anon e storage; service key separada em modulo server-only.
- Prisma 5.22.0 com schema legado `Anime`, `AnimeSeason`, `Episode`, `Favorite`, `WatchHistory`.
- Player usa `video.js`, `hls.js`, `screenfull` ainda instalado, componentes `TomatoVideoPlayer` e `ExternalEmbedPlayer`.
- Vercel Analytics e Speed Insights ja estao nas dependencias.

## Problemas criticos

| Severidade | Area | Problema | Arquivos afetados | Causa provavel | Correcao recomendada |
| --- | --- | --- | --- | --- | --- |
| Critica | Player mobile | A pagina `/watch/[id]` concentra muita regra de fonte, UI, mobile, historico e telemetria em um unico componente muito grande. | `src/app/watch/[id]/page.tsx` | Orquestracao, UI e regra de playback misturadas. | Separar em `PlayerShell`, `VideoSurface`, `PlayerControls`, `EpisodeDrawer` e hooks dedicados. |
| Critica | Auth/UX | Login normal mostrava campo 2FA, mas o plano exige 2FA oculto/feature flag. | `src/app/login/page.tsx`, `src/lib/auth.ts` | Fluxo de seguranca incompleto exposto no login principal. | Campo removido do login e verificacao protegida por flag. |
| Critica | Recuperacao de senha | Link publico de senha podia aparecer sem provider real de e-mail. | `src/app/login/page.tsx`, `src/app/forgot-password`, `src/app/reset-password`, APIs auth | UI prometia envio que pode nao existir em producao. | Link/telas/API ficam desativados salvo flags e provider real. |
| Alta | Dados | Schema legado mistura conteudo editorial e fonte de reproducao em `Episode.videoUrl/sourceType`. | `prisma/schema.prisma`, APIs admin/watch | Modelo cresceu a partir de catalogo simples. | Adicionar camada canonica `content > seasons > episodes > sources` e migrar gradualmente. |
| Alta | Admin | Admin tem muitos endpoints e telas, mas fluxo operacional ainda depende de areas grandes e misturadas. | `src/app/admin/**`, `src/components/admin/**` | Catalogo, temporadas, sync e publicacao nao estao completamente separados. | Modularizar dashboard, catalogo, temporadas, episodios, sources, import, bugs, sugestoes, usuarios e sistema. |
| Alta | Sources privadas | O player ainda opera com fontes resolvidas por endpoint de watch e fallback, mas o modelo legado deixa URL no episodio. | `src/app/api/watch/[id]/route.ts`, `Episode.videoUrl` | Falta de tabela `sources` privada. | Migrar fontes para tabela dedicada; cliente recebe somente playback autorizado. |
| Alta | Mobile | Existem muitas regras mobile dentro da pagina de watch e popovers/sheets ainda precisam padronizacao. | `src/app/watch/[id]/page.tsx`, `AppLayout`, `Header`, `BottomNav` | Mobile foi ajustado incrementalmente. | Criar shell mobile-first, sheets e safe-area consistente. |

## Problemas medios

| Severidade | Area | Problema | Arquivos afetados | Correcao recomendada |
| --- | --- | --- | --- | --- |
| Media | Performance | Player e admin ainda podem entrar em bundles grandes se componentes pesados nao forem lazy-loaded. | `src/app/watch`, `src/app/admin` | Usar dynamic import e Client Components pequenos. |
| Media | Observabilidade | Telemetria existe em watch, mas ainda nao ha contrato central documentado para eventos de produto/admin. | `src/app/api/watch/telemetry`, `src/lib/security-events.ts` | Padronizar eventos e payloads. |
| Media | Documentacao | Nao havia documentos finais de arquitetura, seguranca, player e deploy. | raiz do projeto | Criar docs operacionais. |
| Media | Encoding | Algumas strings ainda aparecem com mojibake em arquivos existentes. | varias paginas | Corrigir progressivamente ao tocar em cada arquivo. |

## Problemas baixos

- Dependencia `screenfull` pode ser removida depois que o novo hook substituir todos os usos.
- Alguns componentes novos de player ainda precisam ser integrados totalmente na pagina `/watch/[id]`.
- O schema canonico foi adicionado em paralelo; a migracao de dados legados ainda precisa de script dedicado.

## Ordem de prioridade

1. Corrigir player mobile/fullscreen e reduzir o tamanho da pagina `/watch/[id]`.
2. Migrar fontes para `sources` privadas e playback autorizado.
3. Separar editor admin de conteudo, temporadas, episodios e sources.
4. Consolidar RLS/migrations no Supabase.
5. Padronizar mobile shell, bottom sheets e safe-area.
6. Reformar home/explore/detalhes sobre os servicos de catalogo canonicos.
7. Instrumentar eventos e performance.

## Status desta rodada

- Campo 2FA removido do login normal.
- Recuperacao de senha escondida por flag publica e bloqueada no servidor sem provider real.
- Hooks base de player criados para fullscreen/orientacao/estado/telemetria.
- `ExternalEmbedPlayer` ajustado para wrapper 16:9 proporcional.
- Schema canonico e migration inicial adicionados sem apagar legado.
- `npx prisma validate` passou.
- `npx prisma generate` passou.
- `npm run lint` passou.
- `npx tsc --noEmit --pretty false` passou.
- `npm run build` passou.
- `npx prisma migrate deploy` aplicou `20260519000000_canonical_streaming_core`.
- `npx prisma migrate status` confirmou schema atualizado.
- `npm audit --omit=dev` ainda falha por vulnerabilidade alta em `next@14.2.35`; correcao automatica exige upgrade major para Next 16.
## Deploy Preview

- Preview Vercel criado com sucesso: https://futuro-sem-contexto-d5do7ta98-relugocruz-7913s-projects.vercel.app
- Deployment id: dpl_2oHxYF1TjWehv3vc7THgUBJZUhNa
- Build remoto Vercel passou.
