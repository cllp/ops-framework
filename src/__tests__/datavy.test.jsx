import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDataView } from "../components/OpsDataView.jsx";

/**
 * Datavyn: de fyra reglerna, en per prov. Varje prov är bevisat rött mot en
 * planterad defekt, och det står utskrivet vilken.
 */

const ORD = { errorTitle: "Kunde inte hämta tillgångarna", loadingLabel: "Hämtar tillgångar" };

describe("OpsDatavy", () => {
  it("visar felet även medan något fortfarande laddar", () => {
    /*
     * ⛔ REGEL 1, och den enda ordningen som går att lita på. Planterad defekt:
     * byt plats på `if (error)` och `if (loading)`, alltså precis den ordning en
     * vy råkar skriva när laddningen känns som det första som händer. Då göms
     * felet bakom en snurra som aldrig slutar snurra.
     */
    render(
      <OpsDataView loading error={new Error("servern svarade 500")} {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDataView>,
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
      <OpsDataView loading {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDataView>,
    );
    expect(screen.getByText("Hämtar tillgångar")).toBeInTheDocument();
    expect(screen.queryByText("innehållet")).not.toBeInTheDocument();
  });

  it("säger att innehållet saknas i stället för att hämta i evighet", () => {
    /*
     * ⛔ REGEL 3, och den som fanns på riktigt i nio vyer. Planterad defekt:
     * byt grenen mot `if (loading || props.data == null)`, alltså den handskrivna
     * varianten. Då ritar en läsning som gick igenom men gav `null` texten
     * "Hämtar tillgångar" för alltid, och sidan påstår att den arbetar när den
     * har gett upp.
     */
    render(
      <OpsDataView loading={false} data={null} {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDataView>,
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
      <OpsDataView loading={false} {...ORD}>
        {() => <p>innehållet</p>}
      </OpsDataView>,
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
      <OpsDataView loading error={null} {...ORD}>
        {barn}
      </OpsDataView>,
    );
    expect(barn).not.toHaveBeenCalled();
  });

  it("ritar huvudet i alla tre tillstånden, felet inräknat", () => {
    /*
     * ⛔ ANNARS TAPPAR FELSIDAN SIN RUBRIK, och en sida utan rubrik går inte att
     * placera: användaren ser en röd ruta utan att veta vilken sida den gäller.
     * Planterad defekt: ta bort `{header}` ur felgrenen, vilket är precis det en
     * handskriven vy glömmer eftersom grenen skrivs sist.
     */
    for (const fall of [{ loading: true }, { loading: false, error: new Error("x") }, { loading: false, data: null }]) {
      const { unmount } = render(
        <OpsDataView {...fall} {...ORD} header={<h1>Tillgångar</h1>}>
          {() => <p>innehållet</p>}
        </OpsDataView>,
      );
      expect(screen.getByRole("heading", { name: "Tillgångar" })).toBeInTheDocument();
      unmount();
    }
  });

  it("skickar datan vidare till barnen", () => {
    render(
      <OpsDataView loading={false} data={{ name: "Adavo" }} {...ORD}>
        {(d) => <p>{d.name}</p>}
      </OpsDataView>,
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
        <OpsDataView loading loadingLabel="Hämtar tillgångar">
          {() => null}
        </OpsDataView>,
      ),
    ).toThrow(/errorTitle/);
    expect(() =>
      render(
        <OpsDataView loading errorTitle="Kunde inte hämta tillgångarna">
          {() => null}
        </OpsDataView>,
      ),
    ).toThrow(/loadingLabel/);
    expect(() => render(<OpsDataView loading {...ORD}>{/* nod, inte funktion */}<p>error</p></OpsDataView>)).toThrow(
      /funktion/,
    );
    tyst.mockRestore();
  });
});
