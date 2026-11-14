import { useMemo, useRef, useState } from 'react';
import { Backpack, BookOpen, Dices, Download, LayoutDashboard, Plus, Sparkles, Swords, TrendingUp, X } from 'lucide-react';
import RpgImage from './RpgImage';
import StatBreakdown from './StatBreakdown';
import { attributes, currencyLabel, unique } from '../lib/rpgData';
import {
  attributeBreakdown,
  attributePointCost,
  activeDefenseFormula,
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
  parseRace,
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
  faithDamageBonus,
  hasFaithDamageBonus,
  humanityResistanceBonus,
  humanityStatus,
  humanityValue,
} from '../lib/humanity';
import { calculateClassSessionXp, classXpCriteria } from '../lib/experience';
import { changeHitPoints, recordDeathSave, resetDeathSaves } from '../lib/deathSaves';
import { advanceSpectralTurn, infusionDamage, infusionManaCost, religionGrade, religionValue, spectralInfusions, spectralSpellPresets, useInfusion, useMagicArrow, useSpell } from '../lib/classActions';
import { advanceDemonicTurn, changeCorruption, corruptionStatus, corruptionValue, demonicDamageBonus, demonicIncomingDamageBonus, demonicSpellCost, isDemonicSpell, toggleDemonicZone } from '../lib/corruption';
import { advanceTechniqueTurn, canLearnCombatTechniques, recordTechniqueTraining, saveCombatTechnique, setTechniqueCombatState, techniqueCostOptions, useCombatTechnique } from '../lib/combatTechniques';
import { markSwordsmanAction, setSwordsmanThreats, startSwordsmanTurn, swordsmanState } from '../lib/swordsman';

