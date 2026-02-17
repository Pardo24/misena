"use client";
import { useRouter } from "next/navigation";

export default function HomeLauncher() {
  const router = useRouter();

  const items = [
    { icon: "🍽️", title: "Hoy", subtitle: "Qué cocino hoy", href: "/today" },
    { icon: "🗓️", title: "Mi Plan", subtitle: "Semana actual", href: "/plan" },
    { icon: "🛒", title: "Compra", subtitle: "Lista semanal", href: "/shop" },
    { icon: "📚", title: "Recetas", subtitle: "Explorar", href: "/recipes" },
    { icon: "🧂", title: "Despensa", subtitle: "Inventario", href: "/pantry" },
    { icon: "👤", title: "Perfil", subtitle: "Cuenta", href: "/account" },
  ];

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <div style={s.brand}>Misena</div>
      </header>

      <div style={s.grid}>
        {items.map((it) => (
          <button
            key={it.href}
            style={s.card}
            onClick={() => router.push(it.href)}
          >
            <div style={s.icon}>{it.icon}</div>
            <div style={s.title}>{it.title}</div>
            <div style={s.sub}>{it.subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    padding: 16,
    background: "#f6f6f6",
  },
  header: {
    marginBottom: 20,
  },
  brand: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.3,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: 16,
    minHeight: 110,
    border: "1px solid #eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  icon: {
    fontSize: 26,
    marginBottom: 6,
  },
  title: {
    fontWeight: 900,
    fontSize: 15,
  },
  sub: {
    fontSize: 12,
    color: "#666",
  },
};
