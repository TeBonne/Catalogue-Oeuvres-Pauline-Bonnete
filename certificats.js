"use strict";
/* ============================================================================
   Certificats d'authenticité
   - émission depuis la fiche d'une œuvre (numéro attribué par la base, contenu figé)
   - PDF A4 généré dans le navigateur : version signée (signature enregistrée) ou à signer à la main
   - historique (liste + détail) avec les coordonnées de l'acheteur
   - page publique de vérification, atteinte par le code QR du certificat
   Réservé aux administrateurs.
   ============================================================================ */
const BUCKET_PRIVE = "prive";
const URL_VERIFICATION = new URL("verification.html", location.origin + location.pathname).href;
const POLICES_PDF = [
  ["cert-titre.ttf", "Titre", "normal"], ["cert-texte.ttf", "Texte", "normal"],
  ["cert-texte-gras.ttf", "Texte", "bold"], ["cert-texte-italique.ttf", "Texte", "italic"]
];
const EMPLACEMENTS = ["En bas à gauche", "En bas à droite", "En haut à gauche", "En haut à droite", "Au dos"];
const cacheCert = { scripts: new Map(), polices: new Map() };

/* ---------- Utilitaires ---------- */
function chargerScript(src) {
  if (!cacheCert.scripts.has(src)) {
    cacheCert.scripts.set(src, new Promise((ok, ko) => {
      const s = document.createElement("script"); s.src = src;
      s.onload = ok; s.onerror = () => { cacheCert.scripts.delete(src); ko(new Error("Le module de création du PDF n'a pas pu être chargé. Vérifiez la connexion.")); };
      document.head.append(s);
    }));
  }
  return cacheCert.scripts.get(src);
}
const enDataUrl = (blob) => new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(l.result); l.onerror = () => ko(new Error("Lecture du fichier impossible.")); l.readAsDataURL(blob); });
const tailleImage = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok({ l: i.naturalWidth, h: i.naturalHeight, img: i }); i.onerror = () => ko(new Error("Image illisible.")); i.src = src; });
async function policeBase64(fichier) {
  if (!cacheCert.polices.has(fichier)) {
    const rep = await fetch("polices/" + fichier);
    if (!rep.ok) throw new Error("Une police du certificat n'a pas pu être chargée.");
    cacheCert.polices.set(fichier, (await enDataUrl(await rep.blob())).split(",")[1]);
  }
  return cacheCert.polices.get(fichier);
}
async function imagePrivee(chemin) {
  const { data, error } = await sb.storage.from(BUCKET_PRIVE).download(chemin);
  if (error) throw error;
  return enDataUrl(data);
}
async function chargerReglages() {
  const { data, error } = await sb.from("reglages").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}
