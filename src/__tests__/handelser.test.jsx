import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
    render(<OpsEventList events={[h("lang", 3, { nar: "Om 2 veckor (2026-09-30)", roll: <span>Du</span> })]} />);
    const titel = screen.getByText("lang");
    const nar = screen.getByText("Om 2 veckor (2026-09-30)");

    // ⛔ Detaljraden hittas via `closest("div")` från datumet och inte som
    // `li`:s första barn. Provet sade förut `titel.parentElement === li`, vilket
    // var sant ända till chevronkolumnen lade en kolumn mellan dem: det gick
    // rött av en ren strukturändring medan felet det bevakar var oförändrat.
    // Ett prov som är rött av fel anledning slutar man läsa.
    const metarad = /** @type {HTMLElement} */ (nar.closest("div"));

    // Titeln får inte ligga i detaljraden, för då konkurrerar de om bredden igen.
    expect(metarad.contains(titel)).toBe(false);
    // Och de ska vara syskon, alltså två rader i samma kolumn. Låg titeln någon
    // annanstans i trädet vore provet grönt utan att layouten var rätt.
    expect(titel.parentElement).toBe(metarad.parentElement);
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

  it("fäller ut detaljer på den rad som har dem", () => {
    render(
      <OpsEventList
        events={[h("moms", 3, { detaljer: <p>Redovisas via e-tjänsten</p> })]}
      />,
    );

    const knapp = screen.getByRole("button", { name: "Visa detaljer för moms" });
    expect(knapp.getAttribute("aria-expanded")).toBe("false");

    // ⛔ Panelen finns i DOM:en hela tiden och styrs med `hidden`. Därför räcker
    // det inte att leta efter texten: den hittas även hopfälld. Provet läser
    // `hidden` på det element `aria-controls` pekar på, alltså samma väg som en
    // skärmläsare tar.
    const panel = () => document.getElementById(/** @type {string} */ (knapp.getAttribute("aria-controls")));
    expect(panel()?.hidden).toBe(true);

    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.hidden).toBe(false);
    expect(screen.getByText("Redovisas via e-tjänsten")).toBeInTheDocument();
  });

  it("ger ingen chevron till en rad utan detaljer", () => {
    // ⛔ En pil som inte öppnar något är ett löfte som inte infrias, och den som
    // tryckt en gång utan att något hände slutar lita på de andra pilarna.
    render(<OpsEventList events={[h("ett", 1, { detaljer: <p>d</p> }), h("tva", 2)]} />);
    expect(screen.getByRole("button", { name: "Visa detaljer för ett" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visa detaljer för tva" })).toBeNull();
  });

  it("reserverar ingen chevronkolumn när ingen rad kan fällas ut", () => {
    // ⛔ Kolumnen är 44 px av en 390 px bred telefon och tas från titeln. En
    // lista helt utan utfällbara rader ska inte betala för en gest som inte
    // finns: det var precis så titeln en gång kom ner till 178 px.
    const { container } = render(<OpsEventList events={[h("ett", 1), h("tva", 2)]} />);
    expect(container.querySelectorAll(".w-11")).toHaveLength(0);

    const { container: medDetaljer } = render(<OpsEventList events={[h("tre", 1, { detaljer: <p>d</p> })]} />);
    expect(medDetaljer.querySelectorAll(".w-11").length).toBeGreaterThan(0);
  });

  it("skriver deadline som eget faktum, inte som en del av brådskan", () => {
    // ⛔ CP: "Om det finns en deadline på aktiviteten så skriv det."
    //
    // `nar` säger hur långt bort något är, `deadline` vilken dag. Två olika
    // fakta, och båda behövs: det ena svarar på "måste jag nu", det andra på
    // "vad skriver jag in i kalendern".
    render(<OpsEventList events={[h("moms", 14, { nar: "Om 2 veckor", deadline: "Förfaller 2026-09-30" })]} />);
    expect(screen.getByText("Om 2 veckor")).toBeInTheDocument();
    expect(screen.getByText("Förfaller 2026-09-30")).toBeInTheDocument();
  });

  it("håller när och deadline i samma element så de inte wrappar isär", () => {
    // ⛔ Som syskon direkt i flexraden kan datumet hamna på egen rad under
    // rollbadgen, där det läses som ett tredje obesläktat fält i stället för
    // som samma upplysning ur ett annat håll.
    render(
      <OpsEventList events={[h("moms", 14, { roll: <span>Förfaller</span>, nar: "Om 2 veckor", deadline: "2026-09-30" })]} />,
    );
    const nar = screen.getByText("Om 2 veckor");
    const deadline = screen.getByText("2026-09-30");
    const klustret = /** @type {HTMLElement} */ (nar.parentElement);

    expect(deadline.parentElement).toBe(klustret);

    // ⛔ DEN HÄR RADEN ÄR HELA PROVET, och första versionen saknade den.
    //
    // Den nöjde sig med att de två har samma förälder, och det är sant både när
    // de sitter i ett eget kluster och när de ligger platt i detaljraden: då är
    // den gemensamma föräldern bara detaljraden i stället. Planterade jag felet
    // blev provet grönt.
    //
    // Klustret måste alltså vara ETT ELEMENT SNÄVARE än raden, och det syns på
    // att rollbadgen ligger utanför det.
    expect(klustret.contains(screen.getByText("Förfaller"))).toBe(false);
  });

  it("visar det tomma läget i stället för en tom lista", () => {
    // ⛔ Tom lista och "allt är gjort" ser likadana ut i markup och betyder
    // motsatta saker.
    render(<OpsEventList events={[]} empty={<p>Inget brinner</p>} />);
    expect(screen.getByText("Inget brinner")).toBeInTheDocument();
  });
});
