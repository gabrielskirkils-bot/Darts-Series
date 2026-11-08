"use client";

import { useState, type FormEvent } from "react";
import { alertError, btnPrimary, btnSecondary, input, label } from "@/components/ui";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus({ kind: "error", message: copy.login.invalidEmail });
      return;
    }
    setStatus({ kind: "sending" });
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: redirect.toString() },
    });
    if (error) {
      setStatus({
        kind: "error",
        message: error.status === 429 ? copy.login.rateLimited : copy.login.failed,
      });
      return;
    }
    setStatus({ kind: "sent", email: value });
  }

  if (status.kind === "sent") {
    return (
      <div className="space-y-3" role="status">
        <h2 className="font-display text-2xl font-bold uppercase">{copy.login.sentTitle}</h2>
        <p>{copy.login.sentBody(status.email)}</p>
        <button type="button" className={btnSecondary} onClick={() => setStatus({ kind: "idle" })}>
          {copy.login.useAnother}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className={label}>
          {copy.login.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {status.kind === "error" && (
        <p className={alertError} role="alert">
          {status.message}
        </p>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={status.kind === "sending"}>
        {status.kind === "sending" ? copy.login.sending : copy.login.submit}
      </button>
    </form>
  );
}