export default function CharacterSheet({ character, catalog, onEdit, onUpdate, requestRoll, activeTab = 'summary', onTabChange }) {
  const [xpDialog, setXpDialog] = useState('');
  const [exporting, setExporting] = useState(false);
  const [proficiencyFilter, setProficiencyFilter] = useState('all');
  const setActiveTab = onTabChange || (() => {});
  const race = findEntry(catalog, character.raceId);
  const classEntry = findEntry(catalog, character.classId);
  const parsedClass = classEntry ? parseClass(classEntry) : null;
  const canLevelUp = character.level < 10 && Number(character.classXp || 0) >= classXpRequired(character.level);
  const demonicOnly = corruptionStatus(character).demonicOnly;

  function persist(changes) {
    onUpdate(recalculateCharacter({ ...character, ...changes }, catalog));
  }

  function persistCharacter(next) {
    onUpdate(recalculateCharacter(next, catalog));
  }

  function rollAttribute(id, label) {
    const breakdown = attributeBreakdown(character, id);
    const rollBonuses = (character.modifiers || []).filter((item) => item.targetType === 'attributeRoll' && item.targetId === id);
    requestRoll({ characterId: character.id, type: 'attribute', name: label, sides: 20, modifiers: [{ id: `attribute_${id}`, sourceId: character.id, sourceName: `${label} final`, sourceType: 'attribute', targetType: 'roll', targetId: id, value: breakdown.total }, ...rollBonuses], penalties: 0, origin: 'character_sheet' }, recordRoll);
  }

  function simpleRoll(type, name, sides = 20) {
    requestRoll({ characterId: character.id, type, name, sides, modifiers: [], penalties: 0, origin: 'character_sheet' }, recordRoll);
  }

  function recordRolls(records, swordsmanAction = '') {
    const luckBonus = Number(character.resources?.pendingLuckBonus || 0);
    const adjusted = records.map((record, index) => luckBonus > 0 && index === 0
      ? { ...record, finalResult: Number(record.finalResult || 0) + luckBonus, modifiers: [...(record.modifiers || []), { id: 'luck_bonus', sourceId: character.id, sourceName: 'Sorte', sourceType: 'luck', targetType: 'roll', targetId: record.type, value: luckBonus }] }
      : record);
    const next = swordsmanAction ? markSwordsmanAction(character, swordsmanAction) : character;
    persistCharacter({ ...next, rollHistory: [...adjusted.reverse(), ...(character.rollHistory || [])].slice(0, 30), resources: luckBonus > 0 ? { ...next.resources, pendingLuckBonus: 0 } : next.resources });
  }

  function recordRoll(record, swordsmanAction = '') { recordRolls([record], swordsmanAction); }

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

  function addCustomItem(draft) {
    const target = draft.equip ? 'equipment' : 'inventory';
    const item = {
      id: `item_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      catalogId: '',
      name: draft.name.trim(),
      type: draft.type,
      quantity: Math.max(1, Number(draft.quantity) || 1),
      weight: Math.max(0, Number(draft.weight) || 0),
      bonus: draft.bonus,
      description: draft.description.trim(),
      notes: '',
      imageUrl: draft.imageUrl.trim(),
      requirements: '',
    };
    persist({ [target]: [item, ...(character[target] || [])] });
  }

  const proficiencyRows = useMemo(() => {
    const official = catalogGroups(catalog).skills;
    if (!official.length) return (character.proficiencies || []).map((name) => ({ id: name, name, proficient: true, source: 'Raça ou classe', category: inferProficiencyCategory(name) }));
    return official.map((entry) => {
      const target = normalize(entry.name);
      const sources = (character.proficiencies || []).filter((value) => normalize(value).includes(target));
      return { id: entry.id, name: entry.name, value: skillValue(character, parseSkill(entry)), proficient: sources.length > 0 || Number(character.skillBonuses?.[entry.id] || 0) > 0, source: sources.join(' · ') || (character.skillBonuses?.[entry.id] ? `Progressão permanente +${character.skillBonuses[entry.id]}` : 'Sem bônus permanente'), category: inferProficiencyCategory(`${entry.name} ${entry.description} ${(entry.labels || []).map((item) => item.name).join(' ')}`) };
    });
  }, [catalog, character.attributes, character.modifiers, character.proficiencies, character.skillBonuses]);
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
        <div className="headerActions"><button className="primaryButton" disabled={!parsedClass} onClick={() => { setActiveTab('progress'); setXpDialog(canLevelUp ? 'level' : 'register'); }}>{canLevelUp ? 'Subir de nível' : 'Registrar XP'}</button><button className="ghostButton" onClick={onEdit}>Editar</button><button className="iconButton" aria-label="Exportar ficha" title="Exportar ficha" onClick={() => setExporting(true)}><Download aria-hidden="true" /></button></div>
      </section>

      <nav className="sheetTabs spanTwo" aria-label="Seções da ficha">
        {[
          ['summary', 'Resumo', LayoutDashboard],
          ['combat', 'Combate', Swords],
          ['spells', 'Magias', Sparkles],
          ['progress', 'Evolução', TrendingUp],
          ['inventory', 'Itens', Backpack],
          ['description', 'História', BookOpen],
        ].map(([id, label, Icon]) => <button key={id} className={activeTab === id ? 'active' : ''} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
      </nav>

      {activeTab === 'summary' && <>
      <Panel title="Vida e recursos" subtitle="Controles da sessão">
        <HitPointControl character={character} raceEntry={race} onChange={persistCharacter} />
        <ResourceControl label="Mana" current={character.currentMana} max={character.maxMana} onChange={(currentMana) => persist({ currentMana })} />
        {character.currentHp === 0 && <DeathSaves character={character} onChange={persistCharacter} />}
      </Panel>

      <DefensePanel character={character} classEntry={classEntry} parsedClass={parsedClass} />

      <HumanityPanel character={character} classEntry={classEntry} onChange={persist} requestRoll={requestRoll} recordRoll={recordRoll} />
      <CorruptionPanel character={character} onChange={persistCharacter} />
      <LuckPanel character={character} onChange={persistCharacter} requestRoll={requestRoll} recordRoll={recordRoll} />

      <Panel title="Pontos" subtitle="Progressão da classe">
        <div className="metricGrid"><Metric label="Nível" value={character.level} /><Metric label="XP de classe" value={`${character.classXp || 0}/${classXpRequired(character.level)}`} /><Metric label="Habilidade" value={character.skillPoints || 0} /><Metric label="Classe" value={character.classPoints || 0} /></div>
      </Panel>
      </>}

      {activeTab === 'combat' && <>
      {Object.entries(character.resources || {}).some(([key]) => key.endsWith('Max')) && <Panel title="Recursos especiais" subtitle="Recursos da classe">
        <div className="resourceStack">{Object.entries(character.resources || {}).filter(([key]) => key.endsWith('Max')).map(([key, maximum]) => {
          const id = key.slice(0, -3), currentKey = `${id}Current`;
          return <ResourceControl key={id} label={id.charAt(0).toUpperCase() + id.slice(1)} current={character.resources[currentKey] || 0} max={maximum} onChange={(value) => persist({ resources: { ...character.resources, [currentKey]: value } })} />;
        })}</div>
      </Panel>}

      {normalize(classEntry?.name || '') === 'arqueiro espectral' && <ClassActionsPanel character={character} classEntry={classEntry} onChange={persistCharacter} />}
      {parsedClass?.metadata?.id === 'swordsman' && <SwordsmanPanel character={character} catalog={catalog} onChange={persistCharacter} requestRoll={requestRoll} recordRoll={recordRoll} recordRolls={recordRolls} />}

      <CombatTechniquesPanel character={character} parsedClass={parsedClass} onChange={persistCharacter} />

      <RuleContextPanel character={character} raceEntry={race} classEntry={classEntry} onChange={persistCharacter} />

      <Panel title="Atributos" subtitle="Clique no dado para testar" wide>
        <div className="breakdownGrid">{attributes.map(([id, label]) => <StatBreakdown key={id} label={label} breakdown={attributeBreakdown(character, id)} onRoll={() => rollAttribute(id, label)} />)}</div>
      </Panel>

      <Panel title="Proficiências e perícias" subtitle="Origem oficial" wide>
        <div className="filterRow">{[['all', 'Todas'], ['with', 'Com proficiência'], ['without', 'Sem proficiência'], ['combat', 'Combate'], ['social', 'Social'], ['knowledge', 'Conhecimento'], ['physical', 'Física'], ['special', 'Especial']].map(([id, label]) => <button key={id} className={proficiencyFilter === id ? 'active' : ''} onClick={() => setProficiencyFilter(id)}>{label}</button>)}</div>
        {!filteredProficiencies.length ? <p className="muted">Nenhuma perícia oficial encontrada para este filtro.</p> : <div className="ruleList">{filteredProficiencies.map((item) => { const rollBonuses = (character.modifiers || []).filter((modifier) => modifier.targetType === 'skillRoll' && normalize(modifier.targetId) === normalize(item.name)); const proficiencyBonus = item.proficient ? item.value : 0; const total = item.value + proficiencyBonus + rollBonuses.reduce((sum, modifier) => sum + Number(modifier.value || 0), 0); return <div key={item.id}><span>{item.proficient ? '✓' : '○'}</span><p><b>{item.name} · rolagem +{total}</b><small>{item.source}{item.proficient ? ` · proficiência soma o valor bruto +${item.value}` : ''}{rollBonuses.length ? ` · bônus de rolagem +${rollBonuses.reduce((sum, modifier) => sum + Number(modifier.value || 0), 0)}` : ''}</small></p><button className="iconButton" aria-label={`Rolar ${item.name}`} title="Rolar teste" onClick={() => requestRoll({ characterId: character.id, type: 'skill', name: item.name, sides: 20, modifiers: [{ id: `skill_${item.id}`, sourceId: item.id, sourceName: item.name, sourceType: 'skill', targetType: 'roll', targetId: item.id, value: item.value }, ...(item.proficient ? [{ id: `proficiency_${item.id}`, sourceId: character.id, sourceName: 'Proficiência · valor bruto', sourceType: 'proficiency', targetType: 'roll', targetId: item.id, value: item.value }] : []), ...rollBonuses], penalties: 0, origin: 'character_sheet' }, recordRoll)}><Dices aria-hidden="true" /></button></div>; })}</div>}
      </Panel>

      <Panel title="Combate e rolagens" subtitle="Ações rápidas">
        {demonicOnly && <p className="validationError">Com 50 ou mais de Corrupção, ataques só podem utilizar Magia Demoníaca.</p>}
        <div className="combatActions"><button className="primaryButton" disabled={demonicOnly} onClick={() => simpleRoll('attack', 'Ataque')}>Ataque</button><button disabled={demonicOnly} onClick={() => simpleRoll('damage', 'Dano', 6)}>Dano</button><button onClick={() => simpleRoll('resistance', 'Resistência')}>Resistência</button><button onClick={() => simpleRoll('general', 'Teste geral')}>Teste geral</button></div>
      </Panel>
      <Panel title="Rolagens recentes" subtitle="Últimos 30 resultados da ficha" wide>
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

      <Panel title="Inventário" subtitle="Catálogo e itens personalizados" wide>
        <CatalogItemPicker catalog={catalog} onAdd={addCatalogItem} />
        <CustomItemCreator onCreate={addCustomItem} />
        <ItemList items={character.inventory || []} catalog={catalog} actionLabel="Equipar" onAction={(item) => moveItem(item, 'equipment')} onQuantity={changeQuantity} onRemove={(item) => persist({ inventory: character.inventory.filter((current) => current.id !== item.id) })} />
      </Panel>
      </>}

      {activeTab === 'progress' && <>
      <ClassProgressPanel character={character} onRegister={() => setXpDialog('register')} onLevelUp={() => setXpDialog('level')} />
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
      {character.raceConnection && <Panel title="Conexão élfica" subtitle={character.combatContext?.separatedFromConnection ? 'Separado da conexão' : 'Conexão presente'} wide><p className="preWrap"><strong>Vínculo:</strong> {character.raceConnection}{'\n\n'}<strong>Penalidade ao se separar:</strong> {character.raceConnectionPenalty || 'Definida pelo Mestre conforme a força da conexão.'}</p></Panel>}
      <Panel title={classEntry?.name || 'Classe'} subtitle="Descrição completa da classe" wide><p className="preWrap">{classEntry ? displayDescription(classEntry) || 'Sem descrição cadastrada.' : 'Classe indisponível no catálogo.'}</p></Panel>
      <Panel title="Anotações"><p className="preWrap">{character.notes?.join('\n') || 'Sem anotações.'}</p></Panel>
      </>}

      {xpDialog && <LevelUpDialog key={xpDialog} mode={xpDialog} character={character} catalog={catalog} parsedClass={parsedClass} onCancel={() => setXpDialog('')} onConfirm={(next) => { setXpDialog(''); onUpdate(recalculateCharacter(next, catalog)); }} />}
      {exporting && <ExportDialog character={character} onClose={() => setExporting(false)} />}
    </div>
  );
}

function Panel({ title, subtitle, wide = false, children }) {
  return <section className={`panel ${wide ? 'spanTwo' : ''}`}><div className="panelHeader"><div><h3>{title}</h3>{subtitle && <span>{subtitle}</span>}</div></div>{children}</section>;
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function DefensePanel({ character, classEntry, parsedClass }) {
  const activeFormula = activeDefenseFormula(character, classEntry);
  const terms = activeFormula?.terms?.length ? activeFormula.terms : [
    { attribute: 'dexterity', weight: .7 },
    { attribute: 'constitution', weight: .3 },
  ];
  const termValues = terms.map((term) => {
    const value = attributeBreakdown(character, term.attribute).total;
    return { ...term, value, contribution: value * Number(term.weight || 0) };
  });
  const formulaBase = Number(activeFormula?.base || 0);
  const rawDefense = formulaBase + termValues.reduce((sum, term) => sum + term.contribution, 0);
  const roundedDefense = Math.max(0, Math.floor(rawDefense));
  const statModifiers = (character.modifiers || []).filter((item) => item.targetType === 'stat' && ['defense', 'armorClass', 'armorclass'].includes(item.targetId));
  const defenseBonus = statModifiers.filter((item) => item.targetId === 'defense').reduce((sum, item) => sum + Number(item.value || 0), 0);
  const armorClassBonus = statModifiers.filter((item) => ['armorClass', 'armorclass'].includes(item.targetId)).reduce((sum, item) => sum + Number(item.value || 0), 0);
  const defense = defenseValue(character, classEntry);
  const armorClass = armorClassValue(character, classEntry);
  const adaptive = Boolean(character.combatContext?.enemyWithinTwoMeters && parsedClass?.metadata?.conditionalDefense?.enemyWithinTwoMeters);
  return <Panel title="Defesa e Classe de Armadura" subtitle={adaptive ? 'Defesa adaptativa ativa' : 'Valores atuais'}><div className="metricGrid"><Metric label="Defesa" value={defense} /><Metric label="CA" value={armorClass} /></div><div className="calculationBreakdown"><strong>Cálculo bruto</strong>{termValues.map((term) => <span key={term.attribute}>{attributeLabel(term.attribute)}: {term.value} × {Math.round(Number(term.weight) * 100)}% = {formatDecimal(term.contribution)}</span>)}{formulaBase !== 0 && <span>Base da fórmula: {formatSigned(formulaBase)}</span>}<span>Soma bruta: {formatDecimal(rawDefense)} → floor = {roundedDefense}</span><span>Defesa: {roundedDefense} {formatSigned(defenseBonus)} = {defense}</span><span>CA: 10 + {defense} {formatSigned(armorClassBonus)} = {armorClass}</span></div>{statModifiers.length > 0 && <div className="modifierSummary">{statModifiers.map((item) => <span key={item.id}>{item.sourceName}: {formatSigned(item.value)} {item.targetId === 'defense' ? 'Defesa' : 'CA'}</span>)}</div>}</Panel>;
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatSigned(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? '+' : '-'} ${formatDecimal(Math.abs(number))}`;
}

function HitPointControl({ character, raceEntry, onChange }) {
  const [amount, setAmount] = useState(1);
  const [damageType, setDamageType] = useState('physical');
  const race = raceEntry ? parseRace(raceEntry, character.raceVariant) : null;
  const mechanics = race?.metadata || {};
  const physicalReduction = (mechanics.damageReduction || [])
    .filter((rule) => rule.type === 'physical')
    .reduce((total, rule) => total + Number(rule.value || 0), 0);
  const healingCap = Number(mechanics.healingCapPercent || 100);
  const delta = Math.max(1, Number(amount) || 1);
  const maximum = Math.max(0, Number(character.maxHp) || 0);
  const current = Math.min(maximum, Math.max(0, Number(character.currentHp) || 0));
  const cap = Math.floor(maximum * healingCap / 100);

  function takeDamage() {
    const reduction = damageType === 'physical' ? physicalReduction : 0;
    const applied = Math.max(0, delta - reduction);
    onChange(changeHitPoints(character, current - applied));
  }

  function heal(longRest = false) {
    onChange(changeHitPoints(character, longRest ? maximum : Math.min(cap, current + delta)));
  }

  const percent = maximum ? current / maximum * 100 : 0;
  return <div className="resourceControl"><div className="resourceHeader"><strong>Vida</strong><span>{current}/{maximum}</span></div><div className="resourceBar"><span style={{ width: `${percent}%` }} /></div><div className="hpAdjust"><input aria-label="Quantidade de vida" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /><select aria-label="Tipo de dano" value={damageType} onChange={(event) => setDamageType(event.target.value)}><option value="physical">Físico</option><option value="magical">Mágico</option><option value="divine">Divino</option><option value="other">Outro</option></select><button className="removeButton" disabled={!current} onClick={takeDamage}>Aplicar dano</button><button disabled={current >= cap} onClick={() => heal(false)}>Curar</button><button disabled={current >= maximum} onClick={() => heal(true)}>Descanso longo</button></div>{physicalReduction > 0 && <p className="muted">Dano físico recebido é reduzido em {physicalReduction}.</p>}{healingCap < 100 && <p className="muted">Curas comuns alcançam no máximo {healingCap}% da vida. Descanso longo ignora esse limite.</p>}</div>;
}

function RuleContextPanel({ character, raceEntry, classEntry, onChange }) {
  const race = raceEntry ? parseRace(raceEntry, character.raceVariant) : null;
  const parsedClass = classEntry ? parseClass(classEntry) : null;
  const mechanics = race?.metadata || {};
  const options = [
    parsedClass?.metadata?.conditionalDefense?.enemyWithinTwoMeters && ['enemyWithinTwoMeters', 'Inimigo a menos de 2 m', 'Ativa a Defesa Adaptativa da classe.'],
    mechanics.conditionalRollBonuses?.some((rule) => rule.condition === 'dark_or_night') && ['darkOrNight', 'Escuro ou noite', 'Ativa bônus raciais condicionais de rolagem.'],
    mechanics.environmentEffects?.some((rule) => rule.environment === 'quente') && ['hotEnvironment', 'Ambiente quente', 'Aplica efeitos raciais de região quente.'],
    mechanics.environmentEffects?.some((rule) => rule.environment === 'gelo') && ['coldEnvironment', 'Ambiente gelado', 'Aplica efeitos raciais de região gelada.'],
    mechanics.conditionalCosts?.some((rule) => rule.condition === 'without_sunlight') && ['withoutSunlight', 'Sem luz solar', 'O Mestre define o custo adicional de Humanidade.'],
    mechanics.statusEffects?.some((rule) => rule.status === 'blinded') && ['blinded', 'Cegueira', 'Lembrete: sofre o dano por turno descrito na raça.'],
    mechanics.connection?.required && ['separatedFromConnection', 'Separado da conexão', 'Ativa o lembrete da penalidade élfica definida pelo Mestre.'],
  ].filter(Boolean);
  if (!options.length) return null;
  const activeEffects = [
    character.combatContext?.hotEnvironment && mechanics.environmentEffects?.some((rule) => rule.environment === 'quente') && 'Deslocamento: -2 m em ambiente quente.',
    character.combatContext?.coldEnvironment && mechanics.environmentEffects?.some((rule) => rule.environment === 'gelo') && 'Deslocamento: -2 m em ambiente gelado.',
    character.combatContext?.withoutSunlight && mechanics.conditionalCosts?.length && 'Humanidade: custo adicional definido pelo Mestre enquanto estiver sem luz solar.',
    character.combatContext?.blinded && mechanics.statusEffects?.find((rule) => rule.status === 'blinded')?.damagePerTurn && `Cegueira: ${mechanics.statusEffects.find((rule) => rule.status === 'blinded').damagePerTurn} de dano físico por turno.`,
    character.combatContext?.separatedFromConnection && mechanics.connection?.required && `Conexão élfica: ${character.raceConnectionPenalty || 'penalidade definida pelo Mestre conforme a força do vínculo'}.`,
  ].filter(Boolean);

  function toggle(id) {
    onChange({ ...character, combatContext: { ...(character.combatContext || {}), [id]: !character.combatContext?.[id] } });
  }

  return <Panel title="Contexto de regras" subtitle="Condições que alteram a ficha" wide><div className="ruleContextGrid">{options.map(([id, label, description]) => <label key={id} className={character.combatContext?.[id] ? 'active' : ''}><input type="checkbox" checked={Boolean(character.combatContext?.[id])} onChange={() => toggle(id)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>{activeEffects.length > 0 && <div className="modifierSummary">{activeEffects.map((effect) => <span key={effect}>{effect}</span>)}</div>}</Panel>;
}

function CombatTechniquesPanel({ character, parsedClass, onChange }) {
  const emptyForm = { name: '', damage: '', description: '', training: '', costType: 'none', cooldownTurns: 1, learningDifficulty: 15, executionDifficulty: 10 };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const eligible = canLearnCombatTechniques(parsedClass);
  const inCombat = character.combatContext?.inCombat === true;

  function submit(event) {
    event.preventDefault();
    const result = saveCombatTechnique(character, form, editingId);
    setError(result.error);
    if (result.error) return;
    onChange(result.character);
    setForm(emptyForm);
    setEditingId('');
    setShowForm(false);
  }

  function edit(technique) {
    setForm({
      name: technique.name,
      damage: technique.damage || '',
      description: technique.description || '',
      training: technique.training || '',
      costType: technique.costType || 'none',
      cooldownTurns: technique.cooldownTurns || 1,
      learningDifficulty: technique.learningDifficulty || 15,
      executionDifficulty: technique.executionDifficulty || 10,
    });
    setEditingId(technique.id);
    setShowForm(true);
    setError('');
  }

  function use(technique, executionSucceeded = false) {
    const result = useCombatTechnique(character, technique.id, { executionSucceeded });
    setError(result.error);
    if (!result.error) onChange(result.character);
  }

  function train(technique, succeeded) {
    const result = recordTechniqueTraining(character, technique.id, succeeded);
    setError(result.error);
    if (!result.error) onChange(result.character);
  }

  function setCombat(active) {
    setError('');
    setShowForm(false);
    setEditingId('');
    onChange(setTechniqueCombatState(character, active));
  }

  if (!eligible) return <Panel title="Técnicas de combate" subtitle="Treinamento marcial" wide><p className="muted">A regra permite técnicas para classes que lutam sem Mana ou que utilizam armas. Esta classe não atende aos critérios estruturados atuais.</p></Panel>;

  return <Panel title="Técnicas de combate" subtitle="Golpes treinados fora de combate" wide>
    {error && <p className="validationError">{error}</p>}
    <div className="techniqueToolbar">
      <span className={inCombat ? 'combatStatus active' : 'combatStatus'}>{inCombat ? 'Combate ativo' : 'Fora de combate'}</span>
      {!inCombat && <button className="primaryButton compactButton" onClick={() => setCombat(true)}>Iniciar combate</button>}
      {inCombat && <><button onClick={() => onChange(advanceTechniqueTurn(character))}>Avançar turno</button><button className="ghostButton" onClick={() => setCombat(false)}>Encerrar combate</button></>}
      {!inCombat && <button className="ghostButton" onClick={() => { setShowForm(!showForm); setEditingId(''); setForm(emptyForm); setError(''); }}><Plus aria-hidden="true" />{showForm ? 'Cancelar' : 'Treinar técnica'}</button>}
    </div>
    <p className="muted">Técnicas são criadas por treinamento fora de combate. Golpes especiais podem ter uso único por combate ou recarga em turnos.</p>
    {showForm && !inCombat && <form className="techniqueForm" onSubmit={submit}>
      <label>Nome<input required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Dano ou sequência<input maxLength="200" value={form.damage} onChange={(event) => setForm({ ...form, damage: event.target.value })} placeholder="Ex.: duas machadadas" /></label>
      <label>Limite de uso<select value={form.costType} onChange={(event) => setForm({ ...form, costType: event.target.value })}>{techniqueCostOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {form.costType === 'cooldown' && <label>Recarga<input type="number" min="1" max="99" value={form.cooldownTurns} onChange={(event) => setForm({ ...form, cooldownTurns: event.target.value })} /></label>}
      <label>CD de aprendizado<input type="number" min="1" max="30" value={form.learningDifficulty} onChange={(event) => setForm({ ...form, learningDifficulty: event.target.value })} /></label>
      <label>CD de execução<input type="number" min="1" max="29" value={form.executionDifficulty} onChange={(event) => setForm({ ...form, executionDifficulty: event.target.value })} /></label>
      <label className="spanForm">Treinamento<textarea rows="2" maxLength="500" value={form.training} onChange={(event) => setForm({ ...form, training: event.target.value })} placeholder="Como a técnica foi praticada e aprendida" /></label>
      <label className="spanForm">Descrição<textarea rows="3" maxLength="1200" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <button className="primaryButton" type="submit">{editingId ? 'Salvar técnica' : 'Aprender técnica'}</button>
    </form>}
    {!(character.techniques || []).length ? <p className="muted">Nenhuma técnica aprendida.</p> : <div className="techniqueGrid">{character.techniques.map((technique) => {
      const blocked = technique.usedThisCombat || Number(technique.cooldownRemaining || 0) > 0;
      const limit = technique.costType === 'once_per_combat' ? 'Uso único por combate' : technique.costType === 'cooldown' ? `Recarga: ${technique.cooldownTurns} turno(s)` : 'Sem limite especial';
      const state = technique.learningState || 'unlearned';
      const stateLabel = state === 'mastered' ? 'Dominada' : state === 'partial' ? 'Aprendizado parcial' : 'Em treinamento';
      const fighterBonus = parsedClass?.metadata?.id === 'fighter' ? ' · Guerreiro +1 nos testes' : '';
      return <article key={technique.id}><div><strong>{technique.name}</strong><span>{stateLabel} · {limit}</span></div>{technique.damage && <p><b>Dano/efeito:</b> {technique.damage}</p>}{technique.description && <p>{technique.description}</p>}{technique.training && <small>Treinamento: {technique.training}</small>}<small>{Number(technique.trainingHours || 0)}h treinadas · Aprendizado CD {technique.learningDifficulty || 15}: {technique.trainingSuccesses || 0}/3 · Execução CD {technique.executionDifficulty || 10}: {technique.executionSuccesses || 0}/3 · Domínio por treino: {technique.masteryTrainingSuccesses || 0}/5{fighterBonus}</small>{inCombat && blocked && <small>{technique.usedThisCombat ? 'Já utilizada neste combate.' : `Disponível em ${technique.cooldownRemaining} turno(s).`}</small>}<div className="quickActions">{inCombat && state === 'partial' ? <><button className="primaryButton compactButton" disabled={blocked} onClick={() => use(technique, true)}>Execução bem-sucedida</button><button disabled={blocked} onClick={() => setError(`A execução falhou contra a CD ${technique.executionDifficulty || 10}; a técnica não foi aplicada.`)}>Execução falhou</button></> : <button className="primaryButton compactButton" disabled={!inCombat || blocked || state !== 'mastered'} onClick={() => use(technique)}>Usar</button>}{!inCombat && <>{state !== 'mastered' && <><button onClick={() => train(technique, true)}>Treino: sucesso</button><button onClick={() => train(technique, false)}>Treino: falha</button></>}<button onClick={() => edit(technique)}>Editar</button><button className="removeButton" onClick={() => onChange({ ...character, techniques: character.techniques.filter((item) => item.id !== technique.id) })}>Remover</button></>}</div></article>;
    })}</div>}
  </Panel>;
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
    <div className="quickActions"><button onClick={() => onChange(advanceSpectralTurn(character, { attacked: true }))}>Novo turno · atacou</button><button onClick={() => onChange(advanceSpectralTurn(character, { attacked: false }))}>Não atacou</button><button onClick={() => onChange(advanceSpectralTurn(character, { tookDamage: true }))}>Sofreu dano</button></div>
    <section className="classActionBlock"><h4>Flecha Mágica e infusões</h4><p className="muted">A Flecha Mágica causa 2d4 de dano. Informe o total obtido; a infusão escolhida aprimora o disparo e aplica Cadência, Mana e Foco.</p><div className="arrowInputs"><label>Resultado dos 2d4<input type="number" min="2" max="8" value={arrowDamage} onChange={(event) => setArrowDamage(event.target.value)} /></label><label>Ataques no turno<input type="number" min="1" value={attacksThisTurn} onChange={(event) => setAttacksThisTurn(event.target.value)} /></label></div><div className="infusionGrid">{spectralInfusions.map((infusion) => { const cadence = Number(character.resources?.cadenciaCurrent || 0); const mana = infusionManaCost(infusion, cadence, attacksThisTurn); const damage = infusionDamage(infusion, arrowDamage, cadence); return <article key={infusion.id}><div><strong>Infusão: {infusion.name}</strong><span>{mana} PM · {infusion.focusCost} Foco</span></div><p>{infusion.effect}</p><div className="arrowDamage"><span>Dano da Flecha Mágica</span><strong>{damage.hit}</strong>{damage.chainTargets > 0 && <><span>Alvos encadeados</span><strong>{damage.chainTargets}</strong></>}</div><button className="primaryButton compactButton" onClick={() => applyInfusion(infusion)}>Aplicar infusão</button></article>; })}</div></section>
  </Panel>;
}

function SwordsmanPanel({ character, catalog, onChange, requestRoll, recordRoll, recordRolls }) {
  const [areaAttack, setAreaAttack] = useState(false);
  const [specializedSword, setSpecializedSword] = useState(false);
  const [attackAttribute, setAttackAttribute] = useState('dexterity');
  const state = swordsmanState(character);
  const focused = state.threats > 0 && state.concentration === 0;
  const concentrationName = state.threats === 0 ? 'Sem alvo focado' : ['Total', 'Dividida', 'Quebrada'][state.concentration];
  const inCombat = Boolean(character.combatContext?.inCombat);

  function rollAttack() {
    const base = attributeBreakdown(character, attackAttribute).total;
    requestRoll({ characterId: character.id, type: 'attack', name: 'Ataque de espada', sides: 20, modifiers: [
      { id: 'swordsman_attribute', sourceId: character.id, sourceName: attributeLabel(attackAttribute), sourceType: 'attribute', targetType: 'roll', targetId: 'attack', value: base },
      ...(specializedSword ? [{ id: 'swordsman_specialization', sourceId: character.id, sourceName: 'Especialização em Espada', sourceType: 'class', targetType: 'roll', targetId: 'attack', value: 1 }] : []),
      ...(focused ? [{ id: 'swordsman_focus', sourceId: character.id, sourceName: 'Concentração Total', sourceType: 'class', targetType: 'roll', targetId: 'attack', value: 1 }] : []),
    ], origin: 'character_sheet' }, recordRoll);
  }

  function rollDodge() {
    const entry = catalogGroups(catalog).skills.find((item) => normalize(item.name) === 'acrobacia');
    const value = entry ? skillValue(character, parseSkill(entry)) : 0;
    const proficient = (character.proficiencies || []).some((item) => normalize(item).includes('acrobacia'));
    const conditional = (character.modifiers || []).filter((item) => item.targetType === 'skillRoll' && normalize(item.targetId) === 'acrobacia');
    requestRoll({ characterId: character.id, type: 'skill', name: 'Esquiva Instintiva', sides: 20, rollMode: areaAttack ? 'disadvantage' : 'normal', modifiers: [
      { id: 'swordsman_acrobatics', sourceId: entry?.id || character.id, sourceName: 'Acrobacia', sourceType: 'skill', targetType: 'roll', targetId: 'acrobatics', value },
      ...(proficient ? [{ id: 'swordsman_proficiency', sourceId: character.id, sourceName: 'Proficiência', sourceType: 'proficiency', targetType: 'roll', targetId: 'acrobatics', value }] : []),
      ...conditional,
      ...(state.concentration < 2 && state.threats > 0 ? [{ id: 'swordsman_dodge_focus', sourceId: character.id, sourceName: 'Concentração', sourceType: 'class', targetType: 'roll', targetId: 'acrobatics', value: 1 }] : []),
    ], origin: 'character_sheet' }, (record) => recordRoll(record, 'dodge'));
  }

  function rollOpening() {
    const base = attributeBreakdown(character, attackAttribute).total;
    const request = { characterId: character.id, type: 'attack', name: character.level >= 5 ? 'Ataque de Abertura · golpe 1 de 2' : 'Ataque de Abertura', sides: 20, rollMode: state.concentration === 1 ? 'disadvantage' : 'normal', modifiers: [
      { id: 'swordsman_opening_attribute', sourceId: character.id, sourceName: attributeLabel(attackAttribute), sourceType: 'attribute', targetType: 'roll', targetId: 'opening', value: base },
      ...(specializedSword ? [{ id: 'swordsman_opening_specialization', sourceId: character.id, sourceName: 'Especialização em Espada', sourceType: 'class', targetType: 'roll', targetId: 'opening', value: 1 }] : []),
      ...(focused ? [{ id: 'swordsman_opening_focus', sourceId: character.id, sourceName: 'Concentração Total', sourceType: 'class', targetType: 'roll', targetId: 'opening', value: 1 }] : []),
    ], origin: 'character_sheet' };
    requestRoll(request, (first) => {
      if (character.level < 5) { recordRoll(first, 'opening'); return; }
      requestRoll({ ...request, name: 'Ataque de Abertura · golpe 2 de 2' }, (second) => recordRolls([first, second], 'opening'));
    });
  }

  return <Panel title="Concentração do Espadachim" subtitle="Foco, esquiva e aberturas" wide>
    <div className="swordsmanStatus"><div><span>Estado</span><strong>{concentrationName}</strong></div><div><span>Ameaças</span><strong>{state.threats}</strong></div><div><span>Esquiva</span><strong>{state.dodgeUsed ? 'Usada' : 'Disponível'}</strong></div><div><span>Abertura</span><strong>{state.openingUsed ? 'Usada' : 'Disponível'}</strong></div></div>
    <div className="swordsmanControls"><label>Ameaças que exigem atenção<select aria-label="Ameaças que exigem atenção" value={state.threats} onChange={(event) => onChange(setSwordsmanThreats(character, Number(event.target.value)))}>{Array.from({ length: 21 }, (_, count) => <option key={count} value={count}>{count}</option>)}</select></label><label>Atributo do ataque<select aria-label="Atributo do ataque" value={attackAttribute} onChange={(event) => setAttackAttribute(event.target.value)}><option value="dexterity">Destreza</option><option value="strength">Força</option></select></label><label className="swordsmanCheck"><input type="checkbox" checked={specializedSword} onChange={(event) => setSpecializedSword(event.target.checked)} />Usando espada especializada (+1)</label><label className="swordsmanCheck"><input type="checkbox" checked={areaAttack} onChange={(event) => setAreaAttack(event.target.checked)} />Ataque em área contra Esquiva</label></div>
    {!inCombat && <button className="primaryButton compactButton swordsmanStart" onClick={() => onChange(setTechniqueCombatState(character, true))}>Iniciar combate</button>}
    <div className="quickActions"><button onClick={() => onChange(startSwordsmanTurn(character))} disabled={!inCombat}>Início do turno</button><button onClick={rollAttack} disabled={!inCombat}>Ataque de espada</button>{character.level >= 2 && <button onClick={rollDodge} disabled={!inCombat || state.dodgeUsed}>Esquiva Instintiva</button>}{character.level >= 3 && <button onClick={rollOpening} disabled={!inCombat || !state.threats || state.openingUsed || state.concentration === 2}>Ataque de Abertura</button>}</div>
    {character.level >= 5 && <p className="muted">Contra-Ataque Duplo: dois testes de ataque consecutivos, cada um com dano próprio se acertar.</p>}
    <p className="muted">Bônus de Concentração Total: +1 no acerto e na Esquiva contra o alvo focado. Em Concentração Dividida, a Abertura é feita com desvantagem. A Especialização só se aplica ao tipo de espada escolhido.</p>
  </Panel>;
}

function SpellbookPanel({ character, catalog, classEntry, onChange }) {
  const emptyForm = { name: '', type: 'Comum', topic: 'Sem tópico', description: '', damage: '', range: '', manaCost: 0, focusCost: 0, humanityCost: 0 };
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const pickerRef = useRef(null);
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
    setQuery('');
    if (pickerRef.current) pickerRef.current.open = false;
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
      <div className="spellResources"><Metric label="Mana" value={`${character.currentMana}/${character.maxMana}`} /><Metric label="Foco" value={character.resources?.focoCurrent ?? '—'} /><Metric label="Religião" value={`${religionValue(character)} · Grau ${religionGrade(character)}`} /><Metric label="Humanidade" value={humanityValue(character)} /><Metric label="Corrupção" value={corruptionValue(character)} /><Metric label="Magias" value={(character.spells || []).length} /></div>
      {error && <p className="validationError">{error}</p>}
      {normalize(classEntry?.name || '') === 'arqueiro espectral' && <div className="spectralSpellNotice"><div><strong>Flecha Mágica</strong><span>Dano natural: 2d4</span></div><p>Precisão, Impacto, Perfurante, Cinética e Espectral são infusões que aprimoram a mesma Flecha Mágica.</p><div className="classSpellPresets">{spectralSpellPresets.filter((preset) => !knownActionIds.has(preset.actionId)).map((preset) => <button className="ghostButton compactButton" key={preset.actionId} onClick={() => addClassSpell(preset)}><Plus aria-hidden="true" />{preset.name}</button>)}</div><div className="arrowInputs"><label>Resultado dos 2d4<input type="number" min="2" max="8" value={arrowDamage} onChange={(event) => setArrowDamage(event.target.value)} /></label><label>Ataques no turno<input type="number" min="1" value={attacksThisTurn} onChange={(event) => setAttacksThisTurn(event.target.value)} /></label></div></div>}
      <div className="spellbookActions"><details ref={pickerRef} className="catalogSpellPicker"><summary>Adicionar magia existente</summary><label>Buscar no catálogo<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, grau, escola ou efeito" /></label><div>{available.length ? available.slice(0, 60).map((entry) => { const parsed = parseCatalogSpell(entry); return <article key={entry.id}><RpgImage src={entry.imageUrl} alt={entry.name} className="spellCatalogImage" fallback="✦" /><div><strong>{entry.name}</strong><span>{parsed.topic} · {parsed.manaCost} PM · {parsed.humanityCost} HM</span><small>{parsed.damage || parsed.description}</small></div><button className="primaryButton compactButton" onClick={() => addCatalogSpell(entry)}>Adicionar</button></article>; }) : <p className="muted">Nenhuma magia disponível para esta busca.</p>}</div></details><button className="ghostButton" onClick={() => setShowCustom(!showCustom)}>{showCustom ? 'Cancelar criação' : 'Criar magia personalizada'}</button></div>
      {showCustom && <form className="spellForm customSpellForm" onSubmit={addCustomSpell}><label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Tópico<input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} /></label><label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Comum</option><option>Espiritual</option><option>Divina</option><option>Feitiço</option><option>Demoníaca</option></select></label><label>Mana<input type="number" min="0" value={form.manaCost} onChange={(event) => setForm({ ...form, manaCost: event.target.value })} /></label><label>Foco<input type="number" min="0" value={form.focusCost} onChange={(event) => setForm({ ...form, focusCost: event.target.value })} /></label><label>Humanidade<input type="number" min="0" value={form.humanityCost} onChange={(event) => setForm({ ...form, humanityCost: event.target.value })} /></label><label>Dano ou efeito<input value={form.damage} onChange={(event) => setForm({ ...form, damage: event.target.value })} /></label><label>Alcance<input value={form.range} onChange={(event) => setForm({ ...form, range: event.target.value })} /></label><label className="spanForm">Descrição<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="primaryButton" type="submit">Criar magia</button></form>}
      {!grouped.length ? <div className="spellbookEmpty"><Sparkles aria-hidden="true" /><p>Adicione magias do catálogo oficial para montar o grimório.</p></div> : <div className="spellTopics">{grouped.map(([topic, spells]) => <section key={topic}><header><div><span>Tópico</span><h4>{topic}</h4></div><strong>{spells.length}</strong></header><div className="spellList">{spells.map((spell) => { const manaCost = isDemonicSpell(spell) ? demonicSpellCost(character, spell.manaCost) : spell.manaCost; return <article key={spell.id}><RpgImage src={spell.imageUrl} alt="" className="spellImage" fallback="✦" /><div className="spellMain"><div><strong>{spell.name}</strong><span>{spell.type} · {manaCost} PM{spell.focusCost ? ` · ${spell.focusCost} Foco` : ''}{spell.humanityCost ? ` · ${spell.humanityCost} HM` : ''}</span><small>{Number(spell.successfulUses || 0) >= 3 ? 'Estável após 3 sucessos' : `${spell.successfulUses || 0}/3 usos bem-sucedidos`}</small></div>{spell.damage && <p><b>Dano/Efeito:</b> {spell.damage}{isDemonicSpell(spell) && demonicDamageBonus(character) > 0 ? ` · +${demonicDamageBonus(character)} pela Corrupção` : ''}</p>}{spell.range && <p><b>Alcance:</b> {spell.range}</p>}<details className="spellDescription"><summary>Descrição</summary><p className="preWrap">{spell.description || 'Sem descrição.'}</p></details>{editingTopic === spell.id ? <div className="topicEditor"><input aria-label={`Tópico de ${spell.name}`} value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} /><button className="primaryButton compactButton" onClick={() => saveTopic(spell)}>Salvar</button><button className="ghostButton compactButton" onClick={() => setEditingTopic('')}>Cancelar</button></div> : <button className="topicButton" onClick={() => { setEditingTopic(spell.id); setTopicDraft(spell.topic || 'Sem tópico'); }}>Organizar tópico</button>}<div className="quickActions"><button className="primaryButton compactButton" onClick={() => cast(spell, true)}>Usar com sucesso</button><button className="ghostButton compactButton" onClick={() => cast(spell, false)}>Registrar falha</button><button className="removeButton compactButton" onClick={() => removeSpell(spell)}>Remover</button></div></div></article>; })}</div></section>)}</div>}
      {!!character.actionHistory?.length && <details className="xpHistory"><summary>Histórico de uso</summary>{character.actionHistory.slice(0, 20).map((action) => <p key={action.id}><b>{action.name}</b> · {action.result || 'Usada'} · {action.manaSpent} PM · {action.focusSpent} Foco · {action.humanitySpent} Humanidade</p>)}</details>}
    </Panel>
  </>;
}

function LuckPanel({ character, onChange, requestRoll, recordRoll }) {
  const luck = Math.max(0, Math.min(3, Number(character.resources?.luck || 0)));

  function consume() {
    if (!luck) return;
    const label = luck === 1 ? 'Repetir uma rolagem' : luck === 2 ? 'Adicionar +1 à próxima rolagem' : 'Repetir o dano de um ataque';
    const next = {
      ...character,
      resources: { ...character.resources, luck: 0, pendingLuckBonus: luck === 2 ? 1 : 0 },
      actionHistory: [{ id: `luck_${Date.now()}`, name: `Sorte ${luck}`, result: label, manaSpent: 0, focusSpent: 0, humanitySpent: 0, createdAt: new Date().toISOString() }, ...(character.actionHistory || [])].slice(0, 100),
    };
    onChange(next);
    if (luck !== 2) requestRoll({ characterId: character.id, type: luck === 3 ? 'damage' : 'luck', name: label, sides: luck === 3 ? 6 : 20, modifiers: [], penalties: 0, origin: 'luck' }, (record) => onChange({ ...next, rollHistory: [record, ...(next.rollHistory || [])].slice(0, 30) }));
  }

  return <Panel title="Sorte" subtitle="Recurso raro de uso único"><div className="metricGrid"><Metric label="Nível ativo" value={luck} /><Metric label="Bônus pendente" value={character.resources?.pendingLuckBonus || 0} /></div><p className="muted">{luck === 0 ? 'Nenhum efeito de Sorte ativo.' : luck === 1 ? 'Repete uma rolagem; o segundo resultado é obrigatório.' : luck === 2 ? 'Adiciona +1 a uma rolagem antes da confirmação.' : 'Repete o dano de um único ataque; o segundo resultado é obrigatório.'}</p><div className="quickActions"><button className="primaryButton" disabled={!luck} onClick={consume}>Usar Sorte</button><button disabled={!luck} onClick={() => onChange({ ...character, resources: { ...character.resources, luck: 0, pendingLuckBonus: 0 } })}>Encerrar sessão</button></div></Panel>;
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
    {hasFaithDamageBonus(character) && <p className="noticeText">Magias Divinas recebem +{faithDamageBonus(character)} de dano (5% da Divindade).</p>}
    {!status.playable && <p className="validationError">O personagem está injogável enquanto permanecer com Humanidade 0.</p>}
    <div className="humanityControls"><label>Quantidade<input type="number" min="1" max="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
    <div className="quickActions"><button className="primaryButton" disabled={humanity <= 0} onClick={() => apply(-1)}>Gastar Humanidade</button><button disabled={humanity >= 100} onClick={() => apply(1)}>Restaurar</button><button disabled={status.difficulty === null} onClick={rollResistance}>Resistência Divina</button><button disabled={humanity >= 100} onClick={() => onChange(changeHumanity(character, 5, 'Recuperação ao fim do combate'))}>Fim do combate +5</button><button disabled={humanity >= 100} onClick={() => onChange(changeHumanity(character, 10, 'Recuperação após 5 turnos'))}>5 turnos +10</button><button disabled={humanity >= 100} onClick={() => onChange(changeHumanity(character, 100, 'Descanso completo'))}>Descanso completo</button></div>
    {!!character.humanityHistory?.length && <details className="xpHistory"><summary>Histórico de Humanidade</summary>{character.humanityHistory.slice(0, 20).map((entry) => <p key={entry.id}><b>{entry.reason}</b> · Humanidade {entry.humanityBefore} → {entry.humanityAfter} · Divindade {entry.divinityBefore} → {entry.divinityAfter}</p>)}</details>}
  </Panel>;
}

function CorruptionPanel({ character, onChange }) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState('Influência do pacto demoníaco');
  const corruption = corruptionValue(character);
  const status = corruptionStatus(character);
  const zoneActive = character.resources?.demonicZoneActive === 1;

  function apply(direction) {
    const value = Math.max(1, Number(amount) || 1);
    onChange(changeCorruption(character, direction * value, reason));
  }

  return <Panel title="Corrupção" subtitle="Pacto e magia demoníaca">
    <ResourceControl label="Corrupção" current={corruption} max={100} readOnly />
    <div className="humanityStatus"><strong>{status.name}</strong><p>{status.description}</p></div>
    <div className="metricGrid"><Metric label="Dano demoníaco" value={`+${demonicDamageBonus(character)}`} /><Metric label="Custo demoníaco" value={`+${demonicDamageBonus(character)} PM`} /><Metric label="Dano na zona" value={`+${demonicIncomingDamageBonus(character)}`} /></div>
    {zoneActive && <p className="noticeText">Zona Demoníaca ativa: vantagem nos poderes demoníacos e uma rolagem adicional com vantagem a cada 5 turnos.</p>}
    {!status.playable && <p className="validationError">Manifestação completa: o personagem morreu e não está mais jogável.</p>}
    <div className="humanityControls"><label>Quantidade<input type="number" min="1" max="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
    <div className="quickActions"><button className="primaryButton" disabled={corruption >= 100} onClick={() => apply(1)}>Adicionar Corrupção</button><button disabled={corruption <= 0} onClick={() => apply(-1)}>Reduzir</button>{status.canCreateZone && <button onClick={() => onChange(toggleDemonicZone(character))}>{zoneActive ? 'Encerrar zona' : 'Criar zona'}</button>}{status.lastOrder && <button className="removeButton" onClick={() => onChange(advanceDemonicTurn(character))}>Avançar turno</button>}</div>
    {!!character.corruptionHistory?.length && <details className="xpHistory"><summary>Histórico de Corrupção</summary>{character.corruptionHistory.slice(0, 20).map((entry) => <p key={entry.id}><b>{entry.reason}</b> · Corrupção {entry.before} → {entry.after}</p>)}</details>}
  </Panel>;
}

function RuleCards({ values = [], empty, onUse }) {
  if (!values.length) return <p className="muted">{empty}</p>;
  return <div className="abilityGrid">{values.map((value) => <article key={value}><span>✦</span><p>{value}</p>{onUse && <button className="ghostButton compactButton" onClick={() => onUse(value)}>Rolar d20</button>}</article>)}</div>;
}

function ItemList({ items, catalog, actionLabel, onAction, onQuantity, onRemove }) {
  if (!items.length) return <p className="muted">Nenhum item cadastrado.</p>;
  return <div className="inventoryList">{items.map((item) => { const entry = findEntry(catalog, item.catalogId); const description = entry ? displayDescription(entry) : item.description; return <article key={item.id}><RpgImage src={entry?.imageUrl || item.imageUrl} alt={item.name} className="itemImage" fallback="□" /><div><strong>{entry?.name || item.name}</strong><span>{entry?.category || item.type}{item.bonus ? ` · ${item.bonus}` : ''}</span><details><summary>Detalhes e bônus</summary><p className="preWrap">{description || item.bonus || 'Sem descrição.'}</p></details></div>{onQuantity && <div className="quantityControl"><button onClick={() => onQuantity(item, -1)}>−</button><span>{item.quantity || 1}</span><button onClick={() => onQuantity(item, 1)}>+</button></div>}<div className="itemActions"><button className="ghostButton compactButton" onClick={() => onAction(item)}>{actionLabel}</button>{onRemove && <button className="removeButton compactButton" onClick={() => onRemove(item)}>Remover</button>}</div></article>; })}</div>;
}

function CatalogItemPicker({ catalog, onAdd }) {
  const [query, setQuery] = useState('');
  const pickerRef = useRef(null);
  const items = catalogGroups(catalog).items.filter((entry) => normalize(`${entry.name} ${entry.description} ${(entry.labels || []).map((label) => label.name).join(' ')}`).includes(normalize(query)));
  function add(entry) {
    onAdd(entry);
    setQuery('');
    if (pickerRef.current) pickerRef.current.open = false;
  }
  return <details ref={pickerRef} className="catalogItemPicker"><summary>Adicionar item existente</summary><label>Buscar no catálogo<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, tipo ou etiqueta" /></label><div>{items.length ? items.slice(0, 30).map((entry) => <article key={entry.id}><RpgImage src={entry.imageUrl} alt={entry.name} className="itemImage" fallback="□" /><span><strong>{entry.name}</strong><small>{entry.labels?.map((label) => label.name).filter(Boolean).join(' · ') || entry.category}</small></span><button className="primaryButton compactButton" onClick={() => add(entry)}>Adicionar</button></article>) : <p className="muted">Nenhum item encontrado.</p>}</div></details>;
}

function CustomItemCreator({ onCreate }) {
  const empty = { name: '', type: 'Item', description: '', imageUrl: '', weight: 0, quantity: 1, bonusTarget: '', bonusValue: 1, equip: false };
  const [draft, setDraft] = useState(empty);
  const bonusOptions = [
    ['', 'Sem bônus'], ['defense', 'Defesa'], ['armorClass', 'CA'],
    ['strength', 'Força'], ['dexterity', 'Destreza'], ['constitution', 'Constituição'],
    ['intelligence', 'Inteligência'], ['charisma', 'Carisma'], ['faith', 'Fé'],
  ];
  const selected = bonusOptions.find(([id]) => id === draft.bonusTarget);

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const bonusValue = Math.max(-20, Math.min(20, Number(draft.bonusValue) || 0));
    onCreate({
      ...draft,
      bonus: selected?.[0] && bonusValue !== 0 ? `${selected[1]}: ${bonusValue >= 0 ? '+' : ''}${bonusValue}` : '',
    });
    setDraft(empty);
  }

  return <details className="customItemCreator"><summary><Plus aria-hidden="true" /> Criar item personalizado</summary><form onSubmit={submit}><div className="customItemGrid"><label>Nome<input maxLength="120" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Tipo<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>Item</option><option>Arma</option><option>Armadura</option><option>Consumível</option><option>Ferramenta</option><option>Acessório</option></select></label><label>Quantidade<input type="number" min="1" max="9999" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></label><label>Peso<input type="number" min="0" step="0.1" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })} /></label><label>Bônus ao equipar<select value={draft.bonusTarget} onChange={(event) => setDraft({ ...draft, bonusTarget: event.target.value })}>{bonusOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Valor do bônus<input type="number" min="-20" max="20" disabled={!draft.bonusTarget} value={draft.bonusValue} onChange={(event) => setDraft({ ...draft, bonusValue: event.target.value })} /></label><label className="spanTwoFields">URL da imagem<input type="url" maxLength="2000" placeholder="https://..." value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /></label><label className="spanTwoFields">Descrição<textarea rows="3" maxLength="2000" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label></div><div className="customItemFooter"><label className="inlineCheck"><input type="checkbox" checked={draft.equip} onChange={(event) => setDraft({ ...draft, equip: event.target.checked })} /> Criar já equipado</label><button type="submit" className="primaryButton"><Plus aria-hidden="true" /> Criar item</button></div></form></details>;
}

