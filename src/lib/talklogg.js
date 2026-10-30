/**
 * TALK:s händelselogg per omgång (0.155.0, cllp/lifehub.app#253).
 *
 * ══ ⛔ VARFÖR DEN FINNS ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP mätte 2026-10-29 21:09 på en riktig iPhone: första inspelningen efter agentens svar fungerar inte i den omgång som kommer
 * direkt efter att agenten svarat ("Mikrofonen gav inget ljud, och inget hördes som text"), och nästa tryck fungerar. Felrapporten
 * sade bara OM något var tomt (`tystVidStart`, `bitar`), aldrig I VILKEN ORDNING saker hände: kom `audiostart` över huvud taget,
 * kom `end` före något `result`, tystnade spåret före eller efter att en ljudkontext skapats. Det är ordningen och tiderna som
 * skiljer orsakerna åt (regel 3: kod visar vad som kan hända, bara data vad som har hänt).
 *
 * ══ ⛔ VAD LOGGEN BÄR, OCH VAD DEN ALDRIG BÄR ═══════════════════════════════════════════════════════════════════════════
 *
 * Händelsenamn, felkoder och millisekunder sedan omgången började. Aldrig text, aldrig ljud, aldrig längden på det som sades.
 * Ett namn är en identifierare ur koden (`audiostart`, `error-no-speech`), och en felkod rensas till `[a-z0-9-]` och kapas.
 * En händelse som upprepas (`result`, `data`) står en gång med sin första tid och antalet efter ett `x`.
 *
 * Formen är en sträng utan blanksteg: `start:0.audiostart:212.result:812x5.end:3012`. Den ryms i en `kodtext` hos mottagaren
 * (högst `LOGG_LANGD` tecken). Är den längre kapas de SENASTE händelserna bort och `+N` visar hur många som föll bort.
 */

/** Längsta loggsträngen. Samma tak som en `kodtext` hos appens felmottagare (`DETALJ_LANGD`). */
export const LOGG_LANGD = 200;

/** Så många olika händelser en omgång håller. Fler än så är en slinga, och loggen ska inte växa med den. */
const MAX_HANDELSER = 40;

/** Felkoder och namn rensas till det här. */
const OTILLATET = /[^a-z0-9-]/g;

/**
 * @param {unknown} v
 * @returns {string}
 */
function rent(v) {
  return String(v ?? "")
    .toLowerCase()
    .replace(OTILLATET, "")
    .slice(0, 24);
}

/**
 * En logg för EN omgång. Tiden räknas från att loggen skapades.
 *
 * @param {{ nu?: () => number }} [val] `nu` är klockan, bara för prov. ⛔ Förvalet läser `Date.now` vid varje anrop (som
 *   `skapaIgenkanningsniva`), så att en falsk klocka i ett prov också når hit.
 */
export function skapaOmgangslogg({ nu = () => Date.now() } = {}) {
  const t0 = nu();
  /** @type {Map<string, { ms: number, antal: number }>} */
  const handelser = new Map();
  let bortfall = 0;
  return {
    /**
     * Noterar att något hände nu. En kod (felkod, läge) läggs efter namnet med bindestreck.
     * @param {string} namn @param {string | number | null} [kod]
     */
    notera(namn, kod) {
      const nyckel = kod === undefined || kod === null || kod === "" ? rent(namn) : `${rent(namn)}-${rent(kod)}`;
      if (!nyckel) return;
      const finns = handelser.get(nyckel);
      if (finns) {
        finns.antal += 1;
        return;
      }
      if (handelser.size >= MAX_HANDELSER) {
        bortfall += 1;
        return;
      }
      handelser.set(nyckel, { ms: Math.max(0, Math.round(nu() - t0)), antal: 1 });
    },
    /** Millisekunder sedan loggen skapades. */
    ms: () => Math.max(0, Math.round(nu() - t0)),
    /**
     * Loggen som en sträng, i den ordning händelserna kom. Tom sträng när inget noterats (regel 5: det är ett svar, inte en utelämnad rad).
     * @returns {string}
     */
    text() {
      const delar = [...handelser.entries()].map(([namn, h]) => `${namn}:${h.ms}${h.antal > 1 ? `x${h.antal}` : ""}`);
      // Kapas bakifrån: de första händelserna är det som skiljer orsakerna åt, och de sista är oftast ett `end` som redan syns i felkoden.
      for (let kvar = delar.length; kvar >= 0; kvar -= 1) {
        const bort = bortfall + (delar.length - kvar);
        const ut = `${delar.slice(0, kvar).join(".")}${bort ? `${kvar ? "." : ""}+${bort}` : ""}`;
        if (ut.length <= LOGG_LANGD) return ut;
      }
      return "";
    },
  };
}

/**
 * Hur en omgång slutade, för nästa omgångs rapport.
 * @typedef {object} Omgangsslut
 * @property {"igenkanning" | "inspelning" | "bada"} mekanism Vad som höll mikrofonen: webbläsarens taligenkänning, inspelaren eller båda.
 * @property {"text" | "ljud" | "tomt" | "fel" | "kastad"} utfall `text`: texten kom fram. `ljud`: ljud men ingen text. `tomt`: varken ljud eller text. `fel`: ett fel
 *   avbröt. `kastad`: personen avbröt.
 * @property {string} logg Omgångens logg, `skapaOmgangslogg().text()`.
 * @property {number} vid När omgången slutade, i klockans tid.
 */

/**
 * ⛔ FÖRRA OMGÅNGEN ÄR EN SIDAS SAK, INTE EN KROKS (0.155.0). Skalets TALK (`useTalk` i `OpsAppShell`) och chattens skrivfält
 * (`useRostinmatning` → `useTalk`) är två instanser med var sin igenkänning och inspelare. Efter att agenten svarat är det en ANNAN
 * instans än den som just spelade in som tar nästa omgång, och en logg per instans hade aldrig kunnat visa övergången från den ena
 * mekanismen till den andra. Därför bor förra omgången här, i modulen, och varje instans läser och skriver samma post.
 *
 * ⛔ BARA MÄTNING. Ingenting i ramverket beslutar något ur den: den bär inte till ett val, ett prov eller ett nytt försök, bara till
 * felrapporten.
 * @type {Omgangsslut | null}
 */
let forra = null;

/**
 * Noterar hur en omgång slutade. Den senaste gäller.
 * @param {Omgangsslut} slut
 */
export function noteraOmgangsslut(slut) {
  forra = slut;
}

/**
 * Förra omgången sedd från en ny omgångs start, eller `null` när ingen funnits på sidan.
 * @param {() => number} [nu]
 * @returns {{ forra: string, forraLogg: string } | null} `forra` är `mekanism:utfall:ms` (ms sedan förra slutade), `forraLogg` dess logg.
 */
export function forraOmgangen(nu = () => Date.now()) {
  if (!forra) return null;
  return { forra: `${forra.mekanism}:${forra.utfall}:${Math.max(0, Math.round(nu() - forra.vid))}`, forraLogg: forra.logg };
}

/** Glöm förra omgången. Bara för prov: sidans liv är det som annars avgör. */
export function glomForraOmgangen() {
  forra = null;
}
