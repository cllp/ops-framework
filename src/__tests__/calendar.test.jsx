import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import {
  dateKey,
  dateText,
  firstColumn,
  todayKey,
  months,
  monthGrid,
  perDay,
  scrollDirection,
} from "../lib/calendar.js";

/**
 * Kalendern: räkningen för sig, rutnätet för sig.
 *
 * ⛔ RÄKNINGEN PROVAS UTAN ATT RENDERA. Att den 1 oktober 2026 är en torsdag är
 * ett faktum om kalendern, inte om en komponent, och ett prov som monterar en
 * vy för att kontrollera det blir rött den dagen någon byter en klass.
 */

describe("kalenderräkningen", () => {
  it("lägger måndag i kolumn noll", () => {
    /*
     * ⛔ `Date.getDay()` SÄGER 0 FÖR SÖNDAG, och svensk vecka börjar på måndag.
     * Utan omräkningen hamnar varje månad en kolumn fel, vilket ser ut som en
     * riktig kalender ända tills man jämför med en.
     *
     * 1 juni 2026 är en måndag, 1 oktober 2026 en torsdag, 1 november 2026 en
     * söndag, alltså sista kolumnen.
     */
    expect(firstColumn(2026, 5)).toBe(0);
    expect(firstColumn(2026, 9)).toBe(3);
    expect(firstColumn(2026, 10)).toBe(6);
  });

  it("räknar skottår rätt", () => {
    // ⛔ Februari 2028 har 29 dagar. En hårdkodad tabell hade tappat den dagen,
    // och en post den 29:e hade tyst försvunnit ur rutnätet.
    const rows = monthGrid(2028, 1);
    const days = rows.flat().filter((d) => d !== null);
    expect(days.length).toBe(29);
    expect(days[days.length - 1]).toBe(29);
  });

  it("fyller ut med tomma platser före den första, inte med förra månadens dagar", () => {
    // ⛔ En grå 29:a bredvid en svart 1:a inbjuder till ett tryck som inte gör
    // något. En tom ruta lovar ingenting.
    const rows = monthGrid(2026, 9); // oktober 2026, börjar på en torsdag
    expect(rows[0].slice(0, 3)).toEqual([null, null, null]);
    expect(rows[0][3]).toBe(1);
  });

  it("skriver datum med två siffror, så strängarna går att jämföra", () => {
    // ⛔ "2026-9-5" sorterar efter "2026-10-01" i en strängjämförelse, och alla
    // nycklar här ÄR strängar.
    expect(dateKey(2026, 8, 5)).toBe("2026-09-05");
  });

  it("läser dagens datum lokalt och inte via UTC", () => {
    /*
     * ⛔ `toISOString()` hade gjort 01.30 den 5:e till "2026-10-04" i svensk
     * sommartid. Kalendern hade ramat in fel dag som idag, bara mellan midnatt
     * och två på natten, alltså ett fel ingen lyckas återskapa.
     */
    expect(todayKey(new Date(2026, 9, 5, 1, 30))).toBe("2026-10-05");
  });

  it("räknar månader över ett årsskifte", () => {
    const out = months(new Date(2026, 11, 15), 1, 1);
    expect(out).toEqual([
      { ar: 2026, month: 10 },
      { ar: 2026, month: 11 },
      { ar: 2027, month: 0 },
    ]);
  });

  it("grupperar poster per dag och behåller ordningen inom dagen", () => {
    const byKey = perDay([
      { id: "a", date: "2026-10-05", title: "A" },
      { id: "b", date: "2026-10-05", title: "B" },
      { id: "c", date: "2026-10-06", title: "C" },
      { id: "d", date: "", title: "Odaterad" },
    ]);
    expect(byKey.get("2026-10-05").map((p) => p.id)).toEqual(["a", "b"]);
    expect(byKey.get("2026-10-06").length).toBe(1);
    // ⛔ En post utan datum hör inte hemma i ett rutnät över datum och tas inte
    // in under en påhittad nyckel.
    expect(byKey.size).toBe(2);
  });

  it("skriver datumet som en rubrik och inte som en nyckel", () => {
    /*
     * ⛔ BUBBLANS RUBRIK ÄR "12 oktober". Man trycker på en dag man ser, alltså
     * är året och månaden redan kända, och "2026-10-12" överst läses som ännu
     * en post i listan i stället för som en rubrik.
     *
     * ⛔ OCH DET SOM INTE ÄR ETT DATUM GER TILLBAKA SIG SJÄLV. Utan den vägen
     * hade en trasig nyckel skrivits ut som "NaN undefined", alltså ett fel som
     * skriker på en plats där ingenting gick sönder.
     */
    expect(dateText("2026-10-12")).toBe("12 oktober");
    expect(dateText("2026-01-01")).toBe("1 januari");
    expect(dateText("")).toBe("");
    expect(dateText("imorgon")).toBe("imorgon");
  });

  it("pekar pilen uppåt när idag rullat ur bild uppåt", () => {
    /*
     * ⛔ CP 2026-09-22, med bild: "Idag-bubblan visar alltid ner-pil. När idag är
     * uppåt skall pilen gå uppåt."
     *
     * ⛔ FELET LÅG I VILKA KANTER SOM JÄMFÖRDES. Den gamla raden vägde elementets
     * NEDERKANT mot rutans överkant, och `IntersectionObserver` svarar i samma
     * ögonblick som tröskeln korsas, alltså när de två ligger på ungefär samma
     * pixel. En bråkdels pixel åt fel håll gav "ner" fast månaden försvann uppåt.
     *
     * Raden här nere är just det ögonblicket: en månad som är 400 px hög och vars
     * nederkant ligger EN pixel under rutans överkant. Det gamla uttrycket svarade
     * "ner". Överkant mot överkant svarar "upp", och är inte ens i närheten av
     * gränsen.
     */
    expect(scrollDirection({ top: -399, bottom: 1 }, { top: 0 })).toBe("upp");
    expect(scrollDirection({ top: -400, bottom: -100 }, { top: 0 })).toBe("upp");
    expect(scrollDirection({ top: 900, bottom: 1300 }, { top: 0 })).toBe("ner");
    // ⛔ Utan ruta räknas fönstrets överkant, alltså noll. Ett `rootBounds` som
    // är null får inte kasta: då slutar knappen fungera helt.
    expect(scrollDirection({ top: -5, bottom: 300 }, null)).toBe("upp");
  });
});

