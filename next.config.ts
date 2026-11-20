import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // Loaders run last to first: Tailwind, then unwrap `@layer` for older iPads/iPhones.
        loaders: ["./css-compat-loader.cjs", "@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
