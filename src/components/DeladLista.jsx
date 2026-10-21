import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { LISTRADTEXT } from "../lib/biblioteklista.js";
import { sizeText } from "../lib/file.js";
import { formateraTid } from "../lib/ljudspelare.js";
import { DeladFil, TYPNAMN } from "./DeladFil.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { TypIkon, plattKlass } from "./BibliotekPostvisning.jsx";

/**
 * En delad LISTA som mottagaren ser den: posterna i ordning, ljud som en spellista (0.133.0, lifehub.app#356).
 *
 * ══ ⛔ DET HÄR ÄR MEDLEMMENS LISTA, SEDD UTIFRÅN ═══════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-20: "EN lista måste kunna delas ... det ser ut som en lista, men alla sakerna i listan delas. Som att jag vill dela en playlist för ett gig." och "Ändras listan kan den ju
 * bara ändras för alla som den delas med. Om en låt tas bort kan den bara tas bort precis som för den som skapade den." Vyn ritar därför exakt det servern svarar (en levande spegel,
 * `createDelningService`), och den kan inte ändra något: ingen dra-grepp, ingen Ta bort, ingen Lägg till.
 *
 * En rad som inte går att visa har medlemmens egna ord (`LISTRADTEXT`): "Finns inte längre" för en raderad post, "Listor kan inte ligga i en lista." för en lista i listan.
 *
 * ══ ⛔ EN SPELARE, ETT ELEMENT, OCH NÄSTA LÅT STARTAR NÄR EN TAR SLUT ═════════════════════════════════════════════════════
 *
 * Alla ljud spelas av EN `OpsLjudspelare` vars adress byts. Det är avsiktligt: en telefon låter ett skript starta ett ljudelement som en människa redan startat, men inte ett nytt,
 * så en spelare per låt hade stannat efter den första. Tar en låt slut startar nästa ljud i ordning (`onSlut`, `autoSpela`). Efter den sista stannar listan. Ett tryck på en rad
 * väljer och startar den raden. Bild, PDF, video och anteckning öppnas inne i sin rad (`OpsDisclosure`), och en länk har en knapp till adressen. Varje rad säger sin typ.
 *
 * ══ ⛔ ADRESSERNA GÅR UT, OCH LISTAN KAN HA ÄNDRATS NÄR DE GÖR DET ══════════════════════════════════════════════════════════════
 *
 * Varje adress gäller 15 minuter. Ger spelaren ett fel anropas `onNyUrl` EN gång per adress (som för en fil), och appen hämtar länken igen och ger vyn ett nytt `delning`: DEN NYA
 * LISTAN. Spelaren håller reda på låten på en nyckel (`id`) som är densamma vid varje hämtning. Finns låten kvar byter den bara adress; har den tagits ur listan eller raderats
 * hoppar spelaren till nästa låt som finns kvar, i den gamla ordningen (`nastaKvar`), och finns ingen går den tillbaka till första låten utan att spela.
 *
 * @typedef {{ id: string, typ: string, rubrik: string, mime?: string, storlek?: number | null, langd?: number | null, peaks?: string | null, nedladdning?: boolean, url?: string, visaUrl?: string | null, text?: string }} Listpost
 */

/**
 * Nyckeln på den låt som ska spela efter en som försvunnit: den första av de som kom efter i den gamla ordningen och som finns kvar i den nya. `null` om ingen finns.
 *
 * @param {readonly string[]} gammal Låtarnas nycklar i den gamla listan, i ordning.
 * @param {readonly string[]} ny Låtarnas nycklar i den nya listan.
 * @param {string} borta Nyckeln som inte finns i den nya.
 * @returns {string | null}
 */
export function nastaKvar(gammal, ny, borta) {
  const i = gammal.indexOf(borta);
  if (i < 0) return null;
  return gammal.slice(i + 1).find((k) => ny.includes(k)) ?? null;
}

/** @param {number} n */
const poster = (n) => `${n} ${n === 1 ? "post" : "poster"}`;

/** Typens namn på en rad, som biblioteket säger det. @param {Listpost} p */
const typNamn = (p) => (p.typ === "anteckning" ? "Anteckning" : p.typ === "lank" ? "Länk" : (TYPNAMN[p.typ] ?? TYPNAMN.dokument));

/** Formen `TypIkon` och `plattKlass` läser: en fil har en MIME, de andra sin typ. @param {Listpost} p */
const ikonPost = (p) => (p.mime ? { typ: "fil", fil: { mime: p.mime } } : { typ: p.typ });

/** Är adressen en länk som får öppnas? Servern släpper bara igenom http och https, och vyn tror inte på det: en adress som blivit något annat får ingen knapp. @param {unknown} url */
const arWebbadress = (url) => typeof url === "string" && /^https?:\/\/[!-~]+$/.test(url);

