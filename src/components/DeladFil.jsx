import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { sizeText } from "../lib/file.js";
import { formateraTid } from "../lib/ljudspelare.js";
import { PausaIkon, SpelaIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";

/**
 * En delad FIL som den ritas på den publika sidan: ljud, bild, video, PDF eller ett dokument som inte går att visa (0.119.0, lifehub.app#356).
 *
 * ⛔ FLYTTAD UR `OpsDelad` OCH OFÖRÄNDRAD (0.133.0). `OpsDelad` ritar nu också en anteckning, en länk och en lista, och en lista ritar sina filer med den här. Den låg
 * kvar i `OpsDelad.jsx` hade `OpsDelad` och listan importerat varandra. Allt om adressen som går ut (`onNyUrl`, en gång per adress), nedladdning som en knapp som finns eller
 * inte och videons egna kontroller står i `OpsDelad.jsx`s dokumentation och gäller här.
 *
 * `iLista`: filen ligger i en delad lista, och raden i listan har redan rubriken. Då ritas ingen egen rubrik.
 *
 * @typedef {{ rubrik: string, typ: string, mime?: string, storlek?: number | null, langd?: number | null, peaks?: string | null, nedladdning?: boolean, url: string, visaUrl?: string | null }} DeladFilSvar
 */

/** Texten när filen inte går att visa och en ny adress inte hjälpte. */
const FIL_FEL = "Filen gick inte att visa just nu.";

/** @type {Record<string, string>} */
export const TYPNAMN = { ljud: "Ljud", bild: "Bild", video: "Video", pdf: "PDF", dokument: "Dokument" };

/**
 * @param {{ delning: DeladFilSvar, onNyUrl?: () => void | Promise<void>, iLista?: boolean }} props
 */
export function DeladFil({ delning, onNyUrl, iLista = false }) {
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
      {iLista ? null : (
        <header className="flex min-w-0 flex-col gap-1">
          <h1 data-delad-rubrik="" className="m-0 text-sida text-ink wrap-anywhere">{rubrik}</h1>
          <p data-delad-meta="" className="m-0 text-meta text-ink-muted">{meta.join(" · ")}</p>
        </header>
      )}

      {typ === "ljud" ? (
        <OpsLjudspelare src={url} namn={rubrik} visaNamn={false} durationMs={langd ?? undefined} peaks={peaks ?? undefined} utanNedladdning={!kanLadda} onFel={(f) => {
          // ⛔ BARA ETT RIKTIGT FEL (0.133.0). Spelaren anropar onFel med en tom text när inget fel finns, också vid första ritningen, och `f || FIL_FEL` gjorde den till ett fel: varje delad
          // ljudfil bad om en ny adress direkt när sidan öppnades, innan något gått fel. Mätt: onNyUrl anropades en gång vid ritningen, utan att någon spelat.
          if (f) filFel(f);
        }} />
      ) : typ === "bild" ? (
        <img src={url} alt={rubrik} onError={() => filFel(FIL_FEL)} className="block h-auto w-full rounded-lg" />
      ) : typ === "video" ? (
        <Video src={url} namn={rubrik} onFel={() => filFel(FIL_FEL)} />
      ) : typ === "pdf" ? (
        <div className="flex min-w-0 flex-col gap-2">
          <object data={visa} type="application/pdf" aria-label={rubrik} className="h-[70dvh] w-full rounded-lg border border-line">
            <p className="m-0 p-4 text-etikett text-ink-secondary">Den här webbläsaren visar inte PDF-filer här. Öppna den i en ny flik.</p>
          </object>
          <a href={visa} target="_blank" rel="noopener noreferrer" data-delad-oppna="" className="text-etikett text-accent underline underline-offset-2">Öppna PDF</a>
        </div>
      ) : (
        <p className="m-0 text-etikett text-ink-secondary">Filen går inte att visa här.{kanLadda ? " Ladda ner den för att öppna den." : ""}</p>
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
