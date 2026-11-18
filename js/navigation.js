"use strict";
/* Navigation : une seule liste de rubriques, affichée en barre latérale sur écran large
   et en menu coulissant sur téléphone (bouton « Menu » de l'en-tête du catalogue). */

/* ---------- Menu coulissant (téléphone) ---------- */
const voileMenu = document.createElement("div");
voileMenu.id = "voile-menu"; voileMenu.setAttribute("aria-hidden", "true");
document.body.append(voileMenu);
function ouvrirMenu() {
  document.body.classList.add("menu-ouvert");
  const b = document.querySelector("#menu"); if (b) b.setAttribute("aria-expanded", "true");
  setTimeout(() => { const l = lateral.querySelector(".lat-fermer"); if (l) l.focus(); }, 60);
}
function fermerMenu(rendreFocus = false) {
  if (!document.body.classList.contains("menu-ouvert")) return;
  document.body.classList.remove("menu-ouvert");
  const b = document.querySelector("#menu"); if (b) { b.setAttribute("aria-expanded", "false"); if (rendreFocus) b.focus(); }
}
voileMenu.addEventListener("click", () => fermerMenu(true));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-ouvert")) { e.stopPropagation(); fermerMenu(true); } });
window.addEventListener("resize", () => { if (innerWidth >= 900) fermerMenu(); });

/* ---------- Barre latérale ---------- */
function masquerLateral() { fermerMenu(); lateral.hidden = true; document.body.classList.remove("avec-lateral"); }
function majLateral(section) {
  if (section != null) { if (section !== etat.section || !app.classList.contains("arrive")) arriver(); etat.section = section; etat.gardien = null; etat.modifie = false; }
  document.body.classList.remove("barre-visible");
  const POINTS = { a_completer: "#d9a400", disponible: "#2e9e57", reserve: "#7b4fd0", vendu: "var(--vermillon)", pas_a_vendre: "#9aa0a8" };
  const lien = (cle, libelle, n, deco = "") => `<button class="lat-lien" data-nav="${cle}" ${etat.section === cle ? 'aria-current="page"' : ""}><span>${deco}<span>${esc(libelle)}</span></span>${n == null ? "" : `<span class="n">${n}</span>`}</button>`;
  const point = (c) => `<span class="point" style="background:${POINTS[c]}" aria-hidden="true"></span>`;
  lateral.innerHTML = `
    <button class="btn icone-seule lat-fermer" data-nav="fermer" aria-label="Fermer le menu" title="Fermer le menu">${ICONES.fermer}</button>
    <div class="lat-marque">Pauline Bonneté</div>
    <div class="lat-sous">Catalogue des œuvres</div>
    ${etat.admin ? lien("admin", "Administration", null, ICONES.reglages) : ""}
    <div class="lat-titre">Œuvres</div>
    ${lien("liste:", "Toutes les œuvres", etat.total_general, ICONES.cadre)}
    ${lien("liste:a_completer", "Œuvres à compléter", etat.comptes.a_completer ?? "", point("a_completer"))}
    ${lien("liste:disponible", "Disponible", etat.comptes.disponible ?? "", point("disponible"))}
    ${lien("liste:reserve", "Réservé", etat.comptes.reserve ?? "", point("reserve"))}
    ${lien("liste:vendu", "Vendu", etat.comptes.vendu ?? "", point("vendu"))}
    ${lien("liste:pas_a_vendre", "Pas à vendre", etat.comptes.pas_a_vendre ?? "", point("pas_a_vendre"))}
    ${etat.admin ? `<div class="lat-titre">Suivi</div>${lien("ventes", "Suivi des ventes", null, ICONES.graphique)}${lien("acheteurs", "Acheteurs", null, ICONES.personnes)}` : ""}
    <div class="lat-titre">Documents</div>
    ${etat.admin ? lien("certificats", "Certificats d'authenticité", null, ICONES.document) : `<button class="lat-lien" disabled><span>${ICONES.document}<span>Certificats d'authenticité</span></span></button>`}
    ${etat.admin ? `<div class="lat-titre">Maintenance</div>${lien("corbeille", "Corbeille", etat.enCorbeille, ICONES.corbeille)}` : ""}
    <div class="lat-bas">${lien("tutoriel", "Revoir le tutoriel", null, ICONES.aide)}<button class="lat-lien" data-nav="sortir"><span>${ICONES.sortir}<span>Déconnexion</span></span></button></div>`;
  lateral.hidden = false; document.body.classList.add("avec-lateral");
}
lateral.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-nav]"); if (!b || etat.occupe) return;
  const nav = b.dataset.nav;
  if (nav === "fermer") return fermerMenu(true);
  if (etat.gardien && !(await etat.gardien())) return;
  etat.retour = null;
  fermerMenu();
  if (nav === "admin") vueAdmin();
  else if (nav === "corbeille") vueCorbeille();
  else if (nav === "ventes") vueVentes();
  else if (nav === "acheteurs") vueAcheteurs();
  else if (nav === "certificats") vueCertificats();
  else if (nav === "tutoriel") lancerTutoriel();
  else if (nav === "sortir") sb.auth.signOut();
  else { etat.statut = nav.slice(6); vueListe(); }
});