function RollHistory({ values }) {
  if (!values.length) return <p className="muted">Nenhuma rolagem registrada.</p>;
  return <div className="historyList">{values.map((roll) => <article key={roll.id}><strong>{roll.finalResult}</strong><div><b>{roll.name}</b><span>{roll.die}: {roll.rawResult} · {rollFormula(roll)}</span><time>{new Date(roll.createdAt).toLocaleString('pt-BR')}</time></div></article>)}</div>;
}

function LevelHistory({ values }) {
  if (!values.length) return <p className="muted">Nenhuma evolução registrada.</p>;
  return <div className="historyList">{values.map((entry, index) => <article key={`${entry.level}_${entry.createdAt}_${index}`}><strong>{entry.level}</strong><div><b>Nível {entry.level} · +{entry.hpAdded} vida</b><span>{entry.rollResult !== null && entry.rollResult !== undefined ? `${entry.die}: ${entry.rollResult}` : entry.hpMethod?.startsWith('initial_') ? `HP inicial · método ${entry.hpMethod.replace('initial_', '')}` : 'Valor fixo'} · XP consumido: {entry.xpSpent || 0} · Habilidade +{entry.skillPoints || 0} · Classe +{entry.classPoints || 0}</span>{entry.abilities?.length > 0 && <span>Habilidades: {entry.abilities.join(', ')}</span>}<time>{new Date(entry.createdAt).toLocaleString('pt-BR')}</time></div></article>)}</div>;
}

