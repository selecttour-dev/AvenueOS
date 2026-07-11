"use client";

import { useState, useTransition } from "react";
import { Building2, Lock } from "lucide-react";
import { login } from "./actions";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await login(password);
      if (res?.error) setError(res.error);
    });

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--bg)" }}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-xl text-white"
        style={{ background: "var(--primary)" }}
      >
        <Building2 size={26} strokeWidth={2} />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">AvenueOS</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
        შესასვლელად შეიყვანე პაროლი
      </p>

      <div className="card mt-8 w-full max-w-sm p-6">
        <label className="label">პაროლი</label>
        <div className="relative">
          <Lock
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-3)" }}
          />
          <input
            type="password"
            className="input !pl-9"
            placeholder="••••••••"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {error && (
          <p className="mt-2 text-sm font-semibold" style={{ color: "var(--red)" }}>
            {error}
          </p>
        )}
        <button
          className="btn btn-primary mt-4 w-full"
          disabled={pending || !password}
          onClick={submit}
        >
          {pending ? "მოწმდება…" : "შესვლა"}
        </button>
      </div>
    </main>
  );
}
