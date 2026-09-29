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
 * Grupp-panelen: SessionStudios arbetsytor, MÄTTA ur källan (#161).
 *
 * ══ ⛔ RÄTTAD 2026-09-28. FÖRSTA VERSIONEN VAR EN GISSNING ═════════════════
 *
 * Panelbredd (288/72), avatarstorlek (32px) och kortet byggt på `OpsCard`
 * var alla en uppskattning mot en skärmbild. CP: "CP har sagt att det ska
 * vara EXAKT som SessionStudio." De riktiga talen och klasserna är lästa ur
 * `sessions-platform/apps/web/src/components/` (läs, ändra aldrig): rad-för-
 * rad-referenser står vid varje mått nedan, så nästa person kan verifiera
 * själv i stället för att lita på den här kommentaren.
 *
 * ══ ⛔ VARFÖR EN NY KOMPONENT OCH INTE `OpsGruppvaljare` ═════════════════
 *
 * `OpsGruppvaljare` (#139) löser en annan fråga: raden i en meny, mellan
 * "alla mina grupper" och en enskild. Den bär varken medlemsantal, åtgärder
 * eller avatarer, och den kollapsar inte. `OpsGruppanel` är en egen, bredare
 * yta: den ÅTERANVÄNDER `OpsIdentity` och samma `ALLA_GRUPPER`-läge, men
 * bygger sin egen rad.
 *
 * ══ ⛔ ÅTGÄRDER OCH KNAPPAR ÄR APPENS, RAMVERKET GISSAR INGET ════════════
 *
 * Glob/info/penna, bibliotek och chatt öppnar APPENS egna vyer. Ramverket
 * känner inte till någon av dem: `atgarder` och `knappar` är listor appen
 * skickar in per grupp (ikon, etikett, `onClick`, en valfri räknare).
 *
 * ══ ⛔ KORTET ÄR INTE `OpsCard`. Byggt för hand, med skälet utskrivet ═════
 *
 * `OpsCard` (`p-(--card-padding)`, ~20px, ingen kant som förval) är
 * ramverkets EGEN kortform. SessionStudios `GroupCard.jsx` är en annan
 * form: `p-3` (12px) MED en 1px kant som förval, `rounded-[var(--radius)]`
 * (12px, INTE `--radius-card` 24px). Att pressa SessionStudios mått genom
 * `OpsCard`s props hade antingen krävt att öppna `OpsCard`s stängda API
 * (padding/kant som appen skickar in, vilket `check-closed-api` finns för
 * att förhindra) eller gett ett kort som ser ut som `OpsCard` fast med fel
 * siffror. Raden är därför handbyggd, med SessionStudios egna klasser.
 *
 * ══ ⛔ HELA RADEN VÄLJER, MEN DET ÄR EN `<div>`, INTE EN `<button>` ═══════
 *
 * SessionStudios `GroupCard.jsx` (rad 59-66) är en `<div onClick={onClick}>`
 * som omsluter TRE riktiga `<button>`/`<a>`-element (glob, info, penna) och
 * TVÅ till (bibliotek, chatt), var och en med `e.stopPropagation()` så ett
 * tryck på en ikon inte också väljer kortet. Det är den enda formen som
 * fungerar: en `<button>` FÅR INTE innehålla en `<button>` (ogiltig HTML,
 * webbläsaren bryter isär trädet), så "hela raden är EN knapp" är inte en
 * möjlig läsning av källan, oavsett hur den beskrivs i ett uppdrag.
 *
 * ⛔ VI LÄGGER TILL `role="button"`, `tabIndex={0}` OCH `onKeyDown`
 * (Enter/Space), NÅGOT SESSIONSTUDIOS EGEN `<div>` INTE HAR. Husets linje är
 * annars RIKTIGA kontroller, aldrig en `<div role="button">` som LÅTSAS vara
 * en knapp utan att göra jobbet (se `OpsRadioGroup`s filhuvud): här gör den
 * jobbet, tangentbord inkluderat, vilket är en förbättring över förlagan och
 * inte en genväg förbi den. Åtgärdsknapparna INUTI stoppar propagering på
 * sitt eget `onClick`, exakt som `GroupCard.jsx`.
 *
 * ══ ⛔ INGET PER-GRUPP HEX-FÄRG. ACCENT-TOKENET, MED FLIT ═════════════════
 *
 * SessionStudios markering målar med `group.color` (en fri hexsträng per
 * grupp) plus en alfa-suffix (`"10"`, `"15"`, `"28"`, `"40"`). Ramverkets
 * `GruppanelGrupp` har inget färgfält, och `OpsIdentity` härleder sin ton ur
 * `seed` genom en FAST palett (`identityTone`), aldrig en fri hexsträng: det
 * är samma arkitekturbeslut som `OpsIdentity`s eget filhuvud ("Identitet
 * bärs aldrig av en färgad prick"), applicerat på markeringen. Vald grupp
 * använder därför `--color-accent`, inte gruppens egen färg. En app som vill
 * ha exakt SessionStudios per-grupp-färgade markering får bygga sitt eget
 * lager ovanpå `atgarder`/`onValj`, ramverket erbjuder inte hex-in.
 *
 * ══ ⛔ EN LISTA, INTE EN POPOVER, AV SAMMA SKÄL SOM `OpsGruppvaljare` ═════
 *
 * En popover går inte att driva med `fireEvent` i jsdom. Panelen är en
 * kolonn med riktiga knappar, alltid framme från 1024 px och uppåt.
 *
 * ══ ⛔ UNDER 1024 PX: EN KNAPP OCH ETT ARK, INTE EN KOLUMN ═══════════════
 *
 * `OpsGruppvaxlare` (samma fil) ritar den aktiva gruppens märke och namn som
 * en knapp i headern. Ett tryck öppnar samma lista i `OpsPanel`, ramverkets
 * ark/rullgardin, i en enklare form (utan åtgärder/knappar/avatarer).
 *
 * ⛔ MEDVETEN AVVIKELSE: `OpsPanel` byter yta vid Tailwinds `md` (768 px),
 * inte vid 1024. Att duplicera `OpsPanel`s brytpunktsmaskin för EN till
 * konsument hade brutit mot en sanning per faktum (arbetsreglernas punkt 2).
 *
 * ══ ⛔ KOLLAPS ÄGS AV APPEN, PRECIS SOM VALET ═════════════════════════════
 *
 * `infalld`/`onInfalld` är STYRDA precis som `aktiv`/`onValj` (brandens form
 * hänger på samma läge, se `OpsAppShell`/`OpsBrand`). Utan dem sköter
 * komponenten kollapset själv, samma mönster som `OpsPanel`s styrda/ostyrda
 * `open`.
 */

/**
 * SessionStudios `--radius` (`index.css` rad 215): `0.75rem` = 12px, bas för
 * kort, knappar och `GroupMark`. Ramverkets skala saknade det steget fram
 * till 0.29.0 (bara 10 och 16), så första utkastet skrev `rounded-[12px]`
 * som en literal. Nu är talet ett token ur fixturen (`radier.bas` i
 * `tokens/sessionstudio-profil.json`, `--radius-base` i `tokens.css`), och
 * konstanten här finns kvar bara så att namnet står på ETT ställe.
 */
const RADIE = "rounded-base";

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
 * @property {ReadonlyArray<GruppanelKnapp>} [atgarder] Uppe till höger på kortet (glob/info/penna, `GroupCard.jsx` rad 71-107). Utelämnad: inga.
 * @property {ReadonlyArray<GruppanelKnapp>} [knappar] Runda knappar på tredje raden (bibliotek/chatt, `GroupCard.jsx` rad 128-166). Utelämnad: inga.
 * @property {ReadonlyArray<GruppanelAvatar>} [avatarer] Avatarraden längst ner, max fyra, sedan "+N" (`GroupCard.jsx` rad 176-191). Utelämnad: ingen rad.
 */

/** Hur många avatarer som ritas innan resten blir en "+N" (`GroupCard.jsx` rad 178: `.slice(0, 4)`). */
const MAX_AVATARER = 4;

/**
 * Enter/Space aktiverar kortets val, precis som en riktig `<button>` redan
 * gör gratis. `<li role="button">` gör det inte utan hjälp.
 *
 * @param {() => void} valj
 * @returns {(e: import("react").KeyboardEvent) => void}
 */
function tangentbordsVal(valj) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      valj();
    }
  };
}

