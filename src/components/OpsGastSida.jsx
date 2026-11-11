import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { lasSparatSprak, sparaSprak, valdSprak } from "../lib/deladdatum.js";
import { GASTDELTASVAR, GASTFEL, GASTNYLANK_SVAR, GASTNYCKELFORM, MAX_GASTNAMN, normaliseraGastepost } from "../lib/gast.js";
import { ALLA, SENASTE, minne, sessionsnyckelFor, skrivSessionTillMinne, sparadeSessionsIds } from "../lib/gastminne.js";
import { GastVaxlare, vaxlarrad } from "./GastVaxlare.jsx";
import { definierade, forvalda } from "../lib/ord.js";
import { PUBLIK_KLASS, PUBLIK_TONER } from "../lib/publikKlass.js";
import { SPRAK } from "../lib/sprak.js";
import { GastDelta } from "./GastDelta.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { ORD_OPSDELADHANDELSE } from "./OpsDeladHandelse.jsx";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { PublikHuvud } from "./PublikHuvud.jsx";
import { ORD_PUBLIKMARKE, PublikMarke } from "./PublikMarke.jsx";
import { GastsidaInfo } from "./gastsidaInfo.js";
import { IKON_FOR } from "./ikonlexikon.js";

/**
 * Orden på gästsidan, på svenska och engelska (0.131.0, cllp/lifehub.app#389). Svenskan i feltexterna är `GASTFEL` och ingen kopia av den (regel 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTSIDA = {
  sprakEtikett: { sv: "Språk", en: "Language" },
  laddar: { sv: "Hämtar", en: "Loading" },
  // ⛔ VÄLKOMSTEN ERSÄTTER ADRESSTEGET (0.200.0, cllp/ops-framework#540). QA 2026-11-07 och CP samma dag: gästen ska "komma direkt in ... hoppa över att bekräfta med mailen", och det ska vara
  // "SUPERSIMPELT". Rubriken är neutral av samma skäl som förut (0.146.0): före inloggningen vet sidan inte vad inbjudan gäller.
  valkommenRubrik: { sv: "Välkommen", en: "Welcome" },
  valkommenIngress: { sv: "Du har fått en inbjudan. Du behöver inget konto.", en: "You have been invited. You do not need an account." },
  oppna: { sv: "Öppna", en: "Open" },
  // Adressen frågas bara på sidan utan länk (`ny-lank`), av den som har tappat allt.
  adressEtikett: { sv: "Din e-postadress", en: "Your email address" },
  felAdress: { sv: "Det där ser inte ut som en e-postadress.", en: "That does not look like an email address." },
  // ⛔ ETT NEJ EFTER ÖPPNA SÄGER VAD GÄSTEN KAN GÖRA (0.200.0). Fel nyckel och okänd inbjudan är samma nej byte för byte, och den vanligaste orsaken är en äldre länk efter att en ny skickats.
  lankenFungerarInte: {
    sv: "Länken fungerar inte längre. Använd den senaste länken du fått, eller be den som bjöd in dig om en ny.",
    en: "The link no longer works. Use the latest link you received, or ask the person who invited you for a new one.",
  },
  // Ingen ny länk på egen hand: den går med mejl, och en inbjudan med telefon har inget mejl. Den som bjöd ger en ny med Dela.
  utgangenTelefon: { sv: "Be den som bjöd in dig om en ny länk.", en: "Ask the person who invited you for a new link." },
  orsak_nej: { sv: GASTFEL.nej, en: "The link no longer works" },
  orsak_aterkallad: { sv: GASTFEL.aterkallad, en: "The invitation has been withdrawn" },
  orsak_utgangen: { sv: GASTFEL.utgangen, en: "The link has expired" },
  "orsak_for-manga": { sv: GASTFEL["for-manga"], en: "Too many attempts. Wait a while and try again" },
  orsak_saknas: { sv: GASTFEL.saknas, en: "What you were invited to no longer exists" },
  kundeInte: { sv: "Det gick inte just nu. Försök igen.", en: "That did not work right now. Try again." },
  nyLankRubrik: { sv: "Be om en ny länk", en: "Ask for a new link" },
  // ⛔ (0.195.0) Sidan säger först att länken i mejlet räcker: en ny länk gör de gamla ogiltiga, och den som bara loggat ut ska inte ogiltigförklara sin inbjudan av misstag.
  nyLankIngress: {
    sv: "Har du kvar mejlet med inbjudan, öppna länken i det. Annars skriver du din adress här, så skickar vi en ny länk om adressen har en inbjudan. En ny länk gör att de gamla slutar fungera.",
    en: "If you still have the invitation email, open the link in it. Otherwise enter your address here and we will send a new link if the address has an invitation. A new link makes the old ones stop working.",
  },
  nyLankKnapp: { sv: "Skicka en ny länk", en: "Send a new link" },
  // (0.215.0, lifehub.app#760 skiva 3) Växlaren överst och Mina inbjudningar.
  vaxlareEtikett: { sv: "Dina inbjudningar", en: "Your invitations" },
  vaxlareHelaGruppen: { sv: "Hela gruppen", en: "The whole group" },
  vaxlareHandelser: { sv: "Händelser och omröstningar", en: "Events and polls" },
  vaxlareOmrostning: { sv: "Omröstning", en: "Poll" },
  vaxlareVisas: { sv: "Visas nu", en: "Showing now" },
  vaxlareFel: { sv: "Inbjudan gick inte att öppna. Den kan ha dragits tillbaka.", en: "The invitation could not be opened. It may have been withdrawn." },
  minaInbjudningar: { sv: "Mina inbjudningar", en: "My invitations" },
  minaRubrik: { sv: "Mina inbjudningar", en: "My invitations" },
  minaIngress: {
    sv: "Skriv din e-postadress, så skickar vi ett mejl med en länk till varje inbjudan du har, upp till fem. Länkarna gäller en gång och i ett dygn. En inbjudan till ett telefonnummer når inte hit: be den som bjöd in dig om en ny länk.",
    en: "Enter your email address and we will send an email with a link to each invitation you have, up to five. The links work once and for one day. An invitation to a phone number cannot be reached here: ask the person who invited you for a new link.",
  },
  minaKnapp: { sv: "Skicka länkarna", en: "Send the links" },
  minaTillbaka: { sv: "Tillbaka", en: "Back" },
  nyLankSvar: { sv: GASTNYLANK_SVAR, en: "If the address has an invitation we have sent a link." },
  namnEtikett: { sv: "Vad ska gruppen kalla dig? (valfritt)", en: "What should the group call you? (optional)" },
  namnSpara: { sv: "Spara", en: "Save" },
  namnSparar: { sv: "Sparar…", en: "Saving…" },
  namnSparat: { sv: "Sparat", en: "Saved" },
  // (0.198.0, cllp/ops-framework#536, förslag B) Under rubriken Du på översikten: "Du syns som Collan · Ändra".
  namnKallas: { sv: "Du syns som {namn}", en: "You appear as {namn}" },
  namnAndra: { sv: "Ändra", en: "Change" },
  namnAvbryt: { sv: "Avbryt", en: "Cancel" },
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
    sv: "Det här sparas om dig: din e-postadress eller ditt telefonnummer och namnet du eller den som bjöd in dig angav, vad du bjudits in till, när, och av vem. Vi sparar också att du loggat in och när, och en kodad kopia av nyckeln som håller dig inloggad på den här enheten (själva nyckeln finns bara hos dig). Dina svar och röster sparas under ett id som räknas fram ur din adress, och de meddelanden du skriver i gruppens chatt sparas med ditt namn och märket Gäst, där alla i gruppen ser dem. Vi räknar hur många anrop du gör och hur många filer du hämtar, för att stoppa missbruk, och en av de fem gratis platserna i gruppen är reserverad åt dig. Appen kan dessutom spara adressen i sin utgående post. Inget av det används till annat än att du ska kunna vara med.",
    en: "This is what we keep about you: your email address or phone number and the name you or the person who invited you gave, what you were invited to, when, and by whom. We also keep that you signed in and when, and a coded copy of the key that keeps you signed in on this device (the key itself only exists with you). Your answers and votes are kept under an id calculated from your address, and the messages you write in the group chat are kept with your name and the mark Guest, where everyone in the group can see them. We count how many requests you make and how many files you fetch, to stop abuse, and one of the five free places in the group is reserved for you. The app may also keep the address in its outgoing mail. None of it is used for anything except letting you take part.",
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
  // ⛔ (0.190.0, QA fynd 7 i cllp/lifehub.app#658) En delad enhet: knappen glömmer sessionerna här och frågar efter adressen igen.
  // ⛔ (0.195.0, CP 2026-11-06: "Vad gör denna med be om en ny länk? Varför då? ... Skriv in adressen igen? Hänger inte med") Den hette "Skriv in adressen igen", vilket inte säger att man
  // loggas ut. Utan länken i minnet landade gästen på "Be om en ny länk", och en ny länk gör de gamla ogiltiga, också den i inbjudningsmejlet. Nu säger knappen vad den gör, den står inne i
  // integriteten och inte mitt i översikten, och raden före säger hur man kommer tillbaka.
  loggaUt: { sv: "Logga ut på den här enheten", en: "Sign out on this device" },
  loggaUtText: { sv: "Du kommer tillbaka med länken i ditt mejl.", en: "You come back with the link in your email." },
  // (0.195.0, CP 2026-11-06) Loggan och en rad om appen, med `omAppen`. `{namn}` är appens namn, `{grupp}` gruppens.
  // (0.204.0) Samma ord som märket på de delade sidorna, ett hem (`ORD_PUBLIKMARKE`).
  omAppenEtikett: ORD_PUBLIKMARKE.omAppenEtikett,
  // (0.198.0, CP 2026-11-07 i cllp/ops-framework#536: "Även texten") Vad appen är, kort. Förut "{grupp} använder {namn}, där grupper organiserar sig utan att jaga varandra."
  omAppenRad: { sv: "{grupp} samlar chatt, kalender och filer i {namn}.", en: "{grupp} brings chat, calendar and files together in {namn}." },
  omAppenLasMer: { sv: "Läs mer", en: "Read more" },
  raderad: { sv: "Dina uppgifter är raderade. Du har inte längre någon åtkomst, och inget av det vi sparade om dig finns kvar.", en: "Your data has been deleted. You no longer have access, and nothing we kept about you remains." },
};

/**
 * Prövar appens `omAppen` (0.195.0): `{ href, namn }`, där `href` är en `https:`-adress. Allt annat kastar, med skälet: en `javascript:`-adress i en länk kör kod på gästens sida,
 * och en `http:`-adress skickar gästen ut okrypterat från en sida som bär en sessionsnyckel. Samma hållning som `provadVyAdress` för Bibliotekets vyer, men strängare: bara https.
 * @param {unknown} omAppen
 * @returns {{ href: string, namn: string } | null}
 */
