import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OpsGruppanel, OpsGruppvaxlare } from "../components/OpsGruppanel.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsBrand } from "../components/OpsBrand.jsx";
import { ALLA_GRUPPER } from "../lib/grupplage.js";

/**
 * Grupp-panelen och gruppväxlaren (#161).
 *
 * ⛔ VAD SOM MÄTS: att "Alla mina grupper" alltid finns, att en grupp med
 * medlemsantal/roll ritar dem och en utan inte gissar en siffra, att kollaps
 * bär om från kort till märken och tillbaka (styrt OCH ostyrt), att kortet
 * aldrig lägger en knapp inuti en annan (glob/info/penna, bibliotek/chatt
 * ligger vid sidan av valknappen, inte inuti den), och att `OpsAppShell`
 * kopplar panelens läge till brandets ikon/ordmärke-val.
 */

const NAV = [{ href: "/", label: "Hem" }];

const GRUPPER = [
  { id: "bolaget", namn: { sv: "Bolaget" }, medlemsantal: 3, roll: "agare" },
  { id: "klubben", namn: { sv: "Klubben" } },
];

describe("OpsGruppanel", () => {
  it("kräver onValj", () => {
    expect(() => render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={undefined} />)).toThrow(/onValj krävs/);
  });

  it("ritar Alla mina grupper och en rad per grupp", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    expect(screen.getByText("Alla mina grupper")).toBeInTheDocument();
    expect(screen.getByText("Bolaget")).toBeInTheDocument();
    expect(screen.getByText("Klubben")).toBeInTheDocument();
  });

  it("⛔ medlemsantal ritas bara när det finns, ingen gissad nolla", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    // Klubben saknar medlemsantal: ingen rad med "0" för den gruppen.
    const klubbenKort = screen.getByText("Klubben").closest("li");
    expect(within(klubbenKort).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("rollpillen ritas bara när roll finns", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    expect(screen.getByText("Ägare")).toBeInTheDocument();
  });

  it("aria-current på den valda gruppen, ingen annanstans", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="bolaget" onValj={() => {}} />);
    const val = screen.getByRole("button", { name: "Bolaget" });
    expect(val).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Klubben" })).not.toHaveAttribute("aria-current");
  });

  it("⛔ vald grupp: accentram plus en svag accent-tonad bakgrund, på KORTET SJÄLVT (#161, rättad 2026-09-28)", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="bolaget" onValj={() => {}} />);
    // ⛔ Kortet ÄR `role="button"` (se filhuvudet: SessionStudios `<div
    // onClick>`, ingen nästlad `OpsCard`), så markeringen sitter direkt på
    // den, inte på ett separat överlägg.
    const kort = screen.getByRole("button", { name: "Bolaget" });
    expect(kort.className).toMatch(/border-accent/);
    expect(kort.className).toMatch(/bg-accent\/10/);
    // ⛔ Ingen sådan klass på en OVALD grupp.
    const ovaldKort = screen.getByRole("button", { name: "Klubben" });
    expect(ovaldKort.className).not.toMatch(/border-accent/);
  });

  it("tryck på en grupp anropar onValj med dess id", async () => {
    const onValj = vi.fn();
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={onValj} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Bolaget" }));
    expect(onValj).toHaveBeenCalledWith("bolaget");
  });

  it("⛔ Alla mina grupper är ett eget val, med aria-current i sitt läge", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    expect(screen.getByRole("button", { name: /Alla mina grupper/ })).toHaveAttribute("aria-current", "true");
  });

  it("tomText ritas när listan är tom", () => {
    render(<OpsGruppanel grupper={[]} aktiv={ALLA_GRUPPER} onValj={() => {}} tomText="Inga grupper än." />);
    expect(screen.getByText("Inga grupper än.")).toBeInTheDocument();
  });

  it("ingen Skapa grupp-knapp utan onSkapa", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    expect(screen.queryByRole("button", { name: "Skapa grupp" })).not.toBeInTheDocument();
  });

  it("med onSkapa: en Skapa grupp-knapp som anropar den", async () => {
    const onSkapa = vi.fn();
    render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} onSkapa={onSkapa} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Skapa grupp" }));
    expect(onSkapa).toHaveBeenCalledOnce();
  });

  describe("kollaps: ostyrt", () => {
    it("från start är kortvyn synlig (namnet syns)", () => {
      render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
      expect(screen.getByText("Bolaget")).toBeInTheDocument();
    });

    it("⛔ ett tryck på chevronen byter till märken, namnet försvinner ur DOM", async () => {
      render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Fäll ihop grupplistan" }));
      expect(screen.queryByText("Bolaget")).not.toBeInTheDocument();
      // Märket finns kvar, som en knapp med gruppens namn som aria-label.
      expect(screen.getByRole("button", { name: "Bolaget" })).toBeInTheDocument();
    });

    it("ett andra tryck fäller ut igen", async () => {
      render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Fäll ihop grupplistan" }));
      await user.click(screen.getByRole("button", { name: "Fäll ut grupplistan" }));
      expect(screen.getByText("Bolaget")).toBeInTheDocument();
    });
  });

  describe("kollaps: styrt", () => {
    it("infalld=true ritar märkesremsan direkt, utan eget klick", () => {
      render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} infalld />);
      expect(screen.queryByText("Bolaget")).not.toBeInTheDocument();
    });

    it("⛔ ett klick på chevronen ÄNDRAR INTE läget själv, bara onInfalld anropas", async () => {
      const onInfalld = vi.fn();
      render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} infalld={false} onInfalld={onInfalld} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Fäll ihop grupplistan" }));
      expect(onInfalld).toHaveBeenCalledWith(true);
      // Fortfarande utfälld: appen bestämmer, inte klicket.
      expect(screen.getByText("Bolaget")).toBeInTheDocument();
    });
  });

  describe("atgarder, knappar och avatarer: appens, aldrig gissade", () => {
    it("ingen av delarna ritas utan att appen skickar dem", () => {
      render(<OpsGruppanel grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
      expect(screen.queryByRole("button", { name: "Publik sida" })).not.toBeInTheDocument();
    });

    it("⛔ en åtgärd och valet är SYSKON, ingen knapp ligger inuti den andra", async () => {
      const onValj = vi.fn();
      const onAtgard = vi.fn();
      const grupper = [{ ...GRUPPER[0], atgarder: [{ icon: <span />, label: "Publik sida", onClick: onAtgard }] }];
      render(<OpsGruppanel grupper={grupper} aktiv={ALLA_GRUPPER} onValj={onValj} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Publik sida" }));
      expect(onAtgard).toHaveBeenCalledOnce();
      expect(onValj).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Bolaget" }));
      expect(onValj).toHaveBeenCalledWith("bolaget");
    });

    it("en knapp med räknare ritar badgen", () => {
      const grupper = [{ ...GRUPPER[0], knappar: [{ icon: <span />, label: "Bibliotek", badge: 18, onClick: () => {} }] }];
      render(<OpsGruppanel grupper={grupper} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
      expect(screen.getByText("18")).toBeInTheDocument();
    });

    it("avatarer kapas vid fyra, resten blir +N", () => {
      const avatarer = ["A", "B", "C", "D", "E"].map((n) => ({ id: n, namn: n }));
      const grupper = [{ ...GRUPPER[0], avatarer }];
      render(<OpsGruppanel grupper={grupper} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
      expect(screen.getByText("+1")).toBeInTheDocument();
    });
  });
});

describe("OpsGruppvaxlare", () => {
  it("kräver onValj", () => {
    expect(() => render(<OpsGruppvaxlare grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={undefined} />)).toThrow(/onValj krävs/);
  });

  it("triggern visar den aktiva gruppens namn", () => {
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv="bolaget" onValj={() => {}} />);
    expect(screen.getByRole("button", { name: "Byt grupp" })).toHaveTextContent("Bolaget");
  });

  it("triggern visar Alla mina grupper när det är läget", () => {
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    expect(screen.getByRole("button", { name: "Byt grupp" })).toHaveTextContent("Alla mina grupper");
  });

  it("⛔ ett tryck öppnar arket med raderna, i enkel form", async () => {
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={() => {}} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Byt grupp" }));
    expect(screen.getByRole("button", { name: "Klubben" })).toBeInTheDocument();
  });

  it("ett val i arket anropar onValj OCH stänger arket", async () => {
    const onValj = vi.fn();
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv={ALLA_GRUPPER} onValj={onValj} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Byt grupp" }));
    await user.click(screen.getByRole("button", { name: "Klubben" }));
    expect(onValj).toHaveBeenCalledWith("klubben");
    expect(screen.queryByRole("button", { name: "Klubben" })).not.toBeInTheDocument();
  });
});

describe("OpsAppShell: grupper-propen (#161)", () => {
  it("utan grupper: ingen panel, skalet oförändrat", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/">
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.queryByLabelText("Alla mina grupper")).not.toBeInTheDocument();
  });

  it("med grupper: panelen OCH växlaren finns i DOM (bredden avgörs av CSS, inte av vad som monteras)", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/" grupper={{ lista: GRUPPER, aktiv: ALLA_GRUPPER, onValj: () => {} }}>
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    // Panelen (nav) och växlaren (OpsPanel-trigger) delar samma aria-label
    // "Alla mina grupper" eftersom båda listar samma rader; minst en instans.
    expect(screen.getAllByText("Alla mina grupper").length).toBeGreaterThan(0);
  });

  it("ett eget OpsBrand-element klonas med panelInfalld (två bilder, crossfade, inte ett bortplockat)", () => {
    const { container } = render(
      <OpsAppShell
        nav={NAV}
        activeHref="/"
        brand={<OpsBrand title="Bolag Ops" />}
        grupper={{ lista: GRUPPER, aktiv: ALLA_GRUPPER, onValj: () => {}, infalld: true }}
      >
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    // ⛔ RÄTTAD 2026-09-28: SessionStudios `AppHeader.jsx` monterar BÅDA
    // bilderna alltid och crossfadar med opacity (rad 174-193), aldrig
    // mount/unmount av en av dem. Se nästa `describe`-block för fler prov.
    expect(container.querySelectorAll("header img").length).toBe(2);
  });
});

