# V2_IMPLEMENTATION_REPORT - Futuro sem Contexto

Gerado em: 2026-06-04

## Estado da V2

A V2 esta ativa em producao como camada visual principal, mas ainda nao esta completa em todos os requisitos V10. O caminho correto e concluir por fases pequenas, preservando dados e login.

## Componentes V2 criados/encontrados

- `V2AppShell`: shell publica com header, bottom nav mobile, offline notice, maintenance gate, safe area e VisualViewport vars.
- `V2Header`: topbar publica com busca, links principais, perfil, logout e entrada para admin quando permitido.
- `V2MobileNav`: navegacao mobile separada do header desktop.
- `V2Hero`, `V2Rail`, `V2AnimeCard`, `V2EpisodeCard`: base de home/catalogo.
- `V2DetailsClient`: detalhes com episodios e CTA de playback.
- `V2Player`: player atual da V2 com HLS, iframe/embed, fullscreen, progresso e sheets.
- `V2AdminShell`: shell admin com sidebar desktop, menu mobile em sheet e busca global.
- `V2Button`, `V2Badge`, `V2Input`, `V2Overlay`, `V2Feedback`: primitivas V2.

## Paginas migradas para V2

- `/login`
- `/`
- `/explore`
- `/anime/[id]`
- `/watch/[id]`
- `/favorites`
- `/profile`
- `/profile/[id]`
- `/settings`
- `/admin` e subrotas principais

## Ajustes aplicados nesta fase

- Criado `AUDIT_V8_LACUNAS.md` com lacunas, riscos, rotas, APIs e prioridade.
- Criado este `V2_IMPLEMENTATION_REPORT.md`.
- Tokens V2 mudados para identidade roxa/ciano.
- Aliases antigos `--v2-orange` e `--accent-*` mantidos por compatibilidade, mas agora apontam para roxo.
- Removido `imgsrv.crunchyroll.com` de `next.config.mjs` e do proxy `/api/image` para evitar dependencia visual de asset protegido.

## Supabase e seguranca preservados

- `supabase.ts` segue como anon client publico.
- `supabase.server.ts` segue com `server-only` para `SUPABASE_SERVICE_KEY`.
- Admin continua protegido por middleware, layout server-side e server actions.
- Password reset e 2FA seguem atras de feature flags.

## Lacunas que continuam abertas

- `V2Player` ainda precisa ser dividido em componentes/hooks menores.
- O admin ainda usa majoritariamente `Anime/Episode`, nao os modelos canonicos como fonte primaria.
- Sync/import tem preview de novos episodios, mas ainda nao diff completo de campos alterados/removidos.
- Algumas APIs admin legadas ainda precisam auditoria endpoint por endpoint.
- Mobile precisa QA visual real em 360/390/430/768 e ajustes finos.
- Ainda existem textos legados com encoding quebrado em pontos isolados.

## Proxima fase recomendada

1. Criar `src/lib/catalog` com adapters legado/canonico.
2. Refatorar `V2Player` para `PlayerShell`, `VideoSurface`, `PlayerControls`, `EpisodeDrawer` e hooks.
3. Completar diff de sync em `/api/admin/anime/sync`.
4. Adicionar teste visual local com Browser/Playwright antes de Preview.

## Adapter de catalogo

A fase atual adicionou `src/lib/catalog/types.ts` e `src/lib/catalog/compat.ts` para normalizar leitura publica entre `Anime` legado e `Content` canonico. Isso permite migrar Home/Explore/Details sem downtime e sem apagar dados existentes.
