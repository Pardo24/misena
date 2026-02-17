import { Suspense } from "react";
import AuthClient from "./AuthClient";

export default function Page({
  searchParams,
}: {
  searchParams: { mode?: string; error?: string };
}) {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
      <AuthClient searchParams={searchParams} />
    </Suspense>
  );
}
