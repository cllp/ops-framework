import { useId, useMemo, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { MAX_GRUPPBESKRIVNING, MAX_GRUPPORT } from "../lib/grupp.js";
import { gruppmarkeProps } from "../lib/gruppikoner.js";
import { kulorTillFarg } from "../lib/gruppfarg.js";
import { OpsGruppmarkeValjare } from "./OpsGruppmarkeValjare.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { text as namnText } from "../lib/sprak.js";
import { huvudmenyInom } from "../lib/modulinstallningar.js";
import { synsPa, synsPaText } from "../lib/tillagg.js";
import { OpsSelect } from "./OpsSelect.jsx";
import { BockIkon, ChevronNedIkon, KryssIkon, PlusIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
/**
 * Formuläret "Ny grupp": SessionStudios `ManageGroupModal` i sin `inline`-form, som en PANEL (0.32.0, #180).
 *
 * ══ ⛔ SAMMA ORDNING SOM SS, MÄTT UR KÄLLAN (CP 2026-09-29 23:30) ═════════════════════════════════════════
 *
 * CP: "Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio."
 * SS `ManageGroupModal.jsx:479-640` (kroppen) och `ManageGroupModalGroupImages.jsx`:
 *
 *   1. En rad "Visuell identitet" (`:34-45`): märket i en cirkel, "Färg och ikon", en hint och en chevron. Ett tryck fäller ut
 *      (`identityOpen`) färgprickar (`w-9 h-9 rounded-full`, vald med ring och bock), en rad ikonrutor (`w-8 h-8`) med en
 *      "Aa"-ruta för initialer först, och när initialer är valda ett fält om 1 till 3 tecken med "Återställ".
 *   2. Namn (`:590`), Beskrivning (`:594`), Ort (`:598`).
 *   3. Medlemmar (`ManageGroupModalMembersSection`): en rad "e-post, roll, Lägg till" och listan under.
 *   4. "Mer inställningar" (`MoreSettingsDisclosure`), hopfälld, med resten. Här: E-postspråk.
 *
 * Före 0.32.0 fanns ingen väg att skapa en grupp i ramverket, bara `OpsUtanMedlemskap` med ETT namnfält för den FÖRSTA gruppen.
 *
 * ══ ⛔ EN PANEL, INTE EN MODAL, OCH KNAPPRADEN ÄR SKALETS ═══════════════════════════════════════════════════
 *
 * Formuläret ritas av `OpsAppShell` i skapa-panelen (`skapa.grupp`), med Tillbaka, rubrik och en fast knapprad. `Spara` är skalets
 * `type="submit" form={formId}`: formuläret ger sitt `<form>` `id={formId}` och har ingen egen sparaknapp.
 *
 * ══ ⛔ FORMULÄRET ÄGER INGEN DATA OCH INGEN ANROPSVÄG ══════════════════════════════════════════════════════
 *
 * `onSkapa({ grupp, inbjudningar })` är appens callable (`skapaGrupp` på nodsidan, `ops-framework/node`). Formuläret vet inte
 * hur den anropas, bara vad den svarar: `{ groupId, tillagda, inbjudna, fel }`. Faller den visas felet i formuläret och ingenting
 * har sparats som en halv grupp (`skapaGrupp` skriver gruppen och ägaren i en batch).
 *
 * ⛔ INBJUDNINGARNA SAMLAS FÖRE SPARA, SOM I SS, och skickas i samma anrop. Före 0.32.0 gick det inte att bjuda in någon i ett
 * formulär alls. Rollen agare finns inte i väljaren: skaparen är ägaren.
 *
 * ⛔ BILDEN LADDAS UPP FÖRST NÄR GRUPPEN FINNS (SS `ManageGroupModalGroupImages.jsx:139`: `!isNew && form.id`). En sökväg i lagringen
 * bär gruppens id, och det finns inget id förrän gruppen är skapad. Formuläret säger det (`bildHint`) i stället för att visa en
 * uppladdning som inte kan fungera, och `onSkapad(groupId, svar)` ger appen id:t att navigera till gruppens sida med, där bilden läggs till.
 *
 * ⛔ FALLER NÅGON INBJUDAN VISAS DET. Gruppen finns då, och panelen visar vilka adresser som inte blev av och varför i stället för att
 * stängas: en tyst nedsläppsväg är värre än ett fel (arbetsreglernas punkt 5). Ett tryck på Spara eller "Öppna gruppen" går vidare, och först då får appen `onSkapad`.
 *
 * ══ ⛔ REDIGERINGSLÄGE: SAMMA FORMULÄR, INTE ETT ANDRA (0.32.0, #180 G2) ═════════════════════════════════════════
 *
 * Ges `grupp` är formuläret i redigeringsläge: fälten förifyllda, `onSpara({ grupp })` i stället för `onSkapa`, och ingen medlemssektion
 * (medlemmarna hanteras av `OpsMedlemmar`, och en inbjudan efter skapandet är ett eget anrop, inte en del av att spara utseendet).
 * SS `ManageGroupModal` är också ETT formulär för båda lägena (`isNew`).
 *
 * ⛔ BILDEN FÅR LADDAS UPP NU, NÄR GRUPPEN FINNS (SS `!isNew && form.id`). Appen ger `onLaddaUppBild(fil) => { sokvag, url }` (uppladdningen är appens: sökvägen
 * bär gruppens id och lagringen är appens beslut, ramverket importerar aldrig en lagrings-SDK) och valfritt `onTaBortBild()`. `bildUrl` är bilden som visas nu.
 * Sökvägen skickas med i `onSpara` som `bild`. ⛔ En bild som laddats upp men inte sparats blir kvar i lagringen om man går ifrån: appens uppladdning bör vara
 * idempotent på sökvägen, precis som SS `uploadGroupImage(groupId, file, "icon")` skriver över samma plats.
 *
 * ⛔ NAMNET ÄR ETT `Namn` PÅ RADEN OCH EN STRÄNG I FÄLTET. Ändras det inte skickas raden tillbaka orörd (en engelsk översättning tappas inte);
 * ändras det sätts båda språken till den nya texten när de var lika, annars bara visningsspråket.
 *
 * ⛔ TYPSNITT ÄR RAMVERKETS ROLLER (`text-etikett`, `text-sektion`, `text-hjalp`), aldrig en rå storlek (`check-typografi`).
 */

/** @typedef {import("../lib/sprak.js").Namn} Namn */

/**
 * @typedef {object} GruppFormularEtiketter
 * @property {string} [visuellIdentitet] "Visuell identitet".
 * @property {string} [fargOchIkon] "Färg och ikon".
 * @property {string} [visuellIdentitetHint]
 * @property {string} [farg] "Färg".
 * @property {string} [ikonEllerLogotyp]
 * @property {string} [initialer] Skärmläsarnamn på "Aa"-rutan.
 * @property {string} [kulorExakt] (0.65.0, #265) Reglaget för alla 360 kulörer.
 * @property {string} [kulorGrader] Enheten efter reglagets värde.
 * @property {string} [kulorAterstall] Reglagets återställning till kulören ur gruppen.
 * @property {string} [kulorHint] Vad kulören gör och inte gör.
 * @property {string} [sokIkon] Sökfältets namn.
 * @property {string} [sokIkonPlatshallare]
 * @property {string} [forslagUrNamn] Raden med förslag ur gruppens namn.
 * @property {string} [forslagInga] Texten när namnet inte ger några förslag (regel 5).
 * @property {string} [forslagSkrivNamn] Texten när namnet är tomt.
 * @property {string} [senastAnvanda]
 * @property {string} [senastInga]
 * @property {string} [vanliga]
 * @property {string} [traffar] Rubriken över sökträffarna, följd av antalet.
 * @property {string} [traffarStatus] Skärmläsarens statusrad efter en sökning. `{n}` byts mot antalet.
 * @property {string} [ingetMatchar] Statusraden när sökningen inte gav något.
 * @property {string} [ingaTraffar] Texten när sökningen inte ger något. `{fraga}` byts mot frågan.
 * @property {string} [egnaInitialer]
 * @property {string} [egnaInitialerHint]
 * @property {string} [aterstallInitialer]
 * @property {string} [bildHint] Vad som gäller för bilden när gruppen skapas.
 * @property {string} [namn] "Gruppnamn".
 * @property {string} [namnPlatshallare]
 * @property {string} [namnKravs] Felet när namnet saknas.
 * @property {string} [beskrivning]
 * @property {string} [beskrivningPlatshallare]
 * @property {string} [ort]
 * @property {string} [ortPlatshallare]
 * @property {string} [medlemmar] Rubrik, följd av antalet.
 * @property {string} [epost] "E-postadress".
 * @property {string} [roll] "Roll".
 * @property {string} [lagg] "Lägg till".
 * @property {string} [taBort] "Ta bort" (följs av adressen).
 * @property {string} [epostFel] Felet när adressen inte är en adress.
 * @property {string} [epostDubblett] Felet när adressen redan är tillagd.
 * @property {string} [medlemmarHint]
 * @property {Record<"admin"|"medlem", string>} [roller]
 * @property {string} [merInstallningar]
 * @property {string} [epostsprak] "E-postspråk".
 * @property {string} [epostsprakHint]
 * @property {Record<"sv"|"en", string>} [spraknamn]
 * @property {string} [sparar]
 * @property {string} [skapadTitel] Rubriken på resultatvyn när någon inbjudan föll.
 * @property {string} [skapadText]
 * @property {string} [oppnaGruppen]
 * @property {string} [felTitel] Rubriken när gruppen inte kunde skapas.
 * @property {string} [laddaUpp] Knappen som väljer en bild (redigeringsläge).
 * @property {string} [bytBild]
 * @property {string} [taBortBild]
 * @property {string} [bildFel] Felet när uppladdningen föll.
 * @property {string} [bildForStor]
 * @property {string} [bildHintRedigera] Vad som gäller för bilden när gruppen finns.
 * @property {string} [sparaFelTitel] Rubriken när ändringarna inte kunde sparas.
 * @property {string} [modulerRubrik] "Appar" (0.50.0; "Moduler" sedan 0.37.0).
 * @property {string} [modulerHint]
 * @property {string} [modulerTomt] Texten när appen inte registrerat någon modul med ett kort.
 * @property {string} [modulOkand] Raden för en modul gruppen har men appen inte registrerat. `{id}` byts mot id:t.
 * @property {string} [synsPa] (0.60.0, #251) Orden före listan på varje app: "Syns på".
 * @property {string} [synsPaEgenYta] (0.60.0) Appen har en egen sida (nav eller kort i hubben): "Egen yta".
 * @property {string} [synsPaIngenting] (0.60.0) Appen har varken egen yta eller tillägg. Skrivs ut, aldrig en tom rad (regel 5).
 * @property {string} [modulInstallningar] (0.89.0) Länken under en installerad app med kort. Öppnar appens eget inställningsläge.
 */

/** @type {Record<"sv"|"en", Required<GruppFormularEtiketter>>} */
const STANDARD = {
  sv: {
    visuellIdentitet: "Visuell identitet",
    fargOchIkon: "Färg och ikon",
    visuellIdentitetHint: "Hur gruppen syns i listor och i gruppväljaren",
    farg: "Färg",
    ikonEllerLogotyp: "Ikon eller initialer",
    initialer: "Initialer",
    kulorExakt: "Exakt kulör",
    kulorGrader: "grader",
    kulorAterstall: "Kulör ur gruppen",
    kulorHint: "Ljusheten följer temat, ljust eller mörkt, så ikonen alltid syns.",
    sokIkon: "Sök ikon",
    sokIkonPlatshallare: "Musik, fotboll, kontor ...",
    forslagUrNamn: "Förslag ur namnet",
    forslagInga: "Namnet ger inga förslag. Sök eller välj bland de vanliga.",
    forslagSkrivNamn: "Skriv ett gruppnamn så föreslås ikoner som passar.",
    senastAnvanda: "Senast använda",
    senastInga: "Inga ännu.",
    vanliga: "Vanliga",
    traffar: "Träffar",
    traffarStatus: "{n} träffar",
    ingetMatchar: "Inget matchar",
    ingaTraffar: "Inga ikoner matchar \"{fraga}\".",
    egnaInitialer: "Egna initialer",
    egnaInitialerHint: "Ett till tre tecken. Tomt fält ger initialer ur gruppens namn.",
    aterstallInitialer: "Återställ till automatiska",
    bildHint: "En bild går att lägga till när gruppen har skapats.",
    namn: "Gruppnamn",
    namnPlatshallare: "Vad heter gruppen?",
    namnKravs: "Gruppen behöver ett namn.",
    beskrivning: "Beskrivning",
    beskrivningPlatshallare: "En kort beskrivning",
    ort: "Ort",
    ortPlatshallare: "Till exempel Visby",
    medlemmar: "Medlemmar",
    epost: "E-postadress",
    roll: "Roll",
    lagg: "Lägg till",
    taBort: "Ta bort",
    epostFel: "Det där ser inte ut som en e-postadress.",
    epostDubblett: "Den adressen är redan tillagd.",
    medlemmarHint: "De får en inbjudan när gruppen har skapats. Du är gruppens ägare.",
    roller: { admin: "Admin", medlem: "Medlem" },
    merInstallningar: "Mer inställningar",
    epostsprak: "E-postspråk",
    epostsprakHint: "Språket gruppens utskick skrivs på, till exempel inbjudningar.",
    spraknamn: { sv: "Svenska", en: "English" },
    sparar: "Sparar",
    skapadTitel: "Gruppen är skapad, men alla inbjudningar gick inte iväg",
    skapadText: "Du kan bjuda in dem igen från gruppens sida.",
    oppnaGruppen: "Öppna gruppen",
    felTitel: "Gruppen kunde inte skapas",
    laddaUpp: "Ladda upp bild",
    bytBild: "Byt bild",
    taBortBild: "Ta bort bilden",
    bildFel: "Bilden kunde inte laddas upp.",
    bildForStor: "Bilden är för stor. Högst 2 MB.",
    bildHintRedigera: "PNG, WebP eller JPEG, högst 2 MB. Bilden ersätter ikonen och initialerna.",
    sparaFelTitel: "Ändringarna kunde inte sparas",
    modulerRubrik: "Appar",
    modulerHint: "En app med egen yta blir ett kort under Appar, i den ordning du installerar dem. En app utan egen yta syns där den gör tillägg. Kalendern och inkorgen har gruppen alltid. Chatten är en app, med kort. Ikonen i huvudet, kopplingarna och appens egna inställningar öppnas i appen.",
    modulerTomt: "Det finns inga appar att installera.",
    modulOkand: "{id} är installerad i gruppen men finns inte här. Den visas inte under Appar.",
    synsPa: "Syns på",
    synsPaEgenYta: "Egen yta",
    modulInstallningar: "Inställningar",
    synsPaIngenting: "ingen egen yta och inga tillägg",
  },
  en: {
    visuellIdentitet: "Visual identity",
    fargOchIkon: "Color and icon",
    visuellIdentitetHint: "How the group appears in lists and in the group switcher",
    farg: "Color",
    ikonEllerLogotyp: "Icon or initials",
    initialer: "Initials",
    kulorExakt: "Exact hue",
    kulorGrader: "degrees",
    kulorAterstall: "Hue from the group",
    kulorHint: "The lightness follows light and dark mode, so the icon is always visible.",
    sokIkon: "Search icons",
    sokIkonPlatshallare: "Music, football, office ...",
    forslagUrNamn: "Suggested from the name",
    forslagInga: "The name gives no suggestions. Search or pick a common one.",
    forslagSkrivNamn: "Type a group name to get matching icons.",
    senastAnvanda: "Recently used",
    senastInga: "None yet.",
    vanliga: "Common",
    traffar: "Matches",
    traffarStatus: "{n} matches",
    ingetMatchar: "Nothing matches",
    ingaTraffar: "No icons match \"{fraga}\".",
    egnaInitialer: "Custom initials",
    egnaInitialerHint: "One to three characters. An empty field uses the initials of the group name.",
    aterstallInitialer: "Reset to automatic",
    bildHint: "An image can be added once the group has been created.",
    namn: "Group name",
    namnPlatshallare: "What is the group called?",
    namnKravs: "The group needs a name.",
    beskrivning: "Description",
    beskrivningPlatshallare: "A short description",
    ort: "City",
    ortPlatshallare: "For example Visby",
    medlemmar: "Members",
    epost: "Email address",
    roll: "Role",
    lagg: "Add",
    taBort: "Remove",
    epostFel: "That does not look like an email address.",
    epostDubblett: "That address has already been added.",
    medlemmarHint: "They get an invitation once the group has been created. You are the owner of the group.",
    roller: { admin: "Admin", medlem: "Member" },
    merInstallningar: "More settings",
    epostsprak: "Email language",
    epostsprakHint: "The language the group's messages are written in, for example invitations.",
    spraknamn: { sv: "Svenska", en: "English" },
    sparar: "Saving",
    skapadTitel: "The group was created, but not every invitation went out",
    skapadText: "You can invite them again from the group's page.",
    oppnaGruppen: "Open the group",
    felTitel: "The group could not be created",
    laddaUpp: "Upload image",
    bytBild: "Change image",
    taBortBild: "Remove image",
    bildFel: "The image could not be uploaded.",
    bildForStor: "The image is too large. 2 MB at most.",
    bildHintRedigera: "PNG, WebP or JPEG, 2 MB at most. The image replaces the icon and initials.",
    sparaFelTitel: "The changes could not be saved",
    modulerRubrik: "Apps",
    modulerHint: "An app with its own page becomes a card under Apps, in the order you install them. An app without one shows up where it adds to other pages. The group always has its calendar and inbox. Chat is an app, with a card. The header icon, the connections and the app's own settings open in the app.",
    modulerTomt: "There are no apps to install.",
    modulOkand: "{id} is installed in the group but does not exist here. It is not shown under Apps.",
    synsPa: "Visible in",
    synsPaEgenYta: "Own page",
    modulInstallningar: "Settings",
    synsPaIngenting: "no own page and no add-ons",
  },
};

/** Samma tumregel som servern (`EPOSTFORM` i `src/node/grupp.js`): en rad som inte är skräp, inte en kontroll av brevlådan. */
const EPOSTFORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {object} GruppFormularSvar Vad `onSkapa` svarar med (`skapaGrupp` på nodsidan).
 * @property {string} groupId
 * @property {ReadonlyArray<string>} [tillagda]
 * @property {ReadonlyArray<string>} [inbjudna]
 * @property {ReadonlyArray<{ epost: string, fel: string }>} [fel]
 */

/**
 * @param {object} props
 * @param {string} [props.formId] `id` på `<form>`, så skapa-panelens fasta Spara (`type="submit" form`) når det. Skalet skickar det.
 * @param {(b: { grupp: { namn: string, farg: string, ikon: string, beskrivning: string, ort: string, epostsprak: "sv"|"en" }, inbjudningar: Array<{ epost: string, roll: "admin"|"medlem" }> }) => Promise<GruppFormularSvar>} props.onSkapa
 *   Appens anrop av `skapaGrupp`. Ett kast visas i formuläret.
 * @param {(groupId: string, svar: GruppFormularSvar) => void} [props.onSkapad] Gruppen finns. Appen navigerar till dess sida.
 * @param {() => void} [props.onKlar] Stänger panelen (skalet skickar den).
 * @param {"sv"|"en"} [props.sprak] Språket på etiketterna och förvalet för gruppens e-postspråk.
 * @param {GruppFormularEtiketter} [props.etiketter] Enskilda texter att byta ut.
 * @param {{ id: string, namn: Namn, farg?: string, ikon?: string, bild?: string, beskrivning?: string, ort?: string, epostsprak?: "sv"|"en", moduler?: ReadonlyArray<string>, huvudmeny?: ReadonlyArray<string> }} [props.grupp] REDIGERINGSLÄGE (0.32.0, G2): den befintliga gruppen. Utan den skapas en ny.
 * @param {(b: { grupp: { namn: string | Namn, farg: string, ikon: string, bild: string, beskrivning: string, ort: string, epostsprak: "sv"|"en", moduler?: string[], huvudmeny?: string[] } }) => Promise<void>} [props.onSpara] Appens sparande i redigeringsläge. Ett kast visas i formuläret.
 *   ⛔ `moduler` och `huvudmeny` (0.83.0) finns med BARA när modulvalet visades (ägaren, se `moduler`). En admin skickar aldrig fältet, eftersom reglerna avvisar hela uppdateringen om det ändras.
 * @param {{ valbara: ReadonlyArray<import("../lib/modul.js").Modul>, agare: boolean, installningarHref?: (modul: import("../lib/modul.js").Modul) => string, onNavigate?: (href: string, event: any) => void }} [props.moduler] (0.37.0, #184) Modulvalet i redigeringsläge: `valbara` ur
 *   `valbaraModuler(registrerade)`, `agare` sant bara när den inloggade är gruppens ägare. Utan det, eller för en admin, ritas inget modulval.
 *   0.89.0: `installningarHref` ger länken Inställningar under en installerad app med kort. Den öppnar appens eget läge. Saknas den ritas ingen länk: inställningarna finns ändå i appen, och en länk utan adress är en knapp som inte leder någonstans.
 * @param {string} [props.bildUrl] Gruppens nuvarande bild att visa (URL). Bara redigeringsläge.
 * @param {(fil: File) => Promise<{ sokvag: string, url: string }>} [props.onLaddaUppBild] Appens uppladdning. Utan den finns ingen bildväljare.
 * @param {() => Promise<void>} [props.onTaBortBild] Appens borttagning av bilden. Utan den finns ingen Ta bort-knapp.
 */
export function OpsGruppFormular({ formId, onSkapa, onSkapad, onKlar, sprak: sprakProp, etiketter, grupp: befintlig, onSpara, bildUrl = "", onLaddaUppBild, onTaBortBild, moduler: modulval }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const redigerar = Boolean(befintlig);
  if (!redigerar && typeof onSkapa !== "function") {
    throw new Error("OpsGruppFormular: onSkapa krävs, appens anrop av skapaGrupp. Ett formulär som inte kan skapa något är en ruta som ser ut som en grupp.");
  }
  if (redigerar && typeof onSpara !== "function") {
    throw new Error("OpsGruppFormular: onSpara krävs i redigeringsläge (grupp angiven). Ett formulär som inte kan spara är en ruta som ser ut som en redigering.");
  }
  const t = { ...STANDARD[sprak === "en" ? "en" : "sv"], ...(etiketter ?? {}) };

  const [namn, setNamn] = useState(befintlig ? namnText(befintlig.namn, sprak) : "");
  const [beskrivning, setBeskrivning] = useState(befintlig?.beskrivning ?? "");
  const [ort, setOrt] = useState(befintlig?.ort ?? "");
  const [farg, setFarg] = useState(befintlig?.farg ?? "");
  const [ikon, setIkon] = useState(befintlig?.ikon ?? "");
  const [epostsprak, setEpostsprak] = useState(/** @type {"sv"|"en"} */ (befintlig?.epostsprak ?? (sprak === "en" ? "en" : "sv")));
  const [bild, setBild] = useState(/** @type {{ sokvag: string, url: string }} */ ({ sokvag: befintlig?.bild ?? "", url: bildUrl }));
  const [bildArbete, setBildArbete] = useState(false);
  const [bildFel, setBildFel] = useState("");
  const [identitetOppen, setIdentitetOppen] = useState(false);
  const [merOppet, setMerOppet] = useState(false);
  const [inbjudna, setInbjudna] = useState(/** @type {Array<{ epost: string, roll: "admin"|"medlem" }>} */ ([]));
  const [nyEpost, setNyEpost] = useState("");
  const [nyRoll, setNyRoll] = useState(/** @type {"admin"|"medlem"} */ ("medlem"));
  const [epostFel, setEpostFel] = useState("");
  const [namnFel, setNamnFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  const [felmeddelande, setFelmeddelande] = useState("");
  const [resultat, setResultat] = useState(/** @type {GruppFormularSvar | null} */ (null));
  /*
   * ⛔ MODULVALET VISAS BARA FÖR ÄGAREN, I REDIGERINGSLÄGE (0.37.0, #184). `moduler` är ägarens fält
   * (`AGARGRUPPFALT`), och en admin som skickade med det fick hela sparningen avvisad av reglerna, inte bara modulerna.
   * ⛔ ORDNINGEN ÄR VALORDNINGEN: en modul som väljs hamnar sist, och hubben ritar korten i den ordningen.
   * ⛔ ETT ID SOM INTE ÄR VALBART LIGGER KVAR, och en rad säger det. Att tyst tappa det vid nästa sparning vore
   * en ändring ägaren aldrig gjorde (arbetsreglernas punkt 5).
   */
  const visaModulval = redigerar && modulval?.agare === true && Array.isArray(modulval.valbara);
  const [valdaModuler, setValdaModuler] = useState(/** @type {string[]} */ ([...(befintlig?.moduler ?? [])]));
  /*
   * ⛔ HUVUDMENYN SPARAS BARA SOM DELMÄNGD (0.89.0, CP 2026-10-09).
   * Reglaget "Visa i huvudmenyn" ritas inte här. Det, ikonen, synligheten, kopplingarna och appens egna fält
   * bor i appens inställningar. En app som avinstalleras tas ändå ur huvudmenyn i samma sparning, så att
   * fältet inte pekar på något gruppen inte har. Ägarens fält, samma sparning som `moduler`.
   */
  const huvudmenyKvar = huvudmenyInom(befintlig?.huvudmeny, valdaModuler);

  const identitetId = useId();
  const merId = useId();
  const idPrefix = useId();

  const marke = useMemo(() => gruppmarkeProps({ id: befintlig?.id, farg, ikon }, "ny-grupp"), [befintlig?.id, farg, ikon]);

  /**
   * Går vidare efter att gruppen finns: panelen stängs FÖRST, sedan får appen id:t.
   *
   * ⛔ ORDNINGEN ÄR ETT BESLUT. Appen navigerar till gruppens sida i `onSkapad`. Stängde panelen efter det kunde dess
   * (asynkrona) väg tillbaka i historiken landa efter appens navigering och ångra den. Skalets `onKlar` stänger
   * dessutom utan att gå bakåt (`stangSkapa(true)`), men den som använder formuläret utan skalet ska inte behöva veta det.
   */
  const klar = (/** @type {GruppFormularSvar} */ svar) => {
    onKlar?.();
    onSkapad?.(svar.groupId, svar);
  };

  const laggTill = () => {
    const e = nyEpost.trim().toLowerCase();
    if (!e) return;
    if (!EPOSTFORM.test(e)) {
      setEpostFel(t.epostFel);
      return;
    }
    if (inbjudna.some((r) => r.epost === e)) {
      setEpostFel(t.epostDubblett);
      return;
    }
    setInbjudna((lista) => [...lista, { epost: e, roll: nyRoll }]);
    setNyEpost("");
    setEpostFel("");
  };

  /** @param {import("react").FormEvent} e */
  const skicka = async (e) => {
    e.preventDefault();
    // ⛔ Resultatvyn har samma `<form>`: ett tryck på panelens Spara där betyder "gå vidare", inte "skapa en till".
    if (resultat) {
      klar(resultat);
      return;
    }
    if (upptagen) return;
    if (!namn.trim()) {
      setNamnFel(t.namnKravs);
      return;
    }
    setNamnFel("");
    setFelmeddelande("");
    setUpptagen(true);
    if (befintlig && onSpara) {
      try {
        const nyttNamn = namn.trim();
        const fore = namnText(befintlig.namn, sprak);
        const orig = /** @type {Namn} */ (befintlig.namn && typeof befintlig.namn === "object" ? befintlig.namn : { sv: fore });
        /** @type {string | Namn} */
        const namnUt = nyttNamn === fore ? befintlig.namn : orig.en === undefined || orig.en === orig.sv ? { sv: nyttNamn, en: nyttNamn } : { ...orig, [sprak === "en" ? "en" : "sv"]: nyttNamn };
        await onSpara({ grupp: { namn: namnUt, farg, ikon, bild: bild.sokvag, beskrivning: beskrivning.trim(), ort: ort.trim(), epostsprak, ...(visaModulval ? { moduler: [...valdaModuler], huvudmeny: huvudmenyKvar } : {}) } });
        klar({ groupId: befintlig.id });
      } catch (fel) {
        setFelmeddelande(fel instanceof Error ? fel.message : String(fel));
      } finally {
        setUpptagen(false);
      }
      return;
    }
    try {
      /*
       * ⛔ EN ADRESS SOM STÅR KVAR I FÄLTET NÄR MAN TRYCKER SPARA ÄR EN ADRESS MAN MENADE. Utan det här skulle
       * någon som skrev en adress och gick direkt till Spara skapa gruppen utan den personen, och inget säger det.
       */
      const ut = [...inbjudna];
      const kvar = nyEpost.trim().toLowerCase();
      if (kvar && EPOSTFORM.test(kvar) && !ut.some((r) => r.epost === kvar)) ut.push({ epost: kvar, roll: nyRoll });
      if (kvar && !EPOSTFORM.test(kvar)) {
        setEpostFel(t.epostFel);
        setUpptagen(false);
        return;
      }
      const svar = await /** @type {NonNullable<typeof onSkapa>} */ (onSkapa)({
        /*
         * ⛔ KULÖREN SOM VISAS ÄR KULÖREN SOM SPARAS (granskningen av PR 266). Utan val visar formuläret kulören ur fröet
         * "ny-grupp"; sparades tom sträng hade gruppen fått en ANNAN kulör ur sitt nya id direkt efter Spara.
         */
        grupp: { namn: namn.trim(), farg: farg || kulorTillFarg(marke.kulor), ikon, beskrivning: beskrivning.trim(), ort: ort.trim(), epostsprak },
        inbjudningar: ut,
      });
      if ((svar.fel ?? []).length > 0) {
        setResultat(svar);
      } else {
        klar(svar);
      }
    } catch (fel) {
      setFelmeddelande(fel instanceof Error ? fel.message : String(fel));
    } finally {
      setUpptagen(false);
    }
  };

  if (resultat) {
    return (
      <form id={formId} onSubmit={skicka} className="flex flex-col gap-4" data-gruppformular="resultat">
        <OpsBanner tone="warning" title={t.skapadTitel}>
          {t.skapadText}
        </OpsBanner>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {(resultat.fel ?? []).map((f) => (
            <li key={f.epost} className="text-etikett text-ink">
              <span className="font-medium">{f.epost}</span>
              <span className="text-ink-secondary">{`: ${f.fel}`}</span>
            </li>
          ))}
        </ul>
        <div>
          <OpsButton variant="secondary" onClick={() => klar(resultat)}>
            {t.oppnaGruppen}
          </OpsButton>
        </div>
      </form>
    );
  }

  return (
    <form id={formId} onSubmit={skicka} noValidate className="flex flex-col gap-4 pb-8" data-gruppformular="">
      {felmeddelande ? (
        <OpsBanner tone="danger" title={redigerar ? t.sparaFelTitel : t.felTitel} onDismiss={() => setFelmeddelande("")}>
          {felmeddelande}
        </OpsBanner>
      ) : null}

      {/* ── 1. Visuell identitet (SS ManageGroupModalGroupImages.jsx:34-45) ───────────────────────────── */}
      <div data-gruppidentitet="">
        <p className="m-0 mb-1.5 text-sektion uppercase text-ink-muted">{t.visuellIdentitet}</p>
        <button
          type="button"
          onClick={() => setIdentitetOppen((v) => !v)}
          aria-expanded={identitetOppen}
          aria-controls={identitetId}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-base border border-line-strong bg-surface px-3 py-3 text-left transition-colors duration-(--duration-fast) ease-standard hover:border-accent/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {/* ⛔ FÖRHANDSVISNINGEN ÄR DEKORATION FÖR SKÄRMLÄSAREN: knappens text säger vad raden är, och märket har inget eget namn att läsa upp
              (gruppen är inte skapad än, och en "Gruppnamn"-bild bredvid fältet med samma namn är två saker med samma etikett). */}
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-faint p-1">
            <OpsIdentity name={namn.trim()} seed={befintlig?.id ?? "ny-grupp"} imageUrl={bild.url || undefined} size="lg" rund {...marke} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-etikett font-semibold text-ink">{t.fargOchIkon}</span>
            <span className="block truncate text-meta text-ink-muted">{t.visuellIdentitetHint}</span>
          </span>
          <span aria-hidden="true" className={cx("shrink-0 text-ink-muted transition-transform duration-(--duration-fast)", identitetOppen && "rotate-180")}>
            <ChevronNedIkon />
          </span>
        </button>

        {identitetOppen ? (
          <div id={identitetId} className="mt-3 flex flex-col gap-3 rounded-base border border-line bg-canvas p-3">
            <OpsGruppmarkeValjare namn={namn} seed={befintlig?.id ?? "ny-grupp"} farg={farg} ikon={ikon} onFarg={setFarg} onIkon={setIkon} sprak={sprak === "en" ? "en" : "sv"} t={t} idPrefix={identitetId} />
            <div>
              {redigerar && onLaddaUppBild ? (
                <div className="mt-3 flex flex-col gap-1" data-gruppbild="">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="relative inline-flex">
                      <span className="sr-only">{bild.url ? t.bytBild : t.laddaUpp}</span>
                      <input
                        type="file"
                        accept="image/png,image/webp,image/jpeg"
                        disabled={bildArbete || upptagen}
                        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                        aria-label={bild.url ? t.bytBild : t.laddaUpp}
                        onChange={async (e) => {
                          const fil = e.target.files?.[0];
                          e.target.value = "";
                          if (!fil) return;
                          setBildFel("");
                          if (fil.size > 2 * 1024 * 1024) {
                            setBildFel(t.bildForStor);
                            return;
                          }
                          setBildArbete(true);
                          try {
                            const svar = await onLaddaUppBild(fil);
                            setBild({ sokvag: svar.sokvag, url: svar.url });
                          } catch {
                            setBildFel(t.bildFel);
                          } finally {
                            setBildArbete(false);
                          }
                        }}
                      />
                      <span className="pointer-events-none inline-flex min-h-11 items-center gap-2 rounded-base border border-line-strong bg-surface px-3 text-etikett font-medium text-ink peer-hover:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                        {bildArbete ? <OpsSpinner size="sm" decorative /> : null}
                        {bild.url ? t.bytBild : t.laddaUpp}
                      </span>
                    </label>
                    {bild.url && onTaBortBild ? (
                      <OpsButton
                        variant="ghost"
                        disabled={bildArbete || upptagen}
                        onClick={async () => {
                          setBildFel("");
                          setBildArbete(true);
                          try {
                            await onTaBortBild();
                            setBild({ sokvag: "", url: "" });
                          } catch {
                            setBildFel(t.bildFel);
                          } finally {
                            setBildArbete(false);
                          }
                        }}
                      >
                        {t.taBortBild}
                      </OpsButton>
                    ) : null}
                  </div>
                  {bildFel ? (
                    <p role="alert" className="m-0 text-hjalp text-danger">
                      {bildFel}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="m-0 mt-2 text-hjalp text-ink-muted">{redigerar && onLaddaUppBild ? t.bildHintRedigera : redigerar ? "" : t.bildHint}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 2. Namn, beskrivning, ort ──────────────────────────────────────────────────────────────── */}
      <OpsField label={t.namn} required error={namnFel || undefined}>
        <OpsInput value={namn} onChange={(v) => { setNamn(v); if (v.trim()) setNamnFel(""); }} placeholder={t.namnPlatshallare} disabled={upptagen} autoComplete="off" />
      </OpsField>
      <OpsField label={t.beskrivning} hint={`${beskrivning.length}/${MAX_GRUPPBESKRIVNING}`}>
        <OpsInput value={beskrivning} onChange={setBeskrivning} placeholder={t.beskrivningPlatshallare} disabled={upptagen} maxLength={MAX_GRUPPBESKRIVNING} />
      </OpsField>
      <OpsField label={t.ort}>
        <OpsInput value={ort} onChange={setOrt} placeholder={t.ortPlatshallare} disabled={upptagen} maxLength={MAX_GRUPPORT} />
      </OpsField>

      {/* ── 2b. Moduler: bara ägaren, bara redigeringsläge (0.37.0, #184) ─────────────────────────────── */}
      {visaModulval && modulval ? (
        <section aria-label={t.modulerRubrik} data-gruppmoduler="" className="flex flex-col gap-2">
          <h3 className="m-0 text-etikett font-medium text-ink-secondary">{t.modulerRubrik}</h3>
          <p className="m-0 text-hjalp text-ink-muted">{t.modulerHint}</p>
          {modulval.valbara.length === 0 ? (
            <p className="m-0 text-etikett text-ink-secondary" data-moduler-tomt="">
              {t.modulerTomt}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {modulval.valbara.map((m) => {
                const vald = valdaModuler.includes(m.id);
                const namnet = namnText(m.namn, sprak);
                // ⛔ HÄRLETT UR MANIFESTET (0.60.0, #251, regel 2): nav eller kort ger "Egen yta", tillägg ger ytornas namn.
                const syns = `${t.synsPa}: ${synsPaText(synsPa(m), { egenYta: t.synsPaEgenYta, ingenting: t.synsPaIngenting }, sprak)}`;
                return (
                  <li key={m.id}>
                    {/* ⛔ NAMNET ÄR KNAPPENS NAMN, "Syns på" ÄR DESS BESKRIVNING: en skärmläsare säger "Ekonomi, knapp, nedtryckt" och läser
                        raden under som tillägg, i stället för att varje knapp heter något långt. */}
                    <button
                      type="button"
                      aria-pressed={vald}
                      aria-label={namnet}
                      aria-describedby={`${idPrefix}-syns-${m.id}`}
                      data-modul={m.id}
                      disabled={upptagen}
                      onClick={() => setValdaModuler((l) => (l.includes(m.id) ? l.filter((x) => x !== m.id) : [...l, m.id]))}
                      className={cx(
                        "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-base border px-3 py-2 text-left text-etikett transition-colors duration-(--duration-fast) ease-standard",
                        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55",
                        vald ? "border-accent bg-accent-subtle text-ink" : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
                      )}
                    >
                      <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-5">
                        {/** @type {import("react").ReactNode} */ (m.hubb?.ikon)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{namnet}</span>
                        <span id={`${idPrefix}-syns-${m.id}`} data-syns-pa="" className="text-hjalp text-ink-muted">
                          {syns}
                        </span>
                      </span>
                      <span aria-hidden="true" className={cx("flex size-5 shrink-0 items-center justify-center text-accent", !vald && "invisible")}>
                        <BockIkon size={16} />
                      </span>
                    </button>
                    {(() => {
                      const hrefFor = modulval.installningarHref;
                      const mal = vald && m.hubb && typeof hrefFor === "function" ? hrefFor(m) : "";
                      if (!mal) return null;
                      return (
                      <div className="pt-1 pl-11">
                        <a
                          href={mal}
                          data-modul-installningar={m.id}
                          onClick={(e) => modulval.onNavigate?.(mal, e)}
                          className="inline-flex min-h-11 items-center rounded-base text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {t.modulInstallningar}
                        </a>
                      </div>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          )}
          {valdaModuler
            .filter((id) => !modulval.valbara.some((m) => m.id === id))
            .map((id) => (
              <p key={id} data-modul-okand={id} className="m-0 text-hjalp text-ink-secondary">
                {t.modulOkand.replace("{id}", id)}
              </p>
            ))}
        </section>
      ) : null}

      {/* ── 3. Medlemmar: inbjudningar samlas före spara (SS ManageGroupModalMembersSection) ──────────── */}
      {!redigerar ? (
      <section aria-label={t.medlemmar} data-gruppmedlemmar="" className="flex flex-col gap-2">
        <h3 className="m-0 text-etikett font-medium text-ink-secondary">{`${t.medlemmar} (${inbjudna.length})`}</h3>
        <p className="m-0 text-hjalp text-ink-muted">{t.medlemmarHint}</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <OpsField label={t.epost} error={epostFel || undefined}>
              <OpsInput
                type="email"
                value={nyEpost}
                onChange={(v) => { setNyEpost(v); if (epostFel) setEpostFel(""); }}
                placeholder="namn@exempel.se"
                disabled={upptagen}
                autoComplete="off"
              />
            </OpsField>
          </div>
          <div className="md:w-40">
            <OpsField label={t.roll}>
              <OpsSelect
                value={nyRoll}
                onChange={(v) => setNyRoll(v === "admin" ? "admin" : "medlem")}
                options={[{ value: "medlem", label: t.roller.medlem }, { value: "admin", label: t.roller.admin }]}
                disabled={upptagen}
              />
            </OpsField>
          </div>
          <div className="md:pt-6">
            <OpsButton variant="secondary" onClick={laggTill} disabled={upptagen || !nyEpost.trim()}>
              <PlusIkon size={16} />
              {t.lagg}
            </OpsButton>
          </div>
        </div>
        {inbjudna.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {inbjudna.map((r) => (
              <li key={r.epost} className="flex min-h-11 items-center gap-2 rounded-base border border-line bg-surface pl-3 pr-1">
                <span className="min-w-0 flex-1 truncate text-etikett text-ink">{r.epost}</span>
                <OpsPill tone={r.roll === "admin" ? "info" : "neutral"}>{t.roller[r.roll]}</OpsPill>
                <button
                  type="button"
                  onClick={() => setInbjudna((lista) => lista.filter((x) => x.epost !== r.epost))}
                  disabled={upptagen}
                  aria-label={`${t.taBort} ${r.epost}`}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <KryssIkon size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      ) : null}

      {/* ── 4. Mer inställningar (SS MoreSettingsDisclosure.jsx:56-100), hopfälld ────────────────────── */}
      <div data-mer-installningar="">
        <hr className="m-0 border-0 border-t border-line" />
        <button
          type="button"
          onClick={() => setMerOppet((v) => !v)}
          aria-expanded={merOppet}
          aria-controls={merId}
          className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-etikett font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <span>{t.merInstallningar}</span>
          <span aria-hidden="true" className={cx("transition-transform duration-200", merOppet && "rotate-180")}>
            <ChevronNedIkon />
          </span>
        </button>
        <div id={merId} role="region" aria-label={t.merInstallningar} hidden={!merOppet} className="flex flex-col gap-4 pt-3">
          <OpsField label={t.epostsprak} hint={t.epostsprakHint}>
            <OpsSelect
              value={epostsprak}
              onChange={(v) => setEpostsprak(v === "en" ? "en" : "sv")}
              options={[{ value: "sv", label: t.spraknamn.sv }, { value: "en", label: t.spraknamn.en }]}
              disabled={upptagen}
            />
          </OpsField>
        </div>
      </div>

      {upptagen ? (
        <p role="status" className="m-0 text-etikett text-ink-secondary">
          {t.sparar}
        </p>
      ) : null}
    </form>
  );
}
