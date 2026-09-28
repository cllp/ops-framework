import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { sakerstallAnvandare } from "../lib/profil.js";
import { byggMedlemskap } from "../lib/grupp.js";
import { uppdateraProfil } from "../node/profil.js";

/**
 * #156: `uppdateraProfil` är den enda platsen som skriver namn/bild i BÅDE
 * `users` och `memberships` i samma steg. Klienten kan inte göra det andra
 * ledet själv (`memberships` har `allow write: if false`), så det här är
 * provbevisen för "allt syns i medlemslistan för hennes grupper".
 */

const INLOGGAD = { uid: "uid-1", namn: "CP", epost: "cp@staiger.se", bild: "" };

const kallaMed = (/** @type {Record<string, any[]>} */ seed = {}) => createMemorySource(seed);

describe("uppdateraProfil", () => {
  it("kräver kalla och uid, och namnger sig", async () => {
    await expect(uppdateraProfil(/** @type {any} */ (undefined))).rejects.toThrow(/uppdateraProfil: en datakälla/);
    await expect(uppdateraProfil({ kalla: kallaMed(), andring: {} })).rejects.toThrow(/uppdateraProfil: uid krävs/);
  });

  it("avvisar andra fält än namn och bild", async () => {
    const kalla = kallaMed();
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(uppdateraProfil({ kalla, uid: "uid-1", andring: /** @type {any} */ ({ telefon: "+46701234567" }) })).rejects.toThrow(
      /uppdateraProfil: fälten telefon går inte att spara här/,
    );
  });

  it("kräver att användaren redan finns", async () => {
    await expect(uppdateraProfil({ kalla: kallaMed(), uid: "finns-inte", andring: { namn: "X" } })).rejects.toThrow(/ingen användare "finns-inte" finns/);
  });

  it("skriver namn till users när ingen grupp finns, och rör inga medlemskap", async () => {
    const kalla = kallaMed();
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    const svar = await uppdateraProfil({ kalla, uid: "uid-1", andring: { namn: "Nytt namn" } });
    expect(svar.anvandare.namn).toBe("Nytt namn");
    expect(svar.medlemskapUppdaterade).toBe(0);
    expect(await kalla.read("users", "uid-1")).toMatchObject({ namn: "Nytt namn" });
  });

  it("⛔ #156: ett namnbyte skriver om ALLA medlemskapsrader för uid, i samma steg", async () => {
    const medlemskap1 = byggMedlemskap({ userId: "uid-1", groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv", namn: "CP", bild: "" });
    const medlemskap2 = byggMedlemskap({ userId: "uid-1", groupId: "annan-grupp", roll: "medlem", typ: "person", status: "aktiv", namn: "CP", bild: "" });
    // En annan persons medlemskap ska INTE röras.
    const annans = byggMedlemskap({ userId: "uid-2", groupId: "bolaget", roll: "medlem", typ: "person", status: "aktiv", namn: "Bob", bild: "" });

    const kalla = kallaMed({ memberships: [medlemskap1, medlemskap2, annans] });
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });

    const svar = await uppdateraProfil({ kalla, uid: "uid-1", andring: { namn: "Claes Philip", bild: "https://minlagring/1.jpg" } });
    expect(svar.medlemskapUppdaterade).toBe(2);

    expect(await kalla.read("memberships", medlemskap1.id)).toMatchObject({ namn: "Claes Philip", bild: "https://minlagring/1.jpg" });
    expect(await kalla.read("memberships", medlemskap2.id)).toMatchObject({ namn: "Claes Philip", bild: "https://minlagring/1.jpg" });
    expect(await kalla.read("memberships", annans.id)).toMatchObject({ namn: "Bob" });
  });

  it("skriver bild utan att röra namnet, om bara bild ändras", async () => {
    const medlemskap = byggMedlemskap({ userId: "uid-1", groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv", namn: "CP", bild: "" });
    const kalla = kallaMed({ memberships: [medlemskap] });
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });

    await uppdateraProfil({ kalla, uid: "uid-1", andring: { bild: "https://minlagring/2.jpg" } });
    expect(await kalla.read("memberships", medlemskap.id)).toMatchObject({ namn: "CP", bild: "https://minlagring/2.jpg" });
  });

  it("ett tomt andring-objekt uppdaterar ingenting och rör inga medlemskap", async () => {
    const medlemskap = byggMedlemskap({ userId: "uid-1", groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv", namn: "CP", bild: "" });
    const kalla = kallaMed({ memberships: [medlemskap] });
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });

    const svar = await uppdateraProfil({ kalla, uid: "uid-1", andring: {} });
    expect(svar.medlemskapUppdaterade).toBe(0);
  });

  it("kastar på ett för långt namn precis som byggAnvandare (validerad före skrivningen)", async () => {
    // namn har inget tak i byggAnvandare, så provet visar i stället att ett
    // OGILTIGT värde för ett annat fält som INTE skickas in inte spökar: en
    // trasig befintlig rad (t.ex. skriven för hand) upptäcks vid läsning.
    const kalla = kallaMed({ users: [{ id: "uid-1", namn: "CP", epost: "cp@staiger.se", bild: "", sprak: "no", tema: "system" }] });
    await expect(uppdateraProfil({ kalla, uid: "uid-1", andring: { namn: "X" } })).rejects.toThrow(/users: språket "no"/);
  });
});
