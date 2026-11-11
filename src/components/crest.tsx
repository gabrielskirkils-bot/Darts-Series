import Image from "next/image";
import { copy } from "@/lib/copy";

/** Width ÷ height of public/brand/sal-crest.png (cut from Logo/SAL Logo.jpeg). */
const RATIO = 398 / 560;

/**
 * The SAL crest. `height` is the rendered height in px (also used for the image request);
 * pass `sizeClass` (e.g. "h-28 sm:h-40 w-auto") for responsive sizes instead.
 */
export function Crest({
  height,
  sizeClass,
  className = "",
  priority = false,
  decorative = false,
}: {
  height: number;
  sizeClass?: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  return (
    <Image
      src="/brand/sal-crest.png"
      alt={decorative ? "" : copy.crestAlt}
      width={Math.round(height * RATIO)}
      height={height}
      // `priority` is deprecated in Next 16: load above-the-fold crests eagerly instead.
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={`shrink-0 select-none ${sizeClass ?? ""} ${className}`}
      style={sizeClass ? undefined : { height, width: "auto" }}
      draggable={false}
    />
  );
}
