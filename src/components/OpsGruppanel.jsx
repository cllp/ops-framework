import { useState } from "react";
import { cx } from "../lib/cx.js";
import { gruppRutaKlass } from "../lib/radKlass.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsCountBadge } from "./counter.jsx";
import { OpsPanel } from "./OpsPanel.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { AndraIkon, ChevronVansterIkon, ChevronHogerIkon, InfoIkon, PersonIkon, PlusIkon } from "./icons.jsx";
import { text } from "../lib/sprak.js";
import { gruppmarkeProps } from "../lib/gruppikoner.js";

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
 * `OpsGruppvaljare` (#139) löser en annan fråga: raden i en meny. Den bär
 * varken medlemsantal, åtgärder eller avatarer, och den kollapsar inte.
 * `OpsGruppanel` är en egen, bredare yta: den ÅTERANVÄNDER `OpsIdentity`, men
 * bygger sin egen rad.
 *
 * ══ ⛔ INGEN RAD "ALLA MINA GRUPPER" (0.35.0, #190) ═══════════════════════
 *
 * CP 2026-09-30: "Ja, frågan om alla grupper: Ta bort det." Det finns alltid
 * exakt en aktiv grupp, och listan består bara av grupperna. Raden som stod
 * överst (SS "Alla arbetsytor", `AppSidebar.jsx` rad 74-88 och 119-133) är
 * borttagen i alla tre formerna: panelen, remsan och växlarens ark. Det är en
 * medveten avvikelse från förebilden, med beslutet ovan som skäl.
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
 * @property {string} [farg] (0.32.0, #180) Gruppens valda färg, ett id ur `PROFILFARGER`. Utelämnad eller tom: tonen härleds ur `id`, som förut.
 * @property {string} [ikon] (0.32.0, #180) Gruppens valda ikon (`GRUPPIKONER`) eller `initialer:AB`. Utelämnad eller tom: initialer ur namnet, som förut.
 * @property {number} [medlemsantal] Utelämnad: ingen siffra ritas, aldrig "0" som gissning.
 * @property {"agare"|"admin"|"medlem"} [roll] Utelämnad: ingen rollpill, och ingen penna.
 * @property {ReadonlyArray<GruppanelKnapp>} [atgarder] Uppe till höger på kortet (glob/info/penna, `GroupCard.jsx` rad 71-107). Utelämnad: inga.
 * @property {ReadonlyArray<GruppanelKnapp>} [knappar] Runda knappar på tredje raden (bibliotek/chatt, `GroupCard.jsx` rad 128-166). Utelämnad: inga.
 * @property {ReadonlyArray<GruppanelAvatar>} [avatarer] Avatarraden längst ner, max fyra, sedan "+N" (`GroupCard.jsx` rad 176-191). Utelämnad: ingen rad.
 */

/**
 * Kortets kant och ljusa bakgrund när det är valt, i GRUPPENS färg (0.32.0, #180 G2, SS `GroupCard.jsx:60-65`:
 * `borderColor: group.color; backgroundColor: ${group.color}10`, alltså färgen vid ca 6 procents täckning).
 *
 * ⛔ KLASSERNA STÅR UTSKRIVNA, INTE BYGGDA (`border-identity-${n}`): Tailwind läser källkoden som text. Färgen är en av de sex identitetstonerna
 * (`PROFILFARGER`), aldrig en hex, samma beslut som i `OpsIdentity`. En grupp utan vald färg använder accenten som förut.
 * @type {Record<string, string>}
 */
const VALD_FARG = {
  1: "border-identity-1 bg-identity-1/6 shadow-sm",
  2: "border-identity-2 bg-identity-2/6 shadow-sm",
  3: "border-identity-3 bg-identity-3/6 shadow-sm",
  4: "border-identity-4 bg-identity-4/6 shadow-sm",
  5: "border-identity-5 bg-identity-5/6 shadow-sm",
  6: "border-identity-6 bg-identity-6/6 shadow-sm",
};

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
 * @param {string} props.listEtikett
 * @param {string} [props.tomText]
 * @param {Record<string, string>} props.rollNamn
 * @param {string} props.medlemmarEtikett
 * @param {string} props.flerAvatarerEtikett
 * @param {(id: string) => void} [props.onInfo]
 * @param {(id: string) => void} [props.onRedigera]
 * @param {string} props.infoEtikett
 * @param {string} props.redigeraEtikett
 */
function GruppanelRader({ grupper, aktiv, onValj, sprak, listEtikett, tomText, rollNamn, medlemmarEtikett, flerAvatarerEtikett, onInfo, onRedigera, infoEtikett, redigeraEtikett }) {
  const mina = grupper ?? [];

  return (
    // ⛔ `gap-1.5` (AppSidebar.jsx rad 43), inte `gap-3`.
    <ul className="flex flex-col gap-1.5" aria-label={listEtikett}>
      {mina.length === 0 && tomText ? <li className="px-2.5 py-1 text-etikett text-ink-secondary">{tomText}</li> : null}

      {mina.map((g) => {
        const namn = text(g.namn, sprak);
        const vald = g.id === aktiv;
        const avatarer = g.avatarer ?? [];
        const synligaAvatarer = avatarer.slice(0, MAX_AVATARER);
        const resten = avatarer.length - synligaAvatarer.length;
        const valj = () => onValj(g.id);
        /*
         * ⛔ (i) OCH PENNA ÄR RAMVERKETS, DE ANDRA ÅTGÄRDERNA APPENS (0.32.0, #180 G2, SS `GroupCard.jsx:88-113`: glob, info, penna i den ordningen).
         * Pennan ritas BARA för `roll` agare eller admin: SS `canEditGroup` (#2705) döljer den för den som inte får, och en roll som saknas ger
         * ingen penna, ramverket gissar aldrig "får nog". (i) är inte rollgatad: en medlem har sin väg in via den.
         */
        const kanRedigera = typeof onRedigera === "function" && (g.roll === "agare" || g.roll === "admin");
        /** @type {GruppanelKnapp[]} */
        const alla = [
          ...(g.atgarder ?? []),
          ...(onInfo ? [{ icon: <InfoIkon size={14} />, label: infoEtikett, onClick: () => onInfo(g.id) }] : []),
          ...(kanRedigera ? [{ icon: <AndraIkon size={14} />, label: redigeraEtikett, onClick: () => onRedigera?.(g.id) }] : []),
        ];

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
              vald ? (VALD_FARG[g.farg ?? ""] ?? "border-accent bg-accent/10 shadow-sm") : "border-line bg-surface hover:border-line-strong",
            )}
          >
            {/* Rad 1: märke + åtgärder. GroupCard.jsx rad 70-107, sizePx=20. */}
            <div className="mb-1.5 flex items-center justify-between">
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} {...gruppmarkeProps(g)} size="xs" />
              {alla.length > 0 ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  {alla.map((a, i) => (
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
            <p className="mb-1 truncate text-meta leading-tight font-semibold text-ink">{namn}</p>

            {g.roll ? (
              <p className="mb-1">
                <OpsPill tone={g.roll === "agare" ? "info" : "neutral"}>{rollNamn[g.roll] || g.roll}</OpsPill>
              </p>
            ) : null}

            {/* Rad 3: medlemsantal + knappar. GroupCard.jsx rad 116-168. */}
            <div className="mt-1.5 flex items-center justify-between">
              {typeof g.medlemsantal === "number" ? (
                <span className="flex items-center gap-1 text-liten text-ink-muted">
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
                  <span className="ml-0.5 text-liten text-ink-muted">
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
 * @param {string} props.listEtikett
 * @param {string} [props.tomText]
 * @param {Record<string, string>} props.rollNamn
 */
function EnkelGruppanelRader({ grupper, aktiv, onValj, onValjOchStang, sprak, listEtikett, tomText, rollNamn }) {
  const mina = grupper ?? [];
  const valj = (/** @type {string} */ id) => {
    onValj(id);
    onValjOchStang?.();
  };

  return (
    <ul className="flex flex-col gap-1.5" aria-label={listEtikett}>
      {mina.length === 0 && tomText ? <li className="px-3 py-1 text-etikett text-ink-secondary">{tomText}</li> : null}

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
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} {...gruppmarkeProps(g)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-etikett font-semibold text-ink">{namn}</span>
                {typeof g.medlemsantal === "number" ? (
                  <span className="block truncate text-meta text-ink-secondary">
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
 * @param {string} props.listEtikett
 */
function GruppanelRemsa({ grupper, aktiv, onValj, sprak, listEtikett }) {
  return (
    // ⛔ `gap-1.5`, `AppSidebar.jsx` rad 60/61.
    <ul className="flex flex-col gap-1.5" aria-label={listEtikett}>
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
                gruppRutaKlass({ vald }),
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} {...gruppmarkeProps(g)} size="rail" />
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
 * @param {string} props.aktiv Den aktiva gruppens id, ur `aktivGrupp`.
 * @param {(id: string) => void} props.onValj
 * @param {() => void} [props.onSkapa] Utelämnad: ingen "Skapa grupp"-knapp.
 * @param {(id: string) => void} [props.onInfo] (0.32.0, G2) (i) på kortet: appen öppnar gruppens detaljsida (`OpsGruppSida`). Utelämnad: ingen knapp.
 * @param {(id: string) => void} [props.onRedigera] (0.32.0, G2) Pennan på kortet. Ritas bara för grupper med `roll` `agare` eller `admin`.
 * @param {string} [props.infoEtikett] Förval "Visa grupp".
 * @param {string} [props.redigeraEtikett] Förval "Redigera grupp".
 * @param {boolean} [props.infalld] Styrd. Utelämnad: panelen sköter läget själv.
 * @param {(infalld: boolean) => void} [props.onInfalld]
 * @param {string} [props.sprak]
 * @param {string} [props.listEtikett] Skärmläsarnamnet på listan. Förval "Mina grupper".
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
  onInfo,
  onRedigera,
  infoEtikett = "Visa grupp",
  redigeraEtikett = "Redigera grupp",
  infalld,
  onInfalld,
  sprak,
  listEtikett = "Mina grupper",
  skapaEtikett = "Skapa grupp",
  tomText = "Du är inte medlem i någon grupp.",
  kollapsaEtikett = "Fäll ihop grupplistan",
  fallUtEtikett = "Fäll ut grupplistan",
  rollNamn = { agare: "Ägare", admin: "Admin", medlem: "Medlem" },
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
      aria-label={listEtikett}
      // ⛔ BREDDEN SITTER PÅ NAVEN, INTE PÅ SKALETS WRAPPER (se `OpsAppShell`).
      // ⛔ `w-(--panel-bredd)`/`w-(--panel-bredd-infalld)`: 184px/44px, MÄTTA
      // ur `AppSidebar.jsx` rad 43-49 (`md:w-[184px]` / `w-11`), inte 288/72.
      // ⛔ INGEN BREDD-TRANSITION. `AppSidebar.jsx` rad 13-16: transitionen
      // togs bort medvetet 2026-04-22, den gav flimmer mellan bredd och
      // `hidden`/`md:flex`-innehållet. Bredden byter direkt här också.
      className={cx(
        "flex h-full flex-col gap-1.5 overflow-y-auto px-(--panel-kant)",
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
        // ⛔ 0.30.1: INFÄLLD ÄR KNAPPEN SAMMA 40 PX-RUTA MED KANT SOM REMSANS ÖVRIGA POSTER (CP:s inspelning,
        // SS infällda ram: en ruta med chevron, inte en naken pil). Utfälld är den full bredd överst (`AppSidebar.jsx:51-59`).
        className={cx(
          "flex items-center justify-center text-ink-secondary",
          kollapsad ? cx(gruppRutaKlass(), "hover:text-ink") : "w-full rounded-base p-1.5 hover:bg-sunken hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
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
          <GruppanelRemsa grupper={grupper} aktiv={aktiv} onValj={onValj} sprak={sprak} listEtikett={listEtikett} />
        ) : (
          <GruppanelRader
            grupper={grupper}
            aktiv={aktiv}
            onValj={onValj}
            sprak={sprak}
            listEtikett={listEtikett}
            tomText={tomText}
            rollNamn={rollNamn}
            medlemmarEtikett={medlemmarEtikett}
            flerAvatarerEtikett={flerAvatarerEtikett}
            onInfo={onInfo}
            onRedigera={onRedigera}
            infoEtikett={infoEtikett}
            redigeraEtikett={redigeraEtikett}
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
            className={cx("flex w-full items-center justify-center gap-1.5 border border-dashed border-accent/15 p-3 text-etikett font-medium text-accent hover:border-accent hover:bg-accent/5", RADIE, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}
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
 * ⛔ ARKET HAR INGEN "SKAPA GRUPP" (0.37.0). CP 2026-09-30, med en skärmbild av arket "Byt grupp" på telefonen: "Ta bort
 * skapa grupp från gruppväljaren. Vill att det skall vara rent där. Finns ju andra ställen att skapa grupp ifrån", och
 * rättelsen samma kväll: "Nej bara i mobil vy." Arket är för att BYTA grupp; en ny grupp skapas med plussets "Ny grupp"
 * (`skapa.grupp`). Gruppanelen på dator har kvar sin knapp. Är personen inte med i någon grupp säger arket det och
 * pekar på plusset (`tomText`), i stället för att vara tomt (arbetsreglernas punkt 5).
 *
 * ⛔ SE `OpsGruppanel`s FILHUVUD om brytpunkten (`OpsPanel`s `md`, inte 1024)
 * och om varför det är en medveten avvikelse och inte en glömd detalj.
 *
 * @param {object} props
 * @param {ReadonlyArray<GruppanelGrupp>} props.grupper
 * @param {string} props.aktiv
 * @param {(id: string) => void} props.onValj
 * @param {string} [props.sprak]
 * @param {string} [props.listEtikett] Skärmläsarnamnet på listan. Förval "Mina grupper".
 * @param {string} [props.ingenGruppEtikett] Knappens namn när personen inte är med i någon grupp. Förval "Ingen grupp".
 * @param {string} [props.tomText] Förval säger att personen inte är med i någon grupp och pekar på plusset.
 * @param {Record<string, string>} [props.rollNamn]
 * @param {string} [props.etikett] Skärmläsarnamn på hela växlaren/arket.
 * @param {string} [props.nuEtikett] (0.31.1) Ordet före det aktiva namnet i knappens skärmläsarnamn: "Byt grupp, nu: Alfa AB". Förval "nu".
 */
export function OpsGruppvaxlare({
  grupper,
  aktiv,
  onValj,
  sprak,
  listEtikett = "Mina grupper",
  ingenGruppEtikett = "Ingen grupp",
  tomText = "Du är inte medlem i någon grupp än. Skapa en med plusset.",
  rollNamn = { agare: "Ägare", admin: "Admin", medlem: "Medlem" },
  etikett = "Byt grupp",
  nuEtikett = "nu",
}) {
  if (typeof onValj !== "function") {
    throw new Error("OpsGruppvaxlare: onValj krävs. En växlare som inte kan välja är en lista som ser ut som en kontroll.");
  }
  const mina = grupper ?? [];
  const aktivRad = mina.find((g) => g.id === aktiv);
  // ⛔ UTAN AKTIV RAD HAR PERSONEN INGEN GRUPP (0.35.0): det enda tillståndet utan aktiv grupp, och det får ett eget namn, inte ett läge.
  const aktivtNamn = aktivRad ? text(aktivRad.namn, sprak) : ingenGruppEtikett;
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
        // ⛔ 0.30.1: UNDER `md` VISAS BARA MÄRKET, INTE NAMNET. CP 2026-09-29 13:44, med bild från
        // telefonen: "Claes Philip St..." i klartext låg ovanpå inkorg, sök och avatar i 390 px.
        // Namnet står kvar i knappens `aria-label` (etiketten) och i arket som öppnas, och
        // synligt från `md`, där det finns plats. SS har ingen gruppväxlare med namn i mobilhuvudet
        // (`AppHeaderMobileToolbar.jsx`: tema, sök, plus, avatar).
        <button
          type="button"
          aria-label={`${etikett}, ${nuEtikett}: ${aktivtNamn}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-etikett font-semibold text-ink md:size-auto md:min-h-11 md:max-w-40 md:justify-start md:gap-2 md:px-2 md:hover:bg-sunken"
        >
          {/* ⛔ 0.31.1: UNDER `md` ÄR KNAPPEN GRUPPMÄRKET OCH INGET ANNAT, på loggans plats längst till vänster (CP 2026-09-29 18:40:
              "VI behöver en bra Grupp-väljare-ikon i mobil istället för logga"). Samma ruta som remsan (`gruppRutaKlass`, 40 px) med
              samma märke (`OpsIdentity rail`), och utan grupp (0.35.0: personen är inte med i någon) den neutrala `PersonIkon`. 44 px
              träffyta runt en 40 px ruta. Från `md` är det märket + namnet som förut. */}
          <span data-gruppmarke="" className={cx(gruppRutaKlass({ vald: Boolean(aktivRad), interaktiv: false }), "md:hidden")}>
            {!aktivRad ? <PersonIkon size={16} /> : <OpsIdentity name={aktivtNamn} seed={aktiv} imageUrl={aktivRad?.bild || undefined} {...gruppmarkeProps(aktivRad)} size="rail" />}
          </span>
          <span className="hidden items-center gap-2 md:flex">
            {!aktivRad ? <PersonIkon size={18} /> : <OpsIdentity name={aktivtNamn} seed={aktiv} imageUrl={aktivRad?.bild || undefined} {...gruppmarkeProps(aktivRad)} size="sm" />}
            <span className="min-w-0 truncate">{aktivtNamn}</span>
          </span>
        </button>
      }
    >
      {() => (
        <EnkelGruppanelRader
          grupper={mina}
          aktiv={aktiv}
          onValj={onValj}
          onValjOchStang={() => setOppet(false)}
          sprak={sprak}
          listEtikett={listEtikett}
          tomText={tomText}
          rollNamn={rollNamn}
        />
      )}
    </OpsPanel>
  );
}
