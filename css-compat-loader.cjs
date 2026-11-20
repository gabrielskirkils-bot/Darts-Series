/**
 * Turbopack CSS loader that runs after Tailwind and makes its output work in older browsers
 * (Safari / iOS before 16.4, which every browser on an older iPad or iPhone uses).
 *
 * Tailwind v4 puts all of its rules in `@layer theme/base/components/utilities`. Browsers
 * without `@layer` support (iOS before 15.4) drop those blocks entirely, so the app renders
 * unstyled. This loader:
 * 1. Lowers the CSS with Lightning CSS: un-nests rules (e.g. Tailwind's
 *    `@supports (color: color-mix(...))` inside a utility, which the layer plugin would
 *    otherwise drop) and rewrites `@media (width >= 40rem)` as `(min-width: 40rem)`.
 * 2. Adds an `rgba()` fallback for translucent colours like `bg-brand-red/10`, which
 *    Tailwind writes with `color-mix()` (iOS 16.2+) and otherwise falls back to the solid colour.
 * 3. Unwraps the layers with the cascade-layers plugin, which keeps their priority by
 *    adjusting selector specificity instead.
 */
const { transform } = require("lightningcss");
const postcss = require("postcss");
const cascadeLayers = require("@csstools/postcss-cascade-layers");

/** Oldest browsers to support (major version << 16): iPads/iPhones on iOS 12 and up. */
const targets = { safari: 12 << 16, ios_saf: 12 << 16, chrome: 80 << 16, firefox: 78 << 16 };

const MIX = /color-mix\(in [a-z]+, var\((--[\w-]+)\) ([\d.]+)%, transparent\)/g;

/** Custom properties whose value is a hex colour, following `var()` references. */
function hexColors(root) {
  const raw = new Map();
  root.walkDecls(/^--/, (decl) => raw.set(decl.prop, decl.value.trim()));
  const resolve = (name, depth = 0) => {
    const value = raw.get(name);
    if (!value || depth > 5) return null;
    if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    return ref ? resolve(ref[1], depth + 1) : null;
  };
  return resolve;
}

function rgba(hex, percent) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${+((a * Number(percent)) / 100).toFixed(3)})`;
}

/** Before each `@supports (color: color-mix(...))` block, add the same rules with rgba(). */
const colorMixFallback = {
  postcssPlugin: "color-mix-fallback",
  Once(root) {
    const hexOf = hexColors(root);
    root.walkAtRules("supports", (atRule) => {
      if (!atRule.params.includes("color-mix")) return;
      const fallback = atRule.clone();
      let complete = true;
      fallback.walkDecls((decl) => {
        decl.value = decl.value.replace(MIX, (match, name, percent) => {
          const hex = hexOf(name);
          if (!hex) complete = false;
          return hex ? rgba(hex, percent) : match;
        });
      });
      if (complete) atRule.before(fallback.nodes);
    });
  },
};

const processor = postcss([colorMixFallback, cascadeLayers()]);

module.exports = function cssCompatLoader(source) {
  const callback = this.async();
  try {
    const { code } = transform({ filename: this.resourcePath, code: Buffer.from(source), targets });
    processor
      .process(code.toString(), { from: this.resourcePath, map: false })
      .then((result) => callback(null, result.css))
      .catch((error) => callback(error));
  } catch (error) {
    callback(error);
  }
};
