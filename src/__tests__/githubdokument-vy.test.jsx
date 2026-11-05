import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { githubDokumentUrl } from "../lib/githubdokument.js";

/*
 * Läsläget för en fil i gruppens GitHub-repo (0.186.0, cllp/lifehub.app#653).
 * ⛔ RÖTT UTAN ÄNDRINGEN: `githubLasare` finns inte i OpsBibliotek, så en GitHub-länk är bara en länk och inget läsläge ritas.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const urlFor = (/** @type {string} */ sokvag) => githubDokumentUrl({ agare: "cllp", repo: "bolag-ops", ref: "main", sokvag });
const lank = (/** @type {string} */ url) => ({ ...byggPost({ groupId: "cps-ab", typ: "lank", rubrik: "Dokument", url, skapadAv: skapare, skapad: tid, andrad: tid }), id: "p" });
const b64 = (/** @type {string} */ s) => btoa(s);
const ANDRAD = { andrad: "2026-11-03T10:00:00Z", av: "Kim" };

function visa(/** @type {any} */ post, /** @type {any} */ githubLasare, /** @type {any} */ extra = {}) {
  return render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" githubLasare={githubLasare} {...extra} />);
}

describe("utan githubLasare", () => {
  it("är en GitHub-länk som förut: adressen som länk, inget läsläge, ingen ikon", () => {
    const post = lank(urlFor("README.md"));
    const { container } = render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" />);
    expect(container.querySelector("[data-github-dokument]")).toBeNull();
    expect(container.querySelector("[data-bibliotek-lank]")?.getAttribute("href")).toBe(post.url);
  });

  it("listraden har inte GitHub-ikonen", () => {
    const { container } = render(<OpsBibliotek poster={[lank(urlFor("README.md"))]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" />);
    expect(container.querySelector('[data-bibliotek-ikon="repoDokument"]')).toBeNull();
    expect(container.querySelector('[data-bibliotek-ikon="lank"]')).not.toBeNull();
  });
});

describe("med githubLasare", () => {
  it("listraden får GitHub-ikonen, en vanlig länk behåller sin", () => {
    const vanlig = { ...lank("https://example.com/a"), id: "q" };
    const { container } = render(<OpsBibliotek poster={[lank(urlFor("README.md")), vanlig]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" githubLasare={async () => ({ lage: "last" })} />);
    expect(container.querySelectorAll('[data-bibliotek-ikon="repoDokument"]').length).toBe(1);
    expect(container.querySelectorAll('[data-bibliotek-ikon="lank"]').length).toBe(1);
  });

  it("en vanlig länk får ingen läsare anropad", () => {
    const lasare = vi.fn();
    visa(lank("https://example.com/a"), lasare);
    expect(lasare).not.toHaveBeenCalled();
  });

  it("väntar synligt (aria-busy och snurra) och anropar läsaren med posten", async () => {
    let los = (/** @type {any} */ _v) => {};
    const lasare = vi.fn(() => new Promise((r) => { los = r; }));
    const post = lank(urlFor("README.md"));
    const { container } = visa(post, lasare);
    const vantar = container.querySelector('[data-github-dokument="hamtar"]');
    expect(vantar?.getAttribute("aria-busy")).toBe("true");
    expect(vantar?.textContent).toContain("Hämtar filen från GitHub.");
    await waitFor(() => expect(lasare).toHaveBeenCalledTimes(1));
    expect(/** @type {any} */ (lasare.mock.calls[0])[0].url).toBe(post.url);
    los({ lage: "last", text: "# Hej", ...ANDRAD });
    await waitFor(() => expect(container.querySelector('[data-github-dokument="markdown"]')).not.toBeNull());
    expect(container.querySelector('[data-github-dokument="hamtar"]')).toBeNull();
  });

  it("raden Ändrad {datum} av {av} och länken Öppna i GitHub (ny flik, noopener)", async () => {
    const post = lank(urlFor("README.md"));
    const { container } = visa(post, async () => ({ lage: "last", text: "text", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector("[data-github-andrad]")).not.toBeNull());
    expect(container.querySelector("[data-github-andrad]")?.textContent).toMatch(/^Ändrad .*2026.* av Kim$/);
    const a = container.querySelector("[data-github-oppna]");
    expect(a?.getAttribute("href")).toBe(post.url);
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("raden och länken på engelska", async () => {
    const { container } = render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[lank(urlFor("README.md"))]} jag={JAG} vald={lank(urlFor("README.md"))} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" githubLasare={async () => ({ lage: "last", text: "x", ...ANDRAD })} />
      </OpsSprakProvider>,
    );
    await waitFor(() => expect(container.querySelector("[data-github-andrad]")).not.toBeNull());
    expect(container.querySelector("[data-github-andrad]")?.textContent).toMatch(/^Changed .* by Kim$/);
    expect(container.querySelector("[data-github-oppna]")?.textContent).toContain("Open in GitHub");
  });

  it("markdown ritas med OpsMarkdown, och en relativ bild blir text och ingen <img>", async () => {
    const { container } = visa(lank(urlFor("README.md")), async () => ({ lage: "last", text: "## Rubrik\n\nSe ![schema](img/a.png) och [mer](docs/b.md).", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector('[data-github-dokument="markdown"]')).not.toBeNull());
    const rot = /** @type {HTMLElement} */ (container.querySelector('[data-github-dokument="markdown"]'));
    expect(rot.textContent).toContain("Rubrik");
    expect(rot.textContent).toContain("Se schema och mer.");
    expect(rot.querySelector("img")).toBeNull();
    expect(rot.querySelector('a[href="docs/b.md"]')).toBeNull();
  });

  it("html ritas i den avspärrade rutan, med exakt sandlådan", async () => {
    const { container } = visa(lank(urlFor("rapport.html")), async () => ({ lage: "last", text: "<h1>Hej</h1><script>1</script>", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    const ram = container.querySelector("iframe");
    expect(ram?.getAttribute("sandbox")).toBe("allow-scripts allow-modals");
    expect(ram?.hasAttribute("src")).toBe(false);
    expect(ram?.getAttribute("srcdoc")).toContain("<h1>Hej</h1>");
    expect(container.querySelectorAll("iframe").length).toBe(1);
  });

  it("en bild ritas som <img> med data-URL och mime", async () => {
    const { container } = visa(lank(urlFor("bild.png")), async () => ({ lage: "last", base64: b64("PNGDATA"), mime: "image/png", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector("[data-github-bild]")).not.toBeNull());
    const img = container.querySelector("[data-github-bild]");
    expect(img?.getAttribute("src")).toBe(`data:image/png;base64,${b64("PNGDATA")}`);
    expect(img?.getAttribute("alt")).toBe("bild.png");
  });

  it("en bild utan mime tar typen ur ändelsen, och en mime utanför de fyra godtas inte", async () => {
    const { container } = visa(lank(urlFor("foto.jpg")), async () => ({ lage: "last", base64: b64("JPG"), mime: "image/svg+xml", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector("[data-github-bild]")).not.toBeNull());
    expect(container.querySelector("[data-github-bild]")?.getAttribute("src")).toBe(`data:image/jpeg;base64,${b64("JPG")}`);
  });

  it("en bild med trasig base64 är läget fel, aldrig en bruten bild", async () => {
    const { container } = visa(lank(urlFor("foto.png")), async () => ({ lage: "last", base64: "inte base64!!", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector('[data-github-lage="fel"]')).not.toBeNull());
    expect(container.querySelector("img")).toBeNull();
  });

  it("text ritas som text med åäö avkodat", async () => {
    const { container } = visa(lank(urlFor("anteckning.txt")), async () => ({ lage: "last", text: "för åäö", ...ANDRAD }));
    await waitFor(() => expect(container.querySelector('[data-bibliotek-text="klar"]')).not.toBeNull());
    expect(container.querySelector('[data-bibliotek-text="klar"]')?.textContent).toBe("för åäö");
  });

  it("csv ritas som text (en halv CSV-läsare visar fel kolumner utan att säga det)", async () => {
    const { container } = visa(lank(urlFor("tabell.csv")), async () => ({ lage: "last", text: 'a,b\n"x,1",2', ...ANDRAD }));
    await waitFor(() => expect(container.querySelector('[data-bibliotek-text="klar"]')).not.toBeNull());
    expect(container.querySelector('[data-bibliotek-text="klar"]')?.textContent).toBe('a,b\n"x,1",2');
    expect(container.querySelector("table")).toBeNull();
  });

  it("en pdf går genom bilageviset: en knapp som öppnar en dialog, aldrig en iframe i läsläget", async () => {
    const { container } = visa(lank(urlFor("avtal.pdf")), async () => ({ lage: "last", base64: b64("%PDF-1.4 x"), ...ANDRAD }));
    const knapp = await waitFor(() => {
      const k = container.querySelector("[data-github-pdf]");
      expect(k).not.toBeNull();
      return /** @type {HTMLElement} */ (k);
    });
    expect(knapp.getAttribute("data-github-pdf")).toBe("fil");
    expect(knapp.hasAttribute("data-bilaga-oppna")).toBe(true);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("en pdf som är större än bilageviset tar får texten och Ladda ned i stället för en dialog", async () => {
    const stor = "A".repeat(700_000);
    const { container } = visa(lank(urlFor("stor.pdf")), async () => ({ lage: "last", base64: stor, ...ANDRAD }));
    await waitFor(() => expect(container.querySelector("[data-github-kan-inte-visas]")).not.toBeNull());
    expect(container.textContent).toContain("Kan inte visas i appen.");
    expect(container.querySelector("[data-github-ladda-ned]")).not.toBeNull();
    expect(container.querySelector("[data-bilaga-oppna]")).toBeNull();
  });

  it.each(["rapport.docx", "tabell.xlsx", "arkiv.zip", "logo.svg"])("%s: 'Kan inte visas i appen.' och Ladda ned", async (namn) => {
    const { container } = visa(lank(urlFor(namn)), async () => ({ lage: "last", base64: b64("BYTES"), ...ANDRAD }));
    await waitFor(() => expect(container.querySelector("[data-github-kan-inte-visas]")).not.toBeNull());
    expect(container.textContent).toContain("Kan inte visas i appen.");
    expect(container.querySelector("[data-github-ladda-ned]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("Ladda ned sparar filen med namnet ur adressen", async () => {
    const klick = vi.fn();
    const skapa = vi.fn(() => "blob:test");
    const orig = { c: URL.createObjectURL, r: URL.revokeObjectURL };
    URL.createObjectURL = skapa;
    URL.revokeObjectURL = () => {};
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { klick(/** @type {HTMLAnchorElement} */ (this).download); });
    try {
      const { container } = visa(lank(urlFor("rapport.docx")), async () => ({ lage: "last", base64: b64("BYTES"), ...ANDRAD }));
      await waitFor(() => expect(container.querySelector("[data-github-ladda-ned]")).not.toBeNull());
      fireEvent.click(/** @type {HTMLElement} */ (container.querySelector("[data-github-ladda-ned] button")));
      await waitFor(() => expect(klick).toHaveBeenCalledWith("rapport.docx"));
    } finally {
      spy.mockRestore();
      URL.createObjectURL = orig.c;
      URL.revokeObjectURL = orig.r;
    }
  });
});

describe("lägena", () => {
  const ORD = /** @type {const} */ ({
    saknas: "Filen finns inte längre i repot.",
    obehorig: "GitHub-kopplingen når inte filen.",
    "inte-gruppens": "Filen ligger inte i gruppens kopplade repo.",
    "for-stor": "Filen är för stor för att visas.",
    fel: "Det gick inte att läsa filen just nu.",
  });
  it.each(Object.entries(ORD))("%s säger sitt ord och bär Öppna i GitHub", async (lage, text) => {
    const post = lank(urlFor("README.md"));
    const { container } = visa(post, async () => ({ lage }));
    await waitFor(() => expect(container.querySelector(`[data-github-lage="${lage}"]`)).not.toBeNull());
    expect(container.querySelector(`[data-github-lage="${lage}"]`)?.textContent).toBe(text);
    expect(container.querySelector("[data-github-oppna]")?.getAttribute("href")).toBe(post.url);
    expect(container.querySelector("[data-github-andrad]")).toBeNull();
  });

  it("for-stor med base64 ger Ladda ned, utan base64 bara länken", async () => {
    const med = visa(lank(urlFor("README.md")), async () => ({ lage: "for-stor", base64: b64("X") }));
    await waitFor(() => expect(med.container.querySelector('[data-github-lage="for-stor"]')).not.toBeNull());
    expect(med.container.querySelector("[data-github-ladda-ned]")).not.toBeNull();
    med.unmount();
    const utan = visa(lank(urlFor("README.md")), async () => ({ lage: "for-stor" }));
    await waitFor(() => expect(utan.container.querySelector('[data-github-lage="for-stor"]')).not.toBeNull());
    expect(utan.container.querySelector("[data-github-ladda-ned]")).toBeNull();
  });

  it("ett avvisat löfte ritas som fel, aldrig tyst", async () => {
    const { container } = visa(lank(urlFor("README.md")), () => Promise.reject(new Error("nätet")));
    await waitFor(() => expect(container.querySelector('[data-github-lage="fel"]')).not.toBeNull());
    expect(container.querySelector('[data-github-lage="fel"]')?.textContent).toBe("Det gick inte att läsa filen just nu.");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("ett synkront kast och ett svar utan känt läge är också fel", async () => {
    const a = visa(lank(urlFor("README.md")), () => { throw new Error("kast"); });
    await waitFor(() => expect(a.container.querySelector('[data-github-lage="fel"]')).not.toBeNull());
    a.unmount();
    const b = visa(lank(urlFor("README.md")), async () => ({ lage: "hittepå" }));
    await waitFor(() => expect(b.container.querySelector('[data-github-lage="fel"]')).not.toBeNull());
  });

  it("läget last utan innehåll för sin sort är fel, inte en tom ruta", async () => {
    const { container } = visa(lank(urlFor("README.md")), async () => ({ lage: "last" }));
    await waitFor(() => expect(container.querySelector('[data-github-lage="fel"]')).not.toBeNull());
  });
});
