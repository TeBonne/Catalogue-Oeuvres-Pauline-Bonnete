"use strict";
/* Catalogue : liste des œuvres, recherche, filtres de statut, tri, vignettes ou liste. */

/* ---------- Liste ---------- */
function filtrer(req) {
  req = req.is("supprime_le", null);
  if (etat.statut) req = req.eq("statut", etat.statut);
  const q = etat.q.replace(/[,()%*\\"]/g, " ").trim();
  if (q) req = req.or(["titre", "serie", "technique", "support"].map((c) => `${c}.ilike."%${q}%"`).join(","));
  return req;
}

async function chargerComptes() {
  const cles = ["", ...Object.keys(STATUTS)];
  const res = await Promise.all(cles.map((s) => {
    let r = sb.from("oeuvres").select("id", { count: "exact", head: true }).is("supprime_le", null);
    return s ? r.eq("statut", s) : r;
  }));
  cles.forEach((s, i) => { if (s) etat.comptes[s] = res[i].count ?? 0; else etat.total_general = res[i].count ?? 0; });
  if (etat.admin) {
    const { count } = await sb.from("oeuvres").select("id", { count: "exact", head: true }).not("supprime_le", "is", null);
    etat.enCorbeille = count ?? 0;
  }
}

async function chargerPage(reinitialiser, jeton = etat.jeton) {
  const page = reinitialiser ? 0 : etat.page, debut = page * PAGE;
  const { data, count, error } = await filtrer(
    sb.from("oeuvres").select("id,titre,statut,prix_eur,vignette_path,technique,support,annee,hauteur_cm,largeur_cm", { count: "exact" })
  ).order(TRIS[etat.tri][1], { ascending: TRIS[etat.tri][2], nullsFirst: false }).order("id").range(debut, debut + PAGE - 1);
  if (error) throw error;
  if (jeton !== etat.jeton) return; // réponse périmée : une recherche plus récente est en cours
  if (reinitialiser) etat.items = [];
  etat.items.push(...data); etat.total = count ?? etat.items.length; etat.page = page + 1;
}

function dessinerPuces() {
  const zone = $("#puces"); if (!zone) return;
  const puce = (cle, lib, n) => `<button class="puce" data-statut="${cle}" aria-pressed="${etat.statut === cle}">${esc(lib)}<span class="n">${n}</span></button>`;
  zone.innerHTML = puce("", "Toutes", etat.total_general) + Object.entries(STATUTS).map(([c, l]) => puce(c, l, etat.comptes[c] ?? 0)).join("");
}

function dessinerGrille() {
  const zone = $("#grille"); if (!zone) return;
  zone.className = etat.vue === "liste" ? "liste" : "grille"; zone.removeAttribute("aria-busy");
  document.querySelectorAll("#bascule button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vue === etat.vue)));
  if (!etat.items.length) {
    zone.innerHTML = `<div class="vide" style="grid-column:1/-1">${etat.total_general ? "Aucune œuvre ne correspond à ce filtre." : "Le catalogue est vide. Ajoutez une première œuvre ou lancez un import."}</div>`;
  } else if (etat.vue === "liste") {
    zone.innerHTML = etat.items.map((o) => `
      <button class="ligne" data-id="${o.id}">
        <span class="coche-sel" aria-hidden="true">${ICONES.valider}</span>
        <img class="fondu" loading="lazy" alt="" src="${esc(urlPhoto(o.vignette_path))}">
        <div class="corps">
          <div class="titre">${o.statut === "vendu" ? `<span class="pastille" role="img" aria-label="Œuvre vendue" title="Œuvre vendue"></span>` : ""}${esc(o.titre)}</div>
          <div class="infos">${esc([o.technique, o.support && o.support.toLowerCase(), dims(o), o.annee].filter(Boolean).join(", ") || "Informations à compléter")}</div>
        </div>
        <div class="droite">${esc(prix(o.prix_eur))}<span class="badge s-${o.statut}">${esc(STATUTS[o.statut] || o.statut)}</span></div>
      </button>`).join("");
  } else {
    zone.innerHTML = etat.items.map((o) => `
      <button class="oeuvre" data-id="${o.id}">
        <span class="coche-sel" aria-hidden="true">${ICONES.valider}</span>
        <div class="cadre"><img class="fondu" loading="lazy" alt="" src="${esc(urlPhoto(o.vignette_path))}"></div>
        <div class="txt">
          <div class="titre">${o.statut === "vendu" ? `<span class="pastille" role="img" aria-label="Œuvre vendue" title="Œuvre vendue"></span>` : ""}${esc(o.titre)}</div>
          <div class="meta"><span>${esc(dims(o) || o.technique || "")}</span><span>${esc(prix(o.prix_eur))}</span></div>
          <span class="badge s-${o.statut}">${esc(STATUTS[o.statut] || o.statut)}</span>
        </div>
      </button>`).join("");
  }
  const reste = etat.total - etat.items.length;
  $("#plus").hidden = reste <= 0;
  $("#plus").textContent = `Afficher plus (${reste} restantes)`;
  $("#resume").textContent = `${etat.total} œuvre${etat.total > 1 ? "s" : ""}${etat.statut || etat.q.trim() ? ` sur ${etat.total_general}` : ""}`;
  majSelection();
}

async function rafraichirListe(avecComptes, pages = 1) {
  const jeton = ++etat.jeton;
  try {
    await Promise.all([chargerPage(true, jeton), avecComptes ? chargerComptes() : null]);
    while (jeton === etat.jeton && etat.page < pages && etat.items.length < etat.total) await chargerPage(false, jeton);
    if (jeton !== etat.jeton) return;
    dessinerPuces(); dessinerGrille(); majLateral();
  } catch (e) { if ($("#grille")) $("#grille").innerHTML = `<div class="message erreur" style="grid-column:1/-1">${msgErreur(e)}</div>`; }
}

function vueListe() {
  etat.selection = null; etat.dernier = null; document.body.classList.remove("sel");
  majLateral("liste:" + etat.statut);
  const retour = etat.retour; etat.retour = null;
  app.innerHTML = `
    <div class="entete">
      <h1>Catalogue des œuvres</h1>
      <div class="actions-entete">
        ${etat.admin ? `<button class="btn icone-seule" id="ventes" aria-label="Suivi des ventes" title="Suivi des ventes">${ICONES.graphique}</button>` : ""}
        ${etat.admin ? `<button class="btn icone-seule" id="admin" aria-label="Administration" title="Administration">${ICONES.reglages}</button>` : ""}
        <button class="btn icone-seule" id="sortir" aria-label="Déconnexion" title="Déconnexion">${ICONES.sortir}</button>
      </div>
      <div class="actions-bureau">
        <button class="btn" data-go="import">Import en lot</button>
        <button class="btn plein" data-go="ajouter">${ICONES.plus}Ajouter une œuvre</button>
      </div>
    </div>
    <input id="q" type="search" enterkeyhint="search" placeholder="Rechercher un titre, une série, une technique…" value="${esc(etat.q)}" aria-label="Rechercher dans le catalogue">
    <div class="puces" id="puces" role="group" aria-label="Filtrer par statut"></div>
    <div class="outils">
      <div class="sous" id="resume" aria-live="polite"></div>
      <div class="outils-droite">
      <select id="tri" class="tri" aria-label="Trier le catalogue" title="Trier le catalogue">${Object.entries(TRIS).map(([c, t]) => `<option value="${c}"${c === etat.tri ? " selected" : ""}>${t[0]}</option>`).join("")}</select>
      <button class="btn discret" id="sel-entrer">Sélectionner</button>
      <div class="segment icones" id="bascule" role="group" aria-label="Mode d'affichage">
        <button data-vue="grille" title="Afficher en vignettes"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg><span class="lib">Vignettes</span></button>
        <button data-vue="liste" title="Afficher en liste"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="4" height="4" rx="1"/><rect x="8" y="4" width="10" height="2" rx="1"/><rect x="2" y="8" width="4" height="4" rx="1"/><rect x="8" y="9" width="10" height="2" rx="1"/><rect x="2" y="13" width="4" height="4" rx="1"/><rect x="8" y="14" width="10" height="2" rx="1"/></svg><span class="lib">Liste</span></button>
      </div></div>
    </div>
    <div class="${etat.vue === "liste" ? "liste" : "grille"}" id="grille" aria-busy="true">${'<div class="squelette"></div>'.repeat(etat.vue === "liste" ? 6 : 8)}</div>
    <p style="text-align:center;margin-top:16px"><button class="btn" id="plus" hidden></button></p>
    <div class="barre-bas mobile"><div class="contenu">
      <button class="btn" data-go="import">Importer</button>
      <button class="btn plein" data-go="ajouter">${ICONES.plus}Ajouter une œuvre</button>
    </div></div>
    <div class="barre-bas" id="barre-selection" hidden><div class="contenu sel">
      <div class="rappel">
        <button class="btn icone-seule" id="sel-quitter" aria-label="Quitter la sélection" title="Quitter la sélection">${ICONES.fermer}</button>
        <strong id="sel-compte" aria-live="polite"></strong>
        <button class="btn danger icone-carree" id="sel-corbeille" aria-label="Mettre à la corbeille" title="Mettre à la corbeille">${ICONES.corbeille}</button>
      </div>
      <div class="actions-lot">
        ${["technique", "support", "nature"].map((c) => `<button class="btn" data-lot="${c}">Modifier ${esc(champSysteme(c).libelle)}</button>`).join("")}
        <button class="btn" data-lot="">Modifier un champ</button>
      </div>
    </div></div>`;
  let minuterie;
  $("#q").addEventListener("input", (e) => { clearTimeout(minuterie); minuterie = setTimeout(() => { etat.q = e.target.value; rafraichirListe(false); }, 300); });
  $("#puces").addEventListener("click", (e) => { const b = e.target.closest(".puce"); if (!b) return; etat.statut = b.dataset.statut; dessinerPuces(); majLateral("liste:" + etat.statut); rafraichirListe(false); });
  $("#grille").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    if (!etat.selection) return vueFiche(b.dataset.id);
    const ids = etat.items.map((o) => o.id), i = ids.indexOf(b.dataset.id);
    if (e.shiftKey && etat.dernier != null && etat.dernier !== i) { // Maj + clic : sélectionne toute la plage
      for (let k = Math.min(i, etat.dernier); k <= Math.max(i, etat.dernier); k++) etat.selection.add(ids[k]);
    } else if (etat.selection.has(b.dataset.id)) etat.selection.delete(b.dataset.id);
    else etat.selection.add(b.dataset.id);
    etat.dernier = i; majSelection();
  });
  $("#sel-entrer").addEventListener("click", () => { etat.selection = new Set(); etat.dernier = null; majSelection(); });
  $("#sel-quitter").addEventListener("click", () => { etat.selection = null; majSelection(); });
  $("#sel-corbeille").addEventListener("click", selectionCorbeille);
  app.querySelectorAll("[data-lot]").forEach((b) => b.addEventListener("click", () => selectionModifier(b.dataset.lot || null)));
  $("#tri").addEventListener("change", (e) => {
    etat.tri = TRIS[e.target.value] ? e.target.value : "ajout-desc";
    try { localStorage.setItem("catalogue-tri", etat.tri); } catch (_) {}
    etat.dernier = null; // l'ordre change : le repère de sélection par plage n'est plus valable
    $("#grille").setAttribute("aria-busy", "true");
    rafraichirListe(false);
  });
  $("#bascule").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-vue]"); if (!b) return;
    etat.vue = b.dataset.vue;
    try { localStorage.setItem("catalogue-vue", etat.vue); } catch (_) {}
    dessinerGrille();
  });
  $("#plus").addEventListener("click", async () => { try { await chargerPage(false); dessinerGrille(); } catch (e) { $("#resume").textContent = "Erreur de chargement : " + (e.message || e); } });
  app.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (b.dataset.go === "import" ? vueImport() : vueFiche(null))));
  if (etat.admin) { $("#admin").addEventListener("click", () => vueAdmin()); $("#ventes").addEventListener("click", () => vueVentes()); }
  $("#sortir").addEventListener("click", () => sb.auth.signOut());
  if (!retour) window.scrollTo(0, 0);
  rafraichirListe(true, retour ? retour.pages : 1).then(() => { if (retour && $("#grille")) window.scrollTo(0, retour.y); });
}
