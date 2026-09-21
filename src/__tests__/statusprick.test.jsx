import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsStatusDot } from "../components/OpsStatusDot.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";

/**
 * ⛔ DET SOM PROVAS ÄR ORDET, INTE FÄRGEN.
 *
 * jsdom räknar ingen CSS, så ett prov som påstår sig kontrollera att `vantar`
 * är orange hade varit grönt oavsett vilken klass som står där. Det som går att
 * prova är det som faktiskt bär betydelsen: att varje läge har ett ord, att
 * ordet når skärmläsaren, och att fem lägen får fem OLIKA klasser. Färgerna i
 * sig mäts av vyportvakten i en riktig webbläsare.
 */
describe("OpsStatusDot", () => {
  it("ger skärmläsaren ordet för varje läge", () => {
    /*
     * ⛔ EN FÄRG GÅR INTE ATT LÄSA UPP. Utan ordet är raden tom för den som
     * använder skärmläsare, och för ungefär var tjugonde man som inte skiljer
     * färgerna åt. Felet är osynligt just för den som byggde vyn.
     */
    render(<OpsStatusDot status="vantar" label="Väntar" />);
    expect(screen.getByText("Väntar")).toBeTruthy();
  });

  it("skriver ut ordet synligt för akut, och bara för akut", () => {
    /*
     * ⛔ Samma logik som `OpsEventList`: bara det läge som lånar larmfärgen får
     * ett ord som standard. Ett missat "akut" kostar något, ett missat "öppet"
     * gör det inte, och fem synliga ord på varje rad hade tvingat fram en
     * radbrytning i en lista där fyra upplysningar redan trängs.
     */
    const { container, unmount } = render(<OpsStatusDot status="akut" label="Akut" />);
    expect(container.querySelector(".sr-only")).toBeNull();
    expect(container.textContent).toBe("Akut");
    unmount();

    const andra = render(<OpsStatusDot status="oppet" label="Öppet" />);
    expect(andra.container.querySelector(".sr-only")?.textContent).toBe("Öppet");
  });

  it("ger de fem lägena fem olika toner", () => {
    /*
     * ⛔ GOLVET ÄR ATT DE SKILJER SIG ÅT, och det är hela skälet till att
     * `--color-blocked` lades till i tokens. Utan ett eget token hade `vantar`
     * lånat `warning`, alltså samma guld som `oppet`, och två lägen med samma
     * färg är samma sak som ingen färg: pricken slutar svara på frågan.
     */
    const klasser = new Set();
    for (const [status, ord] of [
      ["oppet", "Öppet"],
      ["pagar", "Pågår"],
      ["vantar", "Väntar"],
      ["klart", "Klart"],
      ["akut", "Akut"],
    ]) {
      const { container, unmount } = render(<OpsStatusDot status={status} label={ord} />);
      const prick = container.querySelector("[aria-hidden='true'].rounded-full");
      klasser.add(prick?.className);
      // Muspekaren får samma svar som skärmläsaren, utan att säga det två gånger.
      expect(prick?.getAttribute("title")).toBe(ord);
      unmount();
    }
    expect(klasser.size).toBe(5);
  });

  it("kastar på ett okänt läge och på ett saknat ord", () => {
    // ⛔ En prick i fel färg är sämre än ingen prick: den ser ut att betyda
    // något. Samma val som `OpsPill` gör med sina toner.
    expect(() => render(<OpsStatusDot status="kanske" label="Kanske" />)).toThrow(/okänd status/);
    expect(() => render(<OpsStatusDot status="oppet" label="" />)).toThrow(/label saknas/);
  });
});

describe("OpsEventList med status", () => {
  const rad = (extra) => ({ id: "a", titel: "Ärende", dagarKvar: null, ...extra });

  it("visar pricken i den kollapsade raden, alltså utan att något fälls ut", () => {
    /*
     * ⛔ CP (#249): "Statusprick synlig även i kollapsat läge." Ligger den i
     * utfällningen svarar den bara den som redan öppnat kortet, och frågan
     * "vad väntar på någon annan" ställs när man SKUMMAR listan.
     */
    render(
      <OpsEventList
        events={[rad({ status: "vantar", detaljer: <p>Detaljer</p> })]}
        ariaLabel="Händelser"
        statusOrd={{ vantar: "Väntar på motpart" }}
      />,
    );
    expect(screen.getByText("Väntar på motpart")).toBeTruthy();
    // Panelen är fortfarande dold: pricken kom inte därifrån.
    expect(screen.getByText("Detaljer").closest("[hidden]")).toBeTruthy();
  });

  it("kastar när en status saknar sitt ord", () => {
    /*
     * ⛔ SAMMA VAL SOM `atgardsforklaring`: hellre ett fel än en vy som tyst
     * blir obrukbar för en del av sina läsare. En tyst nedsläppsväg hade ritat
     * en färgad prick utan besked, och det ser rätt ut för den som byggde den.
     */
    expect(() =>
      render(<OpsEventList events={[rad({ status: "akut" })]} ariaLabel="Händelser" statusOrd={{ oppet: "Öppet" }} />),
    ).toThrow(/statusOrd saknar ordet/);
  });

  it("rader utan status ritar ingen prick alls", () => {
    // ⛔ Ingen reserverad plats för ett fält som inte finns, exakt som
    // chevronkolumnen och åtgärdsplatsen. En lista utan statusar ska se ut
    // precis som förut.
    const { container } = render(<OpsEventList events={[rad({})]} ariaLabel="Händelser" />);
    expect(container.querySelector(".rounded-full")).toBeNull();
  });
});
