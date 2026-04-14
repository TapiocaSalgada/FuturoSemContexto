# Mapa do Codigo e Rotas

Atualizado automaticamente em: 2026-04-10T18:08:04.477Z

## Contexto Geral
- Stack principal: Next.js (App Router) + NextAuth + Prisma + PostgreSQL.
- Layout global: `src/app/layout.tsx` + `src/components/Providers.tsx` + `src/components/AppLayout.tsx`.
- Politica de acesso global via middleware: praticamente tudo exige sessao, exceto login/registro e auth API.
- Matcher do middleware: `/((?!api/auth|login|register|_next/static|_next/image|favicon.ico|manifest.json|site.webmanifest|sw.js|.*\\..*).*)`

## Estrutura de Pastas (src)
- `src/app`: rotas de pagina e endpoints API.
- `src/components`: layout, navegacao, cards, player de video e UI compartilhada.
- `src/lib`: autenticacao, acesso a dados, integracoes, estado de tema e utilitarios de dominio.
- `prisma/schema.prisma`: modelo de dados (User, Anime, Episode, Manga, Favorites, Comments, etc).

## Rotas de Pagina (20)
| Rota | Acesso | Redireciona para | Arquivo |
| --- | --- | --- | --- |
| `/` | Autenticado | - | `src/app/page.tsx` |
| `/about` | Autenticado | `/settings` | `src/app/about/page.tsx` |
| `/admin` | Admin (validado na tela/API) | `/` | `src/app/admin/page.tsx` |
| `/admin/actions` | Admin (validado na tela/API) | `/admin` | `src/app/admin/actions/page.tsx` |
| `/admin/import` | Admin (validado na tela/API) | - | `src/app/admin/import/page.tsx` |
| `/admin/manga-import` | Admin (validado na tela/API) | `/admin` | `src/app/admin/manga-import/page.tsx` |
| `/anime/[id]` | Autenticado | - | `src/app/anime/[id]/page.tsx` |
| `/explore` | Autenticado | - | `src/app/explore/page.tsx` |
| `/favorites` | Autenticado | - | `src/app/favorites/page.tsx` |
| `/history` | Autenticado | - | `src/app/history/page.tsx` |
| `/login` | Publico | `/` | `src/app/login/page.tsx` |
| `/mangas` | Autenticado | `/` | `src/app/mangas/page.tsx` |
| `/mangas/[id]` | Autenticado | `/` | `src/app/mangas/[id]/page.tsx` |
| `/mangas/[id]/chapter/[chapterId]` | Autenticado | `/` | `src/app/mangas/[id]/chapter/[chapterId]/page.tsx` |
| `/profile` | Autenticado | `/profile/[id] (com id da sessao)` | `src/app/profile/page.tsx` |
| `/profile/[id]` | Autenticado | - | `src/app/profile/[id]/page.tsx` |
| `/register` | Publico | - | `src/app/register/page.tsx` |
| `/settings` | Autenticado | - | `src/app/settings/page.tsx` |
| `/social` | Autenticado | - | `src/app/social/page.tsx` |
| `/watch/[id]` | Autenticado | - | `src/app/watch/[id]/page.tsx` |

## Rotas de API (63)
- Regra rapida de acesso:
  - `Publico`: endpoints de auth (`/api/auth/*`)
  - `Admin`: endpoints `/api/admin/*` e outros com checagem explicita de role
  - `Autenticado`: exige usuario logado

### Grupo /api/achievements (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/achievements` | `GET, POST, PATCH` | Autenticado | `src/app/api/achievements/route.ts` |

