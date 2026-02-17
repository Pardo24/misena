import { Suspense } from "react";
import AppShellClient from "@/components/AppShellClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
      <AppShellClient />
    </Suspense>
  );
}
