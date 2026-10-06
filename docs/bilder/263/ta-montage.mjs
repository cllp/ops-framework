// Regel 12-montaget för #263: SessionStudio renderat ur källan (klasserna ur ChatInboxPanel.jsx, DMPanel.jsx, MessageBubble.jsx,
// ComposerBar.jsx) bredvid ramverkets riktiga skärmbilder ur check-skalyta --bilder.
//
// ⛔ VARFÖR SS RENDERAS UR KÄLLAN: SS webbapp kräver ett inloggat Firebase-projekt och `.env.local`, och går inte att köra här.
// Det är SS klasser och SS ljusa tema, inte en skärmbild av SS-appen. Samma metod som montaget för 0.34.0.
//
// Kör från ramverkets rot:
//   npm run build && node scripts/check-skalyta.mjs --bilder /tmp/bilder263
//   node docs/bilder/263/ta-montage.mjs . /tmp/bilder263 docs/bilder/263
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [rot, bilder, ut] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(ut, { recursive: true });
const req = (m) => import(pathToFileURL(path.join(rot, "node_modules", m)).href);
const postcss = (await req("postcss/lib/postcss.js")).default;
const tailwind = (await req("@tailwindcss/postcss/dist/index.mjs")).default;
const { startaWebblasare } = await import(pathToFileURL(path.join(rot, "scripts/lib/matVyport.mjs")).href);

// SS ljusa tema, `apps/web/src/index.css:296-354` (värdena som de står där).
const SS_VARS = `
:root{--color-bg-primary:#f8f7f4;--color-bg-surface:#ffffff;--color-bg-hover:#e8e4df;--color-text-primary:#1a1a1a;--color-text-secondary:#4a4540;
--color-text-muted:#8a8580;--color-text-subtle:#c0bbb5;--color-placeholder:#6a6560;--color-accent:#9a9588;--color-border-default:rgba(0,0,0,0.08);
--color-chat-bubble-own-bg:#5a564c;--color-chat-bubble-own-text:#f5f2eb;--color-chat-bubble-other-bg:#ffffff;--radius:0.75rem;--color-dm-accent:#7c6fa8}
body{margin:0;font-family:system-ui,sans-serif;background:var(--color-bg-primary)}`;

const ikon = (d, k = "w-3.5 h-3.5") => `<svg class="${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SOK = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>';
const USERPLUS = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>';
const SKICKA = '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>';
const MSG = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';
const avatar = (n, f = "#a89f92", s = "w-7 h-7") => `<span class="${s} rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style="background:${f}">${n}</span>`;

// Listans rad (`ChatInboxPanel.jsx:698-760`).
const rad = (namn, etikett, utdrag, tid, f, aktiv = false) => `
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-left ${aktiv ? "bg-[var(--color-bg-hover)]" : ""}">
  <span class="w-10 h-10 rounded-[var(--radius)] flex items-center justify-center text-white shrink-0" style="background:${f}">${ikon(MSG, "w-4 h-4")}</span>
  <span class="flex-1 min-w-0"><span class="flex items-center gap-2"><span class="flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">${namn}</span><span class="text-[9px] text-[var(--color-text-muted)]">${tid}</span></span>
  <span class="block text-[9px] font-medium" style="color:${f}">${etikett}</span>
  <span class="block truncate text-xs text-[var(--color-text-muted)]">${utdrag}</span></span>
</button>`;

