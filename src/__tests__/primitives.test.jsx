import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpsButton } from "../components/OpsButton.jsx";
import { OpsField, OpsInput } from "../components/OpsField.jsx";
import { OpsList, OpsListRow } from "../components/OpsList.jsx";
import { OpsModal } from "../components/OpsModal.jsx";
import { OpsIdentity } from "../components/OpsIdentity.jsx";
import { OpsPill } from "../components/OpsPill.jsx";
import { OpsCard } from "../components/OpsCard.jsx";
import { OpsSegmented } from "../components/OpsSegmented.jsx";
import { identityTone, initials } from "../lib/identity.js";

/**
 * React loggar varje kastad render till console.error, även den vi väntar oss.
 * Utan den här hjälparen dränks testutskriften i stackspår från tester som gick
 * bra, och en oläslig utskrift är precis hur ett riktigt fel slinker igenom.
 * @param {() => void} kor @param {RegExp} message
 */
function forvantaKrasch(kor, message) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(message);
  } finally {
    tyst.mockRestore();
  }
}

/**
 * ⛔ De här testerna kontrollerar BETEENDE, inte klassnamn.
 *
 * Ett test som påstår att knappen har klassen "bg-accent" går sönder varje gång
 * någon byter en utility och säger ingenting om huruvida knappen fungerar. Det
 * ser ut som täckning och är underhållskostnad. Att utseendet faktiskt blir CSS
 * är byggvaktens jobb (`scripts/check-css-build.mjs`), inte enhetstesternas.
 */

describe("OpsButton", () => {
  it("renderar en riktig knapp och anropar onClick", async () => {
    const onClick = vi.fn();
    render(<OpsButton onClick={onClick}>Spara</OpsButton>);
    const button = screen.getByRole("button", { name: "Spara" });
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renderar en länk när href anges", () => {
    render(<OpsButton href="/rapporter">Rapporter</OpsButton>);
    expect(screen.getByRole("link", { name: "Rapporter" })).toHaveAttribute("href", "/rapporter");
  });

  // ⛔ En spärrad länk måste tappa sitt href. pointer-events stoppar musen men
  // inte tangentbordet, och länken ligger kvar i tabordningen.
  it("spärrad länk har inget href och annonseras som spärrad", () => {
    render(
      <OpsButton href="/rapporter" disabled>
        Rapporter
      </OpsButton>,
    );
    const lank = screen.getByText("Rapporter");
    expect(lank).not.toHaveAttribute("href");
    expect(lank).toHaveAttribute("aria-disabled", "true");
  });

  it("vägrar en ikonknapp utan namn", () => {
    forvantaKrasch(() => render(<OpsButton iconOnly>x</OpsButton>), /ariaLabel/);
  });

  it("rund ikonknapp blir cirkel i header-skala, inte 44 px fylld skiva", () => {
    render(
      <OpsButton variant="primary" iconOnly round ariaLabel="Nytt ärende">
        +
      </OpsButton>,
    );
    const button = screen.getByRole("button", { name: "Nytt ärende" });
    expect(button.className).toMatch(/rounded-full/);
    expect(button.className).toMatch(/\bsize-8\b/);
    expect(button.className).not.toMatch(/rounded-md/);
    expect(button.className).not.toMatch(/min-w-11/);
  });

  it("vägrar round utan iconOnly", () => {
    forvantaKrasch(() => render(<OpsButton round>x</OpsButton>), /round kräver iconOnly/);
  });

  it("vägrar en okänd variant i stället för att rendera något godtyckligt", () => {
    forvantaKrasch(() => render(<OpsButton variant="fancy">x</OpsButton>), /okänd variant/);
  });
});

