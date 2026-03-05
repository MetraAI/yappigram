"use client";

import { useEffect, useState } from "react";
import { api, getRole } from "@/lib";
import { AppShell, AuthGuard, Button, Input } from "@/components";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <SettingsContent />
      </AppShell>
    </AuthGuard>
  );
}

function SettingsContent() {
  const role = getRole();
  const isSuperAdmin = role === "super_admin";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">Settings</h1>

      {isSuperAdmin && <TelegramSection />}
      <TagsSection />
    </div>
  );
}

function TelegramSection() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password2fa, setPassword2fa] = useState("");
  const [step, setStep] = useState<"idle" | "code_sent">("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/tg/status").then(setAccounts).catch(console.error);
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      await api("/api/tg/connect", { method: "POST", body: JSON.stringify({ phone }) });
      setStep("code_sent");
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true);
    try {
      const account = await api("/api/tg/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code, password_2fa: password2fa || null }),
      });
      setAccounts((prev) => [...prev, account]);
      setStep("idle");
      setPhone(""); setCode(""); setPassword2fa("");
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const disconnect = async (id: string) => {
    if (!confirm("Disconnect this account?")) return;
    try {
      await api(`/api/tg/disconnect/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) { alert(e.message); }
  };

  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
        Telegram Accounts
      </h2>

      {accounts.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between bg-gradient-to-r from-surface-card to-surface border border-surface-border rounded-xl p-4 mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${acc.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="font-medium">{acc.phone}</span>
            <span className={`text-xs ${acc.is_active ? "text-emerald-400/70" : "text-red-400/70"}`}>
              {acc.is_active ? "Active" : "Disconnected"}
            </span>
          </div>
          {acc.is_active && (
            <Button variant="danger" onClick={() => disconnect(acc.id)}>Disconnect</Button>
          )}
        </div>
      ))}

      <div className="mt-4 bg-gradient-to-br from-surface-card to-surface border border-surface-border rounded-2xl p-5 space-y-3">
        {step === "idle" ? (
          <>
            <Input label="Phone number" value={phone} onChange={setPhone} placeholder="+79001234567" />
            <Button onClick={connect} disabled={loading || !phone}>
              {loading ? "Sending code..." : "Connect Account"}
            </Button>
          </>
        ) : (
          <>
            <Input label="Code from Telegram" value={code} onChange={setCode} placeholder="12345" />
            <Input label="2FA Password (if enabled)" type="password" value={password2fa} onChange={setPassword2fa} />
            <Button onClick={verify} disabled={loading || !code}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function TagsSection() {
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0ea5e9");

  useEffect(() => {
    api("/api/tags").then(setTags).catch(console.error);
  }, []);

  const createTag = async () => {
    if (!name.trim()) return;
    try {
      const tag = await api("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name, color }),
      });
      setTags((prev) => [...prev, tag]);
      setName("");
    } catch (e: any) { alert(e.message); }
  };

  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        Tags
      </h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((t) => (
          <span
            key={t.id}
            className="px-3 py-1.5 rounded-full text-sm font-medium border animate-fade-in"
            style={{ backgroundColor: t.color + "15", color: t.color, borderColor: t.color + "30" }}
          >
            {t.name}
          </span>
        ))}
        {tags.length === 0 && <span className="text-sm text-slate-500">No tags created yet</span>}
      </div>
      <div className="flex gap-2 items-end">
        <Input label="Tag name" value={name} onChange={setName} placeholder="VIP" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-slate-400 font-medium">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border border-surface-border"
          />
        </div>
        <Button onClick={createTag}>Add</Button>
      </div>
    </section>
  );
}
