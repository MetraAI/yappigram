"use client";

import { useState, useEffect } from "react";
import { AuthGuard, AppShell, Button } from "@/components";
import { api, fetchTgStatus, fetchNewChatsReport, NewChatsReport } from "@/lib";

export default function StatsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Статистика
          </h1>
          <NewChatsSection />
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function NewChatsSection() {
  const [accounts, setAccounts] = useState<{ id: string; phone: string; display_name: string | null }[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountFilter, setAccountFilter] = useState("");
  const [report, setReport] = useState<NewChatsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [userTz, setUserTz] = useState("UTC");

  useEffect(() => {
    fetchTgStatus().then((accs) => {
      setAccounts(accs.filter((a: any) => a.is_active !== false).map((a: any) => ({ id: a.id, phone: a.phone, display_name: a.display_name })));
    }).catch(() => {});
    api("/api/staff/me").then((me: any) => {
      if (me?.timezone) setUserTz(me.timezone);
    }).catch(() => {});
  }, []);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const data = await fetchNewChatsReport(fromDate, toDate, accountFilter || undefined, userTz);
      setReport(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-200">Новые чаты</h2>
      <div className="bg-gradient-to-br from-surface-card to-surface border border-surface-border rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-400 font-medium">От</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-surface border border-surface-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand/50 transition-all duration-200 text-slate-300"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-400 font-medium">До</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-surface border border-surface-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand/50 transition-all duration-200 text-slate-300"
            />
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-slate-400 font-medium">Аккаунт</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="bg-surface border border-surface-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand/50 transition-all duration-200 text-slate-300"
            >
              <option value="">Все аккаунты</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.display_name || acc.phone}</option>
              ))}
            </select>
          </div>
        )}
        <Button onClick={handleFetch} disabled={loading}>
          {loading ? "Загрузка..." : "Показать"}
        </Button>

        {report && (
          <div className="space-y-4 pt-2">
            <div className="bg-brand/10 border border-brand/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-brand">{report.total}</div>
              <div className="text-xs text-slate-400 mt-1">Новых чатов за период</div>
            </div>

            {report.by_day.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">По дням</h3>
                <div className="space-y-1">
                  {report.by_day.map((d) => (
                    <div key={d.date} className="flex justify-between items-center bg-surface rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-400">{d.date}</span>
                      <span className="font-medium text-slate-200">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.by_account.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">По аккаунтам</h3>
                <div className="space-y-1">
                  {report.by_account.map((a) => (
                    <div key={a.account_id} className="flex justify-between items-center bg-surface rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-400">{a.display_name || a.phone}</span>
                      <span className="font-medium text-slate-200">{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.total === 0 && (
              <div className="text-center text-sm text-slate-500 py-4">
                Нет новых чатов за выбранный период
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
