import type { Metadata } from "next";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { alertError, alertOk, alertWarn, card } from "@/components/ui";
import { copy } from "@/lib/copy";
import { getViewer } from "@/lib/supabase/auth";
import { safeRedirectPath } from "@/lib/url";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: copy.login.title };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <Crest height={176} sizeClass="h-36 w-auto sm:h-44" priority />
        <h1 className="font-display text-3xl uppercase">{copy.login.title}</h1>
        <p className="text-muted">{copy.login.intro}</p>
      </div>
      <Suspense fallback={<p className="text-muted">{copy.common.loading}</p>}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);
  const linkError = params.error === "link";
  const viewer = await getViewer();

  return (
    <div className="space-y-4">
      {linkError && <p className={alertError}>{copy.login.linkExpired}</p>}
      {viewer && (
        <div className={viewer.isOrganizer ? alertOk : alertWarn}>
          <p>{copy.login.loggedInAs(viewer.email ?? "")}</p>
          <p>{viewer.isOrganizer ? copy.login.organizer : copy.login.notOrganizer}</p>
        </div>
      )}
      <div className={card}>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
