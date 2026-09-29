import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import * as Ops from "../index.js";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsHub } from "../components/OpsHub.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsIdentity } from "../components/OpsIdentity.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { formatDagOchKlockslag } from "../lib/format.js";

/**
 * 0.30.0 (#173), CP 2026-09-29: navigationen, menyn, hover, loggan, typografin och
 * händelsen. jsdom kör ingen CSS, så det som beror på pixlar (avgränsare, mittlinjer,
 * överflödning) mäts i `scripts/check-skalyta.mjs`. Det här är beteendet och strukturen.
 */

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const moduler = [
  { href: "/oversikt", label: "Översikt" },
  { href: "/ekonomi", label: "Ekonomi", children: [{ href: "/inkomster", label: "Inkomster" }, { href: "/kostnader", label: "Kostnader" }] },
];
const meny = { sektioner: [[{ key: "aktivitet", etikett: "Aktivitet", onClick: () => {} }], [{ key: "inst", etikett: "Inställningar", onClick: () => {} }]], onLoggaUt: () => {} };

/** @param {any} [extra] */
const Skal = (extra = {}) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={moduler} activeHref="/" meny={meny} {...extra}>
    <p>innehåll</p>
  </OpsAppShell>
);

describe("A: fasta poster och moduler i Hub (#173)", () => {
  it("toppraden är Idag, Kalender, Hub, i den ordningen och inget annat", () => {
    render(Skal());
    const rad = screen.getByRole("navigation", { name: "Huvudnavigering" });
    const lankar = within(rad).getAllByRole("link").map((a) => a.textContent);
    expect(lankar).toEqual(["Idag", "Kalender", "Hub"]);
  });

  it("namnen finns på engelska, och de är ramverkets (appen skickar bara href)", () => {
    render(Skal({ sprak: "en" }));
    const rad = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(rad).getAllByRole("link").map((a) => a.textContent)).toEqual(["Today", "Calendar", "Hub"]);
  });

  it("Hub har en chevron som öppnar modulerna, och en modul med undersidor har en egen chevron (0.30.1)", () => {
    render(Skal());
    fireEvent.click(screen.getByRole("button", { name: "Visa sidorna under Hub" }));
    const dropdown = screen.getByRole("dialog");
    // Ekonomis barn är infällda tills dess egen chevron trycks: en rad med chevron, inte en lista som alltid syns.
    expect(within(dropdown).getAllByRole("link").map((a) => a.textContent)).toEqual(["Översikt", "Ekonomi"]);
    const chevron = within(dropdown).getByRole("button", { name: "Visa sidorna under Ekonomi" });
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chevron);
    expect(chevron.getAttribute("aria-expanded")).toBe("true");
    expect(within(dropdown).getAllByRole("link").map((a) => a.textContent)).toEqual(["Översikt", "Ekonomi", "Inkomster", "Kostnader"]);
  });

  it("Hub lyser när man står på en moduls undersida (två steg ner)", () => {
    render(Skal({ activeHref: "/inkomster" }));
    const rad = screen.getByRole("navigation", { name: "Huvudnavigering" });
    // Hub har undermeny, så länken ligger i ett `<span>` som bär flikens klasser.
    expect(within(rad).getByRole("link", { name: "Hub" }).parentElement.className).toContain("border-ink");
    expect(within(rad).getByRole("link", { name: "Idag" }).className).not.toContain("border-ink");
  });

  it("⛔ moduler visas ALDRIG i menyn (hamburgaren), bara i Hub", () => {
    render(Skal());
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    const menyn = screen.getByRole("dialog");
    expect(within(menyn).queryByText("Ekonomi")).toBeNull();
    expect(within(menyn).queryByText("Översikt")).toBeNull();
    expect(within(menyn).getByText("Aktivitet")).toBeTruthy();
  });

  it("⛔ nav OCH fasta ihop kastar, med skälet", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(Skal({ nav: [{ href: "/x", label: "X" }] }))).toThrow(/två modeller/);
    tyst.mockRestore();
  });

  it("⛔ moduler utan fasta kastar (Hub finns bara i den nya modellen)", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsAppShell brand="Ops" nav={[]} moduler={moduler} activeHref="/"><p>x</p></OpsAppShell>)).toThrow(/moduler.*utan.*fasta/);
    tyst.mockRestore();
  });

  it("⛔ fasta utan href på en av de tre kastar och pekar ut vilken", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(Skal({ fasta: { idag: { href: "/" }, kalender: { href: "/k" }, hub: {} } }))).toThrow(/fasta\.hub\.href/);
    tyst.mockRestore();
  });

  it("⛔ primaryAction tillsammans med fasta kastar: plusset i mitten är skalets", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(Skal({ primaryAction: { label: "X", onClick: () => {} } }))).toThrow(/primaryAction/);
    tyst.mockRestore();
  });

  it("bakåtkompatibelt: utan fasta fungerar nav som förut", () => {
    render(<OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }, { href: "/b", label: "B" }]} activeHref="/"><p>x</p></OpsAppShell>);
    const rad = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(rad).getAllByRole("link").map((a) => a.textContent)).toEqual(["Start", "B"]);
  });

  it("bottenraden: Idag, Kalender, PLUS, Hub, Meny, och plusset öppnar samma lista som huvudets", () => {
    render(Skal({ skapa: { handelse: <p>formulär</p>, arende: <p>ärende</p> } }));
    const botten = screen.getByRole("navigation", { name: "Snabbnavigering" });
    const poster = within(botten).getAllByRole("link").map((a) => a.textContent);
    expect(poster).toEqual(["Idag", "Kalender", "Hub"]);
    const alla = Array.from(botten.querySelectorAll("a, button")).map((e) => e.getAttribute("aria-label") || e.textContent);
    expect(alla).toEqual(["Idag", "Kalender", "Skapa", "Hub", "Meny"]);

    fireEvent.click(within(botten).getByRole("button", { name: "Skapa" }));
    const ark = screen.getByRole("dialog", { name: "Skapa" });
    expect(within(ark).getByRole("button", { name: "Ny händelse" })).toBeTruthy();
    expect(within(ark).getByRole("button", { name: "Nytt ärende" })).toBeTruthy();
  });

  it("⛔ ETT plus per yta: huvudets plus göms under md när bottenradens finns, syns alltid utan", () => {
    const { unmount } = render(Skal({ skapa: { handelse: <p>x</p> } }));
    const rubrik = screen.getByRole("banner");
    expect(within(rubrik).getByRole("button", { name: "Skapa" }).className).toContain("hidden md:inline-flex");
    unmount();
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ handelse: <p>x</p> }}>
        <p>x</p>
      </OpsAppShell>,
    );
    const cls = within(screen.getByRole("banner")).getByRole("button", { name: "Skapa" }).className;
    expect(cls).toContain("inline-flex");
    expect(cls).not.toContain("hidden");
  });

  it("utan något att skapa ritas inget plus i bottenraden heller (tomhet är ett svar)", () => {
    render(Skal());
    const botten = screen.getByRole("navigation", { name: "Snabbnavigering" });
    expect(within(botten).queryByRole("button", { name: "Skapa" })).toBeNull();
  });

  it("OpsHub: ett kort per modul, varje kort en länk, och det aktiva markerat (0.30.1)", () => {
    render(<OpsHub moduler={moduler} activeHref="/inkomster" />);
    const lista = screen.getByRole("list", { name: "Moduler" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    // Undersidorna bor på modulens EGEN sida (`OpsHubModul`), inte som rader i kortet.
    const kort = within(lista).getByRole("link", { name: /Ekonomi/ });
    expect(within(lista).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/oversikt", "/ekonomi"]);
    expect(kort.className).toContain("rounded-card");
    expect(kort.className).toContain("ring-accent");
    expect(within(lista).getByRole("link", { name: /Översikt/ }).className).not.toContain("ring-accent");
  });

  it("OpsHub: en tom lista visar text, aldrig en tom yta", () => {
    render(<OpsHub moduler={[]} />);
    expect(screen.getByText("Inga moduler än")).toBeTruthy();
  });

  it("OpsHub: stängt API, ingen className och ingen style i parameterlistan", () => {
    expect(OpsHub.length).toBe(1);
    expect(Ops.OpsHub).toBe(OpsHub);
  });
});

describe("B: menyn, en avgränsare mellan sektioner (#173)", () => {
  const konf = { ...meny, app: [{ href: "/app", label: "Appens sida" }], appVersion: "app v1" };

  /** Antalet avdelningar och hur många av dem som bär en linje OVANFÖR sig. */
  const avdelningar = (/** @type {HTMLElement} */ rot) => {
    const alla = Array.from(rot.querySelectorAll("[data-meny-avdelning]"));
    return { antal: alla.length, medLinje: alla.filter((e) => e.className.split(/\s+/).includes("border-t")).length, forsta: alla[0] };
  };

  it("i rullgardinen: n avdelningar har exakt n-1 linjer, och den FÖRSTA har ingen", () => {
    render(Skal({ meny: konf }));
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    const { antal, medLinje, forsta } = avdelningar(screen.getByRole("dialog"));
    expect(antal).toBeGreaterThanOrEqual(5); // två sektioner, appens, Logga ut, versionerna
    expect(medLinje).toBe(antal - 1);
    expect(forsta.className.split(/\s+/)).not.toContain("border-t");
  });

  it("i bottenradens ark: samma sak, och arkets rubrik bär den enda linjen ovanför första avdelningen", () => {
    render(Skal({ meny: konf }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    const ark = screen.getByRole("dialog");
    const { antal, medLinje } = avdelningar(ark);
    expect(medLinje).toBe(antal - 1);
    // Rubrikraden har `border-b`; ingen avdelning har `border-t` ovanför den.
    expect(ark.querySelectorAll("[data-meny-avdelning].border-t").length).toBe(antal - 1);
  });

  it("en TOM avdelning i mitten ger ingen extra linje", () => {
    render(Skal({ meny: { ...meny, sektioner: [[{ key: "a", etikett: "A", onClick: () => {} }], [], [{ key: "b", etikett: "B", onClick: () => {} }]] } }));
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    const { antal, medLinje } = avdelningar(screen.getByRole("dialog"));
    expect(medLinje).toBe(antal - 1);
  });

  it("meny.app: egen sektion med rubriken 'Appen' (sv), 'App' (en) eller appens egen, och länkar som navigerar", () => {
    const onNavigate = vi.fn();
    const { unmount } = render(Skal({ meny: konf, onNavigate }));
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    const menyn = screen.getByRole("dialog");
    expect(within(menyn).getByText("Appen")).toBeTruthy();
    fireEvent.click(within(menyn).getByRole("link", { name: "Appens sida" }));
    expect(onNavigate).toHaveBeenCalledWith("/app", expect.anything());
    unmount();

    const en = render(Skal({ meny: konf, sprak: "en" }));
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    expect(within(screen.getByRole("dialog")).getByText("App")).toBeTruthy();
    en.unmount();

    render(Skal({ meny: { ...konf, appRubrik: { sv: "Bolagets sidor", en: "Company pages" } } }));
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    expect(within(screen.getByRole("dialog")).getByText("Bolagets sidor")).toBeTruthy();
  });

  it("meny.app valideras som nav: ett barn i barnet kastar", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(Skal({ meny: { ...meny, app: [{ href: "/a", label: "A", children: [{ href: "/b", label: "B", children: [{ href: "/c", label: "C" }] }] }] } })),
    ).toThrow(/EN nivå/);
    tyst.mockRestore();
  });
});

describe("C: hover och rundning (#173)", () => {
  it("raden är rounded-base med hover:bg-raised, aktiv bg-raised text-accent, i menyn och i Hubs dropdown", () => {
    render(Skal());
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    const rad = within(screen.getByRole("dialog")).getByRole("button", { name: "Aktivitet" });
    for (const k of ["rounded-base", "hover:bg-raised", "px-3", "py-2.5", "text-xs"]) expect(rad.className).toContain(k);
    expect(rad.className).not.toContain("rounded-sm");
  });

  it("behållaren är bg-surface, rounded-base, border-line, skugga (annars syns inte hovern)", () => {
    render(Skal());
    fireEvent.click(screen.getByRole("button", { name: /Meny, fler åtgärder/ }));
    const behallare = screen.getByRole("dialog");
    for (const k of ["bg-surface", "rounded-base", "border-line", "shadow-lg"]) expect(behallare.className).toContain(k);
    expect(behallare.className).not.toContain("bg-raised");
  });

  it("ikonlänken är en cirkel: rounded-full size-9 p-2, 44 px träffyta som osynlig after-yta", () => {
    render(<OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" />);
    const l = screen.getByRole("link", { name: "Inkorg" });
    for (const k of ["rounded-full", "size-9", "p-2", "hover:bg-raised", "after:size-11"]) expect(l.className).toContain(k);
    expect(l.className).not.toContain("min-h-11");
  });

  it("avataren: 32 px rund knapp (p-0.5), ring vid hover, accentring när aktiv, OpsIdentity görs 28 px rund", () => {
    const { container, rerender } = render(<OpsIconLink avatar href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" />} />);
    const l = screen.getByRole("link", { name: "Min profil" });
    for (const k of ["size-8", "rounded-full", "p-0.5", "hover:ring-2", "hover:ring-line-strong", "after:size-11"]) expect(l.className).toContain(k);
    const id = container.querySelector('[role="img"]');
    for (const k of ["size-7", "rounded-full"]) expect(id.className).toContain(k);
    expect(id.className).not.toContain("size-9");
    rerender(<OpsIconLink avatar active href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" />} />);
    expect(screen.getByRole("link", { name: "Min profil" }).className).toContain("ring-accent");
  });

  it("OpsIdentity: size=avatar och rund är cirklar, en grupp förblir en rundad ruta", () => {
    const { container } = render(
      <>
        <OpsIdentity name="A B" seed="1" size="avatar" />
        <OpsIdentity name="C D" seed="2" rund />
        <OpsIdentity name="E F" seed="3" />
      </>,
    );
    const [a, r, g] = container.querySelectorAll('[role="img"]');
    expect(a.className).toContain("rounded-full");
    expect(r.className).toContain("rounded-full");
    expect(g.className).toContain("rounded-md");
    expect(g.className).not.toContain("rounded-full");
  });
});

describe("F: skapa händelse med typ och vem som skapade (#173)", () => {
  const kataloger = [{ id: "handelsetyper", kategorier: [{ id: "moete", namn: { sv: "Möte" }, ikon: "x", ordning: 0 }, { id: "frist", namn: { sv: "Frist" }, ikon: "x", ordning: 1 }] }];
  const Form = (/** @type {any} */ p) => (
    <div>
      <p data-testid="props">{`groupId=${p.groupId} typ=${p.typ}`}</p>
      <button type="button" onClick={p.onKlar}>Klar</button>
    </div>
  );

  it("skapa.handelse kan vara { form, katalog }: typvalet ur handelsetyper och formuläret får { groupId, typ, onKlar }", () => {
    const onKlar = vi.fn();
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ handelse: { form: Form }, kataloger, lage: "bolaget", onKlar }}>
        <p>x</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Ny händelse" }));
    const modal = screen.getByRole("dialog", { name: "Ny händelse" });
    expect(within(modal).getByText("Typ")).toBeTruthy();
    expect(within(modal).getByTestId("props").textContent).toBe("groupId=bolaget typ=moete");
    fireEvent.click(within(modal).getByRole("button", { name: "Klar" }));
    expect(onKlar).toHaveBeenCalledWith({ registrering: "handelse", typ: "moete" });
    expect(screen.queryByRole("dialog", { name: "Ny händelse" })).toBeNull();
  });

  it("katalog: null ger ingen typväljare, men formuläret får ändå groupId", () => {
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ handelse: { form: Form, katalog: null }, lage: "bolaget" }}>
        <p>x</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Ny händelse" }));
    const modal = screen.getByRole("dialog", { name: "Ny händelse" });
    expect(within(modal).queryByText("Typ")).toBeNull();
    expect(within(modal).getByTestId("props").textContent).toBe("groupId=bolaget typ=null");
  });

  it("ett färdigt ReactNode fungerar som förut", () => {
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ handelse: <p>färdigt formulär</p> }}>
        <p>x</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Ny händelse" }));
    expect(screen.getByText("färdigt formulär")).toBeTruthy();
  });

  const rad = { id: "h1", title: "Bokslutsmöte", daysLeft: 3 };
  const skapad = new Date(2026, 8, 29, 9, 12).toISOString(); // lokal 09:12, oavsett maskinens tidszon

  it("OpsEventList: 'Skapad av Namn, 29 sep 09:12' när både skapadAv och skapad finns", () => {
    render(<OpsEventList events={[{ ...rad, skapadAv: { namn: "Claes Philip" }, skapad }]} />);
    expect(screen.getByText("Skapad av Claes Philip, 29 sep 09:12")).toBeTruthy();
  });

  it("språket styr månaden och orden", () => {
    render(<OpsEventList sprak="en" skapadAvEtikett="Created by" events={[{ ...rad, skapadAv: { namn: "Claes Philip" }, skapad }]} />);
    expect(screen.getByText(/^Created by Claes Philip, 29 Sep\w* 09:12$/)).toBeTruthy();
  });

  it("en människa och en agent går inte att förväxla: OpsProvenance skriver ut ordet", () => {
    render(<OpsEventList events={[{ ...rad, id: "a", skapadAv: { namn: "Agenten", typ: "agent" }, skapad }]} />);
    const rad1 = screen.getByText(/^Skapad av Agenten, 29 sep 09:12$/);
    expect(rad1.className).toContain("bg-agent-bg");
  });

  it("⛔ en halv rad ritas inte: bara namn, bara tid eller tomt namn ger ingenting", () => {
    render(
      <OpsEventList
        events={[
          { ...rad, id: "a", skapadAv: { namn: "Bara Namn" } },
          { ...rad, id: "b", skapad },
          { ...rad, id: "c", skapadAv: { namn: "  " }, skapad },
        ]}
      />,
    );
    expect(screen.queryByText(/Skapad av/)).toBeNull();
  });

  it("formatDagOchKlockslag: lokal tid, månaden utan punkt, och ett saknat värde blir aldrig en nolla", () => {
    expect(formatDagOchKlockslag(new Date(2026, 8, 5, 7, 3))).toBe("5 sep 07:03");
    expect(formatDagOchKlockslag(new Date(2026, 0, 31, 23, 59))).toBe("31 jan 23:59");
    expect(formatDagOchKlockslag(null)).not.toMatch(/^0/);
  });
});

