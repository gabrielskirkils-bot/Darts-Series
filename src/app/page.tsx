import { Suspense } from "react";
import { copy } from "@/lib/copy";
import { getOverview } from "@/lib/supabase/queries";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{copy.home.title}</h1>
      <Suspense fallback={<p className="text-muted">{copy.home.loading}</p>}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  let overview;
  try {
    overview = await getOverview();
  } catch {
    return <p className="rounded-lg border border-board-red/50 p-4 text-cream">{copy.home.loadError}</p>;
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat label={copy.home.stats.players} value={overview.players} />
        <Stat label={copy.home.stats.tournaments} value={overview.tournaments} />
      </dl>
      {overview.tournaments === 0 && <Onboarding />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-4xl font-bold">{value}</dd>
    </div>
  );
}

function Onboarding() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl font-bold uppercase">{copy.home.emptyTitle}</h2>
      <p className="mt-1 text-muted">{copy.home.emptyIntro}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {copy.home.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-lg bg-surface-2 p-4">
            <span
              className={`num flex size-9 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                i % 2 === 0 ? "bg-board-red" : "bg-board-green"
              }`}
            >
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
