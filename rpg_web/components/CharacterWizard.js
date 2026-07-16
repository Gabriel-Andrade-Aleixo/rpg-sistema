import { useMemo, useState } from 'react';
import RpgImage from './RpgImage';
import StatBreakdown from './StatBreakdown';
import { attributes } from '../lib/rpgData';
import {
  attributeBreakdown,
  catalogGroups,
  evaluateRuleFormula,
  displayDescription,
  findEntry,
  migrateCharacter,
  parseClass,
  parseRace,
  normalize,
  recalculateCharacter,
  spentInitialAttributePoints,
  validateCharacter,
} from '../lib/catalogEngine';

const steps = ['Dados', 'Imagem', 'Raça', 'Classe', 'Atributos', 'Proficiências', 'Vida', 'Equipamentos', 'Habilidades', 'História', 'Revisão'];

export default function CharacterWizard({ initial, catalog, onSave, onCancel, requestRoll }) {
  const [draft, setDraft] = useState(() => migrateCharacter(initial, catalog));
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [initialHealthRoll, setInitialHealthRoll] = useState('');
  const groups = useMemo(() => catalogGroups(catalog), [catalog]);
  const race = findEntry(catalog, draft.raceId);
  const characterClass = findEntry(catalog, draft.classId);
  const parsedRace = race ? parseRace(race, draft.raceVariant) : null;
  const parsedClass = characterClass ? parseClass(characterClass) : null;
  const spentAttributes = spentInitialAttributePoints(draft.attributes);

  function update(changes) {
    setDraft((current) => recalculateCharacter({ ...current, ...changes }, catalog));
  }

  function updateAttribute(id, delta) {
    update({ attributes: { ...draft.attributes, [id]: Math.max(0, Number(draft.attributes?.[id] || 0) + delta) } });
  }

  function selectHealthMethod(method) {
    setInitialHealthRoll('');
    update({ hpProgressionMode: method, maxHp: 0, currentHp: 0, levelHistory: (draft.levelHistory || []).filter((item) => item.level !== 1) });
  }

  function defineHealth() {
    if (!parsedClass) return;
    const method = draft.hpProgressionMode;
    const initial = evaluateRuleFormula(parsedClass.initialHpFormula, draft) ?? parsedClass.baseHp;
    const formula = method === 'hybrid' ? parsedClass.hpPerLevelHybridFormula : method === 'roll' ? parsedClass.hpPerLevelRollFormula : parsedClass.hpPerLevelBaseFormula;
    const progression = evaluateRuleFormula(formula, draft);
    const die = method === 'hybrid' ? parsedClass.hybridDie : parsedClass.hitDie;
    const rawRoll = Number(initialHealthRoll);
    const needsRoll = method !== 'fixed';
    if (initial === null || initial === undefined || progression === null || progression === undefined) return;
    if (needsRoll && (initialHealthRoll === '' || rawRoll < 1 || rawRoll > Number(die || 0))) return;
    const value = Number(initial) + Number(progression) + (needsRoll ? rawRoll : 0);
    const record = { level: 1, hpMethod: method, die: needsRoll ? `d${die}` : '', rollResult: needsRoll ? rawRoll : null, modifiers: Number(initial) + Number(progression), hpAdded: value, skillPoints: 0, classPoints: 0, abilities: [], proficiencies: [], createdAt: new Date().toISOString() };
    update({ maxHp: value, currentHp: value, levelHistory: [record, ...(draft.levelHistory || []).filter((item) => item.level !== 1)] });
  }

  function toggleItem(entry, target, selected) {
    const other = target === 'equipment' ? 'inventory' : 'equipment';
    const current = (draft[target] || []).filter((item) => item.catalogId !== entry.id);
    const otherItems = (draft[other] || []).filter((item) => item.catalogId !== entry.id);
    if (selected) current.push({ id: `item_${Date.now()}_${entry.id}`, catalogId: entry.id, name: entry.name, type: entry.category, quantity: 1, weight: 0, bonus: '', description: '', notes: '', imageUrl: entry.imageUrl || '', requirements: '' });
    update({ [target]: current, [other]: otherItems });
  }

  function submit() {
    const next = recalculateCharacter(draft, catalog);
    const validation = validateCharacter(next, catalog);
    if (!validation.isValid) { setStep(10); return; }
    onSave(next);
  }

  const validation = validateCharacter(draft, catalog);
  return (
    <div className="wizardLayout">
      <nav className="wizardSteps" aria-label="Etapas da ficha">
        {steps.map((label, index) => <button key={label} className={step === index ? 'active' : ''} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      <section className="wizardContent panel">
        <div className="panelHeader"><div><span className="eyebrow">Etapa {step + 1} de {steps.length}</span><h2>{steps[step]}</h2></div><button className="ghostButton" onClick={onCancel}>Cancelar</button></div>

        {step === 0 && <div className="formGrid">
          <label>Nome do personagem<input value={draft.name} onChange={(e) => update({ name: e.target.value })} /></label>
          <label>Nome do jogador<input value={draft.playerName} onChange={(e) => update({ playerName: e.target.value })} /></label>
          <label>Antecedente / origem<input value={draft.background || ''} onChange={(e) => update({ background: e.target.value })} /></label>
        </div>}

        {step === 1 && <div className="imageStep">
          <RpgImage src={draft.imageUrl} alt={draft.name} className="avatarPreview" fallback="◇" />
          <label>URL do avatar<input type="url" value={draft.imageUrl || ''} onChange={(e) => update({ imageUrl: e.target.value })} placeholder="https://..." /></label>
          <p className="muted">Se a imagem falhar ou estiver vazia, o fallback padrão será exibido.</p>
        </div>}

        {step === 2 && <OfficialSelection entries={groups.playableRaces} selectedId={draft.raceId} onSelect={(id) => update({ raceId: id, raceVariant: '' })} empty="Nenhuma raça com regras completas foi encontrada no catálogo oficial." />}
        {step === 2 && parsedRace && <><VariantSelection variants={parsedRace.variants} selected={draft.raceVariant} onSelect={(raceVariant) => update({ raceVariant })} /><RuleSummary entry={race} chips={parsedRace.modifiers.map((item) => `${item.targetId}: ${Number(item.value) >= 0 ? '+' : ''}${item.value}`)} lines={[...parsedRace.proficiencies, ...parsedRace.abilities, ...parsedRace.traits]} /></>}

        {step === 3 && <OfficialSelection entries={groups.playableClasses} selectedId={draft.classId} onSelect={(id) => update(id === draft.classId ? {} : { classId: id, maxHp: 0, currentHp: 0, levelHistory: [] })} empty="Nenhuma classe com regras completas foi encontrada no catálogo oficial." />}
        {step === 3 && parsedClass && <RuleSummary entry={characterClass} chips={[
          parsedClass.hitDie ? `Dado d${parsedClass.hitDie}` : 'Dado de vida não informado',
          parsedClass.initialHpFormula?.label || (parsedClass.baseHp !== null ? `Vida inicial ${parsedClass.baseHp}` : 'Vida inicial não informada'),
          parsedClass.skillPointsPerLevel !== null ? `${parsedClass.skillPointsPerLevel} pontos de habilidade/nível` : 'Pontos de habilidade não informados',
          parsedClass.classPointsPerLevel !== null ? `${parsedClass.classPointsPerLevel} pontos de classe/nível` : 'Pontos de classe não informados',
        ]} lines={parsedClass.resources} />}

        {step === 4 && <div><div className="pointsBanner"><span>Pontos distribuídos</span><strong>{spentAttributes}/10</strong></div><div className="breakdownGrid">
          {attributes.map(([id, name]) => <div className="attributeEditor" key={id}>
            <StatBreakdown label={name} breakdown={attributeBreakdown(draft, id)} />
            <div className="stepperRow"><button disabled={!draft.attributes?.[id]} onClick={() => updateAttribute(id, -1)}>−</button><strong>{draft.attributes?.[id] || 0}</strong><button disabled={spentAttributes >= 10 || Number(draft.attributes?.[id] || 0) >= 20} onClick={() => updateAttribute(id, 1)}>+</button></div>
          </div>)}
        </div></div>}

        {step === 5 && <ProficiencySelection skills={groups.skills} automatic={[...(parsedRace?.proficiencies || []), ...(parsedClass?.proficiencies || [])]} selected={draft.manualProficiencies || []} onChange={(manualProficiencies) => update({ manualProficiencies })} />}

        {step === 6 && <div className="healthChoice">
          <div className="resourceHeadline"><strong>HP inicial calculado</strong><span>{parsedClass ? evaluateRuleFormula(parsedClass.initialHpFormula, draft) ?? parsedClass.baseHp ?? 'indisponível' : 'indisponível'}</span></div>
          <p className="muted">A vida do nível 1 já inclui o ganho do método escolhido. Rolagem e híbrido exigem o resultado bruto do dado agora e a cada novo nível.</p>
          <div className="segmented healthMethods">
            <button className={draft.hpProgressionMode === 'fixed' ? 'active' : ''} disabled={!parsedClass?.hpPerLevelBaseFormula} onClick={() => selectHealthMethod('fixed')}>Valor fixo</button>
            <button className={draft.hpProgressionMode === 'roll' ? 'active' : ''} disabled={!parsedClass?.hpPerLevelRollFormula} onClick={() => selectHealthMethod('roll')}>Rolagem d{parsedClass?.hitDie || '?'}</button>
            <button className={draft.hpProgressionMode === 'hybrid' ? 'active' : ''} disabled={!parsedClass?.hpPerLevelHybridFormula} onClick={() => selectHealthMethod('hybrid')}>Híbrido d{parsedClass?.hybridDie || '?'}</button>
          </div>
          {draft.hpProgressionMode !== 'fixed' && <label>Resultado bruto do d{draft.hpProgressionMode === 'hybrid' ? parsedClass?.hybridDie : parsedClass?.hitDie}<input aria-label="Resultado do dado de vida no nível 1" type="number" min="1" max={draft.hpProgressionMode === 'hybrid' ? parsedClass?.hybridDie : parsedClass?.hitDie} value={initialHealthRoll} onChange={(event) => setInitialHealthRoll(event.target.value)} /></label>}
          <button className="primaryButton" disabled={!parsedClass || (draft.hpProgressionMode !== 'fixed' && !initialHealthRoll)} onClick={defineHealth}>Confirmar e calcular vida do nível 1</button>
          <div className="resourceHeadline"><strong>Vida registrada</strong><span>{draft.currentHp}/{draft.maxHp}</span></div>
          {!parsedClass && <Notice text="Selecione uma classe antes de definir a vida." />}
          {parsedClass && !parsedClass.hitDie && !parsedClass.initialHpFormula && parsedClass.baseHp === null && <Notice text="A classe não possui vida inicial reconhecível. Ajuste o cadastro oficial." />}
        </div>}

        {step === 7 && <div>
          <label className="searchField">Buscar item oficial<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, tipo ou descrição" /></label>
          <div className="catalogChoiceGrid">{groups.items.filter((entry) => `${entry.name} ${entry.category} ${entry.description}`.toLowerCase().includes(query.toLowerCase())).map((entry) => {
            const equipped = (draft.equipment || []).some((item) => item.catalogId === entry.id);
            const stored = (draft.inventory || []).some((item) => item.catalogId === entry.id);
            return <article className="catalogChoice" key={entry.id}><RpgImage src={entry.imageUrl} alt={entry.name} className="catalogThumb" fallback="□" /><div><strong>{entry.name}</strong><span>{entry.category}</span></div><div className="choiceActions"><button className={equipped ? 'selectedAction' : 'ghostButton'} onClick={() => toggleItem(entry, 'equipment', !equipped)}>{equipped ? 'Equipado' : 'Equipar'}</button><button className={stored ? 'selectedAction' : 'ghostButton'} onClick={() => toggleItem(entry, 'inventory', !stored)}>{stored ? 'No inventário' : 'Guardar'}</button></div></article>;
          })}</div>
        </div>}

        {step === 8 && <SimpleRules values={draft.abilities} empty="Nenhuma habilidade inicial foi identificada no catálogo." icon="✦" />}

        {step === 9 && <div className="storyFields"><label>História<textarea rows="8" value={draft.lore || ''} onChange={(e) => update({ lore: e.target.value })} /></label><label>Anotações<textarea rows="5" value={(draft.notes || []).join('\n')} onChange={(e) => update({ notes: e.target.value.split('\n').filter(Boolean) })} /></label></div>}

        {step === 10 && <div className="reviewGrid">
          <RpgImage src={draft.imageUrl} alt={draft.name} className="reviewAvatar" fallback="◇" />
          <div><h3>{draft.name || 'Personagem sem nome'}</h3><p>{race?.name || 'Raça não selecionada'} · {characterClass?.name || 'Classe não selecionada'} · Nível {draft.level}</p><p>Vida {draft.currentHp}/{draft.maxHp} · {draft.equipment.length} equipamentos · {draft.abilities.length} habilidades</p></div>
          <ValidationMessages validation={validation} />
        </div>}

        <footer className="wizardFooter"><button className="ghostButton" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Voltar</button>{step < 10 ? <button className="primaryButton" onClick={() => setStep((value) => value + 1)}>Continuar</button> : <button className="primaryButton" disabled={!validation.isValid} onClick={submit}>Salvar ficha</button>}</footer>
      </section>
    </div>
  );
}

function OfficialSelection({ entries, selectedId, onSelect, empty }) {
  if (!entries.length) return <Notice text={empty} />;
  return <div className="officialGrid">{entries.map((entry) => <button key={entry.id} className={`officialOption ${selectedId === entry.id ? 'active' : ''}`} onClick={() => onSelect(entry.id)}><RpgImage src={entry.imageUrl} alt={entry.name} className="optionImage" fallback="◇" /><strong>{entry.name}</strong><span>{entry.labels?.map((label) => label.name).filter(Boolean).join(' · ') || entry.category}</span></button>)}</div>;
}

function VariantSelection({ variants, selected, onSelect }) {
  if (!variants?.length) return null;
  return <div className="variantSelection"><span>Variante</span><div className="segmented">{variants.map((variant) => <button key={variant.id} className={selected === variant.id ? 'active' : ''} onClick={() => onSelect(variant.id)}>{variant.name}</button>)}</div>{!selected && <p className="validationWarning">Selecione uma variante para aplicar os bônus específicos.</p>}</div>;
}

function RuleSummary({ entry, chips, lines }) {
  return <div className="ruleSummary"><div className="chipRow">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>{lines.map((line) => <p key={line}>{line}</p>)}<details><summary>Descrição completa</summary><p className="preWrap">{displayDescription(entry) || 'Cadastro sem descrição.'}</p></details></div>;
}

function SimpleRules({ values, empty, icon }) {
  if (!values.length) return <Notice text={empty} />;
  return <div className="ruleList">{values.map((value) => <div key={value}><span>{icon}</span><p>{value}</p></div>)}</div>;
}

function ProficiencySelection({ skills, automatic, selected, onChange }) {
  if (!skills.length) return <Notice text="Nenhuma perícia oficial foi encontrada no catálogo." />;
  const isAutomatic = (name) => automatic.some((item) => normalize(item) === normalize(name));
  const isSelected = (name) => selected.some((item) => normalize(item) === normalize(name));
  return <div><p className="muted">Uma perícia proficiente adiciona novamente seu valor bruto à rolagem.</p><div className="proficiencyChoiceGrid">{skills.map((skill) => { const automaticValue = isAutomatic(skill.name), checked = automaticValue || isSelected(skill.name); return <label className="proficiencyChoice" key={skill.id}><input type="checkbox" checked={checked} disabled={automaticValue} onChange={(event) => { const next = selected.filter((item) => normalize(item) !== normalize(skill.name)); if (event.target.checked) next.push(skill.name); onChange(next); }} /><span><strong>{skill.name}</strong><small>{automaticValue ? 'Raça ou classe' : 'Escolhida'}</small></span></label>; })}</div></div>;
}

function ValidationMessages({ validation }) {
  return <div className="validationList">{validation.errors.map((item) => <p className="validationError" key={item}>Erro: {item}</p>)}{validation.warnings.map((item) => <p className="validationWarning" key={item}>Aviso: {item}</p>)}{validation.suggestions.map((item) => <p key={item}>Sugestão: {item}</p>)}</div>;
}

function Notice({ text }) { return <div className="notice"><span>i</span><p>{text}</p></div>; }