describe("D: typografin på ETT ställe (#173)", () => {
  it("fixturens roller finns som tokens och som Tailwind-utilities i tokens.css", async () => {
    const fs = await import("node:fs");
    const pathMod = await import("node:path");
    const css = fs.readFileSync(pathMod.resolve(process.cwd(), "tokens", "tokens.css"), "utf8");
    const fixtur = JSON.parse(fs.readFileSync(pathMod.resolve(process.cwd(), "tokens", "sessionstudio-profil.json"), "utf8"));
    const roller = Object.keys(fixtur.typografi.roller).filter((n) => !n.startsWith("_"));
    expect(roller.sort()).toEqual(["etikett", "hjalp", "liten", "mikro", "rubrik", "sektion"]);
    for (const r of roller) {
      expect(css).toContain(`--text-${r}: ${fixtur.typografi.roller[r].storlek};`);
      expect(css).toContain(`--text-${r}--font-weight: ${fixtur.typografi.roller[r].vikt};`);
    }
    expect(css).toContain("--leading-tight: 1.25;");
    expect(css).toContain("--leading-normal: 1.5;");
    // SS:s tal, mätta: 10 px bottenradsetikett, 11 px hjälptext, 12 px versal sektionsrubrik.
    expect(fixtur.typografi.roller.liten.storlek).toBe("0.625rem");
    expect(fixtur.typografi.roller.hjalp.storlek).toBe("0.6875rem");
    expect(fixtur.typografi.roller.sektion.storlek).toBe("0.75rem");
  });

  it("varje roll har en _kalla med fil och rad ur SessionStudio (regeln: mät, gissa inte)", async () => {
    const fs = await import("node:fs");
    const pathMod = await import("node:path");
    const fixtur = JSON.parse(fs.readFileSync(pathMod.resolve(process.cwd(), "tokens", "sessionstudio-profil.json"), "utf8"));
    for (const [namn, roll] of Object.entries(fixtur.typografi.roller)) {
      if (namn.startsWith("_")) continue;
      expect(/** @type {any} */ (roll)._kalla, namn).toMatch(/\.jsx:\d+/);
    }
  });
});
