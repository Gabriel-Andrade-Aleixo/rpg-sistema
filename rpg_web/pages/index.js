import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Copy, Crown, Moon, Pencil, Plus, Shield, Sun, Trash2 } from 'lucide-react';
import { createCatalogItem, createCatalogSpell, deleteCatalogEntry, deleteCharacter, listCharacters, loadCatalog, saveCharacter, updateCatalogEntry } from '../lib/api';
import { emptyCharacter } from '../lib/rpgData';
import { findEntry, migrateCharacter } from '../lib/catalogEngine';
import AdminView from '../components/AdminView';
import CatalogView from '../components/CatalogView';
import CharacterSheet from '../components/CharacterSheet';
import CharacterWizard from '../components/CharacterWizard';
import DiceModal from '../components/DiceModal';
import RpgImage from '../components/RpgImage';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [catalog, setCatalog] = useState({ entries: [], categories: [] });
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState('sheet');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('dark');
  const [diceRequest, setDiceRequest] = useState(null);
  const selected = useMemo(() => characters.find((item) => item.id === selectedId) || null, [characters, selectedId]);

  async function load(refresh = false, preferredId = selectedId) {
    setLoading(true);
    setError('');
    try {
      const [rawCharacters, nextCatalog] = await Promise.all([listCharacters(), loadCatalog(refresh)]);
      const migrated = rawCharacters.map((item) => migrateCharacter(item, nextCatalog));
      setCatalog(nextCatalog);
      setCharacters(migrated);
      const nextId = preferredId && migrated.some((item) => item.id === preferredId) ? preferredId : '';
      setSelectedId(nextId);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('rpg-theme');
    if (savedTheme) setTheme(savedTheme);
    load();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('rpg-theme', theme);
  }, [theme]);

  function requestRoll(request, callback) {
    setDiceRequest({ ...request, callback });
  }

  function closeRoll(record) {
    const callback = diceRequest?.callback;
    setDiceRequest(null);
    if (record && callback) callback(record);
  }

  function beginCreate() {
    if (!catalog.entries.length) { setError('O catálogo oficial está indisponível. Sincronize o Trello antes de criar uma ficha.'); return; }
    setDraft(emptyCharacter());
    setView('wizard');
  }

  function beginEdit() {
    if (!selected) return;
    setDraft(structuredClone(selected));
    setView('wizard');
  }

  async function persistDraft(character) {
    setSaving(true);
    setError('');
    try {
      const persisted = await saveCharacter(character);
      setCharacters((current) => [...current.filter((item) => item.id !== persisted.id), migrateCharacter(persisted, catalog)]);
      setSelectedId(persisted.id);
      setDraft(null);
      setView('sheet');
      await load(false, persisted.id);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateCharacter(character) {
    const compact = { ...character, rollHistory: (character.rollHistory || []).slice(0, 20), experienceHistory: (character.experienceHistory || []).slice(0, 20), classXpHistory: (character.classXpHistory || []).slice(0, 20), humanityHistory: (character.humanityHistory || []).slice(0, 20) };
    setCharacters((current) => current.map((item) => item.id === compact.id ? compact : item));
    try {
      const persisted = await saveCharacter(compact);
      setCharacters((current) => current.map((item) => item.id === persisted.id ? migrateCharacter(persisted, catalog) : item));
    } catch (reason) { setError(reason.message); }
  }

  async function removeCharacter(character) {
    if (!window.confirm(`Excluir ${character.name || 'personagem'}?`)) return;
    try {
      await deleteCharacter(character.id);
      const remaining = characters.filter((item) => item.id !== character.id);
      setCharacters(remaining);
      setSelectedId(remaining[0]?.id || '');
    } catch (reason) { setError(reason.message); }
  }

  async function duplicateCharacter(character) {
    const copy = { ...structuredClone(character), id: `char_${Date.now()}`, name: `${character.name} (cópia)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await persistDraft(copy);
  }

  async function saveMasterEntry(kind, entry, id = '') {
    setSaving(true);
    setError('');
    try {
      if (id) await updateCatalogEntry(kind, id, entry);
      else if (kind === 'spell') await createCatalogSpell(entry);
      else await createCatalogItem(entry);
      await load(true, selectedId);
    } catch (reason) {
      setError(reason.message);
      throw reason;
    } finally {
      setSaving(false);
    }
  }

  async function removeMasterEntry(kind, id) {
    setSaving(true);
    setError('');
    try {
      await deleteCatalogEntry(kind, id);
      await load(true, selectedId);
    } catch (reason) {
      setError(reason.message);
      throw reason;
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandBlock"><div className="sigil">20</div><div><h1>RPG Manager</h1><span>Fichas inteligentes</span></div></div>
        <button className="primaryButton createButton" onClick={beginCreate} disabled={!catalog.entries.length}><Plus aria-hidden="true" />Criar personagem</button>
        <nav className="mainNav">
          <button className={view === 'sheet' || view === 'wizard' ? 'active' : ''} onClick={() => { setView('sheet'); setDraft(null); }}><Shield aria-hidden="true" /><span>Fichas</span></button>
          <button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><BookOpen aria-hidden="true" /><span>Catálogo</span></button>
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}><Crown aria-hidden="true" /><span>Mestre</span></button>
        </nav>
        <div className="statusRow"><span>{characters.length} fichas</span><span>{catalog.entries?.length || 0} cartões</span></div>
        {loading && <p className="muted">Sincronizando...</p>}
        {error && <div className="sidebarError"><p>{error}</p><button onClick={() => load(true)}>Tentar novamente</button></div>}
        <div className="characterList">{characters.map((character) => {
          const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId);
          return <article className={`characterCard ${selectedId === character.id && view === 'sheet' ? 'active' : ''}`} key={character.id}>
            <button className="characterMain" onClick={() => { setSelectedId(character.id); setView('sheet'); }}><RpgImage src={character.imageUrl} alt={character.name} className="sidebarAvatar" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'} · Nível {character.level}</small><i><b style={{ width: `${character.maxHp ? Math.min(100, character.currentHp / character.maxHp * 100) : 0}%` }} /></i></span></button>
            <div className="cardActions"><button title="Editar" onClick={() => { setSelectedId(character.id); setDraft(structuredClone(character)); setView('wizard'); }}><Pencil aria-hidden="true" />Editar</button><button title="Duplicar" onClick={() => duplicateCharacter(character)}><Copy aria-hidden="true" />Duplicar</button><button title="Excluir" onClick={() => removeCharacter(character)}><Trash2 aria-hidden="true" />Excluir</button></div>
          </article>;
        })}</div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><span className="eyebrow">GERENCIAMENTO RPG</span><h2>{view === 'catalog' ? 'Catálogo' : view === 'admin' ? 'Modo mestre' : draft?.name || selected?.name || 'Painel de fichas'}</h2>{characters.length > 0 && (view === 'sheet' || view === 'wizard') && <label className="mobileCharacterPicker"><span>Ficha ativa</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setDraft(null); setView('sheet'); }}><option value="">Selecionar personagem</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name || 'Sem nome'} · Nível {character.level}</option>)}</select></label>}</div><div className="topbarActions"><QuickDice requestRoll={requestRoll} /><button className="iconButton themeButton" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button></div></header>

        {(view === 'sheet' || view === 'wizard') && !selected && <button className="mobileCreateButton" aria-label="Criar personagem" title="Criar personagem" onClick={beginCreate} disabled={!catalog.entries.length}><Plus aria-hidden="true" /></button>}

        {saving && <div className="savingBar">Salvando ficha...</div>}
        {view === 'catalog' && <CatalogView catalog={catalog} />}
        {view === 'admin' && <AdminView catalog={catalog} characters={characters} onRefresh={() => load(true)} onSaveCatalogEntry={saveMasterEntry} onDeleteCatalogEntry={removeMasterEntry} />}
        {view === 'wizard' && draft && <CharacterWizard initial={draft} catalog={catalog} onSave={persistDraft} onCancel={() => { setDraft(null); setView('sheet'); }} requestRoll={requestRoll} />}
        {view === 'sheet' && selected && <CharacterSheet character={selected} catalog={catalog} onEdit={beginEdit} onUpdate={updateCharacter} requestRoll={requestRoll} />}
        {view === 'sheet' && !selected && !loading && <CharacterChooser characters={characters} catalog={catalog} onSelect={setSelectedId} onCreate={beginCreate} />}
      </section>
      <DiceModal request={diceRequest} onClose={closeRoll} />
    </main>
  );
}

function QuickDice({ requestRoll }) {
  const [sides, setSides] = useState(20);
  const [last, setLast] = useState(null);
  return <div className="quickDice"><select value={sides} onChange={(e) => setSides(Number(e.target.value))}>{[4, 6, 8, 10, 12, 20, 100].map((value) => <option key={value} value={value}>d{value}</option>)}</select><button className="dieButton" title={`Rolar d${sides}`} onClick={() => requestRoll({ characterId: '', type: 'general', name: `Rolagem d${sides}`, sides, modifiers: [], penalties: 0, origin: 'global' }, setLast)}>{last?.finalResult ?? sides}</button><span>{last ? `${last.die}: ${last.finalResult}` : 'Rolar'}</span></div>;
}

function CharacterChooser({ characters, catalog, onSelect, onCreate }) {
  return <section className="characterChooser"><div className="chooserHeader"><div><span className="eyebrow">INICIAR SESSÃO</span><h3>Escolha um personagem</h3><p>Abra uma ficha existente ou comece uma nova jornada.</p></div><button className="primaryButton" onClick={onCreate}><Plus aria-hidden="true" />Criar personagem</button></div>{characters.length ? <div className="chooserGrid">{characters.map((character) => { const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId); return <button key={character.id} className="chooserCharacter" onClick={() => onSelect(character.id)}><RpgImage src={character.imageUrl} alt={character.name} className="chooserPortrait" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'}</small><small>Nível {character.level} · Vida {character.currentHp}/{character.maxHp}</small></span></button>; })}</div> : <div className="emptyState"><div className="emptyIcon">d20</div><h3>Nenhum personagem criado</h3><p>Crie sua primeira ficha usando o catálogo oficial.</p></div>}</section>;
}
