export default function BrandMark({ compact = false }) {
  return (
    <div className={`brandBlock ${compact ? 'compactBrand' : ''}`}>
      <img className="brandLogo" src="/brand/runalith-icon-192.png" alt="" aria-hidden="true" />
      <div>
        <h1>Runalith RPG</h1>
        <span>Fichas, grimório e dados vivos</span>
      </div>
    </div>
  );
}
