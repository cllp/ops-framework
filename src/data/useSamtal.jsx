import { useCallback, useEffect, useRef, useState } from "react";

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

  const olasta = lage.rader.reduce((n, r) => n + r.olasta, 0);
  return { ...lage, olasta, lasOm };
}
