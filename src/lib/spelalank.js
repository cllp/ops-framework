/**
 * Spela-länken: `?spela=1` på en ljudposts adress öppnar posten och startar spelaren (0.234.0, cllp/lifehub.app#860, L4).
 *
 * ══ ⛔ HÄNDELSEN ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-16 ville att agenten ska kunna ge "länkar direkt till kanske att spela upp en låt". Postens adress öppnade spelaren men
 * startade den inte. Med `spela=1` startar detaljen spåret när adressen är klar. Trycket på länken räknas som personens handling, och då
 * brukar webbläsaren tillåta uppspelningen. Det är en **hypotes** för iPhone: säger webbläsaren nej står det tydligt att man trycker på
 * Spela, med knappen i fokus (regel 5, `OpsBibliotek`).
 *
 * ⛔ PARAMETERN TAS BORT UR ADRESSEN NÄR DEN ANVÄNTS, så att en omladdning inte startar låten igen.
 *
 * Ren, utan `window`: adressen skickas in.
 */

/** Parametern, och värdet som betyder "starta". */
export const SPELA_PARAMETER = "spela";

/**
 * Ber adressens fråga om att posten `postId` ska spelas? Bara `spela=1` tillsammans med `post=<postId>`: en spela-parameter för en annan
 * post startar inte den här.
 * @param {string} sok `location.search`, med eller utan `?`.
 * @param {string} postId
 */
export function spelaBegard(sok, postId) {
  if (typeof sok !== "string" || !postId) return false;
  const p = new URLSearchParams(sok.startsWith("?") ? sok.slice(1) : sok);
  return p.get(SPELA_PARAMETER) === "1" && p.get("post") === postId;
}

/**
 * Adressen utan `spela`, resten orört. Hel eller relativ adress in, samma form ut.
 * @param {string} href
 */
export function utanSpela(href) {
  const hel = /^https?:\/\//i.test(href);
  const u = new URL(href, "https://x.invalid");
  u.searchParams.delete(SPELA_PARAMETER);
  const fraga = u.searchParams.toString();
  const rest = `${u.pathname}${fraga ? `?${fraga}` : ""}${u.hash}`;
  return hel ? `${u.origin}${rest}` : rest;
}

/**
 * Postens länk som spela-länk: `&spela=1` (eller `?spela=1`) läggs till. För appen och agenten, som har postens länk (`bibliotekslank`).
 * @param {string} lank
 */
export function medSpela(lank) {
  if (typeof lank !== "string" || lank === "") throw new Error("medSpela: lank krävs, postens länk.");
  const hel = /^https?:\/\//i.test(lank);
  const u = new URL(lank, "https://x.invalid");
  u.searchParams.set(SPELA_PARAMETER, "1");
  const rest = `${u.pathname}?${u.searchParams.toString()}${u.hash}`;
  return hel ? `${u.origin}${rest}` : rest;
}
