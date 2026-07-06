import { useEffect, useState } from 'react';
import { createRoll, rollFormula } from '../lib/catalogEngine';
import ThreeDice from './ThreeDice';

export default function DiceModal({ request, onClose }) {
  const [pending, setPending] = useState(null);
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!request) return undefined;
    setRecord(null);
    setPending(createRoll(request));
    return undefined;
  }, [request]);

  if (!request) return null;
  return (
    <div className="modalBackdrop" role="presentation">
      <section className="modal diceModal" role="dialog" aria-modal="true" aria-label={request.name}>
        <h2>{request.name}</h2>
        {pending && <ThreeDice sides={request.sides} result={pending.rawResult} onSettled={() => setRecord(pending)} />}
        {!record ? <p className="muted">Rolando...</p> : (
          <div className="rollResult">
            <strong>Resultado final: {record.finalResult}</strong>
            <span>{record.die}: {record.rawResult} | {rollFormula(record)}</span>
            {(record.modifiers || []).map((item) => <span key={item.id}>{item.sourceName}: {Number(item.value) >= 0 ? '+' : ''}{item.value}</span>)}
          </div>
        )}
        <button className="primaryButton" disabled={!record} onClick={() => onClose(record)}>Concluir</button>
      </section>
    </div>
  );
}
