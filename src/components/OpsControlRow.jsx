import { cx } from "../lib/cx.js";

/**
 * En rad kontroller ovanför det de styr.
 *
 * ══ ⛔ VARFÖR EN KOMPONENT FÖR SÅ LITE ═════════════════════════════════
 *
 * Den är tunn med flit, och skälet är inte att spara tecken. Vyerna skrev
 * raden själva, och skrev den olika: en rad hade `gap-2` och en annan inget
 * gap alls, en bröts vid för smal skärm och en sköt ut. Ingen av de
 * skillnaderna var beslutade. De uppstod för att varje vy löste samma sak en
 * gång till, och de upptäcktes först när CP höll telefonen bredvid datorn.
 *
 * ⛔ REGELN SOM BOR HÄR ÄR VAD SOM HÄNDER NÄR RADEN INTE RYMS: den BRYTS, den
 * krymper inte och den skjuter inte ut. En kontroll som krympt under sin egen
 * träffyta är värre än en som flyttat ner en rad, för den ser ut att gå att
 * trycka på.
 *
 * ══ ⛔ VAD DEN INTE LÖSER ══════════════════════════════════════════════
 *
 * Den hindrar inte en vy från att lägga sex saker i en rad som rymmer fyra.
 * Det är fortfarande vyns ansvar, och det är fortfarande något som måste MÄTAS
 * och inte antas. CP 2026-09-22: "Går det att ersätta rensa med ett kryss
 * eller nåt annat grepp som gör att allt får plats i en liten skärm?" Svaret
 * blev att flytta en kontroll till en annan rad, inte att göra raden smartare.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {"start" | "mitten"} [props.align] Var raden ligger. `mitten` som
 *   förval, eftersom en ensam kontroll över en lista hör hemma över listans
 *   mitt. `start` när raden bär FLERA kontroller: då är vänsterkanten den enda
 *   punkt som ligger still när en av dem byter bredd.
 */
export function OpsControlRow({ children, align = "mitten" }) {
  const klass = JUSTERINGAR[align];
  /*
   * ⛔ KASTAR I STÄLLET FÖR ATT FALLA TILLBAKA. En tyst reserv gör ett stavfel
   * till en rad som ser nästan rätt ut, och nästan rätt upptäcks aldrig.
   */
  if (!klass) {
    throw new Error(
      `OpsControlRow: okänd align "${align}". Giltiga: ${Object.keys(JUSTERINGAR).join(", ")}.`,
    );
  }
  return <div className={cx("flex flex-wrap items-center gap-2", klass)}>{children}</div>;
}

const JUSTERINGAR = /** @type {const} */ ({
  start: "justify-start",
  mitten: "justify-center",
});
