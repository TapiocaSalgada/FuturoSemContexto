# DEPLOY_CHECKLIST - Futuro sem Contexto

## Antes do deploy

1. Conferir worktree e revisar diffs.
2. Rodar `npx prisma generate`.
3. Rodar `npx prisma migrate status`.
4. Rodar `npm run lint`.
5. Rodar `npx tsc --noEmit --pretty false`.
6. Rodar `npm run build`.
7. Rodar `npm audit --omit=dev`.
8. Confirmar envs de producao na Vercel.

## Variaveis obrigatorias

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `OWNER_EMAIL`

## Flags opcionais

- `ENABLE_ACCOUNT_2FA=false`
- `NEXT_PUBLIC_ENABLE_ACCOUNT_2FA=false`
- `ENABLE_PASSWORD_RESET=false`
- `NEXT_PUBLIC_ENABLE_PASSWORD_RESET=false`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Preview Vercel

- Deploy inicial deve ser Preview.
- Testar `/login`, `/`, `/explore`, `/anime/[id]`, `/watch/[id]`, `/favorites`, `/settings`, `/admin`.
- Testar player em mobile portrait/landscape.
- Testar usuario comum contra `/admin`.
- Testar episodio sem fonte.

## Producao

- So promover Preview para Production depois do smoke test.
- Antes de migrations destrutivas, criar backup do banco.
- Se migration canonica falhar, nao promover deploy de codigo dependente dela.
## Preview desta rodada

- https://futuro-sem-contexto-ft1kdylm8-relugocruz-7913s-projects.vercel.app
- Deployment ID: `dpl_9pYcSSeU8QvehFDPiPLxRQTRSmN9`
- Status Vercel: READY
- Producao nao foi promovida nesta etapa.

## Atualizacao 2026-05-20

- Confirmar no Preview que header/profile/notifications abrem como sheet em mobile, sem sair da tela.
- Confirmar no Preview que `/watch/[id]` usa altura visual correta em portrait/landscape e nao fica atras das barras do navegador.
- Confirmar que CSP conservadora nao bloqueia imagens, embeds, player, Supabase ou Vercel Analytics.
