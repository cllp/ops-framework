import { useContext, useId, useState } from "react";
import { KOMMENTARBILAGA_TYPER, MAX_HANDELSEKOMMENTAR, MAX_KOMMENTARBILAGA, kommentarbilagaFel } from "../lib/handelsemodell.js";
import { isImage } from "../lib/file.js";
import { formatDagOchKlockslag } from "../lib/format.js";
import { OppnaHandelseKontext } from "../lib/handelsekontext.js";
import { laesSkapare, namnMedVia } from "../lib/skapare.js";
import { handelseIdUrAdress } from "../lib/handelsepanel.js";
import { RAKNARE_FRAN } from "../lib/samtal.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsTextarea } from "./OpsField.jsx";
import { OpsFilePicker } from "./OpsFilePicker.jsx";
import { BilagaVisning } from "./BilagaVisning.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { usePersonnamn } from "./usePersonnamn.js";

/**
 * Kommentarstråden på en händelse (0.48.0, #232, beslut 0002).
 *
 * CP 2026-10-02: kommentarer på händelser, och "Ja och ja" på att den som skrev en kommentar får ta bort den och att en ny
 * kommentar syns i Inkorgen. Inkorgens rad är `kommentarsrader` (härledd); den här komponenten är tråden i händelsepanelen.
 *
 * ⛔ RAMVERKET RITAR, APPEN KOPPLAR DATA. Komponenten vet inte var kommentarerna ligger: den får raderna och två funktioner.
 * Appens normala koppling är `createKommentarkalla` (lista eller prenumerera, skriv, taBort).
 *
 * ⛔ ÄLDST FÖRST, OCH SKRIVRUTAN UNDER. En tråd läses uppifrån, och det man skriver hamnar sist, där man just skrev det.
 *
 * ⛔ TOM TRÅD SKRIVS UT (arbetsreglernas punkt 5): "Inga kommentarer än", inte en tom yta som ser ut som att något inte laddat.
 *
 * ⛔ BARA MINA KOMMENTARER HAR "TA BORT". Regeln släpper bara igenom den som skrev den, och en knapp på någon annans rad hade
 * varit en knapp regeln nekar. Utan `onTaBort` ritas ingen knapp alls.
 *
 * ⛔ ETT FEL STÅR UTSKRIVET OCH TEXTEN BLIR KVAR. En kommentar som inte gick fram och försvinner ur rutan är skriven förgäves.
 *
 * ══ ⛔ BILD OCH FIL (0.73.0, cllp/bolag-ops#570) ═══════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06: "Vill kunna klistra in bild i kommentar. Kommentarer behöver ha bilder elelr filer också." Med `bilagor` står
 * `OpsFilePicker` med gemknappen i skrivrutan (som chattens Bifoga, 0.132.0): knappen, inklistring (Cmd+V) var som helst på sidan, och en förhandsvisning före sändning,
 * en miniatyr för en bild och namnet för allt annat. Taket och typerna är modellens (`MAX_KOMMENTARBILAGA`,
 * `KOMMENTARBILAGA_TYPER`), samma konstanter som regeln är byggd av. `onSkriv` får `(text, { bilaga })`, och med en bilaga får
 * texten vara tom.
 *
 * ⛔ INKLISTRINGEN TAS BARA NÄR FOKUS ÄR I TRÅDEN. `OpsFilePicker` lyssnar på hela dokumentet, och två öppna trådar (en i
 * inkorgen och en i händelsepanelen) hade båda fått samma skärmbild. Den som klistrar in i en kommentar står i dess skrivruta.
 *
 * ⛔ AV SOM FÖRVAL. En app vars utrullade regel inte känner fältet hade fått varje kommentar med bilaga nekad, så appen slår på
 * det när regeln från 0.73.0 är utrullad. Bilagor som redan finns på en kommentar visas alltid.
 *
 * ══ ⛔ EN KOMPONENT FÖR HÄNDELSER OCH ÄRENDEN (0.150.0, #381, beslut CP 2026-10-26) ═══════════════════════════════════════
 *
 * CP 2026-10-14: "vi har ju kommentarer till ärenden, så kommer samma modell in i händelser. Skulle kunna vara samma motor."
 * Efter genomgången 2026-10-26 (CP: "Ja alla") är beslutet litet: EN UI-komponent, och den här är den. Datan ligger kvar där den är
 * (`handelser/{id}/kommentarer` och appens `inkorg/{id}/kommentarer`), trådarna slås inte ihop, reglerna rörs inte, och en bilaga
 * stannar i appen och skickas inte till GitHub (en kundbild ska inte bli publik av att hamna i en kommentar).
 *
 * Det som skilde ärendets tråd från den här var fyra saker, och de är fyra frivilliga props. Ingen av dem ändrar något utan sig:
 *   - `radFot(k)`: en rad under en kommentar, t.ex. "På ärendet" med länk, eller skälet till att den inte kom fram. ⛔ Läget står på
 *     VARJE rad och inte på tråden, för två kommentarer i samma tråd kan ha olika öde.
 *   - `skrivHint`: en rad under skrivrutans etikett som säger vart kommentaren tar vägen INNAN man skrivit den.
 *   - `fot`: en rad under tråden, t.ex. att kommentarer skrivna direkt på ärendet inte syns här. Ritas också när tråden är tom,
 *     laddar eller föll, eftersom det den säger gäller hela tråden.
 *   - `kanTaBort(k)`: får BARA snäva in. "Ta bort" kräver fortfarande `onTaBort` och att kommentaren är min; regeln släpper inte
 *     igenom mer än så, och en knapp regeln nekar är en knapp som ljuger.
 * En kommentars `skapadAv` får också vara den gamla strängen (appens ärenden bär den tills bakfyllnaden är körd).
 *
 * ══ ⛔ TECKENRÄKNARE, OCH INGEN TYST KAPNING (0.153.0, cllp/ops-framework#460 punkt 7) ═══════════════════════════════════════════════
 *
 * Skrivrutan hade `maxLength={MAX_HANDELSEKOMMENTAR}`, och webbläsaren kapar en inklistrad text vid taket utan ett ord: appen ställde ut taket under rutan som nödlösning
 * (lifehub.app PR 480, granskningspunkt 12). Nu är det som i chattens skrivfält (`OpsMeddelanden`, 0.106.0): hela texten står kvar, räknaren syns de sista `RAKNARE_FRAN` tecknen
 * ("Kommentaren är N tecken, taket är 5000"), och över taket säger en rad hur många tecken för lång den är, fältet markeras och Skicka är avstängd. Taket är modellens
 * (`MAX_HANDELSEKOMMENTAR`), samma som regeln och `byggKommentar`.
 *
 * @param {object} props
 * @param {ReadonlyArray<{ id: string, text: string, skapad: string, skapadAv?: { uid?: string | null, namn?: string } | string }>} props.kommentarer
 * @param {string} props.uid Den som tittar.
 * @param {(text: string, extra: { bilaga: import("../lib/file.js").Bilaga | null }) => Promise<unknown> | void} props.onSkriv
 * @param {boolean} [props.bilagor] (0.73.0) Visa filväljaren. Av som förval, se ovan.
 * @param {(id: string) => Promise<unknown> | void} [props.onTaBort]
 * @param {(kommentar: any) => boolean} [props.kanTaBort] (0.150.0, #381) Snävar in vilka av MINA kommentarer som har "Ta bort". Utan: alla mina, när `onTaBort` finns.
 * @param {(kommentar: any) => import("react").ReactNode} [props.radFot] (0.150.0, #381) En rad under varje kommentar, normalt dess synkläge. Returnerar den inget ritas inget.
 * @param {string} [props.skrivHint] (0.150.0, #381) Hjälptexten under skrivrutans etikett: vart kommentaren tar vägen.
 * @param {import("react").ReactNode} [props.fot] (0.150.0, #381) En rad under tråden, ovanför skrivrutan. Ritas i varje läge (tom, laddar, fel).
 * @param {boolean} [props.laddar]
 * @param {Error | string | null} [props.fel] Läsningen föll. Skrivs ut med texten.
 * @param {"sv" | "en"} [props.sprak]
 * @param {string} [props.rubrik]
 * @param {string} [props.tomText]
 * @param {string} [props.laddarText]
 * @param {string} [props.lasfelText]
 * @param {string} [props.skrivEtikett]
 * @param {string} [props.skickaEtikett]
 * @param {string} [props.taBortEtikett]
 * @param {string} [props.skrivfelText]
 * @param {string} [props.taBortFelText]
 * @param {string} [props.duText]
 * @param {string} [props.bifogaEtikett]
 * @param {string} [props.bilagaText]
 * @param {string} [props.langdText] (0.153.0) Räknaren de sista tecknen före taket. `{n}` och `{max}` byts. Förval "Kommentaren är {n} tecken, taket är {max}.".
 * @param {string} [props.forLangText] (0.153.0) Felet över taket. `{over}` byts. Förval "Kommentaren är {over} tecken för lång. Korta den för att skicka.".
 */
