"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function InviteClient() {
  const router = useRouter();
  const params = useSearchParams();

  const token = useMemo(() => params.get("token") || "", [params]);

  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMsg("Falta el token de invitación.");
      return;
    }

    (async () => {
      setStatus("busy");
      setMsg("Aceptando invitación…");

      try {
        const r = await fetch("/api/household/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await r.json().catch(() => ({} as any));

        if (!r.ok) {
          const code = String(data?.error || "");

          const human =
            code === "UNAUTHORIZED"
              ? "Necesitas iniciar sesi\u00f3n para aceptar esta invitaci\u00f3n."
              : code === "invalid token" || code === "INVALID_OR_EXPIRED"
                ? "Esta invitaci\u00f3n no existe o ya ha expirado (48h)."
                : code === "expired"
                  ? "Esta invitaci\u00f3n ha expirado (48h)."
                  : code === "not pending"
                    ? "Esta invitaci\u00f3n ya fue usada o revocada."
                    : code === "email mismatch" || code === "EMAIL_MISMATCH"
                      ? "Este link es para otro email. Inicia sesi\u00f3n con el email correcto."
                      : "No se pudo aceptar la invitaci\u00f3n.";

          setStatus("err");
          setMsg(human);
          return;
        }

        setStatus("ok");
        setMsg("Invitación aceptada ✅ Redirigiendo…");

        // te mando a la app (o a /account si quieres)
        setTimeout(() => router.replace("/"), 800);
      } catch {
        setStatus("err");
        setMsg("Error de red. Prueba otra vez.");
      }
    })();
  }, [token, router]);

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.brandRow}>
          <button type="button" style={s.backBtn} onClick={() => router.push("/")}>
            ← Inicio
          </button>
          <div style={s.brand}>Misena</div>
          <div style={{ width: 70 }} />
        </div>

        <h1 style={s.h1}>Invitación a household</h1>
        <p style={s.p}>
          {status === "busy"
            ? "Estamos vinculando tu cuenta al household…"
            : "Acepta la invitación para compartir plan y lista de la compra."}
        </p>

        {status === "ok" && <div style={s.ok}>{msg}</div>}
        {status === "err" && (
          <div style={s.bad}>
            {msg}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={s.primary} onClick={() => router.push("/auth?mode=login")}>
                Login
              </button>
              <button style={s.ghost} onClick={() => router.push("/")}>
                Volver
              </button>
            </div>
          </div>
        )}

        {status === "busy" && <div style={s.muted}>Un momento…</div>}
        {status === "idle" && <div style={s.muted}>Preparando…</div>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    padding: 16,
    background: "#f6f6f6",
    display: "grid",
    placeItems: "start center",
    color: "#111",
  },
  card: {
    width: "min(520px, 100%)",
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 20,
    padding: 18,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  backBtn: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #eee",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  brand: { fontWeight: 900, letterSpacing: -0.2 },
  h1: { margin: "6px 0 6px", fontSize: 20, fontWeight: 900 },
  p: { margin: "0 0 12px", color: "#555", fontSize: 14, lineHeight: 1.35 },
  muted: { color: "#666", fontSize: 13, lineHeight: 1.35 },
  primary: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ghost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e5e5e5",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ok: {
    background: "#ecfdf3",
    border: "1px solid #a6f4c5",
    color: "#027a48",
    padding: "10px 12px",
    borderRadius: 14,
    fontSize: 13,
  },
  bad: {
    background: "#fff5f5",
    border: "1px solid #ffd6d6",
    color: "#b42318",
    padding: "10px 12px",
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.35,
  },
};
