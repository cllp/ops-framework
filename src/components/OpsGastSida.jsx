import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { lasSparatSprak, sparaSprak, valdSprak } from "../lib/deladdatum.js";
import { GASTDELTASVAR, GASTFEL, GASTNYLANK_SVAR, GASTNYCKELFORM, MAX_GASTNAMN, normaliseraGastepost } from "../lib/gast.js";
import { ALLA, SENASTE, minne, sessionsnyckelFor, skrivSessionTillMinne, sparadeSessionsIds } from "../lib/gastminne.js";
import { definierade, forvalda } from "../lib/ord.js";
import { PUBLIK_KLASS, PUBLIK_TONER } from "../lib/publikKlass.js";
import { SPRAK } from "../lib/sprak.js";
import { GastDelta } from "./GastDelta.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { ORD_OPSDELADHANDELSE } from "./OpsDeladHandelse.jsx";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { PublikSprakval } from "./PublikSprakval.jsx";
import { GastsidaInfo } from "./gastsidaInfo.js";

/**
 * Orden på gästsidan, på svenska och engelska (0.131.0, cllp/lifehub.app#389). Svenskan i feltexterna är `GASTFEL` och ingen kopia av den (regel 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTSIDA = {
  sprakEtikett: { sv: "Språk", en: "Language" },
  laddar: { sv: "Hämtar", en: "Loading" },
  // ⛔ RUBRIKEN NÄR ADRESSEN FRÅGAS ÄR NEUTRAL (0.146.0). Före inloggningen vet sidan inte vad inbjudan gäller (en omröstning, en händelse att svara på, hela gruppen), och "rösta" var fel åt den som bjudits in till
  // en händelse. Nyckelnamnet står kvar, så att en app som ger egna ord (`ord.rubrikRosta`) fortfarande träffar rätt text.
  rubrikRosta: { sv: "Du är inbjuden", en: "You are invited" },
  // ⛔ EN MENING OM VARFÖR, OCH ETIKETTEN SÄGER INTE SAMMA SAK EN GÅNG TILL (0.190.0, QA fynd 2 i cllp/lifehub.app#658): ingressen och etiketten var samma mening.
  ingress: { sv: "Skriv din e-postadress, samma som inbjudan kom till. Så vet vi att det är du. Du behöver inget konto.", en: "Enter your email address, the same one the invitation was sent to. That is how we know it is you. You do not need an account." },
  adressEtikett: { sv: "Din e-postadress", en: "Your email address" },
  fortsatt: { sv: "Fortsätt", en: "Continue" },
  felAdress: { sv: "Det där ser inte ut som en e-postadress.", en: "That does not look like an email address." },
  // ⛔ ETT NEJ VID ADRESSEN SÄGER VAD SOM ÄR FEL, OCH BARA DET SERVERN VET (0.190.0, QA fynd 2): fel adress och fel nyckel är samma nej byte för byte, så texten är densamma
  // för båda och ingen kan pröva sig fram. Formfelet (`felAdress`) står bara när adressen verkligen inte är en adress (`normaliseraGastepost` ger null).
  felInbjudan: { sv: "Den adressen hör inte till den här inbjudan. Skriv samma adress som mejlet kom till.", en: "That address does not belong to this invitation. Enter the same address the email was sent to." },
  orsak_nej: { sv: GASTFEL.nej, en: "The link or the address was not right" },
  orsak_aterkallad: { sv: GASTFEL.aterkallad, en: "The invitation has been withdrawn" },
  orsak_utgangen: { sv: GASTFEL.utgangen, en: "The link has expired" },
  "orsak_for-manga": { sv: GASTFEL["for-manga"], en: "Too many attempts. Wait a while and try again" },
  orsak_saknas: { sv: GASTFEL.saknas, en: "What you were invited to no longer exists" },
  kundeInte: { sv: "Det gick inte just nu. Försök igen.", en: "That did not work right now. Try again." },
  nyLankRubrik: { sv: "Be om en ny länk", en: "Ask for a new link" },
  nyLankIngress: { sv: "Skriv din adress, så skickar vi en ny länk om adressen har en inbjudan.", en: "Enter your address and we will send a new link if the address has an invitation." },
  nyLankKnapp: { sv: "Skicka en ny länk", en: "Send a new link" },
  nyLankSvar: { sv: GASTNYLANK_SVAR, en: "If the address has an invitation we have sent a link." },
  namnEtikett: { sv: "Vad ska gruppen kalla dig? (valfritt)", en: "What should the group call you? (optional)" },
  namnSpara: { sv: "Spara", en: "Save" },
  namnSparat: { sv: "Sparat", en: "Saved" },
  gastNot: { sv: "Du är gäst. Du ser bara det du bjudits in till.", en: "You are a guest. You only see what you were invited to." },
  // Gäller varje inbjudan som appen inte gett en väg att visa: hela gruppen (`renderGrupp`) och en händelse att svara på (`onSvara`).
  gruppEjStodd: { sv: "Den här inbjudan går inte att visa i den här versionen av appen.", en: "This invitation cannot be shown in this version of the app." },
  // ── En händelse att svara på (`delta`, 0.146.0). Tre svar: medlemmen har två, men en extern har en egen kalender med Ja, Kanske och Nej (`GASTDELTASVAR`). ──
  deltaFraga: { sv: "Kommer du?", en: "Are you coming?" },
  deltaKommer: { sv: "Jag kommer", en: "I'm coming" },
  deltaKommerInte: { sv: "Kan inte", en: "Can't make it" },
  deltaKanske: { sv: "Kanske", en: "Maybe" },
  deltaSparar: { sv: "Sparar…", en: "Saving…" },
  deltaValt: { sv: "valt", en: "selected" },
  deltaOsvarad: { sv: "Du har inte svarat än.", en: "You have not answered yet." },
  deltaSvarade_kommer: { sv: "Du har svarat: Jag kommer.", en: "You answered: I'm coming." },
  deltaSvarade_kommerInte: { sv: "Du har svarat: Kan inte.", en: "You answered: Can't make it." },
  deltaSvarade_kanske: { sv: "Du har svarat: Kanske.", en: "You answered: Maybe." },
  integritetRubrik: { sv: "Integritet och dina uppgifter", en: "Privacy and your data" },
  integritetLagrat: {
    sv: "Det här sparas om dig: din e-postadress och namnet du eller den som bjöd in dig angav, vad du bjudits in till, när, och av vem. Vi sparar också att du loggat in och när, och en kodad kopia av nyckeln som håller dig inloggad på den här enheten (själva nyckeln finns bara hos dig). Dina svar och röster sparas under ett id som räknas fram ur din adress, och de meddelanden du skriver i gruppens chatt sparas med ditt namn och märket Gäst, där alla i gruppen ser dem. Vi räknar hur många anrop du gör och hur många filer du hämtar, för att stoppa missbruk, och en av de fem gratis platserna i gruppen är reserverad åt dig. Appen kan dessutom spara adressen i sin utgående post. Inget av det används till annat än att du ska kunna vara med.",
    en: "This is what we keep about you: your email address and the name you or the person who invited you gave, what you were invited to, when, and by whom. We also keep that you signed in and when, and a coded copy of the key that keeps you signed in on this device (the key itself only exists with you). Your answers and votes are kept under an id calculated from your address, and the messages you write in the group chat are kept with your name and the mark Guest, where everyone in the group can see them. We count how many requests you make and how many files you fetch, to stop abuse, and one of the five free places in the group is reserved for you. The app may also keep the address in its outgoing mail. None of it is used for anything except letting you take part.",
  },
  integritetRadera: {
    sv: "Så raderas det: tryck på knappen nedan, så tas allt detta bort direkt, i alla grupper du bjudits in till. Inbjudningarna, inloggningarna, räknarna, dina svar och röster, dina meddelanden i chatten och din plats försvinner, och det går inte att ångra. Den som bjöd in dig kan också radera dina uppgifter. Att en inbjudan dras tillbaka raderar ingenting av sig själv.",
    en: "This is how it is deleted: press the button below and all of this is removed immediately, in every group you were invited to. The invitations, the sign-ins, the counters, your answers and votes, your messages in the chat and your place disappear, and it cannot be undone. The person who invited you can also delete your data. Withdrawing an invitation does not delete anything by itself.",
  },
  integritetUtanKnapp: {
    sv: "Så raderas det: be den som bjöd in dig att radera dina uppgifter. Då tas allt detta bort, i gruppen du bjöds in till. Att en inbjudan dras tillbaka raderar ingenting av sig själv.",
    en: "This is how it is deleted: ask the person who invited you to delete your data. Everything above is then removed, in the group you were invited to. Withdrawing an invitation does not delete anything by itself.",
  },
  raderaKnapp: { sv: "Radera mina uppgifter", en: "Delete my data" },
  raderaFraga: { sv: "Radera allt vi har sparat om dig, i alla grupper? Det går inte att ångra.", en: "Delete everything we have kept about you, in every group? It cannot be undone." },
  raderaBekrafta: { sv: "Ja, radera allt", en: "Yes, delete everything" },
  raderaAvbryt: { sv: "Avbryt", en: "Cancel" },
  // ⛔ (0.190.0, QA fynd 7 i cllp/lifehub.app#658) En delad enhet: länken glömmer sessionerna här och frågar efter adressen igen.
  skrivInIgen: { sv: "Skriv in adressen igen", en: "Enter the address again" },
  raderad: { sv: "Dina uppgifter är raderade. Du har inte längre någon åtkomst, och inget av det vi sparade om dig finns kvar.", en: "Your data has been deleted. You no longer have access, and nothing we kept about you remains." },
};

/**
 * Appens bildlogga i samma ruta som skalets märke (0.190.0): 40 px hög som `OpsBrand`s ruta i toppraden, högst `--logo-bredd` bred. Bilden är 64 px hög och beskärs
 * uppe och nere i samma proportion som inloggningen (`OpsInloggning`: 2,5 rem av 14 rem), så att det som syns är märket och inte bildens luft. En bild per tema, som där.
 * @param {{ marke: { ljus: string, mork: string, namn: string } }} props
 */
