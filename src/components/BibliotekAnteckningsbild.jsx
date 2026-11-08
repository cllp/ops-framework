import { useEffect, useRef, useState } from "react";
import { IKON_FOR } from "./ikonlexikon.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsTextarea } from "./OpsField.jsx";
import { bilagaTillBlob, readAttachment } from "../lib/file.js";
import { sakertBildnamn } from "../lib/markdown.js";
import { ordet } from "../lib/ord.js";

/*
 * Anteckningens textfält med "Lägg till bild" och inklistring av en bild (cllp/lifehub.app#696, skiva 1).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP vill kunna lägga en bild i en anteckning. Planen (kommentaren på #696, granskad av Fable): EN anteckningstyp, och bilden är en
 * del av anteckningens markdown (`![](namn)`), aldrig en egen post i Biblioteket. Filen ligger i postens egen mapp, och namnet är
 * det enda texten bär (`lib/markdown.js`).
 *
 * ⛔ APPEN LADDAR UPP, RAMVERKET SKRIVER IN. `onLaggBild({ postId, plats, fil })` lägger filen i postens mapp och svarar med namnet. Ramverket
 * känner varken lagringen eller sökvägen. Först när svaret kommit skrivs `![](namn)` vid markören, så att texten aldrig pekar på en fil som
 * inte finns. Ett namn som inte är ett säkert segment (`sakertBildnamn`) skrivs inte in: visningen hade ritat det som text, och raden
 * säger då vad som hände i stället (regel 5).
 *
 * ⛔ INKLISTRINGEN STANNAR HÄR. En bild som klistras in i textrutan tas av den här komponenten, med `preventDefault()` och
 * `stopPropagation()`: appens lyssnare på dokumentet (lifehub.app `BibliotekInklistring`) hade annars också gjort en egen bildpost av
 * samma inklistring, och det är just den post planen säger att bilden aldrig ska vara. React lyssnar på appens rot, och ett stopp där når
 * aldrig dokumentet. Text i urklippet går igenom som förut: en inklistring med text är text, samma regel som appens (`skaTaKlistra`).
 *
 * ⛔ BILDEN KRYMPS HÄR, INNAN APPEN FÅR DEN. Ramverket har redan krympningen (`readAttachment` i `lib/file.js`: längsta sidan 1600 px,
 * JPEG i kvalitetssteg), och en andra i appen hade varit två ställen som bestämmer hur stor en bild får vara (regel 2). En telefonbild på
 * 4 MB blir några hundra kB, och en HEIC som webbläsaren kan läsa blir en JPEG som alla kan visa. En HEIC som webbläsaren inte kan läsa
 * nekas med skälet, eftersom Storage-regeln inte tar den och ingen annan läsare kan visa den. En GIF lämnas som den är: krympningen hade
 * gjort en rörlig bild till en stillbild.
 *
 * ⛔ BARA PÅ EN POST SOM FINNS. En ny anteckning har inget id, alltså ingen mapp att lägga bilden i, och `onSpara` svarar inte med det id
 * posten fick. Att spara åt personen och sedan ladda upp hade gått genom en väg som inte säger var posten hamnade. Knappen syns därför först
 * när posten är sparad, och en bild som klistras in i en ny anteckning stannar här med raden "Spara anteckningen först" i stället för att bli
 * en egen post.
 *
 * ⛔ SPARA OCH AVBRYT VÄNTAR PÅ UPPLADDNINGEN. Bilden skrivs in först när svaret kommit, och Spara eller Avbryt under tiden stängde rutan:
 * svaret kastades och filen låg kvar i postens mapp utan att texten pekade på den, utan ett ord om det (regel 5). `onPagar` säger därför
 * till redigeringen när en uppladdning pågår och när den är klar, och `OpsDokument` spärrar båda knapparna så länge (`vantar`). Raden
 * "Laddar upp bilden." står under rutan under tiden och säger varför.
 */

