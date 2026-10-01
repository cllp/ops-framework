import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpsKatalogInstallning } from "../components/OpsKatalogInstallning.jsx";
import { validateKatalog } from "../lib/katalog.js";

/**
 * Inställningsvyn (#112).
 *
 * ⛔ DE TVÅ VIKTIGASTE RADERNA HÄR ÄR DE SOM HANDLAR OM VAD VYN INTE GÖR: den
 * raderar aldrig, och den låter inte en medlem spara. Ett prov som bara
 * kontrollerar att en kategori går att lägga till är grönt även när båda de
 * egenskaperna gått förlorade.
 */

const IKONER = ["check", "bell"];
const TEXTNYCKLAR = [{ nyckel: "lofte", etikett: { sv: "Löfte", en: "Promise" }, hjalp: "Vad som får raden att försvinna." }];
const KATEGORIER = validateKatalog(
  [
    {
      id: "uppgift",
      namn: { sv: "Uppgifter", en: "Tasks" },
      farg: 1,
      ikon: "check",
      fas: "aktiv",
      ordning: 0,
      texter: { lofte: { sv: "Försvinner när den är gjord.", en: "Gone when done." } },
    },
    { id: "gammal", namn: { sv: "Gammal sort" }, farg: 2, ikon: "bell", fas: "klar", ordning: 1, arkiverad: true, texter: { lofte: "Står kvar." } },
  ],
  { ikoner: IKONER, textnycklar: ["lofte"], grupp: false },
);

const rita = (props = {}) =>
  render(
    <OpsKatalogInstallning
      kategorier={KATEGORIER}
      ikoner={IKONER}
      kanAndra
      onSpara={() => {}}
      onArkivera={() => {}}
      groupId="cps-ab"
      {...props}
    />,
  );

