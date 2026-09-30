import { cx } from "../lib/cx.js";

/**
 * Rollmärket på en händelse: "Du", "Förfaller", "Agent". VEM som ska göra något, i samma form som brådskans "Försenat".
 *
 * ══ ⛔ VARFÖR DET FINNS (0.32.1) ══════════════════════════════════════════
 *
 * CP 2026-09-30 08:04: "Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio."
 * bolag-ops hade TRE handskrivna kopior av samma piller (EventsView, ProcessView, ScheduleView), och de hade redan
 * glidit isär: `py-1` på ett ställe, `py-0.5` på ett annat, `text-xs` där ramverket har rollen `meta`. Rollpillret och
 * "Försenat" står bredvid varandra på samma rad, så en halv pixel skillnad i höjd syns som två olika sorters märken.
 *
 * ⛔ SAMMA MÅTT SOM "FÖRSENAT", UR SAMMA KONSTANT. `ROLLMARKE_MATT` används av `OpsEventList` för brådskemärket
 * också. Två kopior av en klassrad glider isär första gången någon rättar den ena (arbetsreglernas punkt 2).
 *
 * ⛔ INTE `OpsPill`. Pillrets fem toner är en severitet (neutral, success, warning, danger, info), och en roll är
 * inte en severitet: att låna en färg som betyder "fel" för att säga "agent" lär läsaren att färgen inte betyder något.
 * Färgerna är proveniensens (`--color-human`, `--color-agent`, `--color-auto`), samma som `OpsProvenance`.
 *
 * ⛔ ORDET ÄR APPENS OCH KRÄVS. Ramverket vet inte att "human" betyder "Du" i en app och "Granskare" i nästa, och en
 * färgad ruta utan ord bär betydelsen i färgen ensam.
 */

/**
 * Måtten som rollmärket och brådskemärket ("Försenat") delar: 10 px, 500, px-1.5 py-0.5, helt rundat (0.33.1).
 * ⛔ 0.33.1: BESLUTET ÄNDRAT. Före 0.33.1 var det 12 px, 600, px-2 py-0.5 (`text-meta font-semibold`). CP 2026-09-30 i #187 bad om att
 * händelsernas text ska matcha inkorgen, där typpillret är `OpsPill size="liten"` (10/500, `px-1.5 py-0.5`). Märkena står bredvid
 * pillren i samma rad och ska ha samma storlek.
 */
export const ROLLMARKE_MATT = "shrink-0 rounded-full px-1.5 py-0.5 text-liten font-medium";

const KIND = {
  human: "bg-human-bg text-human",
  agent: "bg-agent-bg text-agent",
  auto: "bg-auto-bg text-auto",
};

/**
 * @param {object} props
 * @param {"human"|"agent"|"auto"} props.kind Vem rollen är.
 * @param {import("react").ReactNode} props.label Appens ord, till exempel "Du" eller "Förfaller".
 */
export function OpsRollmarke({ kind, label }) {
  const klass = KIND[kind];
  if (!klass) {
    throw new Error(`OpsRollmarke: okänt kind "${kind}". Giltiga: ${Object.keys(KIND).join(", ")}.`);
  }
  if (label === undefined || label === null || label === "") {
    throw new Error("OpsRollmarke: label krävs. En färgad ruta utan ord bär rollen i färgen ensam.");
  }
  return <span className={cx("inline-flex items-center", ROLLMARKE_MATT, klass)}>{label}</span>;
}