function provatOmAppen(omAppen) {
  if (omAppen === undefined || omAppen === null) return null;
  const o = /** @type {{ href?: unknown, namn?: unknown }} */ (omAppen);
  let https = false;
  try {
    https = typeof o.href === "string" && new URL(o.href).protocol === "https:";
  } catch {
    https = false;
  }
  if (!https || typeof o.namn !== "string" || !o.namn.trim()) {
    throw new Error(`OpsGastSida: omAppen är { href, namn }, där href är en https-adress (fick ${typeof o.href === "string" ? JSON.stringify(o.href.slice(0, 40)) : typeof o.href}) och namn är appens namn. En javascript-, data- eller http-adress är aldrig tillåten.`);
  }
  return { href: /** @type {string} */ (o.href), namn: o.namn.trim() };
}

/**
 * Gästens egen sida: det en person ser som bjudits in utan konto, på `GASTSOKVAG` (`/guest`; den tidigare `/gast` öppnar samma sida) (0.131.0, cllp/lifehub.app#389, skiva 1; 0.132.0, skiva 2: hela gruppen).
 *
 * ══ ⛔ SIDAN HAR INGEN FIREBASE OCH INGET KONTO, OCH DEN RITAS FÖRE APPENS GRIND ════════════════════════════════════════
 *
 * Appen ritar den på `/guest` före sin inloggning, utan Firebase, med `noindex`. `/gast` är samma sida. Sidan vet inget om gruppen, medlemmarna eller andra gäster: den får `onLos`, `onHamta`, `onNamn` och
 * `onNyLank` (appens anrop mot `/api/gast`) och ritar vad de svarar. Sakens eget kort (för omröstningen: förslagen, Ja, Kanske, Nej och summan) är appens och ritas av `renderSak`.
 * Hela gruppen (`funktion: "grupp"`) ritas av `renderGrupp`, normalt `OpsGastGrupp` med `gastGruppApi(anrop, sessionsnyckel)`: det bantade gränssnittet med Översikt och ingen väg ut ur sidan.
 *
 * ══ ⛔ LÄNKEN RÄCKER: VÄLKOMMEN OCH ÖPPNA, INGET ATT SKRIVA (0.200.0) ═══════════════════════════════════════════════════
 *
 * Före 0.200.0 frågade sidan efter gästens adress (eller nummer) innan länken löstes in. QA 2026-11-07 och CP samma dag: gästen ska "komma direkt in ... hoppa över att bekräfta med mailen", och det
 * ska vara "SUPERSIMPELT". Second opinion (Fable, cllp/ops-framework#540): mejlet öppnas ofta i mejlappens egen webbvy, som har egen lagring, så gästen fick skriva adressen i varje webbläsare.
 *
 * Första öppningen med en länk (`lank`, ur `tolkaGastLank(location.hash)`) i en webbläsare: sidan säger Välkommen och visar knappen Öppna. Knappen postar `{ id, nyckel }`, och ett ja ger en
 * sessionsnyckel som sparas i webbläsarens minne (per inbjudan). Fragmentet tas bort ur adressraden så att nyckeln inte ligger kvar i historiken. Nästa gång sidan öppnas, med eller utan länk, hämtas
 * saken direkt med sessionen, utan välkomsten. Länken förbrukas inte: samma länk öppnar i en annan webbläsare också.
 *
 * ⛔ SIDAN LÖSER INTE IN LÄNKEN AV SIG SJÄLV, BARA KNAPPEN GÖR DET. En säkerhetsskanner i ett mejlprogram kan öppna sidan, och en sida som loggade in vid sidladdningen hade gett skannern en session
 * och märkt gästen som inloggad. Knappen är också platsen för välkomsten. (Att knappen stoppar en skanner som kör skript är en bedömning, inte mätt.)
 *
 * Har länken gått ut erbjuder sidan Skicka en ny länk (`onNyLank({ id, nyckel })`): brevet går till inbjudans egen adress och gästen skriver ingenting. En telefonlänk (`slag: "telefon"`) har inget brev, och
 * sidan ber gästen fråga den som bjöd in. Utan någon länk alls (sidan öppnad på `/guest`) skriver gästen sin adress och får en ny länk (`onNyLank({ epost })`), med samma svar hur det än gått.
 *
 * ══ ⛔ FLERA SESSIONER PÅ SAMMA ENHET: INGEN GIVER UPP FÖRE DE ANDRA ÄR PRÖVADE (0.132.0) ══════════════════════════════
 *
 * En gäst kan ha en omröstning och hela gruppen på samma enhet, alltså två sessioner. Skiva 1 prövade bara den som senast öppnats (`ops-gast:senaste`), så en gäst vars gruppinbjudan dragits
 * tillbaka men som hade en levande omröstning kvar fick "Inbjudan är återkallad" och ingen väg till omröstningen. Nu prövas alla sparade sessioner i tur och ordning (senast öppnade först, sedan
 * indexet `ops-gast:alla`, sedan allt som minnet kan räkna upp): den första som svarar vinner och blir den senast öppnade, och först när ALLA nekats visas orsaken. Samma sak när en återkallelse
 * upptäcks medan sidan är öppen. En länk i adressraden (`lank`) är ett uttryckligt val och prövar bara sin egen inbjudan.
 *
 * ⛔ ALLA NEJ ÄR ETT NEJ. Fel nyckel och okänd inbjudan ger samma text (`lankenFungerarInte` efter Öppna, `orsak_nej` för en session). `aterkallad` och `utgangen` kommer bara när nyckeln stämt. Sidan försöker
 * inte vara klyftigare än servern.
 *
 * ⛔ ÅTERKALLNING SYNS INOM EN MINUT. Sidan hämtar på nytt när fliken får fokus och var `intervallMs`:e millisekund medan den är öppen (förval 60 s). Svarar servern att inbjudan är återkallad byts
 * sakens kort mot texten (och gruppens flikar försvinner med allt som lästs), och inget mer går att göra.
 *
 * ⛔ GÄSTEN KAN RADERA SIG SJÄLV (0.132.0, CP 2026-10-20: klart före första gruppgästen). Längst ned står vad som sparas och hur det raderas (`integritet*`), och med `onRaderaMig` en knapp som frågar en gång
 * och sedan tar bort allt. Utan `onRaderaMig` säger texten att den som bjöd in raderar, i stället för att lova en knapp som inte finns.
 *
 * ⛔ KNAPPARNA VÄNTAR SJÄLVA (`OpsButton`, 0.129.0). Ett andra tryck medan ett anrop väntar startar inget nytt: servern räknar felaktiga försök per inbjudan.
 *
 * ⛔ SPRÅKET ÄR BESÖKARENS (som `OpsDeladHandelse`): SV och EN i huvudet, förval webbläsarens språk, valet sparas. Ger appen `sprak` är språket appens.
 *
 * @param {object} props
 * @param {{ id: string, nyckel: string, slag?: "telefon", sprak?: "sv" | "en" } | null} [props.lank] Id och nyckel ur adressens fragment (`tolkaGastLank`), eller `null` när sidan öppnas utan länk. (0.197.0) `slag: "telefon"`:
 *   en länk som gått ut ger ingen knapp för en ny länk, eftersom en telefoninbjudan inte har något brev. Tecknet är ingen behörighet.
 * @param {(arg: { id: string, nyckel: string }) => Promise<{ ok: boolean, sessionsnyckel?: string, orsak?: string }>} props.onLos (0.200.0) Bara id och nyckel: gästen skriver ingenting.
 * @param {(arg: { id: string, nyckel: string }) => Promise<{ ok: boolean, orsak?: string }>} [props.onProva] (0.202.0) Prövar länken när sidan laddas, utan att lösa in den (tjänstens `prova`). Ett nej visar felet direkt i stället för Välkommen.
 * @param {(arg: { sessionsnyckel: string }) => Promise<{ ok: boolean, namn?: string, funktion?: string, sak?: Record<string, any>, grupp?: { namn: string, funktioner: readonly string[] }, orsak?: string }>} props.onHamta
 * @param {(arg: { epost: string } | { id: string, nyckel: string }) => Promise<unknown>} props.onNyLank Ger alltid samma svar; sidan skriver ut `nyLankSvar` oavsett vad som kommer tillbaka. (0.200.0) `{ id, nyckel }` när
 *   gästen har en länk som gått ut (brevet går till inbjudans egen adress), `{ epost }` när sidan öppnats utan länk.
 * @param {(arg: { sessionsnyckel: string, namn: string }) => Promise<unknown>} [props.onNamn] Utelämnad: ingen namnruta.
 * @param {(arg: { sessionsnyckel: string, val: string }) => Promise<{ ok: boolean, mitt?: string, orsak?: string }>} [props.onSvara] (0.146.0) Gästen svarar på en händelse (`delta`): appens anrop mot `/api/gast` med åtgärden `deltaSvara`, `val` ur
 *   `GASTDELTASVAR`. Sidan ritar händelsen och de tre knapparna själv. Nekas svaret (`aterkallad`, `saknas`, `nej`) hämtas sidan om, så att texten byts direkt. Utelämnad: en `delta`-inbjudan visas inte (`gruppEjStodd`), i stället för knappar som inte gör något.
 * @param {(arg: { sessionsnyckel: string }) => Promise<unknown>} [props.onRaderaMig] (0.132.0) Raderar gästens uppgifter (`raderaMig`). Utelämnad: ingen knapp, och texten hänvisar till den som bjöd in.
 * @param {(arg: { sak: Record<string, any>, funktion: string, sessionsnyckel: string, uppdatera: () => Promise<void> }) => import("react").ReactNode} [props.renderSak] Sakens kort. `uppdatera` hämtar saken på nytt (efter en röst).
 * @param {(arg: { grupp: { namn: string, funktioner: readonly string[] }, namn: string, sessionsnyckel: string, uppdatera: () => Promise<void> }) => import("react").ReactNode} [props.renderGrupp] (0.132.0) Hela gruppen. `uppdatera` hämtar om sidan:
 *   anropa den när en åtgärd nekas (`aterkallad`), så byts allt mot texten direkt i stället för vid nästa minut. Utan den visas en text om att inbjudan inte går att visa.
 * @param {import("react").ReactNode} [props.huvud] Appens logga eller namn, till vänster i huvudet. Med `marke` står det efter märket (en länk tillbaka till hubben).
 * @param {{ ljus: string, mork: string, namn: string }} [props.marke] (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del A) Appens ordmärke, en URL per tema: en BRED bild som är
 *   tätt beskuren runt märket, som appens headerbild (1079 x 260, ungefär 4:1), inte fyrkantig konst med luft runt. Den ritas i samma ruta som skalets märke (40 px hög, högst
 *   `--logo-bredd` bred), fyller höjden och beskärs inte, så ett märke i 4:1 blir cirka 160 x 40 px. `namn` är bildens alternativtext.
 * @param {{ href: string, namn: string }} [props.omAppen] (0.195.0, CP 2026-11-06) Appens egen sida om sig själv. Med den blir märket i huvudet en länk dit (ny flik), och sist i gruppens
 *   översikt står "{gruppens namn} samlar chatt, kalender och filer i {namn}. Läs mer" (0.198.0), med Läs mer som länk. Ramverket känner inte appens adresser, därför en prop.
 *   `href` måste vara `https:`; allt annat kastar. Utan den är märket en bild och raden saknas.
 * @param {string} [props.sprak] `sv` eller `en` om appen styr det. Utelämnat: sidan väljer själv och minns valet.
 * @param {(sprak: string) => void} [props.onSprak]
 * @param {number} [props.intervallMs] Hur ofta saken hämtas på nytt medan sidan är öppen. Förval 60 000. `0` stänger av tidtagningen (fokus hämtar ändå).
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void, key?: (i: number) => string | null, length?: number } | null} [props.lagring] Minnet för sessionen. Förval `localStorage`; `null` ger bara minne för den här sidvisningen.
 * @param {Partial<Record<keyof typeof ORD_OPSGASTSIDA, string>>} [props.ord] Egna texter, som vinner över ordboken.
 */
