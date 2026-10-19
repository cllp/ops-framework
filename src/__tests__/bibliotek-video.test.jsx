import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import {
  FILMIME,
  FILTAK,
  MAX_BIBLIOTEKFIL,
  MAX_BIBLIOTEKLJUD,
  MAX_BIBLIOTEKVIDEO,
  byggPost,
  filInmatningsfel,
  filMimeMonster,
  filSort,
  filTak,
  filtakRegel,
  filtreraBibliotek,
  mimeUrFilnamn,
  normaliseraMime,
} from "../lib/bibliotek.js";
import { bibliotekregelfragment, lagringsregelfragment } from "../lib/regler.js";
import { delningsTyp } from "../lib/delning.js";
import { createDelningService } from "../node/delning.js";
import { medlemskapsId } from "../lib/grupp.js";

/**
 * Video i Biblioteket (0.127.0, cllp/lifehub.app#358).
 *
 * ⛔ CP 2026-10-19: "Vi behöver kunna lägga upp upp till 100mb filer. Wav är vanligt och nödvändigt. Men andra filer kan vi ha mindre
 * storlek på." Ljud behåller 250 MB, övriga filer 25 MB, video får 100 MB. Taket har ETT hem (`FILTAK`) och klienten (`filTak`) och båda
 * reglerna (`filtakRegel`) läser det. Det mest centrala provet nedan kör REGELUTTRYCKET mot `filTak` för varje format och vid varje gräns,
 * så att de två inte kan säga olika (regel 2). Hur regeln beter sig i emulatorn mäts i `rules/__tests__/`.
 *
 * ⛔ Hur videon SER UT mäts inte här (jsdom kör ingen CSS och spelar ingen video): det mäts i `check-skalyta`.
 */

const MB = 1024 * 1024;

describe("formaten och taken", () => {
  it("mp4 och iPhones quicktime ingår i FILMIME, och inget annat videoformat", () => {
    expect(FILMIME).toContain("video/mp4");
    expect(FILMIME).toContain("video/quicktime");
    expect(FILMIME.filter((m) => m.startsWith("video/"))).toEqual(["video/mp4", "video/quicktime"]);
    // Båda reglerna bygger sitt mönster ur samma lista.
    const monster = new RegExp(filMimeMonster());
    expect(monster.test("video/mp4")).toBe(true);
    expect(monster.test("video/quicktime")).toBe(true);
    expect(monster.test("video/webm")).toBe(false);
    expect(monster.test("video/x-msvideo")).toBe(false);
  });

  it("⛔ .mp4, .m4v och .mov blir rätt MIME när webbläsaren inte säger någon (Windows ger ofta tom typ för .mov)", () => {
    expect(mimeUrFilnamn("Rep.mp4")).toBe("video/mp4");
    expect(mimeUrFilnamn("Rep.M4V")).toBe("video/mp4");
    expect(mimeUrFilnamn("IMG_0042.MOV")).toBe("video/quicktime");
    expect(mimeUrFilnamn("rep.avi")).toBe("");
    expect(mimeUrFilnamn("rep.mkv")).toBe("");
    // Ljudets ändelser är oförändrade.
    expect(mimeUrFilnamn("lat.wav")).toBe("audio/wav");
  });

  it("video/x-m4v (Safari om en .m4v) är samma format som video/mp4, och parametrar klipps", () => {
    expect(normaliseraMime("video/x-m4v")).toBe("video/mp4");
    expect(normaliseraMime("Video/MP4;codecs=avc1.42E01E")).toBe("video/mp4");
    expect(normaliseraMime("video/quicktime")).toBe("video/quicktime");
  });

  it("filSort ger video för video, och de andra sorterna är oförändrade", () => {
    expect(filSort("video/mp4")).toBe("video");
    expect(filSort("video/quicktime")).toBe("video");
    expect(filSort("video/x-m4v")).toBe("video");
    expect(filSort("audio/wav")).toBe("ljud");
    expect(filSort("image/png")).toBe("bild");
    expect(filSort("application/pdf")).toBe("dokument");
  });

  it("taken: video 100 MB, ljud 250 MB, allt annat 25 MB", () => {
    expect(MAX_BIBLIOTEKVIDEO).toBe(100 * MB);
    expect(filTak("video/mp4")).toBe(100 * MB);
    expect(filTak("video/quicktime")).toBe(100 * MB);
    expect(filTak("video/x-m4v")).toBe(100 * MB);
    expect(filTak("audio/wav")).toBe(250 * MB);
    expect(filTak("image/jpeg")).toBe(25 * MB);
    expect(filTak("application/pdf")).toBe(25 * MB);
    expect(filTak("")).toBe(25 * MB);
  });

  it("⛔ gränsen är inklusive: 100 MB går in, 100 MB + 1 nekas med ordet video, och en pdf får inte videons tak", () => {
    expect(filInmatningsfel({ namn: "rep.mp4", mime: "video/mp4", byte: 100 * MB })).toBeNull();
    expect(filInmatningsfel({ namn: "rep.mov", mime: "video/quicktime", byte: 100 * MB })).toBeNull();
    expect(filInmatningsfel({ namn: "rep.m4v", mime: "video/x-m4v", byte: 60 * MB })).toBeNull();
    expect(filInmatningsfel({ namn: "rep.mp4", mime: "video/mp4", byte: 100 * MB + 1 })).toBe(`Filen är ${100 * MB + 1} byte. Taket är ${100 * MB} för video.`);
    expect(filInmatningsfel({ namn: "rep.pdf", mime: "application/pdf", byte: 26 * MB })).toMatch(/Taket är 26214400\./);
    // Ljudets text är oförändrad.
    expect(filInmatningsfel({ namn: "lat.wav", mime: "audio/wav", byte: 250 * MB + 1 })).toMatch(/Taket är 262144000 för ljud\./);
    // Ett videoformat som inte står i listan nekas, hur litet det än är.
    expect(filInmatningsfel({ namn: "rep.webm", mime: "video/webm", byte: 1024 })).toMatch(/video\/webm/);
  });
});

