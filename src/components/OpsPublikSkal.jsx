import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { PUBLIK_KNAPP } from "../lib/publikKlass.js";
import { KryssIkon, MenuIcon } from "./icons.jsx";

/**
 * Det publika skalet: sidans ram med toppraden, innehållet och sidfoten (0.94.0, CP 2026-10-12).
 *
 * ══ ⛔ CP: "KOMPOSITIONEN MED LOGGAN I MITTEN ÄR INGET SNYGGT. LOGGAN FLYTTAR SIG MELLAN SIDOR" ══════════════════════
 *
 * Skalet är SessionStudios `LandingShell` med `LandingNav` och `LandingFooter`, som generiska komponenter: ramverket
 * känner inga adresser, ingen text och ingen bild. Länkar, knappar, logga och alla ord kommer in som props.
 *
 * ⛔ TOPPRADEN ÄR EN RAD PÅ EN PLATS. Loggan till vänster, länkarna efter den (från `md`), och till höger språkval,
 * "Logga in" och accentknappen. Raden har samma höjd, samma bredd (`max-w-7xl`) och samma sidomarginaler på varje publik
 * sida, och loggan sätter sin höjd ur `--publik-logga-hojd` och inte ur sidan under. Den ligger därför på samma pixel
 * oavsett vad sidan innehåller; `check-brand` mäter det på två olika sidor (`getBoundingClientRect`). Under `md` ligger
 * länkarna bakom en meny (en dialog, med fokus fångat och Escape).
 *
 * Färgerna är det mörka bandets (`--color-publik-mork*`) och accenten, alltså brandvariabler (`docs/brand.md`).
 */

/**
 * @typedef {{ href: string, label: string, aktiv?: boolean }} PubliktLank
 * @typedef {{ src?: string, paMork?: string, paLjus?: string, alt: string, href?: string, srcSet?: string }} PubliktLogga
 * @typedef {{
 *   aktiv: string,
 *   val: ReadonlyArray<{ kod: string, label: string, ariaLabel?: string }>,
 *   onVal: (kod: string) => void,
 *   etikett: string,
 * }} PubliktSprak
 * @typedef {{
 *   huvudnavigering: string,
 *   oppnaMeny: string,
 *   stangMeny: string,
 *   mobilmeny: string,
 * }} PubliktHuvudTexter
 */

const HUVUDTEXTER = /** @type {const} */ (["huvudnavigering", "oppnaMeny", "stangMeny", "mobilmeny"]);

/**
 * Toppradens två toner (0.94.0): `mork` (SessionStudio, förval) och `ljus`. Klassnamnen står utskrivna, aldrig sammansatta.
 * @type {Record<string, { fast: string, genomskinlig: string, kant: string, lank: string, sprakVald: string, sprakAnnan: string, ikon: string, meny: string, hover: string }>}
 */
const HUVUDTON = {
  mork: {
    fast: "bg-publik-mork",
    genomskinlig: "bg-publik-mork/40 backdrop-blur-md",
    kant: "border-publik-mork-text/10 text-publik-mork-text",
    lank: "text-etikett font-medium text-publik-mork-text/85 transition-colors duration-(--duration-fast) ease-standard hover:text-publik-mork-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    sprakVald: "bg-publik-mork-text/15 text-publik-mork-text",
    sprakAnnan: "text-publik-mork-text/70 hover:text-publik-mork-text",
    ikon: "text-publik-mork-text",
    meny: "bg-publik-mork text-publik-mork-text",
    hover: "hover:text-publik-mork-markering",
  },
  ljus: {
    fast: "bg-publik-ljus",
    genomskinlig: "bg-publik-ljus/70 backdrop-blur-md",
    kant: "border-publik-ljus-text/10 text-publik-ljus-text",
    lank: "text-etikett font-medium text-publik-ljus-text/80 transition-colors duration-(--duration-fast) ease-standard hover:text-publik-ljus-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    sprakVald: "bg-publik-ljus-text/10 text-publik-ljus-text",
    sprakAnnan: "text-publik-ljus-text/65 hover:text-publik-ljus-text",
    ikon: "text-publik-ljus-text",
    meny: "bg-publik-ljus text-publik-ljus-text",
    hover: "hover:text-publik-markering",
  },
};

