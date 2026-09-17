/**
 * Datalagrets kontrakt.
 *
 * ⛔ Poängen är att appens vyer ALDRIG vet var datan kommer ifrån.
 *
 * En vy som anropar `firestore.collection(...)` är låst vid Firestore för all
 * framtid, och den låsningen syns inte förrän någon vill byta. Med ett kontrakt
 * emellan är källan ett byte av en rad vid uppstarten: JSON i repot i dag,
 * Firestore i morgon, SQL bakom ett API sedan.
 *
 * Fyra regler gör kontraktet värt något. Utan dem läcker källans egenheter
 * igenom och abstraktionen blir en lögn.
 *
 * ⛔ 1. ALLT ÄR ASYNKRONT, även minnesadaptern.
 *
 * En synkron läsning från minnet hade sett bekväm ut och tvingat fram en
 * omskrivning av varje anropsställe den dag källan blev ett nätverksanrop.
 * Kontraktet får inte avslöja hur snabb källan råkar vara.
 *
 * ⛔ 2. FEL KASTAS, de returneras aldrig som tomhet.
 *
 * En läsning som misslyckas får aldrig se ut som "det fanns inget". Det är
 * samma falska grönhet som en vakt som blir grön av tom indata: appen visar
 * "Inga kostnader" när sanningen är att servern svarade 500, och användaren
 * drar en slutsats om sin data som inte stämmer.
 *
 * ⛔ 3. `las` returnerar `null` för "finns inte", och det är INTE ett fel.
 *
 * Skillnaden mellan "dokumentet saknas" och "jag kunde inte fråga" måste gå att
 * se, annars går den inte att hantera olika.
 *
 * ⛔ 4. Varje post har ett `id`. Adaptern sätter det vid `skapa`.
 *
 * Utan en gemensam nyckelkonvention kan ingen delad kod, som listor eller
 * tabeller, veta vad som identifierar en rad.
 *
 * ⛔ 5. `prenumerera` ÄR FRIVILLIG, och de fem obligatoriska är fortfarande fem.
 *
 * Realtid är inte en egenskap hos kontraktet utan hos källan. En JSON-fil i
 * repot kan inte pusha, och att kräva metoden hade tvingat varje adapter att
 * ljuga: antingen med en pollingloop som låtsas vara en ström, eller med en
 * metod som kastar och därmed inte går att anropa. Båda är sämre än ett ärligt
 * "den här källan kan det inte".
 *
 * Därför står den INTE i `OPERATIONER`, och `skapaDatakalla` kräver den inte.
 * Den som vill ha realtid frågar källan (`typeof kalla.prenumerera === "function"`)
 * och får ett svar den kan handla på. `useSamlingLive` gör precis det och
 * rapporterar utfallet i `realtid`, i stället för att falla tillbaka i tysthet.
 *
 * ⛔ EN TYST TILLBAKAFALLNING VORE DET FARLIGA HÄR. En app som tror sig ha
 * realtid och inte har det ser exakt likadan ut som en som har det, ända tills
 * någon undrar varför en post inte dök upp. Det felet går inte att se, bara att
 * misstänka.
 */

/**
 * @template T
 * @typedef {object} Datakalla
 * @property {(samling: string, id: string) => Promise<T | null>} las En post, eller null om den inte finns.
 * @property {(samling: string, fraga?: Fraga) => Promise<T[]>} lista
 * @property {(samling: string, data: Partial<T>) => Promise<T>} skapa Returnerar posten med sitt id.
 * @property {(samling: string, id: string, data: Partial<T>) => Promise<T>} uppdatera
 * @property {(samling: string, id: string) => Promise<void>} taBort
 * @property {(samling: string, fraga: Fraga | undefined, lyssnare: Lyssnare<T>) => Avsluta} [prenumerera]
 *   ⛔ FRIVILLIG. Se regel 5 nedan.
 */

/**
 * @template T
 * @typedef {object} Lyssnare
 * @property {(rader: T[]) => void} vidData Varje gång urvalet ändras, inklusive första gången.
 * @property {(fel: Error) => void} vidFel
 */

/** @typedef {() => void} Avsluta Stänger prenumerationen. Måste tåla att anropas flera gånger. */

/**
 * @typedef {object} Fraga
 * @property {Record<string, unknown>} [dar] Likhetsvillkor. `{ status: "oppen" }`.
 * @property {string} [sortera] Fältnamn.
 * @property {"upp" | "ner"} [riktning]
 * @property {number} [antal]
 */

/** De operationer varje adapter måste ha. */
export const OPERATIONER = ["las", "lista", "skapa", "uppdatera", "taBort"];

/**
 * Tar emot en adapter och ger tillbaka en datakälla.
 *
 * ⛔ Kontrollen är inte ceremoni. En adapter som saknar en metod ger annars
 * `undefined is not a function` först den dag någon råkar anropa just den, och
 * det felet pekar mot anropsstället i stället för mot adaptern. Att säga ifrån
 * vid uppstart flyttar felet dit det hör hemma.
 *
 * @template T
 * @param {Partial<Datakalla<T>> & { namn?: string }} adapter
 * @returns {Datakalla<T>}
 */
export function skapaDatakalla(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new Error("skapaDatakalla: en adapter krävs. Se skapaMinneskalla eller skapaJsonKalla för exempel.");
  }
  const saknas = OPERATIONER.filter((op) => typeof (/** @type {any} */ (adapter)[op]) !== "function");
  if (saknas.length > 0) {
    throw new Error(
      `skapaDatakalla: adaptern "${adapter.namn ?? "namnlös"}" saknar ${saknas.join(", ")}. ` +
        "En halv adapter kraschar först den dag någon anropar just den metoden, och felet pekar då mot anropsstället i stället för hit.",
    );
  }
  return /** @type {Datakalla<T>} */ (adapter);
}

/**
 * Filtrerar och sorterar en lista enligt en fråga.
 *
 * Delas av de adaptrar som håller allt i minnet (minne, JSON). En riktig databas
 * gör det här i sin egen frågemotor och använder alltså inte den här.
 *
 * @template {{ id: string }} T
 * @param {T[]} rader @param {Fraga} [fraga] @returns {T[]}
 */
export function tillampaFraga(rader, fraga) {
  if (!fraga) return rader;
  let ut = rader;

  if (fraga.dar) {
    const villkor = Object.entries(fraga.dar);
    ut = ut.filter((r) => villkor.every(([f, v]) => /** @type {any} */ (r)[f] === v));
  }

  if (fraga.sortera) {
    const falt = fraga.sortera;
    const tecken = fraga.riktning === "ner" ? -1 : 1;
    // Kopia före sort: `Array.sort` muterar, och en adapter som sorterar om
    // sin egen lagring ändrar tyst ordningen för nästa läsare.
    ut = [...ut].sort((a, b) => {
      const x = /** @type {any} */ (a)[falt];
      const y = /** @type {any} */ (b)[falt];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * tecken;
    });
  }

  return typeof fraga.antal === "number" ? ut.slice(0, fraga.antal) : ut;
}
