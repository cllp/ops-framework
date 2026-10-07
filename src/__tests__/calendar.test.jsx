import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { LANGTRYCK_MS } from "../lib/talk.js";
import { aterstallHornmarkenVarning } from "../components/OpsCalendarDagruta.jsx";
import {
  dateKey,
  dateText,
  firstColumn,
  todayKey,
  months,
  monthGrid,
  perDay,
  scrollDirection,
  markorlayout,
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

/**
 * Dagpanelen. ⛔ SEDAN 0.36.0 STÅR TITLARNA OCKSÅ I RUTNÄTETS PILLER (SS `MonthGrid.jsx:579`, från 640 px), så ett osagt
 * `getByText` på en titel träffar två noder. Frågor om kort ställs därför inne i panelen.
 */
const panelen = () => {
  const p = document.querySelector("[data-dagpanel]");
  if (!p) throw new Error("Ingen dagpanel är öppen");
  return /** @type {HTMLElement} */ (p);
};

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

  it("gör en tom dag tryckbar, och panelen säger att den är tom (0.36.0)", () => {
    /*
     * ⛔ TILL 0.35.0 VAR EN TOM DAG `disabled`, med skälet att en knapp som öppnar en tom lista lär en att knappar inte
     * gör något. Med skapa-rutan och flerdagsval (#179 F1, SS `useCalendarDaySelection`) är en tom dag den man väljer
     * för att lägga något på den. Panelen säger då "Inga poster" och antalet noll (punkt 5), så trycket gör något.
     *
     * ⛔ SCOPAT TILL OKTOBER: rutnätet ritar 25 månader, alltså finns det 25 knappar som heter "13".
     */
    rendera({ onSkapa: () => {} });
    const oktober = monthBox("oktober 2026");
    const tretton = within(oktober).getByRole("button", { name: "13" });
    expect(tretton).not.toBeDisabled();
    fireEvent.click(tretton);
    expect(within(panelen()).getByText("Inga poster den här dagen.")).toBeInTheDocument();
    expect(panelen().querySelector("[data-dagantal]").textContent).toBe("0poster");
    expect(within(panelen()).getByRole("button", { name: "Skapa den 13 oktober" })).toBeInTheDocument();
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

  it("⛔ lägger posterna som rader i EN bubbla, med en linje mellan raderna och tak med invändig rullning (0.37.0)", () => {
    /*
     * ⛔ ERSÄTTER PROVET "ett EGET kort per post" (0.26.0 till 0.36.0). CP 2026-09-30, med skärmbilder ur SS-appen: "I
     * SessionStudio, ser du att man scrollar i bubblan här om den blir för stor?" SS-appen har en bubbla med raderna och en
     * hårfin linje överst på varje (`abEventRow`), och rullytan har taket 140 px (`abEventsScroll`). CP:s klagomål 2026-09-22
     * ("ingen separator") gällde rader UTAN avdelare; här är linjen avdelaren.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    const bubblor = panelen().querySelectorAll("[data-postbubbla]");
    expect(bubblor.length).toBe(1);
    const rader = bubblor[0].querySelectorAll("[data-postrad]");
    expect(rader.length).toBe(2);
    expect(String(/** @type {HTMLElement} */ (rader[0].parentElement).className)).toContain("divide-y");
    const rulle = /** @type {HTMLElement} */ (bubblor[0].querySelector("[data-postrulle]"));
    expect(rulle.className).toContain("max-h-35");
    expect(rulle.className).toContain("overflow-y-auto");
  });

  it("delar raderna under Grupp och Mina bara när båda slagen finns", () => {
    const kalendrar = [{ id: "styrelse", namn: "Styrelsen", farg: 4, grupp: true, forvald: true }, { id: "privat", namn: "Privat", farg: 5 }];
    rendera({ kalendrar, entries: [{ id: "m", date: "2026-10-12", title: "Möte" }, { id: "t", date: "2026-10-12", title: "Tandläkaren", kalender: { id: "privat", namn: "Privat", farg: 5 } }] });
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    expect([...panelen().querySelectorAll("[data-postrubrik]")].map((x) => x.textContent)).toEqual(["Grupp", "Mina"]);
    fireEvent.click(screen.getByRole("button", { name: /^Stäng/ }));
    rendera({ kalendrar, entries: [{ id: "m", date: "2026-10-13", title: "Möte" }] });
    fireEvent.click(screen.getAllByRole("button", { name: "13, 1 post" }).at(-1));
    expect(panelen().querySelectorAll("[data-postrubrik]").length).toBe(0);
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

  it("⛔ pillren wrappas utan att klämmas ihop när flera dagar valts (bolag-ops#556)", () => {
    /*
     * ⛔ CP 2026-10-02, med bild: "Gui bugg bubblorna får inte plats när man väljer flera här."
     * Pillren stod i samma flex-rad som stängkrysset (`ml-auto`), och utan `shrink-0` klämdes
     * bubblorna ihop så att text och kryss överlappade. Raden är nu en egen wrap-behållare, och
     * varje piller vägrar att krympa. jsdom räknar ingen layout: klasserna och DOM-strukturen mäts
     * här; att boxarna inte överlappar mäts i Chromium (`check-skalyta` avsnitt 30).
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^13/ }).at(-1));

    const rad = /** @type {HTMLElement} */ (panelen().querySelector("[data-datumpiller-rad]"));
    expect(rad).toBeTruthy();
    expect(String(rad.className)).toContain("flex-wrap");
    const piller = [...rad.querySelectorAll("[data-datumpiller]")];
    expect(piller.length).toBe(3);
    for (const p of piller) {
      expect(String(p.className)).toContain("shrink-0");
      expect(rad.contains(p)).toBe(true);
    }
    // ⛔ Stängkrysset står UTANFÖR pillerraden, så det inte tävlar om bredden.
    const stang = within(panelen()).getByRole("button", { name: /^Stäng/ });
    expect(rad.contains(stang)).toBe(false);
  });

  it("ger varje piller ett kryss, och krysset tar bort just den dagen", () => {
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
    // ⛔ 0.37.0: krysset finns också med en dag vald, som i SS-appen (`DayDetailPanel.js`), se `Datumpiller`.
    expect(screen.getByRole("button", { name: "Ta bort 12 oktober" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    fireEvent.click(screen.getByRole("button", { name: "Ta bort 25 oktober" }));

    expect(screen.getByRole("region", { name: "Poster den 12 oktober" })).toBeInTheDocument();
    expect(within(panelen()).queryByText("Löneutbetalning")).toBeNull();
    // ⛔ Rutnätet vet om det: markeringen är släckt, inte bara dold.
    expect(screen.getByRole("button", { name: "25, 1 post" })).toHaveAttribute("aria-pressed", "false");
  });

  it("⛔ panelen flyter över rutnätet på telefon utan egen yta, med tak och egen rullning, och rutnätet får luft under sig (0.37.0)", () => {
    /*
     * ⛔ CP 2026-09-30 22:30, med en skärmbild ur SS-appen: "Inget transparent bakom, de kommer fram på fel sätt med
     * scrollning." 0.36.0 staplade panelen under rutnätet på en ogenomskinlig yta (`max-lg:bg-surface`, `border-t`) och
     * krympte rullytan; det provet är ersatt av det här. jsdom räknar ingen layout: klasserna mäts här, höjderna och att
     * rutnätet syns runt korten i Chromium i `check-skalyta` avsnitt 30.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    const plats = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel-plats]"));
    expect(plats.contains(panelen())).toBe(true);
    const k = String(plats.className).split(/\s+/);
    for (const c of ["max-lg:absolute", "max-lg:-bottom-6", "max-lg:max-h-(--ops-dagpanel-max)", "max-lg:overflow-y-auto"]) expect(k).toContain(c);
    // ⛔ Ingen egen yta och ingen kant bakom panelen.
    expect(k.some((c) => /bg-|border-t/.test(c))).toBe(false);
    // ⛔ Rullytan krymper inte, den får luft under sista månaden.
    expect(rullbehallaren().className).not.toContain("--ops-dagpanel");
    expect(rullbehallaren().querySelector("[data-panelluft]")).not.toBeNull();
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

    expect(within(panelen()).getByText("Utan status och utan länk")).toBeInTheDocument();
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

  /*
   * ⛔ CP 2026-09-24, med bild: "Bubblorna i kalender och listan idag färgar
   * inte vänstersidorna efter typens specifika färg."
   *
   * Listans kort hade kanten hela tiden, genom `OpsCard`. Kalenderns postkort är
   * en egen ruta och hade ingen, så samma post såg olika ut i de två lägena av
   * samma vy. Nu hämtar båda den ur `lib/kant.js`.
   */
  const MED_KANT = [
    { id: "agi", date: "2026-10-12", title: "Arbetsgivardeklaration", status: "oppet", edge: 2, edgeLabel: "Påminnelse" },
    { id: "naken", date: "2026-10-12", title: "Utan slag", status: "oppet" },
  ];

  /** @param {string} title */
  const kortFor = (title) => within(panelen()).getByText(title).closest("[data-postrad]");

  it("målar kanten i slagets färg, och lämnar kortet utan slag orört", () => {
    rendera({ entries: MED_KANT });
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const klasser = String(kortFor("Arbetsgivardeklaration").className).split(/\s+/);
    expect(klasser).toContain("border-l-4");
    expect(klasser).toContain("border-l-identity-2");

    /*
     * ⛔ OCH DET ANDRA KORTET SKA INTE HA NÅGON KANT. Utan den halvan hade
     * provet varit grönt även om kanten ritats på varje kort oavsett `edge`,
     * alltså grönt för en färg som slutat betyda något.
     */
    expect(String(kortFor("Utan slag").className).split(/\s+/)).not.toContain("border-l-4");
  });

  it("säger vad kanten betyder för den som lyssnar", () => {
    // ⛔ En färg ensam går inte att läsa upp och är osynlig för var tjugonde man.
    // Samma krav som `OpsCard` ställer, av samma skäl.
    rendera({ entries: MED_KANT });
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    expect(within(kortFor("Arbetsgivardeklaration")).getByText("Påminnelse")).toBeInTheDocument();
  });

  it("kastar på en kant utan ord i stället för att rita en färg som inte betyder något", () => {
    // ⛔ Kastet sker när KORTET ritas, alltså när dagen öppnas, inte när rutnätet
    // ritas. Ett prov som bara renderade kalendern hade varit grönt.
    rendera({ entries: [{ id: "x", date: "2026-10-12", title: "Utan ord", edge: 2 }] });
    expect(() => fireEvent.click(screen.getByRole("button", { name: "12, 1 post" }))).toThrow(/edgeLabel/);
  });

  it("färgar rutnätets prickar efter slaget, inte alla lika", () => {
    /*
     * ⛔ CP 2026-09-24, med bild: "Prickarna i kalendern skall ju också ha
     * färgen av vilken typ det är."
     *
     * Alla prickar var `bg-accent`, alltså en enda färg. En ruta med tre
     * prickar sade "tre saker händer" och ingenting om vilka, vilket är det man
     * vill veta när man skummar en månad.
     *
     * ⛔ PROVET KRÄVER TVÅ OLIKA KLASSER OCH INTE EN RIKTIG. Ett påstående om
     * att den första pricken har `bg-slag-1` hade varit grönt även om varje
     * prick ritats i samma färg, alltså grönt för exakt det fel som skulle bort.
     */
    rendera({
      entries: [
        { id: "a", date: "2026-10-12", title: "En uppgift", slag: 1, slagLabel: "Uppgift" },
        { id: "b", date: "2026-10-12", title: "En påminnelse", slag: 2, slagLabel: "Påminnelse" },
      ],
    });

    const ruta = screen.getByRole("button", { name: "12, 2 poster" });
    const prickar = [...ruta.querySelectorAll("span.rounded-full")];
    expect(prickar.length).toBe(2);

    const klasser = prickar.map((d) => String(d.className).split(/\s+/).find((k) => k.startsWith("bg-slag-")));
    expect(klasser).toEqual(["bg-slag-1", "bg-slag-2"]);
  });

  it("låter en post utan slag behålla accentpricken", () => {
    // ⛔ Slaget är valfritt. En app som inte har sorter ska inte tappa sina
    // prickar, den ska få dem som förut.
    rendera({ entries: [{ id: "a", date: "2026-10-12", title: "Utan slag" }] });

    const ruta = screen.getByRole("button", { name: "12, 1 post" });
    const prick = ruta.querySelector("span.rounded-full");
    expect(String(prick.className).split(/\s+/)).toContain("bg-accent");
  });

  it("låter slaget vinna över edge på kortet, så prick och kant säger samma sak", () => {
    /*
     * ⛔ DE TVÅ SVARAR PÅ OLIKA FRÅGOR: `edge` på VEM posten tillhör, `slag` på
     * VAD den är. Pricken kan bara visa ett av dem, och den visar slaget.
     * Vann `edge` här hade kortet och pricken burit olika färger för samma post,
     * i två element man ser samtidigt.
     */
    rendera({
      entries: [{ id: "a", date: "2026-10-12", title: "Båda satta", edge: 4, edgeLabel: "Företag", slag: 1, slagLabel: "Uppgift" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "12, 1 post" }));

    const klasser = String(kortFor("Båda satta").className).split(/\s+/);
    expect(klasser).toContain("border-l-slag-1");
    expect(klasser).not.toContain("border-l-identity-4");
  });

  /*
   * ⛔ 0.37.0: RUTAN PÅ TELEFON HAR SS FORMAT RAKT AV, PRICKAR OCH STRECK I KATEGORINS FÄRG (CP 2026-09-30, med en skärmbild
   * ur SS-appen: "Vi kanske skall ta SessionStudios format rakt av och ha prickar och streck istället med rätt färg för
   * kategori?"). De fem proven om ikoner i rutan (0.26.0) är ersatta av proven nedan; beslutet och skälet står i
   * `OpsCalendarDagruta.jsx`. Ikonen finns kvar på raden i `OpsEventList`.
   */
  const marken = (/** @type {string} */ namn) => /** @type {HTMLElement} */ (screen.getByRole("button", { name: namn }).querySelector("[data-kalender-marken]"));

  it("en endagspost är en prick i slagets färg, och ingen ikon ritas i rutan", () => {
    rendera({
      entries: [
        { id: "a", date: "2026-10-12", title: "En uppgift", slag: 1, slagLabel: "Uppgift", kindIcon: <svg data-prov="uppgift" /> },
        { id: "b", date: "2026-10-12", title: "En påminnelse", slag: 2, slagLabel: "Påminnelse" },
      ],
    });
    const m = marken("12, 2 poster");
    expect(screen.getByRole("button", { name: "12, 2 poster" }).querySelectorAll("svg[data-prov]").length).toBe(0);
    const farger = [...m.querySelectorAll("[data-prick]")].map((x) => String(x.className).split(/\s+/).find((k) => k.startsWith("bg-slag-")));
    expect(farger).toEqual(["bg-slag-1", "bg-slag-2"]);
  });

  it("⛔ slagets ikon ritas före titeln på dagpanelens rad, aria-hidden och i slagets färg, men aldrig i dagrutan (0.37.1)", () => {
    /*
     * ⛔ 0.37.0 lovade i sin CHANGELOG att ikonen "står kvar i dagpanelens kort", men `OpsCalendar` ritade den aldrig där. CP
     * 2026-09-30: "Jag gillar ikonerna för typerna hos oss." Provet läser raden i panelen efter att dagen valts, och rutan
     * före: ikonen hör hemma i panelen och inte i rutan (prickar och streck, beslutet från 0.37.0).
     */
    rendera({
      entries: [
        { id: "a", date: "2026-10-12", title: "En uppgift", slag: 1, slagLabel: "Uppgift", kindIcon: <svg data-prov="uppgift" /> },
        { id: "b", date: "2026-10-12", title: "En påminnelse", slag: 2, slagLabel: "Påminnelse" },
      ],
    });
    const dagknapp = screen.getByRole("button", { name: "12, 2 poster" });
    expect(dagknapp.querySelectorAll("svg").length).toBe(0);
    fireEvent.click(dagknapp);
    const rader = [...panelen().querySelectorAll("[data-postrad]")];
    expect(rader.length).toBe(2);
    const medIkon = /** @type {HTMLElement} */ (rader.find((r) => (r.textContent || "").includes("En uppgift")));
    const ikon = /** @type {HTMLElement} */ (medIkon.querySelector("[data-postikon]"));
    expect(ikon.querySelector("svg[data-prov='uppgift']")).not.toBeNull();
    expect(ikon.getAttribute("aria-hidden")).toBe("true");
    expect(ikon.className).toMatch(/text-slag-1|slag-1/);
    // Ikonen står FÖRE titeln i dokumentordning.
    const titel = /** @type {HTMLElement} */ (within(medIkon).getByText("En uppgift"));
    expect(ikon.compareDocumentPosition(titel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Posten utan ikon får ingen.
    const utan = /** @type {HTMLElement} */ (rader.find((r) => (r.textContent || "").includes("En påminnelse")));
    expect(utan.querySelector("[data-postikon]")).toBeNull();
    // Och dagrutan har fortfarande ingen.
    expect(screen.getAllByRole("button", { name: "12, 2 poster" })[0].querySelectorAll("svg[data-prov]").length).toBe(0);
  });

  it("en flerdagspost är ett streck i varje ruta den täcker, och ingen prick där", () => {
    rendera({ entries: [{ id: "k", date: "2026-10-05", endDate: "2026-10-07", title: "Konferens", slag: 3, slagLabel: "Resa" }] });
    for (const d of ["5", "6", "7"]) {
      const m = marken(`${d}, 1 post`);
      expect(m.querySelectorAll('[data-streck="k"]').length).toBe(1);
      expect(m.querySelectorAll("[data-prick]").length).toBe(0);
      expect(String(/** @type {HTMLElement} */ (m.querySelector("[data-streck]")).className)).toContain("bg-slag-3");
    }
    expect(/** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="2026-10-08"]`)).querySelectorAll("[data-streck]").length).toBe(0);
  });

  it("⛔ som SS: tre prickar överst, två under, sedan +N, och antalet tappas aldrig", () => {
    const sex = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `p${n}`, date: "2026-10-12", title: `Post ${n}`, slag: 1, slagLabel: "Uppgift" }));
    rendera({ entries: sex });
    const m = marken("12, 6 poster");
    const rader = [...m.children].map((r) => r.querySelectorAll("[data-prick]").length);
    expect(rader).toEqual([3, 2]);
    expect(/** @type {HTMLElement} */ (m.querySelector("[data-plus]")).textContent).toBe("+1");
    rendera({ entries: sex.slice(0, 5) });
    expect(marken("12, 5 poster").querySelector("[data-plus]")).toBeNull();
  });

  it("två streck överst och prickarna under, och fler flerdagsposter räknas in i +N", () => {
    const spann = [1, 2, 3].map((n) => ({ id: `s${n}`, date: "2026-10-11", endDate: "2026-10-13", title: `Spann ${n}`, slag: 2, slagLabel: "Påminnelse" }));
    rendera({ entries: [...spann, { id: "e", date: "2026-10-12", title: "En", slag: 1, slagLabel: "Uppgift" }] });
    const m = marken("12, 4 poster");
    expect(m.children[0].querySelectorAll("[data-streck]").length).toBe(2);
    expect(m.children[0].querySelectorAll("[data-prick]").length).toBe(0);
    // En prick under, och ett "+1" för det tredje strecket: 2 + 1 + 1 = 4.
    expect(m.children[1].querySelectorAll("[data-prick]").length).toBe(1);
    expect(/** @type {HTMLElement} */ (m.querySelector("[data-plus]")).textContent).toBe("+1");
  });

  /** @param {string} d @returns {HTMLElement} */
  const ruta = (d) => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${d}"]`));
  /** @param {HTMLElement} r @returns {{ id: string | null, ikon: string, raknare: string | null, klass: string }[]} */
  const brickor = (r) =>
    [...r.querySelectorAll("[data-hornmarke]")].map((b) => ({
      id: b.getAttribute("data-hornmarke"),
      ikon: String((b.querySelector("svg") || { getAttribute: () => "" }).getAttribute("class")),
      raknare: (b.querySelector("[data-raknare]") || { textContent: null }).textContent,
      klass: String(b.className),
    }));

  it("dagdekor: ton och ram ritas i rutan, men inte i den valda", () => {
    rendera({ dagdekor: (/** @type {string} */ d) => (d === "2026-10-12" ? { ton: 2, ram: 4 } : undefined) });
    expect(/** @type {HTMLElement} */ (ruta("2026-10-12").querySelector("[data-dagton]")).className).toContain("bg-identity-2/15");
    const ram = /** @type {HTMLElement} */ (ruta("2026-10-12").querySelector("[data-dagram]"));
    expect(ram.className).toContain("border-identity-4");
    expect(ram.className).toContain("border-2");
    expect(ruta("2026-10-13").querySelector("[data-dagram]")).toBeNull();
    fireEvent.click(ruta("2026-10-12"));
    expect(ruta("2026-10-12").querySelector("[data-dagram]")).toBeNull();
    expect(ruta("2026-10-12").querySelector("[data-dagton]")).toBeNull();
  });

  it("⛔ hörnbrickorna är typade: ramverket ritar UserX och Layers själv, borta först oavsett ordning, och orden står i knappens namn", () => {
    rendera({ entries: [], dagdekor: (/** @type {string} */ d) => (d === "2026-10-12" ? { lager: { antal: 1 }, borta: { antal: 1 } } : d === "2026-10-13" ? { lager: { antal: 1 } } : d === "2026-10-14" ? { borta: { antal: 1 } } : undefined) });
    const b12 = brickor(ruta("2026-10-12"));
    expect(b12.map((b) => b.id)).toEqual(["borta", "lager"]);
    expect(b12[0].ikon).toContain("lucide-user-x");
    expect(b12[1].ikon).toContain("lucide-layers");
    expect(b12[0].klass).toContain("border-danger");
    expect(b12[0].klass).toContain("text-danger");
    expect(b12[1].klass).toContain("border-ink-muted");
    // Lagerbrickan har ALLTID -4 px, också ensam (SS pillBadgeOverlap). Borta-brickan aldrig.
    expect(b12[1].klass).toContain("-mt-1");
    expect(b12[0].klass).not.toContain("-mt-1");
    expect(brickor(ruta("2026-10-13"))[0].klass).toContain("-mt-1");
    expect(b12.every((b) => b.raknare === null)).toBe(true);
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 1 borta, 1 lager");
    expect(ruta("2026-10-13").getAttribute("aria-label")).toBe("13, 1 lager");
    expect(ruta("2026-10-14").getAttribute("aria-label")).toBe("14, 1 borta");
    expect(ruta("2026-10-15").querySelector("[data-hornmarken]")).toBeNull();
  });

  it("räknaren: ingen vid 1, siffran från 2, och 9+ från 10; 0 ritar ingen bricka", () => {
    /** @type {Record<string, any>} */
    const dekor = { "2026-10-12": { borta: { antal: 2 }, lager: { antal: 9 } }, "2026-10-13": { borta: { antal: 10 }, lager: { antal: 12 } }, "2026-10-14": { borta: { antal: 0 }, lager: { antal: 0 } } };
    rendera({ entries: [], dagdekor: (/** @type {string} */ d) => dekor[d] });
    expect(brickor(ruta("2026-10-12")).map((b) => b.raknare)).toEqual(["2", "9"]);
    expect(brickor(ruta("2026-10-13")).map((b) => b.raknare)).toEqual(["9+", "9+"]);
    expect(ruta("2026-10-13").getAttribute("aria-label")).toBe("13, 10 borta, 12 lager");
    expect(ruta("2026-10-14").querySelector("[data-hornmarken]")).toBeNull();
    expect(ruta("2026-10-14").getAttribute("aria-label")).toBe("14");
  });

  it("från 640 px raden bredvid siffran som SS webb: UserX före Layers, siffran som den är, och N/N bara utan borta", () => {
    /** @type {Record<string, any>} */
    const dekor = {
      "2026-10-12": { narvaro: { tillgangliga: 2, totalt: 4 }, borta: { antal: 2 }, lager: { antal: 12 } },
      "2026-10-13": { narvaro: { tillgangliga: 4, totalt: 4 }, lager: { antal: 1 } },
      "2026-10-14": { narvaro: { tillgangliga: 0, totalt: 0 } },
    };
    rendera({ entries: [], dagdekor: (/** @type {string} */ d) => dekor[d] });
    const rad = (/** @type {string} */ d) => [...ruta(d).querySelectorAll("[data-indikator]")].map((x) => [x.getAttribute("data-indikator"), (x.querySelector("[data-raknare]") || { textContent: "" }).textContent]);
    // Raden står i siffrans rad (samma förälder som siffran) och är dold under 640 px; brickorna är dolda från 640 px.
    const radEl = /** @type {HTMLElement} */ (ruta("2026-10-12").querySelector("[data-indikatorrad]"));
    expect(radEl.parentElement).toBe(/** @type {HTMLElement} */ (ruta("2026-10-12").querySelector("[data-dagnummer]")).parentElement);
    expect(radEl.className).toContain("hidden");
    expect(radEl.className).toContain("sm:flex");
    expect(String(/** @type {HTMLElement} */ (ruta("2026-10-12").querySelector("[data-hornmarken]")).className)).toContain("sm:hidden");
    expect(rad("2026-10-12")).toEqual([["borta", "2"], ["lager", "12"]]);
    expect(ruta("2026-10-12").querySelector("[data-narvaro]")).toBeNull();
    expect(/** @type {HTMLElement} */ (ruta("2026-10-13").querySelector("[data-narvaro]")).textContent).toBe("4/4");
    expect(ruta("2026-10-13").getAttribute("aria-label")).toBe("13, 4 av 4 tillgängliga, 1 lager");
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 2 borta, 12 lager");
    // En grupp utan medlemmar har ingen N/N att säga.
    expect(ruta("2026-10-14").querySelector("[data-narvaro]")).toBeNull();
  });

  it("⛔ ett antal som inte är ett heltal, och en kvarlämnad hornmarken, varnar i utveckling i stället för att tyst inte rita", () => {
    aterstallHornmarkenVarning();
    const varn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      /** @type {Record<string, any>} */
      const dekor = { "2026-10-12": { borta: { antal: "2" } }, "2026-10-13": { lager: { antal: 1.5 } }, "2026-10-14": { hornmarken: [] }, "2026-10-15": { hornmarken: [] }, "2026-10-16": { hornmarken: [] } };
      rendera({ entries: [], dagdekor: (/** @type {string} */ d) => dekor[d] });
      const texter = varn.mock.calls.map((c) => String(c[0]));
      expect(texter.some((t) => /borta\.antal är "2"/.test(t))).toBe(true);
      expect(texter.some((t) => /lager\.antal är 1\.5/.test(t))).toBe(true);
      // Tre dagar med hornmarken, EN varning: den skrivs en gång per sidladdning, inte en gång per ruta.
      expect(texter.filter((t) => /hornmarken finns inte sedan 0\.61\.0/.test(t)).length).toBe(1);
      expect(ruta("2026-10-12").querySelector("[data-hornmarken]")).toBeNull();
    } finally {
      varn.mockRestore();
    }
  });

  it("verktygsraden: tillgänglighet och lager finns bara med sina props, och trycket byter läget", () => {
    const forsta = rendera();
    expect(screen.queryByRole("button", { name: "Tillgänglighet" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kalenderlager" })).toBeNull();
    forsta.unmount();
    /** @type {boolean[]} */
    const t = [];
    /** @type {boolean[]} */
    const l = [];
    rendera({ tillganglighet: { pa: false, onByt: (/** @type {boolean} */ v) => t.push(v) }, lager: { pa: true, onByt: (/** @type {boolean} */ v) => l.push(v) } });
    const tk = screen.getByRole("button", { name: "Tillgänglighet" });
    const lk = screen.getByRole("button", { name: "Kalenderlager" });
    expect(tk.getAttribute("aria-pressed")).toBe("false");
    expect(lk.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tk);
    fireEvent.click(lk);
    expect(t).toEqual([true]);
    expect(l).toEqual([false]);
    // Ordningen i källan: kalenderväljaren (om den finns), tillgänglighet, veckonummer, lager. Under 768 px flyttar CSS tillgänglighet först.
    const knappar = [...screen.getByRole("toolbar", { name: "Kalenderverktyg" }).querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(knappar.indexOf("Tillgänglighet")).toBeLessThan(knappar.indexOf("Veckonummer"));
    expect(knappar.indexOf("Veckonummer")).toBe(knappar.indexOf("Kalenderlager") - 1);
  });

  it("daglager: lagrens egen bubbla ritas bara när den har innehåll, och får de valda dagarna (plats för F6)", () => {
    const forsta = rendera();
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-13"]')));
    expect(panelen().querySelector("[data-lagerbubbla]")).toBeNull();
    forsta.unmount();
    /** @type {string[][]} */
    const fick = [];
    rendera({ daglager: (/** @type {string[]} */ d) => { fick.push(d); return d.includes("2026-10-13") ? <p>1 kalenderlager</p> : null; } });
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-13"]')));
    expect(/** @type {HTMLElement} */ (panelen().querySelector("[data-lagerbubbla]")).textContent).toBe("1 kalenderlager");
    expect(fick.at(-1)).toEqual(["2026-10-13"]);
  });

  it("kräver ordet även när posten har en ikon", () => {
    // ⛔ Ikonen är en andra kodning, inte en ersättning för ordet: den som
    // lyssnar hör varken färg eller form. Kastet ska komma här också, annars
    // vore ikonen en väg runt kravet.
    expect(() =>
      rendera({ entries: [{ id: "a", date: "2026-10-12", title: "Utan ord", slag: 1, kindIcon: <svg /> }] }),
    ).toThrow(/slagLabel/);
  });

  it("kastar på ett slag utan ord, redan när rutnätet ritas", () => {
    /*
     * ⛔ Samma krav som kanten ställer. En färg utan ord går inte att läsa upp,
     * och validatorns rödgrönvarning är tillåten BARA med en andra kodning.
     *
     * ⛔ OCH KASTET KOMMER TIDIGARE ÄN KANTENS. Kanten sitter på ett kort, som
     * ritas först när dagen öppnas; pricken sitter i rutan och ritas direkt.
     * Provet skrevs först med ett klick och blev rött av fel anledning: det
     * hade redan kastat. Skillnaden är värd att veta, för den betyder att ett
     * slag utan ord sänker hela kalendern och inte bara en dagspanel.
     */
    expect(() =>
      rendera({ entries: [{ id: "a", date: "2026-10-12", title: "Utan ord", slag: 1 }] }),
    ).toThrow(/slagLabel/);
  });

  it("kastar på en plats som inte finns i paletten", () => {
    rendera({ entries: [{ id: "x", date: "2026-10-12", title: "Plats nio", edge: 9, edgeLabel: "Nio" }] });
    expect(() => fireEvent.click(screen.getByRole("button", { name: "12, 1 post" }))).toThrow(/okänd edge/);
  });
});

describe("markorlayout: SS-appens märken i rutan (0.37.0)", () => {
  // SS `apps/mobile/lib/calendarDayMarkerLayout.js`, talen därifrån. Summan av det ritade och +N är alltid antalet.
  const n = (/** @type {number} */ k, /** @type {string} */ p) => Array.from({ length: k }, (_, i) => `${p}${i}`);
  const summa = (/** @type {any} */ l) => l.streck.length + l.ovre.length + l.nedre.length + l.plus;
  it.each([
    [0, 3, { streck: 0, ovre: 3, nedre: 0, plus: 0 }],
    [0, 5, { streck: 0, ovre: 3, nedre: 2, plus: 0 }],
    [0, 6, { streck: 0, ovre: 3, nedre: 2, plus: 1 }],
    [1, 4, { streck: 1, ovre: 1, nedre: 3, plus: 0 }],
    [1, 5, { streck: 1, ovre: 1, nedre: 2, plus: 2 }],
    [2, 3, { streck: 2, ovre: 0, nedre: 3, plus: 0 }],
    [3, 1, { streck: 2, ovre: 0, nedre: 1, plus: 1 }],
  ])("%i flerdag och %i endag", (sp, en, vantat) => {
    const l = markorlayout(n(sp, "s"), n(en, "e"));
    expect({ streck: l.streck.length, ovre: l.ovre.length, nedre: l.nedre.length, plus: l.plus }).toEqual(vantat);
    expect(summa(l)).toBe(sp + en);
  });
});

describe("OpsKalender: långtrycket överlever inte vyn", () => {
  /*
   * ⛔ 2026-10-01, i arbetet med bolag-ops#497: `npm run check` blev rött på ett fel EFTER att alla prov gått
   * igenom ("window is not defined", `OpsCalendar.jsx` i långtryckets timer, under `kalendrar.test.jsx`).
   * Timern på 450 ms startades av ett tryck på en dag och rensades bara av släpp, lämna och avbryt, aldrig när
   * kalendern försvann. Den sköt alltså mot en vy som inte fanns, och i provmiljön mot ett fönster som redan rivits.
   * Provet mäter att ingen timer lever kvar när kalendern tas bort mitt i ett tryck.
   */
  it("rensar långtryckets timer när kalendern tas bort", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = rendera();
      const dag = document.querySelector("[data-cal-day]");
      if (!dag) throw new Error("Ingen dag i rutnätet");
      fireEvent.pointerDown(dag, { pointerId: 1, clientX: 10, clientY: 10 });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("OpsKalender: snabbvyn vid långtryck ligger överst i panelen (0.73.0, bolag-ops#568)", () => {
  /*
   * ⛔ CP 2026-10-06: "den bubblan med långpress i cellen (ej den vanliga). Att snabb vyn kan ligga längst upp i panelen
   * centrerat." Provet mäter VAR titten ritas: första barnet i dagpanelens plats, utan `fixed` och utan koordinater. Hur
   * den ser ut vid 390 och 1280 px mäts i Playwright (`docs/bilder/568`), eftersom jsdom inte kör CSS.
   */
  const ruta = (/** @type {string} */ dag) => {
    const el = document.querySelector(`[data-cal-day="${dag}"]`);
    if (!el) throw new Error(`Ingen ruta för ${dag}`);
    return /** @type {HTMLElement} */ (el);
  };

  it("långtryck öppnar snabbvyn först i panelens plats, inte som en flytande bubbla, och väljer ingen dag", () => {
    vi.useFakeTimers();
    try {
      rendera();
      fireEvent.pointerDown(ruta("2026-10-12"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
      act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
      fireEvent.pointerUp(ruta("2026-10-12"), { pointerId: 1 });
      fireEvent.click(ruta("2026-10-12"));

      const titt = document.querySelector("[data-snabbtitt]");
      const plats = document.querySelector("[data-dagpanel-plats]");
      expect(titt).not.toBeNull();
      expect(plats?.contains(titt)).toBe(true);
      expect(plats?.firstElementChild?.matches("[data-snabbtitt-plats]")).toBe(true);
      expect(titt?.parentElement?.className).toContain("justify-center");
      expect(titt?.className).not.toMatch(/\bfixed\b/);
      expect(/** @type {HTMLElement} */ (titt).style.left).toBe("");
      expect(/** @type {HTMLElement} */ (titt).style.top).toBe("");
      expect(within(/** @type {HTMLElement} */ (titt)).getByText("Arbetsgivardeklaration")).toBeInTheDocument();
      // ⛔ Klicket efter långtrycket sväljs: titten ändrar inte urvalet.
      expect(document.querySelector("[data-dagpanel]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ett vanligt tryck öppnar dagpanelen som förut, utan snabbvy", () => {
    rendera();
    fireEvent.click(ruta("2026-10-12"));
    expect(document.querySelector("[data-dagpanel]")).not.toBeNull();
    expect(document.querySelector("[data-snabbtitt]")).toBeNull();
  });

  it("med en dag vald ligger snabbvyn ovanför dagpanelen i samma plats", () => {
    rendera();
    fireEvent.click(ruta("2026-10-25"));
    fireEvent.contextMenu(ruta("2026-10-12"));
    const plats = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel-plats]"));
    const barn = [...plats.children].map((c) => (c.matches("[data-snabbtitt-plats]") ? "titt" : c.matches("[data-dagpanel]") ? "panel" : "annat"));
    expect(barn).toEqual(["titt", "panel"]);
  });
});
