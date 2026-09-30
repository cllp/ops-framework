import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { medAktivGrupp } from "../data/aktivgrupp.js";
import { OpsDataProvider, useCollection, useDocument, useLiveCollection } from "../data/useData.jsx";

/**
 * EN regel för varje läsväg: den aktiva gruppen (0.35.0, #190).
 *
 * Händelsen: CP 2026-09-30 valde gruppen Travel, och Idag visade fortfarande
 * CPS AB:s rader. `list` och `subscribe` filtrerade på gruppen redan, men `read`
 * av ett dokument gick orörd igenom. Proven nedan bygger just det läget: en
 * medlem i två grupper, B aktiv, och ett dokument som tillhör A.
 *
 * ⛔ VARJE LÄSVÄG PROVAS FÖR SIG, list, subscribe OCH read, och varje prov
 * läser något som FINNS i källan. Ett prov som blir grönt av tom indata vore
 * arbetsreglernas tomma underlag, alltså mäter varje prov först att den andra
 * gruppens rad faktiskt ligger där.
 */

const SEED = () => ({
  handelser: [
    { id: "adavo", groupId: "cps-ab", titel: "Adavo" },
    { id: "attest", groupId: "cps-ab", titel: "Attest" },
    { id: "flyg", groupId: "travel", titel: "Flyg till Rom" },
  ],
  data: [
    { id: "kundfakturor", groupId: "cps-ab", json: "[1,2,3]" },
    { id: "resplan", groupId: "travel", json: "[]" },
    { id: "trasig", json: "{}" },
  ],
  users: [{ id: "u1", namn: "CP" }],
});

const GRUPPADE = ["handelser", "data"];

/** @param {string} groupId @param {any} [kalla] */
const kallaFor = (groupId, kalla = createMemorySource(SEED())) => medAktivGrupp(kalla, { groupId, gruppade: GRUPPADE });

/**
 * En källa med `subscribe` som IGNORERAR `where`, alltså en adapter som inte
 * håller filtret. Det är den sämsta källan insvepningen kan få, och den som
 * visar om kontrollen av raderna faktiskt sker.
 * @param {boolean} [hallerFiltret]
 */
function strommandeKalla(hallerFiltret = false) {
  const inre = createMemorySource(SEED());
  return {
    ...inre,
    /** @param {string} samling @param {any} fraga @param {any} lyssnare */
    subscribe(samling, fraga, lyssnare) {
      inre.list(samling, hallerFiltret ? fraga : { ...fraga, where: undefined }).then(lyssnare.onData, lyssnare.onError);
      return () => {};
    },
  };
}

describe("källan kräver en aktiv grupp och en lista gruppade samlingar", () => {
  it("avvisar en tom grupp, i stället för ett filter på undefined", () => {
    expect(() => medAktivGrupp(createMemorySource({}), { groupId: " ", gruppade: GRUPPADE })).toThrow(/groupId krävs/);
  });

  it("avvisar en tom lista gruppade samlingar, eftersom den inte skyddar något (golv)", () => {
    expect(() => medAktivGrupp(createMemorySource({}), { groupId: "travel", gruppade: [] })).toThrow(/minst en samling/);
  });
});

describe("⛔ read: ett dokument ur en annan grupp finns inte i den aktiva", () => {
  it("underlaget: dokumentet ligger i källan och går att läsa utan insvepning", async () => {
    const ra = createMemorySource(SEED());
    expect(await ra.read("data", "kundfakturor")).toMatchObject({ groupId: "cps-ab" });
  });

  it("⛔ med Travel aktiv ger CPS AB:s dokument null, aldrig raden", async () => {
    expect(await kallaFor("travel").read("data", "kundfakturor")).toBe(null);
  });

  it("den aktiva gruppens eget dokument kommer tillbaka", async () => {
    expect(await kallaFor("travel").read("data", "resplan")).toMatchObject({ id: "resplan", groupId: "travel" });
  });

  it("ett dokument som inte finns är null, precis som förut", async () => {
    expect(await kallaFor("travel").read("data", "finnsinte")).toBe(null);
  });

  it("⛔ ett dokument utan groupId i en gruppad samling kastar, det sorteras inte bort tyst", async () => {
    await expect(kallaFor("travel").read("data", "trasig")).rejects.toThrow(/saknar groupId/);
  });

  it("en samling som inte är gruppad läses orörd", async () => {
    expect(await kallaFor("travel").read("users", "u1")).toMatchObject({ namn: "CP" });
  });

  it("⛔ genom useDocument: medlem i två grupper ser inte A:s dokument när B är aktiv", async () => {
    function Vy() {
      const { data, loading } = useDocument("data", "kundfakturor");
      return <p>{loading ? "laddar" : data ? `rad:${/** @type {any} */ (data).id}` : "ingen rad"}</p>;
    }
    render(
      <OpsDataProvider source={kallaFor("travel")}>
        <Vy />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(screen.getByText("ingen rad")).toBeTruthy());
    expect(screen.queryByText(/rad:kundfakturor/)).toBe(null);
  });
});

