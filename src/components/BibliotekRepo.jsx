import { useEffect, useRef, useState } from "react";
import { ChevronRight, File, Folder } from "lucide-react";
import { GithubDokumentVisningLat } from "./GithubDokumentVisningLat.jsx";
import { OpsAtgardsblad } from "./OpsAtgardsblad.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { sizeText } from "../lib/file.js";
import { githubDokument } from "../lib/githubdokument.js";
import { ordet } from "../lib/ord.js";
import { ORD_BIBLIOTEK_REPO_LAT } from "./BibliotekRepoLat.jsx";

/**
 * Lägena för "I repot" (0.205.0, cllp/lifehub.app#653 skiva 3). Samma ord som läsaren av en fil (`GITHUB_LAGEN`) där de betyder samma sak: `last`, `saknas` (mappen finns inte), `obehorig` (GitHub-kopplingen når den inte) och `fel`. Ett annat läge, eller ett avvisat löfte, ritas som `fel`.
 */
export const REPO_LAGEN = Object.freeze(/** @type {const} */ (["last", "saknas", "obehorig", "fel"]));

/**
 * Orden i "I repot", på båda språken (0.205.0). Rubriken står i `ORD_BIBLIOTEK_REPO_LAT` (0.209.0): raden ritas innan den här modulen hämtas.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_BIBLIOTEK_REPO = {
  listaEtikett: { sv: "Filer och mappar i repot", en: "Files and folders in the repo" },
  tillbaka: { sv: "Tillbaka", en: "Back" },
  tom: { sv: "Mappen är tom.", en: "The folder is empty." },
  fler: { sv: "Visar de första {antal}. Fler finns i mappen i repot.", en: "Showing the first {antal}. There are more in the folder in the repo." },
  saknas: { sv: "Mappen finns inte i repot.", en: "The folder does not exist in the repo." },
  obehorig: { sv: "GitHub-kopplingen når inte mappen.", en: "The GitHub connection cannot reach the folder." },
  fel: { sv: "Det gick inte att läsa mappen just nu.", en: "The folder could not be read right now." },
  lagg: { sv: "Lägg i Biblioteket", en: "Add to the Library" },
  lagd: { sv: "Lagd i Biblioteket.", en: "Added to the Library." },
  laggFel: { sv: "Filen gick inte att lägga i Biblioteket.", en: "The file could not be added to the Library." },
  // Samma ord som läslägets länk (`ORD_GITHUBDOKUMENT.oppna`). Det står här och inte som en import, eftersom läsläget är en egen lat bit som "I repot" inte ska dra in.
  oppnaGithub: { sv: "Öppna i GitHub", en: "Open in GitHub" },
};

/**
 * Så många nivåer indragningen växer (0.209.0). Djupare mappar ritas med samma indrag som nivå tre: på en telefon hade fem nivåer om en tumme var lämnat namnen en handfull tecken.
 */
export const REPO_INDRAG_MAX = 3;
/** Indraget per nivå, som hela klasser så att stilen hittar dem. Index är nivån, högst `REPO_INDRAG_MAX`. */
const INDRAG = ["pl-0", "pl-5", "pl-10", "pl-15"];

/**
 * @typedef {object} RepoPost En rad i "I repot": en fil eller en undermapp i projektets mapp.
 * @property {string} namn Filens eller mappens namn.
 * @property {string} sokvag Sökvägen RELATIV TILL PROJEKTETS MAPP (`""` är mappen själv). Ramverket känner aldrig projektets mapp i repot, bara vägen inom den.
 * @property {"fil" | "mapp"} sort
 * @property {number} [storlek] En fils storlek i byte.
 * @property {string} [url] En fils adress på github.com (`https://github.com/<ägare>/<repo>/blob/<ref>/<sökväg>`). Med den öppnas filen i läsläget.
 */

/**
 * @typedef {object} RepoLasning Svaret från `repoLasare`.
 * @property {"last" | "saknas" | "obehorig" | "fel"} lage Se `REPO_LAGEN`.
 * @property {RepoPost[]} [poster]
 * @property {boolean} [fler] Fler poster finns i mappen än som kom med (appens tak).
 */

