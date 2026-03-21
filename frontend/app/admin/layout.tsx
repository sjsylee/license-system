"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";

function AuthSkeleton() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sider skeleton */}
      <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid rgba(0,0,0,0.06)" }} />
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: "28px 28px" }}>
        <div style={{ height: 32, width: 180, borderRadius: 8, background: "rgba(0,0,0,0.06)", marginBottom: 24 }} />
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, height: 88, borderRadius: 12, background: "rgba(0,0,0,0.06)" }} />
          ))}
        </div>
        <div style={{ height: 300, borderRadius: 12, background: "rgba(0,0,0,0.06)" }} />
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(() => !!getAccessToken());

  useEffect(() => {
    if (ready) return;
    async function init() {
      const token = await refreshAccessToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      setReady(true);
    }
    init();
  }, [ready, router]);

  if (!ready) return <AuthSkeleton />;

  return <AdminShell>{children}</AdminShell>;
}
