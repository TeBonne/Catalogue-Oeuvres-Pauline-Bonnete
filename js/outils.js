"use strict";
/* Utilitaires partagés : formats, dates, photos, fenêtres de confirmation, bandeaux. */

/* ---------- Utilitaires ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, racine = document) => racine.querySelector(sel);
const urlPhoto = (chemin) => sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
const nombre = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".").replace(/\s/g, "")); return Number.isFinite(n) ? n : null; };
const texte = (v) => { const t = String(v ?? "").trim(); return t === "" ? null : t; };
const prix = (v) => v == null ? "" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONES = {
  personnes: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.900 1.900 6.500 5.500"/><path d="M16 4.800a3.500 3.500 0 0 1 0 6.400M18.500 14.900c1.700.8 2.700 2.500 3 5.100"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  retour: svg('<path d="M15 18l-6-6 6-6"/>'),
  telecharger: svg('<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>'),
  filtres: svg('<path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/>'),
  reglages: svg('<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.5"/><circle cx="9" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/>'),
  sortir: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  corbeille: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  valider: svg('<path d="M5 12l5 5L20 7"/>')
};
ICONES.cadre = svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><rect x="8" y="8" width="8" height="8"/>');
ICONES.document = svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>');
ICONES.recadrer = svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>');
ICONES.aide = svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8"/><path d="M12 17h.01"/>');
ICONES.fermer = svg('<path d="M6 6l12 12M18 6L6 18"/>');
ICONES.graphique = svg('<path d="M5 20V11M12 20V4M19 20v-6"/>');
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const euros = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v); // centimes seulement s'il y en a
const enSaisie = (v) => (v == null ? "" : (Number.isInteger(Number(v)) ? String(Number(v)) : Number(v).toFixed(2)).replace(".", ",")); // nombre → texte d'un champ de saisie
async function chargerTarifs() {
  const { data, error } = await sb.from("tarifs_port").select("cle,libelle,montant_eur,ordre").order("ordre");
  if (error) throw error;
  etat.tarifs = data.map((t) => ({ ...t, montant_eur: Number(t.montant_eur) || 0 }));
}
const dateFr = (iso) => { const [a, m, j] = String(iso).split("-"); return `${j}/${m}/${a}`; };
const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/* Accepte AAAA-MM-JJ (sélecteur de date) ou JJ/MM/AAAA (saisie au clavier). Renvoie AAAA-MM-JJ, "" si vide, null si invalide. */
function lireDate(v) {
  v = String(v ?? "").trim(); if (!v) return "";
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/), a, mo, j;
  if (m) [, a, mo, j] = m; else if ((m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) [, j, mo, a] = m; else return null;
  a = +a; mo = +mo; j = +j;
  const d = new Date(a, mo - 1, j);
  if (d.getFullYear() !== a || d.getMonth() !== mo - 1 || d.getDate() !== j) return null;
  return `${a}-${String(mo).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}
const entete = (titre) => `<div class="entete"><div class="gauche"><button type="button" class="btn icone-seule" id="retour" aria-label="Retour" title="Retour">${ICONES.retour}</button><h1>${esc(titre)}</h1></div></div>`;
const dims = (o) => (o.hauteur_cm && o.largeur_cm) ? `${String(o.hauteur_cm).replace(".", ",")} × ${String(o.largeur_cm).replace(".", ",")} cm` : "";
const poids = (octets) => octets == null ? "" : octets < 1048576
  ? `${Math.max(1, Math.round(octets / 1024))} Ko`
  : `${(octets / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
const msgErreur = (e) => esc(e?.message || String(e));

/* Redimensionne une photo dans le navigateur : version d'affichage + vignette (JPEG). */
async function preparerPhoto(fichier) {
  let source;
  try {
    source = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  } catch (_) {
    source = await new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error("Format d'image non lisible par ce navigateur : " + fichier.name));
      img.src = URL.createObjectURL(fichier);
    });
  }
  const l0 = source.width, h0 = source.height;
  const reduire = (max, qualite) => new Promise((ok, ko) => {
    const r = Math.min(1, max / Math.max(l0, h0));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(l0 * r)); c.height = Math.max(1, Math.round(h0 * r));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0, c.width, c.height);
    c.toBlob((b) => b ? ok(b) : ko(new Error("Compression impossible : " + fichier.name)), "image/jpeg", qualite);
  });
  const grand = await reduire(1600, 0.82);
  const petit = await reduire(480, 0.75);
  if (source.close) source.close();
  return { grand, petit };
}

