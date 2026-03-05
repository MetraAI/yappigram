"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isTelegramWebApp, tgAuth, getTgWebApp } from "@/lib";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "no_tg" | "no_access">("loading");

  useEffect(() => {
    if (!isTelegramWebApp()) {
      setStatus("no_tg");
      return;
    }

    getTgWebApp()?.ready();
    getTgWebApp()?.expand();

    tgAuth().then((ok) => {
      if (ok) {
        router.replace("/chats");
      } else {
        setStatus("no_access");
      }
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-full max-w-sm p-8 bg-gradient-to-b from-surface-card to-surface rounded-2xl border border-surface-border shadow-[0_0_40px_rgba(14,165,233,0.06)] animate-fade-in text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent mb-4">
          YappiGram
        </h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Connecting via Telegram...</p>
          </div>
        )}

        {status === "no_tg" && (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              Open this app through the Telegram bot to sign in.
            </p>
            <p className="text-slate-500 text-xs">
              Ask your administrator for an invite link.
            </p>
          </div>
        )}

        {status === "no_access" && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">
              No access. Use an invite link from your administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
