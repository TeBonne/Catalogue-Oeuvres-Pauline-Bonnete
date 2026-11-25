"use strict";
/* Retours et demandes : des tickets sur le back-office lui-même, avec leur contexte (page, œuvre, filtres, captures).

   Circuit : Nouveau → Accepté ou Refusé (le pilote décide) → En cours → Livré → Validé (le pilote valide)
   → Clos (l'avis de l'artiste est demandé). Les demandes du pilote naissent directement « Accepté ».
   Le pilote est le membre dont la colonne `pilote_retours` est vraie.

   Les droits et les changements de statut sont appliqués par la base (fonction `changer_statut_retour`) :
   les boutons ne font que proposer ce que la base autorise.

   Chargé après toutes les vues et avant demarrage.js : il relève quelle vue est affichée (voir « Écran en cours »). */

const PRENOM_ARTISTE = "Pauline", PRENOM_PILOTE = "Antoine";
const CAPTURES_MAX = 5;
const RETOUR_STATUTS = { nouveau: "Nouveau", precision: "Précision demandée", accepte: "Accepté", refuse: "Refusé", en_cours: "En cours", livre: "Livré, à valider", valide: "Validé, avis attendu", clos: "Clos" };
const RETOUR_ETAPES = { nouveau: "Nouveau", accepte: "Accepté", en_cours: "En cours", livre: "Livré", valide: "Validé", clos: "Clos" };
const RETOUR_TYPES = { bug: "Quelque chose ne marche pas", amelioration: "Une idée d'amélioration", question: "Une question" };
const RETOUR_TYPES_COURTS = { bug: "Anomalie", amelioration: "Évolution", question: "Question" };
const RETOUR_GENES = { bloquant: "Ça me bloque", genant: "C'est gênant", mineur: "Ça peut attendre" };
const RETOUR_EVENEMENTS = {
  nouveau: "a répondu à la question", precision: "a demandé une précision", accepte: "a accepté ce retour", refuse: "a refusé ce retour",
  en_cours: "a démarré la réalisation", livre: "a livré la correction", valide: "a validé la correction", clos: "a clos ce retour",
  rouvert: "a rouvert ce retour", a_reprendre: "a renvoyé en correction"
};
const PAGES = {
  vueListe: "Catalogue des œuvres", vueFiche: "Fiche d'une œuvre", vueVentes: "Suivi des ventes", vueAcheteurs: "Acheteurs", vueAcheteur: "Fiche d'un acheteur",
  vueCertificats: "Certificats d'authenticité", vueCertificat: "Certificat", vueCertificatNouveau: "Nouveau certificat", vueAdmin: "Administration",
  vueCorbeille: "Corbeille", vueImport: "Import en lot", vueRetours: "Retours et demandes", vueRetour: "Détail d'un retour"
};
const PAGES_ROUVRABLES = ["vueListe", "vueVentes", "vueAcheteurs", "vueCertificats", "vueAdmin", "vueCorbeille", "vueImport"]; // vues sans paramètre
ICONES.bulle = svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>');
ICONES.trombone = svg('<path d="M20 11.500l-8 8a5 5 0 0 1-7-7l8.500-8.500a3.300 3.300 0 0 1 4.700 4.700L9.800 17a1.700 1.700 0 0 1-2.400-2.400L15 7"/>');
ICONES.ecran = svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>');

etat.pilote = false; etat.retoursAFaire = 0;
etat.retours = { f: { q: "", statut: "ouverts", type: "", auteur: "" } };

const memeEmail = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
const prenomDe = (email) => { if (!email) return ""; if (email === "claude") return "Claude"; const p = email.split("@")[0].split(/[._-]/)[0]; return p.charAt(0).toUpperCase() + p.slice(1); };
const dateHeure = (iso) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const jourCourt = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const badgeRetour = (statut) => `<span class="badge rs-${statut}" style="margin:0">${esc(RETOUR_STATUTS[statut] || statut)}</span>`;
/* Ce retour attend-il une action de la personne connectée ? */
const attendMoi = (r) => etat.pilote
  ? r.statut === "nouveau" || r.statut === "livre"
  : r.statut === "valide" || (r.statut === "precision" && memeEmail(r.auteur_email, etat.email));

/* ---------- Écran en cours ----------
   Chaque fonction `vue…()` est enveloppée pour noter son nom et son premier paramètre (l'identifiant d'une œuvre, par exemple).
   Une nouvelle vue est prise en compte sans rien ajouter ici. */
etat.ecran = { vue: "", element: null };
Object.keys(window).filter((nom) => /^vue[A-Z]/.test(nom) && typeof window[nom] === "function").forEach((nom) => {
  const origine = window[nom];
  window[nom] = function (...parametres) {
    const p = parametres[0];
    etat.ecran = { vue: nom, element: typeof p === "string" && /^[\w-]{1,40}$/.test(p) ? p : null };
    return origine.apply(this, parametres);
  };
});

/* Dernières erreurs techniques de la page : jointes au retour, jamais envoyées ailleurs. */
const erreursRecentes = [];
const noterErreur = (m) => { erreursRecentes.push(`${new Date().toTimeString().slice(0, 8)} ${String(m).slice(0, 300)}`); if (erreursRecentes.length > 5) erreursRecentes.shift(); };
window.addEventListener("error", (e) => { if (e.message) noterErreur(e.message + (e.filename ? ` (${e.filename.split("/").pop().split("?")[0]}:${e.lineno})` : "")); });
window.addEventListener("unhandledrejection", (e) => noterErreur("Opération interrompue : " + ((e.reason && e.reason.message) || e.reason)));

