import type { SpeciesRecord, StockKind, Tank } from "./types";

interface Props {
  tanks: Tank[];
  species: SpeciesRecord[];
  onOpenTank: (tank: Tank) => void;
  onRemoveSpecies: (id: string) => void;
}

interface Holding {
  tank: Tank;
  count: number;
}

interface Row {
  key: string;
  name: string;
  kind: StockKind;
  total: number;
  holdings: Holding[];
}

const KIND_META: Record<StockKind, { icon: string; title: string; empty: string }> = {
  livestock: {
    icon: "🐟",
    title: "Livestock",
    empty: "No livestock yet — open a tank and add species.",
  },
  plant: {
    icon: "🌿",
    title: "Plants",
    empty: "No plants yet — add them from a tank's editor.",
  },
};

/**
 * Everything you own, grouped by species: total counts and which tank each
 * species lives in. Catalog species not currently in any tank appear under
 * "Previously kept" and can be removed from the running database there.
 */
export default function StockView({
  tanks,
  species,
  onOpenTank,
  onRemoveSpecies,
}: Props) {
  const keyOf = (name: string, kind: StockKind) =>
    `${kind}:${name.trim().toLowerCase()}`;

  // Group every tank's stock entries by species.
  const rows = new Map<string, Row>();
  for (const tank of tanks) {
    for (const e of tank.stock) {
      const key = keyOf(e.species, e.kind);
      let row = rows.get(key);
      if (!row) {
        row = { key, name: e.species, kind: e.kind, total: 0, holdings: [] };
        rows.set(key, row);
      }
      row.total += e.count;
      const held = row.holdings.find((h) => h.tank.id === tank.id);
      if (held) held.count += e.count;
      else row.holdings.push({ tank, count: e.count });
    }
  }

  const byKind = (kind: StockKind): Row[] =>
    [...rows.values()]
      .filter((r) => r.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name));

  const unused = species
    .filter((s) => !rows.has(keyOf(s.name, s.kind)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const nothingAnywhere = rows.size === 0 && unused.length === 0;
  if (nothingAnywhere) {
    return (
      <div className="stock-page">
        <div className="empty">
          <div className="big" aria-hidden>
            🐠
          </div>
          <h2>Nothing stocked yet</h2>
          <p>
            Open a tank and add its livestock and plants — every species you
            keep shows up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-page">
      {(["livestock", "plant"] as StockKind[]).map((kind) => {
        const list = byKind(kind);
        const meta = KIND_META[kind];
        return (
          <section key={kind}>
            <div className="section-title">
              {meta.icon} {meta.title}
            </div>
            {list.length === 0 ? (
              <p className="stock-none">{meta.empty}</p>
            ) : (
              list.map((row) => (
                <div className="species-row" key={row.key}>
                  <div className="species-head">
                    <span className="species-name">{row.name}</span>
                    <span className="species-total">×{row.total}</span>
                  </div>
                  <div className="species-tanks">
                    {row.holdings.map((h) => (
                      <button
                        key={h.tank.id}
                        className="tank-chip"
                        onClick={() => onOpenTank(h.tank)}
                      >
                        {h.tank.name}
                        {h.count > 1 && <b>×{h.count}</b>}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}

      {unused.length > 0 && (
        <section>
          <div className="section-title">Previously kept</div>
          <p className="stock-none">
            In your species database but not in any tank right now. They still
            appear as quick-add suggestions.
          </p>
          <div className="species-tanks">
            {unused.map((s) => (
              <span className="tank-chip ghost" key={s.id}>
                {s.kind === "plant" ? "🌿" : "🐟"} {s.name}
                <button
                  aria-label={`Forget ${s.name}`}
                  onClick={() => onRemoveSpecies(s.id)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
