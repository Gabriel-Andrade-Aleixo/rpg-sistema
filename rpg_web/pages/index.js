import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Crown, Dices, LogOut, MoreHorizontal, Moon, Pencil, Plus, Shield, Sun, Trash2, UserRound } from 'lucide-react';
import { clearSession, createCatalogItem, createCatalogSpell, createGenericCatalogEntry, deleteCatalogEntry, deleteCharacter, deleteGenericCatalogEntry, listAdminCharacters, listAdminUsers, listCharacters, loadCatalog, loadStoredSession, login, logout, register, resetAdminUserPassword, saveCharacter, transferCharacterOwner, updateCatalogEntry, updateGenericCatalogEntry, uploadMedia } from '../lib/api';
import { emptyCharacter } from '../lib/rpgData';
import { findEntry, migrateCharacter } from '../lib/catalogEngine';
import { changedCharacterFields, compactCharacter } from '../lib/characterSync';
import { applyPendingEntry, pendingEntry, pendingEntryIsApplied, readPendingQueue, rebasePendingEntry, writePendingQueue } from '../lib/pendingCharacterQueue';
import AdminView from '../components/AdminView';
import CatalogView from '../components/CatalogView';
import CharacterSheet from '../components/CharacterSheet';
import CharacterWizard from '../components/CharacterWizard';
import BrandMark from '../components/BrandMark';
import DiceRollerView from '../components/DiceRollerView';
import RpgImage from '../components/RpgImage';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [publicCharacters, setPublicCharacters] = useState([]);
  const [catalog, setCatalog] = useState({ entries: [], categories: [] });
  const [session, setSession] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState('sheet');
  const [draft, setDraft] = useState(null);
  const [wizardDirty, setWizardDirty] = useState(false);
  const [sheetTabs, setSheetTabs] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('dark');
  const [diceRequest, setDiceRequest] = useState(null);
  const [diceFromSheet, setDiceFromSheet] = useState(false);
  const savedCharacters = useRef(new Map());
  const pendingCharacters = useRef(new Map());
  const saveTimers = useRef(new Map());
  const saveChains = useRef(new Map());
  const catalogRef = useRef(catalog);
  const queueOwnerRef = useRef('');
  const loadGeneration = useRef(0);
  const selected = useMemo(() => characters.find((item) => item.id === selectedId) || null, [characters, selectedId]);

  async function load(refresh = false, preferredId = selectedId, userId = session?.user?.id) {
    const generation = ++loadGeneration.current;
    if (queueOwnerRef.current && queueOwnerRef.current !== userId) {
      for (const timer of saveTimers.current.values()) clearTimeout(timer);
      saveTimers.current.clear();
      pendingCharacters.current.clear();
    }
    setLoading(true);
    setError('');
    setSyncStatus('idle');
    queueOwnerRef.current = userId || '';
    try {
      const [characterPayload, nextCatalog] = await Promise.all([listCharacters(), loadCatalog(refresh)]);
      if (generation !== loadGeneration.current) return;
      const migrated = characterPayload.characters.map((item) => migrateCharacter(item, nextCatalog));
      savedCharacters.current = new Map(migrated.map((item) => [item.id, structuredClone(item)]));
      catalogRef.current = nextCatalog;
      const stored = readPendingQueue(window.localStorage, userId);
      const queued = new Map([...stored, ...pendingCharacters.current]);
      for (const character of migrated) {
        const entry = queued.get(character.id);
        if (entry && pendingEntryIsApplied(character, entry)) queued.delete(character.id);
      }
      pendingCharacters.current = queued;
      writePendingQueue(window.localStorage, userId, queued);
      setCatalog(nextCatalog);
      setCharacters(migrated.map((item) => migrateCharacter(applyPendingEntry(item, queued.get(item.id)), nextCatalog)));
      setPublicCharacters(characterPayload.publicCharacters || []);
      const nextId = preferredId && migrated.some((item) => item.id === preferredId) ? preferredId : '';
      setSelectedId(nextId);
      if (queued.size) {
        setSyncStatus('pending');
        for (const id of queued.keys()) if (savedCharacters.current.has(id)) scheduleCharacterSave(id, 500);
      }
    } catch (reason) {
      if (generation !== loadGeneration.current) return;
      setError(reason.message);
      if (reason.status === 401) {
        clearSession();
        for (const timer of saveTimers.current.values()) clearTimeout(timer);
        saveTimers.current.clear();
        pendingCharacters.current.clear();
        queueOwnerRef.current = '';
        setSession(null);
        setCharacters([]);
        setPublicCharacters([]);
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('rpg-theme');
    if (savedTheme) setTheme(savedTheme);
    const stored = loadStoredSession();
    setSession(stored);
    if (stored?.token) load(false, '', stored.user?.id);
    else {
      loadCatalog().then(setCatalog).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('rpg-theme', theme);
  }, [theme]);

  useEffect(() => () => {
    for (const timer of saveTimers.current.values()) clearTimeout(timer);
  }, []);

  useEffect(() => {
    const retry = () => {
      for (const id of pendingCharacters.current.keys()) scheduleCharacterSave(id, 100);
    };
    const warn = (event) => {
      if (!pendingCharacters.current.size && !wizardDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('online', retry);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('beforeunload', warn);
    };
  }, [wizardDirty]);

  function navigateTo(next) {
    if (view === 'wizard' && wizardDirty && !window.confirm('Descartar as alterações não salvas deste personagem?')) return;
    if (view === 'wizard') {
      setDraft(null);
      setWizardDirty(false);
    }
    setMobileMenuOpen(false);
    setView(next);
  }

  function requestRoll(request, callback) {
    setDiceFromSheet(view === 'sheet');
    setDiceRequest({ id: `queued_roll_${Date.now()}_${Math.random().toString(16).slice(2)}`, request, callback });
    setView('dice');
  }

  function completeQueuedRoll(record, queueId) {
    if (!diceRequest || diceRequest.id !== queueId) return;
    const callback = diceRequest.callback;
    setDiceRequest(null);
    if (record && callback) callback(record);
  }

  function beginCreate() {
    if (!session?.token) { setError('Faça login para criar uma ficha.'); return; }
    if (!catalog.entries.length) { setError('O catálogo oficial está indisponível. Sincronize o Supabase antes de criar uma ficha.'); return; }
    if (view === 'wizard' && wizardDirty && !window.confirm('Descartar o rascunho atual e criar outro personagem?')) return;
    setDraft(emptyCharacter());
    setWizardDirty(false);
    setView('wizard');
  }

  function beginEdit() {
    if (!selected) return;
    setDraft(structuredClone(selected));
    setWizardDirty(false);
    setView('wizard');
  }

  async function persistDraft(character) {
    setSaving(true);
    setError('');
    try {
      const persisted = await saveCharacter(character);
      const migrated = migrateCharacter(persisted, catalog);
      savedCharacters.current.set(persisted.id, structuredClone(migrated));
      setCharacters((current) => [...current.filter((item) => item.id !== persisted.id), migrated]);
      setSelectedId(persisted.id);
      setDraft(null);
      setWizardDirty(false);
      setView('sheet');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAuth(action, payload) {
    setSaving(true);
    setError('');
    try {
      const nextSession = action === 'register' ? await register(payload) : await login(payload);
      setSession(nextSession);
      await load(true, '', nextSession.user?.id);
    } catch (reason) {
      setError(reason.message);
      throw reason;
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (view === 'wizard' && wizardDirty && !window.confirm('Descartar as alterações não salvas deste personagem e sair?')) return;
    if (pendingCharacters.current.size && !window.confirm('Há alterações ainda não sincronizadas. Elas continuarão neste navegador para esta conta. Sair mesmo assim?')) return;
    loadGeneration.current += 1;
    try {
      await logout();
    } catch (reason) {
      setError(reason.message);
    } finally {
      for (const timer of saveTimers.current.values()) clearTimeout(timer);
      saveTimers.current.clear();
      pendingCharacters.current.clear();
      savedCharacters.current.clear();
      queueOwnerRef.current = '';
      setSession(null);
      setCharacters([]);
      setPublicCharacters([]);
      setSelectedId('');
      setView('sheet');
      setDraft(null);
      setMobileMenuOpen(false);
    }
  }

  function updateCharacter(character) {
    const compact = compactCharacter(character);
    setCharacters((current) => current.map((item) => item.id === compact.id ? character : item));
    pendingCharacters.current.set(compact.id, pendingEntry(compact, savedCharacters.current.get(compact.id), pendingCharacters.current.get(compact.id)));
    const stored = writePendingQueue(window.localStorage, queueOwnerRef.current, pendingCharacters.current);
    setSyncStatus(stored ? 'pending' : 'error');
    if (!stored) setError('Não foi possível guardar uma cópia local. Mantenha esta aba aberta até a sincronização.');
    scheduleCharacterSave(compact.id);
  }

  function scheduleCharacterSave(id, delay = 1200) {
    clearTimeout(saveTimers.current.get(id));
    saveTimers.current.set(id, setTimeout(() => flushCharacterSave(id), delay));
  }

  function retryPendingSave() {
    setError('');
    setSyncStatus('pending');
    for (const id of pendingCharacters.current.keys()) if (savedCharacters.current.has(id)) scheduleCharacterSave(id, 0);
  }

  function discardPendingSave(id) {
    if (saveChains.current.has(id)) { setError('Aguarde o salvamento em andamento antes de descartar a cópia local.'); return; }
    if (!window.confirm('Descartar as alterações locais desta ficha e voltar à última versão salva no servidor?')) return;
    pendingCharacters.current.delete(id);
    clearTimeout(saveTimers.current.get(id));
    saveTimers.current.delete(id);
    writePendingQueue(window.localStorage, queueOwnerRef.current, pendingCharacters.current);
    const saved = savedCharacters.current.get(id);
    if (saved) setCharacters((current) => current.map((item) => item.id === id ? structuredClone(saved) : item));
    setError('');
    setSyncStatus(pendingCharacters.current.size ? 'pending' : 'saved');
  }

  function flushCharacterSave(id) {
    clearTimeout(saveTimers.current.get(id));
    saveTimers.current.delete(id);
    const previousChain = saveChains.current.get(id) || Promise.resolve();
    const nextChain = previousChain.then(async () => {
      const ownerId = queueOwnerRef.current;
      const entry = pendingCharacters.current.get(id);
      if (!entry) return;
      const changedFields = changedCharacterFields(entry.base, entry.character);
      if (!changedFields.length) {
        pendingCharacters.current.delete(id);
        writePendingQueue(window.localStorage, queueOwnerRef.current, pendingCharacters.current);
        setSyncStatus(pendingCharacters.current.size ? 'pending' : 'saved');
        return;
      }
      try {
        setSyncStatus('saving');
        const persisted = migrateCharacter(await saveCharacter(entry.character, {
          baseRevision: entry.base?.syncRevision || 0,
          changedFields,
        }), catalogRef.current);
        if (queueOwnerRef.current !== ownerId) return;
        savedCharacters.current.set(id, structuredClone(persisted));
        const latest = pendingCharacters.current.get(id);
        if (latest === entry) pendingCharacters.current.delete(id);
        else if (latest) pendingCharacters.current.set(id, rebasePendingEntry(latest, entry, persisted));
        writePendingQueue(window.localStorage, queueOwnerRef.current, pendingCharacters.current);
        setCharacters((current) => current.map((item) => item.id === id
          ? migrateCharacter(applyPendingEntry(persisted, pendingCharacters.current.get(id)), catalogRef.current)
          : item));
        setError('');
        setSyncStatus(pendingCharacters.current.size ? 'pending' : 'saved');
        if (pendingCharacters.current.has(id) && !saveTimers.current.has(id)) scheduleCharacterSave(id);
      } catch (reason) {
        if (queueOwnerRef.current !== ownerId) return;
        setSyncStatus('error');
        const stored = writePendingQueue(window.localStorage, ownerId, pendingCharacters.current);
        const retryable = !reason.status || reason.status === 429 || reason.status >= 500;
        if (retryable) {
          setError(`${stored ? 'A cópia local está preservada neste navegador.' : 'A alteração está apenas nesta aba; não feche a página.'} Tentaremos sincronizar novamente. ${reason.message}`);
          scheduleCharacterSave(id, 4000);
        } else {
          setError(`${stored ? 'A cópia local não foi sincronizada.' : 'A alteração está apenas nesta aba; não feche a página.'} ${reason.message}`);
        }
      }
    });
    const trackedChain = nextChain.finally(() => {
      if (saveChains.current.get(id) === trackedChain) saveChains.current.delete(id);
    });
    saveChains.current.set(id, trackedChain);
  }

  async function removeCharacter(character) {
    if (!window.confirm(`Excluir ${character.name || 'personagem'}?`)) return;
    try {
      await deleteCharacter(character.id);
      clearTimeout(saveTimers.current.get(character.id));
      pendingCharacters.current.delete(character.id);
      writePendingQueue(window.localStorage, queueOwnerRef.current, pendingCharacters.current);
      savedCharacters.current.delete(character.id);
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
      if (kind === 'generic' && id) await updateGenericCatalogEntry(id, entry);
      else if (kind === 'generic') await createGenericCatalogEntry(entry);
      else if (id) await updateCatalogEntry(kind, id, entry);
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
      if (kind === 'generic') await deleteGenericCatalogEntry(id);
      else await deleteCatalogEntry(kind, id);
      await load(true, selectedId);
    } catch (reason) {
      setError(reason.message);
      throw reason;
    } finally {
      setSaving(false);
    }
  }

  async function loadAdminDirectory() {
    const [users, adminCharacters] = await Promise.all([listAdminUsers(), listAdminCharacters()]);
    return { users, characters: adminCharacters };
  }

  async function transferMasterCharacter(characterId, ownerUserId) {
    await transferCharacterOwner(characterId, ownerUserId);
    await load(true, selectedId);
  }

  async function resetMasterUserPassword(userId, password) {
    await resetAdminUserPassword(userId, password);
  }

  if (!session?.token) {
    return <AuthView loading={loading || saving} error={error} onAuth={handleAuth} />;
  }

  const pageTitle = view === 'catalog' ? 'Catálogo'
    : view === 'admin' ? 'Modo mestre'
      : view === 'dice' ? 'Dice Roller'
        : view === 'wizard' ? (characters.some((item) => item.id === draft?.id) ? 'Editar personagem' : 'Criar personagem')
          : selected?.name || 'Painel de fichas';

  return (
    <main className="appShell">
      <aside className="sidebar">
        <BrandMark />
        <button className="primaryButton createButton" onClick={beginCreate} disabled={!catalog.entries.length}><Plus aria-hidden="true" />Criar personagem</button>
        <nav className="mainNav">
          <button className={view === 'sheet' || view === 'wizard' ? 'active' : ''} onClick={() => navigateTo('sheet')}><Shield aria-hidden="true" /><span>Fichas</span></button>
          <button className={view === 'dice' ? 'active' : ''} onClick={() => { setDiceFromSheet(false); navigateTo('dice'); }}><Dices aria-hidden="true" /><span>Dados</span></button>
          <button className={view === 'catalog' ? 'active' : ''} onClick={() => navigateTo('catalog')}><BookOpen aria-hidden="true" /><span>Catálogo</span></button>
          {session.user?.role === 'admin' && <button className={view === 'admin' ? 'active' : ''} onClick={() => navigateTo('admin')}><Crown aria-hidden="true" /><span>Mestre</span></button>}
        </nav>
        <div className="statusRow"><span>{characters.length} minhas</span><span>{publicCharacters.length} públicas</span></div>
        <div className="userBox"><UserRound aria-hidden="true" /><span><strong>{session.user?.displayName || session.user?.email}</strong><small>{session.user?.role === 'admin' ? 'Mestre' : 'Jogador'}</small></span><button title="Sair" onClick={handleLogout}><LogOut aria-hidden="true" /></button></div>
        {loading && <p className="muted">Sincronizando...</p>}
        {error && <div className="sidebarError"><p>{error}</p><button onClick={pendingCharacters.current.size ? retryPendingSave : () => load(true)}>Tentar novamente</button>{selected && pendingCharacters.current.has(selected.id) && <button onClick={() => discardPendingSave(selected.id)}>Descartar cópia local</button>}</div>}
        <div className="characterList">{characters.map((character) => {
          const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId);
          return <article className={`characterCard ${selectedId === character.id && view === 'sheet' ? 'active' : ''}`} key={character.id}>
            <button className="characterMain" onClick={() => { setSelectedId(character.id); setView('sheet'); }}><RpgImage src={character.imageUrl} alt={character.name} className="sidebarAvatar" fallback="◇" /><span><strong>{character.name || 'Sem nome'}{(character.visibility || 'public') === 'private' ? ' · privada' : ''}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'} · Nível {character.level}</small><i><b style={{ width: `${character.maxHp ? Math.min(100, character.currentHp / character.maxHp * 100) : 0}%` }} /></i></span></button>
            <div className="cardActions"><button title="Editar" onClick={() => { setSelectedId(character.id); setDraft(structuredClone(character)); setView('wizard'); }}><Pencil aria-hidden="true" />Editar</button><button title="Duplicar" onClick={() => duplicateCharacter(character)}><Copy aria-hidden="true" />Duplicar</button><button title="Excluir" onClick={() => removeCharacter(character)}><Trash2 aria-hidden="true" />Excluir</button></div>
          </article>;
        })}</div>
        {!!publicCharacters.length && <div className="publicList"><span className="eyebrow">Outros jogadores</span>{publicCharacters.slice(0, 12).map((character) => {
          const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId);
          return <article className="publicCharacterCard" key={character.id}><RpgImage src={character.imageUrl} alt={character.name} className="sidebarAvatar" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça'} · {characterClass?.name || 'Classe'} · Nível {character.level}</small></span></article>;
        })}</div>}
      </aside>

      <section className="workspace">
        <header className={`topbar ${view === 'sheet' && selected ? 'sheetTopbar' : ''}`}><div><span className="eyebrow">RUNALITH RPG</span><h2>{pageTitle}</h2>{characters.length > 0 && view === 'sheet' && <label className="mobileCharacterPicker"><span>Ficha ativa</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setDraft(null); setView('sheet'); }}><option value="">Selecionar personagem</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name || 'Sem nome'} · Nível {character.level}</option>)}</select></label>}</div><div className="topbarActions">{view === 'sheet' && selected && <button className="iconButton mobileNewCharacterButton" aria-label="Criar personagem" title="Criar personagem" onClick={beginCreate}><Plus aria-hidden="true" /></button>}<button className="iconButton themeButton" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button><button className="iconButton mobileMenuButton" aria-label="Conta e ações" aria-expanded={mobileMenuOpen} title="Conta e ações" onClick={() => setMobileMenuOpen((open) => !open)}><MoreHorizontal aria-hidden="true" /></button></div></header>
        {mobileMenuOpen && <section className="mobileAccountMenu" aria-label="Conta e ações"><div><strong>{session.user?.displayName || session.user?.email}</strong><span>{session.user?.role === 'admin' ? 'Mestre' : 'Jogador'}</span></div>{view === 'sheet' && selected && <><button onClick={() => { setMobileMenuOpen(false); duplicateCharacter(selected); }}><Copy aria-hidden="true" />Duplicar ficha</button><button className="dangerButton" onClick={() => { setMobileMenuOpen(false); removeCharacter(selected); }}><Trash2 aria-hidden="true" />Excluir ficha</button></>}<button onClick={handleLogout}><LogOut aria-hidden="true" />Sair da conta</button></section>}

        {view === 'sheet' && !selected && <button className="mobileCreateButton" aria-label="Criar personagem" title="Criar personagem" onClick={beginCreate} disabled={!catalog.entries.length}><Plus aria-hidden="true" /></button>}

        {loading && <LoadingOverlay label="Sincronizando fichas e catálogo..." />}
        {saving && <div className="savingBar">Salvando ficha...</div>}
        {view === 'sheet' && selected && !error && syncStatus !== 'idle' && <div className="mobileSyncStatus" role="status">{syncStatus === 'pending' ? 'Alterações pendentes de sincronização' : syncStatus === 'saving' ? 'Salvando alterações...' : syncStatus === 'saved' ? 'Ficha sincronizada' : 'Falha na sincronização'}</div>}
        {error && <div className="mobileSyncError" role="alert"><span>{error}</span><div><button onClick={pendingCharacters.current.size ? retryPendingSave : () => load(true)}>Tentar novamente</button>{selected && pendingCharacters.current.has(selected.id) && <button onClick={() => discardPendingSave(selected.id)}>Descartar cópia local</button>}</div></div>}
        {view === 'catalog' && <CatalogView catalog={catalog} />}
        {view === 'admin' && session.user?.role === 'admin' && <AdminView catalog={catalog} characters={characters} onRefresh={() => load(true)} onSaveCatalogEntry={saveMasterEntry} onDeleteCatalogEntry={removeMasterEntry} onUploadMedia={uploadMedia} onLoadAdminDirectory={loadAdminDirectory} onTransferCharacterOwner={transferMasterCharacter} onResetUserPassword={resetMasterUserPassword} />}
        {view === 'dice' && <DiceRollerView queuedRoll={diceRequest} onComplete={completeQueuedRoll} onBack={diceFromSheet && selected ? () => setView('sheet') : null} />}
        {view === 'wizard' && draft && <CharacterWizard initial={draft} catalog={catalog} onSave={persistDraft} onCancel={() => navigateTo('sheet')} onDirtyChange={setWizardDirty} />}
        {view === 'sheet' && selected && <CharacterSheet character={selected} catalog={catalog} onEdit={beginEdit} onUpdate={updateCharacter} requestRoll={requestRoll} activeTab={sheetTabs[selected.id] || 'summary'} onTabChange={(next) => setSheetTabs((current) => ({ ...current, [selected.id]: next }))} />}
        {view === 'sheet' && !selected && !loading && <CharacterChooser characters={characters} publicCharacters={publicCharacters} catalog={catalog} onSelect={setSelectedId} onCreate={beginCreate} />}
      </section>
    </main>
  );
}

