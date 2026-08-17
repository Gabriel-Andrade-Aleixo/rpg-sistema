<div align="center">
  <img src="rpg_web/public/brand/runalith-icon-192.png" width="112" alt="Logo do Runalith RPG">
  <h1>Runalith RPG</h1>
  <p>Fichas inteligentes, grimório, inventário e dados 3D para o sistema Runalith.</p>
</div>

O Runalith RPG é uma plataforma completa para criação e gerenciamento de personagens. O projeto reúne um aplicativo Flutter, uma aplicação web em Next.js e uma API Node.js conectada ao PostgreSQL do Supabase.

As regras oficiais de classes, raças, atributos, perícias, progressão e combate têm como fonte o arquivo [`RPG SISTEMA.docx`](RPG%20SISTEMA.docx). O catálogo estruturado no banco distribui as mesmas regras para web e mobile.

## Recursos

- Autenticação, sessões e múltiplas fichas por usuário.
- Fichas públicas ou privadas; outros jogadores veem apenas o resumo permitido.
- Classes, raças, variantes, atributos, perícias e proficiências estruturadas.
- Progressão por nível, XP geral, XP por atributo e XP por área.
- Controle de HP, mana, foco, Humanidade, Corrupção e testes contra a morte.
- Métodos de vida fixo, rolado e híbrido, com resultados por nível.
- Inventário oficial, moedas, equipamentos e modificadores de Defesa/CA.
- Grimório, magias personalizadas e recursos específicos de cada classe.
- Flecha Mágica e infusões do Arqueiro Espectral.
- Dice Roller 3D com modificadores e histórico local das últimas 30 rolagens.
- Temas claro e escuro e interfaces responsivas no navegador e no celular.
- Área do Mestre para catálogo, imagens, usuários, senhas e posse das fichas.
- Histórico de revisões e proteção contra conflitos de edição simultânea.

## Arquitetura

| Diretório | Tecnologia | Responsabilidade |
| --- | --- | --- |
| [`rpg_backend`](rpg_backend) | Node.js, PostgreSQL e Nodemailer | API, autenticação, regras, catálogo, personagens e e-mail |
| [`rpg_web`](rpg_web) | Next.js, React e Three.js | Aplicação web e Dice Roller 3D |
| [`rpg_sheet_app`](rpg_sheet_app) | Flutter e Dart | Aplicativo mobile com cache local |
| [`supabase`](supabase) | SQL | Migrações versionadas, RLS e estrutura do banco |
| [`RPG SISTEMA.docx`](RPG%20SISTEMA.docx) | Documento | Fonte oficial das regras do sistema |

O web e o mobile acessam somente a API. A URL e as credenciais do PostgreSQL nunca devem ser incluídas nos clientes.

## Pré-requisitos

- Node.js 20 ou superior e npm.
- Flutter com uma versão do Dart compatível com `^3.11.5`.
- Projeto PostgreSQL no Supabase.
- Android Studio/Android SDK para executar ou gerar o APK.
- PowerShell 7 para sincronizar diretamente o documento de regras.

## Início rápido

### 1. Backend

No PowerShell:

```powershell
cd rpg_backend
npm ci
Copy-Item .env.example .env
```

Preencha `rpg_backend/.env`:

```env
PORT=8787
DATABASE_URL=postgresql://postgres.PROJECT_REF:SENHA@aws-0-REGIAO.pooler.supabase.com:6543/postgres
DATABASE_SSL=true
DATABASE_POOL_MAX=1
DATABASE_IDLE_TIMEOUT_MS=10000
ALLOWED_ORIGINS=http://localhost:3000
PASSWORD_RESET_BASE_URL=http://localhost:3000
AUTH_EXPOSE_RESET_TOKEN=true
SESSION_DAYS=7
```

Em desenvolvimento, `AUTH_EXPOSE_RESET_TOKEN=true` permite testar a recuperação sem SMTP. Nunca habilite essa opção em produção.

Crie/atualize as tabelas e carregue o catálogo oficial:

```powershell
npm run db:migrate
npm run sync:system
npm run sync:document
npm run sync:rules
npm run sync:armors
npm run sync:spells
```

Inicie a API:

```powershell
npm run dev
```

A API ficará disponível em `http://localhost:8787`. Verifique com `GET http://localhost:8787/health`.

> A primeira conta cadastrada em uma base vazia recebe o papel de administrador/Mestre. As próximas contas são criadas como jogadores.

### 2. Web

Em outro terminal:

```powershell
cd rpg_web
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Conteúdo de `rpg_web/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
```

Abra `http://localhost:3000`.

### 3. Mobile

Em outro terminal:

```powershell
cd rpg_sheet_app
flutter pub get
Copy-Item env.example.json env.local.json
flutter run --dart-define-from-file=env.local.json
```

Configuração local:

```json
{
  "BACKEND_URL": "http://localhost:8787"
}
```

