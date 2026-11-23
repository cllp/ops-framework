import { Suspense, lazy, useMemo, useState } from "react";
import { kortDatum } from "../lib/deladdatum.js";
import { DATUM_EJ_SATT } from "../lib/handelsemodell.js";
import { lasGastKalenderlage, skrivGastKalenderlage } from "../lib/gastminne.js";
import { GASTKALENDERLAGEN, gastPost, gastkalenderUrval, typVisning, typerIFiltret, typNamn } from "../lib/gastkalender.js";
import { slagPrick, slagText } from "../lib/slag.js";
import { cx } from "../lib/cx.js";
import { LatGrans } from "./LatGrans.jsx";
import { OpsChip } from "./OpsChip.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsVantar } from "./OpsVantar.jsx";

/*
 * ⛔ MÅNAD OCH VECKA HÄMTAS FÖRST NÄR DE VÄLJS (0.257.0). `OpsCalendar` är ramverkets största vy, och en gäst som läser listan eller bara chattar ska inte ladda den. Se `OpsGastKalenderRutnat`.
 */
const Rutnat = lazy(() => import("./OpsGastKalenderRutnat.jsx").then((m) => ({ default: m.OpsGastKalenderRutnat })));

/** Brytpunkten där Månad är förvald (beslutet 18 nov: "Lista är förvald i mobil, Månad på dator"). Samma `md` som gästsidans bottenrad. */
const BRED_SKARM = "(min-width: 48rem)";

/**
 * Är skärmen bred nog för Månad som förval? `false` där webbläsaren inte kan svara (jsdom utan `matchMedia`): Lista är då förvald, eftersom listan är den som alltid går att läsa.
 * @returns {boolean}
 */
const arBredSkarm = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(BRED_SKARM).matches;

/** @param {{ tid?: string | null, slutTid?: string | null }} h @param {string} till */
const tidText = (h, till) => (h.tid ? (h.slutTid ? `${h.tid} ${till} ${h.slutTid}` : h.tid) : undefined);

/**
 * När, på en rad: "lör 7 nov 2026 · 18:00 till 20:00", till slutdatum när den är flera dagar, och "Datum ej satt" utan datum.
 * @param {Record<string, any>} h @param {string} sprak @returns {string}
 */
export function nartext(h, sprak) {
  if (!h.datum) return DATUM_EJ_SATT[sprak === "en" ? "en" : "sv"];
  const till = sprak === "en" ? "to" : "till";
  const dagar = h.slutDatum && h.slutDatum !== h.datum ? `${kortDatum(h.datum, sprak)} ${till} ${kortDatum(h.slutDatum, sprak)}` : kortDatum(h.datum, sprak);
  const tid = h.heldag ? "" : tidText(h, till);
  return tid ? `${dagar} · ${tid}` : dagar;
}

/**
 * Typens märke före titeln: ikonen i typens färg, en prick i typens färg när ikonen saknas, och en neutral prick när händelsen saknar typ. ⛔ ETT MÄRKE OCH INTE ORDET: ordet står i raden
 * under titeln (`nartext` och typen), eftersom en färg och en bild inte går att läsa upp (`lib/slag.js`).
 * @param {{ typ: ReturnType<typeof typVisning>, ritaTypIkon?: (namn: string) => import("react").ReactNode }} props
 */
function Typmarke({ typ, ritaTypIkon }) {
  const ikon = typ && typ.ikon && ritaTypIkon ? ritaTypIkon(typ.ikon) : null;
  if (ikon) {
    return (
      <span aria-hidden="true" data-gast-typmarke="ikon" className={cx("flex size-5 shrink-0 items-center justify-center", (typ && slagText(typ.slag, typ.ord, "OpsGastKalender")) || "text-ink-secondary")}>
        {ikon}
      </span>
    );
  }
  return (
    <span aria-hidden="true" data-gast-typmarke={typ ? "prick" : "neutral"} className="flex size-5 shrink-0 items-center justify-center">
      <span className={cx("size-2 rounded-full", (typ && slagPrick(typ.slag, typ.ord, "OpsGastKalender")) || "bg-ink-muted")} />
    </span>
  );
}