/** @param {{ sok: string, personer: boolean, rader: string, hoger: string, mobil: boolean, hogerSyns: boolean }} o */
const sida = (o) => `<!doctype html><html><head><meta charset="utf-8"><style>CSS</style></head><body>
<div class="h-screen min-h-0 flex flex-col sm:flex-row bg-[var(--color-bg-primary)] sm:gap-2 sm:p-2">
 <div class="${o.mobil && o.hogerSyns ? "hidden" : "flex"} w-full flex-1 min-h-0 sm:flex-none sm:w-[35%] sm:min-w-[220px] sm:max-w-[40%] sm:shrink-0 flex-col bg-[var(--color-bg-surface)] sm:rounded-xl overflow-hidden">
  <div class="flex sm:hidden items-center gap-3 px-4 py-3"><span class="text-[var(--color-accent)]">${ikon(MSG, "w-5 h-5")}</span><h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Meddelanden</h2></div>
  <div class="flex items-center gap-1.5 px-3 py-2"><div class="flex items-center bg-[var(--color-bg-primary)] rounded-[var(--radius)] border border-[var(--color-border-default)] p-0.5">
   <span class="px-2 py-1 rounded-[3px] text-[10px] font-medium bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm">Alla</span><span class="px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">Olästa</span></div></div>
  <div class="px-3 py-1.5"><div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-[var(--radius)]">
   <span class="text-[var(--color-text-muted)]">${ikon(SOK, "w-3 h-3")}</span><span class="flex-1 text-[11px] ${o.sok ? "text-[var(--color-text-primary)]" : "text-[var(--color-placeholder)]"}">${o.sok || "Sök chattar och kontakter"}</span></div></div>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden py-2">
   ${o.personer ? `<div class="shrink-0 px-3 pb-2 border-b border-[var(--color-border-default)] mb-2"><p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">Personer att meddela</p>
    <button class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius)] text-left">${avatar("CB", "#b07a6a")}<span class="flex-1 min-w-0"><span class="block text-sm font-medium text-[var(--color-text-primary)] truncate">Cecilia Berg</span><span class="block text-[10px] text-[var(--color-text-muted)] truncate">cecilia@exempel.se</span></span>
    <span class="flex items-center gap-1 text-[11px] font-medium text-[var(--color-accent)]">${ikon(USERPLUS)}Starta chatt</span></button></div>` : ""}
   <div class="px-2 flex flex-col gap-0.5">${o.rader}</div>
  </div>
 </div>
 <div class="${o.mobil ? (o.hogerSyns ? "flex" : "hidden") : "flex"} flex-1 flex-col min-h-0 min-w-0 basis-0 bg-[var(--color-bg-surface)] sm:rounded-xl overflow-hidden">${o.hoger}</div>
</div></body></html>`;

const tomHoger = `<div class="flex-1 flex flex-col items-center justify-center text-center"><span class="text-[var(--color-text-muted)] opacity-50">${ikon(MSG, "w-12 h-12")}</span><p class="mt-3 text-sm font-medium text-[var(--color-text-muted)]">Välj en chatt</p></div>`;
// DM-tråden (`DMPanel.jsx`, `ChatPanelHeader.jsx:32-38`, `MessageBubble.jsx:126-205`, `ComposerBar.jsx`).
const trad = (mobil, meddelande) => `
${mobil ? `<button class="inline-flex items-center gap-1.5 px-3 py-2.5 border-b border-[var(--color-border-default)] text-xs text-[var(--color-text-secondary)]">‹ Tillbaka</button>` : ""}
<div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-default)]">${avatar("CB", "#b07a6a", "w-8 h-8")}<div><p class="m-0 text-sm font-semibold text-[var(--color-text-primary)]">Cecilia Berg</p><p class="m-0 text-[10px] text-[var(--color-text-muted)]">Senast aktiv i dag</p></div></div>
<div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">${meddelande ? `<div class="flex justify-center py-3"><span class="rounded-full bg-[var(--color-bg-primary)] px-3 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">I dag</span></div>
<div class="flex flex-row-reverse"><div class="flex max-w-[70%] flex-col items-end"><div class="rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed bg-[var(--color-chat-bubble-own-bg)] text-[var(--color-chat-bubble-own-text)]">Hej Cecilia, har du sett protokollet?</div><span class="mt-0.5 mr-1 text-[9px] text-[var(--color-text-muted)]">09:12</span></div></div>`
  : `<div class="h-full flex flex-col items-center justify-center text-center"><span class="text-[var(--color-text-muted)] opacity-40">${ikon(MSG, "w-7 h-7")}</span><p class="mt-3 text-sm text-[var(--color-text-muted)]">Inga meddelanden ännu</p></div>`}</div>
<div class="flex items-end gap-2 border-t border-[var(--color-border-default)] px-3 py-2"><div class="flex-1 min-h-10 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3.5 py-2.5 text-[13px] text-[var(--color-placeholder)]">Skriv ett meddelande</div>
<span class="w-10 h-10 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center">${ikon(SKICKA, "w-4 h-4")}</span></div>`;

