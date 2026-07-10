import { useState } from "react";
import type { SpeciesRecord, StockEntry, StockKind } from "./types";
import { uid } from "./status";
import { useDialog } from "./Dialog";

interface Props {
  title: string;
  kind: StockKind;
  /** The tank's full stock array — this editor manages its `kind` subset. */
  stock: StockEntry[];
  /** Running species catalog, for quick-add suggestions. */
  species: SpeciesRecord[];
  onChange: (stock: StockEntry[]) => void;
}

const MAX_SUGGESTIONS = 6;

/**
 * Structured species editor: a list of name × count rows plus an add box
 * with suggestions drawn from the running species catalog.
 */
export default function StockEditor({
  title,
  kind,
  stock,
  species,
  onChange,
}: Props) {
  const [text, setText] = useState("");
  const dialog = useDialog();

  const mine = stock.filter((e) => e.kind === kind);
  const lower = (s: string) => s.trim().toLowerCase();
  const inTank = new Set(mine.map((e) => lower(e.species)));

  // Catalog matches: same kind, not already in the tank, name matches the
  // query (or everything, when the box is empty), prefix matches first.
  const q = lower(text);
  const suggestions = species
    .filter((s) => s.kind === kind && !inTank.has(lower(s.name)))
    .filter((s) => q === "" || lower(s.name).includes(q))
    .sort((a, b) => {
      const ap = lower(a.name).startsWith(q) ? 0 : 1;
      const bp = lower(b.name).startsWith(q) ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name);
    })
    .slice(0, MAX_SUGGESTIONS);

  function add(name: string) {
    const clean = name.trim();
    if (!clean) return;
    const existing = mine.find((e) => lower(e.species) === lower(clean));
    if (existing) {
      // Already stocked — bump the count instead of duplicating.
      setCount(existing.id, existing.count + 1);
    } else {
      onChange([...stock, { id: uid(), species: clean, kind, count: 1 }]);
    }
    setText("");
  }

  function remove(id: string) {
    onChange(stock.filter((e) => e.id !== id));
  }

  function setCount(id: string, count: number) {
    onChange(
      stock.map((e) =>
        e.id === id ? { ...e, count: Math.max(1, Math.round(count)) } : e
      )
    );
  }

  async function editCount(e: StockEntry) {
    const n = await dialog.promptNumber({
      title: `How many ${e.species}?`,
      label: "Count",
      initial: e.count,
      confirmLabel: "Set",
      min: 1,
      max: 9999,
    });
    if (n != null) setCount(e.id, n);
  }

  return (
    <div className="field">
      <label>{title}</label>

      {mine.length > 0 && (
        <div className="stock-list">
          {mine.map((e) => (
            <div className="stock-row" key={e.id}>
              <span className="stock-name">{e.species}</span>
              <div className="stock-count">
                <button
                  aria-label={`One less ${e.species}`}
                  onClick={() => setCount(e.id, e.count - 1)}
                  disabled={e.count <= 1}
                >
                  −
                </button>
                <button
                  className="n"
                  aria-label={`Set count for ${e.species}`}
                  onClick={() => void editCount(e)}
                >
                  {e.count}
                </button>
                <button
                  aria-label={`One more ${e.species}`}
                  onClick={() => setCount(e.id, e.count + 1)}
                >
                  +
                </button>
              </div>
              <button
                className="stock-del"
                aria-label={`Remove ${e.species}`}
                onClick={() => remove(e.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="stock-add">
        <input
          value={text}
          placeholder={
            kind === "plant" ? "Add a plant…" : "Add a species…"
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(text);
          }}
        />
        <button
          className="stock-add-btn"
          disabled={!text.trim()}
          onClick={() => add(text)}
        >
          Add
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="stock-suggest">
          {suggestions.map((s) => (
            <button key={s.id} onClick={() => add(s.name)}>
              + {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