describe("inställningsvyn", () => {
  it("visar kategorierna, och de arkiverade för sig", () => {
    rita();
    expect(screen.getByText("Uppgifter")).toBeInTheDocument();
    // ⛔ Den arkiverade syns fortfarande. Den är inte borta, den går bara inte
    // att välja för nya poster, och en vy som dolde den gjorde "ta fram igen"
    // omöjligt.
    expect(screen.getByText("Gammal sort")).toBeInTheDocument();
    expect(screen.getByText("Arkiverad")).toBeInTheDocument();
  });

  it("⛔ har ingen knapp som raderar, bara arkivera och ta fram", () => {
    /*
     * En raderad kategori lämnar varje rad som pekar på den utan kategori. De
     * raderna blir omöjliga att filtrera och räkna, och felet upptäcks långt
     * efter att någon tryckt på knappen.
     */
    rita();
    expect(screen.queryByRole("button", { name: /radera/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /ta bort/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Arkivera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ta fram" })).toBeInTheDocument();
  });

  it("⛔ Ändra och Arkivera/Ta fram bär en ikon, inte bara ordet (#164)", () => {
    // Mätt mot SessionStudio: ikon plus ord, aldrig ordet ensamt på en knapp
    // som utför en handling i en lista. Utan svg:n i knappen skulle den här
    // rutan vara röd, oavsett vad namnet på knappen säger.
    rita();
    expect(screen.getAllByRole("button", { name: "Ändra" })[0].querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arkivera" }).querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ta fram" }).querySelector("svg")).toBeInTheDocument();
  });

  it("arkiverar med ett anrop utåt, och vyn skriver inte själv", () => {
    const onArkivera = vi.fn();
    rita({ onArkivera });
    fireEvent.click(screen.getByRole("button", { name: "Arkivera" }));
    expect(onArkivera).toHaveBeenCalledWith(expect.objectContaining({ id: "uppgift" }), true);
  });

  it("tar fram en arkiverad igen, alltså är arkiveringen ångrbar", () => {
    const onArkivera = vi.fn();
    rita({ onArkivera });
    fireEvent.click(screen.getByRole("button", { name: "Ta fram" }));
    expect(onArkivera).toHaveBeenCalledWith(expect.objectContaining({ id: "gammal" }), false);
  });

  it("⛔ en medlem som inte är ägare ser vyn men kan inte ändra, med skälet utskrivet", () => {
    rita({ kanAndra: false });
    expect(screen.getByText("Du kan läsa katalogen, inte ändra den")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lägg till kategori" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Arkivera" })).toBeNull();
    // ⛔ Och vyn säger att den inte är låset. Den som tror att en dold knapp är
    // ett skydd bygger nästa funktion på samma antagande.
    expect(screen.getByText(/regler, inte i den här vyn/)).toBeInTheDocument();
  });

  it("lägger till en kategori och skickar den byggd utåt", () => {
    const onSpara = vi.fn();
    rita({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));

    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.change(screen.getByLabelText(/Namn på engelska/), { target: { value: "Travel" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    // ⛔ Ikonen är den första tillåtna utan att någon rört väljaren: en ny
    // kategori börjar giltig, i stället för att vägras när allt annat fyllts i.
    expect(onSpara.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: "resa", namn: { sv: "Resor", en: "Travel" }, ikon: IKONER[0], fas: "aktiv" }),
    );
  });

  it("⛔ ett ogiltigt värde sparas inte, och skälet från valideringen visas som det är", () => {
    /*
     * Samma validering som vid uppstart, inte en egen i formuläret. En andra
     * uppsättning regler glider isär från den som faktiskt gäller, och då går
     * det att spara något som sedan vägrar läsas in.
     */
    const onSpara = vi.fn();
    rita({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "Min.Kategori" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Fel nyckel" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).not.toHaveBeenCalled();
    expect(screen.getByText(/små bokstäver/)).toBeInTheDocument();
  });

  it("⛔ nyckeln går inte att ändra på en befintlig kategori", () => {
    // Varje rad i databasen pekar på den. Gick den att ändra skulle kopplingen
    // till allt som redan skrivits försvinna, tyst.
    rita();
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByLabelText(/Nyckel/)).toBeDisabled();
  });

  it("säger i formuläret att en omdöpning behåller kopplingen", () => {
    // Utan den meningen vågar ingen döpa om något, och då är hela vyn en
    // knapp folk är rädda för.
    rita();
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByText(/behåller kopplingen/)).toBeInTheDocument();
  });

  it("⛔ färgen väljs som PLATS och inte som färgkod", () => {
    rita();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));

    // Väljaren visar en plats, inte en färgkod.
    expect(screen.getByLabelText(/^Färg/)).toHaveTextContent("Plats 1");
    // ⛔ Och det finns ingen ruta att skriva en hex i. En färgkod i
    // konfigurationen följer inte med när temat byter, så formuläret får inte
    // ens erbjuda det.
    expect(screen.queryByRole("textbox", { name: /Färg/ })).toBeNull();
    expect(screen.getByText(/mätta mot kontrastgolvet/)).toBeInTheDocument();
  });

  it("⛔ ikonen väljs ur tillåtelselistan och går inte att skriva fritt", () => {
    rita();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));

    expect(screen.getByLabelText(/^Ikon/)).toHaveTextContent(IKONER[0]);
    expect(screen.queryByRole("textbox", { name: /Ikon/ })).toBeNull();
  });

  it("⛔ vägrar monteras utan tillåtelselista, i stället för att tillåta vad som helst", () => {
    // Utan lista går det att spara en ikon som inte finns, och den blir en tom
    // ruta i varje vy.
    expect(() => render(<OpsKatalogInstallning kategorier={[]} ikoner={[]} groupId="cps-ab" onSpara={() => {}} onArkivera={() => {}} />)).toThrow(/ikoner krävs/);
  });

  it("⛔ visar ändringsloggen i samma vy, inte i en egen", () => {
    /*
     * En logg man måste leta upp läses aldrig. Den här ska läsas i samma
     * ögonblick man undrar varför en kategori ser annorlunda ut än i går.
     */
    rita({
      logg: [
        {
          handelse: "andrad",
          id: "uppgift",
          fore: { id: "uppgift", namn: { sv: "Uppgifter" } },
          efter: { id: "uppgift", namn: { sv: "Ärenden" } },
          nar: "2026-09-26T08:00:00.000Z",
          av: { uid: "u1", namn: "Claes-Philip" },
        },
      ],
    });
    expect(screen.getByText("Uppgifter döptes om till Ärenden")).toBeInTheDocument();
    expect(screen.getByText("Claes-Philip")).toBeInTheDocument();
  });

  it("utan logg ritas ingen tom rubrik", () => {
    // Tomhet är ett svar, men en rubrik utan innehåll är inte det svaret: den
    // ser ut som något som inte laddat klart.
    rita();
    expect(screen.queryByText("Senaste ändringarna")).toBeNull();
  });

  it("visar namnet på valt språk", () => {
    rita({ sprak: "en" });
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    // Den utan engelskt namn faller tillbaka på svenskan i stället för att bli tom.
    expect(screen.getByText("Gammal sort")).toBeInTheDocument();
  });
});

