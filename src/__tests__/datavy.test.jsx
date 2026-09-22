import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDatavy } from "../components/OpsDatavy.jsx";

/**
 * Datavyn: de fyra reglerna, en per prov. Varje prov är bevisat rött mot en
 * planterad defekt, och det står utskrivet vilken.
 */

const ORD = { felrubrik: "Kunde inte hämta tillgångarna", laddarLabel: "Hämtar tillgångar" };

describe("OpsDatavy", () => {
  it("visar felet även medan något fortfarande laddar", () => {
    /*
     * ⛔ REGEL 1, och den enda ordningen som går att lita på. Planterad defekt:
     * byt plats på `if (fel)` och `if (laddar)`, alltså precis den ordning en
     * vy råkar skriva när laddningen känns som det första som händer. Då göms
     * felet bakom en snurra som aldrig slutar snurra.
     */
    render(
      <OpsDatavy laddar fel={new Error("servern svarade 500")} {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDatavy>,
    );
    expect(screen.getByText("Kunde inte hämta tillgångarna")).toBeInTheDocument();
    expect(screen.getByText("servern svarade 500")).toBeInTheDocument();
    expect(screen.queryByText("Hämtar tillgångar")).not.toBeInTheDocument();
  });

  it("namnger vad laddningen väntar på", () => {
    /*
     * ⛔ REGEL 2. Planterad defekt: skicka `busyLabel="Hämtar"` till OpsEmpty i
     * stället för appens ord. Provet går rött, och det är hela poängen: med
     * fem läsningar i en vy är "Hämtar" samma text i alla fem.
     */
    render(
      <OpsDatavy laddar {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDatavy>,
    );
    expect(screen.getByText("Hämtar tillgångar")).toBeInTheDocument();
    expect(screen.queryByText("innehållet")).not.toBeInTheDocument();
  });

  it("säger att innehållet saknas i stället för att hämta i evighet", () => {
    /*
     * ⛔ REGEL 3, och den som fanns på riktigt i nio vyer. Planterad defekt:
     * byt grenen mot `if (laddar || props.data == null)`, alltså den handskrivna
     * varianten. Då ritar en läsning som gick igenom men gav `null` texten
     * "Hämtar tillgångar" för alltid, och sidan påstår att den arbetar när den
     * har gett upp.
     */
    render(
      <OpsDatavy laddar={false} data={null} {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDatavy>,
    );
    expect(screen.getByText("Innehållet saknas")).toBeInTheDocument();
    expect(screen.queryByText("Hämtar tillgångar")).not.toBeInTheDocument();
    /*
     * ⛔ OCH INTE SOM ETT LARM. Kontraktets regel 3 säger att `null` betyder
     * "finns inte" och att det inte är ett fel. Planterad defekt: rita en
     * OpsBanner med `tone="danger"` eller `tone="warning"`. Båda får
     * `role="alert"` och avbryter skärmläsaren för något som inte gick sönder,
     * och den dagen larmet betyder både "trasigt" och "tomt" betyder det inget.
     */
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gör INGEN tomhetskontroll när vyn inte skickar någon data", () => {
    /*
     * ⛔ SKILLNADEN MELLAN UTELÄMNAD OCH NULL. Planterad defekt: destrukturera
     * `data` i parameterlistan i stället för att läsa `"data" in props`. Då blir
     * utelämnad och `null` samma sak, och varje vy som läser fem listor och
     * inte har ett enda värde att peka på får tomhetsbanderollen i ansiktet
     * fast allt gick bra.
     */
    render(
      <OpsDatavy laddar={false} {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDatavy>,
    );
    expect(screen.getByText("innehållet")).toBeInTheDocument();
    expect(screen.queryByText("Innehållet saknas")).not.toBeInTheDocument();
  });

  it("bygger inte innehållet förrän det finns data att bygga det med", () => {
    /*
     * ⛔ REGEL 4, och skälet till att barnen är en funktion. Planterad defekt:
     * ta emot barnen som en nod. Då bygger React dem innan komponenten hann
     * välja gren, alltså kastar `data.totals` i precis det läge komponenten
     * finns för. Provet mäter det direkt: funktionen får INTE ha anropats.
     */
    const barn = vi.fn(() => <p>innehållet</p>);
    render(
      <OpsDatavy laddar fel={null} {...ORD}>
        {barn}
      </OpsDatavy>,
    );
    expect(barn).not.toHaveBeenCalled();
  });

  it("ritar huvudet i alla tre tillstånden, felet inräknat", () => {
    /*
     * ⛔ ANNARS TAPPAR FELSIDAN SIN RUBRIK, och en sida utan rubrik går inte att
     * placera: användaren ser en röd ruta utan att veta vilken sida den gäller.
     * Planterad defekt: ta bort `{huvud}` ur felgrenen, vilket är precis det en
     * handskriven vy glömmer eftersom grenen skrivs sist.
     */
    for (const fall of [{ laddar: true }, { laddar: false, fel: new Error("x") }, { laddar: false, data: null }]) {
      const { unmount } = render(
        <OpsDatavy {...fall} {...ORD} huvud={<h1>Tillgångar</h1>}>
          {() => <p>innehållet</p>}
        </OpsDatavy>,
      );
      expect(screen.getByRole("heading", { name: "Tillgångar" })).toBeInTheDocument();
      unmount();
    }
  });

  it("skickar datan vidare till barnen", () => {
    render(
      <OpsDatavy laddar={false} data={{ namn: "Adavo" }} {...ORD}>
        {(d) => <p>{d.namn}</p>}
      </OpsDatavy>,
    );
    expect(screen.getByText("Adavo")).toBeInTheDocument();
  });

  it("kastar hellre än att rita en vy utan ord för sina tillstånd", () => {
    /*
     * ⛔ OBLIGATORISKA ETIKETTER, samma regel som i resten av ramverket. En
     * reserv hade gjort felet osynligt: vyn hade ritat "Hämtar" och sett rätt ut
     * ända tills någon undrade vad den hämtade.
     */
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <OpsDatavy laddar laddarLabel="Hämtar tillgångar">
          {() => null}
        </OpsDatavy>,
      ),
    ).toThrow(/felrubrik/);
    expect(() =>
      render(
        <OpsDatavy laddar felrubrik="Kunde inte hämta tillgångarna">
          {() => null}
        </OpsDatavy>,
      ),
    ).toThrow(/laddarLabel/);
    expect(() => render(<OpsDatavy laddar {...ORD}>{/* nod, inte funktion */}<p>fel</p></OpsDatavy>)).toThrow(
      /funktion/,
    );
    tyst.mockRestore();
  });
});