function GastMarke({ marke }) {
  if (!marke || typeof marke.ljus !== "string" || typeof marke.mork !== "string" || typeof marke.namn !== "string" || !marke.namn.trim()) {
    throw new Error("OpsGastSida: marke är { ljus, mork, namn }: en bild per tema och appens namn som alternativtext.");
  }
  return (
    <span data-gast-marke="" className="flex h-10 max-w-(--logo-bredd) shrink-0 items-center overflow-hidden">
      {[["ljus", marke.ljus, "mix-blend-multiply"], ["mork", marke.mork, ""]].map(([tema, src, extra]) => (
        <img key={tema} src={src} alt={tema === "ljus" ? marke.namn : ""} aria-hidden={tema === "ljus" ? undefined : true} className={cx(tema === "ljus" ? "ops-ordmarke-ljus" : "ops-ordmarke-mork", "h-16 w-auto max-w-full object-contain", extra)} />
      ))}
    </span>
  );
}

/** Orsakerna där en länk som gått ut ändå går att ersätta: adressen stämde, så sidan erbjuder en ny länk. */
const ERSATTBARA = /** @type {readonly string[]} */ (["utgangen"]);


/**
 * Gästens egen sida: det en person ser som bjudits in utan konto, på `/gast` (0.131.0, cllp/lifehub.app#389, skiva 1; 0.132.0, skiva 2: hela gruppen).
 *
 * ══ ⛔ SIDAN HAR INGEN FIREBASE OCH INGET KONTO, OCH DEN RITAS FÖRE APPENS GRIND ════════════════════════════════════════
 *
 * Appen ritar den på `/gast` före sin inloggning, utan Firebase, med `noindex`. Sidan vet inget om gruppen, medlemmarna eller andra gäster: den får `onLos`, `onHamta`, `onNamn` och
 * `onNyLank` (appens anrop mot `/api/gast`) och ritar vad de svarar. Sakens eget kort (för omröstningen: förslagen, Ja, Kanske, Nej och summan) är appens och ritas av `renderSak`.
 * Hela gruppen (`funktion: "grupp"`) ritas av `renderGrupp`, normalt `OpsGastGrupp` med `gastGruppApi(anrop, sessionsnyckel)`: det bantade gränssnittet med fyra flikar och ingen väg ut ur `/gast`.
 *
 * ══ ⛔ ADRESSEN SKRIVS EN GÅNG, SEDAN STANNAR GÄSTEN INLOGGAD PÅ ENHETEN ═══════════════════════════════════════════════
 *
 * Första öppningen med en länk (`lank`, ur `tolkaGastLank(location.hash)`): sidan frågar efter adressen och postar `{ id, nyckel, epost }`. Ett ja ger en sessionsnyckel som sparas i webbläsarens
 * minne (per inbjudan), och fragmentet tas bort ur adressraden så att nyckeln inte ligger kvar i historiken. Nästa gång sidan öppnas, med eller utan länk, hämtas saken direkt med sessionen. På en ny
 * enhet finns ingen session: gästen skriver adressen på `/gast` och får en ny länk (`onNyLank`), med samma svar hur det än gått.
 *
 * ══ ⛔ FLERA SESSIONER PÅ SAMMA ENHET: INGEN GIVER UPP FÖRE DE ANDRA ÄR PRÖVADE (0.132.0) ══════════════════════════════
 *
 * En gäst kan ha en omröstning och hela gruppen på samma enhet, alltså två sessioner. Skiva 1 prövade bara den som senast öppnats (`ops-gast:senaste`), så en gäst vars gruppinbjudan dragits
 * tillbaka men som hade en levande omröstning kvar fick "Inbjudan är återkallad" och ingen väg till omröstningen. Nu prövas alla sparade sessioner i tur och ordning (senast öppnade först, sedan
 * indexet `ops-gast:alla`, sedan allt som minnet kan räkna upp): den första som svarar vinner och blir den senast öppnade, och först när ALLA nekats visas orsaken. Samma sak när en återkallelse
 * upptäcks medan sidan är öppen. En länk i adressraden (`lank`) är ett uttryckligt val och prövar bara sin egen inbjudan.
 *
 * ⛔ ALLA NEJ ÄR ETT NEJ. Fel nyckel, fel adress och okänd inbjudan ger samma text (`orsak_nej`). `aterkallad` och `utgangen` kommer bara när adressen stämt. Sidan försöker inte vara klyftigare än servern.
 *
 * ⛔ ÅTERKALLNING SYNS INOM EN MINUT. Sidan hämtar på nytt när fliken får fokus och var `intervallMs`:e millisekund medan den är öppen (förval 60 s). Svarar servern att inbjudan är återkallad byts
 * sakens kort mot texten (och gruppens flikar försvinner med allt som lästs), och inget mer går att göra.
 *
 * ⛔ GÄSTEN KAN RADERA SIG SJÄLV (0.132.0, CP 2026-10-20: klart före första gruppgästen). Längst ned står vad som sparas och hur det raderas (`integritet*`), och med `onRaderaMig` en knapp som frågar en gång
 * och sedan tar bort allt. Utan `onRaderaMig` säger texten att den som bjöd in raderar, i stället för att lova en knapp som inte finns.
 *
 * ⛔ KNAPPARNA VÄNTAR SJÄLVA (`OpsButton`, 0.129.0). Ett andra tryck medan ett anrop väntar startar inget nytt: servern räknar felaktiga adresser per inbjudan.
 *
 * ⛔ SPRÅKET ÄR BESÖKARENS (som `OpsDeladHandelse`): SV och EN i huvudet, förval webbläsarens språk, valet sparas. Ger appen `sprak` är språket appens.
 *
 * @param {object} props
 * @param {{ id: string, nyckel: string } | null} [props.lank] Id och nyckel ur adressens fragment (`tolkaGastLank`), eller `null` när sidan öppnas utan länk.
 * @param {(arg: { id: string, nyckel: string, epost: string }) => Promise<{ ok: boolean, sessionsnyckel?: string, orsak?: string }>} props.onLos
 * @param {(arg: { sessionsnyckel: string }) => Promise<{ ok: boolean, namn?: string, funktion?: string, sak?: Record<string, any>, grupp?: { namn: string, funktioner: readonly string[] }, orsak?: string }>} props.onHamta
 * @param {(arg: { epost: string }) => Promise<unknown>} props.onNyLank Ger alltid samma svar; sidan skriver ut `nyLankSvar` oavsett vad som kommer tillbaka.
 * @param {(arg: { sessionsnyckel: string, namn: string }) => Promise<unknown>} [props.onNamn] Utelämnad: ingen namnruta.
 * @param {(arg: { sessionsnyckel: string, val: string }) => Promise<{ ok: boolean, mitt?: string, orsak?: string }>} [props.onSvara] (0.146.0) Gästen svarar på en händelse (`delta`): appens anrop mot `/api/gast` med åtgärden `deltaSvara`, `val` ur
 *   `GASTDELTASVAR`. Sidan ritar händelsen och de tre knapparna själv. Nekas svaret (`aterkallad`, `saknas`, `nej`) hämtas sidan om, så att texten byts direkt. Utelämnad: en `delta`-inbjudan visas inte (`gruppEjStodd`), i stället för knappar som inte gör något.
 * @param {(arg: { sessionsnyckel: string }) => Promise<unknown>} [props.onRaderaMig] (0.132.0) Raderar gästens uppgifter (`raderaMig`). Utelämnad: ingen knapp, och texten hänvisar till den som bjöd in.
 * @param {(arg: { sak: Record<string, any>, funktion: string, sessionsnyckel: string, uppdatera: () => Promise<void> }) => import("react").ReactNode} [props.renderSak] Sakens kort. `uppdatera` hämtar saken på nytt (efter en röst).
 * @param {(arg: { grupp: { namn: string, funktioner: readonly string[] }, namn: string, sessionsnyckel: string, uppdatera: () => Promise<void> }) => import("react").ReactNode} [props.renderGrupp] (0.132.0) Hela gruppen. `uppdatera` hämtar om sidan:
 *   anropa den när en åtgärd nekas (`aterkallad`), så byts allt mot texten direkt i stället för vid nästa minut. Utan den visas en text om att inbjudan inte går att visa.
 * @param {import("react").ReactNode} [props.huvud] Appens logga eller namn, till vänster i huvudet. Med `marke` står det efter märket (en länk tillbaka till hubben).
 * @param {{ ljus: string, mork: string, namn: string }} [props.marke] (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del A) Appens bildlogga, en URL per tema, ritad i samma
 *   ruta som skalets märke (40 px hög, `--logo-bredd` bred) och beskuren som inloggningens (`OpsInloggning ordmarke`): appens bilder är fyrkantiga med luft runt, och i `huvud`
 *   som `h-8` blev loggan en bråkdel av appens. `namn` är bildens alternativtext.
 * @param {string} [props.sprak] `sv` eller `en` om appen styr det. Utelämnat: sidan väljer själv och minns valet.
 * @param {(sprak: string) => void} [props.onSprak]
 * @param {number} [props.intervallMs] Hur ofta saken hämtas på nytt medan sidan är öppen. Förval 60 000. `0` stänger av tidtagningen (fokus hämtar ändå).
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void, key?: (i: number) => string | null, length?: number } | null} [props.lagring] Minnet för sessionen. Förval `localStorage`; `null` ger bara minne för den här sidvisningen.
 * @param {Partial<Record<keyof typeof ORD_OPSGASTSIDA, string>>} [props.ord] Egna texter, som vinner över ordboken.
 */
