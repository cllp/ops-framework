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
 * skickades två gånger. Raden är en förhandsvisning av det omläsningen strax ger: inget sparas, och omläsningen vinner.
 * Ingen spegelkolumn (`senast`) på samtalsdokumentet byggs för det (regel 2, se filhuvudet i `lib/samtal.js`).
 *
 * @param {{ kalla: ReturnType<typeof import("./samtalskalla.js").createSamtalskalla> | null | undefined, groupId: string | null | undefined, uid: string | null | undefined }} arg
 */
export function useSamtal({ kalla, groupId, uid }) {
  const [lage, setLage] = useState(
    /** @type {{ rader: Awaited<ReturnType<ReturnType<typeof import("./samtalskalla.js").createSamtalskalla>["oversikt"]>>, laddar: boolean, fel: Error | null }} */ ({ rader: [], laddar: true, fel: null }),
  );
  const levande = useRef(0);

  const lasOm = useCallback(async () => {
    if (!kalla || !groupId || !uid) {
      setLage({ rader: [], laddar: !groupId || !uid ? false : true, fel: null });
      return;
    }
    const nr = ++levande.current;
    try {
      const rader = await kalla.oversikt({ groupId, uid });
      // ⛔ Ett sent svar för en grupp man redan lämnat skrivs inte in i den nya gruppens inkorg.
      if (nr === levande.current) setLage({ rader, laddar: false, fel: null });
    } catch (fel) {
      if (nr === levande.current) setLage({ rader: [], laddar: false, fel: fel instanceof Error ? fel : new Error(String(fel)) });
    }
  }, [kalla, groupId, uid]);

  useEffect(() => {
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
      if (!uid) return;
      setLage((f) => {
        const finns = f.rader.find((r) => r.samtal.id === samtal.id);
        const ny = finns
          ? { ...finns, senaste: senaste && (!finns.senaste || senaste.tid >= finns.senaste.tid) ? senaste : finns.senaste }
          : { samtal, senaste, olasta: 0, lastTill: senaste?.tid ?? 0, motpart: motpart(samtal, uid) };
        const tid = (/** @type {typeof ny} */ r) => r.senaste?.tid ?? r.samtal.skapad ?? 0;
        const rader = [ny, ...f.rader.filter((r) => r.samtal.id !== samtal.id)].sort((a, b) => tid(b) - tid(a));
        return { rader, laddar: false, fel: f.fel };
      });
      // ⛔ Omläsningen räknar upp `levande`, så ett svar som var på väg FÖRE inläggningen skriver inte över den.
      lasOm();
    },
    [uid, lasOm],
  );

  const olasta = lage.rader.reduce((n, r) => n + r.olasta, 0);
  return { ...lage, olasta, lasOm, laggIn };
}
