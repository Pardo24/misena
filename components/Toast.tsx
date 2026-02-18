"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Tab } from "@/components/appShellStyles";

export type ToastMsg = {
  text: string;
  action?: { label: string; tab: Tab };
} | null;

type Props = {
  msg: ToastMsg;
  onDismiss: () => void;
  onAction?: (tab: Tab) => void;
};

export function Toast({ msg, onDismiss, onAction }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (msg) {
      // Fade in
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [msg]);

  if (!msg) return null;

  return (
    <div
      className={`fixed left-3 right-3 z-40 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      style={{ bottom: "5.5rem" }}
    >
      <div className="max-w-[500px] mx-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-warm-800 text-white shadow-fab">
        <Check size={16} className="text-primary-400 shrink-0" />
        <span className="flex-1 text-sm font-semibold">{msg.text}</span>
        {msg.action && onAction && (
          <button
            type="button"
            className="px-3 py-1 rounded-lg bg-white/20 text-white text-xs font-bold cursor-pointer border-0 hover:bg-white/30 whitespace-nowrap"
            onClick={() => {
              onAction(msg.action!.tab);
              onDismiss();
            }}
          >
            {msg.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
