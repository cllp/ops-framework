/**
 * Gästens sessioner i enhetens minne, ett format och ett ställe (cllp/lifehub.app#658 punkt 0, 0.188.0).
 *
 * ⛔ EGEN MODUL OCH INTE I `OpsGastSida.jsx`: appens hub importerar `sparaGastSession` för att spara en session efter ett tryck på en gästgrupp. Låg den i sidans fil drog importen hela gästsidan
 * (och `OpsDeladHandelse`) in i startfilen, 10 kB gzip före första vyn (mätt med `check:jsstorlek` i lifehub.app). Sidan och hubben delar det här formatet (regel 2) utan att dela komponent.
 */
import { GASTINBJUDNINGSIDFORM, GASTNYCKELFORM } from "./gast.js";

/** Nyckeln en gästs session sparas under, per inbjudan. Sessionen ligger i webbläsarens minne och inte i adressen. */
export const sessionsnyckelFor = (/** @type {string} */ id) => `ops-gast:${id}`;
/** Nyckeln som minns vilken inbjudan som senast öppnades, så att `/gast` utan länk öppnar rätt sak igen. */
export const SENASTE = "ops-gast:senaste";
/** Nyckeln som minns ALLA inbjudningar som har en session på enheten (en JSON-lista, nyast först). 0.132.0: en gäst kan ha en omröstning och hela gruppen på samma enhet. */
export const ALLA = "ops-gast:alla";

/**
 * Flikar en gruppgäst kan ha valt senast (0.192.0). Översikt är landningen, inte en behörighet.
 * Värdet som sparas är bara ett av de här orden. Aldrig en nyckel, en adress eller ett id ur en länk.
 */
export const GASTFLIKAR = /** @type {const} */ (["oversikt", "chatt", "kalender", "bibliotek", "arenden"]);

/** Nyckel för senast valda flik, per inbjudan. Inbjudans id är redan minnets nyckel för sessionen. Inget mer lagras. */
export const gastFlikNyckel = (/** @type {string} */ id) => `ops-gast:flik:${id}`;

/**
 * Senast valda flik, eller `null` när inget giltigt finns. Ett värde som inte är en flik läses som inget (regel 5: tomt är ett svar).
 * @param {{ las: (k: string) => string | null } | null | undefined} minne
 * @param {string | null | undefined} id Inbjudans id, 64 hextecken. Annat än det sparas inte.
 * @returns {(typeof GASTFLIKAR)[number] | null}
 */
export function lasGastFlik(minne, id) {
  if (!minne || typeof id !== "string" || !GASTINBJUDNINGSIDFORM.test(id)) return null;
  let v = null;
  try {
    v = minne.las(gastFlikNyckel(id));
  } catch {
    return null;
  }
  return /** @type {readonly string[]} */ (GASTFLIKAR).includes(/** @type {string} */ (v)) ? /** @type {(typeof GASTFLIKAR)[number]} */ (v) : null;
}

/**
 * Minns fliken. Skriver bara ett ord ur `GASTFLIKAR`, och bara under inbjudans id. Ett minne som kastar stoppar inte flikbytet.
 * @param {{ skriv: (k: string, v: string) => void } | null | undefined} minne
 * @param {string | null | undefined} id
 * @param {string} flik
 */
export function skrivGastFlik(minne, id, flik) {
  if (!minne || typeof id !== "string" || !GASTINBJUDNINGSIDFORM.test(id)) return;
  if (!/** @type {readonly string[]} */ (GASTFLIKAR).includes(flik)) return;
  try {
    minne.skriv(gastFlikNyckel(id), flik);
  } catch {
    /* Flikbytet gäller ändå. */
  }
}

/**
 * Minnet för sessionen: webbläsarens (`localStorage`) om det går, annars ett som gäller tills sidan lämnas. Kastar aldrig: privat läge eller blockerad lagring ska inte stoppa sidan.
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void } | null | undefined} lagring
 */
