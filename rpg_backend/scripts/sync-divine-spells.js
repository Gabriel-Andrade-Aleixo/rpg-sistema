import { divineSpells } from '../data/divine-spells.js';
import { spectralArrowSpells } from '../data/spectral-arrow-spells.js';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';

const normalize = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const catalogResponse = await fetch(`${backendUrl}/catalog?refresh=true`);
const catalogData = await catalogResponse.json();
if (!catalogResponse.ok || catalogData.ok !== true) {
  throw new Error(catalogData.error || `Catálogo respondeu ${catalogResponse.status}.`);
}

const names = new Set((catalogData.catalog?.entries || [])
  .filter((entry) => normalize(entry.category) === 'magias')
  .map((entry) => normalize(entry.name)));
let created = 0;
let skipped = 0;

for (const spell of [...divineSpells, ...spectralArrowSpells]) {
  if (names.has(normalize(spell.name))) {
    skipped += 1;
    continue;
  }
  const response = await fetch(`${backendUrl}/catalog/spells`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spell }),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) {
    throw new Error(`${spell.name}: ${data.error || response.status}`);
  }
  names.add(normalize(spell.name));
  created += 1;
  console.log(`Criada: ${spell.name}`);
}

console.log(`Sincronização concluída: ${created} criada(s), ${skipped} já existente(s).`);
