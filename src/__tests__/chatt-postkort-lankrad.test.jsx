import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { utanLankar } from "../lib/markdown.js";
import { bibliotekslank } from "../lib/postkommentar.js";

/*
 * cllp/ops-framework#527 (0.196.0): en länk som blivit ett postkort står inte också som text i bubblan.
 *
 * Händelsen: i 0.191.0 (cllp/lifehub.app#663) blev en kommentar på en post ett chattmeddelande med kommentaren och postens länk, och länken blev ett kort. Länken stod ändå kvar ovanför kortet, som en lång radbruten
 * adress (https://my.life-hub.app/bibliotek?plats=…&post=…), hos medlemmen och hos gästen. Samma sak två gånger.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i PR-texten: med 0.195.0 står adressen i bubblan bredvid kortet, och ett meddelande som bara är länken har en bubbla.
 * ⛔ ÅT ANDRA HÅLLET (regel 5): ett uppslag som gav `null` eller föll lämnar länken kvar, så att ingenting försvinner tyst.
 */

const BAS = "https://my.life-hub.app/bibliotek";
const LANK = bibliotekslank(BAS, { plats: "g", postId: "p1" });
const BORTA = bibliotekslank(BAS, { plats: "g", postId: "borta" });
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

/** Bubblan och korten för meddelandet vars rad bär texten eller kortet. */
function meddelandet(/** @type {string} */ url) {
  const kort = /** @type {HTMLElement | null} */ (document.querySelector(`[data-postkort="${url}"]`));
  const rad = /** @type {HTMLElement} */ (kort?.closest("[data-meddelande]"));
  return { kort, rad, bubbla: /** @type {HTMLElement | null} */ (rad?.querySelector("[data-bubbla]") ?? null) };
}

describe("utanLankar: bara visningen, med samma tolkning som bubblan", () => {
  it("länken ensam ger tom text, text runt länken står kvar, en rad som bara bar länken försvinner, och en adress i en kodsnutt rörs inte", () => {
    expect(utanLankar(LANK, [LANK])).toBe("");
    expect(utanLankar(`Kolla här: ${LANK} tack`, [LANK])).toBe("Kolla här: tack");
    expect(utanLankar(`Bra protokoll\n${LANK}\nslut`, [LANK])).toBe("Bra protokoll\nslut");
    expect(utanLankar(`\`${LANK}\` och ${LANK}`, [LANK])).toBe(`\`${LANK}\` och`);
    expect(utanLankar(`Se [rapporten](${LANK})`, [LANK])).toBe("Se");
    expect(utanLankar(`Se https://extern.se/x`, [LANK])).toBe("Se https://extern.se/x");
    expect(utanLankar(`  - punkt\n${LANK}`, [LANK])).toBe("  - punkt");
  });
});

describe("⛔ appens chatt (Meddelanderader i OpsMeddelanden)", () => {
  async function rita(/** @type {string[]} */ texter, /** @type {(url: string) => any} */ sla) {
    const kalla = createMemorySource({});
    const s = createSamtalskalla({ kalla });
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    for (const text of texter) await s.skicka(p.id, { text, av: "bo" });
    const slaUpp = vi.fn(async (/** @type {string} */ url) => sla(url));
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} postkort={{ slaUpp }} />);
    return { kalla, p };
  }
  const protokoll = (/** @type {string} */ url) => (url === LANK ? { titel: "Protokoll", undertitel: "Anteckning" } : null);

  it("bara länken: ingen bubbla, bara kortet, och den lagrade texten är orörd", async () => {
    const { kalla, p } = await rita([LANK], protokoll);
    await waitFor(() => expect(meddelandet(LANK).kort).not.toBeNull());
    const { rad, bubbla } = meddelandet(LANK);
    expect(bubbla).toBeNull();
    expect(rad.textContent).not.toContain("https://");
    const [lagrad] = await kalla.list(`samtal/${p.id}/meddelanden`);
    expect(lagrad.text).toBe(LANK);
  });

  it("text runt länken: texten står kvar i bubblan, länken tas bort ur den", async () => {
    await rita([`Kolla här: ${LANK} tack`], protokoll);
    await waitFor(() => expect(meddelandet(LANK).kort).not.toBeNull());
    const { bubbla } = meddelandet(LANK);
    expect(bubbla?.textContent).toBe("Kolla här: tack");
    expect(bubbla?.querySelector("a")).toBeNull();
  });

  it("⛔ ett uppslag som gav null lämnar länken i bubblan (regel 5)", async () => {
    await rita([`Och här ${BORTA}`], protokoll);
    const bubbla = await waitFor(() => {
      const a = document.querySelector(`[data-bubbla] a[href="${BORTA}"]`);
      expect(a).not.toBeNull();
      return a;
    });
    expect(bubbla?.textContent).toBe(BORTA);
    expect(document.querySelector("[data-postkort]")).toBeNull();
  });

  it("⛔ ett uppslag som föll lämnar länken och säger det", async () => {
    await rita([`Trasig ${LANK}`], () => {
      throw new Error("nät");
    });
    await waitFor(() => expect(document.querySelector(`[data-postkort-fel="${LANK}"]`)).not.toBeNull());
    expect(document.querySelector(`[data-bubbla] a[href="${LANK}"]`)).not.toBeNull();
  });
});

describe("⛔ gästens chatt (samma Meddelanderader i OpsGastChatt)", () => {
  const kort = (/** @type {string} */ url, /** @type {string} */ postId) => [{ url, postId, typ: "anteckning", rubrik: "Protokoll" }];

  it("bara länken: ingen bubbla, bara kortet. Text runt länken: texten utan länken", async () => {
    render(
      <OpsGastChatt
        meddelanden={[
          { id: "m1", av: { namn: "Bo" }, text: LANK, tid: 1000, kort: kort(LANK, "p1") },
          { id: "m2", av: { namn: "Bo" }, text: `Bra protokoll\n${BAS}?plats=g&post=p2`, tid: 2000, kort: kort(`${BAS}?plats=g&post=p2`, "p2") },
        ]}
        igenkanning={false}
      />,
    );
    await waitFor(() => expect(document.querySelectorAll("[data-postkort]").length).toBe(2), { timeout: 5000 });
    expect(meddelandet(LANK).bubbla).toBeNull();
    const andra = meddelandet(`${BAS}?plats=g&post=p2`);
    expect(andra.bubbla?.textContent).toBe("Bra protokoll");
    expect(document.querySelector("[data-gast-chatt-logg]")?.textContent).not.toContain("https://");
  });

  it("⛔ utan kort från servern (ingen åtkomst, raderad post) står länken kvar", async () => {
    render(<OpsGastChatt meddelanden={[{ id: "m1", av: { namn: "Bo" }, text: `Se ${BORTA}`, tid: 1000 }]} igenkanning={false} />);
    await waitFor(() => expect(document.querySelector(`[data-bubbla] a[href="${BORTA}"]`)).not.toBeNull());
    expect(document.querySelector("[data-postkort]")).toBeNull();
  });
});
