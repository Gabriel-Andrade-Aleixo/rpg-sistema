import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Crown, Dices, LogOut, Moon, Pencil, Plus, Shield, Sun, Trash2, UserRound } from 'lucide-react';
import { clearSession, createCatalogItem, createCatalogSpell, deleteCatalogEntry, deleteCharacter, listCharacters, loadCatalog, loadStoredSession, login, logout, register, requestPasswordReset, resetPassword, saveCharacter, updateCatalogEntry } from '../lib/api';
import { emptyCharacter } from '../lib/rpgData';
import { findEntry, migrateCharacter } from '../lib/catalogEngine';
import { changedCharacterFields, compactCharacter } from '../lib/characterSync';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('dark');
  const [diceRequest, setDiceRequest] = useState(null);
  const savedCharacters = useRef(new Map());
  const pendingCharacters = useRef(new Map());
  const saveTimers = useRef(new Map());
  const saveChains = useRef(new Map());
  const selected = useMemo(() => characters.find((item) => item.id === selectedId) || null, [characters, selectedId]);

  async function load(refresh = false, preferredId = selectedId) {
    setLoading(true);
    setError('');
    try {
      const [characterPayload, nextCatalog] = await Promise.all([listCharacters(), loadCatalog(refresh)]);
      const migrated = characterPayload.characters.map((item) => migrateCharacter(item, nextCatalog));
      savedCharacters.current = new Map(migrated.map((item) => [item.id, structuredClone(item)]));
      setCatalog(nextCatalog);
      setCharacters(migrated);
      setPublicCharacters(characterPayload.publicCharacters || []);
      const nextId = preferredId && migrated.some((item) => item.id === preferredId) ? preferredId : '';
      setSelectedId(nextId);
    } catch (reason) {
      setError(reason.message);
      if (reason.status === 401) {
        clearSession();
        setSession(null);
        setCharacters([]);
        setPublicCharacters([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('rpg-theme');
    if (savedTheme) setTheme(savedTheme);
    const stored = loadStoredSession();
    setSession(stored);
    if (stored?.token) load();
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

  function requestRoll(request, callback) {
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
      const migrated = migrateCharacter(persisted, catalog);
      savedCharacters.current.set(persisted.id, structuredClone(migrated));
      setCharacters((current) => [...current.filter((item) => item.id !== persisted.id), migrated]);
      setSelectedId(persisted.id);
      setDraft(null);
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
      await load(true);
    } catch (reason) {
      setError(reason.message);
      throw reason;
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    setSession(null);
    setCharacters([]);
    setPublicCharacters([]);
    setSelectedId('');
    setView('sheet');
    setDraft(null);
  }

  function updateCharacter(character) {
    const compact = compactCharacter(character);
    setCharacters((current) => current.map((item) => item.id === compact.id ? character : item));
    pendingCharacters.current.set(compact.id, compact);
    scheduleCharacterSave(compact.id);
  }

  function scheduleCharacterSave(id, delay = 1200) {
    clearTimeout(saveTimers.current.get(id));
    saveTimers.current.set(id, setTimeout(() => flushCharacterSave(id), delay));
  }

  function flushCharacterSave(id) {
    clearTimeout(saveTimers.current.get(id));
    saveTimers.current.delete(id);
    const previousChain = saveChains.current.get(id) || Promise.resolve();
    const nextChain = previousChain.then(async () => {
      const pending = pendingCharacters.current.get(id);
      if (!pending) return;
      pendingCharacters.current.delete(id);
      const previous = savedCharacters.current.get(id);
      const changedFields = changedCharacterFields(previous, pending);
      if (!changedFields.length) return;
      try {
        const persisted = migrateCharacter(await saveCharacter(pending, {
          baseRevision: previous?.syncRevision || 0,
          changedFields,
        }), catalog);
        savedCharacters.current.set(id, structuredClone(persisted));
        setCharacters((current) => current.map((item) => item.id === id
          ? { ...item, syncRevision: persisted.syncRevision, updatedAt: persisted.updatedAt }
          : item));
        setError('');
      } catch (reason) {
        const retryable = !reason.status || reason.status === 429 || reason.status >= 500;
        if (retryable) {
          if (!pendingCharacters.current.has(id)) pendingCharacters.current.set(id, pending);
          setError(`A ficha ficou salva neste dispositivo e será sincronizada novamente. ${reason.message}`);
          scheduleCharacterSave(id, 4000);
        } else {
          setError(`A alteração continua nesta tela, mas não pôde ser sincronizada. ${reason.message}`);
        }
      }
      if (pendingCharacters.current.has(id)) scheduleCharacterSave(id);
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

  if (!session?.token) {
    return <AuthView loading={loading || saving} error={error} onAuth={handleAuth} />;
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <BrandMark />
        <button className="primaryButton createButton" onClick={beginCreate} disabled={!catalog.entries.length}><Plus aria-hidden="true" />Criar personagem</button>
        <nav className="mainNav">
          <button className={view === 'sheet' || view === 'wizard' ? 'active' : ''} onClick={() => { setView('sheet'); setDraft(null); }}><Shield aria-hidden="true" /><span>Fichas</span></button>
          <button className={view === 'dice' ? 'active' : ''} onClick={() => setView('dice')}><Dices aria-hidden="true" /><span>Dados</span></button>
          <button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><BookOpen aria-hidden="true" /><span>Catálogo</span></button>
          {session.user?.role === 'admin' && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}><Crown aria-hidden="true" /><span>Mestre</span></button>}
        </nav>
        <div className="statusRow"><span>{characters.length} minhas</span><span>{publicCharacters.length} públicas</span></div>
        <div className="userBox"><UserRound aria-hidden="true" /><span><strong>{session.user?.displayName || session.user?.email}</strong><small>{session.user?.role === 'admin' ? 'Mestre' : 'Jogador'}</small></span><button title="Sair" onClick={handleLogout}><LogOut aria-hidden="true" /></button></div>
        {loading && <p className="muted">Sincronizando...</p>}
        {error && <div className="sidebarError"><p>{error}</p><button onClick={() => load(true)}>Tentar novamente</button></div>}
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
        <header className="topbar"><div><span className="eyebrow">RUNALITH RPG</span><h2>{view === 'catalog' ? 'Catálogo' : view === 'admin' ? 'Modo mestre' : view === 'dice' ? 'Dice Roller' : draft?.name || selected?.name || 'Painel de fichas'}</h2>{characters.length > 0 && (view === 'sheet' || view === 'wizard') && <label className="mobileCharacterPicker"><span>Ficha ativa</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setDraft(null); setView('sheet'); }}><option value="">Selecionar personagem</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name || 'Sem nome'} · Nível {character.level}</option>)}</select></label>}</div><div className="topbarActions"><button className="iconButton themeButton" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button></div></header>

        {(view === 'sheet' || view === 'wizard') && !selected && <button className="mobileCreateButton" aria-label="Criar personagem" title="Criar personagem" onClick={beginCreate} disabled={!catalog.entries.length}><Plus aria-hidden="true" /></button>}

        {loading && <LoadingOverlay label="Sincronizando fichas e catálogo..." />}
        {saving && <div className="savingBar">Salvando ficha...</div>}
        {view === 'catalog' && <CatalogView catalog={catalog} />}
        {view === 'admin' && session.user?.role === 'admin' && <AdminView catalog={catalog} characters={characters} onRefresh={() => load(true)} onSaveCatalogEntry={saveMasterEntry} onDeleteCatalogEntry={removeMasterEntry} />}
        {view === 'dice' && <DiceRollerView queuedRoll={diceRequest} onComplete={completeQueuedRoll} />}
        {view === 'wizard' && draft && <CharacterWizard initial={draft} catalog={catalog} onSave={persistDraft} onCancel={() => { setDraft(null); setView('sheet'); }} requestRoll={requestRoll} />}
        {view === 'sheet' && selected && <CharacterSheet character={selected} catalog={catalog} onEdit={beginEdit} onUpdate={updateCharacter} requestRoll={requestRoll} />}
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
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(email);
        setMessage(result.resetToken ? `Token de recuperação: ${result.resetToken}` : 'Se o email existir, enviaremos as instruções de recuperação.');
        return;
      }
      if (mode === 'reset') {
        await resetPassword({ token, password });
        setMessage('Senha atualizada. Entre com a nova senha.');
        setMode('login');
        setPassword('');
        setToken('');
        return;
      }
      await onAuth(mode, { email, password, displayName });
    } catch (reason) {
      setMessage(reason.message || 'Não foi possível concluir a ação.');
    }
  }

  return <main className="authShell"><section className="authPanel"><BrandMark compact /><div><span className="eyebrow">Acesso</span><h2>{mode === 'register' ? 'Criar conta' : mode === 'forgot' ? 'Recuperar senha' : mode === 'reset' ? 'Nova senha' : 'Entrar'}</h2><p>Entre para gerenciar suas fichas. Outros jogadores verão somente o resumo público das fichas não privadas.</p></div><form className="authForm" onSubmit={submit}>{mode !== 'reset' && <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}{mode === 'register' && <label>Nome de exibição<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}{mode === 'reset' && <label>Token de recuperação<input value={token} onChange={(event) => setToken(event.target.value)} required /></label>}{mode !== 'forgot' && <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>}<button className="primaryButton" disabled={loading} type="submit">{loading ? 'Aguarde...' : mode === 'register' ? 'Cadastrar' : mode === 'forgot' ? 'Solicitar recuperação' : mode === 'reset' ? 'Trocar senha' : 'Entrar'}</button></form>{error && <p className="validationError">{error}</p>}{message && <p className="noticeText">{message}</p>}<div className="authSwitch"><button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}</button><button onClick={() => setMode('forgot')}>Esqueci a senha</button><button onClick={() => setMode('reset')}>Tenho token</button></div></section></main>;
}

