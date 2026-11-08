import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Profiler, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsMarkdown } from "../components/OpsMarkdown.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { medBildInsatt } from "../components/BibliotekAnteckningsbild.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, flyttaBibliotekspost } from "../data/bibliotekkalla.js";
import { byggPost } from "../lib/bibliotek.js";
import { bilderI, lankarI, markdownSomText, sakertBildnamn, splitInline, splitMarkdown } from "../lib/markdown.js";

/**
 * Bild i en anteckning (cllp/lifehub.app#696, skiva 1).
 *
 * EN anteckningstyp: bilden är `![alt](namn)` i anteckningens text och filen ligger i postens egen mapp. Proven mäter parsern (ett osäkert namn
 * blir text som förut), visningen (adressen frågas av appen, och utan den står en rad, aldrig ingenting), redigeringen (knappen och inklistringen,
 * som stannar i rutan) och att en anteckning med bilder inte flyttas utan dem. Hur bilden SER UT mäts inte här: jsdom kör ingen CSS.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const FORFATTARE = { uid: "uid-1", roll: "medlem" };

describe("markdown: bilden är ett säkert filnamn, annars text som förut", () => {
  it("`![alt](namn)` blir en bild med alt-texten och namnet, också med tom alt", () => {
    const [b] = splitMarkdown("![Kvitto från taxi](1731062400000-a1b2c3.jpg)");
    expect(b).toEqual({ kind: "paragraph", inline: [{ kind: "image", value: "Kvitto från taxi", namn: "1731062400000-a1b2c3.jpg" }] });
    expect(splitMarkdown("Före ![](bild.png) efter")[0]).toEqual({
      kind: "paragraph",
      inline: [{ kind: "text", value: "Före " }, { kind: "image", value: "", namn: "bild.png" }, { kind: "text", value: " efter" }],
    });
  });

  it("ett namn som inte är ett säkert segment ritas som text, hela tecknet för tecknet", () => {
    for (const namn of ["../hemlig.jpg", "a/b.jpg", "..", ".", "a..b.png", "bild med mellanslag.jpg", "bild?.jpg", "%2e%2e.jpg"]) {
      const rad = `![x](${namn})`;
      const bitar = splitInline(rad, { bilder: true });
      expect(bitar.some((b) => b.kind === "image"), namn).toBe(false);
      expect(bitar.map((b) => b.value).join(""), namn).toBe(rad);
    }
    expect(sakertBildnamn("")).toBe(false);
    expect(sakertBildnamn("ok-1_2.webp")).toBe(true);
  });

  it("⛔ en bild med en adress är ett `!` och en länk, precis som före bilderna (issue-texter från GitHub)", () => {
    const bitar = splitInline("![skärmbild](https://user-images.example.com/a.png)", { bilder: true });
    expect(bitar).toEqual([{ kind: "text", value: "!" }, { kind: "link", value: "skärmbild", url: "https://user-images.example.com/a.png" }]);
    expect(splitInline("![skärmbild](https://user-images.example.com/a.png)")).toEqual(bitar);
  });

  it("chatten, länklistan, utdraget och en kodsnutt tolkar ingen bild", () => {
    expect(splitMarkdown("![a](b.jpg)", { chatt: true })[0]).toEqual({ kind: "paragraph", inline: [{ kind: "text", value: "!" }, { kind: "text", value: "[a](b.jpg)" }] });
    expect(splitInline("![a](b.jpg)").some((b) => b.kind === "image")).toBe(false);
    expect(markdownSomText("![a](b.jpg)")).toBe("![a](b.jpg)");
    expect(lankarI("![a](https://x.se/b.jpg)")).toEqual([{ url: "https://x.se/b.jpg", text: "a" }]);
    expect(splitMarkdown("`![a](b.jpg)`")[0]).toEqual({ kind: "paragraph", inline: [{ kind: "code", value: "![a](b.jpg)" }] });
  });

  it("`bilderI` ger bildernas namn i ordning, utan dubbletter, utan kodblock och utan osäkra namn", () => {
    const text = "# Rubrik ![](r.jpg)\n\n- ![](lista.png)\n\n```\n![](kod.jpg)\n```\n\n![a](r.jpg) ![b](../ut.jpg)\n\n| ![](cell.gif) |\n|---|\n| x |";
    expect(bilderI(text)).toEqual(["r.jpg", "lista.png", "cell.gif"]);
    expect(bilderI("")).toEqual([]);
    expect(bilderI(null)).toEqual([]);
  });

  it("`medBildInsatt` lägger bilden på en egen rad vid markören", () => {
    expect(medBildInsatt("", 0, "a.jpg")).toEqual({ text: "![](a.jpg)", markor: 10 });
    expect(medBildInsatt("Hej då", 3, "a.jpg")).toEqual({ text: "Hej\n![](a.jpg)\n då", markor: 15 });
    expect(medBildInsatt("Rad\n", 4, "a.jpg").text).toBe("Rad\n![](a.jpg)");
    expect(medBildInsatt("Text", 99, "a.jpg").text).toBe("Text\n![](a.jpg)");
  });
});

describe("OpsMarkdown: bilden frågar appen efter sin adress", () => {
  it("utan `bildAdress` står en rad med alt-texten och \"Bilden visas inte här än.\", aldrig ingenting", () => {
    const { container } = render(<OpsMarkdown text={"Se här:\n\n![Biljetten](b.jpg)"} dokument />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-ops-markdown-bild='visas-inte']")?.textContent).toBe("Bild: Biljetten. Bilden visas inte här än.");
    const tom = render(<OpsMarkdown text={"![](b.jpg)"} />);
    expect(tom.container.textContent).toBe("Bilden visas inte här än.");
  });

  it("med en adress ritas bilden med alt-texten, lazy och högst behållarens bredd", async () => {
    const bildAdress = vi.fn((/** @type {string} */ namn) => `https://lagring.example/${namn}`);
    const { container } = render(<OpsMarkdown text={"![Biljetten](b.jpg)"} dokument bildAdress={bildAdress} />);
    const img = await waitFor(() => {
      const el = container.querySelector("img");
      if (!el) throw new Error("ingen bild än");
      return el;
    });
    expect(bildAdress).toHaveBeenCalledWith("b.jpg");
    expect(img.getAttribute("src")).toBe("https://lagring.example/b.jpg");
    expect(img.getAttribute("alt")).toBe("Biljetten");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.className).toContain("max-w-full");
  });

  it("ett löfte som avvisas, en tom adress och en bild som inte laddas säger det", async () => {
    const nej = render(<OpsMarkdown text={"![X](b.jpg)"} bildAdress={() => Promise.reject(new Error("403"))} />);
    expect(await nej.findByText("Bild: X. Bilden kunde inte visas.")).toBeInTheDocument();
    nej.unmount();
    const tom = render(<OpsMarkdown text={"![](b.jpg)"} bildAdress={() => ""} />);
    expect(await tom.findByText("Bilden kunde inte visas.")).toBeInTheDocument();
    tom.unmount();
    const trasig = render(<OpsMarkdown text={"![](b.jpg)"} bildAdress={() => "https://lagring.example/b.jpg"} />);
    const img = await waitFor(() => {
      const el = trasig.container.querySelector("img");
      if (!el) throw new Error("ingen bild än");
      return el;
    });
    fireEvent.error(img);
    expect(trasig.getByText("Bilden kunde inte visas.")).toBeInTheDocument();
    // Medan adressen hämtas står en rad, inte ett tomrum.
    const vantar = render(<OpsMarkdown text={"![](b.jpg)"} bildAdress={() => new Promise(() => {})} />);
    expect(vantar.getByText("Hämtar bilden.")).toBeInTheDocument();
  });

  it("⛔ en annan bild på samma plats ritas aldrig med förra bildens adress, inte ens en gång", async () => {
    /** @type {(url: string) => void} */
    let svaraB = () => {};
    const bildAdress = (/** @type {string} */ namn) => (namn === "a.jpg" ? "https://lagring.example/a.jpg" : new Promise((los) => { svaraB = los; }));
    /** @type {string[][]} */
    const ritat = [];
    // Profilern körs efter varje commit, före effekterna: det som står i DOM:en då är det som hann ritas.
    const vy = (/** @type {string} */ text) => (
      <Profiler id="bild" onRender={() => ritat.push(Array.from(document.querySelectorAll("img")).map((el) => el.getAttribute("src") ?? ""))}>
        <OpsMarkdown text={text} dokument bildAdress={bildAdress} />
      </Profiler>
    );
    const { rerender, container } = render(vy("![](a.jpg)"));
    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", "https://lagring.example/a.jpg"));
    ritat.length = 0;
    rerender(vy("![](b.jpg)"));
    expect(ritat.length).toBeGreaterThan(0);
    expect(ritat.flat()).not.toContain("https://lagring.example/a.jpg");
    expect(container.querySelector("img")).toBeNull();
    await act(async () => svaraB("https://lagring.example/b.jpg"));
    expect(container.querySelector("img")).toHaveAttribute("src", "https://lagring.example/b.jpg");
    expect(ritat.flat()).not.toContain("https://lagring.example/a.jpg");
  });

  it("på engelska", () => {
    const { container } = render(<OpsSprakProvider sprak="en"><OpsMarkdown text={"![Ticket](b.jpg)"} /></OpsSprakProvider>);
    expect(container.textContent).toBe("Image: Ticket. The image is not shown here yet.");
  });

  it("ett osäkert namn ritas som text och frågar aldrig appen", () => {
    const bildAdress = vi.fn(() => "https://x");
    const { container } = render(<OpsMarkdown text={"![x](../hemlig.jpg)"} bildAdress={bildAdress} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("![x](../hemlig.jpg)");
    expect(bildAdress).not.toHaveBeenCalled();
  });
});

