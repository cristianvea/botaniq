import { NavBar, Icon, StatusPill } from '../components/ui.jsx';

export default function PlantsPage({ plants, zones, statuses, photos, loading }) {
  const groups = [
    ...zones.map((z) => ({ key: z.id, title: z.name, items: plants.filter((p) => p.zone_id === z.id) })),
    { key: 'none', title: 'Sin zona', items: plants.filter((p) => !zones.some((z) => z.id === p.zone_id)) },
  ].filter((g) => g.items.length);

  return (
    <div className="screen with-tabs">
      <NavBar
        title="Plantas" large
        sub={plants.length ? `${plants.length} ${plants.length === 1 ? 'planta' : 'plantas'} en ${zones.length || 1} ${zones.length === 1 ? 'zona' : 'zonas'}` : null}
        right={<a className="icon-circle" href="#/new" aria-label="Añadir planta"><Icon name="plus" size={20} stroke={2.4} /></a>}
      />

      {plants.length === 0 && !loading && (
        <div className="empty-state">
          <div className="glyph"><Icon name="leaf" size={42} /></div>
          <h2 className="t-title2">Sin plantas todavía</h2>
          <p className="t-sub c2">Tus plantas aparecerán aquí, ordenadas por zonas.</p>
          <a className="btn" href="#/new"><Icon name="camera" size={20} /> Añadir planta</a>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="section">
          <div className="section-header big">
            <span>{g.title}</span>
            <span className="t-sub c2" style={{ fontWeight: 400 }}>{g.items.length}</span>
          </div>
          <div className="grid">
            {g.items.map((p) => (
              <a key={p.id} className="tile" href={`#/plant/${p.id}`}>
                {photos[p.photo_path] ? <img src={photos[p.photo_path]} alt="" loading="lazy" /> : <div className="tile-empty"><Icon name="sprout" size={48} /></div>}
                <div className="tile-status"><StatusPill status={statuses[p.id]} /></div>
                <div className="tile-info">
                  <b>{p.name}</b>
                  <span>{p.common_name || p.species || ' '}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
