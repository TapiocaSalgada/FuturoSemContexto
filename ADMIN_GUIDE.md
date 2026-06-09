# ADMIN_GUIDE - Futuro sem Contexto

## Como usar

Acesse `/admin` com usuario admin/owner. Usuario comum e anonimo sao bloqueados no middleware e no layout server-side.

## Fluxo recomendado

1. Crie o conteudo em `Catalogo`.
2. Crie temporadas em `Temporadas`.
3. Crie episodios em `Episodios`.
4. Adicione sources no painel lateral do episodio.
5. Teste playback pelo link `Testar`.
6. Publique/oculte no Catalogo ou no modulo de episodios.
7. Use `Bugs` e `Sugestoes` para moderacao.
8. Use `Logs` para auditar acoes criticas.

## Conteudo

O catalogo grava dados reais no modelo `Anime`, incluindo titulo, slug, sinopse, poster, banner, tipo, status, visibilidade, generos, ano, idioma, classificacao e destaque.

## Temporadas

O modulo `Temporadas` grava dados reais em `AnimeSeason`. Excluir uma temporada exige digitar `EXCLUIR` e remove episodios da temporada.

## Episodios e sources

O modulo `Episodios` grava `Episode` e `EpisodeSource`. Cada source tem provider, tipo, URL/storage path, qualidade, idioma, prioridade e estado ativo/inativo.

## Importacao

`Importar API` fica separado da edicao manual. O fluxo existente continua em `/admin/import`; apos importar, revise e publique pelo catalogo.

## Atualizacao 2026-06-04 - Uso Admin V10

- A ordem operacional recomendada continua: Catalogo -> Temporadas -> Episodios -> Sources -> Testar -> Publicar.
- Importacao por API deve ser tratada como staging/diff, nunca como publicacao automatica.
- Se uma source manual existir, a sincronizacao externa nao deve substitui-la sem confirmacao explicita do admin.