const TODAY = new Date(2026, 9, 5); // måndag 5 oktober 2026

/** Appens ord, precis som `OpsEventList` kräver dem. */
const STATUSORD = { oppet: "Öppet", pagar: "Pågår", vantar: "Väntar", klart: "Klart", akut: "Akut" };

const POSTER = [
  { id: "agi", date: "2026-10-12", title: "Arbetsgivardeklaration", status: "oppet" },
  { id: "lon", date: "2026-10-25", title: "Löneutbetalning", status: "oppet", not: "Påminnelse" },
  { id: "stangt", date: "2026-10-12", title: "#249 stängdes", status: "klart", url: "https://github.com/cllp/bolag-ops/issues/249" },
];

/** Månadens block, alltså rubriken plus dess rutnät. */
function monthBox(name) {
  const title = screen.getByRole("heading", { name: name });
  const block = title.parentElement;
  if (!block) throw new Error(`Månaden "${name}" har inget block`);
  return block;
}

/**
 * Månadernas rullbehållare, hittad via veckodagsraden.
 *
 * ⛔ INTE `querySelector("[class*='overflow-y-auto']")`. Dagspanelen rullar
 * också, så den frågan träffar två noder och provet hade blivit grönt eller rött
 * beroende på vilken som råkade komma först i trädet.
 */
function rullbehallaren() {
  const weekRow = screen.getByText("Mån").parentElement;
  const rulle = weekRow && weekRow.parentElement;
  if (!rulle) throw new Error("Hittar ingen rullbehållare kring veckodagsraden");
  return rulle;
}

/**
 * Ställer in en `IntersectionObserver` som säger "inte synlig", och lämnar
 * tillbaka en återställare.
 *
 * ⛔ JSDOM HAR INGEN, så `OpsCalendar` hoppar över observatören helt och
 * Idag-knappen dyker aldrig upp. Ett prov om knappen hade då varit grönt för att
 * den saknades, vilket är den sämsta sortens grönt.
 *
 * ⛔ ÅTERSTÄLLAREN LÄMNAS TILLBAKA i stället för att registreras som en
 * `afterEach` här inne. En hook som registreras inifrån ett prov hör till hela
 * sviten, alltså skulle den läcka ut över prov som aldrig bett om den.
 */
function showTodayButton() {
  const riktig = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    /** @param {(entries: any[]) => void} vidTraff */
    constructor(vidTraff) {
      this.vidTraff = vidTraff;
    }
    observe() {
      this.vidTraff([
        { isIntersecting: false, boundingClientRect: { top: -400, bottom: -10 }, rootBounds: { top: 0 } },
      ]);
    }
    unobserve() {}
    disconnect() {}
  };
  return () => {
    globalThis.IntersectionObserver = riktig;
  };
}

