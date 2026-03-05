"use client";

import { useEffect, useState } from "react";
import { api, type Contact, type StaffMember } from "@/lib";
import { AppShell, AuthGuard, Button } from "@/components";

export default function QueuePage() {
  return (
    <AuthGuard>
      <AppShell>
        <QueueContent />
      </AppShell>
    </AuthGuard>
  );
}

function QueueContent() {
  const [pending, setPending] = useState<Contact[]>([]);
  const [operators, setOperators] = useState<StaffMember[]>([]);
  const [revealed, setRevealed] = useState<Record<string, { real_name: string | null; real_username: string | null; real_tg_id: number } | null>>({});

  useEffect(() => {
    api("/api/contacts?status=pending").then(setPending).catch(console.error);
    api("/api/staff").then((staff: StaffMember[]) =>
      setOperators(staff.filter((s) => s.role === "operator" && s.is_active))
    ).catch(console.error);
  }, []);

  const approve = async (contact: Contact, operatorId?: string) => {
    try {
      await api(`/api/contacts/${contact.id}/approve`, { method: "POST" });
      if (operatorId) {
        await api(`/api/contacts/${contact.id}`, {
          method: "PATCH",
          body: JSON.stringify({ assigned_to: operatorId }),
        });
      }
      setPending((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (e: any) { alert(e.message); }
  };

  const block = async (contact: Contact) => {
    try {
      await api(`/api/contacts/${contact.id}/block`, { method: "POST" });
      setPending((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (e: any) { alert(e.message); }
  };

  const reveal = async (contactId: string) => {
    try {
      const data = await api(`/api/contacts/${contactId}/reveal`);
      setRevealed((prev) => ({ ...prev, [contactId]: data }));
      setTimeout(() => {
        setRevealed((prev) => ({ ...prev, [contactId]: null }));
      }, 30000);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
        Moderation Queue
      </h1>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-16 text-slate-500 animate-fade-in">
          <svg className="w-12 h-12 mb-3 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
          </svg>
          <p className="text-sm">No pending contacts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((contact) => (
            <div key={contact.id} className="bg-gradient-to-br from-surface-card to-surface border border-surface-border rounded-2xl p-5 animate-slide-up">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-semibold text-lg">{contact.alias}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(contact.created_at).toLocaleString()}
                  </div>
                </div>

                {revealed[contact.id] ? (
                  <div className="text-sm bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 animate-fade-in">
                    <div className="text-slate-300">Name: <b className="text-white">{revealed[contact.id]!.real_name || "—"}</b></div>
                    <div className="text-slate-300">Username: <b className="text-white">@{revealed[contact.id]!.real_username || "—"}</b></div>
                    <div className="text-slate-300">ID: <code className="text-brand">{revealed[contact.id]!.real_tg_id}</code></div>
                    <div className="text-xs text-amber-400/60 mt-1.5">Auto-hides in 30s</div>
                  </div>
                ) : (
                  <button
                    onClick={() => reveal(contact.id)}
                    className="text-xs text-amber-400 hover:text-amber-300 border border-amber-400/20 hover:border-amber-400/40 rounded-xl px-3 py-1.5 transition-all duration-200"
                  >
                    Show real data
                  </button>
                )}
              </div>

              <div className="flex gap-2 items-center">
                <Button onClick={() => approve(contact)} variant="primary">
                  Approve
                </Button>

                {operators.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) approve(contact, e.target.value);
                    }}
                    className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand/50 transition-all"
                    defaultValue=""
                  >
                    <option value="" disabled>Approve & assign to...</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                )}

                <Button onClick={() => block(contact)} variant="danger">
                  Block
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
