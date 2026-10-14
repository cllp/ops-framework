import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, flyttaBibliotekspost } from "../data/bibliotekkalla.js";
import { arMittBibliotek, byggPost, farAndra, mittBibliotek, mittJag, postFel } from "../lib/bibliotek.js";

/**
 * Mitt bibliotek (0.101.0, lifehub.app#226): en plats som bara ägaren ser, och flytten mellan den och gruppen.
 * Reglerna provas i emulatorn (`rules/__tests__/mittbibliotek.test.mjs`). Här provas modellen, källan och vyn.
 */

const KIM = "uidKim";
const ANNAN = "uidAnnan";
const tid = 1_700_000_000_000;
const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });

describe("Mitt bibliotek: platsen", () => {
  it("är mitt~<uid>, och en grupp kan aldrig se ut så", () => {
    expect(mittBibliotek(KIM)).toBe("mitt~uidKim");
    expect(arMittBibliotek("mitt~uidKim")).toBe(true);
    expect(arMittBibliotek("cps-ab")).toBe(false);
    expect(arMittBibliotek("mitt~")).toBe(false);
    expect(arMittBibliotek("mitt~a/b")).toBe(false);
    expect(() => mittBibliotek("")).toThrow();
    expect(() => mittBibliotek("a/b")).toThrow();
  });

  it("en post i Mitt bibliotek är en giltig post, och en okänd plats är det inte", () => {
    const rad = { groupId: mittBibliotek(KIM), typ: "anteckning", rubrik: "Utkast", text: "x", skapadAv: skapare(KIM), skapad: tid, andrad: tid };
    expect(postFel(rad)).toBeNull();
    expect(postFel({ ...rad, groupId: "mitt~a/b" })).toMatch(/inte ett grupp-id/);
    expect(postFel({ ...rad, groupId: "Mitt~x" })).toMatch(/inte ett grupp-id/);
  });

  it("bara ägaren får ändra, och en roll i en grupp ger ingenting", () => {
    const post = { groupId: mittBibliotek(KIM), skapadAv: { uid: KIM } };
    expect(farAndra(post, mittJag(KIM))).toBe(true);
    expect(farAndra(post, { uid: ANNAN, roll: "agare" })).toBe(false);
    expect(farAndra(post, { uid: ANNAN, roll: "admin", groupId: mittBibliotek(KIM) })).toBe(false);
  });
});

describe("flyttaBibliotekspost", () => {
  function tvaPlatser() {
    const source = createMemorySource();
    const grupp = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare: () => skapare(KIM),
      jag: () => ({ uid: KIM, roll: "medlem", groupId: "cps-ab" }),
      anteckna: () => {},
      lagring: { laddaUpp: vi.fn(async () => {}) },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const laddaUppMitt = vi.fn(async () => {});
    const mitt = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: mittBibliotek(KIM),
      skapare: () => skapare(KIM),
      jag: () => mittJag(KIM),
      anteckna: () => {},
      lagring: { laddaUpp: laddaUppMitt },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    return { source, grupp, mitt, laddaUppMitt };
  }

  it("flyttar en anteckning med taggar: kopian finns, originalet är borta", async () => {
    const { grupp, mitt } = tvaPlatser();
    const post = await grupp.spara({ typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", taggar: ["styrelse"] });
    const ny = await flyttaBibliotekspost({ fran: grupp, till: mitt, id: post.id, satt: "flytta" });
    expect(ny.groupId).toBe(mittBibliotek(KIM));
    expect(ny.text).toBe("Vi beslutade.");
    expect(ny.taggar).toEqual(["styrelse"]);
    expect((await grupp.las()).poster).toHaveLength(0);
    expect((await mitt.las()).poster.map((p) => p.rubrik)).toEqual(["Protokoll"]);
  });

  it("en kopia lämnar originalet kvar", async () => {
    const { grupp, mitt } = tvaPlatser();
    const post = await grupp.spara({ typ: "lank", rubrik: "Verket", url: "https://bolagsverket.se/" });
    await flyttaBibliotekspost({ fran: grupp, till: mitt, id: post.id, satt: "kopiera" });
    expect((await grupp.las()).poster).toHaveLength(1);
    expect((await mitt.las()).poster).toHaveLength(1);
  });

  it("en fil flyttas genom sina byte till den nya platsens sökväg, med längd, våg och taggar", async () => {
    const { source, grupp, mitt, laddaUppMitt } = tvaPlatser();
    const rad = byggPost({
      groupId: "cps-ab",
      typ: "fil",
      rubrik: "Kvitto",
      fil: { sokvag: "grupper/cps-ab/bibliotek/f1/kvitto.pdf", namn: "kvitto.pdf", mime: "application/pdf", byte: 4 },
      taggar: ["kvitto"],
      skapadAv: skapare(KIM),
      skapad: tid,
      andrad: tid,
    });
    await source.create("bibliotek", { ...rad, id: "f1" });
    const blob = new Blob(["abcd"], { type: "application/pdf" });
    const hamtaFil = vi.fn(async () => blob);
    const ny = await flyttaBibliotekspost({ fran: grupp, till: mitt, id: "f1", satt: "flytta", hamtaFil });
    expect(hamtaFil).toHaveBeenCalledWith("grupper/cps-ab/bibliotek/f1/kvitto.pdf");
    expect(ny.fil?.sokvag).toBe(`grupper/${mittBibliotek(KIM)}/bibliotek/${ny.id}/kvitto.pdf`);
    expect(ny.taggar).toEqual(["kvitto"]);
    expect(laddaUppMitt).toHaveBeenCalledWith(expect.objectContaining({ fil: blob, contentType: "application/pdf" }));
    expect(await source.read("bibliotek", "f1")).toBeNull();
  });

  it("faller borttagningen säger felet att posten nu finns på båda ställena", async () => {
    const { grupp, mitt } = tvaPlatser();
    const post = await grupp.spara({ typ: "anteckning", rubrik: "P", text: "t" });
    const trasig = { ...grupp, radera: async () => { throw new Error("nekad"); } };
    await expect(flyttaBibliotekspost({ fran: trasig, till: mitt, id: post.id, satt: "flytta" })).rejects.toThrow(/finns nu på båda ställena/);
    expect((await mitt.las()).poster).toHaveLength(1);
    expect((await grupp.las()).poster).toHaveLength(1);
  });

  it("en flytt till samma plats och en post som inte finns nekas", async () => {
    const { grupp, mitt } = tvaPlatser();
    await expect(flyttaBibliotekspost({ fran: grupp, till: grupp, id: "x", satt: "flytta" })).rejects.toThrow("Posten ligger redan där.");
    await expect(flyttaBibliotekspost({ fran: grupp, till: mitt, id: "finns-inte", satt: "flytta" })).rejects.toThrow("Posten finns inte längre.");
  });
});

const gruppPost = (uid) => ({ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "x", skapadAv: skapare(uid), skapad: tid, andrad: tid }), id: "a" });
const minPost = { ...byggPost({ groupId: mittBibliotek(KIM), typ: "anteckning", rubrik: "Utkast", text: "x", skapadAv: skapare(KIM), skapad: tid, andrad: tid }), id: "m" };
const MITT_MAL = { id: mittBibliotek(KIM), namn: "Mitt bibliotek" };

