"use client";

import { useAppShell } from "@/components/hooks/useAppShell";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { TodayTab } from "@/components/tabs/TodayTab";
import { RecipesTab } from "@/components/tabs/RecipesTab";
import { PlanTab } from "@/components/tabs/PlanTab";
import { ShopTab } from "@/components/tabs/ShopTab";
import { PantryTab } from "@/components/tabs/PantryTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";

export function AppShell() {
  const s = useAppShell();

  if (!s.ready || !s.settings) {
    return (
      <div className="min-h-screen bg-warm-50 grid place-items-center">
        <div className="animate-pulse text-warm-400 font-bold">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 text-warm-900">
      <Header status={s.status} session={s.session} tab={s.tab} />

      <main className="px-3 py-4 pb-28 grid place-items-start-center">
        {s.tab === "today" && (
          <TodayTab
            today={s.today} todayLoading={s.todayLoading} todayFadeIn={s.todayFadeIn}
            settings={s.settings} lang={s.lang} t={s.t} shop={s.shop}
            cookedSummary={s.cookedSummary} reroll={s.reroll}
            generateShop={s.generateShop} cooked={s.cooked}
          />
        )}
        {s.tab === "recipes" && (
          <RecipesTab
            filteredRecipes={s.filteredRecipes} recipeQuery={s.recipeQuery}
            setRecipeQuery={s.setRecipeQuery} queueIdSet={s.queueIdSet}
            queue={s.queue} lang={s.lang} t={s.t} toggleQueue={s.toggleQueue}
            setTodayWithTransition={s.setTodayWithTransition} setTab={s.setTab}
          />
        )}
        {s.tab === "plan" && (
          <PlanTab
            queue={s.queue} recipeQuery={s.recipeQuery} setRecipeQuery={s.setRecipeQuery}
            lang={s.lang} generateWeeklyShop={s.generateWeeklyShop}
            moveQueue={s.moveQueue} loadQueue={s.loadQueue}
            setTodayWithTransition={s.setTodayWithTransition} setTab={s.setTab}
          />
        )}
        {s.tab === "shop" && (
          <ShopTab
            shop={s.shop} setShop={s.setShop} settings={s.settings}
            groupedShop={s.groupedShop} setGroupedShop={s.setGroupedShop}
            shopMsg={s.shopMsg} finishingShop={s.finishingShop}
            showShopDoneDialog={s.showShopDoneDialog} setShowShopDoneDialog={s.setShowShopDoneDialog}
            markShopAsDone={s.markShopAsDone} t={s.t} onShareShop={s.onShareShop}
            downloadTxt={s.downloadTxt} pantry={s.pantry} setTab={s.setTab}
            loadPantry={s.loadPantry}
          />
        )}
        {s.tab === "pantry" && (
          <PantryTab
            pantry={s.pantry} setPantry={s.setPantry}
            pantryNewName={s.pantryNewName} setPantryNewName={s.setPantryNewName}
            savePantryItem={s.savePantryItem} deletePantryItem={s.deletePantryItem} t={s.t}
          />
        )}
        {s.tab === "settings" && (
          <SettingsTab
            settings={s.settings} t={s.t} toggleLang={s.toggleLang}
            setMode={s.setMode} updateNumber={s.updateNumber}
            updateCost={s.updateCost} toggleDouble={s.toggleDouble}
          />
        )}
      </main>

      <BottomNav tab={s.tab} setTab={s.setTab} t={s.t} />
    </div>
  );
}
