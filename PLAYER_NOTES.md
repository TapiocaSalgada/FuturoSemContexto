# PLAYER_NOTES - Futuro sem Contexto

## Problema raiz

O player acumulou muitas responsabilidades em `/watch/[id]`: carregamento de fontes, fallback, UI mobile, historico, telemetria, report, playlist e estados. Isso aumenta risco de regressao no mobile e dificulta corrigir fullscreen/orientacao.

## Base criada

- `useOrientationLock`: tenta landscape lock sem quebrar quando o browser bloqueia.
- `useFullscreen`: usa Fullscreen API e tenta orientation lock apenas apos fullscreen.
- `usePlayerState`: padroniza estados de ciclo de vida.
- `usePlaybackAnalytics`: emissao segura de eventos sem bloquear playback.
- `PlayerShell`, `VideoSurface`, `PlayerControls`, `EpisodeDrawer`: base para desmontar a pagina watch em componentes menores.
- `ExternalEmbedPlayer`: agora usa wrapper `aspect-video`, `max-h-full`, `max-w-full` e fundo preto.

## Regras de implementacao

- Nunca usar `object-fit: cover` no video do player.
- Iframe/embed fica dentro de wrapper 16:9.
- Fullscreen e orientation lock sao progressive enhancement.
- Portrait mobile deve continuar usavel, com aviso quando necessario.
- Header e bottom nav publicos nao aparecem em `/watch`.
- Progresso deve ser salvo com throttle de 10-15 segundos e em eventos de pausa/saida/troca.

## Proximos passos

1. Migrar a area de video de `/watch/[id]` para `PlayerShell` + `VideoSurface`.
2. Migrar playlist mobile para `EpisodeDrawer`.
3. Centralizar estado do player em `usePlayerState`.
4. Padronizar eventos: `episode_start`, `episode_pause`, `episode_complete`, `buffering_start`, `buffering_end`, `player_error`, `fullscreen_enter`, `fullscreen_exit`, `orientation_lock_failed`, `progress_save`.

## Atualizacao 2026-05-20

- Adicionado `useVisualViewportVars` para manter `--vvh` e `--keyboard-gap` sincronizados com `window.visualViewport`.
- Player mobile, sheets e componentes novos do player agora podem usar a altura visual real em vez de depender apenas de `100dvh`.
- `PlayerShell`, `VideoSurface` e `EpisodeDrawer` foram alinhados para respeitar `--vvh`, safe area e scroll interno.
- A rota `/watch/[id]` passou a usar `var(--vvh, 100dvh)` no modo episodio imersivo, reduzindo corte causado por barras do navegador e teclado.

## Atualizacao 2026-06-04 - Player V10

- O player V2 atual funciona como base, mas continua monolitico.
- A proxima fase deve extrair superficie, controles, drawer, fullscreen/orientation e analytics para componentes/hooks dedicados.
- O criterio de aceitacao mobile permanece: `/watch` sem header, sem bottom nav, `100dvh`, safe area, video com `object-contain` e fullscreen/orientation como progressive enhancement.
