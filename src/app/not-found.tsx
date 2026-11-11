import Link from "next/link";
import { btnSecondary } from "@/components/ui";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <p className="num text-7xl font-bold text-alert">404</p>
      <h1 className="font-display text-3xl font-bold uppercase">{copy.notFound.title}</h1>
      <p className="text-muted">{copy.notFound.body}</p>
      <Link href="/" className={btnSecondary}>
        {copy.notFound.home}
      </Link>
    </div>
  );
}
