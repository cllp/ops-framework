import { useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { definierade, forvalda } from "../lib/ord.js";
import { PUBLIK_KLASS } from "../lib/publikKlass.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";

/**
 * Kodfältet på en publik delningssida (0.125.0, cllp/lifehub.app#377): det som visas när länken har en kod, för en fil och för en händelse.
 *
 * ══ ⛔ ETT FORMULÄR FÖR BÅDA SIDORNA (regel 2) ═════════════════════════════════════════════════════════════════════════
 *
 * `OpsDelad` (en fil) och `OpsDeladHandelse` (en händelse) ritar samma kodruta med samma ord. Sidan vet inte om koden är rätt: den skickar
 * texten till appen (`onKod`), appen frågar servern (`hamta(ref, { kod })`) och ger sidan ett nytt svar. Ett fel svar kommer tillbaka som `orsak`
 * `fel-kod` eller `for-manga`, och står kvar tills koden ändras.
 *
 * ⛔ KODEN SPARAS INTE I SIDAN. Den ligger i fältet medan personen skriver och lämnar komponenten via `onKod`, och inte via adressen eller webbläsarens
 * minne. Fältet är ett vanligt textfält utan taligenkänning och utan autofyll: en kod är inget ett lösenordshanterarprogram ska tro sig känna igen.
 *
 * ⛔ EN TRYCKNING I TAGET. Medan svaret väntas är knappen spärrad, och ett dubbeltryck skickar inte två försök: servern räknar felaktiga koder per länk.
 *
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_DELADKOD = {
  rubrik: { sv: "Länken kräver en kod", en: "This link needs a code" },
  hjalp: { sv: "Koden har du fått av den som delade länken.", en: "You got the code from whoever shared the link." },
  etikett: { sv: "Kod", en: "Code" },
  knapp: { sv: "Öppna", en: "Open" },
  tom: { sv: "Skriv koden.", en: "Enter the code." },
  felKod: { sv: "Koden stämde inte", en: "The code was not right" },
  forManga: { sv: "För många försök. Vänta en stund och försök igen", en: "Too many attempts. Wait a while and try again" },
  kundeInte: { sv: "Det gick inte att kontrollera koden just nu. Försök igen.", en: "The code could not be checked right now. Try again." },
};

/**
 * @param {object} props
 * @param {"kod-kravs" | "fel-kod" | "for-manga" | string} props.orsak Vad servern svarade. `fel-kod` och `for-manga` skriver ut sin text.
 * @param {(kod: string) => void | Promise<void>} props.onKod Appen frågar servern med koden och ger sidan ett nytt svar.
 * @param {string} [props.sprak] `sv` eller `en`.
 * @param {Partial<Record<keyof typeof ORD_DELADKOD, string>>} [props.ord] Egna texter, som vinner över ordboken.
 * @param {boolean} [props.rubrikIHuvud] Rubriken som `h1` (sidan har ingen annan rubrik) och inte som `h2`.
 * @param {boolean} [props.publik] Rubriken och texten i de publika rollerna (`PUBLIK_KLASS`), för en sida som är en presentation (`OpsDeladHandelse`). Utelämnad: appens roller, som `OpsDelad`.
 */
export function DeladKod({ orsak, onKod, sprak = "sv", ord, rubrikIHuvud = true, publik = false }) {
  if (typeof onKod !== "function") throw new Error("DeladKod: onKod krävs, en funktion som tar emot koden.");
  const t = { ...forvalda(ORD_DELADKOD, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const [kod, setKod] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [lokaltFel, setLokaltFel] = useState("");
  // ⛔ EN REF OCH INTE BARA `skickar`: två tryck i samma tick ser samma state.
  const pagar = useRef(false);
  const Rubrik = rubrikIHuvud ? "h1" : "h2";

  async function skicka(/** @type {{ preventDefault: () => void }} */ e) {
    e.preventDefault();
    if (pagar.current) return;
    if (kod.trim() === "") {
      setLokaltFel(t.tom);
      return;
    }
    pagar.current = true;
    setLokaltFel("");
    setSkickar(true);
    try {
      await onKod(kod);
    } catch {
      setLokaltFel(t.kundeInte);
    } finally {
      pagar.current = false;
      setSkickar(false);
    }
  }

  const serverFel = orsak === "fel-kod" ? t.felKod : orsak === "for-manga" ? t.forManga : "";
  const fel = lokaltFel || serverFel;
  return (
    <form data-delad-kod={orsak} onSubmit={skicka} noValidate className="flex w-full max-w-md flex-col gap-4">
      <Rubrik className={publik ? PUBLIK_KLASS.sida : "m-0 text-sida text-ink"}>{t.rubrik}</Rubrik>
      <p className={cx(publik ? PUBLIK_KLASS.brod : "m-0 text-etikett text-ink-secondary")}>{t.hjalp}</p>
      <OpsField label={t.etikett} error={fel || undefined}>
        <OpsInput value={kod} onChange={setKod} autoComplete="off" tal={false} />
      </OpsField>
      <div>
        <OpsButton type="submit" variant="primary" busy={skickar}>
          {t.knapp}
        </OpsButton>
      </div>
    </form>
  );
}
