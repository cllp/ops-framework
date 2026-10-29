import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createKalenderkalla } from "../data/kalenderkalla.js";
import {
  DELADPOST_HANDELSEPREFIX,
  byggKalenderdelning,
  deladKalenderRadId,
  deladKalenderTillVal,
  deladPostHandelseId,
  deladPostTillHandelse,
  deladPostTillRad,
  deladPostUrHandelseId,
  deladeKalendrar,
  delningarAvKalender,
  kalenderdelningId,
  kalendermottagare,
  lasKalenderdelningar,
} from "../lib/kalenderdelning.js";
import { byggKalenderpost, byggMinKalender, postIdUrHandelseId } from "../lib/kalendrar.js";
import { KALENDERVALNYCKEL_FORM } from "../lib/kalendersynlighet.js";
import { kalenderregelfragment } from "../lib/regler.js";

/*
 * 0.154.0 (cllp/lifehub.app#485): delning av en egen kalender, bara läsning. Modellen, mottagarens rader i listan Kalendrar och källan mot minneskällan.
 * Reglerna mäts i emulatorn (`rules/__tests__/kalenderdelning.test.mjs`), dialogen i `kalenderdelning-vy.test.jsx`.
 */

const A = "uid-anna";
const B = "uid-bo";
const C = "uid-cecilia";

describe("raden: en nyckel härledd ur fälten, exakt en mottagare", () => {
  it("nyckeln är ägare|kalender|person~uid för en person och ägare|kalender|grupp för en grupp", () => {
    expect(kalenderdelningId(A, "barnveckor", { person: B })).toBe(`${A}|barnveckor|person~${B}`);
    expect(kalenderdelningId(A, "barnveckor", { grupp: "familjen" })).toBe(`${A}|barnveckor|grupp`);
    expect(byggKalenderdelning({ agare: A, kalenderId: "barnveckor", person: B })).toEqual({ id: `${A}|barnveckor|person~${B}`, agare: A, kalenderId: "barnveckor", person: B });
    expect(byggKalenderdelning({ agare: A, kalenderId: "barnveckor", groupId: "familjen" })).toEqual({ id: `${A}|barnveckor|grupp`, agare: A, kalenderId: "barnveckor", groupId: "familjen" });
  });

  it("⛔ kastar på det reglerna nekar: båda eller ingen mottagare, sig själv, okända fält, avgränsaren i ett uid, fel nyckel", () => {
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "k", person: B, groupId: "g" })).toThrow(/exakt en/);
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "k" })).toThrow(/exakt en/);
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "k", person: A })).toThrow(/sig själv/);
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "k", person: B, skrivbar: true })).toThrow(/skrivbar/);
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "k", person: "a|b" })).toThrow(/uid/);
    expect(() => byggKalenderdelning({ agare: "a~b", kalenderId: "k", person: B })).toThrow(/uid/);
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "Stor Bokstav", person: B })).toThrow(/kalender-id/);
    expect(() => byggKalenderdelning({ agare: A, kalenderId: "k", groupId: "G!" })).toThrow(/grupp-id/);
    expect(() => byggKalenderdelning({ id: `${A}|k|grupp`, agare: A, kalenderId: "k", person: B })).toThrow(/stämmer inte/);
    expect(() => lasKalenderdelningar("inte en lista")).toThrow(/lista/);
  });

  it("läsningen ger en rad per nyckel, och mottagaren tillbaka i den form källan tar", () => {
    const d = { id: `${A}|k|person~${B}`, agare: A, kalenderId: "k", person: B };
    expect(lasKalenderdelningar([d, d])).toHaveLength(1);
    expect(kalendermottagare(lasKalenderdelningar([d])[0])).toEqual({ person: B });
    expect(kalendermottagare(byggKalenderdelning({ agare: A, kalenderId: "k", groupId: "g" }))).toEqual({ grupp: "g" });
  });

  it("ägarens delningar av en kalender: gruppen först", () => {
    const rader = [byggKalenderdelning({ agare: A, kalenderId: "k", person: B }), byggKalenderdelning({ agare: A, kalenderId: "annan", person: B }), byggKalenderdelning({ agare: A, kalenderId: "k", groupId: "g" })];
    expect(delningarAvKalender(rader, "k").map((d) => d.id)).toEqual([`${A}|k|grupp`, `${A}|k|person~${B}`]);
  });
});