export function OpsGastSida({ lank = null, onLos, onProva, onHamta, onNyLank, onNamn, onRaderaMig, onSvara, renderSak, renderGrupp, huvud, marke, omAppen, sprak, onSprak, intervallMs = 60_000, lagring, ord }) {
  for (const [namn, f] of /** @type {const} */ ([["onLos", onLos], ["onHamta", onHamta], ["onNyLank", onNyLank]])) {
    if (typeof f !== "function") throw new Error(`OpsGastSida: ${namn} krävs, en funktion som anropar appens /api/gast.`);
  }
  for (const [namn, f] of /** @type {const} */ ([["onNamn", onNamn], ["onRaderaMig", onRaderaMig], ["onSvara", onSvara], ["renderGrupp", renderGrupp]])) {
    if (f !== undefined && typeof f !== "function") throw new Error(`OpsGastSida: ${namn} måste vara en funktion (eller utelämnas).`);
  }
  if (lank !== null && (!lank || typeof lank.id !== "string" || !GASTNYCKELFORM.test(lank.nyckel) || (lank.slag !== undefined && lank.slag !== "telefon"))) {
    throw new Error("OpsGastSida: lank är { id, nyckel } (med slag: \"telefon\" för en inbjudan till ett nummer) ur tolkaGastLank, eller null.");
  }
  const telefonlank = lank?.slag === "telefon";
  if (sprak !== undefined && !(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`OpsGastSida: språket ${JSON.stringify(sprak)} finns inte (giltiga: ${SPRAK.join(", ")}).`);
  }
  const [valt, setValt] = useState(() => valdSprak({ sparat: lasSparatSprak(), webblasare: typeof navigator === "undefined" ? undefined : navigator.language }));
  const aktivt = sprak ?? valt;
  const t = { ...forvalda(ORD_OPSGASTSIDA, aktivt), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const appen = provatOmAppen(omAppen);
  const mem = useRef(minne(lagring));
  // Rubrikens tre ord (När och var, till, Plats) är den delade händelsesidans: en inbjuden ser samma rubrik som den som fått en delad länk (`DeladRubrik`).
  const { tidEtikett, till, platsEtikett } = forvalda(ORD_OPSDELADHANDELSE, aktivt);
  const rubrikOrd = { tidEtikett, till, platsEtikett };

  /** @type {[{ fas: "startar" | "valkommen" | "ny-lank" | "klar" | "fel" | "nylank-skickad" | "raderad" | "mina" }, Function]} */
  const [lage, setLage] = useState({ fas: "startar" });
  const [sessionsnyckel, setSessionsnyckel] = useState(/** @type {string | null} */ (null));
  const [svar, setSvar] = useState(/** @type {Record<string, any> | null} */ (null));
  const [orsak, setOrsak] = useState("");
  const [epost, setEpost] = useState("");
  /** (0.200.0) Svaret på Öppna när det inte blev en session: `nej`, `aterkallad`, `utgangen`, `for-manga` eller `natfel`. Tom: inget svar än. */
  const [losOrsak, setLosOrsak] = useState("");
  const [fel, setFel] = useState("");
  const [namn, setNamn] = useState("");
  const [namnSparat, setNamnSparat] = useState(false);
  /** Namnet som visas på översikten. Tom sträng: inget namn, formuläret står kvar. Sätts en gång ur servern, sedan ur sparningen. */
  const [visningsnamn, setVisningsnamn] = useState(/** @type {string | null} */ (null));
  const [andrarNamn, setAndrarNamn] = useState(false);
  const namnLast = useRef(false);
  const [fragarRadera, setFragarRadera] = useState(false);
  const [raderaFel, setRaderaFel] = useState("");
  /** Inbjudan som den visade sessionen hör till. */
  const aktivId = useRef(/** @type {string | null} */ (null));
  /**
   * (0.215.0, lifehub.app#760 skiva 3) Växlarens rader: enhetens inbjudningar som servern JUST svarat på, i den här sidvisningen. `null` innan de prövats.
   * ⛔ ETT NAMN LAGRAS ALDRIG PÅ ENHETEN: det som står i växlaren är det servern svarade nyss. En återkallad inbjudan svarar inte, och står därför inte där.
   */
  const [vaxlare, setVaxlare] = useState(/** @type {import("./GastVaxlare.jsx").Vaxlarrad[] | null} */ (null));
  const [vaxlarFel, setVaxlarFel] = useState(false);
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);
  // Serverns namn läses en gång. En senare hämtning (fokus, minut) får inte skriva över ett namn gästen just ändrat.
  useEffect(() => {
    if (namnLast.current || !svar || typeof svar.namn !== "string") return;
    namnLast.current = true;
    const n = svar.namn.trim();
    setVisningsnamn(n);
    setNamn(n);
  }, [svar]);

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
        // (0.215.0) En återkallad inbjudan står inte kvar i växlaren.
        const aterkalladId = aktivId.current;
        setVaxlare((v) => (v ? v.filter((r) => r.id !== aterkalladId) : v));
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

  // Första gången: finns en session för inbjudan (länkens, annars alla sparade, den senast öppnade först) hämtas saken direkt. Annars välkomnar sidan gästen med knappen Öppna, eller erbjuder en ny länk.
  // ⛔ Länken löses aldrig in här, bara av knappen (se filhuvudet: en skanner som öppnar sidan ska inte få en session).
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
      // En återkallad eller saknad inbjudan är ett besked till gästen och inget skäl att visa Öppna. `for-manga` likaså.
      if ("orsak" in res && res.orsak) {
        setOrsak(`orsak_${res.orsak}`);
        setLage({ fas: "fel" });
        return;
      }
      // ⛔ (0.202.0, QA 2026-11-07, punkt 3 i cllp/lifehub.app#687) LÄNKEN PRÖVAS INNAN VÄLKOMMEN VISAS: en ändrad eller gammal länk visade Välkommen och Öppna, och felet kom först efter trycket.
      // `onProva` löser inte in länken och skapar ingen session (se `prova` i tjänsten), så en mejlskanner som öppnar sidan får fortfarande ingenting. Utan `onProva` är det som förut.
      if (lank && onProva) {
        let p;
        try {
          p = await onProva({ id: lank.id, nyckel: lank.nyckel });
        } catch {
          p = null;
        }
        if (!levande.current) return;
        // Ett nätfel avgör ingenting: då visas Välkommen, och Öppna prövar på nytt. ⛔ BARA EN KÄND ORSAK ÄR ETT NEJ: en server som inte känner `prova` (en äldre funktion
        // medan webben redan är ute) svarar 400 utan orsak, och då hade varje gäst fått "Länken fungerar inte längre" för en länk som fungerar. Öppna avgör i stället.
        const o = p && p.ok === false && typeof p.orsak === "string" ? p.orsak : null;
        if (o && ["nej", "aterkallad", "utgangen", "for-manga"].includes(o)) setLosOrsak(o);
      }
      setLage({ fas: lank ? "valkommen" : "ny-lank" });
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

  /*
   * (0.215.0, lifehub.app#760 skiva 3) VÄXLAREN: när en inbjudan visas frågas servern om varje annan sparad session, en gång per sidvisning. Bara de som svarar står i växlaren, med det namn servern gav.
   * ⛔ EN FRÅGA PER SPARAD SESSION, MOT SAMMA `hamta` SOM SIDAN REDAN GÖR: ingen ny väg in, och varje svar prövar sessionen och inbjudan på nytt (en återkallad svarar `aterkallad` och står inte med).
   */
  const visasId = lage.fas === "klar" ? aktivId.current : null;
  useEffect(() => {
    if (lage.fas !== "klar" || vaxlare !== null || !svar || !aktivId.current) return;
    const nuId = aktivId.current;
    const nu = vaxlarrad(nuId, svar);
    let avbruten = false;
    void (async () => {
      /** @type {import("./GastVaxlare.jsx").Vaxlarrad[]} */
      const rader = nu ? [nu] : [];
      for (const id of sparadeIds()) {
        if (id === nuId) continue;
        const nyckel = mem.current.las(sessionsnyckelFor(id));
        if (!nyckel || !GASTNYCKELFORM.test(nyckel)) continue;
        let r;
        try {
          r = await onHamta({ sessionsnyckel: nyckel });
        } catch {
          r = null;
        }
        if (avbruten || !levande.current) return;
        const rad = r && r.ok ? vaxlarrad(id, r) : null;
        if (rad) rader.push(rad);
      }
      if (!avbruten && levande.current) setVaxlare(rader);
    })();
    return () => {
      avbruten = true;
    };
    // Körs en gång när sidan först visar en inbjudan. Ett byte i växlaren behåller listan (alla rader är redan prövade), och en återkallelse tar bort sin rad (`hamta`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lage.fas, vaxlare === null, svar === null]);

  /**
   * (0.215.0) Ett tryck i växlaren: den inbjudans EGEN session, som sidan redan har på enheten. Ingen session lånas till en annan inbjudan, så en vidarebefordrad länk ger aldrig mer än sin egen.
   * Svarar den inte (dragits tillbaka sedan växlaren prövades) tas raden bort och sidan står kvar där den var.
   * @param {string} id
   */
  async function vaxla(id) {
    if (id === aktivId.current) return;
    setVaxlarFel(false);
    const fore = aktivId.current;
    const res = await forsokSessioner([id]);
    if (!levande.current) return;
    if (!res.ok) {
      aktivId.current = fore;
      setVaxlare((v) => (v ? v.filter((r) => r.id !== id) : v));
      setVaxlarFel(true);
      return;
    }
    // Namnet och dess formulär hör till inbjudan: nästa visning läser det på nytt.
    namnLast.current = false;
    setVisningsnamn(null);
    setNamnSparat(false);
    setAndrarNamn(false);
    setFragarRadera(false);
  }

  /** (0.215.0) Mina inbjudningar: adressen, och ett brev med en länk per inbjudan (`onNyLank({ epost })`). Samma svar hur det än gick. */
  async function begarMina() {
    await begarNyLank();
  }

  /** (0.200.0) Öppna: löser in länken med id och nyckel. Gästen skriver ingenting. */
  async function oppna() {
    if (!lank) return;
    setLosOrsak("");
    let r;
    try {
      r = await onLos({ id: lank.id, nyckel: lank.nyckel });
    } catch {
      if (levande.current) setLosOrsak("natfel");
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
    setLosOrsak(["aterkallad", "utgangen", "for-manga"].includes(o) ? o : "nej");
  }

  /** (0.200.0) En länk som gått ut: en ny går till inbjudans egen adress. Gästen skriver ingenting, och svaret är detsamma hur det än gick. */
  async function begarNyLankForLank() {
    if (!lank) return;
    try {
      await onNyLank({ id: lank.id, nyckel: lank.nyckel });
    } catch {
      // ⛔ Ett fel visas inte som ett annat svar än det vanliga: servern svarar likadant hur det än gått, och sidan gör det också.
    }
    if (levande.current) setLage({ fas: "nylank-skickad" });
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
      const n = namn.trim();
      await onNamn({ sessionsnyckel, namn: n });
      if (levande.current) {
        setNamnSparat(true);
        setVisningsnamn(n);
        setAndrarNamn(false);
      }
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
    for (const k of mem.current.nycklar("ops-gast:")) mem.current.glom(k);
    setVaxlare(null);
    setSessionsnyckel(null);
    setSvar(null);
    setLage({ fas: "raderad" });
  }

  /**
   * Glömmer gästen på enheten (0.190.0, QA fynd 7 i cllp/lifehub.app#658): en delad dator eller telefon ska inte öppna någon annans grupp
   * för nästa person. ALLA sessioner på enheten glöms, inte bara den som visas: nästa person ska inte heller hamna i den förras omröstning. Servern rörs inte: sessionen
   * gäller tills den går ut, men nyckeln finns inte längre på enheten. Med länken i minnet (samma sidvisning) är det välkomsten med Öppna; utan den sidan som skickar en ny länk.
   */
  function loggaUt() {
    for (const id of sparadeIds()) glomSession(id);
    mem.current.glom(ALLA);
    mem.current.glom(SENASTE);
    // ⛔ (0.215.0, lifehub.app#760 skiva 3) ALLT GÄSTEN LÄMNAT PÅ ENHETEN, inte bara sessionerna: flikarna och besöken bär inbjudningarnas id, och växlarens namn står bara i sidans minne.
    for (const k of mem.current.nycklar("ops-gast:")) mem.current.glom(k);
    setVaxlare(null);
    setVaxlarFel(false);
    aktivId.current = lank ? lank.id : null;
    setSessionsnyckel(null);
    setSvar(null);
    setEpost("");
    setFel("");
    setOrsak("");
    setLosOrsak("");
    setNamnSparat(false);
    namnLast.current = false;
    setVisningsnamn(null);
    setAndrarNamn(false);
    setFragarRadera(false);
    setLage({ fas: lank ? "valkommen" : "ny-lank" });
  }

  // Bara för den som inte har någon länk alls: adressen, och en ny länk till den.
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
    </form>
  );

  // (0.200.0) Välkomsten med Öppna, eller beskedet efter Öppna. `for-manga` och ett nätfel låter knappen stå kvar: att försöka igen senare kan gå. Ett nej, en återkallad och en utgången länk gör det inte.
  const kanForsokaIgen = losOrsak === "" || losOrsak === "for-manga" || losOrsak === "natfel";
  const valkomst = kanForsokaIgen ? (
    <section data-gast-valkommen="" className="flex w-full max-w-md flex-col gap-4">
      <h1 className={PUBLIK_KLASS.sida}>{t.valkommenRubrik}</h1>
      <p className={PUBLIK_KLASS.brod}>{t.valkommenIngress}</p>
      <div>
        <OpsButton variant="primary" onClick={oppna}>
          {t.oppna}
        </OpsButton>
      </div>
      {losOrsak ? (
        <p role="alert" data-gast-los-fel={losOrsak} className="m-0 text-etikett text-danger">
          {losOrsak === "natfel" ? t.kundeInte : t["orsak_for-manga"]}
        </p>
      ) : null}
    </section>
  ) : (
    <div data-gast-los-fel={losOrsak} role="alert">
      {losOrsak === "utgangen" && telefonlank ? (
        <OpsEmpty title={t.orsak_utgangen} description={t.utgangenTelefon} />
      ) : losOrsak === "utgangen" ? (
        <OpsEmpty
          title={t.orsak_utgangen}
          action={
            <OpsButton variant="primary" onClick={begarNyLankForLank}>
              {t.nyLankKnapp}
            </OpsButton>
          }
        />
      ) : losOrsak === "nej" && !telefonlank ? (
        // ⛔ (0.202.0, QA 2026-11-07, punkt 4 i cllp/lifehub.app#687) EN GAMMAL ELLER ÄNDRAD LÄNK FÅR OCKSÅ BE OM EN NY: brevet går till inbjudans egen adress, gästen skriver ingenting,
        // och svaret är detsamma hur det än går (tjänstens `nyLank`). En återkallad inbjudan får ingen knapp: den som bjöd har stängt den.
        <OpsEmpty
          title={t.lankenFungerarInte}
          action={
            <OpsButton variant="primary" onClick={begarNyLankForLank}>
              {t.nyLankKnapp}
            </OpsButton>
          }
        />
      ) : (
        <OpsEmpty title={losOrsak === "aterkallad" ? t.orsak_aterkallad : t.lankenFungerarInte} />
      )}
    </div>
  );

  /** @param {boolean} [medUtloggning] Gruppens integritet bär Logga ut på den här enheten (0.195.0). En omröstning och en händelse har ingen. */
  const integritetsruta = (medUtloggning = false) => (
            <section data-gast-integritet="" className="flex min-w-0 max-w-2xl flex-col gap-3">
              {/* (0.198.0, cllp/ops-framework#536) I gruppens översikt en rad med ikon i hjälpgruppen, som skissen. */}
              <OpsDisclosure summary={medUtloggning ? <span className="flex min-w-0 items-center gap-3"><IKON_FOR.integritet size={20} aria-hidden="true" className="shrink-0 text-ink-secondary" /><span className="min-w-0">{t.integritetRubrik}</span></span> : t.integritetRubrik}>
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
                  {medUtloggning ? (
                    <div data-gast-logga-ut-rad="" className="flex flex-col items-start gap-2 pt-3">
                      <p className="m-0 text-meta text-publik-ljus-dampad">{t.loggaUtText}</p>
                      <OpsButton variant="secondary" onClick={loggaUt}>
                        {t.loggaUt}
                      </OpsButton>
                    </div>
                  ) : null}
                </div>
              </OpsDisclosure>
            </section>
  );
  const integritet = integritetsruta();
  // Det som står i gruppens översikt: integriteten, med Logga ut på den här enheten inne i den.
  const gruppInfo = (
    <div data-gast-grupp-info-sida="" className="flex min-w-0 flex-col gap-2">
      {integritetsruta(true)}
    </div>
  );

  const grupplage = lage.fas === "klar" && svar?.funktion === "grupp";
  // Raden om appen sist i översikten (0.195.0). Bara i gruppen: den nämner gruppens namn, och en omröstning eller en händelse har ingen översikt.
  const omAppenRad = appen && grupplage && typeof svar?.grupp?.namn === "string" ? (
    <p data-gast-om-appen="" className="m-0 max-w-prose text-meta text-publik-ljus-dampad">
      {t.omAppenRad.replace("{grupp}", svar.grupp.namn).replace("{namn}", appen.namn)}{" "}
      <a href={appen.href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {t.omAppenLasMer}
      </a>
    </p>
  ) : null;
  // Namnet på översikten (0.192.0). Ett sparat namn visas med Ändra. Formuläret står bara när namnet saknas eller när gästen ändrar det.
  // En omröstning och en händelse har ingen översikt, och där står `namnruta` kvar under innehållet.
  const visatNamn = visningsnamn !== null ? visningsnamn : (typeof svar?.namn === "string" ? svar.namn.trim() : "");
  const gruppNamnBlock = !onNamn ? null : visatNamn && !andrarNamn ? (
    <div data-gast-namn-visas="" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <p className="m-0 text-etikett text-ink-secondary">{t.namnKallas.replace("{namn}", visatNamn)}<span aria-hidden="true">{" ·"}</span></p>
      <button
        type="button"
        data-gast-namn-andra=""
        onClick={() => { setNamn(visatNamn); setFel(""); setAndrarNamn(true); }}
        className="inline-flex min-h-11 cursor-pointer items-center text-etikett font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t.namnAndra}
      </button>
    </div>
  ) : (
    <form
      data-gast-namn=""
      noValidate
      className="flex max-w-md flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); }}
    >
      {/* Spara står på samma rad som fältet (CP 2026-11-06 07:35: en egen rad under fältet känns klumpig). Knappen är minst 44 px. Avbryt ligger under, så raden inte får tre kontroller på en smal telefon. */}
      <OpsField label={t.namnEtikett} error={fel || undefined}>
        <div data-gast-namn-rad="" className="flex min-w-0 items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <OpsInput value={namn} onChange={setNamn} maxLength={MAX_GASTNAMN} autoComplete="name" tal={false} yta="fylld" />
          </div>
          <OpsButton type="submit" variant="secondary" busyLabel={t.namnSparar} onClick={sparaNamn}>{t.namnSpara}</OpsButton>
        </div>
      </OpsField>
      {visatNamn ? (
        <div>
          <OpsButton type="button" variant="secondary" onClick={() => { setAndrarNamn(false); setFel(""); setNamn(visatNamn); }}>{t.namnAvbryt}</OpsButton>
        </div>
      ) : null}
    </form>
  );
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
            <OpsInput value={namn} onChange={setNamn} maxLength={MAX_GASTNAMN} autoComplete="name" tal={false} yta="fylld" />
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
      {/* ⛔ (0.201.0) HUVUDET ÄR `PublikHuvud`, samma som en delad länks sida (cllp/ops-framework#544). Gruppens namn står inte bredvid loggan (0.195.0, CP 2026-11-06), och ljust och mörkt
          står bredvid språket (0.195.0, CP 2026-11-06: "Och kan vi ha ljust/mörkt läge switch där också?"). */}
      <PublikHuvud
        namn="gast"
        spalt={spalt}
        aktivt={aktivt}
        etikett={t.sprakEtikett}
        onVal={valj}
        huvud={
          <>
            {/* (0.204.0) Märket är `PublikMarke`, samma som de delade sidornas. */}
            {marke ? <PublikMarke marke={marke} sida="gast" komponent="OpsGastSida" lank={appen ? { href: appen.href, etikett: t.omAppenEtikett.replace("{namn}", appen.namn) } : null} /> : null}
            {huvud}
          </>
        }
      />
      {/* ⛔ I GRUPPEN PÅ TELEFON SLUTAR SIDAN VID BOTTENRADEN (0.190.0, del B): ytan fyller höjden ut till raden (`OpsGastGrupp`), och `main` lämnar exakt radens och den säkra ytans
          höjd under sig, som skalets `main`. Med `pb-16` hade sidan blivit högre än fönstret och rullat ovanpå ytans egen rullning. */}
      <main className={cx("mx-auto w-full flex-1 px-4", grupplage ? "pt-4 pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--spelrad-h,0px))] md:pt-12 md:pb-[calc(4rem+var(--spelrad-h,0px))]" : "pt-8 pb-16 sm:pt-12", spalt)}>
        {lage.fas === "startar" ? (
          <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
        ) : lage.fas === "valkommen" ? (
          valkomst
        ) : lage.fas === "ny-lank" ? (
          adressFormulär({ rubrik: t.nyLankRubrik, ingress: t.nyLankIngress, etikett: t.adressEtikett, knapp: t.nyLankKnapp, onKlar: begarNyLank })
        ) : lage.fas === "mina" ? (
          <div data-gast-mina="" className="flex flex-col gap-4">
            {adressFormulär({ rubrik: t.minaRubrik, ingress: t.minaIngress, etikett: t.adressEtikett, knapp: t.minaKnapp, onKlar: begarMina })}
            {svar ? (
              <div>
                <OpsButton variant="secondary" onClick={() => { setFel(""); setLage({ fas: "klar" }); }}>
                  {t.minaTillbaka}
                </OpsButton>
              </div>
            ) : null}
          </div>
        ) : lage.fas === "nylank-skickad" ? (
          <div data-gast-nylank-skickad="" className="flex flex-col gap-4">
            <OpsEmpty title={t.nyLankSvar} />
            {/* (0.215.0) Kom gästen hit från Mina inbjudningar står inbjudan hen tittade på kvar: vägen tillbaka dit. */}
            {svar && sessionsnyckel ? (
              <div>
                <OpsButton variant="secondary" onClick={() => setLage({ fas: "klar" })}>
                  {t.minaTillbaka}
                </OpsButton>
              </div>
            ) : null}
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
          <div data-gast-klar="" key={sessionsnyckel ?? ""} className="flex min-w-0 flex-col gap-6">
            {/* (0.215.0, lifehub.app#760 skiva 3) Växlaren överst: enhetens andra inbjudningar under sina grupper, och Mina inbjudningar sist. Med en enda inbjudan bara en liten länk. */}
            <GastVaxlare rader={vaxlare} visas={visasId} t={t} onVaxla={vaxla} onMina={() => { setFel(""); setLage({ fas: "mina" }); }} fel={vaxlarFel} />
            {svar && svar.funktion === "grupp" ? (
              renderGrupp ? (
                <GastsidaInfo.Provider value={{ integritet: gruppInfo, namn: gruppNamnBlock, minne: mem.current, inbjudan: aktivId.current, omAppen: omAppenRad }}>
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
            {/* ⛔ I GRUPPEN BOR INTEGRITETEN OCH NAMNET PÅ ÖVERSIKTEN (0.192.0), inte ovanför chatten. En omröstning och en händelse har ingen översikt, och där står de kvar längst ned. */}
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