/** En vanlig sökväg inom projektets mapp: inget tomt led, ingen `.` eller `..`, inget inledande snedstreck. @param {unknown} s */
const arRelativSokvag = (s) => typeof s === "string" && s !== "" && !s.startsWith("/") && s.split("/").every((d) => d !== "" && d !== "." && d !== "..");

/** Ett svar från appen som vyn kan rita: poster med rätt form, de andra bort. @param {unknown} s @returns {RepoLasning} */
function tolka(s) {
  const r = /** @type {any} */ (s);
  if (!r || typeof r !== "object" || !REPO_LAGEN.includes(r.lage)) return { lage: "fel" };
  if (r.lage !== "last") return { lage: r.lage };
  const poster = (Array.isArray(r.poster) ? r.poster : []).filter(
    (/** @type {any} */ p) => p && typeof p.namn === "string" && p.namn !== "" && arRelativSokvag(p.sokvag) && (p.sort === "fil" || p.sort === "mapp"),
  );
  return { lage: "last", poster, fler: r.fler === true };
}

/** En fil som går att öppna på github.com: bara en adress där. @param {RepoPost} p */
const githubAdress = (p) => (typeof p.url === "string" && p.url.startsWith("https://github.com/") ? p.url : "");

/**
 * @typedef {object} Trad Det trädets alla nivåer delar: läsaren, läget för "Lägg i Biblioteket" och vad en fil gör vid ett tryck.
 * @property {string} plats
 * @property {(fraga: { plats: string, sokvag: string }) => Promise<unknown>} las
 * @property {boolean} kanLasa Läsläget finns (`githubLasare`).
 * @property {(p: RepoPost) => void} oppna
 * @property {(p: RepoPost) => import("./OpsAtgardsblad.jsx").Atgard[]} meny
 * @property {(p: RepoPost) => import("react").ReactNode} lage
 * @property {(k: string, vard?: Record<string, string>) => string} o
 * @property {string} sprak
 */

/**
 * "I repot" på ett projekts plats i Biblioteket (0.205.0, cllp/lifehub.app#653 skiva 3, CP 2026-11-08: "Lite som working copy ... integrera det i bibliotek").
 *
 * ⛔ ETT TRÄD, EN NIVÅ I TAGET, LIVE (0.209.0, cllp/lifehub.app#706, CP: "Skall man ha en trädvy"). En mapp fälls ut på plats med en pil, i stället för att man kliver in i den med en brödsmula och kliver
 *   ut med Tillbaka: man ser var man är utan att läsa en rad sökvägar, och flera mappar kan stå utfällda samtidigt. Varje mapp läses först när den fälls ut, med appens `repoLasare({ plats, sokvag })`,
 *   en nivå, och ingenting sparas: en mapp som fälls ihop och ut igen frågar igen. Hela trädet läses aldrig, eftersom det frestar till en lokal kopia (planen i #653).
 *   Indraget växer för varje nivå och stannar vid `REPO_INDRAG_MAX`. Laddning, saknas, obehörig och fel står vid varje mapp, med samma ord som förut.
 * ⛔ ALDRIG OVANFÖR PROJEKTETS MAPP. Vyn känner bara vägen INOM projektets mapp (`""` är mappen själv), en mapp läses bara med den väg dess rad gav, och en väg som inte är en vanlig relativ väg
 *   (`..`, ett inledande snedstreck) ritas inte. Appen prövar samma sak på servern; det här är inte skyddet, bara att vyn aldrig ber om något annat.
 * ⛔ EN FIL ÖPPNAS I DET BEFINTLIGA LÄSLÄGET (`GithubDokumentVisningLat`, 0.186.0) via en adress av typen `github.com/<ägare>/<repo>/blob/<ref>/<sökväg>`, med appens `githubLasare` som den är. Posten läsläget får är en länk som inte
 *   finns i Biblioteket (inget `id`), med platsen som `groupId`: appen ser på det att filen ska läsas genom projektets mapp och inte genom en post. Trädet står kvar under tiden (dolt), så Tillbaka
 *   kommer till samma utfällda mappar.
 * ⛔ ⋮ PÅ VARJE FIL (0.209.0, #706), med samma meny som bibliotekets rader (`OpsAtgardsblad`): "Lägg i Biblioteket" och "Öppna i GitHub". Förut stod en knapp "Lägg i Biblioteket" på varje rad.
 *   "Lägg i Biblioteket" skapar den vanliga länkposten genom appens `onLagg` (lifehub.app kopplar den mot `planForGithubLank`), ingen ny posttyp och inga nya fält, och svaret står vid filen.
 *   "Öppna i GitHub" öppnar filens adress i en ny flik (`noopener`), bara när filen har en adress på github.com.
 * ⛔ TOMHET OCH FEL SÄGS (regel 5): väntan syns, en tom mapp har en rad, ett tak har en rad, och varje läge har sin mening.
 *
 * @param {object} props
 * @param {string} props.plats Projektets plats (`plats~<grupp>~<tagg>`).
 * @param {(fraga: { plats: string, sokvag: string }) => Promise<RepoLasning>} props.lasare
 * @param {((post: any) => Promise<import("./GithubDokumentVisning.jsx").GithubLasning>) | undefined} [props.githubLasare] Utan den öppnas en fil på github.com i en ny flik.
 * @param {((fil: { plats: string, sokvag: string, url: string, namn: string }) => Promise<unknown>) | undefined} [props.onLagg] Utan den finns ingen "Lägg i Biblioteket".
 */
