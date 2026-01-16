"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Lang, Mode, Recipe, ShoppingItem } from "@/lib/types";
import { buildShoppingList,buildShoppingListForMany, getSettings, markCooked, pickTodayRecipeFromList, setPantryItem, updateSettings } from "@/lib/logic";
import { ImportHelloFreshPdf } from "@/components/ImportHelloFreshPdf";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

type Tab = "today" | "recipes" | "shop" | "plan" | "pantry" | "settings";

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
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayFadeIn, setTodayFadeIn] = useState(true);



  const { data: session } = useSession();

  const router = useRouter();
  const searchParams = useSearchParams();

  // mobile responsive (sin CSS media queries)
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 420);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const qtab = searchParams.get("tab") as any;
    const allowed = new Set(["today", "recipes", "shop", "plan", "pantry", "settings"]);
    if (qtab && allowed.has(qtab)) {
      setTab(qtab);
    }
    // solo al montar / cuando cambie la query
  }, [searchParams]);

  async function loadRecipesFromServer(): Promise<Recipe[]> {
    const res = await fetch("/api/recipes", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar recetas");
    const data = (await res.json()) as Recipe[];
    setRecipes(data);
    return data;
  }
  const reloadRecipes = async (): Promise<void> => {
  await loadRecipesFromServer();
};

async function isLoggedIn(): Promise<boolean> {
  const r = await fetch("/api/me", { cache: "no-store" });
  if (!r.ok) return false;
  const data = await r.json();
  return !!data.loggedIn;
}

 useEffect(() => {
  (async () => {
    const s = await getSettings(); // Dexie OK
    setSettings(s);

    // ✅ carga cola + despensa al inicio (para que Recipes marque ✓ al entrar)
    await loadQueue();

    const p = await db.pantry.toArray();
    setPantryList(p.map(x => ({ nameKey: x.nameKey, alwaysHave: !!x.alwaysHave })));

    const serverRecipes = await loadRecipesFromServer(); // ✅ una sola vez

    const cutoff = Date.now() - s.noRepeatDays * 24 * 60 * 60 * 1000;
    const recent = await db.history.where("cookedAt").above(cutoff).toArray();
    const recentSet = new Set(recent.map(h => h.recipeId));

    const today = pickTodayRecipeFromList(serverRecipes, recentSet, s);
    setToday(today);
    setTodayLoading(false);
    setTodayFadeIn(true);
    setReady(true);

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
    setTodayWithTransition(r);
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
        plan: "Plan",
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
        plan: "Pla",
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
  setTodayWithTransition(next);
  }

  function setTodayWithTransition(next: Recipe | null) {
    // pequeña animación: fade-out -> swap -> fade-in
    setTodayFadeIn(false);
    setTodayLoading(true);

    window.setTimeout(() => {
      setToday(next);
      setShop(null);

      // fade in
      setTodayFadeIn(true);
      setTodayLoading(false);
    }, 130);
  }

  const queueIdSet = useMemo(() => {
    return new Set(queue.map((q: any) => q.recipeId).filter(Boolean));
  }, [queue]);


  async function loadQueue() {
  const logged = await isLoggedIn();

  if (!logged) {
    const local = await db.queue.orderBy("position").toArray();
    // necesitas “hydratar” recipe:
    const recipeMap = new Map(recipes.map(r => [r.id, r]));
    setQueue(local.map(q => ({ ...q, recipe: recipeMap.get(q.recipeId) })));
    return;
  }

  const res = await fetch("/api/queue", { cache: "no-store" });
  setQueue(res.ok ? await res.json() : []);
}


  useEffect(() => {
    if (tab === "recipes" || tab === "plan") {
      loadQueue().catch(console.error);
    }
  }, [tab]);


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
    return (
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
        {bodyLines.map((raw, i) => {
          const line = raw.trim();
          if (!line) return null;

          // línea en cursiva (CONSEJO/RECUERDA) sin bullet
          if (line.startsWith("_") && line.endsWith("_")) {
            return (
              <li key={i} style={{ listStyle: "none", marginLeft: -18 }}>
                <div style={styles.tipBox}>
                  <div style={styles.tipText}>
                    <em><RichText text={line.slice(1, -1)} /></em>
                  </div>
                </div>

              </li>
            );
          }

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


async function moveQueue(recipeId: string, dir: "up" | "down") {
  const res = await fetch("/api/queue/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipeId, dir }),
  });

  if (!res.ok) {
    console.error("Queue reorder failed", res.status, await res.text());
    return;
  }

  await loadQueue();
}

function qtyForSettings(ing: any, settings: any) {
  // HF: preferimos texto 2P/4P
  return settings.doublePortions ? ing.qty4Text : ing.qty2Text;
}

async function generateWeeklyShop() {
  const list = queue
    .map((q: any) => q.recipe)
    .filter((r: any) => r && r.id) // asegúrate de que es receta
    .filter(
      (r: any, i: number, arr: any[]) =>
        arr.findIndex((x) => x.id === r.id) === i
    ) 

  if (list.length === 0) return;

  const weekly = await buildShoppingListForMany(list, settings);
  setShop(weekly);
  setTab("shop");
}


function normalizeName(s: string) {
  return s.trim().toLowerCase();
}

// intenta sumar cantidades simples (g/ml/u/cdta) si se puede; si no, deja texto
function parseQtyText(q: string) {
  const t = String(q || "").trim().toLowerCase().replace(",", ".");
  if (!t) return null;

  const half = t.startsWith("½") ? 0.5 : null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*([a-záéíóúñ]+)?/);

  const num = half ?? (m ? Number(m[1]) : NaN);
  if (!Number.isFinite(num)) return null;

  const unitRaw = (m?.[2] || "").toLowerCase();
  const unit =
    unitRaw.startsWith("g") || unitRaw.includes("gram") ? "g" :
    unitRaw === "ml" || unitRaw === "m" ? "ml" :
    unitRaw.includes("cuchar") || unitRaw.includes("cdta") ? "cdta" :
    unitRaw.includes("unidad") || unitRaw.includes("u") || unitRaw.includes("sobre") ? "u" :
    unitRaw || "";

  return { num, unit };
}

async function toggleQueue(recipeId: string) {
  const logged = await isLoggedIn();

  if (!logged) {
    const existing = await db.queue.get(recipeId);
    if (existing) {
      await db.queue.delete(recipeId);
    } else {
      const maxPos = (await db.queue.toArray()).reduce((m, x) => Math.max(m, x.position ?? 0), 0);
     await db.queue.put({recipeId,position: maxPos + 1,createdAt: new Date(),});

    }
    await loadQueue();
    return;
  }

  // server
  const inQueue = queue.some((q: any) => q.recipeId === recipeId);
  const res = await fetch(
    inQueue ? `/api/queue?recipeId=${encodeURIComponent(recipeId)}` : "/api/queue",
    {
      method: inQueue ? "DELETE" : "POST",
      headers: inQueue ? undefined : { "Content-Type": "application/json" },
      body: inQueue ? undefined : JSON.stringify({ recipeId }),
    }
  );

  if (!res.ok) return;
  await loadQueue();
}

  async function pickFromQueue() {
    if (!queue.length) return;
    const first = queue[0];
    const r = first.recipe;
    if (!r) return;

    setTodayWithTransition(r);
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

const isActive = (r: any) => r.active === true || r.active === 1; 
const filteredRecipes = recipes
  .filter(isActive)
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
        <div style={styles.headerBar}>
          <div style={styles.brand}>Misena</div>

          {!session ? (
            <button
              type="button"
              style={styles.loginBtn}
              onClick={() => {
                sessionStorage.setItem("mise:returnTab", tab);
                router.push("/auth?mode=login");
              }}
            >
              Login
            </button>
          ) : (
            <button type="button" style={styles.loginBtn} onClick={() => signOut({ callbackUrl: "/" })}>
              Logout
            </button>
          )}
        </div>
      </header>

      <main style={styles.mainWithBottomNav}>
        {tab === "today" && (
          <section style={styles.card}>
           {todayLoading ? (
              <TodaySkeleton />
            ) : !today ? (
              <div>{t.empty}</div>
            ) : (
              <div style={todayFadeIn ? styles.fadeIn : styles.fadeOut}>
                <>
                <h2 style={styles.h2}>{today.title[lang]}</h2>
                <p style={styles.p}>{today.description[lang]}</p>

                <div style={styles.metaRow}>
                  <span style={styles.badge}>⏱️ {today.timeMin} min</span>
                  <span style={styles.badge}>💸 {"€".repeat(today.costTier)}</span>
                  <span style={styles.badge}>👩‍🍳 {today.difficulty}</span>
                  {settings.doublePortions && <span style={styles.badge}>🍱 sobras</span>}
                </div>

                <div style={styles.ctaRow}>
                  <button style={styles.btnGhost} onClick={reroll}>{t.reroll}</button>
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
                        <div style={styles.stepHeader}>
                          <div style={styles.stepNum}>{idx + 1}</div>
                          <div style={styles.stepHeaderText}>
                            <div style={styles.stepTitle}>
                              <RichText text={title} />
                            </div>
                          </div>
                        </div>

                        <div style={styles.stepText}>
                          {renderStepBody(body)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={styles.endCta}>
                  <button type="button" style={styles.endCtaBtn} onClick={cooked}>
                    {t.cookThis}
                  </button>
                </div>
              </>
              </div>
            )}
            
          </section>
        )}

        {tab === "recipes" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>{t.recipes}</h2>
          <ImportHelloFreshPdf onDone={reloadRecipes} />
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
           <button type="button" style={styles.btnSmall} onClick={() => setTab("plan")}>
              Ver lista ({queue.length})
            </button>
            

          </div>
            <div style={styles.grid}>
            {filteredRecipes.map((r) => {
              const inQueue = queueIdSet.has(r.id);
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  style={styles.recipeCard}
                  onClick={() => {
                    setTodayWithTransition(r);
                    setTab("today");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTodayWithTransition(r);
                      setTab("today");  
                    }
                  }}
                >
                  <div style={styles.recipeTopRow}>
                    <div style={styles.recipeTitle}>{r.title?.[lang] || r.title?.es}</div>

                    <div style={styles.recipeIcons}>
                     
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
                </div>

              );
            })}
          </div>

            <p style={styles.mutedP}>Tip: toca una receta para ponerla como “Hoy”.</p>
          </section>
        )}
        {tab === "plan" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Lista</h2>

            <div style={styles.searchRow}>
              <input
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                placeholder="Filtrar en la lista…"
                style={styles.searchInput}
              />
              {recipeQuery && (
                <button type="button" style={styles.searchClear} onClick={() => setRecipeQuery("")}>
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                style={styles.btnSmallPrimary}
                onClick={async () => {
                  await generateWeeklyShop(); // genera shop desde cola (máx 7)
                  setTab("shop"); // opcional: te lleva directo a la lista
                }}
              >
                Lista compra semanal
              </button>

              <button
                type="button"
                style={styles.btnSmall}
                onClick={async () => {
                  await fetch("/api/queue/clear", { method: "POST" });
                  await loadQueue();
                }}
              >
                Vaciar lista
              </button>
            </div>


            <div style={styles.grid}>
              {queue
                .map((q: any) => q.recipe)
                .filter(Boolean)
                .filter((r: any) => {
                  const qx = recipeQuery.trim().toLowerCase();
                  if (!qx) return true;
                  const title = String(r.title?.[lang] || r.title?.es || "").toLowerCase();
                  const ing = Array.isArray(r.ingredients)
                    ? r.ingredients.map((i: any) => String(i?.name?.[lang] || i?.name?.es || "").toLowerCase()).join(" ")
                    : "";
                  return title.includes(qx) || ing.includes(qx);
                })
                .map((r: any) => (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    style={styles.recipeCard}
                    onClick={() => {
                      setTodayWithTransition(r);
                      setTab("today");

                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setTodayWithTransition(r);
                        setTab("today");

                      }
                    }}
                  >
                    <div style={styles.recipeTopRow}>
                      <div style={styles.recipeTitle}>{r.title?.[lang] || r.title?.es}</div>

                     <div style={styles.recipeIcons}>
                    <button
                      type="button"
                      title="Subir"
                      style={styles.iconBtn}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await moveQueue(r.id, "up");
                      }}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      title="Bajar"
                      style={styles.iconBtn}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await moveQueue(r.id, "down");
                      }}
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      title="Quitar de la lista"
                      style={styles.iconBtn}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await fetch(`/api/queue?recipeId=${encodeURIComponent(r.id)}`, { method: "DELETE" });
                        await loadQueue();
                      }}
                    >
                      ✕
                    </button>
                  </div>

                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.badgeSmall}>⏱️ {r.timeMin}</span>
                      <span style={styles.badgeSmall}>💸 {"€".repeat(r.costTier)}</span>
                    </div>
                  </div>
                ))
                }
            </div>
          </section>
        )}

       {tab === "shop" && (
        <section style={styles.card}>
          <h2 style={styles.h2}>{t.shop}</h2>

          {!shop ? (
            <div style={styles.mutedP}>
              Genera la lista desde “Hoy” o desde “Plan”.
            </div>
          ) : (
            <>
              <div style={styles.mutedP}>
                Consolidado. {settings.doublePortions ? "Incluye raciones dobles (x2)." : ""}
              </div>

              <ul style={styles.ul}>
                {shop.map((item) => (
                  <li key={item.key} style={styles.li}>
                    <label style={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => {
                          setShop((prev) =>
                            prev
                              ? prev.map((x) =>
                                  x.key === item.key ? { ...x, checked: !x.checked } : x
                                )
                              : prev
                          );
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

      <BottomNav tab={tab} setTab={setTab} t={t} />
    </div>
  );
}
function BottomNav({ tab, setTab, t }: any) {
  const items: Array<{ key: Tab; label: string; icon: string }> = [
    { key: "today", label: t.today, icon: "🍽️" },
    { key: "recipes", label: t.recipes, icon: "📚" },
    { key: "plan", label: t.plan, icon: "🗓️" },
    { key: "shop", label: t.shop, icon: "🛒" },
    { key: "pantry", label: t.pantry, icon: "🧺" },
    { key: "settings", label: t.settings, icon: "⚙️" },
  ];

  return (
    <div style={styles.bottomNavWrap}>
      <div style={styles.bottomNav}>
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => setTab(it.key)}
              style={active ? styles.bottomNavItemActive : styles.bottomNavItem}
              aria-label={it.label}
            >
            <div style={active ? styles.bottomNavIconActive : styles.bottomNavIcon}>{it.icon}</div>
            <div style={active ? styles.bottomNavLabelActive : styles.bottomNavLabel}>{it.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div>
      <div style={styles.skelTitle} />
      <div style={styles.skelLine} />
      <div style={styles.skelLineShort} />

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <div style={styles.skelChip} />
        <div style={styles.skelChip} />
        <div style={styles.skelChip} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div style={styles.skelBtn} />
        <div style={styles.skelBtnPrimary} />
      </div>

      <hr style={styles.hr} />

      <div style={styles.skelSection} />
      <div style={styles.skelRow} />
      <div style={styles.skelRow} />
      <div style={styles.skelRow} />

      <div style={{ marginTop: 14 }}>
        <div style={styles.skelSection} />
        <div style={styles.skelCard} />
        <div style={styles.skelCard} />
      </div>
    </div>
  );
}
const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#f6f6f6", color: "#111" },
  header: {
  padding: 12,
  position: "sticky",
  top: 0,
  background: "#fff",
  borderBottom: "1px solid #eee",
  zIndex: 10,
},

headerRow: {
  display: "flex",
  alignItems: "center",
  gap: 8,
},

nav: {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  flex: 1,
  minWidth: 0,
  paddingBottom: 2, // evita que el scroll tape bordes
},
  title: { fontWeight: 800, fontSize: 18, marginBottom: 10 },
  tab: { padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", whiteSpace: "nowrap" },
  tabActive: { border: "1px solid #111", background: "#111", color: "#fff" },
  main: { padding: 12, display: "grid", placeItems: "start center" },
  card: { width: "min(900px, 100%)", background: "#ffffff", border: "1px solid #eee", borderRadius: 16, padding: 14 },
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
authTab: {
  padding: "8px 10px",      // igual que tab
  borderRadius: 10,         // igual que tab
  border: "1px solid #ddd", // igual que tab
  background: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,               // mismo look que tabs
  minWidth: 36,             // compacto
},

authTabIcon: {
  fontSize: 14,             // icono más pequeño
  lineHeight: 1,
  display: "inline-block",
  transform: "translateY(0.5px)", // micro ajuste visual
},

authAvatar: {
  width: 18,
  height: 18,
  borderRadius: 6,
  objectFit: "cover",
  border: "1px solid #eee",
  display: "block",
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
headerTop: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
},

authBtnPrimary: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
},

authIcon: {
  width: 26,
  height: 26,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.15)",
},

userChip: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 8px",
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fafafa",
  maxWidth: "62%",
},

userLeft: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  flex: 1,
},

avatar: {
  width: 34,
  height: 34,
  borderRadius: 12,
  objectFit: "cover",
  border: "1px solid #eaeaea",
  background: "#fff",
},

avatarFallback: {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  border: "1px solid #eaeaea",
  background: "#fff",
  fontWeight: 900,
},

userMeta: {
  display: "grid",
  gap: 2,
  minWidth: 0,
},

userName: {
  fontSize: 13,
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

userSub: {
  fontSize: 12,
  color: "#666",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

authBtnGhost: {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #e5e5e5",
  background: "#fff",
  color: "#111",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
},

authBtnIcon: {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: "1px solid #e5e5e5",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
},
mainWithBottomNav: {
  padding: 12,
  display: "grid",
  placeItems: "start center",
  paddingBottom: 90, // espacio para bottom nav fijo
},

headerTopRow: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
},

headerSpacer: { height: 2 },

// CTA row
ctaRow: {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
},

btnGhost: {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
},

btnPrimaryWide: {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
},

// Ingredients
sectionTitleRow: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 12,
},

ingList: {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 6,
},

ingRow: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 10px",
  borderRadius: 14,
  border: "1px solid #f0f0f0",
  background: "#fff",
},

ingLeft: { minWidth: 0, display: "grid", gap: 2 },
ingName: { fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
ingHint: { fontSize: 12, color: "#777" },
ingQty: { fontSize: 13, color: "#666", whiteSpace: "nowrap" },

// Steps premium
stepCard: {
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 12,
  background: "#fff",
  minHeight: 120,
},

stepHeader: {
  display: "flex",
  alignItems: "center",   // ✅ alinea verticalmente
  gap: 10,
  marginBottom: 10,
},

stepNum: {
  width: 28,
  height: 28,
  borderRadius: 10,
  border: "1px solid #eaeaea",
  background: "#fafafa",
  display: "flex",        // ✅ mejor control que grid
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 13,
  lineHeight: "28px",     // ✅ evita “bailes”
  flex: "0 0 28px",
},

stepHeaderText: {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
},

stepTitle: {
  fontWeight: 900,
  lineHeight: 1.15
},
stepBody: {
  lineHeight: 1.4,
  color: "#222",
  fontSize: 14,
},
cookedBarWrap: {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: "calc(76px + env(safe-area-inset-bottom))", // ✅ justo encima del nav
  zIndex: 40,
  display: "grid",
  placeItems: "center",
  padding: "0 10px",
  pointerEvents: "none",
},

cookedBarBtn: {
  pointerEvents: "auto",
  width: "min(520px, 100%)",
  height: 42,                 // ✅ mucho menos grande
  borderRadius: 999,
  border: "1px solid #eee",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  color: "#111",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
},

bottomNavWrap: {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  padding: 8,
  zIndex: 30,
  background: "#fff",
  borderTop: "1px solid #eee",
},

bottomNav: {
  margin: "0 auto",
  width: "min(900px, 100%)",
  display: "flex",
  justifyContent: "space-between",
  gap: 4,
},

bottomNavItem: {
  flex: 1,
  border: "1px solid transparent",
  background: "transparent",
  borderRadius: 12,
  padding: "8px 6px",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  gap: 4,
  color: "#444",
},

bottomNavItemActive: {
  flex: 1,
  border: "1px solid #ddd",
  background: "#fafafa",
  borderRadius: 12,
  padding: "8px 6px",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  gap: 4,
  color: "#111",
},

bottomNavIcon: { fontSize: 16, lineHeight: 1 },
bottomNavLabel: { fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" },

headerBar: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
},

brand: {
  fontWeight: 800,
  letterSpacing: -0.3,
},

loginBtn: {
  height: 34,
  padding: "0 10px",         // ✅ vertical cero, centrado real
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  display: "inline-flex",     // ✅
  alignItems: "center",       // ✅
  justifyContent: "center",   // ✅
  lineHeight: 1,              // ✅
},
fadeIn: {
  opacity: 1,
  transform: "translateY(0px)",
  transition: "opacity 180ms ease, transform 180ms ease",
},

fadeOut: {
  opacity: 0,
  transform: "translateY(6px)",
  transition: "opacity 130ms ease, transform 130ms ease",
},

// Skeleton bits
skelTitle: {
  height: 20,
  borderRadius: 10,
  background: "#f0f0f0",
  width: "70%",
},
skelLine: {
  height: 12,
  borderRadius: 10,
  background: "#f0f0f0",
  marginTop: 10,
  width: "95%",
},
skelLineShort: {
  height: 12,
  borderRadius: 10,
  background: "#f0f0f0",
  marginTop: 8,
  width: "75%",
},
skelChip: {
  height: 26,
  borderRadius: 999,
  background: "#f0f0f0",
  width: 72,
},
skelBtn: {
  height: 40,
  borderRadius: 12,
  background: "#f0f0f0",
  width: 120,
},
skelBtnPrimary: {
  height: 40,
  borderRadius: 12,
  background: "#e9e9e9",
  width: 170,
  border: "1px solid #e5e5e5",
},
skelSection: {
  height: 14,
  borderRadius: 10,
  background: "#f0f0f0",
  width: 120,
  marginTop: 6,
},
skelRow: {
  height: 18,
  borderRadius: 12,
  background: "#f3f3f3",
  marginTop: 10,
},
skelCard: {
  height: 110,
  borderRadius: 16,
  background: "#f3f3f3",
  marginTop: 10,
},
tipBox: {
  position: "relative",
  padding: "12px 12px 12px",
  paddingTop: 14, // un pelín más de aire
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fafafa",
},
tipText: { fontSize: 13, color: "#333" },
endCta: {
  display: "grid",
  placeItems: "center",
  paddingTop: 14,
},

endCtaBtn: {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
},
};
