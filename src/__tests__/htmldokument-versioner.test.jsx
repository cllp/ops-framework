import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { ORD_HTMLVERSIONER, arKonflikt, tolkaVersioner } from "../components/BibliotekHtmlVersioner.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Versionsraden för ett HTML-dokument i Biblioteket (0.158.0).
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: utan `BibliotekHtmlVersioner` och propparna `htmlVersioner`, `hamtaHtmlVersion`, `aterstallHtml` och `nyHtmlVersion` finns ingen rad "Versioner", så varje prov nedan som letar efter den är röd
 * (och filen kan inte ens laddas, eftersom modulen saknas). Skyddet som lagts till är mutationsprövat i CHANGELOG 0.158.0.
 */

const tid = 1_700_000_000_000;
const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const ANNA = { uid: "uid-2", namn: "Anna", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const ANNAN = { uid: "uid-9", roll: "medlem" };
const PLATS = "cps-ab";

const html = (extra = {}) => ({
  ...byggPost({ groupId: PLATS, typ: "fil", rubrik: "Rapport", fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/rapport.html`, namn: "rapport.html", mime: "text/html", byte: 20, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid, ...extra }),
  id: "p1",
});
const version3 = () => html({ version: { nr: 3, av: ANNA, tid: tid + 20_000 } });
const pdf = () => ({
  ...byggPost({ groupId: PLATS, typ: "fil", rubrik: "Avtal", fil: { sokvag: `grupper/${PLATS}/bibliotek/p2/avtal.pdf`, namn: "avtal.pdf", mime: "application/pdf", byte: 20, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid }),
  id: "p2",
});

/** Svaret från `html.versioner`: tre versioner, den nuvarande först. */
const lista3 = () => ({
  nuvarande: 3,
  versioner: [
    { nr: 3, nuvarande: true, fil: { sokvag: "x3" }, av: ANNA, tid: tid + 20_000, saknas: false },
    { nr: 2, nuvarande: false, fil: { sokvag: "x2" }, av: KIM, tid: tid + 10_000, saknas: false },
    { nr: 1, nuvarande: false, fil: { sokvag: "x1" }, av: KIM, tid, saknas: false },
  ],
  saknas: [],
});

/** @param {Record<string, any>} props */
function rita(props = {}) {
  const post = props.post ?? version3();
  return render(
    <OpsBibliotek
      poster={[post]}
      jag={props.jag ?? JAG}
      vald={post}
      onOppna={() => {}}
      onStang={() => {}}
      onSpara={() => {}}
      hubHref="/hub"
      filUrl={() => "https://lagring.example/fil"}
      hamtaFil={async () => new Blob(["<h1>Nu</h1>"], { type: "text/html" })}
      {...props.extra}
    />,
  );
}

/** Fäller ut raden och väntar tills listan finns. */
async function oppnaRaden() {
  fireEvent.click(await screen.findByText("Versioner"));
  await screen.findByLabelText("Versioner", { selector: "ul" });
}

const fil = (namn = "ny.html", text = "<p>ny</p>", typ = "text/html") => new File([text], namn, { type: typ });

describe("Versionsraden: när den finns", () => {
  it("syns för ett HTML-dokument när appen ger htmlVersioner, och visar vilken version det är utan att hämta något", async () => {
    const htmlVersioner = vi.fn(async () => lista3());
    rita({ extra: { htmlVersioner } });
    expect(await screen.findByText("Versioner")).toBeTruthy();
    expect(screen.getByText("Version 3")).toBeTruthy();
    // Listan hämtas först när raden fälls ut: den som aldrig tittar på historiken kostar inget anrop.
    expect(htmlVersioner).not.toHaveBeenCalled();
  });

  it("⛔ utan htmlVersioner är Biblioteket oförändrat: ingen rad", async () => {
    rita({ extra: {} });
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    expect(screen.queryByText("Versioner")).toBeNull();
    expect(document.querySelector("[data-html-versioner]")).toBeNull();
  });

  it("⛔ en PDF får ingen versionsrad, också när appen ger htmlVersioner", async () => {
    const htmlVersioner = vi.fn(async () => lista3());
    rita({ post: pdf(), extra: { htmlVersioner } });
    await screen.findByRole("link", { name: /avtal\.pdf/ });
    expect(screen.queryByText("Versioner")).toBeNull();
    expect(htmlVersioner).not.toHaveBeenCalled();
  });

  it("ritas också utan hamtaFil: dokumentet är då en nedladdning, men historiken går att läsa", async () => {
    rita({ extra: { hamtaFil: undefined, htmlVersioner: async () => lista3() } });
    await oppnaRaden();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByText("Version 2")).toBeTruthy();
  });
});

describe("Listan", () => {
  it("visar nummer, vem och när, och märker den nuvarande", async () => {
    rita({ extra: { htmlVersioner: async () => lista3() } });
    await oppnaRaden();
    const rader = document.querySelectorAll("[data-html-version]");
    expect([...rader].map((r) => r.getAttribute("data-html-version"))).toEqual(["3", "2", "1"]);
    expect(within(/** @type {HTMLElement} */ (rader[0])).getByText("Nuvarande")).toBeTruthy();
    expect(within(/** @type {HTMLElement} */ (rader[0])).getByText(/Anna/)).toBeTruthy();
    expect(within(/** @type {HTMLElement} */ (rader[1])).getByText(/Kim, .*2023/)).toBeTruthy();
    expect(within(/** @type {HTMLElement} */ (rader[1])).queryByText("Nuvarande")).toBeNull();
    // Den nuvarande öppnas redan i rutan ovanför: ingen Öppna eller Återställ på den.
    expect(within(/** @type {HTMLElement} */ (rader[0])).queryByRole("button")).toBeNull();
  });

  it("⛔ tomhet skrivs ut: en tom lista säger det", async () => {
    rita({ extra: { htmlVersioner: async () => ({ nuvarande: 1, versioner: [] }) } });
    fireEvent.click(await screen.findByText("Versioner"));
    expect(await screen.findByText("Inga versioner hittades.")).toBeTruthy();
  });

  it("⛔ ett svar i fel form säger det och går inte att läsa som en tom lista", async () => {
    rita({ extra: { htmlVersioner: async () => ({ nagot: "annat" }) } });
    fireEvent.click(await screen.findByText("Versioner"));
    expect(await screen.findByText(/Versionerna gick inte att hämta\. Svaret hade ett oväntat format\./)).toBeTruthy();
    expect(screen.queryByText("Inga versioner hittades.")).toBeNull();
  });

  it("⛔ ett fel vid hämtningen skrivs ut med orsaken, och Försök igen hämtar om", async () => {
    const htmlVersioner = vi.fn().mockRejectedValueOnce(new Error("nätet föll")).mockResolvedValueOnce(lista3());
    rita({ extra: { htmlVersioner } });
    fireEvent.click(await screen.findByText("Versioner"));
    expect(await screen.findByText(/Versionerna gick inte att hämta\. Det gick inte\. nätet föll/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Försök igen" }));
    await screen.findByLabelText("Versioner", { selector: "ul" });
    expect(htmlVersioner).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/nätet föll/)).toBeNull();
  });

  it("en version som borde finnas men saknas står med, utan knappar", async () => {
    const l = lista3();
    l.versioner[1] = { nr: 2, nuvarande: false, fil: /** @type {any} */ (null), av: /** @type {any} */ (null), tid: /** @type {any} */ (null), saknas: true };
    rita({ extra: { htmlVersioner: async () => l, hamtaHtmlVersion: async () => "x", aterstallHtml: async () => ({}) } });
    await oppnaRaden();
    const rad = /** @type {HTMLElement} */ (document.querySelector('[data-html-version="2"]'));
    expect(within(rad).getByText("Versionen saknas i historiken.")).toBeTruthy();
    expect(within(rad).queryByRole("button")).toBeNull();
  });

  it("listan hämtas om när dokumentets fil byter (appen har ritat om posten efter en ny version)", async () => {
    const htmlVersioner = vi.fn(async () => lista3());
    const a = version3();
    const props = { poster: [a], jag: JAG, vald: a, onOppna: () => {}, onStang: () => {}, onSpara: () => {}, hubHref: "/hub", filUrl: () => "https://lagring.example/fil", hamtaFil: async () => new Blob(["<p>x</p>"]), htmlVersioner };
    const { rerender } = render(<OpsBibliotek {...props} />);
    await oppnaRaden();
    expect(htmlVersioner).toHaveBeenCalledTimes(1);
    const b = { ...a, fil: { ...a.fil, sokvag: `grupper/${PLATS}/bibliotek/p1/v4-abc-rapport.html` }, version: { nr: 4, av: ANNA, tid: tid + 30_000 } };
    rerender(<OpsBibliotek {...props} poster={[b]} vald={b} />);
    await waitFor(() => expect(htmlVersioner).toHaveBeenCalledTimes(2));
  });
});

describe("Öppna en äldre version", () => {
  it("hämtar texten och ritar den i den avspärrade rutan, märkt som en äldre version", async () => {
    const hamtaHtmlVersion = vi.fn(async () => "<h1>Förra årets siffror</h1>");
    const post = version3();
    rita({ post, extra: { htmlVersioner: async () => lista3(), hamtaHtmlVersion } });
    await oppnaRaden();
    fireEvent.click(screen.getByRole("button", { name: "Öppna version 2" }));
    await waitFor(() => expect(document.querySelectorAll("iframe").length).toBe(2));
    expect(hamtaHtmlVersion).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), 2);
    const ruta = /** @type {HTMLIFrameElement} */ (document.querySelector("[data-html-versioner-oppen] iframe"));
    expect(ruta.getAttribute("srcdoc")).toContain("Förra årets siffror");
    // ⛔ Samma avspärrning som det nuvarande dokumentet: scripts och modaler, aldrig samma ursprung.
    expect(ruta.getAttribute("sandbox")).toBe("allow-scripts allow-modals");
    expect(screen.getByText("Du tittar på version 2, inte den nuvarande.")).toBeTruthy();
    expect(document.querySelector("[data-html-dokument-markning]:not(:empty)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    expect(document.querySelector("[data-html-versioner-oppen]")).toBeNull();
  });

  it("⛔ ett fel och en tom version skrivs ut i stället för en tom ruta", async () => {
    const hamtaHtmlVersion = vi.fn().mockRejectedValueOnce(new Error("finns inte")).mockResolvedValueOnce({ text: "   " });
    rita({ extra: { htmlVersioner: async () => lista3(), hamtaHtmlVersion } });
    await oppnaRaden();
    fireEvent.click(screen.getByRole("button", { name: "Öppna version 2" }));
    expect(await screen.findByText(/Version 2 gick inte att visa\. Det gick inte\. finns inte/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Öppna version 1" }));
    expect(await screen.findByText("Version 1 är tom.")).toBeTruthy();
    expect(document.querySelectorAll("iframe").length).toBe(1);
  });

  it("utan hamtaHtmlVersion finns ingen Öppna", async () => {
    rita({ extra: { htmlVersioner: async () => lista3() } });
    await oppnaRaden();
    expect(screen.queryByRole("button", { name: /Öppna version/ })).toBeNull();
  });
});

describe("Återställ", () => {
  it("anropar appen med versionen och den version personen såg, visar att den väntar, och läser om listan", async () => {
    let klar = /** @type {(v: unknown) => void} */ (() => {});
    const aterstallHtml = vi.fn(() => new Promise((los) => { klar = los; }));
    const htmlVersioner = vi.fn().mockResolvedValueOnce(lista3()).mockResolvedValue({ ...lista3(), nuvarande: 4, versioner: [{ nr: 4, nuvarande: true, av: KIM, tid: tid + 40_000, saknas: false }, ...lista3().versioner.map((v) => ({ ...v, nuvarande: false }))] });
    const post = version3();
    rita({ post, extra: { htmlVersioner, aterstallHtml } });
    await oppnaRaden();
    const knapp = screen.getByRole("button", { name: "Återställ version 1" });
    fireEvent.click(knapp);
    expect(aterstallHtml).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), 1, 3);
    // ⛔ Knappen väntar synligt (check-vantar kräver det av varje knapp som startar ett anrop): upptagen, med verbet i pågående form, och de andra är spärrade.
    await waitFor(() => expect(knapp).toHaveAttribute("aria-busy", "true"));
    expect(knapp.textContent).toContain("Återställer…");
    expect(screen.getByRole("button", { name: "Återställ version 2" })).toBeDisabled();
    klar({ ny: true, nr: 4, aterstallning: 1 });
    expect(await screen.findByText("Version 1 är återställd som version 4.")).toBeTruthy();
    await waitFor(() => expect(htmlVersioner).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Version 4")).toBeTruthy());
  });

  it("⛔ en återställning som inte blev en ny version säger det, i stället för att låtsas", async () => {
    rita({ extra: { htmlVersioner: async () => lista3(), aterstallHtml: async () => ({ ny: false, orsak: "oforandrad", nr: 3 }) } });
    await oppnaRaden();
    fireEvent.click(screen.getByRole("button", { name: "Återställ version 2" }));
    expect(await screen.findByText("Ingen ny version skapades: dokumentet har redan version 2:s innehåll.")).toBeTruthy();
  });

  it("⛔ en konflikt blir en mening med en knapp som läser om, och fran blir den nyare versionen", async () => {
    const aterstallHtml = vi.fn().mockRejectedValueOnce(Object.assign(new Error("Dokumentet har uppdaterats."), { kod: "konflikt" })).mockResolvedValueOnce({ ny: true, nr: 6 });
    const nyare = { nuvarande: 5, versioner: [{ nr: 5, nuvarande: true, av: ANNA, tid: tid + 50_000, saknas: false }, ...lista3().versioner.map((v) => ({ ...v, nuvarande: false }))] };
    const htmlVersioner = vi.fn().mockResolvedValueOnce(lista3()).mockResolvedValue(nyare);
    rita({ extra: { htmlVersioner, aterstallHtml } });
    await oppnaRaden();
    fireEvent.click(screen.getByRole("button", { name: "Återställ version 1" }));
    const varning = await screen.findByText(/Någon annan hann före, och dokumentet har en nyare version/);
    expect(varning.closest("[role=alert]")).toBeTruthy();
    // Orsaken i klartext från servern visas inte som ett "oväntat fel": det är en konflikt.
    expect(screen.queryByText(/Det gick inte\./)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Läs om" }));
    await waitFor(() => expect(screen.getByText("Version 5")).toBeTruthy());
    expect(screen.queryByText(/Någon annan hann före/)).toBeNull();
    // Nästa försök utgår från den nyare versionen.
    fireEvent.click(screen.getByRole("button", { name: "Återställ version 1" }));
    await waitFor(() => expect(aterstallHtml).toHaveBeenCalledTimes(2));
    expect(aterstallHtml.mock.calls[1].slice(1)).toEqual([1, 5]);
  });

  it("status 409 räknas också som en konflikt", () => {
    expect(arKonflikt({ status: 409 })).toBe(true);
    expect(arKonflikt({ httpStatus: 409 })).toBe(true);
    expect(arKonflikt({ kod: "konflikt" })).toBe(true);
    expect(arKonflikt({ code: "konflikt" })).toBe(true);
    expect(arKonflikt({ kod: "ogiltigt" })).toBe(false);
    expect(arKonflikt(new Error("409"))).toBe(false);
    expect(arKonflikt(null)).toBe(false);
  });

  it("⛔ andra fel skrivs ut med orsak, och listan står kvar", async () => {
    rita({ extra: { htmlVersioner: async () => lista3(), aterstallHtml: async () => { throw Object.assign(new Error("x"), { kod: "version-saknas" }); } } });
    await oppnaRaden();
    fireEvent.click(screen.getByRole("button", { name: "Återställ version 1" }));
    expect(await screen.findByText("Den versionen finns inte längre i historiken.")).toBeTruthy();
    expect(document.querySelectorAll("[data-html-version]").length).toBe(3);
  });

  it("⛔ den som inte får ändra posten ser ingen Återställ och ingen uppladdning, men kan öppna", async () => {
    rita({ jag: ANNAN, extra: { jag: ANNAN, htmlVersioner: async () => lista3(), hamtaHtmlVersion: async () => "<p>a</p>", aterstallHtml: async () => ({}), nyHtmlVersion: async () => ({}) } });
    await oppnaRaden();
    expect(screen.queryByRole("button", { name: /Återställ/ })).toBeNull();
    expect(screen.queryByText("Ladda upp ny version")).toBeNull();
    expect(screen.getByRole("button", { name: "Öppna version 2" })).toBeTruthy();
  });

  it("utan aterstallHtml finns ingen Återställ", async () => {
    rita({ extra: { htmlVersioner: async () => lista3(), hamtaHtmlVersion: async () => "<p>a</p>" } });
    await oppnaRaden();
    expect(screen.queryByRole("button", { name: /Återställ/ })).toBeNull();
  });
});

describe("Ladda upp en ny version", () => {
  const filfalt = () => /** @type {HTMLInputElement} */ (document.querySelector('[data-html-versioner-ny] input[type="file"]'));

  it("skickar filen och den version personen såg, och säger vilken version det blev", async () => {
    const nyHtmlVersion = vi.fn(async () => ({ ny: true, nr: 4 }));
    const htmlVersioner = vi.fn(async () => lista3());
    rita({ extra: { htmlVersioner, nyHtmlVersion } });
    await oppnaRaden();
    const f = fil("rapport-2.html");
    fireEvent.change(filfalt(), { target: { files: [f] } });
    await waitFor(() => expect(nyHtmlVersion).toHaveBeenCalledTimes(1));
    expect(nyHtmlVersion).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), f, 3);
    expect(await screen.findByText("Filen är sparad som version 4.")).toBeTruthy();
    await waitFor(() => expect(htmlVersioner).toHaveBeenCalledTimes(2));
  });

  it("knappen väntar synligt medan filen laddas upp", async () => {
    let klar = /** @type {(v: unknown) => void} */ (() => {});
    const nyHtmlVersion = vi.fn(() => new Promise((los) => { klar = los; }));
    rita({ extra: { htmlVersioner: async () => lista3(), nyHtmlVersion } });
    await oppnaRaden();
    fireEvent.change(filfalt(), { target: { files: [fil()] } });
    const knapp = await screen.findByRole("button", { name: /Laddar upp/ });
    expect(knapp).toHaveAttribute("aria-busy", "true");
    klar({ ny: true, nr: 4 });
    await screen.findByText("Filen är sparad som version 4.");
    expect(screen.getByRole("button", { name: "Ladda upp ny version" })).not.toHaveAttribute("aria-busy", "true");
  });

  it("⛔ en fil som inte är HTML nekas här med en mening, och appen anropas inte", async () => {
    const nyHtmlVersion = vi.fn(async () => ({}));
    rita({ extra: { htmlVersioner: async () => lista3(), nyHtmlVersion } });
    await oppnaRaden();
    fireEvent.change(filfalt(), { target: { files: [fil("bild.png", "x", "image/png")] } });
    expect(await screen.findByText("Välj en HTML-fil (.html eller .htm).")).toBeTruthy();
    fireEvent.change(filfalt(), { target: { files: [fil("tom.html", "", "text/html")] } });
    expect(await screen.findByText(/tom/i)).toBeTruthy();
    expect(nyHtmlVersion).not.toHaveBeenCalled();
  });

  it("en fil utan typ men med .html i namnet godtas", async () => {
    const nyHtmlVersion = vi.fn(async () => ({ ny: true, nr: 4 }));
    rita({ extra: { htmlVersioner: async () => lista3(), nyHtmlVersion } });
    await oppnaRaden();
    fireEvent.change(filfalt(), { target: { files: [fil("a.html", "<p>x</p>", "")] } });
    await waitFor(() => expect(nyHtmlVersion).toHaveBeenCalledTimes(1));
  });

  it("⛔ en fil som är lika med den nuvarande säger att ingen ny version skapades", async () => {
    rita({ extra: { htmlVersioner: async () => lista3(), nyHtmlVersion: async () => ({ ny: false, orsak: "oforandrad", nr: 3 }) } });
    await oppnaRaden();
    fireEvent.change(filfalt(), { target: { files: [fil()] } });
    expect(await screen.findByText("Ingen ny version skapades: filen är lika med den nuvarande versionen.")).toBeTruthy();
  });

  it("⛔ en konflikt vid uppladdningen visas som konflikt, och andra fel med sin orsak", async () => {
    const nyHtmlVersion = vi.fn()
      .mockRejectedValueOnce({ status: 409 })
      .mockRejectedValueOnce(Object.assign(new Error("tomt"), { kod: "for-stor" }));
    rita({ extra: { htmlVersioner: async () => lista3(), nyHtmlVersion } });
    await oppnaRaden();
    fireEvent.change(filfalt(), { target: { files: [fil()] } });
    expect(await screen.findByRole("button", { name: "Läs om" })).toBeTruthy();
    fireEvent.change(filfalt(), { target: { files: [fil()] } });
    expect(await screen.findByText("Filen är för stor.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Läs om" })).toBeNull();
  });

  it("utan nyHtmlVersion finns ingen uppladdning", async () => {
    rita({ extra: { htmlVersioner: async () => lista3() } });
    await oppnaRaden();
    expect(screen.queryByText("Ladda upp ny version")).toBeNull();
  });
});

describe("Språk och tolkning", () => {
  it("orden finns på svenska och engelska, och raden ritas på engelska", async () => {
    for (const [k, t] of Object.entries(ORD_HTMLVERSIONER)) {
      expect(t.sv, `sv ${k}`).toBeTruthy();
      expect(t.en, `en ${k}`).toBeTruthy();
      expect(`${t.sv}${t.en}`, `tankstreck ${k}`).not.toMatch(/[—–]/);
    }
    const post = version3();
    render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} htmlVersioner={async () => lista3()} aterstallHtml={async () => ({})} nyHtmlVersion={async () => ({})} />
      </OpsSprakProvider>,
    );
    fireEvent.click(await screen.findByText("Versions"));
    await screen.findByLabelText("Versions", { selector: "ul" });
    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore version 2" })).toBeTruthy();
    expect(screen.getByText("Upload new version")).toBeTruthy();
  });

  it("tolkaVersioner: bar lista, svar från tjänsten, fel form och ett nummer som inte är ett heltal", () => {
    expect(tolkaVersioner(lista3())?.rader.map((r) => r.nr)).toEqual([3, 2, 1]);
    expect(tolkaVersioner(lista3().versioner)?.nuvarande).toBe(3);
    expect(tolkaVersioner([{ nr: 1 }])?.nuvarande).toBe(1);
    expect(tolkaVersioner({ nuvarande: 1, versioner: [] })?.rader).toEqual([]);
    expect(tolkaVersioner(null)).toBeNull();
    expect(tolkaVersioner({ versioner: "x" })).toBeNull();
    expect(tolkaVersioner([{ nr: "2" }])).toBeNull();
    expect(tolkaVersioner([{ nr: 0 }])).toBeNull();
  });
});
