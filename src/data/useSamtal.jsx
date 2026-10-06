import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motpart } from "../lib/samtal.js";

/** @typedef {Awaited<ReturnType<ReturnType<typeof import("./samtalskalla.js").createSamtalskalla>["oversikt"]>>} Rader */
/** @typedef {Map<string, { samtal: import("../lib/samtal.js").Samtal, senaste: (import("../lib/samtal.js").Meddelande & { id: string }) | null }>} Lokala */

/**
 * Slår in de lokala raderna i källans svar. Ren: de lokala rader källan har kommit ikapp med (samtalet finns och dess senaste
 * meddelande är minst lika nytt) står inte i den karta som returneras, och anroparen sparar den kartan.
 *
 * @param {Rader} fran Källans svar.
 * @param {Lokala} lokala
 * @param {string} uid
 * @returns {{ rader: Rader, kvar: Lokala }}
 */
function sammanfoga(fran, lokala, uid) {
  const rader = [...fran];
  /** @type {Lokala} */
  const kvar = new Map();
  for (const [id, l] of lokala) {
    const i = rader.findIndex((r) => r.samtal.id === id);
    if (i < 0) {
      rader.push({ samtal: l.samtal, senaste: l.senaste, olasta: 0, lastTill: l.senaste?.tid ?? 0, motpart: motpart(l.samtal, uid) });
      kvar.set(id, l);
      continue;
    }
    const r = rader[i];
    if (l.senaste && (!r.senaste || r.senaste.tid < l.senaste.tid)) {
      rader[i] = { ...r, senaste: l.senaste };
      kvar.set(id, l);
    }
  }
  const tid = (/** @type {Rader[number]} */ r) => r.senaste?.tid ?? r.samtal.skapad ?? 0;
  return { rader: rader.sort((a, b) => tid(b) - tid(a)), kvar };
}

/**
 * Inkorgens rader och antalet olästa, ur en samtalskälla (0.34.0, #182).
 *
 * ⛔ TRE TILLSTÅND, SAMMA SKÄL SOM `useKallor`: `laddar`, `fel` och raderna. En inkorg som visar "Inga meddelanden" medan
 * hämtningen pågår har lugnat någon om något den inte vet.
 *
 * ⛔ ANTALET OLÄSTA RÄKNAS UR RADERNA, det hämtas inte för sig. En badge som frågar på egen hand kan visa 2 medan
 * inkorgen bredvid visar 3, och då litar ingen på någon av dem.
 *
 * ⛔ LÄSES OM NÄR FÖNSTRET FÅR FOKUS. Ingen realtidsnärvaro i 0.34.0 (se CHANGELOG), men den som kommer tillbaka till
 * fliken ska inte se en inkorg från i morse.
 *
 * ⛔ `laggIn` LÄGGER IN EN RAD LOKALT DIREKT, OCH LÄSER SEDAN OM (0.63.0, #263). Den som just öppnat eller skrivit i ett samtal
 * ska se det i listan i samma stund, inte vid nästa `focus`. CP 2026-10-06: "Chatten dök upp långt senare", och frågan
 * skickades två gånger. Inget sparas: raden hålls i minnet tills källan själv har svarat med samtalet och med ett meddelande
 * som är minst lika nytt. Fram till dess slås den in i varje omläsning. ⛔ ANNARS TOG OMLÄSNINGEN BORT DEN IGEN. En källa som
 * ännu inte ser samtalet (en fråga som besvaras ur en cache, ett index som inte hunnit ikapp) svarar utan det, och en rad som
 * stod där i en halv sekund och sedan försvann är samma fel som CP såg, kortare. Ett samtal i en annan grupp än den inkorgen
 * visar läggs aldrig in: ett svar som kommer efter ett gruppbyte hör till den förra gruppen.
 * Ingen spegelkolumn (`senast`) på samtalsdokumentet byggs för det (regel 2, se filhuvudet i `lib/samtal.js`).
 *
 * @param {{ kalla: ReturnType<typeof import("./samtalskalla.js").createSamtalskalla> | null | undefined, groupId: string | null | undefined, uid: string | null | undefined }} arg
 */