/**
 * Toppraden.
 *
 * @param {object} props
 * @param {PubliktLogga} props.logga Loggan: `alt`, dit den länkar (`href`, förval `/`) och en bild. Höjden är `--publik-logga-hojd`. Bilden är `src`, eller ETT PAR: `paMork` (loggan för en mörk botten) och `paLjus` (för en ljus). Toppraden väljer efter sin `ton` och inte efter ett fast värde, eftersom en logga i en ruta försvinner mot en botten i sin egen färg; ger instansen bara `src` används den på båda. Ramverket känner inga filnamn.
 * @param {ReadonlyArray<PubliktLank>} props.lankar Länkarna i mitten, från `md`. Fyra eller färre: raden är till för att leda vidare, inte för att visa allt.
 * @param {ReadonlyArray<PubliktLank>} [props.mobilLankar] Länkarna i mobilmenyn. Förval `lankar`. SessionStudio visar där ALLA sidor och i raden bara fyra.
 * @param {PubliktSprak} [props.sprak] Språkval, kompakt (SV / EN). Utelämnat: inget språkval.
 * @param {{ href: string, label: string }} [props.loggaIn] "Logga in", en textlänk till höger.
 * @param {{ href: string, label: string }} [props.kom] Accentknappen, "Kom igång".
 * @param {import("react").ReactNode} [props.konto] (0.150.0, #352) Kontot: avataren och dess meny, ritad av appen. Står där Logga in och accentknappen annars står, och ERSÄTTER dem: den som är inloggad ska inte erbjudas att logga in eller komma igång. Under `md` står den bredvid hamburgaren och inte i menyn, och mobilmenyn har då inte heller Logga in eller accentknappen. Ritas EN gång (en hel meny finns inte i två exemplar, varav ett dolt). Ramverket vet inget om vad kontot är: raderna i menyn byggs med `radKlass` och fälten med `faltKlass`, som är exporterade.
 * @param {boolean} [props.transparent] Genomskinlig med oskärpa över en hjälte (SessionStudios startsida); annars helt i tonens färg.
 * @param {"mork"|"ljus"} [props.ton] Toppradens ton: `mork` (förval, som SessionStudio) eller `ljus`. Loggan kommer från instansen och ska fungera på båda; en genomskinlig logga utan ram gör det.
 * @param {PubliktHuvudTexter} props.texter Orden som inte är innehåll: navigeringens namn och menyknapparnas. Ramverket har inga förval, eftersom en sida har ett språk och ramverket inte vet vilket.
 */