/**
 * Orden, på båda språken.
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_ANTECKNINGSBILD = {
  text: { sv: "Text", en: "Text" },
  laggTill: { sv: "Lägg till bild", en: "Add image" },
  laddarUpp: { sv: "Laddar upp bilden.", en: "Uploading the image." },
  fel: { sv: "Bilden laddades inte upp: {skal}", en: "The image was not uploaded: {skal}" },
  ingetNamn: { sv: "Bilden laddades upp men fick inget namn som går att skriva in i texten.", en: "The image was uploaded but got no name that can be written into the text." },
  inteBild: { sv: "Filen är ingen bild.", en: "The file is not an image." },
  sparaForst: { sv: "Spara anteckningen först. Sedan går det att lägga till bilder.", en: "Save the note first. Then images can be added." },
};

/** Typerna en bild får ha när den lämnar krympningen: de bildtyper Bibliotekets lagringsregel tar emot. */
const BILDTYPER = /** @type {const} */ (["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** Tak för bilden efter krympningen, i data-URL-tecken (cirka 10 MB fil). Krympningen ger normalt några hundra kB; taket fångar en bild som inte gick att krympa. */
const MAX_BILDTECKEN = 14_000_000;

/**
 * Bilden som appen ska ladda upp: krympt till JPEG när webbläsaren kan läsa den, annars som den är om typen tas emot. En GIF lämnas orörd.
 * Kastar med ett skäl som går att agera på (`readAttachment`).
 *
 * @param {File} fil
 * @returns {Promise<File>}
 */
async function forbered(fil) {
  if (fil.type === "image/gif") return fil;
  const bilaga = await readAttachment(fil, { maxChars: MAX_BILDTECKEN, typer: BILDTYPER });
  const blob = bilagaTillBlob(bilaga);
  const bas = (fil.name || "bild").replace(/\.[^.]+$/, "") || "bild";
  const andelse = blob.type === "image/jpeg" ? "jpg" : (blob.type.split("/")[1] ?? "bin");
  return new File([blob], `${bas}.${andelse}`, { type: blob.type });
}

/** @param {{ type?: string, name?: string } | null | undefined} fil */
function arBild(fil) {
  if (!fil) return false;
  if (typeof fil.type === "string" && fil.type.startsWith("image/")) return true;
  // En HEIC från en iPhone kan sakna typ i vissa webbläsare. Appen krymper den i sin uppladdning.
  return !fil.type && /\.(heic|heif)$/i.test(fil.name ?? "");
}

/**
 * Texten med `![](namn)` insatt vid `pos`, på en egen rad, och var markören hamnar efter den.
 *
 * @param {string} text
 * @param {number} pos
 * @param {string} namn
 * @returns {{ text: string, markor: number }}
 */
export function medBildInsatt(text, pos, namn) {
  const vid = Math.max(0, Math.min(Number.isInteger(pos) ? pos : text.length, text.length));
  const fore = text.slice(0, vid);
  const efter = text.slice(vid);
  const bild = `![](${namn})`;
  const inskott = `${fore !== "" && !fore.endsWith("\n") ? "\n" : ""}${bild}${efter !== "" && !efter.startsWith("\n") ? "\n" : ""}`;
  return { text: fore + inskott + efter, markor: fore.length + inskott.length };
}

/**
 * @param {object} props
 * @param {string} props.text
 * @param {(text: string) => void} props.setText
 * @param {{ id: string, groupId?: string } | null} props.post Posten som redigeras. `null` för en ny anteckning.
 * @param {((inmatning: { postId: string, plats: string, fil: File }) => Promise<{ namn: string }>) | undefined} props.onLaggBild
 * @param {string} props.sprak
 * @param {(pagar: boolean) => void} [props.onPagar] Sant när en uppladdning börjar, falskt när den sista är klar (och när rutan tas bort). Redigeringen spärrar Spara och Avbryt med det.
 */
export function AnteckningsText({ text, setText, post, onLaggBild, sprak, onPagar }) {
  const o = (/** @type {keyof typeof ORD_ANTECKNINGSBILD} */ k) => ordet(ORD_ANTECKNINGSBILD, k, sprak);
  const ruta = useRef(/** @type {HTMLDivElement | null} */ (null));
  const filFalt = useRef(/** @type {HTMLInputElement | null} */ (null));
  const textRef = useRef(text);
  textRef.current = text;
  const [pagar, setPagar] = useState(0);
  const [fel, setFel] = useState("");
  const [notis, setNotis] = useState("");
  const markorEfter = useRef(/** @type {number | null} */ (null));
  const livs = useRef(true);
  useEffect(() => {
    livs.current = true;
    return () => {
      livs.current = false;
    };
  }, []);
  // ⛔ Redigeringen får veta när en uppladdning pågår, så att Spara och Avbryt väntar (se filens huvud). Falskt också när rutan tas bort, så att en spärr aldrig blir kvar.
  const laddar = pagar > 0;
  const onPagarRef = useRef(onPagar);
  onPagarRef.current = onPagar;
  useEffect(() => {
    onPagarRef.current?.(laddar);
  }, [laddar]);
  useEffect(() => () => onPagarRef.current?.(false), []);
  const kopplad = typeof onLaggBild === "function";
  const kan = kopplad && Boolean(post?.id);

  const textfalt = () => /** @type {HTMLTextAreaElement | null} */ (ruta.current?.querySelector("textarea") ?? null);

  // Markören efter den insatta bilden, när texten väl ritats om.
  useEffect(() => {
    const pos = markorEfter.current;
    if (pos === null) return;
    markorEfter.current = null;
    const falt = textfalt();
    if (falt && typeof falt.setSelectionRange === "function") falt.setSelectionRange(pos, pos);
  }, [text]);

  /** @param {File[]} filer */
  async function laddaUpp(filer) {
    if (!kan || !post) return;
    setFel("");
    setNotis("");
    for (const fil of filer) {
      if (!arBild(fil)) {
        setFel(o("inteBild"));
        continue;
      }
      const vidStart = textfalt()?.selectionStart ?? textRef.current.length;
      setPagar((n) => n + 1);
      try {
        const klar = await forbered(fil);
        if (!livs.current) return;
        const svar = await /** @type {NonNullable<typeof onLaggBild>} */ (onLaggBild)({ postId: post.id, plats: post.groupId ?? "", fil: klar });
        if (!livs.current) return;
        const namn = svar?.namn;
        if (!sakertBildnamn(namn)) {
          setFel(o("ingetNamn"));
          continue;
        }
        // ⛔ Markören läses NÄR SVARET KOMMIT: personen kan ha skrivit vidare under uppladdningen. Finns fältet inte längre gäller platsen vid start.
        const falt = textfalt();
        const pos = falt ? falt.selectionStart : vidStart;
        const ut = medBildInsatt(textRef.current, pos, /** @type {string} */ (namn));
        markorEfter.current = ut.markor;
        textRef.current = ut.text;
        setText(ut.text);
      } catch (e) {
        if (!livs.current) return;
        const skal = (e instanceof Error && e.message ? e.message : String(e)).replace(/[.\s]+$/, "");
        setFel(o("fel").replace("{skal}", `${skal}.`));
      } finally {
        if (livs.current) setPagar((n) => n - 1);
      }
    }
  }

  /** @param {import("react").ClipboardEvent} e */
  function klistra(e) {
    if (!kopplad) return;
    const data = e.clipboardData;
    const bilder = Array.from(data?.files ?? []).filter((f) => arBild(f));
    if (bilder.length === 0) return;
    let textIUrklipp = "";
    try {
      textIUrklipp = data?.getData("text/plain") ?? "";
    } catch {
      textIUrklipp = "";
    }
    if (textIUrklipp.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    if (!kan) {
      setFel("");
      setNotis(o("sparaForst"));
      return;
    }
    void laddaUpp(bilder);
  }

  return (
    <OpsField label={o("text")}>
      <div ref={ruta} className="flex min-w-0 flex-col gap-2" onPaste={klistra}>
        <OpsTextarea value={text} onChange={setText} ariaLabel={o("text")} rows={8} />
        {kan ? (
          <div className="flex flex-wrap items-center gap-2">
            <OpsButton variant="secondary" size="sm" busy={pagar > 0} onClick={() => filFalt.current?.click()}>
              <IKON_FOR.slappBild size={16} aria-hidden="true" />
              {o("laggTill")}
            </OpsButton>
            <input
              ref={filFalt}
              type="file"
              accept="image/*"
              multiple
              aria-label={o("laggTill")}
              className="hidden"
              onChange={(e) => {
                const valda = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (valda.length) void laddaUpp(valda);
              }}
            />
          </div>
        ) : null}
        {pagar > 0 ? <p role="status" data-anteckningsbild="laddar" className="m-0 text-meta text-ink-secondary">{o("laddarUpp")}</p> : null}
        {fel ? <p role="alert" data-anteckningsbild="fel" className="m-0 text-etikett text-danger wrap-anywhere">{fel}</p> : null}
        {notis ? <p role="status" data-anteckningsbild="spara-forst" className="m-0 text-meta text-ink-secondary">{notis}</p> : null}
      </div>
    </OpsField>
  );
}
