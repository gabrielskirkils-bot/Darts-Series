"use client";

import { useState, type FormEvent } from "react";
import { alertError, btnPrimary, btnSecondary, input, label } from "@/components/ui";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "sent"; email: string; verifying: boolean; error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Supabase email OTPs are 6 digits by default (configurable up to 8). */
const CODE_RE = /^\d{6,8}$/;

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
    setCode("");
    setStatus({ kind: "sent", email: value, verifying: false, error: null });
  }

  // The code works on any device or browser, unlike the link (which logs in whichever
  // browser opens it, e.g. the Gmail app's built-in one).
  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind !== "sent") return;
    const token = code.replace(/\s/g, "");
    if (!CODE_RE.test(token)) {
      setStatus({ ...status, error: copy.login.codeFormat });
      return;
    }
    setStatus({ ...status, verifying: true, error: null });
    const { error } = await createClient().auth.verifyOtp({ email: status.email, token, type: "email" });
    if (error) {
      setStatus({
        ...status,
        verifying: false,
        error: error.status === 429 ? copy.login.rateLimited : copy.login.codeInvalid,
      });
      return;
    }
    // Full navigation so the server renders with the new session cookie.
    window.location.assign(next);
  }

  if (status.kind === "sent") {
    return (
      <div className="space-y-4">
        <div className="space-y-2" role="status">
          <h2 className="font-display text-2xl font-bold uppercase">{copy.login.sentTitle}</h2>
          <p>{copy.login.sentBody(status.email)}</p>
        </div>
        <form onSubmit={onVerify} className="space-y-4" noValidate>
          <div>
            <label htmlFor="code" className={label}>
              {copy.login.codeLabel}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              required
              className={`${input} num text-center text-2xl tracking-[0.3em]`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {status.error && (
            <p className={alertError} role="alert">
              {status.error}
            </p>
          )}
          <button type="submit" className={`${btnPrimary} w-full`} disabled={status.verifying}>
            {status.verifying ? copy.login.verifying : copy.login.codeSubmit}
          </button>
        </form>
        <button type="button" className={`${btnSecondary} w-full`} onClick={() => setStatus({ kind: "idle" })}>
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