describe("OpsField", () => {
  it("kopplar etikett, fält, hjälptext och fel till varandra", () => {
    render(
      <OpsField label="E-post" hint="Jobbadressen" error="Ogiltig adress">
        <OpsInput value="" onChange={() => {}} />
      </OpsField>,
    );
    const falt = screen.getByLabelText("E-post");
    expect(falt).toHaveAttribute("aria-invalid", "true");

    // Både hjälptext och fel ska nås av skärmläsaren, inte bara det ena.
    const beskrivs = falt.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(beskrivs).toHaveLength(2);
    const texter = beskrivs.map((id) => document.getElementById(id)?.textContent);
    expect(texter).toContain("Jobbadressen");
    expect(texter).toContain("Ogiltig adress");
  });

  it("annonserar felet när det dyker upp", () => {
    render(
      <OpsField label="E-post" error="Ogiltig adress">
        <OpsInput value="" onChange={() => {}} />
      </OpsField>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Ogiltig adress");
  });

  it("vägrar webbläsarens egen datumväljare", () => {
    forvantaKrasch(
      () =>
        render(
          <OpsField label="Datum">
            <OpsInput type="date" />
          </OpsField>,
        ),
      /inte tillåten/,
    );
  });
});

describe("OpsListRow", () => {
  it("gör den klickbara ytan till en riktig knapp", () => {
    const onClick = vi.fn();
    render(
      <OpsList>
        <OpsListRow interactive onClick={onClick}>
          Ärende 12
        </OpsListRow>
      </OpsList>,
    );
    screen.getByRole("button", { name: "Ärende 12" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("vägrar en rad som ser klickbar ut men inte är det", () => {
    forvantaKrasch(
      () =>
        render(
          <OpsList>
            <OpsListRow interactive>Ärende 12</OpsListRow>
          </OpsList>,
        ),
      /kräver href eller onClick/,
    );
  });
});

describe("OpsModal", () => {
  it("annonserar sin titel för skärmläsare", () => {
    render(
      <OpsModal open onOpenChange={() => {}} title="Ta bort rapport">
        <p>Detta går inte att ångra.</p>
      </OpsModal>,
    );
    expect(screen.getByRole("dialog", { name: "Ta bort rapport" })).toBeInTheDocument();
  });

  it("vägrar en modal utan titel", () => {
    forvantaKrasch(() => render(<OpsModal open onOpenChange={() => {}}>x</OpsModal>), /title krävs/);
  });
});

describe("OpsIdentity", () => {
  it("bär namnet som text, inte bara som färg", () => {
    render(<OpsIdentity name="Nordiska Kammarkören" seed="grp_9912" />);
    expect(screen.getByRole("img", { name: "Nordiska Kammarkören" })).toBeInTheDocument();
  });

  it("kräver ett stabilt id, inte namnet", () => {
    forvantaKrasch(() => render(<OpsIdentity name="Utan id" seed="" />), /seed krävs/);
  });

  // ══ #164, korrigering C: standardikon och uttryckligt vald ton ══════════
  it("⛔ ritar en egen ikon i stället för initialer när `icon` skickas in", () => {
    const Ikon = () => <svg data-testid="egen-ikon" />;
    render(<OpsIdentity name="Claes Philip" seed="uid-1" icon={Ikon} />);
    expect(screen.getByTestId("egen-ikon")).toBeInTheDocument();
    expect(screen.queryByText("CP")).toBeNull();
  });

  it("⛔ `tone` åsidosätter den ur `seed` härledda tonen", () => {
    const seed = "grp_9912";
    const harleddTon = identityTone(seed);
    // ⛔ EN TON SOM SKILJER SIG FRÅN DEN HÄRLEDDA, RÄKNAT FRÅN DEN, INTE
    // HÅRDKODAD. Ett hårdkodat "1" hade kunnat råka VARA den härledda tonen
    // för just detta seed, och då hade provet varit grönt utan att mäta
    // något (arbetsreglernas punkt 4: tautologisk lista).
    const annanTon = /** @type {1|2|3|4|5|6} */ (((harleddTon % 6) + 1));

    const { container: standard } = render(<OpsIdentity name="X" seed={seed} />);
    const harleddKlass = /** @type {HTMLElement} */ (standard.firstChild).className;

    const { container: overridad } = render(<OpsIdentity name="X" seed={seed} tone={annanTon} />);
    const overridadKlass = /** @type {HTMLElement} */ (overridad.firstChild).className;

    expect(harleddKlass).not.toBe(overridadKlass);
    expect(overridadKlass).toContain(`bg-identity-${annanTon}`);
  });

  it("bilden ritas FÖRE ikonen: `imageUrl` vinner även när `icon` skickas in", () => {
    render(<OpsIdentity name="X" seed="uid-1" imageUrl="https://x/y.png" icon={() => <svg data-testid="egen-ikon" />} />);
    expect(screen.queryByTestId("egen-ikon")).toBeNull();
    expect(screen.getByRole("img", { name: "X" }).querySelector("img")).toBeTruthy();
  });
});

describe("identitetslogik", () => {
  it("ger samma ton för samma id varje gång", () => {
    const a = identityTone("grp_9912");
    expect(identityTone("grp_9912")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(6);
  });

  it("sprider tonerna över hela skalan i stället för att fastna på en", () => {
    const sedda = new Set(Array.from({ length: 200 }, (_, i) => identityTone(`grp_${i}`)));
    expect(sedda.size).toBe(6);
  });

  // ⛔ `name[0]` klipper mitt i tecken utanför BMP och ger en trasig ruta.
  it("klipper inte mitt i ett tecken", () => {
    expect(initials("Åsa Öberg")).toBe("ÅÖ");
    expect(initials("🎻 Stråkar")).toBe("🎻S");
    expect(initials("   ")).toBe("?");
  });
});

describe("OpsPill", () => {
  it("bär betydelsen i text, inte bara i färg", () => {
    render(<OpsPill tone="danger">Försenad</OpsPill>);
    expect(screen.getByText("Försenad")).toBeInTheDocument();
  });
});

describe("OpsCard", () => {
  it("ritar ingen kant utan edge", () => {
    const { container } = render(<OpsCard>innehåll</OpsCard>);
    expect(container.firstElementChild?.className).not.toContain("border-l-4");
  });

  it("ritar en kant ur identitetspaletten", () => {
    const { container } = render(
      <OpsCard edge={2} edgeLabel="Privat">
        innehåll
      </OpsCard>,
    );
    expect(container.firstElementChild?.className).toContain("border-l-identity-2");
  });

  /**
   * ⛔ Samma regel som för identitet och proveniens: färgen ensam får inte bära
   * betydelsen. En kant i en färg säger ingenting till den som inte lärt sig
   * koden, går inte att läsa upp, och är osynlig för var tjugonde man.
   */
  it("kastar när en kant saknar ord", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsCard edge={2}>x</OpsCard>)).toThrow(/edgeLabel/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("vägrar en rundning som inte finns i stället för att rita panelens hörn", () => {
    /*
     * ⛔ EN TYST RESERV GÖR ETT STAVFEL TILL ETT KORT SOM SER NÄSTAN RÄTT UT.
     * `rounding="bubla"` hade fått panelens 8 px, och den som skrev det hade
     * trott att bubblan inte gick att få. Samma skäl som `tone` och `edge`
     * redan kastar av.
     */
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      /* @ts-expect-error avsiktligt fel värde */
      expect(() => render(<OpsCard rounding="bubla">x</OpsCard>)).toThrow(/okänd rounding/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("ger panelen SessionStudios kortradie och bubblan sin egen", () => {
    /*
     * ⛔ BÅDA HALVORNA, för bara med dem är det ett prov. Att bubblan är rund
     * går att uppfylla genom att göra ALLT runt, och då är skillnaden borta.
     *
     * ops-framework#164 flyttade rundningsskalan mot SessionStudios
     * `.rounded-app`. `kort` är sedan dess `--radius-card` (24px) uttryckligt,
     * inte `rounded-lg` (som numera är 16px, ett annat SessionStudio-mått).
     * `bubbla` är `rounded-3xl`, 28px, SessionStudios `--radius-bubble`.
     */
    const { container: panel } = render(<OpsCard>x</OpsCard>);
    expect(panel.firstElementChild?.className).toMatch(/rounded-\[var\(--radius-card\)\]/);

    const { container: bubbla } = render(<OpsCard rounding="bubbla">x</OpsCard>);
    expect(bubbla.firstElementChild?.className).toMatch(/rounded-3xl/);
  });

  it("annonserar vad kanten betyder", () => {
    render(
      <OpsCard edge={1} edgeLabel="Företag">
        innehåll
      </OpsCard>,
    );
    expect(screen.getByText("Företag")).toBeInTheDocument();
  });

  it("kastar på okänd edge i stället för att rendera en färglös kant", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsCard edge={9} edgeLabel="X">x</OpsCard>)).toThrow(/okänd edge/);
    } finally {
      tyst.mockRestore();
    }
  });
});

describe("OpsSegmented", () => {
  it("markerar det valda läget och byter på klick", () => {
    const chosen = [];
    render(
      <OpsSegmented
        ariaLabel="Vad som visas"
        value="idag"
        onChange={(v) => chosen.push(v)}
        options={[
          { value: "idag", label: "Idag", badge: 2 },
          { value: "kommande", label: "Kommande", badge: 4 },
        ]}
      />,
    );
    const today = screen.getByRole("tab", { name: /Idag/ });
    expect(today).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Kommande/ })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByRole("tab", { name: /Kommande/ }));
    expect(chosen).toEqual(["kommande"]);
  });

  it("kastar vid fler än tre lägen", () => {
    // ⛔ Vakten finns för att fyra segment ger ord som är för korta för att
    // betyda något. Är den inte brytbar är den en kommentar, inte en regel.
    const fyra = ["a", "b", "c", "d"].map((v) => ({ value: v, label: v.toUpperCase() }));
    expect(() => render(<OpsSegmented ariaLabel="x" value="a" onChange={() => {}} options={fyra} />)).toThrow(/två eller tre lägen/);
  });

  it("ritar ikonen i stället för ordet, men behåller ordet för den som lyssnar", () => {
    /*
     * ⛔ CP 2026-09-22, med bild: "Låt lista och kalender vara två ikoner som man
     * togglar, så det blir en dublett på idag/kommande."
     *
     * Två breda pillerspår under varandra läses som samma kontroll två gånger,
     * och det nedre åt så mycket bredd att rubriken bredvid kapades.
     *
     * ⛔ ORDET FÖRSVINNER INTE, det blir skärmläsartext. En ikon utan namn är en
     * knapp som inte går att höra, och två sådana bredvid varandra är ett val man
     * inte kan göra. Provet frågar därför efter det TILLGÄNGLIGA NAMNET och inte
     * efter synlig text: det är den halvan som går att tappa utan att någon ser
     * det på skärmen.
     */
    render(
      <OpsSegmented
        ariaLabel="Lista eller kalender"
        value="lista"
        onChange={() => {}}
        options={[
          { value: "lista", label: "Lista", icon: <svg data-testid="ikon-lista" /> },
          { value: "kalender", label: "Kalender", icon: <svg data-testid="ikon-kalender" /> },
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Kalender" })).toBeInTheDocument();
    expect(screen.getByTestId("ikon-lista")).toBeInTheDocument();
    // ⛔ Och ordet står inte som synlig text bredvid ikonen: då vore det ingen
    // ikonväxel, bara samma breda piller med en bild framför.
    expect(screen.getByRole("tab", { name: "Lista" }).textContent).toBe("Lista");
    expect(screen.getByRole("tab", { name: "Lista" }).querySelector(".sr-only")).not.toBeNull();
  });

  it("vägrar en rad där bara vissa lägen har ikon", () => {
    /*
     * ⛔ EN IKON BREDVID ETT ORD SER UT SOM ETT FEL, och läsaren vet inte om
     * ikonen betyder något extra. En tyst nedsläppsväg hade ritat den blandade
     * raden, och ingen hade sett det förrän på en skärmbild.
     */
    expect(() =>
      render(
        <OpsSegmented
          ariaLabel="x"
          value="a"
          onChange={() => {}}
          options={[
            { value: "a", label: "A", icon: <svg /> },
            { value: "b", label: "B" },
          ]}
        />,
      ),
    ).toThrow(/Antingen alla eller inget/);
  });

  it("visar chevron och undermeny på aktivt segment med menu", () => {
    // ⛔ SessionStudio: Idag bär Idag|Tidigare. Chevron bara när fliken är
    // aktiv; klick på inaktivt segment byter utan att öppna menyn.
    const chosen = [];
    const { rerender } = render(
      <OpsSegmented
        ariaLabel="Vad som visas"
        value="idag"
        onChange={(v) => chosen.push(v)}
        options={[
          {
            value: "idag",
            label: "Idag",
            menu: {
              items: [
                { value: "idag", label: "Idag" },
                { value: "tidigare", label: "Tidigare" },
              ],
            },
          },
          { value: "kommande", label: "Kommande" },
        ]}
      />,
    );
    const today = screen.getByRole("tab", { name: /Idag/ });
    expect(today).toHaveAttribute("aria-selected", "true");
    expect(today).toHaveAttribute("aria-haspopup", "menu");
    expect(today).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(today);
    expect(today).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Tidigare/ }));
    expect(chosen).toEqual(["tidigare"]);

    rerender(
      <OpsSegmented
        ariaLabel="Vad som visas"
        value="tidigare"
        onChange={(v) => chosen.push(v)}
        options={[
          {
            value: "idag",
            label: "Idag",
            menu: {
              items: [
                { value: "idag", label: "Idag" },
                { value: "tidigare", label: "Tidigare" },
              ],
            },
          },
          { value: "kommande", label: "Kommande" },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: /Tidigare/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Kommande/ })).toHaveAttribute("aria-selected", "false");
  });
});

/*
 * ══ ⛔ RÄKNAREN, ANTALET I MENYN OCH GRUNDLÄGETS ETIKETT (0.64.0, lifehub.app#59) ══════════════════════════════════════════════
 *
 * CP 2026-10-06, om Idag i LifeHub: Idag visade 9, Kommande 70, Tidigare ingenting. Utan nollan hoppar kontrollen i bredd, antalet
 * ska stå i menyraderna före klicket, och Kommande ska heta Kommande i sitt grundläge. Bredden mäts i en riktig webbläsare
 * (check-skalyta avsnitt 42), eftersom jsdom inte räknar någon CSS.
 */
describe("OpsSegmented, räknaren och menyns antal (0.64.0, lifehub.app#59)", () => {
  const kommande = (value, badge = 70) => (
    <OpsSegmented
      ariaLabel="Vad som visas"
      value={value}
      onChange={() => {}}
      options={[
        { value: "idag", label: "Idag", badge: 0, menu: { items: [{ value: "idag", label: "Idag", badge: 0 }, { value: "avklarat", label: "Avklarat", badge: 3 }] } },
        {
          value: "kommande",
          label: "Kommande",
          badge,
          menu: {
            items: [
              { value: "vecka", label: "Inom 7 dagar", badge: 12 },
              { value: "manad", label: "Inom 30 dagar", badge: 40 },
              { value: "kommande", label: "Allt framåt", badge: 70 },
            ],
          },
        },
      ]}
    />
  );

  it("⛔ ritar räknaren också när den är 0", () => {
    render(kommande("kommande"));
    const idag = screen.getByRole("tab", { name: /^Idag/ });
    expect(idag.textContent).toBe("Idag0");
    expect(screen.getByRole("tab", { name: /^Kommande/ }).textContent).toMatch(/^Kommande70/);
  });

  it("⛔ ritar antalet i varje menyrad, till höger om ordet och före bocken", () => {
    render(kommande("vecka"));
    fireEvent.click(screen.getByRole("tab", { name: /^Inom 7 dagar/ }));
    const rader = screen.getAllByRole("menuitemradio");
    // Golv: menyn ritades, med alla tre rader.
    expect(rader.length).toBe(3);
    expect(rader.map((r) => r.textContent)).toEqual(["Inom 7 dagar12", "Inom 30 dagar40", "Allt framåt70"]);
    // Ordningen inne i den valda raden: ordet, talet, bocken.
    const vald = rader[0];
    const delar = [...vald.children];
    const talet = delar.findIndex((d) => d.textContent === "12");
    expect(talet).toBeGreaterThan(delar.findIndex((d) => d.textContent === "Inom 7 dagar"));
    expect(talet).toBe(delar.length - 2);
    expect(delar[delar.length - 1].querySelector("svg")).not.toBeNull();
  });

  it("⛔ ritar en nolla i menyraden, inte ingenting", () => {
    render(kommande("idag"));
    fireEvent.click(screen.getByRole("tab", { name: /^Idag/ }));
    expect(screen.getAllByRole("menuitemradio").map((r) => r.textContent)).toEqual(["Idag0", "Avklarat3"]);
  });

  it("⛔ segmentet heter som sig själv i grundläget, och bara ett annat menyval byter etiketten", () => {
    const { rerender } = render(kommande("kommande"));
    expect(screen.getByRole("tab", { name: /^Kommande/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /^Allt framåt/ })).toBeNull();

    rerender(kommande("vecka"));
    expect(screen.getByRole("tab", { name: /^Inom 7 dagar/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /^Kommande/ })).toBeNull();

    rerender(kommande("avklarat"));
    expect(screen.getByRole("tab", { name: /^Avklarat/ })).toHaveAttribute("aria-selected", "true");
  });
});