function ClassProgressPanel({ character, onRegister, onLevelUp }) {
  const balance = Number(character.classXp || 0);
  const cost = classXpRequired(character.level);
  const atLimit = character.level >= 10;
  const ready = !atLimit && balance >= cost;
  return <Panel title="XP de classe" subtitle="Usado para subir de nível" wide>
    <div className="classProgress">
      <div className="classProgressBalance"><span>Saldo disponível</span><strong>{balance} XP</strong><small>{atLimit ? 'Nível máximo · XP de Excelência' : ready ? `Nível ${character.level + 1} disponível · custa ${cost} XP` : `Faltam ${cost - balance} XP para o nível ${character.level + 1}`}</small></div>
      {!atLimit && <progress max={cost} value={Math.min(cost, balance)} aria-label="Progresso para o próximo nível" />}
      <div className="classProgressActions"><button className="ghostButton" onClick={onRegister}>Registrar XP de sessão</button>{!atLimit && <button className="primaryButton" disabled={!ready} onClick={onLevelUp}>Subir para nível {character.level + 1}</button>}</div>
    </div>
  </Panel>;
}

function ExperiencePanel({ character, catalog, classEntry, onChange }) {
  const skills = catalogGroups(catalog).skills;
  const [gain, setGain] = useState(1);
  const [scene, setScene] = useState('Participação relevante');
  const [attribute, setAttribute] = useState(attributes[0][0]);
  const [skillId, setSkillId] = useState(skills[0]?.id || '');
  const developmentXp = Number(character.developmentXp || 0);
  const developmentPoints = Number(character.developmentPoints || 0);
  const attributeValue = attributeBreakdown(character, attribute).total;
  const attributeCost = attributePointCost(attributeValue);
  const skillDevelopment = Number(character.developmentSkillBonuses?.[skillId] || 0);

  function history(type, amount, description) {
    return { id: `xp_${Date.now()}_${Math.random().toString(16).slice(2)}`, type, amount, description, createdAt: new Date().toISOString() };
  }

  function grantDevelopmentXp() {
    const amount = Math.min(4, Math.max(1, Number(gain) || 1));
    const total = developmentXp + amount;
    const earnedPoints = Math.floor(total / 20);
    onChange({
      developmentXp: total % 20,
      developmentPoints: developmentPoints + earnedPoints,
      experienceHistory: [...(earnedPoints > 0 ? [history('conversion', -(earnedPoints * 20), `${earnedPoints * 20} XP convertidos automaticamente em ${earnedPoints} PD`)] : []), history('development', amount, scene || 'Cena relevante'), ...(character.experienceHistory || [])],
    });
  }

  function improveAttribute() {
    if (developmentPoints < attributeCost || attributeValue >= 20) return;
    if (!window.confirm(`Gastar ${attributeCost} PD para +1 em ${attributeLabel(attribute)}?`)) return;
    onChange({
      developmentPoints: developmentPoints - attributeCost,
      permanentAttributeBonuses: { ...character.permanentAttributeBonuses, [attribute]: Number(character.permanentAttributeBonuses?.[attribute] || 0) + 1 },
      developmentAttributeBonuses: { ...character.developmentAttributeBonuses, [attribute]: Number(character.developmentAttributeBonuses?.[attribute] || 0) + 1 },
      experienceHistory: [history('development_spend', -attributeCost, `+1 permanente em ${attributeLabel(attribute)}`), ...(character.experienceHistory || [])],
    });
  }

  function improveSkill() {
    if (!skillId || developmentPoints < 1 || skillDevelopment >= 5) return;
    const skill = skills.find((entry) => entry.id === skillId);
    onChange({
      developmentPoints: developmentPoints - 1,
      skillBonuses: { ...character.skillBonuses, [skillId]: Number(character.skillBonuses?.[skillId] || 0) + 1 },
      developmentSkillBonuses: { ...character.developmentSkillBonuses, [skillId]: skillDevelopment + 1 },
      experienceHistory: [history('development_spend', -1, `+1 permanente em ${skill?.name || 'perícia'}`), ...(character.experienceHistory || [])],
    });
  }

  return <Panel title="XP de desenvolvimento" subtitle="A cada 20 XP, recebe 1 PD automaticamente" wide>
    <div className="xpColumns">
      <section className="xpBlock"><div className="xpBalance"><span>Saldo de desenvolvimento</span><strong>{developmentXp}/20 XP · {developmentPoints} PD</strong></div><h4>Registrar cena</h4><label>Contribuição<select value={gain} onChange={(event) => setGain(Number(event.target.value))}><option value="1">Participação relevante · 1 XP</option><option value="2">Boa contribuição · 2 XP</option><option value="3">Grande contribuição · 3 XP</option><option value="4">Feito excepcional · 4 XP</option></select></label><label>Contexto<input value={scene} onChange={(event) => setScene(event.target.value)} /></label><button className="primaryButton" onClick={grantDevelopmentXp}>Registrar {gain} XP de desenvolvimento</button></section>
      <section className="xpBlock"><h4>Gastar PD</h4><label>Atributo<select value={attribute} onChange={(event) => setAttribute(event.target.value)}>{attributes.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><button className="ghostButton" disabled={developmentPoints < attributeCost || attributeValue >= 20} onClick={improveAttribute}>+1 atributo · {attributeCost} PD</button><label>Perícia<select value={skillId} onChange={(event) => setSkillId(event.target.value)}>{skills.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label><button className="ghostButton" disabled={!skillId || developmentPoints < 1 || skillDevelopment >= 5} onClick={improveSkill}>+1 perícia · 1 PD ({skillDevelopment}/5)</button></section>
    </div>
    <details className="xpHistory"><summary>Histórico de XP</summary>{!(character.experienceHistory || []).length ? <p className="muted">Nenhum XP registrado.</p> : <div className="historyList">{character.experienceHistory.map((entry) => <article key={entry.id}><strong>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong><div><b>{entry.description}</b><time>{new Date(entry.createdAt).toLocaleString('pt-BR')}</time></div></article>)}</div>}</details>
  </Panel>;
}

function LevelUpDialog({ mode, character, catalog, parsedClass, onCancel, onConfirm }) {
  const method = character.hpProgressionMode === 'base' ? 'fixed' : (character.hpProgressionMode || 'fixed');
  const [rawRoll, setRawRoll] = useState('');
  const [xpGain, setXpGain] = useState(0);
  const [xpNote, setXpNote] = useState('');
  const [xpBreakdown, setXpBreakdown] = useState({});
  const [entryMode, setEntryMode] = useState('criteria');
  if (!parsedClass) return null;
  const nextLevel = character.level + 1;
  const nextCharacter = recalculateCharacter({ ...character, level: nextLevel }, catalog);
  const formula = method === 'hybrid' ? parsedClass.hpPerLevelHybridFormula : method === 'roll' ? parsedClass.hpPerLevelRollFormula : parsedClass.hpPerLevelBaseFormula;
  const formulaValue = evaluateRuleFormula(formula, nextCharacter);
  const die = method === 'hybrid' ? parsedClass.hybridDie : parsedClass.hitDie;
  const parsedRoll = Number(rawRoll);
  const hp = method === 'fixed' ? formulaValue : rawRoll !== '' && parsedRoll >= 1 && parsedRoll <= Number(die || 0) ? Number(formulaValue || 0) + parsedRoll : null;
  const xpCost = classXpRequired(character.level);
  const availableXp = Number(character.classXp || 0);
  const unlocks = parsedClass.unlocks.filter((item) => item.level === nextLevel).map((item) => item.name);

  function withRegisteredXp() {
    const gain = Math.max(0, Number(xpGain) || 0);
    if (!gain) return character;
    const calculated = calculateClassSessionXp(xpBreakdown);
    const entry = { id: `class_xp_${Date.now()}`, amount: gain, note: xpNote.trim() || 'Sessão', breakdown: entryMode === 'criteria' ? calculated.breakdown : {}, createdAt: new Date().toISOString() };
    return { ...character, classXp: Number(character.classXp || 0) + gain, classXpTotal: Number(character.classXpTotal || 0) + gain, classXpHistory: [entry, ...(character.classXpHistory || [])] };
  }

  function registerOnly() {
    if (Number(xpGain) > 0) onConfirm(withRegisteredXp());
  }

  function confirm() {
    if (hp === null || availableXp < xpCost || character.level >= 10) return;
    const record = {
      level: nextLevel, hpMethod: method, die: method === 'fixed' ? '' : `d${die}`,
      rollResult: method === 'fixed' ? null : parsedRoll, modifiers: method === 'fixed' ? Math.max(0, hp - Number(parsedClass.hpPerLevelBase || 0)) : Number(formulaValue || 0),
      hpAdded: hp, skillPoints: parsedClass.skillPointsPerLevel || 0, classPoints: parsedClass.classPointsPerLevel || 0,
      abilities: unlocks, proficiencies: [], xpSpent: xpCost, createdAt: new Date().toISOString(),
    };
    onConfirm({
      ...character, classXp: availableXp - xpCost, level: nextLevel,
      maxHp: character.maxHp + hp, currentHp: character.currentHp + hp,
      skillPoints: (character.skillPoints || 0) + (parsedClass.skillPointsPerLevel || 0),
      classPoints: (character.classPoints || 0) + (parsedClass.classPointsPerLevel || 0),
      levelHistory: [record, ...(character.levelHistory || [])],
    });
  }

  return <div className="modalBackdrop"><section className="modal levelModal">
    <div className="panelHeader"><div><span className="eyebrow">XP de Classe</span><h2>{mode === 'register' ? 'Registrar XP de sessão' : `Subir para nível ${nextLevel}`}</h2></div><button className="iconButton" aria-label="Fechar" title="Fechar" onClick={onCancel}><X aria-hidden="true" /></button></div>
    {mode === 'register' ? <>
      <div className="segmented" role="group" aria-label="Forma de registrar XP"><button className={entryMode === 'criteria' ? 'active' : ''} onClick={() => { setEntryMode('criteria'); setXpGain(calculateClassSessionXp(xpBreakdown).total); }}>Por critérios</button><button className={entryMode === 'manual' ? 'active' : ''} onClick={() => { setEntryMode('manual'); setXpGain(0); }}>Total manual</button></div>
      {entryMode === 'criteria' ? <ClassXpCalculator values={xpBreakdown} onChange={(values) => { const calculated = calculateClassSessionXp(values); setXpBreakdown(values); setXpGain(calculated.total); }} /> : <label>XP ganho<input type="number" min="0" value={xpGain} onChange={(event) => setXpGain(event.target.value)} /></label>}
      <label>Origem / sessão<input value={xpNote} onChange={(event) => setXpNote(event.target.value)} placeholder="Ex.: sessão de hoje" /></label>
      <div className="xpBalance"><span>Após registrar</span><strong>{availableXp} + {Math.max(0, Number(xpGain) || 0)} = {availableXp + Math.max(0, Number(xpGain) || 0)} XP</strong></div>
      {character.level < 10 && <p className="xpHint">{availableXp + Math.max(0, Number(xpGain) || 0) >= xpCost ? `XP suficiente para subir ao nível ${nextLevel}.` : `Faltarão ${xpCost - availableXp - Math.max(0, Number(xpGain) || 0)} XP para o próximo nível.`}</p>}
    </> : <>
      <div className="xpBalance"><span>Saldo de XP de classe</span><strong>{availableXp} XP</strong></div>
      <div className="methodSummary"><span>Custo do nível {nextLevel}</span><strong>{xpCost} XP · restam {Math.max(0, availableXp - xpCost)} XP</strong></div>
      <div className="methodSummary"><span>Método de vida</span><strong>{method === 'fixed' ? 'Valor fixo' : method === 'roll' ? `Rolagem d${die}` : `Híbrido + d${die}`}</strong></div>
      {method !== 'fixed' && <label>Resultado bruto do d{die}<input type="number" min="1" max={die} value={rawRoll} onChange={(event) => setRawRoll(event.target.value)} /></label>}
      <div className="summaryList"><span>Atributos do novo nível <b>aplicados antes da vida</b></span><span>Base e modificadores de vida <b>{formulaValue ?? 'indisponível'}</b></span><span>Vida adicionada <b>{hp ?? 'informe um resultado válido'}</b></span><span>Habilidades <b>{unlocks.join(', ') || 'nenhuma identificada'}</b></span></div>
    </>}
    <details className="xpHistory"><summary>Histórico de XP de Classe</summary>{!(character.classXpHistory || []).length ? <p className="muted">Nenhum XP de Classe registrado.</p> : character.classXpHistory.map((entry) => <p key={entry.id}>+{entry.amount} XP · {entry.note} · {new Date(entry.createdAt).toLocaleString('pt-BR')}</p>)}</details>
    <div className="modalActions"><button className="ghostButton" onClick={onCancel}>Cancelar</button>{mode === 'register' ? <button className="primaryButton" disabled={Number(xpGain) <= 0} onClick={registerOnly}>Registrar {Number(xpGain) || 0} XP</button> : <button className="primaryButton" disabled={availableXp < xpCost || hp === null} onClick={confirm}>Confirmar nível {nextLevel}</button>}</div>
  </section></div>;
}

function ClassXpCalculator({ values, onChange }) {
  const calculated = calculateClassSessionXp(values);
  return <details className="classXpCalculator">
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
    onConfirm({ ...baseCharacter, classXp: baseCharacter.classXp - xpCost, level: nextLevel, maxHp: character.maxHp + hp, currentHp: character.currentHp + hp, skillPoints: (character.skillPoints || 0) + (parsedClass.skillPointsPerLevel || 0), classPoints: (character.classPoints || 0) + (parsedClass.classPointsPerLevel || 0), abilities: unique([...(character.abilities || []), ...unlocks]), levelHistory: [{ ...record, xpSpent: xpCost }, ...(character.levelHistory || [])], rollHistory: roll ? [roll, ...(character.rollHistory || [])].slice(0, 30) : character.rollHistory });
  }
  return <div className="modalBackdrop"><section className="modal levelModal"><div className="panelHeader"><div><span className="eyebrow">XP de Classe</span><h2>{character.level >= 10 ? 'Progresso de Excelência' : `Nível ${character.level} → ${nextLevel}`}</h2></div><button className="iconButton" title="Fechar" onClick={onCancel}>×</button></div><div className="xpEntry"><label>XP ganho<input type="number" min="0" value={xpGain} onChange={(event) => setXpGain(event.target.value)} /></label><label>Origem / sessão<input value={xpNote} onChange={(event) => setXpNote(event.target.value)} /></label></div><div className="xpBalance"><span>{character.level >= 10 ? 'Excelência' : `Próximo nível (${xpCost} XP)`}</span><strong>{availableXp}/{xpCost} XP</strong></div>{character.level < 10 && <><div className="segmented"><button disabled={baseHealth === null || baseHealth === undefined} className={method === 'base' ? 'active' : ''} onClick={() => { setMethod('base'); setRoll(null); }}>Vida fixa</button><button disabled={!parsedClass.hitDie} className={method === 'roll' ? 'active' : ''} onClick={() => setMethod('roll')}>Rolar dado</button></div>{method === 'roll' && <button className="primaryButton" onClick={() => requestRoll({ characterId: character.id, type: 'health', name: 'Vida do novo nível', sides: parsedClass.hitDie, modifiers: formulaRollModifiers(parsedClass.hpPerLevelRollFormula, character, 'Vida por nível'), penalties: 0, origin: 'level_up' }, setRoll)}>Rolar d{parsedClass.hitDie}</button>}<div className="summaryList"><span>XP consumido <b>{xpCost}</b></span><span>Vida adicionada <b>{hp ?? 'aguardando rolagem'}</b></span><span>Pontos de habilidade <b>{parsedClass.skillPointsPerLevel ?? 'não informado'}</b></span><span>Pontos de classe <b>{parsedClass.classPointsPerLevel ?? 'não informado'}</b></span><span>Habilidades <b>{unlocks.join(', ') || 'nenhuma identificada'}</b></span></div></>}<details className="xpHistory"><summary>Histórico de XP de Classe</summary>{!(character.classXpHistory || []).length ? <p className="muted">Nenhum XP de Classe registrado.</p> : (character.classXpHistory || []).map((entry) => <p key={entry.id}>+{entry.amount} XP · {entry.note} · {new Date(entry.createdAt).toLocaleString('pt-BR')}</p>)}</details><div className="modalActions"><button className="ghostButton" onClick={onCancel}>Cancelar</button><button className="ghostButton" disabled={Number(xpGain) <= 0} onClick={registerOnly}>Apenas registrar XP</button>{character.level < 10 && <button className="primaryButton" disabled={availableXp < xpCost || hp === null || hp === undefined} onClick={confirm}>Consumir XP e subir</button>}</div></section></div>;
}

function ExportDialog({ character, onClose }) {
  function download() {
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(character.name || 'personagem').replace(/[^a-z0-9_-]+/gi, '_')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="modalBackdrop"><section className="modal exportModal" role="dialog" aria-modal="true" aria-label="Exportar ficha"><div className="panelHeader"><div><span className="eyebrow">Exportação</span><h2>Ficha em JSON</h2></div><button className="iconButton" aria-label="Fechar" title="Fechar" onClick={onClose}><X aria-hidden="true" /></button></div><pre>{JSON.stringify(character, null, 2)}</pre><div className="modalActions"><button className="ghostButton" onClick={onClose}>Cancelar</button><button className="primaryButton" onClick={download}><Download aria-hidden="true" />Baixar JSON</button></div></section></div>;
}

function inferProficiencyCategory(value) {
  const text = normalize(value);
  if (/combate|arma|armadura|ataque|escudo/.test(text)) return 'combat';
  if (/social|carisma|persuas|intimida|engan/.test(text)) return 'social';
  if (/conhecimento|relig|arcano|historia|natureza/.test(text)) return 'knowledge';
  if (/fisic|atlet|acrob|furtiv|forca|destreza/.test(text)) return 'physical';
  return 'special';
}