const emailValide = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const techniqueComplete = (o) => (o.technique && o.support ? `${o.technique} sur ${o.support.toLowerCase()}` : o.technique || o.support || "");
const dimensionsTexte = (o) => (o.hauteur_cm && o.largeur_cm ? `${String(o.hauteur_cm).replace(".", ",")} cm × ${String(o.largeur_cm).replace(".", ",")} cm` : "");
const acheteurTexte = (c) => [c.acheteur_prenom, c.acheteur_nom].filter(Boolean).join(" ");
const badgeCertificat = (c) => `<span class="badge ${c.statut === "valide" ? "s-disponible" : "s-vendu"}" style="margin:0">${c.statut === "valide" ? "Valide" : "Annulé"}</span>`;
function telecharger(blob, nom) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/* ---------- Création du PDF A4 ---------- */
async function genererPdf(c, { signe }) {
  await Promise.all([chargerScript("lib/jspdf.umd.min.js"), chargerScript("lib/qrcode.js")]);
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
  for (const [fichier, nom, style] of POLICES_PDF) { doc.addFileToVFS(fichier, await policeBase64(fichier)); doc.addFont(fichier, nom, style); }
  const d = c.donnees, G = 22, D = 188, L = D - G; // marges gauche/droite, largeur utile
  const encre = [23, 28, 38], gris = [91, 100, 114], trait = [205, 208, 202];
  const police = (nom, style, taille, couleur = encre) => { doc.setFont(nom, style); doc.setFontSize(taille); doc.setTextColor(...couleur); };
  doc.setProperties({ title: `Certificat d'authenticité ${c.numero}`, author: d.artiste, subject: d.titre });

  // En-tête
  police("Titre", "normal", 12); doc.text(d.artiste, G, 24);
  police("Texte", "normal", 9, gris); doc.text(`Certificat n° ${c.numero}`, D, 24, { align: "right" });
  doc.setDrawColor(...trait); doc.setLineWidth(0.3); doc.line(G, 29, D, 29);
  police("Titre", "normal", 27); doc.text("Certificat d'authenticité", G, 47);

  // Mise en page : le texte est mesuré d'abord, la photo occupe la place restante (jamais de chevauchement)
  police("Texte", "italic", 10.5);
  const lignes = doc.splitTextToSize(d.texte, L), hDeclaration = lignes.length * 10.5 * 0.3528 * 1.5 + 8;
  police("Texte", "normal", 11.5);
  const rubriques = [
    ["TITRE DE L'ŒUVRE", d.titre], ["NOM DE L'ARTISTE", d.artiste], ["ANNÉE DE CRÉATION", d.annee],
    ["TECHNIQUE", d.technique], ["DIMENSIONS", d.dimensions], ["EMPLACEMENT DE LA SIGNATURE", d.emplacement_signature]
  ].filter(([, v]) => v).map(([libelle, valeur]) => ({ libelle, valeur: doc.splitTextToSize(String(valeur), D - 84) }));
  const hRubriques = rubriques.reduce((t, r) => t + r.valeur.length * 5.4 + 3, 0);
  const ys = 234, haut = 57, hPhotoMax = Math.max(30, Math.min(100, ys - 8 - haut - 12 - hDeclaration - hRubriques));

  // Photo de l'œuvre, entière, centrée
  let y = haut;
  if (c.photo_path) {
    const src = await imagePrivee(c.photo_path), t = await tailleImage(src);
    const k = Math.min(118 / t.l, hPhotoMax / t.h), l = t.l * k, h = t.h * k, x = G + (L - l) / 2;
    doc.addImage(src, "JPEG", x, y, l, h, undefined, "FAST");
    doc.setDrawColor(...trait); doc.setLineWidth(0.2); doc.rect(x, y, l, h);
    y += h + 12;
  }

  // Déclaration (formulation du modèle de l'artiste)
  police("Texte", "italic", 10.5, [60, 66, 78]);
  doc.text(lignes, G, y, { lineHeightFactor: 1.5 });
  y += hDeclaration;

  // Rubriques
  for (const r of rubriques) {
    police("Texte", "bold", 8.2); doc.text(r.libelle + " :", G, y);
    police("Texte", "normal", 11.5); doc.text(r.valeur, 84, y);
    y += r.valeur.length * 5.4 + 3;
  }

  // Signature et date, en pied de certificat
  police("Texte", "bold", 8.2); doc.text("SIGNATURE DE L'ARTISTE", G, ys);
  if (signe && c.signature) {
    const t = await tailleImage(c.signature), k = Math.min(62 / t.l, 24 / t.h);
    doc.addImage(c.signature, "PNG", G, ys + 3, t.l * k, t.h * k, undefined, "FAST");
  }
  police("Texte", "bold", 8.2); doc.text("DATE", 118, ys);
  police("Texte", "normal", 11.5); doc.text(`${c.lieu ? `à ${c.lieu}, ` : ""}le ${dateFr(c.emis_le)}`, 118, ys + 8);

  // Vérification : code QR et adresse
  doc.setDrawColor(...trait); doc.setLineWidth(0.3); doc.line(G, 266, D, 266);
  const lien = `${URL_VERIFICATION}?c=${c.code_verif}`, qr = window.qrcode(0, "M");
  qr.addData(lien); qr.make();
  const n = qr.getModuleCount(), cote = 19, pas = cote / n;
  doc.setFillColor(...encre);
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) doc.rect(G + k * pas, 270 + r * pas, pas + 0.02, pas + 0.02, "F");
  police("Texte", "bold", 9); doc.text("Vérifier l'authenticité de ce certificat", G + cote + 6, 276);
  police("Texte", "normal", 8.5, gris);
  doc.text("Scannez ce code, ou rendez-vous à l'adresse ci-dessous :", G + cote + 6, 281);
  doc.text(doc.splitTextToSize(lien, D - (G + cote + 6)), G + cote + 6, 285.5);
  doc.link(G, 270, L, cote, { url: lien });

  if (c.statut === "annule") { // un certificat annulé reste consultable, mais ne peut plus passer pour valide
    doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.22 }));
    police("Titre", "normal", 110, [194, 48, 28]); doc.text("ANNULÉ", 105, 170, { align: "center", angle: 35 });
    doc.restoreGraphicsState();
  }
  return doc.output("blob");
}

