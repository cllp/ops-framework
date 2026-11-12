/**
 * Paren av text och yta som ramverkets komponenter ritar, och kravet på var och ett (WCAG AA).
 *
 * ══ ⛔ EN LISTA, TVÅ ANVÄNDARE (0.218.0, cllp/lifehub.app#786) ══════════════════════════════════════════════════════
 *
 * Listan stod i `scripts/check-kontrast.mjs`, som prövar ramverkets egna token. 0.218.0 lät en hubb sätta egna färger, och
 * granskningen av dem (`granskaPalett` i `palett.js`) fick först en egen, kortare lista på sju par. En oberoende granskning
 * mätte slumpvisa paletter som den släppte igenom: dämpad text mot sidan 2,45:1, mot headern 2,94:1, accenten mot headern
 * 2,69:1, text mot en rad med hover 4,12:1, och en palett där felraden gav 1,17:1. Två listor över samma par är två sanningar
 * (arbetsreglernas punkt 2). Därför bor paren här, och både vakten och granskningen läser dem.
 *
 * ⛔ `ink-muted` STÅR INTE HÄR, MED FLIT: den bär aldrig information (se vaktens filhuvud), och en sänkt ribba för den hade
 * skrivit in felet i listan.
 *
 * ⛔ PAR SOM LADES TILL 0.218.0 (efter granskningen): dämpad text mot sidan, headern, ett fält och en rad med hover; text mot
 * sidan, ett fält och en rad med hover; accenten mot kortet; fel, klart, varning och info som text mot sidan, headern och kortet;
 * märket mot sidan; märkets accent mot kortet. Alla mätta mot ramverkets egna token innan de skrevs in (lägsta: mörkt
 * `ink-secondary` mot `hover` 5,76:1, ljust `warning` mot `canvas` 4,64:1).
 */

/** AA: 4.5 för brödtext, 3.0 för stor eller halvfet text från 18,66 px. */
export const BROD = 4.5;
export const STOR = 3.0;
/** Grafik och kontrollers ytor, alltså inte text. WCAG 1.4.11. */
export const GRAFIK = 3.0;

/**
 * Paren som ska hålla. `text` mot `yta`, per tema.
 *
 * ⛔ `nivå: STOR` bara där texten FAKTISKT är stor eller halvfet och ≥ 18,66 px.
 * Att sänka ribban för en liten metarad är att skriva in felet i vakten.
 */
