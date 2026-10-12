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
 * (`apps/web/src/landingPages`), och blir `text-publik-rubrik`, `text-publik-sida`, `text-publik-block`, `text-publik-ingress`,
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
  /** Fotohjältens rubrik, `<h1>`: serif, 500, 36 px, 48 px från `sm`, 56 px från `lg`. */
  hjalte: "m-0 max-w-4xl font-display-publik text-publik-rubrik text-ink",
  /** Innehållssidans rubrik, `<h1>` (SS HowItWorksPage): serif, 500, 36 px, 48 px från `sm`. */
  sida: "m-0 font-display-publik text-publik-sida text-ink",
  /** Avsnittets rubrik, `<h2>` (SS HowItWorksPage `SectionShell`): serif, 500, 30 px, 36 px från `sm`. Samma roll som blockets. */
  avsnitt: "m-0 font-display-publik text-publik-block text-ink",
  /** Ingressen under en rubrik. Bredden sätter anroparen (`max-w-las` i ett block, `max-w-3xl` på en innehållssida). */
  ingress: "m-0 text-publik-ingress text-ink-secondary",
  /** Löptext. Bredden sätter anroparen. */
  brod: "m-0 text-publik-brod text-ink-secondary",
});

/**
 * De tre tonerna ett block kan ha (0.94.0), efter SessionStudios `LandingFeatureBlock` (`TONE_STYLES`): ett ljust band, ett
 * band i accentfärgen och ett mörkt band. Varje ton är sex roller: bakgrund, överrad, rubrik, brödtext, kantknapp och bildens
 * toning. Alla färger är brandvariabler (`--color-publik-*`, `tokens/brand-kontrakt.json`), så en instans byter tonerna i sin
 * brandfil och ingen komponent rörs.
 *
 * ⛔ KLASSNAMNEN STÅR UTSKRIVNA OCH ÄR ALDRIG SAMMANSATTA. Tailwind läser klassnamn som text; en klass som byggs av
 * `text-publik-${ton}` finns inte i någon fil och genereras aldrig.
 */
export const PUBLIK_TONER = Object.freeze({
  ljus: Object.freeze({
    band: "bg-publik-ljus",
    overrad: "text-publik-markering",
    rubrik: "text-publik-ljus-text",
    brod: "text-publik-ljus-dampad",
    kantknapp: "border-publik-ljus-text text-publik-ljus-text hover:bg-publik-ljus-text hover:text-publik-ljus",
    toning: "ops-publik-bildtoning-ljus",
    panel: "bg-publik-ljus-text/6",
  }),
  accent: Object.freeze({
    band: "bg-publik-accentband",
    overrad: "text-publik-accentband-dampad",
    rubrik: "text-publik-accentband-text",
    brod: "text-publik-accentband-dampad",
    kantknapp: "border-publik-accentband-text text-publik-accentband-text hover:bg-publik-accentband-text hover:text-publik-accentband",
    toning: "ops-publik-bildtoning-accent",
    panel: "bg-publik-accentband-text/8",
  }),
  mork: Object.freeze({
    band: "bg-publik-mork",
    overrad: "text-publik-mork-markering",
    rubrik: "text-publik-mork-text",
    brod: "text-publik-mork-dampad",
    kantknapp: "border-publik-mork-text text-publik-mork-text hover:bg-publik-mork-text hover:text-publik-mork",
    toning: "ops-publik-bildtoning-mork",
    panel: "bg-publik-mork-text/8",
  }),
});

/**
 * Knapparna på publika sidor: pillform som SessionStudio (`rounded-full`), 14 px, 600. `primar` är accentknappen,
 * `kant` den kantade. Färgen på `kant` kommer ur tonen (`PUBLIK_TONER[ton].kantknapp`) eller, i hjälten på en bild, ur
 * `kantPaBild`. ⛔ Storlekarna är rollen `etikett` och ingen literal.
 */
export const PUBLIK_KNAPP = Object.freeze({
  bas: "inline-flex items-center justify-center rounded-full text-etikett font-semibold transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  primar: "bg-accent px-8 py-3 text-accent-contrast hover:bg-accent-hover",
  primarLiten: "bg-accent px-5 py-2 text-accent-contrast hover:bg-accent-hover",
  kant: "border-2 px-6 py-2.5",
  kantPaBild: "border-2 border-publik-mork-text/80 px-8 py-3 text-publik-mork-text hover:bg-publik-mork-text/10",
});
