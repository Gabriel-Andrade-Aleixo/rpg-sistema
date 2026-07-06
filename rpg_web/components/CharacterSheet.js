import { useMemo, useState } from 'react';
import { Backpack, BookOpen, Dices, Download, LayoutDashboard, Plus, Sparkles, Swords, TrendingUp, X } from 'lucide-react';
import RpgImage from './RpgImage';
import StatBreakdown from './StatBreakdown';
import { attributes, currencyLabel, unique } from '../lib/rpgData';
import {
  attributeBreakdown,
  allowedCombatXpTargets,
  armorClassValue,
  catalogGroups,
  classXpRequired,
  defenseValue,
  displayDescription,
  attributeLabel,
  evaluateRuleFormula,
  findEntry,
  formulaRollModifiers,
  normalize,
  parseClass,
  parseCatalogSpell,
  parseSkill,
  recalculateCharacter,
  rollFormula,
  skillValue,
} from '../lib/catalogEngine';
import {
  changeHumanity,
  divineAccuracyBonus,
  divinityValue,
  hasFaithDamageBonus,
  humanityResistanceBonus,
  humanityStatus,
  humanityValue,
} from '../lib/humanity';
import { calculateClassSessionXp, classXpCriteria } from '../lib/experience';
import { changeHitPoints, recordDeathSave, resetDeathSaves } from '../lib/deathSaves';
import { infusionDamage, infusionManaCost, spectralInfusions, spectralSpellPresets, useInfusion, useMagicArrow, useSpell } from '../lib/classActions';

