"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Header } from "@/components/Header";
import { ArrowLeft, Copy, Share2, UserPlus, XCircle } from "lucide-react";

type Invite = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED";
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string | null;
};
type Member = { id: string; email: string; name?: string | null };
type HouseholdApi = {
  id: string;
  name?: string | null;
  members: Array<{
    userId: string;
    role: "OWNER" | "MEMBER";
    user: { id: string; email: string | null; name: string | null };
  }>;
  invites: Invite[];
};

type InviteLinkMap = Record<string, string>;

export default function AccountPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"OWNER" | "MEMBER" | null>(null);
  const [inviteLinks, setInviteLinks] = useState<InviteLinkMap>({});
  const [acceptUrls, setAcceptUrls] = useState<Record<string, string>>({});

  const isOwner = myRole === "OWNER";

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const data = await r.json();
      setMe(data);

      if (data.loggedIn) {
        const h = await fetch("/api/household", { cache: "no-store" });

        if (!h.ok) {
          setHouseholdId(null);
          setMyRole(null);
          setMembers([]);
          setInvites([]);
          setLoading(false);
          return;
        }

        const hd = (await h.json()) as HouseholdApi;

        setHouseholdId(hd.id);

        const mine = hd.members.find((m) => m.userId === (session?.user as any)?.id);
        setMyRole(mine?.role ?? null);

        setMembers(
          (hd.members ?? []).map((m) => ({
            id: m.user.id,
            email: m.user.email ?? "",
            name: m.user.name,
          }))
        );

        setInvites(
          (hd.invites ?? []).map((i) => ({
            id: i.id,
            email: i.email,
            status: i.status,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
            acceptedAt: i.acceptedAt,
          }))
        );
      } else {
        setHouseholdId(null);
        setMyRole(null);
        setMembers([]);
        setInvites([]);
      }
    } catch {
      setErr("No se pudieron cargar tus datos.");
    } finally {
      setLoading(false);
    }
  }

  function loadInviteLinks(): InviteLinkMap {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("mise:inviteLinks") || "{}");
    } catch {
      return {};
    }
  }

  function saveInviteLinks(map: InviteLinkMap) {
    localStorage.setItem("mise:inviteLinks", JSON.stringify(map));
  }

  useEffect(() => {
    loadAll();
    setInviteLinks(loadInviteLinks());
  }, []);

  async function createHouseholdIfNeeded() {
    setMsg(null); setErr(null);

    const r = await fetch("/api/household/ensure", { method: "POST" });

    if (!r.ok) {
      setErr((await r.text()) || "No se pudo crear el household.");
      return;
    }

    await loadAll();
    setMsg("Household listo");
  }

  async function invite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setMsg(null); setErr(null);

    const r = await fetch("/api/household/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!r.ok) {
      const body = await r.json().catch(() => null);
      setErr(body?.message || "No se pudo invitar.");
      return;
    }

    const data = await r.json();

    setInviteEmail("");

    if (data?.invite?.id && data?.acceptUrl) {
      setAcceptUrls(prev => ({ ...prev, [data.invite.id]: data.acceptUrl }));
    }

    await loadAll();
    setMsg("Invitacion creada (link listo para compartir)");
  }

  async function revoke(inviteId: string) {
    setMsg(null); setErr(null);
    const r = await fetch("/api/household/invites/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    if (!r.ok) { setErr("No se pudo revocar."); return; }

    setInviteLinks((prev) => {
      const next = { ...prev };
      delete next[inviteId];
      saveInviteLinks(next);
      return next;
    });

    await loadAll();
    setMsg("Invitacion revocada.");
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

  const loggedIn = !!session;

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-50">
        <Header status={status} session={session} tab="today" />
        <div className="max-w-[520px] mx-auto px-4 py-6">
          <div className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card text-warm-500 text-center py-8">
            Cargando...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <Header status={status} session={session} tab="today" />

      <div className="max-w-[520px] mx-auto px-4 py-6 grid gap-4">
        {/* Back button */}
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-bold text-warm-600 hover:text-primary-600 cursor-pointer bg-transparent border-0 w-fit"
          onClick={() => router.push("/")}
        >
          <ArrowLeft size={16} /> Inicio
        </button>

        <h1 className="text-2xl font-extrabold text-warm-900">Cuenta</h1>
        <p className="text-warm-500 text-sm -mt-2">Gestiona tu household, invitaciones y favoritos.</p>

        {msg && (
          <div className="bg-primary-50 border border-primary-200 text-primary-800 px-4 py-3 rounded-xl text-sm font-semibold">
            {msg}
          </div>
        )}
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">
            {err}
          </div>
        )}

        {/* Account section */}
        <section className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
          <h2 className="text-base font-extrabold text-warm-900 mb-3">Tu cuenta</h2>

          {!loggedIn ? (
            <>
              <p className="text-warm-500 text-sm mb-3">Estas en modo invitado. Los datos se guardan solo en este dispositivo.</p>
              <button
                className="w-full px-4 py-3 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0"
                onClick={() => router.push("/auth?mode=login")}
              >
                Login
              </button>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <div className="flex justify-between items-center gap-3 py-2">
                  <span className="text-sm font-bold text-warm-600">Email</span>
                  <span className="text-sm text-warm-900 truncate">{session.user?.email}</span>
                </div>
                <div className="flex justify-between items-center gap-3 py-2">
                  <span className="text-sm font-bold text-warm-600">Nombre</span>
                  <span className="text-sm text-warm-900 truncate">{session.user?.name ?? "—"}</span>
                </div>
              </div>

              <div className="mt-3">
                <button
                  className="px-4 py-2.5 rounded-xl border border-warm-200 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Cerrar sesion
                </button>
              </div>
            </>
          )}
        </section>

        {/* Household section */}
        {loggedIn && (
          <section className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
            <h2 className="text-base font-extrabold text-warm-900 mb-3">Household</h2>

            {householdId ? (
              <>
                <h3 className="text-sm font-extrabold text-warm-700 uppercase tracking-wide mb-2">Miembros</h3>
                <div className="grid gap-2 mb-4">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-warm-100 bg-warm-50">
                      <div className="min-w-0">
                        <div className="font-bold text-warm-800 text-sm truncate">{m.name ?? m.email}</div>
                        <div className="text-xs text-warm-500 truncate">{m.email}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {isOwner ? (
                  <>
                    <h3 className="text-sm font-extrabold text-warm-700 uppercase tracking-wide mb-2">Invitar</h3>
                    <div className="flex gap-2 items-center">
                      <input
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email (opcional)"
                        inputMode="email"
                        className="flex-1 px-3 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                      />
                      <button
                        className="px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 whitespace-nowrap inline-flex items-center gap-1.5"
                        onClick={invite}
                      >
                        <UserPlus size={14} />
                        {inviteEmail.trim() ? "Invitar" : "Crear link"}
                      </button>
                    </div>
                    <p className="text-warm-400 text-xs mt-1.5">
                      Deja el email vacio para crear un link que cualquiera pueda usar.
                    </p>
                  </>
                ) : (
                  <p className="text-warm-500 text-sm">Solo el owner puede invitar.</p>
                )}

                {isOwner && invites.length > 0 && (
                  <>
                    <h3 className="text-sm font-extrabold text-warm-700 uppercase tracking-wide mt-4 mb-2">Invitaciones</h3>
                    <div className="grid gap-2">
                      {invites.map((inv) => {
                        const url = acceptUrls[inv.id];
                        const isPending = inv.status === "PENDING";
                        const isAccepted = inv.status === "ACCEPTED";

                        let timeLeft = "";
                        if (isPending && inv.expiresAt) {
                          const ms = new Date(inv.expiresAt).getTime() - Date.now();
                          if (ms > 0) {
                            const h = Math.floor(ms / 3600000);
                            timeLeft = h > 0 ? `${h}h restantes` : "< 1h";
                          }
                        }

                        return (
                          <div key={inv.id} className="p-3 rounded-xl border border-warm-200 bg-white">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-warm-800 text-sm truncate">
                                  {inv.email || "(link abierto)"}
                                </div>
                                <div className="flex gap-2 items-center mt-1.5">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${
                                    isPending
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-primary-50 text-primary-700 border-primary-200"
                                  }`}>
                                    {isPending ? "Pendiente" : "Aceptada"}
                                  </span>
                                  {timeLeft && <span className="text-xs text-warm-400">{timeLeft}</span>}
                                </div>
                              </div>

                              {isPending && (
                                <div className="flex gap-1.5">
                                  {url && (
                                    <button
                                      type="button"
                                      title="Compartir"
                                      className="w-8 h-8 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-primary-600 hover:border-primary-300"
                                      onClick={async () => {
                                        const res = await shareTextOrCopy({
                                          title: "Invitacion a household (Misena)",
                                          text: `Unete a mi household en Misena:\n${url}`,
                                        });
                                        if (res.ok && (res.mode === "copy" || res.mode === "copy-legacy")) alert("Copiado");
                                      }}
                                    >
                                      <Share2 size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title="Revocar"
                                    className="w-8 h-8 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-red-500 hover:border-red-300"
                                    onClick={() => revoke(inv.id)}
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-warm-500 text-sm mb-3">No tienes household todavia.</p>
                <button
                  className="w-full px-4 py-3 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0"
                  onClick={createHouseholdIfNeeded}
                >
                  Crear mi household
                </button>
              </>
            )}
          </section>
        )}

        {/* Favorites section */}
        <section className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
          <h2 className="text-base font-extrabold text-warm-900 mb-2">Favoritos</h2>
          <p className="text-warm-500 text-sm">
            (Siguiente paso) Guardar recetas favoritas para tenerlas siempre a mano.
          </p>
        </section>
      </div>
    </div>
  );
}
