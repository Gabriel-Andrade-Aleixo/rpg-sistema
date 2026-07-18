import { useEffect, useRef, useState } from 'react';
import { Dices, RotateCcw, Trash2 } from 'lucide-react';
import { createRoll, rollFormula } from '../lib/catalogEngine';
import { diceOptions } from '../lib/rpgData';
import ThreeDice from './ThreeDice';

const storageKey = 'runalith-dice-history-v1';

export default function DiceRollerView({ queuedRoll, onComplete }) {
  const [sides, setSides] = useState(20);
  const [label, setLabel] = useState('Rolagem livre');
  const [modifier, setModifier] = useState('0');
  const [animation, setAnimation] = useState(null);
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const handledQueue = useRef('');
  const stageRef = useRef(null);
  const rolling = Boolean(animation && !record);

  useEffect(() => {
    try {
      setHistory(JSON.parse(window.localStorage.getItem(storageKey) || '[]'));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!queuedRoll?.id || handledQueue.current === queuedRoll.id) return;
    handledQueue.current = queuedRoll.id;
    startRoll(queuedRoll.request, queuedRoll.id);
  }, [queuedRoll?.id]);

  function persistHistory(values) {
    const next = values.slice(0, 30);
    setHistory(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function startRoll(source, queueId = '') {
    const next = createRoll(source);
    setRecord(null);
    setAnimation({ id: `${next.id}_${Date.now()}`, record: next, queueId });
    if (window.innerWidth <= 720) {
      window.requestAnimationFrame(() => stageRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      }));
    }
  }

  function rollManual() {
    if (rolling) return;
    const bonus = Number(modifier) || 0;
    startRoll({
      characterId: '',
      type: 'general',
      name: label.trim() || `Rolagem d${sides}`,
      sides,
      modifiers: bonus ? [{
        id: 'manual_modifier',
        sourceId: 'dice_roller',
        sourceName: 'Modificador',
        sourceType: 'manual',
        targetType: 'roll',
        targetId: 'general',
        value: bonus,
      }] : [],
      penalties: 0,
      origin: 'dice_roller',
    });
  }

  function settleRoll() {
    if (!animation?.record) return;
    const next = animation.record;
    setRecord(next);
    persistHistory([next, ...history]);
    if (animation.queueId) onComplete?.(next, animation.queueId);
  }

  function clearHistory() {
    persistHistory([]);
  }

  return (
    <section className="dicePage">
      <div className="diceHero">
        <div>
          <span className="eyebrow">Dice Roller</span>
          <h3>Mesa de rolagem</h3>
          <p>Role dados com animação 3D, aplique modificadores e mantenha as últimas 30 rolagens salvas neste navegador.</p>
        </div>
        <div className="diceHeroStats">
          <span>Último resultado</span>
          <strong>{record?.finalResult ?? '—'}</strong>
          <small>{record ? `${record.name} · ${record.die}` : 'Pronto para rolar'}</small>
        </div>
      </div>

      <div className="diceWorkbench">
        <section className="diceControlPanel">
          <div className="panelHeader">
            <div><h3>Nova rolagem</h3><span>Selecione o dado e ajuste o bônus bruto.</span></div>
          </div>
          <label>Nome da rolagem<input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          <div className="dicePicker" role="group" aria-label="Tipo de dado">
            {diceOptions.map((value) => (
              <button key={value} className={sides === value ? 'active' : ''} onClick={() => setSides(value)}>d{value}</button>
            ))}
          </div>
          <label>Modificador<input type="number" value={modifier} onChange={(event) => setModifier(event.target.value)} /></label>
          <button className="primaryButton rollCallButton" disabled={rolling} onClick={rollManual}><Dices aria-hidden="true" />{rolling ? 'Rolando...' : `Rolar d${sides}`}</button>
          {record && (
            <div className="rollResultBlock">
              <strong>{record.finalResult}</strong>
              <span>{record.die}: {record.rawResult} · {rollFormula(record)}</span>
              {(record.modifiers || []).map((item) => <small key={item.id}>{item.sourceName}: {Number(item.value) >= 0 ? '+' : ''}{item.value}</small>)}
            </div>
          )}
        </section>

        <section ref={stageRef} className="diceStagePanel">
          {animation
            ? <ThreeDice key={animation.id} sides={Number(animation.record.die.replace('d', '')) || sides} result={animation.record.rawResult} onSettled={settleRoll} />
            : <div className="diceIdle"><Dices aria-hidden="true" /><strong>d20</strong><span>Escolha um dado para começar.</span></div>}
        </section>

        <section className="diceHistoryPanel">
          <div className="panelHeader">
            <div><h3>Histórico local</h3><span>Últimas {Math.min(history.length, 30)} rolagens neste dispositivo.</span></div>
            <button className="iconButton" title="Limpar histórico" disabled={!history.length} onClick={clearHistory}><Trash2 aria-hidden="true" /></button>
          </div>
          {!history.length ? <p className="muted">Nenhuma rolagem salva ainda.</p> : (
            <div className="historyList diceHistoryList">
              {history.map((item) => (
                <article key={item.id}>
                  <strong>{item.finalResult}</strong>
                  <div>
                    <b>{item.name}</b>
                    <span>{item.die}: {item.rawResult} · {rollFormula(item)}</span>
                    <time>{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
                  </div>
                  <button title="Repetir rolagem" onClick={() => startRoll({ ...item, sides: Number(item.die.replace('d', '')) || 20 })}><RotateCcw aria-hidden="true" /></button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
