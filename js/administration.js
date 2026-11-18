"use strict";
/* Administration : champs des fiches, listes de choix, tarifs de frais de port. */

/* ---------- Espace administrateur ---------- */
async function vueAdmin(message = "", type = "info") {
  if (!etat.admin) return vueListe();
  majLateral("admin");
  window.scrollTo(0, 0);
  app.innerHTML = `<p class="sous">Chargement…</p>`;
  try { await chargerChamps(); await chargerTarifs(); } catch (e) { message = msgErreur(e); type = "erreur"; }
  const { count: enCorbeille } = await sb.from("oeuvres").select("id", { count: "exact", head: true }).not("supprime_le", "is", null);
  const carte = (c) => `
    <details class="carte bloc champ" data-champ="${c.id}" ${etat.adminOuvert === c.id ? "open" : ""}>
      <summary><span class="nom">${esc(c.libelle)}</span><span class="sous">${TYPES[c.type]}${c.type === "liste" ? `, ${c.options.length} choix` : ""}</span></summary>
      <label for="lib-${c.id}">Libellé du champ</label>
      <div class="rang"><input id="lib-${c.id}" value="${esc(c.libelle)}" autocomplete="off"><button class="btn" data-action="libelle">Enregistrer</button></div>
      ${c.type === "liste" ? `
        <label>Choix proposés</label>
        ${c.options.map((v, i) => `
          <div class="rang option"><input data-option="${i}" data-initial="${esc(v)}" value="${esc(v)}" aria-label="Choix ${i + 1}" autocomplete="off">
          <button class="btn icone-carree" data-action="renommer" data-i="${i}" aria-label="Enregistrer le nouveau nom" title="Enregistrer le nouveau nom" disabled>${ICONES.valider}</button>
          <button class="btn danger icone-carree" data-action="retirer" data-i="${i}" aria-label="Retirer le choix ${esc(v)}" title="Retirer ce choix">${ICONES.corbeille}</button></div>`).join("") || `<p class="sous">Aucun choix pour l'instant.</p>`}
        <p class="aide">Modifiez un nom puis validez avec la coche : les œuvres concernées sont mises à jour.</p>
        <div class="rang"><input data-nouveau placeholder="Nouveau choix" aria-label="Nouveau choix" autocomplete="off"><button class="btn" data-action="ajouter">Ajouter</button></div>` : ""}
      ${c.systeme ? "" : `<div class="zone-danger"><button class="btn danger" data-action="supprimer">Supprimer ce champ</button></div>`}
    </details>`;
  app.innerHTML = `
    <div id="adm" class="etroit">
      ${entete("Administration")}
      <p class="sous">Champs et listes de choix des fiches. Les modifications s'appliquent à toutes les œuvres.</p>
      <div id="alerte">${message ? `<div class="message ${type}">${message}</div>` : ""}</div>
      <button class="btn discret" id="revoir-tuto" style="margin:0 0 12px -14px">${ICONES.aide}Revoir le tutoriel de prise en main</button>
      <section class="carte bloc">
        <h2>Corbeille</h2>
        <p class="sous">${enCorbeille ? `${enCorbeille} œuvre${enCorbeille > 1 ? "s" : ""} supprimée${enCorbeille > 1 ? "s" : ""}, à restaurer ou à effacer définitivement.` : "Aucune œuvre dans la corbeille."}</p>
        <button class="btn large" id="corbeille">Ouvrir la corbeille</button>
      </section>
      <section class="carte bloc" id="tarifs-port">
        <h2>Frais de port</h2>
        <p class="sous">Quatre tarifs, facturés à l'acheteur en plus du prix de l'œuvre. Le tarif se choisit dans la fiche de chaque œuvre. Modifier un montant ici ne change pas les ventes déjà enregistrées.</p>
        ${etat.tarifs.length ? `
        <div class="tarifs">
          <span class="lib" id="tp-col-lib">Libellé</span><span class="lib" id="tp-col-montant">Montant (€)</span>
          ${etat.tarifs.map((t) => `
            <input data-tarif="${t.cle}" data-quoi="libelle" value="${esc(t.libelle)}" maxlength="40" autocomplete="off" aria-labelledby="tp-col-lib">
            <input data-tarif="${t.cle}" data-quoi="montant" value="${esc(enSaisie(t.montant_eur))}" inputmode="decimal" autocomplete="off" aria-label="Montant en euros du tarif ${esc(t.libelle)}">`).join("")}
        </div>
        <div id="tp-erreur" role="alert"></div>
        <button class="btn plein large" id="tp-enregistrer" style="margin-top:14px">Enregistrer les tarifs</button>` : `<div class="message erreur">Les tarifs n'ont pas pu être chargés.</div>`}
      </section>
      <div id="reglages-certificats"></div>
      <h2 style="margin-top:22px">Champs des fiches</h2>
      ${etat.champs.map(carte).join("")}
      <section class="carte bloc">
        <h2>Ajouter un champ</h2>
        <label for="n-lib">Libellé</label>
        <input id="n-lib" placeholder="Par exemple : Lieu de stockage" autocomplete="off">
        <label for="n-type">Type</label>
        <select id="n-type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
        <p class="sous">Le type ne peut plus être changé ensuite. Pour une liste, les choix s'ajoutent après la création.</p>
        <button class="btn plein large" id="n-ajouter">Ajouter le champ</button>
      </section>
    </div>`;
  $("#retour").addEventListener("click", vueListe);
  $("#corbeille").addEventListener("click", () => vueCorbeille());
  $("#revoir-tuto").addEventListener("click", () => lancerTutoriel());
  monterReglagesCertificats();
  const erreur = (m) => { $("#alerte").innerHTML = `<div class="message erreur">${m}</div>`; window.scrollTo(0, 0); };
  const verifier = (res) => { if (res.error) throw res.error; if (res.data && !res.data.length) throw new Error("Modification refusée : droits insuffisants."); };

  if ($("#tp-enregistrer")) {
    const zone = $("#tarifs-port");
    zone.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); e.stopPropagation(); $("#tp-enregistrer").click(); } });
    $("#tp-enregistrer").addEventListener("click", async () => {
      const refus = (m, el) => { $("#tp-erreur").innerHTML = `<div class="message erreur">${m}</div>`; el.focus(); };
      const maj = [];
      for (const t of etat.tarifs) {
        const elL = zone.querySelector(`[data-tarif="${t.cle}"][data-quoi="libelle"]`), elM = zone.querySelector(`[data-tarif="${t.cle}"][data-quoi="montant"]`);
        const libelle = texte(elL.value), m = texte(elM.value) ? nombre(elM.value) : 0;
        if (!libelle) return refus("Chaque tarif doit avoir un libellé.", elL);
        if (m === null || m < 0) return refus(`Le montant du tarif « ${esc(libelle)} » doit être un nombre, par exemple 25.`, elM);
        if (libelle !== t.libelle || m !== t.montant_eur) maj.push({ cle: t.cle, libelle, montant_eur: Math.round(m * 100) / 100 });
      }
      if (!maj.length) return vueAdmin("Aucun changement à enregistrer sur les tarifs.");
      const b = $("#tp-enregistrer"); b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = "Enregistrement…";
      try {
        for (const { cle, ...valeurs } of maj) verifier(await sb.from("tarifs_port").update(valeurs).eq("cle", cle).select("cle"));
        vueAdmin("Tarifs de frais de port enregistrés.");
      } catch (e) { vueAdmin("Les tarifs n'ont pas tous été enregistrés : " + msgErreur(e), "erreur"); }
    });
  }

  $("#n-ajouter").addEventListener("click", async () => {
    const libelle = texte($("#n-lib").value);
    if (!libelle) return erreur("Indiquez un libellé pour le nouveau champ.");
    const ordre = Math.max(0, ...etat.champs.map((c) => c.ordre)) + 1;
    try {
      verifier(await sb.from("champs").insert({ libelle, type: $("#n-type").value, ordre }).select("id"));
      vueAdmin(`Champ « ${esc(libelle)} » ajouté.`);
    } catch (e) { erreur(msgErreur(e)); }
  });

  $("#adm").addEventListener("input", (e) => {
    const el = e.target.closest("[data-option]"); if (!el) return;
    const v = el.value.trim();
    el.parentElement.querySelector('[data-action="renommer"]').disabled = !v || v === el.dataset.initial;
  });
  $("#adm").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    const b = e.target.id === "n-lib" ? $("#n-ajouter")
      : e.target.parentElement.querySelector('[data-action="renommer"]:not([disabled]), [data-action="libelle"], [data-action="ajouter"]');
    if (b) { e.preventDefault(); b.click(); }
  });
  $("#adm").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]"); if (!b) return;
    const bloc = b.closest("[data-champ]");
    const c = etat.champs.find((x) => x.id === bloc.dataset.champ);
    const action = b.dataset.action, i = Number(b.dataset.i);
    etat.adminOuvert = c.id;
    if (action === "retirer" || action === "supprimer") {
      const accord = await confirmer(action === "retirer"
        ? { titre: "Retirer ce choix ?", corps: `« ${c.options[i]} » ne sera plus proposé dans la liste « ${c.libelle} ». Les œuvres qui l'utilisent le conservent.`, action: "Retirer le choix" }
        : { titre: "Supprimer ce champ ?", corps: `Le champ « ${c.libelle} » disparaîtra de toutes les fiches.`, action: "Supprimer le champ" });
      if (!accord) return;
    }
    b.disabled = true;
    try {
      let ok = "";
      if (action === "libelle") {
        const v = texte($("#lib-" + c.id).value);
        if (!v) throw new Error("Le libellé ne peut pas être vide.");
        verifier(await sb.from("champs").update({ libelle: v }).eq("id", c.id).select("id"));
        ok = "Libellé enregistré.";
      } else if (action === "ajouter") {
        const v = texte($("[data-nouveau]", bloc).value);
        if (!v) throw new Error("Saisissez le nouveau choix.");
        if (c.options.includes(v)) throw new Error("Ce choix existe déjà.");
        verifier(await sb.from("champs").update({ options: [...c.options, v] }).eq("id", c.id).select("id"));
        ok = `Choix « ${v} » ajouté.`;
      } else if (action === "renommer") {
        const v = texte($(`[data-option="${i}"]`, bloc).value);
        if (!v) throw new Error("Le choix ne peut pas être vide.");
        if (v === c.options[i]) { b.disabled = false; return; }
        const res = await sb.rpc("renommer_option", { p_champ: c.id, p_ancien: c.options[i], p_nouveau: v });
        if (res.error) throw res.error;
        ok = `Choix renommé en « ${v} ». Œuvres mises à jour : ${res.data}.`;
      } else if (action === "retirer") {
        verifier(await sb.from("champs").update({ options: c.options.filter((_, k) => k !== i) }).eq("id", c.id).select("id"));
        ok = `Choix « ${c.options[i]} » retiré de la liste. Les œuvres qui l'utilisaient le conservent.`;
      } else if (action === "supprimer") {
        verifier(await sb.from("champs").delete().eq("id", c.id).select("id"));
        ok = `Champ « ${c.libelle} » supprimé.`;
      }
      vueAdmin(esc(ok));
    } catch (err) { b.disabled = false; erreur(msgErreur(err)); }
  });
}
