/**
 * Zoomen i PDF-vyn (0.235.0): nypning, dubbeltryck, Ctrl- eller Cmd+hjul, knapparna, omritningen och taket för pixlar. Utan pdf.js och utan React, så att reglerna går att pröva var för sig.
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-16: "Det går inte att zooma i pdf:er i biblioteket. Det vore bra om det funkade." och "Ja kör zoom på pdf".
 * Raden hade − och + sedan 0.196.0 (samma som HTML-rutan, 10 till 200 procent av sidans tryckta storlek), men i en telefon zoomar man med fingrarna, och där hände ingenting: två fingrar på sidan nöp
 * hela appen eller ingenting alls, och ett dubbeltryck gjorde inget. Det var det CP mötte.
 *
 * ══ ⛔ SÅ HÄR RÄKNAS ZOOMEN ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. FAKTORN ÄR RELATIV HEL BREDD, 1 TILL 4. 1 är sidan anpassad till rutans bredd (som förut förvalet, `anpassadSkala`), 4 är fyra gånger den. Raden visar faktorn som procent: "100 %" är hel bredd, "150 %" en och en halv gång.
 *    Mindre än hel bredd behövs inte för en PDF: sidan ryms redan, och en sida som är mindre än rutan är bara svårare att läsa.
 * 2. NYPNINGEN följer fingrarna (`nypZoom`): avståndet mellan dem nu delat med avståndet när nypningen började, gånger faktorn då.
 * 3. DUBBELTRYCKET växlar (`dubbeltryckZoom`): hel bredd blir 2x, och allt inzoomat blir hel bredd. Två tryck räknas som ett dubbeltryck när de kommer inom `DUBBELTRYCK_MS` och `DUBBELTRYCK_AVSTAND` (`arDubbeltryck`).
 * 4. HJULET zoomar bara med Ctrl eller Cmd (`hjulZoom`). Utan dem rullar det som förut. En styrplattas nypning kommer i webbläsaren som Ctrl+hjul och följer samma regel.
 * 5. KNAPPARNA stegar en kvarts gång (`stegaZoom`): 100, 125, 150 och så vidare till 400 procent, till närmaste kvart i den riktningen.
 * 6. SVEPET i helskärmen byter sida bara vid hel bredd (`svepTillats`). Inzoomad drar fingret sidan, och ett drag får inte byta sida under fingret.
 * 7. ⛔ OMRITNINGEN VÄNTAR TILLS ZOOMEN STANNAT (`RITA_OM_MS`). Under nypningen sträcks den ritade bilden med CSS (ramen får sin nya storlek och canvasen fyller den). Först när faktorn stått still ritas
 *    sidorna om i den nya skalan, i skärmens upplösning. Annars hade varje rörelse med fingrarna startat en ny ritning av varje sida.
 *    ⛔ BARA SIDOR NÄRA VYN HAR EN CANVAS (granskningen av 0.235.0). Den första versionen behöll canvasen för varje sida som någon gång visats, och efter en zoom ritades alla de sidorna om i den nya skalan,
 *    samtidigt: vid 4x upp till 64 MB per sida, och några sidor räcker för att fylla Safaris canvasminne på en iPhone. Nu har en sida en canvas bara medan den är i vyn eller en skärmhöjd från den
 *    (`IntersectionObserver` i `OpsPdfVisning`). En sida som lämnar det området släpper sin canvas (bredd och höjd noll) och står kvar som en platshållare i sin storlek.
 *    ⛔ OMRITNINGARNA KÖAS (`skapaRitko`): en ritning i taget, i den ordning de bads om. Ett avbrott väntar ut den avbrutna ritningen innan nästa börjar.
 * 8. ⛔ TAKET FÖR PIXLAR (`ritmatt`): en canvas får högst `PIXELTAK` pixlar. Safari på iPhone kraschar fliken, eller ritar en tom yta, när en canvas blir större (16 777 216 pixlar är Safaris gräns för en canvas),
 *    och 4x på en A4 i skärmens upplösning (3x) är cirka 9 500 gånger 13 400, alltså 127 miljoner. Över taket ritas sidan i takets upplösning och sträcks resten: suddigare, men fliken lever.
 */