describe("mottagarens rader: en per kalender, i rätt grupp, aldrig ägarens egen", () => {
  const delningar = [
    byggKalenderdelning({ agare: A, kalenderId: "barnveckor", person: B }),
    byggKalenderdelning({ agare: A, kalenderId: "barnveckor", groupId: "familjen" }),
    byggKalenderdelning({ agare: A, kalenderId: "resor", groupId: "bolaget" }),
    byggKalenderdelning({ agare: C, kalenderId: "trana", person: B }),
    byggKalenderdelning({ agare: B, kalenderId: "egen", groupId: "familjen" }),
  ];

  it("i Familjen: Barnveckor en gång (via person och grupp) och Cecilias Träna; Resor hör till Bolaget och Bos egen kommer inte med", () => {
    const rader = deladeKalendrar(delningar, { uid: B, groupId: "familjen" });
    expect(rader.map((r) => [r.agare, r.kalenderId, r.via])).toEqual([
      [A, "barnveckor", ["person", "grupp"]],
      [C, "trana", ["person"]],
    ]);
    expect(rader[0].radId).toBe(`delad:${A}:barnveckor`);
  });

  it("i Bolaget: det som delats med personen, och Resor via gruppen", () => {
    expect(deladeKalendrar(delningar, { uid: B, groupId: "bolaget" }).map((r) => r.kalenderId)).toEqual(["barnveckor", "resor", "trana"]);
    expect(deladeKalendrar(delningar, { uid: B }).map((r) => r.kalenderId)).toEqual(["barnveckor", "trana"]);
  });

  it("⛔ radens id följer kalendervalens nyckelform också med ett långt uid och ett långt kalender-id, och är stabil", () => {
    const langtUid = "u".repeat(60);
    const langtId = "k".repeat(70);
    const id = deladKalenderRadId(langtUid, langtId);
    expect(KALENDERVALNYCKEL_FORM.test(id)).toBe(true);
    expect(id).toBe(deladKalenderRadId(langtUid, langtId));
    expect(id).not.toBe(deladKalenderRadId(langtUid, `${langtId.slice(1)}x`));
    expect(KALENDERVALNYCKEL_FORM.test(deladKalenderRadId(A, "barnveckor"))).toBe(true);
  });

  it("raden i listan har sektionen Delade med mig och märket med ägarens namn, på båda språken", () => {
    const kal = byggMinKalender({ id: "barnveckor", namn: "Barnveckor", farg: 3, ikon: "hus" });
    const [rad] = deladeKalendrar(delningar, { uid: B, groupId: "familjen" });
    expect(deladKalenderTillVal(kal, rad, { agarnamn: "Anna" })).toEqual({ id: `delad:${A}:barnveckor`, namn: "Barnveckor", farg: 3, sektion: "Delade med mig", marke: "Delad av Anna. Bara läsning" });
    expect(deladKalenderTillVal(kal, rad, { agarnamn: "Anna", sprak: "en" }).marke).toBe("Shared by Anna. Read only");
    expect(deladKalenderTillVal(kal, rad).marke).toBe("Delad av någon i gruppen. Bara läsning");
  });
});

describe("en delad post: egen rad, eget id, aldrig förväxlad med en egen post", () => {
  const post = byggKalenderpost({ id: "vecka-45", kalenderId: "barnveckor", titel: "Barnen hos mig", plats: "Hemma", start: "2026-11-02", slut: "2026-11-08", heldag: true });
  const rad = { id: `delad:${A}:barnveckor`, namn: "Barnveckor", farg: 3 };

  it("som rad i kalendern: kalendern är den delade raden och handelseId har ett eget prefix", () => {
    const r = deladPostTillRad(post, rad, A);
    expect(r.handelseId).toBe(`${DELADPOST_HANDELSEPREFIX}${A}~vecka-45`);
    expect(r.id).toBe(r.handelseId);
    expect(r.kalender).toEqual({ id: rad.id, namn: "Barnveckor", farg: 3 });
    expect(r.endDate).toBe("2026-11-08");
    expect(postIdUrHandelseId(r.handelseId)).toBeNull();
    expect(deladPostUrHandelseId(r.handelseId)).toEqual({ agare: A, postId: "vecka-45" });
  });

  it("som händelse i panelen: titel, plats och kalender som för en egen post", () => {
    const h = deladPostTillHandelse(post, rad, A);
    expect(h.id).toBe(deladPostHandelseId(A, "vecka-45"));
    expect(h.titel).toBe("Barnen hos mig");
    expect(h.plats).toBe("Hemma");
    expect(h.kalender).toEqual({ namn: "Barnveckor", farg: 3 });
  });

  it("⛔ ett id som inte är en delad posts ger null, också ett halvt", () => {
    for (const fel of ["post~vecka-45", `${DELADPOST_HANDELSEPREFIX}`, `${DELADPOST_HANDELSEPREFIX}${A}`, `${DELADPOST_HANDELSEPREFIX}${A}~`, `${DELADPOST_HANDELSEPREFIX}~p`, 5, null]) expect(deladPostUrHandelseId(fel)).toBeNull();
  });
});

