import { DELNINGSORSAKER, delningsfel } from "../lib/delning.js";
import { DeladFil } from "./DeladFil.jsx";
import { DeladKod } from "./DeladKod.jsx";
import { DeladLista } from "./DeladLista.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";

/**
 * Den publika vyn av en delad post: det en mottagare ser på `/g/<adress>` (eller `/d/<token>` för en gammal länk), utan inloggning (0.119.0, lifehub.app#356).
 *
 * ══ ⛔ FYRA TYPER, EN VY (0.133.0) ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-18: "Vi skall ju ha en publik länk till varje artefakt." `delning.typ` avgör vad som ritas: `anteckning` (rubriken och texten, i den typografi biblioteket läser den i),
 * `lank` (rubriken och en tydlig knapp till adressen, som öppnas i en ny flik), `lista` (en spellista, se `DeladLista`) och allt annat är en fil (`ljud`, `bild`, `video`, `pdf`,
 * `dokument`) och ritas som förut (`DeladFil`). Vyn läser bara fälten servern svarar med och har ingen egen regel för vad som får visas.
 *
 * ⛔ EN LÄNKS KNAPP FINNS BARA FÖR EN HTTP- ELLER HTTPS-ADRESS. Servern släpper bara igenom sådana, men vyn tror inte på det: en adress som blivit något annat får ingen knapp,
 * och adressen står som text så att den går att läsa av den som vill skriva av den.
 *
 * ══ ⛔ VYN RITAR VAD SERVERN SVARAR OCH INGET MER ═══════════════════════════════════════════════════════════════════════
 *
 * `delning` är `hamta().delning` ur `createDelningService`: rubrik, typ, mime, storlek, längd, våg, om nedladdning är på och en
 * signerad adress. Vyn läser aldrig en grupp, ett namn eller en sökväg, för de finns inte i svaret. Och den har ingen egen
 * regel för vem som får se vad: en länk som inte går att visa är ett `orsak`, och texten kommer ur `delningsfel`.
 *
 * ⛔ ETT AV TRE LÄGEN, OCH ETT FEL KASTAS. `delning`, `orsak` eller `laddar`. Ingen av dem, eller flera, är ett fel i anropet: en
 * tom yta ser ut som en länk som är trasig, och två lägen samtidigt hade låtit det ena vinna tyst (regel 5).
 *
 * ══ ⛔ NEDLADDNING ÄR EN KNAPP SOM FINNS ELLER INTE ═══════════════════════════════════════════════════════════════════
 *
 * "Ladda ner" ritas bara när `delning.nedladdning` är sant, och ljudspelarens egen länk döljs då den är av (`utanNedladdning`).
 * Det är en beställning om vad vyn erbjuder, och inte ett skydd: adressen går att läsa ur sidan. Den signerade adressen är därför
 * också skapad med `Content-Disposition: inline` när nedladdning är av, så en direktlänk visas och sparas inte av sig själv.
 *
 * ══ ⛔ ADRESSEN GÅR UT, OCH VYN BER OM EN NY (`onNyUrl`) ═══════════════════════════════════════════════════════════════
 *
 * Den signerade adressen gäller i 15 minuter. Ger filen ett fel (ljudet, bilden, videon) anropas `onNyUrl` EN gång per adress, och
 * appen hämtar länken igen och ger vyn ett nytt `delning`. Ger också den nya adressen fel visas felet i stället för att vyn ber
 * igen och igen: en loop mot servern är värre än en bild som inte kom.
 *
 * ⛔ EN `<video>` UTAN `controls`. Webbläsarens egna kontroller ser olika ut överallt och kan inte bära temat (`check-webblasarkontroller`
 * fäller de ostylade kontrollerna). Spelknapp, tid och spolning är ramverkets: en knapp, en tid och `.ops-reglage`.
 *
 * ⛔ BARA RAMVERKETS TEMA. Inga egna färger eller mått här, bara klasser ur tokenkontraktet. Skalet runt (logga, grupp, språk) är
 * appens: vyn är innehållet.
 *
 * @param {object} props
 * @param {import("./DeladFil.jsx").DeladFilSvar | { typ: "anteckning", rubrik: string, text: string } | { typ: "lank", rubrik: string, url: string } | { typ: "lista", rubrik: string, nedladdning?: boolean, ejVisade?: number, poster: ReadonlyArray<any> } | null} [props.delning] Länken går att visa. `typ` säger vad: `anteckning`, `lank`, `lista` eller en fils (`ljud`, `bild`, `video`, `pdf`, `dokument`).
 * @param {string} [props.orsak] Länken går inte att visa: `utgangen`, `stangd` eller `saknas` (`DELNINGSORSAKER`). En okänd orsak får texten för `utgangen`.
 * @param {boolean} [props.laddar] Länken hämtas.
 * @param {() => void | Promise<void>} [props.onNyUrl] Filen kunde inte läsas, troligen för att adressen gått ut. Appen hämtar länken igen och ger ett nytt `delning`. För en lista är det den NYA listan: servern läser om den vid varje hämtning.
 * @param {(kod: string) => void | Promise<void>} [props.onKod] (0.125.0) Koden som personen skrev. Med den ritas kodrutan när orsaken är `kod-kravs`, `fel-kod` eller `for-manga` (en fillänk kan ha en kod
 *   sedan 0.125.0); appen frågar servern med koden (`hamta(ref, { kod })`) och ger vyn ett nytt svar. Utan den står orsaken som text.
 * @param {string} [props.sprak] (0.125.0) `sv` eller `en`, för kodrutan. Förval: språket i `OpsSprakProvider`. Resten av vyn är svensk som förut.
 */