/** Hel bredd. */
export const PDF_ZOOM_MIN = 1;
/** Fyra gånger hel bredd. */
export const PDF_ZOOM_MAX = 4;
/** Dubbeltryckets inzoomning. */
export const PDF_ZOOM_DUBBEL = 2;
/** Knapparnas steg, en kvarts gång. */
export const PDF_ZOOM_STEG = 0.25;
/** Så länge zoomen ska stå still innan sidorna ritas om, i millisekunder. Se punkt 7. */
export const RITA_OM_MS = 200;
/** Längsta tid mellan två tryck i ett dubbeltryck, i millisekunder. Samma som telefonernas egna. */
export const DUBBELTRYCK_MS = 300;
/** Längsta avstånd mellan två tryck i ett dubbeltryck, i CSS-pixlar. */
export const DUBBELTRYCK_AVSTAND = 30;
/** Ett finger som rört sig mer än så här är ett drag och inget tryck, i CSS-pixlar. */
export const TRYCK_RORELSE = 10;
/** Flest pixlar i en canvas. Se punkt 8. */
export const PIXELTAK = 16_777_216;

/** Ett hjulsteg på 100 (ett hack på ett vanligt hjul) multiplicerar faktorn med `HJULFAKTOR`. Samma tal som HTML-rutans hjul. */
const HJULSTEG = 100;
const HJULFAKTOR = 1.1;
/** Två faktorer som skiljer mindre än så här är samma. */
const EPS = 1e-6;

/**
 * Faktorn inom 1 och 4. Ett tal som inte är ändligt är hel bredd.
 * @param {number} f
 * @returns {number}
 */
export function klampZoom(f) {
  if (!Number.isFinite(f)) return PDF_ZOOM_MIN;
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, f));
}

/**
 * Nästa faktor för + (`1`) eller − (`-1`): närmaste kvart i den riktningen, inom gränserna. Från 1,3 blir + 1,5 och − 1,25.
 * @param {number} f
 * @param {1 | -1} riktning
 * @returns {number}
 */
export function stegaZoom(f, riktning) {
  const kvartar = klampZoom(f) / PDF_ZOOM_STEG;
  const nasta = riktning > 0 ? Math.floor(kvartar + EPS) + 1 : Math.ceil(kvartar - EPS) - 1;
  return klampZoom(nasta * PDF_ZOOM_STEG);
}

/**
 * Faktorn efter ett hjul. Bara med Ctrl eller Cmd: utan dem är svaret `null`, och hjulet rullar som förut. Uppåt (negativt `deltaY`) förstorar.
 * @param {number} f
 * @param {{ deltaY: number, deltaMode?: number, ctrlKey?: boolean, metaKey?: boolean }} e
 * @returns {number | null}
 */
export function hjulZoom(f, e) {
  if (!e.ctrlKey && !e.metaKey) return null;
  const delta = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
  if (!Number.isFinite(delta) || delta === 0) return klampZoom(f);
  return klampZoom(f * Math.pow(HJULFAKTOR, -delta / HJULSTEG));
}

/**
 * Faktorn under en nypning: faktorn när nypningen började, gånger avståndet mellan fingrarna nu delat med avståndet då.
 * @param {number} f0 Faktorn när nypningen började.
 * @param {number} avstand0 Avståndet mellan fingrarna då.
 * @param {number} avstand Avståndet nu.
 * @returns {number}
 */
export function nypZoom(f0, avstand0, avstand) {
  if (!(avstand0 > 0) || !(avstand > 0)) return klampZoom(f0);
  return klampZoom(f0 * (avstand / avstand0));
}

/**
 * Dubbeltrycket: hel bredd blir 2x, och allt inzoomat blir hel bredd.
 * @param {number} f
 * @returns {number}
 */
export function dubbeltryckZoom(f) {
  return klampZoom(f) > PDF_ZOOM_MIN + EPS ? PDF_ZOOM_MIN : PDF_ZOOM_DUBBEL;
}

/**
 * Är två tryck ett dubbeltryck? Inom `DUBBELTRYCK_MS` och `DUBBELTRYCK_AVSTAND`.
 * @param {{ t: number, x: number, y: number } | null} forra
 * @param {{ t: number, x: number, y: number }} nu
 * @returns {boolean}
 */
export function arDubbeltryck(forra, nu) {
  if (!forra) return false;
  const dt = nu.t - forra.t;
  return dt >= 0 && dt <= DUBBELTRYCK_MS && Math.hypot(nu.x - forra.x, nu.y - forra.y) <= DUBBELTRYCK_AVSTAND;
}

/**
 * Får ett svep byta sida? Bara vid hel bredd: inzoomad drar fingret sidan.
 * @param {number} f
 * @returns {boolean}
 */