function Vy({ poster, jag, grupper, onDela = vi.fn(() => Promise.resolve()), platser = [], plats = undefined, onPlats = undefined }) {
  const [vald, setVald] = useState(null);
  return (
    <OpsBibliotek
      poster={poster}
      jag={jag}
      vald={vald}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={() => {}}
      grupper={grupper}
      onDela={onDela}
      platser={platser}
      plats={plats}
      onPlats={onPlats}
      hubHref="/hub"
    />
  );
}

describe("OpsBibliotek: Mitt bibliotek i menyn", () => {
  it("författaren får Flytta och Kopiera till Mitt bibliotek, och flytten säger när den är klar", async () => {
    const onDela = vi.fn(() => Promise.resolve());
    render(<Vy poster={[gruppPost(KIM)]} jag={{ uid: KIM, roll: "medlem" }} grupper={[MITT_MAL]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Flytta till Mitt bibliotek" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ id: "a", groupId: MITT_MAL.id, satt: "flytta" }));
    expect(await screen.findByText("Flyttad till Mitt bibliotek.")).toBeInTheDocument();
  });

  it("en annan medlem, också en admin, får bara kopiera till sitt eget bibliotek", () => {
    render(<Vy poster={[gruppPost(ANNAN)]} jag={{ uid: KIM, roll: "admin" }} grupper={[MITT_MAL]} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    expect(screen.queryByRole("menuitem", { name: "Flytta till Mitt bibliotek" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Kopiera till Mitt bibliotek" })).toBeInTheDocument();
  });

  it("i Mitt bibliotek heter det Dela med gruppen, och det är en flytt", async () => {
    const onDela = vi.fn(() => Promise.resolve());
    render(<Vy poster={[minPost]} jag={mittJag(KIM)} grupper={[MITT_MAL, { id: "cps-ab", namn: "CPS" }]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Utkast" }));
    expect(screen.queryByRole("menuitem", { name: "Flytta till Mitt bibliotek" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela med CPS" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ id: "m", groupId: "cps-ab", satt: "flytta" }));
  });

  it("ett fel i flytten står kvar med skälet", async () => {
    const onDela = vi.fn(() => Promise.reject(new Error("Filen kunde inte hämtas.")));
    render(<Vy poster={[gruppPost(KIM)]} jag={{ uid: KIM, roll: "medlem" }} grupper={[MITT_MAL]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera till Mitt bibliotek" }));
    expect(await screen.findByText("Filen kunde inte hämtas.")).toBeInTheDocument();
  });

  it("växlaren visar båda platserna och byter plats", () => {
    const onPlats = vi.fn();
    render(
      <Vy
        poster={[gruppPost(KIM)]}
        jag={{ uid: KIM, roll: "medlem" }}
        grupper={[MITT_MAL]}
        platser={[{ id: "cps-ab", namn: "CPS" }, MITT_MAL]}
        plats="cps-ab"
        onPlats={onPlats}
      />,
    );
    const vaxlare = screen.getByRole("tablist", { name: "Vilket bibliotek" });
    expect(vaxlare).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Mitt bibliotek" }));
    expect(onPlats).toHaveBeenCalledWith(MITT_MAL.id);
  });

  it("med en enda plats syns ingen växlare", () => {
    render(<Vy poster={[gruppPost(KIM)]} jag={{ uid: KIM, roll: "medlem" }} grupper={[]} platser={[{ id: "cps-ab", namn: "CPS" }]} plats="cps-ab" />);
    expect(screen.queryByRole("tablist", { name: "Vilket bibliotek" })).toBeNull();
  });
});