describe("källan mot minneskällan: dela, hitta, läsa, sluta dela", () => {
  const ny = () => {
    const kalla = createMemorySource();
    return { kalla, k: createKalenderkalla({ kalla, kalenderdelningar: "kalenderdelningar" }) };
  };

  it("ägaren delar med en person och en grupp, mottagaren hittar och läser, ägaren slutar dela", async () => {
    const { k } = ny();
    await k.sparaMina(A, [byggMinKalender({ id: "barnveckor", namn: "Barnveckor", farg: 3, ikon: "hus" })]);
    await k.sparaPost(A, { id: "v45", kalenderId: "barnveckor", titel: "Barnen", start: "2026-11-02", slut: "2026-11-02", heldag: true }, [{ id: "barnveckor" }]);
    await k.sparaPost(A, { id: "v46", kalenderId: "barnveckor", titel: "Barnen igen", start: "2026-11-09", slut: "2026-11-09", heldag: true }, [{ id: "barnveckor" }]);
    const p = await k.dela(A, "barnveckor", { person: B });
    await k.dela(A, "barnveckor", { grupp: "familjen" });
    expect((await k.delningar(A)).map((d) => d.id).sort()).toEqual([`${A}|barnveckor|grupp`, `${A}|barnveckor|person~${B}`]);
    const rader = deladeKalendrar(await k.deladeMedMig(B, { groupId: "familjen" }), { uid: B, groupId: "familjen" });
    expect(rader).toHaveLength(1);
    expect((await k.deladKalender(A, "barnveckor"))?.namn).toBe("Barnveckor");
    expect((await k.deladePoster(A, "barnveckor")).map((x) => x.titel).sort()).toEqual(["Barnen", "Barnen igen"]);
    expect(k.deladeVagar(A, "barnveckor")).toEqual({ kalender: { samling: `users/${A}/minaKalendrar`, id: "barnveckor" }, poster: { samling: `users/${A}/kalenderposter`, fraga: { where: { kalenderId: "barnveckor" } } } });

    await expect(k.slutaDela(B, p.id)).rejects.toThrow(/någon annans/);
    expect(await k.slutaDela(A, p.id)).toEqual({ borttagen: true });
    expect(await k.slutaDela(A, p.id)).toEqual({ borttagen: false });
    expect((await k.deladeMedMig(B)).length).toBe(0);
  });

  it("att dela med en annan grupp byter gruppen, raden är densamma", async () => {
    const { k } = ny();
    await k.dela(A, "resor", { grupp: "bolaget" });
    await k.dela(A, "resor", { grupp: "familjen" });
    const rader = await k.delningar(A);
    expect(rader).toEqual([{ id: `${A}|resor|grupp`, agare: A, kalenderId: "resor", groupId: "familjen" }]);
  });

  it("⛔ utan samlingsnamnet finns ingen delning, och det säger källan", async () => {
    const k = createKalenderkalla({ kalla: createMemorySource() });
    await expect(k.dela(A, "k", { person: B })).rejects.toThrow(/kalenderdelningar krävs/);
    expect(() => createKalenderkalla({ kalla: createMemorySource(), kalenderdelningar: "inte/ett namn" })).toThrow(/samlingsnamn/);
  });
});

describe("regelfragmentet: utan namnet oförändrat, med det ett block och läsning för den som fått delningen", () => {
  it("utan kalenderdelningar finns varken blocket eller funktionen, och läsningen är bara ägarens", () => {
    const text = kalenderregelfragment();
    expect(text).not.toContain("opsKalenderDeladMedMig");
    expect(text).toContain("allow read, delete: if opsInloggad() && request.auth.uid == uid;");
  });
  it("med kalenderdelningar: blocket, läsningen av kalender och poster, och radering av en post är fortfarande ägarens", () => {
    const text = kalenderregelfragment({ kalenderdelningar: "delade" });
    expect(text).toContain("match /delade/{did}");
    expect(text).toContain("|| opsKalenderDeladMedMig(uid, kid);");
    expect(text).toContain("|| opsKalenderDeladMedMig(uid, resource.data.kalenderId);");
    expect(text).toContain("allow delete: if opsInloggad() && request.auth.uid == uid;");
    expect(text).not.toContain("allow read, delete");
    expect(() => kalenderregelfragment({ kalenderdelningar: "gruppkalendrar" })).toThrow(/krockar/);
  });
});
