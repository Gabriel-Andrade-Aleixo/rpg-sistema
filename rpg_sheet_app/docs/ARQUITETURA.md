# Arquitetura

O projeto agora fica dividido em tres partes logicas:

## Backend

Pasta irma: `../rpg_backend/`

Responsabilidades:

- Guardar `TRELLO_API_KEY` e `TRELLO_TOKEN` fora do app.
- Criar/usar o quadro Trello.
- Criar listas necessarias.
- Fazer CRUD de personagens.
- Expor API HTTP para mobile e web.

Rotas atuais:

- `GET /health`
- `POST /setup`
- `GET /characters`
- `GET /characters/:id`
- `POST /characters`
- `DELETE /characters/:id`
- `GET /catalog`

## Mobile

Pastas principais:

- `rpg_sheet_app/android/`
- `rpg_sheet_app/ios/`
- `rpg_sheet_app/lib/`

Roda o mesmo app Flutter. Em producao, deve usar `BACKEND_URL` em vez de token Trello direto.

## Web

Pasta irma: `../rpg_web/`

O web e um app Next.js em JavaScript. Ele conversa apenas com o backend por `NEXT_PUBLIC_BACKEND_URL`.

## Persistência no app

O app usa `BACKEND_URL` para personagens e catálogo. Sem backend, apenas o cache local de personagens continua disponível; regras oficiais nunca são inventadas ou carregadas de outra fonte.

## Comandos

Backend:

```bash
cd ..\rpg_backend
node server.js
```

Flutter mobile:

```bash
flutter run --dart-define-from-file=env.local.json
```

Web Next:

```bash
cd ..\rpg_web
npm install
npm run dev
```
