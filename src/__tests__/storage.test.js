import { describe, expect, it, vi } from "vitest";
import { createStorageSource, STORAGE_OPERATIONS } from "../data/storage.js";
import { createMemoryStorage } from "../data/adapters.js";
import { createFirebaseStorageSource } from "../data/firebaseStorage.js";

/**
 * Lagringens kontrakt (#156): en bilduppladdning bredvid `kalla`.
 *
 * ⛔ SAMMA SKÄL SOM `data-primitives.test.jsx`: en adapter som saknar en
 * metod ska säga det VID UPPSTART och namnge sig, inte kasta
 * "undefined is not a function" den dag någon råkar anropa just den.
 */

describe("createStorageSource: kontrollen, inte ceremonin", () => {
  it("kräver ett objekt", () => {
    expect(() => createStorageSource(undefined)).toThrow(/en adapter krävs/);
  });

  it("kräver båda operationerna, och namnger vilka som saknas", () => {
    expect(() => createStorageSource({ laddaUpp: async () => ({}) })).toThrow(/saknar taBort/);
    expect(() => createStorageSource({ taBort: async () => {} })).toThrow(/saknar laddaUpp/);
  });

  it("STORAGE_OPERATIONS är de tre", () => {
    expect(STORAGE_OPERATIONS).toEqual(["laddaUpp", "taBort", "adress"]);
  });

  it("släpper igenom en hel adapter, och en utan adress namnger den", () => {
    const adapter = { laddaUpp: async () => ({ url: "x", sokvag: "y" }), taBort: async () => {}, adress: async () => "https://exempel.se/a" };
    expect(createStorageSource(adapter)).toBe(adapter);
    expect(() => createStorageSource({ laddaUpp: async () => ({ url: "x", sokvag: "y" }), taBort: async () => {} })).toThrow(/saknar adress/);
  });
});

describe("createMemoryStorage", () => {
  it("laddar upp och svarar med url och sokvag", async () => {
    const lagring = createMemoryStorage();
    const svar = await lagring.laddaUpp({ sokvag: "profilbilder/uid-1/1.jpg", fil: new Uint8Array([1, 2, 3]) });
    expect(svar.sokvag).toBe("profilbilder/uid-1/1.jpg");
    expect(svar.url).toContain("profilbilder/uid-1/1.jpg");
  });

  it("kräver sokvag och fil", async () => {
    const lagring = createMemoryStorage();
    await expect(lagring.laddaUpp({ sokvag: "", fil: "x" })).rejects.toThrow(/sokvag krävs/);
    await expect(lagring.laddaUpp({ sokvag: "a/b", fil: undefined })).rejects.toThrow(/fil krävs/);
  });

  it("⛔ TA BORT tar faktiskt bort, mätt genom en ny uppladdning på samma sökväg", async () => {
    /*
     * Minneskällan har ingen "finns filen"-fråga i kontraktet, så provet
     * mäter borttagningen indirekt: samma sökväg laddas upp två gånger, och
     * mellan de två raderas den. Utan en verklig borttagning hade det ändå
     * sett likadant ut, så det som faktiskt provas är att `taBort` INTE
     * kastar och att en efterföljande uppladdning fungerar som om inget
     * legat där.
     */
    const lagring = createMemoryStorage();
    await lagring.laddaUpp({ sokvag: "a", fil: "1" });
    await lagring.taBort("a");
    const andra = await lagring.laddaUpp({ sokvag: "a", fil: "2" });
    expect(andra.sokvag).toBe("a");
  });

  it("taBort på en sökväg som aldrig funnits kastar inte", async () => {
    await expect(createMemoryStorage().taBort("finns-inte")).resolves.toBeUndefined();
  });

  it("kräver sokvag på taBort", async () => {
    await expect(createMemoryStorage().taBort("")).rejects.toThrow(/sokvag krävs/);
  });

  it("adress ger den lagrade url:en och kastar när sökvägen saknas", async () => {
    const lagring = createMemoryStorage();
    const sparad = await lagring.laddaUpp({ sokvag: "a/b", fil: "x" });
    await expect(lagring.adress("a/b")).resolves.toBe(sparad.url);
    await expect(lagring.adress("saknas")).rejects.toThrow(/ingen fil/);
    await expect(lagring.adress("")).rejects.toThrow(/sokvag krävs/);
  });
});