export function BibliotekRepo({ plats, lasare, githubLasare, onLagg }) {
  const sprak = useOpsSprak();
  /** @param {string} k @param {Record<string, string>} [vard] */
  const o = (k, vard = {}) => Object.entries(vard).reduce((t, [n, v]) => t.replace(`{${n}}`, v), ordet(ORD_BIBLIOTEK_REPO, k, sprak));
  const [oppen, setOppen] = useState(/** @type {RepoPost | null} */ (null));
  /** Läget för "Lägg i Biblioteket", per fil (sökvägen). */
  const [lagda, setLagda] = useState(/** @type {Record<string, { lage: "klar" } | { lage: "fel", text: string }>} */ ({}));
  const lasareRef = useRef(lasare);
  lasareRef.current = lasare;

  /** En fil som går att lägga i Biblioteket: den har en adress som läsläget känner (samma villkor som knappen före 0.209.0). @param {RepoPost} p */
  const kanLaggas = (p) => typeof onLagg === "function" && typeof p.url === "string" && githubDokument(p.url) !== null;

  /** @param {RepoPost} fil */
  const lagg = async (fil) => {
    if (typeof onLagg !== "function" || !fil.url) return;
    try {
      await onLagg({ plats, sokvag: fil.sokvag, url: fil.url, namn: fil.namn });
      setLagda((l) => ({ ...l, [fil.sokvag]: { lage: "klar" } }));
    } catch (fel) {
      const text = fel instanceof Error && fel.message ? fel.message : o("laggFel");
      setLagda((l) => ({ ...l, [fil.sokvag]: { lage: "fel", text } }));
    }
  };

  /** @param {RepoPost} p @returns {import("./OpsAtgardsblad.jsx").Atgard[]} */
  const meny = (p) => {
    /** @type {import("./OpsAtgardsblad.jsx").Atgard[]} */
    const ut = [];
    if (kanLaggas(p) && lagda[p.sokvag]?.lage !== "klar") ut.push({ id: "lagg", etikett: o("lagg"), onValj: () => void lagg(p) });
    const adress = githubAdress(p);
    if (adress) ut.push({ id: "github", etikett: o("oppnaGithub"), onValj: () => window.open(adress, "_blank", "noopener,noreferrer") });
    return ut;
  };

  /** Svaret på "Lägg i Biblioteket" vid filen. @param {RepoPost} p */
  const lage = (p) => {
    const l = lagda[p.sokvag];
    if (l?.lage === "klar") return <span role="status" data-bibliotek-repo-lagd="" className="text-meta text-ink-muted">{o("lagd")}</span>;
    if (l?.lage === "fel") return <span role="alert" data-bibliotek-repo-laggfel="" className="text-meta text-danger wrap-anywhere">{l.text}</span>;
    return null;
  };

  /** @type {Trad} */
  const trad = {
    plats,
    las: (f) => lasareRef.current(f),
    kanLasa: typeof githubLasare === "function",
    oppna: setOppen,
    meny,
    lage,
    o,
    sprak,
  };

  // Posten läsläget får: en länk utan `id`, med platsen som `groupId` (se ovan).
  const lankpost = oppen && oppen.url ? { typ: "lank", url: oppen.url, rubrik: oppen.namn, groupId: plats } : null;

  return (
    <div data-bibliotek-repo-innehall="" className="flex min-w-0 flex-col gap-2">
      {oppen && lankpost ? (
        <div data-bibliotek-repo-fil={oppen.sokvag} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <OpsButton variant="secondary" size="sm" onClick={() => setOppen(null)}>{o("tillbaka")}</OpsButton>
            <span className="min-w-0 flex-1" aria-hidden="true" />
            <OpsAtgardsblad baraKnapp namn={oppen.namn} poster={meny(oppen)} />
          </div>
          {lage(oppen)}
          <h3 className="m-0 text-etikett font-medium text-ink wrap-anywhere">{oppen.namn}</h3>
          <GithubDokumentVisningLat key={oppen.url} post={lankpost} lasare={/** @type {NonNullable<typeof githubLasare>} */ (githubLasare)} />
        </div>
      ) : null}
      {/* Trädet står kvar medan en fil är öppen, dolt, så att Tillbaka kommer till samma utfällda mappar. */}
      <div hidden={Boolean(oppen && oppen.url)} className="min-w-0">
        <Mapp sokvag="" niva={0} trad={trad} />
      </div>
    </div>
  );
}

