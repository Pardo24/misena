"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { Recipe } from "@/lib/types";

export function ImportHelloFreshPdf({
  onImported,
}: {
  onImported?: (recipe: Recipe) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function runImport() {
  if (!file) return;

  setErr("");
  setLoading(true);

  try {
    console.log("Import start:", file.name, file.type, file.size);

    const fd = new FormData();
    fd.append("pdf", file);

   const res = await fetch("/api/hellofresh", {
      method: "POST",
      body: fd,
    });


    let data: any = null;
    try {
      data = await res.json();
    } catch {
      const txt = await res.text();
      throw new Error(txt || "Respuesta no-JSON del servidor");
    }

    console.log("Import response:", res.status, data);

    if (!res.ok) {
      throw new Error(data?.detail || data?.error || "Error importando PDF");
    }

    const recipe = data.recipe;
    await db.recipes.put(recipe);

    onImported?.(recipe);
    setFile(null);

  } catch (e: any) {
    console.error("Import error:", e);
    setErr(e?.message ?? "Error importando PDF");
  } finally {
    setLoading(false);
  }
}

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Importar PDF (HelloFresh)</div>

      <input 
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={runImport}
          disabled={!file || loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: loading ? "#444" : "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Importando..." : "Importar"}
        </button>

        <div style={{ color: "#666", fontSize: 13 }}>
          {file ? `Archivo: ${file.name}` : "Selecciona un PDF"}
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 10, color: "#b00020", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}
    </div>
  );
}
