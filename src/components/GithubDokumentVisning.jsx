import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { BilagaVisning } from "./BilagaVisning.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsHtmlDokument } from "./OpsHtmlDokument.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { GithubDokumentVantar } from "./GithubDokumentVisningLat.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { TextForhandsvisning } from "./TextForhandsvisning.jsx";
import { avkodaTextfil } from "../lib/bibliotek.js";
import { formatDateTime } from "../lib/format.js";
import { GITHUB_LAGEN, githubDokument, githubMarkdown } from "../lib/githubdokument.js";
import { kommentarbilagaFel } from "../lib/handelsemodell.js";
import { ordet } from "../lib/ord.js";
import { sparaSomFil } from "../lib/sparaFil.js";

/**
 * Orden i läsläget för en fil i GitHub, på båda språken (0.186.0, cllp/lifehub.app#653).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_GITHUBDOKUMENT = {
  oppna: { sv: "Öppna i GitHub", en: "Open in GitHub" },
  andrad: { sv: "Ändrad {datum} av {av}", en: "Changed {datum} by {av}" },
  andradUtanAv: { sv: "Ändrad {datum}", en: "Changed {datum}" },
  laddaNed: { sv: "Ladda ned", en: "Download" },
  kanInteVisas: { sv: "Kan inte visas i appen.", en: "Cannot be shown in the app." },
  saknas: { sv: "Filen finns inte längre i repot.", en: "The file no longer exists in the repo." },
  obehorig: { sv: "GitHub-kopplingen når inte filen.", en: "The GitHub connection cannot reach the file." },
  "inte-gruppens": { sv: "Filen ligger inte i gruppens kopplade repo.", en: "The file is not in the group's connected repo." },
  // ⛔ VILKET REPO GRUPPEN HAR OCH VILKET FILEN LIGGER I (0.205.0, CP 2026-11-08): utan de två namnen gick det inte att se varför en länk inte lästes. Filens repo tas ur adressen, gruppens ur läsarens `kopplat`.
  inteGruppensKopplat: { sv: "Filen ligger i {fil}, men gruppen är kopplad till {kopplat}.", en: "The file is in {fil}, but the group is connected to {kopplat}." },
  inteGruppensUtanKoppling: { sv: "Filen ligger i {fil}, och gruppen har inget repo kopplat.", en: "The file is in {fil}, and the group has no repo connected." },
  "mitt-bibliotek": { sv: "En länk i Mitt bibliotek kan inte läsas ur GitHub. Lägg posten i gruppens bibliotek, på projektets plats, så öppnas filen här.", en: "A link in My library cannot be read from GitHub. Put the post in the group's library, on the project's place, and the file opens here." },
  "for-stor": { sv: "Filen är för stor för att visas.", en: "The file is too large to show." },
  fel: { sv: "Det gick inte att läsa filen just nu.", en: "The file could not be read right now." },
};

/**
 * @typedef {object} GithubLasning
 * @property {"last" | "saknas" | "obehorig" | "inte-gruppens" | "mitt-bibliotek" | "for-stor" | "fel"} lage Se `GITHUB_LAGEN`.
 * @property {string | null} [kopplat] (0.205.0) Bara med `inte-gruppens`: repot gruppen är kopplad till, `ägare/namn`, eller `null` när gruppen inte har något. Raden säger då vilket repo filen ligger i (ur adressen) och vilket gruppen har. Utan fältet står den gamla raden.
 * @property {string} [text] Filens text (markdown, html, text, csv).
 * @property {string} [base64] Filens byte, base64 utan prefix. Krävs för pdf, bild, nedladdning, och duger som text för de textsorter som saknar `text`.
 * @property {string} [mime] Bara för en bild: `image/png`, `image/jpeg`, `image/gif` eller `image/webp`. Annars härleds typen ur adressens ändelse.
 * @property {string} [andrad] ISO-tid för senaste ändringen.
 * @property {string} [av] Vem som ändrade den senast.
 * @property {number} [storlek] Filens storlek i byte.
 */

const BILDMIME = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const BILDMIME_UR_ANDELSE = /** @type {Record<string, string>} */ ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" });
const BASE64FORM = /^[A-Za-z0-9+/]*={0,2}$/;

/** @param {string} b64 @returns {Uint8Array | null} */
function bytesUrBase64(b64) {
  if (!BASE64FORM.test(b64)) return null;
  try {
    const bin = atob(b64);
    const ut = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) ut[i] = bin.charCodeAt(i);
    return ut;
  } catch {
    return null;
  }
}

