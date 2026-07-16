import fs from 'node:fs';

import { closePool } from '../lib/postgres.js';
import { upsertCatalogEntry } from '../lib/catalogStore.js';

loadDotEnv();

const labels = {
  armor: { id: 'label_armadura', name: 'Armadura', color: 'blue' },
  light: { id: 'label_armadura_leve', name: 'Armadura Leve', color: 'green' },
  medium: { id: 'label_armadura_media', name: 'Armadura Média', color: 'yellow' },
  heavy: { id: 'label_armadura_pesada', name: 'Armadura Pesada', color: 'red' },
  shield: { id: 'label_escudo', name: 'Escudo', color: 'purple' },
};

const armors = [
  { name: 'Armadura de Couro', category: 'Leve', defense: 1, weight: 5, description: 'Proteção leve e flexível, adequada para mobilidade e furtividade.' },
  { name: 'Armadura de Couro Batido', category: 'Leve', defense: 2, weight: 7, description: 'Couro reforçado em camadas para absorver impactos sem limitar muito os movimentos.' },
  { name: 'Cota de Escamas', category: 'Média', defense: 3, weight: 12, description: 'Placas sobrepostas oferecem proteção intermediária e cobertura ampla.' },
  { name: 'Peitoral', category: 'Média', defense: 4, weight: 10, description: 'Placa metálica protege o torso mantendo braços e pernas relativamente livres.' },
  { name: 'Cota de Malha', category: 'Pesada', defense: 5, weight: 18, description: 'Malha metálica pesada que distribui o impacto por toda a superfície.' },
  { name: 'Armadura de Placas', category: 'Pesada', defense: 6, weight: 25, description: 'Conjunto completo de placas, oferecendo a maior proteção do catálogo inicial.' },
  { name: 'Escudo', category: 'Escudo', defense: 1, weight: 4, description: 'Proteção empunhada que pode ser combinada com uma armadura.' },
];

try {
  for (const armor of armors) {
    const subtype = armor.category === 'Leve' ? 'light' : armor.category === 'Média' ? 'medium' : armor.category === 'Pesada' ? 'heavy' : 'shield';
    const metadata = {
      schemaVersion: 1,
      type: 'item',
      itemType: 'armor',
      armorCategory: armor.category.toLowerCase(),
      weight: armor.weight,
      modifiers: [{ targetType: 'stat', targetId: 'defense', value: armor.defense }],
    };
    const description = `# ${armor.name}\n\n**Tipo:** Armadura ${armor.category}\n**Defesa:** +${armor.defense}\n**Peso:** ${armor.weight}\n\n${armor.description}\n\nO bônus de Defesa é aplicado somente enquanto o item estiver equipado.\n\n---\nMetadados usados automaticamente pelos aplicativos. Edite com cuidado.\n<!-- RPG_RULES_JSON_START -->\n${JSON.stringify(metadata, null, 2)}\n<!-- RPG_RULES_JSON_END -->`;
    await upsertCatalogEntry('Equipamentos', {
      name: armor.name,
      description,
      labels: [labels.armor, labels[subtype]],
      metadata,
    });
  }
  console.log(`Armaduras sincronizadas: ${armors.length} entradas e ${Object.keys(labels).length} etiquetas.`);
} finally {
  await closePool();
}

function loadDotEnv() {
  const path = new URL('../.env', import.meta.url);
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[name]) process.env[name] = value;
  }
}
