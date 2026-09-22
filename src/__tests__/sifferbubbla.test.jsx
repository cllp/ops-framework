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
 * (`bg-contrast-panel`, `ops-contrast-panel`, `border-line`, `text-ink`,
 * `text-success`, `text-danger`, `shadow-lg`). Panelen inverterar mot sidan;
 * bläck/accent remapdas i `.ops-contrast-panel` så tokens byter med temat. Ramverkets
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

  it("visar nuläget överst och det simulerade under, i en enda storlek", () => {
    /*
     * ⛔ CP 2026-09-20: "det större lägen i bubblan får inte allt plats. Bättre
     * att ha en storlek, den lilla. Och sedan ha två rader med nuvarande i
     * mindre text överst och den justerade i stort grönt under."
     *
     * Ordningen i DOM:en ÄR kravet, inte en detalj: nuläget är referensen man
     * jämför mot och ska läsas först, både av ögat och av den som lyssnar.
     */
    const { container } = render(
      <OpsFloatingSummary label="Månadskassaflöde" value="+23 256 kr/mån" hint="Nuläget 25 600 kr/mån" tone="success" />,
    );

    const nulaget = screen.getByText("Nuläget 25 600 kr/mån");
    const talet = screen.getByText("+23 256 kr/mån");
    expect(nulaget.compareDocumentPosition(talet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Litet överst, stort och tonat under.
    expect(String(nulaget.className).split(/\s+/)).toContain("text-sm");
    const talklasser = String(talet.className).split(/\s+/);
    expect(talklasser).toContain("text-lg");
    expect(talklasser).toContain("font-bold");
    expect(talklasser).toContain("text-success");

    // ⛔ Och ingen växling finns kvar. Utan kryss har bubblan noll knappar.
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("målar inte namnet men tappar det aldrig för den som lyssnar", () => {
    /*
     * ⛔ Tre rader ryms inte i "den lilla", och kortet ovanför säger redan vad
     * talet är. Den som inte ser skärmen har inget kort att luta sig mot, så
     * namnet står kvar som skärmläsartext. Utan det är bubblan två nakna tal.
     */
    render(<OpsFloatingSummary label="Månadskassaflöde" value="+1 kr" />);
    const name = screen.getByText("Månadskassaflöde");
    expect(String(name.className).split(/\s+/)).toContain("sr-only");
  });

  it("har samma bredd oavsett innehåll", () => {
    // ⛔ En storlek betyder en bredd. Byter talet antal siffror ska rutan stå
    // still, det var hela fixen på att den svajade under blicken.
    const bubbla = () => document.querySelector(".pointer-events-auto");

    const { unmount } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const smal = String(bubbla().className);
    unmount();

    render(<OpsFloatingSummary label="Netto" value="+1 234 567 kr/mån" hint="Nuläget 9 876 543 kr/mån" />);
    expect(String(bubbla().className)).toBe(smal);
    expect(smal.split(/\s+/)).toContain("max-w-xs");
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

  it("står still när talet byter bredd", () => {
    /*
     * ⛔ CP: "Den svajar lite med siffrornas bredd."
     *
     * Utan fast bredd växer bubblan när talet blir en siffra bredare, och rutan
     * man läser rör sig under blicken. Full bredd upp till taket gör behållaren
     * orörlig; talet byter bredd inuti den.
     *
     * ⛔ Provet mätte förut skillnaden mellan utfällt och ihopfällt. Lägena är
     * borta, så det mäter nu det som faktiskt bar värdet: att bredden är fast.
     */
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const klasser = String(container.firstChild.firstChild.className).split(/\s+/);
    expect(klasser).toContain("w-full");
    expect(klasser).toContain("max-w-xs");
  });

  it("låter nuläget kortas av men aldrig talet", () => {
    /*
     * ⛔ EN HINT SOM BLEV TVÅ RADER VAR HALVA FELET I CP:S BILD. Bubblan blev
     * högre, sköt upp över sitt utrymme och la sig i vägen. Det som ska ge vika
     * när det blir trångt är nuläget, aldrig siffran: siffran är hela skälet
     * till att bubblan finns.
     *
     * ⛔ Namnet står inte längre i provet, för det målas inte längre. Det är
     * `sr-only` och har ingen bredd att ge vika med.
     */
    render(<OpsFloatingSummary label="Månadskassaflöde" value="+23 176 kr/mån" hint="Nuläget 23 256 kr/mån" />);

    expect(String(screen.getByText("Nuläget 23 256 kr/mån").className).split(/\s+/)).toContain("truncate");

    const talet = String(screen.getByText("+23 176 kr/mån").className).split(/\s+/);
    expect(talet).toContain("whitespace-nowrap");
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
    //
    // ⛔ Noll knappar utan det, inte en: växlingen är borta, så krysset är den
    // enda knapp bubblan kan ha.
    const { container, rerender } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(container.querySelectorAll("button")).toHaveLength(0);

    rerender(<OpsFloatingSummary label="Netto" value="+1 kr" onDismiss={() => {}} />);
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("krysset bär namnet, så den som lyssnar vet vad som döljs", () => {
    /*
     * ⛔ Provet hette förut "stänger utan att fälla ihop" och höll isär två
     * syskonknappar. Det finns bara en knapp kvar, men kravet på den lever: utan
     * `label` i sitt namn är krysset "Dölj" i en lista med andra kryss, och då
     * vet den som lyssnar inte vad som försvinner.
     */
    let stangd = 0;
    render(<OpsFloatingSummary label="Månadskassaflöde" value="+1 kr" onDismiss={() => { stangd += 1; }} />);

    const kryss = screen.getByRole("button", { name: /Dölj/ });
    expect(kryss.getAttribute("aria-label")).toContain("Månadskassaflöde");
    fireEvent.click(kryss);
    expect(stangd).toBe(1);
  });

  it("ligger på innehållets lager och inte på appskalets", () => {
    // ⛔ Tar bubblan `--z-chrome` lägger den sig över headern och bottenraden,
    // alltså om exakt det fel ops-framework#47 rättade.
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    expect(container.firstChild.className).toContain("z-(--z-sticky)");
    expect(container.firstChild.className).not.toContain("z-(--z-chrome)");
  });

  it("är centrerad horisontellt, inte högerställd", () => {
    /*
     * ⛔ ops-framework#54: `justify-end` sköt bubblan långt ner i högra hörnet.
     * CP ville ha den ungefär mitt i viewport, fortfarande ovanför botten-nav.
     */
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const klasser = String(container.firstChild.className).split(/\s+/);
    expect(klasser).toContain("justify-center");
    expect(klasser).not.toContain("justify-end");
  });

  it("har tydligt rundade hörn via en token som faktiskt finns", () => {
    /*
     * ⛔ ops-framework#54: `rounded-2xl` emitterade ingen border-radius eftersom
     * `--radius-*: initial` nollat Tailwinds egna steg och skalan saknade 2xl.
     * Bubblan såg ut som en fyrkant. `rounded-3xl` (24px) finns i tokens och
     * läses som bubbla utan att äta tvåradslayouten som `rounded-full` skulle.
     */
    const { container } = render(<OpsFloatingSummary label="Netto" value="+1 kr" />);
    const klasser = String(container.firstChild.firstChild.className).split(/\s+/);
    expect(klasser).toContain("rounded-3xl");
    expect(klasser).not.toContain("rounded-2xl");
    expect(klasser).not.toContain("rounded-full");
  });
});
