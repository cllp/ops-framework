// Före och efter bilder för den kompakta raden i Biblioteket (0.165.0). Kör: npm run build && node scripts/bibliotek-kompakt-rad.mjs efter
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { distUtanKommentarer } from "./lib/dist-text.mjs";
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(rot, "dist", "index.js");
const prefix = process.argv[2];
const arb = fs.mkdtempSync(path.join(rot, "node_modules", ".rad-"));
const entry = `import { createRoot } from "react-dom/client";
import * as Ops from "${dist}";
const tid = Date.UTC(2026,9,31,9);
const s = { uid: "uid-1", namn: "CP", typ: "manniska", kalla: "bibliotek" };
const fp = (id, rubrik, fil, extra={}) => ({ ...Ops.byggPost({ groupId: "g", typ: "fil", rubrik, fil, skapadAv: s, skapad: tid, andrad: tid, ...extra }), id });
const poster = [
  fp("h1","akustisk-gitarr-v1.html",{sokvag:"grupper/g/bibliotek/h1/akustisk-gitarr-v1.html",namn:"akustisk-gitarr-v1.html",mime:"text/html",byte:69632}),
  fp("h2","sang-v1.html",{sokvag:"grupper/g/bibliotek/h2/sang-v1.html",namn:"sang-v1.html",mime:"text/html",byte:69632},{taggar:["musik"]}),
  fp("p1","inbetalningskort.pdf",{sokvag:"grupper/g/bibliotek/p1/inbetalningskort.pdf",namn:"inbetalningskort.pdf",mime:"application/pdf",byte:249856}),
  { ...Ops.byggPost({ groupId: "g", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade om bokslutet.", skapadAv: s, skapad: tid, andrad: tid }), id: "a" },
  { ...Ops.byggPost({ groupId: "g", typ: "lank", rubrik: "Bolagsverket", url: "https://bolagsverket.se", skapadAv: s, skapad: tid, andrad: tid }), id: "l" },
];
createRoot(document.getElementById("root")).render(<div className="p-4"><Ops.OpsBibliotek poster={poster} jag={{uid:"uid-1",roll:"admin"}} onOppna={()=>{}} onStang={()=>{}} onSpara={()=>{}} hubHref="/hub" oppnaHtml={(p)=>"/bibliotek/visa/"+p.id} filUrl={()=>""} /></div>);
`;
const ef = path.join(arb, "entry.jsx"); fs.writeFileSync(ef, entry);
const js = await build({ entryPoints:[ef], bundle:true, write:false, format:"iife", jsx:"automatic", platform:"browser", define:{"process.env.NODE_ENV":'"production"'}, logLevel:"error" });
const ds = path.join(arb,"d.js"); fs.writeFileSync(ds, distUtanKommentarer(dist));
const css = (await postcss([tailwind()]).process(`@import "tailwindcss" source(none);\n@import "${path.join(rot,"tokens","tokens.css")}";\n@source "${ds}";\n@source "${ef}";\n`,{from:path.join(arb,"a.css")})).css;
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><style>${css}</style></head><body class="bg-canvas text-ink font-sans"><div id="root"></div><script>${js.outputFiles[0].text.replace(/<\/script>/g,"<\\/script>")}</script></body></html>`;
const { browser } = await startaWebblasare();
for (const w of [390, 1280]) {
  const c = await browser.newContext({ viewport:{width:w,height:800}, colorScheme:"dark" }); const p = await c.newPage();
  const fel=[]; p.on("pageerror",e=>fel.push(e.message));
  await p.setContent(html); await p.waitForSelector("[data-bibliotek-lista]",{timeout:8000}).catch(()=>{throw new Error(fel.join("\n"))});
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(rot, `docs/jamforelser/0.165.0/${prefix}-${w}.png`), fullPage:true }); await c.close();
}
await browser.close(); fs.rmSync(arb,{recursive:true,force:true});
