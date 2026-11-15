/**
 * Vad Sentry får se (ops-framework/sentry). Ren logik utan SDK, så att den går att pröva utan `@sentry/browser`.
 *
 * ══ ⛔ HÄNDELSEN ══════════════════════════════════════════════════════════════════════════════════════════════════════
 * 2026-11-15, granskningen av lifehub.app PR 845 (Sentry i My och SessionStudio): `sentryMottagare` körde `Sentry.init` med SDK:ns
 * förval. Då följer brödsmulorna med varje fel, alltså konsolrader, navigeringar och anrop med hela adressen, och adressen på sidan står
 * i `request.url`. En adress med en inloggningskod (`?lh_kod=`) eller en konsolrad med sagd text hade hamnat hos en tredje part.
 * Det mättes aldrig att det hänt, eftersom Sentry inte var på. Därför byggs skyddet innan det slås på.
 *
 * ══ REGELN ══════════════════════════════════════════════════════════════════════════════════════════════════════════
 *   - Varje adress skickas utan fråga och ankare: sidans (`request.url`), brödsmulornas (`url`, `from`, `to`) och felets ramar lämnas,
 *     eftersom de är kodens filer och inte personens.
 *   - Inga konsolbrödsmulor. Konsolen bär det appen loggar, och det kan vara vad som helst.
 *   - `request` bär varken cookies, huvuden eller frågesträng.
 *   - `sendDefaultPii: false` uttryckligen, så att ett ändrat förval i SDK:n inte ändrar vad som skickas.
 *   - Adresser inne i fri text (felets meddelande och värde, brödsmulans text) rensas på samma sätt, och användarnamn och lösenord i
 *     en adress tas bort (granskningen av PR 600).
 *   - ⛔ `extra` (appens `sammanhang`) rensas INTE: det är appens ansvar att aldrig lägga en kod eller en sagd text där.
 */

/**
 * Adressen utan fråga och ankare. En sträng som inte är en adress lämnas som den är, utan det som följer `?` eller `#`.
 * @param {unknown} adress
 * @returns {unknown}
 */
export function utanFraga(adress) {
  if (typeof adress !== "string") return adress;
  const slut = adress.search(/[?#]/);
  return utanInloggning(slut === -1 ? adress : adress.slice(0, slut));
}

/**
 * Användarnamn och lösenord i en adress (`https://namn:losen@host`) tas bort.
 * @param {string} text
 * @returns {string}
 */
function utanInloggning(text) {
  return text.replace(/(\w+:\/\/)[^/\s@]+@/g, "$1");
}

/**
 * En fri text (felets meddelande, en brödsmulas text) med varje adress i den rensad som ovan. Granskningen av ops-framework PR 600:
 * ett fel som "Failed to fetch https://x?lh_kod=..." bär adressen i texten och inte i ett adressfält.
 * @param {unknown} text
 * @returns {unknown}
 */
export function rensaText(text) {
  if (typeof text !== "string") return text;
  return utanInloggning(text.replace(/(\w+:\/\/[^\s?#]*)[?#][^\s"'<>)]*/g, "$1"));
}

/**
 * Brödsmulan som får följa med, eller `null` när den inte får det.
 * @param {any} smula
 * @returns {any}
 */
export function rensaBrodsmula(smula) {
  if (!smula || smula.category === "console") return null;
  const ut = "message" in smula ? { ...smula, message: rensaText(smula.message) } : { ...smula };
  if (smula.data && typeof smula.data === "object") {
    const data = { ...smula.data };
    for (const nyckel of ["url", "from", "to"]) if (nyckel in data) data[nyckel] = utanFraga(data[nyckel]);
    ut.data = data;
  }
  return ut;
}

/**
 * Händelsen som får skickas: sidans adress utan fråga, ingen cookie, inga huvuden, och brödsmulorna rensade som ovan.
 * @param {any} handelse
 * @returns {any}
 */
export function rensaHandelse(handelse) {
  if (!handelse) return handelse;
  const ut = { ...handelse };
  if (ut.request) {
    const { cookies: _c, headers: _h, query_string: _q, ...resten } = ut.request;
    ut.request = { ...resten, url: utanFraga(resten.url) };
  }
  if (Array.isArray(ut.breadcrumbs)) ut.breadcrumbs = ut.breadcrumbs.map(rensaBrodsmula).filter(Boolean);
  if ("message" in ut) ut.message = rensaText(ut.message);
  if (ut.exception && Array.isArray(ut.exception.values)) {
    ut.exception = { ...ut.exception, values: ut.exception.values.map((/** @type {any} */ v) => ({ ...v, value: rensaText(v.value) })) };
  }
  return ut;
}

/**
 * Det `Sentry.init` får. Allt som styr vad som skickas står här och provas här.
 * @param {{ dsn: string, miljo: string, version?: string }} konfig
 */
export function sentryInitAlternativ({ dsn, miljo, version }) {
  return {
    dsn,
    environment: miljo,
    release: version,
    sendDefaultPii: false,
    beforeSend: rensaHandelse,
    beforeBreadcrumb: rensaBrodsmula,
  };
}
