import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * Smart länk (0.128.0, cllp/lifehub.app#378, CP 2026-10-20): titel och artist i rubriken, källans ikon och omslaget, och ett tryck öppnar låten.
 * "Inget avancerat": ingen inbäddad spelare, ingen förhandsvisning utöver ikon och omslag, bara de fyra källorna.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const SPOTIFY = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";
const YOUTUBE = "https://youtu.be/dQw4w9WgXcQ";
const OMSLAG = "https://i.scdn.co/image/ab67616d0000b273";

const lank = (id, extra = {}) => ({
  ...byggPost({ groupId: "cps-ab", typ: "lank", rubrik: "Lose Yourself, Eminem", url: SPOTIFY, skapadAv: skapare, skapad: tid, andrad: tid, ...extra }),
  id,
});

function Harness({ start = [], onLankInfo = undefined, jag = JAG, startVald = null }) {
  const [vald, setVald] = useState(startVald);
  const [skapar, setSkapar] = useState(/** @type {any} */ (null));
  const [sparat, setSparat] = useState(/** @type {unknown[]} */ ([]));
  return (
    <>
      <OpsBibliotek
        poster={start}
        jag={jag}
        vald={vald}
        skapar={skapar}
        onOppna={(p) => { setSkapar(null); setVald(/** @type {any} */ (p)); }}
        onStang={() => { setVald(null); setSkapar(null); }}
        onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
        onSpara={(inmatning) => { setSparat((s) => [...s, inmatning]); }}
        onLankInfo={onLankInfo}
        hubHref="/hub"
      />
      <output data-sparat="">{JSON.stringify(sparat)}</output>
    </>
  );
}

const sparade = () => JSON.parse(document.querySelector("[data-sparat]")?.textContent || "[]");

async function nyLank() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ny post" }));
  await user.click(screen.getByRole("menuitem", { name: "Länk" }));
  return user;
}