/**
 * En mapps innehåll: läses när den ritas, alltså när mappen fälls ut, och ritar sina rader. Projektets mapp (`""`) är nivå 0.
 *
 * @param {{ sokvag: string, niva: number, trad: Trad }} props
 */
function Mapp({ sokvag, niva, trad }) {
  const { o } = trad;
  const [svar, setSvar] = useState(/** @type {RepoLasning | null} */ (null));
  const lasRef = useRef(trad.las);
  lasRef.current = trad.las;
  useEffect(() => {
    let kvar = true;
    setSvar(null);
    Promise.resolve()
      .then(() => lasRef.current({ plats: trad.plats, sokvag }))
      .then((s) => {
        if (kvar) setSvar(tolka(s));
      })
      .catch(() => {
        if (kvar) setSvar({ lage: "fel" });
      });
    return () => {
      kvar = false;
    };
  }, [trad.plats, sokvag]);

  const indrag = INDRAG[Math.min(niva, REPO_INDRAG_MAX)];
  if (!svar) {
    return (
      <div role="status" aria-busy="true" data-bibliotek-repo-lage="hamtar" data-bibliotek-repo-mapp={sokvag} className={cx("inline-flex items-center gap-2 text-etikett text-ink-muted", indrag)}>
        <OpsSpinner size="sm" decorative />
        {ordet(ORD_BIBLIOTEK_REPO_LAT, "hamtar", trad.sprak)}
      </div>
    );
  }
  if (svar.lage !== "last") {
    return (
      <p role={svar.lage === "fel" ? "alert" : "status"} data-bibliotek-repo-lage={svar.lage} data-bibliotek-repo-mapp={sokvag} className={cx("m-0 text-etikett", svar.lage === "fel" ? "text-danger" : "text-ink-secondary", indrag)}>
        {o(svar.lage)}
      </p>
    );
  }
  const poster = svar.poster ?? [];
  if (poster.length === 0) {
    return <p role="status" data-bibliotek-repo-lage="tom" data-bibliotek-repo-mapp={sokvag} className={cx("m-0 text-etikett text-ink-secondary", indrag)}>{o("tom")}</p>;
  }
  return (
    <>
      <ul aria-label={niva === 0 ? o("listaEtikett") : undefined} data-bibliotek-repo-lista={sokvag} className="m-0 flex list-none flex-col gap-1 p-0">
        {poster.map((p) => (p.sort === "mapp" ? <MappRad key={p.sokvag} post={p} niva={niva} trad={trad} /> : <FilRad key={p.sokvag} post={p} niva={niva} trad={trad} />))}
      </ul>
      {svar.fler ? <p role="status" data-bibliotek-repo-fler="" className={cx("m-0 text-meta text-ink-muted", indrag)}>{o("fler", { antal: String(poster.length) })}</p> : null}
    </>
  );
}

