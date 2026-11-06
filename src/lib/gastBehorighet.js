/**
 * Vad JUST den här gruppgästen får göra, ur fälten servern redan skickar (0.192.0).
 *
 * ⛔ INGET PÅHITAT. Raderna läser `funktioner`, `nedladdning` och `kommentera`. En funktion som inte står med nämns inte.
 * `nedladdning: false` är det enda som tar bort nedladdning (samma regel som biblioteket). Saknas fältet gäller det som förut: nedladdning är på.
 * `kommentera` nämns bara när det är `true` och biblioteket finns. Tom lista är ett svar: gästen har inga av de här funktionerna.
 *
 * @param {{ funktioner?: readonly string[], nedladdning?: boolean, kommentera?: boolean } | null | undefined} grupp
 * @param {string} [sprak]
 * @returns {string[]}
 */
export function gastBehorighetsrader(grupp, sprak = "sv") {
  const en = sprak === "en";
  const har = (/** @type {string} */ f) => Array.isArray(grupp?.funktioner) && grupp.funktioner.includes(f);
  /** @type {string[]} */
  const rader = [];
  if (har("chatt")) rader.push(en ? "You can read and write in the chat, from the beginning." : "Du kan läsa och skriva i chatten, från början.");
  if (har("kalender")) rader.push(en ? "You can see what is coming up and answer on events." : "Du kan se vad som är på gång och svara på händelser.");
  if (har("bibliotek")) {
    rader.push(
      grupp?.nedladdning === false
        ? en
          ? "You can read and play in the library. The group has turned off downloads."
          : "Du kan läsa och spela i biblioteket. Gruppen har stängt av nedladdning."
        : en
          ? "You can read, play and download in the library."
          : "Du kan läsa, spela och ladda ned i biblioteket.",
    );
  }
  if (grupp?.kommentera === true && har("bibliotek")) {
    rader.push(en ? "You can comment on items in the library." : "Du kan kommentera poster i biblioteket.");
  }
  if (har("arenden")) rader.push(en ? "You only see cases the group has given you." : "Du ser bara ärenden som gruppen har gett dig.");
  return rader;
}
