"use strict";
/* Fiche d'une œuvre : ajout, modification, vente, photo, suppression. */

/* ---------- Fiche (ajout / modification) ---------- */
async function suggestions() {
  const listes = { serie: new Set() };
  const { data } = await sb.from("oeuvres").select("serie").not("serie", "is", null).is("supprime_le", null).limit(1000);
  (data || []).forEach((o) => Object.keys(listes).forEach((c) => { if (o[c]) listes[c].add(o[c]); }));
  return listes;
}

async function vueFiche(id, origine) {
  const revenir = () => (origine === "ventes" ? vueVentes() : vueListe());
  etat.retour = id && $("#grille") ? { y: window.scrollY, pages: etat.page } : null;
  etat.gardien = null; etat.modifie = false; etat.section = "fiche"; arriver();
  app.innerHTML = `<p class="sous">Chargement…</p>`;
  window.scrollTo(0, 0);
  let o = { titre: "", statut: "" };
  if (id) {
    const { data, error } = await sb.from("oeuvres").select("*").eq("id", id).single();
    if (error) { app.innerHTML = `<div class="message erreur">${msgErreur(error)}</div><button class="btn" id="retour">Retour</button>`; $("#retour").onclick = vueListe; return; }
    o = data;
  }
  let acheteurs = [];
  if (etat.admin) { try { acheteurs = await chargerAcheteurs(); } catch (_) {} }
  const listes = await suggestions();
  try { await chargerChamps(); } catch (_) {}
  const perso = o.champs_perso || {};
  const champPerso = (c) => {
    const v = perso[c.id], idc = "cp-" + c.id;
    const lab = `<label for="${idc}">${esc(c.libelle)}</label>`;
    if (c.type === "liste") {
      const vals = v && !c.options.includes(v) ? [...c.options, v] : c.options;
      return `${lab}<select id="${idc}"><option value="">Choisir…</option>${vals.map((x) => `<option value="${esc(x)}" ${v === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
    }
    if (c.type === "case") return `<label class="coche" for="${idc}" style="margin-top:14px"><input id="${idc}" type="checkbox" ${v === true ? "checked" : ""}> ${esc(c.libelle)}</label>`;
    if (c.type === "nombre") return `${lab}<input id="${idc}" inputmode="decimal" value="${esc(v == null ? "" : String(v).replace(".", ","))}">`;
    return `${lab}<input id="${idc}" value="${esc(v)}" autocomplete="off">`;
  };
  const champListe = (cle, lib) => `
    <div><label for="${cle}">${lib}</label>
    <input id="${cle}" list="l-${cle}" value="${esc(o[cle])}" autocomplete="off">
    <datalist id="l-${cle}">${[...listes[cle]].sort((a, b) => a.localeCompare(b, "fr")).map((v) => `<option value="${esc(v)}">`).join("")}</datalist></div>`;
  const champChoix = (cle) => {
    const c = champSysteme(cle);
    const valeurs = o[cle] && !c.options.includes(o[cle]) ? [...c.options, o[cle]] : c.options;
    return `
    <div><label for="${cle}">${esc(c.libelle)}</label>
    <select id="${cle}">
      <option value="" ${o[cle] ? "" : "selected"}>Choisir…</option>
      ${valeurs.map((v) => `<option value="${esc(v)}" ${o[cle] === v ? "selected" : ""}>${esc(v)}</option>`).join("")}
    </select></div>`;
  };
  const req = `<span class="req" aria-hidden="true">*</span>`;
  const perso_html = champsPerso().map(champPerso).join("");
  app.innerHTML = `
    ${entete(id ? "Modifier l'œuvre" : "Nouvelle œuvre")}
    <form id="f" class="fiche" novalidate>
      <div class="carte colonne-photo">
        ${id ? `<a href="${esc(urlPhoto(o.photo_path))}" target="_blank" rel="noopener" title="Ouvrir la photo en grand"><img class="apercu" id="apercu" alt="Photo de l'œuvre" src="${esc(urlPhoto(o.photo_path))}"></a>`
             : `<img class="apercu" id="apercu" alt="Aperçu de la photo choisie" hidden>`}
        <label class="zone-photo" for="photo" id="zone" style="margin-top:${id ? "12px" : "0"};min-height:${id ? "56px" : "160px"}">${id ? "Remplacer la photo" : `<span>Toucher ici pour prendre ou choisir une photo&nbsp;${req}</span>`}</label>
        <input class="cache" id="photo" type="file" accept="image/*">
        <button class="btn large" type="button" id="recadrer" style="margin-top:10px" ${id ? "" : "hidden"}>${ICONES.recadrer}Recadrer la photo</button>
        <p class="aide" id="aide-recadrage" hidden>Recadrage appliqué. Enregistrez la fiche pour le conserver.</p>
        ${id && etat.admin ? `<button class="btn discret" type="button" id="en-accueil" style="margin:6px 0 0 -14px">Afficher sur l'écran de connexion</button>` : ""}
        ${id ? `<p class="aide">${[
          o.poids_photo_octets != null ? `Photo en ligne : ${poids(o.poids_photo_octets)}` : "",
          o.fichier_origine ? `Fichier d'origine : ${esc(o.fichier_origine)}${o.poids_origine_octets != null ? ` (${poids(o.poids_origine_octets)})` : ""}` : ""
        ].filter(Boolean).join("<br>")}</p>` : ""}
      </div>
      <div class="carte">
        <p class="aide" style="margin:0">Les champs marqués ${req} sont obligatoires.</p>
        <h2 class="section premiere">Identification</h2>
        <label for="titre">Titre</label>
        <input id="titre" value="${esc(o.titre === "Sans titre" ? "" : o.titre)}" placeholder="Sans titre" autocomplete="off" enterkeyhint="next">
        <label for="statut">Statut ${req}</label>
        <select id="statut" required aria-required="true">
          <option value="" ${o.statut ? "" : "selected"} disabled>Choisir…</option>
          ${Object.entries(STATUTS).map(([c, l]) => `<option value="${c}" ${o.statut === c ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <div class="bloc-vente" id="bloc-vente" ${o.statut === "vendu" ? "" : "hidden"}>
          <div class="deux">
            <div><label for="prix_vendu">Vendu au prix de (€)</label>
              <input id="prix_vendu" inputmode="decimal" autocomplete="off" value="${esc(String(o.prix_vendu_eur ?? "").replace(".", ","))}"></div>
            <div><label for="date_vente">Date de la vente</label>
              <input id="date_vente" type="date" max="${aujourdhui()}" value="${esc(o.date_vente)}"></div>
          </div>
          <p class="aide">Le prix réellement encaissé peut différer du prix affiché. Ces deux informations alimentent le suivi des ventes.</p>
          <label for="port_facture">Frais de port facturés (€)</label>
          <input id="port_facture" class="champ-court" inputmode="decimal" autocomplete="off" value="${esc(enSaisie(o.port_facture_eur))}" aria-describedby="port-aide">
          <p class="aide" id="port-aide">Facturés à l'acheteur en plus du prix. Le montant reprend le tarif choisi dans « Frais de port », reste modifiable et ne changera plus si les tarifs évoluent. Laissez vide pour une remise en main propre.</p>
          ${etat.admin ? `
          <label for="acheteur">Acheteur</label>
          <select id="acheteur" aria-describedby="acheteur-aide">
            <option value="">Non renseigné</option>
            ${acheteurs.map((a) => `<option value="${a.id}" ${o.acheteur_id === a.id ? "selected" : ""}>${esc(nomAcheteur(a))}${a.email && (a.prenom || a.nom) ? ` (${esc(a.email)})` : ""}</option>`).join("")}
            <option value="__nouveau">Nouvel acheteur…</option>
          </select>
          <div id="acheteur-nouveau" hidden>
            <div class="deux" style="margin-top:12px">
              <div><label for="na-prenom">Prénom</label><input id="na-prenom" autocomplete="off"></div>
              <div><label for="na-nom">Nom</label><input id="na-nom" autocomplete="off"></div>
            </div>
            <label for="na-email">E-mail</label>
            <input id="na-email" type="email" inputmode="email" autocapitalize="none" spellcheck="false" autocomplete="off">
          </div>
          <p class="aide" id="acheteur-aide">Visible des administrateurs uniquement. Le fichier complet se trouve dans la rubrique « Acheteurs ».</p>` : ""}
        </div>

        <h2 class="section">Caractéristiques</h2>
        <div class="deux">${champChoix("technique")}${champChoix("support")}</div>
        <div class="deux">${champChoix("nature")}${champListe("serie", "Série ou thème")}</div>
        <div class="deux">
          <div><label for="hauteur">Hauteur (cm)</label><input id="hauteur" inputmode="decimal" autocomplete="off" value="${esc(String(o.hauteur_cm ?? "").replace(".", ","))}"></div>
          <div><label for="largeur">Largeur (cm)</label><input id="largeur" inputmode="decimal" autocomplete="off" value="${esc(String(o.largeur_cm ?? "").replace(".", ","))}"></div>
        </div>
        <div class="deux">
          <div><label for="annee">Année</label><input id="annee" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(o.annee)}"></div>
          <div><label for="encadre">Encadrement</label>
            <select id="encadre">
              <option value="" ${o.encadre == null ? "selected" : ""}>Non renseigné</option>
              <option value="oui" ${o.encadre === true ? "selected" : ""}>Encadré</option>
              <option value="non" ${o.encadre === false ? "selected" : ""}>Non encadré</option>
            </select></div>
        </div>

        <label for="emplacement_signature">Emplacement de la signature</label>
        <input id="emplacement_signature" list="l-emplacement-fiche" autocomplete="off" value="${esc(o.emplacement_signature)}" placeholder="Par exemple : en bas à gauche">
        <datalist id="l-emplacement-fiche">${EMPLACEMENTS.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>

        <h2 class="section">Vente</h2>
        <label for="prix">Prix (€)</label>
        <input id="prix" class="champ-court" inputmode="decimal" autocomplete="off" value="${esc(String(o.prix_eur ?? "").replace(".", ","))}">
        <label class="coche" for="prix_masque"><input id="prix_masque" type="checkbox" ${o.prix_masque ? "checked" : ""}> Ne pas afficher le prix sur le site web</label>
        <label for="port_type">Frais de port</label>
        <select id="port_type" class="champ-court" aria-describedby="port-type-aide">
          <option value="">Non défini</option>
          ${etat.tarifs.map((t) => `<option value="${t.cle}" ${o.port_type === t.cle ? "selected" : ""}>${esc(t.libelle)}${t.montant_eur ? ` (${esc(euros(t.montant_eur))})` : ""}</option>`).join("")}
        </select>
        <p class="aide" id="port-type-aide">Taille du colis à prévoir. ${etat.admin ? "Les tarifs se règlent dans Administration." : "Les tarifs sont réglés par l'administrateur."}</p>

        ${perso_html ? `<h2 class="section">Informations complémentaires</h2>${perso_html}` : ""}

        <h2 class="section">Description</h2>
        <textarea id="description" style="min-height:120px;margin-top:12px" aria-label="Description" aria-describedby="description-aide">${esc(o.description)}</textarea>
        <p class="aide" id="description-aide">Ce texte sera publié sur le site web, à côté de l'œuvre.</p>

        <h2 class="section">Suivi interne</h2>
        <label for="notes">Notes privées</label>
        <textarea id="notes" aria-describedby="notes-aide">${esc(o.notes_privees)}</textarea>
        <p class="aide" id="notes-aide">Acheteur, date de vente… Ces notes ne sont jamais publiées.</p>

      </div>
    </form>
    <div class="barre-bas">
      <div id="alerte" role="alert"></div>
      <div class="contenu fin">
        ${id && etat.admin ? `<button class="btn plein vert outil" type="button" id="certificat" aria-label="Générer le certificat d'authenticité" title="Générer le certificat d'authenticité">${ICONES.document}<span class="long">Générer le certificat d'authenticité</span></button>` : ""}
        ${id ? `<button class="btn danger outil" type="button" id="supprimer" aria-label="Supprimer" title="Supprimer">${ICONES.corbeille}<span class="long">Supprimer</span></button>` : ""}
        <span class="espace"></span>
        <button class="btn" type="button" id="annuler">Annuler</button>
        <button class="btn plein" type="submit" form="f" id="valider">Enregistrer</button>
      </div>
    </div>`;
  document.body.classList.add("barre-visible");
  let fichier = null, choisi = null; // choisi : fichier choisi par l'utilisateur (nom et poids), distinct d'un simple recadrage
  const marquer = () => { etat.modifie = true; };
  $("#f").addEventListener("input", (e) => { marquer(); e.target.removeAttribute("aria-invalid"); });
  $("#f").addEventListener("change", marquer);
  etat.gardien = async () => !etat.modifie || confirmer({
    titre: "Quitter sans enregistrer ?", corps: "Les modifications apportées à cette fiche seront perdues.",
    action: "Quitter sans enregistrer", annuler: "Continuer la saisie", delai: 0
  });
  const quitter = async () => { if (await etat.gardien()) revenir(); };
  $("#statut").addEventListener("change", (e) => {
    const vendu = e.target.value === "vendu";
    $("#bloc-vente").hidden = !vendu;
    if (vendu && !texte($("#prix_vendu").value)) $("#prix_vendu").value = $("#prix").value; // proposé par défaut : le prix affiché
    if (vendu) proposerPort();
  });
  // Frais de port : le montant facturé suit le tarif choisi tant qu'il n'a pas été saisi à la main
  let portSaisi = o.port_facture_eur != null;
  function proposerPort() {
    if (portSaisi) return;
    const t = etat.tarifs.find((x) => x.cle === $("#port_type").value);
    $("#port_facture").value = t && t.montant_eur ? enSaisie(t.montant_eur) : "";
  }
  $("#port_facture").addEventListener("input", (e) => { portSaisi = texte(e.target.value) !== null; });
  $("#port_type").addEventListener("change", proposerPort);
  if ($("#acheteur")) $("#acheteur").addEventListener("change", (e) => { const neuf = e.target.value === "__nouveau"; $("#acheteur-nouveau").hidden = !neuf; if (neuf) $("#na-prenom").focus(); });
  $("#retour").addEventListener("click", quitter);
  $("#annuler").addEventListener("click", quitter);
  $("#photo").addEventListener("change", (e) => {
    fichier = e.target.files[0] || null; if (!fichier) return;
    choisi = { nom: fichier.name, poids: fichier.size };
    const img = $("#apercu"); img.src = URL.createObjectURL(fichier); img.hidden = false;
    $("#zone").textContent = "Changer de photo"; $("#zone").style.minHeight = "56px"; $("#zone").style.marginTop = "12px";
    $("#zone").removeAttribute("aria-invalid");
    $("#recadrer").hidden = false; $("#aide-recadrage").hidden = true;
  });
  if (id && etat.admin) $("#en-accueil").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    const accord = await confirmer({
      titre: "Afficher cette œuvre sur l'écran de connexion ?",
      corps: "Elle remplacera l'image actuelle. Cet écran est visible sans compte : choisissez une photo recadrée, sans élément étranger à l'œuvre.",
      action: "Afficher cette œuvre", delai: 0, ton: "neutre", vignette: $("#apercu").src
    });
    if (!accord) return;
    b.disabled = true;
    try {
      let source = fichier;
      if (!source) { const rep = await fetch(urlPhoto(o.photo_path)); if (!rep.ok) throw new Error("La photo enregistrée n'a pas pu être lue."); source = await rep.blob(); }
      const { grand } = await preparerPhoto(new File([source], "accueil.jpg", { type: source.type || "image/jpeg" }));
      const { error } = await sb.storage.from(BUCKET).upload(ACCUEIL_CHOISIE, grand, { contentType: "image/jpeg", cacheControl: "60", upsert: true });
      if (error) throw error;
      bandeau("Cette œuvre s'affichera sur l'écran de connexion d'ici quelques minutes.");
    } catch (err) { alerte(msgErreur(err)); }
    b.disabled = false;
  });
  $("#recadrer").addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      let source = fichier;
      if (!source) { // photo déjà enregistrée : on la relit pour la recadrer
        const rep = await fetch(urlPhoto(o.photo_path));
        if (!rep.ok) throw new Error("La photo enregistrée n'a pas pu être lue.");
        source = await rep.blob();
      }
      const blob = await recadrerPhoto(source);
      if (blob) {
        fichier = new File([blob], (choisi ? choisi.nom : o.fichier_origine) || "photo.jpg", { type: "image/jpeg" });
        const img = $("#apercu"); img.src = URL.createObjectURL(fichier); img.hidden = false;
        $("#aide-recadrage").hidden = false; marquer();
      }
    } catch (err) { alerte(msgErreur(err)); }
    b.disabled = false;
  });
  const alerte = (m, champ) => {
    $("#alerte").innerHTML = m ? `<div class="message erreur">${m}</div>` : "";
    app.querySelectorAll("#f [aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const el = m && champ && document.getElementById(champ);
    if (el) { el.setAttribute("aria-invalid", "true"); el.scrollIntoView({ block: "center" }); if (el.focus) el.focus({ preventScroll: true }); }
  };

  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!id && !fichier) return alerte("Ajoutez une photo de l'œuvre.", "zone");
    if (!$("#statut").value) return alerte("Choisissez un statut.", "statut");
    const h = nombre($("#hauteur").value), l = nombre($("#largeur").value), a = nombre($("#annee").value), p = nombre($("#prix").value);
    if ((texte($("#hauteur").value) && !(h > 0)) || (texte($("#largeur").value) && !(l > 0))) return alerte("Les dimensions doivent être des nombres positifs.", texte($("#hauteur").value) && !(h > 0) ? "hauteur" : "largeur");
    if (texte($("#annee").value) && !(Number.isInteger(a) && a >= 1900 && a <= 2100)) return alerte("L'année doit comporter quatre chiffres, par exemple 2024.", "annee");
    if (texte($("#prix").value) && (p === null || p < 0)) return alerte("Le prix doit être un nombre, par exemple 450.", "prix");
    const vendu = $("#statut").value === "vendu";
    const pv = vendu ? nombre($("#prix_vendu").value) : null;
    const dv = vendu ? lireDate($("#date_vente").value) : "";
    if (vendu && texte($("#prix_vendu").value) && (pv === null || pv < 0)) return alerte("Le prix de vente doit être un nombre, par exemple 450.", "prix_vendu");
    if (vendu && ($("#date_vente").validity.badInput || dv === null)) return alerte("La date de la vente n'est pas valide. Format attendu : JJ/MM/AAAA.", "date_vente");
    if (vendu && dv && dv > aujourdhui()) return alerte("La date de la vente ne peut pas être dans le futur.", "date_vente");
    const pf = vendu ? nombre($("#port_facture").value) : null;
    if (vendu && texte($("#port_facture").value) && (pf === null || pf < 0)) return alerte("Les frais de port doivent être un nombre, par exemple 25.", "port_facture");
    let acheteurId = vendu ? (o.acheteur_id ?? null) : null, nouvelAcheteur = null;
    if (vendu && $("#acheteur")) {
      const choix = $("#acheteur").value;
      if (choix === "__nouveau") {
        nouvelAcheteur = { prenom: texte($("#na-prenom").value), nom: texte($("#na-nom").value), email: texte($("#na-email").value) ? texte($("#na-email").value).toLowerCase() : null };
        if (!nouvelAcheteur.prenom && !nouvelAcheteur.nom && !nouvelAcheteur.email) return alerte("Renseignez au moins un prénom, un nom ou un e-mail pour le nouvel acheteur.", "na-prenom");
        if (nouvelAcheteur.email && !emailValide(nouvelAcheteur.email)) return alerte("L'adresse e-mail de l'acheteur n'est pas valide.", "na-email");
      } else acheteurId = choix || null;
    }
    const cp = { ...(o.champs_perso || {}) };
    for (const c of champsPerso()) {
      const el = document.getElementById("cp-" + c.id); if (!el) continue;
      const v = c.type === "case" ? el.checked : c.type === "nombre" ? nombre(el.value) : texte(el.value);
      if (c.type === "nombre" && texte(el.value) && v === null) return alerte(`« ${esc(c.libelle)} » doit être un nombre.`, "cp-" + c.id);
      if (v === null || v === false) delete cp[c.id]; else cp[c.id] = v;
    }
    const valeurs = {
      titre: texte($("#titre").value) || "Sans titre", statut: $("#statut").value,
      prix_vendu_eur: pv, date_vente: dv || null,
      port_type: $("#port_type").value || null, port_facture_eur: pf, acheteur_id: acheteurId,
      technique: texte($("#technique").value), support: texte($("#support").value),
      nature: texte($("#nature").value), serie: texte($("#serie").value),
      hauteur_cm: h, largeur_cm: l, annee: a, prix_eur: p, prix_masque: $("#prix_masque").checked,
      encadre: $("#encadre").value === "" ? null : $("#encadre").value === "oui",
      description: texte($("#description").value), emplacement_signature: texte($("#emplacement_signature").value),
      notes_privees: texte($("#notes").value), champs_perso: cp
    };
    const bouton = $("#valider"); bouton.disabled = true; bouton.setAttribute("aria-busy", "true"); bouton.textContent = "Enregistrement…"; alerte("");
    try {
      const oid = id || crypto.randomUUID();
      if (nouvelAcheteur) { // créé d'abord, pour rattacher la vente à son identifiant
        const cree = await sb.from("acheteurs").insert(nouvelAcheteur).select("id");
        if (cree.error || !cree.data.length) throw cree.error || new Error("L'acheteur n'a pas pu être créé : droits insuffisants.");
        valeurs.acheteur_id = cree.data[0].id;
      }
      const chemins = fichier ? await envoyerPhoto(oid, fichier) : {};
      if (fichier && choisi) { chemins.fichier_origine = choisi.nom; chemins.poids_origine_octets = choisi.poids; }
      else delete chemins.poids_origine_octets; // simple recadrage : le fichier d'origine reste le même
      const req = id
        ? sb.from("oeuvres").update({ ...valeurs, ...chemins }).eq("id", id)
        : sb.from("oeuvres").insert({ id: oid, ...valeurs, ...chemins });
      const { error } = await req;
      if (error) throw error;
      if (id && fichier) await sb.storage.from(BUCKET).remove([o.photo_path, o.vignette_path]);
      etat.modifie = false;
      revenir();
      bandeau(id ? "Modifications enregistrées" : "Œuvre ajoutée au catalogue");
    } catch (err) { bouton.disabled = false; bouton.removeAttribute("aria-busy"); bouton.textContent = "Enregistrer"; alerte(msgErreur(err)); }
  });

  if (id) {
    if (etat.admin) $("#certificat").addEventListener("click", () => {
      if (etat.modifie) return bandeau("Enregistrez d'abord vos modifications : le certificat reprend la fiche enregistrée.");
      vueCertificatNouveau(id);
    });
    const b = $("#supprimer");
    b.addEventListener("click", async () => {
      const accord = await confirmer({
        titre: "Supprimer cette œuvre ?",
        corps: `« ${o.titre} » sera retirée du catalogue et placée dans la corbeille. Un administrateur pourra la restaurer.`,
        vignette: urlPhoto(o.vignette_path), action: "Mettre à la corbeille"
      });
      if (!accord) return;
      b.disabled = true;
      const { data, error } = await sb.from("oeuvres").update({ supprime_le: new Date().toISOString() }).eq("id", id).select("id");
      if (error || !data.length) { b.disabled = false; return alerte(error ? msgErreur(error) : "Suppression refusée."); }
      etat.modifie = false; etat.retour = null;
      vueListe();
      bandeau("Œuvre placée dans la corbeille", "Annuler", async () => {
        await sb.from("oeuvres").update({ supprime_le: null }).eq("id", id);
        vueListe();
      });
    });
  }
}
