/**
 * A same-site path to redirect to after login. Anything that isn't a plain
 * absolute path ("/x", not "//host" or "https://…") falls back to "/".
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
