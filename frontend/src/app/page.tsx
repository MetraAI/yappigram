"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTokens, clearAllCrmStorage, disconnectWS } from "@/lib";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Direct navigation (not iframe): always re-SSO to sync with current PostForge user
    const isInIframe = window.self !== window.top;
    if (!isInIframe) {
      const pfToken = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (pfToken) {
        // Clear stale CRM tokens — login page will do fresh SSO
        clearAllCrmStorage();
        disconnectWS();
      }
    }

    const tokens = getTokens();
    router.replace(tokens ? "/chats" : "/login");
  }, [router]);

  return null;
}
