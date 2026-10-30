import { useCallback, useEffect, useRef, useState } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsHtmlDokument } from "./OpsHtmlDokument.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { arHtmlMime, filInmatningsfel, mimeUrFilnamn } from "../lib/bibliotek.js";
import { ordet } from "../lib/ord.js";
import { skaparensNamn } from "../lib/skapare.js";

/**
 * Versionsraden för ett HTML-dokument i Bibliotekets detalj (0.158.0, cllp/ops-framework, uppföljning av #472).
 *
 * ══ ⛔ VARFÖR RADEN ÄR SMAL ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP har bestämt den smala varianten: en rad "Versioner" i postens panel, bara för ett HTML-dokument (`text/html`). Där kan man se listan (nummer, vem, när), öppna en äldre version i den avspärrade rutan (`OpsHtmlDokument`),
 * återställa en (som skapar en NY version) och ladda upp en ny fil som ny version. Ingen jämförelse mellan versioner.
 *
 * ⛔ SKRIVNINGARNA GÅR VIA APPEN, ALDRIG MOT FIRESTORE HÄRIFRÅN. En klientskrivning direkt mot Firestore klarar inte steget från version 2 till 3 för en admin, eftersom reglernas uttrycksgräns tar slut. Därför tar komponenten
 * bara callbacks (`lista`, `hamtaVersion`, `aterstall`, `nyVersion`), och appen anropar sitt API som anropar `createHtmlDokumentService` på servern. Utan en callback finns inte knappen som behöver den, och utan `lista` ritas ingen rad alls.
 *
 * ⛔ FELEN SYNS. En konflikt (någon annan hann före: `fel.kod === "konflikt"` eller `fel.status === 409`) blir en mening med en knapp för att läsa om listan. Tomhet ("Inga versioner hittades."), ett svar i fel form och
 * alla andra fel skrivs ut med sin orsak (arbetsreglernas punkt 5). Ingenting tystas, och en återställning eller en fil som inte blev en ny version säger det.
 *
 * ⛔ `fran` ÄR VERSIONEN ANVÄNDAREN SÅG. Den kommer ur den senast lästa listan (`nuvarande`), annars ur postens `version.nr` (1 när fältet saknas). Servern jämför den med dokumentets nuvarande version och svarar `konflikt`
 * om någon hann före: det är så två som skriver ur samma version inte skriver över varandra.
 *
 * Listan hämtas när raden fälls ut, inte när detaljen öppnas: en HTML-post ska inte kosta ett anrop mer än den gör i dag för den som aldrig tittar på historiken.
 *
 * @param {object} props
 * @param {{ id?: string, groupId?: string, rubrik?: string, version?: { nr?: number }, skapadAv?: unknown, fil?: { sokvag?: string, namn?: string, mime?: string } }} props.post HTML-dokumentet.
 * @param {boolean} props.kanAndra Får den som tittar ändra posten (`farAndra`)? Utan det finns varken Återställ eller uppladdning: servern nekar dem ändå.
 * @param {(post: any) => Promise<unknown>} props.lista Versionerna, `{ nuvarande, versioner: [{ nr, nuvarande, av, tid, saknas? }] }` (svaret från `html.versioner`) eller bara listan.
 * @param {(post: any, nr: number) => Promise<unknown>} [props.hamtaVersion] Texten för en version, som en sträng eller `{ text }` (`html.lasVersion`).
 * @param {(post: any, nr: number, fran: number) => Promise<unknown>} [props.aterstall] Återställer version `nr` som en ny version, ur version `fran`. Löser till svaret från `html.aterstall` (`{ ny, nr }`) eller inget.
 * @param {(post: any, fil: File, fran: number) => Promise<unknown>} [props.nyVersion] Sparar `fil` som en ny version, ur version `fran`. Löser till svaret från `html.uppdatera` (`{ ny, nr }`) eller inget.
 */
