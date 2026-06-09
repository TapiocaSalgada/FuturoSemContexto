# SECURITY_NOTES - Futuro sem Contexto

## Estado atual aplicado

- `src/lib/supabase.ts` exporta apenas client anon publico.
- `src/lib/supabase.server.ts` usa `import "server-only"` e concentra `SUPABASE_SERVICE_KEY`.
- `/api/auth/accounts` nao deve listar usuarios publicamente.
- APIs de watch/download/proxy foram tratadas como sensiveis em fases anteriores.
- Campo 2FA saiu do login normal.
- Rotas 2FA ficam atras de `ENABLE_ACCOUNT_2FA=true`.
- Recuperacao de senha so funciona com `ENABLE_PASSWORD_RESET=true`, `RESEND_API_KEY` e `EMAIL_FROM`.
- `next.config.mjs` define headers basicos de seguranca, incluindo CSP conservadora, HSTS, `nosniff`, frame protection, referrer policy e permissions policy.

## Regras obrigatorias

- Nunca importar `supabase.server.ts` em Client Component.
- Nunca expor `SUPABASE_SERVICE_KEY` no browser.
- Admin deve ser validado no servidor em toda API admin.
- Usuario comum so acessa dados proprios.
- Sources privadas nao devem ser retornadas em payload publico de catalogo.
- Logs nao podem conter senha, reset token, refresh token ou source privada sensivel.

## RLS

A migration canonica ativa RLS em:

- `content`
- `seasons`
- `episodes`
- `sources`
- `watch_progress`
- `watchlist_folders`
- `watchlist`
- `admin_audit_logs`

Politicas iniciais:

- Conteudo/temporadas/episodios publicos podem ser lidos por anon/authenticated.
- Progresso e watchlist sao self-only via `auth.uid()` quando acessados direto pelo Supabase.
- `sources` e `admin_audit_logs` ficam sem policy publica de leitura/escrita; acesso operacional deve passar pelo servidor.

## Pendencias

- Criar helpers centrais `requireUser`, `requireAdmin`, `requireModerator` e substituir checks soltos.
- Adicionar auditoria em todas as acoes admin destrutivas.
- Apertar CSP gradualmente quando os dominios reais de video/embed estiverem consolidados.
- Escrever testes de IDOR para perfil, watchlist, progresso, bugs, sugestoes e admin.

## Atualizacao 2026-06-04 - Hardening V10

- `imgsrv.crunchyroll.com` foi removido da allowlist de imagens e do proxy `/api/image` para evitar dependencia de asset protegido.
- A CSP ainda permite `https:` em midia/frame/connect por causa dos providers de video existentes; ela deve ser apertada quando os dominios reais estiverem consolidados.
- Password reset publico so deve aparecer quando as flags publicas e servidoras estiverem ativas e `RESEND_API_KEY`/`EMAIL_FROM` existirem.
- A proxima auditoria deve revisar todas as rotas `src/app/api/admin/**` para confirmar helper admin centralizado em cada endpoint.

## Atualizacao 2026-06-04 - Password reset status

- Criado `/api/auth/password-reset-status` para a UI verificar disponibilidade real de recuperacao de senha no servidor.
- `login`, `forgot-password` e `reset-password` passam a esconder/desabilitar o fluxo quando `ENABLE_PASSWORD_RESET`, `NEXT_PUBLIC_ENABLE_PASSWORD_RESET`, `RESEND_API_KEY` e `EMAIL_FROM` nao estiverem coerentes.