/**
 * Raderna i FULL FORM (kort, åtgärder, knappar, avatarer), bara för panelen.
 * `OpsGruppvaxlare`s ark använder `EnkelGruppanelRader` nedan i stället.
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
 * @param {string} props.flerAvatarerEtikett
 */
function GruppanelRader({ grupper, aktiv, onValj, sprak, allaEtikett, tomText, rollNamn, medlemmarEtikett, flerAvatarerEtikett }) {
  const mina = grupper ?? [];

  return (
    // ⛔ `gap-1.5` (AppSidebar.jsx rad 43), inte `gap-3`.
    <ul className="flex flex-col gap-1.5" aria-label={allaEtikett}>
      <li>
        {/* "Alla arbetsytor", AppSidebar.jsx rad 119-133: p-2.5, text-xs font-medium. */}
        <button
          type="button"
          onClick={() => onValj(ALLA_GRUPPER)}
          aria-current={aktiv === ALLA_GRUPPER ? "true" : undefined}
          className={cx(
            "flex w-full items-center gap-2 border p-2.5 text-left text-xs font-medium transition-all",
            RADIE,
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            aktiv === ALLA_GRUPPER ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-ink-secondary hover:border-line-strong",
          )}
        >
          <PersonIkon size={16} />
          {allaEtikett}
        </button>
      </li>

      {mina.length === 0 && tomText ? <li className="px-2.5 py-1 text-sm text-ink-secondary">{tomText}</li> : null}

      {mina.map((g) => {
        const namn = text(g.namn, sprak);
        const vald = g.id === aktiv;
        const avatarer = g.avatarer ?? [];
        const synligaAvatarer = avatarer.slice(0, MAX_AVATARER);
        const resten = avatarer.length - synligaAvatarer.length;
        const valj = () => onValj(g.id);

        return (
          // ⛔ `GroupCard.jsx` rad 59-66: `<div onClick>`, INTE en `<button>`.
          // Se filhuvudet: en knapp kan inte innehålla åtgärdsknapparna
          // nedan. `role="button"`/`tabIndex`/`onKeyDown` läggs till för
          // tangentbordet, något förlagan saknar.
          <li
            key={g.id}
            role="button"
            tabIndex={0}
            onClick={valj}
            onKeyDown={tangentbordsVal(valj)}
            aria-current={vald ? "true" : undefined}
            aria-label={namn}
            className={cx(
              "flex w-full cursor-pointer flex-col overflow-hidden border p-3 text-left transition-all hover:shadow-md",
              RADIE,
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              vald ? "border-accent bg-accent/10 shadow-sm" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            {/* Rad 1: märke + åtgärder. GroupCard.jsx rad 70-107, sizePx=20. */}
            <div className="mb-1.5 flex items-center justify-between">
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} size="xs" />
              {g.atgarder && g.atgarder.length > 0 ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  {g.atgarder.map((a, i) => (
                    <button
                      // eslint-disable-next-line react/no-array-index-key -- ⛔ ÅTGÄRDER HAR INGET EGET ID. Appen skickar en lista ikoner, index räcker eftersom listan inte sorteras om under komponentens liv.
                      key={i}
                      type="button"
                      onClick={(e) => {
                        // ⛔ `e.stopPropagation()`, GroupCard.jsx rad 79/88/98.
                        // Utan den väljer ett tryck på ikonen ÄVEN kortet.
                        e.stopPropagation();
                        a.onClick();
                      }}
                      aria-label={a.label}
                      title={a.label}
                      className={cx("p-1.5 text-ink-muted hover:text-accent", RADIE, "hover:bg-sunken")}
                    >
                      {a.icon}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Rad 2: namn. GroupCard.jsx rad 111-113. */}
            <p className="mb-1 truncate text-xs leading-tight font-semibold text-ink">{namn}</p>

            {g.roll ? (
              <p className="mb-1">
                <OpsPill tone={g.roll === "agare" ? "info" : "neutral"}>{rollNamn[g.roll] || g.roll}</OpsPill>
              </p>
            ) : null}

            {/* Rad 3: medlemsantal + knappar. GroupCard.jsx rad 116-168. */}
            <div className="mt-1.5 flex items-center justify-between">
              {typeof g.medlemsantal === "number" ? (
                <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <PersonIkon size={10} />
                  {g.medlemsantal}
                  <span className="sr-only"> {medlemmarEtikett}</span>
                </span>
              ) : (
                <span />
              )}
              {g.knappar && g.knappar.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  {g.knappar.map((k, i) => (
                    <button
                      // eslint-disable-next-line react/no-array-index-key -- se noten vid atgarder ovan.
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        k.onClick();
                      }}
                      aria-label={k.label}
                      title={k.label}
                      className="relative flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink-secondary hover:border-accent hover:text-accent"
                    >
                      {k.icon}
                      {typeof k.badge === "number" ? <OpsCountBadge count={k.badge} text={k.label} placement="icon" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Rad 4: avatarer. GroupCard.jsx rad 176-191: gap-0.5, Avatar size=5 (20px). */}
            {avatarer.length > 0 ? (
              <div className="mt-1.5 flex items-center gap-0.5">
                {synligaAvatarer.map((a) => (
                  // ⛔ Rent dekorativt här: ramverket har inget `onViewUser`-
                  // fält på `GruppanelAvatar` (#161-scope), till skillnad från
                  // SessionStudios klickbara profil-avatar (GroupCard.jsx rad
                  // 178-190). Ett tryck på en avatar navigerar alltså ingenstans
                  // ännu, och en span som bara visar bilden ljuger då inte om
                  // vad den gör.
                  <span key={a.id} className="inline-flex rounded-full">
                    <OpsIdentity name={a.namn} seed={a.id} imageUrl={a.bild || undefined} size="xs" />
                  </span>
                ))}
                {resten > 0 ? (
                  <span className="ml-0.5 text-[9px] text-ink-muted">
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
 * knapp, ingen avatarstapel. Se `OpsGruppanel`s filhuvud för varför arket
 * inte återanvänder `GruppanelRader` rakt av (för smalt för hela kortet).
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
            "flex min-h-11 w-full items-center gap-2 border px-3 py-2 text-left text-sm font-semibold",
            RADIE,
            "transition-colors duration-(--duration-fast) ease-standard",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            aktiv === ALLA_GRUPPER ? "border-accent bg-accent/10 text-accent" : "border-transparent text-ink-secondary hover:bg-sunken hover:text-ink",
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
                "flex min-h-11 w-full items-center gap-2.5 border px-3 py-2 text-left",
                RADIE,
                "transition-colors duration-(--duration-fast) ease-standard",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                vald ? "border-accent bg-accent/10" : "border-transparent hover:bg-sunken",
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
 * `AppSidebar.jsx` rad 61-107.
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
    // ⛔ `gap-1.5`, `AppSidebar.jsx` rad 60/61.
    <ul className="flex flex-col gap-1.5" aria-label={allaEtikett}>
      <li>
        {/* "Alla arbetsytor", rad 74-88: w-10 h-10 (40px). */}
        <button
          type="button"
          onClick={() => onValj(ALLA_GRUPPER)}
          aria-current={aktiv === ALLA_GRUPPER ? "true" : undefined}
          aria-label={allaEtikett}
          title={allaEtikett}
          className={cx(
            "flex size-10 items-center justify-center border transition-all",
            RADIE,
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            aktiv === ALLA_GRUPPER ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-line-strong",
          )}
        >
          <PersonIkon size={16} />
        </button>
      </li>
      {(grupper ?? []).map((g) => {
        const namn = text(g.namn, sprak);
        const vald = g.id === aktiv;
        return (
          <li key={g.id}>
            {/* Gruppknapp, rad 89-107: w-10 h-10, overflow-hidden p-0.5, märke 34px. */}
            <button
              type="button"
              onClick={() => onValj(g.id)}
              aria-current={vald ? "true" : undefined}
              aria-label={namn}
              title={namn}
              className={cx(
                "flex size-10 items-center justify-center overflow-hidden border p-0.5 transition-all",
                RADIE,
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                vald ? "border-accent bg-accent/10 shadow-sm" : "border-line bg-surface hover:border-line-strong",
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
  // ⛔ STYRD ELLER OSTYRD, SAMMA MÖNSTER SOM `OpsPanel`s `open`.
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
      // ⛔ BREDDEN SITTER PÅ NAVEN, INTE PÅ SKALETS WRAPPER (se `OpsAppShell`).
      // ⛔ `w-(--panel-bredd)`/`w-(--panel-bredd-infalld)`: 184px/44px, MÄTTA
      // ur `AppSidebar.jsx` rad 43-49 (`md:w-[184px]` / `w-11`), inte 288/72.
      // ⛔ INGEN BREDD-TRANSITION. `AppSidebar.jsx` rad 13-16: transitionen
      // togs bort medvetet 2026-04-22, den gav flimmer mellan bredd och
      // `hidden`/`md:flex`-innehållet. Bredden byter direkt här också.
      className={cx(
        "flex h-full flex-col gap-1.5 overflow-y-auto px-0.5",
        kollapsad ? "w-(--panel-bredd-infalld)" : "w-(--panel-bredd)",
      )}
    >
      {/*
       * ⛔ CHEVRONEN ÄR FÖRSTA BARNET, I PANELEN (`AppSidebar.jsx` rad 51-59),
       * INTE I TOPPRADEN. `w-full ... p-1.5`, ikon `w-3.5 h-3.5` (14px).
       */}
      <button
        type="button"
        onClick={vaxlaInfalld}
        aria-label={kollapsad ? fallUtEtikett : kollapsaEtikett}
        className={cx("flex w-full items-center justify-center p-1.5 text-ink-secondary hover:bg-sunken hover:text-ink", RADIE, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}
      >
        {kollapsad ? <ChevronHogerIkon size={14} /> : <ChevronVansterIkon size={14} />}
      </button>

      {/*
       * ⛔ INGEN `flex-1` PÅ LISTAN. "Skapa nytt" FÖLJER listan (`AppSidebar.jsx`
       * rad 119-184: samma `flex-col gap-1.5`, knappen är sista barnet), den
       * fästs inte i panelens botten. Hela panelen scrollar (`overflow-y-auto`
       * på asiden, rad 49), inte listan för sig. CP:s bild bekräftar: knappen
       * står direkt under sista kortet.
       */}
      <div className="flex flex-col gap-1.5">
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
        kollapsad ? (
          // "Skapa nytt", infälld: rad 108-112, w-10 h-10 dashed.
          <button
            type="button"
            onClick={onSkapa}
            aria-label={skapaEtikett}
            title={skapaEtikett}
            className={cx("flex size-10 items-center justify-center border border-dashed border-accent/15 text-accent hover:border-accent hover:bg-accent/5", RADIE, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}
          >
            <PlusIkon size={16} />
          </button>
        ) : (
          // "Skapa nytt", utfälld: rad 157-166, p-3 dashed, text-sm font-medium.
          <button
            type="button"
            onClick={onSkapa}
            className={cx("flex w-full items-center justify-center gap-1.5 border border-dashed border-accent/15 p-3 text-sm font-medium text-accent hover:border-accent hover:bg-accent/5", RADIE, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}
          >
            <PlusIkon size={16} />
            {skapaEtikett}
          </button>
        )
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
        // den men inte GÖR om det till en knapp.
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
