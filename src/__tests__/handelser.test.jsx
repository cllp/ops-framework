import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { bradska, delaIdagKommande } from "../lib/handelser.js";
import { OpsEventList } from "../components/OpsEventList.jsx";

const h = (id, dagarKvar, extra = {}) => ({ id, titel: id, dagarKvar, ...extra });

describe("bradska", () => {
  it("skiljer försenat, nu, framåt och odaterat", () => {
    expect(bradska(h("a", -2))).toBe("forsenat");
    expect(bradska(h("b", 0))).toBe("pagar");
    expect(bradska(h("c", 3))).toBe("framat");
    expect(bradska(h("d", null))).toBe("odaterat");
  });

  /**
   * ⛔ Felet den här raden finns för, och det är ett vi redan haft i bolag-ops:
   * ett intervall man står mitt i (dag 15-20, och det är den 16:e) räknades mot
   * sin första dag och blev "passerat". Raden sade att något skulle gjorts igår
   * när det i själva verket var dags nu.
   */
  it("räknar ett pågående intervall som nu, inte som passerat", () => {
    expect(bradska(h("lon", -1, { pagar: true }))).toBe("pagar");
  });

  it("tål att sakna fält utan att kasta", () => {
    expect(bradska(/** @type {any} */ (null))).toBe("odaterat");
    expect(bradska(/** @type {any} */ ({ id: "x", titel: "x" }))).toBe("odaterat");
  });
});

describe("delaIdagKommande", () => {
  it("lägger försenat i Idag och odaterat i Kommande", () => {
    const { idag, kommande, forsenat } = delaIdagKommande([h("sent", -3), h("nu", 0), h("snart", 2), h("nagon-gang", null)]);

    // ⛔ Försenat ligger i Idag, inte i en egen tredje hink: det kräver dig just
    // nu, och en egen flik hade gömt det bakom ett klick.
    expect(idag.map((x) => x.id)).toEqual(["sent", "nu"]);

    // ⛔ Odaterat i Kommande: det kräver dig inte idag, och lägger man det i
    // Idag slutar den siffran svara på "hur mycket måste jag göra nu".
    expect(kommande.map((x) => x.id)).toEqual(["snart", "nagon-gang"]);

    expect(forsenat).toBe(1);
  });

  it("klarar tom och saknad lista", () => {
    expect(delaIdagKommande([])).toEqual({ idag: [], kommande: [], forsenat: 0 });
    expect(delaIdagKommande(/** @type {any} */ (undefined)).idag).toEqual([]);
  });
});

describe("OpsEventList", () => {
  it("skriver ut ordet för försenat, inte bara färgen", () => {
    // ⛔ En färg går inte att läsa upp och är osynlig för var tjugonde man.
    render(<OpsEventList events={[h("moms", -2, { nar: "För 2 dagar sedan" })]} />);
    expect(screen.getByText("Försenat")).toBeInTheDocument();
  });

  it("låter appen skriva sitt eget språk men inte ta bort ordet", () => {
    render(<OpsEventList events={[h("moms", -2)]} labels={{ forsenat: "Overdue" }} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("ger varje länk ett eget namn för skärmläsare", () => {
    // ⛔ "Öppna" tio gånger i rad säger ingenting uppläst.
    render(<OpsEventList events={[h("ett", 1, { url: "/a" }), h("tva", 2, { url: "/b" })]} />);
    expect(screen.getByRole("link", { name: "Öppna ett" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Öppna tva" })).toBeInTheDocument();
  });

  it("låter titeln stå för sig, inte i samma rad som detaljerna", () => {
    /*
     * ⛔ Regression, och den upptäcktes bara för att CP skickade en skärmbild.
     *
     * Titeln låg i samma flexrad som rollbadge, brådskemärke och datum, med
     * `flex-1`. Mätt i Chromium vid 390 px fick den 178 till 196 px, alltså under
     * halva skärmen, och "Attest större leverantörsfakturor" bröts i tre rader à
     * två ord medan halva raden stod tom.
     *
     * jsdom kör ingen CSS och kan inte mäta bredder, så provet kan inte se felet.
     * Det kan däremot se STRUKTUREN som orsakade det: ligger titeln i samma
     * element som datumet konkurrerar de om bredden igen. Beviset för bredden är
     * mätningen i mätbygget; det här är golvet som gör att strukturen inte kan
     * falla tillbaka obemärkt.
     */
    const { container } = render(<OpsEventList events={[h("lang", 3, { nar: "Om 2 veckor (2026-09-30)", roll: <span>Du</span> })]} />);
    const rad = /** @type {HTMLElement} */ (container.querySelector("li"));
    const titel = screen.getByText("lang");
    const nar = screen.getByText("Om 2 veckor (2026-09-30)");

    expect(titel.parentElement).toBe(rad);
    expect(nar.parentElement).not.toBe(rad);
    expect(titel.contains(nar)).toBe(false);
    expect(/** @type {HTMLElement} */ (nar.parentElement).contains(titel)).toBe(false);
  });

  it("visar slaget bredvid rollen, som två olika upplysningar", () => {
    // ⛔ Rollen säger VEM, slaget säger VAD FÖR SORTS SAK. Bär raden bara det
    // ena går det att filtrera på typ utan att kunna se vilken typ en rad har,
    // alltså utan att kunna kontrollera sitt eget filter.
    render(<OpsEventList events={[h("moms", 3, { roll: <span>Förfaller</span>, slag: "Pengar" })]} />);
    expect(screen.getByText("Förfaller")).toBeInTheDocument();
    expect(screen.getByText("Pengar")).toBeInTheDocument();
  });

  it("ritar slaget som text och inte som ett tredje färgat märke", () => {
    // ⛔ Raden bär redan en rollbadge och ibland ett brådskemärke. Ett tredje
    // piller gör den till ett klistermärkesalbum, och då vet ögat inte längre
    // vilket märke som betyder mest. Brådskan är det enda som får larma.
    render(<OpsEventList events={[h("moms", -2, { slag: "Pengar" })]} />);
    const slag = screen.getByText("Pengar");
    expect(slag.className).not.toMatch(/rounded-full/);
    // Försenat-märket på samma rad ÄR ett piller, så provet visar skillnaden.
    expect(screen.getByText("Försenat").className).toMatch(/rounded-full/);
  });

  it("visar det tomma läget i stället för en tom lista", () => {
    // ⛔ Tom lista och "allt är gjort" ser likadana ut i markup och betyder
    // motsatta saker.
    render(<OpsEventList events={[]} empty={<p>Inget brinner</p>} />);
    expect(screen.getByText("Inget brinner")).toBeInTheDocument();
  });
});