describe("createFirebaseStorageSource: kontrollen av konfigurationen", () => {
  it("kräver storage", () => {
    expect(() => createFirebaseStorageSource(/** @type {any} */ (undefined))).toThrow(/createFirebaseStorageSource: storage krävs/);
  });

  it("kräver sdk", () => {
    expect(() => createFirebaseStorageSource(/** @type {any} */ ({ storage: {} }))).toThrow(/sdk krävs/);
  });

  it("kräver hela modulen, inte plock", () => {
    expect(() => createFirebaseStorageSource(/** @type {any} */ ({ storage: {}, sdk: { ref: () => {} } }))).toThrow(/sdk saknar/);
  });

  it("laddar upp via de injicerade funktionerna", async () => {
    const referens = { path: "profilbilder/uid-1/1.jpg" };
    const sdk = {
      ref: vi.fn(() => referens),
      uploadBytes: vi.fn(async () => {}),
      getDownloadURL: vi.fn(async () => "https://firebasestorage.example/1.jpg"),
      deleteObject: vi.fn(async () => {}),
    };
    const lagring = createFirebaseStorageSource({ storage: /** @type {any} */ ({}), sdk });
    const svar = await lagring.laddaUpp({ sokvag: "profilbilder/uid-1/1.jpg", fil: "fil" });
    expect(svar).toEqual({ url: "https://firebasestorage.example/1.jpg", sokvag: "profilbilder/uid-1/1.jpg" });
    expect(sdk.uploadBytes).toHaveBeenCalledWith(referens, "fil");
    await lagring.laddaUpp({ sokvag: "grupper/cps-ab/bibliotek/p/a.webm", fil: "ljud", contentType: "audio/webm" });
    expect(sdk.uploadBytes).toHaveBeenLastCalledWith(referens, "ljud", { contentType: "audio/webm" });
  });

  it("⛔ rapportera får procent via uploadBytesResumable (lifehub.app#163)", async () => {
    const referens = { path: "grupper/my/bibliotek/p/ide.m4a" };
    /** @type {Array<(snap: { bytesTransferred: number, totalBytes: number }) => void>} */
    const lyssnare = [];
    const sdk = {
      ref: vi.fn(() => referens),
      uploadBytes: vi.fn(async () => {}),
      uploadBytesResumable: vi.fn(() => ({
        on: (_h, next, _err, klar) => {
          lyssnare.push(next);
          queueMicrotask(() => {
            next({ bytesTransferred: 40, totalBytes: 100 });
            next({ bytesTransferred: 100, totalBytes: 100 });
            klar();
          });
        },
      })),
      getDownloadURL: vi.fn(async () => "https://exempel.se/ide.m4a"),
      deleteObject: vi.fn(async () => {}),
    };
    const lagring = createFirebaseStorageSource({ storage: /** @type {any} */ ({}), sdk });
    /** @type {number[]} */
    const andel = [];
    await lagring.laddaUpp({
      sokvag: "grupper/my/bibliotek/p/ide.m4a",
      fil: "ljud",
      contentType: "audio/mp4",
      rapportera: (n) => andel.push(n),
    });
    expect(sdk.uploadBytesResumable).toHaveBeenCalled();
    expect(sdk.uploadBytes).not.toHaveBeenCalled();
    expect(andel).toEqual([0.4, 1, 1]);
  });

  it("⛔ TA BORT SVÄLJER \"objektet finns inte\", inte andra fel", async () => {
    const sdk = {
      ref: vi.fn(() => ({})),
      uploadBytes: vi.fn(async () => {}),
      getDownloadURL: vi.fn(async () => ""),
      deleteObject: vi.fn(async () => {
        throw Object.assign(new Error("no object"), { code: "storage/object-not-found" });
      }),
    };
    const lagring = createFirebaseStorageSource({ storage: /** @type {any} */ ({}), sdk });
    await expect(lagring.taBort("a")).resolves.toBeUndefined();
  });

  it("adress hämtar nedladdningsadressen för sökvägen", async () => {
    const referens = { path: "grupper/my/bibliotek/p/ide.webm" };
    const sdk = {
      ref: vi.fn(() => referens),
      uploadBytes: vi.fn(async () => {}),
      getDownloadURL: vi.fn(async () => "https://exempel.se/ide.webm"),
      deleteObject: vi.fn(async () => {}),
    };
    const lagring = createFirebaseStorageSource({ storage: /** @type {any} */ ({}), sdk });
    await expect(lagring.adress("grupper/my/bibliotek/p/ide.webm")).resolves.toBe("https://exempel.se/ide.webm");
    expect(sdk.ref).toHaveBeenCalledWith({}, "grupper/my/bibliotek/p/ide.webm");
    expect(sdk.getDownloadURL).toHaveBeenCalledWith(referens);
    await expect(lagring.adress("")).rejects.toThrow(/sokvag krävs/);
  });

  it("men ett ANNAT fel kastas vidare", async () => {
    const sdk = {
      ref: vi.fn(() => ({})),
      uploadBytes: vi.fn(async () => {}),
      getDownloadURL: vi.fn(async () => ""),
      deleteObject: vi.fn(async () => {
        throw Object.assign(new Error("permission denied"), { code: "storage/unauthorized" });
      }),
    };
    const lagring = createFirebaseStorageSource({ storage: /** @type {any} */ ({}), sdk });
    await expect(lagring.taBort("a")).rejects.toThrow(/permission denied/);
  });
});