Em um celular físico, substitua `localhost` pelo IP do computador na rede local, por exemplo `http://192.168.0.10:8787`. O firewall precisa permitir a porta `8787`.

## Variáveis de ambiente

### Backend

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão PostgreSQL; use o Transaction Pooler na Vercel |
| `DATABASE_SSL` | Produção | Habilita TLS na conexão com o banco |
| `DATABASE_POOL_MAX` | Recomendado | Limite de conexões por instância; use `1` em serverless |
| `DATABASE_IDLE_TIMEOUT_MS` | Não | Tempo de inatividade das conexões |
| `ALLOWED_ORIGINS` | Sim | Origens web autorizadas, separadas por vírgula |
| `PASSWORD_RESET_BASE_URL` | Sim | URL do web usada nos links de recuperação |
| `AUTH_EXPOSE_RESET_TOKEN` | Não | Expõe token apenas para desenvolvimento |
| `SESSION_DAYS` | Não | Duração da sessão; padrão de 7 dias |
| `SMTP_HOST` | Para e-mail | Servidor SMTP |
| `SMTP_PORT` | Para e-mail | Porta SMTP, geralmente `587` ou `465` |
| `SMTP_SECURE` | Para e-mail | `true` para TLS implícito na porta `465` |
| `SMTP_USER` | Para e-mail | Usuário fornecido pelo provedor |
| `SMTP_PASS` | Para e-mail | Senha de aplicativo ou chave SMTP |
| `MAIL_FROM` | Para e-mail | Remetente exibido nos e-mails |

Exemplo SMTP usando placeholders:

```env
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario@dominio.com
SMTP_PASS=sua-senha-ou-chave-smtp
MAIL_FROM="Runalith RPG <usuario@dominio.com>"
```

### Clientes

- Web: `NEXT_PUBLIC_BACKEND_URL` em `rpg_web/.env.local`.
- Flutter: `BACKEND_URL` em `rpg_sheet_app/env.local.json`.

## Banco e catálogo

As migrações ficam em [`supabase/migrations`](supabase/migrations). Execute `npm run db:migrate` antes de publicar qualquer versão que altere o esquema.

Principais tabelas:

- `rpg_users`, `auth_sessions` e `password_reset_tokens`: contas e autenticação.
- `characters` e `character_revisions`: fichas e histórico.
- `catalog_categories`, `catalog_entries` e `catalog_entry_revisions`: conteúdo oficial.
- `media_assets`: imagens enviadas pelo Mestre, limitadas a 2 MB.
- `auth_rate_limits`: proteção de login, cadastro e recuperação.

As tabelas possuem RLS e não são acessadas diretamente pelo app. O backend valida propriedade, permissões e regras antes de persistir uma ficha.

## Testes e auditoria

Backend:

```powershell
cd rpg_backend
npm run check
npm test
npm run audit:rules
```

Web:

```powershell
cd rpg_web
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes E2E esperam o backend em `http://localhost:8787` e o web em `http://localhost:3000`.

Flutter:

```powershell
cd rpg_sheet_app
flutter analyze
flutter test
```

## Build do APK

Configure `rpg_sheet_app/env.local.json` com a URL HTTPS do backend de produção e execute:

```powershell
cd rpg_sheet_app
flutter build apk --release --dart-define-from-file=env.local.json
```

O arquivo será criado em `rpg_sheet_app/build/app/outputs/flutter-apk/app-release.apk`.

## Deploy na Vercel

Publique `rpg_backend` e `rpg_web` como projetos separados.

No backend:

1. Configure todas as variáveis de produção.
2. Use em `DATABASE_URL` a URI **Transaction Pooler** do Supabase, porta `6543`.
3. Defina `DATABASE_POOL_MAX=1`.
4. Inclua a URL exata do web em `ALLOWED_ORIGINS`.
5. Defina `PASSWORD_RESET_BASE_URL` com a URL pública do web.
6. Execute as migrações antes do deploy que depende delas.

No web, configure `NEXT_PUBLIC_BACKEND_URL` com a URL HTTPS pública do backend.

## Segurança

- Arquivos `.env`, `.env.local` e `env.local.json` estão ignorados pelo Git.
- Nunca coloque `DATABASE_URL`, senhas SMTP ou tokens em variáveis `NEXT_PUBLIC_*`.
- Não use a senha normal da conta de e-mail; use uma senha de aplicativo ou chave SMTP.
- Revogue e substitua imediatamente qualquer credencial exposta em commits, logs ou conversas.
- Em produção, mantenha `AUTH_EXPOSE_RESET_TOKEN=false`.

## Documentação

- [Configuração detalhada](rpg_sheet_app/docs/CONFIGURACAO.md)
- [Integração com Supabase](rpg_sheet_app/docs/SUPABASE.md)
- [Arquitetura](rpg_sheet_app/docs/ARQUITETURA.md)
