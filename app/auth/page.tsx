"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();

  const initialMode = (params.get("mode") as Mode) || "login";
  const [mode, setMode] = useState<Mode>(initialMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const authErrorParam = params.get("error"); // string | null


  useEffect(() => {
    if (!authErrorParam) return;

    const msg =
        authErrorParam === "OAuthCallback" ? "Has cancelado el login con Google." :
        authErrorParam === "OAuthAccountNotLinked" ? "Ese email ya existe con otro método. Entra con el método original." :
        "No se pudo iniciar sesión. Prueba otra vez.";

    setAuthError(msg);
    }, [authErrorParam]);

  const title = useMemo(() => (mode === "login" ? "Bienvenido" : "Crear cuenta"), [mode]);
  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Entra para guardar y compartir tu planificación."
        : "Crea una cuenta para guardar y compartir tu planificación.",
    [mode]
  );

  function switchMode(next: Mode) {
    setAuthError(null);
    setMode(next);
    router.replace(`/auth?mode=${next}`);
  }

  function getReturnUrl() {
    const tab = sessionStorage.getItem("mise:returnTab");
    if (!tab) return "/";
    sessionStorage.removeItem("mise:returnTab");
    return `/?tab=${encodeURIComponent(tab)}`;
    }

    async function onGoogle() {
    setAuthError(null);
    setBusy("google");
    await signIn("google", { callbackUrl: getReturnUrl() });
    setBusy(null);
    }

    function goHome() {
    router.push(getReturnUrl());
    }

  async function onEmail() {
    setAuthError(null);
    setBusy("email");

    const e = email.trim().toLowerCase();
    if (!e) {
      setAuthError("Escribe un email.");
      setBusy(null);
      return;
    }
    if (password.length < 8) {
      setAuthError("El password debe tener mínimo 8 caracteres.");
      setBusy(null);
      return;
    }

    try {
      if (mode === "signup") {
        // 1) crear usuario
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || null, email: e, password }),
        });

        if (!res.ok) {
          const msg = await safeText(res);
          if (res.status === 409) setAuthError("Ese email ya existe. Prueba a iniciar sesión.");
          else setAuthError(msg || "No se pudo crear la cuenta.");
          setBusy(null);
          return;
        }
      }

      // 2) iniciar sesión con credentials
      const res = await signIn("credentials", {
        email: e,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setAuthError("Email o password incorrectos.");
        setBusy(null);
        return;
      }

      router.push(getReturnUrl());
    } catch (err) {
      setAuthError("Error inesperado.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
       <header style={s.authHeader}>
            <button type="button" style={s.authBack} onClick={goHome}>
                ←
            </button>

            <div style={s.authBrand}>Misena</div>

            <div style={{ width: 70 }} /> {/* spacer simétrico */}
        </header>

        <h1 style={s.h1}>{title}</h1>
        <p style={s.p}>{subtitle}</p>

        <button
            type="button"
            style={s.btnGoogle}
            onClick={onGoogle}
            disabled={busy !== null}
            >
            <span style={s.googleIcon} aria-hidden>
                {/* Google "G" SVG (simple y fiable) */}
                <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.9 6.1 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.2-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.2 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.9 6.1 29.7 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.3 0 10.2-2 13.9-5.2l-6.4-5.2C29.6 35.9 26.9 36 24 36c-5.4 0-9.9-3.5-11.5-8.3l-6.6 5.1C9.2 39.8 16 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.2-5.8 6.6l.1.1 6.4 5.2C39.8 36.2 44 30.7 44 24c0-1.1-.1-2.2-.4-3.5z"/>
                </svg>
            </span>
            <span>Entrar con Google</span>
        </button>


        <div style={s.dividerRow}>
          <div style={s.dividerLine} />
          <div style={s.dividerText}>o</div>
          <div style={s.dividerLine} />
        </div>

        {mode === "signup" && (
          <div style={s.field}>
            <label style={s.label}>Nombre (opcional)</label>
            <input
              style={s.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dani"
              autoComplete="name"
            />
          </div>
        )}

        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        {authError && <div style={s.alert}>{authError}</div>}

        <button style={s.btnPrimary} onClick={onEmail} disabled={busy !== null}>
          {busy === "email"
            ? "Procesando…"
            : mode === "login"
              ? "Entrar"
              : "Crear cuenta"}
        </button>

        <div style={s.footerRow}>
            {mode === "login" ? (
                <button
                type="button"
                style={s.switchBtn}
                onClick={() => switchMode("signup")}
                disabled={busy !== null}
                >
                Crear cuenta
                </button>
            ) : (
                <button
                type="button"
                style={s.switchBtn}
                onClick={() => switchMode("login")}
                disabled={busy !== null}
                >
                Iniciar sesión
                </button>
            )}
            </div>


        <button
            type="button"
            style={s.guestLink}
            onClick={() => router.push(getReturnUrl())}
            disabled={busy !== null}
            >
            Continuar como invitado
        </button>


        <div style={s.note}>
          En modo invitado, los datos se guardan solo en este dispositivo.
        </div>
      </div>
    </div>
  );
}

async function safeText(res: Response) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%)",
    color: "#111",
  },
  authHeader: {
  width: "min(520px, 100%)",
  margin: "0 auto",
  padding: "14px 12px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
},

authBrand: {
  fontWeight: 800,
  letterSpacing: -0.2,
},

authBack: {
  height: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #eee",
  background: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
},

  card: {
    width: "min(420px, 100%)",
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  },
  brandRow: { display: "flex", gap: 12, alignItems: "center", marginBottom: 14 },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid #eee",
    background: "#fafafa",
    fontSize: 22,
  },
  brandTitle: { fontWeight: 900, fontSize: 18, lineHeight: 1.1 },
  brandTag: { color: "#666", fontSize: 13, marginTop: 2 },
  h1: { margin: "6px 0 6px", fontSize: 22, fontWeight: 900 },
  p: { margin: "0 0 14px", color: "#555", fontSize: 14, lineHeight: 1.35 },
btnGoogle: {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #e5e5e5",
  background: "#fff",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
},

googleIcon: {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
},

guestLink: {
  marginTop: 10,
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#111",
  fontSize: 13,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  cursor: "pointer",
  opacity: 0.9,
},
  dividerRow: { display: "flex", alignItems: "center", gap: 10, margin: "14px 0" },
  dividerLine: { height: 1, background: "#eee", flex: 1 },
  dividerText: { color: "#888", fontSize: 13 },

  field: { display: "grid", gap: 6, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: 700, color: "#444" },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid #ddd",
    background: "#fafafa",
    outline: "none",
    fontSize: 14,
  },

  btnPrimary: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 6,
  },
  btnGhost: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #eee",
    background: "#fafafa",
    color: "#111",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 10,
  },

  footerRow: { marginTop: 10, display: "flex", justifyContent: "center" },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#111",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
  },
  errorBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: "10px 12px",
    borderRadius: 14,
    background: "#fff5f5",
    border: "1px solid #ffd6d6",
    color: "#b00020",
    fontSize: 13,
    lineHeight: 1.35,
  },
  note: { marginTop: 10, color: "#777", fontSize: 12, lineHeight: 1.35 },


switchBtn: {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #e5e5e5",
  background: "#fff",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
},
alert: {
  background: "#fff5f5",
  border: "1px solid #ffd6d6",
  color: "#b42318",
  padding: "10px 12px",
  borderRadius: 14,
  fontSize: 13,
  marginBottom: 10,
},
};