describe("⛔ list: bara den aktiva gruppens rader", () => {
  it("lägger på gruppen, så att Travel inte ser Adavo och attest", async () => {
    const rader = await kallaFor("travel").list("handelser");
    expect(rader.map((r) => r.id)).toEqual(["flyg"]);
  });

  it("⛔ en fråga som ber om en annan grupp kastar i stället för att skriva över den tyst", async () => {
    await expect(kallaFor("travel").list("handelser", { where: { groupId: "cps-ab" } })).rejects.toThrow(/aktiva gruppen är "travel"/);
  });

  it("⛔ en källa som inte håller filtret fångas: en annan grupps rad kastar", async () => {
    const inre = createMemorySource(SEED());
    const lacker = { ...inre, list: (/** @type {string} */ s) => inre.list(s) };
    await expect(kallaFor("travel", lacker).list("handelser")).rejects.toThrow(/tillhör gruppen "cps-ab"/);
  });

  it("⛔ en rad utan groupId i en gruppad samling kastar", async () => {
    const kalla = createMemorySource({ handelser: [{ id: "x", titel: "utan grupp" }] });
    const lacker = { ...kalla, list: (/** @type {string} */ s) => kalla.list(s) };
    await expect(kallaFor("travel", lacker).list("handelser")).rejects.toThrow(/saknar groupId/);
  });

  it("genom useCollection: vyn får bara Travels rader", async () => {
    function Vy() {
      const { data, loading } = useCollection("handelser");
      return <p>{loading ? "laddar" : data.map((r) => r.id).join(",") || "tomt"}</p>;
    }
    render(
      <OpsDataProvider source={kallaFor("travel")}>
        <Vy />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(screen.getByText("flyg")).toBeTruthy());
  });
});

describe("⛔ subscribe: bara den aktiva gruppens rader, och ett brott går till onError", () => {
  it("lägger gruppen i frågan till källan", async () => {
    const onData = vi.fn();
    kallaFor("travel", strommandeKalla(true)).subscribe?.("handelser", undefined, { onData, onError: vi.fn() });
    await waitFor(() => expect(onData).toHaveBeenCalled());
    expect(onData.mock.calls[0][0].map((/** @type {any} */ r) => r.id)).toEqual(["flyg"]);
  });

  it("⛔ en ström med en annan grupps rad når aldrig onData", async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    kallaFor("travel", strommandeKalla(false)).subscribe?.("handelser", undefined, { onData, onError });
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0].message).toMatch(/tillhör gruppen "cps-ab"/);
    expect(onData).not.toHaveBeenCalled();
  });

  it("genom useLiveCollection: vyn visar felet och inte CPS AB:s rader", async () => {
    function Vy() {
      const { data, error, loading } = useLiveCollection("handelser");
      return <p>{loading ? "laddar" : error ? "fel" : data.map((r) => r.id).join(",")}</p>;
    }
    render(
      <OpsDataProvider source={kallaFor("travel", strommandeKalla(false))}>
        <Vy />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(screen.getByText("fel")).toBeTruthy());
    expect(screen.queryByText(/adavo/)).toBe(null);
  });

  it("en källa utan subscribe får ingen (useLiveCollection ska inte välja en väg som kraschar)", () => {
    expect(kallaFor("travel").subscribe).toBeUndefined();
  });
});

describe("skrivningar hamnar i den aktiva gruppen", () => {
  it("create stämplar den aktiva gruppen", async () => {
    const rad = await kallaFor("travel").create("handelser", { titel: "Hotell" });
    expect(/** @type {any} */ (rad).groupId).toBe("travel");
  });

  it("create med en annan grupp kastar", async () => {
    await expect(Promise.resolve().then(() => kallaFor("travel").create("handelser", /** @type {any} */ ({ titel: "x", groupId: "cps-ab" })))).rejects.toThrow(/aktiva gruppen/);
  });

  it("update som flyttar en rad till en annan grupp kastar", () => {
    expect(() => kallaFor("travel").update("handelser", "flyg", /** @type {any} */ ({ groupId: "cps-ab" }))).toThrow(/flyttas inte/);
  });

  it("batch stämplar create med den aktiva gruppen", async () => {
    const kalla = kallaFor("travel");
    const [rad] = await /** @type {any} */ (kalla).batch([{ op: "create", collection: "handelser", data: { titel: "Tåg" } }]);
    expect(rad.groupId).toBe("travel");
  });
});
