import { NAMN_SAKNAS } from "../lib/personnamn.js";
import { arGastId, GASTNAMNLOS } from "../lib/gast.js";
import { arMittBibliotek } from "../lib/bibliotek.js";
import { bibliotekslank, kommentarRotId, kommentarRotText, lasBibliotekslank, utanPostlank } from "../lib/postkommentar.js";
import { samtalsnyckel } from "../lib/samtal.js";

/**
 * @typedef {object} Postkommentar En kommentar på en post, som den ritas i postens tråd.
 * @property {string} id
 * @property {string} namn Avsändarens namn. Aldrig ett uid.
 * @property {string} text Texten, utan postens egen länk.
 * @property {number} tid Millisekunder.
 * @property {boolean} [egen] Den som läser skrev den.
 * @property {boolean} [gast] En gäst skrev den (märket Gäst).
 */

/**
 * @typedef {object} Postkommentarer (0.191.0, cllp/lifehub.app#663) Det `OpsBibliotek` behöver för Kommentera och tråden på posten. Medlemmens källa är `createPostkommentarer`,
 * gästens bygger `OpsGastGrupp` av serverns anrop. Vyn vet inte vilken det är.
 * @property {(post: { id: string, groupId: string }) => Promise<{ rader: Postkommentar[] }>} las Roten och svaren, äldst först. Tom lista: ingen har kommenterat.
 * @property {(post: { id: string, groupId: string }, text: string) => Promise<unknown>} kommentera Den första kommentaren skapar roten i gruppchatten, nästa blir ett svar i dess tråd.
 * @property {(post: { id: string, groupId: string }, lyssnare: { onData: (rader: Postkommentar[]) => void, onError: (fel: Error) => void }) => (() => void) | null} [prenumerera]
 *   Följer tråden. `null`: källan kan inte, och vyn läser om efter en egen kommentar.
 * @property {(post: { id: string, groupId: string }) => boolean} [kanKommentera] Får posten kommenteras här? Utelämnad: ja.
 * @property {number} [maxTecken] Taket på en kommentar i fältet. Utelämnad: chattens tak, med plats för postens länk. Gästens källa har gästens tak (`GASTSKRIV_MAX_TECKEN`).
 */

/**
 * Medlemmens kommentarer på biblioteksposter, genom gruppens chatt (0.191.0, cllp/lifehub.app#663). Modellen och skälen står i `lib/postkommentar.js`.
 *
 * ⛔ INGEN EGEN SAMLING OCH INGEN EGEN REGEL: allt går genom samtalskällan (`rotmeddelande`, `tradmeddelanden`, `prenumereraTrad`, `skickaPaRot`), med samma regler som chatten.
 * ⛔ GRUPPCHATTEN ÖPPNAS FÖRST (`oppnaGrupp`, en gång per källa). Regeln för ett meddelande kräver att samtalet finns, och en läsning av en rot i ett samtal som inte finns är ett
 * nej från regeln, inte ett tomt svar.
 * ⛔ MITT BIBLIOTEK KOMMENTERAS INTE: posten är personens egen, och en länk i gruppchatten till något ingen annan kan läsa vore en kommentar till ingen.
 *
 * @param {object} konfig
 * @param {import("./samtalskalla.js").Tradfunktioner & ReturnType<typeof import("./samtalskalla.js").createSamtalskalla>} konfig.samtal Samtalskällan, med `tradar`.
 * @param {string} konfig.groupId Gruppen vars chatt bär kommentarerna.
 * @param {string} konfig.uid Den inloggade.
 * @param {string} konfig.bas Appens adress till biblioteket (`bibliotekslank`), till exempel `https://my.life-hub.app/bibliotek`.
 * @param {(uid: string) => string | null | undefined} [konfig.namnFor] Ett namn för en avsändare. Utelämnad, eller utan svar: "Namn saknas".
 * @returns {Postkommentarer}
 */
