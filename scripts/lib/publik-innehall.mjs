/**
 * Innehållet i provsidorna för det publika skalet (`check-brand`, `montage-publik`). Det är INNEHÅLL och inte ramverk:
 * ramverket levererar inga bilder, inga adresser och inga ord. Bilderna är antingen SVG-toningar som skapas här (vakten, som
 * körs i CI utan några filer) eller riktiga foton som montaget skickar in ur SessionStudios katalog (lokalt, aldrig incheckade).
 */

/** @param {string} a @param {string} b @param {string} [c] @returns {string} En SVG-toning som data-URL, 1600 x 900. */
export function toning(a, b, c = b) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** @param {string} fyll @param {string} text @returns {string} En enkel logga som SVG (text i en pill), 160 x 32. */
export function loggaSvg(fyll, text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="32" viewBox="0 0 160 32"><rect width="160" height="32" rx="6" fill="${fyll}"/><text x="80" y="21" font-family="Georgia, serif" font-size="15" text-anchor="middle" fill="#ffffff">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** En figur (SVG) till `OpsPublikBlock figur`: tre staplar. @returns {string} */
export const FIGUR_SVG =
  '<svg viewBox="0 0 240 140" role="img" aria-label="Tre staplar" width="240" height="140"><rect x="20" y="70" width="40" height="60" rx="6" fill="currentColor" opacity="0.35"/><rect x="100" y="40" width="40" height="90" rx="6" fill="currentColor" opacity="0.6"/><rect x="180" y="10" width="40" height="120" rx="6" fill="currentColor"/></svg>';

/**
 * @param {{ logga?: { src: string, alt: string }, hjalte?: string, block?: string[], sprak?: "sv" | "en" }} [bilder] Bildadresser; saknade ersätts av toningar.
 */
export function innehall(bilder = {}) {
  const [b1, b2, b3] = bilder.block ?? [toning("#7a5c3a", "#c08a55"), toning("#3d5a52", "#8fb3a6"), toning("#4a4458", "#9b8fb5")];
  return {
    logga: bilder.logga ?? { src: loggaSvg("#1f6f6b", "Exempelhubben"), alt: "Exempelhubben" },
    texter: { huvudnavigering: "Huvudnavigering", oppnaMeny: "Öppna meny", stangMeny: "Stäng meny", mobilmeny: "Mobilmeny" },
    lankar: [
      { href: "/funktioner", label: "Funktioner" },
      { href: "/sa-funkar-det", label: "Så funkar det" },
      { href: "/priser", label: "Priser" },
      { href: "/live", label: "Live" },
    ],
    mobilLankar: [
      { href: "/funktioner", label: "Funktioner" },
      { href: "/sa-funkar-det", label: "Så funkar det" },
      { href: "/varfor", label: "Varför" },
      { href: "/priser", label: "Priser" },
      { href: "/om-oss", label: "Om oss" },
      { href: "/live", label: "Live" },
      { href: "/support", label: "Support" },
    ],
    sprak: { aktiv: "sv", val: [{ kod: "sv", label: "SV" }, { kod: "en", label: "EN" }], etikett: "Språk" },
    loggaIn: { href: "/app", label: "Logga in" },
    kom: { href: "/app", label: "Kom igång" },
    hjalte: {
      eyebrow: "Skapa tillsammans",
      title: "Där grupper får saker att hända",
      ingress: "Planering, material och samtal på ett ställe, så att ni kan lägga tiden på det ni egentligen gör.",
      malgrupp: "För artister, kreatörer och performers, eller vilken konstellation som helst.",
      bild: { src: bilder.hjalte ?? toning("#2a3a36", "#6a5a48", "#c08a55"), alt: "Fyra personer repeterar i en ljus lokal" },
      primar: { href: "/app", label: "Kom igång" },
      sekundar: { href: "/live", label: "Se live" },
    },
    block: [
      { ton: "ljus", bildSida: "hoger", eyebrow: "Planera", title: "Kalendern som hela gruppen delar", text: ["Se vem som kan, när, och vad som ska hända. Svaren samlas utan att någon behöver jaga dem."], handling: { href: "/funktioner", label: "Läs mer" }, bild: { src: b1, alt: "En kalender med tre inbokade pass" } },
      { ton: "accent", bildSida: "vanster", eyebrow: "Samla", title: "Allt material, där ni behöver det", text: ["Noter, ljudfiler och anteckningar ligger i samma session som repetitionen."], handling: { href: "/funktioner", label: "Se hur" }, bild: { src: b2, alt: "Ett öppet notblad på ett notställ" } },
      { ton: "mork", bildSida: "hoger", eyebrow: "Spela", title: "Hela spellistan i fickan", text: ["På scen räcker det att bläddra. Resten har ni redan gjort."], handling: { href: "/live", label: "Prova" }, figur: FIGUR_SVG },
      { ton: "ljus", bildSida: "vanster", eyebrow: "Dela", title: "Bjud in utan att ställa krav", text: ["Gäster ser det de behöver och inget mer."], handling: { href: "/funktioner", label: "Läs mer" }, bild: { src: b3, alt: "En mobil som visar en inbjudan" } },
    ],
    uppmaning: { title: "Redo att börja?", text: "Det tar några minuter att komma igång, och det första steget är gratis.", primar: { href: "/app", label: "Kom igång" }, sekundar: { href: "/support", label: "Prata med oss" } },
    fot: {
      tagline: "Creative platform for creative people",
      malgrupp: "För artister, kreatörer och performers, eller vilken konstellation som helst.",
      navEtikett: "Sidfot",
      copyright: "Exempelhubben",
      ar: 2026,
      grupper: [
        { rubrik: "Produkt", lankar: [{ href: "/funktioner", label: "Funktioner" }, { href: "/priser", label: "Priser" }, { href: "/live", label: "Live" }] },
        { rubrik: "Bolaget", lankar: [{ href: "/om-oss", label: "Om oss" }, { href: "/support", label: "Support" }, { href: "/integritet", label: "Integritet" }] },
      ],
    },
    kort: {
      eyebrow: "Om oss",
      title: "Ett lugnare sätt att samla gruppen",
      ingress: "Vi bygger det vi själva saknade: ett ställe där planering och material hör ihop.",
      avsnitt: { eyebrow: "Så funkar det", title: "En idé per block", ingress: "Varje avsnitt har en rubrik och ett stycke.", text: "Löpande text i läsbredd, aldrig längre än 65 tecken per rad." },
    },
  };
}
