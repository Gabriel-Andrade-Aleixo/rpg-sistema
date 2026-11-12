import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceMetadataBlock } from '../lib/catalogStore.js';

test('sincronizar metadados novamente não duplica o aviso no cartão', () => {
  const metadata = { type: 'class', id: 'swordsman' };
  const first = replaceMetadataBlock('# Espadachim\n\nVida e Concentração.', metadata);
  const second = replaceMetadataBlock(first, metadata);
  assert.equal(second, first);
  const legacy = first.replace('---\nMetadados usados automaticamente pelos aplicativos. Edite com cuidado.', '---\nMetadados usados automaticamente pelos aplicativos.\n\n---\nMetadados usados automaticamente pelos aplicativos. Edite com cuidado.');
  assert.equal(replaceMetadataBlock(legacy, metadata), first);
});
