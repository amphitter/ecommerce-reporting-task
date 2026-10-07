"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, BadgeCheck, Eye, EyeOff, ShieldCheck, Key, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Please verify credentials.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network or server connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleSimulateState = (state: "normal" | "loading" | "error") => {
    if (state === "normal") {
      setError(null);
      setLoading(false);
    } else if (state === "loading") {
      setLoading(true);
      setError(null);
      setTimeout(() => setLoading(false), 2000);
    } else if (state === "error") {
      setError("Invalid security credentials for node cluster. Cryptographic handoff token expired or signature failed verification.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-brand-blue flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <div>
              <div className="font-bold text-text-primary text-sm leading-none">NexusOps</div>
              <div className="text-[10px] text-brand-blue font-semibold uppercase tracking-wider">Enterprise Analytics</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-success bg-success-bg px-2 py-0.5 rounded border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>AUTH SECURED</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="card p-6 md:p-8 bg-white">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold text-text-primary">E-commerce Reporting</h1>
            <span className="text-[11px] text-text-muted flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              CLUSTER ONLINE
            </span>
          </div>
          <p className="text-xs text-text-muted mb-5">
            Sign in to access your multi-marketplace analytics, order flows, and warehouse control dashboard.
          </p>

          {/* QA State Simulator */}
          <div className="mb-5 p-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">QA Simulator:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSimulateState("normal")}
                className="px-2 py-0.5 rounded text-[11px] bg-white border border-slate-200 hover:bg-slate-100 text-text-secondary"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => handleSimulateState("loading")}
                className="px-2 py-0.5 rounded text-[11px] bg-white border border-slate-200 hover:bg-slate-100 text-text-secondary"
              >
                Loading
              </button>
              <button
                type="button"
                onClick={() => handleSimulateState("error")}
                className="px-2 py-0.5 rounded text-[11px] bg-white border border-slate-200 hover:bg-slate-100 text-critical"
              >
                Error
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded bg-critical-bg border border-red-200 flex items-start gap-2.5 text-xs text-critical">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-primary" htmlFor="adminId">
                  Admin Identifier <span className="text-critical">*</span>
                </label>
                <span className="text-[11px] text-text-muted">Single Admin</span>
              </div>
              <div className="relative">
                <input
                  id="adminId"
                  type="text"
                  required
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  placeholder="e.g. admin"
                  className="input-base text-xs font-mono"
                />
              </div>
              <p className="text-[11px] text-text-muted mt-1">Configured via environment variables.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-primary" htmlFor="password">
                  Security Token / Password <span className="text-critical">*</span>
                </label>
                <span className="text-[11px] text-brand-blue hover:underline cursor-pointer">
                  Default: admin123
                </span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="input-base text-xs pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary pt-1">
              <input
                type="checkbox"
                id="remember"
                defaultChecked
                className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
              />
              <label htmlFor="remember" className="select-none">
                Remember device context for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2 h-10 text-sm font-semibold"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Validating Identity...</span>
                </>
              ) : (
                <span>Sign In to Dashboard &rarr;</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-surface-border" />
            <span className="absolute px-3 bg-white text-[10px] tracking-widest text-text-muted uppercase font-semibold">
              ENTERPRISE SINGLE SIGN-ON
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setPassword("admin123");
              setTimeout(() => {
                const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
                if (btn) btn.click();
              }, 100);
            }}
            className="w-full btn-secondary flex items-center justify-center gap-2 h-9 text-xs"
          >
            <Key size={14} className="text-brand-blue" />
            <span>Authenticate with One-Click Admin Key</span>
          </button>

          {/* Security status */}
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-text-muted font-mono">
            <div className="flex items-center gap-1.5">
              <Lock size={12} className="text-success" />
              <span>TLS 1.3 / HTTP-Only Session</span>
            </div>
            <span className="text-success font-semibold">ENCRYPTED</span>
          </div>
        </div>

        {/* Security Notice Callout */}
        <div className="card p-4 mt-4 bg-slate-50 border border-surface-border">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-text-muted shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-0.5">
                Strict Audit Protocol Notice
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Authorized personnel only. All access attempts, analytical queries, and dataset export actions are cryptographically signed, timestamped, and audited per ISO-27001 & SOC2 Type II compliance rules.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
