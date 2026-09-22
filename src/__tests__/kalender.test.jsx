import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsKalender } from "../components/OpsKalender.jsx";
import {
  datumnyckel,
  datumtext,
  forstaKolumnen,
  idagsnyckel,
  manader,
  manadsrutnat,
  perDag,
  rullriktning,
} from "../lib/kalender.js";

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
    expect(forstaKolumnen(2026, 5)).toBe(0);
    expect(forstaKolumnen(2026, 9)).toBe(3);
    expect(forstaKolumnen(2026, 10)).toBe(6);
  });

  it("räknar skottår rätt", () => {
    // ⛔ Februari 2028 har 29 dagar. En hårdkodad tabell hade tappat den dagen,
    // och en post den 29:e hade tyst försvunnit ur rutnätet.
    const rader = manadsrutnat(2028, 1);
    const dagar = rader.flat().filter((d) => d !== null);
    expect(dagar.length).toBe(29);
    expect(dagar[dagar.length - 1]).toBe(29);
  });

  it("fyller ut med tomma platser före den första, inte med förra månadens dagar", () => {
    // ⛔ En grå 29:a bredvid en svart 1:a inbjuder till ett tryck som inte gör
    // något. En tom ruta lovar ingenting.
    const rader = manadsrutnat(2026, 9); // oktober 2026, börjar på en torsdag
    expect(rader[0].slice(0, 3)).toEqual([null, null, null]);
    expect(rader[0][3]).toBe(1);
  });

  it("skriver datum med två siffror, så strängarna går att jämföra", () => {
    // ⛔ "2026-9-5" sorterar efter "2026-10-01" i en strängjämförelse, och alla
    // nycklar här ÄR strängar.
    expect(datumnyckel(2026, 8, 5)).toBe("2026-09-05");
  });

  it("läser dagens datum lokalt och inte via UTC", () => {
    /*
     * ⛔ `toISOString()` hade gjort 01.30 den 5:e till "2026-10-04" i svensk
     * sommartid. Kalendern hade ramat in fel dag som idag, bara mellan midnatt
     * och två på natten, alltså ett fel ingen lyckas återskapa.
     */
    expect(idagsnyckel(new Date(2026, 9, 5, 1, 30))).toBe("2026-10-05");
  });

  it("räknar månader över ett årsskifte", () => {
    const ut = manader(new Date(2026, 11, 15), 1, 1);
    expect(ut).toEqual([
      { ar: 2026, manad: 10 },
      { ar: 2026, manad: 11 },
      { ar: 2027, manad: 0 },
    ]);
  });

  it("grupperar poster per dag och behåller ordningen inom dagen", () => {
    const karta = perDag([
      { id: "a", datum: "2026-10-05", titel: "A" },
      { id: "b", datum: "2026-10-05", titel: "B" },
      { id: "c", datum: "2026-10-06", titel: "C" },
      { id: "d", datum: "", titel: "Odaterad" },
    ]);
    expect(karta.get("2026-10-05").map((p) => p.id)).toEqual(["a", "b"]);
    expect(karta.get("2026-10-06").length).toBe(1);
    // ⛔ En post utan datum hör inte hemma i ett rutnät över datum och tas inte
    // in under en påhittad nyckel.
    expect(karta.size).toBe(2);
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
    expect(datumtext("2026-10-12")).toBe("12 oktober");
    expect(datumtext("2026-01-01")).toBe("1 januari");
    expect(datumtext("")).toBe("");
    expect(datumtext("imorgon")).toBe("imorgon");
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
    expect(rullriktning({ top: -399, bottom: 1 }, { top: 0 })).toBe("upp");
    expect(rullriktning({ top: -400, bottom: -100 }, { top: 0 })).toBe("upp");
    expect(rullriktning({ top: 900, bottom: 1300 }, { top: 0 })).toBe("ner");
    // ⛔ Utan ruta räknas fönstrets överkant, alltså noll. Ett `rootBounds` som
    // är null får inte kasta: då slutar knappen fungera helt.
    expect(rullriktning({ top: -5, bottom: 300 }, null)).toBe("upp");
  });
});

const IDAG = new Date(2026, 9, 5); // måndag 5 oktober 2026

/** Appens ord, precis som `OpsEventList` kräver dem. */
const STATUSORD = { oppet: "Öppet", pagar: "Pågår", vantar: "Väntar", klart: "Klart", akut: "Akut" };

