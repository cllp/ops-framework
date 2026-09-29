import { useState } from "react";
import { ROLLER } from "../lib/grupp.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSelect } from "./OpsSelect.jsx";

/**
 * Medlemmarna i en grupp: lista, bjud in, ändra roll, ta bort.
 *
 * ══ ⛔ BARA ÄGAREN SER DEN, OCH DET ÄR EN ARTIGHET ════════════════════
 *
 * `kanAndra` kommer utifrån. ⛔ **Den här kontrollen är inte ett skydd**, samma
 * not som i `OpsKatalogInstallning`: den som vill skriva ändå öppnar konsolen.
 * Det riktiga låset är att `memberships` inte går att skriva från en klient
 * alls, och att callablen kontrollerar ägarskapet själv (#137).
 *
 * ══ ⛔ ALDRIG SIG SJÄLV ═══════════════════════════════════════════════
 *
 * Den som tar bort sitt eget ägarskap låser ut sig ur sin egen grupp, och det
 * finns ingen väg tillbaka utan en annan ägare. Raden för en själv har därför
 * ingen knapp, och `migUid` är obligatorisk just därför: utan den vet vyn inte
 * vilken rad som är ens egen, och då hade skyddet varit en gissning.
 *
 * ══ ⛔ INGET MEJL SKICKAS ═════════════════════════════════════════════
 *
 * Mailmodulen (#101) tar det när den finns. Tills dess står det i vyn att
 * personen behöver logga in, eftersom ett tyst utskick som inte sker är värre
 * än en mening som säger vad som gäller.
 *
 * @param {object} props
 * @param {{ medlemskap: import("../lib/grupp.js").Medlemskap, namn?: string, epost?: string }[]} props.medlemmar
 *   ⛔ `namn` och `epost` är VALFRIA och behövs inte längre: medlemskapet bär
 *   själv `namn` och `bild` sedan #138. Fälten står kvar för den som redan har
 *   uppgifterna i handen, och e-posten ritas bara för den som läser sin egen
 *   rad. Se noten om e-posten nedan.
 * @param {{ id: string, epost: string, roll: string }[]} [props.inbjudningar] Väntande, för att den som bjöd in ska se att det hänt.
 * @param {string} props.migUid
 * @param {boolean} [props.kanAndra]
 * @param {(b: { epost: string, roll: string }) => void | Promise<void>} [props.onBjudIn]
 * @param {(b: { userId: string, roll: string }) => void} [props.onAndraRoll]
 * @param {(b: { userId: string }) => void} [props.onTaBort]
 * @param {(b: { id: string }) => void} [props.onAterkalla]
 * @param {string} [props.rubrik]
 * @param {string} [props.epostEtikett]
 * @param {string} [props.rollEtikett]
 * @param {string} [props.bjudInEtikett]
 * @param {string} [props.taBortEtikett]
 * @param {string} [props.aterkallaEtikett]
 * @param {string} [props.vantarEtikett]
 * @param {string} [props.duEtikett]
 * @param {string} [props.ingaText]
 * @param {string} [props.mejlNot]
 * @param {Record<string, string>} [props.rollNamn]
 */