describe("⛔ ett hem för varje tak: klienten och båda reglerna läser FILTAK", () => {
  /** Regeluttrycket som en funktion, så att det kan köras: `mime.matches('re')` blir ett RegExp-prov och resten är redan JavaScript. */
  const kor = (/** @type {string} */ uttryck) => {
    const js = uttryck.replace(/mime\.matches\('([^']*)'\)/g, (_, re) => `new RegExp(${JSON.stringify(re)}).test(mime)`);
    return /** @type {(mime: string, byte: number) => boolean} */ (new Function("mime", "byte", `return ${js};`));
  };

  it("uttrycket och filTak säger samma sak för varje format i FILMIME, på varje sida om varje gräns", () => {
    const uttryck = filtakRegel("mime", "byte");
    const regel = kor(uttryck);
    let kontrollerade = 0;
    for (const mime of FILMIME) {
      const tak = filTak(mime);
      for (const byte of [1, tak - 1, tak, tak + 1, MAX_BIBLIOTEKFIL, MAX_BIBLIOTEKFIL + 1, MAX_BIBLIOTEKVIDEO, MAX_BIBLIOTEKVIDEO + 1, MAX_BIBLIOTEKLJUD, MAX_BIBLIOTEKLJUD + 1]) {
        expect(regel(mime, byte), `${mime} ${byte}`).toBe(byte <= tak);
        kontrollerade += 1;
      }
    }
    // Golv: 15 format, 10 storlekar var. Ett prov som gick över noll format hade varit grönt av att inget mättes.
    expect(FILMIME.length).toBeGreaterThanOrEqual(15);
    expect(kontrollerade).toBe(FILMIME.length * 10);
  });

  /** Taken som står i en genererad regeltext: `matches('^familj/.*') && ... <= tak`. */
  const takIText = (/** @type {string} */ text) => [...text.matchAll(/matches\('\^(\w+)\/\.\*'\)\s*&&\s*[\w.]+\s*<=\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]);

  it("Firestore-regeln för posten och Storage-regeln bär var och en alla familjernas tak, ur FILTAK", () => {
    const forvantat = FILTAK.map((g) => [g.familj, g.tak]);
    expect(forvantat).toEqual([["audio", 250 * MB], ["video", 100 * MB]]);
    const sok = { gruppPrefix: "grupper", postPrefix: "bibliotek" };
    const firestore = takIText(bibliotekregelfragment("bibliotek", sok));
    const lagring = takIText(lagringsregelfragment({ bibliotek: { ...sok, samling: "bibliotek" } }));
    // Firestore-regeln bär dessutom ljudets egna villkor (`utskrift`, `durationMs`) som inte är tak, men de har inget `<=` mot ett byte-fält.
    expect(firestore).toEqual(forvantat);
    expect(lagring).toEqual(forvantat);
    // Det allmänna taket står också i båda.
    expect(bibliotekregelfragment("bibliotek", sok)).toContain(`<= ${MAX_BIBLIOTEKFIL}`);
    expect(lagringsregelfragment({ bibliotek: { ...sok, samling: "bibliotek" } })).toContain(`<= ${MAX_BIBLIOTEKFIL}`);
  });

  it("båda reglerna släpper in video/mp4 och video/quicktime ur samma mönster som klienten", () => {
    const sok = { gruppPrefix: "grupper", postPrefix: "bibliotek" };
    expect(bibliotekregelfragment("bibliotek", sok)).toContain(filMimeMonster());
    expect(lagringsregelfragment({ bibliotek: { ...sok, samling: "bibliotek" } })).toContain(filMimeMonster());
    expect(filMimeMonster()).toContain("video/mp4|video/quicktime");
  });
});