function CharacterChooser({ characters, publicCharacters = [], catalog, onSelect, onCreate }) {
  return <section className="characterChooser"><div className="chooserHeader"><div><span className="eyebrow">INICIAR SESSÃO</span><h3>Escolha um personagem</h3><p>Abra uma ficha sua ou veja o resumo público de outros jogadores.</p></div><button className="primaryButton" onClick={onCreate}><Plus aria-hidden="true" />Criar personagem</button></div>{characters.length ? <div className="chooserGrid">{characters.map((character) => { const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId); return <button key={character.id} className="chooserCharacter" onClick={() => onSelect(character.id)}><RpgImage src={character.imageUrl} alt={character.name} className="chooserPortrait" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'}</small><small>Nível {character.level} · Vida {character.currentHp}/{character.maxHp}</small></span></button>; })}</div> : <div className="emptyState"><img className="emptyIconImage" src="/brand/runalith-icon-192.png" alt="" aria-hidden="true" /><h3>Nenhum personagem criado</h3><p>Crie sua primeira ficha usando o catálogo oficial.</p></div>}{!!publicCharacters.length && <section className="publicChooser"><h3>Fichas públicas</h3><div className="chooserGrid">{publicCharacters.map((character) => { const race = findEntry(catalog, character.raceId), characterClass = findEntry(catalog, character.classId); return <article key={character.id} className="chooserCharacter summaryOnly"><RpgImage src={character.imageUrl} alt={character.name} className="chooserPortrait" fallback="◇" /><span><strong>{character.name || 'Sem nome'}</strong><small>{race?.name || 'Raça indisponível'} · {characterClass?.name || 'Classe indisponível'}</small><small>Nível {character.level}{character.ownerName ? ` · ${character.ownerName}` : ''}</small></span></article>; })}</div></section>}</section>;
}
