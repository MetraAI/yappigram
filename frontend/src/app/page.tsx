"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTokens } from "@/lib";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const tokens = getTokens();
    router.replace(tokens ? "/chats" : "/login");
  }, [router]);

  return null;
}
