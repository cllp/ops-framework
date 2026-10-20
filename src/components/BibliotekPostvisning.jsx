import { useState } from "react";
import { File as FilIkon, FileText, Globe, Image as BildIkon, List as ListIkon, Mic, Video as VideoIkon } from "lucide-react";
import { ADRESSFORM, filSort } from "../lib/bibliotek.js";
import { lankKalla, lankKallnamn } from "../lib/lankkalla.js";
import { KallIkon } from "./icons.jsx";

/*
 * Hur en bibliotekspost ritas som en liten bit: typens ikon, plattan bakom den, etiketten och, sedan 0.128.0, en länks källa och omslag.
 *
 * ⛔ UTBRUTET UR `OpsBibliotek` (0.128.0, cllp/lifehub.app#378). Listan i en lista (`BibliotekLista`) ritar samma poster som biblioteket gör, med samma ikon, samma
 * etikett och samma märke, och en andra kopia av dem hade glidit isär (regel 2). `TypIkon`, `plattKlass` och `typEtikett` är oförändrade, bara flyttade.
 */

/**
 * Typens ikon i typens färg, 16 px och utan ruta (SessionStudios `LibraryRow`). Bilden fyller en ruta i stället.
 *
 * @param {{ post: { typ: string, fil?: { mime?: string } } }} props
 */
export function TypIkon({ post }) {
  if (post.typ === "fil") {
    const sort = filSort(post.fil?.mime);
    if (sort === "ljud") return <Mic size={20} aria-hidden="true" className="text-typ-ljud" />;
    if (sort === "bild") return <BildIkon size={20} aria-hidden="true" className="text-typ-lank" />;
    if (sort === "video") return <VideoIkon size={20} aria-hidden="true" className="text-ink-secondary" />;
    return <FilIkon size={20} aria-hidden="true" className="text-ink-secondary" />;
  }
  if (post.typ === "lista") return <ListIkon size={20} aria-hidden="true" className="text-ink-secondary" />;
  if (post.typ === "lank") return <Globe size={20} aria-hidden="true" className="text-typ-lank" />;
  return <FileText size={20} aria-hidden="true" className="text-typ-anteckning" />;
}

/**
 * Plattan bakom ikonen, i typens ton (SessionStudios app): ljud rosa, länk och bild blå, anteckning lila, dokument och lista neutral.
 *
 * @param {{ typ: string, fil?: { mime?: string } }} post
 */
export function plattKlass(post) {
  if (post.typ === "fil") {
    const sort = filSort(post.fil?.mime);
    if (sort === "ljud") return "bg-typ-ljud/15";
    if (sort === "bild") return "bg-typ-lank/15";
    return "bg-raised";
  }
  if (post.typ === "lista") return "bg-raised";
  if (post.typ === "lank") return "bg-typ-lank/15";
  return "bg-typ-anteckning/15";
}

/**
 * Källan en länk kommer från: den sparade, och för en länk från före 0.128.0 (som inte har någon) den adressen ger. Samma funktion som skrev den (`lankKalla`), så de
 * två inte kan säga olika.
 *
 * @param {{ kalla?: string, url?: string }} post
 * @returns {import("../lib/lankkalla.js").Lankkalla}
 */
export function postensKalla(post) {
  return /** @type {any} */ (post.kalla) ?? lankKalla(post.url);
}

/**
 * Öppnas länken direkt vid ett tryck? Bara en musiklänk (en av de fyra källorna) med en adress som går att öppna: CP 2026-10-20, "ett tryck öppnar låten direkt". En vanlig länk
 * öppnar detaljen som förut, där adressen står.
 *
 * @param {{ typ: string, kalla?: string, url?: string }} post
 * @returns {boolean}
 */
export function oppnasDirekt(post) {
  return post.typ === "lank" && typeof post.url === "string" && ADRESSFORM.test(post.url) && postensKalla(post) !== "annat";
}

/**
 * Typetiketten i versaler och i singular, som i SessionStudios app ("SONG", "RECORDING · M4A"): "ANTECKNING", "LÄNK", "LISTA",
 * "LJUD · WEBM", "BILD · HEIC", "DOKUMENT · PDF". Ändelsen ur filnamnet, annars ur MIME. En musiklänk säger sin källa: "LÄNK · SPOTIFY".
 *
 * @param {{ typ: string, kalla?: string, url?: string, fil?: { namn?: string, mime?: string } }} post
 */
export function typEtikett(post) {
  if (post.typ === "anteckning") return "Anteckning";
  if (post.typ === "lista") return "Lista";
  if (post.typ === "lank") {
    const kalla = lankKallnamn(postensKalla(post));
    return kalla ? `Länk · ${kalla}` : "Länk";
  }
  const sort = filSort(post.fil?.mime);
  const namn = sort === "ljud" ? "Ljud" : sort === "bild" ? "Bild" : sort === "video" ? "Video" : "Dokument";
  const ur = /\.([a-z0-9]{1,6})$/i.exec(post.fil?.namn ?? "")?.[1] ?? /\/([a-z0-9.+-]+)$/i.exec(post.fil?.mime ?? "")?.[1]?.replace(/^x-/, "") ?? "";
  return ur ? `${namn} · ${ur}` : namn;
}

/**
 * Märket för en länk: omslaget som en cirkel med källans märke i hörnet, eller bara källans märke när det inte finns något omslag (eller det inte gick att hämta). En länk
 * utan känd källa är jordgloben, som förut.
 *
 * ⛔ ETT OMSLAG SOM INTE LADDAS ÄR INGET FEL ATT VISA (regel 5, bedömt): det är en tredje parts bild, och raden bär redan allt som behövs (rubrik, källa, adress).
 * Bilden byts mot källans märke, och märket finns kvar. Bilden hämtas av webbläsaren från källans egen server, så en app med `img-src` i sin CSP måste släppa in de fyra (se
 * CHANGELOG 0.128.0).
 *
 * @param {{ post: { rubrik?: string, kalla?: string, url?: string, bild?: string }, storlek?: "liten" | "stor" }} props
 */
export function LankMark({ post, storlek = "liten" }) {
  const kalla = postensKalla(post);
  const [bildFel, setBildFel] = useState(false);
  const stor = storlek === "stor";
  const mal = stor ? "size-20" : "size-11";
  const bild = typeof post.bild === "string" && post.bild !== "" && !bildFel ? post.bild : "";
  return (
    <span data-bibliotek-lankmark={kalla} className={`relative flex ${mal} shrink-0 items-center justify-center`}>
      <span className={`flex ${mal} items-center justify-center overflow-hidden rounded-full ${bild ? "bg-raised" : "bg-typ-lank/15"}`}>
        {bild ? (
          <img data-bibliotek-omslag="" src={bild} alt="" aria-hidden="true" referrerPolicy="no-referrer" loading="lazy" onError={() => setBildFel(true)} className={`${mal} object-cover`} />
        ) : (
          <span aria-hidden="true" className="flex text-typ-lank"><KallIkon kalla={kalla} size={stor ? 32 : 20} /></span>
        )}
      </span>
      {bild && kalla !== "annat" ? (
        <span data-bibliotek-kallmarke={kalla} aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-surface text-ink">
          <KallIkon kalla={kalla} size={12} />
        </span>
      ) : null}
    </span>
  );
}
