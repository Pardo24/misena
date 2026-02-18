"use client";

import type { Settings, ShoppingItem } from "@/lib/types";
import type { ShopItem } from "@/components/appShellStyles";
import { qtyLabel, lineLabel, groupItems, groupsToText } from "@/components/appShellStyles";
import { Share2, Download, Check, Package } from "lucide-react";

type Props = {
  shop: ShoppingItem[] | null;
  setShop: React.Dispatch<React.SetStateAction<ShoppingItem[] | null>>;
  settings: Settings;
  groupedShop: boolean;
  setGroupedShop: React.Dispatch<React.SetStateAction<boolean>>;
  shopMsg: string | null;
  finishingShop: boolean;
  showShopDoneDialog: boolean;
  setShowShopDoneDialog: (v: boolean) => void;
  markShopAsDone: () => void;
  t: Record<string, string>;
  onShareShop: () => void;
  downloadTxt: (filename: string, text: string) => void;
  pantry: any[] | null;
  setTab: (t: any) => void;
  loadPantry: () => Promise<void>;
};

function renderShopItem(item: ShopItem, setShop: React.Dispatch<React.SetStateAction<ShoppingItem[] | null>>) {
  return (
    <li key={item.key} className="flex items-center justify-between gap-3 py-3 border-b border-warm-100">
      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => {
            const next = !item.checked;
            setShop((prev) =>
              prev ? prev.map((x) => x.key === item.key ? { ...x, checked: next } : x) : prev
            );
            fetch("/api/shop/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: item.key, checked: next }),
            }).catch(() => {});
          }}
        />
        <span className={`font-bold transition-all ${item.checked ? "line-through text-warm-400" : "text-warm-800"}`}>
          {item.name}
          {qtyLabel(item as any) ? (
            <span className="ml-2 font-bold text-warm-400 text-sm">{qtyLabel(item as any)}</span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

export function ShopTab({
  shop, setShop, settings, groupedShop, setGroupedShop,
  shopMsg, finishingShop, showShopDoneDialog, setShowShopDoneDialog,
  markShopAsDone, t, onShareShop, downloadTxt, pantry, setTab, loadPantry,
}: Props) {
  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
      <h2 className="text-xl font-extrabold text-warm-900 mb-1">{t.shop}</h2>

      {!shop ? (
        <div className="text-warm-400 text-sm py-4">Genera la lista desde &quot;Hoy&quot; o desde &quot;Plan&quot;.</div>
      ) : (
        <>
          <p className="text-warm-400 text-sm mb-3">
            Consolidado. {settings.doublePortions ? "Incluye raciones dobles (x2)." : ""}
          </p>

          {/* Top actions */}
          <div className="flex gap-2 items-center justify-between flex-wrap mb-3">
            <button
              type="button"
              className={`px-3 py-2 rounded-full border font-bold text-sm cursor-pointer ${
                groupedShop
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : "border-warm-200 bg-white text-warm-600"
              }`}
              onClick={() => setGroupedShop((v) => !v)}
            >
              {groupedShop ? "Agrupado" : "Agrupar por tipos"}
            </button>

            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-warm-200 bg-white text-warm-600 text-sm font-bold hover:border-warm-400 cursor-pointer"
                onClick={() => {
                  const groups = groupItems(shop as any);
                  const text = groupedShop
                    ? groupsToText(groups)
                    : (shop as any[]).map((it) => `- ${lineLabel(it)}`).join("\n");
                  downloadTxt(
                    `misena-lista-compra-${new Date().toISOString().slice(0, 10)}.txt`,
                    text
                  );
                }}
              >
                <Download size={14} /> Descargar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 cursor-pointer border-0"
                onClick={onShareShop}
              >
                <Share2 size={14} /> Compartir
              </button>
            </div>
          </div>

          {shopMsg && <div className="text-warm-400 text-sm mb-2">{shopMsg}</div>}

          {/* List */}
          {groupedShop ? (
            <>
              {groupItems(shop as any).map((g) => (
                <div key={g.key}>
                  <div className="font-black text-sm text-warm-600 mt-4 mb-1 uppercase tracking-wide">{g.title}</div>
                  <ul className="m-0 p-0 list-none">
                    {g.items.map((item) => renderShopItem(item, setShop))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <ul className="m-0 p-0 list-none">
              {(shop as any[]).map((item) => renderShopItem(item, setShop))}
            </ul>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap mt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
              onClick={() => setShowShopDoneDialog(true)}
              disabled={finishingShop || !shop?.length}
            >
              <Check size={16} /> Compra hecha
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[44px]"
              onClick={async () => {
                if (!shop?.length) return;
                const finishing = true;
                const items = shop.map((it) => ({
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
                  return;
                }
                await fetch("/api/shop", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items: [] }),
                }).catch(() => {});
                setShop(null);
                await loadPantry();
                setTab("profile");
              }}
              disabled={finishingShop || !shop?.length}
            >
              <Package size={16} /> Todo a despensa
            </button>
          </div>
          <p className="text-warm-400 text-xs mt-2">
            &quot;Compra hecha&quot; pasa los marcados. &quot;Todo a despensa&quot; pasa todos.
          </p>

          {/* Confirmation dialog */}
          {showShopDoneDialog && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] grid place-items-center p-4"
              onClick={() => !finishingShop && setShowShopDoneDialog(false)}
            >
              <div
                className="w-full max-w-[440px] bg-white rounded-2xl p-5 shadow-fab"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="font-black text-lg mb-2">Confirmar compra</div>
                <div className="text-sm text-warm-500 mb-3">
                  Estos items se añadirán a tu despensa:
                </div>
                <div className="max-h-[300px] overflow-y-auto mb-4">
                  <ul className="m-0 p-0 list-none">
                    {shop.filter(x => x.checked).map((it) => (
                      <li key={it.key} className="flex justify-between gap-2 py-1.5 border-b border-warm-100">
                        <span className="font-bold text-warm-800">{it.name}</span>
                        <span className="text-warm-500 text-sm">{qtyLabel(it as any)}</span>
                      </li>
                    ))}
                  </ul>
                  {shop.filter(x => x.checked).length === 0 && (
                    <div className="text-warm-400 text-sm py-2">Marca los items que hayas comprado.</div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm cursor-pointer min-h-[44px]"
                    onClick={() => setShowShopDoneDialog(false)}
                    disabled={finishingShop}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
                    onClick={markShopAsDone}
                    disabled={finishingShop}
                  >
                    {finishingShop ? "Guardando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
