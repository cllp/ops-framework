import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * ⛔ GÄSTENS FILNAMN ÄR TEXT NÄR NEDLADDNING ÄR AV (cllp/ops-framework#560). Med `utanNedladdning` (lifehub.app#691) ritades filnamnet ändå som `<a href={adress}>` för video, textfil,
 * HTML utan `hamtaFil` och övriga filer: gästen kunde långtrycka, välja Kopiera länkadress och dela den signerade adressen, som öppnar filen för vem som helst i en kvart. Det är väg
 * som Kopiera länk stängdes för i menyn (0.210.0). Kvittot efter Kopiera länk var dessutom hårdkodad svenska.
 *
 * Kvittot går genom `ordet`. De tre proven längst ned låser fallen som saknades: medlemmens kvittens (ingen giltighetstid), gästens länkpost
 * (postens egen adress, inte en signering) och en länkpost när nedladdning är av (Kopiera länk står kvar, kvittot utan kvart).
 *
 * ⛔ RÖTT UTAN RÄTTNINGEN (regel 4), utfallen står i commit-meddelandet.
 */

const tid = 1_700_000_000_000;
const med = (/** @type {any} */ extra) => ({ groupId: "gast", skapadAv: { uid: "u1", namn: "Anna", typ: "manniska", kalla: "bibliotek" }, skapad: tid, andrad: tid, ...extra });
const somGast = (/** @type {any} */ p, /** @type {string} */ id) => ({ ...p, id, groupId: "gast", skapadAv: { uid: "", namn: "Anna" } });
const fil = (/** @type {string} */ id, /** @type {string} */ namn, /** @type {string} */ mime) => somGast(byggPost(med({ typ: "fil", rubrik: `Post ${id}`, fil: { sokvag: id, namn, mime, byte: 100 } })), id);

const FILER = {
  video: fil("v1", "film.mp4", "video/mp4"),
  textMedHamta: fil("t1", "anteckning.txt", "text/plain"),
  textUtanHamta: fil("t2", "lista.txt", "text/plain"),
  zip: fil("z1", "paket.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
  html: fil("h1", "sida.html", "text/html"),
};
const adressFor = (/** @type {string} */ id) => `https://signerad.exempel/${id}?sig=abc`;

function Vy({ post, utanNedladdning, hamtaFil, htmlVersioner }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  return (
    <OpsSprakProvider sprak={globalThis.__sprak ?? "sv"}>
      <OpsBibliotek
        poster={[post]}
        jag={null}
        vald={vald}
        onOppna={setVald}
        onStang={() => setVald(null)}
        onSkapa={() => {}}
        onSpara={async () => false}
        hamtaAdress={async (/** @type {string} */ s) => adressFor(s)}
        hamtaFil={hamtaFil}
        htmlVersioner={htmlVersioner}
        adresserPaBegaran
        utanHubb
        utanNedladdning={utanNedladdning}
      />
    </OpsSprakProvider>
  );
}

async function oppna(/** @type {any} */ post, /** @type {any} */ props) {
  const user = userEvent.setup();
  render(<Vy post={post} {...props} />);
  await user.click(screen.getByRole("button", { name: post.rubrik }));
  await waitFor(() => expect(document.querySelector("[data-bibliotek-fil]")).toBeTruthy());
  await waitFor(() => expect(document.body.textContent).toContain(post.fil.namn));
  return user;
}

const lankarMedAdress = () => [...document.querySelectorAll("a[href]")].filter((a) => (a.getAttribute("href") ?? "").includes("signerad.exempel"));
const hamtaFil = async () => new Blob(["hej"], { type: "text/plain" });

const FALL = /** @type {const} */ ([
  ["video", FILER.video, {}],
  ["textfil med hamtaFil", FILER.textMedHamta, { hamtaFil }],
  ["textfil utan hamtaFil", FILER.textUtanHamta, {}],
  ["övrig fil", FILER.zip, {}],
  ["HTML utan hamtaFil", FILER.html, { htmlVersioner: async () => [] }],
]);

describe("filnamnet i gästens detalj", () => {
  for (const [namn, post, props] of FALL) {
    it(`⛔ ${namn}: med nedladdning av är filnamnet text och ingen länk bär den signerade adressen`, async () => {
      await oppna(post, { ...props, utanNedladdning: true });
      expect(lankarMedAdress().map((a) => a.outerHTML)).toEqual([]);
      expect(document.querySelector("[data-bibliotek-filnamn]")?.textContent).toContain(post.fil.namn);
      expect(screen.queryByRole("link", { name: "Ladda ned" })).toBeNull();
    });
    it(`${namn}: med nedladdning på finns länken som förut`, async () => {
      await oppna(post, { ...props, utanNedladdning: false });
      const lank = document.querySelector("a[data-bibliotek-filnamnslank]");
      expect(lank?.getAttribute("href")).toBe(adressFor(post.id));
      expect(lank?.textContent).toContain(post.fil.namn);
    });
  }
});

describe("kvittot efter Kopiera länk följer språket", () => {
  const ursprung = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  afterEach(() => {
    delete (/** @type {any} */ (globalThis)).__sprak;
    if (ursprung) Object.defineProperty(navigator, "clipboard", ursprung);
    else delete (/** @type {any} */ (navigator)).clipboard;
  });

  it("⛔ engelska: kvittot med giltighetstid, och felet med adressen", async () => {
    globalThis.__sprak = "en";
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<Vy post={FILER.zip} utanNedladdning={false} />);
    await user.click(screen.getByRole("button", { name: "Actions for Post z1" }));
    await user.click(screen.getByRole("menuitem", { name: /Kopiera länk|Copy link/ }));
    expect(await screen.findByText("The link is copied. It is valid for 15 minutes.")).toBeTruthy();
  });

  it("⛔ engelska: ett urklipp som nekas ger felet på engelska, med adressen", async () => {
    globalThis.__sprak = "en";
    const user = userEvent.setup();
    // userEvent.setup() ersätter navigator.clipboard, så urklippet läggs in efteråt.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("nekad")) } });
    render(<Vy post={FILER.zip} utanNedladdning={false} />);
    await user.click(screen.getByRole("button", { name: "Actions for Post z1" }));
    await user.click(screen.getByRole("menuitem", { name: /Kopiera länk|Copy link/ }));
    expect(await screen.findByText(`The link could not be copied. The address is ${adressFor("z1")}`)).toBeTruthy();
  });

  it("svenska är oförändrat: Länken är kopierad. Den gäller i 15 minuter.", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const user = userEvent.setup();
    render(<Vy post={FILER.zip} utanNedladdning={false} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Post z1" }));
    await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    expect(await screen.findByText("Länken är kopierad. Den gäller i 15 minuter.")).toBeTruthy();
  });
});

describe("ljud utan spelarskal (granskningen av PR 561)", () => {
  const ljud = fil("l1", "inspelning.mp3", "audio/mpeg");
  const spelare = () => document.querySelectorAll("[data-ljudspelare], audio").length;
  /** @param {boolean} utanNedladdning */
  async function oppnaLjud(utanNedladdning) {
    const user = userEvent.setup();
    render(<Vy post={ljud} utanNedladdning={utanNedladdning} />);
    await user.click(screen.getByRole("button", { name: ljud.rubrik }));
    await waitFor(() => expect(spelare()).toBeGreaterThan(0));
  }
  it("⛔ med nedladdning av bär detaljens spelare ingen länk med den signerade adressen", async () => {
    await oppnaLjud(true);
    await waitFor(() => expect(document.querySelector("audio[src]")?.getAttribute("src") ?? "").toContain("signerad.exempel"));
    expect(lankarMedAdress().map((a) => a.outerHTML)).toEqual([]);
  });
  it("med nedladdning på har spelaren sin Ladda ned som förut", async () => {
    await oppnaLjud(false);
    await waitFor(() => expect(lankarMedAdress().length).toBeGreaterThan(0));
  });
});

/**
 * ⛔ KVITTOT ÄR OLIKA FÖR EN SIGNERAD FIL OCH FÖR EN VANLIG ADRESS (cllp/ops-framework#560). Gästens fil hämtas och gäller en kvart, så kvittot säger det.
 * Medlemmens adress och en länkposts egen adress gör inte det. `utanNedladdning` tar bort Kopiera länk på en fil, inte på en länkpost: länkens adress är inte en signering.
 */
const LANK_URL = "https://exempel.se/karta";
const LANK = somGast(byggPost(med({ typ: "lank", rubrik: "Kartan", url: LANK_URL })), "k1");
const MEDLEMSFIL = { id: "mf", ...byggPost(med({ groupId: "g1", typ: "fil", rubrik: "Avtal", fil: { sokvag: "mf", namn: "avtal.pdf", mime: "application/pdf", byte: 2048 } })) };
/** Filens nedladdningsadress. ⛔ (0.220.0, lifehub.app#801) Den lämnas aldrig ut av Kopiera länk. */
const FILENS_ADRESS = "https://lagring.exempel/avtal.pdf?token=hemlig";
/** Postens adress i appen, som Kopiera länk ger en medlem (`postlankBas` + `bibliotekslank`). */
const MEDLEMS_ADRESS = "https://app.exempel/bibliotek?plats=g1&post=mf";
const KVITTO = { sv: "Länken är kopierad.", en: "The link is copied." };

function Medlem({ sprak }) {
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsBibliotek
        poster={[MEDLEMSFIL]}
        jag={{ uid: "u1", namn: "Anna", roll: "medlem", status: "aktiv" }}
        vald={null}
        onOppna={() => {}}
        onStang={() => {}}
        onSkapa={() => {}}
        onSpara={async () => false}
        filUrl={() => FILENS_ADRESS}
        postlankBas="https://app.exempel/bibliotek"
        utanHubb
      />
    </OpsSprakProvider>
  );
}

