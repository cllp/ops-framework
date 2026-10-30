import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsHtmlVy } from "../components/OpsHtmlDokument.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { HTML_SANDBOX, HTML_UTSKRIFTSMEDDELANDE, htmlVyAdress } from "../lib/htmldokument.js";

/*
 * HTML-dokument i ett eget fönster (0.159.0).
 *
 * CP 2026-10-30: "de skulle gå att öppna direkt i ett fönster. Inte ladda ner så." Lagringen svarar `attachment` för en HTML-fil (så att koden aldrig körs på lagringens eller appens ursprung), och därför laddades varje
 * direktlänk ned. Vyn (`OpsHtmlVy`) ritar dokumentet i hela fönstret i SAMMA avspärrade ruta som detaljen, och `oppnaHtml` på `OpsBibliotek` gör att ett tryck öppnar den i stället för att ladda ned.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `OpsHtmlVy`, `htmlVyAdress` och propen `oppnaHtml` finns inte, så filen kan inte ens laddas. De enskilda skydden är mutationsprövade (CHANGELOG 0.159.0): med `allow-same-origin` i
 * `HTML_SANDBOX`, med vyn ritad som en `src` mot en blob-adress och med en andra `<iframe` i en komponent är provsatserna som namnger dem röda.
 */

const rot = path.resolve(__dirname, "..", "..");
const tid = 1_700_000_000_000;
const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const PLATS = "cps-ab";