async function pdfDuCertificat(c, signe) {
  let signature = null;
  if (signe) {
    const r = await chargerReglages();
    if (!r.signature_path) throw new Error("La signature de l'artiste n'est pas enregistrée. Ajoutez-la dans Administration.");
    signature = await imagePrivee(r.signature_path);
  }
  return genererPdf({ ...c, signature }, { signe });
}

/* ---------- Historique : liste ---------- */
async function vueCertificats(message = "") {
  if (!etat.admin) return vueListe();
  majLateral("certificats");
  window.scrollTo(0, 0);
  app.innerHTML = `${entete("Certificats d'authenticité")}<p class="sous">Chargement…</p>`;
  $("#retour").addEventListener("click", vueListe);
  const { data, error } = await sb.from("certificats")
    .select("id,numero,emis_le,donnees,acheteur_prenom,acheteur_nom,acheteur_email,statut")
    .order("annee", { ascending: false }).order("sequence", { ascending: false }).limit(1000);
  if (error) {
    app.innerHTML = `${entete("Certificats d'authenticité")}<div class="message erreur" role="alert">Les certificats n'ont pas pu être chargés : ${msgErreur(error)}</div><button class="btn" id="reessayer">Réessayer</button>`;
    $("#retour").addEventListener("click", vueListe); $("#reessayer").addEventListener("click", () => vueCertificats());
    return;
  }
  app.innerHTML = `
    <div class="etroit">
      ${entete("Certificats d'authenticité")}
      ${message ? `<div class="message info" role="status">${message}</div>` : ""}
      ${data.length ? `
      <p class="sous">${data.length} certificat${data.length > 1 ? "s" : ""} émis. Un certificat ne se modifie pas : en cas d'erreur, annulez-le et émettez-en un nouveau.</p>
      <section class="carte" style="padding:8px" id="liste-certificats">
        ${data.map((c) => `
          <button class="vente" data-id="${c.id}">
            <div class="corps">
              <div class="titre">${esc(c.donnees.titre)}</div>
              <div class="sous">${esc(c.numero)}, émis le ${esc(dateFr(c.emis_le))}</div>
            </div>
            <div class="droite">
              ${badgeCertificat(c)}
              <div class="sous">${esc(acheteurTexte(c) || c.acheteur_email || "Acheteur non renseigné")}</div>
            </div>
          </button>`).join("")}
      </section>` : `
      <div class="carte vide">Aucun certificat émis pour l'instant.<br>Ouvrez la fiche d'une œuvre et utilisez « Générer le certificat d'authenticité ».</div>`}
    </div>`;
  $("#retour").addEventListener("click", vueListe);
  if (data.length) $("#liste-certificats").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) vueCertificat(b.dataset.id); });
}

/* ---------- Historique : détail d'un certificat ---------- */
async function vueCertificat(id, message = "") {
  if (!etat.admin) return vueListe();
  majLateral("certificats");
  window.scrollTo(0, 0);
  app.innerHTML = `${entete("Certificat")}<p class="sous">Chargement…</p>`;
  $("#retour").addEventListener("click", () => vueCertificats());
  let c, reglages;
  try {
    const rep = await sb.from("certificats").select("*").eq("id", id).single();
    if (rep.error) throw rep.error;
    c = rep.data; reglages = await chargerReglages();
  } catch (e) {
    app.innerHTML = `${entete("Certificat")}<div class="message erreur" role="alert">Ce certificat n'a pas pu être chargé : ${msgErreur(e)}</div>`;
    $("#retour").addEventListener("click", () => vueCertificats());
    return;
  }
  const d = c.donnees, valide = c.statut === "valide", lien = `${URL_VERIFICATION}?c=${c.code_verif}`;
  const ligne = (l, v) => (v ? `<div class="sous">${esc(l)}</div><div>${esc(v)}</div>` : "");
  app.innerHTML = `
    <div class="etroit">
      ${entete(`Certificat ${c.numero}`)}
      <div id="alerte" role="alert">${message ? `<div class="message info">${message}</div>` : ""}</div>
      ${valide ? "" : `<div class="message erreur">Ce certificat a été annulé le ${esc(new Date(c.annule_le).toLocaleDateString("fr-FR"))}. Il reste consultable, et la page de vérification le signale comme annulé.</div>`}
      <section class="carte bloc">
        <div class="commandes" style="margin-bottom:10px"><h2 style="margin:0">${esc(d.titre)}</h2>${badgeCertificat(c)}</div>
        <div class="fiche-cert">
          ${ligne("Artiste", d.artiste)}${ligne("Année de création", d.annee)}${ligne("Technique", d.technique)}${ligne("Dimensions", d.dimensions)}
          ${ligne("Emplacement de la signature", d.emplacement_signature)}${ligne("Nature", d.nature)}
          ${ligne("Émis", `${c.lieu ? `à ${c.lieu}, ` : ""}le ${dateFr(c.emis_le)}`)}
        </div>
        <p class="aide">Le contenu d'un certificat émis est figé : il ne suit pas les modifications apportées ensuite à la fiche de l'œuvre.</p>
        ${c.oeuvre_id ? `<button class="btn discret" id="voir-oeuvre" style="margin:8px 0 0 -14px">Ouvrir la fiche de l'œuvre</button>` : ""}
      </section>

      <section class="carte bloc">
        <h2>Document</h2>
        <div class="actions-cert">
          <button class="btn plein" id="pdf-signe" ${reglages.signature_path ? "" : "disabled"}>Télécharger le PDF signé</button>
          <button class="btn" id="pdf-vierge">Télécharger le PDF à signer à la main</button>
        </div>
        ${reglages.signature_path ? "" : `<p class="aide">La signature de l'artiste n'est pas encore enregistrée : ajoutez-la dans Administration pour obtenir la version signée.</p>`}
        <p class="aide">Le PDF est au format A4. La version à signer laisse l'emplacement de la signature vide, pour une signature manuscrite après impression.</p>
        <p class="aide">Vérification publique : <a href="${esc(lien)}" target="_blank" rel="noopener">ouvrir la page atteinte par le code QR</a>. Elle n'affiche jamais l'acheteur.</p>
      </section>

      <section class="carte bloc">
        <h2>Acheteur</h2>
        <p class="aide" style="margin-top:0">Ces coordonnées ne figurent pas sur le certificat. Elles servent à votre suivi et à l'envoi par e-mail.</p>
        <div class="deux">
          <div><label for="a-prenom">Prénom</label><input id="a-prenom" autocomplete="off" value="${esc(c.acheteur_prenom)}"></div>
          <div><label for="a-nom">Nom</label><input id="a-nom" autocomplete="off" value="${esc(c.acheteur_nom)}"></div>
        </div>
        <label for="a-email">E-mail</label>
        <input id="a-email" type="email" inputmode="email" autocapitalize="none" spellcheck="false" autocomplete="off" value="${esc(c.acheteur_email)}">
        <div class="actions-cert" style="margin-top:16px">
          <button class="btn" id="a-enregistrer">Enregistrer l'acheteur</button>
          <button class="btn plein" id="a-courriel" ${valide && reglages.signature_path ? "" : "disabled"}>Préparer l'e-mail à l'acheteur</button>
        </div>
        <p class="aide">« Préparer l'e-mail » télécharge le PDF signé, puis ouvre votre messagerie avec un message prêt à envoyer : il reste à y joindre le PDF.${c.email_prepare_le ? ` Dernière préparation le ${esc(new Date(c.email_prepare_le).toLocaleDateString("fr-FR"))}.` : ""}</p>
      </section>

      ${valide ? `<section class="carte bloc"><h2>Annulation</h2>
        <p class="aide" style="margin-top:0">À utiliser en cas d'erreur sur le certificat. Son numéro n'est pas réattribué.</p>
        <button class="btn danger" id="annuler-cert">Annuler ce certificat</button></section>` : ""}
    </div>`;
  $("#retour").addEventListener("click", () => vueCertificats());
  const alerter = (m, type = "erreur") => { $("#alerte").innerHTML = `<div class="message ${type}">${m}</div>`; window.scrollTo(0, 0); };
  const occuper = async (b, libelle, action) => {
    const avant = b.textContent; b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = libelle;
    try { await action(); } catch (e) { alerter(msgErreur(e)); }
    if (b.isConnected) { b.disabled = false; b.removeAttribute("aria-busy"); b.textContent = avant; }
  };
  const lireAcheteur = () => {
    const email = $("#a-email").value.trim().toLowerCase();
    if (email && !emailValide(email)) { $("#a-email").setAttribute("aria-invalid", "true"); $("#a-email").focus(); throw new Error("L'adresse e-mail de l'acheteur n'est pas valide."); }
    return { acheteur_prenom: texte($("#a-prenom").value), acheteur_nom: texte($("#a-nom").value), acheteur_email: email || null };
  };
  const enregistrerAcheteur = async (extra = {}) => {
    const valeurs = { ...lireAcheteur(), ...extra };
    const { data, error } = await sb.from("certificats").update(valeurs).eq("id", c.id).select("id");
    if (error) throw error;
    if (!data.length) throw new Error("Modification refusée : droits insuffisants.");
    Object.assign(c, valeurs);
  };

  if (c.oeuvre_id) $("#voir-oeuvre").addEventListener("click", () => vueFiche(c.oeuvre_id));
  $("#pdf-signe").addEventListener("click", (e) => occuper(e.currentTarget, "Création du PDF…", async () => telecharger(await pdfDuCertificat(c, true), `Certificat-${c.numero}.pdf`)));
  $("#pdf-vierge").addEventListener("click", (e) => occuper(e.currentTarget, "Création du PDF…", async () => telecharger(await pdfDuCertificat(c, false), `Certificat-${c.numero}-a-signer.pdf`)));
  $("#a-enregistrer").addEventListener("click", (e) => occuper(e.currentTarget, "Enregistrement…", async () => { await enregistrerAcheteur(); bandeau("Acheteur enregistré"); }));
  $("#a-courriel").addEventListener("click", (e) => occuper(e.currentTarget, "Préparation…", async () => {
    const a = lireAcheteur();
    if (!a.acheteur_email) { $("#a-email").focus(); throw new Error("Renseignez l'adresse e-mail de l'acheteur."); }
    telecharger(await pdfDuCertificat(c, true), `Certificat-${c.numero}.pdf`);
    await enregistrerAcheteur({ email_prepare_le: new Date().toISOString() });
    const corps = [
      `Bonjour${a.acheteur_prenom ? " " + a.acheteur_prenom : ""},`, "",
      `Vous trouverez en pièce jointe le certificat d'authenticité n° ${c.numero} de l'œuvre « ${d.titre} ».`, "",
      "Vous pouvez en vérifier l'authenticité à tout moment à cette adresse :", lien, "",
      "Bien cordialement,", d.artiste
    ].join("\r\n");
    bandeau("PDF téléchargé : joignez-le au message qui s'ouvre.");
    location.href = `mailto:${encodeURIComponent(a.acheteur_email)}?subject=${encodeURIComponent(`Certificat d'authenticité, « ${d.titre} »`)}&body=${encodeURIComponent(corps)}`;
  }));
  if (valide) $("#annuler-cert").addEventListener("click", async () => {
    const accord = await confirmer({
      titre: `Annuler le certificat ${c.numero} ?`,
      corps: "Il sera marqué comme annulé, y compris sur la page de vérification. Cette action est définitive : pour corriger une erreur, émettez ensuite un nouveau certificat.",
      action: "Annuler le certificat", annuler: "Conserver le certificat"
    });
    if (!accord) return;
    const { data, error } = await sb.from("certificats").update({ statut: "annule", annule_le: new Date().toISOString() }).eq("id", c.id).select("id");
    if (error || !data.length) return alerter(error ? msgErreur(error) : "Annulation refusée : droits insuffisants.");
    vueCertificat(c.id, `Le certificat ${esc(c.numero)} est annulé.`);
  });
}

/* ---------- Émission d'un nouveau certificat, depuis la fiche d'une œuvre ---------- */
async function vueCertificatNouveau(oeuvreId) {
  if (!etat.admin) return vueListe();
  majLateral("certificats");
  window.scrollTo(0, 0);
  app.innerHTML = `${entete("Nouveau certificat")}<p class="sous">Chargement…</p>`;
  const retour = () => vueFiche(oeuvreId);
  $("#retour").addEventListener("click", retour);
  let o, reglages;
  try {
    const [rep, existant] = await Promise.all([
      sb.from("oeuvres").select("*").eq("id", oeuvreId).single(),
      sb.from("certificats").select("id,numero").eq("oeuvre_id", oeuvreId).eq("statut", "valide").limit(1)
    ]);
    if (rep.error) throw rep.error;
    if (existant.error) throw existant.error;
    if (existant.data.length) // un seul certificat valide par œuvre
      return vueCertificat(existant.data[0].id, `Cette œuvre a déjà un certificat valide, le ${esc(existant.data[0].numero)}. Pour en émettre un nouveau, annulez d'abord celui-ci.`);
    o = rep.data; reglages = await chargerReglages();
  } catch (e) {
    app.innerHTML = `${entete("Nouveau certificat")}<div class="message erreur" role="alert">Le certificat n'a pas pu être préparé : ${msgErreur(e)}</div>`;
    $("#retour").addEventListener("click", retour);
    return;
  }
  const reproduction = (o.nature || "").toLowerCase().startsWith("reprod");
  const req = `<span class="req" aria-hidden="true">*</span>`;
  app.innerHTML = `
    <div class="etroit">
      ${entete("Nouveau certificat")}
      <form id="fc" novalidate>
        <section class="carte bloc">
          <div class="tete-cert"><img alt="" src="${esc(urlPhoto(o.vignette_path))}"><div><h2 style="margin:0">${esc(o.titre)}</h2>
            <p class="aide" style="margin:4px 0 0">Vérifiez les informations reprises de la fiche. Une fois émis, le certificat reçoit un numéro définitif et ne peut plus être modifié.</p></div></div>
          ${reglages.signature_path ? "" : `<div class="message info">La signature de l'artiste n'est pas encore enregistrée. Le certificat pourra être imprimé et signé à la main ; la version signée sera disponible dès que la signature sera ajoutée dans Administration.</div>`}
          <label for="c-titre">Titre de l'œuvre ${req}</label><input id="c-titre" value="${esc(o.titre === "Sans titre" ? "" : o.titre)}" autocomplete="off">
          <div class="deux">
            <div><label for="c-annee">Année de création ${req}</label><input id="c-annee" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(o.annee)}"></div>
            <div><label for="c-nature">Nature</label><select id="c-nature"><option value="Original" ${reproduction ? "" : "selected"}>Œuvre originale</option><option value="Reproduction" ${reproduction ? "selected" : ""}>Reproduction</option></select></div>
          </div>
          <label for="c-technique">Technique ${req}</label><input id="c-technique" autocomplete="off" value="${esc(techniqueComplete(o))}" placeholder="Par exemple : Acrylique sur toile avec châssis bois">
          <div class="deux">
            <div><label for="c-dimensions">Dimensions ${req}</label><input id="c-dimensions" autocomplete="off" value="${esc(dimensionsTexte(o))}" placeholder="55 cm × 38 cm"></div>
            <div><label for="c-emplacement">Emplacement de la signature</label><input id="c-emplacement" list="l-emplacement" autocomplete="off" value="${esc(o.emplacement_signature)}">
              <datalist id="l-emplacement">${EMPLACEMENTS.map((v) => `<option value="${esc(v)}">`).join("")}</datalist></div>
          </div>
          <label for="c-texte">Déclaration ${req}</label>
          <textarea id="c-texte" style="min-height:120px"></textarea>
          <p class="aide">Formulation de Pauline, modifiable dans Administration. Elle change selon la nature choisie.</p>
          <div class="deux">
            <div><label for="c-lieu">Lieu d'émission</label><input id="c-lieu" autocomplete="off" value="${esc(reglages.lieu_emission)}" placeholder="Vannes"></div>
            <div><label for="c-date">Date d'émission ${req}</label><input id="c-date" type="date" max="${aujourdhui()}" value="${aujourdhui()}"></div>
          </div>
        </section>
        <section class="carte bloc">
          <h2>Acheteur</h2>
          <p class="aide" style="margin-top:0">Facultatif. Ces coordonnées ne figurent pas sur le certificat : elles servent à votre suivi et à l'envoi par e-mail.</p>
          <div class="deux">
            <div><label for="c-prenom">Prénom</label><input id="c-prenom" autocomplete="off"></div>
            <div><label for="c-nom">Nom</label><input id="c-nom" autocomplete="off"></div>
          </div>
          <label for="c-email">E-mail</label><input id="c-email" type="email" inputmode="email" autocapitalize="none" spellcheck="false" autocomplete="off">
        </section>
      </form>
    </div>
    <div class="barre-bas">
      <div id="alerte" role="alert"></div>
      <div class="contenu fin">
        <button class="btn" type="button" id="c-annuler">Annuler</button>
        <button class="btn plein" type="submit" form="fc" id="c-emettre">Émettre le certificat</button>
      </div>
    </div>`;
  document.body.classList.add("barre-visible");
  $("#retour").addEventListener("click", retour); $("#c-annuler").addEventListener("click", retour);
  let texteModifie = false;
  const poserTexte = () => { if (!texteModifie) $("#c-texte").value = $("#c-nature").value === "Reproduction" ? reglages.texte_reproduction : reglages.texte_original; };
  poserTexte();
  $("#c-texte").addEventListener("input", () => { texteModifie = true; });
  $("#c-nature").addEventListener("change", poserTexte);
  $("#fc").addEventListener("input", (e) => e.target.removeAttribute("aria-invalid"));
  const alerter = (m, champ) => {
    $("#alerte").innerHTML = m ? `<div class="message erreur">${m}</div>` : "";
    const el = m && champ && document.getElementById(champ);
    if (el) { el.setAttribute("aria-invalid", "true"); el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); }
  };

  $("#fc").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = (idc) => $("#" + idc).value.trim();
    const annee = nombre(v("c-annee")), date = lireDate($("#c-date").value), email = v("c-email").toLowerCase();
    if (!v("c-titre")) return alerter("Indiquez le titre de l'œuvre.", "c-titre");
    if (!(Number.isInteger(annee) && annee >= 1900 && annee <= 2100)) return alerter("L'année de création doit comporter quatre chiffres, par exemple 2026.", "c-annee");
    if (!v("c-technique")) return alerter("Indiquez la technique, par exemple « Acrylique sur toile ».", "c-technique");
    if (!v("c-dimensions")) return alerter("Indiquez les dimensions, par exemple « 55 cm × 38 cm ».", "c-dimensions");
    if (!v("c-texte")) return alerter("La déclaration ne peut pas être vide.", "c-texte");
    if (!date) return alerter("La date d'émission n'est pas valide. Format attendu : JJ/MM/AAAA.", "c-date");
    if (date > aujourdhui()) return alerter("La date d'émission ne peut pas être dans le futur.", "c-date");
    if (email && !emailValide(email)) return alerter("L'adresse e-mail de l'acheteur n'est pas valide.", "c-email");
    const accord = await confirmer({
      titre: "Émettre ce certificat ?", corps: "Il recevra un numéro définitif et ne pourra plus être modifié, seulement annulé.",
      action: "Émettre le certificat", annuler: "Relire", delai: 0, ton: "neutre"
    });
    if (!accord) return;
    const bouton = $("#c-emettre"); bouton.disabled = true; bouton.setAttribute("aria-busy", "true"); bouton.textContent = "Émission…"; alerter("");
    const id = crypto.randomUUID(), chemin = `certificats/${id}/photo.jpg`;
    let photoDeposee = false;
    try {
      // La photo est copiée dans l'espace privé : le certificat garde l'image du jour de l'émission
      const rep = await fetch(urlPhoto(o.photo_path));
      if (!rep.ok) throw new Error("La photo de l'œuvre n'a pas pu être lue.");
      const depot = await sb.storage.from(BUCKET_PRIVE).upload(chemin, await rep.blob(), { contentType: "image/jpeg" });
      if (depot.error) throw depot.error;
      photoDeposee = true;
      const { data, error } = await sb.rpc("emettre_certificat", {
        p_id: id, p_oeuvre: o.id, p_lieu: v("c-lieu"), p_date: date, p_photo: chemin,
        p_prenom: v("c-prenom"), p_nom: v("c-nom"), p_email: email,
        p_donnees: {
          artiste: reglages.artiste, titre: v("c-titre"), annee: String(annee), technique: v("c-technique"), dimensions: v("c-dimensions"),
          emplacement_signature: v("c-emplacement") || null, nature: $("#c-nature").value, texte: v("c-texte")
        }
      });
      if (error) throw error;
      document.body.classList.remove("barre-visible");
      vueCertificat(id, `Le certificat ${esc(data.numero)} est émis. Vous pouvez maintenant le télécharger ou l'envoyer.`);
    } catch (err) {
      if (photoDeposee) await sb.storage.from(BUCKET_PRIVE).remove([chemin]);
      bouton.disabled = false; bouton.removeAttribute("aria-busy"); bouton.textContent = "Émettre le certificat";
      alerter("Le certificat n'a pas été émis : " + msgErreur(err));
    }
  });
}