function GastLank({ sprak, utanNedladdning, hamtaAdress }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsBibliotek
        poster={[LANK]}
        jag={null}
        vald={vald}
        onOppna={setVald}
        onStang={() => setVald(null)}
        onSkapa={() => {}}
        onSpara={async () => false}
        hamtaAdress={hamtaAdress}
        adresserPaBegaran
        utanHubb
        utanNedladdning={utanNedladdning}
      />
    </OpsSprakProvider>
  );
}

describe("kvittot för medlem, länkpost och nedladdning av", () => {
  const ursprung = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  /** @type {import("vitest").Mock} */
  let writeText;
  afterEach(() => {
    if (ursprung) Object.defineProperty(navigator, "clipboard", ursprung);
    else delete (/** @type {any} */ (navigator)).clipboard;
  });

  function urklipp() {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  }

  /**
   * @param {string} rubrik
   * @param {"sv" | "en"} sprak
   */
  async function kopiera(rubrik, sprak) {
    const user = userEvent.setup();
    urklipp();
    const knapp = sprak === "en" ? `Actions for ${rubrik}` : `Åtgärder för ${rubrik}`;
    await user.click(screen.getByRole("button", { name: knapp }));
    await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    expect(await screen.findByText(KVITTO[sprak])).toBeTruthy();
    expect(screen.queryByText(/15 minuter|15 minutes/)).toBeNull();
    return user;
  }

  it("⛔ medlemmens kvittens är den korta, på svenska och engelska, och adressen är postens i appen, aldrig filens (0.220.0)", async () => {
    const { unmount } = render(<Medlem sprak="sv" />);
    await kopiera("Avtal", "sv");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MEDLEMS_ADRESS));
    expect(writeText).not.toHaveBeenCalledWith(FILENS_ADRESS);
    unmount();

    render(<Medlem sprak="en" />);
    await kopiera("Avtal", "en");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MEDLEMS_ADRESS));
  });

  it("⛔ gästens länkpost kopierar postens adress och kvittot säger inte en kvart", async () => {
    const hamtaAdress = vi.fn(async () => adressFor("k1"));
    const { unmount } = render(<GastLank sprak="sv" utanNedladdning={false} hamtaAdress={hamtaAdress} />);
    await kopiera("Kartan", "sv");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LANK_URL));
    expect(hamtaAdress, "en länkpost har sin adress och hämtas inte").not.toHaveBeenCalled();
    unmount();

    const hamtaEn = vi.fn(async () => adressFor("k1"));
    render(<GastLank sprak="en" utanNedladdning={false} hamtaAdress={hamtaEn} />);
    await kopiera("Kartan", "en");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LANK_URL));
    expect(hamtaEn).not.toHaveBeenCalled();
  });

  it("⛔ en länkpost med utanNedladdning har kvar Kopiera länk, kvittot utan kvart, och ingen signerad adress i detaljen", async () => {
    const hamtaAdress = vi.fn(async () => adressFor("k1"));
    render(<GastLank sprak="sv" utanNedladdning hamtaAdress={hamtaAdress} />);
    const user = await kopiera("Kartan", "sv");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LANK_URL));
    expect(hamtaAdress).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Kartan" }));
    await waitFor(() => expect(document.querySelector("[data-bibliotek-lank]")?.getAttribute("href")).toBe(LANK_URL));
    expect(lankarMedAdress().map((a) => a.getAttribute("href"))).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Kartan" }));
    expect(screen.getByRole("menuitem", { name: "Kopiera länk" })).toBeTruthy();
  });
});
