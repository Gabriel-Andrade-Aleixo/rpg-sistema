# Integração Supabase

O mobile chama o backend por `BACKEND_URL`. O app nunca acessa o Postgres diretamente.

No backend, configure `DATABASE_URL` em `../rpg_backend/.env` ou nas variáveis do provedor de deploy. Esse arquivo está ignorado pelo Git.

## Vercel

Em deploy na Vercel, não use a URL direta do banco no formato `db.<project-ref>.supabase.co`. Essa URL direta do Supabase pode resolver apenas para IPv6, e as Functions da Vercel não conectam em hosts IPv6.

Use uma destas opções:

- Preferencial: no Supabase, clique em **Connect**, selecione **Transaction pooler** e copie a URI da porta `6543`. Coloque essa URI em `DATABASE_URL` na Vercel, defina `DATABASE_POOL_MAX=1` e faça redeploy.
- Alternativa paga: habilite o IPv4 add-on do Supabase e então use a URL direta.

Depois de trocar a variável, teste:

```bash
curl https://SEU_BACKEND.vercel.app/catalog
```

Se retornar o catálogo, a conexão do backend com o Postgres voltou.

Configure também `ALLOWED_ORIGINS` com a URL exata do site. Mais de uma origem pode ser separada por vírgula.

## Migrações

O backend não cria tabelas durante o cold start. Antes de publicar uma versão que altere o banco, execute localmente:

```bash
cd ../rpg_backend
npm run db:migrate
```

As migrações versionadas ficam em `../supabase/migrations`. Elas habilitam RLS e removem acesso direto de `anon`, `authenticated` e `service_role`; somente o backend com a conexão Postgres acessa as tabelas internas.

## Tabelas principais

- `catalog_categories`: categorias oficiais, como `Classes`, `Racas`, `Magias`, `Equipamentos` e `Sistema`.
- `catalog_entries`: entradas oficiais do catálogo, com descrição, etiquetas, URL de imagem e metadados JSONB.
- `characters`: ficha atual do personagem em JSONB.
- `character_revisions`: histórico de revisões de ficha.
- `catalog_entry_revisions`: histórico de alterações do catálogo.
- `media_assets`: imagens enviadas pelo Mestre, limitadas a 2 MB.
- `auth_rate_limits`: limites de tentativas de login e cadastro.

## Regras estruturadas

Classes, raças, itens e magias oficiais podem conter o bloco:

```text
<!-- RPG_RULES_JSON_START -->
...
<!-- RPG_RULES_JSON_END -->
```

Esse JSON controla fórmulas de HP, mana, Defesa/CA, recursos, progressão de atributos, variantes raciais, bônus de rolagem, custos de magia e modificadores de equipamento. Alterações válidas passam a valer no web e no mobile após sincronizar o catálogo.

Para recriar categorias e regras iniciais:

```bash
cd ../rpg_backend
npm run sync:system
npm run sync:document
npm run sync:rules
npm run sync:armors
npm run sync:spells
```