async function envoyerPhoto(id, fichier) {
  const { grand, petit } = await preparerPhoto(fichier);
  const t = Date.now();
  const photo_path = `${id}/photo-${t}.jpg`, vignette_path = `${id}/vignette-${t}.jpg`;
  for (const [chemin, blob] of [[photo_path, grand], [vignette_path, petit]]) {
    const { error } = await sb.storage.from(BUCKET).upload(chemin, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) throw error;
  }
  return { photo_path, vignette_path, poids_photo_octets: grand.size, poids_origine_octets: fichier.size };
}

/* Fenêtre de confirmation : « Annuler » en bouton principal, action dangereuse inactive 2 secondes. */
function confirmer({ titre, corps, vignette, action, annuler = "Annuler", delai = 2, ton = "danger" }) {
  return new Promise((resoudre) => {
    const voile = document.createElement("div"); voile.className = "voile";
    voile.innerHTML = `
      <div class="dialogue" role="alertdialog" aria-modal="true" aria-labelledby="dlg-titre" aria-describedby="dlg-corps">
        <div class="tete">${vignette ? `<img alt="" src="${esc(vignette)}">` : ""}<h2 id="dlg-titre">${esc(titre)}</h2></div>
        <p id="dlg-corps">${esc(corps)}</p>
        <div style="display:grid;gap:10px">
          <button class="btn ${ton === "neutre" ? "" : "plein"} large" data-r="non">${esc(annuler)}</button>
          <button class="btn ${ton === "neutre" ? "plein" : "danger"} large" data-r="oui" ${delai ? "disabled" : ""}>${esc(action)}${delai ? ` (${delai})` : ""}</button>
        </div>
      </div>`;
    document.body.append(voile);
    const oui = voile.querySelector('[data-r="oui"]');
    let reste = delai;
    const minuterie = setInterval(() => {
      reste--;
      if (reste > 0) oui.textContent = `${action} (${reste})`;
      else { clearInterval(minuterie); oui.textContent = action; oui.disabled = false; }
    }, 1000);
    const clavier = (e) => { if (e.key === "Escape") fermer(false); };
    const fermer = (r) => { clearInterval(minuterie); document.removeEventListener("keydown", clavier); voile.remove(); resoudre(r); };
    document.addEventListener("keydown", clavier);
    voile.addEventListener("click", (e) => {
      if (e.target === voile) return fermer(false);
      const b = e.target.closest("[data-r]"); if (b && !b.disabled) fermer(b.dataset.r === "oui");
    });
    voile.querySelector('[data-r="non"]').focus();
  });
}

/* Bandeau temporaire avec action d'annulation. */
function bandeau(message, libelle, action) {
  document.querySelectorAll(".bandeau").forEach((b) => b.remove());
  const el = document.createElement("div"); el.className = "bandeau"; el.setAttribute("role", "status");
  el.innerHTML = `<span>${esc(message)}</span>${libelle ? `<button type="button">${esc(libelle)}</button>` : ""}`;
  document.body.append(el);
  const fin = setTimeout(() => el.remove(), libelle ? 10000 : 4000);
  if (libelle) el.querySelector("button").addEventListener("click", async () => { clearTimeout(fin); el.remove(); await action(); });
}

async function effacerPhotos(lignes) {
  const chemins = lignes.flatMap((l) => [l.photo_path, l.vignette_path]).filter(Boolean);
  for (let i = 0; i < chemins.length; i += 100) await sb.storage.from(BUCKET).remove(chemins.slice(i, i + 100));
}

/* Configuration des champs (gérée depuis l'espace administrateur) */
async function chargerChamps() {
  const { data, error } = await sb.from("champs").select("*").order("ordre").order("cree_le");
  if (error) throw error;
  etat.champs = data;
}
const champSysteme = (cle) => etat.champs.find((c) => c.systeme && c.cle === cle) || { libelle: LIBELLES_DEFAUT[cle], options: LISTES[cle] };
const champsPerso = () => etat.champs.filter((c) => !c.systeme);

/* Les vignettes apparaissent en fondu une fois chargées. */
document.addEventListener("load", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("pret"); }, true);
document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("pret"); }, true);
function arriver() { app.classList.remove("arrive"); void app.offsetWidth; app.classList.add("arrive"); }