const POSTER = [
  { id: "agi", datum: "2026-10-12", titel: "Arbetsgivardeklaration", status: "oppet" },
  { id: "lon", datum: "2026-10-25", titel: "Löneutbetalning", status: "oppet", not: "Påminnelse" },
  { id: "stangt", datum: "2026-10-12", titel: "#249 stängdes", status: "klart", url: "https://github.com/cllp/bolag-ops/issues/249" },
];

/** Månadens block, alltså rubriken plus dess rutnät. */
function manadsruta(namn) {
  const rubrik = screen.getByRole("heading", { name: namn });
  const block = rubrik.parentElement;
  if (!block) throw new Error(`Månaden "${namn}" har inget block`);
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
  const veckorad = screen.getByText("Mån").parentElement;
  const rulle = veckorad && veckorad.parentElement;
  if (!rulle) throw new Error("Hittar ingen rullbehållare kring veckodagsraden");
  return rulle;
}

/**
 * Ställer in en `IntersectionObserver` som säger "inte synlig", och lämnar
 * tillbaka en återställare.
 *
 * ⛔ JSDOM HAR INGEN, så `OpsKalender` hoppar över observatören helt och
 * Idag-knappen dyker aldrig upp. Ett prov om knappen hade då varit grönt för att
 * den saknades, vilket är den sämsta sortens grönt.
 *
 * ⛔ ÅTERSTÄLLAREN LÄMNAS TILLBAKA i stället för att registreras som en
 * `afterEach` här inne. En hook som registreras inifrån ett prov hör till hela
 * sviten, alltså skulle den läcka ut över prov som aldrig bett om den.
 */
function visaIdagknappen() {
  const riktig = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    /** @param {(poster: any[]) => void} vidTraff */
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
    <OpsKalender poster={POSTER} ariaLabel="Kalender" idag={IDAG} statusOrd={STATUSORD} {...extra} />,
  );
}

