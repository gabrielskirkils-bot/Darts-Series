import "server-only";
import { cache } from "react";
import { createClient } from "./server";

export type Viewer = {
  userId: string;
  email: string | null;
  isOrganizer: boolean;
};

/**
 * The logged-in user and whether they're an organizer, or null for anonymous.
 * Reads cookies, so render callers behind <Suspense>. Deduplicated per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: isOrganizer } = await supabase.rpc("is_organizer");
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    isOrganizer: isOrganizer === true,
  };
});

export class NotOrganizerError extends Error {
  constructor() {
    super("Only organizers can do this.");
  }
}

/** For Server Actions: throws unless the caller is an organizer. RLS enforces the same. */
export async function requireOrganizer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isOrganizer) throw new NotOrganizerError();
  return viewer;
}
