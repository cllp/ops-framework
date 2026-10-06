import { useCallback, useEffect, useRef, useState } from "react";
import { motpart } from "../lib/samtal.js";

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
  /** Raderna som lagts in lokalt och som källan ännu inte svarat med. Nyckel: samtalets id. */
  /** Källans senaste svar, utan de lokala raderna. Bara det svaret får avgöra att källan kommit ikapp. */
  const kallsvar = useRef(/** @type {Awaited<ReturnType<ReturnType<typeof import("./samtalskalla.js").createSamtalskalla>["oversikt"]>>} */ ([]));
  const lokala = useRef(/** @type {Map<string, { samtal: import("../lib/samtal.js").Samtal, senaste: (import("../lib/samtal.js").Meddelande & { id: string }) | null }>} */ (new Map()));

  /**
   * Slår in de lokala raderna i källans svar, och glömmer dem källan har kommit ikapp med.
   * @param {Awaited<ReturnType<ReturnType<typeof import("./samtalskalla.js").createSamtalskalla>["oversikt"]>>} fran
   */
  const sammanfoga = (fran) => {
    const rader = [...fran];
    for (const [id, l] of lokala.current) {
      const i = rader.findIndex((r) => r.samtal.id === id);
      if (i < 0) {
        rader.push({ samtal: l.samtal, senaste: l.senaste, olasta: 0, lastTill: l.senaste?.tid ?? 0, motpart: motpart(l.samtal, uid ?? "") });
        continue;
      }
      const r = rader[i];
      if (l.senaste && (!r.senaste || r.senaste.tid < l.senaste.tid)) rader[i] = { ...r, senaste: l.senaste };
      else lokala.current.delete(id);
    }
    const tid = (/** @type {typeof rader[number]} */ r) => r.senaste?.tid ?? r.samtal.skapad ?? 0;
    return rader.sort((a, b) => tid(b) - tid(a));
  };

  const lasOm = useCallback(async () => {
    if (!kalla || !groupId || !uid) {
      setLage({ rader: [], laddar: !groupId || !uid ? false : true, fel: null });
      return;
    }
    const nr = ++levande.current;
    try {
      const rader = await kalla.oversikt({ groupId, uid });
      // ⛔ Ett sent svar för en grupp man redan lämnat skrivs inte in i den nya gruppens inkorg.
      if (nr === levande.current) {
        kallsvar.current = rader;
        setLage({ rader: sammanfoga(rader), laddar: false, fel: null });
      }
    } catch (fel) {
      if (nr === levande.current) setLage({ rader: [], laddar: false, fel: fel instanceof Error ? fel : new Error(String(fel)) });
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
      levande.current += 1;
    };
  }, [lasOm]);

  // `senaste`: det man just skickade, om något.
  const laggIn = useCallback(
    (/** @type {import("../lib/samtal.js").Samtal} */ samtal, /** @type {(import("../lib/samtal.js").Meddelande & { id: string }) | null} */ senaste = null) => {
      if (!uid || !groupId || samtal.groupId !== groupId) return;
      const forra = lokala.current.get(samtal.id);
      const nyast = forra?.senaste && (!senaste || forra.senaste.tid > senaste.tid) ? forra.senaste : senaste;
      lokala.current.set(samtal.id, { samtal, senaste: nyast });
      setLage((f) => ({ rader: sammanfoga(kallsvar.current), laddar: false, fel: f.fel }));
      // ⛔ Omläsningen räknar upp `levande`, så ett svar som var på väg FÖRE inläggningen skriver inte över den.
      lasOm();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, groupId, lasOm],
  );

  const olasta = lage.rader.reduce((n, r) => n + r.olasta, 0);
  return { ...lage, olasta, lasOm, laggIn };
}