describe("OpsKalender", () => {
  it("ritar månaderna bakåt och framåt kring idag", () => {
    rendera({ manaderBakat: 1, manaderFramat: 1 });
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
    const oktober = manadsruta("oktober 2026");
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
    const dagen = () => screen.getByRole("button", { name: "12, 2 poster" });
    const bubblan = () => screen.queryByRole("region", { name: "Poster den 12 oktober" });

    fireEvent.click(dagen());
    fireEvent.click(dagen());
    expect(bubblan()).toBeNull();

    fireEvent.click(dagen());
    fireEvent.click(screen.getByRole("button", { name: "Stäng 12 oktober" }));
    expect(bubblan()).toBeNull();

    fireEvent.click(dagen());
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

    const kortFor = (titel) => screen.getByText(titel).closest(".ops-contrast-panel");
    const ett = kortFor("Arbetsgivardeklaration");
    const tva = kortFor("#249 stängdes");

    expect(ett).not.toBeNull();
    expect(tva).not.toBeNull();
    expect(ett).not.toBe(tva);
    // ⛔ Och det ena är inte det andras förälder: två kort som är syskon, inte en
    // låda med en låda i.
    expect(ett.contains(tva)).toBe(false);
    expect(tva.contains(ett)).toBe(false);
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
    const ordning = within(panelen)
      .getAllByText(/oktober/)
      .slice(0, 2)
      .map((n) => n.textContent);
    expect(ordning).toEqual(["12 oktober", "25 oktober"]);
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
     * Bredderna är förebildens egna: 300 px från 768, 360 px från 1024.
     */
    rendera();
    expect(screen.queryByRole("region", { name: /^Poster/ })).toBeNull();

    const hint = screen.getByText(/Tryck på en dag/);
    const kolumnen = hint.parentElement;
    expect(kolumnen.className).toContain("md:w-75");
    expect(kolumnen.className).toContain("lg:w-90");
    // ⛔ Raden syns BARA på breda skärmar. På telefon finns ingen kolumn att
    // förklara, och en ruta längst ner hade legat i vägen för dagarna man ska
    // trycka på.
    expect(hint.className).toContain("hidden");
    expect(hint.className).toContain("md:block");
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

  it("gör en post med url till en länk och resten till text", () => {
    /*
     * ⛔ LÄNKEN ÄR HELA POÄNGEN för ett stängt ärende: man öppnar dagen för att
     * komma vidare. En rad som ser tryckbar ut och inte är det är ett löfte som
     * inte infrias, så posterna utan url är text.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    expect(screen.getByRole("link", { name: "#249 stängdes" })).toHaveAttribute(
      "href",
      "https://github.com/cllp/bolag-ops/issues/249",
    );
    expect(screen.queryByRole("link", { name: "Arbetsgivardeklaration" })).toBeNull();
  });

  it("låter rullytan gå ända ner i stället för att sluta på ett påhittat tak", () => {
    /*
     * ⛔ CP 2026-09-22, med bild: "Börja med att ta bort botten och låt den gå
     * ända ner."
     *
     * Taket var `max-h-[60svh]`, ett tal taget ur luften, och bilden visade
     * följden: rutnätet slutade en bit ner på skärmen med en ram under sig och
     * en stor tom yta därefter. Man rullade i en lucka mitt på en sida som mest
     * bestod av ingenting.
     *
     * ⛔ TVÅ SAKER MÄTS, OCH BÅDA BEHÖVS. Höjden räknas ur fönstret minus det
     * MÄTTA avståndet till rullytans överkant, och ramen är borta. En höjd utan
     * mätning hade varit ett nytt påhittat tal, och en mätning som inte når CSS
     * hade inte kunnat ha en brytpunkt: en inline-stil kan inte ha en
     * media-fråga, så mätningen går in som en variabel och räkningen sker i
     * klassen.
     *
     * ⛔ VAD PROVET INTE BEVISAR: att rutnätet faktiskt når skärmens underkant.
     * jsdom har ingen layout, alla rektanglar är noll. Det som mäts är att
     * variabeln sätts, att höjden räknas ur den, att bottenraden dras bort på
     * telefon men inte från 768 px, och att ramen är borta.
     */
    rendera();
    const rulle = rullbehallaren();

    expect(rulle.style.getPropertyValue("--kalender-topp")).toBe("0px");
    expect(rulle.className).toContain("h-[calc(100svh_-_var(--kalender-topp)_-_var(--bottom-nav-h)_-_var(--safe-bottom))]");
    expect(rulle.className).toContain("md:h-[calc(100svh_-_var(--kalender-topp)_-_var(--safe-bottom))]");
    // ⛔ Inget tak kvar, och ingen ram under.
    expect(rulle.className).not.toContain("max-h-");
    expect(rulle.className).not.toContain("border");
  });

  it("låter Idag-knappen vika för dagspanelen på telefon, men inte på bred skärm", () => {
    /*
     * ⛔ EN KROCK SOM DEN NYA HÖJDEN SKAPADE. Sedan rullytan går ända ner bottnar
     * knappen och panelen på samma linje, och två flytande kontroller ovanpå
     * varandra i underkanten är en av dem man inte kommer åt.
     *
     * Panelen är det man läser just då; Idag-knappen är ett hjälpmedel medan man
     * rullar. Från 768 px bor panelen i egen kolumn och krocken finns inte, så
     * knappen ska stå kvar där.
     *
     * ⛔ KNAPPEN MÅSTE FINNAS FÖR ATT PROVET SKA SÄGA NÅGOT, och den dyker upp
     * först när idag rullat ur bild. jsdom kör ingen `IntersectionObserver`, så
     * den ställs in här: utan det hade provet varit grönt för att knappen
     * saknades, inte för att den vek.
     */
    const aterstall = visaIdagknappen();
    try {
      rendera();
      const knappen = () => screen.getByRole("button", { name: /Idag$/ });

      // Utan panel: synlig på alla bredder, alltså varken dold eller villkorad.
      expect(knappen().className).not.toContain("hidden");
      expect(knappen().className).not.toContain("md:flex");

      fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
      expect(knappen().className).toContain("hidden");
      expect(knappen().className).toContain("md:flex");
    } finally {
      aterstall();
    }
  });

  it("kastar utan namn i stället för att rita ett stumt rutnät", () => {
    expect(() => render(<OpsKalender poster={[]} idag={IDAG} />)).toThrow(/ariaLabel krävs/);
  });

  it("säger ifrån när ingen post har datum", () => {
    // ⛔ Ett tomt rutnät ser likadant ut vare sig ingenting är daterat eller
    // ingenting finns, och de två är olika besked.
    rendera({ poster: [], tomtText: "Inget daterat framåt." });
    expect(screen.getByText("Inget daterat framåt.")).toBeInTheDocument();
  });
});
