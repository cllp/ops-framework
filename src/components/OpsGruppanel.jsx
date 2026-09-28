import { useState } from "react";
import { cx } from "../lib/cx.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCountBadge } from "./counter.jsx";
import { OpsPanel } from "./OpsPanel.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { ChevronVansterIkon, ChevronHogerIkon, PersonIkon, PlusIkon } from "./icons.jsx";
import { ALLA_GRUPPER } from "../lib/grupplage.js";
import { text } from "../lib/sprak.js";

/**
 * Grupp-panelen: SessionStudios arbetsytor, mätt in (#161).
 *
 * ══ ⛔ VARFÖR EN NY KOMPONENT OCH INTE `OpsGruppvaljare` ═════════════════
 *
 * CP 2026-09-28, med en skärmbild av SessionStudios `AppSidebar.jsx`:
 * "OCH GRUPPVÄLJARE? Var finns det?" Två uppföljande bilder (utfälld och
 * infälld) visar mer än en lista: ett kort per grupp med märke, en klase
 * SMÅ ÅTGÄRDSIKONER (glob, info, penna), namn, medlemsantal, en rad med
 * VALFRIA KNAPPAR (bibliotek med räknare, chatt), en avatarstapel, och en
 * kollapsbar remsa där bara märkena syns.
 *
 * `OpsGruppvaljare` (#139) löser en annan fråga: raden i en meny, mellan
 * "alla mina grupper" och en enskild. Den bär varken medlemsantal, åtgärder
 * eller avatarer, och den kollapsar inte. Ett tredje och fjärde fält på den
 * komponenten för ett ANNAT användningsfall (menyraden i #139 kontra
 * sidopanelen i #161) hade gjort en komponent till två i en trenchcoat.
 * `OpsGruppanel` är därför en egen, bredare yta: den ÅTERANVÄNDER
 * `OpsIdentity` och samma `ALLA_GRUPPER`-läge, men bygger sin egen rad.
 *
 * ══ ⛔ ÅTGÄRDER, KNAPPAR OCH AVATARER ÄR APPENS, RAMVERKET GISSAR INGET ═══
 *
 * De tre glob/info/penna-ikonerna i CP:s bild betyder "publik sida", "info"
 * och "redigera". Bibliotek- och chattknapparna öppnar APPENS egna vyer.
 * Ramverket känner inte till någon av dem: `atgarder` och `knappar` är listor
 * appen skickar in per grupp (ikon, etikett, `onClick`, en valfri räknare på
 * `knappar`), precis som `OpsPanelRow`s `action` eller `OpsCard`s `edge`.
 * Utan dem ritas ingen rad, av samma skäl som `OpsUtanMedlemskap.onSkapaGrupp`:
 * en knapp som inte gör något är en knapp som ser ut att göra det.
 *
 * ══ ⛔ EN LISTA, INTE EN POPOVER, AV SAMMA SKÄL SOM `OpsGruppvaljare` ═════
 *
 * Se den filens filhuvud: en popover går inte att driva med `fireEvent` i
 * jsdom. Panelen här är en kolonn med riktiga knappar, alltid framme från
 * 1024 px och uppåt.
 *
 * ══ ⛔ INGEN NÄSTLAD <button>. VARJE KORT ÄR TVÅ KNAPPAR, INTE EN ═════════
 *
 * Kortet har både ett VAL (tryck på namnet/märket väljer gruppen) och egna
 * åtgärder (glob, info, penna, bibliotek, chatt). HTML tillåter inte en
 * `<button>` inuti en annan, och husets linje är RIKTIGA kontroller, aldrig
 * en `<div role="button">` som låtsas vara en (se `OpsRadioGroup`s filhuvud).
 * Lösningen är att valknappen (märke, namn, medlemsantal) och åtgärdsknapparna
 * är SYSKON i samma `<li>`, aldrig förälder och barn.
 *
 * ══ ⛔ UNDER 1024 PX: EN KNAPP OCH ETT ARK, INTE EN KOLUMN ═══════════════
 *
 * `OpsGruppvaxlare` (samma fil, delar sina rader med `OpsGruppanel` via
 * `GruppanelRader` nedan) ritar den aktiva gruppens märke och namn som en
 * knapp i headern. Ett tryck öppnar samma lista i `OpsPanel`, ramverkets
 * ark/rullgardin, i en enklare form (utan åtgärder/knappar/avatarer: se
 * noten på `GruppanelRader` för varför).
 *
 * ⛔ OCH DET ÄR EN MEDVETEN AVVIKELSE FRÅN "ALLTID ETT ARK UNDER 1024 PX".
 * `OpsPanel` byter yta vid Tailwinds `md` (768 px, se den filens `SMAL`),
 * inte vid 1024. Mellan 768 och 1024 blir växlaren alltså en rullgardin, inte
 * en bottensheet. Att duplicera `OpsPanel`s brytpunktsmaskin (matchMedia,
 * lyssnare, Safari-reserv) för EN till konsument hade brutit mot att panelen
 * redan är den ytan appens meny och notiser delar: två sätt att avgöra "är
 * skärmen smal" i samma app är den sortens glidning arbetsreglernas punkt 2
 * varnar för. `OpsPanel` ÄR arket, och `OpsGruppvaxlare` använder det som det
 * är, med brytpunkten det redan har.
 *
 * ══ ⛔ KOLLAPS ÄGS AV APPEN, PRECIS SOM VALET ═════════════════════════════
 *
 * CP 2026-09-28, om logotypen: "Skalet äger alltså både panelens läge och
 * brandens form; koppla dem i OpsAppShell." `infalld`/`onInfalld` är därför
 * STYRDA precis som `aktiv`/`onValj`, inte ett internt `useState` här. Utan
 * dem (fristående bruk av `OpsGruppanel` utanför skalet) sköter komponenten
 * det själv, samma mönster som `OpsPanel`s styrda/ostyrda `open`.
 */