export default function CharacterSheet({ character, catalog, onEdit, onUpdate, requestRoll }) {
  const [levelUp, setLevelUp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [proficiencyFilter, setProficiencyFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('summary');
  const race = findEntry(catalog, character.raceId);
  const classEntry = findEntry(catalog, character.classId);
  const parsedClass = classEntry ? parseClass(classEntry) : null;

  function persist(changes) {
    onUpdate(recalculateCharacter({ ...character, ...changes }, catalog));
  }

  function persistCharacter(next) {
    onUpdate(recalculateCharacter(next, catalog));
  }

  function rollAttribute(id, label) {
    const breakdown = attributeBreakdown(character, id);
    const rollBonuses = (character.modifiers || []).filter((item) => item.targetType === 'attributeRoll' && item.targetId === id);
    requestRoll({ characterId: character.id, type: 'attribute', name: label, sides: 20, modifiers: [{ id: `base_${id}`, sourceId: character.id, sourceName: `${label} base`, sourceType: 'character', targetType: 'roll', targetId: id, value: breakdown.base }, ...breakdown.modifiers, ...rollBonuses], penalties: 0, origin: 'character_sheet' }, recordRoll);
  }

  function simpleRoll(type, name, sides = 20) {
    requestRoll({ characterId: character.id, type, name, sides, modifiers: [], penalties: 0, origin: 'character_sheet' }, recordRoll);
  }

  function recordRoll(record) {
    persist({ rollHistory: [record, ...(character.rollHistory || [])].slice(0, 20) });
  }

  function moveItem(item, target) {
    const source = target === 'equipment' ? 'inventory' : 'equipment';
    persist({
      [source]: (character[source] || []).filter((current) => current.id !== item.id),
      [target]: [...(character[target] || []).filter((current) => current.id !== item.id), item],
    });
  }

  function changeQuantity(item, delta) {
    persist({ inventory: character.inventory.map((current) => current.id === item.id ? { ...current, quantity: Math.max(1, Number(current.quantity || 1) + delta) } : current) });
  }

  function addCatalogItem(entry) {
    const existing = (character.inventory || []).find((item) => item.catalogId === entry.id);
    if (existing) {
      persist({ inventory: character.inventory.map((item) => item.id === existing.id ? { ...item, quantity: Number(item.quantity || 1) + 1 } : item) });
      return;
    }
    const item = { id: `item_${Date.now()}_${entry.id}`, catalogId: entry.id, name: entry.name, type: entry.category, quantity: 1, weight: 0, bonus: '', description: '', notes: '', imageUrl: entry.imageUrl || '', requirements: '' };
    persist({ inventory: [item, ...(character.inventory || [])] });
  }

  const proficiencyRows = useMemo(() => {
    const official = catalogGroups(catalog).skills;
    if (!official.length) return (character.proficiencies || []).map((name) => ({ id: name, name, proficient: true, source: 'Raça ou classe', category: inferProficiencyCategory(name) }));
    return official.map((entry) => {
      const target = normalize(entry.name);
      const sources = (character.proficiencies || []).filter((value) => normalize(value).includes(target));
      return { id: entry.id, name: entry.name, value: skillValue(character, parseSkill(entry)), proficient: sources.length > 0 || Number(character.skillBonuses?.[entry.id] || 0) > 0, source: sources.join(' · ') || (character.skillBonuses?.[entry.id] ? `Progressão permanente +${character.skillBonuses[entry.id]}` : 'Sem bônus permanente'), category: inferProficiencyCategory(`${entry.name} ${entry.description} ${(entry.labels || []).map((item) => item.name).join(' ')}`) };
    });
  }, [catalog, character.proficiencies]);
  const filteredProficiencies = useMemo(() => proficiencyRows.filter((item) => {
    if (proficiencyFilter === 'with') return item.proficient;
    if (proficiencyFilter === 'without') return !item.proficient;
    if (proficiencyFilter === 'all') return true;
    return item.category === proficiencyFilter;
  }), [proficiencyRows, proficiencyFilter]);

  return (
    <div className="sheetGrid">
      <section className="sheetHeader spanTwo">
        <RpgImage src={character.imageUrl} alt={character.name} className="sheetPortrait" fallback="◇" />
        <div><span className="eyebrow">Ficha ativa</span><h2>{character.name}</h2><p>{race?.name || 'Raça indisponível'} · {classEntry?.name || 'Classe indisponível'} · Nível {character.level}</p></div>
        <div className="headerActions"><button className="primaryButton" disabled={!parsedClass} onClick={() => setLevelUp(true)}>{character.level >= 10 ? 'Registrar XP / Excelência' : 'Subir de nível'}</button><button className="ghostButton" onClick={onEdit}>Editar</button><button className="iconButton" aria-label="Exportar ficha" title="Exportar ficha" onClick={() => setExporting(true)}><Download aria-hidden="true" /></button></div>
      </section>

      {activeTab === 'summary' && <>
      <Panel title="Vida e recursos" subtitle="Controles da sessão">
        <ResourceControl label="Vida" current={character.currentHp} max={character.maxHp} onChange={(currentHp) => persistCharacter(changeHitPoints(character, currentHp))} />
        <ResourceControl label="Mana" current={character.currentMana} max={character.maxMana} onChange={(currentMana) => persist({ currentMana })} />
        {character.currentHp === 0 && <DeathSaves character={character} onChange={persistCharacter} />}
      </Panel>

      <HumanityPanel character={character} classEntry={classEntry} onChange={persist} requestRoll={requestRoll} recordRoll={recordRoll} />

      <Panel title="Pontos" subtitle="Progressão da classe">
        <div className="metricGrid"><Metric label="Nível" value={character.level} /><Metric label="XP de classe" value={`${character.classXp || 0}/${classXpRequired(character.level)}`} /><Metric label="Habilidade" value={character.skillPoints || 0} /><Metric label="Classe" value={character.classPoints || 0} /></div>
      </Panel>
      <DefensePanel character={character} classEntry={classEntry} parsedClass={parsedClass} />
      </>}

      {activeTab === 'combat' && <>
      {Object.entries(character.resources || {}).some(([key]) => key.endsWith('Max')) && <Panel title="Recursos especiais" subtitle="Recursos da classe">
        <div className="resourceStack">{Object.entries(character.resources || {}).filter(([key]) => key.endsWith('Max')).map(([key, maximum]) => {
          const id = key.slice(0, -3), currentKey = `${id}Current`;
          return <ResourceControl key={id} label={id.charAt(0).toUpperCase() + id.slice(1)} current={character.resources[currentKey] || 0} max={maximum} onChange={(value) => persist({ resources: { ...character.resources, [currentKey]: value } })} />;
        })}</div>
      </Panel>}

      {normalize(classEntry?.name || '') === 'arqueiro espectral' && <ClassActionsPanel character={character} classEntry={classEntry} onChange={persistCharacter} />}

      <Panel title="Atributos" subtitle="Clique no dado para testar" wide>
        <div className="breakdownGrid">{attributes.map(([id, label]) => <StatBreakdown key={id} label={label} breakdown={attributeBreakdown(character, id)} onRoll={() => rollAttribute(id, label)} />)}</div>
      </Panel>

      <Panel title="Proficiências e perícias" subtitle="Origem oficial" wide>
        <div className="filterRow">{[['all', 'Todas'], ['with', 'Com proficiência'], ['without', 'Sem proficiência'], ['combat', 'Combate'], ['social', 'Social'], ['knowledge', 'Conhecimento'], ['physical', 'Física'], ['special', 'Especial']].map(([id, label]) => <button key={id} className={proficiencyFilter === id ? 'active' : ''} onClick={() => setProficiencyFilter(id)}>{label}</button>)}</div>
        {!filteredProficiencies.length ? <p className="muted">Nenhuma perícia oficial encontrada para este filtro.</p> : <div className="ruleList">{filteredProficiencies.map((item) => { const rollBonuses = (character.modifiers || []).filter((modifier) => modifier.targetType === 'skillRoll' && normalize(modifier.targetId) === normalize(item.name)); const proficiencyBonus = item.proficient ? item.value : 0; const total = item.value + proficiencyBonus + rollBonuses.reduce((sum, modifier) => sum + Number(modifier.value || 0), 0); return <div key={item.id}><span>{item.proficient ? '✓' : '○'}</span><p><b>{item.name} · rolagem +{total}</b><small>{item.source}{item.proficient ? ` · proficiência soma o valor bruto +${item.value}` : ''}{rollBonuses.length ? ` · bônus de rolagem +${rollBonuses.reduce((sum, modifier) => sum + Number(modifier.value || 0), 0)}` : ''}</small></p><button className="iconButton" aria-label={`Rolar ${item.name}`} title="Rolar teste" onClick={() => requestRoll({ characterId: character.id, type: 'skill', name: item.name, sides: 20, modifiers: [{ id: `skill_${item.id}`, sourceId: item.id, sourceName: item.name, sourceType: 'skill', targetType: 'roll', targetId: item.id, value: item.value }, ...(item.proficient ? [{ id: `proficiency_${item.id}`, sourceId: character.id, sourceName: 'Proficiência · valor bruto', sourceType: 'proficiency', targetType: 'roll', targetId: item.id, value: item.value }] : []), ...rollBonuses], penalties: 0, origin: 'character_sheet' }, recordRoll)}><Dices aria-hidden="true" /></button></div>; })}</div>}
      </Panel>

      <Panel title="Combate e rolagens" subtitle="Ações rápidas">
        <div className="combatActions"><button className="primaryButton" onClick={() => simpleRoll('attack', 'Ataque')}>Ataque</button><button onClick={() => simpleRoll('damage', 'Dano', 6)}>Dano</button><button onClick={() => simpleRoll('resistance', 'Resistência')}>Resistência</button><button onClick={() => simpleRoll('general', 'Teste geral')}>Teste geral</button></div>
      </Panel>
      <Panel title="Rolagens recentes" subtitle="Últimos 20 resultados" wide>
        <div className="panelTools"><button className="ghostButton compactButton" disabled={!character.rollHistory?.length} onClick={() => persist({ rollHistory: [] })}>Limpar histórico</button></div>
        <RollHistory values={character.rollHistory || []} />
      </Panel>
      </>}

      {activeTab === 'spells' && <SpellbookPanel character={character} catalog={catalog} classEntry={classEntry} onChange={persistCharacter} />}

      {activeTab === 'inventory' && <>
      <Panel title="Dinheiro" subtitle="50 cobre = 1 prata">
        <div className="coinControls">{[['gold', 'Ouro'], ['silver', 'Prata'], ['copper', 'Cobre']].map(([id, label]) => <label key={id}>{label}<input type="number" min="0" value={character.currency?.[id] || 0} onChange={(event) => persist({ currency: { ...character.currency, [id]: Math.max(0, Number(event.target.value) || 0) } })} /></label>)}</div><p className="coinTotal">{currencyLabel(character.currency)}</p>
      </Panel>

      <Panel title="Equipamentos" subtitle="Efeitos ativos" wide>
        <ItemList items={character.equipment || []} catalog={catalog} actionLabel="Desequipar" onAction={(item) => moveItem(item, 'inventory')} />
      </Panel>

      <Panel title="Inventário" subtitle="Itens oficiais" wide>
        <CatalogItemPicker catalog={catalog} onAdd={addCatalogItem} />
        <ItemList items={character.inventory || []} catalog={catalog} actionLabel="Equipar" onAction={(item) => moveItem(item, 'equipment')} onQuantity={changeQuantity} onRemove={(item) => persist({ inventory: character.inventory.filter((current) => current.id !== item.id) })} />
      </Panel>
      </>}

      {activeTab === 'progress' && <>
      <ExperiencePanel character={character} catalog={catalog} classEntry={classEntry} onChange={persist} />
      <Panel title="Habilidades" subtitle="Desbloqueadas pelo nível" wide>
        <RuleCards values={character.abilities} empty="Nenhuma habilidade identificada para este nível." onUse={(value) => simpleRoll('ability', value)} />
      </Panel>
      <Panel title="Histórico de evolução" subtitle="Registro permanente" wide>
        <LevelHistory values={character.levelHistory || []} />
      </Panel>
      </>}

      {activeTab === 'description' && <>
      <Panel title="Personagem" subtitle={character.background || 'Antecedente não informado'} wide><p className="preWrap">{character.lore || 'Sem história cadastrada.'}</p></Panel>
      <Panel title={race?.name || 'Raça'} subtitle="Descrição da raça" wide><p className="preWrap">{race ? displayDescription(race) || 'Sem descrição cadastrada.' : 'Raça indisponível no catálogo.'}</p></Panel>
      <Panel title={classEntry?.name || 'Classe'} subtitle="Descrição completa da classe" wide><p className="preWrap">{classEntry ? displayDescription(classEntry) || 'Sem descrição cadastrada.' : 'Classe indisponível no catálogo.'}</p></Panel>
      <Panel title="Anotações"><p className="preWrap">{character.notes?.join('\n') || 'Sem anotações.'}</p></Panel>
      </>}

      <nav className="sheetTabs spanTwo" aria-label="Seções da ficha">
        {[
          ['summary', 'Resumo', LayoutDashboard],
          ['combat', 'Combate', Swords],
          ['spells', 'Magias', Sparkles],
          ['progress', 'Evolução', TrendingUp],
          ['inventory', 'Itens', Backpack],
          ['description', 'História', BookOpen],
        ].map(([id, label, Icon]) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
      </nav>

      {levelUp && <LevelUpDialog character={character} catalog={catalog} parsedClass={parsedClass} onCancel={() => setLevelUp(false)} onConfirm={(next) => { setLevelUp(false); onUpdate(recalculateCharacter(next, catalog)); }} />}
      {exporting && <ExportDialog character={character} onClose={() => setExporting(false)} />}
    </div>
  );
}

function Panel({ title, subtitle, wide = false, children }) {
  return <section className={`panel ${wide ? 'spanTwo' : ''}`}><div className="panelHeader"><div><h3>{title}</h3>{subtitle && <span>{subtitle}</span>}</div></div>{children}</section>;
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function DefensePanel({ character, classEntry, parsedClass }) {
  const terms = parsedClass?.defenseFormula?.terms || [];
  const formula = terms.length
    ? `Defesa = floor(${terms.map((term) => `${attributeLabel(term.attribute)} × ${Math.round(Number(term.weight) * 100)}%`).join(' + ')})`
    : 'Defesa = floor(Destreza × 70% + Constituição × 30%)';
  const equipment = (character.modifiers || []).filter((item) => item.sourceType === 'equipment' && item.targetType === 'stat' && ['defense', 'armorClass'].includes(item.targetId));
  return <Panel title="Defesa e Classe de Armadura" subtitle="Valores atuais"><div className="metricGrid"><Metric label="Defesa" value={defenseValue(character, classEntry)} /><Metric label="CA" value={armorClassValue(character, classEntry)} /></div><p className="formulaText">{formula}<br />CA = 10 + Defesa + bônus direto de CA</p>{equipment.length > 0 && <div className="modifierSummary">{equipment.map((item) => <span key={item.id}>{item.sourceName}: +{item.value} {item.targetId === 'defense' ? 'Defesa' : 'CA'}</span>)}</div>}</Panel>;
}

function ResourceControl({ label, current, max, onChange, readOnly = false }) {
  const [amount, setAmount] = useState(1);
  const safeMax = Math.max(0, Number(max) || 0), safeCurrent = Math.min(Math.max(0, Number(current) || 0), safeMax), percent = safeMax ? safeCurrent / safeMax * 100 : 0;
  const delta = Math.max(1, Number(amount) || 1);
  return <div className="resourceControl"><div className="resourceHeader"><strong>{label}</strong><span>{safeCurrent}/{safeMax}</span></div><div className="resourceBar"><span style={{ width: `${percent}%` }} /></div>{!readOnly && <div className="resourceAdjust"><input aria-label={`Quantidade para ajustar ${label}`} type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /><button title={`Subtrair ${label}`} disabled={!safeCurrent} onClick={() => onChange(Math.max(0, safeCurrent - delta))}>−</button><button title={`Somar ${label}`} disabled={safeCurrent >= safeMax} onClick={() => onChange(Math.min(safeMax, safeCurrent + delta))}>+</button><button onClick={() => onChange(safeMax)}>Cheio</button></div>}</div>;
}

function DeathSaves({ character, onChange }) {
  const successes = Number(character.resources?.deathSuccesses || 0), failures = Number(character.resources?.deathFailures || 0), dead = Number(character.resources?.dead || 0) === 1;
  return <div className="deathSaves"><div><strong>Testes contra a morte</strong><span>{dead ? 'Personagem morto' : 'Vida zerada'}</span></div><div className="metricGrid"><Metric label="Acertos" value={`${successes}/3`} /><Metric label="Erros" value={`${failures}/3`} /></div><div className="quickActions"><button className="primaryButton" disabled={dead} onClick={() => onChange(recordDeathSave(character, true))}>Registrar acerto</button><button disabled={dead} onClick={() => onChange(recordDeathSave(character, false))}>Registrar erro</button><button onClick={() => onChange(resetDeathSaves(character))}>Zerar testes</button></div><p className="muted">Ao alcançar 3 acertos, o personagem retorna com 1 ponto de vida.</p></div>;
}

function ClassActionsPanel({ character, classEntry, onChange }) {
  const [error, setError] = useState('');
  const [arrowDamage, setArrowDamage] = useState(2);
  const [attacksThisTurn, setAttacksThisTurn] = useState(1);

  function applyInfusion(infusion) {
    const result = useInfusion(character, infusion, { baseDamage: arrowDamage, attacksThisTurn });
    setError(result.error);
    if (!result.error) onChange(result.character);
  }

  return <Panel title="Flecha Mágica" subtitle="Disparo 2d4 e infusões do Arqueiro Espectral" wide>
    {error && <p className="validationError">{error}</p>}
    <section className="classActionBlock"><h4>Flecha Mágica e infusões</h4><p className="muted">A Flecha Mágica causa 2d4 de dano. Informe o total obtido; a infusão escolhida aprimora o disparo e aplica Cadência, Mana e Foco.</p><div className="arrowInputs"><label>Resultado dos 2d4<input type="number" min="2" max="8" value={arrowDamage} onChange={(event) => setArrowDamage(event.target.value)} /></label><label>Ataques no turno<input type="number" min="1" value={attacksThisTurn} onChange={(event) => setAttacksThisTurn(event.target.value)} /></label></div><div className="infusionGrid">{spectralInfusions.map((infusion) => { const cadence = Number(character.resources?.cadenciaCurrent || 0); const mana = infusionManaCost(infusion, cadence, attacksThisTurn); const damage = infusionDamage(infusion, arrowDamage, cadence); return <article key={infusion.id}><div><strong>Infusão: {infusion.name}</strong><span>{mana} PM · {infusion.focusCost} Foco</span></div><p>{infusion.effect}</p><div className="arrowDamage"><span>Dano da Flecha Mágica</span><strong>{damage.hit}</strong>{infusion.id === 'spectral' && <><span>Dano no erro</span><strong>{damage.miss}</strong></>}</div><button className="primaryButton compactButton" onClick={() => applyInfusion(infusion)}>Aplicar infusão</button></article>; })}</div></section>
  </Panel>;
}

function SpellbookPanel({ character, catalog, classEntry, onChange }) {
  const emptyForm = { name: '', type: 'Comum', topic: 'Sem tópico', description: '', damage: '', range: '', manaCost: 0, focusCost: 0, humanityCost: 0 };
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [editingTopic, setEditingTopic] = useState('');
  const [topicDraft, setTopicDraft] = useState('');
  const [error, setError] = useState('');
  const [arrowDamage, setArrowDamage] = useState(2);
  const [attacksThisTurn, setAttacksThisTurn] = useState(1);
  const knownCatalogIds = new Set((character.spells || []).map((spell) => spell.catalogId).filter(Boolean));
  const knownActionIds = new Set((character.spells || []).map((spell) => spell.actionId).filter(Boolean));
  const available = catalogGroups(catalog).spells.filter((entry) => {
    const parsed = parseCatalogSpell(entry);
    const allowedClass = !parsed.className || normalize(parsed.className) === normalize(classEntry?.name || '');
    const newClassAction = !parsed.actionId || !knownActionIds.has(parsed.actionId);
    return allowedClass && newClassAction && !knownCatalogIds.has(entry.id) && normalize(`${entry.name} ${entry.description} ${(entry.labels || []).map((label) => label.name).join(' ')}`).includes(normalize(query));
  });
  const grouped = Object.entries((character.spells || []).reduce((result, spell) => {
    const topic = spell.topic?.trim() || 'Sem tópico';
    if (!result[topic]) result[topic] = [];
    result[topic].push(spell);
    return result;
  }, {})).sort(([left], [right]) => left.localeCompare(right, 'pt-BR', { numeric: true }));

  function addCatalogSpell(entry) {
    const parsed = parseCatalogSpell(entry);
    const spell = { ...parsed, id: `spell_${Date.now()}_${entry.id}`, successfulUses: 0, createdAt: new Date().toISOString() };
    onChange({ ...character, spells: [spell, ...(character.spells || [])] });
  }

  function addClassSpell(preset) {
    const spell = { ...preset, id: `spell_${Date.now()}_${preset.actionId}`, catalogId: '', imageUrl: '', successfulUses: 0, createdAt: new Date().toISOString() };
    onChange({ ...character, spells: [spell, ...(character.spells || [])] });
  }

  function addCustomSpell(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const spell = { ...form, id: `spell_${Date.now()}_${Math.random().toString(16).slice(2)}`, catalogId: '', name: form.name.trim(), topic: form.topic.trim() || 'Sem tópico', manaCost: Number(form.manaCost || 0), focusCost: Number(form.focusCost || 0), humanityCost: Number(form.humanityCost || 0), imageUrl: '', successfulUses: 0, createdAt: new Date().toISOString() };
    onChange({ ...character, spells: [spell, ...(character.spells || [])] });
    setForm(emptyForm);
    setShowCustom(false);
  }

  function cast(spell, successful) {
    if (spell.actionType === 'spectral_arrow') {
      const result = useMagicArrow(character, spell, { successful });
      setError(result.error);
      if (!result.error) onChange(result.character);
      return;
    }
    if (spell.actionType === 'spectral_infusion') {
      const infusion = spectralInfusions.find((item) => item.id === spell.actionId);
      if (!infusion) { setError('Infusão do catálogo não encontrada.'); return; }
      const result = useInfusion(character, infusion, { baseDamage: arrowDamage, attacksThisTurn, successful, spellId: spell.id });
      setError(result.error);
      if (!result.error) onChange(result.character);
      return;
    }
    const result = useSpell(character, spell, successful);
    setError(result.error);
    if (!result.error) onChange(result.character);
  }

  function removeSpell(spell) {
    if (!window.confirm(`Remover a magia ${spell.name}?`)) return;
    onChange({ ...character, spells: (character.spells || []).filter((item) => item.id !== spell.id) });
  }

  function saveTopic(spell) {
    const topic = topicDraft.trim() || 'Sem tópico';
    onChange({ ...character, spells: character.spells.map((item) => item.id === spell.id ? { ...item, topic } : item) });
    setEditingTopic('');
  }

  return <>
    <Panel title="Grimório do personagem" subtitle="Magias organizadas por tópico" wide>
      <div className="spellResources"><Metric label="Mana" value={`${character.currentMana}/${character.maxMana}`} /><Metric label="Foco" value={character.resources?.focoCurrent ?? '—'} /><Metric label="Humanidade" value={humanityValue(character)} /><Metric label="Magias" value={(character.spells || []).length} /></div>
      {error && <p className="validationError">{error}</p>}
      {normalize(classEntry?.name || '') === 'arqueiro espectral' && <div className="spectralSpellNotice"><div><strong>Flecha Mágica</strong><span>Dano natural: 2d4</span></div><p>Precisão, Impacto, Perfurante, Cinética e Espectral são infusões que aprimoram a mesma Flecha Mágica.</p><div className="classSpellPresets">{spectralSpellPresets.filter((preset) => !knownActionIds.has(preset.actionId)).map((preset) => <button className="ghostButton compactButton" key={preset.actionId} onClick={() => addClassSpell(preset)}><Plus aria-hidden="true" />{preset.name}</button>)}</div><div className="arrowInputs"><label>Resultado dos 2d4<input type="number" min="2" max="8" value={arrowDamage} onChange={(event) => setArrowDamage(event.target.value)} /></label><label>Ataques no turno<input type="number" min="1" value={attacksThisTurn} onChange={(event) => setAttacksThisTurn(event.target.value)} /></label></div></div>}
      <div className="spellbookActions"><details className="catalogSpellPicker"><summary>Adicionar magia existente</summary><label>Buscar no catálogo<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, grau, escola ou efeito" /></label><div>{available.length ? available.slice(0, 60).map((entry) => { const parsed = parseCatalogSpell(entry); return <article key={entry.id}><RpgImage src={entry.imageUrl} alt={entry.name} className="spellCatalogImage" fallback="✦" /><div><strong>{entry.name}</strong><span>{parsed.topic} · {parsed.manaCost} PM · {parsed.humanityCost} HM</span><small>{parsed.damage || parsed.description}</small></div><button className="primaryButton compactButton" onClick={() => addCatalogSpell(entry)}>Adicionar</button></article>; }) : <p className="muted">Nenhuma magia disponível para esta busca.</p>}</div></details><button className="ghostButton" onClick={() => setShowCustom(!showCustom)}>{showCustom ? 'Cancelar criação' : 'Criar magia personalizada'}</button></div>
      {showCustom && <form className="spellForm customSpellForm" onSubmit={addCustomSpell}><label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Tópico<input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} /></label><label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Comum</option><option>Espiritual</option><option>Divina</option><option>Feitiço</option><option>Demoníaca</option></select></label><label>Mana<input type="number" min="0" value={form.manaCost} onChange={(event) => setForm({ ...form, manaCost: event.target.value })} /></label><label>Foco<input type="number" min="0" value={form.focusCost} onChange={(event) => setForm({ ...form, focusCost: event.target.value })} /></label><label>Humanidade<input type="number" min="0" value={form.humanityCost} onChange={(event) => setForm({ ...form, humanityCost: event.target.value })} /></label><label>Dano ou efeito<input value={form.damage} onChange={(event) => setForm({ ...form, damage: event.target.value })} /></label><label>Alcance<input value={form.range} onChange={(event) => setForm({ ...form, range: event.target.value })} /></label><label className="spanForm">Descrição<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="primaryButton" type="submit">Criar magia</button></form>}
      {!grouped.length ? <div className="spellbookEmpty"><Sparkles aria-hidden="true" /><p>Adicione magias do catálogo oficial para montar o grimório.</p></div> : <div className="spellTopics">{grouped.map(([topic, spells]) => <section key={topic}><header><div><span>Tópico</span><h4>{topic}</h4></div><strong>{spells.length}</strong></header><div className="spellList">{spells.map((spell) => <article key={spell.id}><RpgImage src={spell.imageUrl} alt="" className="spellImage" fallback="✦" /><div className="spellMain"><div><strong>{spell.name}</strong><span>{spell.type} · {spell.manaCost} PM{spell.focusCost ? ` · ${spell.focusCost} Foco` : ''}{spell.humanityCost ? ` · ${spell.humanityCost} HM` : ''}</span><small>{Number(spell.successfulUses || 0) >= 3 ? 'Estável após 3 sucessos' : `${spell.successfulUses || 0}/3 usos bem-sucedidos`}</small></div>{spell.damage && <p><b>Dano/Efeito:</b> {spell.damage}</p>}{spell.range && <p><b>Alcance:</b> {spell.range}</p>}<p className="preWrap">{spell.description || 'Sem descrição.'}</p>{editingTopic === spell.id ? <div className="topicEditor"><input aria-label={`Tópico de ${spell.name}`} value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} /><button className="primaryButton compactButton" onClick={() => saveTopic(spell)}>Salvar</button><button className="ghostButton compactButton" onClick={() => setEditingTopic('')}>Cancelar</button></div> : <button className="topicButton" onClick={() => { setEditingTopic(spell.id); setTopicDraft(spell.topic || 'Sem tópico'); }}>Organizar tópico</button>}<div className="quickActions"><button className="primaryButton compactButton" onClick={() => cast(spell, true)}>Usar com sucesso</button><button className="ghostButton compactButton" onClick={() => cast(spell, false)}>Registrar falha</button><button className="removeButton compactButton" onClick={() => removeSpell(spell)}>Remover</button></div></div></article>)}</div></section>)}</div>}
      {!!character.actionHistory?.length && <details className="xpHistory"><summary>Histórico de uso</summary>{character.actionHistory.slice(0, 20).map((action) => <p key={action.id}><b>{action.name}</b> · {action.result || 'Usada'} · {action.manaSpent} PM · {action.focusSpent} Foco · {action.humanitySpent} Humanidade</p>)}</details>}
    </Panel>
  </>;
}

function HumanityPanel({ character, classEntry, onChange, requestRoll, recordRoll }) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState('Uso de poder divino');
  const humanity = humanityValue(character);
  const divinity = divinityValue(character);
  const status = humanityStatus(character, classEntry);
  const resistance = humanityResistanceBonus(character);

  function apply(delta) {
    const value = Math.max(1, Number(amount) || 1);
    onChange(changeHumanity(character, delta < 0 ? -value : value, reason));
  }

  function rollResistance() {
    if (status.difficulty === null) return;
    requestRoll({
      characterId: character.id,
      type: 'divine_resistance',
      name: `Resistência Divina · CD ${status.difficulty}`,
      sides: 20,
      modifiers: [{ id: 'humanity_resistance', sourceId: character.id, sourceName: 'Humanidade ÷ 10', sourceType: 'humanity', targetType: 'roll', targetId: 'divineResistance', value: resistance }],
      penalties: 0,
      origin: 'character_sheet',
    }, recordRoll);
  }

  return <Panel title="Humanidade e Divindade" subtitle="Magia divina e controle">
    <ResourceControl label="Humanidade" current={humanity} max={100} readOnly />
    <ResourceControl label="Divindade" current={divinity} max={100} readOnly />
    <div className="humanityStatus"><strong>{status.name}</strong><p>{status.description}</p></div>
    <div className="metricGrid"><Metric label="CD Divina" value={status.difficulty ?? (humanity === 1 ? 'Especial' : '—')} /><Metric label="Resistência" value={`+${resistance}`} /><Metric label="Acerto divino" value={`+${divineAccuracyBonus(character)}`} /></div>
    {hasFaithDamageBonus(character) && <p className="noticeText">Magias Divinas recebem dano base + Fé.</p>}
    {!status.playable && <p className="validationError">O personagem está injogável enquanto permanecer com Humanidade 0.</p>}
    <div className="humanityControls"><label>Quantidade<input type="number" min="1" max="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
    <div className="quickActions"><button className="primaryButton" disabled={humanity <= 0} onClick={() => apply(-1)}>Gastar Humanidade</button><button disabled={humanity >= 100} onClick={() => apply(1)}>Restaurar</button><button disabled={status.difficulty === null} onClick={rollResistance}>Resistência Divina</button></div>
    {!!character.humanityHistory?.length && <details className="xpHistory"><summary>Histórico de Humanidade</summary>{character.humanityHistory.slice(0, 20).map((entry) => <p key={entry.id}><b>{entry.reason}</b> · Humanidade {entry.humanityBefore} → {entry.humanityAfter} · Divindade {entry.divinityBefore} → {entry.divinityAfter}</p>)}</details>}
  </Panel>;
}

function RuleCards({ values = [], empty, onUse }) {
  if (!values.length) return <p className="muted">{empty}</p>;
  return <div className="abilityGrid">{values.map((value) => <article key={value}><span>✦</span><p>{value}</p>{onUse && <button className="ghostButton compactButton" onClick={() => onUse(value)}>Usar</button>}</article>)}</div>;
}

function ItemList({ items, catalog, actionLabel, onAction, onQuantity, onRemove }) {
  if (!items.length) return <p className="muted">Nenhum item cadastrado.</p>;
  return <div className="inventoryList">{items.map((item) => { const entry = findEntry(catalog, item.catalogId); const description = entry ? displayDescription(entry) : item.description; return <article key={item.id}><RpgImage src={entry?.imageUrl || item.imageUrl} alt={item.name} className="itemImage" fallback="□" /><div><strong>{entry?.name || item.name}</strong><span>{entry?.category || item.type}{item.bonus ? ` · ${item.bonus}` : ''}</span><details><summary>Detalhes e bônus</summary><p className="preWrap">{description || item.bonus || 'Sem descrição.'}</p></details></div>{onQuantity && <div className="quantityControl"><button onClick={() => onQuantity(item, -1)}>−</button><span>{item.quantity || 1}</span><button onClick={() => onQuantity(item, 1)}>+</button></div>}<div className="itemActions"><button className="ghostButton compactButton" onClick={() => onAction(item)}>{actionLabel}</button>{onRemove && <button className="removeButton compactButton" onClick={() => onRemove(item)}>Remover</button>}</div></article>; })}</div>;
}

function CatalogItemPicker({ catalog, onAdd }) {
  const [query, setQuery] = useState('');
  const items = catalogGroups(catalog).items.filter((entry) => normalize(`${entry.name} ${entry.description} ${(entry.labels || []).map((label) => label.name).join(' ')}`).includes(normalize(query)));
  return <details className="catalogItemPicker"><summary>Adicionar item existente</summary><label>Buscar no catálogo<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, tipo ou etiqueta" /></label><div>{items.length ? items.slice(0, 30).map((entry) => <article key={entry.id}><RpgImage src={entry.imageUrl} alt={entry.name} className="itemImage" fallback="□" /><span><strong>{entry.name}</strong><small>{entry.labels?.map((label) => label.name).filter(Boolean).join(' · ') || entry.category}</small></span><button className="primaryButton compactButton" onClick={() => onAdd(entry)}>Adicionar</button></article>) : <p className="muted">Nenhum item encontrado.</p>}</div></details>;
}

function RollHistory({ values }) {
  if (!values.length) return <p className="muted">Nenhuma rolagem registrada.</p>;
  return <div className="historyList">{values.map((roll) => <article key={roll.id}><strong>{roll.finalResult}</strong><div><b>{roll.name}</b><span>{roll.die}: {roll.rawResult} · {rollFormula(roll)}</span><time>{new Date(roll.createdAt).toLocaleString('pt-BR')}</time></div></article>)}</div>;
}

function LevelHistory({ values }) {
  if (!values.length) return <p className="muted">Nenhuma evolução registrada.</p>;
  return <div className="historyList">{values.map((entry, index) => <article key={`${entry.level}_${entry.createdAt}_${index}`}><strong>{entry.level}</strong><div><b>Nível {entry.level} · +{entry.hpAdded} vida</b><span>{entry.rollResult !== null && entry.rollResult !== undefined ? `${entry.die}: ${entry.rollResult}` : entry.hpMethod?.startsWith('initial_') ? `HP inicial · método ${entry.hpMethod.replace('initial_', '')}` : 'Valor fixo'} · XP consumido: {entry.xpSpent || 0} · Habilidade +{entry.skillPoints || 0} · Classe +{entry.classPoints || 0}</span>{entry.abilities?.length > 0 && <span>Habilidades: {entry.abilities.join(', ')}</span>}<time>{new Date(entry.createdAt).toLocaleString('pt-BR')}</time></div></article>)}</div>;
}

function ExperiencePanel({ character, catalog, classEntry, onChange }) {
  const skills = catalogGroups(catalog).skills;
  const suggestedAreas = unique(['Investigação', 'Coleta', 'Medicina', 'Religião', 'Furtividade', 'Diplomacia', 'Sobrevivência', ...skills.map((entry) => entry.name)]);
  const [area, setArea] = useState(suggestedAreas[0] || 'Investigação');
  const [areaGain, setAreaGain] = useState(1);
  const [combatBase, setCombatBase] = useState(1);
  const [combatExtra, setCombatExtra] = useState(1);
  const [areaAttribute, setAreaAttribute] = useState('');
  const [combatAttribute, setCombatAttribute] = useState('');
  const areaBalance = Number(character.areaExperience?.[area] || 0);
  const matchingSkill = skills.find((entry) => normalize(entry.name) === normalize(area));
  const relatedAttributes = matchingSkill
    ? parseSkill(matchingSkill).terms.map((term) => term.attribute)
    : attributes.map(([id]) => id);
  const combatTargets = allowedCombatXpTargets(classEntry);

  function history(type, amount, description) {
    return { id: `xp_${Date.now()}_${Math.random().toString(16).slice(2)}`, type, amount, description, createdAt: new Date().toISOString() };
  }

  function grantAreaXp() {
    const amount = Math.min(4, Math.max(1, Number(areaGain) || 1));
    onChange({
      areaExperience: { ...character.areaExperience, [area]: areaBalance + amount },
      experienceHistory: [history('area', amount, `${area}: XP por cena`), ...(character.experienceHistory || [])],
    });
  }

  function grantCombatXp() {
    const amount = Math.min(8, Math.max(0, Number(combatBase) || 0) + Math.max(0, Number(combatExtra) || 0));
    if (!amount) return;
    onChange({ combatXp: Number(character.combatXp || 0) + amount, experienceHistory: [history('combat', amount, `Combate: base ${combatBase} + participação ${combatExtra}`), ...(character.experienceHistory || [])] });
  }

  function convertAreaToSkill() {
    if (!matchingSkill || areaBalance < 20) return;
    onChange({
      areaExperience: { ...character.areaExperience, [area]: areaBalance - 20 },
      skillBonuses: { ...character.skillBonuses, [matchingSkill.id]: Number(character.skillBonuses?.[matchingSkill.id] || 0) + 1 },
      experienceHistory: [history('conversion', -20, `${area}: +1 permanente na perícia`), ...(character.experienceHistory || [])],
    });
  }

  function convertAreaToAttribute() {
    const target = areaAttribute || relatedAttributes[0];
    if (!target || areaBalance < 20) return;
    if (!window.confirm(`Confirmar aprovação do mestre para +1 em ${attributeLabel(target)}?`)) return;
    const current = attributeBreakdown(character, target).total;
    if (current >= 20) return;
    onChange({
      areaExperience: { ...character.areaExperience, [area]: areaBalance - 20 },
      permanentAttributeBonuses: { ...character.permanentAttributeBonuses, [target]: Number(character.permanentAttributeBonuses?.[target] || 0) + 1 },
      experienceHistory: [history('conversion', -20, `${area}: +1 permanente em ${attributeLabel(target)}`), ...(character.experienceHistory || [])],
    });
  }

  function convertCombat() {
    const target = combatAttribute || combatTargets[0];
    if (!target || Number(character.combatXp || 0) < 25) return;
    if (!window.confirm(`Confirmar que ${attributeLabel(target)} é permitido pela classe e coerente com o combate?`)) return;
    if (attributeBreakdown(character, target).total >= 20) return;
    onChange({
      combatXp: character.combatXp - 25,
      permanentAttributeBonuses: { ...character.permanentAttributeBonuses, [target]: Number(character.permanentAttributeBonuses?.[target] || 0) + 1 },
      experienceHistory: [history('conversion', -25, `Combate: +1 permanente em ${attributeLabel(target)}`), ...(character.experienceHistory || [])],
    });
  }

  return <Panel title="Experiência" subtitle="Áreas, combate e conversões" wide>
    <div className="xpColumns">
      <section className="xpBlock"><h4>XP por área</h4><label>Área<select aria-label="Área de experiência" value={area} onChange={(event) => { setArea(event.target.value); setAreaAttribute(''); }}>{suggestedAreas.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>XP da cena (1–4)<input type="number" min="1" max="4" value={areaGain} onChange={(event) => setAreaGain(event.target.value)} /></label><button className="primaryButton" onClick={grantAreaXp}>Registrar XP</button><div className="xpBalance"><span>{area}</span><strong>{areaBalance}/20 XP</strong></div>{matchingSkill && <button className="ghostButton" disabled={areaBalance < 20} onClick={convertAreaToSkill}>Converter em +1 na perícia</button>}{relatedAttributes.length > 0 && <div className="conversionRow"><select value={areaAttribute || relatedAttributes[0]} onChange={(event) => setAreaAttribute(event.target.value)}>{relatedAttributes.map((id) => <option value={id} key={id}>{attributeLabel(id)}</option>)}</select><button className="ghostButton" disabled={areaBalance < 20} onClick={convertAreaToAttribute}>+1 atributo</button></div>}</section>
      <section className="xpBlock"><h4>XP de combate</h4><label>Dificuldade<select value={combatBase} onChange={(event) => setCombatBase(Number(event.target.value))}><option value="0">Não participou · 0</option><option value="1">Fácil · 1</option><option value="2">Moderado · 2</option><option value="3">Difícil · 3</option><option value="4">Mortal · 4</option></select></label><label>Participação<select value={combatExtra} onChange={(event) => setCombatExtra(Number(event.target.value))}><option value="0">Sem adicional · 0</option><option value="1">Pouca · 1</option><option value="2">Moderada · 2</option><option value="3">Bastante · 3</option><option value="4">Carregou · 4</option></select></label><button className="primaryButton" onClick={grantCombatXp}>Registrar {Math.min(8, Number(combatBase) + Number(combatExtra))} XP</button><div className="xpBalance"><span>Combate</span><strong>{character.combatXp || 0}/25 XP</strong></div>{combatTargets.length ? <div className="conversionRow"><select value={combatAttribute || combatTargets[0]} onChange={(event) => setCombatAttribute(event.target.value)}>{combatTargets.map((id) => <option value={id} key={id}>{attributeLabel(id)}</option>)}</select><button className="ghostButton" disabled={character.combatXp < 25} onClick={convertCombat}>Converter +1</button></div> : <p className="validationWarning">O arquivo não lista os atributos de combate permitidos para esta classe. A conversão permanece bloqueada.</p>}</section>
    </div>
    <details className="xpHistory"><summary>Histórico de XP</summary>{!(character.experienceHistory || []).length ? <p className="muted">Nenhum XP registrado.</p> : <div className="historyList">{character.experienceHistory.map((entry) => <article key={entry.id}><strong>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong><div><b>{entry.description}</b><time>{new Date(entry.createdAt).toLocaleString('pt-BR')}</time></div></article>)}</div>}</details>
  </Panel>;
}

function LevelUpDialog({ character, catalog, parsedClass, onCancel, onConfirm }) {
  const method = character.hpProgressionMode === 'base' ? 'fixed' : (character.hpProgressionMode || 'fixed');
  const [rawRoll, setRawRoll] = useState('');
  const [xpGain, setXpGain] = useState(1);
  const [xpNote, setXpNote] = useState('Participação na sessão +1');
  const [xpBreakdown, setXpBreakdown] = useState({ participation: 1 });
  if (!parsedClass) return null;
  const nextLevel = character.level + 1;
  const nextCharacter = recalculateCharacter({ ...character, level: nextLevel }, catalog);
  const formula = method === 'hybrid' ? parsedClass.hpPerLevelHybridFormula : method === 'roll' ? parsedClass.hpPerLevelRollFormula : parsedClass.hpPerLevelBaseFormula;
  const formulaValue = evaluateRuleFormula(formula, nextCharacter);
  const die = method === 'hybrid' ? parsedClass.hybridDie : parsedClass.hitDie;
  const parsedRoll = Number(rawRoll);
  const hp = method === 'fixed' ? formulaValue : rawRoll !== '' && parsedRoll >= 1 && parsedRoll <= Number(die || 0) ? Number(formulaValue || 0) + parsedRoll : null;
  const xpCost = classXpRequired(character.level);
  const availableXp = Number(character.classXp || 0) + Math.max(0, Number(xpGain) || 0);
  const unlocks = parsedClass.unlocks.filter((item) => item.level === nextLevel).map((item) => item.name);

  function withRegisteredXp() {
    const gain = Math.max(0, Number(xpGain) || 0);
    if (!gain) return character;
    const calculated = calculateClassSessionXp(xpBreakdown);
    const entry = { id: `class_xp_${Date.now()}`, amount: gain, note: xpNote.trim() || 'Sessão', breakdown: calculated.total === gain ? calculated.breakdown : {}, createdAt: new Date().toISOString() };
    return { ...character, classXp: Number(character.classXp || 0) + gain, classXpTotal: Number(character.classXpTotal || 0) + gain, classXpHistory: [entry, ...(character.classXpHistory || [])] };
  }

  function registerOnly() {
    if (Number(xpGain) > 0) onConfirm(withRegisteredXp());
  }

  function confirm() {
    const baseCharacter = withRegisteredXp();
    if (hp === null || Number(baseCharacter.classXp || 0) < xpCost || character.level >= 10) return;
    const record = {
      level: nextLevel, hpMethod: method, die: method === 'fixed' ? '' : `d${die}`,
      rollResult: method === 'fixed' ? null : parsedRoll, modifiers: method === 'fixed' ? Math.max(0, hp - Number(parsedClass.hpPerLevelBase || 0)) : Number(formulaValue || 0),
      hpAdded: hp, skillPoints: parsedClass.skillPointsPerLevel || 0, classPoints: parsedClass.classPointsPerLevel || 0,
      abilities: unlocks, proficiencies: [], xpSpent: xpCost, createdAt: new Date().toISOString(),
    };
    onConfirm({
      ...baseCharacter, classXp: baseCharacter.classXp - xpCost, level: nextLevel,
      maxHp: character.maxHp + hp, currentHp: character.currentHp + hp,
      skillPoints: (character.skillPoints || 0) + (parsedClass.skillPointsPerLevel || 0),
      classPoints: (character.classPoints || 0) + (parsedClass.classPointsPerLevel || 0),
      levelHistory: [record, ...(character.levelHistory || [])],
    });
  }

  return <div className="modalBackdrop"><section className="modal levelModal">
    <div className="panelHeader"><div><span className="eyebrow">XP de Classe</span><h2>{character.level >= 10 ? 'Progresso de Excelência' : `Nível ${character.level} → ${nextLevel}`}</h2></div><button className="iconButton" aria-label="Fechar" title="Fechar" onClick={onCancel}><X aria-hidden="true" /></button></div>
    <ClassXpCalculator values={xpBreakdown} onChange={(values) => { const calculated = calculateClassSessionXp(values); setXpBreakdown(values); setXpGain(calculated.total); setXpNote(calculated.summary || 'Sessão'); }} />
    <div className="xpEntry"><label>XP ganho<input type="number" min="0" value={xpGain} onChange={(event) => setXpGain(event.target.value)} /></label><label>Origem / sessão<input value={xpNote} onChange={(event) => setXpNote(event.target.value)} /></label></div>
    <div className="xpBalance"><span>{character.level >= 10 ? 'Excelência' : `Próximo nível (${xpCost} XP)`}</span><strong>{availableXp}/{xpCost} XP</strong></div>
    {character.level < 10 && <><div className="methodSummary"><span>Método de vida</span><strong>{method === 'fixed' ? 'Valor fixo' : method === 'roll' ? `Rolagem d${die}` : `Híbrido + d${die}`}</strong></div>{method !== 'fixed' && <label>Resultado bruto do d{die}<input type="number" min="1" max={die} value={rawRoll} onChange={(event) => setRawRoll(event.target.value)} /></label>}<div className="summaryList"><span>XP consumido <b>{xpCost}</b></span><span>Atributos do novo nível <b>aplicados antes da vida</b></span><span>Base e modificadores de vida <b>{formulaValue ?? 'indisponível'}</b></span><span>Vida adicionada <b>{hp ?? 'informe um resultado válido'}</b></span><span>Habilidades <b>{unlocks.join(', ') || 'nenhuma identificada'}</b></span></div></>}
    <details className="xpHistory"><summary>Histórico de XP de Classe</summary>{!(character.classXpHistory || []).length ? <p className="muted">Nenhum XP de Classe registrado.</p> : character.classXpHistory.map((entry) => <p key={entry.id}>+{entry.amount} XP · {entry.note} · {new Date(entry.createdAt).toLocaleString('pt-BR')}</p>)}</details>
    <div className="modalActions"><button className="ghostButton" onClick={onCancel}>Cancelar</button><button className="ghostButton" disabled={Number(xpGain) <= 0} onClick={registerOnly}>Apenas registrar XP</button>{character.level < 10 && <button className="primaryButton" disabled={availableXp < xpCost || hp === null} onClick={confirm}>Consumir XP e subir</button>}</div>
  </section></div>;
}

function ClassXpCalculator({ values, onChange }) {
  const calculated = calculateClassSessionXp(values);
  return <details className="classXpCalculator" open>
    <summary>Critérios da sessão <strong>{calculated.total} XP</strong></summary>
    <div className="classXpCriteria">{classXpCriteria.map(([id, label, options]) => <label key={id}>{label}<select value={values[id] || 0} onChange={(event) => onChange({ ...values, [id]: Number(event.target.value) })}>{options.map((value) => <option key={value} value={value}>{value === 0 ? 'Não conceder' : `+${value} XP`}</option>)}</select></label>)}</div>
  </details>;
}

function LegacyLevelUpDialog({ character, parsedClass, onCancel, requestRoll, onConfirm }) {
  const baseHealth = evaluateRuleFormula(parsedClass?.hpPerLevelBaseFormula, character) ?? parsedClass?.hpPerLevelBase;
  const [method, setMethod] = useState(baseHealth !== null && baseHealth !== undefined ? 'base' : 'roll');
  const [roll, setRoll] = useState(null);
  const [xpGain, setXpGain] = useState(0);
  const [xpNote, setXpNote] = useState('Sessão');
  if (!parsedClass) return null;
  const nextLevel = character.level + 1;
  const xpCost = classXpRequired(character.level);
  const availableXp = Number(character.classXp || 0) + Math.max(0, Number(xpGain) || 0);
  const unlocks = parsedClass.unlocks.filter((item) => item.level === nextLevel).map((item) => item.name);
  const hp = method === 'base' ? baseHealth : roll?.finalResult;

  function withRegisteredXp() {
    const gain = Math.max(0, Number(xpGain) || 0);
    if (!gain) return character;
    const entry = { id: `class_xp_${Date.now()}`, amount: gain, note: xpNote.trim() || 'Sessão', createdAt: new Date().toISOString() };
    return { ...character, classXp: Number(character.classXp || 0) + gain, classXpTotal: Number(character.classXpTotal || 0) + gain, classXpHistory: [entry, ...(character.classXpHistory || [])] };
  }

  function registerOnly() {
    if (Number(xpGain) <= 0) return;
    onConfirm(withRegisteredXp());
  }

  function confirm() {
    if (hp === null || hp === undefined) return;
    const baseCharacter = withRegisteredXp();
    if (Number(baseCharacter.classXp || 0) < xpCost || character.level >= 10) return;
    const record = { level: nextLevel, hpMethod: method, die: method === 'roll' ? `d${parsedClass.hitDie}` : '', rollResult: roll?.rawResult ?? null, modifiers: method === 'roll' ? (roll?.modifiers || []).reduce((sum, item) => sum + Number(item.value || 0), 0) : Math.max(0, hp - Number(parsedClass.hpPerLevelBase || 0)), hpAdded: hp, skillPoints: parsedClass.skillPointsPerLevel || 0, classPoints: parsedClass.classPointsPerLevel || 0, abilities: unlocks, proficiencies: [], createdAt: new Date().toISOString() };
    onConfirm({ ...baseCharacter, classXp: baseCharacter.classXp - xpCost, level: nextLevel, maxHp: character.maxHp + hp, currentHp: character.currentHp + hp, skillPoints: (character.skillPoints || 0) + (parsedClass.skillPointsPerLevel || 0), classPoints: (character.classPoints || 0) + (parsedClass.classPointsPerLevel || 0), abilities: unique([...(character.abilities || []), ...unlocks]), levelHistory: [{ ...record, xpSpent: xpCost }, ...(character.levelHistory || [])], rollHistory: roll ? [roll, ...(character.rollHistory || [])].slice(0, 20) : character.rollHistory });
  }
  return <div className="modalBackdrop"><section className="modal levelModal"><div className="panelHeader"><div><span className="eyebrow">XP de Classe</span><h2>{character.level >= 10 ? 'Progresso de Excelência' : `Nível ${character.level} → ${nextLevel}`}</h2></div><button className="iconButton" title="Fechar" onClick={onCancel}>×</button></div><div className="xpEntry"><label>XP ganho<input type="number" min="0" value={xpGain} onChange={(event) => setXpGain(event.target.value)} /></label><label>Origem / sessão<input value={xpNote} onChange={(event) => setXpNote(event.target.value)} /></label></div><div className="xpBalance"><span>{character.level >= 10 ? 'Excelência' : `Próximo nível (${xpCost} XP)`}</span><strong>{availableXp}/{xpCost} XP</strong></div>{character.level < 10 && <><div className="segmented"><button disabled={baseHealth === null || baseHealth === undefined} className={method === 'base' ? 'active' : ''} onClick={() => { setMethod('base'); setRoll(null); }}>Vida fixa</button><button disabled={!parsedClass.hitDie} className={method === 'roll' ? 'active' : ''} onClick={() => setMethod('roll')}>Rolar dado</button></div>{method === 'roll' && <button className="primaryButton" onClick={() => requestRoll({ characterId: character.id, type: 'health', name: 'Vida do novo nível', sides: parsedClass.hitDie, modifiers: formulaRollModifiers(parsedClass.hpPerLevelRollFormula, character, 'Vida por nível'), penalties: 0, origin: 'level_up' }, setRoll)}>Rolar d{parsedClass.hitDie}</button>}<div className="summaryList"><span>XP consumido <b>{xpCost}</b></span><span>Vida adicionada <b>{hp ?? 'aguardando rolagem'}</b></span><span>Pontos de habilidade <b>{parsedClass.skillPointsPerLevel ?? 'não informado'}</b></span><span>Pontos de classe <b>{parsedClass.classPointsPerLevel ?? 'não informado'}</b></span><span>Habilidades <b>{unlocks.join(', ') || 'nenhuma identificada'}</b></span></div></>}<details className="xpHistory"><summary>Histórico de XP de Classe</summary>{!(character.classXpHistory || []).length ? <p className="muted">Nenhum XP de Classe registrado.</p> : (character.classXpHistory || []).map((entry) => <p key={entry.id}>+{entry.amount} XP · {entry.note} · {new Date(entry.createdAt).toLocaleString('pt-BR')}</p>)}</details><div className="modalActions"><button className="ghostButton" onClick={onCancel}>Cancelar</button><button className="ghostButton" disabled={Number(xpGain) <= 0} onClick={registerOnly}>Apenas registrar XP</button>{character.level < 10 && <button className="primaryButton" disabled={availableXp < xpCost || hp === null || hp === undefined} onClick={confirm}>Consumir XP e subir</button>}</div></section></div>;
}

function ExportDialog({ character, onClose }) {
  return <div className="modalBackdrop"><section className="modal exportModal"><div className="panelHeader"><div><span className="eyebrow">Exportação</span><h2>Prévia JSON da ficha</h2></div><button className="iconButton" aria-label="Fechar" title="Fechar" onClick={onClose}><X aria-hidden="true" /></button></div><pre>{JSON.stringify(character, null, 2)}</pre><p className="muted">A arquitetura está preparada para PDF e imagem em uma próxima etapa.</p></section></div>;
}

function inferProficiencyCategory(value) {
  const text = normalize(value);
  if (/combate|arma|armadura|ataque|escudo/.test(text)) return 'combat';
  if (/social|carisma|persuas|intimida|engan/.test(text)) return 'social';
  if (/conhecimento|relig|arcano|historia|natureza/.test(text)) return 'knowledge';
  if (/fisic|atlet|acrob|furtiv|forca|destreza/.test(text)) return 'physical';
  return 'special';
}
