/**
 * En sida att fotografera, byggd mot dist (0.103.0). Delad av `talk-montage.mjs` och `mikrofon-montage.mjs`: ytan (en jsx-fil med
 * `OPS_DIST` där dist ska in) paketeras med esbuild, CSS:en byggs av Tailwind ur tokens och det som faktiskt används, och
 * typsnittet bäddas in. Före 0.103.0 stod samma kod i `talk-montage.mjs`, och en andra kopia i ett nytt montage hade glidit isär.
 *
 * ⛔ Arbetsmappen ligger i repots rot och inte i node_modules: där kan node_modules vara en länk till en annan arbetskopia, och
 * montaget ska inte skriva i någon annans träd. Paketen hittas ändå, eftersom esbuild letar uppåt från ingången.
 */

import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { distUtanKommentarer } from "./dist-text.mjs";

/**
 * @param {{ rot: string, yta: string, namn: string, dist?: string }} val `yta` relativt `rot`, `namn` är arbetsmappens prefix. `dist` är en annan byggd version att fotografera (före-bilden mot origin/main).
 * @returns {Promise<{ sida: string, stada: () => void }>}
 */
export async function byggYta({ rot, yta, namn, dist: annanDist }) {
  const dist = annanDist ?? path.join(rot, "dist", "index.js");
  if (!fs.existsSync(dist)) throw new Error(`${namn}: dist/index.js saknas. Kör npm run build först.`);
  const tokensFil = path.join(rot, "tokens", "tokens.css");
  const arbetsmapp = fs.mkdtempSync(path.join(rot, `.ops-${namn}-`));
  const stada = () => fs.rmSync(arbetsmapp, { recursive: true, force: true });
  try {
    const entry = fs.readFileSync(path.join(rot, yta), "utf8").replace("OPS_DIST", dist.replace(/\\/g, "/"));
    const entryFil = path.join(arbetsmapp, "entry.jsx");
    fs.writeFileSync(entryFil, entry);
    const js = await build({
      entryPoints: [entryFil],
      bundle: true,
      write: false,
      format: "iife",
      jsx: "automatic",
      platform: "browser",
      target: ["es2022"],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "error",
    });
    const distSkannad = path.join(arbetsmapp, "dist-skannad.js");
    fs.writeFileSync(distSkannad, distUtanKommentarer(dist));
    const cssRatt = (
      await postcss([tailwind()]).process(
        `@import "tailwindcss" source(none);\n@import "${tokensFil.replace(/\\/g, "/")}";\n@source "${distSkannad.replace(/\\/g, "/")}";\n@source "${entryFil.replace(/\\/g, "/")}";\n`,
        { from: path.join(arbetsmapp, "app.css") },
      )
    ).css;
    const fontData = fs.readFileSync(path.join(rot, "fonts", "glacial-indifference", "glacial-indifference-400.woff2")).toString("base64");
    const css = cssRatt.replace(/url\(["']?[^)"']*glacial-indifference-400\.woff2["']?\)/g, `url(data:font/woff2;base64,${fontData})`);
    const sida = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>${js.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;
    return { sida, stada };
  } catch (fel) {
    stada();
    throw fel;
  }
}
