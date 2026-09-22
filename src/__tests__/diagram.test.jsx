import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsRankChart } from "../components/OpsRankChart.jsx";
import { OpsShareChart } from "../components/OpsShareChart.jsx";

/**
 * ⛔ PROVEN LÄSER TEXT OCH STRUKTUR, ALDRIG GEOMETRI SOM SER RÄTT UT.
 *
 * jsdom kör ingen CSS och ritar ingen SVG, så ett prov kan aldrig se att ringen
 * ser bra ut. Det det KAN se är det som gör diagrammet läsbart utan färg:
 * finns siffran som text, finns namnet, och kastar komponenten när färgen
 * skulle behöva hittas på. Det är också precis de egenskaper som går sönder
 * tyst, eftersom ett diagram som tappat sin legend fortfarande ser ut som ett
 * diagram.
 */

const andelar = [
  { id: "fonder", label: "Fonder", value: 4600000, text: "4 600 000 kr" },
  { id: "kontanter", label: "Kontanter", value: 1000000, text: "1 000 000 kr" },
];

describe("OpsShareChart", () => {
  it("skriver varje bit som text med värde och andel, inte bara som färg", () => {
    // ⛔ Tre av sex palettfärger ligger under 3:1 mot ljus yta. De är tillåtna
    // ENDAST med synliga etiketter eller en tabellvy, så listan bredvid ringen
    // är inte pynt utan villkoret för att paletten får användas.
    render(<OpsShareChart segments={andelar} ariaLabel="Tillgångar per klass" />);

    expect(screen.getByText("Fonder")).toBeInTheDocument();
    expect(screen.getByText("4 600 000 kr")).toBeInTheDocument();
    // 4 600 000 av 5 600 000 är 82 procent.
    expect(screen.getByText("82 %")).toBeInTheDocument();
    expect(screen.getByText("18 %")).toBeInTheDocument();
  });

  it("ger ringen ett namn i stället för att vara en osynlig graf", () => {
    render(<OpsShareChart segments={andelar} ariaLabel="Tillgångar per klass" />);
    expect(screen.getByRole("img", { name: "Tillgångar per klass" })).toBeInTheDocument();
  });

  it("kastar hellre än att hitta på en sjunde färg", () => {
    // ⛔ En genererad färg är omätt, och omätt färg i ett diagram betyder i
    // praktiken två serier som någon inte kan skilja åt. Att vika ihop svansen
    // till "Övrigt" är appens beslut: ordet är dess, och vad som får försvinna i
    // en restpost är innehåll, inte form.
    const sju = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, value: 10 }));
    expect(() => render(<OpsShareChart segments={sju} ariaLabel="Sju" />)).toThrow(/högst 6/);
  });

  it("visar det tomma läget när allt är noll, i stället för en ring utan bitar", () => {
    // ⛔ En tom ring ser ut som ett diagram som laddar. "Vi har inga tillgångar"
    // och "siffran kom aldrig" är olika saker.
    render(<OpsShareChart segments={[{ id: "a", label: "A", value: 0 }]} ariaLabel="Tom" empty={<p>Inget att fördela</p>} />);
    expect(screen.getByText("Inget att fördela")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("räknar andelen själv i stället för att låta appen skicka in den", () => {
    // ⛔ Andelen följer direkt av geometrin. Räknade appen ut den också skulle
    // två uträkningar av samma tal kunna visa olika procent i samma rad.
    render(<OpsShareChart segments={[{ id: "a", label: "A", value: 1 }, { id: "b", label: "B", value: 3 }]} ariaLabel="Fjärdedelar" />);
    expect(screen.getByText("25 %")).toBeInTheDocument();
    expect(screen.getByText("75 %")).toBeInTheDocument();
  });

  /*
   * ⛔ DET HÄR PROVET BRYTER MOT FILENS EGEN REGEL, OCH DET STÅR DÄRFÖR HÄR.
   *
   * Rubriken överst säger att proven läser text och struktur, aldrig geometri.
   * Det här läser en klassträng, alltså varken text eller geometri. Skälet är
   * att det som gick sönder (bolag-ops#152) inte går att upptäcka på något annat
   * sätt här: jsdom kör ingen CSS, så ringens faktiska position finns inte att
   * mäta, och utan provet kan nästa person skriva tillbaka `items-center` utan
   * att en enda rad blir röd.
   *
   * ⛔ VAR ÄRLIG OM VAD DET BEVISAR. Det bevisar att DEKLARATIONEN står kvar,
   * inte att ringen står still. Den andra kontrollen är ett öga på en riktig
   * webbläsare, och den står i issuens verifieringssteg. Ett prov som låtsas
   * vara den vore värre än inget prov.
   */
  it("ankrar ringen upptill i stället för att centrera den mot listan", () => {
    const { container } = render(<OpsShareChart segments={andelar} ariaLabel="Tillgångar per klass" />);
    const rad = container.firstElementChild;
    const ringen = rad?.firstElementChild;

    expect(rad?.className).toContain("sm:items-start");
    expect(rad?.className).not.toContain("items-center");

    /*
     * ⛔ TOPPANKRINGEN ÄR VILLKORAD, OCH PROVET MÅSTE SÄGA DET. Raden är
     * `flex-col` under `sm`, alltså är tväraxeln vågrät där, och ett ovillkorat
     * `self-start` vänsterställer ringen i mobilen. Ett prov som bara krävde
     * "self-start" någonstans i strängen hade varit grönt för båda varianterna,
     * och då är det inte provet som håller mobilen centrerad.
     */
    expect(ringen?.className).toContain("self-center");
    expect(ringen?.className).toContain("sm:self-start");
    expect(ringen?.className).not.toMatch(/(^|\s)self-start/);
  });
});

describe("OpsShareChart, det som ingår i en bit", () => {
  const medDetaljer = [
    { id: "pension", label: "Pension", value: 5285733, text: "5 285 733 kr", detaljer: <p>Minpension, ITP</p> },
    { id: "bostad", label: "Bostad", value: 6800000, text: "6 800 000 kr" },
  ];

  it("gör HELA raden till knappen, inte en pil i egen kolumn", () => {
    // ⛔ En 44 px pil bredvid en 28 px rad gör listan halvannan gång högre utan
    // att säga något nytt. Att raden ÄR knappen är också vad som gör den möjlig
    // att träffa med tummen.
    render(<OpsShareChart segments={medDetaljer} ariaLabel="Tillgångar" />);

    const knapp = screen.getByRole("button", { expanded: false });
    // Knappen bär radens egen text. Ett påklistrat "visa detaljer" hade ersatt
    // siffrorna med ett verb i uppläsningen.
    expect(within(knapp).getByText("Pension")).toBeInTheDocument();
    expect(within(knapp).getByText("5 285 733 kr")).toBeInTheDocument();
    expect(within(knapp).getByText("44 %")).toBeInTheDocument();
  });

  it("håller detaljerna dolda tills man öppnar dem", () => {
    render(<OpsShareChart segments={medDetaljer} ariaLabel="Tillgångar" />);
    expect(screen.getByText("Minpension, ITP")).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("Minpension, ITP")).toBeVisible();
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  it("pekar på en panel som finns även när raden är stängd", () => {
    // ⛔ `hidden` och inte villkorlig rendering. Ett `aria-controls` som pekar på
    // ett id som bara finns ibland är en trasig referens i uppläsningen varje
    // gång raden är stängd, och det syns inte på skärmen.
    render(<OpsShareChart segments={medDetaljer} ariaLabel="Tillgångar" />);
    const id = screen.getByRole("button", { expanded: false }).getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(String(id))).not.toBeNull();
  });

  it("ger ingen knapp åt en rad som inte har något att visa", () => {
    // ⛔ En pil som inte öppnar något är ett löfte som inte infrias, och den som
    // tryckt en gång utan att något hände slutar lita på de andra pilarna.
    render(<OpsShareChart segments={medDetaljer} ariaLabel="Tillgångar" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("lämnar listan som en ren lista när ingen bit har detaljer", () => {
    render(<OpsShareChart segments={andelar} ariaLabel="Tillgångar" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("OpsRankChart", () => {
  const rader = [
    { id: "brf", label: "Boende", value: 10918, text: "10 918 kr", niva: /** @type {3} */ (3) },
    { id: "mat", label: "Mat", value: 5000, text: "5 000 kr", niva: /** @type {2} */ (2) },
    { id: "strom", label: "Ström", value: 979, text: "979 kr", niva: /** @type {1} */ (1) },
  ];

  it("bär varje värde som text, så listan går att läsa utan att mäta mot en axel", () => {
    // ⛔ Skalans ljusaste steg ligger nära ytan. En stapel som nästan är ytan
    // måste ha sin siffra skriven, annars är raden tom för den som inte ser den.
    render(<OpsRankChart rows={rader} ariaLabel="Kostnader" />);
    const list = screen.getByLabelText("Kostnader");
    expect(within(list).getByText("10 918 kr")).toBeInTheDocument();
    expect(within(list).getByText("979 kr")).toBeInTheDocument();
  });

  it("mäter mot det största värdet och inte mot summan", () => {
    // ⛔ Mot summan blir varje enskild stapel en tunn strimma, och listan slutar
    // svara på vilken post som är störst, vilket är hela frågan.
    const { container } = render(<OpsRankChart rows={rader} ariaLabel="Kostnader" />);
    const bredder = [...container.querySelectorAll("[style*='width']")].map((el) => el.getAttribute("style"));
    expect(bredder[0]).toMatch(/width:\s*100%/);
    // 5 000 av 10 918 är 45,8 procent, alltså inte 5 000 av 16 897 (29,6).
    expect(bredder[1]).toMatch(/width:\s*4[0-9]/);
  });

  it("låter appen bestämma vad som är högt, och klarar sig utan bedömningen", () => {
    // ⛔ Var gränsen mellan hög och medel går är domän: tusen kronor kan vara
    // mycket i en lista och försumbart i en annan. Utan `niva` får alla staplar
    // samma ton, vilket är rätt och inte en degradering: längden bär redan
    // storleken.
    const utan = rader.map(({ niva, ...r }) => r);
    const { container } = render(<OpsRankChart rows={utan} ariaLabel="Utan nivå" />);
    const toner = [...container.querySelectorAll("[class*='bg-scale-']")].map((el) =>
      (el.className.match(/bg-scale-\d/) || [])[0],
    );
    expect(new Set(toner).size).toBe(1);
  });

  it("målar nivåerna med en skala som mörknar, aldrig med serieslottar", () => {
    // ⛔ En regnbåge har ingen ordning: läsaren måste slå upp legenden för varje
    // steg i stället för att se den. Serieslottarna bär IDENTITET och skalan bär
    // STORLEK, och byter man plats på dem betyder färgen två saker samtidigt.
    const { container } = render(<OpsRankChart rows={rader} ariaLabel="Kostnader" />);
    const klasser = container.innerHTML;
    expect(klasser).toMatch(/bg-scale-3/);
    expect(klasser).toMatch(/bg-scale-1/);
    expect(klasser).not.toMatch(/bg-series-/);
  });

  it("visar det tomma läget i stället för en lista utan staplar", () => {
    render(<OpsRankChart rows={[]} ariaLabel="Tom" empty={<p>Inga kostnader</p>} />);
    expect(screen.getByText("Inga kostnader")).toBeInTheDocument();
  });
});

describe("OpsShareChart, hålet", () => {
  it("ritar ingen total i mitten av ringen", () => {
    /*
     * ⛔ Regression, och den upptäcktes bara för att sidan mättes i en webbläsare.
     *
     * Komponenten hade `center`, alltså en total mitt i ringen. Mätt i Chromium
     * är ringen 160 px med 14 px linje, så hålet är cirka 130 px, och
     * "3 500 000 kr" är bredare än så: texten lade sig ovanpå färgen i båda
     * ändar, mörk text på blått.
     *
     * jsdom kan inte mäta bredder, så provet kan inte se felet. Det kan däremot
     * se att propen är borta, alltså att fällan inte kan återinföras av vana.
     */
    const { container } = render(
      <OpsShareChart segments={andelar} ariaLabel="Tillgångar" center="3 500 000 kr" centerLabel="totalt" />,
    );
    expect(container.textContent).not.toMatch(/3 500 000 kr/);
    expect(container.querySelector(".absolute")).toBeNull();
  });
});
