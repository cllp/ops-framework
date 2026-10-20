import { useState } from "react";
import { normaliseraGastepost } from "../lib/gast.js";
import { ROLLER } from "../lib/grupp.js";
import { forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { GastBekraftelse, gastFelText, OpsGastLista, ORD_OPSGASTLISTA } from "./OpsGastLista.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { usePersonnamn } from "./usePersonnamn.js";

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
 * @param {(b: { userId: string }) => void | Promise<unknown>} [props.onTaBort] Ger den ett löfte är knappen upptagen tills det är klart (0.129.0, `OpsButton`).
 * @param {(b: { id: string }) => void | Promise<unknown>} [props.onAterkalla] Samma: ett löfte gör knappen upptagen.
 * @param {string} [props.rubrik]
 * @param {string} [props.epostEtikett]
 * @param {string} [props.rollEtikett]
 * @param {string} [props.bjudInEtikett]
 * @param {string} [props.taBortEtikett]
 * @param {string} [props.aterkallaEtikett]
 * @param {string} [props.vantarEtikett]
 * @param {string} [props.duEtikett]
 * @param {string} [props.aiEtikett] Märket på en agents rad. Förval "AI", samma på båda språken.
 * @param {string} [props.ingaText]
 * @param {string} [props.mejlNot]
 * @param {Record<string, string>} [props.rollNamn]
 * @param {object} [props.gaster] (0.132.0, lifehub.app#389) **Gäster i hela gruppen, bjudna in härifrån.** Med den finns "Gäst (utan konto)" som ett val i Roll. Med Gäst valt visar rutan "X av 5 gratis platser"
 *   och ingressen om vad en gäst får se, knappen heter "Bjud in utan konto" och ett tryck öppnar bekräftelsen (gästen ser chattens hela historik, och det går inte att ta tillbaka) innan `onBjud` anropas.
 *   Väntande gäster står under de väntande inbjudningarna, med Skicka igen och Dra tillbaka (`OpsGastLista` utan rubrik). Raden under E-post säger att en adress utan Google-konto kan bjudas in som gäst
 *   (`mejlNotMedGast` eller ordboken; ersätter `mejlNot`). Ägare och admin bjuder in: `kanAndra` styr, och tjänsten prövar rollen igen.
 * @param {ReadonlyArray<import("./OpsGastLista.jsx").Person>} props.gaster.personer Tjänstens `lista({ groupId }).personer`.
 * @param {{ anvanda: number, totalt: number }} props.gaster.platser Tjänstens `lista({ groupId }).platser`.
 * @param {(inmatning: { epost: string, namn: string }) => void | Promise<unknown>} props.gaster.onBjud Efter bekräftelsen. Tjänstens `bjud({ slag: "grupp", groupId, epost })`.
 * @param {(arg: { id: string }) => void | Promise<unknown>} [props.gaster.onSkickaOm]
 * @param {(arg: { id: string }) => void | Promise<unknown>} [props.gaster.onAterkalla]
 * @param {(arg: { gastId: string }) => void | Promise<unknown>} [props.gaster.onAterkallaAlla]
 * @param {(arg: { gastId: string, epost: string }) => void | Promise<unknown>} [props.gaster.onRadera]
 * @param {number} [props.gaster.nu] Bara för prov.
 * @param {string} [props.mejlNotMedGast] Raden under E-post när `gaster` finns. Förval ur ordboken (`ORD_OPSGASTLISTA.medlemsNotMedGast`).
 * @param {string} [props.sprak] Språket för gästdelens ord. Utelämnat: ur `OpsSprakProvider`.
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
  aiEtikett,
  ingaText = "Gruppen har inga medlemmar än.",
  mejlNot = "Inget mejl skickas. Be personen logga in, så blir inbjudan ett medlemskap.",
  rollNamn = { agare: "Ägare", admin: "Admin", medlem: "Medlem" },
  gaster,
  mejlNotMedGast,
  sprak: sprakProp,
}) {
  if (typeof migUid !== "string" || !migUid) {
    throw new Error("OpsMedlemmar: migUid krävs. Utan den vet vyn inte vilken rad som är ens egen, och skyddet mot att ta bort sig själv blir en gissning.");
  }

  const personnamn = usePersonnamn();
  const [epost, setEpost] = useState("");
  const [roll, setRoll] = useState("medlem");
  const sprakKontext = useOpsSprak();
  const t = /** @type {Record<string, string>} */ (forvalda(ORD_OPSGASTLISTA, sprakProp ?? sprakKontext));
  const [gastFel, setGastFel] = useState("");
  const [bekrafta, setBekrafta] = useState(/** @type {{ slag: "grupp", epost: string, namn: string } | null} */ (null));
  const gastLage = Boolean(gaster) && roll === "gast";
  const gastFulla = Boolean(gaster) && gaster !== undefined && gaster.platser.anvanda >= gaster.platser.totalt;

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
    if (gastLage) {
      // ⛔ En gäst bjuds inte in med ett tryck: bekräftelsen säger vad gästen ser (chattens hela historik) och att det inte går att ta tillbaka.
      setGastFel("");
      if (normaliseraGastepost(epost) === null) {
        setGastFel(t.felEpost);
        return;
      }
      setBekrafta({ slag: "grupp", epost: epost.trim(), namn: "" });
      return;
    }
    await onBjudIn({ epost, roll });
    setEpost("");
  };

  async function bjudGast() {
    const b = bekrafta;
    setBekrafta(null);
    if (!b || !gaster) return;
    try {
      await gaster.onBjud({ epost: b.epost, namn: b.namn });
      setEpost("");
    } catch (e) {
      setGastFel(gastFelText(e, t, gaster.platser.totalt));
    }
  }

  const rollval = ROLLER.map((r) => ({ value: r, label: rollNamn[r] || r }));
  // Gäst är ett val bara i inbjudningsrutan, aldrig i en befintlig medlems rad: en gäst är ingen medlem och har ingen roll att byta till.
  const inbjudanRollval = gaster ? [...rollval, { value: "gast", label: t.rollGast }] : rollval;

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
             * listan ska visa.
             *
             * ⛔ UID:T VISAS ALDRIG (#218, CP 2026-10-01: "Bra om användarnamnet
             * inte är Guid"). Sista utvägen är den inloggades eget namn, annars
             * "Namn saknas", märkt med `data-namn-saknas`: "den här raden
             * skrevs innan namnet fanns".
             */
            const { text: visningsnamn, saknas } = personnamn(medlemskap.namn || namn || medlemsEpost, medlemskap.userId);
            /*
             * ⛔ EN AGENT HAR INGEN ROLL ATT ÄNDRA OCH INGEN TA BORT (lifehub.app#47). Den stängs av av ägaren
             * (`createAgentService`), och ett borttaget medlemskap hade kommit tillbaka med nästa engångssteg.
             */
            const agent = medlemskap.typ === "agent";
            return (
              <OpsListRow key={medlemskap.id}>
                <OpsIdentity name={visningsnamn} seed={medlemskap.userId} imageUrl={medlemskap.bild || undefined} size="sm" />
                <span className="min-w-0 flex-1 truncate text-ink" data-namn-saknas={saknas ? "" : undefined}>
                  {visningsnamn}
                </span>
                {jag ? <OpsPill tone="neutral">{duEtikett}</OpsPill> : null}
                {agent ? (
                  <OpsPill tone="info">{aiEtikett ?? "AI"}</OpsPill>
                ) : kanAndra && !jag && onAndraRoll ? (
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
                {kanAndra && !jag && !agent && onTaBort ? (
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

      {/* Väntande gäster bland de väntande inbjudningarna (0.132.0), med samma Skicka igen och Dra tillbaka som i `OpsGastLista`. Listan har ingen egen rubrik: raden står under Väntar. */}
      {gaster && gaster.personer.length > 0 ? (
        <OpsGastLista
          utanRubrik
          personer={gaster.personer}
          platser={gaster.platser}
          {...(kanAndra && gaster.onSkickaOm ? { onSkickaOm: gaster.onSkickaOm } : {})}
          {...(kanAndra && gaster.onAterkalla ? { onAterkalla: gaster.onAterkalla } : {})}
          {...(kanAndra && gaster.onAterkallaAlla ? { onAterkallaAlla: gaster.onAterkallaAlla } : {})}
          {...(kanAndra && gaster.onRadera ? { onRadera: gaster.onRadera } : {})}
          {...(gaster.nu !== undefined ? { nu: gaster.nu } : {})}
          sprak={sprakProp ?? sprakKontext}
        />
      ) : null}

      {kanAndra && onBjudIn ? (
        <>
          <OpsField label={epostEtikett} hint={gaster ? mejlNotMedGast ?? t.medlemsNotMedGast : mejlNot}>
            <OpsInput value={epost} onChange={setEpost} type="email" placeholder="namn@example.com" />
          </OpsField>
          <OpsField label={rollEtikett}>
            <OpsSelect options={inbjudanRollval} value={gaster ? roll : roll === "gast" ? "medlem" : roll} onChange={setRoll} />
          </OpsField>
          {gastLage && gaster ? (
            <div data-medlemmar-gast="" className="flex min-w-0 flex-col gap-2">
              <p className="m-0 text-etikett text-ink-secondary">{t.ingressGrupp}</p>
              <p data-gastlista-platser="" className="m-0 text-etikett text-ink-secondary">
                {t.platser.replace("{anvanda}", String(gaster.platser.anvanda)).replace("{totalt}", String(gaster.platser.totalt))}
              </p>
              {gastFulla ? <p data-gastlista-fulla="" role="status" className="m-0 text-etikett text-ink">{t.platserFulla.replace("{totalt}", String(gaster.platser.totalt))}</p> : null}
              {gastFel ? <p role="alert" data-gastlista-bjudfel="" className="m-0 text-etikett text-danger wrap-anywhere">{gastFel}</p> : null}
            </div>
          ) : null}
          <div>
            <OpsButton variant="primary" onClick={bjudIn} disabled={!epost || (gastLage && gastFulla)}>
              {gastLage ? t.bjud : bjudInEtikett}
            </OpsButton>
          </div>
          {bekrafta ? <GastBekraftelse bekrafta={bekrafta} t={t} onBekrafta={bjudGast} onAvbryt={() => setBekrafta(null)} /> : null}
        </>
      ) : null}
    </>
  );
}