const html = (/** @type {Record<string, unknown>} */ extra = {}) => ({
  ...byggPost({ groupId: PLATS, typ: "fil", rubrik: "Rapport", fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/rapport.html`, namn: "rapport.html", mime: "text/html", byte: 2048, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid, ...extra }),
  id: "p1",
});
const pdf = () => ({
  ...byggPost({ groupId: PLATS, typ: "fil", rubrik: "Avtal", fil: { sokvag: `grupper/${PLATS}/bibliotek/p2/avtal.pdf`, namn: "avtal.pdf", mime: "application/pdf", byte: 2048, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid }),
  id: "p2",
});
const vyFor = (/** @type {{ id: string, groupId: string }} */ p) => `/bibliotek/visa/${p.id}?plats=${encodeURIComponent(p.groupId)}`;

const sida = "<!doctype html><html><body><h1>Årets siffror</h1><form action='https://exempel.example'><input name='x'></form></body></html>";
const hamtaSida = () => vi.fn(async () => new Blob([sida], { type: "text/html" }));

afterEach(() => vi.restoreAllMocks());

/** Väntar tills vyn ritat rutan (dokumentet är hämtat) och ger den. `waitFor` med ett uttryck som ger null väntar inte, så villkoret är ett förväntat. */
async function vantaRuta() {
  await waitFor(() => expect(document.querySelector("[data-html-vy-ruta]")).not.toBeNull());
  return /** @type {HTMLIFrameElement} */ (document.querySelector("[data-html-vy-ruta]"));
}

describe("OpsHtmlVy: dokumentet i hela fönstret", () => {
  it("fyller fönstret: en rad överst med namn, vem som laddade upp, Spara som PDF och Stäng, och rutan under tar resten", async () => {
    const onStang = vi.fn();
    render(<OpsHtmlVy hamta={hamtaSida()} sokvag="grupper/x/rapport.html" namn="Årsrapport.html" skapadAv={{ ...KIM, via: { nyckelId: "k1", namn: "Byggagent" } }} onStang={onStang} />);
    const ruta = await vantaRuta();
    const vy = /** @type {HTMLElement} */ (document.querySelector("[data-html-vy]"));
    expect(vy.className).toMatch(/\bh-dvh\b/);
    expect(vy.className).toMatch(/\bflex-col\b/);
    expect(ruta.className).toMatch(/\bflex-1\b/);
    expect(ruta.className).toMatch(/\bw-full\b/);
    expect(screen.getByRole("heading", { name: "Årsrapport.html" })).toBeTruthy();
    expect(document.querySelector("[data-html-vy-av]")?.textContent).toBe("Uppladdat av Kim via Byggagent");
    expect(document.querySelector("[data-html-vy-skydd]")?.textContent).toMatch(/avskilt från appen/);
    expect(document.querySelector("[data-html-vy-skydd]")?.textContent).toMatch(/lösenord/);
    expect(screen.getByRole("button", { name: "Spara som PDF" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    expect(onStang).toHaveBeenCalledTimes(1);
    expect(ruta.getAttribute("title")).toBe("HTML-dokument i helt fönster: Årsrapport.html");
  });

  it("⛔ rutan är SAMMA avspärrade ruta som i detaljen: exakt allow-scripts allow-modals, srcdoc och aldrig en adress", async () => {
    const skapa = vi.fn();
    const hamtad = vi.fn(async () => new Blob([sida]));
    // @ts-ignore: jsdom har ingen createObjectURL; spionen visar att vyn aldrig försöker.
    URL.createObjectURL = skapa;
    render(<OpsHtmlVy hamta={hamtad} sokvag="grupper/x/rapport.html" namn="rapport.html" />);
    const ruta = await vantaRuta();
    expect(HTML_SANDBOX).toBe("allow-scripts allow-modals");
    expect(ruta.getAttribute("sandbox")).toBe(HTML_SANDBOX);
    const delar = (ruta.getAttribute("sandbox") ?? "").split(/\s+/);
    for (const forbjudet of ["allow-same-origin", "allow-top-navigation", "allow-top-navigation-by-user-activation", "allow-popups", "allow-popups-to-escape-sandbox", "allow-forms", "allow-downloads"]) {
      expect(delar, forbjudet).not.toContain(forbjudet);
    }
    // Ingen `src`: innehållet är texten som hämtades med inloggningen, ritad som `srcdoc`.
    expect(ruta.hasAttribute("src")).toBe(false);
    expect(ruta.getAttribute("srcdoc")).toContain("Årets siffror");
    expect(ruta.getAttribute("srcdoc")?.indexOf("<script>")).toBeLessThan(ruta.getAttribute("srcdoc")?.indexOf("<h1>") ?? -1);
    expect(ruta.getAttribute("referrerpolicy")).toBe("no-referrer");
    // Ingen blob- eller data-adress någonstans i vyn, och ingen navigering.
    expect(skapa).not.toHaveBeenCalled();
    for (const el of document.querySelectorAll("[href],[src],[data]")) {
      for (const a of ["href", "src", "data"]) expect(el.getAttribute(a) ?? "", `${el.tagName} ${a}`).not.toMatch(/^(blob|data|javascript):/i);
    }
    // Filen hämtades en gång, med sökvägen, och vyn rörde ingen adress.
    expect(hamtad).toHaveBeenCalledTimes(1);
    expect(hamtad).toHaveBeenCalledWith("grupper/x/rapport.html");
  });

  it("⛔ Spara som PDF skickar utskriftsmeddelandet till rutan, och bara när dokumentet visas", async () => {
    render(<OpsHtmlVy hamta={hamtaSida()} sokvag="s" namn="rapport.html" />);
    const ruta = await vantaRuta();
    const skicka = vi.fn();
    Object.defineProperty(ruta, "contentWindow", { value: { postMessage: skicka }, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Spara som PDF" }));
    expect(skicka).toHaveBeenCalledWith({ typ: HTML_UTSKRIFTSMEDDELANDE }, "*");
  });

  it("tomhet, fel och väntan skrivs ut i fönstret, och Stäng finns kvar i alla tre", async () => {
    const onStang = vi.fn();
    const { unmount } = render(<OpsHtmlVy hamta={async () => { throw new Error("nätet"); }} sokvag="s" namn="rapport.html" onStang={onStang} />);
    expect(await screen.findByText(/Dokumentet gick inte att visa/)).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Spara som PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stäng" })).toBeTruthy();
    unmount();

    const { unmount: u2 } = render(<OpsHtmlVy hamta={async () => new Blob([""])} sokvag="s" namn="rapport.html" onStang={onStang} />);
    expect(await screen.findByText("Dokumentet är tomt.")).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Stäng" })).toBeTruthy();
    u2();

    render(<OpsHtmlVy hamta={() => new Promise(() => {})} sokvag="s" namn="rapport.html" onStang={onStang} />);
    expect(screen.getByRole("status")).toHaveTextContent("Hämtar dokumentet.");
    expect(screen.getByRole("button", { name: "Stäng" })).toBeTruthy();
  });

  it("utan onStang ritas ingen Stäng, med stangEtikett heter knappen det appen säger, och engelskan följer språket", async () => {
    const { unmount } = render(<OpsHtmlVy hamta={hamtaSida()} sokvag="s" namn="rapport.html" />);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    expect(screen.queryByRole("button", { name: "Stäng" })).toBeNull();
    unmount();
    const { unmount: u2 } = render(<OpsHtmlVy hamta={hamtaSida()} sokvag="s" namn="rapport.html" onStang={() => {}} stangEtikett="Till Biblioteket" />);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    expect(screen.getByRole("button", { name: "Till Biblioteket" })).toBeTruthy();
    u2();
    render(
      <OpsSprakProvider sprak="en">
        <OpsHtmlVy hamta={hamtaSida()} sokvag="s" namn="report.html" skapadAv={KIM} onStang={() => {}} />
      </OpsSprakProvider>,
    );
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    expect(screen.getByRole("button", { name: "Save as PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(document.querySelector("[data-html-vy-av]")?.textContent).toBe("Uploaded by Kim");
  });

  it("sidramens reserverade rullningslist släpps medan vyn visas och återställs när den lämnas", async () => {
    document.documentElement.style.scrollbarGutter = "stable";
    const { unmount } = render(<OpsHtmlVy hamta={hamtaSida()} sokvag="s" namn="rapport.html" />);
    await vantaRuta();
    expect(document.documentElement.style.scrollbarGutter).toBe("auto");
    unmount();
    expect(document.documentElement.style.scrollbarGutter).toBe("stable");
    document.documentElement.style.scrollbarGutter = "";
  });

  it("en ny hamta-funktion vid varje rendering hämtar inte om dokumentet", async () => {
    const hamtad = vi.fn(async () => new Blob([sida]));
    const { rerender } = render(<OpsHtmlVy hamta={(s) => hamtad(s)} sokvag="s" namn="rapport.html" />);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    rerender(<OpsHtmlVy hamta={(s) => hamtad(s)} sokvag="s" namn="rapport.html" />);
    rerender(<OpsHtmlVy hamta={(s) => hamtad(s)} sokvag="s" namn="rapport.html" />);
    expect(hamtad).toHaveBeenCalledTimes(1);
  });
});

describe("htmlVyAdress: adressen får bara vara en sida, aldrig en blob- eller data-adress", () => {
  const post = html();

  it("anropar funktionen bara för ett HTML-dokument med en fil", () => {
    const f = vi.fn(() => "/bibliotek/visa/p1");
    expect(htmlVyAdress(f, post)).toBe("/bibliotek/visa/p1");
    expect(htmlVyAdress(f, pdf())).toBe("");
    expect(htmlVyAdress(f, { ...post, fil: { ...post.fil, sokvag: "" } })).toBe("");
    expect(htmlVyAdress(f, { typ: "anteckning" })).toBe("");
    expect(htmlVyAdress(f, null)).toBe("");
    expect(f).toHaveBeenCalledTimes(1);
    expect(htmlVyAdress(undefined, post)).toBe("");
    expect(htmlVyAdress("/x", post)).toBe("");
  });

  it("null, undefined och tom text är ett svar (som förut), och ingen adress kastar inte", () => {
    for (const svar of [null, undefined, ""]) expect(htmlVyAdress(() => svar, post)).toBe("");
  });

  it("⛔ blob:, data:, javascript:, en adress utan protokoll och en protokollrelativ adress kastar, med skälet", () => {
    for (const svar of ["blob:https://app.example/1234", "data:text/html;base64,PGgxPg==", "javascript:alert(1)", "bibliotek/visa/p1", "//elak.example/x", " /x", "/x y", 42, {}]) {
      expect(() => htmlVyAdress(() => /** @type {any} */ (svar), post), String(svar)).toThrow(/oppnaHtml: svaret ska vara adressen till en sida i appen/);
    }
    expect(htmlVyAdress(() => "https://app.example/bibliotek/visa/p1", post)).toBe("https://app.example/bibliotek/visa/p1");
  });
});

describe("OpsBibliotek med oppnaHtml", () => {
  const rendera = (/** @type {Record<string, unknown>} */ extra = {}, poster = [html(), pdf()]) =>
    render(<OpsBibliotek poster={poster} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} {...extra} />);

  it("⛔ ett tryck på ett HTML-dokument i listan är en länk till vyn i ett nytt fönster, och ingenting laddas ned", async () => {
    const onOppna = vi.fn();
    rendera({ oppnaHtml: vyFor, onOppna });
    const lank = await screen.findByRole("link", { name: "Öppna Rapport i ett eget fönster" });
    expect(lank).toHaveAttribute("href", "/bibliotek/visa/p1?plats=cps-ab");
    expect(lank).toHaveAttribute("target", "_blank");
    expect(lank.getAttribute("rel")).toBe("noopener noreferrer");
    expect(lank.hasAttribute("download")).toBe(false);
    // Länken är kortets tryckyta, och adressen är aldrig filens eller en blob.
    expect(lank.getAttribute("href")).not.toMatch(/lagring|^blob:|^data:/);
    // Öppnas i eget fönster: detaljpanelen öppnas inte i det här.
    expect(onOppna).not.toHaveBeenCalled();
    // Inget annat HTML-kort har en knapp som öppnar panelen.
    expect(screen.queryByRole("button", { name: "Rapport" })).toBeNull();
  });

  it("⛔ övriga poster är oförändrade: en PDF öppnar panelen, och HTML utan oppnaHtml också", async () => {
    const onOppna = vi.fn();
    const { unmount } = rendera({ oppnaHtml: vyFor, onOppna });
    fireEvent.click(await screen.findByRole("button", { name: "Avtal" }));
    expect(onOppna).toHaveBeenCalledTimes(1);
    unmount();
    const onOppna2 = vi.fn();
    rendera({ onOppna: onOppna2 });
    expect(screen.queryByRole("link", { name: /eget fönster/ })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Rapport" }));
    expect(onOppna2).toHaveBeenCalledTimes(1);
  });

  it("oppnaHtml anropas inte för en post som inte är ett HTML-dokument, och svarar den null gäller posten som förut", async () => {
    const f = vi.fn(() => null);
    rendera({ oppnaHtml: f });
    await screen.findByRole("button", { name: "Rapport" });
    expect(screen.getByRole("button", { name: "Avtal" })).toBeTruthy();
    expect(f.mock.calls.every(([p]) => p.id === "p1")).toBe(true);
    expect(f).toHaveBeenCalled();
  });

  it("⛔ svarar oppnaHtml med en blob-adress kastar Biblioteket i stället för att länka dit", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => rendera({ oppnaHtml: () => "blob:https://app.example/1" })).toThrow(/oppnaHtml: svaret ska vara adressen till en sida i appen/);
    tyst.mockRestore();
  });

  it("menyn på kortet har Visa detaljer, så att rutan, versionerna och Ladda ned nås", async () => {
    const user = userEvent.setup();
    const onOppna = vi.fn();
    rendera({ oppnaHtml: vyFor, onOppna });
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Rapport" }));
    const rad = within(screen.getByRole("menu", { name: "Rapport" })).getByRole("menuitem", { name: /Visa detaljer/ });
    await user.click(rad);
    expect(onOppna).toHaveBeenCalledTimes(1);
    expect(onOppna.mock.calls[0][0].id).toBe("p1");
  });

  it("⛔ i detaljen öppnar filnamnet vyn i ett nytt fönster, Ladda ned är ett eget val, och rutan ritas som förut", async () => {
    const post = html();
    const hamtaFil = hamtaSida();
    rendera({ oppnaHtml: vyFor, vald: post, hamtaFil }, [post]);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    expect(document.querySelector("iframe")?.getAttribute("sandbox")).toBe("allow-scripts allow-modals");
    const oppna = /** @type {HTMLAnchorElement} */ (document.querySelector("[data-bibliotek-oppna-html]"));
    expect(oppna.getAttribute("href")).toBe("/bibliotek/visa/p1?plats=cps-ab");
    expect(oppna.getAttribute("target")).toBe("_blank");
    expect(oppna.getAttribute("rel")).toBe("noopener noreferrer");
    expect(oppna.hasAttribute("download")).toBe(false);
    expect(oppna.textContent).toContain("rapport.html");
    expect(oppna).toHaveAccessibleName(/rapport\.html.*Öppnas i ett eget fönster/);
    const ladda = screen.getByRole("link", { name: "Ladda ned" });
    expect(ladda).toHaveAttribute("href", "https://lagring.example/fil");
    expect(ladda).toHaveAttribute("download", "rapport.html");
    // Det är lagringens adress som laddas ned, och den ritas aldrig: den enda rutan har srcdoc.
    expect(document.querySelectorAll("iframe").length).toBe(1);
    expect(document.querySelector("iframe")?.hasAttribute("src")).toBe(false);
  });

  it("utan hamtaFil ritas ingen ruta i detaljen, men vyn och Ladda ned finns", async () => {
    const post = html();
    rendera({ oppnaHtml: vyFor, vald: post }, [post]);
    await screen.findByRole("link", { name: "Ladda ned" });
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector("[data-bibliotek-oppna-html]")?.getAttribute("href")).toBe("/bibliotek/visa/p1?plats=cps-ab");
  });

  it("⛔ utan oppnaHtml är detaljen som förut: filnamnet är nedladdningen och Ladda ned finns inte som eget val", async () => {
    const post = html();
    rendera({ vald: post, hamtaFil: hamtaSida() }, [post]);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    const lank = screen.getByRole("link", { name: /rapport\.html/ });
    expect(lank).toHaveAttribute("href", "https://lagring.example/fil");
    expect(lank).toHaveAttribute("download", "rapport.html");
    expect(screen.queryByRole("link", { name: "Ladda ned" })).toBeNull();
    expect(document.querySelector("[data-bibliotek-oppna-html]")).toBeNull();
  });
});

describe("⛔ det finns bara en väg in för HTML: en ruta, och aldrig en blob- eller data-adress", () => {
  /** Alla .js och .jsx under src, utan prov. */
  function filer(/** @type {string} */ mapp) {
    /** @type {string[]} */
    const ut = [];
    for (const f of fs.readdirSync(mapp, { withFileTypes: true })) {
      if (f.name === "__tests__" || f.name === "node_modules") continue;
      const sokvag = path.join(mapp, f.name);
      if (f.isDirectory()) ut.push(...filer(sokvag));
      else if (/\.(jsx?|mjs)$/.test(f.name)) ut.push(sokvag);
    }
    return ut;
  }
  /** Källan utan kommentarer: rader som börjar med `*`, `//` eller `/*`. En närvarokontroll i en kommentar mäter ingenting. */
  const kod = (/** @type {string} */ fil) => fs.readFileSync(fil, "utf8").split("\n").filter((r) => !/^\s*(\*|\/\/|\/\*)/.test(r)).join("\n");

  it("`<iframe` står på exakt ett ställe i src, och det ställe sätter sandboxen", () => {
    const alla = filer(path.join(rot, "src"));
    // Golv: ett prov som läser ingenting är grönt av fel skäl.
    expect(alla.length).toBeGreaterThan(150);
    const med = alla.filter((f) => /<iframe\b/.test(kod(f)));
    expect(med.map((f) => path.relative(rot, f))).toEqual(["src/components/OpsHtmlDokument.jsx"]);
    const k = kod(med[0]);
    expect((k.match(/<iframe\b/g) ?? []).length).toBe(1);
    expect(k).toMatch(/sandbox=\{HTML_SANDBOX\}/);
    expect(k).not.toMatch(/\ballow-same-origin\b/);
  });

  it("ingen komponent skapar en blob-adress, och ingen sätter `src` på en ruta", () => {
    const komponenter = filer(path.join(rot, "src", "components"));
    expect(komponenter.length).toBeGreaterThan(100);
    for (const f of komponenter) {
      expect(kod(f), path.relative(rot, f)).not.toMatch(/createObjectURL/);
    }
    expect(kod(path.join(rot, "src", "components", "OpsHtmlDokument.jsx"))).not.toMatch(/\bsrc=\{/);
  });

  it("sandlådan i lib är exakt de två orden, och ingen annan kod i src skriver ett sandbox-värde", () => {
    const alla = filer(path.join(rot, "src"));
    const sandbox = alla.filter((f) => /\bsandbox\s*=/.test(kod(f))).map((f) => path.relative(rot, f));
    expect(sandbox).toEqual(["src/components/OpsHtmlDokument.jsx"]);
    expect(kod(path.join(rot, "src", "lib", "htmldokument.js"))).toMatch(/HTML_SANDBOX = "allow-scripts allow-modals";/);
  });
});
