"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { Recipe } from "@/lib/types";

export function ImportHelloFreshPdf({ onDone }: { onDone: () => void | Promise<void> }) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [inputKey, setInputKey] = useState(0);

 async function runImport() {
    try {
      setErr("");
      setLoading(true);

      const fd = new FormData();
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/hellofresh", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());

      setFiles([]);
      onDone();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Importar PDF (HelloFresh)</div>

     <input
        key={inputKey}
        type="file"
        accept="application/pdf"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={runImport}
          disabled={files.length === 0 || loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: loading ? "#444" : "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Importando..." : `Importar (${files.length})`}
        </button>

        <div style={{ color: "#666", fontSize: 13 }}>
          {files.length > 0
            ? `Archivos: ${files.map(f => f.name).join(", ")}`
            : "Selecciona uno o varios PDFs"}
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