const GRUPP = rad("Claes Philip Staiger Konsulting", "Grupp", "Cecilia: Hej alla, styrelsemötet flyttas…", "09:01", "#6a8a7a");
const BO = rad("Bo Lind", "Direktmeddelande", "Bo: Och en sak till: momsen för augusti.", "09:05", "#7c6fa8");
const CEC = (aktiv) => rad("Cecilia Berg", "Direktmeddelande", "Du: Hej Cecilia, har du sett protokollet?", "09:12", "#b07a6a", aktiv);

const lagen = (mobil) => ({
  fore: sida({ sok: "ce", personer: true, rader: GRUPP + BO, hoger: tomHoger, mobil, hogerSyns: false }),
  efter: sida({ sok: "", personer: false, rader: CEC(true) + GRUPP + BO, hoger: trad(mobil, true), mobil, hogerSyns: true }),
});

const arbets = fs.mkdtempSync(path.join(rot, "node_modules", ".ss263-"));
const alla = [...Object.values(lagen(false)), ...Object.values(lagen(true))].join("\n");
fs.writeFileSync(path.join(arbets, "kalla.html"), alla);
const css = (await postcss([tailwind()]).process(`@import "tailwindcss" source(none);\n@source "${path.join(arbets, "kalla.html")}";\n${SS_VARS}`, { from: path.join(arbets, "a.css") })).css;

const { browser } = await startaWebblasare();
for (const [bredd, hojd, mobil] of [[1280, 900, false], [390, 844, true]]) {
  const l = lagen(mobil);
  for (const [namn, html] of Object.entries(l)) {
    const p = await browser.newPage({ viewport: { width: bredd, height: hojd } });
    await p.setContent(html.replace("CSS", css));
    await p.screenshot({ path: path.join(ut, `ss-${namn}-${bredd}.png`) });
    await p.close();
  }
}

// Montaget: ramverket till vänster, SS till höger, med en rubrikrad. Bilderna läses som data-URL.
const data = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
const par = [
  ["fore", "Läget nytt, före valet", "nytt-meddelande", (b) => (b < 768 ? "Ramverket 0.63.0: plussets rad, läget \"nytt\" ersätter listan, med Till och \"Tillbaka\"" : "Ramverket 0.63.0: plussets rad, läget \"nytt\" i högerpanelen med Till, listan kvar"), "SS: sökningen \"ce\" i listan ger \"Personer att meddela\"", "nytt"],
  ["fore", "Före första meddelandet", "nytt-vald", "Ramverket 0.63.0: Cecilia vald i läget \"nytt\", tråden öppnad direkt", "SS: \"Personer att meddela\" i listan, före Starta chatt"],
  ["efter", "Efter första meddelandet", "nytt-skickat", "Ramverket 0.63.0: raden i listan och bubblan i tråden, utan focus", "SS: tråden öppen, raden överst i listan"],
];
for (const [bredd, hojd] of [[1280, 900], [390, 844]]) {
  for (const [lage, rubrik, rfil, rtext, stext, namn = lage] of par) {
    const skala = bredd === 1280 ? 0.6 : 1;
    const w = Math.round(bredd * skala);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#ddd;font:14px system-ui}h1{font-size:16px;margin:8px 12px}.r{display:flex;gap:12px;padding:0 12px 12px}figure{margin:0}figcaption{font-size:12px;margin:4px 0;max-width:${w}px}img{width:${w}px;display:block;border:1px solid #999}</style></head><body>
<h1>#263, ${bredd} px: ${rubrik}</h1><div class="r"><figure><figcaption>${typeof rtext === "function" ? rtext(bredd) : rtext}</figcaption><img src="${data(path.join(bilder, `${rfil}-${bredd}.png`))}"></figure>
<figure><figcaption>${stext} (renderat ur SS källa, se jämförelsen)</figcaption><img src="${data(path.join(ut, `ss-${lage}-${bredd}.png`))}"></figure></div></body></html>`;
    const p = await browser.newPage({ viewport: { width: w * 2 + 40, height: 400 } });
    await p.setContent(html);
    await p.screenshot({ path: path.join(ut, `${namn}-${bredd}-ramverk-ss.png`), fullPage: true });
    await p.close();
  }
}
await browser.close();
fs.rmSync(arbets, { recursive: true, force: true });
// Bara montagen ligger kvar i utmappen; SS halvbilder är mellansteg.
for (const f of fs.readdirSync(ut)) if (/^ss-.*\.png$/.test(f)) fs.rmSync(path.join(ut, f));
console.log("klart", fs.readdirSync(ut).join(" "));
