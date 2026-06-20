"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, Bot, Clock, CheckCircle2, AlertCircle, Key } from "lucide-react";
import { formatRelativeTime, copyToClipboard } from "@/lib/utils";

interface McpConnection {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  _count: { auditLogs: number };
}

interface NewConnection extends Omit<McpConnection, "_count"> {
  token: string;
}

export function McpConnectionsTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newConnectionId, setNewConnectionId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const { data: connections, isLoading } = useQuery<McpConnection[]>({
    queryKey: ["mcp-connections"],
    queryFn: () => fetch("/api/mcp/connections").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      fetch("/api/mcp/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json()),
    onSuccess: (data: NewConnection) => {
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      setNewToken(data.token);
      setNewConnectionId(data.id);
      setNewName("");
      setShowCreate(false);
    },
    onError: () => toast.error("שגיאה ביצירת חיבור"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/mcp/connections/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      setConfirmRevoke(null);
      toast.success("החיבור בוטל בהצלחה");
    },
    onError: () => toast.error("שגיאה בביטול חיבור"),
  });

  const activeConnections = connections?.filter((c) => !c.revokedAt) ?? [];
  const revokedConnections = connections?.filter((c) => c.revokedAt) ?? [];

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">חבר עוזר AI לעסק שלך</h3>
            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
              חבר את העסק שלך לעוזר AI כמו Claude או ChatGPT. תוכל לשאול "מי הלקוחות שלי השבוע?" או
              "קבע פגישה לדני ביום שלישי" והוא יבצע את זה בשבילך.
            </p>
          </div>
        </div>
      </div>

      {/* Token reveal — shown immediately after creation */}
      {newToken && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-amber-800">הטוקן שלך — שמור אותו עכשיו!</h4>
          </div>
          <p className="text-amber-700 text-sm">
            הטוקן הזה יוצג <strong>פעם אחת בלבד</strong>. לאחר שתסגור את ההודעה הזו, לא תוכל לראות אותו שוב.
          </p>
          <div className="bg-white border border-amber-200 rounded-lg p-3 flex items-center gap-3 font-mono text-sm break-all">
            <span className="flex-1 text-slate-700 select-all">{newToken}</span>
            <button
              onClick={() => { copyToClipboard(newToken); toast.success("הטוקן הועתק"); }}
              className="text-amber-600 hover:text-amber-800 flex-shrink-0"
              title="העתק"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          {/* Easy method — paste one URL into Claude Desktop's Connectors UI */}
          <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-2">
            <p className="text-emerald-800 text-sm font-semibold">✅ הדרך הקלה (מומלץ) — חיבור ב-Claude Desktop בלי קוד:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs text-slate-600">
              <li>ב-Claude Desktop: <strong>Settings → Connectors → Add custom connector</strong></li>
              <li>ב-<strong>Name</strong> כתוב: <code>Petra</code></li>
              <li>ב-<strong>Remote MCP server URL</strong> הדבק את הכתובת הבאה (כוללת את הטוקן שלך):</li>
            </ol>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2 font-mono text-xs break-all">
              <span className="flex-1 text-slate-700 select-all">
                {(typeof window !== "undefined" ? window.location.origin : "https://petra-app.com")}/api/mcp/u/{newToken}
              </span>
              <button
                onClick={() => {
                  const origin = typeof window !== "undefined" ? window.location.origin : "https://petra-app.com";
                  copyToClipboard(`${origin}/api/mcp/u/${newToken}`);
                  toast.success("הכתובת הועתקה");
                }}
                className="text-emerald-600 hover:text-emerald-800 flex-shrink-0"
                title="העתק כתובת"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">לחץ <strong>Add</strong> וזהו — Claude מחובר לעסק שלך. 🎉</p>
          </div>

          {/* Advanced method — config file with header auth */}
          <details className="text-amber-700 text-sm">
            <summary className="font-medium cursor-pointer select-none">דרך מתקדמת — דרך קובץ הגדרות (Developer → Edit Config)</summary>
            <div className="space-y-1 mt-2">
              <ol className="list-decimal list-inside space-y-0.5 text-xs">
                <li>ב-Claude Desktop: <strong>Settings → Developer → Edit Config</strong></li>
                <li>הוסף את הבלוק הבא תחת <code>mcpServers</code>:</li>
              </ol>
              <pre className="bg-white border border-amber-200 rounded p-2 text-xs overflow-x-auto mt-1 whitespace-pre-wrap">
{`"petra": {
  "url": "${typeof window !== "undefined" ? window.location.origin : "https://petra-app.com"}/api/mcp",
  "headers": {
    "Authorization": "Bearer ${newToken}"
  }
}`}
              </pre>
              <p className="text-xs text-amber-600">סגור ופתח מחדש את Claude Desktop (Cmd+Q) כדי שהשינוי ייכנס לתוקף.</p>
            </div>
          </details>
          <button
            onClick={() => { setNewToken(null); setNewConnectionId(null); }}
            className="btn-secondary text-sm w-full mt-2"
          >
            הבנתי, שמרתי את הטוקן
          </button>
        </div>
      )}

      {/* Active connections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-700">חיבורים פעילים ({activeConnections.length})</h4>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              חבר עוזר חדש
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
            <h5 className="text-sm font-medium text-slate-700">שם החיבור החדש</h5>
            <p className="text-xs text-slate-500">תן שם שיזהה לך איפה הטוקן הזה משמש, למשל: &quot;Claude Desktop של אור&quot;</p>
            <input
              className="input w-full"
              placeholder="למשל: Claude Desktop"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && createMutation.mutate(newName.trim())}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate(newName.trim())}
                disabled={!newName.trim() || createMutation.isPending}
                className="btn-primary text-sm"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור חיבור"}
              </button>
              <button onClick={() => { setShowCreate(false); setNewName(""); }} className="btn-secondary text-sm">
                ביטול
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : activeConnections.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Bot className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">אין עוזרי AI מחוברים עדיין.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeConnections.map((conn) => (
              <div key={conn.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{conn.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          פעיל
                        </span>
                        {conn.lastUsedAt ? (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            שימוש אחרון: {formatRelativeTime(conn.lastUsedAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">טרם נעשה שימוש</span>
                        )}
                        <span className="text-xs text-slate-400">{conn._count.auditLogs} פעולות</span>
                      </div>
                    </div>
                  </div>
                  {confirmRevoke === conn.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">לבטל?</span>
                      <button
                        onClick={() => revokeMutation.mutate(conn.id)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                        disabled={revokeMutation.isPending}
                      >
                        {revokeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "כן, בטל"}
                      </button>
                      <button onClick={() => setConfirmRevoke(null)} className="text-xs text-slate-500">
                        לא
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRevoke(conn.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="נתק"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked connections (collapsed) */}
      {revokedConnections.length > 0 && (
        <details className="text-sm">
          <summary className="text-slate-500 cursor-pointer select-none">
            חיבורים שבוטלו ({revokedConnections.length})
          </summary>
          <div className="mt-2 space-y-2">
            {revokedConnections.map((conn) => (
              <div key={conn.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-slate-500 text-sm line-through">{conn.name}</p>
                  <p className="text-xs text-slate-400">
                    בוטל {conn.revokedAt ? formatRelativeTime(conn.revokedAt) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