/* ---------- Contexte joint à un retour ---------- */
function contexteCourant() {
  const { vue, element } = etat.ecran, h1 = app.querySelector("h1");
  const c = {
    page: PAGES[vue] || (h1 && h1.textContent.trim()) || "Page non identifiée", vue, date: new Date().toISOString(),
    affichage: innerWidth >= 900 ? "ordinateur" : "téléphone", fenetre: `${innerWidth} × ${innerHeight}`, ecran: `${screen.width} × ${screen.height}`, navigateur: navigator.userAgent
  };
  if (vue === "vueFiche") c.oeuvre = element ? { id: element, titre: ($("#titre") || {}).value || "" } : { nouvelle: true };
  else if (element) c.element = element;
  if (vue === "vueListe") c.catalogue = { statut: etat.statut || "toutes", recherche: etat.q, tri: etat.tri, affichage: etat.vue, selection: etat.selection ? etat.selection.size : null };
  if (vue === "vueVentes") {
    const v = etat.ventes, filtres = Object.fromEntries(Object.entries(v.f).filter(([, x]) => x !== "" && x != null));
    c.ventes = { regroupement: v.grain, annee: v.annee, periode: v.periode, tri: v.tri, filtres };
  }
  if (vue === "vueAdmin") c.onglet = etat.adminOnglet;
  if (etat.modifie) c.saisie_en_cours = true;
  const messages = [...document.querySelectorAll(".message.erreur")].map((m) => m.textContent.trim()).filter(Boolean).slice(0, 3);
  if (messages.length) c.messages_erreur = messages;
  if (erreursRecentes.length) c.erreurs_techniques = erreursRecentes.slice();
  return c;
}
/* Le contexte en clair : [libellé, valeur], pour le panneau de saisie comme pour le détail d'un retour. */
function lignesContexte(c) {
  const l = [["Page", c.page]];
  if (c.oeuvre) l.push(["Œuvre", c.oeuvre.nouvelle ? "Nouvelle fiche, pas encore enregistrée" : c.oeuvre.titre || "Sans titre"]);
  if (c.catalogue) {
    const k = c.catalogue;
    l.push(["Catalogue", [k.statut === "toutes" ? "toutes les œuvres" : `statut « ${STATUTS[k.statut] || k.statut} »`, k.recherche ? `recherche « ${k.recherche} »` : "", `tri « ${(TRIS[k.tri] || [k.tri])[0]} »`, k.affichage === "liste" ? "en liste" : "en vignettes", k.selection != null ? `${k.selection} œuvre(s) sélectionnée(s)` : ""].filter(Boolean).join(", ")]);
  }
  if (c.ventes) {
    const v = c.ventes, f = Object.entries(v.filtres || {}).map(([cle, x]) => `${cle} : ${x}`);
    l.push(["Suivi des ventes", [`par ${v.regroupement === "annee" ? "année" : "mois"}`, v.annee ? `année ${v.annee}` : "", v.periode ? `période ${v.periode}` : "", ...f].filter(Boolean).join(", ")]);
  }
  if (c.onglet) l.push(["Onglet", c.onglet]);
  if (c.saisie_en_cours) l.push(["Saisie", "des modifications n'étaient pas enregistrées"]);
  (c.messages_erreur || []).forEach((m) => l.push(["Message affiché", m]));
  (c.erreurs_techniques || []).forEach((m) => l.push(["Erreur technique", m]));
  if (c.date) l.push(["Date", dateHeure(c.date)]);
  l.push(["Affichage", `${c.affichage || ""}, fenêtre de ${c.fenetre || "?"} (écran ${c.ecran || "?"})`]);
  if (c.navigateur) l.push(["Navigateur", c.navigateur]);
  return l;
}
const listeContexte = (c) => `<dl class="rt-contexte-liste">${lignesContexte(c).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>`;

/* ---------- Compteur de la barre latérale ---------- */
function majPastilleRetours() {
  const n = lateral.querySelector('[data-nav="retours"] .n'); if (!n) return;
  n.textContent = etat.retoursAFaire || ""; n.classList.toggle("a-faire", etat.retoursAFaire > 0);
  n.title = etat.retoursAFaire ? `${etat.retoursAFaire} retour${etat.retoursAFaire > 1 ? "s" : ""} en attente de votre action` : "";
}
async function chargerCompteRetours() {
  try {
    const { data, error } = await sb.from("retours").select("id,statut,auteur_email").in("statut", ["nouveau", "precision", "livre", "valide"]).limit(1000);
    if (error) throw error;
    etat.retoursAFaire = data.filter(attendMoi).length;
  } catch (_) { etat.retoursAFaire = 0; /* sans gravité : la rubrique reste accessible */ }
  majPastilleRetours();
}

