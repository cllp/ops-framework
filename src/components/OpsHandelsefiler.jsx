import { ORD_OPSPLATSFILER, OpsPlatsfiler } from "./OpsPlatsfiler.jsx";

/**
 * En händelses filer: sektionen "Filer" i händelsepanelen (0.121.0, cllp/lifehub.app#366, docs/beslut/0006).
 *
 * ⛔ SEDAN 0.122.0 ÄR DET HÄR ETT NAMN OCH INGEN EGEN KOMPONENT. Sektionen blev generell (`OpsPlatsfiler`, docs/beslut/0007) när ärenden fick
 * samma filer, i stället för att kopieras (regel 2). `OpsHandelsefiler` är `OpsPlatsfiler` med slaget låst till händelse: en app som redan
 * använder namnet ser ingen skillnad, och en ärendekälla ritas aldrig under en händelse (kastar). Propar och beteende står i `OpsPlatsfiler`.
 * Felen heter `OpsPlatsfiler`, eftersom det är där de kastas.
 *
 * @param {Omit<Parameters<typeof OpsPlatsfiler>[0], "slag">} props
 */
export function OpsHandelsefiler(props) {
  return <OpsPlatsfiler {...props} slag="handelse" />;
}

/** Samma ordlista som `OpsPlatsfiler`: det fanns ingen egen att hålla lika med den (regel 2). Kvar för bakåtkompatibilitet. */
export const ORD_OPSHANDELSEFILER = ORD_OPSPLATSFILER;
