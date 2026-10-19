import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { DELNINGSORSAKER, delningsfel } from "../lib/delning.js";
import { sizeText } from "../lib/file.js";
import { formateraTid } from "../lib/ljudspelare.js";
import { DeladKod } from "./DeladKod.jsx";
import { PausaIkon, SpelaIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";

/**
 * Den publika vyn av en delad fil: det en mottagare ser på `/d/<token>`, utan inloggning (0.119.0, lifehub.app#356).
 *
 * ══ ⛔ VYN RITAR VAD SERVERN SVARAR OCH INGET MER ═══════════════════════════════════════════════════════════════════════
 *
 * `delning` är `hamta().delning` ur `createDelningService`: rubrik, typ, mime, storlek, längd, våg, om nedladdning är på och en
 * signerad adress. Vyn läser aldrig en grupp, ett namn eller en sökväg, för de finns inte i svaret. Och den har ingen egen
 * regel för vem som får se vad: en länk som inte går att visa är ett `orsak`, och texten kommer ur `delningsfel`.
 *
 * ⛔ ETT AV TRE LÄGEN, OCH ETT FEL KASTAS. `delning`, `orsak` eller `laddar`. Ingen av dem, eller flera, är ett fel i anropet: en
 * tom yta ser ut som en länk som är trasig, och två lägen samtidigt hade låtit det ena vinna tyst (regel 5).
 *
 * ══ ⛔ NEDLADDNING ÄR EN KNAPP SOM FINNS ELLER INTE ═══════════════════════════════════════════════════════════════════
 *
 * "Ladda ner" ritas bara när `delning.nedladdning` är sant, och ljudspelarens egen länk döljs då den är av (`utanNedladdning`).
 * Det är en beställning om vad vyn erbjuder, och inte ett skydd: adressen går att läsa ur sidan. Den signerade adressen är därför
 * också skapad med `Content-Disposition: inline` när nedladdning är av, så en direktlänk visas och sparas inte av sig själv.
 *
 * ══ ⛔ ADRESSEN GÅR UT, OCH VYN BER OM EN NY (`onNyUrl`) ═══════════════════════════════════════════════════════════════
 *
 * Den signerade adressen gäller i 15 minuter. Ger filen ett fel (ljudet, bilden, videon) anropas `onNyUrl` EN gång per adress, och
 * appen hämtar länken igen och ger vyn ett nytt `delning`. Ger också den nya adressen fel visas felet i stället för att vyn ber
 * igen och igen: en loop mot servern är värre än en bild som inte kom.
 *
 * ⛔ EN `<video>` UTAN `controls`. Webbläsarens egna kontroller ser olika ut överallt och kan inte bära temat (`check-webblasarkontroller`
 * fäller de ostylade kontrollerna). Spelknapp, tid och spolning är ramverkets: en knapp, en tid och `.ops-reglage`.
 *
 * ⛔ BARA RAMVERKETS TEMA. Inga egna färger eller mått här, bara klasser ur tokenkontraktet. Skalet runt (logga, grupp, språk) är
 * appens: vyn är innehållet.
 *
 * @param {object} props
 * @param {{ rubrik: string, typ: string, mime?: string, storlek?: number | null, langd?: number | null, peaks?: string | null, nedladdning?: boolean, url: string, visaUrl?: string | null } | null} [props.delning] Länken går att visa.
 * @param {string} [props.orsak] Länken går inte att visa: `utgangen`, `stangd` eller `saknas` (`DELNINGSORSAKER`). En okänd orsak får texten för `utgangen`.
 * @param {boolean} [props.laddar] Länken hämtas.
 * @param {() => void | Promise<void>} [props.onNyUrl] Filen kunde inte läsas, troligen för att adressen gått ut. Appen hämtar länken igen och ger ett nytt `delning`.
 * @param {(kod: string) => void | Promise<void>} [props.onKod] (0.125.0) Koden som personen skrev. Med den ritas kodrutan när orsaken är `kod-kravs`, `fel-kod` eller `for-manga` (en fillänk kan ha en kod
 *   sedan 0.125.0); appen frågar servern med koden (`hamta(ref, { kod })`) och ger vyn ett nytt svar. Utan den står orsaken som text.
 * @param {string} [props.sprak] (0.125.0) `sv` eller `en`, för kodrutan. Förval: språket i `OpsSprakProvider`. Resten av vyn är svensk som förut.
 */
export function OpsDelad({ delning = null, orsak, laddar = false, onNyUrl, onKod, sprak }) {
  const kontextSprak = useOpsSprak();
  const lagen = [Boolean(delning), orsak !== undefined, laddar].filter(Boolean).length;
  if (lagen !== 1) {
    throw new Error("OpsDelad: ge precis en av delning, orsak och laddar. Ingen av dem är en tom yta, flera är två sanningar om samma länk.");
  }
  if (onNyUrl !== undefined && typeof onNyUrl !== "function") {
    throw new Error("OpsDelad: onNyUrl ska vara en funktion.");
  }
  if (onKod !== undefined && typeof onKod !== "function") {
    throw new Error("OpsDelad: onKod ska vara en funktion.");
  }
  if (laddar) return <OpsEmpty busy title="Hämtar filen" busyLabel="Hämtar filen" />;
  if (orsak !== undefined) {
    const kand = /** @type {readonly string[]} */ (DELNINGSORSAKER).includes(orsak);
    if (onKod && (orsak === "kod-kravs" || orsak === "fel-kod" || orsak === "for-manga")) {
      return <DeladKod orsak={orsak} onKod={onKod} sprak={sprak ?? kontextSprak} />;
    }
    return (
      <div data-delad="fel" data-delad-orsak={kand ? orsak : "utgangen"}>
        <OpsEmpty title={delningsfel(orsak)} />
      </div>
    );
  }
  return <DelatInnehall delning={/** @type {NonNullable<typeof delning>} */ (delning)} onNyUrl={onNyUrl} />;
}

/** Texten när filen inte går att visa och en ny adress inte hjälpte. */
const FIL_FEL = "Filen gick inte att visa just nu.";

/** @type {Record<string, string>} */
const TYPNAMN = { ljud: "Ljud", bild: "Bild", video: "Video", pdf: "PDF", dokument: "Dokument" };

/**
 * @param {{ delning: NonNullable<Parameters<typeof OpsDelad>[0]["delning"]>, onNyUrl?: () => void | Promise<void> }} props
 */
function DelatInnehall({ delning, onNyUrl }) {
  const { rubrik, typ, storlek, langd, peaks, url } = delning;
  const kanLadda = delning.nedladdning === true;
  // ⛔ En adress som gått ut ger fel, och ber om en ny EN gång. Den nya adressen får sin egen chans, men inte en loop.
  const bedd = useRef(/** @type {string | null} */ (null));
  const [fel, setFel] = useState("");
  useEffect(() => setFel(""), [url]);
  const filFel = (/** @type {string} */ text) => {
    if (typeof onNyUrl === "function" && bedd.current !== url) {
      bedd.current = url;
      Promise.resolve(onNyUrl()).catch(() => setFel(text));
      return;
    }
    setFel(text);
  };

  const meta = [TYPNAMN[typ] ?? TYPNAMN.dokument, storlek ? sizeText(storlek) : "", typ === "ljud" && langd ? formateraTid(langd / 1000) : ""].filter(Boolean);
  // En inbäddad PDF kan inte komma från en adress med `attachment`: servern ger då en egen adress för att visa den.
  const visa = delning.visaUrl || url;

  return (
    <article data-delad={typ} className="flex min-w-0 w-full flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 data-delad-rubrik="" className="m-0 text-sida text-ink wrap-anywhere">{rubrik}</h1>
        <p data-delad-meta="" className="m-0 text-meta text-ink-muted">{meta.join(" · ")}</p>
      </header>

      {typ === "ljud" ? (
        <OpsLjudspelare src={url} namn={rubrik} visaNamn={false} durationMs={langd ?? undefined} peaks={peaks ?? undefined} utanNedladdning={!kanLadda} onFel={(f) => filFel(f || FIL_FEL)} />
      ) : typ === "bild" ? (
        <img src={url} alt={rubrik} onError={() => filFel(FIL_FEL)} className="block h-auto w-full rounded-lg" />
      ) : typ === "video" ? (
        <Video src={url} namn={rubrik} onFel={() => filFel(FIL_FEL)} />
      ) : typ === "pdf" ? (
        <div className="flex min-w-0 flex-col gap-2">
          <object data={visa} type="application/pdf" aria-label={rubrik} className="h-[70dvh] w-full rounded-lg border border-line">
            <p className="m-0 p-4 text-brod text-ink-secondary">Den här webbläsaren visar inte PDF-filer här. Öppna den i en ny flik.</p>
          </object>
          <a href={visa} target="_blank" rel="noopener noreferrer" data-delad-oppna="" className="text-brod text-accent underline underline-offset-2">Öppna PDF</a>
        </div>
      ) : (
        <p className="m-0 text-brod text-ink-secondary">Filen går inte att visa här.{kanLadda ? " Ladda ner den för att öppna den." : ""}</p>
      )}

      {fel ? <p role="alert" data-delad-fel="" className="m-0 text-etikett text-danger">{fel}</p> : null}

      {kanLadda ? (
        <div>
          <OpsButton variant="secondary" href={url} ariaLabel={`Ladda ner ${rubrik}`}>Ladda ner</OpsButton>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Video med ramverkets egna kontroller: spela och pausa, tid och spolning. Ingen `controls`-attribut.
 *
 * @param {{ src: string, namn: string, onFel: () => void }} props
 */
function Video({ src, namn, onFel }) {
  const video = useRef(/** @type {HTMLVideoElement | null} */ (null));
  const [spelar, setSpelar] = useState(false);
  const [tid, setTid] = useState(0);
  const [langd, setLangd] = useState(0);
  const spelaEllerPausa = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      // `play()` ger ett löfte som avvisas när webbläsaren nekar uppspelningen. Det är ett fel att visa, inte ett som får försvinna.
      Promise.resolve(v.play()).catch(() => onFel());
    } else {
      v.pause();
    }
  };
  const spola = (/** @type {number} */ till) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = till;
    setTid(till);
  };
  return (
    <div data-delad-video="" className="flex min-w-0 flex-col gap-2">
      <video
        ref={video}
        src={src}
        aria-label={namn}
        preload="metadata"
        playsInline
        onClick={spelaEllerPausa}
        onPlay={() => setSpelar(true)}
        onPause={() => setSpelar(false)}
        onEnded={() => setSpelar(false)}
        onTimeUpdate={(e) => setTid(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLangd(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onError={onFel}
        className="block h-auto w-full rounded-lg bg-sunken"
      />
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label={spelar ? `Pausa ${namn}` : `Spela ${namn}`}
          onClick={spelaEllerPausa}
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-subtle text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {spelar ? <PausaIkon size={16} /> : <SpelaIkon size={16} />}
        </button>
        <input
          type="range"
          aria-label="Spola"
          aria-valuetext={`${formateraTid(tid)} av ${formateraTid(langd)}`}
          className={cx("ops-reglage relative h-11 min-w-0 flex-1 cursor-pointer bg-transparent")}
          min={0}
          max={langd > 0 ? langd : 1}
          step={0.1}
          value={Math.min(tid, langd > 0 ? langd : 1)}
          disabled={langd <= 0}
          onChange={(e) => spola(Number(e.target.value))}
        />
        <span data-delad-tid="" className="shrink-0 text-meta text-ink-secondary tabular-nums">
          {formateraTid(tid)} / {formateraTid(langd)}
        </span>
      </div>
    </div>
  );
}