/**
 * @typedef {object} GruppanelKnapp En liten ikonknapp (glob, info, penna,
 *   bibliotek, chatt). Ramverket vet inte vad den gör, bara hur den ser ut.
 * @property {import("react").ReactNode} icon
 * @property {string} label Skärmläsarnamnet.
 * @property {number} [badge] Räknare i knappens hörn (`OpsCountBadge`). Utelämnad: ingen.
 * @property {() => void} onClick
 */

/**
 * @typedef {object} GruppanelAvatar
 * @property {string} id Stabilt id, `OpsIdentity seed`.
 * @property {string} namn
 * @property {string} [bild]
 */

/**
 * @typedef {object} GruppanelGrupp
 * @property {string} id
 * @property {import("../lib/sprak.js").Namn} namn
 * @property {string} [bild] Gruppens egen bild till märket. Utelämnad: ikon eller initialer (`OpsIdentity`).
 * @property {number} [medlemsantal] Utelämnad: ingen siffra ritas, aldrig "0" som gissning.
 * @property {"agare"|"medlem"} [roll] Utelämnad: ingen rollpill.
 * @property {ReadonlyArray<GruppanelKnapp>} [atgarder] Uppe till höger på kortet (glob/info/penna i CP:s bild). Utelämnad: inga.
 * @property {ReadonlyArray<GruppanelKnapp>} [knappar] Under medlemsantalet (bibliotek/chatt i CP:s bild). Utelämnad: inga.
 * @property {ReadonlyArray<GruppanelAvatar>} [avatarer] Längst ner på kortet, max fyra, sedan "+N". Utelämnad: ingen rad.
 */

/** Hur många avatarer som ritas innan resten blir en "+N". Mätt ur CP:s bild: fyra plus en rad. */
const MAX_AVATARER = 4;

/**
 * Raderna i FULL FORM (kort, åtgärder, knappar, avatarer), bara för panelen.
 * `OpsGruppvaxlare`s ark använder `EnkelGruppanelRader` nedan i stället, se
 * den funktionens filhuvud för skälet.
 *
 * @param {object} props
 * @param {ReadonlyArray<GruppanelGrupp>} props.grupper
 * @param {string} props.aktiv
 * @param {(id: string) => void} props.onValj
 * @param {string} [props.sprak]
 * @param {string} props.allaEtikett
 * @param {string} [props.tomText]
 * @param {Record<string, string>} props.rollNamn
 * @param {string} props.medlemmarEtikett
 * @param {string} props.flerAvatarerEtikett Följt av antalet, t.ex. "+4 fler".
 */