export function OpsGastSida({ lank = null, onLos, onHamta, onNyLank, onNamn, onRaderaMig, onSvara, renderSak, renderGrupp, huvud, marke, sprak, onSprak, intervallMs = 60_000, lagring, ord }) {
  for (const [namn, f] of /** @type {const} */ ([["onLos", onLos], ["onHamta", onHamta], ["onNyLank", onNyLank]])) {
    if (typeof f !== "function") throw new Error(`OpsGastSida: ${namn} krävs, en funktion som anropar appens /api/gast.`);
  }
  for (const [namn, f] of /** @type {const} */ ([["onNamn", onNamn], ["onRaderaMig", onRaderaMig], ["onSvara", onSvara], ["renderGrupp", renderGrupp]])) {
    if (f !== undefined && typeof f !== "function") throw new Error(`OpsGastSida: ${namn} måste vara en funktion (eller utelämnas).`);
  }
  if (lank !== null && (!lank || typeof lank.id !== "string" || !GASTNYCKELFORM.test(lank.nyckel))) {
    throw new Error("OpsGastSida: lank är { id, nyckel } ur tolkaGastLank, eller null.");
  }
  if (sprak !== undefined && !(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`OpsGastSida: språket ${JSON.stringify(sprak)} finns inte (giltiga: ${SPRAK.join(", ")}).`);
  }
  const [valt, setValt] = useState(() => valdSprak({ sparat: lasSparatSprak(), webblasare: typeof navigator === "undefined" ? undefined : navigator.language }));
  const aktivt = sprak ?? valt;
  const t = { ...forvalda(ORD_OPSGASTSIDA, aktivt), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const mem = useRef(minne(lagring));
  // Rubrikens tre ord (När och var, till, Plats) är den delade händelsesidans: en inbjuden ser samma rubrik som den som fått en delad länk (`DeladRubrik`).
  const { tidEtikett, till, platsEtikett } = forvalda(ORD_OPSDELADHANDELSE, aktivt);
  const rubrikOrd = { tidEtikett, till, platsEtikett };

  /** @type {[{ fas: "startar" | "adress" | "ny-lank" | "klar" | "fel" | "nylank-skickad" | "raderad" }, Function]} */
  const [lage, setLage] = useState({ fas: "startar" });
  const [sessionsnyckel, setSessionsnyckel] = useState(/** @type {string | null} */ (null));
  const [svar, setSvar] = useState(/** @type {Record<string, any> | null} */ (null));
  const [orsak, setOrsak] = useState("");
  const [epost, setEpost] = useState("");
  const [fel, setFel] = useState("");
  const [namn, setNamn] = useState("");
  const [namnSparat, setNamnSparat] = useState(false);
  const [fragarRadera, setFragarRadera] = useState(false);
  const [raderaFel, setRaderaFel] = useState("");
  /** Inbjudan som den visade sessionen hör till. */
  const aktivId = useRef(/** @type {string | null} */ (null));
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  /** @param {string} s */
  function valj(s) {
    if (sprak === undefined) setValt(/** @type {"sv" | "en"} */ (s));
    sparaSprak(s);
    if (onSprak) onSprak(s);
  }

  /** Inbjudningarna som har en sparad session, den senast öppnade först. Samma läsning som `sparaGastSession` gör (en funktion, ett minnesformat). */
  function sparadeIds() {
    return sparadeSessionsIds(mem.current);
  }

  /** @param {string} id @param {string} nyckel */
  function skrivSession(id, nyckel) {
    skrivSessionTillMinne(mem.current, id, nyckel);
  }

  /** @param {string} id */
  function glomSession(id) {
    mem.current.glom(sessionsnyckelFor(id));
    const kvar = sparadeIds().filter((x) => x !== id);
    mem.current.skriv(ALLA, JSON.stringify(kvar));
    if (mem.current.las(SENASTE) === id) mem.current.glom(SENASTE);
  }

  /**
   * Prövar de sparade sessionerna i ordning och visar den första som svarar. En session som servern inte känner (`nej`) glöms. En återkallad eller saknad (`aterkallad`, `saknas`) sparas kvar och
   * orsaken minns, men prövningen fortsätter: en annan inbjudan på enheten kan leva. `for-manga` är ingen dom över sessionen och avbryter utan att glömma något.
   *
   * @param {readonly string[]} ids
   * @returns {Promise<{ ok: true } | { ok: false, natfel?: boolean, orsak?: string | null, avbruten?: boolean }>}
   */
  const forsokSessioner = useCallback(
    async (/** @type {readonly string[]} */ ids) => {
      /** @type {string | null} */
      let kvarOrsak = null;
      for (const id of ids) {
        const nyckel = mem.current.las(sessionsnyckelFor(id));
        if (!nyckel || !GASTNYCKELFORM.test(nyckel)) continue;
        let r;
        try {
          r = await onHamta({ sessionsnyckel: nyckel });
        } catch {
          return { ok: false, natfel: true };
        }
        if (!levande.current) return { ok: false, avbruten: true };
        if (r && r.ok) {
          aktivId.current = id;
          mem.current.skriv(SENASTE, id);
          setSessionsnyckel(nyckel);
          setSvar(r);
          setNamn(typeof r.namn === "string" ? r.namn : "");
          setLage({ fas: "klar" });
          return { ok: true };
        }
        const o = r && typeof r.orsak === "string" ? r.orsak : "nej";
        if (o === "for-manga") return { ok: false, orsak: o };
        if (o === "aterkallad" || o === "saknas") {
          kvarOrsak ??= o;
          continue;
        }
        glomSession(id);
      }
      return { ok: false, orsak: kvarOrsak };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onHamta],
  );

  /**
   * Hämtar om med sessionen som visas. `tyst` (tidtagningen och fokus): ett nätfel byter inte vyn, och `for-manga` inte heller. Är inbjudan återkallad prövas de andra sparade sessionerna
   * innan sidan ger upp, så att en levande omröstning inte göms bakom en återkallad grupp.
   *
   * @param {string} nyckel
   * @param {{ tyst?: boolean }} [val]
   * @returns {Promise<boolean>} Sant om saken gick att visa.
   */
  const hamta = useCallback(
    /**
     * @param {string} nyckel
     * @param {{ tyst?: boolean }} [val]
     * @returns {Promise<boolean>}
     */
    async (nyckel, val = {}) => {
      let r;
      try {
        r = await onHamta({ sessionsnyckel: nyckel });
      } catch {
        if (!val.tyst && levande.current) {
          setOrsak("kundeInte");
          setLage({ fas: "fel" });
        }
        return false;
      }
      if (!levande.current) return false;
      if (r && r.ok) {
        setSvar(r);
        setNamn(typeof r.namn === "string" ? r.namn : "");
        setLage({ fas: "klar" });
        return true;
      }
      const o = r && typeof r.orsak === "string" ? r.orsak : "nej";
      if (o === "for-manga" && val.tyst) return false;
      if (o === "aterkallad") {
        const andra = sparadeIds().filter((id) => id !== aktivId.current);
        if (andra.length > 0) {
          const res = await forsokSessioner(andra);
          if (res.ok) return true;
          if (!levande.current) return false;
        }
      }
      setOrsak(`orsak_${o}`);
      setLage({ fas: "fel" });
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onHamta, forsokSessioner],
  );

  // Första gången: finns en session för inbjudan (länkens, annars alla sparade, den senast öppnade först) hämtas saken direkt. Annars frågar sidan efter adressen, eller erbjuder en ny länk.
  useEffect(() => {
    const ids = lank ? [lank.id] : sparadeIds();
    if (lank) aktivId.current = lank.id;
    void (async () => {
      const res = await forsokSessioner(ids);
      if (!levande.current || res.ok || ("avbruten" in res && res.avbruten)) return;
      if ("natfel" in res && res.natfel) {
        setOrsak("kundeInte");
        setLage({ fas: "fel" });
        return;
      }
      // En återkallad eller saknad inbjudan är ett besked till gästen och inget skäl att be om adressen. `for-manga` likaså.
      if ("orsak" in res && res.orsak) {
        setOrsak(`orsak_${res.orsak}`);
        setLage({ fas: "fel" });
        return;
      }
      setLage({ fas: lank ? "adress" : "ny-lank" });
    })();
    // Körs en gång per sidvisning och länk: att hämta om vid varje ny funktionsidentitet vore att hämta i en loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lank?.id]);

  // Återkallning och ändringar syns: hämta på nytt när fliken får fokus och var `intervallMs`:e millisekund medan den är öppen.
  useEffect(() => {
    if (!sessionsnyckel || lage.fas !== "klar") return undefined;
    const om = () => void hamta(sessionsnyckel, { tyst: true });
    const synlig = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") om();
    };
    const timer = intervallMs > 0 ? setInterval(om, intervallMs) : null;
    if (typeof window !== "undefined") window.addEventListener("focus", om);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", synlig);
    return () => {
      if (timer) clearInterval(timer);
      if (typeof window !== "undefined") window.removeEventListener("focus", om);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", synlig);
    };
  }, [sessionsnyckel, lage.fas, intervallMs, hamta]);

  async function skickaAdress() {
    if (!lank) return;
    setFel("");
    if (normaliseraGastepost(epost) === null) {
      setFel(t.felAdress);
      return;
    }
    let r;
    try {
      r = await onLos({ id: lank.id, nyckel: lank.nyckel, epost: epost.trim() });
    } catch {
      if (levande.current) setFel(t.kundeInte);
      return;
    }
    if (!levande.current) return;
    if (r && r.ok && typeof r.sessionsnyckel === "string" && GASTNYCKELFORM.test(r.sessionsnyckel)) {
      skrivSession(lank.id, r.sessionsnyckel);
      aktivId.current = lank.id;
      setSessionsnyckel(r.sessionsnyckel);
      // Nyckeln ska inte ligga kvar i adressraden eller historiken när den fyllt sin uppgift.
      try {
        if (typeof window !== "undefined" && window.history?.replaceState) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        /* Adressraden går inte att ändra här: inget att göra. */
      }
      await hamta(r.sessionsnyckel);
      return;
    }
    const o = r && typeof r.orsak === "string" ? r.orsak : "nej";
    setFel(o === "nej" ? t.felInbjudan : (t[`orsak_${o}`] ?? t.felInbjudan));
    if (ERSATTBARA.includes(o)) setOrsak(`orsak_${o}`);
  }

  async function begarNyLank() {
    setFel("");
    if (normaliseraGastepost(epost) === null) {
      setFel(t.felAdress);
      return;
    }
    try {
      await onNyLank({ epost: epost.trim() });
    } catch {
      // ⛔ Ett fel visas inte som ett annat svar än det vanliga: servern svarar likadant hur det än gått, och sidan gör det också.
    }
    if (levande.current) setLage({ fas: "nylank-skickad" });
  }

  async function sparaNamn() {
    if (!onNamn || !sessionsnyckel) return;
    setFel("");
    try {
      await onNamn({ sessionsnyckel, namn: namn.trim() });
      if (levande.current) setNamnSparat(true);
    } catch {
      if (levande.current) setFel(t.kundeInte);
    }
  }

  /**
   * Gästen svarar på händelsen (`delta`). Sant om det sparades, eller om sidan byttes mot ett besked i stället (en återkallad inbjudan): `false` är bara "det gick inte just nu", och kortet skriver ut det vid knapparna.
   * @param {string} val
   * @returns {Promise<boolean>}
   */
  async function svaraDelta(val) {
    if (!onSvara || !sessionsnyckel) return false;
    let r;
    try {
      r = await onSvara({ sessionsnyckel, val });
    } catch {
      return false;
    }
    if (!levande.current) return true;
    if (r && r.ok === true) {
      // Det servern svarade gäller; saknas det står det gästen tryckte på. Nästa hämtning (fokus, tidtagningen) rättar om något ändå skiljer sig.
      const mitt = typeof r.mitt === "string" && /** @type {readonly string[]} */ (GASTDELTASVAR).includes(r.mitt) ? r.mitt : val;
      setSvar((fore) => (fore && fore.delta ? { ...fore, delta: { ...fore.delta, mitt } } : fore));
      return true;
    }
    const o = r && typeof r.orsak === "string" ? r.orsak : "";
    // Nekat av ett skäl som gäller inbjudan: hämta om, så byts sidan mot texten direkt i stället för vid nästa minut.
    if (o === "aterkallad" || o === "saknas" || o === "nej") {
      await hamta(sessionsnyckel);
      return true;
    }
    return false;
  }

  async function raderaMig() {
    if (!onRaderaMig || !sessionsnyckel) return;
    setRaderaFel("");
    let r;
    try {
      r = await onRaderaMig({ sessionsnyckel });
    } catch {
      if (levande.current) setRaderaFel(t.kundeInte);
      return;
    }
    if (!levande.current) return;
    if (r && typeof r === "object" && /** @type {{ ok?: unknown }} */ (r).ok === false) {
      setRaderaFel(t.kundeInte);
      return;
    }
    // Allt är borta hos servern. Sessionerna på enheten är det också: personens andra inbjudningar hade nekats vid nästa hämtning, men ingen nyckel ska ligga kvar.
    for (const id of sparadeIds()) glomSession(id);
    mem.current.glom(ALLA);
    setSessionsnyckel(null);
    setSvar(null);
    setLage({ fas: "raderad" });
  }

  /**
   * Glömmer gästen på enheten och frågar efter adressen igen (0.190.0, QA fynd 7 i cllp/lifehub.app#658): en delad dator eller telefon ska inte öppna någon annans grupp
   * för nästa person. ALLA sessioner på enheten glöms, inte bara den som visas: nästa person ska inte heller hamna i den förras omröstning. Servern rörs inte: sessionen
   * gäller tills den går ut, men nyckeln finns inte längre på enheten. Med länken i minnet (samma sidvisning) är det adressteget; utan den sidan som skickar en ny länk.
   */
  function skrivInIgen() {
    for (const id of sparadeIds()) glomSession(id);
    mem.current.glom(ALLA);
    mem.current.glom(SENASTE);
    aktivId.current = lank ? lank.id : null;
    setSessionsnyckel(null);
    setSvar(null);
    setEpost("");
    setFel("");
    setOrsak("");
    setNamnSparat(false);
    setFragarRadera(false);
    setLage({ fas: lank ? "adress" : "ny-lank" });
  }

  const adressFormulär = (/** @type {{ rubrik: string, ingress: string, etikett: string, knapp: string, onKlar: () => Promise<void> }} */ p) => (
    <form
      data-gast-form={lage.fas}
      noValidate
      className="flex w-full max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <h1 className={PUBLIK_KLASS.sida}>{p.rubrik}</h1>
      <p className={PUBLIK_KLASS.brod}>{p.ingress}</p>
      <OpsField label={p.etikett} error={fel || undefined}>
        <OpsInput value={epost} onChange={setEpost} type="email" autoComplete="email" tal={false} />
      </OpsField>
      <div>
        <OpsButton type="submit" variant="primary" onClick={p.onKlar}>
          {p.knapp}
        </OpsButton>
      </div>
      {lage.fas === "adress" && orsak === "orsak_utgangen" ? (
        <div className="flex flex-col gap-2">
          <OpsButton variant="secondary" onClick={begarNyLank}>
            {t.nyLankKnapp}
          </OpsButton>
        </div>
      ) : null}
    </form>
  );

  const integritet = (
            <section data-gast-integritet="" className="flex min-w-0 max-w-2xl flex-col gap-3">
              <OpsDisclosure summary={t.integritetRubrik}>
                <div className="flex flex-col gap-3 pt-2">
                  <p data-gast-integritet-lagrat="" className="m-0 text-meta text-publik-ljus-dampad">{t.integritetLagrat}</p>
                  <p data-gast-integritet-radera="" className="m-0 text-meta text-publik-ljus-dampad">{onRaderaMig ? t.integritetRadera : t.integritetUtanKnapp}</p>
                  {onRaderaMig ? (
                    fragarRadera ? (
                      <div data-gast-radera-fraga="" role="group" aria-label={t.raderaKnapp} className="flex flex-col gap-3">
                        <p className="m-0 text-etikett text-publik-ljus-text">{t.raderaFraga}</p>
                        <div className="flex flex-wrap gap-2">
                          <OpsButton variant="danger" onClick={raderaMig}>
                            {t.raderaBekrafta}
                          </OpsButton>
                          <OpsButton variant="secondary" onClick={() => { setFragarRadera(false); setRaderaFel(""); }}>
                            {t.raderaAvbryt}
                          </OpsButton>
                        </div>
                        {raderaFel ? <p role="alert" data-gast-radera-fel="" className="m-0 text-etikett text-danger">{raderaFel}</p> : null}
                      </div>
                    ) : (
                      <div>
                        <OpsButton variant="secondary" onClick={() => setFragarRadera(true)}>
                          {t.raderaKnapp}
                        </OpsButton>
                      </div>
                    )
                  ) : null}
                </div>
              </OpsDisclosure>
            </section>
  );
  // Det som ligger i gruppens (i)-panel: integriteten och vägen tillbaka till adressteget.
  const gruppInfo = (
    <div data-gast-grupp-info-sida="" className="flex min-w-0 flex-col gap-2">
      {integritet}
      <div>
        <button type="button" data-gast-skriv-in-igen="" onClick={skrivInIgen} className="inline-flex min-h-11 cursor-pointer items-center text-etikett text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {t.skrivInIgen}
        </button>
      </div>
    </div>
  );

  const grupplage = lage.fas === "klar" && svar?.funktion === "grupp";
  // ⛔ I GRUPPEN STÅR NAMNRUTAN ÖVERST (0.190.0, granskning av PR 524): under gruppen hamnade den efter ytan som fyller höjden ut till bottenraden, och på telefon
  // rullade då hela sidan ovanpå chattens egen rullning (check-skalyta 56 (e), "sidan rullar true"). Ovanför mäts den in i ytans topp, och ytan blir kortare i stället.
  const namnruta = (
    <>
      {onNamn && svar && !svar.namn && !namnSparat ? (
        <form
          data-gast-namn=""
          noValidate
          className="flex max-w-md flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <OpsField label={t.namnEtikett} error={fel || undefined}>
            <OpsInput value={namn} onChange={setNamn} maxLength={MAX_GASTNAMN} autoComplete="name" tal={false} />
          </OpsField>
          <div>
            <OpsButton type="submit" variant="secondary" onClick={sparaNamn}>
              {t.namnSpara}
            </OpsButton>
          </div>
        </form>
      ) : null}
      {namnSparat ? <p data-gast-namn-sparat="" role="status" className={PUBLIK_KLASS.brod}>{t.namnSparat}</p> : null}
    </>
  );
  // Hela gruppen behöver bredd: kalenderns rutnät och biblioteket blir trånga i 48 rem. En omröstning är kvar i den smala spalten.
  const spalt = grupplage ? "max-w-5xl" : "max-w-3xl";

  return (
    <div lang={aktivt} data-gastsida="" data-sprak={aktivt} data-gast-lage={lage.fas} className={cx("flex min-h-dvh w-full flex-col", PUBLIK_TONER.ljus.band, PUBLIK_TONER.ljus.rubrik)}>
      <header className="sticky top-0 z-10 border-b border-publik-ljus-text/10 bg-publik-ljus">
        <div className={cx("mx-auto flex h-14 w-full items-center justify-between gap-3 px-4", spalt)}>
          <div data-gast-huvud="" className="flex min-w-0 items-center gap-3">
            {marke ? <GastMarke marke={marke} /> : null}
            {huvud}
          </div>
          <PublikSprakval aktivt={aktivt} etikett={t.sprakEtikett} onVal={valj} />
        </div>
      </header>
      {/* ⛔ I GRUPPEN PÅ TELEFON SLUTAR SIDAN VID BOTTENRADEN (0.190.0, del B): ytan fyller höjden ut till raden (`OpsGastGrupp`), och `main` lämnar exakt radens och den säkra ytans
          höjd under sig, som skalets `main`. Med `pb-16` hade sidan blivit högre än fönstret och rullat ovanpå ytans egen rullning. */}
      <main className={cx("mx-auto w-full flex-1 px-4", grupplage ? "pt-4 pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--spelrad-h,0px))] md:pt-12 md:pb-[calc(4rem+var(--spelrad-h,0px))]" : "pt-8 pb-16 sm:pt-12", spalt)}>
        {lage.fas === "startar" ? (
          <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
        ) : lage.fas === "adress" ? (
          adressFormulär({ rubrik: t.rubrikRosta, ingress: t.ingress, etikett: t.adressEtikett, knapp: t.fortsatt, onKlar: skickaAdress })
        ) : lage.fas === "ny-lank" ? (
          adressFormulär({ rubrik: t.nyLankRubrik, ingress: t.nyLankIngress, etikett: t.adressEtikett, knapp: t.nyLankKnapp, onKlar: begarNyLank })
        ) : lage.fas === "nylank-skickad" ? (
          <div data-gast-nylank-skickad="">
            <OpsEmpty title={t.nyLankSvar} />
          </div>
        ) : lage.fas === "raderad" ? (
          <div data-gast-raderad="">
            <OpsEmpty title={t.raderad} />
          </div>
        ) : lage.fas === "fel" ? (
          <div data-gast-fel={orsak.replace(/^orsak_/, "")}>
            <OpsEmpty title={t[orsak] ?? t.orsak_nej} />
          </div>
        ) : (
          <div data-gast-klar="" className="flex min-w-0 flex-col gap-6">
            {grupplage ? namnruta : null}
            {svar && svar.funktion === "grupp" ? (
              renderGrupp ? (
                <GastsidaInfo.Provider value={gruppInfo}>
                  {renderGrupp({ grupp: svar.grupp, namn: typeof svar.namn === "string" ? svar.namn : "", sessionsnyckel: /** @type {string} */ (sessionsnyckel), uppdatera: async () => void (await hamta(/** @type {string} */ (sessionsnyckel), { tyst: true })) })}
                </GastsidaInfo.Provider>
              ) : (
                <div data-gast-grupp-ejstodd=""><OpsEmpty title={t.gruppEjStodd} /></div>
              )
            ) : svar && svar.funktion === "delta" ? (
              onSvara && svar.delta?.handelse ? (
                <GastDelta delta={svar.delta} onSvara={svaraDelta} t={{ ...t, ...rubrikOrd }} sprak={aktivt} />
              ) : (
                <div data-gast-delta-ejstodd=""><OpsEmpty title={t.gruppEjStodd} /></div>
              )
            ) : svar && renderSak && svar.sak ? (
              renderSak({ sak: svar.sak, funktion: String(svar.funktion ?? ""), sessionsnyckel: /** @type {string} */ (sessionsnyckel), uppdatera: async () => void (await hamta(/** @type {string} */ (sessionsnyckel), { tyst: true })) })
            ) : null}
            {grupplage ? null : namnruta}
            {/* ⛔ I GRUPPEN BOR INTEGRITETEN BAKOM (i) (0.190.0, del A), tillsammans med "Skriv in adressen igen", och sidfotens "Du är gäst" är borta: gruppens huvud säger det.
                En omröstning och en händelse har inget sådant huvud, och där står de kvar längst ned. */}
            {svar?.funktion === "grupp" ? null : (
              <>
                {integritet}
                <p data-gast-not="" className="m-0 text-meta text-publik-ljus-dampad">{t.gastNot}</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
