"use client";

import type { Lang, Mode, Settings } from "@/lib/types";

type Props = {
  settings: Settings;
  t: Record<string, string>;
  toggleLang: (lang: Lang) => void;
  setMode: (m: Mode) => void;
  updateNumber: (key: "maxTimeMin" | "noRepeatDays", value: number) => void;
  updateCost: (value: 1 | 2 | 3) => void;
  toggleDouble: (val: boolean) => void;
};

export function SettingsTab({
  settings, t, toggleLang, setMode, updateNumber, updateCost, toggleDouble,
}: Props) {
  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
      <h2 className="text-xl font-extrabold text-warm-900 mb-4">{t.settings}</h2>

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
    </section>
  );
}
