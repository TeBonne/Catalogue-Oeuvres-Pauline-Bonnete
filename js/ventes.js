"use strict";
/* Suivi des ventes : chiffres clés, graphique, liste filtrable, export CSV. */

/* ---------- Suivi des ventes (administrateur) ---------- */
async function chargerVentes() {
  const ventes = [];
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await sb.from("oeuvres").select("id,titre,nature,technique,vignette_path,prix_eur,prix_vendu_eur,date_vente,port_facture_eur,port_type")
      .eq("statut", "vendu").is("supprime_le", null).order("id").range(debut, debut + 999);
    if (error) throw error;
    ventes.push(...data);
    if (data.length < 1000) break;
  }
  return ventes;
}

async function vueVentes() {
  if (!etat.admin) return vueListe();
  majLateral("ventes");
  window.scrollTo(0, 0);
  app.innerHTML = `${entete("Suivi des ventes")}<p class="sous">Chargement…</p>`;
  $("#retour").addEventListener("click", vueListe);
  let ventes;
  try { ventes = await chargerVentes(); }
  catch (e) {
    app.innerHTML = `${entete("Suivi des ventes")}
      <div class="message erreur" role="alert">Les ventes n'ont pas pu être chargées : ${msgErreur(e)}</div>
      <button class="btn" id="reessayer">Réessayer</button>`;
    $("#retour").addEventListener("click", vueListe);
    $("#reessayer").addEventListener("click", () => vueVentes());
    return;
  }
  const montant = (v) => (v.prix_vendu_eur == null ? null : Number(v.prix_vendu_eur));
  const completes = ventes.filter((v) => montant(v) != null && v.date_vente);
  const incompletes = ventes.length - completes.length;
  const annees = [...new Set(completes.map((v) => +v.date_vente.slice(0, 4)))].sort((a, b) => a - b);
  const cfg = etat.ventes;
  if (!annees.includes(cfg.annee)) cfg.annee = annees[annees.length - 1] ?? new Date().getFullYear();
  const somme = (l) => l.reduce((t, v) => t + montant(v), 0);
  const port = (v) => Number(v.port_facture_eur) || 0;
  const sommePort = (l) => Math.round(l.reduce((t, v) => t + port(v), 0) * 100) / 100;
  const avecPort = sommePort(completes) > 0; // deux séries dans le graphique seulement s'il y a du port à montrer
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  const plafond = (v) => { if (v <= 0) return 100; const p = 10 ** Math.floor(Math.log10(v)); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((x) => x >= v); };

  const valeurs = (col) => [...new Set(ventes.map((v) => v[col]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const VIDE = () => ({ q: "", du: "", au: "", min: null, max: null, nature: "", technique: "", port: "", etat: "" });
  function ligneVente(v) {
    const ecart = montant(v) != null && v.prix_eur != null ? montant(v) - Number(v.prix_eur) : null;
    return `<button class="vente" data-id="${v.id}">
      <img class="fondu" loading="lazy" alt="" src="${esc(urlPhoto(v.vignette_path))}">
      <div class="corps"><div class="titre">${esc(v.titre)}</div>
        <div class="sous">${v.nature ? `${esc(v.nature)}, ` : ""}${v.date_vente ? `<span class="long">${v.nature ? "vendue le " : "Vendue le "}</span>${esc(dateFr(v.date_vente))}` : `<span class="manque">Date à compléter</span>`}</div></div>
      <div class="droite"><div class="montant">${montant(v) != null ? esc(euros(montant(v))) : `<span class="manque">Prix à compléter</span>`}</div>
        <div class="sous">${v.prix_eur != null ? `Affiché ${esc(euros(Number(v.prix_eur)))}` : "Sans prix affiché"}${ecart ? `, soit ${ecart > 0 ? "+" : "−"}${esc(euros(Math.abs(ecart)))}` : ""}</div>
        ${port(v) ? `<div class="sous port-ligne"><i></i>Port ${esc(euros(port(v)))}</div>` : v.port_type === "main_propre" ? `<div class="sous">Remise en main propre</div>` : ""}</div>
    </button>`;
  }
  // Liste des ventes : recherche, panneau de filtres, filtres actifs retirables un à un, tri
  function monterListe(series) {
    const f = cfg.f;
    const remplir = () => {
      $("#v-q").value = f.q; $("#vf-du").value = f.du; $("#vf-au").value = f.au;
      $("#vf-min").value = enSaisie(f.min); $("#vf-max").value = enSaisie(f.max);
      for (const c of ["nature", "technique", "port", "etat"]) { const el = $("#vf-" + c); el.value = f[c]; if (el.value !== f[c]) f[c] = ""; } // valeur disparue des ventes
      $("#vf-erreur").innerHTML = "";
    };
    const actifs = () => {
      const l = [], per = series.find((x) => x.cle === cfg.periode);
      if (per) l.push(["periode", `Période : ${per.nom.replace("Année ", "")}`]);
      if (f.q) l.push(["q", `Titre contenant « ${f.q} »`]);
      if (f.du || f.au) l.push(["dates", `Vendue ${f.du ? `du ${dateFr(f.du)} ` : ""}${f.au ? `${f.du ? "au" : "jusqu'au"} ${dateFr(f.au)}` : ""}`.trim()]);
      if (f.min != null || f.max != null) l.push(["prix", `Prix ${f.min != null ? `de ${euros(f.min)} ` : ""}${f.max != null ? `${f.min != null ? "à" : "jusqu'à"} ${euros(f.max)}` : ""}`.trim()]);
      if (f.nature) l.push(["nature", `Nature : ${f.nature}`]);
      if (f.technique) l.push(["technique", `Technique : ${f.technique}`]);
      if (f.port) l.push(["port", { avec: "Avec port facturé", sans: "Sans port facturé", main: "Remise en main propre" }[f.port]]);
      if (f.etat) l.push(["etat", f.etat === "complete" ? "Fiches complètes" : "Fiches à compléter"]);
      return l;
    };
    const retenue = (v) => {
      const m = montant(v), d = v.date_vente || "";
      if (cfg.periode && !d.startsWith(cfg.periode)) return false;
      if (f.q && !sansAccent(v.titre).includes(sansAccent(f.q))) return false;
      if (f.du && !(d && d >= f.du)) return false;
      if (f.au && !(d && d <= f.au)) return false;
      if (f.min != null && !(m != null && m >= f.min)) return false;
      if (f.max != null && !(m != null && m <= f.max)) return false;
      if (f.nature && v.nature !== f.nature) return false;
      if (f.technique && v.technique !== f.technique) return false;
      if (f.port === "avec" && !port(v)) return false;
      if (f.port === "sans" && port(v)) return false;
      if (f.port === "main" && v.port_type !== "main_propre") return false;
      const complete = m != null && !!v.date_vente;
      if (f.etat === "complete" && !complete) return false;
      if (f.etat === "incomplete" && complete) return false;
      return true;
    };
    const parTitre = (a, b) => a.titre.localeCompare(b.titre, "fr", { numeric: true, sensitivity: "base" });
    const dernier = (x, y) => (x == null) - (y == null); // les valeurs absentes toujours en fin de liste
    const ORDRES = {
      "date-desc": (a, b) => dernier(a.date_vente, b.date_vente) || (b.date_vente || "").localeCompare(a.date_vente || "") || parTitre(a, b),
      "date-asc": (a, b) => dernier(a.date_vente, b.date_vente) || (a.date_vente || "").localeCompare(b.date_vente || "") || parTitre(a, b),
      "prix-desc": (a, b) => dernier(montant(a), montant(b)) || montant(b) - montant(a) || parTitre(a, b),
      "prix-asc": (a, b) => dernier(montant(a), montant(b)) || montant(a) - montant(b) || parTitre(a, b),
      "titre-asc": parTitre
    };
    let affichees = [];
    // Export CSV de la liste telle qu'affichée (filtres et tri compris) : point-virgule, virgule décimale et BOM pour Excel en français
    function exporter() {
      const nb = (x) => (x == null ? "" : String(Math.round(Number(x) * 100) / 100).replace(".", ","));
      const cellule = (x) => { let t = x == null ? "" : String(x); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }; // pas de formule exécutable à l'ouverture
      const lignes = [["Date de vente", "Titre", "Nature", "Technique", "Prix affiché (€)", "Prix de vente (€)", "Frais de port facturés (€)", "Livraison", "Total encaissé (€)", "Fiche de vente"]];
      for (const v of affichees) {
        const m = montant(v);
        lignes.push([v.date_vente ? dateFr(v.date_vente) : "", v.titre, v.nature, v.technique, nb(v.prix_eur), nb(m), port(v) ? nb(port(v)) : "", v.port_type === "main_propre" ? "Remise en main propre" : port(v) ? "Envoi" : "", m == null ? "" : nb(m + port(v)), m != null && v.date_vente ? "Complète" : "À compléter"]);
      }
      const csv = "\ufeff" + lignes.map((l) => l.map((x, i) => ((i >= 4 && i <= 6) || i === 8 ? x : cellule(x))).join(";")).join("\r\n") + "\r\n";
      const lien = document.createElement("a"), adresse = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      lien.href = adresse; lien.download = `ventes-pauline-bonnete-${aujourdhui()}.csv`;
      document.body.append(lien); lien.click(); lien.remove();
      setTimeout(() => URL.revokeObjectURL(adresse), 4000);
      bandeau(`${pluriel(affichees.length, "vente")} exportée${affichees.length > 1 ? "s" : ""} dans le fichier ${lien.download}`);
    }
    function maj() {
      const liste = ventes.filter(retenue).sort(ORDRES[cfg.tri] || ORDRES["date-desc"]), la = actifs();
      const comptees = liste.filter((v) => montant(v) != null && v.date_vente), horsTotal = liste.length - comptees.length, nbPanneau = la.filter(([c]) => c !== "periode" && c !== "q").length;
      affichees = liste; $("#v-export").disabled = !liste.length;
      $("#v-nb").hidden = !nbPanneau; $("#v-nb").textContent = nbPanneau;
      $("#v-actifs").hidden = !la.length;
      $("#v-actifs").innerHTML = la.length ? `<span class="sous">Filtres actifs</span>${la.map(([c, l]) => `<span class="actif">${esc(l)}<button type="button" data-retirer="${c}" aria-label="Retirer le filtre : ${esc(l)}">${ICONES.fermer}</button></span>`).join("")}<button class="btn discret" type="button" id="v-tout">Tout effacer</button>` : "";
      $("#v-resume").textContent = !liste.length ? "" : `${la.length ? `${pluriel(liste.length, "vente")} sur ${ventes.length}` : pluriel(liste.length, "vente")} : ${euros(somme(comptees))} de tableaux${sommePort(comptees) ? ` et ${euros(sommePort(comptees))} de frais de port` : ""}${horsTotal ? `, hors ${pluriel(horsTotal, "vente")} à compléter` : ""}.`;
      $("#liste-ventes").innerHTML = liste.map(ligneVente).join("") || `<div class="vide-filtre"><p>Aucune vente ne correspond ${la.length > 1 ? "à ces filtres" : la.length ? "à ce filtre" : "pour l'instant"}.</p>${la.length ? `<button class="btn" type="button" id="v-tout-2">Effacer les filtres</button>` : ""}</div>`;
    }
    const effacer = (cle) => {
      const avait = !!cfg.periode;
      if (cle === "periode" || cle === "tout") cfg.periode = null;
      if (cle === "tout") Object.assign(f, VIDE());
      else if (cle === "dates") { f.du = ""; f.au = ""; }
      else if (cle === "prix") { f.min = null; f.max = null; }
      else if (cle !== "periode") f[cle] = "";
      if (avait && !cfg.periode) return dessiner(false); // la barre du graphique doit aussi se désélectionner
      remplir(); maj();
    };
    let attente;
    $("#v-q").addEventListener("input", (e) => { clearTimeout(attente); attente = setTimeout(() => { f.q = e.target.value.trim(); maj(); }, 200); });
    $("#v-tri").addEventListener("change", (e) => { cfg.tri = e.target.value; maj(); });
    $("#v-export").addEventListener("click", exporter);
    $("#v-filtres").addEventListener("click", () => { cfg.panneau = !cfg.panneau; $("#v-panneau").hidden = !cfg.panneau; $("#v-filtres").setAttribute("aria-expanded", String(cfg.panneau)); if (cfg.panneau) $("#vf-du").focus(); });
    $("#v-panneau").addEventListener("submit", (e) => {
      e.preventDefault();
      const refus = (m, id) => { $("#vf-erreur").innerHTML = `<div class="message erreur">${m}</div>`; $("#" + id).focus(); };
      const du = lireDate($("#vf-du").value), au = lireDate($("#vf-au").value);
      if ($("#vf-du").validity.badInput || du === null) return refus("La date de début n'est pas valide. Format attendu : JJ/MM/AAAA.", "vf-du");
      if ($("#vf-au").validity.badInput || au === null) return refus("La date de fin n'est pas valide. Format attendu : JJ/MM/AAAA.", "vf-au");
      if (du && au && du > au) return refus("La date de début est postérieure à la date de fin.", "vf-du");
      const min = texte($("#vf-min").value) ? nombre($("#vf-min").value) : null, max = texte($("#vf-max").value) ? nombre($("#vf-max").value) : null;
      if (texte($("#vf-min").value) && (min === null || min < 0)) return refus("Le prix minimum doit être un nombre, par exemple 300.", "vf-min");
      if (texte($("#vf-max").value) && (max === null || max < 0)) return refus("Le prix maximum doit être un nombre, par exemple 600.", "vf-max");
      if (min != null && max != null && min > max) return refus("Le prix minimum est supérieur au prix maximum.", "vf-min");
      Object.assign(f, { du: du || "", au: au || "", min, max, nature: $("#vf-nature").value, technique: $("#vf-technique").value, port: $("#vf-port").value, etat: $("#vf-etat").value });
      cfg.panneau = false; $("#v-panneau").hidden = true; $("#v-filtres").setAttribute("aria-expanded", "false");
      remplir(); maj();
    });
    $("#v-panneau").addEventListener("input", () => { $("#vf-erreur").innerHTML = ""; });
    $("#vf-raz").addEventListener("click", () => { const q = f.q; Object.assign(f, VIDE(), { q }); remplir(); maj(); });
    $("#bloc-liste").addEventListener("click", (e) => {
      const r = e.target.closest("[data-retirer]");
      if (r) return effacer(r.dataset.retirer);
      if (e.target.closest("#v-tout, #v-tout-2")) effacer("tout");
    });
    remplir(); maj();
  }

  // Périodes du graphique (mois de l'année choisie, ou années), avec leurs totaux
  function periodesDuGraphe() {
    const parMois = cfg.grain === "mois";
    const series = parMois
      ? MOIS.map((m, i) => ({ cle: `${cfg.annee}-${String(i + 1).padStart(2, "0")}`, long: m, court: m[0].toUpperCase(), nom: `${MOIS_LONGS[i]} ${cfg.annee}` }))
      : (annees.length ? Array.from({ length: annees[annees.length - 1] - annees[0] + 1 }, (_, i) => annees[0] + i) : [cfg.annee])
          .map((a) => ({ cle: String(a), long: String(a), court: String(a).slice(2), nom: `Année ${a}` }));
    series.forEach((s) => { const l = completes.filter((v) => v.date_vente.startsWith(s.cle)); s.total = somme(l); s.port = sommePort(l); s.n = l.length; });
    if (cfg.periode && !series.some((s) => s.cle === cfg.periode)) cfg.periode = null;
    return { parMois, series };
  }

  // Graphique : changement de période, infobulle, clic sur une barre
  function brancherGraphe(series) {
    $("#grain").addEventListener("click", (e) => { const b = e.target.closest("[data-grain]"); if (!b || b.dataset.grain === cfg.grain) return; cfg.grain = b.dataset.grain; cfg.periode = null; dessiner(); });
    if ($("#annee")) $("#annee").addEventListener("change", (e) => { cfg.annee = +e.target.value; cfg.periode = null; dessiner(); });
    const graphe = $("#graphe"); if (!graphe) return;
    const bulle = $("#infobulle"), zone = graphe.querySelector(".zone");
    const montrer = (col) => {
      const s = series[+col.dataset.i];
      bulle.textContent = "";
      const fort = document.createElement("strong"); fort.textContent = euros(s.total + s.port);
      bulle.append(fort, document.createTextNode(`${s.nom}, ${pluriel(s.n, "vente")}`));
      if (s.port) { const detail = document.createElement("span"); detail.className = "detail"; detail.textContent = `Tableaux ${euros(s.total)}, port ${euros(s.port)}`; bulle.append(detail); }
      bulle.hidden = false;
      const z = zone.getBoundingClientRect(), c = col.getBoundingClientRect(), demi = bulle.offsetWidth / 2;
      bulle.style.left = Math.min(z.width - demi, Math.max(demi, c.left - z.left + c.width / 2)) + "px";
      bulle.style.top = Math.max(bulle.offsetHeight, col.querySelector(".barre").getBoundingClientRect().top - z.top - 6) + "px";
    };
    zone.querySelectorAll(".col").forEach((col) => {
      col.addEventListener("pointerenter", () => montrer(col));
      col.addEventListener("focus", () => montrer(col));
      col.addEventListener("pointerleave", () => { bulle.hidden = true; });
      col.addEventListener("blur", () => { bulle.hidden = true; });
      col.addEventListener("click", () => { const s = series[+col.dataset.i]; cfg.periode = cfg.periode === s.cle ? null : s.cle; dessiner(false); });
    });
  }

  function dessiner(anime = true) {
    const { parMois, series } = periodesDuGraphe();
    const haut = plafond(Math.max(...series.map((s) => s.total + s.port)));
    const duGraphe = parMois ? completes.filter((v) => v.date_vente.startsWith(String(cfg.annee))) : completes;

    app.innerHTML = `
      ${entete("Suivi des ventes")}
      ${!ventes.length ? `<div class="carte vide">Aucune vente enregistrée pour l'instant.<br>Passez une œuvre au statut « Vendu » pour la voir apparaître ici.</div>` : `
      <div class="tuiles quatre">
        <div class="tuile"><div class="v">${esc(euros(somme(completes)))}</div><div class="l">Total des ventes, hors port</div></div>
        <div class="tuile"><div class="v">${esc(euros(sommePort(completes)))}</div><div class="l">Frais de port facturés</div></div>
        <div class="tuile"><div class="v">${ventes.length}</div><div class="l">${ventes.length > 1 ? "Œuvres vendues" : "Œuvre vendue"}</div></div>
        <div class="tuile"><div class="v">${completes.length ? esc(euros(Math.round(somme(completes) / completes.length))) : "—"}</div><div class="l">Prix de vente moyen</div></div>
      </div>
      ${incompletes ? `<div class="message info" role="status"><strong>${pluriel(incompletes, "vente")} à compléter.</strong> Sans prix de vente ou sans date, ${incompletes > 1 ? "elles ne sont pas comptées" : "elle n'est pas comptée"} dans le total ni dans le graphique. ${incompletes > 1 ? "Elles sont signalées" : "Elle est signalée"} dans la liste ci-dessous.</div>` : ""}
      <section class="carte bloc">
        <div class="commandes">
          <h2 style="margin:0">${parMois ? `Ventes par mois en ${cfg.annee}` : "Ventes par année"}</h2>
          <div style="display:flex;gap:8px;align-items:center">
            ${parMois && annees.length > 1 ? `<select id="annee" aria-label="Année affichée">${annees.map((a) => `<option ${a === cfg.annee ? "selected" : ""}>${a}</option>`).join("")}</select>` : ""}
            <div class="segment" id="grain" role="group" aria-label="Granularité du graphique">
              <button data-grain="mois" aria-pressed="${parMois}">Mois</button>
              <button data-grain="annee" aria-pressed="${!parMois}">Année</button>
            </div>
          </div>
        </div>
        ${!completes.length ? `<p class="sous">Aucune vente complète à représenter : renseignez le prix de vente et la date des œuvres vendues.</p>` : `
        <p class="sous" style="margin:0 0 ${avecPort ? 10 : 18}px">${sommePort(duGraphe)
          ? `${esc(euros(somme(duGraphe)))} de tableaux et ${esc(euros(sommePort(duGraphe)))} de frais de port, soit ${esc(euros(somme(duGraphe) + sommePort(duGraphe)))} encaissés`
          : esc(euros(somme(duGraphe)))} pour ${pluriel(duGraphe.length, "vente")}${parMois ? ` en ${cfg.annee}` : ""}. Touchez une barre pour filtrer la liste.</p>
        ${avecPort ? `<div class="legende"><span><i class="tab"></i>Tableaux</span><span><i class="port"></i>Frais de port</span></div>` : ""}
        <div class="graphe ${cfg.periode ? "filtre" : ""} ${anime ? "anime" : ""}" id="graphe">
          <div class="ordonnees" aria-hidden="true"><span>${esc(euros(haut))}</span><span>${esc(euros(haut / 2))}</span><span>0 €</span></div>
          <div class="zone">
            <div class="trait" style="top:0"></div><div class="trait" style="top:50%"></div>
            ${series.map((s, i) => `<button class="col" data-i="${i}" style="--i:${i}" aria-pressed="${s.cle === cfg.periode}" aria-label="${esc(`${s.nom} : ${euros(s.total)} de tableaux${s.port ? ` et ${euros(s.port)} de frais de port` : ""}, ${pluriel(s.n, "vente")}`)}"><span class="barre" style="height:${s.total + s.port ? Math.max(1.5, ((s.total + s.port) / haut) * 100) : 0}%">${s.port ? `<i class="seg port" style="flex-grow:${s.port}"></i>` : ""}${s.total ? `<i class="seg tab" style="flex-grow:${s.total}"></i>` : ""}</span></button>`).join("")}
            <div class="infobulle" id="infobulle" hidden></div>
          </div>
          <div class="abscisses" aria-hidden="true">${series.map((s) => `<span><span class="long">${esc(s.long)}</span><span class="court">${esc(s.court)}</span></span>`).join("")}</div>
        </div>`}
      </section>
      <section class="carte bloc" style="padding:8px" id="bloc-liste">
        <div class="commandes" style="padding:10px 10px 0;margin-bottom:10px">
          <h2 style="margin:0">Liste des ventes</h2>
          <button class="btn" id="v-export" style="min-height:40px" title="Télécharger la liste affichée au format CSV (Excel, Numbers, LibreOffice)">${ICONES.telecharger}Exporter</button>
        </div>
        <div class="outils-ventes">
          <input id="v-q" type="search" enterkeyhint="search" placeholder="Rechercher un titre…" aria-label="Rechercher une vente par titre" value="${esc(cfg.f.q)}">
          <button class="btn" id="v-filtres" aria-expanded="${cfg.panneau}" aria-controls="v-panneau">${ICONES.filtres}Filtres<span class="compteur-filtres" id="v-nb" hidden></span></button>
          <select id="v-tri" class="tri" aria-label="Trier la liste des ventes">${Object.entries(TRIS_VENTES).map(([c, l]) => `<option value="${c}" ${c === cfg.tri ? "selected" : ""}>${l}</option>`).join("")}</select>
        </div>
        <form class="panneau-filtres" id="v-panneau" ${cfg.panneau ? "" : "hidden"} novalidate>
          <div class="grille-filtres">
            <div><label for="vf-du">Vendue du</label><input id="vf-du" type="date"></div>
            <div><label for="vf-au">au</label><input id="vf-au" type="date"></div>
            <div><label for="vf-min">Prix de vente, de (€)</label><input id="vf-min" inputmode="decimal" autocomplete="off"></div>
            <div><label for="vf-max">à (€)</label><input id="vf-max" inputmode="decimal" autocomplete="off"></div>
            <div><label for="vf-nature">Nature</label><select id="vf-nature"><option value="">Toutes</option>${valeurs("nature").map((x) => `<option>${esc(x)}</option>`).join("")}</select></div>
            <div><label for="vf-technique">Technique</label><select id="vf-technique"><option value="">Toutes</option>${valeurs("technique").map((x) => `<option>${esc(x)}</option>`).join("")}</select></div>
            <div><label for="vf-port">Livraison</label><select id="vf-port"><option value="">Indifférent</option><option value="avec">Avec port</option><option value="sans">Sans port</option><option value="main">Main propre</option></select></div>
            <div><label for="vf-etat">Fiche de vente</label><select id="vf-etat"><option value="">Toutes</option><option value="complete">Complètes</option><option value="incomplete">À compléter</option></select></div>
          </div>
          <div id="vf-erreur" role="alert"></div>
          <div class="actions-filtres">
            <button class="btn" type="button" id="vf-raz">Réinitialiser</button>
            <button class="btn plein" type="submit">Appliquer</button>
          </div>
        </form>
        <div class="actifs" id="v-actifs" hidden></div>
        <p class="sous" id="v-resume" aria-live="polite" style="padding:0 10px;margin:10px 0 6px"></p>
        <div id="liste-ventes"></div>
      </section>`}`;

    $("#retour").addEventListener("click", vueListe);
    if (!ventes.length) return;
    monterListe(series);
    $("#liste-ventes").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) vueFiche(b.dataset.id, "ventes"); });
    brancherGraphe(series);
  }
  dessiner();
}