export function useSamtal({ kalla, groupId, uid }) {
  const [lage, setLage] = useState(
    /** @type {{ rader: Awaited<ReturnType<ReturnType<typeof import("./samtalskalla.js").createSamtalskalla>["oversikt"]>>, laddar: boolean, fel: Error | null }} */ ({ rader: [], laddar: true, fel: null }),
  );
  const levande = useRef(0);
  /** Källans senaste svar, utan de lokala raderna. Bara det svaret får avgöra att källan kommit ikapp. */
  const kallsvar = useRef(/** @type {Rader} */ ([]));
  /** Raderna som lagts in lokalt och som källan ännu inte svarat med. Nyckel: samtalets id. */
  const lokala = useRef(/** @type {Lokala} */ (new Map()));
  /*
   * ⛔ GRUPPEN SOM VISAS JUST NU, INTE DEN SOM GÄLLDE NÄR ETT ANROP BÖRJADE (granskningen av PR 264, tredje varvet). Ett gruppbyte
   * medan `oppnaPrivat` pågick lade in förra gruppens samtal i den nya inkorgen: anroparen höll kvar `laggIn` ur renderingen där
   * klicket skedde, och dess `groupId` var den gamla gruppen, så kontrollen jämförde g med g. `lokala` är en ref och delades med
   * den nya gruppen, och den gamla `lasOm` kunde skriva in g:s hela översikt. Både `laggIn` och `lasOm` jämför därför med refen.
   */
  const gruppNu = useRef(groupId);
  // Skrivs när renderingen är på plats, inte under den: en rendering som React kastar får inte flytta refen.
  useLayoutEffect(() => {
    gruppNu.current = groupId;
  }, [groupId]);

  const lasOm = useCallback(async () => {
    if (!kalla || !groupId || !uid) {
      setLage({ rader: [], laddar: !groupId || !uid ? false : true, fel: null });
      return;
    }
    /*
     * ⛔ En `lasOm` ur en rendering för en annan grupp gör ingenting. Den får inte heller räkna upp `levande`: då hade den
     * aktuella gruppens läsning som är på väg kastats som inaktuell, och inkorgen hade stått kvar på "laddar" eller tom.
     * Det är den enda gruppkontrollen i `lasOm` som behövs. Ett sent svar för en grupp man lämnat fångas av numret. Vid ett
     * byte från g till h är det h:s nya läsning som räknar upp `levande`, så g:s svar har inte längre det aktuella numret.
     * Effektens städning (`levande.current += 1` nedan) bär bara när ingen ny läsning startar: gruppen blir `null`, eller
     * källan byts utan att en ny läsning kommer igång. Fallet null har ett eget prov i `useSamtal.test.jsx`. En andra kontroll av gruppen på svaret stod här och var grön utan sig själv i varje prov, och togs
     * bort i fjärde varvet av granskningen av PR 264 (regel 4: ett skydd som inte kan ses falla är ingen vakt).
     */
    if (gruppNu.current !== groupId) return;
    const nr = ++levande.current;
    const aktuell = () => nr === levande.current;
    try {
      const rader = await kalla.oversikt({ groupId, uid });
      // ⛔ Ett sent svar för en grupp man redan lämnat skrivs inte in i den nya gruppens inkorg.
      if (aktuell()) {
        kallsvar.current = rader;
        const s = sammanfoga(rader, lokala.current, uid);
        lokala.current = s.kvar;
        setLage({ rader: s.rader, laddar: false, fel: null });
      }
    } catch (fel) {
      if (aktuell()) setLage({ rader: [], laddar: false, fel: fel instanceof Error ? fel : new Error(String(fel)) });
    }
  }, [kalla, groupId, uid]);

  useEffect(() => {
    lokala.current = new Map();
    kallsvar.current = [];
    setLage((f) => ({ ...f, rader: [], laddar: true, fel: null }));
    lasOm();
    if (typeof window === "undefined") return undefined;
    const fokus = () => lasOm();
    window.addEventListener("focus", fokus);
    return () => {
      window.removeEventListener("focus", fokus);
      // ⛔ Det enda skyddet mot ett sent svar när ingen ny läsning startar efter bytet (gruppen blir `null`). Se ovan.
      levande.current += 1;
    };
  }, [lasOm]);

  // `senaste`: det man just skickade, om något.
  const laggIn = useCallback(
    (/** @type {import("../lib/samtal.js").Samtal} */ samtal, /** @type {(import("../lib/samtal.js").Meddelande & { id: string }) | null} */ senaste = null) => {
      // ⛔ Mot gruppen som visas NU, se `gruppNu`. Ett `laggIn` ur en äldre rendering bär en gammal `groupId`.
      if (!uid || !groupId || gruppNu.current !== groupId || samtal.groupId !== groupId) return;
      const forra = lokala.current.get(samtal.id);
      const nyast = forra?.senaste && (!senaste || forra.senaste.tid > senaste.tid) ? forra.senaste : senaste;
      lokala.current = new Map(lokala.current).set(samtal.id, { samtal, senaste: nyast });
      const s = sammanfoga(kallsvar.current, lokala.current, uid);
      lokala.current = s.kvar;
      setLage((f) => ({ rader: s.rader, laddar: false, fel: f.fel }));
      // ⛔ Omläsningen räknar upp `levande`, så ett svar som var på väg FÖRE inläggningen skriver inte över den.
      lasOm();
    },
    [uid, groupId, lasOm],
  );

  const olasta = lage.rader.reduce((n, r) => n + r.olasta, 0);
  // ⛔ Summan är ett golv så snart en rad är det (chattens nattskiva): räkningen i den raden nådde sidans storlek.
  const olastaFler = lage.rader.some((r) => r.olastaFler === true);
  return { ...lage, olasta, olastaFler, lasOm, laggIn };
}
