import { LISTRADTEXT } from "./biblioteklista.js";

/**
 * Orden på sidan för en delad post (fil, anteckning, länk, lista), på svenska och engelska (0.201.0, cllp/ops-framework#544).
 *
 * Före 0.201.0 var filens sida bara på svenska, medan händelsens sida och gästens sida hade svenska och engelska. Mottagaren av en delad länk är ofta inte medlem, och
 * kan lika gärna läsa engelska. Vyerna (`OpsDelad`, `DeladFil`, `DeladLista`) läser språket ur `useOpsSprak()`, som `OpsDeladSida` sätter.
 * Raderna i en lista som inte går att visa har medlemmens egna ord på svenska (`LISTRADTEXT`), en sanning (regel 2).
 * @type {import("./ord.js").Ordbok}
 */
export const ORD_OPSDELAD = {
  laddar: { sv: "Hämtar", en: "Loading" },
  anteckning: { sv: "Anteckning", en: "Note" },
  lank: { sv: "Länk", en: "Link" },
  lista: { sv: "Lista", en: "List" },
  typ_ljud: { sv: "Ljud", en: "Audio" },
  typ_bild: { sv: "Bild", en: "Image" },
  typ_video: { sv: "Video", en: "Video" },
  typ_pdf: { sv: "PDF", en: "PDF" },
  typ_dokument: { sv: "Dokument", en: "Document" },
  oppnaLanken: { sv: "Öppna länken", en: "Open the link" },
  oppnaLankenNamn: { sv: "Öppna länken {namn}", en: "Open the link {namn}" },
  oppna: { sv: "Öppna", en: "Open" },
  ingenText: { sv: "Anteckningen har ingen text.", en: "The note has no text." },
  filFel: { sv: "Filen gick inte att visa just nu.", en: "The file could not be shown right now." },
  visasInte: { sv: "Filen går inte att visa här.", en: "The file cannot be shown here." },
  visasInteLadda: { sv: " Ladda ner den för att öppna den.", en: " Download it to open it." },
  pdfVisasInte: { sv: "Den här webbläsaren visar inte PDF-filer här. Öppna den i en ny flik.", en: "This browser does not show PDF files here. Open it in a new tab." },
  oppnaPdf: { sv: "Öppna PDF", en: "Open PDF" },
  laddaNer: { sv: "Ladda ner", en: "Download" },
  laddaNerNamn: { sv: "Ladda ner {namn}", en: "Download {namn}" },
  spelaNamn: { sv: "Spela {namn}", en: "Play {namn}" },
  pausaNamn: { sv: "Pausa {namn}", en: "Pause {namn}" },
  spola: { sv: "Spola", en: "Seek" },
  tidAv: { sv: "{tid} av {langd}", en: "{tid} of {langd}" },
  spelare: { sv: "Spelare", en: "Player" },
  post: { sv: "post", en: "item" },
  poster: { sv: "poster", en: "items" },
  tom: { sv: "Listan är tom.", en: "The list is empty." },
  posterI: { sv: "Posterna i {namn}", en: "The items in {namn}" },
  ejVisad: { sv: "1 post till visas inte här.", en: "1 more item is not shown here." },
  ejVisade: { sv: "{n} poster till visas inte här.", en: "{n} more items are not shown here." },
  spelasNu: { sv: "Spelas nu", en: "Playing now" },
  spelaUrListan: { sv: "Spela {namn} ur listan", en: "Play {namn} from the list" },
  saknas: { sv: LISTRADTEXT.saknas, en: "No longer exists" },
  listaILista: { sv: LISTRADTEXT.lista, en: "A list cannot be inside a list." },
};
