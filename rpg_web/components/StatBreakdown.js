import { Dices } from 'lucide-react';

export default function StatBreakdown({ label, breakdown, onRoll }) {
  const format = (value) => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return (
    <details className="breakdown">
      <summary>
        <span className="breakdownLabel"><b>{label}</b><small>{breakdown.base} pontos investidos</small></span>
        <strong title="Valor atual">{breakdown.total}</strong>
        {onRoll && <button type="button" className="iconButton" aria-label={`Rolar ${label}`} title={`Rolar ${label}`} onClick={(event) => { event.preventDefault(); onRoll(); }}><Dices aria-hidden="true" /></button>}
      </summary>
      <div className="breakdownRows">
        <span>Pontos investidos <b>{breakdown.base}</b></span>
        {breakdown.modifiers.map((item) => <span key={item.id}>{item.sourceName} <b>{Number(item.value) >= 0 ? '+' : ''}{format(item.value)}</b></span>)}
        {breakdown.rawTotal !== breakdown.total && <span>Antes de arredondar <b>{format(breakdown.rawTotal)}</b></span>}
        <span className="breakdownTotal">Valor atual <b>{breakdown.total}</b></span>
      </div>
    </details>
  );
}