### Grupo /api/admin (26)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/admin/alerts` | `GET` | Admin | `src/app/api/admin/alerts/route.ts` |
| `/api/admin/anfire` | `GET` | Admin | `src/app/api/admin/anfire/route.ts` |
| `/api/admin/anime` | `POST, PUT, DELETE, GET` | Admin | `src/app/api/admin/anime/route.ts` |
| `/api/admin/anime/media` | `GET` | Admin | `src/app/api/admin/anime/media/route.ts` |
| `/api/admin/anime/metadata` | `GET` | Admin | `src/app/api/admin/anime/metadata/route.ts` |
| `/api/admin/anime/sync` | `POST` | Admin | `src/app/api/admin/anime/sync/route.ts` |
| `/api/admin/animefenix` | `GET` | Admin | `src/app/api/admin/animefenix/route.ts` |
| `/api/admin/anisbr` | `GET` | Admin | `src/app/api/admin/anisbr/route.ts` |
| `/api/admin/bug-reports` | `GET, PATCH, DELETE` | Admin | `src/app/api/admin/bug-reports/route.ts` |
| `/api/admin/categories` | `GET, POST, DELETE` | Admin | `src/app/api/admin/categories/route.ts` |
| `/api/admin/comments` | `GET, DELETE` | Admin | `src/app/api/admin/comments/route.ts` |
| `/api/admin/dashboard` | `GET` | Admin | `src/app/api/admin/dashboard/route.ts` |
| `/api/admin/episode` | `POST, PUT, DELETE, GET` | Admin | `src/app/api/admin/episode/route.ts` |
| `/api/admin/maintenance` | `GET, PATCH` | Admin | `src/app/api/admin/maintenance/route.ts` |
| `/api/admin/manga` | `GET, POST, PATCH, DELETE` | Admin | `src/app/api/admin/manga/route.ts` |
| `/api/admin/manga/import` | `POST` | Admin | `src/app/api/admin/manga/import/route.ts` |
| `/api/admin/manga/sync` | `POST` | Admin | `src/app/api/admin/manga/sync/route.ts` |
| `/api/admin/mangadex/search` | `GET` | Admin | `src/app/api/admin/mangadex/search/route.ts` |
| `/api/admin/mobile-app` | `GET` | Admin | `src/app/api/admin/mobile-app/route.ts` |
| `/api/admin/navigation` | `GET, PATCH` | Admin | `src/app/api/admin/navigation/route.ts` |
| `/api/admin/playanimes` | `GET` | Admin | `src/app/api/admin/playanimes/route.ts` |
| `/api/admin/proxy` | `GET` | Admin | `src/app/api/admin/proxy/route.ts` |
| `/api/admin/proxy/search` | `GET` | Admin | `src/app/api/admin/proxy/search/route.ts` |
| `/api/admin/sugoi` | `GET` | Admin | `src/app/api/admin/sugoi/route.ts` |
| `/api/admin/users` | `GET, PATCH, DELETE` | Admin | `src/app/api/admin/users/route.ts` |
| `/api/admin/watch-player-config` | `GET, PATCH` | Admin | `src/app/api/admin/watch-player-config/route.ts` |

### Grupo /api/anime (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/anime/[id]` | `GET` | Autenticado | `src/app/api/anime/[id]/route.ts` |

### Grupo /api/announcements (2)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/announcements` | `GET, POST, DELETE` | Admin | `src/app/api/announcements/route.ts` |
| `/api/announcements/read` | `POST` | Autenticado | `src/app/api/announcements/read/route.ts` |

### Grupo /api/auth (3)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | `-` | Publico | `src/app/api/auth/[...nextauth]/route.ts` |
| `/api/auth/accounts` | `GET` | Publico | `src/app/api/auth/accounts/route.ts` |
| `/api/auth/register` | `POST` | Publico | `src/app/api/auth/register/route.ts` |

### Grupo /api/bug-reports (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/bug-reports` | `POST` | Autenticado | `src/app/api/bug-reports/route.ts` |

### Grupo /api/comments (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/comments` | `GET, POST, PATCH, DELETE` | Autenticado | `src/app/api/comments/route.ts` |

### Grupo /api/download (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/download/[episodeId]` | `GET` | Autenticado | `src/app/api/download/[episodeId]/route.ts` |

### Grupo /api/favorites (2)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/favorites` | `POST, GET, DELETE` | Autenticado | `src/app/api/favorites/route.ts` |
| `/api/favorites/folders` | `GET, POST, PATCH, DELETE` | Autenticado | `src/app/api/favorites/folders/route.ts` |

