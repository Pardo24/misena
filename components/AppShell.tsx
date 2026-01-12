"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Lang, Mode, Recipe, ShoppingItem } from "@/lib/types";
import { buildShoppingList, getSettings, markCooked, pickTodayRecipeFromList, setPantryItem, updateSettings } from "@/lib/logic";
import { ImportHelloFreshPdf } from "@/components/ImportHelloFreshPdf";

type Tab = "today" | "recipes" | "shop" | "pantry" | "settings";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("today");
  const [ready, setReady] = useState(false);

  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);

  const [today, setToday] = useState<Recipe | null>(null);
  const [shop, setShop] = useState<ShoppingItem[] | null>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeQuery, setRecipeQuery] = useState("");

  const [pantryText, setPantryText] = useState("");
  const [pantryList, setPantryList] = useState<{ nameKey: string; alwaysHave: boolean }[]>([]);
 
  const [queue, setQueue] = useState<any[]>([]);

  async function loadRecipesFromServer(): Promise<Recipe[]> {
    const res = await fetch("/api/recipes", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar recetas");
    const data = (await res.json()) as Recipe[];
    setRecipes(data);
    return data;
  }


  useEffect(() => {
  (async () => {
    const s = await getSettings(); // Dexie OK
    setSettings(s);

    const serverRecipes = await loadRecipesFromServer(); // ✅ una sola vez

    const cutoff = Date.now() - s.noRepeatDays * 24 * 60 * 60 * 1000;
    const recent = await db.history.where("cookedAt").above(cutoff).toArray();
    const recentSet = new Set(recent.map(h => h.recipeId));

    const today = pickTodayRecipeFromList(serverRecipes, recentSet, s);
    setToday(today);
  })().catch(console.error);
}, []);

  useEffect(() => {
  if (!settings) return;
  if (!recipes || recipes.length === 0) return;

  (async () => {
    const cutoff = Date.now() - settings.noRepeatDays * 24 * 60 * 60 * 1000;
    const recent = await db.history.where("cookedAt").above(cutoff).toArray();
    const recentSet = new Set(recent.map(h => h.recipeId));

    const r = pickTodayRecipeFromList(recipes, recentSet, settings);
    setToday(r);
    setShop(null);
  })().catch(console.error);
}, [
  settings?.mode,
  settings?.maxTimeMin,
  settings?.maxCostTier,
  settings?.noRepeatDays,
  recipes,
]);

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
  const settings = await getSettings();
  const cutoff = Date.now() - settings.noRepeatDays * 24 * 60 * 60 * 1000;
  const recent = await db.history.where("cookedAt").above(cutoff).toArray();
  const recentSet = new Set(recent.map(h => h.recipeId));

  const next = pickTodayRecipeFromList(recipes, recentSet, settings);
  setToday(next);
}

  async function loadQueue() {
  const res = await fetch("/api/queue", { cache: "no-store" });
  setQueue(await res.json());
}

function RichText({ text }: { text: string }) {
  // interpreta **bold** y _italic_
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={out.length}>{text.slice(last, m.index)}</span>);

    const token = m[0];
    if (token.startsWith("**")) out.push(<strong key={out.length}>{token.slice(2, -2)}</strong>);
    else out.push(<em key={out.length}>{token.slice(1, -1)}</em>);

    last = m.index + token.length;
  }

  if (last < text.length) out.push(<span key={out.length}>{text.slice(last)}</span>);
  return <>{out}</>;
}

function renderStepBody(bodyLines: string[]) {
  // bodyLines viene con "• ..." y "_CONSEJO: ..._"
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
      {bodyLines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;

        // línea en cursiva (CONSEJO/RECUERDA) sin bullet
        if (line.startsWith("_") && line.endsWith("_")) {
          return (
            <li key={i} style={{ listStyle: "none", marginLeft: -18 }}>
              <em><RichText text={line.slice(1, -1)} /></em>
            </li>
          );
        }

        // bullet normal
        const clean = line.startsWith("•") ? line.slice(1).trim() : line;
        return (
          <li key={i}>
            <RichText text={clean} />
          </li>
        );
      })}
    </ul>
  );
}

