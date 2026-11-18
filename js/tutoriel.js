"use strict";
/* ============================================================================
   Tutoriel de prise en main : huit étapes qui pointent les vrais éléments de l'écran.
   Lancé à la première connexion, passable à tout moment, rejouable ensuite.
   ============================================================================ */
const visibleTuto = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" ? el : null; };
const premierVisible = (selecteur) => [...document.querySelectorAll(selecteur)].find(visibleTuto) || null;

const ETAPES_TUTO = [
  { titre: "Ajouter une œuvre",
    texte: "Prenez ou choisissez une photo, puis renseignez la fiche. L'import en lot crée d'un coup une fiche par photo, à compléter ensuite.",
    cible: () => premierVisible('[data-go="ajouter"]') },
  { titre: "Retrouver une œuvre",
    texte: "Cherchez par titre, série ou technique. Les filtres par statut montrent les œuvres à compléter, disponibles, réservées ou vendues.",
    cible: () => visibleTuto(document.querySelector("#q")) },
  { titre: "Changer d'affichage",
    texte: "Passez des vignettes à la liste : les vignettes pour reconnaître une œuvre d'un coup d'œil, la liste pour lire ses informations.",
    cible: () => visibleTuto(document.querySelector("#bascule")) },
  { titre: "Ouvrir une fiche",
    texte: "Touchez une œuvre pour compléter ses informations, recadrer sa photo, ou indiquer qu'elle est vendue, à quel prix et à quelle date.",
    cible: () => premierVisible("#grille [data-id]") },
  { titre: "Agir sur plusieurs œuvres",
    texte: "« Sélectionner » permet de modifier la technique, le support ou la nature de plusieurs œuvres à la fois, ou de les mettre à la corbeille.",
    cible: () => visibleTuto(document.querySelector("#sel-entrer")) },
  { titre: "Suivre les ventes", admin: true,
    texte: "Le suivi des ventes totalise les œuvres vendues et les présente par mois ou par année, avec le prix réellement encaissé.",
    cible: () => premierVisible('#lateral [data-nav="ventes"], #menu') },
  { titre: "Délivrer un certificat", admin: true,
    texte: "Depuis la fiche d'une œuvre, générez son certificat d'authenticité en PDF, signé ou à signer à la main. L'historique des certificats émis est conservé.",
    cible: () => premierVisible('#lateral [data-nav="certificats"], #menu') },
  { titre: "Régler l'application", admin: true,
    texte: "Administration regroupe les listes de choix, les champs supplémentaires et la signature. La corbeille conserve les œuvres supprimées, pour les restaurer en cas d'erreur.",
    cible: () => premierVisible('#lateral [data-nav="admin"], #menu') }
];

let tutorielEnCours = false;

async function marquerTutorielVu() {
  etat.tutorielVu = true;
  try { if (etat.email) await sb.from("membres").update({ tutoriel_vu: true }).eq("email", etat.email); } catch (_) { /* sans gravité : il sera reproposé */ }
}

