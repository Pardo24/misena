"use client";

import type { PantryRow } from "@/components/appShellStyles";
import { Plus, X } from "lucide-react";

type Props = {
  pantry: PantryRow[] | null;
  setPantry: React.Dispatch<React.SetStateAction<PantryRow[] | null>>;
  pantryNewName: string;
  setPantryNewName: (v: string) => void;
  savePantryItem: (p: { nameKey: string; qty?: number | null; unit?: string | null; alwaysHave?: boolean }) => Promise<void>;
  deletePantryItem: (nameKey: string) => Promise<void>;
  t: Record<string, string>;
};

export function PantryTab({
  pantry, setPantry, pantryNewName, setPantryNewName,
  savePantryItem, deletePantryItem, t,
}: Props) {
  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
      <h2 className="text-xl font-extrabold text-warm-900 mb-1">{t.pantry}</h2>
      <p className="text-warm-400 text-sm mb-3">Tu inventario (compartido en household).</p>

      {/* Quick add */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <input
          className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="arroz, aceite, sal…"
          value={pantryNewName}
          onChange={(e) => setPantryNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const key = pantryNewName.trim().toLowerCase();
              if (!key) return;
              setPantryNewName("");
              savePantryItem({ nameKey: key, qty: null, unit: null, alwaysHave: false });
            }
          }}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
          onClick={async () => {
            const key = pantryNewName.trim().toLowerCase();
            if (!key) return;
            setPantryNewName("");
            await savePantryItem({ nameKey: key, qty: null, unit: null, alwaysHave: false });
          }}
        >
          <Plus size={16} /> Añadir
        </button>
      </div>

      <hr className="border-0 border-t border-warm-200 mb-4" />

      {!pantry ? (
        <div className="text-warm-400 text-sm animate-pulse">Cargando…</div>
      ) : pantry.length === 0 ? (
        <div className="text-warm-400 text-sm py-4 text-center">Aún no hay nada en tu despensa.</div>
      ) : (
        <div className="grid gap-3">
          {pantry.map((it) => (
            <div key={it.id} className="border border-warm-200 rounded-2xl p-3 bg-warm-50">
              <div className="flex justify-between gap-2 items-center">
                <div className="font-black capitalize text-warm-800">{it.nameKey}</div>
                <button
                  type="button"
                  className="w-8 h-8 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-400 hover:text-red-500 hover:border-red-300"
                  onClick={() => deletePantryItem(it.nameKey)}
                  title="Eliminar"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex gap-2 items-center mt-2.5 flex-wrap">
                <input
                  className="w-24 px-3 py-2 rounded-xl border border-warm-200 bg-white text-sm outline-none focus:border-primary-400"
                  inputMode="decimal"
                  placeholder="qty"
                  value={it.qty ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPantry((prev) =>
                      prev ? prev.map((x) => (x.id === it.id ? { ...x, qty: v === "" ? null : Number(v) } : x)) : prev
                    );
                  }}
                  onBlur={async () => {
                    const row = pantry.find((x) => x.id === it.id);
                    if (!row) return;
                    await savePantryItem({ nameKey: row.nameKey, qty: row.qty, unit: row.unit, alwaysHave: row.alwaysHave });
                  }}
                />
                <input
                  className="w-24 px-3 py-2 rounded-xl border border-warm-200 bg-white text-sm outline-none focus:border-primary-400"
                  placeholder="unit (g/ml/u)"
                  value={it.unit ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPantry((prev) =>
                      prev ? prev.map((x) => (x.id === it.id ? { ...x, unit: v === "" ? null : v } : x)) : prev
                    );
                  }}
                  onBlur={async () => {
                    const row = pantry.find((x) => x.id === it.id);
                    if (!row) return;
                    await savePantryItem({ nameKey: row.nameKey, qty: row.qty, unit: row.unit, alwaysHave: row.alwaysHave });
                  }}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={it.alwaysHave}
                    onChange={async () => {
                      const next = !it.alwaysHave;
                      setPantry((prev) => (prev ? prev.map((x) => (x.id === it.id ? { ...x, alwaysHave: next } : x)) : prev));
                      await savePantryItem({ nameKey: it.nameKey, qty: it.qty, unit: it.unit, alwaysHave: next });
                    }}
                  />
                  <span className="text-warm-500 text-sm">Básico</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