/** @param {Record<string, any>} [extra] */
function anteckning(extra = {}) {
  return { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Kvitton", text: "Taxi i juli.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a1", ...extra };
}

/** @param {{ start?: any[], onLaggBildIAnteckning?: any, bildIAnteckningAdress?: any, onSpara?: any }} props */
function Harness({ start = [anteckning()], onLaggBildIAnteckning, bildIAnteckningAdress, onSpara = () => {} }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  const [skapar, setSkapar] = useState(/** @type {any} */ (null));
  return (
    <OpsBibliotek
      poster={start}
      jag={FORFATTARE}
      vald={vald}
      skapar={skapar}
      onOppna={(p) => { setSkapar(null); setVald(p); }}
      onStang={() => { setVald(null); setSkapar(null); }}
      onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
      onSpara={onSpara}
      hubHref="/hub"
      onLaggBildIAnteckning={onLaggBildIAnteckning}
      bildIAnteckningAdress={bildIAnteckningAdress}
    />
  );
}

function redigera() {
  fireEvent.click(screen.getByRole("button", { name: "Kvitton" }));
  fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Kvitton" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
}

const textruta = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Text" }));
const bild = (namn = "foto.png", typ = "image/png") => new File([new Uint8Array([1, 2, 3])], namn, { type: typ });

/** En inklistring med filerna och texten, som webbläsaren ger den. */
function klistra(/** @type {HTMLElement} */ el, /** @type {File[]} */ filer, text = "") {
  return fireEvent.paste(el, { clipboardData: { files: filer, getData: (/** @type {string} */ t) => (t === "text/plain" ? text : "") } });
}

describe("OpsBibliotek: Lägg till bild i en sparad anteckning", () => {
  it("utan propen finns ingen knapp, och redigeringen är som förut", () => {
    render(<Harness />);
    redigera();
    expect(textruta()).toHaveValue("Taxi i juli.");
    expect(screen.queryByRole("button", { name: "Lägg till bild" })).toBeNull();
  });

  it("knappen laddar upp genom appen och skriver `![](namn)` vid markören när svaret kommit", async () => {
    /** @type {(v: { namn: string }) => void} */
    let svara = () => {};
    const onLagg = vi.fn(() => new Promise((los) => { svara = los; }));
    render(<Harness onLaggBildIAnteckning={onLagg} />);
    redigera();
    const ruta = textruta();
    ruta.setSelectionRange(4, 4);
    fireEvent.change(screen.getByLabelText("Lägg till bild", { selector: "input" }), { target: { files: [bild()] } });
    expect(screen.getByText("Laddar upp bilden.")).toBeInTheDocument();
    await waitFor(() => expect(onLagg).toHaveBeenCalledTimes(1));
    // Krympningen (ramverkets `readAttachment`) ger appen en fil den kan ladda upp. jsdom kan inte avkoda bilden, så den går igenom som PNG.
    const [{ postId, plats, fil }] = /** @type {any} */ (onLagg.mock.calls[0]);
    expect({ postId, plats }).toEqual({ postId: "a1", plats: "cps-ab" });
    expect(fil).toBeInstanceOf(File);
    expect(fil.type).toBe("image/png");
    expect(fil.size).toBe(3);
    // ⛔ Texten pekar aldrig på en fil som inte finns: ingenting skrivs in innan svaret kommit.
    expect(ruta).toHaveValue("Taxi i juli.");
    await act(async () => svara({ namn: "1731062400000-a1b2c3.jpg" }));
    await waitFor(() => expect(ruta).toHaveValue("Taxi\n![](1731062400000-a1b2c3.jpg)\n i juli."));
    expect(ruta).toHaveValue("Taxi\n![](1731062400000-a1b2c3.jpg)\n i juli.");
    expect(screen.queryByText("Laddar upp bilden.")).toBeNull();
  });

  it("⛔ Spara och Avbryt väntar medan bilden laddas upp, så att den aldrig tappas tyst", async () => {
    /** @type {(v: { namn: string }) => void} */
    let svara = () => {};
    const onLagg = vi.fn(() => new Promise((los) => { svara = los; }));
    const onSpara = vi.fn(() => true);
    render(<Harness onLaggBildIAnteckning={onLagg} onSpara={onSpara} />);
    redigera();
    textruta().setSelectionRange(12, 12);
    fireEvent.change(screen.getByLabelText("Lägg till bild", { selector: "input" }), { target: { files: [bild()] } });
    await waitFor(() => expect(onLagg).toHaveBeenCalledTimes(1));
    const spara = screen.getByRole("button", { name: "Spara" });
    const avbryt = screen.getByRole("button", { name: "Avbryt" });
    expect(screen.getByText("Laddar upp bilden.")).toBeInTheDocument();
    expect(spara).toBeDisabled();
    expect(avbryt).toBeDisabled();
    fireEvent.click(spara);
    fireEvent.click(avbryt);
    // Ingenting sparades och rutan står kvar: svaret har någonstans att landa.
    expect(onSpara).not.toHaveBeenCalled();
    expect(textruta()).toHaveValue("Taxi i juli.");
    await act(async () => svara({ namn: "kvitto.jpg" }));
    await waitFor(() => expect(textruta()).toHaveValue("Taxi i juli.\n![](kvitto.jpg)"));
    expect(screen.queryByText("Laddar upp bilden.")).toBeNull();
    expect(screen.getByRole("button", { name: "Spara" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Avbryt" })).not.toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Spara" })); });
    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(/** @type {any} */ (onSpara).mock.calls[0])).toContain("![](kvitto.jpg)");
  });

  it("ett fel och ett osäkert namn syns, och texten står kvar", async () => {
    const onLagg = vi.fn().mockRejectedValueOnce(new Error("Storage nekade.")).mockResolvedValueOnce({ namn: "../ut.jpg" });
    render(<Harness onLaggBildIAnteckning={onLagg} />);
    redigera();
    const input = screen.getByLabelText("Lägg till bild", { selector: "input" });
    fireEvent.change(input, { target: { files: [bild()] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Bilden laddades inte upp: Storage nekade."));
    fireEvent.change(input, { target: { files: [bild()] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Bilden laddades upp men fick inget namn som går att skriva in i texten."));
    // En fil som inte är en bild, och en HEIC webbläsaren inte kan läsa, laddas aldrig upp.
    fireEvent.change(input, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Filen är ingen bild."));
    fireEvent.change(input, { target: { files: [new File(["x"], "IMG_1.HEIC", { type: "" })] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Bilden laddades inte upp: Filtypen/));
    expect(onLagg).toHaveBeenCalledTimes(2);
    expect(textruta()).toHaveValue("Taxi i juli.");
  });

  it("⛔ en inklistrad bild tas av rutan och når inte appens lyssnare på dokumentet", async () => {
    const onLagg = vi.fn(async () => ({ namn: "klistrad.png" }));
    const dokumentet = vi.fn();
    document.addEventListener("paste", dokumentet);
    try {
      render(<Harness onLaggBildIAnteckning={onLagg} />);
      redigera();
      textruta().setSelectionRange(12, 12);
      klistra(textruta(), [bild("image.png")]);
      await waitFor(() => expect(textruta()).toHaveValue("Taxi i juli.\n![](klistrad.png)"));
      expect(onLagg).toHaveBeenCalledTimes(1);
      expect(dokumentet).not.toHaveBeenCalled();
      // Text i urklippet är text, och går vidare som förut.
      klistra(textruta(), [bild("image.png")], "en mening");
      expect(onLagg).toHaveBeenCalledTimes(1);
      expect(dokumentet).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("paste", dokumentet);
    }
  });

  it("utan propen går en inklistrad bild vidare som förut", () => {
    const dokumentet = vi.fn();
    document.addEventListener("paste", dokumentet);
    try {
      render(<Harness />);
      redigera();
      klistra(textruta(), [bild()]);
      expect(dokumentet).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("paste", dokumentet);
    }
  });

  it("⛔ en ny anteckning har ingen knapp, och en inklistrad bild blir ingen egen post", () => {
    const onLagg = vi.fn();
    const dokumentet = vi.fn();
    document.addEventListener("paste", dokumentet);
    try {
      render(<Harness onLaggBildIAnteckning={onLagg} />);
      fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /anteckning/i }));
      expect(screen.queryByRole("button", { name: "Lägg till bild" })).toBeNull();
      klistra(textruta(), [bild()]);
      expect(onLagg).not.toHaveBeenCalled();
      expect(dokumentet).not.toHaveBeenCalled();
      expect(screen.getByText("Spara anteckningen först. Sedan går det att lägga till bilder.")).toBeInTheDocument();
    } finally {
      document.removeEventListener("paste", dokumentet);
    }
  });

  it("läsningen frågar appen efter bildens adress med postens id och plats", async () => {
    const adress = vi.fn(({ namn }) => Promise.resolve(`https://lagring.example/${namn}`));
    const { container } = render(<Harness start={[anteckning({ text: "Taxi.\n\n![Kvittot](k.jpg)" })]} bildIAnteckningAdress={adress} />);
    // Listans förhandsvisning visar ingen rå bildsyntax.
    expect(container.textContent).not.toContain("!k.jpg");
    expect(container.textContent).not.toContain("![");
    fireEvent.click(screen.getByRole("button", { name: "Kvitton" }));
    const img = await screen.findByRole("img", { name: "Kvittot" });
    expect(img).toHaveAttribute("src", "https://lagring.example/k.jpg");
    expect(adress).toHaveBeenCalledWith({ postId: "a1", plats: "cps-ab", namn: "k.jpg" });
  });

  it("utan adressprop står raden i läsningen", () => {
    render(<Harness start={[anteckning({ text: "![Kvittot](k.jpg)" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Kvitton" }));
    expect(screen.getByText("Bild: Kvittot. Bilden visas inte här än.")).toBeInTheDocument();
  });
});

describe("flytten tappar inga bilder", () => {
  const skapareFn = () => skapare;
  it("⛔ en anteckning med bilder flyttas och kopieras inte, och ingenting skrivs", async () => {
    const source = createMemorySource({ bibliotek: [] });
    const fran = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare: skapareFn, jag: () => ({ uid: "uid-1", roll: "medlem", groupId: "cps-ab" }), anteckna: async () => {} });
    const till = createBibliotekskalla({ source, collection: "bibliotek", groupId: "mitt~uid-1", skapare: skapareFn });
    const ny = await fran.spara({ typ: "anteckning", rubrik: "Med bild", text: "Se ![](a.jpg)" });
    for (const satt of /** @type {const} */ (["flytta", "kopiera"])) {
      await expect(flyttaBibliotekspost({ fran, till, id: ny.id, satt })).rejects.toThrow(/En anteckning med bilder flyttas eller kopieras inte/);
    }
    expect((await source.list("bibliotek", { where: { groupId: "mitt~uid-1" } })) ?? []).toEqual([]);
    expect(await fran.hamta(ny.id)).not.toBeNull();
    // En anteckning utan bild flyttas som förut.
    const utan = await fran.spara({ typ: "anteckning", rubrik: "Utan", text: "Bara text, och `![](kod.jpg)` i en kodsnutt." });
    const flyttad = await flyttaBibliotekspost({ fran, till, id: utan.id, satt: "flytta" });
    expect(flyttad.groupId).toBe("mitt~uid-1");
  });
});