export function OpsPublikHuvud({ logga, lankar, mobilLankar, sprak, loggaIn, kom, konto, transparent = false, ton = "mork", texter }) {
  const [oppen, setOppen] = useState(false);
  if (!logga || !logga.alt || !(logga.src || logga.paMork || logga.paLjus)) {
    throw new Error("OpsPublikHuvud: logga kräver alt och en bild (src, eller paMork och paLjus). Loggan är märket, och en bild utan alt-text är ett märke ingen skärmläsare kan nämna.");
  }
  for (const nyckel of HUVUDTEXTER) {
    if (!texter?.[nyckel]) throw new Error(`OpsPublikHuvud: texter.${nyckel} saknas. Ramverket har inga orden och gissar dem inte.`);
  }
  const T = HUVUDTON[ton];
  if (!T) throw new Error(`OpsPublikHuvud: okänd ton "${ton}". Giltiga: ${Object.keys(HUVUDTON).join(", ")}.`);
  const loggaSrc = (ton === "mork" ? logga.paMork : logga.paLjus) ?? logga.src ?? logga.paMork ?? logga.paLjus;
  const mobil = mobilLankar ?? lankar;
  const hogerDesktop = (
    <div className="hidden items-center gap-3 md:flex">
      {sprak ? <Sprakval sprak={sprak} ton={T} /> : null}
      {loggaIn ? (
        <a href={loggaIn.href} className={T.lank}>
          {loggaIn.label}
        </a>
      ) : null}
      {kom ? (
        <a href={kom.href} className={cx(PUBLIK_KNAPP.bas, PUBLIK_KNAPP.primarLiten)}>
          {kom.label}
        </a>
      ) : null}
    </div>
  );
  const menyn = (
    <Dialog.Root open={oppen} onOpenChange={setOppen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={texter.oppnaMeny}
          className={cx("inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden", T.ikon)}
        >
          <MenuIcon size={24} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          data-ops-publik="mobilmeny"
          aria-describedby={undefined}
          className={cx("fixed inset-0 z-(--z-modal) flex flex-col items-center justify-center px-6 md:hidden", T.meny)}
        >
          <Dialog.Title className="sr-only">{texter.mobilmeny}</Dialog.Title>
          <Dialog.Close
            aria-label={texter.stangMeny}
            className={cx("absolute top-3 right-4 inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", T.ikon)}
          >
            <KryssIkon size={24} />
          </Dialog.Close>
          <ul className="m-0 flex list-none flex-col items-center gap-5 p-0 text-publik-ingress font-medium">
            {mobil.map((l) => (
              <li key={l.href}>
                <a href={l.href} aria-current={l.aktiv ? "page" : undefined} className={T.hover} onClick={() => setOppen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
            {loggaIn && !konto ? (
              <li>
                <a href={loggaIn.href} className={T.hover} onClick={() => setOppen(false)}>
                  {loggaIn.label}
                </a>
              </li>
            ) : null}
          </ul>
          {kom && !konto ? (
            <a href={kom.href} className={cx(PUBLIK_KNAPP.bas, PUBLIK_KNAPP.primar, "mt-8")} onClick={() => setOppen(false)}>
              {kom.label}
            </a>
          ) : null}
          {sprak ? (
            <div className="mt-8">
              <Sprakval sprak={sprak} ton={T} stor />
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
  return (
    <nav
      data-ops-publik="huvud"
      aria-label={texter.huvudnavigering}
      className={cx("sticky top-0 z-(--z-chrome) border-b", T.kant, transparent ? T.genomskinlig : T.fast)}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href={logga.href ?? "/"} data-publik-logga="" className="flex shrink-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <img src={loggaSrc} srcSet={logga.srcSet} alt={logga.alt} className="h-(--publik-logga-hojd) w-auto" decoding="async" />
        </a>

        <ul className="m-0 hidden list-none items-center gap-6 p-0 md:flex">
          {lankar.map((l) => (
            <li key={l.href}>
              <a href={l.href} aria-current={l.aktiv ? "page" : undefined} className={T.lank}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {konto ? (
          // Med ett konto: språkvalet (om det finns) från `md`, kontot på alla bredder och hamburgern under `md`, i ETT kluster till höger.
          // Utan konto är raden som förut (inget extra element), så att loggan och länkarna ligger där de låg.
          <div className="flex shrink-0 items-center gap-3">
            {sprak ? (
              <div className="hidden items-center gap-3 md:flex">
                <Sprakval sprak={sprak} ton={T} />
              </div>
            ) : null}
            <div data-publik-konto="" className="flex items-center">
              {konto}
            </div>
            {menyn}
          </div>
        ) : (
          <>
            {hogerDesktop}
            {menyn}
          </>
        )}
      </div>
    </nav>
  );
}

/**
 * Språkvalet: två knappar bredvid varandra, den valda markerad.
 * @param {{ sprak: PubliktSprak, ton: { sprakVald: string, sprakAnnan: string }, stor?: boolean }} props
 */
function Sprakval({ sprak, ton, stor = false }) {
  return (
    <div role="group" aria-label={sprak.etikett} className="flex items-center gap-1 text-meta font-medium">
      {sprak.val.map((v) => {
        const vald = v.kod === sprak.aktiv;
        return (
          <button
            key={v.kod}
            type="button"
            aria-pressed={vald}
            aria-label={v.ariaLabel}
            onClick={() => sprak.onVal(v.kod)}
            className={cx(
              "rounded-sm transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              stor ? "px-3 py-1 text-etikett" : "px-2 py-1",
              vald ? ton.sprakVald : ton.sprakAnnan,
            )}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sidfoten: det mörka bandet med tagline, målgrupp, länkgrupper och copyright.
 *
 * @param {object} props
 * @param {string} props.tagline Raden i serif och accentfärg ("Creative platform for creative people").
 * @param {string} [props.malgrupp] Raden under taglinen.
 * @param {ReadonlyArray<{ rubrik: string, lankar: ReadonlyArray<PubliktLank> }>} [props.grupper] Länkgrupper med rubrik, i två kolumner.
 * @param {string} props.copyright Hela raden längst ned, utan årtal: ramverket sätter in året.
 * @param {string} props.navEtikett Namnet på sidfotens navigering.
 * @param {number} [props.ar] Året i copyrightraden. Förval: innevarande år. ⛔ Ger ett prov som inte flyttar sig med klockan.
 */
export function OpsPublikFot({ tagline, malgrupp, grupper = [], copyright, navEtikett, ar }) {
  if (!navEtikett) throw new Error("OpsPublikFot: navEtikett saknas. Ramverket har inga orden och gissar dem inte.");
  return (
    <footer data-ops-publik="fot" className="bg-publik-mork px-4 py-12 text-publik-mork-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="md:max-w-sm">
            <p className="m-0 font-display-publik text-publik-ingress text-publik-mork-markering">{tagline}</p>
            {malgrupp ? <p className="mt-2 mb-0 text-etikett text-publik-mork-dampad">{malgrupp}</p> : null}
          </div>
          {grupper.length > 0 ? (
            <nav aria-label={navEtikett} className="grid grid-cols-2 gap-x-12 gap-y-8">
              {grupper.map((g) => (
                <div key={g.rubrik}>
                  <p className="m-0 mb-3 text-publik-eyebrow uppercase text-publik-mork-text/55">{g.rubrik}</p>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 text-etikett">
                    {g.lankar.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} className="text-publik-mork-text/75 hover:text-publik-mork-text">
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          ) : null}
        </div>
        <p className="mt-10 mb-0 border-t border-publik-mork-text/10 pt-6 text-meta text-publik-mork-text/45">
          © {ar ?? new Date().getFullYear()} {copyright}
        </p>
      </div>
    </footer>
  );
}

/**
 * Skalet: toppraden, `<main id="main-content">` och sidfoten på en ljus sida.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.huvud Toppraden, en `<OpsPublikHuvud />`.
 * @param {import("react").ReactNode} [props.fot] Sidfoten, en `<OpsPublikFot />`.
 * @param {import("react").ReactNode} props.children Sidans block: `OpsPublikHjalte`, `OpsPublikBlock`, `OpsPublikUppmaning`.
 */
export function OpsPublikSkal({ huvud, fot, children }) {
  return (
    <div data-ops-publik="skal" className="min-h-svh bg-publik-ljus font-sans text-publik-ljus-text">
      {huvud}
      <main id="main-content">{children}</main>
      {fot}
    </div>
  );
}