export function OpsDelad({ delning = null, orsak, laddar = false, onNyUrl, onKod, sprak }) {
  const kontextSprak = useOpsSprak();
  const lagen = [Boolean(delning), orsak !== undefined, laddar].filter(Boolean).length;
  if (lagen !== 1) {
    throw new Error("OpsDelad: ge precis en av delning, orsak och laddar. Ingen av dem är en tom yta, flera är två sanningar om samma länk.");
  }
  if (onNyUrl !== undefined && typeof onNyUrl !== "function") {
    throw new Error("OpsDelad: onNyUrl ska vara en funktion.");
  }
  if (onKod !== undefined && typeof onKod !== "function") {
    throw new Error("OpsDelad: onKod ska vara en funktion.");
  }
  if (laddar) return <OpsEmpty busy title="Hämtar filen" busyLabel="Hämtar filen" />;
  if (orsak !== undefined) {
    const kand = /** @type {readonly string[]} */ (DELNINGSORSAKER).includes(orsak);
    if (onKod && (orsak === "kod-kravs" || orsak === "fel-kod" || orsak === "for-manga")) {
      return <DeladKod orsak={orsak} onKod={onKod} sprak={sprak ?? kontextSprak} />;
    }
    return (
      <div data-delad="fel" data-delad-orsak={kand ? orsak : "utgangen"}>
        <OpsEmpty title={delningsfel(orsak)} />
      </div>
    );
  }
  const d = /** @type {NonNullable<typeof delning>} */ (delning);
  if (d.typ === "anteckning") return <DeladAnteckning delning={/** @type {{ rubrik: string, text: string }} */ (d)} />;
  if (d.typ === "lank") return <DeladLank delning={/** @type {{ rubrik: string, url: string }} */ (d)} />;
  if (d.typ === "lista") return <DeladLista delning={/** @type {any} */ (d)} onNyUrl={onNyUrl} />;
  return <DeladFil delning={/** @type {import("./DeladFil.jsx").DeladFilSvar} */ (d)} onNyUrl={onNyUrl} />;
}

/**
 * En delad anteckning: rubriken och texten, som biblioteket läser den (`OpsMarkdown`, ingen HTML tolkas).
 * @param {{ delning: { rubrik: string, text: string } }} props
 */
function DeladAnteckning({ delning }) {
  return (
    <article data-delad="anteckning" className="flex min-w-0 w-full flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 data-delad-rubrik="" className="m-0 text-sida text-ink wrap-anywhere">{delning.rubrik}</h1>
        <p data-delad-meta="" className="m-0 text-meta text-ink-muted">Anteckning</p>
      </header>
      <div data-delad-text="" className="max-w-las">
        {delning.text ? <OpsMarkdown text={delning.text} dokument /> : <p className="m-0 text-brod text-ink-secondary">Anteckningen har ingen text.</p>}
      </div>
    </article>
  );
}

/**
 * En delad länk: rubriken och en tydlig knapp till adressen. Adressen står också som text.
 * @param {{ delning: { rubrik: string, url: string } }} props
 */
function DeladLank({ delning }) {
  const oppnas = typeof delning.url === "string" && /^https?:\/\/[!-~]+$/.test(delning.url);
  return (
    <article data-delad="lank" className="flex min-w-0 w-full flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 data-delad-rubrik="" className="m-0 text-sida text-ink wrap-anywhere">{delning.rubrik}</h1>
        <p data-delad-meta="" className="m-0 text-meta text-ink-muted">Länk</p>
      </header>
      <p data-delad-adress="" className="m-0 text-brod text-ink-secondary wrap-anywhere">{delning.url}</p>
      {oppnas ? (
        <div>
          <OpsButton variant="primary" href={delning.url} newTab ariaLabel={`Öppna länken ${delning.rubrik}`}>Öppna länken</OpsButton>
        </div>
      ) : null}
    </article>
  );
}

