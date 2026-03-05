"use client";

import { useEffect, useState } from "react";
import { api, type StaffMember, type TgAccount } from "@/lib";
import { AppShell, AuthGuard, Badge, Button } from "@/components";

export default function TeamPage() {
  return (
    <AuthGuard>
      <AppShell>
        <TeamContent />
      </AppShell>
    </AuthGuard>
  );
}

function TeamContent() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [accounts, setAccounts] = useState<TgAccount[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("operator");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    api("/api/staff").then(setStaff).catch(console.error);
    api("/api/tg/status").then(setAccounts).catch(console.error);
  }, []);

  const createInvite = async () => {
    try {
      const data = await api("/api/staff/invite", {
        method: "POST",
        body: JSON.stringify({ role: inviteRole }),
      });
      setInviteLink(data.bot_link);
    } catch (e: any) { alert(e.message); }
  };

  const toggleActive = async (member: StaffMember) => {
    try {
      const updated = await api(`/api/staff/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      setStaff((prev) => prev.map((s) => (s.id === member.id ? updated : s)));
    } catch (e: any) { alert(e.message); }
  };

  const roleColor: Record<string, string> = {
    super_admin: "#ef4444",
    admin: "#f59e0b",
    operator: "#0ea5e9",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">Team</h1>
        <div className="flex gap-2">
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand/50 transition-all"
          >
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={createInvite}>Create Invite</Button>
        </div>
      </div>

      {inviteLink && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 mb-6 animate-slide-up">
          <p className="text-sm text-emerald-400 mb-2 font-medium">Invite link (48h):</p>
          <code className="text-xs text-slate-300 break-all">{inviteLink}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(inviteLink); }}
            className="ml-3 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/20 rounded-lg px-2 py-1 transition-colors"
          >
            Copy
          </button>
        </div>
      )}

      <div className="space-y-3">
        {staff.map((member) => (
          <div
            key={member.id}
            className={`bg-gradient-to-br from-surface-card to-surface border border-surface-border rounded-2xl p-4 animate-fade-in ${
              !member.is_active ? "opacity-40" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{member.name}</span>
                  <Badge text={member.role} color={roleColor[member.role] || "#0ea5e9"} />
                </div>
                <div className="text-xs text-slate-500 mt-1">{member.tg_username ? `@${member.tg_username}` : `ID: ${member.tg_user_id}`}</div>
              </div>

              <div className="flex gap-2">
                {member.role !== "super_admin" && accounts.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => setEditingId(editingId === member.id ? null : member.id)}
                  >
                    <svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Accounts
                  </Button>
                )}
                {member.role !== "super_admin" && (
                  <Button
                    variant={member.is_active ? "danger" : "secondary"}
                    onClick={() => toggleActive(member)}
                  >
                    {member.is_active ? "Block" : "Activate"}
                  </Button>
                )}
              </div>
            </div>

            {editingId === member.id && (
              <AccountAssigner staffId={member.id} accounts={accounts} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountAssigner({ staffId, accounts }: { staffId: string; accounts: TgAccount[] }) {
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/staff/${staffId}/accounts`)
      .then(setAssigned)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [staffId]);

  const toggle = async (accountId: string) => {
    const next = assigned.includes(accountId)
      ? assigned.filter((a) => a !== accountId)
      : [...assigned, accountId];

    try {
      await api(`/api/staff/${staffId}/accounts`, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setAssigned(next);
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="text-xs text-slate-500 mt-3">Loading...</div>;

  return (
    <div className="mt-4 pt-4 border-t border-surface-border animate-slide-up">
      <p className="text-xs text-slate-400 mb-2 font-medium">Assigned TG accounts:</p>
      <div className="flex flex-wrap gap-2">
        {accounts.filter((a) => a.is_active).map((acc) => (
          <button
            key={acc.id}
            onClick={() => toggle(acc.id)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-all duration-200 ${
              assigned.includes(acc.id)
                ? "bg-brand/10 border-brand/30 text-brand shadow-[0_0_10px_rgba(14,165,233,0.1)]"
                : "bg-surface border-surface-border text-slate-400 hover:border-slate-600"
            }`}
          >
            {acc.phone}
          </button>
        ))}
        {accounts.filter((a) => a.is_active).length === 0 && (
          <span className="text-xs text-slate-500">No active TG accounts</span>
        )}
      </div>
    </div>
  );
}
