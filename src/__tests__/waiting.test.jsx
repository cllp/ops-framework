import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsSpinner } from "../components/OpsSpinner.jsx";
import { OpsButton } from "../components/OpsButton.jsx";
import { OpsEmpty } from "../components/OpsEmpty.jsx";
import { OpsBrand } from "../components/OpsBrand.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsTag } from "../components/OpsTag.jsx";

/** @param {() => void} kor @param {RegExp} message */
function forvantaKrasch(kor, message) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(message);
  } finally {
    tyst.mockRestore();
  }
}

/**
 * ⛔ Testerna här handlar om EN sak: att väntan når fram till båda sorters
 * användare, och att den bara når fram en gång.
 *
 * Det första felet är lätt att förstå. Det andra är lätt att missa, och värre:
 * en yta som annonserar "Hämtar" två gånger låter som om två olika saker
 * laddar, och då slutar man lyssna på beskedet.
 */

describe("OpsSpinner", () => {
  it("annonserar väntan som standard", () => {
    render(<OpsSpinner label="Hämtar kostnader" />);
    expect(screen.getByRole("status")).toHaveTextContent("Hämtar kostnader");
  });

  // ⛔ Standardvärdet är det tillgängliga. Den som glömmer tänka på
  // skärmläsare får rätt beteende, och den som vill ha tyst måste be om det.
  it("är tyst bara när någon uttryckligen ber om det", () => {
    const { container } = render(<OpsSpinner decorative />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("vägrar annonsera utan att säga vad den väntar på", () => {
    forvantaKrasch(() => render(<OpsSpinner label="" />), /label krävs/);
  });

  it("kraschar på okänd storlek i stället för att rita ingenting", () => {
    // @ts-expect-error avsiktligt fel storlek
    forvantaKrasch(() => render(<OpsSpinner size="enorm" />), /okänd size/);
  });
});

describe("OpsButton när den arbetar", () => {
  // ⛔ Regressionstest. `busy` satte förut bara aria-busy, alltså besked till
  // skärmläsaren och ingenting till ögat.
  it("visar en snurra, inte bara ett attribut", () => {
    const { container } = render(<OpsButton busy>Spara</OpsButton>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("behåller etiketten så att knappen inte byter bredd mitt i klicket", () => {
    render(<OpsButton busy>Spara</OpsButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Spara");
  });

  // ⛔ Knappen bär redan aria-busy. En annonserande snurra inuti hade gjort
  // väntan till två besked om samma sak.
  it("annonserar väntan en enda gång", () => {
    render(<OpsButton busy>Spara</OpsButton>);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("går inte att klicka medan den arbetar", async () => {
    const onClick = vi.fn();
    render(
      <OpsButton busy onClick={onClick}>
        Spara
      </OpsButton>,
    );
    screen.getByRole("button").click();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("OpsEmpty när den hämtar", () => {
  it("skiljer hämtning från tomhet för ögat, inte bara i texten", () => {
    const { container } = render(<OpsEmpty title="Inga kostnader" busy />);
    expect(screen.getByRole("status")).toHaveTextContent("Hämtar");
    expect(screen.queryByText("Inga kostnader")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("visar ingen snurra när listan bara är tom", () => {
    const { container } = render(<OpsEmpty title="Inga kostnader" description="Lägg till den första." />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("OpsBrand", () => {
  it("visar produktnamn och ägarrad", () => {
    render(<OpsBrand title="Operations Hub" subtitle="CPS AB" />);
    expect(screen.getByText("Operations Hub")).toBeInTheDocument();
    expect(screen.getByText("CPS AB")).toBeInTheDocument();
  });

  it("vägrar ett märke utan namn", () => {
    // @ts-expect-error title saknas med flit
    forvantaKrasch(() => render(<OpsBrand />), /title krävs/);
  });

  it("kraschar på okänt märke i stället för att rita en tom ruta", () => {
    // @ts-expect-error avsiktligt fel märke
    forvantaKrasch(() => render(<OpsBrand title="X" mark="klotter" />), /okänt mark/);
  });

  // ⛔ Det vanliga fallet ska vara det rätta fallet. Skriver man bara ett namn
  // i skalet ska man få varumärket, inte fet text.
  it("skalet gör ett riktigt varumärke av en sträng", () => {
    render(
      <OpsAppShell brand="Bolag Ops" nav={[]} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.getByText("Bolag Ops")).toBeInTheDocument();
  });

  // ══ #164, korrigering B / punkt 9: ordmärket och ikonen som bilder ═════
  describe("bilder (#164)", () => {
    it("utan ordmarke/ikon ritas namnet som text, precis som förut", () => {
      render(<OpsBrand title="Bolag Ops" ordmarke={undefined} ikon={undefined} />);
      expect(screen.getByText("Bolag Ops")).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("med bara ordmarke ritas EN bild med rätt alt-text, ingen subtitle-rad", () => {
      render(<OpsBrand title="Bolag Ops" subtitle="CPS AB" ordmarke={{ ljus: "/ord-ljus.png", mork: "/ord-mork.png" }} />);
      const bilder = screen.getAllByRole("img", { name: "Bolag Ops" });
      expect(bilder).toHaveLength(1);
      expect(screen.queryByText("CPS AB")).toBeNull();
    });

    it("väljer ljus/mork utifrån det upplösta temat", () => {
      const { unmount } = render(<OpsBrand title="X" ordmarke={{ ljus: "/ljus.png", mork: "/mork.png" }} />);
      expect(screen.getByRole("img", { name: "X" })).toHaveAttribute("src", "/ljus.png");
      unmount();

      document.documentElement.setAttribute("data-theme", "dark");
      render(<OpsBrand title="X" ordmarke={{ ljus: "/ljus.png", mork: "/mork.png" }} />);
      expect(screen.getByRole("img", { name: "X" })).toHaveAttribute("src", "/mork.png");
      document.documentElement.removeAttribute("data-theme");
    });

    it("med BÅDA ordmarke och ikon ritas två bilder: ikonen smal (md:hidden), ordmärket bred (hidden md:block)", () => {
      render(
        <OpsBrand
          title="X"
          ordmarke={{ ljus: "/ord.png", mork: "/ord.png" }}
          ikon={{ ljus: "/ikon.png", mork: "/ikon.png" }}
        />,
      );
      const bilder = screen.getAllByRole("img", { name: "X" });
      expect(bilder).toHaveLength(2);
      expect(bilder.find((b) => b.getAttribute("src") === "/ikon.png")?.className).toContain("md:hidden");
      expect(bilder.find((b) => b.getAttribute("src") === "/ord.png")?.className).toContain("hidden");
    });
  });
});

describe("OpsTag när färgen betyder något", () => {
  // ⛔ Igenkänningen är hela poängen: samma etikett måste ge samma ton varje
  // gång, annars är färgen brus.
  it("ger samma ton för samma etikett", () => {
    const a = render(<OpsTag label="Mat" />).container.firstChild;
    const b = render(<OpsTag label="Mat" />).container.firstChild;
    expect(/** @type {Element} */ (a).className).toBe(/** @type {Element} */ (b).className);
  });

  // ⛔ AB och PRIVAT avgör vems pengar en rad gäller. Den skillnaden får inte
  // falla ut ur en hash, och den får inte flytta sig om någon skriver om
  // etiketten.
  it("låser tonen när den skickas in", () => {
    const a = render(<OpsTag label="PRIVAT" tone={2} />).container.firstChild;
    const b = render(<OpsTag label="Privat" tone={2} />).container.firstChild;
    expect(/** @type {Element} */ (a).className).toBe(/** @type {Element} */ (b).className);
  });

  it("kraschar på en ton som inte finns i kontraktet", () => {
    // @ts-expect-error sjunde tonen finns inte
    forvantaKrasch(() => render(<OpsTag label="X" tone={9} />), /okänd tone/);
  });
});
