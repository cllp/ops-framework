import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsGruppvaxlare } from "../components/OpsGruppanel.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsHubblista } from "../components/OpsHubbar.jsx";

/**
 * Hubbarna ovanför grupperna (0.52.0, cllp/lifehub.app#27).
 *
 * CP 2026-10-04 om mobilen: "där är det precis på samma plats som man switchar grupper, inte hubbar." Det som mäts:
 * att arket börjar med hubbarna och att grupperna står under en rubrik som nämner hubben, att den aktiva hubben inte
 * är en länk och de andra är det, att "Alla hubbar" leder dit appen sagt, att märket heter hubben, att chevronen vid
 * märket öppnar samma lista, och att en lista som säger fel om var man är stoppas med skälet.
 */

const NAV = [{ href: "/", label: "Hem" }];
const GRUPPER = [
  { id: "phst", namn: { sv: "PHST" }, roll: "agare" },
  { id: "mitt", namn: { sv: "Mitt projekt" } },
];
const HUBBAR = {
  aktiv: "my",
  lista: [
    { id: "my", namn: "MY HUB" },
    { id: "music", namn: "MUSIC HUB", href: "https://id.example/?open=music" },
  ],
  allaHref: "https://id.example/",
};

describe("OpsHubblista", () => {
  it("den aktiva hubben är markerad och ingen länk, en annan är en länk till sin href", () => {
    render(<OpsHubblista hubbar={HUBBAR} />);
    const aktiv = screen.getByText("MY HUB").closest("[aria-current]");
    expect(aktiv).not.toBeNull();
    expect(screen.queryByRole("link", { name: "MY HUB" })).toBeNull();
    expect(screen.getByRole("link", { name: "MUSIC HUB" })).toHaveAttribute("href", "https://id.example/?open=music");
    expect(screen.getByRole("link", { name: /Alla hubbar/ })).toHaveAttribute("href", "https://id.example/");
  });

  it("⛔ en lista utan den aktiva hubben, en tom lista och en hubb utan href stoppas med skälet", () => {
    expect(() => render(<OpsHubblista hubbar={{ ...HUBBAR, aktiv: "annan" }} />)).toThrow(/står inte i listan/);
    expect(() => render(<OpsHubblista hubbar={{ aktiv: "my", lista: [] }} />)).toThrow(/lista är tom/);
    expect(() => render(<OpsHubblista hubbar={{ aktiv: "my", lista: [{ id: "my", namn: "MY HUB" }, { id: "x", namn: "X" }] }} />)).toThrow(/saknar href/);
  });
});

describe("⛔ gruppväxlarens ark: hubbarna överst, grupperna under sin hubb", () => {
  it("arket börjar med hubbarna och grupperna står under Grupper i MY HUB", async () => {
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv="phst" onValj={() => {}} hubbar={HUBBAR} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Byt grupp, nu: PHST" }));
    const hubbar = screen.getByRole("region", { name: "Hubbar" });
    const grupper = screen.getByRole("region", { name: "Grupper i MY HUB" });
    expect(within(hubbar).getByRole("link", { name: "MUSIC HUB" })).toBeInTheDocument();
    expect(within(grupper).getByRole("button", { name: "Mitt projekt" })).toBeInTheDocument();
    // Ordningen: hubbarna före grupperna i dokumentet.
    expect(hubbar.compareDocumentPosition(grupper) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("utan hubbar är arket som förut, utan hubbrubrik", async () => {
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv="phst" onValj={() => {}} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Byt grupp, nu: PHST" }));
    expect(screen.queryByRole("region", { name: "Hubbar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mitt projekt" })).toBeInTheDocument();
  });
});

describe("OpsAppShell med hubbar", () => {
  it("märket heter den aktiva hubben, och chevronen vid märket öppnar samma lista", async () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/" hubbar={HUBBAR} grupper={{ lista: GRUPPER, aktiv: "phst", onValj: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.getAllByText("MY").length).toBeGreaterThan(0);
    await userEvent.setup().click(screen.getByRole("button", { name: "Byt hubb, nu: MY HUB" }));
    expect(screen.getByRole("link", { name: "MUSIC HUB" })).toHaveAttribute("href", "https://id.example/?open=music");
  });

  it("utan hubbar finns ingen chevron och märket är som förut", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/" grupper={{ lista: GRUPPER, aktiv: "phst", onValj: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.queryByRole("button", { name: /Byt hubb/ })).toBeNull();
  });
});
