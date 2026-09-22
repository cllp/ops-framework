import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsKalender } from "../components/OpsKalender.jsx";
import { datumnyckel, forstaKolumnen, idagsnyckel, manader, manadsrutnat, perDag } from "../lib/kalender.js";

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

  it("fäller ut dagens poster under månaden, och stänger på ett andra tryck", () => {
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));

    const listan = screen.getByText("2026-10-12").closest("div");
    expect(within(listan).getByText("Arbetsgivardeklaration")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    expect(screen.queryByText("2026-10-12")).toBeNull();
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
