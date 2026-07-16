import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import RpgImage from './RpgImage';
import { displayDescription } from '../lib/catalogEngine';

export default function CatalogView({ catalog }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [detail, setDetail] = useState(null);
  const categories = useMemo(() => [...new Set((catalog.entries || []).map((entry) => entry.category))].sort(), [catalog]);
  const entries = useMemo(() => (catalog.entries || []).filter((entry) => {
    const inCategory = category === 'all' || entry.category === category;
    const text = `${entry.name} ${entry.description} ${(entry.labels || []).map((label) => label.name).join(' ')}`.toLowerCase();
    return inCategory && text.includes(query.toLowerCase());
  }), [catalog, category, query]);
  return <section className="viewPage"><header className="viewHeader"><div><span className="eyebrow">Supabase</span><h2>Catálogo oficial</h2><p>{entries.length} de {catalog.entries?.length || 0} entradas</p></div><label className="catalogSearch">Buscar<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, bônus, requisito..." /></label></header><div className="filterRow categoryFilters"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Todos</button>{categories.map((value) => <button key={value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="catalogGrid">{entries.map((entry) => <button className="catalogCard" key={entry.id} onClick={() => setDetail(entry)}><RpgImage src={entry.imageUrl} alt={entry.name} className="catalogImage" fallback="◇" /><div><span>{entry.category}</span><strong>{entry.name}</strong><p>{displayDescription(entry) || 'Cadastro sem descrição.'}</p></div></button>)}</div>{detail && <div className="modalBackdrop"><section className="modal catalogDetail" role="dialog" aria-modal="true" aria-label={detail.name}><div className="panelHeader"><div><span className="eyebrow">{detail.category}</span><h2>{detail.name}</h2></div><button className="iconButton" aria-label="Fechar" title="Fechar" onClick={() => setDetail(null)}><X aria-hidden="true" /></button></div><RpgImage src={detail.imageUrl} alt={detail.name} className="detailImage" fallback="◇" /><div className="chipRow">{(detail.labels || []).map((label) => <span key={label.id}>{label.name || label.color}</span>)}</div><p className="preWrap">{displayDescription(detail) || 'O cadastro não possui descrição.'}</p>{detail.sourceUrl && <a href={detail.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte</a>}</section></div>}</section>;
}
