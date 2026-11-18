"use strict";
/* Sélection multiple et actions en lot sur le catalogue. */

/* ---------- Sélection multiple et actions en lot ---------- */
function majSelection() {
  const zone = $("#grille"), barre = $("#barre-selection"); if (!zone || !barre) return;
  const actif = !!etat.selection, n = actif ? etat.selection.size : 0;
  zone.classList.toggle("selection", actif);
  zone.querySelectorAll("[data-id]").forEach((b) => {
    const choisie = actif && etat.selection.has(b.dataset.id);
    b.classList.toggle("choisie", choisie);
    if (actif) b.setAttribute("aria-pressed", String(choisie)); else b.removeAttribute("aria-pressed");
  });
  barre.hidden = !actif; app.querySelector(".barre-bas.mobile").hidden = actif; $("#sel-entrer").hidden = actif;
  document.body.classList.toggle("sel", actif);
  $("#sel-compte").innerHTML = n ? `${n} <span class="long">œuvre${n > 1 ? "s" : ""} </span>sélectionnée${n > 1 ? "s" : ""}` : "Touchez les œuvres";
  barre.querySelectorAll("[data-lot], #sel-corbeille").forEach((b) => { b.disabled = !n; });
}

async function parLots(ids, action) {
  for (let i = 0; i < ids.length; i += 150) { const { error } = await action(ids.slice(i, i + 150)); if (error) throw error; }
}

async function selectionCorbeille() {
  const ids = [...etat.selection], n = ids.length, pl = n > 1 ? "s" : "";
  const accord = await confirmer({
    titre: `Mettre ${n} œuvre${pl} à la corbeille ?`,
    corps: `${n > 1 ? "Elles seront retirées" : "Elle sera retirée"} du catalogue. Un administrateur pourra ${n > 1 ? "les" : "la"} restaurer depuis la corbeille.`,
    action: "Mettre à la corbeille"
  });
  if (!accord) return;
  try {
    const quand = new Date().toISOString();
    await parLots(ids, (lot) => sb.from("oeuvres").update({ supprime_le: quand }).in("id", lot));
  } catch (e) { vueListe(); return bandeau("La mise à la corbeille a échoué : " + (e.message || e)); }
  vueListe();
  bandeau(`${n} œuvre${pl} placée${pl} dans la corbeille`, "Annuler", async () => {
    try { await parLots(ids, (lot) => sb.from("oeuvres").update({ supprime_le: null }).in("id", lot)); }
    catch (e) { bandeau("L'annulation a échoué : " + (e.message || e)); }
    vueListe();
  });
}

