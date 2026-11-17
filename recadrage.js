"use strict";
/* ============================================================================
   Éditeur de photo : recadrage et rotation, avec Cropper.js (hébergé dans lib/).
   recadrerPhoto(source) ouvre l'éditeur en plein écran sur une image (Blob ou File)
   et renvoie l'image recadrée en JPEG, ou null si l'utilisateur renonce.
   ============================================================================ */
function chargerStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((ok, ko) => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href;
    l.onload = ok; l.onerror = () => { l.remove(); ko(new Error("L'éditeur de photo n'a pas pu être chargé. Vérifiez la connexion.")); };
    document.head.append(l);
  });
}

async function recadrerPhoto(source) {
  try { await Promise.all([chargerScript("lib/cropper.min.js"), chargerStyle("lib/cropper.min.css")]); }
  catch (e) { throw new Error("L'éditeur de photo n'a pas pu être chargé. Vérifiez la connexion."); }
  return new Promise((resoudre) => {
    const adresse = URL.createObjectURL(source);
    const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const editeur = document.createElement("div");
    editeur.className = "editeur"; editeur.setAttribute("role", "dialog"); editeur.setAttribute("aria-modal", "true"); editeur.setAttribute("aria-label", "Recadrer la photo");
    editeur.innerHTML = `
      <div class="editeur-tete">
        <strong>Recadrer la photo</strong>
        <span class="editeur-aide">Déplacez les poignées du cadre. Pincez ou utilisez la molette pour zoomer.</span>
      </div>
      <div class="editeur-zone"><img alt="Photo à recadrer"></div>
      <div class="editeur-outils">
        <div class="editeur-groupe">
          <button type="button" class="ed-btn" data-ed="gauche" aria-label="Pivoter vers la gauche" title="Pivoter vers la gauche">${ico('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>')}</button>
          <button type="button" class="ed-btn" data-ed="droite" aria-label="Pivoter vers la droite" title="Pivoter vers la droite">${ico('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>')}</button>
          <div class="ed-segment" role="group" aria-label="Forme du cadre">
            <button type="button" data-ed="libre" aria-pressed="true">Libre</button>
            <button type="button" data-ed="carre" aria-pressed="false">Carré</button>
          </div>
          <button type="button" class="ed-btn texte" data-ed="reinit">Réinitialiser</button>
        </div>
        <div class="editeur-groupe fin">
          <button type="button" class="btn" data-ed="annuler">Annuler</button>
          <button type="button" class="btn plein" data-ed="appliquer">Appliquer</button>
        </div>
      </div>`;
    document.body.append(editeur);
    document.body.classList.add("editeur-ouvert");
    const image = editeur.querySelector("img");
    let recadreur = null, termine = false;

    const fermer = (resultat) => {
      if (termine) return; termine = true;
      document.removeEventListener("keydown", clavier);
      if (recadreur) recadreur.destroy();
      editeur.remove(); document.body.classList.remove("editeur-ouvert");
      URL.revokeObjectURL(adresse);
      resoudre(resultat);
    };
    const clavier = (e) => { if (e.key === "Escape") fermer(null); };
    document.addEventListener("keydown", clavier);

    image.addEventListener("error", () => { fermer(null); bandeau("Cette photo n'a pas pu être ouverte dans l'éditeur."); });
    image.addEventListener("load", () => {
      recadreur = new window.Cropper(image, {
        viewMode: 1,            // le cadre ne sort jamais de l'image
        autoCropArea: 1,        // au départ, toute l'image est retenue
        dragMode: "move", background: false, guides: true, center: false, toggleDragModeOnDblclick: false,
        responsive: true, restore: false, checkOrientation: false
      });
    }, { once: true });
    image.src = adresse;

    editeur.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ed]"); if (!b) return;
      const action = b.dataset.ed;
      if (action === "annuler") return fermer(null);
      if (!recadreur) return;
      if (action === "gauche") recadreur.rotate(-90);
      else if (action === "droite") recadreur.rotate(90);
      else if (action === "reinit") { recadreur.reset(); recadreur.setAspectRatio(NaN); marquerForme("libre"); }
      else if (action === "libre" || action === "carre") { recadreur.setAspectRatio(action === "carre" ? 1 : NaN); marquerForme(action); }
      else if (action === "appliquer") {
        b.disabled = true; b.setAttribute("aria-busy", "true");
        const toile = recadreur.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, fillColor: "#fff", imageSmoothingEnabled: true, imageSmoothingQuality: "high" });
        if (!toile) { fermer(null); return bandeau("Le recadrage n'a pas pu être appliqué."); }
        toile.toBlob((blob) => { if (blob) fermer(blob); else { fermer(null); bandeau("Le recadrage n'a pas pu être appliqué."); } }, "image/jpeg", 0.95);
      }
    });
    const marquerForme = (choix) => editeur.querySelectorAll(".ed-segment button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.ed === choix)));
    editeur.querySelector('[data-ed="appliquer"]').focus();
  });
}
