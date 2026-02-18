"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Lang, Mode, Settings } from "@/lib/types";
import type { PantryRow } from "@/components/appShellStyles";
import { ChevronDown, ChevronUp, LogIn, LogOut, Plus, Users, X } from "lucide-react";

type Props = {
  session: any;
  status: "authenticated" | "loading" | "unauthenticated";
  pantry: PantryRow[] | null;
  setPantry: React.Dispatch<React.SetStateAction<PantryRow[] | null>>;
  pantryNewName: string;
  setPantryNewName: (v: string) => void;
  savePantryItem: (p: { nameKey: string; qty?: number | null; unit?: string | null; alwaysHave?: boolean }) => Promise<void>;
  deletePantryItem: (nameKey: string) => Promise<void>;
  settings: Settings;
  toggleLang: (lang: Lang) => void;
  setMode: (m: Mode) => void;
  updateNumber: (key: "maxTimeMin" | "noRepeatDays", value: number) => void;
  updateCost: (value: 1 | 2 | 3) => void;
  toggleDouble: (val: boolean) => void;
  t: Record<string, string>;
};

export function ProfileTab({
  session, status,
  pantry, setPantry, pantryNewName, setPantryNewName,
  savePantryItem, deletePantryItem,
  settings, toggleLang, setMode, updateNumber, updateCost, toggleDouble,
  t,
}: Props) {
  const router = useRouter();
  const [pantryOpen, setPantryOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isLoggedIn = status === "authenticated";

  return (
    <div className="w-full max-w-[900px] grid gap-4">
      {/* User info card */}
      <section className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="w-12 h-12 rounded-xl object-cover border border-warm-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 font-extrabold text-lg">
                {(session?.user?.name || session?.user?.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-warm-900 truncate">
                {session?.user?.name || "Usuario"}
              </div>
              <div className="text-warm-500 text-sm truncate">
                {session?.user?.email}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-warm-500 text-sm mb-3">Modo invitado. Los datos se guardan solo en este dispositivo.</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
              onClick={() => router.push("/auth?mode=login")}
            >
              <LogIn size={16} /> Login
            </button>
          </div>
        )}

        {isLoggedIn && (
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-200 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[44px]"
              onClick={() => router.push("/account")}
            >
              <Users size={14} /> Mi hogar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-200 bg-white text-warm-700 font-bold text-sm hover:border-red-300 hover:text-red-600 cursor-pointer min-h-[44px]"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut size={14} /> Salir
            </button>
          </div>
        )}
      </section>

      {/* Pantry section (collapsible, default expanded) */}
      <section className="bg-white border border-warm-200 rounded-2xl shadow-card overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 cursor-pointer bg-transparent border-0 text-left"
          onClick={() => setPantryOpen(!pantryOpen)}
        >
          <h2 className="text-lg font-extrabold text-warm-900">{t.pantry}</h2>
          {pantryOpen ? <ChevronUp size={20} className="text-warm-400" /> : <ChevronDown size={20} className="text-warm-400" />}
        </button>

        {pantryOpen && (
          <div className="px-4 pb-4">
            <p className="text-warm-400 text-sm mb-3">{t.pantryHelp}</p>

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
                <Plus size={16} /> {t.addPantry ? "Añadir" : "Añadir"}
              </button>
            </div>

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
          </div>
        )}
      </section>

      {/* Settings section (collapsible, default collapsed) */}
      <section className="bg-white border border-warm-200 rounded-2xl shadow-card overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 cursor-pointer bg-transparent border-0 text-left"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <h2 className="text-lg font-extrabold text-warm-900">{t.settings}</h2>
          {settingsOpen ? <ChevronUp size={20} className="text-warm-400" /> : <ChevronDown size={20} className="text-warm-400" />}
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4">
            <div className="grid gap-0 divide-y divide-warm-100">
              {/* Lang */}
              <div className="flex items-center justify-between gap-3 py-4">
                <div className="font-semibold text-warm-700">{t.lang}</div>
                <div className="flex gap-2">
                  <button
                    className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer min-h-[44px] ${
                      settings.lang === "es"
                        ? "bg-primary-600 text-white border-0"
                        : "border border-warm-200 bg-white text-warm-600"
                    }`}
                    onClick={() => toggleLang("es")}
                  >ES</button>
                  <button
                    className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer min-h-[44px] ${
                      settings.lang === "ca"
                        ? "bg-primary-600 text-white border-0"
                        : "border border-warm-200 bg-white text-warm-600"
                    }`}
                    onClick={() => toggleLang("ca")}
                  >CAT</button>
                </div>
              </div>

              {/* Mode */}
              <div className="flex items-center justify-between gap-3 py-4">
                <div className="font-semibold text-warm-700">{t.mode}</div>
                <div className="flex gap-2">
                  {(["lazy", "normal", "chef"] as const).map((m) => (
                    <button
                      key={m}
                      className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer min-h-[44px] capitalize ${
                        settings.mode === m
                          ? "bg-primary-600 text-white border-0"
                          : "border border-warm-200 bg-white text-warm-600"
                      }`}
                      onClick={() => setMode(m)}
                    >
                      {m === "lazy" ? "Vago" : m === "normal" ? "Normal" : "Chef"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Double */}
              <div className="flex items-center justify-between gap-3 py-4">
                <div className="font-semibold text-warm-700">{t.double}</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={settings.doublePortions} onChange={(e) => toggleDouble(e.target.checked)} />
                  <span className="text-warm-500 text-sm font-semibold">{settings.doublePortions ? "ON" : "OFF"}</span>
                </label>
              </div>

              {/* Max time */}
              <div className="flex items-center justify-between gap-3 py-4">
                <div className="font-semibold text-warm-700">{t.maxTime}</div>
                <input
                  type="number"
                  value={settings.maxTimeMin}
                  min={10}
                  max={90}
                  className="w-24 px-3 py-2 rounded-xl border border-warm-200 bg-warm-50 text-sm outline-none focus:border-primary-400"
                  onChange={(e) => updateNumber("maxTimeMin", Number(e.target.value))}
                />
              </div>

              {/* Max cost */}
              <div className="flex items-center justify-between gap-3 py-4">
                <div className="font-semibold text-warm-700">{t.maxCost}</div>
                <select
                  value={settings.maxCostTier}
                  onChange={(e) => updateCost(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-24 px-3 py-2 rounded-xl border border-warm-200 bg-warm-50 text-sm outline-none focus:border-primary-400"
                >
                  <option value={1}>&euro;</option>
                  <option value={2}>&euro;&euro;</option>
                  <option value={3}>&euro;&euro;&euro;</option>
                </select>
              </div>

              {/* No repeat */}
              <div className="flex items-center justify-between gap-3 py-4">
                <div className="font-semibold text-warm-700">{t.noRepeat}</div>
                <input
                  type="number"
                  value={settings.noRepeatDays}
                  min={3}
                  max={30}
                  className="w-24 px-3 py-2 rounded-xl border border-warm-200 bg-warm-50 text-sm outline-none focus:border-primary-400"
                  onChange={(e) => updateNumber("noRepeatDays", Number(e.target.value))}
                />
              </div>
            </div>

            <p className="text-warm-400 text-sm mt-4">
              Para instalar en iPhone: abrir en Safari &rarr; Compartir &rarr; &quot;Añadir a pantalla de inicio&quot;.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
