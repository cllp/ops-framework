import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rapporteraFel } from "./felrapport.js";
import {
  aterstallKalenderSynlighet,
  arForvaldSynlighet,
  arKalenderSynlig,
  kalenderSynlighetNyckel,
  kalenderVisning,
  lasKalenderSynlighet,
  sattKalenderVisning,
  skrivKalenderSynlighet,
  synligaKalenderRader,
  vaxlaKalenderSynlighet,
} from "./kalendersynlighet.js";

/**
 * Lagringen som den ser ut för den som läser: `getItem` och `setItem`. `setItem` får svara med ett löfte (en app som sparar på en server), men
 * ingenting i kalendern väntar på det.
 * @typedef {{ getItem: (n: string) => string | null, setItem: (n: string, v: string) => void | Promise<unknown> }} Kalenderlagring
 */

/** @returns {Kalenderlagring | undefined} */
function webblasarlagring() {
  // `window.localStorage` KAN KASTA bara genom att läsas (SecurityError i ett blockerat läge), och då ska kalendern fungera utan minne.
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {Kalenderlagring | undefined} lager
 * @param {string} nyckel
 */
function lasFran(lager, nyckel) {
  if (!nyckel || !lager) return lasKalenderSynlighet(null);
  try {
    return lasKalenderSynlighet(lager.getItem(nyckel));
  } catch (fel) {
    rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "läsa synlighet" });
    return lasKalenderSynlighet(null);
  }
}

/**
 * Vilka kalendrar som syns och hur de visas, ur ETT minne per person och grupp (0.134.0, cllp/lifehub.app#402). `OpsCalendar` använder den själv;
 * en vy som ska följa samma val (Idag) anropar den med SAMMA `minne` och samma `kalendrar`.
 *
 * ══ ⛔ ETT TRYCK ÄNDRAR TILLSTÅNDET DIREKT, OCH SPARAR SEN ═══════════════════════════════════════════════════════════
 *
 * CP 2026-10-21: "Utan fördröjning. Ett tryck ändrar kalendern direkt ur det som redan är laddat, och valet sparas i bakgrunden."
 * Valet är React-tillstånd och ändras i samma tryck; sparandet är en effekt EFTER att det ritats. Det väntar aldrig på `setItem`, och svarar
 * den med ett löfte som aldrig löses (en server som inte svarar) ändras kalendern ändå. Det finns ingen hämtning här att vänta på:
 * kalendern filtrerar posterna den redan har. Ett fel vid sparandet rapporteras (`rapporteraFel`) men rullar inte tillbaka valet: det som
 * ritades är det personen bad om, och att det inte sparades syns vid nästa besök.
 *
 * ⛔ UTAN `minne` GÄLLER VALET BARA DEN HÄR VISNINGEN. Ramverket känner inte personen eller gruppen; en app som inte skickar `minne` får
 * listan men inget som överlever en omladdning, och det är dokumenterat och inte ett fel.
 *
 * @param {object} props
 * @param {string} [props.minne] Vem och vilken grupp valet gäller, appens val. Sparas under `kalenderSynlighetNyckel(minne)`.
 * @param {ReadonlyArray<{ id: string, avFranStart?: boolean }>} [props.kalendrar] Raderna. Utan dem finns inget att välja.
 * @param {Kalenderlagring} [props.lagring] Förval `window.localStorage` när den går att läsa.
 * @param {(ids: string[]) => void} [props.onSynliga] Id:n som syns, i radernas ordning, en gång vid start och varje gång mängden ändras.
 */
export function useKalenderSynlighet({ minne = "", kalendrar, lagring, onSynliga }) {
  const lager = lagring || webblasarlagring();
  const nyckel = minne ? kalenderSynlighetNyckel(minne) : "";
  const [state, setState] = useState(() => ({ nyckel, val: lasFran(lager, nyckel) }));
  // Byter appen minne (en annan grupp) läses det nya under samma ritning. Ett `useEffect` hade ritat en gång med den förra gruppens val.
  let aktuell = state;
  if (state.nyckel !== nyckel) {
    aktuell = { nyckel, val: lasFran(lager, nyckel) };
    setState(aktuell);
  }
  const val = aktuell.val;

  const andra = useCallback(
    /** @param {(v: import("./kalendersynlighet.js").KalenderSynlighet) => import("./kalendersynlighet.js").KalenderSynlighet} fn */
    (fn) => setState((s) => (s.nyckel === nyckel ? { nyckel, val: fn(s.val) } : s)),
    [nyckel],
  );

  // Sparandet, efter ritningen. `sparat` är det som redan ligger i lagringen eller just lästes därifrån, så att ett byte av minne inte skriver.
  const sparat = useRef({ nyckel, text: skrivKalenderSynlighet(val) });
  useEffect(() => {
    const text = skrivKalenderSynlighet(val);
    if (sparat.current.nyckel !== nyckel) {
      sparat.current = { nyckel, text };
      return;
    }
    if (sparat.current.text === text) return;
    sparat.current = { nyckel, text };
    if (!nyckel || !lager) return;
    try {
      const svar = lager.setItem(nyckel, text);
      if (svar && typeof (/** @type {Promise<unknown>} */ (svar)).then === "function") {
        /** @type {Promise<unknown>} */ (svar).then(undefined, (fel) => rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "spara synlighet" }));
      }
    } catch (fel) {
      rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "spara synlighet" });
    }
  }, [val, nyckel, lager]);

  const rader = useMemo(() => (kalendrar || []).filter((r) => r && typeof r.id === "string" && r.id.length > 0), [kalendrar]);
  const synliga = useMemo(() => synligaKalenderRader(rader, val).map((r) => r.id), [rader, val]);

  // Bara när det finns rader: en app utan kalendrar har inget att följa. Samma nyckel två gånger ger inget anrop.
  const onSynligaRef = useRef(onSynliga);
  onSynligaRef.current = onSynliga;
  const senast = useRef(/** @type {string | null} */ (null));
  useEffect(() => {
    if (!kalendrar) {
      senast.current = null;
      return;
    }
    const k = synliga.join("\0");
    if (senast.current === k) return;
    senast.current = k;
    onSynligaRef.current?.(synliga);
  }, [kalendrar, synliga]);

  const radPerId = useMemo(() => new Map(rader.map((r) => [r.id, r])), [rader]);
  return {
    /** Id:n som syns, i radernas ordning. */
    synliga,
    /** @param {string} id */
    arSynlig: (id) => {
      const r = radPerId.get(id);
      return r ? arKalenderSynlig(r, val) : true;
    },
    /** @param {string} id */
    visning: (id) => {
      const r = radPerId.get(id);
      return r ? kalenderVisning(r, val) : "handelser";
    },
    /** Allt som det var från början: varje rad har sitt förval. */
    arForval: arForvaldSynlighet(rader, val),
    /** @param {string} id */
    vaxla: (id) => {
      const r = radPerId.get(id);
      if (r) andra((v) => vaxlaKalenderSynlighet(r, v));
    },
    /** @param {string} id @param {import("./kalendersynlighet.js").Kalendervisning} visning */
    valjVisning: (id, visning) => {
      const r = radPerId.get(id);
      if (r) andra((v) => sattKalenderVisning(r, visning, v));
    },
    aterstall: () => andra(aterstallKalenderSynlighet),
  };
}