### Grupo /api/feed (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/feed` | `GET` | Autenticado | `src/app/api/feed/route.ts` |

### Grupo /api/follows (2)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/follows` | `GET, POST` | Autenticado | `src/app/api/follows/route.ts` |
| `/api/follows/list` | `GET` | Autenticado | `src/app/api/follows/list/route.ts` |

### Grupo /api/history (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/history` | `GET, POST, DELETE` | Autenticado | `src/app/api/history/route.ts` |

### Grupo /api/local-files (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/local-files` | `GET` | Autenticado | `src/app/api/local-files/route.ts` |

### Grupo /api/mangas (4)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/mangas` | `GET` | Autenticado | `src/app/api/mangas/route.ts` |
| `/api/mangas/[id]` | `GET` | Autenticado | `src/app/api/mangas/[id]/route.ts` |
| `/api/mangas/chapter/[chapterId]` | `GET` | Autenticado | `src/app/api/mangas/chapter/[chapterId]/route.ts` |
| `/api/mangas/chapter/[chapterId]/image` | `GET` | Autenticado | `src/app/api/mangas/chapter/[chapterId]/image/route.ts` |

### Grupo /api/mobile (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/mobile/push/register` | `POST, DELETE` | Autenticado | `src/app/api/mobile/push/register/route.ts` |

### Grupo /api/notifications (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/notifications` | `GET, PATCH` | Autenticado | `src/app/api/notifications/route.ts` |

### Grupo /api/presence (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/presence` | `POST` | Autenticado | `src/app/api/presence/route.ts` |

### Grupo /api/profile (4)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/profile` | `PATCH, GET` | Autenticado | `src/app/api/profile/route.ts` |
| `/api/profile/change-email` | `POST` | Autenticado | `src/app/api/profile/change-email/route.ts` |
| `/api/profile/change-password` | `POST` | Autenticado | `src/app/api/profile/change-password/route.ts` |
| `/api/profile/connections` | `GET` | Autenticado | `src/app/api/profile/connections/route.ts` |

### Grupo /api/ratings (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/ratings` | `GET, POST` | Autenticado | `src/app/api/ratings/route.ts` |

### Grupo /api/search (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/search` | `GET` | Autenticado | `src/app/api/search/route.ts` |

### Grupo /api/settings (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/settings` | `GET, PATCH` | Autenticado | `src/app/api/settings/route.ts` |

### Grupo /api/suggestions (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/suggestions` | `GET, POST, PATCH, DELETE` | Admin | `src/app/api/suggestions/route.ts` |

### Grupo /api/system (2)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/system/maintenance` | `GET` | Autenticado | `src/app/api/system/maintenance/route.ts` |
| `/api/system/navigation` | `GET` | Autenticado | `src/app/api/system/navigation/route.ts` |

### Grupo /api/upload (1)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/upload` | `POST` | Autenticado | `src/app/api/upload/route.ts` |

### Grupo /api/watch (2)
| Endpoint | Metodos | Acesso | Arquivo |
| --- | --- | --- | --- |
| `/api/watch/[id]` | `GET` | Autenticado | `src/app/api/watch/[id]/route.ts` |
| `/api/watch/telemetry` | `POST` | Autenticado | `src/app/api/watch/telemetry/route.ts` |

## Observacoes Importantes de Navegacao
- A aba Manga esta desativada por produto e varias rotas de manga redirecionam para `/`.
- `/about` redireciona para `/settings`.
- `/profile` redireciona para `/profile/[id]` da sessao ativa.
- O feed social (`/social`) continua acessivel por URL direta, mesmo fora da navegacao principal.
- Paginas admin dependem de role admin na UI e nas APIs de backend.

## Como Manter Atualizado
- Sempre que criar/remover rota, rode `npm run docs:routes`.
- Checklist rapido: nova `page.tsx` em `src/app` e novo `route.ts` em `src/app/api`.