/* ---------- Captures d'écran ---------- */
/* Toute image devient un JPEG de 2000 px au plus : lisible, et sous la limite de poids du stockage. */
async function preparerCapture(source) {
  let image;
  try { image = await createImageBitmap(source); }
  catch (e) { // même repli que pour les photos des œuvres : certains fichiers ne se lisent que par une balise image
    if (!(source instanceof Blob)) throw e;
    image = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image illisible")); i.src = URL.createObjectURL(source); });
  }
  const r = Math.min(1, 2000 / Math.max(image.width, image.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(image.width * r)); c.height = Math.max(1, Math.round(image.height * r));
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(image, 0, 0, c.width, c.height);
  if (image.close) image.close();
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("Cette image n'a pas pu être préparée."))), "image/jpeg", 0.88));
}
/* Capture par le navigateur (ordinateur) : il demande quelle fenêtre partager, une image est prise, le partage s'arrête aussitôt. */
const captureEcranPossible = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && innerWidth >= 900;
async function capturerEcran(masquer) {
  const flux = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true });
  try {
    const video = document.createElement("video"); video.srcObject = flux; video.muted = true;
    await video.play();
    masquer(true);
    await new Promise((r) => setTimeout(r, 500)); // le temps que la fenêtre de choix se referme et que le panneau quitte l'image
    return await preparerCapture(video);
  } finally { flux.getTracks().forEach((t) => t.stop()); masquer(false); }
}
const cacheCaptures = new Map();
async function urlCapture(chemin) {
  if (!cacheCaptures.has(chemin)) {
    const { data, error } = await sb.storage.from(BUCKET_PRIVE).download(chemin);
    if (error) throw error;
    cacheCaptures.set(chemin, URL.createObjectURL(data));
  }
  return cacheCaptures.get(chemin);
}
function agrandirCapture(url) {
  const voile = document.createElement("div"); voile.className = "voile rt-loupe";
  voile.innerHTML = `<img alt="Capture d'écran agrandie" src="${esc(url)}"><button class="btn icone-seule" aria-label="Fermer" title="Fermer">${ICONES.fermer}</button>`;
  const clavier = (e) => { if (e.key === "Escape") fermer(); };
  const fermer = () => { document.removeEventListener("keydown", clavier); voile.remove(); };
  document.addEventListener("keydown", clavier);
  voile.addEventListener("click", fermer);
  document.body.append(voile); voile.querySelector("button").focus();
}

/* ---------- Fenêtre de saisie d'un commentaire (motif, question, réponse…) ----------
   Renvoie le texte saisi, ou null si la personne annule. */
function saisir({ titre, libelle, requis, action }) {
  return new Promise((resoudre) => {
    const voile = document.createElement("div"); voile.className = "voile";
    voile.innerHTML = `
      <form class="dialogue large" role="dialog" aria-modal="true" aria-labelledby="sai-titre" novalidate>
        <h2 id="sai-titre">${esc(titre)}</h2>
        <label for="sai-texte">${esc(libelle)}${requis ? ' <span class="req">*</span>' : ' <span class="opt">(facultatif)</span>'}</label>
        <textarea id="sai-texte" maxlength="5000" style="min-height:120px"></textarea>
        <div id="sai-erreur" role="alert"></div>
        <div class="actions"><button class="btn" type="button" data-r="non">Annuler</button><button class="btn plein" type="submit">${esc(action)}</button></div>
      </form>`;
    document.body.append(voile);
    const zone = voile.querySelector("textarea");
    const clavier = (e) => { if (e.key === "Escape") fermer(null); };
    const fermer = (r) => { document.removeEventListener("keydown", clavier); voile.remove(); resoudre(r); };
    document.addEventListener("keydown", clavier);
    voile.addEventListener("mousedown", (e) => { if (e.target === voile) fermer(null); });
    voile.querySelector('[data-r="non"]').addEventListener("click", () => fermer(null));
    voile.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = zone.value.trim();
      if (requis && !t) { zone.setAttribute("aria-invalid", "true"); voile.querySelector("#sai-erreur").innerHTML = `<div class="message erreur">Ce champ est nécessaire.</div>`; return zone.focus(); }
      fermer(t);
    });
    zone.focus();
  });
}

/* ---------- Faire un retour : panneau latéral, sans quitter la page ---------- */
const ongletRetour = document.createElement("button");
ongletRetour.id = "retour-onglet"; ongletRetour.type = "button"; ongletRetour.title = "Faire un retour sur cette page";
ongletRetour.innerHTML = `${ICONES.bulle}<span>Un retour ?</span>`;
ongletRetour.addEventListener("click", () => ouvrirRetour());
document.body.append(ongletRetour);