/** @param {string} id @param {string} rubrik @param {{ namn: string, mime: string }} fil @param {number} steg */
const filpost = (id, rubrik, { namn, mime }, steg) => ({
  ...byggPost({
    groupId: "cps-ab",
    typ: "fil",
    rubrik,
    fil: { sokvag: `grupper/cps-ab/bibliotek/${id}/${namn}`, namn, mime, byte: 2048 },
    skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" },
    skapad: 1_700_000_000_000,
    andrad: 1_700_000_000_000 + steg,
  }),
  id,
});

describe("flikarna: video ligger under Dokument och inte under Ljud eller Bilder", () => {
  it("fliken Dokument visar video och dokument, ingen annan flik visar videon, och varje post ligger under exakt en filflik", () => {
    const poster = [
      filpost("film", "Rep", { namn: "rep.mp4", mime: "video/mp4" }, 1),
      filpost("mov", "Resa", { namn: "resa.mov", mime: "video/quicktime" }, 2),
      filpost("pdf", "Avtal", { namn: "avtal.pdf", mime: "application/pdf" }, 3),
      filpost("bild", "Kvitto", { namn: "k.jpg", mime: "image/jpeg" }, 4),
      filpost("ljud", "Idé", { namn: "ide.webm", mime: "audio/webm" }, 5),
    ];
    expect(filtreraBibliotek(poster, { flik: "fil" }).map((p) => p.id).sort()).toEqual(["film", "mov", "pdf"]);
    expect(filtreraBibliotek(poster, { flik: "ljud" }).map((p) => p.id)).toEqual(["ljud"]);
    expect(filtreraBibliotek(poster, { flik: "bild" }).map((p) => p.id)).toEqual(["bild"]);
    const per = ["ljud", "bild", "fil"].flatMap((flik) => filtreraBibliotek(poster, { flik }).map((p) => p.id));
    expect(per.sort()).toEqual(["bild", "film", "ljud", "mov", "pdf"]);
    expect(filtreraBibliotek(poster, { flik: "alla" })).toHaveLength(5);
  });
});

const FORFATTARE = { uid: "uid-1", roll: "medlem" };

/** @param {{ start: any[], onLaddaUpp?: any }} props */
function Harness({ start, onLaddaUpp }) {
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
      onSpara={() => {}}
      onLaddaUpp={onLaddaUpp}
      filUrl={(p) => `https://exempel.se/${p.fil.sokvag}`}
      hubHref="/hub"
    />
  );
}

describe("OpsBibliotek: video i listan och i detaljen", () => {
  const film = filpost("film", "Replokal", { namn: "rep.mp4", mime: "video/mp4" }, 1);
  const pdf = filpost("pdf", "Avtal", { namn: "avtal.pdf", mime: "application/pdf" }, 2);

  it("⛔ detaljen spelar videon med en vanlig <video controls playsinline>, och ett dokument får ingen", () => {
    render(<Harness start={[film, pdf]} />);
    fireEvent.click(screen.getByRole("button", { name: "Replokal" }));
    const video = /** @type {HTMLVideoElement} */ (document.querySelector("video"));
    expect(video).not.toBeNull();
    expect(video.hasAttribute("controls")).toBe(true);
    // React skriver `playsInline` som attributet `playsinline`.
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("src")).toBe("https://exempel.se/grupper/cps-ab/bibliotek/film/rep.mp4");
    // Bara metadata hämtas innan någon trycker spela: filen kan vara 100 MB.
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.getAttribute("aria-label")).toBe("Replokal");
    // Utvägen när webbläsaren inte kan avkoda filen.
    expect(screen.getByRole("link", { name: /rep\.mp4/ })).toHaveAttribute("href", "https://exempel.se/grupper/cps-ab/bibliotek/film/rep.mp4");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.click(screen.getByRole("button", { name: "Avtal" }));
    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByRole("link", { name: /avtal\.pdf/ })).toBeInTheDocument();
  });

  it("kortet i listan säger Video, med ändelsen, och ligger under Dokument", () => {
    render(<Harness start={[film, pdf]} />);
    expect(document.querySelector('[data-bibliotek-kort="dokument"]')).not.toBeNull();
    expect(screen.getByText("Video · mp4")).toBeInTheDocument();
    expect(screen.getByText("Dokument · pdf")).toBeInTheDocument();
    // Listan spelar ingenting: ingen <video> förrän posten öppnas.
    expect(document.querySelector("video")).toBeNull();
  });

  it("⛔ en .mov utan typ från webbläsaren tas emot som quicktime, och en film över 100 MB nekas med ordet video", () => {
    const onLaddaUpp = vi.fn();
    render(<Harness start={[]} onLaddaUpp={onLaddaUpp} />);
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fil" }));
    const stor = new File(["x"], "stor.mp4", { type: "video/mp4" });
    Object.defineProperty(stor, "size", { value: 100 * MB + 1 });
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [stor] } });
    expect(screen.getAllByRole("alert").some((n) => /Taket är 104857600 för video/.test(n.textContent ?? ""))).toBe(true);
    const mov = new File(["x"], "IMG_1.MOV", { type: "" });
    Object.defineProperty(mov, "size", { value: 80 * MB });
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [mov] } });
    expect(screen.queryAllByRole("alert").some((n) => /Taket|Formatet/.test(n.textContent ?? ""))).toBe(false);
    expect(screen.getByText("IMG_1.MOV")).toBeInTheDocument();
  });
});