/**
 * @param {object} props
 * @param {{ rubrik: string, nedladdning?: boolean, ejVisade?: number, poster: ReadonlyArray<Listpost | { typ: "saknas" | "lista-i-lista" }> }} props.delning
 * @param {() => void | Promise<void>} [props.onNyUrl]
 */
export function DeladLista({ delning, onNyUrl }) {
  const rader = Array.isArray(delning.poster) ? delning.poster : [];
  const ljud = /** @type {Listpost[]} */ (rader.filter((p) => p.typ === "ljud" && typeof (/** @type {Listpost} */ (p)).id === "string" && typeof (/** @type {Listpost} */ (p)).url === "string"));
  const nycklar = ljud.map((p) => p.id);
  const ejVisade = Number.isInteger(delning.ejVisade) ? /** @type {number} */ (delning.ejVisade) : 0;

  // Vald låt: nyckeln, eller null för "den första". `auto` är om nästa adress ska starta av sig själv: sant medan något spelar, när en låt tagit slut och efter ett tryck på en rad.
  const [vald, setVald] = useState(/** @type {string | null} */ (null));
  const [auto, setAuto] = useState(false);
  const [start, setStart] = useState(0);
  const [fel, setFel] = useState("");
  const forra = useRef(/** @type {string[]} */ (nycklar));
  const bedd = useRef(/** @type {string | null} */ (null));

  // ⛔ LISTAN HAR HÄMTATS OM OCH DEN VALDA LÅTEN FINNS INTE LÄNGRE: spelaren går till nästa låt som finns kvar, i den gamla ordningen, och det räknas ut medan sidan ritas (inte i en effekt efteråt).
  // Annars hade en ritning hunnit visa första låten på vägen och startat den. Finns ingen nästa väljs första låten, och ingenting startar.
  const forsvunnen = vald !== null && !nycklar.includes(vald);
  const efterfoljare = forsvunnen ? nastaKvar(forra.current, nycklar, /** @type {string} */ (vald)) : null;
  const aktuell = ljud.find((p) => p.id === (forsvunnen ? efterfoljare : vald)) ?? ljud[0];
  const spelaVidare = auto && !(forsvunnen && efterfoljare === null);
  const nyckelText = nycklar.join("|");
  useEffect(() => {
    forra.current = nycklar;
    if (forsvunnen) {
      setVald(efterfoljare);
      if (efterfoljare === null) setAuto(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nycklarna läses ur `nyckelText`
  }, [nyckelText]);

  const aktuellUrl = aktuell?.url ?? "";
  useEffect(() => setFel(""), [aktuellUrl]);

  const filFel = (/** @type {string} */ text) => {
    if (typeof onNyUrl === "function" && bedd.current !== aktuellUrl) {
      bedd.current = aktuellUrl;
      Promise.resolve(onNyUrl()).catch(() => setFel(text));
      return;
    }
    setFel(text);
  };

  /** Nästa ljud i ordning, eller ingen: efter den sista stannar listan och går tillbaka till första låten. */
  const nasta = () => {
    const i = aktuell ? nycklar.indexOf(aktuell.id) : -1;
    const n = i >= 0 ? nycklar[i + 1] : undefined;
    if (n === undefined) {
      setAuto(false);
      setVald(null);
      return;
    }
    setAuto(true);
    setVald(n);
  };

  return (
    <article data-delad="lista" className="flex min-w-0 w-full flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 data-delad-rubrik="" className="m-0 text-sida text-ink wrap-anywhere">{delning.rubrik}</h1>
        <p data-delad-meta="" className="m-0 text-meta text-ink-muted">
          {["Lista", poster(rader.length + ejVisade)].join(" · ")}
        </p>
      </header>

      {aktuell ? (
        <section aria-label="Spelare" data-delad-spelare="" className="flex min-w-0 flex-col gap-1 rounded-lg border border-line p-3">
          <OpsLjudspelare
            src={aktuell.url}
            namn={aktuell.rubrik}
            durationMs={aktuell.langd ?? undefined}
            peaks={aktuell.peaks ?? undefined}
            utanNedladdning={aktuell.nedladdning !== true}
            autoSpela={spelaVidare}
            startnummer={start}
            onSlut={nasta}
            onSpelstatus={setAuto}
            onFel={(f) => {
              if (f) filFel(f);
            }}
          />
        </section>
      ) : null}
      {fel ? <p role="alert" data-delad-fel="" className="m-0 text-etikett text-danger">{fel}</p> : null}

      {rader.length === 0 ? (
        <p data-delad-tom="" className="m-0 text-etikett text-ink-secondary">Listan är tom.</p>
      ) : (
        <ol aria-label={`Posterna i ${delning.rubrik}`} data-delad-poster="" className="m-0 flex list-none flex-col gap-2 p-0">
          {rader.map((p, i) => (
            <Rad
              key={"id" in p ? p.id : `r${i}`}
              p={p}
              spelas={Boolean(aktuell) && "id" in p && p.id === aktuell?.id}
              onValj={() => {
                if (!("id" in p)) return;
                setAuto(true);
                // Raden är redan vald (och står på sin adress): adressen byts inte, så ett startnummer säger åt spelaren att starta.
                if (aktuell?.id === p.id) setStart((n) => n + 1);
                setVald(p.id);
              }}
              onNyUrl={onNyUrl}
            />
          ))}
        </ol>
      )}
      {ejVisade > 0 ? <p data-delad-ejvisade="" className="m-0 text-meta text-ink-muted">{ejVisade === 1 ? "1 post till visas inte här." : `${ejVisade} poster till visas inte här.`}</p> : null}
    </article>
  );
}

const RAD = "flex min-w-0 flex-col rounded-lg border border-line bg-surface";

/**
 * @param {{ p: Listpost | { typ: "saknas" | "lista-i-lista" }, spelas: boolean, onValj: () => void, onNyUrl?: () => void | Promise<void> }} props
 */
function Rad({ p, spelas, onValj, onNyUrl }) {
  if (p.typ === "saknas" || p.typ === "lista-i-lista") {
    return (
      <li data-delad-rad={p.typ} className={cx(RAD, "p-3")}>
        <span data-delad-saknas="" className="text-etikett text-ink-muted wrap-anywhere">{p.typ === "lista-i-lista" ? LISTRADTEXT.lista : LISTRADTEXT.saknas}</span>
      </li>
    );
  }
  const post = /** @type {Listpost} */ (p);
  const meta = [typNamn(post), post.typ === "ljud" && post.langd ? formateraTid(post.langd / 1000) : "", post.storlek ? sizeText(post.storlek) : ""].filter(Boolean).join(" · ");
  const plattan = (
    <span aria-hidden="true" className={cx("flex size-11 shrink-0 items-center justify-center rounded-full", plattKlass(ikonPost(post)))}>
      <TypIkon post={ikonPost(post)} />
    </span>
  );
  const rubrik = (
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span data-delad-radrubrik="" className="text-etikett text-ink wrap-anywhere">{post.rubrik}</span>
      <span data-delad-radmeta="" className="text-meta text-ink-muted">{spelas ? `Spelas nu · ${meta}` : meta}</span>
    </span>
  );

  if (post.typ === "ljud") {
    return (
      <li data-delad-rad="ljud" aria-current={spelas ? "true" : undefined} className={cx(RAD, "flex-row items-center gap-3 p-3", spelas && "border-accent bg-accent-faint")}>
        <button
          type="button"
          aria-label={`Spela ${post.rubrik} ur listan`}
          onClick={onValj}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 bg-transparent text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {plattan}
          {rubrik}
        </button>
        {post.nedladdning === true && post.url ? <OpsButton variant="secondary" size="sm" href={post.url} ariaLabel={`Ladda ner ${post.rubrik}`}>Ladda ner</OpsButton> : null}
      </li>
    );
  }

  if (post.typ === "lank") {
    return (
      <li data-delad-rad="lank" className={cx(RAD, "flex-row items-center gap-3 p-3")}>
        {plattan}
        {rubrik}
        {arWebbadress(post.url) ? (
          <OpsButton variant="secondary" size="sm" href={post.url} newTab ariaLabel={`Öppna länken ${post.rubrik}`}>Öppna</OpsButton>
        ) : null}
      </li>
    );
  }

  return <Utfallbar post={post} plattan={plattan} rubrik={rubrik} onNyUrl={onNyUrl} />;
}

/**
 * En rad som fäller ut sitt innehåll: en anteckning (texten), en bild, en video, en PDF eller ett dokument. Innehållet monteras först när raden öppnas, så att en lista med
 * hundra bilder inte hämtar hundra bilder.
 *
 * @param {{ post: Listpost, plattan: import("react").ReactNode, rubrik: import("react").ReactNode, onNyUrl?: () => void | Promise<void> }} props
 */
function Utfallbar({ post, plattan, rubrik, onNyUrl }) {
  const [oppen, setOppen] = useState(false);
  return (
    <li data-delad-rad={post.typ} className="min-w-0">
      <OpsDisclosure
        open={oppen}
        onOpenChange={setOppen}
        summary={
          <span className="flex min-w-0 flex-1 items-center gap-3">
            {plattan}
            {rubrik}
          </span>
        }
      >
        {oppen ? (
          post.typ === "anteckning" ? (
            <div data-delad-anteckning="" className="max-w-las">
              <OpsMarkdown text={post.text ?? ""} dokument />
            </div>
          ) : (
            <DeladFil delning={/** @type {import("./DeladFil.jsx").DeladFilSvar} */ (post)} onNyUrl={onNyUrl} iLista />
          )
        ) : null}
      </OpsDisclosure>
    </li>
  );
}
