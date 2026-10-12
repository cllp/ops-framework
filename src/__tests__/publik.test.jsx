import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { OpsPublikSkal, OpsPublikHuvud, OpsPublikFot, OpsPublikHjalte, OpsPublikBlock, OpsPublikUppmaning, OpsPublikAvsnitt, OpsPublikText } from "../index.js";
import { PUBLIK_KLASS, PUBLIK_TONER } from "../lib/publikKlass.js";

// jsdom kör ingen CSS. Det här provet bevisar STRUKTUREN (rubriknivåer, namn, vad som kastar); att loggan ligger på samma
// plats och att brandfilen byter tonerna mäts i en riktig webbläsare av `scripts/check-brand.mjs`.

const TEXTER = { huvudnavigering: "Huvudnavigering", oppnaMeny: "Öppna meny", stangMeny: "Stäng meny", mobilmeny: "Mobilmeny" };
const LOGGA = { src: "/logga.svg", alt: "Exempelhubben" };
const LANKAR = [
  { href: "/a", label: "Alfa" },
  { href: "/b", label: "Beta", aktiv: true },
];

describe("OpsPublikHuvud (toppraden)", () => {
  it("ritar loggan först, länkarna efter, och höjden ur en token", () => {
    const { container } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={TEXTER} />);
    const nav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    const bild = within(nav).getByAltText("Exempelhubben");
    expect(bild.className).toContain("h-(--publik-logga-hojd)");
    expect(bild.closest("a").getAttribute("href")).toBe("/");
    const text = container.textContent;
    expect(text.indexOf("Alfa")).toBeGreaterThan(-1);
    expect(nav.querySelector("[data-publik-logga]")).toBe(bild.closest("a"));
    expect(screen.getByText("Beta").getAttribute("aria-current")).toBe("page");
  });

  it("språkvalet markerar det valda och anropar onVal", () => {
    const onVal = vi.fn();
    render(
      <OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={TEXTER} sprak={{ aktiv: "sv", val: [{ kod: "sv", label: "SV" }, { kod: "en", label: "EN" }], onVal, etikett: "Språk" }} />,
    );
    const grupp = screen.getByRole("group", { name: "Språk" });
    expect(within(grupp).getByText("SV").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(grupp).getByText("EN"));
    expect(onVal).toHaveBeenCalledWith("en");
  });

  it("mobilmenyn öppnas och stängs, och bär alla mobilLankar", () => {
    render(
      <OpsPublikHuvud logga={LOGGA} lankar={LANKAR} mobilLankar={[...LANKAR, { href: "/c", label: "Gamma" }]} loggaIn={{ href: "/app", label: "Logga in" }} kom={{ href: "/app", label: "Kom igång" }} texter={TEXTER} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Öppna meny" }));
    const dialog = screen.getByRole("dialog", { name: "Mobilmeny" });
    expect(within(dialog).getByText("Gamma")).toBeTruthy();
    expect(within(dialog).getAllByText("Kom igång").length).toBe(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng meny" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toppraden har två toner, mörk (förval) och ljus, och kastar på en okänd", () => {
    const { container, rerender } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={TEXTER} />);
    expect(container.querySelector("nav").className).toContain("bg-publik-mork");
    rerender(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={TEXTER} ton="ljus" />);
    expect(container.querySelector("nav").className).toContain("bg-publik-ljus");
    expect(container.querySelector("nav").className).not.toContain("bg-publik-mork");
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={TEXTER} ton="rosa" />)).toThrow(/okänd ton/);
    tyst.mockRestore();
  });

  it("loggan väljs efter toppradens ton: paMork på mörk, paLjus på ljus, annars src på båda", () => {
    const par = { paMork: "/ljus-ruta.png", paLjus: "/mork-ruta.png", alt: "Hubben" };
    const { container, rerender } = render(<OpsPublikHuvud logga={par} lankar={LANKAR} texter={TEXTER} />);
    expect(container.querySelector("[data-publik-logga] img").getAttribute("src")).toBe("/ljus-ruta.png");
    rerender(<OpsPublikHuvud logga={par} lankar={LANKAR} texter={TEXTER} ton="ljus" />);
    expect(container.querySelector("[data-publik-logga] img").getAttribute("src")).toBe("/mork-ruta.png");
    rerender(<OpsPublikHuvud logga={{ src: "/en.png", alt: "Hubben" }} lankar={LANKAR} texter={TEXTER} ton="ljus" />);
    expect(container.querySelector("[data-publik-logga] img").getAttribute("src")).toBe("/en.png");
    rerender(<OpsPublikHuvud logga={{ paMork: "/bara-mork.png", alt: "Hubben" }} lankar={LANKAR} texter={TEXTER} ton="ljus" />);
    expect(container.querySelector("[data-publik-logga] img").getAttribute("src")).toBe("/bara-mork.png");
  });

  it("kastar när loggan saknar alt eller texterna saknas: ramverket gissar inga ord", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsPublikHuvud logga={{ src: "/x.svg", alt: "" }} lankar={LANKAR} texter={TEXTER} />)).toThrow(/alt/);
    expect(() => render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={{ ...TEXTER, oppnaMeny: "" }} />)).toThrow(/texter\.oppnaMeny/);
    tyst.mockRestore();
  });
});

