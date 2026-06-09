# ADMIN_SECURITY - Futuro sem Contexto

## Protecao

- `/admin` e subrotas sao bloqueadas por middleware para nao admins.
- `src/app/admin/layout.tsx` valida admin no servidor antes de renderizar.
- Server actions chamam `requireAdminActor()` antes de alterar dados.
- A busca global admin usa `/api/admin/search`, protegida por sessao admin.
- `SUPABASE_SERVICE_KEY` continua restrita a `src/lib/supabase.server.ts` com `server-only`.

## Permissoes

- Owner e admin acessam o console.
- Alteracao de roles respeita `canManageRoles()`.
- Owner nao pode ser banido ou rebaixado por admin comum.
- Acoes destrutivas exigem confirmacao textual em formularios criticos.

## Auditoria

Acoes importantes geram `AdminAuditLog`:

- criacao/exclusao de conteudo
- publicacao/ocultacao
- criacao/exclusao de temporada
- criacao/exclusao de episodio
- criacao/toggle/exclusao de source
- triagem de bug
- status de sugestao
- role/banimento de usuario
- manutencao e avisos

## Sources

`EpisodeSource` tem RLS habilitada e sem policy publica. Usuario comum nao lista sources por Supabase; o player recebe apenas a lista resolvida por `/api/watch/[id]` apos sessao valida.

## Pendencias

- Criar testes automatizados de IDOR para APIs admin.
- Trocar todos os endpoints admin legados para `requireAdminActor()` centralizado.
- Evoluir CSP para allowlist exata de providers de video.

## Atualizacao 2026-06-04 - Seguranca Admin V10

- A protecao atual combina middleware, layout server-side e server actions.
- Nenhuma tela nova do admin deve chamar API sensivel sem validacao server-side.
- Toda acao destrutiva ou de role/source/publicacao deve registrar `AdminAuditLog` e exigir confirmacao quando irreversivel.