export function createPostkommentarer(konfig) {
  const { samtal, groupId, uid, bas, namnFor } = konfig ?? /** @type {any} */ ({});
  if (!samtal || typeof samtal.skickaPaRot !== "function" || typeof samtal.tradmeddelanden !== "function") {
    throw new Error("createPostkommentarer: samtal krävs, en samtalskälla med tradar. Kommentarerna är chattens trådar och har ingen annan väg.");
  }
  if (typeof groupId !== "string" || groupId === "") throw new Error("createPostkommentarer: groupId krävs.");
  if (typeof uid !== "string" || uid === "") throw new Error("createPostkommentarer: uid krävs.");
  // Prövar basen direkt: en felaktig bas är ett fel när källan byggs, inte vid första kommentaren.
  lasBibliotekslank(bas, "");
  const sid = samtalsnyckel({ groupId, slag: "grupp" });
  /** @type {Promise<unknown> | null} */
  let oppen = null;
  const klar = () => {
    if (!oppen) {
      oppen = samtal.oppnaGrupp({ groupId, uid });
      oppen.catch(() => {
        oppen = null;
      });
    }
    return oppen;
  };

  /** @param {any} m @param {{ id: string }} post @returns {Postkommentar} */
  const rad = (m, post) => {
    const gast = arGastId(m.av);
    const namn = gast ? (typeof m.avNamn === "string" && m.avNamn) || GASTNAMNLOS : (namnFor?.(m.av) || NAMN_SAKNAS);
    return {
      id: m.id,
      namn,
      text: utanPostlank(m.text, (url) => lasBibliotekslank(bas, url)?.postId === post.id),
      tid: m.tid,
      ...(m.av === uid ? { egen: true } : {}),
      ...(gast ? { gast: true } : {}),
    };
  };
  /** @param {any} rot @param {any[]} svar @param {{ id: string }} post */
  const rader = (rot, svar, post) => (rot ? [rad(rot, post), ...svar.map((m) => rad(m, post))] : []);

  /** @param {{ id: string, groupId: string }} post */
  const kanKommentera = (post) => Boolean(post) && typeof post.id === "string" && !arMittBibliotek(post.groupId);

  return {
    kanKommentera,
    async las(post) {
      await klar();
      const rid = kommentarRotId(post.id);
      const [rot, svar] = await Promise.all([samtal.rotmeddelande(sid, rid), samtal.tradmeddelanden(sid, rid)]);
      return { rader: rader(rot, svar, post) };
    },
    async kommentera(post, text) {
      if (!kanKommentera(post)) throw new Error("Posten i Mitt bibliotek kan inte kommenteras i gruppens chatt.");
      await klar();
      const lank = bibliotekslank(bas, { plats: post.groupId, postId: post.id });
      return samtal.skickaPaRot(sid, kommentarRotId(post.id), { text, rotText: kommentarRotText(text, lank), av: uid });
    },
    prenumerera(post, { onData, onError }) {
      const rid = kommentarRotId(post.id);
      let levande = true;
      /** @type {any} */
      let rot = null;
      /** @type {any[]} */
      let svar = [];
      /** @type {(() => void) | null} */
      let sluta = null;
      const lasRot = async () => {
        rot = await samtal.rotmeddelande(sid, rid);
        if (levande) onData(rader(rot, svar, post));
      };
      klar().then(
        () => {
          if (!levande) return;
          lasRot().catch((e) => levande && onError(e));
          sluta = samtal.prenumereraTrad(sid, rid, {
            onData: (r) => {
              svar = r;
              // Roten kan ha skapats av någon annan sedan den lästes: ett svar i tråden betyder att den finns.
              if (!rot) lasRot().catch((e) => levande && onError(e));
              else if (levande) onData(rader(rot, svar, post));
            },
            onError: (e) => levande && onError(e),
          });
        },
        (e) => levande && onError(e),
      );
      return () => {
        levande = false;
        sluta?.();
      };
    },
  };
}
