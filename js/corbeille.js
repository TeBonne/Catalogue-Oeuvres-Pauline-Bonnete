"use strict";
/* Corbeille : restauration et suppression définitive (administrateur). */

/* ---------- Corbeille (administrateur) ---------- */
async function vueCorbeille(message = "", type = "info") {
  if (!etat.admin) return vueListe();
  majLateral("corbeille");
  window.scrollTo(0, 0);
  app.innerHTML = `<p class="sous">Chargement…</p>`;
  const { data, error } = await sb.from("oeuvres").select("id,titre,vignette_path,supprime_le")
    .not("supprime_le", "is", null).order("supprime_le", { ascending: false }).limit(1000);
  const items = data || [];
  if (error) { message = msgErreur(error); type = "erreur"; }
  else { etat.enCorbeille = items.length; majLateral(); }
  const jour = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  app.innerHTML = `
    <div id="corb" class="corb etroit">
      ${entete("Corbeille")}
      <p class="sous">Les œuvres supprimées restent ici tant qu'un administrateur ne les efface pas définitivement.</p>
      <div id="alerte">${message ? `<div class="message ${type}">${message}</div>` : ""}</div>
      ${items.map((o) => `
        <section class="carte bloc" data-id="${o.id}">
          <div class="tete"><img loading="lazy" alt="" src="${esc(urlPhoto(o.vignette_path))}">
            <div><strong>${esc(o.titre)}</strong><div class="sous">Supprimée le ${esc(jour(o.supprime_le))}</div></div></div>
          <div class="rang"><button class="btn" data-action="restaurer">Restaurer</button><button class="btn danger" data-action="effacer">Supprimer</button></div>
        </section>`).join("") || `<div class="vide">La corbeille est vide.</div>`}
      ${items.length ? `<button class="btn danger large" id="vider" style="margin-top:8px">Vider la corbeille (${items.length})</button>` : ""}
    </div>`;
  $("#retour").addEventListener("click", () => vueAdmin());
  const erreur = (m) => { $("#alerte").innerHTML = `<div class="message erreur">${m}</div>`; window.scrollTo(0, 0); };

  $("#corb").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]"); if (!b) return;
    const o = items.find((x) => x.id === b.closest("[data-id]").dataset.id);
    try {
      if (b.dataset.action === "restaurer") {
        b.disabled = true;
        const res = await sb.from("oeuvres").update({ supprime_le: null }).eq("id", o.id).select("id");
        if (res.error) throw res.error;
        return vueCorbeille(`« ${esc(o.titre)} » a été restaurée dans le catalogue.`);
      }
      const accord = await confirmer({
        titre: "Supprimer définitivement ?",
        corps: `« ${o.titre} » et ses photos seront effacées. Cette action est irréversible.`,
        vignette: urlPhoto(o.vignette_path), action: "Supprimer définitivement"
      });
      if (!accord) return;
      b.disabled = true;
      const res = await sb.from("oeuvres").delete().eq("id", o.id).select("photo_path,vignette_path");
      if (res.error) throw res.error;
      if (!res.data.length) throw new Error("Suppression refusée : droits insuffisants.");
      await effacerPhotos(res.data);
      vueCorbeille(`« ${esc(o.titre)} » a été supprimée définitivement.`);
    } catch (err) { b.disabled = false; erreur(msgErreur(err)); }
  });

  if (items.length) $("#vider").addEventListener("click", async () => {
    const accord = await confirmer({
      titre: "Vider la corbeille ?",
      corps: `${items.length} œuvre${items.length > 1 ? "s" : ""} et leurs photos seront effacées. Cette action est irréversible.`,
      action: "Tout supprimer définitivement"
    });
    if (!accord) return;
    $("#vider").disabled = true;
    try {
      const res = await sb.from("oeuvres").delete().not("supprime_le", "is", null).select("photo_path,vignette_path");
      if (res.error) throw res.error;
      await effacerPhotos(res.data);
      vueCorbeille(`Corbeille vidée : ${res.data.length} œuvre${res.data.length > 1 ? "s" : ""} supprimée${res.data.length > 1 ? "s" : ""} définitivement.`);
    } catch (err) { $("#vider").disabled = false; erreur(msgErreur(err)); }
  });
}