function ouvrirRetour() {
  if ($("#retour-panneau") || !etat.utilisateur) return;
  const contexte = contexteCourant(), captures = []; // { blob, url }
  const voile = document.createElement("div"); voile.className = "retour-voile";
  voile.innerHTML = `
    <aside class="retour-panneau" id="retour-panneau" role="dialog" aria-modal="true" aria-labelledby="rt-h">
      <div class="rt-tete"><h2 id="rt-h">Faire un retour</h2><button class="btn icone-seule" type="button" id="rt-fermer" aria-label="Fermer" title="Fermer">${ICONES.fermer}</button></div>
      <form id="rt-f" novalidate>
        <div class="rt-contexte">
          <div><span class="sous">Page concernée</span><strong id="rt-page">${esc(contexte.page)}${contexte.oeuvre && contexte.oeuvre.titre ? ` : ${esc(contexte.oeuvre.titre)}` : ""}</strong></div>
          <details><summary>Informations jointes automatiquement</summary>${listeContexte(contexte)}</details>
        </div>
        <fieldset class="rt-types"><legend>De quoi s'agit-il ?</legend>
          ${Object.entries(RETOUR_TYPES).map(([c, l], i) => `<label><input type="radio" name="rt-type" value="${c}" ${i ? "" : "checked"}><span>${esc(l)}</span></label>`).join("")}
        </fieldset>
        <label for="rt-resume">En une phrase <span class="req">*</span></label>
        <input id="rt-resume" maxlength="120" autocomplete="off" required>
        <label for="rt-detail">Détail <span class="opt">(facultatif)</span></label>
        <textarea id="rt-detail" maxlength="5000" placeholder="Ce que vous faisiez, ce que vous attendiez, ce qui s'est passé…"></textarea>
        <label for="rt-gene">Urgence</label>
        <select id="rt-gene">${Object.entries(RETOUR_GENES).map(([c, l]) => `<option value="${c}" ${c === "genant" ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <label for="rt-fichier">Captures d'écran <span class="opt">(facultatif, ${CAPTURES_MAX} au plus)</span></label>
        <div class="rt-depot" id="rt-depot">
          <p>${innerWidth >= 900 ? "Collez une capture (Ctrl + V), glissez une image ici, ou :" : "Joignez une capture d'écran de votre téléphone :"}</p>
          <div class="rang">
            <button class="btn" type="button" id="rt-choisir">${ICONES.trombone}Choisir une image</button>
            ${captureEcranPossible() ? `<button class="btn" type="button" id="rt-capturer">${ICONES.ecran}Capturer l'écran</button>` : ""}
          </div>
          <input class="cache" type="file" id="rt-fichier" accept="image/*" multiple tabindex="-1">
        </div>
        <div class="rt-vignettes" id="rt-vignettes" aria-live="polite"></div>
        ${etat.pilote ? `<label class="coche" for="rt-avis"><input id="rt-avis" type="checkbox"> Demander l'avis de ${PRENOM_ARTISTE} une fois la correction validée</label>` : ""}
        <div id="rt-alerte" role="alert"></div>
        <div class="rt-actions"><button class="btn" type="button" id="rt-annuler">Annuler</button><button class="btn plein" type="submit" id="rt-envoyer">Envoyer</button></div>
      </form>
    </aside>`;
  document.body.append(voile); document.body.classList.add("retour-ouvert");
  const panneau = voile.querySelector("#retour-panneau"), q = (s) => panneau.querySelector(s);
  const alerter = (m, champ) => { q("#rt-alerte").innerHTML = m ? `<div class="message erreur">${m}</div>` : ""; if (champ) q(champ).focus(); };
  const saisi = () => q("#rt-resume").value.trim() || q("#rt-detail").value.trim() || captures.length;

  // ----- Fermeture -----
  const clavier = (e) => { if (e.key === "Escape" && !document.querySelector(".voile")) quitter(); };
  const fermer = () => {
    document.removeEventListener("keydown", clavier); document.removeEventListener("paste", coller);
    captures.forEach((c) => URL.revokeObjectURL(c.url));
    voile.remove(); document.body.classList.remove("retour-ouvert");
  };
  const quitter = async () => {
    if (saisi() && !(await confirmer({ titre: "Abandonner ce retour ?", corps: "Ce que vous avez saisi sera perdu.", action: "Abandonner", annuler: "Continuer la saisie", delai: 0 }))) return;
    fermer();
  };
  document.addEventListener("keydown", clavier);
  voile.addEventListener("mousedown", (e) => { if (e.target === voile) quitter(); });
  q("#rt-fermer").addEventListener("click", quitter);
  q("#rt-annuler").addEventListener("click", quitter);

  // ----- Captures : collage, glisser-déposer, fichier, capture par le navigateur -----
  const dessinerCaptures = () => {
    q("#rt-vignettes").innerHTML = captures.map((c, i) => `<figure><img alt="Capture ${i + 1}" src="${c.url}"><button class="btn icone-seule" type="button" data-retirer="${i}" aria-label="Retirer la capture ${i + 1}" title="Retirer">${ICONES.fermer}</button></figure>`).join("");
  };
  const ajouter = async (sources) => {
    alerter("");
    for (const s of sources) {
      if (captures.length >= CAPTURES_MAX) { alerter(`${CAPTURES_MAX} captures au plus par retour.`); break; }
      try { const blob = await preparerCapture(s); captures.push({ blob, url: URL.createObjectURL(blob) }); }
      catch (_) { alerter("Une image n'a pas pu être lue. Essayez un fichier JPEG ou PNG."); }
    }
    dessinerCaptures();
  };
  const images = (liste) => [...liste].filter((f) => f && f.type && f.type.startsWith("image/"));
  const coller = (e) => { const l = images([...(e.clipboardData ? e.clipboardData.items : [])].map((i) => (i.kind === "file" ? i.getAsFile() : null))); if (l.length) { e.preventDefault(); ajouter(l); } };
  document.addEventListener("paste", coller);
  const depot = q("#rt-depot");
  ["dragenter", "dragover"].forEach((t) => depot.addEventListener(t, (e) => { e.preventDefault(); depot.classList.add("survol"); }));
  ["dragleave", "drop"].forEach((t) => depot.addEventListener(t, (e) => { e.preventDefault(); depot.classList.remove("survol"); }));
  depot.addEventListener("drop", (e) => { const l = images(e.dataTransfer ? e.dataTransfer.files : []); if (l.length) ajouter(l); else alerter("Seules les images peuvent être jointes."); });
  q("#rt-choisir").addEventListener("click", () => q("#rt-fichier").click());
  q("#rt-fichier").addEventListener("change", (e) => { ajouter(images(e.target.files)); e.target.value = ""; });
  q("#rt-vignettes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-retirer]"); if (!b) return;
    const [c] = captures.splice(+b.dataset.retirer, 1); URL.revokeObjectURL(c.url); dessinerCaptures(); alerter("");
  });
  if (q("#rt-capturer")) q("#rt-capturer").addEventListener("click", async () => {
    if (captures.length >= CAPTURES_MAX) return alerter(`${CAPTURES_MAX} captures au plus par retour.`);
    alerter("");
    try {
      const blob = await capturerEcran((oui) => { voile.style.visibility = oui ? "hidden" : ""; });
      captures.push({ blob, url: URL.createObjectURL(blob) }); dessinerCaptures();
    } catch (e) {
      if (e && e.name === "NotAllowedError") return; // la personne a refermé la fenêtre de choix
      alerter("La capture automatique n'a pas fonctionné sur ce navigateur. Faites une capture d'écran habituelle, puis collez-la ici.");
    }
  });

  // ----- Envoi -----
  q("#rt-f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titre = texte(q("#rt-resume").value);
    if (!titre) return alerter("Résumez votre retour en une phrase.", "#rt-resume");
    const b = q("#rt-envoyer"); b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = "Envoi…";
    const id = crypto.randomUUID(), chemins = [];
    try {
      for (const [i, c] of captures.entries()) {
        const chemin = `retours/${id}/capture-${i + 1}.jpg`;
        const { error } = await sb.storage.from(BUCKET_PRIVE).upload(chemin, c.blob, { contentType: "image/jpeg" });
        if (error) throw error;
        chemins.push(chemin);
      }
      const { data, error } = await sb.from("retours").insert({
        id, type: q('[name="rt-type"]:checked').value, gene: q("#rt-gene").value, titre, description: texte(q("#rt-detail").value),
        avis_demande: etat.pilote ? q("#rt-avis").checked : true, contexte, captures: chemins
      }).select("id,numero,statut").single();
      if (error) throw error;
      fermer();
      chargerCompteRetours();
      if (etat.ecran.vue === "vueRetours") vueRetours();
      bandeau(`Retour n° ${data.numero} envoyé`, "Voir", async () => { if (!etat.gardien || await etat.gardien()) vueRetour(data.id); });
    } catch (err) {
      b.disabled = false; b.removeAttribute("aria-busy"); b.textContent = "Envoyer";
      alerter("Le retour n'a pas pu être envoyé : " + msgErreur(err));
    }
  });
  q("#rt-resume").focus();
}

/* ---------- Liste des retours ---------- */
async function vueRetours(message = "") {
  majLateral("retours");
  window.scrollTo(0, 0);
  const tete = `<div class="entete"><div class="gauche"><button type="button" class="btn icone-seule" id="retour" aria-label="Retour" title="Retour">${ICONES.retour}</button><h1>Retours et demandes</h1></div>
    <button class="btn plein outil" id="rt-nouveau" aria-label="Faire un retour">${ICONES.plus}<span class="long">Faire un retour</span></button></div>`;
  app.innerHTML = `${tete}<p class="sous">Chargement…</p>`;
  const brancherTete = () => { $("#retour").addEventListener("click", vueListe); $("#rt-nouveau").addEventListener("click", () => ouvrirRetour()); };
  brancherTete();
  const { data: retours, error } = await sb.from("retours").select("id,numero,cree_le,auteur_email,type,gene,titre,statut,avis_demande,captures").order("cree_le", { ascending: false }).limit(1000);
  if (etat.ecran.vue !== "vueRetours") return; // une autre page a été ouverte entre-temps
  if (error) {
    app.innerHTML = `${tete}<div class="message erreur" role="alert">Les retours n'ont pas pu être chargés : ${msgErreur(error)}</div><button class="btn" id="reessayer">Réessayer</button>`;
    brancherTete(); $("#reessayer").addEventListener("click", () => vueRetours());
    return;
  }
  etat.retoursAFaire = retours.filter(attendMoi).length; majPastilleRetours();
  const f = etat.retours.f, auteurs = [...new Set(retours.map((r) => r.auteur_email))].sort();
  if (f.auteur && !auteurs.includes(f.auteur)) f.auteur = "";
  const option = (v, l, choisi) => `<option value="${esc(v)}" ${v === choisi ? "selected" : ""}>${esc(l)}</option>`;
  app.innerHTML = `
    ${tete}
    <div id="alerte" role="status">${message ? `<div class="message info">${message}</div>` : ""}</div>
    <p class="sous">${etat.pilote
      ? `Les retours de ${PRENOM_ARTISTE} et vos propres demandes. Vous décidez de leur mise en chantier, puis vous validez ce qui est livré ; l'avis de ${PRENOM_ARTISTE} est demandé ensuite.`
      : `Vos remarques sur l'application. ${PRENOM_PILOTE} décide de leur mise en chantier ; une fois la correction validée, votre avis vous est demandé.`}</p>
    <div class="outils-ventes rt-outils" style="padding:0;margin:14px 0 10px">
      <input id="rt-q" type="search" enterkeyhint="search" placeholder="Rechercher un mot, un numéro…" aria-label="Rechercher un retour" value="${esc(f.q)}">
      <select id="rt-statut" class="tri" aria-label="Filtrer par statut">
        ${option("ouverts", "En cours de traitement", f.statut)}${option("moi", "À traiter par moi", f.statut)}${option("", "Tous les retours", f.statut)}
        ${Object.entries(RETOUR_STATUTS).map(([c, l]) => option(c, l, f.statut)).join("")}
      </select>
      <select id="rt-type" class="tri" aria-label="Filtrer par type">${option("", "Tous les types", f.type)}${Object.entries(RETOUR_TYPES_COURTS).map(([c, l]) => option(c, l, f.type)).join("")}</select>
      <select id="rt-auteur" class="tri" aria-label="Filtrer par demandeur">${option("", "Tous les demandeurs", f.auteur)}${auteurs.map((a) => option(a, prenomDe(a), f.auteur)).join("")}</select>
    </div>
    <p class="sous" id="rt-resume-liste" aria-live="polite"></p>
    <section class="carte" style="padding:8px" id="liste-retours"></section>`;
  brancherTete();
  const retenu = (r) => {
    if (f.statut === "moi" ? !attendMoi(r) : f.statut === "ouverts" ? ["clos", "refuse"].includes(r.statut) : f.statut && r.statut !== f.statut) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.auteur && r.auteur_email !== f.auteur) return false;
    const q = sansAccent(f.q.trim());
    return !q || sansAccent(`#${r.numero} n°${r.numero} ${r.titre}`).includes(q);
  };
  const dessiner = () => {
    const liste = retours.filter(retenu).sort((a, b) => attendMoi(b) - attendMoi(a)); // ceux qui m'attendent d'abord ; l'ordre par date est conservé ensuite
    const aMoi = liste.filter(attendMoi).length;
    $("#rt-resume-liste").textContent = retours.length ? `${liste.length} retour${liste.length > 1 ? "s" : ""}${liste.length < retours.length ? ` sur ${retours.length}` : ""}${aMoi ? `, dont ${aMoi} en attente de votre action` : ""}.` : "";
    $("#liste-retours").innerHTML = liste.map((r) => `
      <button class="vente retour-ligne" data-id="${r.id}">
        <span class="rt-num" aria-label="Retour numéro ${r.numero}">#${r.numero}</span>
        <div class="corps"><div class="titre">${esc(r.titre)}</div>
          <div class="sous">${esc([RETOUR_TYPES_COURTS[r.type], prenomDe(r.auteur_email), jourCourt(r.cree_le), r.gene === "bloquant" ? "bloquant" : "", r.captures && r.captures.length ? `${r.captures.length} capture${r.captures.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(", "))}</div></div>
        <div class="droite">${badgeRetour(r.statut)}${attendMoi(r) ? `<div class="sous rt-a-moi">À vous de jouer</div>` : ""}</div>
      </button>`).join("") || `<div class="vide-filtre"><p>${retours.length ? "Aucun retour ne correspond à ces filtres." : "Aucun retour pour l'instant. Le bouton « Un retour ? », présent sur chaque page, en crée un avec son contexte."}</p></div>`;
  };
  let attente;
  $("#rt-q").addEventListener("input", (e) => { clearTimeout(attente); attente = setTimeout(() => { f.q = e.target.value; dessiner(); }, 200); });
  for (const c of ["statut", "type", "auteur"]) $("#rt-" + c).addEventListener("change", (e) => { f[c] = e.target.value; dessiner(); });
  $("#liste-retours").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) vueRetour(b.dataset.id); });
  dessiner();
}

/* ---------- Détail d'un retour ---------- */
/* Actions proposées selon le rôle et le statut. La base refuse toute autre transition. */
const ACTIONS_RETOUR = {
  accepter: { vers: "accepte", fait: "Retour accepté" },
  preciser: { vers: "precision", fait: "Question envoyée", saisie: { titre: "Demander une précision", libelle: "Votre question", requis: true, action: "Envoyer la question" } },
  refuser: { vers: "refuse", fait: "Retour refusé", saisie: { titre: "Refuser ce retour", libelle: "Motif du refus, visible par son auteur", requis: true, action: "Refuser" } },
  commencer: { vers: "en_cours", fait: "Réalisation démarrée" },
  livrer: { vers: "livre", fait: "Marqué comme livré", saisie: { titre: "Marquer comme livré", libelle: "Ce qui a été fait", requis: false, action: "Marquer comme livré" } },
  valider: { vers: "valide", fait: "Correction validée" },
  reprendre: { vers: "en_cours", fait: "Renvoyé en correction", saisie: { titre: "Ce n'est pas encore bon", libelle: "Ce qui ne va pas", requis: true, action: "Renvoyer en correction" } },
  clore: { vers: "clos", fait: "Retour clos" },
  rouvrir: { vers: "accepte", fait: "Retour rouvert", saisie: { titre: "Rouvrir ce retour", libelle: "Pourquoi le rouvrir ?", requis: true, action: "Rouvrir" } },
  repondre: { vers: "nouveau", fait: "Réponse envoyée", saisie: { titre: "Répondre à la question", libelle: "Votre réponse", requis: true, action: "Envoyer ma réponse" } },
  convient: { vers: "clos", fait: "Merci, le retour est clos" },
  convient_pas: { vers: "en_cours", fait: "C'est noté, le retour repart en correction", saisie: { titre: "Cela ne convient pas encore", libelle: "Dites ce qui ne va pas", requis: true, action: "Envoyer" } }
};
function actionsRetour(r) {
  const b = (cle, libelle, classe = "") => `<button class="btn ${classe}" data-action="${cle}">${libelle}</button>`;
  const mien = memeEmail(r.auteur_email, etat.email);
  if (etat.pilote) return {
    nouveau: ["À vous de décider si ce retour sera traité.", b("accepter", "Accepter", "plein") + b("preciser", "Demander une précision") + b("refuser", "Refuser", "danger")],
    precision: [`En attente de la réponse de ${prenomDe(r.auteur_email)}.`, b("accepter", "Accepter") + b("refuser", "Refuser", "danger")],
    accepte: ["Accepté : en attente de réalisation.", b("commencer", "Passer en cours") + b("refuser", "Refuser finalement", "danger")],
    en_cours: ["La réalisation est en cours.", b("livrer", "Marquer comme livré")],
    livre: ["La correction est livrée. Vérifiez-la, puis validez.", b("valider", r.avis_demande ? "Valider la correction" : "Valider et clore", "plein") + b("reprendre", "Ce n'est pas encore bon")],
    valide: [`Vous avez validé. L'avis de ${PRENOM_ARTISTE} est attendu.`, b("clore", "Clore sans attendre")],
    refuse: ["Ce retour a été refusé.", b("rouvrir", "Rouvrir")],
    clos: ["Ce retour est clos.", b("rouvrir", "Rouvrir")]
  }[r.statut] || ["", ""];
  return {
    nouveau: [`En attente de la décision de ${PRENOM_PILOTE}.`, ""],
    precision: mien ? [`${PRENOM_PILOTE} a besoin d'une précision pour décider.`, b("repondre", "Répondre", "plein")] : [`${PRENOM_PILOTE} a demandé une précision.`, ""],
    accepte: [`Accepté par ${PRENOM_PILOTE} : en attente de réalisation.`, ""],
    en_cours: ["La réalisation est en cours.", ""],
    livre: [`La correction est livrée. ${PRENOM_PILOTE} la vérifie avant de vous demander votre avis.`, ""],
    valide: [`${PRENOM_PILOTE} a validé cette correction. Est-ce que cela vous convient ?`, b("convient", "Oui, c'est bon", "plein vert") + b("convient_pas", "Non, pas encore")],
    refuse: [`Ce retour n'a pas été retenu par ${PRENOM_PILOTE}.`, ""],
    clos: ["Ce retour est clos.", ""]
  }[r.statut] || ["", ""];
}

