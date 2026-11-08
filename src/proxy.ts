import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // If Supabase falls back to the Site URL (redirect URL not allow-listed), the
  // magic-link code lands on some other page: hand it to the callback route.
  const { pathname, searchParams } = request.nextUrl;
  if (request.method === "GET" && searchParams.has("code") && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = "";
    url.searchParams.set("code", searchParams.get("code")!);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
