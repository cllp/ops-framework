/**
 * Gästens kalender som data: vilka händelser som visas, i vilken ordning, och hur en händelse blir en post i ramverkets kalender (0.257.0, cllp/lifehub.app#890).
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP godkände 18 nov en riktig kalendervy i gästvyn: Lista, Månad och Vecka, ett filter på händelsetyp, valet Visa passerade, och typens ikon och färg i både listan och kalendern
 * "med en gemensam rendering". Före 0.257.0 var gästens kalender bara en lista över det som är på gång (0.190.0), och urvalet och ordningen stod inne i `OpsGastGrupp`.
 *
 * ⛔ EN SANNING FÖR ALLA TRE LÄGENA (regel 2). Filtret och Visa passerade gäller listan, månaden och veckan likadant, och typens ord, färg och ikon räknas här en gång. Hade
 * listan och kalendern valt var för sig hade ett byte av läge kunnat visa andra händelser, och den som bytt hade inte kunnat se varför.
 *
 * ⛔ REN LOGIK, INGEN JSX. Ikonen är appens (`ritaTypIkon` i `OpsGastGrupp`) och läggs på i vyn.
 */

/** Gästkalenderns lägen, i växelns ordning. Värdet som sparas på enheten är bara ett av de här orden. */
export const GASTKALENDERLAGEN = /** @type {const} */ (["lista", "manad", "vecka"]);

/**
 * @typedef {object} Gasthandelsetyp En rad ur `kalender`-svarets `typer` (`GASTHANDELSETYPFALT`).
 * @property {string} id
 * @property {{ sv: string, en?: string }} namn
 * @property {string | null} [ikon] Ikonens namn, som appen ritar.
 * @property {1 | 2 | 3 | null} [farg] Platsen i slagpaletten.
 */

/**
 * Typens ord på gästens språk. Engelskan faller tillbaka på svenskan, eftersom en typ CP lagt till har ett namn och inte alltid två (katalogen kräver bara ett).
 * @param {Gasthandelsetyp} typ @param {string} sprak @returns {string}
 */
export function typNamn(typ, sprak) {
  return (sprak === "en" && typ.namn.en) || typ.namn.sv;
}

/**
 * Händelserna gästen ser med filtret och Visa passerade, i kalenderns ordning: först de utan datum (en omröstning om dagen, som väntar på gästens röst), sedan i tidsordning, heldag
 * före klockslag samma dag.
 *
 * ⛔ PASSERAT ÄR EN HÄNDELSE SOM SLUTADE FÖRE IDAG. En resa som började i förrgår och slutar i morgon är på gång. Utan `visaPasserade` visas inte det som varit, som i listan sedan 0.190.0.
 * ⛔ ETT TOMT TYPVAL ÄR ALLA TYPER. Ett val utesluter händelser utan typ, eftersom de inte är någon av de valda.
 * @template {{ id: string, datum?: string | null, slutDatum?: string | null, tid?: string | null, heldag?: boolean, typ?: string | null }} H
 * @param {ReadonlyArray<H>} handelser
 * @param {{ idag: string, visaPasserade?: boolean, valdaTyper?: ReadonlyArray<string> }} val `idag` som `YYYY-MM-DD`.
 * @returns {H[]}
 */
export function gastkalenderUrval(handelser, { idag, visaPasserade = false, valdaTyper = [] }) {
  const typer = new Set(valdaTyper);
  const urval = handelser.filter((h) => (typer.size === 0 || (typeof h.typ === "string" && typer.has(h.typ))) && (!h.datum || visaPasserade || String(h.slutDatum ?? h.datum) >= idag));
  const utanDatum = urval.filter((h) => !h.datum);
  const daterade = urval
    .filter((h) => h.datum)
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || (a.heldag ? -1 : 0) - (b.heldag ? -1 : 0) || String(a.tid ?? "").localeCompare(String(b.tid ?? "")) || String(a.id).localeCompare(String(b.id)));
  return [...utanDatum, ...daterade];
}

/**
 * Typerna i filtret: de som någon av händelserna har, i svarets ordning. En typ utan händelse är inget att välja.
 * @param {ReadonlyArray<Gasthandelsetyp>} typer @param {ReadonlyArray<Record<string, any>>} handelser @returns {Gasthandelsetyp[]}
 */
export function typerIFiltret(typer, handelser) {
  const iBruk = new Set(handelser.map((h) => h.typ).filter(Boolean));
  return typer.filter((t) => iBruk.has(t.id));
}

/**
 * Typens visning: slaget (färgen) med sitt ord och ikonens namn, eller `null` när händelsen saknar typ (neutral stil). Samma svar för raden i listan och posten i kalendern.
 * @param {string | null | undefined} typId @param {ReadonlyMap<string, Gasthandelsetyp>} typer @param {string} sprak
 * @returns {{ id: string, ord: string, slag?: 1 | 2 | 3, ikon?: string } | null}
 */
export function typVisning(typId, typer, sprak) {
  const t = typId ? typer.get(typId) : undefined;
  if (!t) return null;
  return { id: t.id, ord: typNamn(t, sprak), ...(t.farg ? { slag: t.farg } : {}), ...(t.ikon ? { ikon: t.ikon } : {}) };
}

/**
 * En daterad händelse som en post i `OpsCalendar` (`CalendarEntry`), utan ikon: den läggs på i vyn. `handelseId` öppnar händelsens panel, som ett tryck i listan.
 * ⛔ INGET `typ` PÅ POSTEN. Gästens filter har redan valt (`gastkalenderUrval`), och kalenderns eget typfilter och dess apprad (`apparFor`, som läser postens `typ`) hade blivit ett andra filter.
 * @param {{ id: string, titel: string, datum: string, slutDatum?: string | null, tid?: string | null, heldag?: boolean }} h
 * @param {ReturnType<typeof typVisning>} typ
 * @param {string} not Raden under titeln i dagpanelen (när, och typens ord).
 * @returns {import("./calendar.js").CalendarEntry}
 */
export function gastPost(h, typ, not) {
  return {
    id: h.id,
    date: h.datum,
    title: h.titel,
    handelseId: h.id,
    not,
    ...(h.slutDatum && h.slutDatum > h.datum ? { endDate: h.slutDatum } : {}),
    ...(h.heldag ? { allDay: /** @type {const} */ (true) } : {}),
    ...(!h.heldag && h.tid ? { tid: h.tid } : {}),
    ...(typ && typ.slag ? { slag: typ.slag, slagLabel: typ.ord } : {}),
  };
}
