"use client";

import { useAppShell } from "@/components/hooks/useAppShell";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { HomeTab } from "@/components/tabs/HomeTab";
import { RecipesTab } from "@/components/tabs/RecipesTab";
import { ShopTab } from "@/components/tabs/ShopTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import { Toast } from "@/components/Toast";

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

      <main className="px-3 py-4 pb-28 w-full overflow-hidden max-w-[900px] mx-auto">
        {s.tab === "home" && (
          <HomeTab
            session={s.session}
            today={s.today} todayLoading={s.todayLoading}
            reroll={s.reroll}
            queue={s.queue} queueIdSet={s.queueIdSet}
            toggleQueue={s.toggleQueue}
            generateWeeklyShop={s.generateWeeklyShop}
            moveQueue={s.moveQueue} loadQueue={s.loadQueue}
            shop={s.shop} pantry={s.pantry}
            setTab={s.setTab} setDetailRecipe={s.setDetailRecipe}
            lang={s.lang} t={s.t}
          />
        )}
        {s.tab === "recipes" && (
          <RecipesTab
            filteredRecipes={s.filteredRecipes} recipeQuery={s.recipeQuery}
            setRecipeQuery={s.setRecipeQuery} queueIdSet={s.queueIdSet}
            queue={s.queue} lang={s.lang} t={s.t} toggleQueue={s.toggleQueue}
            setDetailRecipe={s.setDetailRecipe} setTab={s.setTab}
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
        {s.tab === "profile" && (
          <ProfileTab
            session={s.session} status={s.status}
            pantry={s.pantry} setPantry={s.setPantry}
            pantryNewName={s.pantryNewName} setPantryNewName={s.setPantryNewName}
            savePantryItem={s.savePantryItem} deletePantryItem={s.deletePantryItem}
            settings={s.settings}
            toggleLang={s.toggleLang} setMode={s.setMode}
            updateNumber={s.updateNumber} updateCost={s.updateCost}
            toggleDouble={s.toggleDouble} t={s.t}
          />
        )}
      </main>

      <BottomNav tab={s.tab} setTab={s.setTab} t={s.t} />

      {/* Recipe Detail Modal */}
      {s.detailRecipe && (
        <RecipeDetailModal
          recipe={s.detailRecipe}
          settings={s.settings}
          lang={s.lang}
          inQueue={s.queueIdSet.has(s.detailRecipe.id)}
          onToggleQueue={() => s.toggleQueue(s.detailRecipe!.id)}
          onCook={async () => {
            s.setTodayWithTransition(s.detailRecipe);
            s.setDetailRecipe(null);
            s.setTab("home");
          }}
          onClose={() => s.setDetailRecipe(null)}
        />
      )}

      {/* Toast */}
      <Toast
        msg={s.toastMsg}
        onDismiss={() => s.setToastMsg(null)}
        onAction={(tab) => s.setTab(tab)}
      />
    </div>
  );
}
