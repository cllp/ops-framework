import { useContext, useId, useState } from "react";
import { attachmentSize, isImage } from "../lib/file.js";
import { KOMMENTARBILAGA_TYPER, MAX_HANDELSEKOMMENTAR, MAX_KOMMENTARBILAGA } from "../lib/handelsemodell.js";
import { formatDagOchKlockslag } from "../lib/format.js";
import { OppnaHandelseKontext } from "../lib/handelsekontext.js";
import { handelseIdUrAdress } from "../lib/handelsepanel.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsTextarea } from "./OpsField.jsx";
import { OpsFilePicker } from "./OpsFilePicker.jsx";
import { FilIkon } from "./icons.jsx";
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
 * `OpsFilePicker` under skrivrutan: Välj fil, inklistring (Cmd+V) var som helst på sidan, och en förhandsvisning före sändning,
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
 * @param {object} props
 * @param {ReadonlyArray<{ id: string, text: string, skapad: string, skapadAv?: { uid?: string | null, namn?: string } }>} props.kommentarer
 * @param {string} props.uid Den som tittar.
 * @param {(text: string, extra: { bilaga: import("../lib/file.js").Bilaga | null }) => Promise<unknown> | void} props.onSkriv
 * @param {boolean} [props.bilagor] (0.73.0) Visa filväljaren. Av som förval, se ovan.
 * @param {(id: string) => Promise<unknown> | void} [props.onTaBort]
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
}) {
  if (typeof onSkriv !== "function") throw new Error("OpsKommentarer: onSkriv krävs. En tråd utan skrivruta är en lista, och den heter inte kommentarer.");
  if (onTaBort !== undefined && typeof onTaBort !== "function") throw new Error("OpsKommentarer: onTaBort måste vara en funktion, eller utelämnas.");
  const personnamn = usePersonnamn();
  const rubrikId = useId();
  const [utkast, setUtkast] = useState("");
  const [bilaga, setBilaga] = useState(/** @type {import("../lib/file.js").Bilaga | null} */ (null));
  const [fokusInne, setFokusInne] = useState(false);
  const [skriver, setSkriver] = useState(false);
  const [skrivfel, setSkrivfel] = useState(/** @type {string | null} */ (null));
  const [tarBort, setTarBort] = useState(/** @type {string | null} */ (null));
  const [taBortFel, setTaBortFel] = useState(/** @type {string | null} */ (null));
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const rensad = utkast.trim();
  const kanSkicka = Boolean(rensad || bilaga);

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
      <span id={rubrikId} className="text-brod font-semibold text-ink">
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
            const avUid = k.skapadAv?.uid ?? null;
            const min = avUid !== null && avUid === uid;
            const { text: namn } = personnamn(k.skapadAv?.namn ?? "", avUid ?? "");
            return (
              <li key={k.id} data-kommentar={k.id} className="flex min-w-0 gap-3 rounded-base bg-raised p-3">
                <OpsIdentity name={namn} seed={avUid ?? k.id} size="avatar" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="truncate text-etikett font-medium text-ink">
                      {namn}
                      {min ? ` (${duText})` : ""}
                    </span>
                    <span className="text-meta text-ink-muted">{formatDagOchKlockslag(k.skapad, { locale })}</span>
                  </div>
                  {k.text ? <p className="m-0 whitespace-pre-wrap break-words text-brod text-ink">{k.text}</p> : null}
                  {k.bilaga?.dataUrl ? <Kommentarbilaga bilaga={k.bilaga} namn={namn} bilagaText={bilagaText} /> : null}
                </div>
                {min && onTaBort ? (
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
      <OpsField label={skrivEtikett} error={skrivfel ?? undefined}>
        <OpsTextarea value={utkast} onChange={setUtkast} rows={3} maxLength={MAX_HANDELSEKOMMENTAR} disabled={skriver} onSend={skicka} />
      </OpsField>
      {bilagor ? (
        <div data-kommentar-bilaga="">
          <OpsFilePicker
            value={bilaga}
            onChange={setBilaga}
            maxChars={MAX_KOMMENTARBILAGA}
            typer={KOMMENTARBILAGA_TYPER}
            accept={KOMMENTARBILAGA_TYPER.join(",")}
            paste={fokusInne}
            ariaLabel={bifogaEtikett}
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
  bifogaEtikett: { sv: "Bifoga bild eller fil", en: "Attach image or file" },
  bilagaText: { sv: "Bilaga från", en: "Attachment from" },
};

/**
 * En bilaga på en kommentar: bilden som en miniatyr som öppnas i full storlek, en fil som en nedladdningslänk med namn och storlek.
 *
 * ⛔ INGEN `<iframe>` FÖR EN PDF, av samma skäl som i `OpsFilePicker`: den ritas olika i varje webbläsare, och en tom ruta ser ut
 * som att filen inte kom fram.
 *
 * @param {{ bilaga: import("../lib/file.js").Bilaga, namn: string, bilagaText: string }} props
 */
function Kommentarbilaga({ bilaga, namn, bilagaText }) {
  const storlek = bilaga.tecken ? attachmentSize(bilaga.tecken) : "";
  if (isImage(bilaga.typ)) {
    return (
      <a href={bilaga.dataUrl} download={bilaga.namn || "bild"} data-kommentar-bilaga-visad="bild" className="block w-fit">
        <img src={bilaga.dataUrl} alt={`${bilagaText} ${namn}: ${bilaga.namn}`} className="block max-h-40 max-w-full rounded-md border border-line" />
      </a>
    );
  }
  return (
    <a
      href={bilaga.dataUrl}
      download={bilaga.namn || "bilaga"}
      data-kommentar-bilaga-visad="fil"
      className="flex w-fit max-w-full items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-meta text-ink no-underline hover:bg-accent-faint"
    >
      <FilIkon />
      <span className="min-w-0 truncate">{bilaga.namn}</span>
      {storlek ? <span className="shrink-0 text-ink-muted">{storlek}</span> : null}
    </a>
  );
}

/**
 * En rad i inkorgen för en händelse med nya kommentarer från någon annan (0.48.0). Raderna räknas fram med `kommentarsrader`,
 * och raden försvinner när händelsen öppnats och läsmärket flyttats.
 *
 * @param {object} props
 * @param {string} props.titel Händelsens rubrik.
 * @param {number} props.olasta
 * @param {string} props.namn Den som skrev den senaste.
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
  const { titel, olasta, namn, text, href, onOppna } = props;
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
      <span className="block w-full truncate text-meta text-ink-muted">{`${antal} · ${namn || ord.namnSaknas}: ${text}`}</span>
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