/**
 * Gästens kalenderflik: Lista, Månad och Vecka, filtret på händelsetyp och Visa passerade (0.257.0, cllp/lifehub.app#890, CP:s beslut 18 nov).
 *
 * ══ ⛔ BESLUTET OCH VAD SOM GÖRS AV DET ══════════════════════════════════════════════════════════════════════════════
 *
 * 0.190.0 strök månaden för gäster ("Skall bara kunna läsa va och således bara en kalendervy som är lista eller?"). 18 nov godkände CP en riktig kalender i gästvyn, generellt för alla grupper,
 * med Travel-gruppen som första användare: växling Lista, Månad och Vecka (Lista förvald i mobil, Månad på dator, senaste valet sparas), filter som chips per händelsetyp med ikon och färg plus
 * Visa passerade (av som standard), typens ikon och färg i både lista och kalender med en gemensam rendering och en neutral stil utan typ, och oförändrade behörigheter.
 *
 * - ⛔ MÅNAD OCH VECKA ÄR RAMVERKETS `OpsCalendar` (beslutet: "Återanvänd ramverkets kalendervy. Bygg ingen ny."). Veckan är ett läge i samma kalender (`lage="vecka"`), inte en vy här.
 * - ⛔ EN GEMENSAM RENDERING: typens ord, färg och ikon räknas en gång (`typVisning`), och samma svar blir märket i listan och slaget och ikonen på posten i kalendern.
 * - ⛔ FILTRET OCH VISA PASSERADE GÄLLER ALLA TRE LÄGENA (`gastkalenderUrval`). Ett byte av läge visar samma händelser i en annan form.
 * - ⛔ HÄNDELSER UTAN DATUM STÅR ÖVERST I ALLA LÄGEN. En omröstning om dagen har ingen ruta i ett rutnät, och det är just den gästen ska svara på.
 * - ⛔ BARA TYPER SOM FINNS BLAND HÄNDELSERNA ÄR CHIPS, och inga chips alls när ingen händelse har en typ: ett filter utan något att välja är en rad att läsa förbi.
 *
 * @param {object} props
 * @param {{ handelser: Array<{ id: string } & Record<string, any>>, typer?: import("../lib/gastkalender.js").Gasthandelsetyp[], avkortad?: boolean, ejVisade?: number }} props.kalender Tjänstens `kalender`-svar.
 * @param {string} props.sprak
 * @param {Record<string, string>} props.t Gästvyns ord (`ORD_OPSGASTGRUPP`).
 * @param {string} props.idag `YYYY-MM-DD`.
 * @param {Date} [props.idagDatum] Bara för prov: kalenderns idag.
 * @param {(id: string) => void} props.onOppna Öppnar händelsens panel.
 * @param {(namn: string) => import("react").ReactNode} [props.ritaTypIkon] Appens ikon för ett ikonnamn. Utan den ritas typens färg som en prick.
 * @param {{ las: (k: string) => string | null, skriv: (k: string, v: string) => void } | null} [props.minne] Gästsidans minne, för senaste läget.
 */