const RAD_KLASS = "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-etikett text-ink hover:bg-surface-hover md:min-h-8";

/**
 * En undermapp: en pil som fäller ut den på plats. Innehållet läses först när den fälls ut, och nästa nivå dras in ett steg till (högst `REPO_INDRAG_MAX`).
 * @param {{ post: RepoPost, niva: number, trad: Trad }} props
 */
function MappRad({ post, niva, trad }) {
  const [utfalld, setUtfalld] = useState(false);
  return (
    <li data-bibliotek-repo-rad="mapp" data-bibliotek-repo-niva={niva} className="flex min-w-0 flex-col gap-1">
      <div className={cx("flex min-w-0", INDRAG[Math.min(niva, REPO_INDRAG_MAX)])}>
        <button type="button" aria-expanded={utfalld} onClick={() => setUtfalld((u) => !u)} className={RAD_KLASS}>
          <ChevronRight size={16} aria-hidden="true" className={cx("shrink-0 text-ink-muted transition-transform duration-(--duration-fast)", utfalld && "rotate-90")} />
          <Folder size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
          <span className="min-w-0 flex-1 wrap-anywhere">{post.namn}</span>
        </button>
      </div>
      {utfalld ? <Mapp sokvag={post.sokvag} niva={niva + 1} trad={trad} /> : null}
    </li>
  );
}

/**
 * En fil: ett tryck öppnar läsläget (eller github.com i en ny flik utan det), och ⋮ har "Lägg i Biblioteket" och "Öppna i GitHub".
 * ⛔ Raden har ingen pil, men samma luft till vänster som en mapps pil, så att namnen står i linje med mapparnas.
 * @param {{ post: RepoPost, niva: number, trad: Trad }} props
 */
function FilRad({ post, niva, trad }) {
  const kanLasa = typeof post.url === "string" && githubDokument(post.url) !== null;
  const storlek = typeof post.storlek === "number" ? sizeText(post.storlek) : "";
  const etikett = (
    <>
      <span aria-hidden="true" className="inline-block w-4 shrink-0" />
      <File size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1 wrap-anywhere">{post.namn}</span>
      {storlek ? <span className="shrink-0 text-meta text-ink-muted">{storlek}</span> : null}
    </>
  );
  const adress = githubAdress(post);
  const meny = trad.meny(post);
  return (
    <li data-bibliotek-repo-rad="fil" data-bibliotek-repo-niva={niva} className={cx("flex min-w-0 flex-col gap-1", INDRAG[Math.min(niva, REPO_INDRAG_MAX)])}>
      <div className="flex min-w-0 items-center gap-1">
        {kanLasa && trad.kanLasa ? (
          <button type="button" onClick={() => trad.oppna(post)} className={RAD_KLASS}>{etikett}</button>
        ) : adress ? (
          <a href={adress} target="_blank" rel="noopener noreferrer" className={RAD_KLASS}>{etikett}</a>
        ) : (
          <span className={RAD_KLASS}>{etikett}</span>
        )}
        {meny.length > 0 ? <OpsAtgardsblad baraKnapp namn={post.namn} poster={meny} /> : null}
      </div>
      {trad.lage(post)}
    </li>
  );
}
