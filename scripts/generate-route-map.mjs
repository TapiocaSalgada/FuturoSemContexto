import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const appDir = path.join(projectRoot, "src", "app");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function routeFromPage(filePath) {
  const rel = toPosix(path.relative(appDir, filePath));
  if (rel === "page.tsx") return "/";
  return `/${rel.replace(/\/page\.tsx$/, "")}`;
}

function routeFromApi(filePath) {
  const rel = toPosix(path.relative(appDir, filePath));
  return `/${rel.replace(/\/route\.ts$/, "")}`;
}

function isAdminOnlyByCode(content) {
  const hasRequireAdmin =
    /function\s+requireAdmin\s*\(/.test(content) || /requireAdmin\s*\(\)/.test(content);
  const hasDirectRoleGuard =
    /!session\s*\|\|[^\n\r]*role\s*!==\s*["']admin["']/.test(content) ||
    /\(session\.user\s+as\s+any\)\.role\s*!==\s*["']admin["']/.test(content);
  return hasRequireAdmin || hasDirectRoleGuard;
}

function markdownTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

const allFiles = walk(appDir);

const pageFiles = allFiles
  .filter((f) => f.endsWith(`${path.sep}page.tsx`))
  .filter((f) => !f.includes(`${path.sep}src${path.sep}app${path.sep}api${path.sep}`));

const apiFiles = allFiles
  .filter((f) => f.includes(`${path.sep}src${path.sep}app${path.sep}api${path.sep}`))
  .filter((f) => f.endsWith(`${path.sep}route.ts`));

const pages = pageFiles
  .map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const serverRedirects = [...content.matchAll(/redirect\(["'`]([^"'`]+)["'`]\)/g)].map(
      (m) => m[1],
    );
    const clientReplaces = [...content.matchAll(/router\.replace\(["'`]([^"'`]+)["'`]\)/g)].map(
      (m) => m[1],
    );
    const route = routeFromPage(filePath);
    const redirectTargets = [...new Set([...serverRedirects, ...clientReplaces])];

    if (route === "/profile") {
      redirectTargets.push("/profile/[id] (com id da sessao)");
    }

    let access = "Autenticado";
    if (route === "/login" || route === "/register") access = "Publico";
    if (route.startsWith("/admin")) access = "Admin (validado na tela/API)";

    return {
      route,
      access,
      redirectsTo: [...new Set(redirectTargets)],
      file: toPosix(path.relative(projectRoot, filePath)),
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const apis = apiFiles
  .map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const route = routeFromApi(filePath);
    const methods = [
      ...new Set(
        [...content.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map(
          (m) => m[1],
        ),
      ),
    ];
    const adminOnly = route.startsWith("/api/admin") || isAdminOnlyByCode(content);

    let access = "Autenticado";
    if (route.startsWith("/api/auth")) access = "Publico";
    else if (adminOnly) access = "Admin";

    const group = route.split("/")[2] || "misc";

    return {
      route,
      methods: methods.join(", ") || "-",
      access,
      group,
      file: toPosix(path.relative(projectRoot, filePath)),
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const apiGroups = [...new Set(apis.map((a) => a.group))].sort();
const matcher =
  "/((?!api/auth|login|register|_next/static|_next/image|favicon.ico|manifest.json|site.webmanifest|sw.js|.*\\\\..*).*)";

const pageRows = pages.map((p) => [
  `\`${p.route}\``,
  p.access,
  p.redirectsTo.length ? `\`${p.redirectsTo.join(", ")}\`` : "-",
  `\`${p.file}\``,
]);

let markdown = "";
markdown += "# Mapa do Codigo e Rotas\n\n";
markdown += `Atualizado automaticamente em: ${new Date().toISOString()}\n\n`;
markdown += "## Contexto Geral\n";
markdown += "- Stack principal: Next.js (App Router) + NextAuth + Prisma + PostgreSQL.\n";
markdown +=
  "- Layout global: `src/app/layout.tsx` + `src/components/Providers.tsx` + `src/components/AppLayout.tsx`.\n";
markdown +=
  "- Politica de acesso global via middleware: praticamente tudo exige sessao, exceto login/registro e auth API.\n";
markdown += `- Matcher do middleware: \`${matcher}\`\n\n`;

markdown += "## Estrutura de Pastas (src)\n";
markdown += "- `src/app`: rotas de pagina e endpoints API.\n";
markdown += "- `src/components`: layout, navegacao, cards, player de video e UI compartilhada.\n";
markdown += "- `src/lib`: autenticacao, acesso a dados, integracoes, estado de tema e utilitarios de dominio.\n";
markdown +=
  "- `prisma/schema.prisma`: modelo de dados (User, Anime, Episode, Manga, Favorites, Comments, etc).\n\n";

markdown += `## Rotas de Pagina (${pages.length})\n`;
markdown += markdownTable(["Rota", "Acesso", "Redireciona para", "Arquivo"], pageRows);
markdown += "\n\n";

markdown += `## Rotas de API (${apis.length})\n`;
markdown += "- Regra rapida de acesso:\n";
markdown += "  - `Publico`: endpoints de auth (`/api/auth/*`)\n";
markdown += "  - `Admin`: endpoints `/api/admin/*` e outros com checagem explicita de role\n";
markdown += "  - `Autenticado`: exige usuario logado\n\n";

for (const group of apiGroups) {
  const groupApis = apis.filter((item) => item.group === group);
  markdown += `### Grupo /api/${group} (${groupApis.length})\n`;
  const rows = groupApis.map((item) => [
    `\`${item.route}\``,
    `\`${item.methods}\``,
    item.access,
    `\`${item.file}\``,
  ]);
  markdown += markdownTable(["Endpoint", "Metodos", "Acesso", "Arquivo"], rows);
  markdown += "\n\n";
}

markdown += "## Observacoes Importantes de Navegacao\n";
markdown += "- A aba Manga esta desativada por produto e varias rotas de manga redirecionam para `/`.\n";
markdown += "- `/about` redireciona para `/settings`.\n";
markdown += "- `/profile` redireciona para `/profile/[id]` da sessao ativa.\n";
markdown +=
  "- O feed social (`/social`) continua acessivel por URL direta, mesmo fora da navegacao principal.\n";
markdown += "- Paginas admin dependem de role admin na UI e nas APIs de backend.\n\n";

markdown += "## Como Manter Atualizado\n";
markdown += "- Sempre que criar/remover rota, rode `npm run docs:routes`.\n";
markdown += "- Checklist rapido: nova `page.tsx` em `src/app` e novo `route.ts` em `src/app/api`.\n";

const docsDir = path.join(projectRoot, "docs");
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
const outFile = path.join(docsDir, "MAPA_CODIGO_E_ROTAS.md");
fs.writeFileSync(outFile, markdown, "utf8");

console.log(`Arquivo atualizado: ${toPosix(path.relative(projectRoot, outFile))}`);
console.log(`Paginas: ${pages.length} | APIs: ${apis.length}`);
