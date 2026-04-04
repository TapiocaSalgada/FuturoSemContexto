# Futuro sem Contexto Mobile

App mobile em Expo (React Native) com WebView para o site principal.

## Rodar local

```bash
npm install
npm run start
```

Depois:

- pressione `a` para abrir no Android Emulator
- ou escaneie o QR com Expo Go no celular

## Features prontas

- navegação por abas (Inicio, Social, Lista, Configs, Perfil)
- back/forward/reload
- persistência da ultima tela
- troca de URL do servidor dentro do app (bom para teste local)
- push notifications nativas (Expo) com registro automatico no backend
- deep link de notificação para abrir a rota correta no app
- app sempre carrega seu site em tempo real (novos animes e updates aparecem sem atualizar app)

## Build de APK/AAB (Android)

```bash
npm install -g eas-cli
npx eas login
npx eas build:configure
npx eas build -p android --profile preview
```

Atalhos:

```bash
npm run build:apk
npm run build:aab
```

## Backend necessario para push

No projeto web/API (`futuro-stream-app`):

```bash
npx prisma generate
npx prisma db push
```

Isso cria a tabela de tokens mobile usada em `POST /api/mobile/push/register`.

## Fluxo de longo prazo (ja coberto)

- **Novo anime / episodio no painel:** aparece no app automaticamente, porque o app consome o site online.
- **Notificações:** quando o backend cria notificação, ele tambem dispara push para tokens mobile ativos.
- **Troca de conta no app:** token e reassociado automaticamente ao usuario logado no WebView.

## Observacoes

- O login e sessao rodam no proprio site dentro do WebView.
- Se quiser migrar para telas 100% nativas depois, esse app ja serve como base de release e transicao.