async function vueRetour(id, message = "") {
  majLateral("retours");
  window.scrollTo(0, 0);
  app.innerHTML = `${entete("Retour")}<p class="sous">Chargement…</p>`;
  $("#retour").addEventListener("click", () => vueRetours());
  const [rep, fil] = await Promise.all([
    sb.from("retours").select("*").eq("id", id).single(),
    sb.from("retours_messages").select("*").eq("retour_id", id).order("cree_le")
  ]);
  if (etat.ecran.vue !== "vueRetour" || etat.ecran.element !== id) return;
  const r = rep.data;
  if (rep.error || fil.error || !r) {
    app.innerHTML = `${entete("Retour")}<div class="message erreur" role="alert">Ce retour n'a pas pu être chargé${rep.error || fil.error ? ` : ${msgErreur(rep.error || fil.error)}` : "."}</div>`;
    $("#retour").addEventListener("click", () => vueRetours());
    return;
  }
  const messages = fil.data, c = r.contexte || {}, [phrase, boutons] = actionsRetour(r);
  const etapes = Object.keys(RETOUR_ETAPES).filter((e) => e !== "valide" || r.avis_demande);
  const rang = etapes.indexOf(r.statut); // -1 pour « Précision demandée » et « Refusé », hors du fil principal
  const ligneFil = (m) => m.evenement
    ? `<li class="evt"><div><strong>${esc(prenomDe(m.auteur))}</strong> ${esc(RETOUR_EVENEMENTS[m.evenement] || m.evenement)} <span class="sous">${esc(dateHeure(m.cree_le))}</span></div>${m.corps ? `<p>${esc(m.corps)}</p>` : ""}</li>`
    : `<li class="msg"><div><strong>${esc(prenomDe(m.auteur))}</strong> <span class="sous">${esc(dateHeure(m.cree_le))}</span></div><p>${esc(m.corps)}</p></li>`;
  const ouvrable = c.oeuvre && c.oeuvre.id ? "Ouvrir la fiche concernée" : PAGES_ROUVRABLES.includes(c.vue) ? "Ouvrir la page concernée" : "";
  app.innerHTML = `
    <div class="entete"><div class="gauche"><button type="button" class="btn icone-seule" id="retour" aria-label="Retour" title="Retour">${ICONES.retour}</button><h1><span class="rt-num-titre">#${r.numero}</span> ${esc(r.titre)}</h1></div></div>
    <div id="alerte" role="status">${message ? `<div class="message info">${message}</div>` : ""}</div>
    <div class="rt-detail">
      <div>
        <section class="carte bloc">
          <div class="rt-meta">${badgeRetour(r.statut)}<span>${esc(RETOUR_TYPES_COURTS[r.type] || r.type)}</span><span>${esc(RETOUR_GENES[r.gene] || r.gene)}</span>
            <span class="sous">Créé par ${esc(prenomDe(r.auteur_email))} le ${esc(dateHeure(r.cree_le))}</span></div>
          ${r.description ? `<p class="rt-description">${esc(r.description)}</p>` : `<p class="sous" style="margin:12px 0 0">Pas de détail saisi.</p>`}
          ${r.statut === "refuse" && r.motif_refus ? `<div class="message erreur"><strong>Motif du refus :</strong> ${esc(r.motif_refus)}</div>` : ""}
          ${r.note_livraison && ["livre", "valide", "clos"].includes(r.statut) ? `<div class="message info"><strong>Ce qui a été fait :</strong> ${esc(r.note_livraison)}</div>` : ""}
          ${r.captures && r.captures.length ? `<h2 class="section">Captures d'écran</h2><div class="rt-vignettes" id="rt-captures">${r.captures.map((ch, i) => `<figure><button type="button" data-capture="${i}" aria-label="Agrandir la capture ${i + 1}"><span class="squelette"></span></button></figure>`).join("")}</div>` : ""}
        </section>
        <section class="carte bloc">
          <h2>Échanges</h2>
          <ol class="rt-fil" id="rt-fil"><li class="evt"><div><strong>${esc(prenomDe(r.auteur_email))}</strong> a créé ce retour <span class="sous">${esc(dateHeure(r.cree_le))}</span></div></li>${messages.map(ligneFil).join("")}</ol>
          <form id="rt-commenter" novalidate>
            <label for="rt-commentaire">Ajouter un commentaire</label>
            <textarea id="rt-commentaire" maxlength="5000" style="min-height:70px"></textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn" type="submit" id="rt-publier">Publier</button></div>
          </form>
        </section>
      </div>
      <aside>
        <section class="carte bloc rt-suivi">
          <h2>Suivi</h2>
          <ol class="rt-etapes">${etapes.map((e, i) => `<li class="${rang === -1 ? (i === 0 ? "fait" : "") : i < rang ? "fait" : i === rang ? "ici" : ""}" ${i === rang ? 'aria-current="step"' : ""}>${esc(RETOUR_ETAPES[e])}</li>`).join("")}</ol>
          ${rang === -1 ? `<p style="margin:12px 0 0">${badgeRetour(r.statut)}</p>` : ""}
          <p class="rt-phrase ${attendMoi(r) ? "a-moi" : ""}">${esc(phrase)}</p>
          ${boutons ? `<div class="rt-boutons" id="rt-boutons">${boutons}</div>` : ""}
          <div id="rt-erreur" role="alert"></div>
        </section>
        <section class="carte bloc">
          <h2>Contexte</h2>
          ${listeContexte(c)}
          ${ouvrable ? `<button class="btn large" id="rt-ouvrir" style="margin-top:12px">${ouvrable}</button>` : ""}
        </section>
      </aside>
    </div>`;
  $("#retour").addEventListener("click", () => vueRetours());

  // ----- Captures -----
  (r.captures || []).forEach(async (chemin, i) => {
    const b = app.querySelector(`[data-capture="${i}"]`);
    try { const url = await urlCapture(chemin); if (b.isConnected) { b.innerHTML = `<img alt="Capture ${i + 1}" src="${url}">`; b.addEventListener("click", () => agrandirCapture(url)); } }
    catch (_) { if (b.isConnected) b.outerHTML = `<span class="sous">Capture illisible</span>`; }
  });
  if ($("#rt-ouvrir")) $("#rt-ouvrir").addEventListener("click", () => (c.oeuvre && c.oeuvre.id ? vueFiche(c.oeuvre.id) : window[c.vue]()));

  // ----- Changement de statut -----
  if ($("#rt-boutons")) $("#rt-boutons").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-action]"); if (!b) return;
    const a = ACTIONS_RETOUR[b.dataset.action];
    let commentaire = null;
    if (a.saisie) { commentaire = await saisir(a.saisie); if (commentaire === null) return; }
    $("#rt-boutons").querySelectorAll("button").forEach((x) => { x.disabled = true; });
    const { error } = await sb.rpc("changer_statut_retour", { p_id: id, p_statut: a.vers, p_commentaire: commentaire || null });
    if (error) {
      $("#rt-boutons").querySelectorAll("button").forEach((x) => { x.disabled = false; });
      $("#rt-erreur").innerHTML = `<div class="message erreur">Le changement n'a pas été enregistré : ${msgErreur(error)}</div>`;
      return;
    }
    chargerCompteRetours();
    await vueRetour(id);
    bandeau(a.fait);
  });

  // ----- Commentaire -----
  $("#rt-commenter").addEventListener("submit", async (e) => {
    e.preventDefault();
    const corps = texte($("#rt-commentaire").value); if (!corps) return $("#rt-commentaire").focus();
    const b = $("#rt-publier"); b.disabled = true;
    const { error } = await sb.from("retours_messages").insert({ retour_id: id, auteur: String(etat.email).toLowerCase(), corps });
    if (error) { b.disabled = false; $("#alerte").innerHTML = `<div class="message erreur">Le commentaire n'a pas pu être publié : ${msgErreur(error)}</div>`; return window.scrollTo(0, 0); }
    await vueRetour(id);
    const dernier = $("#rt-fil li:last-child"); if (dernier) dernier.scrollIntoView({ block: "center" });
  });
}
