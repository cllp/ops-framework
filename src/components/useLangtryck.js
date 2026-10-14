import { useEffect, useRef } from "react";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * Långtrycket: EN logik för raden i `OpsAtgardsblad` och för ikonerna i skalets rader (0.103.0).
 *
 * ⛔ HÄNDELSEN: CP 2026-10-14, "kör" på förslaget att ett långtryck på ikonerna i menyraden skapar i den modulen (Kalender ger
 * Ny händelse, gruppikonen Ny grupp). Logiken fanns redan i `OpsAtgardsblad`: hålltiden ur `apparark.js`, rörelsetoleransen och
 * släppskyddet som lifehub.app#226 tog fram. En kopia i bottenraden hade varit den tredje (TALK har sin egen i `useTalk`, app-arket
 * en fjärde i `ArkRuta`), och tre kopior av samma gest glider isär i hålltid och i vad som händer med klicket efteråt. Därför är
 * logiken flyttad hit, och `OpsAtgardsblad` använder den här kroken i stället för sin egen.
 *
 * Vad kroken gör, i den ordning det händer:
 *   - Ett tryck med vänster knapp eller ett finger startar en timer på `LANGTRYCK_MS`. Rör sig pekaren mer än 8 px avbryts den.
 *   - När tiden nåtts anropas `onLangtryck`, och klicket som webbläsaren skickar när fingret lyfts sväljs (`onClickCapture`). Ett
 *     långtryck på en länk hade annars både öppnat genvägen och navigerat.
 *   - `iSlappet` och `stoppaSlappet` är släppskyddet: ett tidsfönster efter att fingret lyfts, inom vilket ett klick på det som
 *     nyss öppnats inte räknas. Det är `OpsAtgardsblad`s menyrader som behöver det, se dess filhuvud.
 *   - ⛔ TANGENTBORDET: Shift+F10 och tangenten ContextMenu öppnar samma sak (granskningen av PR 383, MÅSTE 1). Före 0.103.0 öppnade
 *     Enter på bottenradens plus skapa-listan. När plusset blev en mikrofon startade Enter TALK, och listan gick bara att nå med ett
 *     långtryck, alltså inte alls utan pekare under 768 px (också när en dator zoomar 200 %). Shift+F10 och ContextMenu är
 *     kontextmenyns tangenter i alla plattformar, och ett långtryck är telefonens kontextmeny. `kortkommando` är tangentens namn för
 *     `aria-keyshortcuts`. Tangenten sätter inget släppskydd: inget finger lyfts, så nästa Enter i det som öppnats ska räknas. Den
 *     `contextmenu` som webbläsaren skickar efter tangenten stoppas, så att dess egen meny inte läggs ovanpå.
 *   - Utan `onLangtryck` ger kroken inga händelser alls. ⛔ EN GENVÄG UTAN MOTTAGARE SKA INTE GÅ ATT HÅLLA IN: med tomma händelser
 *     och utan `LANGTRYCK_KLASS` beter sig ytan exakt som innan, med länkens vanliga förhandsvisning och kontextmeny.
 */

/** Hur länge efter att fingret lyfts som klicket från samma tryck ignoreras. Klicket kommer inom några tiotal millisekunder. */
export const SLAPP_SKYDD_MS = 400;
/** Ett släpp som aldrig kom (avbruten gest, förlorad händelse) håller inte spärren längre än så här efter att trycket nåddes. */
export const SLAPP_SKYDD_TAK_MS = 2000;
/** Tangenten som öppnar det ett långtryck öppnar, i den form `aria-keyshortcuts` tar. ContextMenu fungerar också, men saknas på Mac. */
export const KORTKOMMANDO = "Shift+F10";
/** Inom så lång tid efter tangenten räknas en `contextmenu` som webbläsarens svar på den (Windows skickar den när tangenten släpps). */
const TANGENT_MENY_MS = 1000;

/** Är tangenten kontextmenyns: Shift+F10 eller ContextMenu? @param {any} e @returns {boolean} */
export function arKontextTangent(e) {
  if (e.key === "ContextMenu") return true;
  return e.key === "F10" && e.shiftKey === true && !e.ctrlKey && !e.altKey && !e.metaKey;
}

/** Rörelse som avbryter ett långtryck. Ett finger som ligger still darrar några pixlar, ett som rullar flyttar sig mer. */
const RORELSE_PX = 8;

/**
 * Klasserna på en yta som går att hålla in: iOS visar ingen förhandsvisning av länken (`-webkit-touch-callout: none`) och
 * markerar inte ordet under fingret. ⛔ Bara på en yta med en genväg: på en vanlig länk är förhandsvisningen webbläsarens, och
 * den ska vara kvar.
 */
export const LANGTRYCK_KLASS = "select-none [-webkit-touch-callout:none]";

/**
 * En kort vibration när genvägen öppnas, där webbläsaren har den (Android). Safari har ingen `navigator.vibrate`, och då händer
 * inget: att den saknas är ingen felväg, och ett kast hade stoppat genvägen den bara skulle bekräfta.
 */
export function vibrera() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(10);
  } catch {
    // En webbläsare som spärrar vibrationen (en ram utan tillstånd) har ändå öppnat genvägen.
  }
}

