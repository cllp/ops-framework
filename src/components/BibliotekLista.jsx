import { useEffect, useRef, useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { MAX_BIBLIOTEKRUBRIK, MAX_LISTPOSTER, filtreraBibliotek, inmatningsfel, ljudRubrik, arLjudpost, trimSomRegeln } from "../lib/bibliotek.js";
import { kandidaterForLista, laggTillPost, losLista, taBortPost } from "../lib/biblioteklista.js";
import { flyttaFore, flyttaId } from "../lib/apparark.js";
import { cx } from "../lib/cx.js";
import { LankMark, TypIkon, oppnasDirekt, plattKlass, typEtikett } from "./BibliotekPostvisning.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";

/*
 * Listor i Biblioteket: vyn av en lista, "Lägg till" inifrån listan och "Lägg i lista" ur en posts meny (0.128.0, cllp/lifehub.app#378).
 *
 * ⛔ DESIGNEN ÄR CP:S BESLUT 2026-10-20: "Listor är en post i Biblioteket som pekar på andra poster från samma bibliotek i en bestämd ordning. Poster läggs till med långtryck
 * eller inifrån listan, ordningen ändras genom att dra och posterna tas bort lika lätt." Modellen och skälen står i `lib/biblioteklista.js` och `lib/bibliotek.js` (`listaFel`).
 *
 * ⛔ VARJE ÄNDRING SPARAS DIREKT. Dra, flytta med piltangenterna, ta bort och lägg till är fyra tryck som var och en är en skrivning av listans `poster`, utan ett Spara. Ordningen
 * ritas om på en gång (optimistiskt) och rullas tillbaka med felet synligt om skrivningen faller (regel 5): en ordning som såg sparad ut och inte var det är värre än ett fel. Skrivningarna
 * går i tur och ordning (en kedja), så att två snabba ändringar inte kommer fram i omvänd ordning.
 *
 * ⛔ DRA OCH TANGENTBORD ÄR SAMMA ÅTGÄRD. Greppet är en knapp: pekardrag (`flyttaFore`, som app-arkets ordning) och upp-/nedpil (`flyttaId`) ger samma lista. Fokus följer med den flyttade raden.
 */

/**
 * Kör appens `onSpara` och gör om dess tre sätt att säga nej (kastar, svarar `false`, avvisat löfte) till ETT kast med en text.
 *
 * @param {((inmatning: any) => void | boolean | Promise<void | boolean>) | undefined} onSpara
 * @param {Record<string, unknown>} inmatning
 * @param {string} felText Texten när appen svarar `false`.
 * @returns {Promise<void>}
 */
export async function sparaOchVanta(onSpara, inmatning, felText) {
  if (typeof onSpara !== "function") throw new Error("Sparandet är inte kopplat. Ingenting ändrades.");
  const svar = await onSpara(inmatning);
  if (svar === false) throw new Error(felText);
}

/** @param {unknown} e */
const felText = (e) => (e instanceof Error && e.message ? e.message : String(e));

/**
 * Postens namn i en lista: ljudets rubrik (med datum när den saknas), annars rubriken, annars "Post".
 * @param {import("../lib/bibliotek.js").Bibliotekspost} post
 */
const postNamn = (post) => (arLjudpost(post) ? ljudRubrik(post) : trimSomRegeln(post.rubrik) || "Post");

/**
 * Postens märke i en lista: länkens omslag och källa, annars typens ikon på sin platta.
 * @param {{ post: import("../lib/bibliotek.js").Bibliotekspost }} props
 */
function RadMark({ post }) {
  if (post.typ === "lank") return <LankMark post={post} />;
  return (
    <span aria-hidden="true" className={cx("flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full", plattKlass(post))}>
      <TypIkon post={post} />
    </span>
  );
}

/**
 * En lista: posterna i ordning, med dra, upp-/nedpil, ta bort och Lägg till för den som får ändra den.
 *
 * ⛔ ALLA ID I LISTAN SYNS (`losLista`): en post som tagits bort, eller som aldrig fanns på platsen, står kvar som en rad med "Finns inte längre" och en knapp att ta bort raden. En tom lista säger att den är tom.
 *
 * @param {object} props
 * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} props.lista
 * @param {ReadonlyArray<import("../lib/bibliotek.js").Bibliotekspost & { id: string }>} props.poster Platsens poster, de enda en lista läses mot.
 * @param {boolean} props.kanAndra Personen får ändra listan (`farAndra`).
 * @param {(inmatning: { id: string, typ: "lista", rubrik: string, poster: string[] }) => void | boolean | Promise<void | boolean>} [props.onSpara]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => void} props.onOppnaPost
 */
export function ListaVisning({ lista, poster, kanAndra, onSpara, onOppnaPost }) {
  const [lokal, setLokal] = useState(/** @type {string[] | null} */ (null));
  const [fel, setFel] = useState("");
  const [lagger, setLagger] = useState(false);
  const [sok, setSok] = useState("");
  const [dragId, setDragId] = useState(/** @type {string | null} */ (null));
  const [malId, setMalId] = useState(/** @type {string | null} */ (null));
  const dras = useRef(/** @type {string | null} */ (null));
  const kedja = useRef(/** @type {Promise<void>} */ (Promise.resolve()));
  const levande = useRef(true);
  const fokusEfter = useRef(/** @type {string | null} */ (null));
  const listRef = useRef(/** @type {HTMLOListElement | null} */ (null));

  const fran = Array.isArray(lista.poster) ? lista.poster : [];
  const idn = lokal ?? fran;
  const nyckel = fran.join(",");
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);
  // Värdens version av listan har kommit: den vinner över den optimistiska ordningen.
  useEffect(() => {
    setLokal(null);
  }, [nyckel]);
  useEffect(() => {
    const id = fokusEfter.current;
    if (!id) return;
    fokusEfter.current = null;
    const grepp = Array.from(listRef.current?.querySelectorAll("[data-lista-grepp]") ?? []).find((n) => n.getAttribute("data-lista-grepp") === id);
    if (grepp instanceof HTMLElement) grepp.focus();
  });

  const rader = losLista({ poster: idn }, poster);

  /**
   * Skriver en ny ordning eller ett nytt innehåll. Ritas om direkt; faller skrivningen rullas listan tillbaka och felet står kvar.
   * @param {string[]} nasta
   */
  function spara(nasta) {
    setFel("");
    setLokal(nasta);
    const jobb = kedja.current.then(async () => {
      try {
        await sparaOchVanta(onSpara, { id: lista.id, typ: "lista", rubrik: lista.rubrik, poster: nasta }, "Listan kunde inte sparas.");
      } catch (e) {
        if (levande.current) {
          setLokal(null);
          setFel(felText(e));
        }
      }
    });
    kedja.current = jobb;
    return jobb;
  }

  /** @param {string} id @param {number} steg */
  function flytta(id, steg) {
    const nasta = flyttaId(idn, id, steg);
    if (nasta.join(",") === idn.join(",")) return;
    fokusEfter.current = id;
    void spara(nasta);
  }

  /** @param {EventTarget | null} nod */
  const radUr = (nod) => (nod instanceof Element ? nod.closest("[data-lista-rad]")?.getAttribute("data-lista-rad") ?? null : null);
  /**
   * Raden under pekaren. Med pekarfångst är händelsens mål listan, och då är punkten under fingret sanningen; utan (och i jsdom) är det målet.
   * @param {{ clientX: number, clientY: number, target: EventTarget | null }} e
   */
  const radUnder = (e) => {
    const viaPunkt = typeof document.elementFromPoint === "function" ? radUr(document.elementFromPoint(e.clientX, e.clientY)) : null;
    return viaPunkt ?? radUr(e.target);
  };
  const slutaDra = () => {
    dras.current = null;
    setDragId(null);
    setMalId(null);
  };

  const kandidater = kandidaterForLista({ poster: idn }, poster);
  const sokta = filtreraBibliotek(kandidater, { sok });

  return (
    <div data-bibliotek-lista="" data-bibliotek-listvy="" className="flex min-w-0 flex-col gap-3">
      {kanAndra ? (
        <div className="flex flex-wrap items-center gap-2">
          <OpsButton variant="secondary" size="sm" onClick={() => { setSok(""); setLagger(true); }} disabled={idn.length >= MAX_LISTPOSTER}>
            <Plus size={16} aria-hidden="true" />
            Lägg till
          </OpsButton>
          {idn.length >= MAX_LISTPOSTER ? <span className="text-meta text-ink-muted">Listan är full: högst {MAX_LISTPOSTER} poster.</span> : null}
        </div>
      ) : null}
      {fel ? <p role="alert" data-bibliotek-lista-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{fel}</p> : null}
      {rader.length === 0 ? (
        <p data-bibliotek-lista-tom="" className="m-0 text-brod text-ink-secondary">
          Listan är tom.{kanAndra ? " Lägg till poster med knappen ovan, eller ur menyn på en post." : ""}
        </p>
      ) : (
        <ol
          ref={listRef}
          aria-label={`Posterna i ${trimSomRegeln(lista.rubrik) || "listan"}`}
          data-bibliotek-lista-rader=""
          className="m-0 flex list-none flex-col gap-2 p-0"
          onPointerDown={(e) => {
            if (!kanAndra || (e.button ?? 0) !== 0) return;
            const grepp = e.target instanceof Element ? e.target.closest("[data-lista-grepp]") : null;
            const id = grepp?.getAttribute("data-lista-grepp");
            if (!id) return;
            dras.current = id;
            setDragId(id);
            setMalId(null);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // jsdom har ingen aktiv pekare. Proven skickar händelserna direkt till raderna.
            }
          }}
          onPointerMove={(e) => {
            if (!dras.current) return;
            const id = radUnder(e);
            setMalId(id && id !== dras.current ? id : null);
          }}
          onPointerUp={(e) => {
            const franId = dras.current;
            const tillId = radUnder(e) ?? malId;
            slutaDra();
            if (!franId || !tillId || franId === tillId) return;
            const nasta = flyttaFore(idn, franId, tillId);
            if (nasta.join(",") === idn.join(",")) return;
            fokusEfter.current = franId;
            void spara(nasta);
          }}
          onPointerCancel={slutaDra}
        >
          {rader.map((r, i) => {
            const namn = r.post ? postNamn(r.post) : r.skal === "lista" ? "En lista" : "Finns inte längre";
            return (
              <li
                key={r.id}
                data-lista-rad={r.id}
                data-lista-saknas={r.post ? undefined : r.skal}
                data-lista-drar={dragId === r.id ? "" : undefined}
                data-lista-mal={malId === r.id ? "" : undefined}
                className={cx("flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface p-2", dragId === r.id && "opacity-60", malId === r.id && "bg-accent-subtle")}
              >
                {kanAndra ? (
                  <button
                    type="button"
                    data-lista-grepp={r.id}
                    aria-label={`Flytta ${namn}, plats ${i + 1} av ${rader.length}. Upp- och nedpil ändrar ordningen.`}
                    aria-keyshortcuts="ArrowUp ArrowDown"
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        flytta(r.id, -1);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        flytta(r.id, 1);
                      }
                    }}
                    className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border-0 bg-transparent text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </button>
                ) : null}
                {r.post ? <Raden post={r.post} namn={namn} onOppnaPost={onOppnaPost} /> : (
                  <span data-lista-saknas-text="" className="min-w-0 flex-1 text-brod text-ink-muted wrap-anywhere">
                    {r.skal === "lista" ? "Listor kan inte ligga i en lista." : "Finns inte längre"}
                  </span>
                )}
                {kanAndra ? (
                  <button
                    type="button"
                    data-lista-bort={r.id}
                    aria-label={r.post ? `Ta bort ${namn} ur listan` : r.skal === "lista" ? "Ta bort raden ur listan" : "Ta bort raden som inte finns längre ur listan"}
                    onClick={() => void spara(taBortPost(idn, r.id))}
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <OpsModal
        open={lagger}
        onOpenChange={setLagger}
        title="Lägg till i listan"
        size="sm"
        footer={<OpsButton variant="primary" onClick={() => setLagger(false)}>Klar</OpsButton>}
      >
        <div data-bibliotek-lista-lagg="" className="flex min-w-0 flex-col gap-3">
          <OpsInput value={sok} onChange={setSok} type="search" ariaLabel="Sök bland posterna" placeholder="Sök..." />
          {kandidater.length === 0 ? (
            <p data-bibliotek-lista-inget="" className="m-0 text-brod text-ink-secondary">Det finns inget mer att lägga till. Alla poster på den här platsen ligger redan i listan.</p>
          ) : sokta.length === 0 ? (
            <p className="m-0 text-brod text-ink-secondary">Inget matchar &quot;{sok}&quot;.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {sokta.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-2" data-lista-kandidat={p.id}>
                  <RadMark post={p} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-brod text-ink">{postNamn(p)}</span>
                    <span className="text-meta tracking-wide text-ink-muted uppercase">{typEtikett(p)}</span>
                  </span>
                  <OpsButton
                    variant="secondary"
                    size="sm"
                    ariaLabel={`Lägg till ${postNamn(p)}`}
                    onClick={() => {
                      try {
                        const { poster: nasta, andrad } = laggTillPost(idn, p.id);
                        if (andrad) void spara(nasta);
                      } catch (e) {
                        setFel(felText(e));
                      }
                    }}
                  >
                    Lägg till
                  </OpsButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </OpsModal>
    </div>
  );
}

/**
 * Innehållet i en rad som finns: märke, namn och typ. En musiklänk är en länk som öppnar låten direkt, allt annat öppnar posten.
 *
 * @param {{ post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, namn: string, onOppnaPost: (post: any) => void }} props
 */
function Raden({ post, namn, onOppnaPost }) {
  const innehall = (
    <>
      <RadMark post={post} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-brod font-medium text-ink">{namn}</span>
        <span data-bibliotek-typ="" className="text-meta tracking-wide text-ink-muted uppercase">{typEtikett(post)}</span>
      </span>
    </>
  );
  const klass = "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent p-0 text-left no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  if (oppnasDirekt(post)) {
    return (
      <a href={post.url} target="_blank" rel="noopener noreferrer" data-lista-oppna="lank" aria-label={`Öppna ${namn}`} className={klass}>
        {innehall}
      </a>
    );
  }
  return (
    <button type="button" data-lista-oppna="post" aria-label={`Öppna ${namn}`} onClick={() => onOppnaPost(post)} className={klass}>
      {innehall}
    </button>
  );
}

/**
 * "Lägg i lista" ur en posts meny: välj en av listorna personen får ändra, eller gör en ny med posten i.
 *
 * ⛔ SVARET SYNS. Lyckat ger en rad ("Lagd i …", "Ligger redan i …", "Listan … är gjord"), misslyckat står orsaken kvar i rutan och ingenting är hälften gjort. Ligger posten redan i listan skrivs inget.
 *
 * @param {object} props
 * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} props.post Posten som ska läggas i en lista.
 * @param {ReadonlyArray<import("../lib/bibliotek.js").Bibliotekspost & { id: string }>} props.listor Listorna personen får ändra (`listorAttLaggaI`).
 * @param {(inmatning: Record<string, unknown>) => void | boolean | Promise<void | boolean>} [props.onSpara]
 * @param {(text: string) => void} props.onKlar
 */
export function LaggILista({ post, listor, onSpara, onKlar }) {
  const [namn, setNamn] = useState("");
  const [pagar, setPagar] = useState(false);
  const [fel, setFel] = useState("");
  const upptagen = useRef(false);
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  /**
   * @param {Record<string, unknown>} inmatning
   * @param {string} klartext
   */
  async function kor(inmatning, klartext) {
    if (upptagen.current) return;
    upptagen.current = true;
    setFel("");
    setPagar(true);
    try {
      await sparaOchVanta(onSpara, inmatning, "Listan kunde inte sparas.");
      if (levande.current) onKlar(klartext);
    } catch (e) {
      if (levande.current) setFel(felText(e));
    } finally {
      upptagen.current = false;
      if (levande.current) setPagar(false);
    }
  }

  /** @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} lista */
  function laggI(lista) {
    let svar;
    try {
      svar = laggTillPost(Array.isArray(lista.poster) ? lista.poster : [], post.id);
    } catch (e) {
      setFel(felText(e));
      return;
    }
    if (!svar.andrad) {
      onKlar(`${postNamn(post)} ligger redan i listan ${lista.rubrik}.`);
      return;
    }
    void kor({ id: lista.id, typ: "lista", rubrik: lista.rubrik, poster: svar.poster }, `${postNamn(post)} är lagd i listan ${lista.rubrik}.`);
  }

  function skapaNy() {
    const rubrik = trimSomRegeln(namn);
    const inm = { typ: "lista", rubrik, poster: [post.id] };
    const f = inmatningsfel(inm);
    if (f) {
      setFel(f);
      return;
    }
    void kor(inm, `Listan ${rubrik} är gjord, med ${postNamn(post)} i.`);
  }

  return (
    <div data-bibliotek-laggilista="" className="flex min-w-0 flex-col gap-4">
      <p className="m-0 text-brod text-ink-secondary">Välj en lista för {postNamn(post)}, eller gör en ny.</p>
      {listor.length === 0 ? (
        <p data-bibliotek-laggilista-inga="" className="m-0 text-etikett text-ink-muted">Det finns inga listor du kan lägga till i än.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {listor.map((l) => (
            <li key={l.id}>
              <OpsButton variant="secondary" disabled={pagar} ariaLabel={`Lägg i ${l.rubrik}`} onClick={() => laggI(l)}>
                {l.rubrik}
                {" · "}
                {(l.poster?.length ?? 0) === 1 ? "1 post" : `${l.poster?.length ?? 0} poster`}
              </OpsButton>
            </li>
          ))}
        </ul>
      )}
      <OpsField label="Ny lista" error={fel || undefined}>
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <OpsInput value={namn} onChange={setNamn} maxLength={MAX_BIBLIOTEKRUBRIK} tal={false} placeholder="Namn på listan" />
          </div>
          <OpsButton variant="primary" busy={pagar} onClick={skapaNy}>Skapa lista</OpsButton>
        </div>
      </OpsField>
    </div>
  );
}
