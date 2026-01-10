"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Lang, Mode, Recipe, ShoppingItem } from "@/lib/types";
import { buildShoppingList, ensureSeeded, getSettings, markCooked, pickTodayRecipe, setPantryItem, updateSettings } from "@/lib/logic";
import { ImportHelloFreshPdf } from "@/components/ImportHelloFreshPdf";

type Tab = "today" | "recipes" | "shop" | "pantry" | "settings";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("today");
  const [ready, setReady] = useState(false);

  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);

  const [today, setToday] = useState<Recipe | null>(null);
  const [shop, setShop] = useState<ShoppingItem[] | null>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantryText, setPantryText] = useState("");
  const [pantryList, setPantryList] = useState<{ nameKey: string; alwaysHave: boolean }[]>([]);

  useEffect(() => {
    (async () => {
      await ensureSeeded();
      const s = await getSettings();
      setSettings(s);
      const rs = await db.recipes.toArray();
      setRecipes(rs);
      const p = await db.pantry.toArray();
      setPantryList(p.map(x => ({ nameKey: x.nameKey, alwaysHave: !!x.alwaysHave })));
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const r = await pickTodayRecipe();
      setToday(r);
      setShop(null);
    })();
  }, [ready, settings?.lang, settings?.mode, settings?.maxTimeMin, settings?.maxCostTier]);

  const lang: Lang = settings?.lang ?? "es";

  const t = useMemo(() => {
    const dict = {
      es: {
        today: "Hoy",
        recipes: "Recetas",
        shop: "Compra",
        pantry: "Despensa",
        settings: "Ajustes",
        reroll: "Otra receta",
        cookThis: "Marcar como cocinada",
        makeList: "Generar lista de compra",
        empty: "No hay recetas que cumplan filtros.",
        mode: "Modo",
        lang: "Idioma",
        double: "Raciones dobles (sobras)",
        maxTime: "Máx. minutos",
        maxCost: "Máx. coste",
        noRepeat: "No repetir (días)",
        addPantry: "Añadir a despensa",
        pantryHelp: "Añade básicos (ej: aceite, sal, ajo) para que no salgan en la compra.",
      },
      ca: {
        today: "Avui",
        recipes: "Receptes",
        shop: "Compra",
        pantry: "Rebost",
        settings: "Ajustos",
        reroll: "Una altra recepta",
        cookThis: "Marcar com a cuinada",
        makeList: "Generar llista de compra",
        empty: "No hi ha receptes que compleixin filtres.",
        mode: "Mode",
        lang: "Idioma",
        double: "Racions dobles (sobres)",
        maxTime: "Màx. minuts",
        maxCost: "Màx. cost",
        noRepeat: "No repetir (dies)",
        addPantry: "Afegir al rebost",
        pantryHelp: "Afegeix bàsics (ex: oli, sal, all) perquè no surtin a la compra.",
      }
    } as const;

    return dict[lang];
  }, [lang]);

  async function reroll() {
    const r = await pickTodayRecipe();
    setToday(r);
    setShop(null);
  }

  function renderBoldMultiline(text: string) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.+?)\*\*/g); // alterna normal/bold
      return (
        <div key={i}>
          {parts.map((p, j) =>
            j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span>
          )}
        </div>
      );
    });
  }

  async function generateShop() {
    if (!today) return;
    const list = await buildShoppingList(today);
    setShop(list);
    setTab("shop");
  }

  async function cooked() {
    if (!today) return;
    await markCooked(today.id);
    await reroll();
  }

  async function toggleLang(newLang: Lang) {
    if (!settings) return;
    await updateSettings({ lang: newLang });
    setSettings(await getSettings());
  }

  async function setMode(m: Mode) {
    if (!settings) return;
    await updateSettings({ mode: m });
    setSettings(await getSettings());
  }

  async function updateNumber(key: "maxTimeMin" | "noRepeatDays", value: number) {
    if (!settings) return;
    await updateSettings({ [key]: value } as any);
    setSettings(await getSettings());
  }

  async function updateCost(value: 1 | 2 | 3) {
    if (!settings) return;
    await updateSettings({ maxCostTier: value });
    setSettings(await getSettings());
  }

  async function toggleDouble(val: boolean) {
    if (!settings) return;
    await updateSettings({ doublePortions: val });
    setSettings(await getSettings());
  }

  async function addPantry() {
    const nameKey = pantryText.trim().toLowerCase();
    if (!nameKey) return;
    await setPantryItem(nameKey, true);
    const p = await db.pantry.toArray();
    setPantryList(p.map(x => ({ nameKey: x.nameKey, alwaysHave: !!x.alwaysHave })));
    setPantryText("");
  }

  async function togglePantry(nameKey: string, alwaysHave: boolean) {
    await setPantryItem(nameKey, !alwaysHave);
    const p = await db.pantry.toArray();
    setPantryList(p.map(x => ({ nameKey: x.nameKey, alwaysHave: !!x.alwaysHave })));
  }

  if (!ready || !settings) {
    return <div style={styles.wrap}><div style={styles.card}>Cargando…</div></div>;
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div style={styles.title}>🍽️ Cenas</div>
        <nav style={styles.nav}>
          <TabBtn active={tab === "today"} onClick={() => setTab("today")}>{t.today}</TabBtn>
          <TabBtn active={tab === "recipes"} onClick={() => setTab("recipes")}>{t.recipes}</TabBtn>
          <TabBtn active={tab === "shop"} onClick={() => setTab("shop")}>{t.shop}</TabBtn>
          <TabBtn active={tab === "pantry"} onClick={() => setTab("pantry")}>{t.pantry}</TabBtn>
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>{t.settings}</TabBtn>
        </nav>
      </header>

      <main style={styles.main}>
        {tab === "today" && (
          <section style={styles.card}>
            {!today ? (
              <div>{t.empty}</div>
            ) : (
              <>
                <h2 style={styles.h2}>{today.title[lang]}</h2>
                <p style={styles.p}>{today.description[lang]}</p>

                <div style={styles.metaRow}>
                  <span style={styles.badge}>⏱️ {today.timeMin} min</span>
                  <span style={styles.badge}>💸 {"€".repeat(today.costTier)}</span>
                  <span style={styles.badge}>👩‍🍳 {today.difficulty}</span>
                  {settings.doublePortions && <span style={styles.badge}>🍱 sobras</span>}
                </div>

                <div style={styles.btnRow}>
                  <button style={styles.btn} onClick={reroll}>{t.reroll}</button>
                  <button style={styles.btnPrimary} onClick={generateShop}>{t.makeList}</button>
                </div>

                <hr style={styles.hr} />

                <h3 style={styles.h3}>Ingredientes</h3>
                <ul style={styles.ul}>
                  {today.ingredients.map((ing, idx) => (
                    <li key={idx} style={styles.li}>
                      <span>{ing.name[lang]}</span>
                     <span style={styles.muted}>
                      {(() => {
                        const hf = settings.doublePortions ? ing.qty4Text : ing.qty2Text;
                        const legacy = ing.qtyText ?? `${ing.qty ?? ""} ${ing.unit ?? ""}`.trim();
                        return hf ?? legacy;
                      })()}
                      {ing.pantry ? " (despensa)" : ""}
                    </span>
                    </li>
                  ))}
                </ul>

               <h3 style={styles.h3}>Pasos</h3>

                <div style={styles.stepsGrid}>
                {today.steps[lang].map((s, idx) => {
                  const [titleLine, ...rest] = s.split("\n");
                  const title = (titleLine || "").trim();
                  const body = rest.join("\n").trim();

                  return (
                    <div key={idx} style={styles.stepCard}>
                      <div style={styles.stepTitle}>{title || `Paso ${idx + 1}`}</div>
                      <div style={styles.stepText}>{renderBoldMultiline(body)}</div>
                    </div>
                  );
                })}
              </div>


                <div style={styles.btnRow}>
                  <button style={styles.btn} onClick={cooked}>{t.cookThis}</button>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "recipes" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>{t.recipes}</h2>

            <ImportHelloFreshPdf
                onImported={async (r) => {
                    // refresca lista de recetas en UI
                    setRecipes(await db.recipes.toArray());

                    // opcional: ponerla como "Hoy" directamente
                    setToday(r);
                    setShop(null);
                    setTab("today");
                }}
                />

            <div style={styles.grid}>
              {recipes.filter(r => r.active).map(r => (
                <button
                  key={r.id}
                  style={styles.recipeCard}
                  onClick={() => {
                    setToday(r);
                    setShop(null);
                    setTab("today");
                  }}
                >
                  <div style={styles.recipeTitle}>{r.title[lang]}</div>
                  <div style={styles.metaRow}>
                    <span style={styles.badgeSmall}>⏱️ {r.timeMin}</span>
                    <span style={styles.badgeSmall}>💸 {"€".repeat(r.costTier)}</span>
                  </div>
                  <div style={styles.recipeDesc}>{r.description[lang]}</div>
                </button>
              ))}
            </div>
            <p style={styles.mutedP}>Tip: toca una receta para ponerla como “Hoy”.</p>
          </section>
        )}

        {tab === "shop" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>{t.shop}</h2>
            {!shop ? (
              <div style={styles.mutedP}>Genera la lista desde “Hoy”.</div>
            ) : (
              <>
                <div style={styles.mutedP}>
                  Consolidado. {settings.doublePortions ? "Incluye raciones dobles (x2)." : ""}
                </div>
                <ul style={styles.ul}>
                  {shop.map(item => (
                    <li key={item.key} style={styles.li}>
                      <label style={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => {
                            setShop(prev => prev ? prev.map(x => x.key === item.key ? { ...x, checked: !x.checked } : x) : prev);
                          }}
                        />
                        <span style={{ textDecoration: item.checked ? "line-through" : "none" }}>
                          {item.name}
                        </span>
                      </label>
                      <span style={styles.muted}>
  {item.qtyText
    ? item.qtyText
    : item.qty != null
      ? `${Math.round(item.qty * 100) / 100} ${item.unit ?? ""}`.trim()
      : ""}
</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {tab === "pantry" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>{t.pantry}</h2>
            <p style={styles.mutedP}>{t.pantryHelp}</p>

            <div style={styles.btnRow}>
              <input
                value={pantryText}
                onChange={(e) => setPantryText(e.target.value)}
                placeholder={lang === "es" ? "ej: aceite, sal, ajo" : "ex: oli, sal, all"}
                style={styles.input}
              />
              <button style={styles.btnPrimary} onClick={addPantry}>{t.addPantry}</button>
            </div>

            <ul style={styles.ul}>
              {pantryList.map(p => (
                <li key={p.nameKey} style={styles.li}>
                  <span>{p.nameKey}</span>
                  <button style={styles.btnSmall} onClick={() => togglePantry(p.nameKey, p.alwaysHave)}>
                    {p.alwaysHave ? "✅" : "⬜"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "settings" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>{t.settings}</h2>

            <div style={styles.row}>
              <div style={styles.label}>{t.lang}</div>
              <div style={styles.btnRow}>
                <button style={settings.lang === "es" ? styles.btnPrimary : styles.btn} onClick={() => toggleLang("es")}>ES</button>
                <button style={settings.lang === "ca" ? styles.btnPrimary : styles.btn} onClick={() => toggleLang("ca")}>CAT</button>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.label}>{t.mode}</div>
              <div style={styles.btnRow}>
                <button style={settings.mode === "lazy" ? styles.btnPrimary : styles.btn} onClick={() => setMode("lazy")}>Vago</button>
                <button style={settings.mode === "normal" ? styles.btnPrimary : styles.btn} onClick={() => setMode("normal")}>Normal</button>
                <button style={settings.mode === "chef" ? styles.btnPrimary : styles.btn} onClick={() => setMode("chef")}>Chef</button>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.label}>{t.double}</div>
              <label style={styles.checkRow}>
                <input type="checkbox" checked={settings.doublePortions} onChange={(e) => toggleDouble(e.target.checked)} />
                <span style={styles.muted}>{settings.doublePortions ? "ON" : "OFF"}</span>
              </label>
            </div>

            <div style={styles.row}>
              <div style={styles.label}>{t.maxTime}</div>
              <input
                type="number"
                value={settings.maxTimeMin}
                min={10}
                max={90}
                style={styles.input}
                onChange={(e) => updateNumber("maxTimeMin", Number(e.target.value))}
              />
            </div>

            <div style={styles.row}>
              <div style={styles.label}>{t.maxCost}</div>
              <select
                value={settings.maxCostTier}
                onChange={(e) => updateCost(Number(e.target.value) as 1 | 2 | 3)}
                style={styles.input}
              >
                <option value={1}>€</option>
                <option value={2}>€€</option>
                <option value={3}>€€€</option>
              </select>
            </div>

            <div style={styles.row}>
              <div style={styles.label}>{t.noRepeat}</div>
              <input
                type="number"
                value={settings.noRepeatDays}
                min={3}
                max={30}
                style={styles.input}
                onChange={(e) => updateNumber("noRepeatDays", Number(e.target.value))}
              />
            </div>

            <p style={styles.mutedP}>
              Para instalar en iPhone: abrir en Safari → Compartir → “Añadir a pantalla de inicio”.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {})
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#f6f6f6", color: "#111" },
  header: { padding: 12, position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #eee", zIndex: 10 },
  title: { fontWeight: 800, fontSize: 18, marginBottom: 10 },
  nav: { display: "flex", gap: 8, overflowX: "auto" },
  tab: { padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", whiteSpace: "nowrap" },
  tabActive: { border: "1px solid #111", background: "#111", color: "#fff" },
  main: { padding: 12, display: "grid", placeItems: "start center" },
  card: { width: "min(900px, 100%)", background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 14 },
  h2: { margin: "4px 0 8px", fontSize: 18 },
  h3: { margin: "14px 0 6px", fontSize: 15 },
  p: { margin: "6px 0 10px", color: "#333" },
  mutedP: { marginTop: 10, color: "#666", fontSize: 13 },
  metaRow: { display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" },
  badge: { padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 13 },
  badgeSmall: { padding: "4px 8px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 12 },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  btn: { padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" },
  btnPrimary: { padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff" },
  btnSmall: { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" },
  hr: { border: "none", borderTop: "1px solid #eee", margin: "12px 0" },
  ul: { padding: 0, margin: 0, listStyle: "none" },
  li: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid #f0f0f0" },
  muted: { color: "#666", fontSize: 13 },
  ol: { margin: "6px 0 0", paddingLeft: 18 },
  oli: { margin: "6px 0", color: "#222" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginTop: 10 },
  recipeCard: { textAlign: "left", padding: 12, borderRadius: 14, border: "1px solid #eee", background: "#fff" },
  recipeTitle: { fontWeight: 700, marginBottom: 6 },
  recipeDesc: { fontSize: 13, color: "#555", marginTop: 6 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" },
  label: { fontWeight: 600 },
  input: { padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: 180 },
  checkRow: { display: "flex", alignItems: "center", gap: 8 },
  stepsGrid: {  display: "grid",  gap: 12,  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"},
  stepCard: {  border: "1px solid #eee",  borderRadius: 14,  padding: 12,  background: "#fff", minHeight: 110},
  stepTitle: {  fontWeight: 800,  marginBottom: 8},
  stepText: {  lineHeight: 1.35,  color: "#222",  whiteSpace: "pre-wrap", fontSize: 14},

};
