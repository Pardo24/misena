"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Lang, Mode, Recipe, ShoppingItem } from "@/lib/types";
import {
  buildShoppingList,
  buildShoppingListForMany,
  getSettings,
  markCooked,
  normalizeIngredientName,
  pickTodayRecipeFromList,
  updateSettings,
} from "@/lib/logic";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import type { Tab, PantryRow } from "@/components/appShellStyles";
import type { ToastMsg } from "@/components/Toast";

export function useAppShell() {
  const [tab, setTab] = useState<Tab>("home");
  const [ready, setReady] = useState(false);

  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);

  const [today, setToday] = useState<Recipe | null>(null);
  const [shop, setShop] = useState<ShoppingItem[] | null>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeQuery, setRecipeQuery] = useState("");

  const [queue, setQueue] = useState<any[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayFadeIn, setTodayFadeIn] = useState(true);
  const [groupedShop, setGroupedShop] = useState(true);
  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const [finishingShop, setFinishingShop] = useState(false);
  const [showShopDoneDialog, setShowShopDoneDialog] = useState(false);
  const [pantry, setPantry] = useState<PantryRow[] | null>(null);
  const [cookedSummary, setCookedSummary] = useState<{ name: string; qty: string }[] | null>(null);
  const [pantryNewName, setPantryNewName] = useState("");
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [toastMsg, setToastMsg] = useState<ToastMsg>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session, status } = useSession();

  const searchParams = useSearchParams();

  const showToast = useCallback((text: string, actionTab?: Tab) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({
      text,
      action: actionTab ? { label: "Ver plan", tab: actionTab as Tab } : undefined,
    });
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  useEffect(() => {
    const qtab = searchParams.get("tab") as any;
    const allowed = new Set(["home", "recipes", "shop", "profile"]);
    if (qtab && allowed.has(qtab)) {
      setTab(qtab);
    }
  }, [searchParams]);

  async function loadRecipesFromServer(): Promise<Recipe[]> {
    const res = await fetch("/api/recipes", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar recetas");
    const data = (await res.json()) as Recipe[];
    setRecipes(data);
    return data;
  }

  async function isLoggedIn(): Promise<boolean> {
    const r = await fetch("/api/me", { cache: "no-store" });
    if (!r.ok) return false;
    const data = await r.json();
    return !!data.loggedIn;
  }

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
      await loadQueue();
      await loadPantry();
      loadShopFromServer();
      const serverRecipes = await loadRecipesFromServer();
      const cutoff = Date.now() - s.noRepeatDays * 24 * 60 * 60 * 1000;
      const recent = await db.history.where("cookedAt").above(cutoff).toArray();
      const recentSet = new Set(recent.map(h => h.recipeId));
      const todayRecipe = pickTodayRecipeFromList(serverRecipes, recentSet, s);
      setToday(todayRecipe);
      setTodayLoading(false);
      setTodayFadeIn(true);
      initialTodaySet.current = true;
      setReady(true);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether initial load has set today already
  const initialTodaySet = useRef(false);

  useEffect(() => {
    // Skip if initial load hasn't happened yet, or if recipes aren't loaded
    if (!initialTodaySet.current) return;
    if (!settings) return;
    if (!recipes || recipes.length === 0) return;
    (async () => {
      const cutoff = Date.now() - settings.noRepeatDays * 24 * 60 * 60 * 1000;
      const recent = await db.history.where("cookedAt").above(cutoff).toArray();
      const recentSet = new Set(recent.map(h => h.recipeId));
      const r = pickTodayRecipeFromList(recipes, recentSet, settings);
      setTodayWithTransition(r);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings?.mode,
    settings?.maxTimeMin,
    settings?.maxCostTier,
    settings?.noRepeatDays,
  ]);

  const lang: Lang = settings?.lang ?? "es";

  const t = useMemo(() => {
    const dict = {
      es: {
        home: "Inicio",
        recipes: "Recetas",
        shop: "Compra",
        profile: "Perfil",
        pantry: "Despensa",
        settings: "Ajustes",
        reroll: "Otra receta",
        cookThis: "Marcar como cocinada",
        makeList: "Añadir a la cesta",
        empty: "No hay recetas que cumplan filtros.",
        mode: "Modo",
        lang: "Idioma",
        double: "Raciones dobles (sobras)",
        maxTime: "Máx. minutos",
        maxCost: "Máx. coste",
        noRepeat: "No repetir (días)",
        addPantry: "Añadir a despensa",
        pantryHelp: "Añade básicos (ej: aceite, sal, ajo) para que no salgan en la compra.",
        greeting: "Hola",
        suggestion: "Sugerencia del día",
        planEmpty: "Tu plan está vacío",
        exploreCta: "Explorar recetas",
        weeklyShopCta: "Lista compra semanal",
      },
      ca: {
        home: "Inici",
        recipes: "Receptes",
        shop: "Compra",
        profile: "Perfil",
        pantry: "Rebost",
        settings: "Ajustos",
        reroll: "Una altra recepta",
        cookThis: "Marcar com a cuinada",
        makeList: "Afegir a la cistella",
        empty: "No hi ha receptes que compleixin filtres.",
        mode: "Mode",
        lang: "Idioma",
        double: "Racions dobles (sobres)",
        maxTime: "Màx. minuts",
        maxCost: "Màx. cost",
        noRepeat: "No repetir (dies)",
        addPantry: "Afegir al rebost",
        pantryHelp: "Afegeix bàsics (ex: oli, sal, all) perquè no surtin a la compra.",
        greeting: "Hola",
        suggestion: "Suggeriment del dia",
        planEmpty: "El teu pla està buit",
        exploreCta: "Explorar receptes",
        weeklyShopCta: "Llista compra setmanal",
      }
    } as const;
    return dict[lang];
  }, [lang]);

  function setTodayWithTransition(next: Recipe | null) {
    setTodayFadeIn(false);
    setTodayLoading(true);
    window.setTimeout(() => {
      setToday(next);
      setShop(null);
      setTodayFadeIn(true);
      setTodayLoading(false);
    }, 130);
  }

  async function reroll() {
    const s = await getSettings();
    const cutoff = Date.now() - s.noRepeatDays * 24 * 60 * 60 * 1000;
    const recent = await db.history.where("cookedAt").above(cutoff).toArray();
    const recentSet = new Set(recent.map(h => h.recipeId));
    const next = pickTodayRecipeFromList(recipes, recentSet, s);
    setTodayWithTransition(next);
  }

  const queueIdSet = useMemo(() => {
    return new Set(queue.map((q: any) => q.recipeId).filter(Boolean));
  }, [queue]);

  async function loadQueue() {
    const logged = await isLoggedIn();
    if (!logged) {
      const local = await db.queue.orderBy("position").toArray();
      const recipeMap = new Map(recipes.map(r => [r.id, r]));
      setQueue(local.map(q => ({ ...q, recipe: recipeMap.get(q.recipeId) })));
      return;
    }
    const res = await fetch("/api/queue", { cache: "no-store" });
    setQueue(res.ok ? await res.json() : []);
  }

  useEffect(() => {
    if (tab === "recipes" || tab === "home") {
      loadQueue().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  async function loadShopFromServer() {
    try {
      const r = await fetch("/api/shop", { cache: "no-store" });
      if (!r.ok) return;
      const items = await r.json();
      if (Array.isArray(items) && items.length > 0) {
        setShop(items.map((it: any) => ({
          key: it.key, name: it.name, qty: it.qty, unit: it.unit,
          qtyText: it.qtyText, category: it.category, checked: !!it.checked,
        })));
      }
    } catch {}
  }

  async function saveShopToServer(items: ShoppingItem[]) {
    try {
      await fetch("/api/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
    } catch {}
  }

  async function generateWeeklyShop() {
    const list = queue
      .map((q: any) => q.recipe)
      .filter((r: any) => r && r.id)
      .filter((r: any, i: number, arr: any[]) => arr.findIndex((x) => x.id === r.id) === i);
    if (list.length === 0) return;
    const serverPantrySet = new Set(
      (pantry ?? []).filter((p) => p.alwaysHave).map((p) => p.nameKey)
    );
    const weekly = await buildShoppingListForMany(list, settings, serverPantrySet);
    setShop(weekly);
    await saveShopToServer(weekly);
    setTab("shop");
  }

  async function toggleQueue(recipeId: string) {
    const logged = await isLoggedIn();
    const wasInQueue = queueIdSet.has(recipeId);

    if (!logged) {
      const existing = await db.queue.get(recipeId);
      if (existing) {
        await db.queue.delete(recipeId);
      } else {
        const maxPos = (await db.queue.toArray()).reduce((m, x) => Math.max(m, x.position ?? 0), 0);
        await db.queue.put({ recipeId, position: maxPos + 1, createdAt: new Date() });
      }
      await loadQueue();
      if (!wasInQueue) {
        const r = recipes.find((r) => r.id === recipeId);
        if (r) showToast(`Se ha añadido ${r.title[lang]} al plan`, "home");
      }
      return;
    }
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
    if (!wasInQueue) {
      const r = recipes.find((r) => r.id === recipeId);
      if (r) showToast(`Se ha añadido ${r.title[lang]} al plan`, "home");
    }
  }

  async function generateShop() {
    if (!today) return;
    const serverPantrySet = new Set(
      (pantry ?? []).filter((p) => p.alwaysHave).map((p) => p.nameKey)
    );
    const list = await buildShoppingList(today, settings ?? undefined, serverPantrySet);
    setShop(list);
    await saveShopToServer(list);
    setTab("shop");
  }

  async function cooked() {
    if (!today) return;
    await markCooked(today.id);
    const deductItems = today.ingredients.map((ing) => {
      const nameKey = normalizeIngredientName(ing.name[lang] || ing.name.es || "");
      const useDouble = settings?.doublePortions;
      const qty = useDouble ? (ing.qty4 ?? ing.qty ?? null) : (ing.qty2 ?? ing.qty ?? null);
      const unit = useDouble ? (ing.unit4 ?? ing.unit ?? null) : (ing.unit2 ?? ing.unit ?? null);
      return { nameKey, qty: qty != null ? Number(qty) : null, unit };
    }).filter((it) => it.nameKey);
    if (deductItems.length > 0) {
      try {
        const r = await fetch("/api/pantry/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: deductItems }),
        });
        if (r.ok) {
          const data = await r.json();
          const summary = (data.deducted ?? [])
            .filter((d: any) => d.oldQty != null && d.newQty != null && d.oldQty !== d.newQty)
            .map((d: any) => ({
              name: d.nameKey,
              qty: `${d.oldQty} → ${d.newQty} ${d.unit ?? ""}`.trim(),
            }));
          if (summary.length > 0) {
            setCookedSummary(summary);
            setTimeout(() => setCookedSummary(null), 6000);
          }
          await loadPantry();
        }
      } catch {}
    }
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

  async function loadPantry() {
    const r = await fetch("/api/pantry", { cache: "no-store" });
    if (!r.ok) return setPantry([]);
    setPantry(await r.json());
  }

  async function savePantryItem(p: { nameKey: string; qty?: number | null; unit?: string | null; alwaysHave?: boolean }) {
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    await loadPantry();
  }

  async function deletePantryItem(nameKey: string) {
    await fetch(`/api/pantry?nameKey=${encodeURIComponent(nameKey)}`, { method: "DELETE" });
    await loadPantry();
  }

  async function markShopAsDone() {
    if (!shop || shop.length === 0) return;
    setFinishingShop(true);
    const toAdd = shop.filter((x) => x.checked);
    if (toAdd.length > 0) {
      const items = toAdd.map((it) => ({
        nameKey: String(it.key).trim().toLowerCase(),
        qty: it.qty != null ? it.qty : null,
        unit: it.unit ? String(it.unit).trim().toLowerCase() : null,
      }));
      const r = await fetch("/api/pantry/batchAdd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) {
        alert("No se pudo pasar la compra a la despensa.");
        setFinishingShop(false);
        return;
      }
    }
    await fetch("/api/shop", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    }).catch(() => {});
    setShop(null);
    setShowShopDoneDialog(false);
    setFinishingShop(false);
    await loadPantry();
    setTab("profile");
  }

  async function onShareShop() {
    const text = buildShopShareText();
    const res = await shareTextOrCopy({ title: "Lista de la compra", text });
    if (res.ok && (res.mode === "copy" || res.mode === "copy-legacy")) {
      alert("Copiado");
    }
  }

  function buildShopShareText() {
    if (!shop?.length) return "Lista vacía";
    const lines = shop.map((it) => {
      const qty = it.qtyText
        ? it.qtyText
        : it.qty != null
          ? `${Math.round(it.qty * 100) / 100} ${it.unit ?? ""}`.trim()
          : "";
      return `- ${it.name}${qty ? ` (${qty})` : ""}`;
    });
    return `Lista de la compra (Misena)\n\n${lines.join("\n")}`;
  }

  async function shareTextOrCopy(opts: { title?: string; text: string }) {
    const { title, text } = opts;
    const navAny = navigator as any;
    if (navAny.share) {
      try {
        await navAny.share({ title: title ?? "Misena", text });
        return { ok: true, mode: "share" as const };
      } catch (e: any) {
        if (e?.name === "AbortError") return { ok: false, mode: "cancel" as const };
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true, mode: "copy" as const };
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return { ok: true, mode: "copy-legacy" as const };
    } catch {
      return { ok: false, mode: "fail" as const };
    }
  }

  function downloadTxt(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

  return {
    // Tab state
    tab, setTab,
    ready, settings,
    session, status,

    // Today
    today, todayLoading, todayFadeIn,
    cookedSummary,
    reroll, cooked, generateShop,

    // Recipes
    recipes, filteredRecipes,
    recipeQuery, setRecipeQuery,
    queueIdSet,
    toggleQueue,
    setTodayWithTransition,

    // Plan
    queue, loadQueue, moveQueue,
    generateWeeklyShop,

    // Shop
    shop, setShop,
    groupedShop, setGroupedShop,
    shopMsg, finishingShop,
    showShopDoneDialog, setShowShopDoneDialog,
    markShopAsDone, onShareShop, downloadTxt,

    // Pantry
    pantry, setPantry,
    pantryNewName, setPantryNewName,
    savePantryItem, deletePantryItem, loadPantry,

    // Settings
    toggleLang, setMode, updateNumber, updateCost, toggleDouble,

    // Modal + Toast
    detailRecipe, setDetailRecipe,
    toastMsg, setToastMsg, showToast,

    // i18n
    lang, t,
  };
}

export type AppShellState = ReturnType<typeof useAppShell>;
