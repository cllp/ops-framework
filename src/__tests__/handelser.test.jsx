import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { urgency, splitTodayUpcoming } from "../lib/events.js";
import { OpsEventList } from "../components/OpsEventList.jsx";

const h = (id, daysLeft, extra = {}) => ({ id, title: id, daysLeft, ...extra });

describe("bradska", () => {
  it("skiljer försenat, nu, framåt och odaterat", () => {
    expect(urgency(h("a", -2))).toBe("forsenat");
    expect(urgency(h("b", 0))).toBe("pagar");
    expect(urgency(h("c", 3))).toBe("framat");
    expect(urgency(h("d", null))).toBe("odaterat");
  });

  /**
   * ⛔ Felet den här raden finns för, och det är ett vi redan haft i bolag-ops:
   * ett intervall man står mitt i (dag 15-20, och det är den 16:e) räknades mot
   * sin första dag och blev "passerat". Raden sade att något skulle gjorts igår
   * när det i själva verket var dags nu.
   */
  it("räknar ett pågående intervall som nu, inte som passerat", () => {
    expect(urgency(h("lon", -1, { pagar: true }))).toBe("pagar");
  });

  it("tål att sakna fält utan att kasta", () => {
    expect(urgency(/** @type {any} */ (null))).toBe("odaterat");
    expect(urgency(/** @type {any} */ ({ id: "x", title: "x" }))).toBe("odaterat");
  });
});

describe("delaIdagKommande", () => {
  it("lägger försenat i Idag och odaterat i Kommande", () => {
    const { today, kommande, forsenat } = splitTodayUpcoming([h("sent", -3), h("nu", 0), h("snart", 2), h("nagon-gang", null)]);

    // ⛔ Försenat ligger i Idag, inte i en egen tredje hink: det kräver dig just
    // nu, och en egen flik hade gömt det bakom ett klick.
    expect(today.map((x) => x.id)).toEqual(["sent", "nu"]);

    // ⛔ Odaterat i Kommande: det kräver dig inte idag, och lägger man det i
    // Idag slutar den siffran svara på "hur mycket måste jag göra nu".
    expect(kommande.map((x) => x.id)).toEqual(["snart", "nagon-gang"]);

    expect(forsenat).toBe(1);
  });

  it("klarar tom och saknad lista", () => {
    expect(splitTodayUpcoming([])).toEqual({ today: [], kommande: [], forsenat: 0 });
    expect(splitTodayUpcoming(/** @type {any} */ (undefined)).today).toEqual([]);
  });
});