function GruppanelRader({ grupper, aktiv, onValj, sprak, allaEtikett, tomText, rollNamn, medlemmarEtikett, flerAvatarerEtikett }) {
  const mina = grupper ?? [];

  return (
    <ul className="flex flex-col gap-3" aria-label={allaEtikett}>
      <li>
        <button
          type="button"
          onClick={() => onValj(ALLA_GRUPPER)}
          aria-current={aktiv === ALLA_GRUPPER ? "true" : undefined}
          className={cx(
            "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold",
            "transition-colors duration-(--duration-fast) ease-standard",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            aktiv === ALLA_GRUPPER ? "border-accent bg-sunken text-ink" : "border-transparent text-ink-secondary hover:bg-sunken hover:text-ink",
          )}
        >
          <PersonIkon size={18} />
          {allaEtikett}
        </button>
      </li>

      {mina.length === 0 && tomText ? <li className="px-3 py-1 text-sm text-ink-secondary">{tomText}</li> : null}

      {mina.map((g) => {
        const namn = text(g.namn, sprak);
        const vald = g.id === aktiv;
        const avatarer = g.avatarer ?? [];
        const synligaAvatarer = avatarer.slice(0, MAX_AVATARER);
        const resten = avatarer.length - synligaAvatarer.length;

        return (
          <li
            key={g.id}
            className={cx(
              "flex flex-col gap-2 rounded-3xl border p-3",
              vald ? "border-accent bg-sunken" : "border-line bg-canvas",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} size="md" />
              {g.atgarder && g.atgarder.length > 0 ? (
                <div className="flex shrink-0 items-center gap-1">
                  {g.atgarder.map((a, i) => (
                    <button
                      // eslint-disable-next-line react/no-array-index-key -- ⛔ ÅTGÄRDER HAR INGET EGET ID. Appen skickar en lista ikoner, inte poster med nyckel; index räcker eftersom listan inte sorteras om under komponentens liv.
                      key={i}
                      type="button"
                      onClick={a.onClick}
                      aria-label={a.label}
                      title={a.label}
                      className="flex size-8 items-center justify-center rounded-md text-ink-secondary hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {a.icon}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onValj(g.id)}
              aria-current={vald ? "true" : undefined}
              aria-label={namn}
              className="flex flex-col gap-0.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="truncate text-sm font-semibold text-ink">{namn}</span>
              {typeof g.medlemsantal === "number" ? (
                <span className="flex items-center gap-1 text-xs text-ink-secondary">
                  <PersonIkon size={14} />
                  {g.medlemsantal}
                  <span className="sr-only"> {medlemmarEtikett}</span>
                </span>
              ) : null}
              {g.roll ? (
                <span className="mt-0.5">
                  <OpsPill tone={g.roll === "agare" ? "info" : "neutral"}>{rollNamn[g.roll] || g.roll}</OpsPill>
                </span>
              ) : null}
            </button>

            {g.knappar && g.knappar.length > 0 ? (
              <div className="flex items-center gap-2">
                {g.knappar.map((k, i) => (
                  <button
                    // eslint-disable-next-line react/no-array-index-key -- se noten vid atgarder ovan.
                    key={i}
                    type="button"
                    onClick={k.onClick}
                    aria-label={k.label}
                    title={k.label}
                    className="relative flex size-9 items-center justify-center rounded-full bg-sunken text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {k.icon}
                    {typeof k.badge === "number" ? <OpsCountBadge count={k.badge} text={k.label} placement="icon" /> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {avatarer.length > 0 ? (
              <div className="flex items-center -space-x-2">
                {synligaAvatarer.map((a) => (
                  <span key={a.id} className="ring-2 ring-canvas rounded-md">
                    <OpsIdentity name={a.namn} seed={a.id} imageUrl={a.bild || undefined} size="sm" />
                  </span>
                ))}
                {resten > 0 ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sunken text-xs font-semibold text-ink-secondary ring-2 ring-canvas">
                    +{resten}
                    <span className="sr-only"> {flerAvatarerEtikett}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Raderna i ENKEL FORM: namn, medlemsantal och rollpill, ingen åtgärd, ingen
 * knapp, ingen avatarstapel.
 *
 * ⛔ VARFÖR ARKET INTE ÅTERANVÄNDER `GruppanelRader` RAKT AV. Ett ark på en
 * telefon är för smalt för tre knappklasar per rad (märke, åtgärder, knappar,
 * avatarer): SessionStudios EGEN mobilväljare (`UnifiedGroupFilter`) är av
 * samma skäl bara en FORM, namn och räknare, aldrig hela kortet. Att tvinga
 * in samma kort i 280 px hade gett en rad ingen kan trycka rätt i med
 * tummen, precis den sortens fel #158/#159 redan flaggat i andra ark.
 *
 * @param {object} props
 * @param {ReadonlyArray<GruppanelGrupp>} props.grupper
 * @param {string} props.aktiv
 * @param {(id: string) => void} props.onValj
 * @param {() => void} [props.onValjOchStang]
 * @param {string} [props.sprak]
 * @param {string} props.allaEtikett
 * @param {string} [props.tomText]
 * @param {Record<string, string>} props.rollNamn
 */
function EnkelGruppanelRader({ grupper, aktiv, onValj, onValjOchStang, sprak, allaEtikett, tomText, rollNamn }) {
  const mina = grupper ?? [];
  const valj = (/** @type {string} */ id) => {
    onValj(id);
    onValjOchStang?.();
  };

  return (
    <ul className="flex flex-col gap-1.5" aria-label={allaEtikett}>
      <li>
        <button
          type="button"
          onClick={() => valj(ALLA_GRUPPER)}
          aria-current={aktiv === ALLA_GRUPPER ? "true" : undefined}
          className={cx(
            "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold",
            "transition-colors duration-(--duration-fast) ease-standard",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            aktiv === ALLA_GRUPPER ? "border-accent bg-sunken text-ink" : "border-transparent text-ink-secondary hover:bg-sunken hover:text-ink",
          )}
        >
          <PersonIkon size={18} />
          {allaEtikett}
        </button>
      </li>

      {mina.length === 0 && tomText ? <li className="px-3 py-1 text-sm text-ink-secondary">{tomText}</li> : null}

      {mina.map((g) => {
        const namn = text(g.namn, sprak);
        const vald = g.id === aktiv;
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => valj(g.id)}
              aria-current={vald ? "true" : undefined}
              aria-label={namn}
              className={cx(
                "flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left",
                "transition-colors duration-(--duration-fast) ease-standard",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                vald ? "border-accent bg-sunken" : "border-transparent hover:bg-sunken",
              )}
            >
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{namn}</span>
                {typeof g.medlemsantal === "number" ? (
                  <span className="block truncate text-xs text-ink-secondary">
                    {g.medlemsantal} {g.medlemsantal === 1 ? "medlem" : "medlemmar"}
                  </span>
                ) : null}
              </span>
              {g.roll ? <OpsPill tone={g.roll === "agare" ? "info" : "neutral"}>{rollNamn[g.roll] || g.roll}</OpsPill> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Den infällda remsan: bara märkena, i samma ordning. Ingen text.
 *
 * @param {object} props
 * @param {ReadonlyArray<GruppanelGrupp>} props.grupper
 * @param {string} props.aktiv
 * @param {(id: string) => void} props.onValj
 * @param {string} [props.sprak]
 * @param {string} props.allaEtikett
 */
function GruppanelRemsa({ grupper, aktiv, onValj, sprak, allaEtikett }) {
  return (
    <ul className="flex flex-col items-center gap-2" aria-label={allaEtikett}>
      <li>
        <button
          type="button"
          onClick={() => onValj(ALLA_GRUPPER)}
          aria-current={aktiv === ALLA_GRUPPER ? "true" : undefined}
          aria-label={allaEtikett}
          title={allaEtikett}
          className={cx(
            "flex size-10 items-center justify-center rounded-lg border",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            aktiv === ALLA_GRUPPER ? "border-accent bg-sunken text-ink" : "border-transparent text-ink-secondary hover:bg-sunken hover:text-ink",
          )}
        >
          <PersonIkon size={18} />
        </button>
      </li>
      {(grupper ?? []).map((g) => {
        const namn = text(g.namn, sprak);
        const vald = g.id === aktiv;
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onValj(g.id)}
              aria-current={vald ? "true" : undefined}
              aria-label={namn}
              title={namn}
              className={cx(
                "flex size-10 items-center justify-center rounded-lg border",
                "transition-colors duration-(--duration-fast) ease-standard",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                vald ? "border-accent" : "border-transparent hover:bg-sunken",
              )}
            >
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} size="md" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Grupp-panelen, från 1024 px och uppåt.
 *
 * @param {object} props
 * @param {ReadonlyArray<GruppanelGrupp>} props.grupper Mina, plus `medlemsantal`/`roll`/`atgarder`/`knappar`/`avatarer` när appen har dem. Ramverket räknar och känner till ingenting av det.
 * @param {string} props.aktiv `ALLA_GRUPPER` eller ett grupp-id.
 * @param {(id: string) => void} props.onValj
 * @param {() => void} [props.onSkapa] Utelämnad: ingen "Skapa grupp"-knapp.
 * @param {boolean} [props.infalld] Styrd. Utelämnad: panelen sköter läget själv.
 * @param {(infalld: boolean) => void} [props.onInfalld]
 * @param {string} [props.sprak]
 * @param {string} [props.allaEtikett]
 * @param {string} [props.skapaEtikett]
 * @param {string} [props.tomText]
 * @param {string} [props.kollapsaEtikett]
 * @param {string} [props.fallUtEtikett]
 * @param {Record<string, string>} [props.rollNamn]
 * @param {string} [props.medlemmarEtikett] Skärmläsarordet efter medlemsantalet.
 * @param {string} [props.flerAvatarerEtikett] Skärmläsartext efter "+N".
 */
export function OpsGruppanel({
  grupper,
  aktiv,
  onValj,
  onSkapa,
  infalld,
  onInfalld,
  sprak,
  allaEtikett = "Alla mina grupper",
  skapaEtikett = "Skapa grupp",
  tomText = "Du är inte medlem i någon grupp.",
  kollapsaEtikett = "Fäll ihop grupplistan",
  fallUtEtikett = "Fäll ut grupplistan",
  rollNamn = { agare: "Ägare", medlem: "Medlem" },
  medlemmarEtikett = "medlemmar",
  flerAvatarerEtikett = "fler",
}) {
  if (typeof onValj !== "function") {
    throw new Error("OpsGruppanel: onValj krävs. En panel som inte kan välja är en lista som ser ut som en kontroll.");
  }
  // ⛔ STYRD ELLER OSTYRD, SAMMA MÖNSTER SOM `OpsPanel`s `open`. Se filhuvudet:
  // i skalet är den ALLTID styrd (brandens form hänger på samma läge), men en
  // fristående `OpsGruppanel` ska ändå fungera utan att appen håller state.
  const styrd = typeof infalld === "boolean";
  const [egetInfalld, setEgetInfalld] = useState(false);
  const kollapsad = styrd ? infalld : egetInfalld;
  const vaxlaInfalld = () => {
    const nytt = !kollapsad;
    if (!styrd) setEgetInfalld(nytt);
    onInfalld?.(nytt);
  };

  return (
    <nav
      aria-label={allaEtikett}
      // ⛔ BREDDEN SITTER PÅ NAVEN, INTE PÅ SKALETS WRAPPER. `OpsAppShell`
      // monterar den här komponenten i en `hidden lg:block`-kolumn utan egen
      // bredd, av precis det här skälet: styr appen INTE `infalld`, kollapsar
      // `OpsGruppanel` sig själv (se filhuvudet), och då måste bredden följa
      // med HÄR. Låg bredden i skalets wrapper i stället hade krävt att den
      // OCKSÅ kände till `kollapsad`, alltså samma tillstånd på två ställen.
      className={cx("flex h-full flex-col gap-3 border-r border-line bg-surface p-3", kollapsad ? "w-[4.5rem]" : "w-64")}
    >
      <div className={cx("flex items-center", kollapsad ? "justify-center" : "justify-start")}>
        <button
          type="button"
          onClick={vaxlaInfalld}
          aria-label={kollapsad ? fallUtEtikett : kollapsaEtikett}
          className="flex size-8 items-center justify-center rounded-md text-ink-secondary hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {kollapsad ? <ChevronHogerIkon size={16} /> : <ChevronVansterIkon size={16} />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {kollapsad ? (
          <GruppanelRemsa grupper={grupper} aktiv={aktiv} onValj={onValj} sprak={sprak} allaEtikett={allaEtikett} />
        ) : (
          <GruppanelRader
            grupper={grupper}
            aktiv={aktiv}
            onValj={onValj}
            sprak={sprak}
            allaEtikett={allaEtikett}
            tomText={tomText}
            rollNamn={rollNamn}
            medlemmarEtikett={medlemmarEtikett}
            flerAvatarerEtikett={flerAvatarerEtikett}
          />
        )}
      </div>

      {onSkapa ? (
        <div className={kollapsad ? "flex justify-center" : undefined}>
          {kollapsad ? (
            <button
              type="button"
              onClick={onSkapa}
              aria-label={skapaEtikett}
              title={skapaEtikett}
              className="flex size-10 items-center justify-center rounded-lg border border-dashed border-line text-ink-secondary hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PlusIkon size={18} />
            </button>
          ) : (
            <OpsButton variant="secondary" onClick={onSkapa}>
              {skapaEtikett}
            </OpsButton>
          )}
        </div>
      ) : null}
    </nav>
  );
}

/**
 * Gruppväxlaren på smal skärm: knappen i headern plus ett ark med samma
 * grupper, i ENKEL FORM (se `EnkelGruppanelRader`s filhuvud).
 *
 * ⛔ SE `OpsGruppanel`s FILHUVUD om brytpunkten (`OpsPanel`s `md`, inte 1024)
 * och om varför det är en medveten avvikelse och inte en glömd detalj.
 *
 * @param {object} props
 * @param {ReadonlyArray<GruppanelGrupp>} props.grupper
 * @param {string} props.aktiv
 * @param {(id: string) => void} props.onValj
 * @param {() => void} [props.onSkapa]
 * @param {string} [props.sprak]
 * @param {string} [props.allaEtikett]
 * @param {string} [props.skapaEtikett]
 * @param {string} [props.tomText]
 * @param {Record<string, string>} [props.rollNamn]
 * @param {string} [props.etikett] Skärmläsarnamn på hela växlaren/arket.
 */
export function OpsGruppvaxlare({
  grupper,
  aktiv,
  onValj,
  onSkapa,
  sprak,
  allaEtikett = "Alla mina grupper",
  skapaEtikett = "Skapa grupp",
  tomText = "Du är inte medlem i någon grupp.",
  rollNamn = { agare: "Ägare", medlem: "Medlem" },
  etikett = "Byt grupp",
}) {
  if (typeof onValj !== "function") {
    throw new Error("OpsGruppvaxlare: onValj krävs. En växlare som inte kan välja är en lista som ser ut som en kontroll.");
  }
  const mina = grupper ?? [];
  const aktivRad = mina.find((g) => g.id === aktiv);
  const aktivtNamn = aktiv === ALLA_GRUPPER ? allaEtikett : aktivRad ? text(aktivRad.namn, sprak) : allaEtikett;
  const [oppet, setOppet] = useState(false);

  return (
    <OpsPanel
      label={etikett}
      open={oppet}
      onOpenChange={setOppet}
      align="start"
      trigger={
        // ⛔ EN RIKTIG <button>, INTE EN <span>. `OpsPanel`s `trigger` monteras
        // med Radix `asChild`, som SÄTTER a11y-attributen på elementet man ger
        // den men inte GÖR om det till en knapp: en `<span>` hade blivit en
        // klickbar yta utan knapp-roll, alltså osynlig för `getByRole("button")`
        // och för alla som navigerar med tangentbord via röstkommando "knapp".
        <button type="button" aria-label={etikett} className="flex min-h-11 max-w-40 items-center gap-2 rounded-md px-2 text-sm font-semibold text-ink hover:bg-sunken">
          {aktiv === ALLA_GRUPPER ? <PersonIkon size={18} /> : <OpsIdentity name={aktivtNamn} seed={aktiv} imageUrl={aktivRad?.bild || undefined} size="sm" />}
          <span className="min-w-0 truncate">{aktivtNamn}</span>
        </button>
      }
    >
      {() => (
        <>
          {onSkapa ? (
            <div className="mb-2">
              <OpsButton
                variant="secondary"
                onClick={() => {
                  setOppet(false);
                  onSkapa();
                }}
              >
                {skapaEtikett}
              </OpsButton>
            </div>
          ) : null}
          <EnkelGruppanelRader
            grupper={mina}
            aktiv={aktiv}
            onValj={onValj}
            onValjOchStang={() => setOppet(false)}
            sprak={sprak}
            allaEtikett={allaEtikett}
            tomText={tomText}
            rollNamn={rollNamn}
          />
        </>
      )}
    </OpsPanel>
  );
}
