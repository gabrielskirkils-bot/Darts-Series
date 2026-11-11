import type { MetadataRoute } from "next";
import { copy } from "@/lib/copy";

/** Lets phones and tablets save the app to the home screen with the SAL crest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.fullName,
    short_name: copy.appName,
    description: copy.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#081530",
    theme_color: "#081530",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
