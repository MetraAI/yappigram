import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c1222",
};

export const metadata: Metadata = {
  title: "METRA CRM",
  description: "METRA CRM — Telegram CRM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "METRA CRM",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <script dangerouslySetInnerHTML={{ __html: `
          // Pre-React SSO handler: save tokens from URL params before React hydrates
          (function() {
            try {
              var p = new URLSearchParams(window.location.search);
              var at = p.get("access_token");
              var rt = p.get("refresh_token");
              if (at && rt && window.location.pathname.indexOf("/login") !== -1) {
                var role = p.get("role") || "operator";
                localStorage.setItem("tokens", JSON.stringify({access_token: at, refresh_token: rt, role: role}));
                var base = window.location.pathname.split("/login")[0] || "";
                window.location.replace(base + "/chats/");
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="overscroll-none">{children}</body>
    </html>
  );
}
