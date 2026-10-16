import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";

/*
 * `fore` och `online` på gruppsidan (0.114.0, från granskningen av lifehub.app PR 341).
 *
 * `fore` ritas efter snabbvalen och FÖRE medlemslistan, så att appen kan visa gruppens läge överst. `online` är en mängd av userId: en
 * online-medlem får en grön prick med aria-label "<namn> online", och listan sorteras online först, sedan ägare, admin, medlem, sedan
 * namn. ⛔ Utan propen är ordningen och utseendet som förut.
 */

const grupp = { id: "g1", namn: { sv: "Alfa AB" }, roll: /** @type {const} */ ("agare") };
const medlemmar = [
  { id: "u-dan", namn: "Dan", bild: "", roll: /** @type {const} */ ("agare") },
  { id: "u-bo", namn: "Bo", bild: "", roll: /** @type {const} */ ("admin") },
  { id: "u-ann", namn: "Ann", bild: "", roll: /** @type {const} */ ("medlem") },
  { id: "u-cec", namn: "Cecilia", bild: "", roll: /** @type {const} */ ("medlem") },
];
const namnen = () => [...document.querySelectorAll("[data-gruppsida-medlemmar] li")].map((li) => li.querySelector("span.text-etikett")?.textContent);

describe("OpsGruppSida fore", () => {
  it("⛔ ritas före medlemslistan och efter snabbvalen, och children ligger kvar under", () => {
    render(
      <OpsGruppSida grupp={grupp} medlemmar={medlemmar} snabbval={[{ icon: null, label: "Kalender", onClick: () => {} }]} fore={<p data-testid="lage">Gruppens läge</p>}>
        <p data-testid="barn">Appens sektion</p>
      </OpsGruppSida>,
    );
    const snabbval = /** @type {Node} */ (document.querySelector("[data-gruppsida-snabbval]"));
    const lage = screen.getByTestId("lage");
    const lista = /** @type {Node} */ (document.querySelector("[data-gruppsida-medlemmar]"));
    const barn = screen.getByTestId("barn");
    const fore = (/** @type {Node} */ a, /** @type {Node} */ b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(fore(snabbval, lage)).toBe(true);
    expect(fore(lage, lista)).toBe(true);
    expect(fore(lista, barn)).toBe(true);
  });

  it("utan fore ritas ingen tom behållare", () => {
    render(<OpsGruppSida grupp={grupp} medlemmar={medlemmar} />);
    expect(document.querySelector("[data-gruppsida-fore]")).toBeNull();
  });
});

describe("OpsGruppSida online", () => {
  it("⛔ en online-medlem står först med en grön prick som heter \"<namn> online\"", () => {
    render(<OpsGruppSida grupp={grupp} medlemmar={medlemmar} online={new Set(["u-cec"])} />);
    // Cecilia är medlem men online: hon står före ägaren, sedan ägare, admin, medlem.
    expect(namnen()).toEqual(["Cecilia", "Dan", "Bo", "Ann"]);
    const prickar = screen.getAllByRole("img", { name: /online$/ });
    expect(prickar).toHaveLength(1);
    expect(prickar[0].getAttribute("aria-label")).toBe("Cecilia online");
    const forstaRaden = /** @type {HTMLElement} */ (document.querySelector("[data-gruppsida-medlemmar] li"));
    expect(within(forstaRaden).getByRole("img", { name: "Cecilia online" })).toBeTruthy();
  });

  it("⛔ inom online och inom varje roll sorteras namnen, och rollordningen är ägare, admin, medlem", () => {
    render(<OpsGruppSida grupp={grupp} medlemmar={medlemmar} online={new Set(["u-ann", "u-cec", "u-bo"])} />);
    // Online: Bo (admin), Ann och Cecilia (medlem, på namn). Sedan de som inte är det: Dan.
    expect(namnen()).toEqual(["Bo", "Ann", "Cecilia", "Dan"]);
    expect(screen.getAllByRole("img", { name: /online$/ }).map((p) => p.getAttribute("aria-label"))).toEqual(["Bo online", "Ann online", "Cecilia online"]);
  });

  it("⛔ utan online är ordningen medlemmarnas egen och ingen prick ritas", () => {
    const blandad = [medlemmar[3], medlemmar[0], medlemmar[2], medlemmar[1]];
    render(<OpsGruppSida grupp={grupp} medlemmar={blandad} />);
    expect(namnen()).toEqual(["Cecilia", "Dan", "Ann", "Bo"]);
    expect(screen.queryAllByRole("img", { name: /online/ })).toHaveLength(0);
    expect(document.querySelector("[data-medlem-avatar]")).toBeNull();
  });

  it("en tom mängd är ett svar: sorteringen gäller, och ingen prick ritas", () => {
    const blandad = [medlemmar[3], medlemmar[0], medlemmar[2], medlemmar[1]];
    render(<OpsGruppSida grupp={grupp} medlemmar={blandad} online={new Set()} />);
    expect(namnen()).toEqual(["Dan", "Bo", "Ann", "Cecilia"]);
    expect(screen.queryAllByRole("img", { name: /online/ })).toHaveLength(0);
  });

  it("etiketten går att byta för språket, och en online som inte är en mängd kastar", () => {
    render(<OpsGruppSida grupp={grupp} medlemmar={medlemmar} online={new Set(["u-ann"])} etiketter={{ online: "är online" }} />);
    expect(screen.getByRole("img", { name: "Ann är online" })).toBeTruthy();
    expect(() => render(<OpsGruppSida grupp={grupp} medlemmar={medlemmar} online={/** @type {any} */ (["u-ann"])} />)).toThrow(/mängd av userId/);
  });
});