export function BibliotekHtmlVersioner({ post, kanAndra, lista, hamtaVersion, aterstall, nyVersion }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_HTMLVERSIONER} */ k, /** @type {Record<string, string | number>} */ v = {}) =>
    Object.entries(v).reduce((t, [n, x]) => t.replaceAll(`{${n}}`, String(x)), ordet(ORD_HTMLVERSIONER, k, sprak));

  const [oppen, setOppen] = useState(false);
  const [data, setData] = useState(/** @type {{ nuvarande: number, rader: Versionsrad[] } | null} */ (null));
  const [lage, setLage] = useState(/** @type {"vilar" | "hamtar" | "klar" | "fel"} */ ("vilar"));
  const [listfel, setListfel] = useState("");
  const [arbetar, setArbetar] = useState(/** @type {string | null} */ (null));
  const [fel, setFel] = useState(/** @type {{ konflikt: boolean, text: string } | null} */ (null));
  const [besked, setBesked] = useState("");
  const [visad, setVisad] = useState(/** @type {{ nr: number, av: unknown, lage: "hamtar" | "klar" | "fel", html?: string, fel?: string } | null} */ (null));
  const filFalt = useRef(/** @type {HTMLInputElement | null} */ (null));

  // ⛔ FUNKTIONERNA I REFAR, som `OpsHtmlDokumentHamtat`: en app som skickar nya pilfunktioner vid varje rendering ska inte hämta om listan.
  const ref = useRef({ post, lista, hamtaVersion, aterstall, nyVersion });
  ref.current = { post, lista, hamtaVersion, aterstall, nyVersion };
  const lopnr = useRef(0);
  const visadLopnr = useRef(0);
  const arbetarRef = useRef(/** @type {string | null} */ (null));
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
      lopnr.current += 1;
      visadLopnr.current += 1;
    };
  }, []);

  const ladda = useCallback(async () => {
    const mitt = (lopnr.current += 1);
    setLage("hamtar");
    setListfel("");
    try {
      const svar = await ref.current.lista(ref.current.post);
      if (mitt !== lopnr.current) return;
      const tolkad = tolkaVersioner(svar);
      if (!tolkad) {
        setLage("fel");
        setListfel(ordet(ORD_HTMLVERSIONER, "ogiltigtSvar", sprak));
        return;
      }
      setData(tolkad);
      setLage("klar");
    } catch (e) {
      if (mitt !== lopnr.current) return;
      setLage("fel");
      setListfel(felText(e, sprak));
    }
  }, [sprak]);

  // Listan läses när raden är utfälld, och om när dokumentets fil byter (appen har ritat om posten efter en ny version).
  const sokvag = post.fil?.sokvag;
  useEffect(() => {
    if (oppen) void ladda();
  }, [oppen, sokvag, post.id, ladda]);

  const fran = data?.nuvarande ?? (Number.isInteger(post.version?.nr) ? /** @type {number} */ (post.version?.nr) : 1);

  /** @param {string} nyckel @param {() => Promise<void>} gor */
  async function kor(nyckel, gor) {
    if (arbetarRef.current) return;
    arbetarRef.current = nyckel;
    setArbetar(nyckel);
    setFel(null);
    setBesked("");
    try {
      await gor();
    } catch (e) {
      if (monterad.current) setFel({ konflikt: arKonflikt(e), text: arKonflikt(e) ? "" : felText(e, sprak) });
    } finally {
      arbetarRef.current = null;
      if (monterad.current) setArbetar(null);
    }
  }

  /** @param {number} nr @param {unknown} av */
  function oppna(nr, av) {
    const hamta = ref.current.hamtaVersion;
    if (!hamta) return Promise.resolve();
    const mitt = (visadLopnr.current += 1);
    setVisad({ nr, av, lage: "hamtar" });
    return Promise.resolve()
      .then(() => hamta(ref.current.post, nr))
      .then((svar) => {
        if (mitt !== visadLopnr.current) return;
        const html = typeof svar === "string" ? svar : svar && typeof svar === "object" && typeof (/** @type {any} */ (svar).text) === "string" ? /** @type {any} */ (svar).text : null;
        if (html === null) setVisad({ nr, av, lage: "fel", fel: ordet(ORD_HTMLVERSIONER, "ogiltigtSvar", sprak) });
        else setVisad({ nr, av, lage: "klar", html });
      })
      .catch((e) => {
        if (mitt === visadLopnr.current) setVisad({ nr, av, lage: "fel", fel: felText(e, sprak) });
      });
  }

  /** @param {number} nr */
  function aterstallVersion(nr) {
    const gor = ref.current.aterstall;
    if (!gor) return Promise.resolve();
    return kor(`aterstall:${nr}`, async () => {
      const svar = await gor(ref.current.post, nr, fran);
      if (!monterad.current) return;
      setBesked(svarsbesked(svar, "aterstalld", "aterstalldNr", "oforandrad", { fran: nr }, o));
      await ladda();
    });
  }

  /** @param {import("react").ChangeEvent<HTMLInputElement>} e */
  function valdFil(e) {
    const vald = e.target.files?.[0] ?? null;
    // Samma fil ska gå att välja igen efter ett fel.
    e.target.value = "";
    const gor = ref.current.nyVersion;
    if (!vald || !gor) return Promise.resolve();
    const mime = vald.type || mimeUrFilnamn(vald.name);
    if (!arHtmlMime(mime)) {
      setBesked("");
      setFel({ konflikt: false, text: o("valjHtml") });
      return Promise.resolve();
    }
    const formfel = filInmatningsfel({ namn: vald.name, mime, byte: vald.size });
    if (formfel) {
      setBesked("");
      setFel({ konflikt: false, text: formfel });
      return Promise.resolve();
    }
    return kor("ny", async () => {
      const svar = await gor(ref.current.post, vald, fran);
      if (!monterad.current) return;
      setBesked(svarsbesked(svar, "nyLagd", "nyLagdNr", "oforandradFil", {}, o));
      await ladda();
    });
  }

  /** Läs om efter en konflikt: listan hämtas på nytt och `fran` blir den nyare versionen. */
  function lasOm() {
    setFel(null);
    return ladda();
  }

  const nu = data?.nuvarande ?? (Number.isInteger(post.version?.nr) ? /** @type {number} */ (post.version?.nr) : 1);
  const upptagen = arbetar !== null;
  const namn = post.fil?.namn ?? post.rubrik ?? "";

  return (
    <div data-html-versioner="" className="min-w-0">
      <OpsDisclosure
        onOpenChange={setOppen}
        summary={
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <span className="font-medium text-ink">{o("rubrik")}</span>
            <span data-html-versioner-nu="" className="text-meta text-ink-secondary">{o("version", { nr: nu })}</span>
          </span>
        }
      >
        <div className="flex min-w-0 flex-col gap-3">
          {lage === "hamtar" && !data ? <p role="status" data-html-versioner-lage="hamtar" className="m-0 text-etikett text-ink-muted">{o("hamtar")}</p> : null}
          {lage === "fel" ? (
            <div role="alert" data-html-versioner-lage="fel" className="flex min-w-0 flex-col items-start gap-2">
              <p className="m-0 text-etikett text-danger wrap-anywhere">{`${o("listfel")} ${listfel}`}</p>
              <OpsButton variant="secondary" size="sm" busyLabel={o("hamtarKort")} onClick={() => ladda()}>
                {o("forsokIgen")}
              </OpsButton>
            </div>
          ) : null}
          {data && data.rader.length === 0 ? <p role="status" data-html-versioner-lage="tom" className="m-0 text-etikett text-ink-muted">{o("inga")}</p> : null}
          {data && data.rader.length > 0 ? (
            <ul data-html-versioner-lista="" className="m-0 flex min-w-0 list-none flex-col p-0" aria-label={o("rubrik")} aria-busy={lage === "hamtar" ? "true" : undefined}>
              {data.rader.map((r) => (
                <li
                  key={r.nr}
                  data-html-version={r.nr}
                  data-html-version-nuvarande={r.nuvarande ? "" : undefined}
                  className="flex min-w-0 flex-col gap-2 border-t border-divider py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-etikett font-medium text-ink">
                      {o("version", { nr: r.nr })}
                      {r.nuvarande ? <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-meta font-medium text-ink">{o("nuvarande")}</span> : null}
                    </span>
                    <span className="text-meta text-ink-secondary wrap-anywhere">
                      {r.saknas ? o("saknas") : versionsrad(r, sprak, o)}
                    </span>
                  </div>
                  {!r.saknas && !r.nuvarande && (hamtaVersion || (kanAndra && aterstall)) ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {hamtaVersion ? (
                        <OpsButton variant="secondary" size="sm" ariaLabel={o("oppnaNr", { nr: r.nr })} busyLabel={o("hamtarKort")} disabled={upptagen} onClick={() => oppna(r.nr, r.av)}>
                          {o("oppna")}
                        </OpsButton>
                      ) : null}
                      {kanAndra && aterstall ? (
                        <OpsButton variant="secondary" size="sm" ariaLabel={o("aterstallNr", { nr: r.nr })} busyLabel={o("aterstaller")} disabled={upptagen && arbetar !== `aterstall:${r.nr}`} onClick={() => aterstallVersion(r.nr)}>
                          {o("aterstall")}
                        </OpsButton>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {fel?.konflikt ? (
            <div role="alert" data-html-versioner-konflikt="" className="flex min-w-0 flex-col items-start gap-2">
              <p className="m-0 text-etikett text-danger wrap-anywhere">{o("konflikt")}</p>
              <OpsButton variant="secondary" size="sm" busyLabel={o("hamtarKort")} onClick={lasOm}>
                {o("lasOm")}
              </OpsButton>
            </div>
          ) : null}
          {fel && !fel.konflikt ? <p role="alert" data-html-versioner-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{fel.text}</p> : null}
          {besked ? <p role="status" data-html-versioner-besked="" className="m-0 text-etikett text-ink-secondary wrap-anywhere">{besked}</p> : null}

          {kanAndra && nyVersion ? (
            <div data-html-versioner-ny="" className="flex min-w-0 flex-col items-start gap-1 border-t border-divider pt-3">
              <OpsButton
                variant="secondary"
                size="sm"
                busy={arbetar === "ny"}
                busyLabel={o("laddarUpp")}
                disabled={upptagen && arbetar !== "ny"}
                onClick={() => filFalt.current?.click()}
              >
                {o("ny")}
              </OpsButton>
              <input ref={filFalt} type="file" accept=".html,.htm,text/html" aria-label={o("ny")} className="hidden" onChange={valdFil} />
              <span className="text-meta text-ink-muted">{o("nyHjalp")}</span>
            </div>
          ) : null}

          {visad ? (
            <div data-html-versioner-oppen={visad.nr} className="flex min-w-0 flex-col gap-2 border-t border-divider pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-etikett font-medium text-ink">{o("gammal", { nr: visad.nr })}</p>
                <OpsButton variant="ghost" size="sm" onClick={() => { visadLopnr.current += 1; setVisad(null); }}>
                  {o("stang")}
                </OpsButton>
              </div>
              {visad.lage === "hamtar" ? <p role="status" data-html-versioner-lage="oppnar" className="m-0 text-etikett text-ink-muted">{o("hamtarVersion", { nr: visad.nr })}</p> : null}
              {visad.lage === "fel" ? <p role="alert" data-html-versioner-lage="oppnaFel" className="m-0 text-etikett text-danger wrap-anywhere">{`${o("oppnaFel", { nr: visad.nr })} ${visad.fel ?? ""}`}</p> : null}
              {visad.lage === "klar" && (visad.html ?? "").trim() === "" ? <p role="status" data-html-versioner-lage="tomVersion" className="m-0 text-etikett text-ink-muted">{o("tomVersion", { nr: visad.nr })}</p> : null}
              {visad.lage === "klar" && (visad.html ?? "").trim() !== "" ? (
                <OpsHtmlDokument html={/** @type {string} */ (visad.html)} namn={`${namn}, ${o("version", { nr: visad.nr }).toLowerCase()}`} skapadAv={visad.av} />
              ) : null}
            </div>
          ) : null}
        </div>
      </OpsDisclosure>
    </div>
  );
}

/**
 * @typedef {object} Versionsrad
 * @property {number} nr
 * @property {boolean} nuvarande
 * @property {unknown} av
 * @property {number | null} tid
 * @property {boolean} saknas
 */

/**
 * Svaret från `lista` som rader, den nyaste först, eller `null` när formen är fel (ett svar som inte går att läsa är ett fel som skrivs ut, inte en tom lista).
 *
 * @param {unknown} svar `{ nuvarande, versioner }` (svaret från `html.versioner`) eller bara listan.
 * @returns {{ nuvarande: number, rader: Versionsrad[] } | null}
 */
export function tolkaVersioner(svar) {
  const s = /** @type {any} */ (svar);
  const lista = Array.isArray(s) ? s : s && typeof s === "object" && Array.isArray(s.versioner) ? s.versioner : null;
  if (!lista) return null;
  /** @type {Versionsrad[]} */
  const rader = [];
  for (const r of lista) {
    if (!r || typeof r !== "object" || !Number.isInteger(r.nr) || r.nr < 1) return null;
    rader.push({ nr: r.nr, nuvarande: r.nuvarande === true, av: r.av ?? null, tid: Number.isFinite(r.tid) ? r.tid : null, saknas: r.saknas === true });
  }
  rader.sort((a, b) => b.nr - a.nr);
  const utpekad = !Array.isArray(s) && Number.isInteger(s.nuvarande) ? s.nuvarande : null;
  const nuvarande = utpekad ?? rader.find((r) => r.nuvarande)?.nr ?? rader[0]?.nr ?? 1;
  return { nuvarande, rader: rader.map((r) => ({ ...r, nuvarande: r.nr === nuvarande })) };
}

/** @param {unknown} e Är felet en konflikt (någon annan hann före)? Appen kastar `kod: "konflikt"` (tjänstens kod) eller ett fel med status 409. */
export function arKonflikt(e) {
  if (!e || typeof e !== "object") return false;
  const x = /** @type {any} */ (e);
  return x.kod === "konflikt" || x.code === "konflikt" || x.status === 409 || x.httpStatus === 409;
}

/** @param {number} ms @param {string} sprak */
function versionstid(ms, sprak) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(sprak === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** @param {Versionsrad} r @param {string} sprak @param {(k: keyof typeof ORD_HTMLVERSIONER, v?: Record<string, string | number>) => string} o */
function versionsrad(r, sprak, o) {
  const vem = r.av ? skaparensNamn(r.av, sprak) : "";
  const tid = r.tid === null ? "" : versionstid(r.tid, sprak);
  if (vem && tid) return o("avTid", { vem, tid });
  return vem || tid || o("okand");
}

/**
 * Meddelandet efter en lyckad skrivning. ⛔ SÄGER VAD SOM HÄNDE: en skrivning som inte blev en ny version (`ny: false`, texten är lika med den nuvarande) skrivs ut som det, inte som ett lyckat steg.
 *
 * @param {unknown} svar @param {"aterstalld" | "nyLagd"} utanNr @param {"aterstalldNr" | "nyLagdNr"} medNr @param {"oforandrad" | "oforandradFil"} oforandrad
 * @param {Record<string, string | number>} extra @param {(k: keyof typeof ORD_HTMLVERSIONER, v?: Record<string, string | number>) => string} o
 */
function svarsbesked(svar, utanNr, medNr, oforandrad, extra, o) {
  const s = /** @type {any} */ (svar && typeof svar === "object" ? svar : {});
  if (s.ny === false) return o(oforandrad, extra);
  if (Number.isInteger(s.nr)) return o(medNr, { ...extra, nr: s.nr });
  return o(utanNr, extra);
}

/** @param {unknown} e @param {string} sprak */
function felText(e, sprak) {
  const x = /** @type {any} */ (e && typeof e === "object" ? e : {});
  const kod = typeof x.kod === "string" ? x.kod : typeof x.code === "string" ? x.code : "";
  const text = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const k = /** @type {Record<string, keyof typeof ORD_HTMLVERSIONER>} */ ({
    tomt: "felTomt",
    "for-stor": "felForStor",
    ogiltigt: "felOgiltigt",
    "version-saknas": "felVersionSaknas",
    "finns-inte": "felFinnsInte",
    "inte-html": "felInteHtml",
    "ej-klar": "felInteHtml",
  })[kod];
  if (k) return ordet(ORD_HTMLVERSIONER, k, sprak);
  return text ? `${ordet(ORD_HTMLVERSIONER, "felOkant", sprak)} ${text}` : ordet(ORD_HTMLVERSIONER, "felOkant", sprak);
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_HTMLVERSIONER = {
  rubrik: { sv: "Versioner", en: "Versions" },
  version: { sv: "Version {nr}", en: "Version {nr}" },
  nuvarande: { sv: "Nuvarande", en: "Current" },
  avTid: { sv: "{vem}, {tid}", en: "{vem}, {tid}" },
  okand: { sv: "Okänt vem och när.", en: "Author and time unknown." },
  saknas: { sv: "Versionen saknas i historiken.", en: "This version is missing from the history." },
  hamtar: { sv: "Hämtar versionerna.", en: "Fetching the versions." },
  hamtarKort: { sv: "Hämtar…", en: "Fetching…" },
  listfel: { sv: "Versionerna gick inte att hämta.", en: "The versions could not be fetched." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  inga: { sv: "Inga versioner hittades.", en: "No versions found." },
  ogiltigtSvar: { sv: "Svaret hade ett oväntat format.", en: "The response had an unexpected format." },
  oppna: { sv: "Öppna", en: "Open" },
  oppnaNr: { sv: "Öppna version {nr}", en: "Open version {nr}" },
  aterstall: { sv: "Återställ", en: "Restore" },
  aterstallNr: { sv: "Återställ version {nr}", en: "Restore version {nr}" },
  aterstaller: { sv: "Återställer…", en: "Restoring…" },
  aterstalld: { sv: "Version {fran} är återställd som en ny version.", en: "Version {fran} was restored as a new version." },
  aterstalldNr: { sv: "Version {fran} är återställd som version {nr}.", en: "Version {fran} was restored as version {nr}." },
  oforandrad: { sv: "Ingen ny version skapades: dokumentet har redan version {fran}:s innehåll.", en: "No new version was created: the document already has the content of version {fran}." },
  ny: { sv: "Ladda upp ny version", en: "Upload new version" },
  laddarUpp: { sv: "Laddar upp…", en: "Uploading…" },
  nyHjalp: { sv: "En ny HTML-fil blir en ny version. Den förra finns kvar.", en: "A new HTML file becomes a new version. The previous one is kept." },
  nyLagd: { sv: "Filen är sparad som en ny version.", en: "The file was saved as a new version." },
  nyLagdNr: { sv: "Filen är sparad som version {nr}.", en: "The file was saved as version {nr}." },
  oforandradFil: { sv: "Ingen ny version skapades: filen är lika med den nuvarande versionen.", en: "No new version was created: the file is identical to the current version." },
  valjHtml: { sv: "Välj en HTML-fil (.html eller .htm).", en: "Choose an HTML file (.html or .htm)." },
  konflikt: { sv: "Någon annan hann före, och dokumentet har en nyare version än den du såg. Läs om för att se den och försök sedan igen.", en: "Someone else got there first, and the document has a newer version than the one you saw. Reload to see it, then try again." },
  lasOm: { sv: "Läs om", en: "Reload" },
  gammal: { sv: "Du tittar på version {nr}, inte den nuvarande.", en: "You are looking at version {nr}, not the current one." },
  stang: { sv: "Stäng", en: "Close" },
  hamtarVersion: { sv: "Hämtar version {nr}.", en: "Fetching version {nr}." },
  oppnaFel: { sv: "Version {nr} gick inte att visa.", en: "Version {nr} could not be shown." },
  tomVersion: { sv: "Version {nr} är tom.", en: "Version {nr} is empty." },
  felOkant: { sv: "Det gick inte.", en: "That did not work." },
  felTomt: { sv: "Filen är tom.", en: "The file is empty." },
  felForStor: { sv: "Filen är för stor.", en: "The file is too large." },
  felOgiltigt: { sv: "Filen går inte att läsa som text.", en: "The file cannot be read as text." },
  felVersionSaknas: { sv: "Den versionen finns inte längre i historiken.", en: "That version is no longer in the history." },
  felFinnsInte: { sv: "Dokumentet finns inte längre.", en: "The document no longer exists." },
  felInteHtml: { sv: "Dokumentet är inte ett färdigt HTML-dokument.", en: "The document is not a finished HTML document." },
};