/**
 * @param {object} val
 * @param {(() => void) | null | undefined} val.onLangtryck Det långtrycket öppnar. Utan den: inga händelser.
 * @param {boolean} [val.hogerklick] Ett högerklick öppnar samma sak (raden i `OpsAtgardsblad`, där musen inte har något långtryck).
 *   Utan: kontextmenyn stoppas bara medan ett tryck pågår, så att högerklick med mus på en länk fungerar som förut (ny flik).
 * @param {(mal: EventTarget | null) => boolean} [val.hoppaOver] Ett tryck som börjar på det här målet räknas inte (⋮ i raden).
 * @param {boolean} [val.haptik] Vibrera när långtrycket nås. Förval falskt.
 * @returns {{ aktiv: boolean, handelser: Record<string, (e: any) => void>, kortkommando: string | undefined, iSlappet: () => boolean, stoppaSlappet: (e: any) => void }}
 */
export function useLangtryck({ onLangtryck, hogerklick = false, hoppaOver, haptik = false }) {
  const langt = useRef(false);
  /**
   * ⛔ SLÄPPSKYDDET ÄR ETT TIDSFÖNSTER OCH INGET TILLSTÅND (granskningen av PR 364). Klick inom `SLAPP_SKYDD_MS` efter att fingret
   * lyfts ignoreras, och ett klick efter det går alltid fram. Ett tillstånd som släpptes först av ett klick hade svalt nästa riktiga
   * tryck när släppet landade någon annanstans. `oppnad` och `slappt` är millisekunder (`Date.now()`); `slappt` är `null` tills
   * fingret lyfts.
   */
  const slappSkydd = useRef(/** @type {null | { oppnad: number, slappt: number | null }} */ (null));
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const pagar = useRef(false);
  const stada = useRef(/** @type {null | (() => void)} */ (null));
  /** När tangenten senast öppnade genvägen (`Date.now()`), så att kontextmenyn som följer den kan stoppas. */
  const tangentTid = useRef(/** @type {number | null} */ (null));
  const senaste = useRef(onLangtryck);
  senaste.current = onLangtryck;

  // ⛔ En yta som försvinner mitt i ett tryck (navigering, ett ark som stängs) får inte öppna något efteråt.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      stada.current?.();
    },
    [],
  );

  /** Ska ett klick just nu ignoreras som släppet efter långtrycket? */
  const iSlappet = () => {
    const s = slappSkydd.current;
    if (!s) return false;
    const nu = Date.now();
    if (s.slappt === null) return nu - s.oppnad < SLAPP_SKYDD_TAK_MS;
    return nu - s.slappt < SLAPP_SKYDD_MS;
  };
  /** Klick som kommer i släppet stoppas innan de når en knapp. @param {any} e */
  const stoppaSlappet = (e) => {
    if (!iSlappet()) return;
    e.preventDefault();
    e.stopPropagation();
  };

  if (typeof onLangtryck !== "function") return { aktiv: false, handelser: {}, kortkommando: undefined, iSlappet, stoppaSlappet };

  const utlos = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    langt.current = true;
    slappSkydd.current = { oppnad: Date.now(), slappt: null };
    if (haptik) vibrera();
    senaste.current?.();
  };

  /** @param {any} e */
  const ner = (e) => {
    // jsdom saknar PointerEvent, och där kan `button` saknas. Ett tryck utan knapp är ett finger.
    if (e.button !== undefined && e.button !== 0) return;
    if (hoppaOver && hoppaOver(e.target)) return;
    langt.current = false;
    pagar.current = true;
    stada.current?.();
    const startX = e.clientX;
    const startY = e.clientY;
    timer.current = setTimeout(utlos, LANGTRYCK_MS);
    const move = (/** @type {PointerEvent} */ ev) => {
      // ⛔ EFTER ATT LÅNGTRYCKET NÅTTS AVBRYTER RÖRELSE INGENTING: fingret ligger kvar, och släppet ska mätas när det kommer.
      if (langt.current) return;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > RORELSE_PX) slapp();
    };
    const slapp = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pagar.current = false;
      // Klicket efter släppet kommer i en senare händelse. Fönstret räknas från släppet, inte från att långtrycket nåddes.
      if (slappSkydd.current && slappSkydd.current.slappt === null) slappSkydd.current = { ...slappSkydd.current, slappt: Date.now() };
      stada.current?.();
    };
    stada.current = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", slapp);
      document.removeEventListener("pointercancel", slapp);
      stada.current = null;
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", slapp);
    document.addEventListener("pointercancel", slapp);
  };

  return {
    aktiv: true,
    kortkommando: KORTKOMMANDO,
    handelser: {
      onPointerDown: ner,
      /** @param {any} e */
      onKeyDown: (e) => {
        if (!arKontextTangent(e)) return;
        if (hoppaOver && hoppaOver(e.target)) return;
        e.preventDefault();
        tangentTid.current = Date.now();
        senaste.current?.();
      },
      /** @param {any} e */
      onContextMenu: (e) => {
        // Kontextmenyn som webbläsaren skickar efter Shift+F10 eller ContextMenu: genvägen är redan öppnad av tangenten.
        if (tangentTid.current !== null && Date.now() - tangentTid.current < TANGENT_MENY_MS) {
          tangentTid.current = null;
          e.preventDefault();
          return;
        }
        if (hogerklick) {
          e.preventDefault();
          senaste.current?.();
          return;
        }
        // ⛔ BARA MEDAN ETT TRYCK PÅGÅR. Android öppnar kontextmenyn för en länk vid ett långtryck: den stoppas, och väntar timern
        // fortfarande öppnas genvägen nu, så att den inte hänger på att webbläsaren skickar ett släpp efter sin egen meny.
        // Ett högerklick med mus startar inget tryck (`ner` släpper bara vänster knapp förbi) och får sin vanliga meny.
        if (!pagar.current) return;
        e.preventDefault();
        if (timer.current) utlos();
      },
      /** @param {any} e */
      onClickCapture: (e) => {
        if (!langt.current) return;
        langt.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
    iSlappet,
    stoppaSlappet,
  };
}