export function OpsMedlemmar({
  medlemmar,
  inbjudningar = [],
  migUid,
  kanAndra = false,
  onBjudIn,
  onAndraRoll,
  onTaBort,
  onAterkalla,
  rubrik = "Medlemmar",
  epostEtikett = "E-post",
  rollEtikett = "Roll",
  bjudInEtikett = "Bjud in",
  taBortEtikett = "Ta bort",
  aterkallaEtikett = "Återkalla",
  vantarEtikett = "Väntar",
  duEtikett = "Du",
  ingaText = "Gruppen har inga medlemmar än.",
  mejlNot = "Inget mejl skickas. Be personen logga in, så blir inbjudan ett medlemskap.",
  rollNamn = { agare: "Ägare", admin: "Admin", medlem: "Medlem" },
}) {
  if (typeof migUid !== "string" || !migUid) {
    throw new Error("OpsMedlemmar: migUid krävs. Utan den vet vyn inte vilken rad som är ens egen, och skyddet mot att ta bort sig själv blir en gissning.");
  }

  const [epost, setEpost] = useState("");
  const [roll, setRoll] = useState("medlem");

  /*
   * ⛔ INGEN EGEN `trim`, OCH DET ÄR ETT MUTATIONSFYND SOM GJORDE PROVET
   * STARKARE.
   *
   * Här stod `epost.trim()` på båda ställena. Svepet tog bort den och
   * ingenting blev rött: fältet är `type="email"`, och webbläsarens egen
   * värdesanering strippar inledande och avslutande blanksteg innan värdet ens
   * når `onChange`. Ingen inmatning kunde alltså skilja versionerna åt.
   *
   * ⛔ ATT TA BORT DEN GÖR PROVET TILL EN RIKTIG VAKT. Med en egen `trim` hade
   * ett byte av `type` till `text` passerat obemärkt, eftersom trimmen då tagit
   * över tyst. Utan den fäller provet "adressen kommer fram utan blanksteg"
   * exakt det bytet.
   */
  const bjudIn = async () => {
    if (!epost || !onBjudIn) return;
    await onBjudIn({ epost, roll });
    setEpost("");
  };

  const rollval = ROLLER.map((r) => ({ value: r, label: rollNamn[r] || r }));

  return (
    <>
      <p className="text-etikett font-semibold uppercase tracking-wide text-ink-secondary">{rubrik}</p>

      {medlemmar.length === 0 ? (
        <OpsEmpty title={ingaText} />
      ) : (
        <OpsList ariaLabel={rubrik}>
          {medlemmar.map(({ medlemskap, namn, epost: medlemsEpost }) => {
            const jag = medlemskap.userId === migUid;
            /*
             * ⛔ NAMNET KOMMER UR MEDLEMSKAPET FÖRST (#138, beslut A).
             * `users` läses bara av sig själv, så en lista som byggde på
             * profiler hade visat en rad och sedan tomma rutor för alla
             * andra. Medlemskapet bär namnet denormaliserat, och det är den
             * enda källan som är läsbar för hela gruppen.
             *
             * ⛔ E-POSTEN RITAS INTE. Den lämnar aldrig `users`, och att
             * anroparen kan råka ha sin egen i handen gör den inte till något
             * listan ska visa. Uid:t är sista utvägen och betyder "den här
             * raden skrevs innan namnet fanns".
             */
            const visningsnamn = medlemskap.namn || namn || medlemsEpost || medlemskap.userId;
            return (
              <OpsListRow key={medlemskap.id}>
                <OpsIdentity name={visningsnamn} seed={medlemskap.userId} imageUrl={medlemskap.bild || undefined} size="sm" />
                <span className="min-w-0 flex-1 truncate text-ink">{visningsnamn}</span>
                {jag ? <OpsPill tone="neutral">{duEtikett}</OpsPill> : null}
                {kanAndra && !jag && onAndraRoll ? (
                  <OpsSelect
                    options={rollval}
                    value={medlemskap.roll}
                    onChange={(v) => onAndraRoll({ userId: medlemskap.userId, roll: v })}
                    ariaLabel={`${rollEtikett}, ${visningsnamn}`}
                  />
                ) : (
                  <OpsPill tone={medlemskap.roll === "agare" ? "info" : "neutral"}>{rollNamn[medlemskap.roll] || medlemskap.roll}</OpsPill>
                )}
                {/* ⛔ Ingen knapp på sin egen rad. Se noten i filhuvudet. */}
                {kanAndra && !jag && onTaBort ? (
                  <OpsButton variant="ghost" size="sm" onClick={() => onTaBort({ userId: medlemskap.userId })}>
                    {taBortEtikett}
                  </OpsButton>
                ) : null}
              </OpsListRow>
            );
          })}
        </OpsList>
      )}

      {/* ⛔ Väntande inbjudningar syns, annars ser det ut som att ingenting
          hände när man bjöd in någon som inte loggat in än. */}
      {inbjudningar.length > 0 ? (
        <OpsList ariaLabel={vantarEtikett}>
          {inbjudningar.map((i) => (
            <OpsListRow key={i.id}>
              <span className="min-w-0 flex-1 truncate text-ink-secondary">{i.epost}</span>
              <OpsPill tone="warning">{vantarEtikett}</OpsPill>
              <OpsPill tone="neutral">{rollNamn[i.roll] || i.roll}</OpsPill>
              {kanAndra && onAterkalla ? (
                <OpsButton variant="ghost" size="sm" onClick={() => onAterkalla({ id: i.id })}>
                  {aterkallaEtikett}
                </OpsButton>
              ) : null}
            </OpsListRow>
          ))}
        </OpsList>
      ) : null}

      {kanAndra && onBjudIn ? (
        <>
          <OpsField label={epostEtikett} hint={mejlNot}>
            <OpsInput value={epost} onChange={setEpost} type="email" placeholder="namn@example.com" />
          </OpsField>
          <OpsField label={rollEtikett}>
            <OpsSelect options={rollval} value={roll} onChange={setRoll} />
          </OpsField>
          <div>
            <OpsButton variant="primary" onClick={bjudIn} disabled={!epost}>
              {bjudInEtikett}
            </OpsButton>
          </div>
        </>
      ) : null}
    </>
  );
}