export function minne(lagring) {
  /** @type {Record<string, string>} */
  const reserv = {};
  const l = lagring === undefined ? (() => { try { return globalThis.localStorage; } catch { return null; } })() : lagring;
  return {
    /** @param {string} k @returns {string | null} */
    las(k) {
      try {
        const v = l ? l.getItem(k) : null;
        return v ?? reserv[k] ?? null;
      } catch {
        return reserv[k] ?? null;
      }
    },
    /** @param {string} k @param {string} v */
    skriv(k, v) {
      reserv[k] = v;
      try {
        l?.setItem(k, v);
      } catch {
        /* Reserven gäller tills sidan lämnas. */
      }
    },
    /** @param {string} k */
    glom(k) {
      delete reserv[k];
      try {
        l?.removeItem(k);
      } catch {
        /* Inget att göra: det finns inget sparat. */
      }
    },
    /**
     * Nycklarna som börjar med `prefix`, för ett minne som kan räkna upp dem (`localStorage` kan; ett minne med bara get, set och remove kan inte). Hittar sessioner som skrevs innan
     * indexet fanns (0.131.0 skrev inget index).
     * @param {string} prefix
     * @returns {string[]}
     */
    nycklar(prefix) {
      const ut = new Set(Object.keys(reserv).filter((k) => k.startsWith(prefix)));
      try {
        const st = /** @type {any} */ (l);
        if (st && typeof st.key === "function" && Number.isInteger(st.length)) {
          for (let i = 0; i < st.length; i++) {
            const k = st.key(i);
            if (typeof k === "string" && k.startsWith(prefix)) ut.add(k);
          }
        }
      } catch {
        /* Minnet går inte att räkna upp: bara det vi redan känner till finns att välja på. */
      }
      return [...ut];
    },
  };
}

/** @typedef {ReturnType<typeof minne>} Gastminne */

/**
 * Inbjudningarna som har en sparad session, den senast öppnade först. Indexet, och allt minnet kan räkna upp (sessioner från före indexet).
 * @param {Gastminne} mem
 * @returns {string[]}
 */
export function sparadeSessionsIds(mem) {
  /** @type {string[]} */
  const ut = [];
  const senaste = mem.las(SENASTE);
  if (senaste) ut.push(senaste);
  try {
    const lista = JSON.parse(mem.las(ALLA) ?? "[]");
    if (Array.isArray(lista)) for (const id of lista) if (typeof id === "string") ut.push(id);
  } catch {
    /* Ett trasigt index är ingen session: resten av listan gäller. */
  }
  for (const k of mem.nycklar("ops-gast:")) ut.push(k.slice("ops-gast:".length));
  return [...new Set(ut)].filter((id) => GASTINBJUDNINGSIDFORM.test(id));
}

/**
 * Skriver en session, markerar den som den senast öppnade och lägger den först i indexet.
 * @param {Gastminne} mem
 * @param {string} id
 * @param {string} nyckel
 */
export function skrivSessionTillMinne(mem, id, nyckel) {
  mem.skriv(sessionsnyckelFor(id), nyckel);
  mem.skriv(SENASTE, id);
  mem.skriv(ALLA, JSON.stringify([id, ...sparadeSessionsIds(mem).filter((x) => x !== id)]));
}

/**
 * Sparar en gästsession på enheten på samma sätt som `OpsGastSida` gör efter en inlösen, och markerar inbjudan som den som öppnas näst (cllp/lifehub.app#658 punkt 0). En app som ger en inloggad person
 * en gästsession (`oppnaGruppgast` i tjänsten) sparar den här och går till `/guest`, som öppnar den utan länk. ⛔ ETT MINNESFORMAT, TVÅ SKRIVARE: appen känner aldrig nycklarna.
 *
 * @param {object} p
 * @param {string} p.id Inbjudans id (64 hextecken).
 * @param {string} p.sessionsnyckel
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void } | null} [p.lagring] Förval `localStorage`; `null` ger bara minne.
 * @returns {boolean} Sann när sessionen kunde skrivas till enhetens minne. Falsk när minnet är blockerat (privat läge): sidan på `/gast` hittar då ingen session.
 */
export function sparaGastSession({ id, sessionsnyckel, lagring }) {
  if (typeof id !== "string" || !GASTINBJUDNINGSIDFORM.test(id) || typeof sessionsnyckel !== "string" || !GASTNYCKELFORM.test(sessionsnyckel)) {
    throw new Error("sparaGastSession: id är en inbjudans id (64 hextecken) och sessionsnyckel en nyckel (43 tecken).");
  }
  const mem = minne(lagring);
  skrivSessionTillMinne(mem, id, sessionsnyckel);
  // Minnet svalde skrivningen om det inte går att läsa tillbaka ur enhetens eget lager (reserven gäller bara tills sidan lämnas).
  try {
    const l = lagring === undefined ? globalThis.localStorage : lagring;
    return l != null && l.getItem(sessionsnyckelFor(id)) === sessionsnyckel;
  } catch {
    return false;
  }
}
