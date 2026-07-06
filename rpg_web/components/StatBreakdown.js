import { Dices } from 'lucide-react';

export default function StatBreakdown({ label, breakdown, onRoll }) {
  return (
    <details className="breakdown">
      <summary>
        <span>{label}</span>
        <strong>{breakdown.total}</strong>
        {onRoll && <button type="button" className="iconButton" aria-label={`Rolar ${label}`} title={`Rolar ${label}`} onClick={(event) => { event.preventDefault(); onRoll(); }}><Dices aria-hidden="true" /></button>}
      </summary>
      <div className="breakdownRows">
        <span>Base <b>{breakdown.base}</b></span>
        {breakdown.modifiers.map((item) => <span key={item.id}>{item.sourceName} <b>{Number(item.value) >= 0 ? '+' : ''}{item.value}</b></span>)}
        <span className="breakdownTotal">Total <b>{breakdown.total}</b></span>
      </div>
    </details>
  );
}
