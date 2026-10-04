import { cx } from "../lib/cx.js";
import { text } from "../lib/sprak.js";
import { BockIkon, ChevronHogerIkon } from "./icons.jsx";

/**
 * Hubbarna: instanserna personen får öppna, ovanför grupperna (0.52.0, cllp/lifehub.app#27).
 *
 * ══ ⛔ TVÅ NIVÅER SOM SKA SYNAS SOM TVÅ ═══════════════════════════════════════
 *
 * CP 2026-10-04: "Var går jag ut och väljer fler hubbar", och om mobilen: "där är det precis på samma plats som man
 * switchar grupper, inte hubbar." En hubb är en egen instans med egen data (MY HUB, MUSIC HUB); en grupp är ett
 * sammanhang inne i en hubb. Listan står därför ÖVERST, med sin egen rubrik, och grupperna under en rubrik som säger
 * vilken hubb de hör till. Ett ark där båda såg ut som rader i samma lista hade låtit en grupp i My se ut att ligga i
 * Music.
 *
 * ⛔ EN ANNAN HUBB ÄR EN LÄNK, INTE EN KNAPP MED EN FUNKTION. Att byta hubb är att gå till en annan instans, och det
 * går via Identity (`href` är appens, ofta `<identity>/?open=<id>`). Ramverket vet inte vart, och ska inte veta det:
 * "Ramverket känner aldrig projekt-id eller samlingsnamn. Appen skickar in dem."
 *
 * ⛔ DEN AKTIVA HUBBEN ÄR INGEN LÄNK. Den bär `aria-current` och en bock; en länk till sidan man redan står på hade
 * laddat om appen och tappat det man gjorde.
 *
 * @typedef {object} OpsHubb
 * @property {string} id Instansens id, till exempel `my`.
 * @property {string | { sv: string, en?: string }} namn Det som står i listan, till exempel "MY HUB".
 * @property {string} [href] Vart en annan hubb öppnas. Krävs för alla utom den aktiva.
 *
 * @typedef {object} OpsHubbarna
 * @property {string} aktiv Den hubb appen ÄR. Måste finnas i `lista`.
 * @property {ReadonlyArray<OpsHubb>} lista
 * @property {string} [allaHref] Vart "Alla hubbar" leder, till exempel Identitys startsida. Utelämnad: ingen rad.
 * @property {string} [rubrik] Förval "Hubbar".
 * @property {string} [allaEtikett] Förval "Alla hubbar".
 * @property {string} [sprak]
 */

/**
 * Prövar formen och kastar med skälet. Samma prövning för arket och menyn, så de inte kan säga olika saker.
 *
 * @param {OpsHubbarna} hubbar
 */
export function provaHubbar(hubbar) {
  const lista = hubbar?.lista ?? [];
  if (lista.length === 0) throw new Error("OpsHubbar: lista är tom. Minst den aktiva hubben ska stå där, annars säger listan att appen inte finns.");
  if (!lista.some((h) => h.id === hubbar.aktiv)) {
    throw new Error(`OpsHubbar: den aktiva hubben "${hubbar.aktiv}" står inte i listan. En lista utan den hubb man står i säger fel om var man är.`);
  }
  for (const h of lista) {
    if (h.id !== hubbar.aktiv && !h.href) {
      throw new Error(`OpsHubbar: hubben "${h.id}" saknar href. En hubb man inte kan öppna är en rad som ser ut som en länk.`);
    }
  }
}

/** Den aktiva hubbens namn, i appens språk. @param {OpsHubbarna} hubbar */
export function aktivHubbNamn(hubbar) {
  const h = hubbar.lista.find((x) => x.id === hubbar.aktiv);
  return h ? text(h.namn, hubbar.sprak) : "";
}

const RAD = cx(
  "inline-flex min-h-11 items-center gap-2 rounded-base border px-3 py-2 text-etikett font-semibold",
  "transition-colors duration-(--duration-fast) ease-standard",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
);

/**
 * Listan: en rubrik och hubbarna på en rad som bryts, och "Alla hubbar" sist.
 *
 * @param {{ hubbar: OpsHubbarna }} props
 */
export function OpsHubblista({ hubbar }) {
  provaHubbar(hubbar);
  const rubrik = hubbar.rubrik ?? "Hubbar";
  const alla = hubbar.allaEtikett ?? "Alla hubbar";
  return (
    <section aria-label={rubrik} data-hubbar="">
      <h2 className="m-0 mb-2 text-meta font-semibold uppercase tracking-wide text-ink-secondary">{rubrik}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {hubbar.lista.map((h) => {
          const namn = text(h.namn, hubbar.sprak);
          const vald = h.id === hubbar.aktiv;
          return (
            <li key={h.id}>
              {vald ? (
                <span aria-current="true" className={cx(RAD, "border-accent bg-accent/10 text-ink")}>
                  {namn}
                  <BockIkon size={14} />
                </span>
              ) : (
                <a href={h.href} className={cx(RAD, "border-line text-ink hover:bg-sunken")}>
                  {namn}
                </a>
              )}
            </li>
          );
        })}
        {hubbar.allaHref ? (
          <li>
            <a href={hubbar.allaHref} className={cx(RAD, "border-transparent text-accent hover:bg-sunken")}>
              {alla}
              <ChevronHogerIkon size={14} />
            </a>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
