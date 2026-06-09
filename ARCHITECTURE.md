# ARCHITECTURE - Futuro sem Contexto

## Direcao

A plataforma passa a evoluir em duas camadas:

1. Camada legada compativel: `Anime`, `AnimeSeason`, `Episode`, `Favorite`, `WatchHistory` continuam funcionando ate a migracao completa.
2. Camada canonica de streaming: `content`, `seasons`, `episodes`, `sources`, `watch_progress`, `watchlist`, `admin_audit_logs`.

Essa abordagem evita uma migracao big-bang e permite mover telas e APIs por modulo.

## Principios

- Cliente nao decide autorizacao sensivel.
- Service role do Supabase fica somente no servidor.
- Player nao usa layout global publico.
- Source de video e dado operacional, nao metadado publico.
- Admin e sync passam por APIs com autorizacao server-side.
- Mobile usa bottom nav/sheets; player usa fullscreen progressivo e safe-area.

## Modulos alvo

- `components/layout`: app shell, topbar, bottom nav, sheets.
- `components/catalog`: cards, rails, filtros, empty/loading states.
- `components/player`: shell, superficie, controles, drawer, estados.
- `components/admin`: catalogo, temporadas, episodios, sources, import, usuarios, moderacao.
- `hooks`: viewport, fullscreen, orientation, player state, network, analytics.
- `lib/security`: autorizacao, rate limit, auditoria, sanitizacao.
- `lib/catalog`: servicos de leitura/publicacao do catalogo canonico.
- `lib/player`: resolucao de fonte autorizada, signed/playback token, telemetria.

## Modelo canonico

- `content`: anime/serie/filme/special com slug, status, imagens e metadados.
- `seasons`: temporadas por conteudo.
- `episodes`: episodios canonicos por conteudo/temporada.
- `sources`: fontes privadas por episodio.
- `watch_progress`: progresso por usuario e episodio.
- `watchlist` e `watchlist_folders`: minha lista futura, separada do favorito legado.
- `admin_audit_logs`: trilha de alteracoes administrativas.

## Compatibilidade

- Rotas atuais continuam lendo os modelos legados ate receberem servicos canonicos.
- A migracao de dados deve copiar `Anime` para `content`, `AnimeSeason` para `seasons`, `Episode` para `episodes` e `Episode.videoUrl/sourceType` para `sources`.
- A migracao deve ser idempotente e nunca apagar source manual sem confirmacao.
## Atualizacao 2026-06-04 - Reforma V10

- A estrategia oficial continua sendo ponte gradual, nao migracao big-bang.
- O modelo legado `Anime/AnimeSeason/Episode/EpisodeSource` permanece operacional enquanto a UI e o admin migram para adapters.
- O modelo canonico `Content/Season/CatalogEpisode/Source` deve receber novas leituras/escritas por modulo, sem apagar dados legados.
- A identidade visual V2 passa a usar roxo/ciano como acento principal. O alias `--v2-orange` permanece apenas para compatibilidade tecnica temporaria.
- Assets ou hosts de marca/plataforma terceira nao devem ser usados como dependencia visual do produto.

## Atualizacao 2026-06-04 - Adapter inicial

- Criado `src/lib/catalog/types.ts` com contrato normalizado para itens de catalogo.
- Criado `src/lib/catalog/compat.ts` com `listPublicCatalogItems()`, lendo modelos legados e canonicos em paralelo.
- As paginas ainda nao foram migradas para esse adapter; a proxima fase deve trocar Home/Explore/Details gradualmente.
