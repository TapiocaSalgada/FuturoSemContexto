# Futuro sem Contexto - Operacao

## Fixes consolidados
- Bloqueio do pop-out do Google Drive no player.
- Correcao da recursao infinita em comentarios aninhados.
- Sync de role no JWT sem exigir novo login.
- Login por Discord e conta sem senha local.
- Perfis com follows, historico e favoritos com privacidade.
- Temas dinamicos aplicados por variaveis globais.
- Correcoes de preload no formulario de edicao do admin.

## Stack oficial
- Frontend e backend web: Next.js 14 em Vercel.
- Banco principal: Supabase PostgreSQL via Prisma.
- Storage de imagens: bucket `uploads` no Supabase Storage.
- Repositorio e fluxo de deploy: GitHub -> Vercel.
- Videos: fontes externas remotas. `public/videos` fica apenas como apoio local.

## Variaveis criticas
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `OWNER_EMAIL`

## Checklist de deploy
1. Confirmar que o bucket `uploads` existe no Supabase e aceita `getPublicUrl`.
2. Validar que todas as variaveis acima estao configuradas no projeto da Vercel.
3. Garantir que o `OWNER_EMAIL` seja o mesmo usado pela conta principal do admin.
4. Rodar `npx prisma generate` depois de alterar o schema.
5. Rodar `npx prisma db push` para aplicar campos e modelos novos sem depender de estado local.
6. Fazer smoke test de login, upload de imagem, perfil, notificacoes, player e admin apos deploy.

## Regras operacionais
- Nao depender de `public/videos` como fonte principal em producao.
- Novos episodios devem ser cadastrados com URL externa valida.
- Favoritos, follows e notificacoes devem ser testados com pelo menos duas contas.
- Settings devem refletir no backend; nao aceitar regressao para client-only.