describe("texterna i inställningsvyn", () => {
  const medTexter = (props = {}) => rita({ textnycklar: TEXTNYCKLAR, ...props });

  it("⛔ en redigering RADERAR INTE kategorins texter", () => {
    /*
     * Vyn byggde förut en ny kategori av formulärets fält och bara dem. Att
     * spara efter en omdöpning hade därför tömt hjälptexterna, alltså samma
     * tysta förlust som byggKategori nyss slutade göra, men utlöst av en knapp
     * och därmed värre: den som tryckte trodde att hen bytte ett namn.
     */
    const onSpara = vi.fn();
    medTexter({ onSpara });
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Ärenden" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(onSpara.mock.calls[0][0].namn.sv).toBe("Ärenden");
    expect(onSpara.mock.calls[0][0].texter).toEqual({ lofte: { sv: "Försvinner när den är gjord.", en: "Gone when done." } });
  });

  it("ritar ett fält per språk för varje deklarerad text, med etiketten appen gav", () => {
    medTexter();
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByLabelText(/^Löfte, svenska/)).toHaveValue("Försvinner när den är gjord.");
    expect(screen.getByLabelText(/^Löfte, engelska/)).toHaveValue("Gone when done.");
  });

  it("⛔ en text kategorin bär utan att den är deklarerad ritas också", () => {
    // En text som bärs vidare utan att synas är ett läge där vyn ljuger med
    // utelämnande: den som tittar tror att kategorin har de fält som står där.
    medTexter({ textnycklar: [] });
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByLabelText(/^lofte, svenska/)).toHaveValue("Försvinner när den är gjord.");
  });

  it("⛔ en ny kategori går inte att spara utan de texter katalogen kräver", () => {
    /*
     * Det är hela skälet till att kravet finns. Utan det föds en kategori som
     * lagts till här utan hjälptexter, och resultatet är ett formulär med tomma
     * fält och inga exempel, alltså sämre än listan det ersatte.
     */
    const onSpara = vi.fn();
    medTexter({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).not.toHaveBeenCalled();
    expect(screen.getByText(/lofte/)).toBeInTheDocument();
  });

  it("med texten ifylld sparas den nya kategorin", () => {
    const onSpara = vi.fn();
    medTexter({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.change(screen.getByLabelText(/^Löfte, svenska/), { target: { value: "Försvinner när resan är redovisad." } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(onSpara.mock.calls[0][0].texter).toEqual({ lofte: { sv: "Försvinner när resan är redovisad." } });
  });

  it("utan deklarerade texter och utan burna ritas ingen tom rubrik", () => {
    // Tomhet är ett svar, men en rubrik utan innehåll ser ut som något som inte
    // laddat klart.
    rita({ kategorier: validateKatalog([{ id: "x", namn: { sv: "X" }, farg: 1, ikon: "check", fas: "ny" }], { ikoner: IKONER, grupp: false }) });
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.queryByText(/Texter, alltså/)).toBeNull();
  });
});

describe("sortkatalogen i inställningsvyn", () => {
  const SORTER = validateKatalog([{ id: "kvitto", namn: { sv: "Kvitto" }, farg: 1, ikon: "check" }], { ikoner: IKONER, faser: false, grupp: false });
  const sortvy = (props = {}) => rita({ kategorier: SORTER, faser: false, ...props });

  it("⛔ ritar ingen fasväljare, eftersom fältet inte finns på kategorin", () => {
    // En rullgardin för något som inte sparas är värre än ingen: den som
    // väljer i den tror att valet betyder något.
    sortvy();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    expect(screen.queryByLabelText(/^Fas/)).toBeNull();
  });

  it("⛔ ritar ingen tom fas-etikett på raden heller", () => {
    // En pill utan text är en ruta som ser ut som något som inte laddat klart.
    sortvy();
    expect(screen.queryByText("aktiv")).toBeNull();
    expect(screen.getByText("Kvitto")).toBeInTheDocument();
  });

  it("sparar en ny kategori utan fas, och valideringen släpper igenom den", () => {
    const onSpara = vi.fn();
    sortvy({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(onSpara.mock.calls[0][0].fas).toBeNull();
  });

  it("en statuskatalog har kvar sin fasväljare", () => {
    // Förvalet är oförändrat, annars hade varje befintlig vy tyst tappat den.
    rita();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    expect(screen.getByLabelText(/^Fas/)).toBeInTheDocument();
  });
});

describe("en katalog utan färger i inställningsvyn", () => {
  const UTAN = validateKatalog([{ id: "kvitto", namn: { sv: "Kvitto" }, ikon: "check" }], { ikoner: IKONER, faser: false, farger: false, grupp: false });
  const vy = (props = {}) => rita({ kategorier: UTAN, faser: false, farger: false, ...props });

  it("⛔ ritar ingen färgväljare och ingen ruta att skriva en hex i", () => {
    vy();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    expect(screen.queryByLabelText(/^Färg/)).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Färg/ })).toBeNull();
  });

  it("⛔ ritar ingen prick, i stället för en grå", () => {
    // `slagPrick` kastar på en plats som inte finns, och en grå prick hade sagt
    // att kategorin har en färg som inte laddat klart.
    //
    // ⛔ `.size-2.rounded-full`, INTE BARA `.rounded-full` (#164, CP-beslut
    // 2026-09-28 18:20): sedan OpsButton fick piller som förval för
    // textknappar bär VARJE knapp i vyn också `.rounded-full`, och den bredare
    // frågan träffade dem i stället för att mäta pricken. `size-2` är
    // prickens EGNA, unika mått (`OpsKatalogInstallning.jsx`), ingen knapp
    // delar det.
    const { container } = vy();
    expect(container.querySelectorAll(".size-2.rounded-full")).toHaveLength(0);
    expect(screen.getByText("Kvitto")).toBeInTheDocument();
  });

  it("sparar utan färg, och valideringen släpper igenom den", () => {
    const onSpara = vi.fn();
    vy({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(onSpara.mock.calls[0][0].farg).toBeNull();
  });

  it("en katalog med färger har kvar sin väljare och sin prick", () => {
    rita();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    expect(screen.getByLabelText(/^Färg/)).toBeInTheDocument();
  });
});

describe("⛔ groupId (#162, krävs sedan 0.33.0): vyn skriver i den aktiva gruppens katalog", () => {
  it("⛔ vägrar monteras utan groupId, i stället för att spara kategorier utan grupp", () => {
    // Före 0.33.0 byggdes en kategori utan grupp när propen saknades, alltså en rad som
    // delas av varje grupp i samlingen. Röd mot 0.32.1: där monterades vyn utan klagan.
    expect(() => render(<OpsKatalogInstallning kategorier={KATEGORIER} ikoner={IKONER} onSpara={() => {}} onArkivera={() => {}} />)).toThrow(/groupId krävs/);
    expect(() => render(<OpsKatalogInstallning kategorier={KATEGORIER} ikoner={IKONER} groupId="  " onSpara={() => {}} onArkivera={() => {}} />)).toThrow(/groupId krävs/);
  });

  it("en ny kategori bär den aktiva gruppens groupId", () => {
    const onSpara = vi.fn();
    rita({ onSpara, groupId: "cps-ab" });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(onSpara.mock.calls[0][0].groupId).toBe("cps-ab");
  });

  it("en ÄNDRAD kategori bär den också, inte bara en nyskapad", () => {
    const onSpara = vi.fn();
    rita({ onSpara, groupId: "cps-ab" });
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(onSpara.mock.calls[0][0].groupId).toBe("cps-ab");
  });

  it("⛔ ett öppet utkast stängs när gruppen byts, och kan inte sparas in i den nya gruppen", () => {
    /*
     * Röd mot 0.32.1: där låg `redigerar` och `utkast` kvar över bytet, formuläret visade grupp A:s
     * "Uppgifter" under grupp B:s lista, och Spara gav onSpara en kopia av A:s kategori med groupId B.
     */
    const onSpara = vi.fn();
    const MIRANDA = validateKatalog([{ id: "turne", namn: { sv: "Turné" }, farg: 2, ikon: "bell", fas: "aktiv" }], { ikoner: IKONER, grupp: false });
    const vy = (/** @type {string} */ groupId, /** @type {any} */ kategorier) => (
      <OpsKatalogInstallning kategorier={kategorier} ikoner={IKONER} kanAndra textnycklar={TEXTNYCKLAR} onSpara={onSpara} onArkivera={() => {}} groupId={groupId} />
    );
    const { rerender } = render(vy("cps-ab", KATEGORIER));
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByLabelText(/Namn på svenska/)).toHaveValue("Uppgifter");

    rerender(vy("miranda-ab", MIRANDA));
    expect(screen.getByText("Turné")).toBeInTheDocument();
    expect(screen.queryByText("Uppgifter")).toBeNull();
    expect(screen.queryByLabelText(/Namn på svenska/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(onSpara).not.toHaveBeenCalled();
  });
});

describe("⛔ rubriken syns (0.44.0, bolag-ops#507)", () => {
  it("katalogen har en synlig rubrik på nivå 2, och sektionen bär den som namn", () => {
    rita({ rubrik: "Händelsetyper" });
    expect(screen.getByRole("heading", { level: 2, name: "Händelsetyper" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Händelsetyper" })).toBeTruthy();
  });

  it("två kataloger på samma sida har var sin rubrik", () => {
    render(
      <>
        <OpsKatalogInstallning kategorier={KATEGORIER} ikoner={IKONER} kanAndra onSpara={() => {}} onArkivera={() => {}} groupId="cps-ab" rubrik="Händelsetyper" />
        <OpsKatalogInstallning kategorier={KATEGORIER} ikoner={IKONER} kanAndra onSpara={() => {}} onArkivera={() => {}} groupId="cps-ab" rubrik="Inkorgens sorter" />
      </>,
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Händelsetyper", "Inkorgens sorter"]);
  });
});
