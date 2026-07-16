# Integração Supabase

O mobile chama o backend por `BACKEND_URL`. O app nunca acessa o Postgres diretamente.

No backend, configure `DATABASE_URL` em `../rpg_backend/.env` ou nas variáveis do provedor de deploy. Esse arquivo está ignorado pelo Git.

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