export function svepTillats(f) {
  return klampZoom(f) <= PDF_ZOOM_MIN + EPS;
}

/**
 * Rullningen efter en zoom, så att punkten under fingrarna (eller pekaren) står kvar: `(rullning + punkt) * (efter / fore) - punkt`, aldrig under noll.
 * @param {number} rullning `scrollLeft` eller `scrollTop` före zoomen.
 * @param {number} punkt Punktens läge i rutan, från rutans synliga kant.
 * @param {number} fore Faktorn före.
 * @param {number} efter Faktorn efter.
 * @returns {number}
 */
export function forankradRullning(rullning, punkt, fore, efter) {
  if (!(fore > 0) || !(efter > 0)) return Math.max(0, rullning);
  return Math.max(0, (rullning + punkt) * (efter / fore) - punkt);
}

/**
 * Canvasens storlek i pixlar för en sida som visas i `bredd` gånger `hojd` CSS-pixlar, i skärmens upplösning men aldrig över `tak` pixlar. `k` är pixlar per CSS-pixel, det pdf.js ska rita i.
 * @param {number} bredd CSS-pixlar.
 * @param {number} hojd CSS-pixlar.
 * @param {number} dpr `devicePixelRatio`.
 * @param {number} [tak]
 * @returns {{ bredd: number, hojd: number, k: number }}
 */
export function ritmatt(bredd, hojd, dpr, tak = PIXELTAK) {
  const b = bredd > 0 ? bredd : 1;
  const h = hojd > 0 ? hojd : 1;
  const onskad = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  const k = Math.min(onskad, Math.sqrt(tak / (b * h)));
  // Nedåt, så att avrundningen aldrig tar canvasen över taket.
  return { bredd: Math.max(1, Math.floor(b * k)), hojd: Math.max(1, Math.floor(h * k)), k };
}

/** Så länge en ritning får hålla kön, i millisekunder. Se `skapaRitko`. */
export const RITA_TIDSGRANS_MS = 15_000;

/**
 * En kö för ritningar (granskningen av 0.235.0, se punkt 7 i filhuvudet): en ritning i taget, i tur och ordning. `lagg(kor, val)` lägger en ritning sist, eller först med `forst`
 * (sidan under fingret efter en zoom), och svarar en funktion som stryker den, om den inte börjat.
 * En ritning som börjat avbryts av den som lade den (pdf.js `cancel`), och kön går vidare först när ritningens löfte lagt sig, så att två ritningar aldrig pågår samtidigt. Ett fel i en ritning stoppar inte kön.
 *
 * ⛔ TIDSGRÄNSEN (den andra granskningen av 0.235.0): en ritning som inte lagt sig efter `tidsgrans` (15 s) får `onTidsgrans` (avbryt och visa felet), och kön går vidare utan att vänta på den.
 * Utan gränsen hade en enda ritning som aldrig svarade stoppat varje sida efter den, och vyn hade stått vit utan fel.
 *
 * @param {{ tidsgrans?: number }} [val]
 * @returns {{ lagg: (kor: () => Promise<unknown>, val?: { forst?: boolean, onTidsgrans?: () => void }) => () => void, readonly antal: number }}
 */
export function skapaRitko({ tidsgrans = RITA_TIDSGRANS_MS } = {}) {
  /** @type {Array<{ kor: () => Promise<unknown>, onTidsgrans?: () => void }>} */
  const ko = [];
  let pagar = false;
  const nasta = () => {
    if (pagar) return;
    const jobb = ko.shift();
    if (!jobb) return;
    pagar = true;
    let klar = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let klocka;
    const vidare = () => {
      if (klar) return;
      klar = true;
      clearTimeout(klocka);
      pagar = false;
      nasta();
    };
    klocka = setTimeout(() => {
      if (klar) return;
      try {
        jobb.onTidsgrans?.();
      } finally {
        vidare();
      }
    }, tidsgrans);
    Promise.resolve()
      .then(() => jobb.kor())
      .catch(() => {})
      .then(vidare);
  };
  return {
    lagg(kor, val = {}) {
      const jobb = { kor, onTidsgrans: val.onTidsgrans };
      if (val.forst) ko.unshift(jobb);
      else ko.push(jobb);
      // Kön startar ett varv senare: alla sidor i samma ritning hinner läggas, och sidan under fingret (`forst`) hinner före de andra.
      Promise.resolve().then(nasta);
      return () => {
        const i = ko.indexOf(jobb);
        if (i >= 0) ko.splice(i, 1);
      };
    },
    get antal() {
      return ko.length + (pagar ? 1 : 0);
    },
  };
}

