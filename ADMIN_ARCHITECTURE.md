# ADMIN_ARCHITECTURE - Futuro sem Contexto

## Objetivo

O admin foi reorganizado como console operacional, separado do site publico e com bundle proprio via segmento `/admin`.

## Estrutura

- `src/app/admin/layout.tsx`: protecao server-side e shell admin.
- `src/components/admin/AdminShell.tsx`: sidebar desktop, menu mobile e estrutura responsiva.
- `src/components/admin/AdminTopbar.tsx`: busca global admin.
- `src/lib/admin/permissions.ts`: autorizacao server-side.
- `src/lib/admin/actions.ts`: server actions auditadas.
- `src/lib/admin/audit.ts`: escrita em `AdminAuditLog`.

## Modulos

- `/admin`: dashboard.
- `/admin/catalogo`: conteudos.
- `/admin/temporadas`: temporadas reais.
- `/admin/episodios`: episodios e sources.
- `/admin/importar`: staging/importacao separada.
- `/admin/bugs`: triagem de bugs.
- `/admin/sugestoes`: moderacao de sugestoes.
- `/admin/usuarios`: usuarios e roles.
- `/admin/sistema`: manutencao e avisos.
- `/admin/logs`: auditoria.

## Dados

A primeira versao usa os modelos que o site publico ja consome (`Anime`, `AnimeSeason`, `Episode`) para nao quebrar o produto. Sources multiplas foram adicionadas em `EpisodeSource` e integradas ao endpoint `/api/watch/[id]`.

## Atualizacao 2026-06-04 - Admin V10

- O admin V2 ja possui dashboard, catalogo, temporadas, episodios, sources, importacao, moderacao, usuarios, sistema e logs.
- A proxima fase deve completar editor de conteudo existente, duplicacao/reordenacao/mover episodios, teste de source e sync com diff completo.
- O admin deve continuar usando cards/sheets no mobile e nunca depender de hover ou tabela larga para operacao critica.