async function toggleQueue(recipeId: string) {
  const inQueue = queue.some((q) => q.recipeId === recipeId);

    if (inQueue) {
      await fetch(`/api/queue?recipeId=${encodeURIComponent(recipeId)}`, { method: "DELETE" });
    } else {
      await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
    }

    await loadQueue();
}

  async function pickFromQueue() {
    if (!queue.length) return;
    const first = queue[0];
    const r = first.recipe;
    if (!r) return;

    setToday(r);
    setShop(null);
    setTab("today");

    await fetch(`/api/queue?recipeId=${encodeURIComponent(first.recipeId)}`, { method: "DELETE" });
    await loadQueue();
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
const q = recipeQuery.trim().toLowerCase();

const filteredRecipes = recipes
  .filter(r => r.active === 1)
  .filter(r => {
    if (!q) return true;
    const title = (r.title?.[lang] || r.title?.es || "").toLowerCase();
    const desc = (r.description?.[lang] || r.description?.es || "").toLowerCase();
    const ing = (r.ingredients ?? [])
      .map((i: any) => (i?.name?.[lang] || i?.name?.es || "").toLowerCase())
      .join(" ");
    return title.includes(q) || desc.includes(q) || ing.includes(q);
  });

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
                    const lines = (s ?? "").split("\n").map(l => l.trim()).filter(Boolean);

                    // tu extractor genera: "Titulo\n• ...\n• ...\n_CONSEJO: ..._"
                    const title = lines[0] ?? `Paso ${idx + 1}`;
                    const body = lines.slice(1);

                    return (
                      <div key={idx} style={styles.stepCard}>
                        <div style={styles.stepTitle}>
                          <RichText text={title} />
                        </div>

                        <div style={styles.stepText}>
                          {renderStepBody(body)}
                        </div>
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

          <ImportHelloFreshPdf onDone={loadRecipesFromServer} />
            <div style={styles.searchRow}>
            <input
              value={recipeQuery}
              onChange={(e) => setRecipeQuery(e.target.value)}
              placeholder="Buscar por nombre o ingrediente…"
              style={styles.searchInput}
            />
            {recipeQuery && (
              <button type="button" style={styles.searchClear} onClick={() => setRecipeQuery("")}>
                ✕
              </button>
            )}
           {queue.length > 0 && (
              <div style={styles.queueBar}>
                <div style={{ fontWeight: 700 }}>Cola ({queue.length})</div>

                <div style={styles.queueChips}>
                  {queue
                    .map((q) => q.recipe)        // q incluye recipe porque el GET hace include: { recipe: true }
                    .filter(Boolean)
                    .map((r: any) => (
                      <button
                        key={r.id}
                        type="button"
                        style={styles.chip}
                        onClick={() => {
                          setToday(r);
                          setShop(null);
                          setTab("today");
                        }}
                      >
                        {r.title?.[lang] || r.title?.es}
                      </button>
                    ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={styles.btnSmallPrimary} onClick={pickFromQueue}>
                    Cocinar siguiente
                  </button>

                  <button
                    type="button"
                    style={styles.btnSmall}
                    onClick={async () => {
                      // vacía la cola en servidor (una a una, simple)
                      await Promise.all(
                        queue.map((q: any) =>
                          fetch(`/api/queue?recipeId=${encodeURIComponent(q.recipeId)}`, { method: "DELETE" })
                        )
                      );
                      await loadQueue();
                    }}
                  >
                    Vaciar
                  </button>
                </div>
              </div>
            )}

          </div>
            <div style={styles.grid}>
            {filteredRecipes.map((r) => {
              const inQueue = queue.some(q => q.recipeId === r.id);
              return (
                <button
                  key={r.id}
                  style={styles.recipeCard}
                  onClick={() => {
                    setToday(r);
                    setShop(null);
                    setTab("today");
                  }}
                >
                  <div style={styles.recipeTopRow}>
                    <div style={styles.recipeTitle}>{r.title?.[lang] || r.title?.es}</div>

                    <div style={styles.recipeIcons}>
                      {/* Poner como Hoy */}
                      <button
                        type="button"
                        title="Poner como receta de hoy"
                        style={styles.iconBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setToday(r);
                          setShop(null);
                          setTab("today");
                        }}
                      >
                        ☀️
                      </button>

                      {/* Cola */}
                      <button
                        type="button"
                        title={inQueue ? "Quitar de la cola" : "Añadir a la cola"}
                        style={inQueue ? styles.iconBtnActive : styles.iconBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleQueue(r.id);
                        }}
                      >
                        {inQueue ? "✓" : "＋"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.metaRow}>
                    <span style={styles.badgeSmall}>⏱️ {r.timeMin}</span>
                    <span style={styles.badgeSmall}>💸 {"€".repeat(r.costTier)}</span>
                  </div>

                  <div style={styles.recipeDesc}>{r.description?.[lang] || r.description?.es}</div>
                </button>
              );
            })}
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
searchRow: {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 12,
},
searchInput: {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fafafa",
  outline: "none",
},
searchClear: {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
},

queueBar: {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  marginBottom: 12,
  background: "#fff",
  display: "flex",
  gap: 12,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
},
queueChips: {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  flex: 1,
},
chip: {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  cursor: "pointer",
  fontSize: 13,
},
btnSmallPrimary: {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
},

recipeTopRow: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
},
recipeIcons: {
  display: "flex",
  gap: 8,
},
iconBtn: {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid #e5e5e5",
  background: "#fff",
  cursor: "pointer",
},
iconBtnActive: {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
},

};
