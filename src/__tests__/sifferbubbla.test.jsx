import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { OpsFloatingSummary } from "../components/OpsFloatingSummary.jsx";

/**
 * ⛔ DET SOM PROVAS ÄR ATT DEN INTE FÖRSVINNER, INTE ATT DEN SYNS.
 *
 * En bubbla som går att fälla ihop har två sätt att gå sönder, och bara det ena
 * märks: att den inte fäller ihop, och att den fäller ihop till ingenting. Det
 * senare ser ut som en fungerande knapp ända tills någon vill ha tillbaka
 * siffran och inte hittar något att trycka på.
 *
 * ⛔ Färgerna går INTE att prova här. jsdom räknar ingen CSS, så ett prov som
 * påstår sig kontrollera att bubblan funkar i mörkt läge hade varit grönt oavsett.
 * Det som går att göra i stället är gjort: komponenten använder bara tokens
 * (`bg-raised`, `border-line`, `text-ink`, `text-success`, `text-danger`,
 * `shadow-lg`), och alla sex byter med temat i `tokens.css`. Ramverkets
 * `check-closed-api` fäller varje egen färg, och vyportvakten mäter mörkt läge
 * i en riktig webbläsare.
 */
describe("OpsFloatingSummary", () => {
  beforeEach(() => {
    try {
      globalThis.localStorage?.clear();
    } catch {
      // Inget minne, inget att rensa.
    }
  });

  it("visar namnet och siffran utfälld", () => {
    render(<OpsFloatingSummary label="Månadskassaflöde" value="+23 256 kr" />);
    expect(screen.getByText("Månadskassaflöde")).toBeInTheDocument();
    expect(screen.getByText("+23 256 kr")).toBeInTheDocument();
  });

  it("behåller siffran när den fälls ihop, och tappar bara namnet", () => {
    render(<OpsFloatingSummary label="Månadskassaflöde" value="+23 256 kr" />);
    fireEvent.click(screen.getByRole("button"));

    // ⛔ Det här är provets hela poäng: ihopfälld är inte borta.
    expect(screen.getByText("+23 256 kr")).toBeInTheDocument();
    expect(screen.queryByText("Månadskassaflöde")).not.toBeInTheDocument();
  });

  it("går att fälla ut igen", () => {
    render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const knapp = screen.getByRole("button");
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    expect(screen.getByText("Netto")).toBeInTheDocument();
  });

  it("säger sitt läge för den som lyssnar, inte bara för den som ser", () => {
    render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const knapp = screen.getByRole("button");
    expect(knapp).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(knapp);
    expect(knapp).toHaveAttribute("aria-expanded", "false");
    // Namnet är borta ur texten men finns kvar i etiketten, annars är knappen
    // "plus ett kronor" och ingenting mer.
    expect(knapp.getAttribute("aria-label")).toContain("Netto");
  });

  it("visar hinten utfälld och inte ihopfälld", () => {
    render(<OpsFloatingSummary label="Netto" value="+1 kr" hint="−2 344 kr mot nuläget" />);
    expect(screen.getByText("−2 344 kr mot nuläget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("−2 344 kr mot nuläget")).not.toBeInTheDocument();
  });

  it("startar utfälld varje gång", () => {
    /*
     * ⛔ `storageKey` ÄR BORTTAGEN, OCH DET ÄR EN FÖLJD AV NÄR BUBBLAN FINNS.
     *
     * Den lever bara medan något är justerat, och justeringarna överlever inte
     * en omladdning. Ett minne av "ihopfälld" hade därför gällt ett läge som
     * ändå är borta, och nästa gång man drog i ett reglage hade siffran man bad
     * om kommit tillbaka hopvikt.
     */
    const { unmount } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    fireEvent.click(screen.getByRole("button"));
    unmount();

    render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("kastar hellre än att rendera en bubbla utan siffra eller utan namn", () => {
    expect(() => render(<OpsFloatingSummary label="Netto" value="" />)).toThrow(/label och value/);
    expect(() => render(<OpsFloatingSummary label="" value="+1 kr" />)).toThrow(/label och value/);
  });

  it("bottnar ovanför bottenraden, inte ovanpå den", () => {
    // ⛔ Klassen kontrolleras för att det inte finns något annat sätt: jsdom
    // räknar ingen layout. Utan den här raden kan `--bottom-nav-h` falla bort i
    // en omskrivning, och då lägger sig bubblan över telefonens navigering.
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(container.firstChild.className).toContain("--bottom-nav-h");
    expect(container.firstChild.className).toContain("--safe-bottom");
  });

  it("räknar även med knappen som sticker upp ur bottenraden", () => {
    /*
     * ⛔ ATT KLARA BAREN RÄCKTE INTE, OCH DET SYNTES BARA PÅ EN TELEFON.
     *
     * Bottenradens huvudåtgärd är en rund knapp som lyfts 12px och bär en 4px
     * ring, alltså 16px ovanför baren. Bubblan bottnade 8px över baren och låg
     * därmed halvt under knappen. CP 2026-09-18, med bild.
     *
     * Provet läser tokennamnet och inte ett tal: hela poängen med
     * `--bottom-nav-overhang` är att sträckan bor på ETT ställe, och ett prov
     * som skrev 16px hit hade gjort det till två.
     */
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(container.firstChild.className).toContain("--bottom-nav-overhang");
  });

  it("har fast bredd utfälld och egen bredd ihopfälld", () => {
    /*
     * ⛔ CP: "Den svajar lite med siffrornas bredd."
     *
     * Bubblan ligger högerställd, så ett tal som blir en siffra bredare växer åt
     * vänster. Man drar i ett reglage och rutan man läser rör sig under blicken.
     * Full bredd utfälld gör behållaren orörlig; talet byter bredd inuti den.
     *
     * Ihopfälld ska den däremot INTE spänna skärmen: en tom remsa tvärs över
     * telefonen för en ensam siffra är inte en mindre bubbla.
     */
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const bubbla = () => container.firstChild.firstChild;
    expect(String(bubbla().className).split(/\s+/)).toContain("w-full");

    fireEvent.click(screen.getByRole("button"));
    expect(String(bubbla().className).split(/\s+/)).not.toContain("w-full");
  });

  it("låter namnet kortas av men aldrig talet", () => {
    /*
     * ⛔ EN HINT SOM BLEV TVÅ RADER VAR HALVA FELET I CP:S BILD. Bubblan blev
     * högre, sköt upp över sitt utrymme och la sig i vägen. Det som ska ge vika
     * när det blir trångt är namnet, aldrig siffran: siffran är hela skälet till
     * att bubblan finns.
     */
    render(<OpsFloatingSummary label="Månadskassaflöde" value="+23 176 kr/mån" hint="Nuläget 23 256 kr" />);

    for (const text of ["Månadskassaflöde", "Nuläget 23 256 kr"]) {
      expect(String(screen.getByText(text).className).split(/\s+/)).toContain("truncate");
    }

    const talet = String(screen.getByText("+23 176 kr/mån").className).split(/\s+/);
    expect(talet).toContain("whitespace-nowrap");
    expect(talet).toContain("shrink-0");
    expect(talet).not.toContain("truncate");
  });

  it("är fast i fönstret och inte sticky i en förälder", () => {
    /*
     * ⛔ DET HÄR ÄR PROVET SOM SAKNADES, OCH DESS FRÅNVARO KOSTADE EN RUNDA.
     *
     * Första versionen var `sticky bottom-…`, lånat från SessionStudios
     * "Idag"-knapp. Där fungerar det, för deras kalender är ett skal med fast
     * höjd vars kolumner scrollar var för sig. En sida som scrollar i
     * DOKUMENTET har ingen sådan behållare, och `sticky` blev då en rad i
     * flödet som inte flöt. CP såg det direkt; inget prov gjorde det.
     */
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);

    /*
     * ⛔ KLASSERNA LÄSES SOM KLASSER OCH INTE SOM TEXT, och det är inte
     * petimeter. Första versionen av provet gjorde `not.toContain("sticky")` på
     * hela strängen och blev rött mot rätt kod: `z-(--z-sticky)` innehåller
     * ordet. Ett prov som fäller på en delsträng i ett tokennamn hade tvingat
     * fram ett namnbyte på lagret för att blidka provet.
     */
    const klasser = String(container.firstChild.className).split(/\s+/);
    expect(klasser).toContain("fixed");
    expect(klasser).not.toContain("sticky");
  });

  it("har inget kryss utan onDismiss, och ett med", () => {
    // ⛔ Krysset är valfritt med flit. En bubbla som appen själv tar bort när
    // villkoret upphör behöver inget, och ett kryss som inte gör något är värre
    // än inget kryss.
    const { rerender } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);

    rerender(<OpsFloatingSummary label="Netto" value="+1 kr" onDismiss={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("stänger utan att fälla ihop när man trycker på krysset", () => {
    /*
     * ⛔ TVÅ SYSKONKNAPPAR OCH INTE EN KNAPP I EN KNAPP. En knapp inuti en knapp
     * är ogiltig HTML, och trycket hade bubblat upp: ett försök att STÄNGA hade
     * i stället FÄLLT IHOP, och bubblan blivit kvar. Provet håller isär dem.
     */
    let stangd = 0;
    render(<OpsFloatingSummary label="Netto" value="+1 kr" onDismiss={() => { stangd += 1; }} />);

    fireEvent.click(screen.getByRole("button", { name: /Dölj/ }));
    expect(stangd).toBe(1);
    expect(screen.getByRole("button", { name: /Fäll ihop/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("ligger på innehållets lager och inte på appskalets", () => {
    // ⛔ Tar bubblan `--z-chrome` lägger den sig över headern och bottenraden,
    // alltså om exakt det fel ops-framework#47 rättade.
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(container.firstChild.className).toContain("z-(--z-sticky)");
    expect(container.firstChild.className).not.toContain("z-(--z-chrome)");
  });
});