/** Alla levande canvasar i en vy får tillsammans högst så här många pixlar: 40 miljoner, 160 MB med fyra byte per pixel. Se `skapaCanvasbudget`. */
export const PIXELBUDGET = 40_000_000;

/**
 * Minnet för alla canvasar i en vy (den andra granskningen av 0.235.0).
 *
 * ⛔ HÄNDELSEN: en sida behåller sin gamla canvas tills den nya är ritad (ingen vit blinkning). Med taket per canvas (`PIXELTAK`) och tre sidor nära vyn kunde därför fyra canvasar på taket finnas
 * samtidigt under en omritning vid 4x, cirka 256 MB, och äldre iPhones klarar cirka 224 MB för en flik. Därför en budget för hela vyn, räknad med den canvas som håller på att ritas:
 *   1. `tak()`: taket för nästa canvas är budgeten delad med antalet sidor nära vyn plus en (den som ritas), och aldrig över `PIXELTAK`.
 *   2. `ledigt()`: det som är kvar av budgeten just nu. Räcker det inte för nästa canvas släpper sidan sin gamla canvas först (`slapp`), och tar resten om det fortfarande inte räcker.
 *   3. `lagg` och `slapp`: varje canvas som skapas räknas, och en canvas som släpps får bredd och höjd noll (Safari på iPhone håller annars kvar minnet) och räknas bort.
 * Summan av levande canvasar går alltså aldrig över budgeten, inte heller medan en ritning pågår.
 *
 * @param {{ budget?: number }} [val]
 */
export function skapaCanvasbudget({ budget = PIXELBUDGET } = {}) {
  /** @type {Map<HTMLCanvasElement, number>} */
  const levande = new Map();
  let sidor = 0;
  const summa = () => {
    let s = 0;
    for (const v of levande.values()) s += v;
    return s;
  };
  return {
    budget,
    /** En sida nära vyn. Svarar funktionen som räknar bort den. @returns {() => void} */
    registrera() {
      sidor += 1;
      let kvar = true;
      return () => {
        if (!kvar) return;
        kvar = false;
        sidor -= 1;
      };
    },
    get sidor() {
      return sidor;
    },
    tak() {
      return Math.min(PIXELTAK, budget / (Math.max(1, sidor) + 1));
    },
    ledigt() {
      return Math.max(0, budget - summa());
    },
    summa,
    /** @param {HTMLCanvasElement} c */
    lagg(c) {
      levande.set(c, c.width * c.height);
    },
    /** @param {HTMLCanvasElement} c */
    slapp(c) {
      c.width = 0;
      c.height = 0;
      levande.delete(c);
    },
  };
}

/**
 * Var punkten under fingret ligger i en sida, som andel av sidans bredd och höjd (granskningen av 0.235.0). Sidans ruta och punkten i samma koordinater (`getBoundingClientRect`, `clientX`).
 * Med andelen går punkten att lägga tillbaka under fingret efter en zoom, oavsett om sidan är centrerad (helskärmen) eller om luften mellan sidorna inte skalar (den rullande vyn).
 * @param {{ left: number, top: number, width: number, height: number }} sida
 * @param {{ x: number, y: number }} punkt
 * @returns {{ fx: number, fy: number }}
 */
export function andelISida(sida, punkt) {
  return { fx: sida.width > 0 ? (punkt.x - sida.left) / sida.width : 0, fy: sida.height > 0 ? (punkt.y - sida.top) / sida.height : 0 };
}

/**
 * Hur mycket rutan ska rullas för att samma andel av sidan ska hamna under fingret igen: positivt rullar åt höger och nedåt.
 * @param {{ left: number, top: number, width: number, height: number }} sidaEfter Sidans ruta efter zoomen, med rullningen före.
 * @param {{ fx: number, fy: number }} andel
 * @param {{ x: number, y: number }} punkt Fingret, i samma koordinater.
 * @returns {{ dx: number, dy: number }}
 */
export function rullningTillAndel(sidaEfter, andel, punkt) {
  return { dx: sidaEfter.left + andel.fx * sidaEfter.width - punkt.x, dy: sidaEfter.top + andel.fy * sidaEfter.height - punkt.y };
}