function rendera(extra = {}) {
  return render(
    <OpsCalendar entries={POSTER} ariaLabel="Kalender" today={TODAY} statusWords={STATUSORD} {...extra} />,
  );
}

describe("OpsKalender", () => {
  it("ritar månaderna bakåt och framåt kring idag", () => {
    rendera({ monthsBack: 1, monthsForward: 1 });
    expect(screen.getByRole("heading", { name: "september 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "oktober 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "november 2026" })).toBeInTheDocument();
  });

  it("säger i knappens namn hur många poster en dag bär", () => {
    /*
     * ⛔ FÄRGEN FÅR ALDRIG BÄRA BETYDELSEN ENSAM. Prickarna är dekor och läses
     * inte upp; antalet står i knappens namn. Utan det är en dag med tre poster
     * och en tom dag samma sak för den som inte ser skärmen.
     */
    rendera();
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25, 1 post" })).toBeInTheDocument();
  });

  it("gör en tom dag otryckbar i stället för att öppna ingenting", () => {
    /*
     * ⛔ En knapp som öppnar en tom lista lär en att knappar inte gör något.
     *
     * ⛔ SCOPAT TILL OKTOBER, och det är inte prydnad: rutnätet ritar fyra
     * månader, alltså finns det fyra knappar som heter "13". Ett osagt
     * `getByRole` kastade på flera träffar, och det felet ser ut som en bugg i
     * komponenten i stället för en tvetydig fråga i provet.
     */
    rendera();
    const oktober = monthBox("oktober 2026");
    expect(within(oktober).getByRole("button", { name: "13" })).toBeDisabled();
  });

  it("öppnar dagen i en panel som ligger UTANFÖR rullbehållaren", () => {
    /*
     * ⛔ DET HÄR PROVET ÄR CP:s ÄNDRING, ORDAGRANT: "bubblorna måste vara
     * flytande som i SessionStudio."
     *
     * Första versionen fällde ut dagen inuti månadsblocket, och då SKJUTS
     * resten av rutnätet nedåt: man trycker på den 12:e, dagarna under flyttar
     * sig, och nästa tryck landar på fel dag.
     *
     * Provet frågar därför var i trädet bubblan hamnade och inte hur den ser
     * ut. Ett påstående om en klass hade varit grönt även med bubblan
     * inklistrad mitt i rutnätet, alltså grönt för exakt det fel som skulle
     * bort.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const bubblan = screen.getByRole("region", { name: "Poster den 12 oktober" });
    expect(within(bubblan).getByText("Arbetsgivardeklaration")).toBeInTheDocument();

    const rulle = rullbehallaren();
    expect(rulle.className).toContain("overflow-y-auto");
    expect(rulle.contains(bubblan)).toBe(false);
  });

  it("stänger panelen på ett andra tryck, på krysset och på Escape", () => {
    /*
     * ⛔ TRE VÄGAR UT, och det är inte generositet. Bubblan ligger över en del
     * av rutnätet, så den som inte hittar ut ur den kan inte se dagarna under.
     * Ett litet kryss ensamt är den ruta man till slut rullar ifrån i stället
     * för att stänga.
     */
    rendera();
    const theDay = () => screen.getByRole("button", { name: "12, 2 poster" });
    const bubblan = () => screen.queryByRole("region", { name: "Poster den 12 oktober" });

    fireEvent.click(theDay());
    fireEvent.click(theDay());
    expect(bubblan()).toBeNull();

    fireEvent.click(theDay());
    fireEvent.click(screen.getByRole("button", { name: "Stäng 12 oktober" }));
    expect(bubblan()).toBeNull();

    fireEvent.click(theDay());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(bubblan()).toBeNull();
  });

  it("rullar sin EGEN behållare vid montering, inte sidan", () => {
    /*
     * ⛔ CP 2026-09-22, med bild: "Scrollningen tar med hela menyn och allt."
     *
     * `scrollIntoView` rullar ALLA rullbara förfäder, alltså också dokumentet,
     * och det var precis symptomet: kalendern drog med sig appskalet och varje
     * väg tillbaka till idag gick genom hela sidan.
     *
     * Provet mäter VILKET element som rullades, för det är skillnaden. Ett prov
     * som bara kollade att något rullade hade varit grönt före ändringen också.
     */
    const rullade = [];
    let intoView = 0;
    const fannsScrollTo = "scrollTo" in Element.prototype;
    const orgScrollTo = Element.prototype.scrollTo;
    const orgIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollTo = function () {
      rullade.push(this);
    };
    Element.prototype.scrollIntoView = function () {
      intoView += 1;
    };

    try {
      rendera();
      expect(intoView).toBe(0);
      expect(rullade.length).toBe(1);
      // ⛔ Och det som rullades ÄR rullbehållaren, inte vilket element som helst.
      expect(rullade[0].className).toContain("overflow-y-auto");
      // ⛔ Utan `overscroll-contain` fortsätter rullningen ut i sidan så fort man
      // nått kalenderns botten, alltså samma fel en halv sekund senare.
      expect(rullade[0].className).toContain("overscroll-contain");
    } finally {
      if (fannsScrollTo) Element.prototype.scrollTo = orgScrollTo;
      else delete Element.prototype.scrollTo;
      Element.prototype.scrollIntoView = orgIntoView;
    }
  });

  it("samlar flera markerade dagar i EN panel", () => {
    /*
     * ⛔ CP 2026-09-22: "jag kan markera flera som gör listan i bubblorna
     * scrollbar och datumen finns med på denna tryckt på."
     *
     * Att den andra dagen LÄGGS TILL i stället för att ERSÄTTA den första är hela
     * funktionen: med ett enda vald-värde hade provet sett en panel med rätt namn
     * och fel innehåll.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));

    const panelen = screen.getByRole("region", { name: "Poster för 2 valda dagar" });
    expect(within(panelen).getByText("Arbetsgivardeklaration")).toBeInTheDocument();
    expect(within(panelen).getByText("Löneutbetalning")).toBeInTheDocument();
  });

  it("ger varje post ett EGET kort, inte rader i ett gemensamt", () => {
    /*
     * ⛔ CP 2026-09-22, med bild ur SessionStudio: "Det finns ingen separator med
     * flera händelser i bubblan."
     *
     * Första versionen la posterna som rader i EN panel, och fem påminnelser i
     * rad blev en vägg av fet text utan något som skiljer dem åt. Förebilden
     * lägger varje post i ett eget kort med egen skugga och luft omkring, och
     * luften ÄR avdelaren.
     *
     * ⛔ PROVET FRÅGAR EFTER TVÅ SKILDA KORT och inte efter en klass. Ett
     * påstående om `rounded-xl` hade varit grönt även om båda posterna låg i
     * samma ruta, alltså grönt för exakt det fel som skulle bort.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const kortFor = (title) => screen.getByText(title).closest(".ops-contrast-panel");
    const ett = kortFor("Arbetsgivardeklaration");
    const two = kortFor("#249 stängdes");

    expect(ett).not.toBeNull();
    expect(two).not.toBeNull();
    expect(ett).not.toBe(two);
    // ⛔ Och det ena är inte det andras förälder: två kort som är syskon, inte en
    // låda med en låda i.
    expect(ett.contains(two)).toBe(false);
    expect(two.contains(ett)).toBe(false);
  });

  it("skriver datumet både som piller överst och på varje kort", () => {
    /*
     * ⛔ CP 2026-09-22: "vi får inte upp datumet precis som i session studio.
     * Placeringen är fel."
     *
     * Förebilden gör det på två ställen, och de svarar på olika frågor. PILLREN
     * överst säger vilka dagar urvalet består av, och är samtidigt kontrollen som
     * plockar bort en av dem. KORTETS metarad säger vilken av dagarna just den
     * posten tillhör, vilket med flera dagar valda är det enda som skiljer två
     * likadana påminnelser åt.
     *
     * Tre träffar på "12 oktober": ett piller plus två kort.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const panelen = screen.getByRole("region", { name: "Poster den 12 oktober" });
    expect(within(panelen).getAllByText("12 oktober").length).toBe(3);
  });

  it("sätter noten efter datumet på kortet, inte på en egen rad", () => {
    // ⛔ Ett kort i förebilden har EN metarad: datumet, och efter det som gäller
    // just den posten. Två rader hade gjort kortet dubbelt så högt för en
    // upplysning som får plats efter en prick.
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));

    const panelen = screen.getByRole("region", { name: "Poster den 25 oktober" });
    expect(within(panelen).getByText("25 oktober · Påminnelse")).toBeInTheDocument();
  });

  it("radar upp pillren i datumordning och inte i tryckordning", () => {
    /*
     * ⛔ Man läser panelen uppifrån och ner, och en lista i tryckordning hade
     * visat den 25:e över den 12:e utan att något sagt varför. Att en ren
     * strängsortering räcker är hela skälet till att nycklarna skrivs
     * `YYYY-MM-DD` med två siffror.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const panelen = screen.getByRole("region", { name: "Poster för 2 valda dagar" });
    // ⛔ Pillren ligger först i trädet, alltså de två första träffarna i
    // dokumentordning.
    const order = within(panelen)
      .getAllByText(/oktober/)
      .slice(0, 2)
      .map((n) => n.textContent);
    expect(order).toEqual(["12 oktober", "25 oktober"]);
  });

  it("ger varje piller ett kryss när flera dagar är valda, och inget när en är det", () => {
    /*
     * ⛔ PILLRET ÄR BÅDE UPPLYSNINGEN OCH KONTROLLEN, precis som i förebilden:
     * krysset i pillret plockar bort just den dagen ur urvalet.
     *
     * ⛔ OCH DET FINNS BARA NÄR DET GÖR NÅGON SKILLNAD. Med en enda vald dag gör
     * pillrets kryss exakt samma sak som panelens stängkryss två centimeter till
     * höger, och två knappar med samma verkan får läsaren att leta efter
     * skillnaden.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    expect(screen.queryByRole("button", { name: "Ta bort 12 oktober" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    fireEvent.click(screen.getByRole("button", { name: "Ta bort 25 oktober" }));

    expect(screen.getByRole("region", { name: "Poster den 12 oktober" })).toBeInTheDocument();
    expect(screen.queryByText("Löneutbetalning")).toBeNull();
    // ⛔ Rutnätet vet om det: markeringen är släckt, inte bara dold.
    expect(screen.getByRole("button", { name: "25, 1 post" })).toHaveAttribute("aria-pressed", "false");
  });

  it("ger panelen ett tak och egen rullning på telefon", () => {
    /*
     * ⛔ EN DAG MED TOLV POSTER FÅR INTE VÄXA UT UR FÖNSTRET. Förebildens remsa
     * har `max-h-[45%]` och `overflow-y-auto`, alltså samma sak: panelen tar en
     * dryg tredjedel av skärmen och rullar inuti sig själv.
     *
     * ⛔ VAD PROVET BEVISAR OCH VAD DET INTE GÖR. jsdom räknar ingen layout, så
     * den faktiska rullsträckan går inte att mäta här. Det som mäts är att taket
     * och rullningen sitter på panelen, och att rullningen inte fortsätter ut i
     * sidan när man nått botten.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const panelen = screen.getByRole("region", { name: "Poster den 12 oktober" });
    expect(panelen.className).toContain("max-h-[45svh]");
    expect(panelen.className).toContain("overflow-y-auto");
    expect(panelen.className).toContain("overscroll-contain");
  });

  it("reserverar sidokolumnen även när ingen dag är vald", () => {
    /*
     * ⛔ FÖREBILDENS `showSidePanel = !isPhone` FRÅGAR EFTER SKÄRMBREDDEN, aldrig
     * efter urvalet. Dök kolumnen upp först vid ett tryck skulle rutnätet krympa
     * under fingret, och nästa tryck landa på fel dag. Det är exakt det fel
     * utfällningen under månaden en gång hade, fast i sidled.
     *
     * ⛔ GRÄNSEN GÅR VID 1024 px OCH INTE 768, och det är CP:s andra rättelse:
     * "I web-vyn har du tryckt ihop kalendern." Räknat: en app-vy på 768 px har
     * 736 px innanför sidomarginalen, och drar man 300 px till en kolumn
     * återstår 62 px per dagsruta. Vid 1024 blir samma räkning 99 px.
     *
     * Det är dessutom förebildens egen regel: `showSplitChrome = !isPhone &&
     * isLandscape`, med kommentaren att en stående iPad får samma krom som en
     * telefon. En stående iPad är 768 till 834 px bred.
     */
    rendera();
    expect(screen.queryByRole("region", { name: /^Poster/ })).toBeNull();

    const hint = screen.getByText(/Tryck på en dag/);
    const theColumn = hint.parentElement;
    expect(theColumn.className).toContain("lg:w-75");
    expect(theColumn.className).toContain("xl:w-90");
    // ⛔ Raden syns BARA på breda skärmar. På telefon finns ingen kolumn att
    // förklara, och en ruta längst ner hade legat i vägen för dagarna man ska
    // trycka på.
    expect(hint.className).toContain("hidden");
    expect(hint.className).toContain("lg:block");
  });

  it("tömmer hela urvalet på krysset, och en dag i taget i rutnätet", () => {
    /*
     * ⛔ TVÅ OLIKA GESTER MED TVÅ OLIKA RÄCKVIDDER, och det är avsiktligt.
     * Bubblan är ETT objekt på skärmen, så ett kryss som lämnade två av tre
     * dagar kvar hade sett ut som att knappen inte fungerade. Enskilda dagar tas
     * bort där de valdes, med ett andra tryck i rutnätet.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));

    // Ett andra tryck tar bort EN dag, och bubblan står kvar med den andra.
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    expect(screen.getByRole("region", { name: "Poster den 12 oktober" })).toBeInTheDocument();

    // Och tillbaka till två, så krysset har något att tömma.
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    fireEvent.click(screen.getByRole("button", { name: "Stäng 2 dagar" }));
    expect(screen.queryByRole("region", { name: /^Poster/ })).toBeNull();
    // ⛔ Och rutnätet vet om det: markeringarna är släckta, inte bara dolda.
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fäller ut status som ORD och länken, bakom en chevron", () => {
    /*
     * ⛔ CP 2026-09-22: "Låt varje bubbla vara expanderbar så att man kan fälla
     * ut detaljer. Vidare vill man kunna se status och länk (issue) där också om
     * det finns."
     *
     * ⛔ STATUS FINNS PÅ TVÅ NIVÅER OCH DET ÄR AVSIKTLIGT. Pricken i den
     * ihopfällda raden svarar på frågan man ställer när man SKUMMAR panelen;
     * ORDET står i utfällningen, där det får plats. Samma arbetsdelning som
     * `OpsEventList` gör mellan pricken på raden och Status i panelen.
     *
     * ⛔ LÄNKEN FLYTTADE FRÅN TITELN HIT. Låg den kvar på båda vore det samma
     * adress två gånger på samma kort. Det kostar ett tryck till för ett stängt
     * ärende, och det är den avvägning CP:s formulering gör.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    // Ihopfälld: titeln är text, inte en länk.
    expect(screen.queryByRole("link", { name: /#249 stängdes/ })).toBeNull();

    const chevron = screen.getByRole("button", { name: "Visa detaljer för #249 stängdes" });
    fireEvent.click(chevron);

    /*
     * ⛔ LÄST INNE I UTFÄLLNINGEN, via `aria-controls`. Ordet "Klart" står också
     * i statusprickens eget upplästa namn i raden ovanför, så ett osagt
     * `getByText` träffade två noder. Att provet blir rött på två träffar är
     * rött av fel anledning: det säger inget om utfällningen.
     */
    const panelen = document.getElementById(chevron.getAttribute("aria-controls"));
    expect(panelen).not.toBeNull();
    expect(panelen.hidden).toBe(false);
    expect(within(panelen).getByRole("link", { name: "Öppna #249 stängdes" })).toHaveAttribute(
      "href",
      "https://github.com/cllp/bolag-ops/issues/249",
    );
    expect(within(panelen).getByText("Klart")).toBeInTheDocument();
  });

  it("ger ingen chevron åt ett kort utan något att fälla ut", () => {
    /*
     * ⛔ EN PIL SOM ÖPPNAR EN TOM RUTA ÄR ETT LÖFTE SOM INTE INFRIAS, och den som
     * tryckt en gång utan att något hände slutar lita på de andra. Samma regel
     * som `OpsEventList` har om sin chevronkolumn.
     */
    rendera({
      entries: [{ id: "naken", date: "2026-10-12", title: "Utan status och utan länk" }],
      statusWords: {},
    });
    fireEvent.click(screen.getByRole("button", { name: "12, 1 post" }));

    expect(screen.getByText("Utan status och utan länk")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Visa detaljer/ })).toBeNull();
  });

  it("kastar utan namn i stället för att rita ett stumt rutnät", () => {
    expect(() => render(<OpsCalendar entries={[]} today={TODAY} />)).toThrow(/ariaLabel krävs/);
  });

  it("säger ifrån när ingen post har datum", () => {
    // ⛔ Ett tomt rutnät ser likadant ut vare sig ingenting är daterat eller
    // ingenting finns, och de två är olika besked.
    rendera({ entries: [], emptyText: "Inget daterat framåt." });
    expect(screen.getByText("Inget daterat framåt.")).toBeInTheDocument();
  });
});
