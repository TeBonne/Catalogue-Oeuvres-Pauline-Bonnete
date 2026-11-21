"use strict";
/* Fichier des acheteurs (administrateur) : liste, fiche, achats rattachés.
   Un acheteur se rattache à une vente depuis la fiche de l'œuvre vendue (voir fiche.js). */

const nomAcheteur = (a) => [a.prenom, a.nom].filter(Boolean).join(" ") || a.email || "Acheteur sans nom";
const initiales = (a) => ((a.prenom || "")[0] || "") + ((a.nom || "")[0] || "") || (a.email || "?")[0];

async function chargerAcheteurs() {
  const { data, error } = await sb.from("acheteurs").select("id,prenom,nom,email,telephone,ville,notes").order("nom").order("prenom").limit(5000);
  if (error) throw error;
  return data;
}
async function achatsParAcheteur() {
  const { data, error } = await sb.from("oeuvres").select("id,titre,acheteur_id,prix_vendu_eur,date_vente,vignette_path")
    .not("acheteur_id", "is", null).is("supprime_le", null).limit(5000);
  if (error) throw error;
  const groupes = new Map();
  data.forEach((o) => { if (!groupes.has(o.acheteur_id)) groupes.set(o.acheteur_id, []); groupes.get(o.acheteur_id).push(o); });
  return groupes;
}

async function vueAcheteurs(message = "") {
  if (!etat.admin) return vueListe();
  majLateral("acheteurs");
  window.scrollTo(0, 0);
  app.innerHTML = `${entete("Acheteurs")}<p class="sous">Chargement…</p>`;
  $("#retour").addEventListener("click", vueListe);
  let acheteurs, achats;
  try { [acheteurs, achats] = await Promise.all([chargerAcheteurs(), achatsParAcheteur()]); }
  catch (e) {
    app.innerHTML = `${entete("Acheteurs")}<div class="message erreur" role="alert">Le fichier des acheteurs n'a pas pu être chargé : ${msgErreur(e)}</div><button class="btn" id="reessayer">Réessayer</button>`;
    $("#retour").addEventListener("click", vueListe); $("#reessayer").addEventListener("click", () => vueAcheteurs());
    return;
  }
  const total = (l) => l.reduce((t, o) => t + (Number(o.prix_vendu_eur) || 0), 0);
  app.innerHTML = `
    <div class="etroit">
      ${entete("Acheteurs")}
      <div id="alerte" role="status">${message ? `<div class="message info">${message}</div>` : ""}</div>
      <p class="sous">Les personnes qui ont acheté une œuvre. Un acheteur se rattache à une vente depuis la fiche de l'œuvre vendue. Ces informations ne sont visibles que des administrateurs.</p>
      <div class="outils-ventes" style="padding:0;margin:14px 0">
        <input id="ach-q" type="search" enterkeyhint="search" placeholder="Rechercher un nom, un e-mail, une ville…" aria-label="Rechercher un acheteur">
        <button class="btn plein" id="ach-ajouter">${ICONES.plus}Ajouter un acheteur</button>
      </div>
      <p class="sous" id="ach-resume" aria-live="polite"></p>
      <section class="carte" style="padding:8px" id="liste-acheteurs"></section>
    </div>`;
  $("#retour").addEventListener("click", vueListe);
  $("#ach-ajouter").addEventListener("click", () => vueAcheteur(null));
  const dessiner = () => {
    const q = sansAccent($("#ach-q").value.trim());
    const liste = acheteurs.filter((a) => !q || sansAccent([a.prenom, a.nom, a.email, a.ville].filter(Boolean).join(" ")).includes(q));
    $("#ach-resume").textContent = acheteurs.length ? `${liste.length} acheteur${liste.length > 1 ? "s" : ""}${q ? ` sur ${acheteurs.length}` : ""}.` : "";
    $("#liste-acheteurs").innerHTML = liste.map((a) => {
      const l = achats.get(a.id) || [];
      return `<button class="vente" data-id="${a.id}">
        <span class="initiales" aria-hidden="true">${esc(initiales(a).toUpperCase())}</span>
        <div class="corps"><div class="titre">${esc(nomAcheteur(a))}</div>
          <div class="sous">${esc([a.email, a.ville].filter(Boolean).join(", ") || "Coordonnées à compléter")}</div></div>
        <div class="droite"><div class="montant">${l.length ? esc(euros(total(l))) : ""}</div>
          <div class="sous">${l.length ? `${l.length} achat${l.length > 1 ? "s" : ""}` : "Aucun achat rattaché"}</div></div>
      </button>`;
    }).join("") || `<div class="vide-filtre"><p>${acheteurs.length ? "Aucun acheteur ne correspond à cette recherche." : "Aucun acheteur pour l'instant. Ajoutez-en un ici, ou directement depuis la fiche d'une œuvre vendue."}</p></div>`;
  };
  let attente;
  $("#ach-q").addEventListener("input", () => { clearTimeout(attente); attente = setTimeout(dessiner, 200); });
  $("#liste-acheteurs").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) vueAcheteur(b.dataset.id); });
  dessiner();
}

