import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Promise-based, in-app replacements for window.confirm / window.prompt.
// Native dialogs render as "localhost says…" chrome in an installed PWA and
// break the full-screen feel; these match the app's sheet/scrim styling.

interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptNumberOpts {
  title: string;
  message?: string;
  label?: string;
  initial?: number;
  placeholder?: string;
  confirmLabel?: string;
  min?: number;
  max?: number;
  unit?: string;
}

interface DialogApi {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  promptNumber: (opts: PromptNumberOpts) => Promise<number | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

type Active =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | {
      kind: "prompt";
      opts: PromptNumberOpts;
      resolve: (v: number | null) => void;
    };

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) =>
        setActive({ kind: "confirm", opts, resolve })
      ),
    []
  );

  const promptNumber = useCallback(
    (opts: PromptNumberOpts) =>
      new Promise<number | null>((resolve) => {
        setValue(opts.initial != null ? String(opts.initial) : "");
        setActive({ kind: "prompt", opts, resolve });
      }),
    []
  );

  const api = useMemo<DialogApi>(() => ({ confirm, promptNumber }), [
    confirm,
    promptNumber,
  ]);

  function close(result: boolean | number | null) {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(result as boolean);
    else active.resolve(result as number | null);
    setActive(null);
  }

  function submitPrompt() {
    if (!active || active.kind !== "prompt") return;
    const { min = -Infinity, max = Infinity } = active.opts;
    const n = parseFloat(value);
    if (Number.isNaN(n)) return close(null);
    close(Math.max(min, Math.min(max, n)));
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      {active && (
        <>
          <div className="scrim dialog-scrim" onClick={() => close(falseFor(active))} />
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={active.opts.title}
          >
            <div className="dialog-title">{active.opts.title}</div>
            {active.opts.message && (
              <div className="dialog-msg">{active.opts.message}</div>
            )}

            {active.kind === "prompt" && (
              <div className="field dialog-field">
                {active.opts.label && <label>{active.opts.label}</label>}
                <div className="dialog-input-row">
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    value={value}
                    placeholder={active.opts.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitPrompt();
                    }}
                  />
                  {active.opts.unit && (
                    <span className="dialog-unit">{active.opts.unit}</span>
                  )}
                </div>
              </div>
            )}

            <div className="dialog-actions">
              <button className="dialog-cancel" onClick={() => close(falseFor(active))}>
                {active.kind === "confirm"
                  ? active.opts.cancelLabel ?? "Cancel"
                  : "Cancel"}
              </button>
              <button
                className={
                  "dialog-confirm" +
                  (active.kind === "confirm" && active.opts.danger ? " danger" : "")
                }
                onClick={() =>
                  active.kind === "confirm" ? close(true) : submitPrompt()
                }
              >
                {active.kind === "confirm"
                  ? active.opts.confirmLabel ?? "OK"
                  : active.opts.confirmLabel ?? "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </DialogContext.Provider>
  );
}

/** The "dismiss" result for the active dialog (false for confirm, null for prompt). */
function falseFor(active: Active): boolean | number | null {
  return active.kind === "confirm" ? false : null;
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