describe("Ny länk: rubriken fylls i ur titel och artist", () => {
  it("en inklistrad Spotify-adress slås upp EN gång, rubriken blir 'titel, artist', och posten sparas med omslaget", async () => {
    const onLankInfo = vi.fn(async () => ({ titel: "Lose Yourself", artist: "Eminem", kalla: "annat-som-ignoreras", bild: OMSLAG }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Lose Yourself, Eminem"));
    expect(onLankInfo).toHaveBeenCalledTimes(1);
    expect(onLankInfo).toHaveBeenCalledWith(SPOTIFY);
    // Lämnas fältet efter inklistringen slås samma adress inte upp en andra gång.
    await user.tab();
    expect(onLankInfo).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Spara" }));
    const [inm] = sparade();
    expect(inm).toMatchObject({ typ: "lank", rubrik: "Lose Yourself, Eminem", url: SPOTIFY, bild: OMSLAG });
    // `kalla` i svaret ignoreras och skickas aldrig vidare: ramverket härleder den ur adressen.
    expect(Object.hasOwn(inm, "kalla")).toBe(false);
  });

  it("rubriken går att ändra efteråt, och det personen skrivit skrivs aldrig över av ett nytt uppslag", async () => {
    const onLankInfo = vi.fn(async (/** @type {string} */ url) => (url === SPOTIFY ? { titel: "Lose Yourself", artist: "Eminem" } : { titel: "Never Gonna Give You Up", artist: "Rick Astley" }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Lose Yourself, Eminem"));
    // Ett nytt uppslag får byta den rubrik uppslaget självt skrev...
    await user.clear(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(YOUTUBE);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Never Gonna Give You Up, Rick Astley"));
    // ...men inte en rubrik personen ändrat.
    await user.clear(screen.getByRole("textbox", { name: "Rubrik" }));
    await user.type(screen.getByRole("textbox", { name: "Rubrik" }), "Min egen");
    await user.clear(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    await waitFor(() => expect(onLankInfo).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Min egen");
  });

  it("en rubrik som skrivits INNAN adressen klistras in står kvar", async () => {
    const onLankInfo = vi.fn(async () => ({ titel: "Lose Yourself", artist: "Eminem" }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.type(screen.getByRole("textbox", { name: "Rubrik" }), "Träningen");
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    await waitFor(() => expect(onLankInfo).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Träningen");
  });

  it("⛔ faller uppslaget står rubrikfältet tomt och felet sägs i en rad, aldrig tyst; Spara säger att rubriken saknas", async () => {
    const onLankInfo = vi.fn(async () => {
      throw new Error("Spotify svarade 404.");
    });
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    const larm = await screen.findByText(/Titeln gick inte att hämta: Spotify svarade 404\. Skriv en rubrik själv\./);
    expect(larm).toHaveAttribute("role", "alert");
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(sparade()).toHaveLength(0);
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toMatch(/Rubriken saknas/);
    // Personen skriver en rubrik själv och sparar: det går.
    await user.type(screen.getByRole("textbox", { name: "Rubrik" }), "Låten");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(sparade()[0]).toMatchObject({ rubrik: "Låten", url: SPOTIFY, bild: null });
  });

  it("⛔ ett uppslag som lyckas utan titel och artist är också ett fel som sägs", async () => {
    const onLankInfo = vi.fn(async () => ({ bild: OMSLAG }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    expect(await screen.findByText(/Hittade ingen titel eller artist för länken/)).toHaveAttribute("role", "alert");
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("");
  });

  it("medan uppslaget pågår står en statusrad, och den försvinner när det är klart", async () => {
    let klar;
    const onLankInfo = vi.fn(() => new Promise((res) => { klar = res; }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    expect(await screen.findByText("Hämtar titel och artist.")).toHaveAttribute("role", "status");
    klar({ titel: "T", artist: "A" });
    await waitFor(() => expect(screen.queryByText("Hämtar titel och artist.")).toBeNull());
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("T, A");
  });

  it("⛔ ett svar för en adress som personen hunnit byta bort från kastas", async () => {
    /** @type {Record<string, (v: any) => void>} */
    const vantar = {};
    const onLankInfo = vi.fn((/** @type {string} */ url) => new Promise((res) => { vantar[url] = res; }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    await waitFor(() => expect(onLankInfo).toHaveBeenCalledTimes(1));
    await user.clear(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(YOUTUBE);
    await waitFor(() => expect(onLankInfo).toHaveBeenCalledTimes(2));
    // Det gamla svaret kommer sist och får inte skriva över.
    vantar[YOUTUBE]({ titel: "Rick", artist: "Astley", bild: OMSLAG });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Rick, Astley"));
    vantar[SPOTIFY]({ titel: "Gammal", artist: "Låt" });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("Rick, Astley");
  });

  it("en adress som skrivs för hand slås upp när fältet lämnas, inte medan man skriver", async () => {
    const onLankInfo = vi.fn(async () => ({ titel: "T", artist: "A" }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.type(screen.getByRole("textbox", { name: "Adress" }), SPOTIFY);
    expect(onLankInfo).not.toHaveBeenCalled();
    await user.tab();
    await waitFor(() => expect(onLankInfo).toHaveBeenCalledTimes(1));
    expect(onLankInfo).toHaveBeenCalledWith(SPOTIFY);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("T, A"));
  });

  it("en vanlig webbadress slås inte upp och ger inget fel: bara de fyra källorna", async () => {
    const onLankInfo = vi.fn(async () => ({ titel: "X" }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste("https://bolagsverket.se/");
    await user.tab();
    expect(onLankInfo).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Hämtar titel och artist.")).toBeNull();
  });

  it("utan `onLankInfo` görs inget uppslag och inget syns: en länk är som förut", async () => {
    render(<Harness />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    await user.tab();
    expect(screen.queryByText("Hämtar titel och artist.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("");
  });

  it("ett omslag som inte är en https-adress används inte, och det sägs; titeln fylls ändå i", async () => {
    const onLankInfo = vi.fn(async () => ({ titel: "T", artist: "A", bild: "http://i.scdn.co/a.jpg" }));
    render(<Harness onLankInfo={onLankInfo} />);
    const user = await nyLank();
    await user.click(screen.getByRole("textbox", { name: "Adress" }));
    await user.paste(SPOTIFY);
    expect(await screen.findByText(/Omslaget kunde inte användas/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rubrik" })).toHaveValue("T, A");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(sparade()[0].bild).toBeNull();
  });
});

describe("att ändra en sparad länk", () => {
  it("⛔ byts adressen utan ett nytt uppslag skickas `bild: null`: omslaget hörde till en annan låt", async () => {
    render(<Harness start={[lank("l1", { bild: OMSLAG })]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Lose Yourself, Eminem" }));
    await user.click(screen.getByRole("menuitem", { name: "Visa detaljer" }));
    await user.click(screen.getByRole("button", { name: "Åtgärder för Lose Yourself, Eminem" }));
    await user.click(screen.getByRole("menuitem", { name: "Redigera" }));
    await user.clear(screen.getByRole("textbox", { name: "Adress" }));
    await user.type(screen.getByRole("textbox", { name: "Adress" }), "https://youtu.be/abc");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(sparade()[0]).toMatchObject({ id: "l1", url: "https://youtu.be/abc", bild: null });
  });

  it("ändras bara rubriken följer omslaget med", async () => {
    render(<Harness start={[lank("l1", { bild: OMSLAG })]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Lose Yourself, Eminem" }));
    await user.click(screen.getByRole("menuitem", { name: "Visa detaljer" }));
    await user.click(screen.getByRole("button", { name: "Åtgärder för Lose Yourself, Eminem" }));
    await user.click(screen.getByRole("menuitem", { name: "Redigera" }));
    await user.clear(screen.getByRole("textbox", { name: "Rubrik" }));
    await user.type(screen.getByRole("textbox", { name: "Rubrik" }), "Nytt namn");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(sparade()[0]).toMatchObject({ id: "l1", rubrik: "Nytt namn", url: SPOTIFY, bild: OMSLAG });
  });
});

describe("listan visar källans ikon och omslaget, och ett tryck öppnar låten", () => {
  it("⛔ en musiklänk är en riktig länk till adressen, i ny flik, och öppnar inte detaljen", async () => {
    render(<Harness start={[lank("l1")]} />);
    const a = screen.getByRole("link", { name: "Öppna Lose Yourself, Eminem i Spotify" });
    expect(a).toHaveAttribute("href", SPOTIFY);
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("button", { name: "Lose Yourself, Eminem" })).toBeNull();
    // Ett tryck på länken byter inte vy i biblioteket.
    a.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(a);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bibliotek");
    expect(document.querySelector("[data-bibliotek-detalj]")).toBeNull();
  });

  it("en vanlig länk öppnar detaljen som förut: en knapp och inte en länk, och jordgloben som ikon", () => {
    render(<Harness start={[lank("v", { rubrik: "Bolagsverket", url: "https://bolagsverket.se/" })]} />);
    expect(screen.getByRole("button", { name: "Bolagsverket" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Öppna / })).toBeNull();
    expect(document.querySelector("[data-bibliotek-lankmark='annat']")).not.toBeNull();
    expect(document.querySelector("[data-kall-ikon]")).toBeNull();
    expect(document.querySelector("[data-bibliotek-typ]")?.textContent).toBe("Länk");
  });

  it("varje källa får sitt märke och sitt namn i etiketten", () => {
    const start = [
      lank("s", { rubrik: "A", url: SPOTIFY }),
      lank("y", { rubrik: "B", url: YOUTUBE }),
      lank("m", { rubrik: "C", url: "https://music.apple.com/se/album/x/1" }),
      lank("c", { rubrik: "D", url: "https://soundcloud.com/forss/flickermood" }),
    ];
    render(<Harness start={start} />);
    for (const [kalla, namn] of [["spotify", "Spotify"], ["youtube", "YouTube"], ["applemusic", "Apple Music"], ["soundcloud", "SoundCloud"]]) {
      expect(document.querySelector(`[data-kall-ikon='${kalla}']`), kalla).not.toBeNull();
      expect(screen.getAllByText(`Länk · ${namn}`), namn).toHaveLength(1);
    }
    for (const svg of document.querySelectorAll("[data-kall-ikon]")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    }
  });

  it("med ett omslag ritas bilden med källans märke i hörnet; utan omslag bara märket", () => {
    render(<Harness start={[lank("m", { bild: OMSLAG }), lank("u", { rubrik: "Utan", url: YOUTUBE })]} />);
    const mark = document.querySelector("[data-bibliotek-lankmark='spotify']");
    const bild = mark?.querySelector("img[data-bibliotek-omslag]");
    expect(bild).toHaveAttribute("src", OMSLAG);
    expect(bild).toHaveAttribute("alt", "");
    expect(bild).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(mark?.querySelector("[data-bibliotek-kallmarke='spotify']")).not.toBeNull();
    const utan = document.querySelector("[data-bibliotek-lankmark='youtube']");
    expect(utan?.querySelector("img")).toBeNull();
    expect(utan?.querySelector("[data-kall-ikon='youtube']")).not.toBeNull();
  });

  it("⛔ ett omslag som inte går att ladda byts mot källans märke, och raden finns kvar", () => {
    render(<Harness start={[lank("m", { bild: OMSLAG })]} />);
    const bild = document.querySelector("img[data-bibliotek-omslag]");
    expect(bild).not.toBeNull();
    fireEvent.error(/** @type {Element} */ (bild));
    expect(document.querySelector("img[data-bibliotek-omslag]")).toBeNull();
    expect(document.querySelector("[data-bibliotek-lankmark='spotify'] [data-kall-ikon='spotify']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Öppna Lose Yourself, Eminem i Spotify" })).toBeInTheDocument();
  });

  it("en länk från före 0.128.0 (utan `kalla` i dokumentet) får sitt märke ur adressen", () => {
    const gammal = { id: "g", groupId: "cps-ab", typ: "lank", rubrik: "Gammal", url: SPOTIFY, skapadAv: skapare, skapad: tid, andrad: tid };
    render(<Harness start={[gammal]} />);
    expect(document.querySelector("[data-kall-ikon='spotify']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Öppna Gammal i Spotify" })).toHaveAttribute("href", SPOTIFY);
  });

  it("detaljen nås ur menyn ('Visa detaljer'), visar källans namn, omslaget och adressen som länk, och har ingen spelare", async () => {
    render(<Harness start={[lank("l1", { bild: OMSLAG })]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Lose Yourself, Eminem" }));
    const meny = screen.getByRole("menu", { name: "Lose Yourself, Eminem" });
    expect(within(meny).getAllByRole("menuitem").map((r) => r.textContent)).toContain("Visa detaljer");
    await user.click(within(meny).getByRole("menuitem", { name: "Visa detaljer" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lose Yourself, Eminem");
    const lasning = document.querySelector("[data-bibliotek-lank-lasning]");
    expect(lasning?.querySelector("[data-bibliotek-kallnamn]")?.textContent).toBe("Spotify");
    expect(lasning?.querySelector("img[data-bibliotek-omslag]")).toHaveAttribute("src", OMSLAG);
    expect(within(/** @type {HTMLElement} */ (lasning)).getByRole("link", { name: SPOTIFY })).toHaveAttribute("href", SPOTIFY);
    // Ingen inbäddad spelare eller förhandsvisning (CP 2026-10-20).
    expect(document.querySelector("iframe, audio, video")).toBeNull();
    // I detaljen finns inte 'Visa detaljer' i menyn: man är redan där.
    await user.click(screen.getByRole("button", { name: "Åtgärder för Lose Yourself, Eminem" }));
    expect(screen.queryByRole("menuitem", { name: "Visa detaljer" })).toBeNull();
  });

  it("en vanlig länk har inte 'Visa detaljer': ett tryck på kortet öppnar redan detaljen", async () => {
    render(<Harness start={[lank("v", { rubrik: "Bolagsverket", url: "https://bolagsverket.se/" })]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Åtgärder för Bolagsverket" }));
    expect(screen.queryByRole("menuitem", { name: "Visa detaljer" })).toBeNull();
  });
});
