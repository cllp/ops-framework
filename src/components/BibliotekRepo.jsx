import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, File, Folder } from "lucide-react";
import { GithubDokumentVisningLat } from "./GithubDokumentVisningLat.jsx";
import { IKON_FOR } from "./ikonlexikon.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { sizeText } from "../lib/file.js";
import { githubDokument } from "../lib/githubdokument.js";
import { ordet } from "../lib/ord.js";
import { ORD_BIBLIOTEK_REPO_LAT } from "./BibliotekRepoLat.jsx";

/**
 * Lägena för "I repot" (0.205.0, cllp/lifehub.app#653 skiva 3). Samma ord som läsaren av en fil (`GITHUB_LAGEN`) där de betyder samma sak: `last`, `saknas` (mappen finns inte), `obehorig` (GitHub-kopplingen når den inte) och `fel`. Ett annat läge, eller ett avvisat löfte, ritas som `fel`.
 */
export const REPO_LAGEN = Object.freeze(/** @type {const} */ (["last", "saknas", "obehorig", "fel"]));

/**
 * Orden i "I repot", på båda språken (0.205.0).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_BIBLIOTEK_REPO = {
  rubrik: { sv: "I repot", en: "In the repo" },
  rot: { sv: "Projektets mapp", en: "Project folder" },
  smulaEtikett: { sv: "Var i repot", en: "Where in the repo" },
  listaEtikett: { sv: "Filer och mappar i repot", en: "Files and folders in the repo" },
  tillbaka: { sv: "Tillbaka", en: "Back" },
  tom: { sv: "Mappen är tom.", en: "The folder is empty." },
  fler: { sv: "Visar de första {antal}. Fler finns i mappen i repot.", en: "Showing the first {antal}. There are more in the folder in the repo." },
  saknas: { sv: "Mappen finns inte i repot.", en: "The folder does not exist in the repo." },
  obehorig: { sv: "GitHub-kopplingen når inte mappen.", en: "The GitHub connection cannot reach the folder." },
  fel: { sv: "Det gick inte att läsa mappen just nu.", en: "The folder could not be read right now." },
  lagg: { sv: "Lägg i Biblioteket", en: "Add to the Library" },
  laggEtikett: { sv: "Lägg {namn} i Biblioteket", en: "Add {namn} to the Library" },
  lagd: { sv: "Lagd i Biblioteket.", en: "Added to the Library." },
  laggFel: { sv: "Filen gick inte att lägga i Biblioteket.", en: "The file could not be added to the Library." },
};

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

/**
 * "I repot" på ett projekts plats i Biblioteket (0.205.0, cllp/lifehub.app#653 skiva 3, CP 2026-11-08: "Lite som working copy ... integrera det i bibliotek").
 *
 * ⛔ EN NIVÅ I TAGET, LIVE. Appens `repoLasare({ plats, sokvag })` läser en mapp i projektets mapp i repot, och ingenting sparas: varje öppning frågar igen. Hela trädet läses aldrig, eftersom det frestar till en lokal kopia (planen i #653).
 * ⛔ ALDRIG OVANFÖR PROJEKTETS MAPP. Vyn känner bara vägen INOM projektets mapp (`""` är mappen själv). Brödsmulan och Tillbaka går upp en nivå och stannar vid `""`, och en väg som inte är en vanlig relativ väg (`..`, ett inledande snedstreck) ritas inte. Appen prövar
 *   samma sak på servern; det här är inte skyddet, bara att vyn aldrig ber om något annat.
 * ⛔ EN FIL ÖPPNAS I DET BEFINTLIGA LÄSLÄGET (`GithubDokumentVisningLat`, 0.186.0) via en adress av typen `github.com/<ägare>/<repo>/blob/<ref>/<sökväg>`, med appens `githubLasare` som den är. Posten läsläget får är en länk som inte
 *   finns i Biblioteket (inget `id`), med platsen som `groupId`: appen ser på det att filen ska läsas genom projektets mapp och inte genom en post.
 * ⛔ "LÄGG I BIBLIOTEKET" SKAPAR DEN VANLIGA LÄNKPOSTEN genom appens `onLagg` (lifehub.app kopplar den mot `planForGithubLank`). Ingen ny posttyp och inga nya fält.
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
  const rubrikId = useId();
  /** @param {string} k @param {Record<string, string>} [vard] */
  const o = (k, vard = {}) => Object.entries(vard).reduce((t, [n, v]) => t.replace(`{${n}}`, v), ordet(ORD_BIBLIOTEK_REPO, k, sprak));
  const [sokvag, setSokvag] = useState("");
  const [svar, setSvar] = useState(/** @type {RepoLasning | null} */ (null));
  const [oppen, setOppen] = useState(/** @type {RepoPost | null} */ (null));
  /** Läget för "Lägg i Biblioteket", per fil (sökvägen). */
  const [lagda, setLagda] = useState(/** @type {Record<string, { lage: "klar" } | { lage: "fel", text: string }>} */ ({}));
  const lasareRef = useRef(lasare);
  lasareRef.current = lasare;

  useEffect(() => {
    let kvar = true;
    setSvar(null);
    Promise.resolve()
      .then(() => lasareRef.current({ plats, sokvag }))
      .then((s) => {
        if (kvar) setSvar(tolka(s));
      })
      .catch(() => {
        if (kvar) setSvar({ lage: "fel" });
      });
    return () => {
      kvar = false;
    };
  }, [plats, sokvag]);

  const led = sokvag === "" ? [] : sokvag.split("/");
  /** @param {string} till */
  const ga = (till) => {
    setOppen(null);
    setSokvag(till);
  };
  const upp = () => ga(led.slice(0, -1).join("/"));

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

  /** @param {RepoPost} fil */
  const laggKnapp = (fil) => {
    if (typeof onLagg !== "function" || !fil.url) return null;
    const lage = lagda[fil.sokvag];
    if (lage?.lage === "klar") return <span role="status" data-bibliotek-repo-lagd="" className="text-meta text-ink-muted">{o("lagd")}</span>;
    return (
      <span data-bibliotek-repo-lagg="" className="inline-flex flex-col gap-1">
        <OpsButton variant="secondary" size="sm" ariaLabel={o("laggEtikett", { namn: fil.namn })} onClick={() => lagg(fil)}>{o("lagg")}</OpsButton>
        {lage?.lage === "fel" ? <span role="alert" className="text-meta text-danger wrap-anywhere">{lage.text}</span> : null}
      </span>
    );
  };

  const smula = (
    <nav aria-label={o("smulaEtikett")} data-bibliotek-repo-smula="" className="flex min-w-0 flex-wrap items-center gap-1 text-etikett">
      {sokvag === "" && !oppen ? (
        <span aria-current="page" className="text-ink-secondary">{o("rot")}</span>
      ) : (
        <button type="button" onClick={() => ga("")} className="min-h-11 text-accent underline underline-offset-2 md:min-h-8">{o("rot")}</button>
      )}
      {led.map((namn, i) => {
        const till = led.slice(0, i + 1).join("/");
        const sist = i === led.length - 1 && !oppen;
        return (
          <span key={till} className="inline-flex min-w-0 items-center gap-1">
            <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
            {sist ? (
              <span aria-current="page" className="min-w-0 text-ink-secondary wrap-anywhere">{namn}</span>
            ) : (
              <button type="button" onClick={() => ga(till)} className="min-h-11 min-w-0 text-accent underline underline-offset-2 wrap-anywhere md:min-h-8">{namn}</button>
            )}
          </span>
        );
      })}
    </nav>
  );

  /** @type {import("react").ReactNode} */
  let innehall;
  if (oppen && oppen.url) {
    const post = { typ: "lank", url: oppen.url, rubrik: oppen.namn, groupId: plats };
    innehall = (
      <div data-bibliotek-repo-fil={oppen.sokvag} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <OpsButton variant="secondary" size="sm" onClick={() => setOppen(null)}>{o("tillbaka")}</OpsButton>
          {laggKnapp(oppen)}
        </div>
        <h3 className="m-0 text-etikett font-medium text-ink wrap-anywhere">{oppen.namn}</h3>
        <GithubDokumentVisningLat key={oppen.url} post={post} lasare={/** @type {NonNullable<typeof githubLasare>} */ (githubLasare)} />
      </div>
    );
  } else if (!svar) {
    innehall = (
      <div role="status" aria-busy="true" data-bibliotek-repo-lage="hamtar" className="inline-flex items-center gap-2 text-etikett text-ink-muted">
        <OpsSpinner size="sm" decorative />
        {ordet(ORD_BIBLIOTEK_REPO_LAT, "hamtar", sprak)}
      </div>
    );
  } else if (svar.lage !== "last") {
    innehall = (
      <p role={svar.lage === "fel" ? "alert" : "status"} data-bibliotek-repo-lage={svar.lage} className={svar.lage === "fel" ? "m-0 text-etikett text-danger" : "m-0 text-etikett text-ink-secondary"}>
        {o(svar.lage)}
      </p>
    );
  } else if ((svar.poster ?? []).length === 0) {
    innehall = <p role="status" data-bibliotek-repo-lage="tom" className="m-0 text-etikett text-ink-secondary">{o("tom")}</p>;
  } else {
    innehall = (
      <>
        <ul aria-label={o("listaEtikett")} data-bibliotek-repo-lista="" className="m-0 flex list-none flex-col gap-1 p-0">
          {(svar.poster ?? []).map((p) => {
            const kanLasa = p.sort === "fil" && typeof p.url === "string" && githubDokument(p.url) !== null;
            const storlek = p.sort === "fil" && typeof p.storlek === "number" ? sizeText(p.storlek) : "";
            const Ikon = p.sort === "mapp" ? Folder : File;
            const etikett = (
              <>
                <Ikon size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1 wrap-anywhere">{p.namn}</span>
                {storlek ? <span className="shrink-0 text-meta text-ink-muted">{storlek}</span> : null}
              </>
            );
            const radKlass = "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-etikett text-ink hover:bg-surface-hover md:min-h-8";
            return (
              <li key={p.sokvag} data-bibliotek-repo-rad={p.sort} className="flex min-w-0 flex-wrap items-center gap-2">
                {p.sort === "mapp" ? (
                  <button type="button" onClick={() => ga(p.sokvag)} className={radKlass}>{etikett}</button>
                ) : kanLasa && typeof githubLasare === "function" ? (
                  <button type="button" onClick={() => setOppen(p)} className={radKlass}>{etikett}</button>
                ) : typeof p.url === "string" && p.url.startsWith("https://github.com/") ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className={radKlass}>{etikett}</a>
                ) : (
                  <span className={radKlass}>{etikett}</span>
                )}
                {p.sort === "fil" && kanLasa ? laggKnapp(p) : null}
              </li>
            );
          })}
        </ul>
        {svar.fler ? <p role="status" data-bibliotek-repo-fler="" className="m-0 text-meta text-ink-muted">{o("fler", { antal: String((svar.poster ?? []).length) })}</p> : null}
      </>
    );
  }

  return (
    <section aria-labelledby={rubrikId} data-bibliotek-repo="" className="flex min-w-0 flex-col gap-2 border-t border-line pt-3">
      <h2 id={rubrikId} className="m-0 inline-flex items-center gap-2 text-etikett font-medium text-ink">
        <IKON_FOR.repoDokument size={16} aria-hidden="true" className="shrink-0" />
        {o("rubrik")}
      </h2>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {sokvag !== "" && !oppen ? (
          <span data-bibliotek-repo-tillbaka="" className="inline-flex">
            <OpsButton variant="secondary" size="sm" onClick={upp}>{o("tillbaka")}</OpsButton>
          </span>
        ) : null}
        {smula}
      </div>
      {innehall}
    </section>
  );
}