export function OpsKommentarer(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  return <OpsKommentarerRitad {...forvalda(ORD_OPSKOMMENTARER, sprak)} {...definierade(props)} sprak={sprak} />;
}

/** @param {any} p */
function OpsKommentarerRitad({
  kommentarer,
  uid,
  onSkriv,
  onTaBort,
  kanTaBort,
  radFot,
  skrivHint,
  fot,
  bilagor = false,
  laddar = false,
  fel = null,
  sprak,
  rubrik = ORD_OPSKOMMENTARER.rubrik.sv,
  tomText = ORD_OPSKOMMENTARER.tomText.sv,
  laddarText = ORD_OPSKOMMENTARER.laddarText.sv,
  lasfelText = ORD_OPSKOMMENTARER.lasfelText.sv,
  skrivEtikett = ORD_OPSKOMMENTARER.skrivEtikett.sv,
  skickaEtikett = ORD_OPSKOMMENTARER.skickaEtikett.sv,
  taBortEtikett = ORD_OPSKOMMENTARER.taBortEtikett.sv,
  skrivfelText = ORD_OPSKOMMENTARER.skrivfelText.sv,
  taBortFelText = ORD_OPSKOMMENTARER.taBortFelText.sv,
  duText = ORD_OPSKOMMENTARER.duText.sv,
  bifogaEtikett = ORD_OPSKOMMENTARER.bifogaEtikett.sv,
  bilagaText = ORD_OPSKOMMENTARER.bilagaText.sv,
  langdText = ORD_OPSKOMMENTARER.langdText.sv,
  forLangText = ORD_OPSKOMMENTARER.forLangText.sv,
}) {
  if (typeof onSkriv !== "function") throw new Error("OpsKommentarer: onSkriv krävs. En tråd utan skrivruta är en lista, och den heter inte kommentarer.");
  if (onTaBort !== undefined && typeof onTaBort !== "function") throw new Error("OpsKommentarer: onTaBort måste vara en funktion, eller utelämnas.");
  for (const [namn, v] of Object.entries({ kanTaBort, radFot })) {
    if (v !== undefined && typeof v !== "function") throw new Error(`OpsKommentarer: ${namn} måste vara en funktion, eller utelämnas.`);
  }
  const personnamn = usePersonnamn();
  const rubrikId = useId();
  const [utkast, setUtkast] = useState("");
  const [bilaga, setBilaga] = useState(/** @type {import("../lib/file.js").Bilaga | null} */ (null));
  const [fokusInne, setFokusInne] = useState(false);
  // Gemknappens plats i skrivrutan (0.132.0): `OpsTextarea` ger den, `OpsFilePicker` ritar knappen i den. `null` tills fältet monterats.
  const [bifogaPlats, setBifogaPlats] = useState(/** @type {HTMLElement | null} */ (null));
  const [skriver, setSkriver] = useState(false);
  const [skrivfel, setSkrivfel] = useState(/** @type {string | null} */ (null));
  const [tarBort, setTarBort] = useState(/** @type {string | null} */ (null));
  const [taBortFel, setTaBortFel] = useState(/** @type {string | null} */ (null));
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const rensad = utkast.trim();
  // ⛔ INGEN TYST KAPNING (se filhuvudet): längden räknas som modellen räknar den (`byggKommentar` prövar den trimmade texten), och över taket är Skicka avstängd.
  const langd = rensad.length;
  const forLang = langd > MAX_HANDELSEKOMMENTAR;
  // ⛔ RÄKNAREN RÄKNAR SAMMA LÄNGD SOM TAKET PRÖVAR (granskningen av PR 464): den trimmade. Förut stod `utkast.length` i räknaren, så blanksteg i kanterna gav en siffra över taket på en text som gick att skicka.
  const visaRaknare = langd >= MAX_HANDELSEKOMMENTAR - RAKNARE_FRAN;
  const kanSkicka = Boolean(rensad || bilaga) && !forLang;

  const skicka = async () => {
    if (!kanSkicka || skriver) return;
    setSkrivfel(null);
    setSkriver(true);
    try {
      await onSkriv(rensad, { bilaga });
      setUtkast("");
      setBilaga(null);
    } catch (e) {
      setSkrivfel(`${skrivfelText}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSkriver(false);
    }
  };
  /** @param {string} id */
  const taBort = async (id) => {
    setTaBortFel(null);
    setTarBort(id);
    try {
      await onTaBort(id);
    } catch (e) {
      setTaBortFel(`${taBortFelText}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTarBort(null);
    }
  };

  // #369: trådens bilder räknas en gång (KAN 1), med kommentarens id så att platsen följer med (BÖR 2).
  // ⛔ Namnet på den som skrev går genom `namnMedVia` (0.135.0, lifehub.app#409): en kommentar som en personlig API-nyckel skrev heter "Miranda via Byggagent".
  // 0.150.0 (#381): `laesSkapare` är den enda läsaren av fältet (regel 2) och tar båda formerna, objektet och den gamla strängen
  // (appens ärenden bär den tills bakfyllnaden körts). Strängen ger ett namn och inget uid.
  const skrivarnamn = (/** @type {any} */ stampel) => {
    const s = laesSkapare(stampel);
    return namnMedVia(personnamn(s.namn, s.uid ?? "").text, s.via, sprak);
  };
  const galleri = tradensBilder(kommentarer ?? [], (/** @type {any} */ x) => `${bilagaText} ${skrivarnamn(x.skapadAv)}: ${x.bilaga.namn}`);
  return (
    <section
      data-ops-kommentarer=""
      aria-labelledby={rubrikId}
      className="flex flex-col gap-3"
      onFocus={() => setFokusInne(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget))) setFokusInne(false);
      }}
    >
      <span id={rubrikId} className="text-rubrik text-ink">
        {rubrik}
      </span>
      {fel ? (
        <p role="alert" className="m-0 text-meta text-danger">
          {`${lasfelText}: ${fel instanceof Error ? fel.message : String(fel)}`}
        </p>
      ) : laddar ? (
        <p role="status" className="m-0 text-meta text-ink-muted">
          {laddarText}
        </p>
      ) : kommentarer.length === 0 ? (
        <p data-kommentarer-tomma="" className="m-0 text-meta text-ink-muted">
          {tomText}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {kommentarer.map((/** @type {any} */ k) => {
            const skapare = laesSkapare(k.skapadAv);
            const avUid = skapare.uid;
            const min = avUid !== null && avUid === uid;
            const kanTaBortDen = min && onTaBort && (kanTaBort ? kanTaBort(k) === true : true);
            const radens = radFot ? radFot(k) : null;
            const namn = skrivarnamn(k.skapadAv);
            return (
              <li key={k.id} data-kommentar={k.id} className="flex min-w-0 gap-3 rounded-base bg-raised p-3">
                <OpsIdentity name={namn} seed={avUid ?? (skapare.namn || k.id)} size="avatar" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="truncate text-etikett font-medium text-ink">
                      {namn}
                      {min ? ` (${duText})` : ""}
                    </span>
                    <span className="text-meta text-ink-muted">{formatDagOchKlockslag(k.skapad, { locale })}</span>
                  </div>
                  {k.text ? <p className="m-0 whitespace-pre-wrap break-words text-etikett text-ink">{k.text}</p> : null}
                  {k.bilaga?.dataUrl ? <Kommentarbilaga bilaga={k.bilaga} namn={namn} bilagaText={bilagaText} sprak={sprak} galleri={galleri} galleriPlats={galleri.findIndex((g) => g.id === k.id)} /> : null}
                  {radens ? (
                    <div data-kommentar-fot="" className="min-w-0 text-meta text-ink-muted">
                      {radens}
                    </div>
                  ) : null}
                </div>
                {kanTaBortDen ? (
                  <OpsButton variant="ghost" size="sm" busy={tarBort === k.id} disabled={tarBort !== null} ariaLabel={`${taBortEtikett}, ${(k.text || k.bilaga?.namn || "").slice(0, 40)}`} onClick={() => taBort(k.id)}>
                    {taBortEtikett}
                  </OpsButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {taBortFel ? (
        <p role="alert" className="m-0 text-meta text-danger">
          {taBortFel}
        </p>
      ) : null}
      {fot ? (
        <div data-kommentarer-fot="" className="min-w-0 text-meta text-ink-muted">
          {fot}
        </div>
      ) : null}
      {/* ⛔ RÄKNAREN ÄR FÄLTETS (granskningen av PR 464): kopplad med `aria-describedby` som i chattens skrivfält, och EN levande yta. Över taket bär den felet själv; `error` är bara sändfelet. */}
      <OpsField
        label={skrivEtikett}
        hint={skrivHint}
        error={skrivfel ?? undefined}
        raknare={visaRaknare ? { over: forLang, text: forLang ? forLangText.replace("{over}", String(langd - MAX_HANDELSEKOMMENTAR)) : langdText.replace("{n}", String(langd)).replace("{max}", String(MAX_HANDELSEKOMMENTAR)) } : undefined}
      >
        <OpsTextarea value={utkast} onChange={setUtkast} rows={3} disabled={skriver} onSend={skicka} {...(bilagor ? { bifogaPlats: setBifogaPlats } : {})} />
      </OpsField>
      {bilagor ? (
        // Gemknappen sitter i skrivrutan (som chattens Bifoga); här står bara förhandsvisningen och felet, när det finns något att visa.
        <div data-kommentar-bilaga="" className="empty:hidden">
          <OpsFilePicker
            value={bilaga}
            onChange={setBilaga}
            maxChars={MAX_KOMMENTARBILAGA}
            typer={KOMMENTARBILAGA_TYPER}
            accept={KOMMENTARBILAGA_TYPER.join(",")}
            paste={fokusInne}
            ariaLabel={bifogaEtikett}
            knappPlats={bifogaPlats}
          />
        </div>
      ) : null}
      <div className="flex justify-end">
        <OpsButton variant="primary" busy={skriver} disabled={!kanSkicka || skriver} onClick={skicka}>
          {skickaEtikett}
        </OpsButton>
      </div>
    </section>
  );
}

/** Orden i tråden, svenska och engelska (0.46.0-mönstret). */
export const ORD_OPSKOMMENTARER = {
  rubrik: { sv: "Kommentarer", en: "Comments" },
  tomText: { sv: "Inga kommentarer än.", en: "No comments yet." },
  laddarText: { sv: "Läser kommentarerna", en: "Loading comments" },
  lasfelText: { sv: "Kommentarerna kunde inte läsas", en: "The comments could not be loaded" },
  skrivEtikett: { sv: "Skriv en kommentar", en: "Write a comment" },
  skickaEtikett: { sv: "Skicka", en: "Send" },
  taBortEtikett: { sv: "Ta bort", en: "Delete" },
  skrivfelText: { sv: "Kommentaren sparades inte", en: "The comment was not saved" },
  taBortFelText: { sv: "Kommentaren togs inte bort", en: "The comment was not deleted" },
  duText: { sv: "du", en: "you" },
  bifogaEtikett: { sv: "Bifoga", en: "Attach" },
  bilagaText: { sv: "Bilaga från", en: "Attachment from" },
  langdText: { sv: "Kommentaren är {n} tecken, taket är {max}.", en: "The comment is {n} characters, the limit is {max}." },
  forLangText: { sv: "Kommentaren är {over} tecken för lång. Korta den för att skicka.", en: "The comment is {over} characters too long. Shorten it to send." },
};

/**
 * En bilaga på en kommentar: bilden som en miniatyr som öppnas i full storlek, en fil som en nedladdningslänk med namn och storlek.
 *
 * ⛔ INGEN `<iframe>` FÖR EN PDF, av samma skäl som i `OpsFilePicker`: den ritas olika i varje webbläsare, och en tom ruta ser ut
 * som att filen inte kom fram.
 *
 * @param {{ bilaga: import("../lib/file.js").Bilaga, namn: string, bilagaText: string, sprak?: string, galleri?: { bilaga: any, alt: string }[], galleriPlats?: number }} props
 */
function Kommentarbilaga({ bilaga, namn, bilagaText, sprak, galleri, galleriPlats }) {
  return <BilagaVisning bilaga={bilaga} alt={`${bilagaText} ${namn}: ${bilaga.namn}`} sprak={sprak} galleri={galleri} galleriPlats={galleriPlats} />;
}

/**
 * En rad i inkorgen för en händelse med nya kommentarer från någon annan (0.48.0). Raderna räknas fram med `kommentarsrader`,
 * och raden försvinner när händelsen öppnats och läsmärket flyttats.
 *
 * @param {object} props
 * @param {string} props.titel Händelsens rubrik.
 * @param {number} props.olasta
 * @param {string} props.namn Den som skrev den senaste.
 * @param {{ nyckelId?: string, namn: string }} [props.via] (0.135.0, lifehub.app#409) `senaste.via` ur `kommentarsrader`: raden heter då "Miranda via Byggagent".
 * @param {string} props.text Den senaste kommentaren.
 * @param {string} [props.href] Leder till händelsen, normalt `handelseHref(id)`, som `OpsSvarsrad`. Skalet öppnar panelen.
 * @param {() => void} [props.onOppna] Utan `href`: öppnar händelsen, t.ex. `useOppnaHandelse()(id)`. MED `href`: anropas vid klicket,
 *   före navigeringen, t.ex. för att markera raden läst direkt. En av de två krävs.
 *   ⛔ `href` ÄR DEN SOM GÅR ATT RITA UTANFÖR SKALET. `useOppnaHandelse` kastar utan skal, och en inkorg som ritas i ett prov utan skal
 *   föll då i varje prov (bolag-ops #551: 43 röda). Med `href` behövs ingen hook, och `onOppna` kan ändå göra sitt.
 * @param {"sv" | "en"} [props.sprak]
 */
export function OpsKommentarsrad(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  const ord = forvalda(ORD_OPSKOMMENTARSRAD, sprak);
  const { titel, olasta, namn, via, text, href, onOppna } = props;
  // ⛔ INNE I SKALET ÖPPNAS PANELEN UTAN OMLADDNING. En länk till `?handelse=<id>` laddar annars om hela appen, och då ligger inte
  // Inkorgen kvar under panelen när man går tillbaka. Kontexten är `null` utanför skalet (och i ett skal utan panel), och då är raden
  // en vanlig länk: den går att rita i ett prov utan skal, vilket `useOppnaHandelse` inte gör (den kastar).
  const oppnaISkalet = useContext(OppnaHandelseKontext);
  if (!href && typeof onOppna !== "function") throw new Error("OpsKommentarsrad: href eller onOppna krävs. En rad om nya kommentarer som inte leder till dem är en rad man inte kan bli av med.");
  const antal = olasta === 1 ? ord.enNy : `${olasta} ${ord.flerNya}`;
  const klass =
    "flex w-full min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-card border border-line bg-surface p-3 text-left no-underline transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const innehall = (
    <>
      <span className="block w-full truncate text-etikett font-medium text-ink">{titel}</span>
      <span className="block w-full truncate text-meta text-ink-muted">{`${antal} · ${namnMedVia(namn || ord.namnSaknas, via, sprak)}: ${text}`}</span>
    </>
  );
  return href ? (
    <a
      href={href}
      data-ops-kommentarsrad=""
      className={klass}
      onClick={(e) => {
        if (typeof onOppna === "function") onOppna();
        const id = handelseIdUrAdress(href);
        if (oppnaISkalet && id && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          oppnaISkalet(id);
        }
      }}
    >
      {innehall}
    </a>
  ) : (
    <button type="button" data-ops-kommentarsrad="" onClick={onOppna} className={klass}>
      {innehall}
    </button>
  );
}

/** Orden på inkorgens rad. */
export const ORD_OPSKOMMENTARSRAD = {
  enNy: { sv: "1 ny kommentar", en: "1 new comment" },
  flerNya: { sv: "nya kommentarer", en: "new comments" },
  namnSaknas: { sv: "Namn saknas", en: "Name missing" },
};

/**
 * Trådens bilder i ordning, för bläddringen i den stora vyn (#369).
 *
 * @param {any[]} kommentarer
 * @param {(k: any) => string} altFor
 * @returns {{ id: string, bilaga: any, alt: string }[]}
 */
function tradensBilder(kommentarer, altFor) {
  return kommentarer
    .filter((k) => k?.bilaga?.dataUrl && isImage(k.bilaga.typ) && !kommentarbilagaFel(k.bilaga))
    .map((k) => ({ id: k.id, bilaga: k.bilaga, alt: altFor(k) }));
}