describe("OpsPublikHjalte", () => {
  it("är sidans enda h1 och namnges av den", () => {
    render(<OpsPublikHjalte title="Rubriken" eyebrow="Över" ingress="Ingress" />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.closest("header").getAttribute("aria-labelledby")).toBe(h1.id);
  });

  it("med bild: fotot, toningen och två knappar; alt krävs", () => {
    const { container } = render(
      <OpsPublikHjalte title="Rubriken" bild={{ src: "/h.webp", alt: "Fyra personer" }} primar={{ href: "/a", label: "Kom igång" }} sekundar={{ href: "/b", label: "Se live" }} malgrupp="För alla" />,
    );
    expect(screen.getByAltText("Fyra personer")).toBeTruthy();
    expect(container.querySelector(".ops-publik-hjaltetoning")).toBeTruthy();
    expect(screen.getByText("Kom igång").className).toContain("bg-accent");
    expect(screen.getByText("Se live").className).toContain("border-2");
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsPublikHjalte title="x" bild={{ src: "/h.webp", alt: "" }} />)).toThrow(/alt/);
    tyst.mockRestore();
  });
});

describe("OpsPublikBlock (tre toner, bilden växlar sida)", () => {
  it.each(["ljus", "accent", "mork"])("tonen %s ger bandets klass och bildens toning", (ton) => {
    const { container } = render(
      <OpsPublikBlock ton={ton} title="Rubrik" eyebrow="Över" bild={{ src: "/b.webp", alt: "Bild" }} handling={{ href: "/x", label: "Läs mer" }}>
        <p>Text</p>
      </OpsPublikBlock>,
    );
    const sektion = container.querySelector("section");
    expect(sektion.className).toBe(PUBLIK_TONER[ton].band);
    expect(sektion.getAttribute("data-ton")).toBe(ton);
    expect(container.querySelector(`.${PUBLIK_TONER[ton].toning}`)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Rubrik" })).toBeTruthy();
    expect(sektion.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { level: 2 }).id);
  });

  it("bildSida vanster vänder raden; figur ersätter fotot", () => {
    const { container } = render(
      <OpsPublikBlock title="Rubrik" bildSida="vanster" figur={<svg data-figur="" />}>
        <p>Text</p>
      </OpsPublikBlock>,
    );
    expect(container.querySelector(".lg\\:flex-row-reverse")).toBeTruthy();
    expect(container.querySelector("[data-figur]")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("kastar på okänd ton och okänd bildSida", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsPublikBlock ton="rosa" title="x" />)).toThrow(/okänd ton/);
    expect(() => render(<OpsPublikBlock bildSida="mitten" title="x" />)).toThrow(/bildSida/);
    tyst.mockRestore();
  });

  it("tonernas klassnamn är utskrivna och aldrig sammansatta (Tailwind läser text)", () => {
    for (const ton of Object.values(PUBLIK_TONER)) for (const klass of Object.values(ton)) expect(klass).not.toMatch(/\$\{/);
    expect(Object.keys(PUBLIK_TONER)).toEqual(["ljus", "accent", "mork"]);
  });
});

describe("OpsPublikUppmaning, OpsPublikFot och skalet", () => {
  it("uppmaningen har rubrik, text och två knappar", () => {
    render(<OpsPublikUppmaning title="Redo?" primar={{ href: "/a", label: "Kom igång" }} sekundar={{ href: "/b", label: "Prata" }}>Börja här.</OpsPublikUppmaning>);
    expect(screen.getByRole("heading", { level: 2, name: "Redo?" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Kom igång", "Prata"]);
  });

  it("sidfoten sätter året själv om det inte ges, och kräver navEtikett", () => {
    const { container } = render(<OpsPublikFot tagline="T" copyright="Hubben" navEtikett="Sidfot" ar={2026} grupper={[{ rubrik: "Produkt", lankar: [{ href: "/a", label: "Alfa" }] }]} />);
    expect(container.textContent).toContain("© 2026 Hubben");
    expect(screen.getByRole("navigation", { name: "Sidfot" })).toBeTruthy();
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsPublikFot tagline="T" copyright="x" />)).toThrow(/navEtikett/);
    tyst.mockRestore();
  });

  it("skalet lägger toppraden, main#main-content och sidfoten i ordning", () => {
    const { container } = render(
      <OpsPublikSkal huvud={<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} texter={TEXTER} />} fot={<OpsPublikFot tagline="T" copyright="x" navEtikett="Sidfot" />}>
        <OpsPublikAvsnitt title="Avsnitt"><OpsPublikText>Text.</OpsPublikText></OpsPublikAvsnitt>
      </OpsPublikSkal>,
    );
    const ordning = [...container.querySelectorAll("[data-ops-publik]")].map((e) => e.getAttribute("data-ops-publik"));
    expect(ordning).toEqual(["skal", "huvud", "avsnitt", "text", "fot"]);
    expect(container.querySelector("main#main-content")).toBeTruthy();
  });
});

describe("PUBLIK_KLASS (rollerna)", () => {
  it("bär rollerna text-publik-* och rubrikfamiljen font-display-publik, aldrig en storlek", () => {
    expect(PUBLIK_KLASS.hjalte).toContain("font-display-publik");
    expect(PUBLIK_KLASS.hjalte).toContain("text-publik-rubrik");
    expect(PUBLIK_KLASS.avsnitt).toContain("text-publik-block");
    expect(PUBLIK_KLASS.sida).toContain("text-publik-sida");
    expect(PUBLIK_KLASS.ingress).toContain("text-publik-ingress");
    expect(PUBLIK_KLASS.brod).toContain("text-publik-brod");
    for (const k of Object.values(PUBLIK_KLASS)) expect(k).not.toMatch(/text-\[|font-bold|font-semibold/);
  });
});