async function vueAcheteur(id) {
  if (!etat.admin) return vueListe();
  majLateral("acheteurs");
  window.scrollTo(0, 0);
  const titre = id ? "Acheteur" : "Nouvel acheteur";
  app.innerHTML = `${entete(titre)}<p class="sous">Chargement…</p>`;
  $("#retour").addEventListener("click", () => vueAcheteurs());
  let a = {}, achats = [];
  if (id) {
    try {
      const [rep, ventes] = await Promise.all([
        sb.from("acheteurs").select("*").eq("id", id).single(),
        sb.from("oeuvres").select("id,titre,prix_vendu_eur,date_vente,vignette_path").eq("acheteur_id", id).is("supprime_le", null).order("date_vente", { ascending: false, nullsFirst: false })
      ]);
      if (rep.error) throw rep.error;
      if (ventes.error) throw ventes.error;
      a = rep.data; achats = ventes.data;
    } catch (e) {
      app.innerHTML = `${entete(titre)}<div class="message erreur" role="alert">Cet acheteur n'a pas pu être chargé : ${msgErreur(e)}</div>`;
      $("#retour").addEventListener("click", () => vueAcheteurs());
      return;
    }
  }
  const champ = (cle, libelle, attributs = "") => `<div><label for="ach-${cle}">${libelle}</label><input id="ach-${cle}" autocomplete="off" value="${esc(a[cle])}" ${attributs}></div>`;
  app.innerHTML = `
    <div class="etroit">
      ${entete(id ? nomAcheteur(a) : titre)}
      <div id="alerte" role="alert"></div>
      <form class="carte bloc" id="ach-f" novalidate>
        <div class="deux">${champ("prenom", "Prénom")}${champ("nom", "Nom")}</div>
        <div class="deux">${champ("email", "E-mail", 'type="email" inputmode="email" autocapitalize="none" spellcheck="false"')}${champ("telephone", "Téléphone", 'type="tel" inputmode="tel"')}</div>
        ${champ("ville", "Ville")}
        <label for="ach-notes">Notes</label>
        <textarea id="ach-notes" style="min-height:90px">${esc(a.notes)}</textarea>
        <p class="aide">Renseignez au moins un prénom, un nom ou un e-mail.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
          ${id ? `<button class="btn danger" type="button" id="ach-supprimer" style="margin-right:auto">${ICONES.corbeille}Supprimer</button>` : ""}
          <button class="btn" type="button" id="ach-annuler">Annuler</button>
          <button class="btn plein" type="submit" id="ach-valider">Enregistrer</button>
        </div>
      </form>
      ${id ? `
      <section class="carte" style="padding:8px;margin-top:14px">
        <h2 style="margin:10px 10px 6px">Achats <span class="sous" style="font-weight:400">(${achats.length})</span></h2>
        <div id="ach-achats">${achats.map((o) => `
          <button class="vente" data-id="${o.id}">
            <img class="fondu" loading="lazy" alt="" src="${esc(urlPhoto(o.vignette_path))}">
            <div class="corps"><div class="titre">${esc(o.titre)}</div><div class="sous">${o.date_vente ? `Vendue le ${esc(dateFr(o.date_vente))}` : "Date de vente à compléter"}</div></div>
            <div class="droite"><div class="montant">${o.prix_vendu_eur != null ? esc(euros(Number(o.prix_vendu_eur))) : ""}</div></div>
          </button>`).join("") || `<p class="sous" style="padding:4px 10px 10px">Aucun achat rattaché. Ouvrez la fiche d'une œuvre vendue et choisissez cet acheteur.</p>`}</div>
      </section>` : ""}
    </div>`;
  const alerter = (m, cle) => { $("#alerte").innerHTML = m ? `<div class="message erreur">${m}</div>` : ""; if (cle) $("#ach-" + cle).focus(); if (m) window.scrollTo(0, 0); };
  $("#ach-f").addEventListener("input", () => { etat.modifie = true; });
  etat.gardien = async () => !etat.modifie || confirmer({
    titre: "Quitter sans enregistrer ?", corps: "Les modifications apportées à cet acheteur seront perdues.",
    action: "Quitter sans enregistrer", annuler: "Continuer la saisie", delai: 0
  });
  const quitter = async () => { if (await etat.gardien()) { etat.modifie = false; vueAcheteurs(); } };
  $("#retour").addEventListener("click", quitter);
  $("#ach-annuler").addEventListener("click", quitter);
  if ($("#ach-achats")) $("#ach-achats").addEventListener("click", async (e) => { const b = e.target.closest("[data-id]"); if (b && await etat.gardien()) vueFiche(b.dataset.id); });
  $("#ach-f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = (c) => texte($("#ach-" + c).value);
    const valeurs = { prenom: v("prenom"), nom: v("nom"), email: v("email") ? v("email").toLowerCase() : null, telephone: v("telephone"), ville: v("ville"), notes: v("notes") };
    if (!valeurs.prenom && !valeurs.nom && !valeurs.email) return alerter("Renseignez au moins un prénom, un nom ou un e-mail.", "prenom");
    if (valeurs.email && !emailValide(valeurs.email)) return alerter("L'adresse e-mail n'est pas valide.", "email");
    const b = $("#ach-valider"); b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = "Enregistrement…";
    const { data, error } = await (id ? sb.from("acheteurs").update(valeurs).eq("id", id).select("id") : sb.from("acheteurs").insert(valeurs).select("id"));
    if (error || !data.length) { b.disabled = false; b.removeAttribute("aria-busy"); b.textContent = "Enregistrer"; return alerter("L'acheteur n'a pas pu être enregistré : " + (error ? msgErreur(error) : "droits insuffisants.")); }
    etat.modifie = false;
    vueAcheteurs(`${esc(nomAcheteur(valeurs))} ${id ? "a été mis à jour" : "a été ajouté au fichier"}.`);
  });
  if (id) $("#ach-supprimer").addEventListener("click", async () => {
    const ok = await confirmer({
      titre: `Supprimer ${nomAcheteur(a)} ?`,
      corps: achats.length ? `Ses coordonnées seront effacées définitivement. ${achats.length > 1 ? `Ses ${achats.length} achats restent enregistrés` : "Son achat reste enregistré"} dans le suivi des ventes, sans acheteur.` : "Ses coordonnées seront effacées définitivement.",
      action: "Supprimer définitivement", ton: "danger"
    });
    if (!ok) return;
    const { data, error } = await sb.from("acheteurs").delete().eq("id", id).select("id");
    if (error || !data.length) return alerter("La suppression a échoué : " + (error ? msgErreur(error) : "droits insuffisants."));
    etat.modifie = false;
    vueAcheteurs(`${esc(nomAcheteur(a))} a été supprimé du fichier.`);
  });
}
