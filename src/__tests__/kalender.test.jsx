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
});

const IDAG = new Date(2026, 9, 5); // måndag 5 oktober 2026

/** Appens ord, precis som `OpsEventList` kräver dem. */
const STATUSORD = { oppet: "Öppet", pagar: "Pågår", vantar: "Väntar", klart: "Klart", akut: "Akut" };

const POSTER = [
  { id: "agi", datum: "2026-10-12", titel: "Arbetsgivardeklaration", status: "oppet" },
  { id: "lon", datum: "2026-10-25", titel: "Löneutbetalning", status: "oppet" },
  { id: "stangt", datum: "2026-10-12", titel: "#249 stängdes", status: "klart", url: "https://github.com/cllp/bolag-ops/issues/249" },
];

/** Månadens block, alltså rubriken plus dess rutnät. */
function manadsruta(namn) {
  const rubrik = screen.getByRole("heading", { name: namn });
  const block = rubrik.parentElement;
  if (!block) throw new Error(`Månaden "${namn}" har inget block`);
  return block;
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

  it("öppnar dagen i en bubbla som ligger UTANFÖR rullbehållaren", () => {
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
    const { container } = rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const bubblan = screen.getByRole("region", { name: "Poster den 12 oktober" });
    expect(within(bubblan).getByText("Arbetsgivardeklaration")).toBeInTheDocument();

    const rulle = container.querySelector("[class*='overflow-y-auto']");
    expect(rulle).not.toBeNull();
    expect(rulle.contains(bubblan)).toBe(false);
  });

  it("stänger bubblan på ett andra tryck, på krysset och på Escape", () => {
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

  it("samlar flera markerade dagar i EN bubbla, med datumet över varje", () => {
    /*
     * ⛔ CP 2026-09-22: "jag kan markera flera som gör listan i bubblorna
     * scrollbar och datumen finns med på denna tryckt på."
     *
     * Två påståenden, och båda behövs. Att den andra dagen LÄGGS TILL i stället
     * för att ERSÄTTA den första är hela funktionen: med ett enda vald-värde
     * hade provet sett en bubbla med rätt rubrik och fel innehåll. Och datumet
     * per grupp är det enda som skiljer posterna åt när flera dagar ligger i
     * samma lista.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));

    const bubblan = screen.getByRole("region", { name: "Poster för 2 valda dagar" });
    expect(within(bubblan).getByText("Arbetsgivardeklaration")).toBeInTheDocument();
    expect(within(bubblan).getByText("Löneutbetalning")).toBeInTheDocument();
    expect(within(bubblan).getByText("12 oktober")).toBeInTheDocument();
    expect(within(bubblan).getByText("25 oktober")).toBeInTheDocument();
  });

  it("radar upp dagarna i datumordning och inte i tryckordning", () => {
    /*
     * ⛔ Man läser bubblan uppifrån och ner, och en lista i tryckordning hade
     * visat den 25:e över den 12:e utan att något sagt varför. Att en ren
     * strängsortering räcker är hela skälet till att nycklarna skrivs
     * `YYYY-MM-DD` med två siffror.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "25, 1 post" }));
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const bubblan = screen.getByRole("region", { name: "Poster för 2 valda dagar" });
    const datum = within(bubblan)
      .getAllByRole("heading", { level: 5 })
      .map((h) => h.textContent);
    expect(datum).toEqual(["12 oktober", "25 oktober"]);
  });

  it("skriver inte datumet två gånger när bara en dag är markerad", () => {
    /*
     * ⛔ Datumet står redan i bubblans rubrik när en enda dag är vald, och samma
     * datum två gånger med tio pixlar emellan får läsaren att leta efter
     * skillnaden. Gruppens datumrubrik dyker därför upp först när den skiljer
     * något åt.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const bubblan = screen.getByRole("region", { name: "Poster den 12 oktober" });
    expect(within(bubblan).getAllByText("12 oktober").length).toBe(1);
    expect(within(bubblan).queryAllByRole("heading", { level: 5 }).length).toBe(0);
  });

  it("låter LISTAN rulla, inte hela bubblan", () => {
    /*
     * ⛔ Rullade hela bubblan skulle krysset rulla ur bild så fort man markerat
     * fyra dagar, alltså skulle vägen ut försvinna precis när man börjat behöva
     * den. Rubrikraden ligger därför utanför den rullande delen.
     *
     * ⛔ VAD PROVET BEVISAR: att rullningen sitter på en nod som INTE innehåller
     * krysset, och att den noden får krympa (`min-h-0`). jsdom räknar ingen
     * layout, så den faktiska rullsträckan går inte att mäta här; utan `min-h-0`
     * växer listan förbi bubblans tak och `overflow-y-auto` får aldrig något att
     * göra, vilket är det fel som annars smyger sig in.
     */
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const bubblan = screen.getByRole("region", { name: "Poster den 12 oktober" });
    const kryss = within(bubblan).getByRole("button", { name: "Stäng 12 oktober" });
    const rullande = bubblan.querySelector("[class*='overflow-y-auto']");

    expect(rullande).not.toBeNull();
    expect(rullande.contains(kryss)).toBe(false);
    expect(rullande.className).toContain("min-h-0");
    expect(within(rullande).getByText("Arbetsgivardeklaration")).toBeInTheDocument();
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