describe("OpsEventList", () => {
  it("skriver ut ordet för försenat, inte bara färgen", () => {
    // ⛔ En färg går inte att läsa upp och är osynlig för var tjugonde man.
    render(<OpsEventList events={[h("moms", -2, { when: "För 2 dagar sedan" })]} />);
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

  it("visar urlLabel och uppdaterad i headern i stället för Öppna", () => {
    render(
      <OpsEventList
        events={[h("fix", 1, { url: "/x/183", urlLabel: "#183", updatedAt: "2026-09-18" })]}
      />,
    );
    const lank = screen.getByRole("link", { name: "#183 fix" });
    expect(lank).toHaveTextContent("#183");
    expect(screen.getByText("2026-09-18")).toBeInTheDocument();
    expect(screen.queryByText("Öppna")).toBeNull();
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
    render(<OpsEventList events={[h("lang", 3, { when: "Om 2 veckor (2026-09-30)", role: <span>Du</span> })]} />);
    const title = screen.getByText("lang");
    const when = screen.getByText("Om 2 veckor (2026-09-30)");

    // ⛔ Detaljraden hittas via `closest("div")` från datumet och inte som
    // `li`:s första barn. Provet sade förut `title.parentElement === li`, vilket
    // var sant ända till chevronkolumnen lade en kolumn mellan dem: det gick
    // rött av en ren strukturändring medan felet det bevakar var oförändrat.
    // Ett prov som är rött av fel anledning slutar man läsa.
    const metarad = /** @type {HTMLElement} */ (when.closest("div"));

    // Titeln får inte ligga i detaljraden, för då konkurrerar de om bredden igen.
    expect(metarad.contains(title)).toBe(false);
    // Och de ska vara syskon, alltså två rader i samma kolumn. Låg titeln någon
    // annanstans i trädet vore provet grönt utan att layouten var rätt.
    expect(title.parentElement).toBe(metarad.parentElement);
  });

  it("visar slaget bredvid rollen, som två olika upplysningar", () => {
    // ⛔ Rollen säger VEM, slaget säger VAD FÖR SORTS SAK. Bär raden bara det
    // ena går det att filtrera på typ utan att kunna se vilken typ en rad har,
    // alltså utan att kunna kontrollera sitt eget filter.
    render(<OpsEventList events={[h("moms", 3, { role: <span>Förfaller</span>, kind: "Pengar" })]} />);
    expect(screen.getByText("Förfaller")).toBeInTheDocument();
    expect(screen.getByText("Pengar")).toBeInTheDocument();
  });

  it("ritar slaget som text och inte som ett tredje färgat märke", () => {
    // ⛔ Raden bär redan en rollbadge och ibland ett brådskemärke. Ett tredje
    // piller gör den till ett klistermärkesalbum, och då vet ögat inte längre
    // vilket märke som betyder mest. Brådskan är det enda som får larma.
    render(<OpsEventList events={[h("moms", -2, { kind: "Pengar" })]} />);
    const kind = screen.getByText("Pengar");
    expect(kind.className).not.toMatch(/rounded-full/);
    // Försenat-märket på samma rad ÄR ett piller, så provet visar skillnaden.
    expect(screen.getByText("Försenat").className).toMatch(/rounded-full/);
  });

  it("fäller ut detaljer på den rad som har dem", () => {
    render(
      <OpsEventList
        events={[h("moms", 3, { details: <p>Redovisas via e-tjänsten</p> })]}
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
    render(<OpsEventList events={[h("ett", 1, { details: <p>d</p> }), h("tva", 2)]} />);
    expect(screen.getByRole("button", { name: "Visa detaljer för ett" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visa detaljer för tva" })).toBeNull();
  });

  it("ritar varje händelse som eget kort, inte divider-rader i ett delat kort", () => {
    // ⛔ Inkorg-mönstret: gap-3 mellan OpsCard. En ul.divide-y i ett ytterkort
    // var felet på bolag-ops Idag ("kräver dig nu").
    const { container } = render(<OpsEventList events={[h("a", 1, { when: "Idag" }), h("b", 2, { when: "I morgon" })]} />);
    const list = container.querySelector("ul");
    expect(list?.className).toMatch(/gap-3/);
    expect(list?.className).not.toMatch(/divide-y/);
    /*
     * ⛔ RADIEN ÄR INTE KRAVET. Här stod `div.rounded-lg.border`, alltså en
     * fråga som band fast ett hörnvärde provet aldrig handlade om. Kravet är
     * att varje händelse är ETT EGET kort, och det säger `border` plus
     * räkningen. Hörnet blev `rounded-3xl` när bubblan kom, och provet gick
     * rött utan att något blivit fel.
     */
    const kort = container.querySelectorAll("ul > li > div.border");
    expect(kort).toHaveLength(2);
    // ⛔ Och de ÄR bubblor, alltså 24 px och inte panelens 8. Det är ett eget
    // krav och står som en egen rad, inte insmuget i frågan ovan.
    for (const k of kort) expect(k.className).toMatch(/rounded-3xl/);
  });

  it("släpper igenom slagets vänsterkant till kortet", () => {
    /*
     * ⛔ CP 2026-09-22: "Matt vänsterkant per slag (Uppgift / Påminnelse /
     * Faktum) som SS left accent."
     *
     * ⛔ KANTEN BYGGS INTE HÄR, DEN SLÄPPS IGENOM. `OpsCard` har haft den hela
     * tiden. Listan gjorde den bara inte nåbar, så varje yta som ville visa
     * slaget som en kant hade fått rita sin egen, och då hade tre ytor haft tre
     * kanter som nästan var lika.
     */
    const { container } = render(
      <OpsEventList events={[h("a", 1, { when: "Idag", edge: 2, edgeLabel: "Påminnelse" })]} />,
    );
    const kortet = container.querySelector("ul > li > div.border");
    expect(kortet?.className).toMatch(/border-l-4/);
    // ⛔ Och ordet följer med. En färg utan ord säger ingenting till den som
    // inte lärt sig koden, och `OpsCard` kastar hellre än att rita den.
    expect(screen.getByText("Påminnelse")).toBeInTheDocument();
  });

  it("kastar när kanten saknar sitt ord", () => {
    /*
     * ⛔ REGELN BOR I `OpsCard` OCH PROVAS HÄR ÄNDÅ, för det är genom listan
     * appen faktiskt når den. Ett prov bara på kortet hade lämnat vägen hit
     * obevakad, och det är vägen som används.
     */
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsEventList events={[h("a", 1, { when: "Idag", edge: 2 })]} />)).toThrow(/edgeLabel/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("reserverar ingen chevronkolumn när ingen rad kan fällas ut", () => {
    // ⛔ Kolumnen är 44 px av en 390 px bred telefon och tas från titeln. En
    // lista helt utan utfällbara rader ska inte betala för en gest som inte
    // finns: det var precis så titeln en gång kom ner till 178 px.
    const { container } = render(<OpsEventList events={[h("ett", 1), h("tva", 2)]} />);
    expect(container.querySelectorAll(".w-11")).toHaveLength(0);

    const { container: medDetaljer } = render(<OpsEventList events={[h("tre", 1, { details: <p>d</p> })]} />);
    expect(medDetaljer.querySelectorAll(".w-11").length).toBeGreaterThan(0);
  });

  it("skriver deadline som eget faktum, inte som en del av brådskan", () => {
    // ⛔ CP: "Om det finns en deadline på aktiviteten så skriv det."
    //
    // `when` säger hur långt bort något är, `deadline` vilken dag. Två olika
    // fakta, och båda behövs: det ena svarar på "måste jag nu", det andra på
    // "vad skriver jag in i kalendern".
    render(<OpsEventList events={[h("moms", 14, { when: "Om 2 veckor", deadline: "Förfaller 2026-09-30" })]} />);
    expect(screen.getByText("Om 2 veckor")).toBeInTheDocument();
    expect(screen.getByText("Förfaller 2026-09-30")).toBeInTheDocument();
  });

  it("håller när och deadline i samma element så de inte wrappar isär", () => {
    // ⛔ Som syskon direkt i flexraden kan datumet hamna på egen rad under
    // rollbadgen, där det läses som ett tredje obesläktat fält i stället för
    // som samma upplysning ur ett annat håll.
    render(
      <OpsEventList events={[h("moms", 14, { role: <span>Förfaller</span>, when: "Om 2 veckor", deadline: "2026-09-30" })]} />,
    );
    const when = screen.getByText("Om 2 veckor");
    const deadline = screen.getByText("2026-09-30");
    const klustret = /** @type {HTMLElement} */ (when.parentElement);

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

  it("ritar appens åtgärd på raden och förklaringen en gång för listan", () => {
    // ⛔ Ramverket RITAR åtgärden och tolkar den aldrig. Provet skickar in en
    // knapp och kontrollerar att den kommer fram och fungerar, inte vad den gör.
    const rader = [];
    render(
      <OpsEventList
        events={[h("lon", 3, { atgard: <button onClick={() => rader.push("lon")}>Bocka av</button> }), h("faktura", 5)]}
        actionHint="Bara påminnelser går att bocka av."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bocka av" }));
    expect(rader).toEqual(["lon"]);

    // ⛔ EN gång, inte en gång per rad utan knapp. Tre identiska meningar under
    // varandra mättes fram som en tredjedel längre lista i bolag-ops Idag, och
    // en rad som säger samma sak som raden ovanför slutar läsas.
    expect(screen.getAllByText("Bara påminnelser går att bocka av.")).toHaveLength(1);
  });

  it("lämnar en lista utan åtgärder precis som förut", () => {
    /*
     * ⛔ Platsen ritas bara när raden har något att lägga där, exakt som
     * chevronkolumnen bara finns när någon rad kan fällas ut. Annars betalar
     * varje befintlig lista marginal för en gest som inte finns, och det felet
     * har komponenten redan gjort en gång med titeln som fick 178 px.
     *
     * ⛔ FÖRSTA VERSIONEN AV DET HÄR PROVET MÄTTE FEL SAK. Den räknade knappar,
     * och en tom `div` innehåller inga knappar: planterade jag felet, alltså
     * lät platsen ritas alltid, stod provet grönt. Nu letar det efter TOMMA
     * element, vilket är precis vad den onödiga platsen är.
     */
    // ⛔ `when` på båda raderna med flit: utan den är detaljraden tom av egna
    // skäl, och då hade provet fällt på något det inte handlar om.
    const { container } = render(<OpsEventList events={[h("a", 1, { when: "I morgon" }), h("b", 2, { when: "Om 2 dagar" })]} />);
    const tomma = [...container.querySelectorAll("li *")].filter((e) => !e.children.length && !e.textContent.trim());
    expect(tomma).toHaveLength(0);
  });

  it("kastar när några rader går att göra något åt och listan inte säger vilka", () => {
    /*
     * ⛔ DET HÄR ÄR LÖFTET, INTE EN ARTIGHET.
     *
     * En lista där vissa rader går att göra något åt och andra ser likadana ut
     * lär användaren att trycka på måfå, och den som tryckt förgäves en gång
     * slutar lita på hela listan, också de rader där knappen fanns.
     */
    const tyst = () => render(<OpsEventList events={[h("lon", 3, { atgard: <button>Bocka av</button> }), h("stum", 5)]} />);
    expect(tyst).toThrow(/actionHint/);
  });

  it("kräver ingen förklaring när ALLA rader har en åtgärd", () => {
    // ⛔ Då finns ingen tyst rad att undra över, och ett krav som larmar utan
    // att det finns något att larma på lär man sig att kringgå.
    const alla = () =>
      render(
        <OpsEventList
          events={[h("a", 1, { atgard: <button>Ett</button> }), h("b", 2, { atgard: <button>Två</button> })]}
        />,
      );
    expect(alla).not.toThrow();
  });

  it("visar det tomma läget i stället för en tom lista", () => {
    // ⛔ Tom lista och "allt är gjort" ser likadana ut i markup och betyder
    // motsatta saker.
    render(<OpsEventList events={[]} empty={<p>Inget brinner</p>} />);
    expect(screen.getByText("Inget brinner")).toBeInTheDocument();
  });
});