/** Filens byte: texten (UTF-8) om den finns, annars base64. @param {GithubLasning} l @returns {Uint8Array | null} */
function bytesAv(l) {
  if (typeof l.text === "string") return new TextEncoder().encode(l.text);
  if (typeof l.base64 === "string" && l.base64 !== "") return bytesUrBase64(l.base64);
  return null;
}

/**
 * Läsläget för en post som pekar på en fil i gruppens GitHub-repo (0.186.0, cllp/lifehub.app#653). Appens `githubLasare` hämtar filen (med gruppens koppling, på servern); här ritas den efter sin sort.
 *
 * ⛔ SORTEN HÄRLEDS UR ADRESSEN (`githubDokument`), ALDRIG UR SVARET. Läsaren ger innehållet och läget, adressen säger vad det är: en andra uppgift om sorten i svaret hade kunnat säga emot den första (regel 2).
 * ⛔ ETT AVVISAT LÖFTE ÄR LÄGET `fel`, ritat och inte tyst. Ett läge utanför `GITHUB_LAGEN`, eller ett svar som inte går att rita (en bild vars base64 är trasig), är också `fel`.
 * ⛔ HTML OCH PDF GÅR GENOM DE VISNINGAR SOM REDAN FINNS: den avspärrade rutan (`OpsHtmlDokument`) och bilageviset (`BilagaVisning`, den enda platsen som gör en blob-adress, med typkontrollen före). Inget nytt `<iframe>` och ingen ny blob-adress.
 * ⛔ CSV RITAS SOM TEXT, inte som tabell: en tabell kräver en riktig CSV-läsare (citattecken, kommatecken och radbrytningar i fält), och en halv läsare visar fel kolumner utan att säga det.
 *
 * Känd begränsning: relativa bilder och länkar i en markdown-fil visas inte (`githubMarkdown`). En PDF större än bilageviset tar (`MAX_KOMMENTARBILAGA`, cirka 500 kB) kan inte visas i appen och får Ladda ned.
 *
 * @param {object} props
 * @param {{ url?: string, rubrik?: string }} props.post
 * @param {(post: any) => Promise<GithubLasning>} props.lasare
 */