function LoadingOverlay({ label }) {
  return <div className="loadingOverlay" role="status" aria-live="polite"><span /><strong>{label}</strong></div>;
}

function AuthView({ loading, error, onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    try {
      await onAuth(mode, { email, password, displayName });
    } catch (reason) {
      setMessage(reason.message || 'Não foi possível concluir a ação.');
    }
  }

  return <main className="authShell"><section className="authPanel"><BrandMark compact /><div><span className="eyebrow">Acesso</span><h2>{mode === 'register' ? 'Criar conta' : 'Entrar'}</h2><p>Entre para gerenciar suas fichas. Outros jogadores verão somente o resumo público das fichas não privadas.</p></div><form className="authForm" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{mode === 'register' && <label>Nome de exibição<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}<label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button className="primaryButton" disabled={loading} type="submit">{loading ? 'Aguarde...' : mode === 'register' ? 'Cadastrar' : 'Entrar'}</button></form>{error && <p className="validationError">{error}</p>}{message && <p className="noticeText">{message}</p>}<div className="authSwitch"><button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}</button></div><p className="authHelp">Para redefinir sua senha, solicite ao mestre da campanha.</p></section></main>;
}

function CharacterChooser({ characters, publicCharacters = [], catalog, onSelect, onCreate }) {
  return <section className="characterChooser"><div className="chooserHeader"><div><span className="eyebrow">INICIAR SESSÃO</span><h3>Escolha um personagem</h3><p>Abra uma ficha sua ou veja o resumo público de outros jogadores.</p></div><button className="primaryButton" onClick={onCreate}><Plus aria-hidden="true" />Criar personagem</button></div>{characters.length ? <div className="chooserGrid">{characters.map((character) => { const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId); return <button key={character.id} className="chooserCharacter" onClick={() => onSelect(character.id)}><RpgImage src={character.imageUrl} alt={character.name} className="chooserPortrait" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'}</small><small>Nível {character.level} · Vida {character.currentHp}/{character.maxHp}</small></span></button>; })}</div> : <div className="emptyState"><img className="emptyIconImage" src="/brand/runalith-icon-192.png" alt="" aria-hidden="true" /><h3>Nenhum personagem criado</h3><p>Crie sua primeira ficha usando o catálogo oficial.</p></div>}{!!publicCharacters.length && <section className="publicChooser"><h3>Fichas públicas</h3><div className="chooserGrid">{publicCharacters.map((character) => { const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId); return <article key={character.id} className="chooserCharacter summaryOnly"><RpgImage src={character.imageUrl} alt={character.name} className="chooserPortrait" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'}</small><small>Nível {character.level}{character.ownerName ? ` · ${character.ownerName}` : ''}</small></span></article>; })}</div></section>}</section>;
}
