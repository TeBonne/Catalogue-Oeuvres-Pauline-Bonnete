"use strict";
/* Photos complémentaires d'une œuvre (détail, signature, dos, œuvre encadrée…), gérées depuis la fiche.
   La photo principale reste celle de la table « oeuvres » : c'est elle qui apparaît au catalogue et sur le certificat.
   Ajouts et suppressions sont immédiats : ils ne dépendent pas du bouton « Enregistrer » de la fiche. */

const MAX_PHOTOS_PLUS = 8;

async function cheminsComplementaires(idsOeuvres) {
  const chemins = [];
  for (let i = 0; i < idsOeuvres.length; i += 150) {
    const { data, error } = await sb.from("photos_oeuvre").select("photo_path,vignette_path").in("oeuvre_id", idsOeuvres.slice(i, i + 150));
    if (error) throw error;
    chemins.push(...data);
  }
  return chemins;
}

async function monterGalerie(o, rouvrir) {
  const zone = $("#galerie"); if (!zone) return;
  let photos = [];
  const charger = async () => {
    const { data, error } = await sb.from("photos_oeuvre").select("id,photo_path,vignette_path,poids_octets").eq("oeuvre_id", o.id).order("cree_le");
    if (error) throw error;
    photos = data;
  };
  const dessiner = (message = "", type = "info") => {
    if (!zone.isConnected) return;
    zone.innerHTML = `
      <h3 class="galerie-titre">Autres photos <span class="sous">${photos.length} sur ${MAX_PHOTOS_PLUS}</span></h3>
      <div class="galerie">
        ${photos.map((p, i) => `
          <figure data-photo="${p.id}">
            <a href="${esc(urlPhoto(p.photo_path))}" target="_blank" rel="noopener" title="Ouvrir la photo en grand"><img loading="lazy" alt="Photo complémentaire ${i + 1}" src="${esc(urlPhoto(p.vignette_path))}"></a>
            <div class="galerie-actions">
              <button type="button" data-g="principale" aria-label="Définir la photo ${i + 1} comme photo principale" title="Définir comme photo principale">${ICONES.etoile}</button>
              <button type="button" data-g="supprimer" aria-label="Supprimer la photo ${i + 1}" title="Supprimer cette photo">${ICONES.corbeille}</button>
            </div>
          </figure>`).join("")}
        ${photos.length < MAX_PHOTOS_PLUS ? `<label class="galerie-ajout" for="photos-plus">${ICONES.plus}<span>Ajouter</span></label>` : ""}
      </div>
      <input class="cache" id="photos-plus" type="file" accept="image/*" multiple>
      <div id="galerie-message" role="status">${message ? `<div class="message ${type}">${message}</div>` : ""}</div>
      <p class="aide">Détail, signature, dos, œuvre encadrée… L'étoile fait d'une photo la photo principale, celle du catalogue et du certificat.</p>`;
  };
  const occuper = (texteEnCours) => { etat.occupe = true; $("#galerie-message").innerHTML = `<div class="message info" aria-busy="true">${texteEnCours}</div>`; zone.querySelectorAll("button, label").forEach((b) => { b.style.pointerEvents = "none"; b.style.opacity = ".5"; }); };

  zone.addEventListener("input", (e) => { if (e.target.id === "photos-plus") e.stopPropagation(); });
  zone.addEventListener("change", async (e) => {
    if (e.target.id !== "photos-plus") return;
    e.stopPropagation(); // la galerie s'enregistre seule : ne pas marquer la fiche comme modifiée
    const tous = [...e.target.files], place = MAX_PHOTOS_PLUS - photos.length, fichiers = tous.slice(0, place);
    if (!fichiers.length) return;
    let ajoutees = 0, echec = "";
    try {
      for (const [i, fichier] of fichiers.entries()) {
        occuper(`Envoi de la photo ${i + 1} sur ${fichiers.length}…`);
        const { grand, petit } = await preparerPhoto(fichier);
        const t = `${Date.now()}-${i}`, photo_path = `${o.id}/plus-${t}.jpg`, vignette_path = `${o.id}/plus-vignette-${t}.jpg`;
        for (const [chemin, blob] of [[photo_path, grand], [vignette_path, petit]]) {
          const { error } = await sb.storage.from(BUCKET).upload(chemin, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (error) throw error;
        }
        const { error } = await sb.from("photos_oeuvre").insert({ oeuvre_id: o.id, photo_path, vignette_path, poids_octets: grand.size });
        if (error) { await sb.storage.from(BUCKET).remove([photo_path, vignette_path]); throw error; }
        ajoutees++;
      }
    } catch (err) { echec = msgErreur(err); }
    etat.occupe = false;
    try { await charger(); } catch (_) {}
    const reste = tous.length - fichiers.length;
    dessiner(echec ? `${ajoutees ? `${ajoutees} photo${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""}, puis une erreur : ` : "L'ajout a échoué : "}${echec}`
      : `${ajoutees} photo${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""}.${reste ? ` ${reste} non envoyée${reste > 1 ? "s" : ""} : la limite est de ${MAX_PHOTOS_PLUS} photos complémentaires.` : ""}`, echec ? "erreur" : "info");
  });

  zone.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-g]"); if (!b || etat.occupe) return;
    const p = photos.find((x) => x.id === b.closest("[data-photo]").dataset.photo); if (!p) return;
    if (b.dataset.g === "supprimer") {
      const ok = await confirmer({ titre: "Supprimer cette photo ?", corps: "Elle sera effacée définitivement. La photo principale et la fiche ne changent pas.", vignette: urlPhoto(p.vignette_path), action: "Supprimer la photo" });
      if (!ok) return;
      occuper("Suppression…");
      const { data, error } = await sb.from("photos_oeuvre").delete().eq("id", p.id).select("id");
      etat.occupe = false;
      if (error || !data.length) return dessiner("La suppression a échoué : " + (error ? msgErreur(error) : "droits insuffisants."), "erreur");
      await sb.storage.from(BUCKET).remove([p.photo_path, p.vignette_path]);
      photos = photos.filter((x) => x.id !== p.id);
      return dessiner("Photo supprimée.");
    }
    // Photo principale : les deux photos échangent leur place
    if (etat.modifie) return dessiner("Enregistrez d'abord la fiche : elle contient des modifications qui seraient perdues.", "erreur");
    occuper("Changement de photo principale…");
    try {
      const maj = await sb.from("oeuvres").update({ photo_path: p.photo_path, vignette_path: p.vignette_path, poids_photo_octets: p.poids_octets ?? null }).eq("id", o.id).select("id");
      if (maj.error || !maj.data.length) throw maj.error || new Error("droits insuffisants.");
      const suite = o.photo_path
        ? await sb.from("photos_oeuvre").update({ photo_path: o.photo_path, vignette_path: o.vignette_path, poids_octets: o.poids_photo_octets ?? null }).eq("id", p.id).select("id")
        : await sb.from("photos_oeuvre").delete().eq("id", p.id).select("id");
      if (suite.error) throw suite.error;
      etat.occupe = false;
      await rouvrir();
      bandeau("Photo principale changée");
    } catch (err) { etat.occupe = false; dessiner("Le changement de photo principale a échoué : " + msgErreur(err), "erreur"); }
  });

  try { await charger(); dessiner(); }
  catch (err) { zone.innerHTML = `<div class="message erreur">Les autres photos n'ont pas pu être chargées : ${msgErreur(err)}</div>`; }
}
