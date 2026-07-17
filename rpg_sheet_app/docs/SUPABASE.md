# Integração Supabase

O mobile chama o backend por `BACKEND_URL`. O app nunca acessa o Postgres diretamente.

No backend, configure `DATABASE_URL` em `../rpg_backend/.env` ou nas variáveis do provedor de deploy. Esse arquivo está ignorado pelo Git.

## Vercel

Em deploy na Vercel, não use a URL direta do banco no formato `db.<project-ref>.supabase.co`. Essa URL direta do Supabase pode resolver apenas para IPv6, e as Functions da Vercel não conectam em hosts IPv6.

Use uma destas opções:

- Preferencial: no Supabase, abra **Project Settings > Database > Connection string > Connection pooling** e copie a URI do **Session pooler** ou **Transaction pooler**. Coloque essa URI em `DATABASE_URL` na Vercel e faça redeploy.
- Alternativa paga: habilite o IPv4 add-on do Supabase e então use a URL direta.

Depois de trocar a variável, teste:

```bash
curl https://SEU_BACKEND.vercel.app/catalog
```

Se retornar catálogo ou erro de autenticação esperado em outras rotas, a conexão do backend com o Postgres voltou.

## Tabelas principais

- `catalog_categories`: categorias oficiais, como `Classes`, `Racas`, `Magias`, `Equipamentos` e `Sistema`.
- `catalog_entries`: entradas oficiais do catálogo, com descrição, etiquetas, URL de imagem e metadados JSONB.
- `characters`: ficha atual do personagem em JSONB.
- `character_revisions`: histórico de revisões de ficha.
- `catalog_entry_revisions`: histórico de alterações do catálogo.

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
