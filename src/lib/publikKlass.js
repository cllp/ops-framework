/**
 * Klasserna för typografin på PUBLIKA sidor (0.94.0, CP 2026-10-12).
 *
 * ══ ⛔ VARFÖR DET FINNS EN EGEN UPPSÄTTNING ═══════════════════════════════
 *
 * CP 2026-10-12 om life-hub.app:s publika sidor: "Texten är för tung: allt i fetstil, långa rader och för mycket per yta.
 * Bättre att det ser ut som SessionStudio." En publik sida är en PRESENTATIONSSIDA, inte en appvy: rubrikerna är större,
 * brödtexten luftigare och rubrikfamiljen en serif. Appens roller (`text-sida`, `text-titel`, `text-brod`) är gjorda för
 * täta vyer och blir fel här, och att låta varje publik sida skriva sina egna storlekar är exakt det `check-typografi`
 * finns för att stoppa.
 *
 * Rollerna bor i `tokens/sessionstudio-profil.json` (`typografi.publik`), mätta ur SessionStudios landningssidor
 * (`apps/web/src/landingPages`), och blir `text-publik-rubrik`, `text-publik-avsnitt`, `text-publik-ingress`,
 * `text-publik-brod` och `text-publik-eyebrow`. Rubrikfamiljen är en egen token, `--font-display-publik` (`font-display-publik`),
 * så en instans kan ge sina publika rubriker en egen röst i sin brandfil utan att röra en komponent (`docs/brand.md`).
 * Läsbredden är `--container-las` (`max-w-las`, 65ch).
 *
 * ⛔ APPENS VYER BERÖRS INTE. Appen fortsätter med `--font-display` och rollerna i `typografi.roller`. Rollerna här används
 * bara där en sida är en presentation, och de är inte en genväg till större text i en vy.
 *
 * ⛔ FÄRGEN LIGGER UTANFÖR ROLLEN, som för `sektion`: rubriken är `text-ink`, ingressen och brödtexten `text-ink-secondary`
 * (SS dämpade ton), överraden `text-accent`. Versalerna sätts här (`uppercase`).
 */

export const PUBLIK_KLASS = Object.freeze({
  /** Överraden över en rubrik: 12 px, 600, spärrad, versaler, accent. */
  eyebrow: "m-0 text-publik-eyebrow uppercase text-accent",
  /** Hjälterubriken, sidans `<h1>`: serif, 500, 36 px, 48 px från `sm`, 56 px från `lg`. */
  hjalte: "m-0 max-w-4xl font-display-publik text-publik-rubrik text-ink",
  /** Avsnittsrubriken, `<h2>`: serif, 500, 30 px, 36 px från `sm`, 44 px från `lg`. */
  avsnitt: "m-0 max-w-3xl font-display-publik text-publik-avsnitt text-ink",
  /** Ingressen under en rubrik, i läsbredd. */
  ingress: "m-0 max-w-las text-publik-ingress text-ink-secondary",
  /** Löptext i läsbredd. */
  brod: "m-0 max-w-las text-publik-brod text-ink-secondary",
});