/* Fenêtre « Modifier un champ » : renvoie les colonnes à mettre à jour, ou null si l'utilisateur renonce. */
function demanderChamp(n, impose) {
  const listeConfig = (cle) => [["", "Aucune valeur (vider le champ)"], ...champSysteme(cle).options.map((v) => [v, v])];
  const CHAMPS = [
    { cle: "statut", libelle: "Statut", options: () => Object.entries(STATUTS) },
    { cle: "technique", libelle: champSysteme("technique").libelle, options: () => listeConfig("technique") },
    { cle: "support", libelle: champSysteme("support").libelle, options: () => listeConfig("support") },
    { cle: "nature", libelle: champSysteme("nature").libelle, options: () => listeConfig("nature") },
    { cle: "serie", libelle: "Série ou thème", saisie: "text" },
    { cle: "annee", libelle: "Année", saisie: "numeric" },
    { cle: "prix_eur", libelle: "Prix (€)", saisie: "decimal" },
    { cle: "prix_masque", libelle: "Affichage du prix sur le site web", options: () => [["non", "Afficher le prix"], ["oui", "Ne pas afficher le prix"]] },
    { cle: "encadre", libelle: "Encadrement", options: () => [["", "Non renseigné"], ["oui", "Encadré"], ["non", "Non encadré"]] }
  ];
  return new Promise((resoudre) => {
    const voile = document.createElement("div"); voile.className = "voile";
    voile.innerHTML = `
      <div class="dialogue large" role="dialog" aria-modal="true" aria-labelledby="lot-titre">
        <h2 id="lot-titre">${impose ? `Modifier « ${esc(CHAMPS.find((c) => c.cle === impose).libelle)} »` : "Modifier un champ"} pour ${n} œuvre${n > 1 ? "s" : ""}</h2>
        <div ${impose ? "hidden" : ""}><label for="lot-champ">Champ à modifier</label>
        <select id="lot-champ">${CHAMPS.map((c, i) => `<option value="${i}" ${c.cle === impose ? "selected" : ""}>${esc(c.libelle)}</option>`).join("")}</select></div>
        <label for="lot-valeur">Nouvelle valeur</label>
        <div id="lot-zone"></div>
        <p class="aide" id="lot-aide"></p>
        <div id="lot-erreur" role="alert"></div>
        <div class="actions">
          <button class="btn" data-r="non">Annuler</button>
          <button class="btn plein" data-r="oui">Appliquer</button>
        </div>
      </div>`;
    document.body.append(voile);
    const q = (sel) => voile.querySelector(sel);
    const champ = () => CHAMPS[+q("#lot-champ").value];
    const dessinerValeur = () => {
      const c = champ();
      q("#lot-zone").innerHTML = c.options
        ? `<select id="lot-valeur">${c.options().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`
        : `<input id="lot-valeur" inputmode="${c.saisie}" autocomplete="off" placeholder="Laisser vide pour effacer la valeur">`;
      q("#lot-aide").textContent = c.cle === "statut"
        ? "Une œuvre vendue qui passe à un autre statut perd son prix de vente, sa date de vente, ses frais de port facturés et son acheteur."
        : `La valeur actuelle de ce champ sera remplacée sur ${n > 1 ? "toutes les œuvres sélectionnées" : "l'œuvre sélectionnée"}.`;
      q("#lot-erreur").innerHTML = "";
    };
    const lire = () => {
      const c = champ(), v = q("#lot-valeur").value;
      if (c.cle === "statut") return v === "vendu" ? { statut: v } : { statut: v, prix_vendu_eur: null, date_vente: null, port_facture_eur: null, acheteur_id: null };
      if (c.cle === "prix_masque") return { prix_masque: v === "oui" };
      if (c.cle === "encadre") return { encadre: v === "" ? null : v === "oui" };
      if (c.cle === "annee") {
        const a = nombre(v);
        if (texte(v) && !(Number.isInteger(a) && a >= 1900 && a <= 2100)) throw new Error("L'année doit comporter quatre chiffres, par exemple 2024.");
        return { annee: a };
      }
      if (c.cle === "prix_eur") {
        const p = nombre(v);
        if (texte(v) && (p === null || p < 0)) throw new Error("Le prix doit être un nombre, par exemple 450.");
        return { prix_eur: p };
      }
      return { [c.cle]: texte(v) };
    };
    const clavier = (e) => { if (e.key === "Escape") fermer(null); };
    const fermer = (r) => { document.removeEventListener("keydown", clavier); voile.remove(); resoudre(r); };
    document.addEventListener("keydown", clavier);
    q("#lot-champ").addEventListener("change", dessinerValeur);
    voile.addEventListener("click", (e) => {
      if (e.target === voile) return fermer(null);
      const b = e.target.closest("[data-r]"); if (!b) return;
      if (b.dataset.r === "non") return fermer(null);
      try { fermer(lire()); }
      catch (err) { q("#lot-erreur").innerHTML = `<div class="message erreur">${msgErreur(err)}</div>`; q("#lot-valeur").setAttribute("aria-invalid", "true"); q("#lot-valeur").focus(); }
    });
    dessinerValeur();
    (impose ? q("#lot-valeur") : q("#lot-champ")).focus();
  });
}

async function selectionModifier(impose) {
  const ids = [...etat.selection], n = ids.length, pl = n > 1 ? "s" : "";
  const maj = await demanderChamp(n, impose);
  if (!maj) return;
  const colonnes = ["id", ...Object.keys(maj)].join(",");
  const avant = [];
  try {
    for (let i = 0; i < ids.length; i += 150) { // valeurs d'origine, pour pouvoir annuler
      const { data, error } = await sb.from("oeuvres").select(colonnes).in("id", ids.slice(i, i + 150));
      if (error) throw error;
      avant.push(...data);
    }
    await parLots(ids, (lot) => sb.from("oeuvres").update(maj).in("id", lot));
  } catch (e) { vueListe(); return bandeau("La modification a échoué : " + (e.message || e)); }
  vueListe();
  bandeau(`${n} œuvre${pl} modifiée${pl}`, "Annuler", async () => {
    const groupes = new Map();
    avant.forEach(({ id, ...valeurs }) => { const k = JSON.stringify(valeurs); if (!groupes.has(k)) groupes.set(k, { valeurs, ids: [] }); groupes.get(k).ids.push(id); });
    try { for (const g of groupes.values()) await parLots(g.ids, (lot) => sb.from("oeuvres").update(g.valeurs).in("id", lot)); }
    catch (e) { bandeau("L'annulation a échoué : " + (e.message || e)); }
    vueListe();
  });
}
