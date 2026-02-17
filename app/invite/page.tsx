import { Suspense } from "react";
import InviteClient from "./InviteClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
      <InviteClient />
    </Suspense>
  );
}