async function lancerTutoriel() {
  if (tutorielEnCours) return;
  if (etat.gardien && !(await etat.gardien())) return; // une saisie en cours n'est jamais perdue
  if (!document.querySelector("#grille") || etat.selection) { vueListe(); await new Promise((r) => setTimeout(r, 700)); }
  const etapes = ETAPES_TUTO.filter((e) => !e.admin || etat.admin);
  tutorielEnCours = true;
  let i = 0;

  const fond = document.createElement("div"); fond.className = "tuto-fond";
  const halo = document.createElement("div"); halo.className = "tuto-halo";
  const carte = document.createElement("div"); carte.className = "tuto-carte";
  carte.setAttribute("role", "dialog"); carte.setAttribute("aria-modal", "true"); carte.setAttribute("aria-labelledby", "tuto-titre");
  document.body.append(fond, halo, carte);
  document.body.classList.add("tuto-ouvert");

  const placer = () => {
    const cible = etapes[i].cible();
    const etroit = window.innerWidth < 700;
    if (!cible) { halo.classList.add("sans-cible"); carte.dataset.pos = "centre"; carte.style.cssText = ""; return; }
    const r = cible.getBoundingClientRect(), m = 6;
    halo.classList.remove("sans-cible");
    halo.style.cssText = `left:${r.left - m}px;top:${r.top - m}px;width:${r.width + 2 * m}px;height:${r.height + 2 * m}px`;
    if (etroit) { // sur téléphone, la carte se place à l'opposé de l'élément montré
      carte.dataset.pos = r.top + r.height / 2 > window.innerHeight / 2 ? "haut" : "bas"; carte.style.cssText = "";
      return;
    }
    carte.dataset.pos = "libre";
    const l = carte.offsetWidth, h = carte.offsetHeight, marge = 16;
    let x, y;
    if (r.right + marge + l < window.innerWidth && r.width < 320) { x = r.right + marge; y = r.top; }        // à droite (barre latérale)
    else if (r.bottom + marge + h < window.innerHeight) { x = r.left; y = r.bottom + marge; }                 // dessous
    else { x = r.left; y = r.top - marge - h; }                                                             // dessus
    carte.style.cssText = `left:${Math.max(marge, Math.min(x, window.innerWidth - l - marge))}px;top:${Math.max(marge, Math.min(y, window.innerHeight - h - marge))}px`;
  };

  const afficher = () => {
    const e = etapes[i], dernier = i === etapes.length - 1;
    carte.innerHTML = `
      <div class="tuto-avancement" role="progressbar" aria-valuemin="1" aria-valuemax="${etapes.length}" aria-valuenow="${i + 1}" aria-label="Avancement du tutoriel">
        ${etapes.map((_, k) => `<span class="${k < i ? "fait" : k === i ? "actif" : ""}"></span>`).join("")}
      </div>
      <div class="tuto-etape">Étape ${i + 1} sur ${etapes.length}</div>
      <h2 id="tuto-titre">${esc(e.titre)}</h2>
      <p>${esc(e.texte)}</p>
      <div class="tuto-actions">
        <button type="button" class="btn discret" data-tuto="passer" aria-label="Passer le tutoriel">Passer</button>
        <span style="flex:1"></span>
        ${i ? `<button type="button" class="btn" data-tuto="avant">Précédent</button>` : ""}
        <button type="button" class="btn plein" data-tuto="apres">${dernier ? "Terminer" : "Suivant"}</button>
      </div>`;
    const cible = e.cible();
    if (cible && !cible.closest("#lateral, .barre-bas")) cible.scrollIntoView({ block: "center", behavior: "instant" });
    placer();
    carte.querySelector('[data-tuto="apres"]').focus({ preventScroll: true });
  };

  const fermer = (termine) => {
    tutorielEnCours = false;
    window.removeEventListener("resize", placer); window.removeEventListener("scroll", placer, true); document.removeEventListener("keydown", clavier);
    fond.remove(); halo.remove(); carte.remove(); document.body.classList.remove("tuto-ouvert");
    marquerTutorielVu();
    bandeau(termine ? "Tutoriel terminé. Vous pouvez le revoir depuis le menu ou l'administration." : "Tutoriel passé. Vous pouvez le revoir depuis le menu ou l'administration.");
  };
  const aller = (pas) => { const n = i + pas; if (n >= etapes.length) return fermer(true); if (n >= 0) { i = n; afficher(); } };
  const clavier = (e) => {
    if (e.key === "Escape") fermer(false);
    else if (e.key === "ArrowRight") aller(1);
    else if (e.key === "ArrowLeft") aller(-1);
  };
  carte.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tuto]"); if (!b) return;
    if (b.dataset.tuto === "passer") fermer(false); else aller(b.dataset.tuto === "apres" ? 1 : -1);
  });
  window.addEventListener("resize", placer); window.addEventListener("scroll", placer, true); document.addEventListener("keydown", clavier);
  afficher();
}
