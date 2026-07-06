import { useMemo, useState } from 'react';
import { Image as ImageIcon, LayoutDashboard, Package, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react';
import { catalogGroups, displayDescription, findEntry, parseRuleMetadata } from '../lib/catalogEngine';
import RpgImage from './RpgImage';

const emptyItem = { name: '', type: 'Armadura', armorCategory: 'Leve', description: '', bonusTarget: 'defense', bonusValue: 1, weight: 0, imageUrl: '' };
const emptySpell = { name: '', school: 'Arcana', topic: 'Sem tópico', className: '', actionType: '', actionId: '', level: 0, description: '', manaCost: 0, focusCost: 0, humanityCost: 0, range: '', damage: '', imageUrl: '' };

export default function AdminView({ catalog, characters, onRefresh, onSaveCatalogEntry, onDeleteCatalogEntry, onCreateItem }) {
  const [tab, setTab] = useState('overview');
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const groups = catalogGroups(catalog);
  const withoutDescription = catalog.entries.filter((entry) => !entry.description?.trim()).length;
  const withoutImage = catalog.entries.filter((entry) => !entry.imageUrl).length;
  const invalid = characters.filter((character) => {
    const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId);
    return parseRuleMetadata(race)?.type !== 'race' || parseRuleMetadata(characterClass)?.type !== 'class';
  }).length;
  const metrics = [
    ['Entradas oficiais', catalog.entries.length, 'library'],
    ['Itens e equipamentos', groups.items.length, 'items'],
    ['Magias', groups.spells.length, 'spells'],
    ['Personagens', characters.length, 'characters'],
    ['Sem descrição', withoutDescription, 'description'],
    ['Sem imagem', withoutImage, 'images'],
    ['Fichas inconsistentes', invalid, 'warning'],
  ];
  const activeEntries = tab === 'spells' ? groups.spells : groups.items;
  const filtered = useMemo(() => activeEntries.filter((entry) => entry.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [activeEntries, search]);

  function beginCreate(kind) {
    setEditor({ kind, id: '', value: kind === 'spell' ? { ...emptySpell } : { ...emptyItem } });
    setMessage('');
  }

  function beginEdit(kind, entry) {
    setEditor({ kind, id: entry.id, value: kind === 'spell' ? spellFromEntry(entry) : itemFromEntry(entry) });
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    if (!editor) return;
    setSubmitting(true);
    setMessage('');
    try {
      if (onSaveCatalogEntry) await onSaveCatalogEntry(editor.kind, editor.value, editor.id);
      else if (editor.kind === 'item' && onCreateItem) await onCreateItem(editor.value);
      setMessage(`${editor.kind === 'spell' ? 'Magia' : 'Item'} ${editor.id ? 'atualizado' : 'criado'} no Trello.`);
      setEditor(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(kind, entry) {
    if (!window.confirm(`Excluir ${entry.name} do catálogo oficial?`)) return;
    setSubmitting(true);
    setMessage('');
    try {
      await onDeleteCatalogEntry(kind, entry.id);
      if (editor?.id === entry.id) setEditor(null);
      setMessage(`${kind === 'spell' ? 'Magia' : 'Item'} removido do catálogo.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="viewPage adminWorkspace">
    <header className="viewHeader"><div><span className="eyebrow">Administração</span><h2>Biblioteca oficial</h2><p>Gerencie o conteúdo sincronizado com o Trello.</p></div><button className="ghostButton refreshButton" onClick={onRefresh}><RefreshCw aria-hidden="true" />Sincronizar</button></header>
    <nav className="adminTabs" aria-label="Áreas do modo mestre">
      <button className={tab === 'overview' ? 'active' : ''} onClick={() => { setTab('overview'); setEditor(null); }}><LayoutDashboard aria-hidden="true" />Visão geral</button>
      <button className={tab === 'items' ? 'active' : ''} onClick={() => { setTab('items'); setEditor(null); }}><Package aria-hidden="true" />Itens <span>{groups.items.length}</span></button>
      <button className={tab === 'spells' ? 'active' : ''} onClick={() => { setTab('spells'); setEditor(null); }}><Sparkles aria-hidden="true" />Magias <span>{groups.spells.length}</span></button>
    </nav>
    {message && <p className={/criado|atualizado|removido/.test(message) ? 'noticeText adminMessage' : 'validationError adminMessage'}>{message}</p>}
    {tab === 'overview' ? <>
      <div className="adminGrid">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="adminDiagnostic"><div><h3>Qualidade do catálogo</h3><p>{invalid ? `${invalid} ficha(s) precisam de revisão de raça ou classe.` : 'As fichas estão consistentes com o catálogo atual.'}</p></div><div><strong>{catalog.board?.name || 'GERENCIAMENTO RPG'}</strong><span>Fonte oficial no Trello</span></div></section>
    </> : <div className={`catalogManager ${editor ? 'editing' : ''}`}>
      <section className="catalogManagerList">
        <div className="managerToolbar"><label className="searchField"><Search aria-hidden="true" /><input aria-label={`Buscar ${tab === 'spells' ? 'magias' : 'itens'}`} placeholder={`Buscar ${tab === 'spells' ? 'magias' : 'itens'}...`} value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="primaryButton" onClick={() => beginCreate(tab === 'spells' ? 'spell' : 'item')}><Plus aria-hidden="true" />Novo</button></div>
        <div className="managerEntries">{filtered.map((entry) => <article className="managerEntry" key={entry.id}><RpgImage src={entry.imageUrl} alt="" className="managerThumb" fallback={<ImageIcon aria-hidden="true" />} /><div><strong>{entry.name}</strong><span>{entry.labels?.map((label) => label.name).filter(Boolean).slice(0, 2).join(' · ') || entry.category}</span><p>{summaryFromEntry(entry)}</p></div><div className="managerEntryActions"><button className="iconButton" title="Editar" aria-label={`Editar ${entry.name}`} onClick={() => beginEdit(tab === 'spells' ? 'spell' : 'item', entry)}><Pencil aria-hidden="true" /></button><button className="iconButton dangerButton" title="Excluir" aria-label={`Excluir ${entry.name}`} onClick={() => remove(tab === 'spells' ? 'spell' : 'item', entry)}><Trash2 aria-hidden="true" /></button></div></article>)}</div>
        {!filtered.length && <div className="managerEmpty"><span>{search ? 'Nenhum resultado para esta busca.' : `Nenhum ${tab === 'spells' ? 'feitiço' : 'item'} cadastrado.`}</span></div>}
      </section>
      {editor && <CatalogEditor editor={editor} setEditor={setEditor} onSubmit={save} submitting={submitting} />}
    </div>}
  </section>;
}

function CatalogEditor({ editor, setEditor, onSubmit, submitting }) {
  const { kind, value } = editor;
  const set = (field, next) => setEditor({ ...editor, value: { ...value, [field]: next } });
  return <aside className="catalogEditor"><div className="editorHeader"><div><span className="eyebrow">{editor.id ? 'Editar' : 'Novo cadastro'}</span><h3>{kind === 'spell' ? 'Magia' : 'Item oficial'}</h3></div><button className="iconButton" type="button" title="Fechar editor" onClick={() => setEditor(null)}><X aria-hidden="true" /></button></div>
    <form className="catalogEditorForm" onSubmit={onSubmit}>
      <label>Nome<input required minLength="2" value={value.name} onChange={(event) => set('name', event.target.value)} /></label>
      {kind === 'item' ? <ItemFields value={value} set={set} /> : <SpellFields value={value} set={set} />}
      {kind === 'spell' && <div className="formPair"><label>Tópico<input value={value.topic} onChange={(event) => set('topic', event.target.value)} /></label><label>Classe indicada<input value={value.className} onChange={(event) => set('className', event.target.value)} /></label></div>}
      <label>Descrição<textarea rows="5" value={value.description} onChange={(event) => set('description', event.target.value)} /></label>
      <label>URL da imagem<input type="url" placeholder="https://..." value={value.imageUrl} onChange={(event) => set('imageUrl', event.target.value)} /></label>
      <div className="imagePreview"><RpgImage src={value.imageUrl} alt="Prévia" fallback={<><ImageIcon aria-hidden="true" /><span>Prévia da imagem</span></>} /></div>
      <button className="primaryButton" disabled={submitting} type="submit">{submitting ? 'Salvando...' : editor.id ? 'Salvar alterações' : `Criar ${kind === 'spell' ? 'magia' : 'item'}`}</button>
    </form>
  </aside>;
}

function ItemFields({ value, set }) {
  return <><div className="formPair"><label>Tipo<select value={value.type} onChange={(event) => { const type = event.target.value; set('type', type); if (type === 'Armadura' && !value.armorCategory) set('armorCategory', 'Leve'); }}><option>Armadura</option><option>Arma</option><option>Consumível</option><option>Artefato</option><option>Outro</option></select></label>{value.type === 'Armadura' && <label>Categoria<select value={value.armorCategory} onChange={(event) => set('armorCategory', event.target.value)}><option>Leve</option><option>Média</option><option>Pesada</option><option>Escudo</option></select></label>}</div><div className="formPair"><label>Bônus em<select value={value.bonusTarget} onChange={(event) => set('bonusTarget', event.target.value)}><option value="">Sem bônus</option><option value="defense">Defesa</option><option value="armorClass">CA</option><option value="attack">Ataque</option><option value="damage">Dano</option><option value="health">Vida</option><option value="mana">Mana</option><option value="strength">Força</option><option value="dexterity">Destreza</option><option value="constitution">Constituição</option><option value="intelligence">Inteligência</option><option value="charisma">Carisma</option><option value="faith">Fé</option></select></label><label>Valor<input type="number" min="-99" max="99" disabled={!value.bonusTarget} value={value.bonusValue} onChange={(event) => set('bonusValue', event.target.value)} /></label></div><label>Peso<input type="number" min="0" step="0.1" value={value.weight} onChange={(event) => set('weight', event.target.value)} /></label></>;
}

function SpellFields({ value, set }) {
  return <><div className="formPair"><label>Tipo<select value={value.school} onChange={(event) => set('school', event.target.value)}><option>Arcana</option><option>Divina</option><option>Espectral</option><option>Elemental</option><option>Demoníaca</option><option>Natural</option><option>Outra</option></select></label><label>Nível<input type="number" min="0" max="20" value={value.level} onChange={(event) => set('level', event.target.value)} /></label></div><div className="formTriple"><label>Mana<input type="number" min="0" value={value.manaCost} onChange={(event) => set('manaCost', event.target.value)} /></label><label>Foco<input type="number" min="0" value={value.focusCost} onChange={(event) => set('focusCost', event.target.value)} /></label><label>Humanidade<input type="number" min="0" value={value.humanityCost} onChange={(event) => set('humanityCost', event.target.value)} /></label></div><div className="formPair"><label>Alcance<input value={value.range} onChange={(event) => set('range', event.target.value)} /></label><label>Dano ou efeito<input value={value.damage} onChange={(event) => set('damage', event.target.value)} /></label></div></>;
}

function itemFromEntry(entry) {
  const metadata = parseRuleMetadata(entry) || {};
  const modifier = metadata.modifiers?.[0] || {};
  const typeLabel = entry.labels?.map((label) => label.name).find((name) => /^Tipo: /i.test(name));
  const type = metadata.armorCategory ? 'Armadura' : typeLabel?.replace(/^Tipo: /i, '') || 'Outro';
  const categories = { leve: 'Leve', media: 'Média', pesada: 'Pesada', escudo: 'Escudo' };
  return { ...emptyItem, name: entry.name, type, armorCategory: categories[metadata.armorCategory] || 'Leve', description: summaryFromEntry(entry), bonusTarget: modifier.targetId || '', bonusValue: Number(modifier.value || 0), weight: Number(metadata.weight || 0), imageUrl: entry.imageUrl || '' };
}

function spellFromEntry(entry) {
  const metadata = parseRuleMetadata(entry) || {};
  const schools = { arcana: 'Arcana', divina: 'Divina', espectral: 'Espectral', elemental: 'Elemental', demoniaca: 'Demoníaca', natural: 'Natural', outra: 'Outra' };
  return { ...emptySpell, name: entry.name, school: schools[metadata.school] || 'Outra', topic: metadata.topic || 'Sem tópico', className: metadata.className || '', actionType: metadata.actionType || '', actionId: metadata.actionId || '', level: Number(metadata.level || 0), description: summaryFromEntry(entry), manaCost: Number(metadata.costs?.mana || 0), focusCost: Number(metadata.costs?.focus || 0), humanityCost: Number(metadata.costs?.humanity || 0), range: metadata.range || '', damage: metadata.damage || '', imageUrl: entry.imageUrl || '' };
}

function summaryFromEntry(entry) {
  return displayDescription(entry).split(/\r?\n/).filter((line) => line && !/^# /.test(line) && !/^\*\*(Tipo|Categoria|Peso|Nível|Tópico|Classe|Custo|Alcance|Dano\/Efeito):\*\*/i.test(line) && !/^O bônus é aplicado/i.test(line)).join('\n').trim();
}