export const PAR = [
  { vad: "panelens rubrik", text: "ink", yta: "raised", niva: BROD },
  { vad: "radens rubrik", text: "ink", yta: "raised", niva: BROD },
  { vad: "radens detalj", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "radens metarad (klockslag, slag)", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "dagsrubriken (Idag, I går)", text: "ink-secondary", yta: "raised", niva: BROD },
  /* ⛔ "Ny" ÄR `OpsPill tone="info"`, i Aktivitet OCH i Inkorgen, ur
     `STATUS_TONES` (bolag-ops #363). `info-bg` är halvgenomskinlig, så den
     mäts SAMMANSATT över ytan chippet faktiskt ligger på (`bas`), i panelen
     (`raised`) och i en lista på sidan (`surface`, `canvas`). */
  { vad: "chipset Ny i panelen", text: "info", yta: "info-bg", bas: "raised", niva: BROD },
  { vad: "chipset Ny på sidan (surface)", text: "info", yta: "info-bg", bas: "surface", niva: BROD },
  { vad: "chipset Ny på sidan (canvas)", text: "info", yta: "info-bg", bas: "canvas", niva: BROD },
  /* ⛔ RÄKNEMÄRKET, `OpsCountBadge`: samma par på klockan, inkorgen, flikarna
     och panelens rader (ops-framework #97). */
  { vad: "räknemärkets siffra", text: "badge-contrast", yta: "badge", niva: BROD },
  /* ⛔ MÄRKET MOT HEADERN. Det sitter på en ikonknapp i headern (`surface`),
     och ska synas som en egen form där. */
  { vad: "märket mot headern", text: "badge", yta: "surface", niva: GRAFIK },
  /* ⛔ MÄRKET SJÄLVT MOT PANELEN, inte bara siffran i det. Ett märke som går i
     ett med ytan syns inte, hur läsbar siffran i det än är, och det är ett
     KRAV PÅ GRAFIK och därför 3:1 och inte 4,5. */
  { vad: "märket mot panelen", text: "badge", yta: "raised", niva: GRAFIK },
  { vad: "Gick fel", text: "danger", yta: "raised", niva: BROD },
  /* ⛔ FELMÄRKET, `OpsFelBadge` (0.45.0, bolag-ops#150): utropstecknet och ringen
     i `danger` på ytans egen färg, på en ikonknapp i headern. Tecknet är 8 px,
     alltså brödtextens krav och inte grafikens. */
  { vad: "felmärkets utropstecken i headern", text: "danger", yta: "surface", niva: BROD },
  { vad: "tillbakapilen", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "panelrad, vilande", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "panelrad, aktiv", text: "ink", yta: "raised", niva: BROD },
  /*
   * ⛔ REGLAGET, `OpsToggle` (cllp/bolag-ops#417). CP 2026-09-26, med bild från
   * mobilen: "Går ej att se kontrast på toggle". Mätt mot tokens gällde det
   * BÅDA temana, och det var inte en knopp som var svår att se utan en knopp
   * som inte fanns:
   *
   *   spår av (sunken) mot panelen (raised)    ljust 1,17:1   mörkt 1,00:1
   *   knopp (canvas) mot spår av (sunken)      ljust 1,09:1   mörkt 1,14:1
   *
   * ⛔ DET ÄR KANTERNA SOM BÄR KRAVET, inte fyllningarna, och därför är det
   * kanterna som står här. En fyllning som `sunken` ligger per definition nära
   * ytan den vilar på, så ett par på fyllningen hade varit ett krav tokenet
   * inte kan uppfylla.
   *
   * ⛔ PÅ-LÄGET SAKNAS HÄR, OCH DET ÄR INTE EN GLÖMSKA UTAN ETT MÄTT HÅL.
   *
   * Knoppen ligger då på `accent`, och INGET befintligt token klarar 3:1 mot
   * accent i båda temana. Mätt:
   *
   *                        ljust (accent #9a9588)   mörkt (accent #e8e0d0)
   *   raised                 2,99:1                  12,46:1
   *   canvas                 2,79:1                  14,22:1
   *   accent-contrast        2,79:1                  11,56:1
   *   ink-secondary          3,17:1                   2,44:1
   *
   * Orsaken är att ljust `accent` ligger MITT i skalan: det är för mörkt för
   * en ljus knopp och för ljust för en mörk. Samma sak gör att
   * `accent-contrast` bara ger 2,79:1 på `accent` i ljust läge, vilket står
   * utskrivet vid tokenet: mörk text hade gett 5,83:1, och det ljusa värdet
   * bärs för paritet med förlagan.
   *
   * ⛔ ATT SKRIVA IN ETT PAR SOM FALLER HADE GJORT VAKTEN RÖD FÖR ETT BESLUT,
   * inte för ett fel. ⛔ BESLUTET ÄR NU TAGET: ljust `accent-contrast` är
   * mörkt, och paret står i listan nedanför. Raden om `accent-contrast` i
   * tabellen ovan gäller alltså det GAMLA värdet och är kvar som historik.
   *
   * Reglagets på-läge är ändå fortfarande ett öppet hål: knoppen är en YTA och
   * inte text, så den behöver ett token som klarar 3:1 mot accent i båda
   * teman, och `accent-contrast` klarar det bara i ljust läge nu.
   *
   * Kontrollen som ändå finns i på-läget: knoppen FLYTTAR sig, och spårets
   * kant mot panelen står kvar. Läget avgörs alltså aldrig av färg ensam.
   */
  { vad: "reglagets spårkant mot panelen", text: "ink-secondary", yta: "raised", niva: GRAFIK },
  { vad: "reglagets knoppkant mot spåret, av", text: "ink-secondary", yta: "sunken", niva: GRAFIK },
  /*
   * ⛔ PRIMÄRKNAPPEN, OCH HÅLET SOM NOTEN OVANFÖR SADE SKULLE STÄNGAS.
   *
   * Noten löd: "Hålet stängs den dag ljust `accent-contrast` blir mörkt, och
   * det är ett produktbeslut om hur varje primärknapp ser ut." Beslutet är
   * taget, och därför står paret här i stället för i en kommentar.
   *
   * Det gäller inte bara en knapp. `accent-contrast` bär texten på VARJE
   * accentfylld yta i ramverket: `OpsButton variant="primary"`, FAB:en,
   * räknemärket, den valda dagen i kalendern och kryssrutan.
   *
   * ⛔ OCH HOVER-LÄGET STÅR MED, vilket det inte gjorde i någon tidigare
   * mätning. Mätt 2026-09-27: ljust `accent-contrast` gav 2,79:1 på `accent`
   * men bara 2,44:1 på `accent-hover`, alltså SÄMRE i det läge muspekaren
   * skapar. Ett par som bara mäter viloläget godkänner en knapp som blir
   * oläsbar när man pekar på den.
   */
  { vad: "primärknappens text", text: "accent-contrast", yta: "accent", niva: BROD },
  { vad: "primärknappens text, hover", text: "accent-contrast", yta: "accent-hover", niva: BROD },
  /* Tipsraden ("håll in Kalender", CP 2026-10-23: "man ser knappt den rutan"). Accentytan med primärknappens text, och ytan ska gå att se mot sidan. */
  { vad: "tipsradens text", text: "accent-contrast", yta: "accent", niva: BROD },
  { vad: "tipsradens stängkryss, hover", text: "accent-contrast", yta: "accent-hover", niva: GRAFIK },
  { vad: "tipsradens yta mot sidan", text: "accent", yta: "canvas", niva: GRAFIK },
  { vad: "tipsradens yta mot headern", text: "accent", yta: "surface", niva: GRAFIK },
  /*
   * ⛔ MÄRKETS ORANGE (0.31.0). "HUB" i toppraden och i inloggningen är stor text
   * (13 respektive 32 px, spärrad) och ska nå 3:1, det som WCAG kräver av
   * storstil. CP:s orange (#a9925e) klarar det mot mörk yta (5,22:1) men inte
   * mot ljus (2,94:1 mot yta, 2,85:1 mot canvas): därför har ljust läge en
   * mörkare ton av samma kulör, se `marke` i tokens/sessionstudio-profil.json.
   * Paret mot canvas är inloggningens (märket står direkt på sidan), paret mot
   * surface är toppradens.
   */
  { vad: "märkets orange i toppraden", text: "marke-accent", yta: "surface", niva: STOR },
  { vad: "märkets orange i inloggningen", text: "marke-accent", yta: "canvas", niva: STOR },
  { vad: "märkets ljusgrå (ink) i toppraden", text: "ink", yta: "surface", niva: BROD },
  /*
   * ⛔ HUBKORTETS INFO-RAD OCH "INGET NYTT" (0.31.0, fynd 8 i cllp/bolag-ops#475: "svag kontrast i info-rad och Inget nytt").
   * Raden stod i `ink-muted` (12 px, normalstil, alltså BROD 4,5:1), och `ink-muted` når det inte mot kortets yta i ljust läge.
   * Den är nu `ink-secondary`. Paret mot `raised` är kortets hover.
   */
  { vad: "hubkortets info-rad", text: "ink-secondary", yta: "surface", niva: BROD },
  { vad: "hubkortets info-rad, hover", text: "ink-secondary", yta: "raised", niva: BROD },
  /*
   * ⛔ 0.218.0, EFTER GRANSKNINGEN AV HUBBENS FÄRGER (se filhuvudet). Varje par är ett ställe komponenterna faktiskt ritar: en
   * metarad direkt på sidan (`canvas`), en rad som pekaren står på (`hover`), texten och platshållaren i ett fält (`sunken`),
   * statusorden (`OpsPill`, `OpsBanner`, felraderna) direkt på sidan, i headern och i ett kort, och märkets accent i kortet.
   */
  { vad: "dämpad text direkt på sidan", text: "ink-secondary", yta: "canvas", niva: BROD },
  { vad: "dämpad text på en rad med hover", text: "ink-secondary", yta: "hover", niva: BROD },
  { vad: "text direkt på sidan", text: "ink", yta: "canvas", niva: BROD },
  { vad: "text i ett fält", text: "ink", yta: "sunken", niva: BROD },
  { vad: "text på en rad med hover", text: "ink", yta: "hover", niva: BROD },
  { vad: "accenten mot kortet (knapp, reglage)", text: "accent", yta: "raised", niva: GRAFIK },
  { vad: "fel direkt på sidan", text: "danger", yta: "canvas", niva: BROD },
  { vad: "klart direkt på sidan", text: "success", yta: "canvas", niva: BROD },
  { vad: "klart i headern", text: "success", yta: "surface", niva: BROD },
  { vad: "klart i ett kort", text: "success", yta: "raised", niva: BROD },
  { vad: "varning direkt på sidan", text: "warning", yta: "canvas", niva: BROD },
  { vad: "varning i headern", text: "warning", yta: "surface", niva: BROD },
  { vad: "varning i ett kort", text: "warning", yta: "raised", niva: BROD },
  { vad: "info direkt på sidan", text: "info", yta: "canvas", niva: BROD },
  { vad: "info i headern", text: "info", yta: "surface", niva: BROD },
  { vad: "info i ett kort", text: "info", yta: "raised", niva: BROD },
  { vad: "märket mot sidan", text: "badge", yta: "canvas", niva: GRAFIK },
  { vad: "märkets accent i ett kort", text: "marke-accent", yta: "raised", niva: STOR },
];