export function OpsGastKalender({ kalender, sprak, t, idag, idagDatum, onOppna, ritaTypIkon, minne }) {
  const [lage, setLage] = useState(() => /** @type {(typeof GASTKALENDERLAGEN)[number]} */ (lasGastKalenderlage(minne) ?? (arBredSkarm() ? "manad" : "lista")));
  const [valdaTyper, setValdaTyper] = useState(/** @type {string[]} */ ([]));
  const [visaPasserade, setVisaPasserade] = useState(false);

  const allaTyper = kalender.typer ?? [];
  const typkarta = useMemo(() => new Map(allaTyper.map((x) => [x.id, x])), [allaTyper]);
  const filtertyper = useMemo(() => typerIFiltret(allaTyper, kalender.handelser), [allaTyper, kalender.handelser]);
  // En vald typ som inte längre finns bland händelserna (efter en ny hämtning) väljs inte längre: annars hade filtret visat noll händelser med ett val ingen kan se.
  const giltigaVal = useMemo(() => valdaTyper.filter((id) => filtertyper.some((x) => x.id === id)), [valdaTyper, filtertyper]);
  const urval = useMemo(() => gastkalenderUrval(kalender.handelser, { idag, visaPasserade, valdaTyper: giltigaVal }), [kalender.handelser, idag, visaPasserade, giltigaVal]);
  const utanDatum = urval.filter((h) => !h.datum);
  const visning = (/** @type {Record<string, any>} */ h) => typVisning(h.typ, typkarta, sprak);
  /** Raden under titeln: när, och typens ord. @param {Record<string, any>} h */
  const underrad = (h) => {
    const typ = visning(h);
    return typ ? `${typ.ord} · ${nartext(h, sprak)}` : nartext(h, sprak);
  };
  const poster = useMemo(
    () =>
      urval
        .filter((h) => h.datum)
        .map((h) => {
          const typ = visning(h);
          const ikon = typ && typ.ikon && ritaTypIkon ? ritaTypIkon(typ.ikon) : null;
          return { ...gastPost(/** @type {any} */ (h), typ, underrad(h)), ...(ikon ? { kindIcon: ikon } : {}) };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urval, typkarta, sprak, ritaTypIkon],
  );

  /** @param {string} v */
  const bytLage = (v) => {
    setLage(/** @type {(typeof GASTKALENDERLAGEN)[number]} */ (v));
    skrivGastKalenderlage(minne, v);
  };
  /** @param {string} id */
  const vaxlaTyp = (id) => setValdaTyper((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  /** @param {ReadonlyArray<Record<string, any>>} lista @param {string} etikett */
  const rader = (lista, etikett) => (
    <OpsList ariaLabel={etikett}>
      {lista.map((h) => (
        <OpsListRow key={h.id} interactive onClick={() => onOppna(h.id)} ariaLabel={h.titel}>
          <span data-gast-pagang={h.id} data-ejsatt={h.datum ? undefined : ""} data-gast-typ={h.typ ?? undefined} className="flex min-w-0 flex-1 items-start gap-2">
            <Typmarke typ={visning(h)} ritaTypIkon={ritaTypIkon} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-etikett font-medium text-ink wrap-anywhere">{h.titel}</span>
              <span data-gast-nar="" className="text-meta text-ink-secondary">{underrad(h)}</span>
            </span>
          </span>
        </OpsListRow>
      ))}
    </OpsList>
  );

  const filtrerat = giltigaVal.length > 0 || visaPasserade;
  const tomText = filtrerat ? t.kalenderIngetFilter : t.ingetPaGang;
  return (
    <div data-gast-kalender="" data-gast-kalender-lage={lage} className="flex min-w-0 flex-col gap-3">
      <div data-gast-kalender-verktyg="" className="flex min-w-0 flex-col gap-2">
        <OpsSegmented
          ariaLabel={t.kalenderLageEtikett}
          value={lage}
          onChange={bytLage}
          options={[
            { value: "lista", label: t.kalenderLista },
            { value: "manad", label: t.kalenderManad },
            { value: "vecka", label: t.kalenderVecka },
          ]}
        />
        <div role="group" aria-label={t.kalenderFilterEtikett} data-gast-kalender-filter="" className="flex flex-wrap gap-2">
          {filtertyper.map((x) => {
            const typ = typVisning(x.id, typkarta, sprak);
            const ikon = x.ikon && ritaTypIkon ? ritaTypIkon(x.ikon) : null;
            return (
              <OpsChip
                key={x.id}
                selected={giltigaVal.includes(x.id)}
                onClick={() => vaxlaTyp(x.id)}
                icon={
                  ikon ? (
                    <span data-gast-chip-typ={x.id} className={cx("flex", (typ && slagText(typ.slag, typ.ord, "OpsGastKalender")) || "text-ink-secondary")}>{ikon}</span>
                  ) : (
                    <span data-gast-chip-typ={x.id} className={cx("size-2 rounded-full", (typ && slagPrick(typ.slag, typ.ord, "OpsGastKalender")) || "bg-ink-muted")} />
                  )
                }
              >
                {typNamn(x, sprak)}
              </OpsChip>
            );
          })}
          <OpsChip selected={visaPasserade} onClick={() => setVisaPasserade((v) => !v)}>
            {t.kalenderVisaPasserade}
          </OpsChip>
        </div>
      </div>

      {lage === "lista" ? (
        urval.length === 0 ? (
          // ⛔ TOMT ÄR EN TYST RAD (0.190.0, QA fynd 9): inte en stor ruta som tar lika mycket plats som innehållet hade gjort.
          <p role="status" data-gast-kalender-tom="" className="m-0 text-etikett text-ink-muted">{tomText}</p>
        ) : (
          rader(urval, t.paGangEtikett)
        )
      ) : (
        <>
          {utanDatum.length > 0 ? <div data-gast-kalender-utandatum="">{rader(utanDatum, DATUM_EJ_SATT[sprak === "en" ? "en" : "sv"])}</div> : null}
          <LatGrans fel={<p role="alert" data-gast-kalender-lasfel="" className="m-0 text-etikett text-danger">{t.kalenderLasfel}</p>}>
            <Suspense fallback={<div data-gast-kalender-hamtar=""><OpsVantar text={t.laddar} /></div>}>
              <Rutnat poster={poster} lage={lage} onOppna={onOppna} ariaLabel={t.kalenderEtikett} sprak={sprak} idag={idagDatum} />
            </Suspense>
          </LatGrans>
        </>
      )}
      {kalender.avkortad ? <p role="status" data-gast-kalender-avkortad="" className="m-0 text-meta text-ink-muted">{t.kalenderAvkortad.replace("{n}", String(kalender.handelser.length))}</p> : null}
      {(kalender.ejVisade ?? 0) > 0 ? <p role="status" data-gast-kalender-ejvisade="" className="m-0 text-meta text-ink-muted">{t.kalenderEjVisade.replace("{n}", String(kalender.ejVisade))}</p> : null}
    </div>
  );
}