export function GithubDokumentVisning({ post, lasare }) {
  const sprak = useOpsSprak();
  /** @param {string} k @param {Record<string, string>} [vard] */
  const o = (k, vard = {}) => Object.entries(vard).reduce((t, [n, v]) => t.replace(`{${n}}`, v), ordet(ORD_GITHUBDOKUMENT, k, sprak));
  const info = githubDokument(post.url);
  const [svar, setSvar] = useState(/** @type {GithubLasning | null} */ (null));
  const lasareRef = useRef(lasare);
  lasareRef.current = lasare;
  const postRef = useRef(post);
  postRef.current = post;
  useEffect(() => {
    let kvar = true;
    setSvar(null);
    Promise.resolve()
      .then(() => lasareRef.current(postRef.current))
      .then((s) => {
        if (!kvar) return;
        setSvar(s && typeof s === "object" && GITHUB_LAGEN.includes(s.lage) ? s : { lage: "fel" });
      })
      .catch(() => {
        if (kvar) setSvar({ lage: "fel" });
      });
    return () => {
      kvar = false;
    };
  }, [post.url]);
  if (!info) return null;
  const url = /** @type {string} */ (post.url);
  /** Raden för ett läge som inte är `last`. `inte-gruppens` med `kopplat` säger båda repona. @param {GithubLasning} l */
  const lageRad = (l) => {
    if (l.lage !== "inte-gruppens" || l.kopplat === undefined) return o(l.lage);
    const fil = `${info.agare}/${info.repo}`;
    return typeof l.kopplat === "string" && l.kopplat ? o("inteGruppensKopplat", { fil, kopplat: l.kopplat }) : o("inteGruppensUtanKoppling", { fil });
  };
  const oppna = (
    <a href={url} target="_blank" rel="noopener noreferrer" data-github-oppna="" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-etikett text-accent underline underline-offset-2 md:min-h-8">
      {o("oppna")}
      <ExternalLink size={14} aria-hidden="true" className="shrink-0" />
    </a>
  );
  if (!svar) {
    return (
      <div data-github-dokument="hamtar" role="status" aria-busy="true" className="flex min-w-0 flex-col gap-2">
        <GithubDokumentVantar />
        {oppna}
      </div>
    );
  }
  const bytes = bytesAv(svar);
  const laddaNed = bytes ? (
    // Knappen tar inga data-attribut (den är ett stängt API): märket sitter på ett omslag.
    <span data-github-ladda-ned="" className="inline-flex">
      <OpsButton variant="secondary" size="sm" onClick={() => sparaSomFil({ hamta: () => Promise.resolve(new Blob([/** @type {BlobPart} */ (bytes)])), sokvag: url, namn: info.namn, adress: url })}>
        {o("laddaNed")}
      </OpsButton>
    </span>
  ) : null;
  if (svar.lage !== "last") {
    return (
      <div data-github-dokument={svar.lage} className="flex min-w-0 flex-col gap-2">
        <p role={svar.lage === "fel" ? "alert" : "status"} data-github-lage={svar.lage} className={svar.lage === "fel" ? "m-0 text-etikett text-danger" : "m-0 text-etikett text-ink-secondary"}>
          {lageRad(svar)}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {svar.lage === "for-stor" ? laddaNed : null}
          {oppna}
        </div>
      </div>
    );
  }
  const datum = svar.andrad && !Number.isNaN(new Date(svar.andrad).getTime()) ? formatDateTime(svar.andrad) : "";
  const rad = datum ? (svar.av ? o("andrad", { datum, av: svar.av }) : o("andradUtanAv", { datum })) : "";
  const text = typeof svar.text === "string" ? svar.text : bytes ? avkodaTextfil(bytes) : null;
  /** @type {import("react").ReactNode} */
  let innehall;
  let ritat = true;
  switch (info.sort) {
    case "markdown":
      if (text === null) ritat = false;
      else innehall = <OpsMarkdown text={githubMarkdown(text)} dokument />;
      break;
    case "html":
      if (text === null) ritat = false;
      else innehall = <OpsHtmlDokument html={text} namn={info.namn} />;
      break;
    case "text":
    case "csv":
      if (!bytes) ritat = false;
      else innehall = <TextForhandsvisning hamta={() => Promise.resolve(new Blob([/** @type {BlobPart} */ (bytes)]))} sokvag={url} namn={info.namn} />;
      break;
    case "bild": {
      const mime = svar.mime && BILDMIME.includes(svar.mime) ? svar.mime : BILDMIME_UR_ANDELSE[info.andelse];
      if (!svar.base64 || !bytes || !mime) ritat = false;
      else innehall = <img data-github-bild="" src={`data:${mime};base64,${svar.base64}`} alt={info.namn} className="block h-auto max-w-full rounded-md border border-line" />;
      break;
    }
    case "pdf": {
      const dataUrl = `data:application/pdf;base64,${svar.base64 ?? ""}`;
      const bilaga = { dataUrl, namn: info.namn, typ: "application/pdf", tecken: dataUrl.length };
      if (!svar.base64 || !bytes) ritat = false;
      // Större än bilageviset tar: samma besked som för en fil appen inte kan visa, med Ladda ned.
      else if (kommentarbilagaFel(bilaga) !== null) innehall = <KanInteVisas text={o("kanInteVisas")} knapp={laddaNed} />;
      else innehall = <BilagaVisning bilaga={bilaga} alt={info.namn} marke="data-github-pdf" sprak={sprak} />;
      break;
    }
    default:
      innehall = <KanInteVisas text={o("kanInteVisas")} knapp={laddaNed} />;
  }
  if (!ritat) {
    return (
      <div data-github-dokument="fel" className="flex min-w-0 flex-col gap-2">
        <p role="alert" data-github-lage="fel" className="m-0 text-etikett text-danger">{o("fel")}</p>
        {oppna}
      </div>
    );
  }
  return (
    <div data-github-dokument={info.sort} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {rad ? <span data-github-andrad="" className="text-meta text-ink-muted">{rad}</span> : null}
        {oppna}
      </div>
      {innehall}
    </div>
  );
}

/** @param {{ text: string, knapp: import("react").ReactNode }} props */
function KanInteVisas({ text, knapp }) {
  return (
    <div data-github-kan-inte-visas="" className="flex flex-wrap items-center gap-3">
      <span className="text-etikett text-ink-secondary">{text}</span>
      {knapp}
    </div>
  );
}