describe("createBibliotekskalla: en film laddas upp som en film", () => {
  it("mime, tak och innehållstyp följer filen, och ingen längd eller våg läses ur en film", async () => {
    const source = createMemorySource({ bibliotek: [] });
    const uppladdat = /** @type {any[]} */ ([]);
    const kalla = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare: () => ({ uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" }),
      lagring: { laddaUpp: async (/** @type {any} */ i) => { uppladdat.push(i); return { url: "minne://x", sokvag: i.sokvag }; }, taBort: async () => {} },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    const sparad = await kalla.laddaUppFil({ rubrik: "Resan", fil: { name: "IMG_7.MOV", type: "", size: 90 * MB, arrayBuffer } });
    expect(sparad.fil.mime).toBe("video/quicktime");
    expect(sparad.fil.byte).toBe(90 * MB);
    expect(sparad.fil.klar).toBe(true);
    expect(uppladdat[0].contentType).toBe("video/quicktime");
    // En film har ingen våg och ingen längd i posten, och filen läses inte hel för att få dem.
    expect(Object.hasOwn(sparad, "peaks")).toBe(false);
    expect(Object.hasOwn(sparad, "durationMs")).toBe(false);
    expect(arrayBuffer).not.toHaveBeenCalled();
    const m4v = await kalla.laddaUppFil({ rubrik: "Rep", fil: { name: "rep.m4v", type: "video/x-m4v", size: 10 * MB } });
    expect(m4v.fil.mime).toBe("video/mp4");
    await expect(kalla.laddaUppFil({ rubrik: "För stor", fil: { name: "stor.mp4", type: "video/mp4", size: 100 * MB + 1 } })).rejects.toThrow(/Taket är 104857600 för video/);
    expect(uppladdat).toHaveLength(2);
  });
});

describe("delning: en film delas med länk som andra filer", () => {
  it("skapa och hamta ger typen video och filens egen signerade adress", async () => {
    const GRUPP = "kallan";
    const MEDLEM = "uid-medlem";
    const kalla = createMemorySource({
      memberships: [{ id: medlemskapsId(MEDLEM, GRUPP), userId: MEDLEM, groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv", namn: "Medlem" }],
      bibliotek: [
        {
          id: "p-film",
          groupId: GRUPP,
          typ: "fil",
          rubrik: "Replokalen",
          skapadAv: { uid: MEDLEM, namn: "Medlem", typ: "manniska", kalla: "bibliotek" },
          skapad: 1_800_000_000_000 - 1000,
          andrad: 1_800_000_000_000 - 1000,
          fil: { sokvag: `grupper/${GRUPP}/bibliotek/p-film/rep.mp4`, namn: "rep.mp4", mime: "video/mp4", byte: 90 * MB, klar: true },
        },
      ],
      delningar: [],
    });
    const signeradAdress = vi.fn(async (/** @type {any} */ b) => `https://lagring.test/${b.sokvag}`);
    const tjanst = createDelningService({ kalla, lagring: { signeradAdress }, samlingar: { delningar: "delningar", bibliotek: "bibliotek" }, klocka: () => 1_800_000_000_000 });
    const delad = await tjanst.skapa({ uid: MEDLEM, postId: "p-film", groupId: GRUPP, dagar: 7, gruppdel: "travel", fildel: "replokalen" });
    const svar = /** @type {any} */ (await tjanst.hamta(delad.adress));
    expect(svar.ok).toBe(true);
    expect(svar.delning.typ).toBe("video");
    expect(svar.delning.mime).toBe("video/mp4");
    expect(svar.delning.url).toContain("rep.mp4");
    expect(delningsTyp("video/quicktime")).toBe("video");
  });
});