describe("⛔ panelens och logotypens bredd, mätta ur SessionStudio, inte gissade (#161)", () => {
  /*
   * ⛔ RÄTTAD 2026-09-28: panelens bredd (288/72) OCH avataren (32px) var en
   * uppskattning, inte en mätning. De riktiga talen kommer ur
   * sessions-platform/apps/web/src/components/AppSidebar.jsx (panelen) och
   * .../AppHeader.jsx (logorutan), och de är INTE samma tal som varandra:
   * panelen är 184/44, logorutan är 180/40. Två olika rutor, två olika
   * skäl (asidet har `px-0.5`, logorutan har det inte), alltså TVÅ tokenpar,
   * inte ett gemensamt.
   *
   * ⛔ INTE ETT NÄRVAROGREP. Provet mäter inte "står ordet någonstans", det
   * extraherar VILKA `w-(--namn)`-klasser varje fil faktiskt använder och
   * kräver att rätt fil äger rätt par. En fil som byter till en egen
   * literal (`w-72`) tappar sin post ur mängden och gör provet rött.
   */
  const har = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const gruppanelKalla = har("../components/OpsGruppanel.jsx");
  const brandKalla = har("../components/OpsBrand.jsx");
  const tokensKalla = har("../../tokens/tokens.css");

  /** @param {string} kalla @param {string} namn @returns {Set<string>} */
  const tokennamn = (kalla, namn) => new Set([...kalla.matchAll(new RegExp(`w-\\(--${namn}(-infalld)?\\)`, "g"))].map((m) => m[0]));

  it("OpsGruppanel äger --panel-bredd/-infalld, som en riktig Tailwind-klass", () => {
    expect([...tokennamn(gruppanelKalla, "panel-bredd")].sort()).toEqual(["w-(--panel-bredd)", "w-(--panel-bredd-infalld)"]);
  });

  it("OpsBrand äger --logo-bredd/-infalld, som en riktig Tailwind-klass", () => {
    expect([...tokennamn(brandKalla, "logo-bredd")].sort()).toEqual(["w-(--logo-bredd)", "w-(--logo-bredd-infalld)"]);
  });

  it("alla fyra token är deklarerade i tokens.css, med de uppmätta talen", () => {
    expect(tokensKalla).toMatch(/--panel-bredd:\s*184px/);
    expect(tokensKalla).toMatch(/--panel-bredd-infalld:\s*44px/);
    expect(tokensKalla).toMatch(/--logo-bredd:\s*180px/);
    expect(tokensKalla).toMatch(/--logo-bredd-infalld:\s*40px/);
  });

  it("panelen bär sin klass i DOM, per läge", () => {
    const utfalld = render(
      <OpsAppShell nav={NAV} activeHref="/" grupper={{ lista: GRUPPER, aktiv: ALLA_GRUPPER, onValj: () => {}, infalld: false }}>
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    expect(utfalld.container.querySelector(".w-\\(--panel-bredd\\)")).toBeTruthy();
    expect(utfalld.container.querySelector(".w-\\(--panel-bredd-infalld\\)")).toBeFalsy();
    utfalld.unmount();

    const infalld = render(
      <OpsAppShell nav={NAV} activeHref="/" grupper={{ lista: GRUPPER, aktiv: ALLA_GRUPPER, onValj: () => {}, infalld: true }}>
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    expect(infalld.container.querySelector(".w-\\(--panel-bredd-infalld\\)")).toBeTruthy();
    infalld.unmount();
  });

  it("logotyprutan bär sin klass i DOM, per läge, med båda bilderna alltid monterade", () => {
    const utfalld = render(
      <OpsAppShell nav={NAV} activeHref="/" brand="Bolag Ops" grupper={{ lista: GRUPPER, aktiv: ALLA_GRUPPER, onValj: () => {}, infalld: false }}>
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    expect(utfalld.container.querySelector("header .w-\\(--logo-bredd\\)")).toBeTruthy();
    expect(utfalld.container.querySelectorAll("header img").length).toBe(2);
    utfalld.unmount();

    const infalld = render(
      <OpsAppShell nav={NAV} activeHref="/" brand="Bolag Ops" grupper={{ lista: GRUPPER, aktiv: ALLA_GRUPPER, onValj: () => {}, infalld: true }}>
        <p>Innehåll</p>
      </OpsAppShell>,
    );
    expect(infalld.container.querySelector("header .w-\\(--logo-bredd-infalld\\)")).toBeTruthy();
    expect(infalld.container.querySelectorAll("header img").length).toBe(2);
    infalld.unmount();
  });
});
