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
 * @param {() => void} kor @param {RegExp} meddelande
 */
function forvantaKrasch(kor, meddelande) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(meddelande);
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
    const knapp = screen.getByRole("button", { name: "Spara" });
    knapp.click();
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
    const knapp = screen.getByRole("button", { name: "Nytt ärende" });
    expect(knapp.className).toMatch(/rounded-full/);
    expect(knapp.className).toMatch(/\bsize-8\b/);
    expect(knapp.className).not.toMatch(/rounded-md/);
    expect(knapp.className).not.toMatch(/min-w-11/);
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

  // ⛔ `namn[0]` klipper mitt i tecken utanför BMP och ger en trasig ruta.
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
    const valda = [];
    render(
      <OpsSegmented
        ariaLabel="Vad som visas"
        value="idag"
        onChange={(v) => valda.push(v)}
        options={[
          { value: "idag", label: "Idag", badge: 2 },
          { value: "kommande", label: "Kommande", badge: 4 },
        ]}
      />,
    );
    const idag = screen.getByRole("tab", { name: /Idag/ });
    expect(idag).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Kommande/ })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByRole("tab", { name: /Kommande/ }));
    expect(valda).toEqual(["kommande"]);
  });

  it("kastar vid fler än tre lägen", () => {
    // ⛔ Vakten finns för att fyra segment ger ord som är för korta för att
    // betyda något. Är den inte brytbar är den en kommentar, inte en regel.
    const fyra = ["a", "b", "c", "d"].map((v) => ({ value: v, label: v.toUpperCase() }));
    expect(() => render(<OpsSegmented ariaLabel="x" value="a" onChange={() => {}} options={fyra} />)).toThrow(/två eller tre lägen/);
  });

  it("visar chevron och undermeny på aktivt segment med menu", () => {
    // ⛔ SessionStudio: Idag bär Idag|Tidigare. Chevron bara när fliken är
    // aktiv; klick på inaktivt segment byter utan att öppna menyn.
    const valda = [];
    const { rerender } = render(
      <OpsSegmented
        ariaLabel="Vad som visas"
        value="idag"
        onChange={(v) => valda.push(v)}
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
    const idag = screen.getByRole("tab", { name: /Idag/ });
    expect(idag).toHaveAttribute("aria-selected", "true");
    expect(idag).toHaveAttribute("aria-haspopup", "menu");
    expect(idag).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(idag);
    expect(idag).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Tidigare/ }));
    expect(valda).toEqual(["tidigare"]);

    rerender(
      <OpsSegmented
        ariaLabel="Vad som visas"
        value="tidigare"
        onChange={(v) => valda.push(v)}
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