/* ---------- Réglages, dans l'espace Administration ---------- */
/* Rend le fond d'une signature scannée transparent : l'encre reste, le papier disparaît. */
async function preparerSignature(fichier) {
  const t = await tailleImage(await enDataUrl(fichier));
  const k = Math.min(1, 900 / t.l), c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(t.l * k)); c.height = Math.max(1, Math.round(t.h * k));
  const ctx = c.getContext("2d"); ctx.drawImage(t.img, 0, 0, c.width, c.height);
  const px = ctx.getImageData(0, 0, c.width, c.height), p = px.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    p[i + 3] = Math.min(p[i + 3], Math.max(0, Math.min(255, Math.round((235 - lum) * 255 / 135))));
  }
  ctx.putImageData(px, 0, 0);
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("Image de signature illisible."))), "image/png"));
}

async function monterReglagesCertificats() {
  const zone = $("#reglages-certificats"); if (!zone) return;
  let r, apercu = "";
  try {
    r = await chargerReglages();
    if (r.signature_path) apercu = await imagePrivee(r.signature_path);
  } catch (e) { zone.innerHTML = `<section class="carte bloc"><h2>Certificats d'authenticité</h2><div class="message erreur">Réglages indisponibles : ${msgErreur(e)}</div></section>`; return; }
  if (!zone.isConnected) return;
  zone.innerHTML = `
    <section class="carte bloc">
      <h2>Certificats d'authenticité</h2>
      <button class="btn large" id="rc-liste">Voir les certificats émis</button>
      <div id="rc-alerte" role="alert"></div>

      <h2 class="section">Signature de l'artiste</h2>
      <p class="aide">Elle est apposée sur la version signée des certificats. Elle est conservée dans un espace privé, accessible aux seuls administrateurs.</p>
      <div class="signature-apercu">${apercu ? `<img alt="Signature enregistrée" src="${apercu}">` : `<span class="sous">Aucune signature enregistrée</span>`}</div>
      <div class="actions-cert">
        <label class="btn" for="rc-fichier">${apercu ? "Remplacer la signature" : "Ajouter une signature"}</label>
        <input class="cache" id="rc-fichier" type="file" accept="image/png,image/jpeg">
        ${apercu ? `<button class="btn danger" id="rc-retirer">Retirer</button>` : ""}
      </div>
      <p class="aide">Une photo ou un scan d'une signature à l'encre sombre sur papier blanc convient : le fond blanc est rendu transparent automatiquement.</p>

      <h2 class="section">Lieu d'émission par défaut</h2>
      <div class="rang"><input id="rc-lieu" value="${esc(r.lieu_emission)}" placeholder="Vannes" autocomplete="off" aria-label="Lieu d'émission par défaut"><button class="btn" id="rc-lieu-ok">Enregistrer</button></div>

      <h2 class="section">Déclaration</h2>
      <label for="rc-original">Pour une œuvre originale</label>
      <textarea id="rc-original" style="min-height:110px">${esc(r.texte_original)}</textarea>
      <label for="rc-reproduction">Pour une reproduction</label>
      <textarea id="rc-reproduction" style="min-height:110px">${esc(r.texte_reproduction)}</textarea>
      <button class="btn" id="rc-textes" style="margin-top:12px">Enregistrer les déclarations</button>
      <p class="aide">Ces textes s'appliquent aux prochains certificats. Ceux déjà émis gardent leur formulation.</p>
    </section>`;
  const alerter = (m) => { $("#rc-alerte").innerHTML = m ? `<div class="message erreur">${m}</div>` : ""; };
  const maj = async (valeurs) => {
    const { data, error } = await sb.from("reglages").update(valeurs).eq("id", 1).select("id");
    if (error) throw error;
    if (!data.length) throw new Error("Modification refusée : droits insuffisants.");
  };
  const tenter = async (action, succes) => { try { alerter(""); await action(); if (succes) bandeau(succes); } catch (e) { alerter(msgErreur(e)); } };
  $("#rc-liste").addEventListener("click", () => vueCertificats());
  $("#rc-lieu-ok").addEventListener("click", () => tenter(() => maj({ lieu_emission: texte($("#rc-lieu").value) }), "Lieu d'émission enregistré"));
  $("#rc-textes").addEventListener("click", () => tenter(async () => {
    const a = texte($("#rc-original").value), b = texte($("#rc-reproduction").value);
    if (!a || !b) throw new Error("Les deux déclarations doivent être renseignées.");
    await maj({ texte_original: a, texte_reproduction: b });
  }, "Déclarations enregistrées"));
  $("#rc-fichier").addEventListener("change", (e) => tenter(async () => {
    const f = e.target.files[0]; if (!f) return;
    const chemin = `signature/signature-${Date.now()}.png`;
    const depot = await sb.storage.from(BUCKET_PRIVE).upload(chemin, await preparerSignature(f), { contentType: "image/png" });
    if (depot.error) throw depot.error;
    await maj({ signature_path: chemin });
    if (r.signature_path) await sb.storage.from(BUCKET_PRIVE).remove([r.signature_path]);
    bandeau("Signature enregistrée"); monterReglagesCertificats();
  }));
  if (apercu) $("#rc-retirer").addEventListener("click", async () => {
    const accord = await confirmer({ titre: "Retirer la signature ?", corps: "Les certificats ne pourront plus être téléchargés en version signée tant qu'une nouvelle signature n'est pas ajoutée.", action: "Retirer la signature" });
    if (!accord) return;
    tenter(async () => { await maj({ signature_path: null }); await sb.storage.from(BUCKET_PRIVE).remove([r.signature_path]); bandeau("Signature retirée"); monterReglagesCertificats(); });
  });
}
