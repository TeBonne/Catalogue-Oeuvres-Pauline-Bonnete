"use strict";
/* Connexion : écran d'accueil, mot de passe oublié, ouverture de session. */

/* ---------- Œuvre affichée sur l'écran de connexion ---------- */
/* Image choisie par un administrateur (copie publique à chemin fixe) ; à défaut, une œuvre du catalogue rognée à l'affichage. */
const ACCUEIL_CHOISIE = "accueil/fond.jpg";
const ACCUEIL_DEFAUT = { // photo d'origine : capture d'écran dont seule la peinture est montrée (zone en pixels de l'image)
  chemin: "f8f56689-d5f0-40b2-a792-5542aae78b1d/photo-1794934478620.jpg", largeur: 738, x: 128, y: 402, l: 514, h: 753
};
function monterAccueil() {
  const fond = $("#accueil-fond"); if (!fond) return;
  const poser = (adresse, rogne) => { // l'œuvre occupe tout le fond de l'écran
    if (!fond.isConnected) return;
    if (rogne) {
      const style = `width:${(rogne.largeur / rogne.l) * 100}%;left:${(-rogne.x / rogne.l) * 100}%;top:${(-rogne.y / rogne.h) * 100}%`;
      fond.innerHTML = `<div class="rogne" style="aspect-ratio:${rogne.l}/${rogne.h};width:max(100vw, calc(100vh * ${rogne.l / rogne.h}))"><img alt="" src="${esc(adresse)}" style="${style}"></div>`;
    } else fond.style.backgroundImage = `url("${adresse}")`;
    fond.classList.add("pret"); $("#accueil").classList.add("avec-oeuvre");
  };
  const essayer = (adresse, alors, sinon) => { const i = new Image(); i.onload = alors; i.onerror = sinon; i.src = adresse; };
  const choisie = urlPhoto(ACCUEIL_CHOISIE) + "?v=" + Math.floor(Date.now() / 600000), defaut = urlPhoto(ACCUEIL_DEFAUT.chemin);
  essayer(choisie, () => poser(choisie, null), () => essayer(defaut, () => poser(defaut, ACCUEIL_DEFAUT), () => {}));
}

/* ---------- Connexion ---------- */
function vueConnexion(message = "", type = "erreur") {
  masquerLateral();
  app.innerHTML = `
    <div class="accueil" id="accueil">
    <div class="accueil-fond" id="accueil-fond" aria-hidden="true"></div>
    <div class="carte accueil-carte">
      <h1 style="font-size:1.9rem">Pauline Bonneté</h1>
      <p class="sous" style="margin-top:6px">Ma vie, mes œuvres</p>
      ${message ? `<div class="message ${type}">${message}</div>` : ""}
      <form id="f">
        <label for="email">Adresse e-mail</label>
        <input id="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required>
        <label for="mdp">Mot de passe</label>
        <input id="mdp" type="password" autocomplete="current-password" minlength="8" required aria-describedby="mdp-aide">
        <p class="aide" id="mdp-aide">8 caractères minimum.</p>
        <label class="coche" for="voir"><input id="voir" type="checkbox"> Afficher le mot de passe</label>
        <button class="btn discret" type="button" id="oubli" style="margin:4px 0 0 -14px">Mot de passe oublié ?</button>
        <div style="display:grid;gap:10px;margin-top:14px">
          <button class="btn plein large" type="submit">Se connecter</button>
          <button class="btn large" type="button" id="creer">Créer mon compte</button>
        </div>
      </form>
      <p class="sous" style="margin-top:14px">Seules les adresses autorisées accèdent au catalogue.</p>
    </div>
    </div>`;
  monterAccueil();
  const lire = () => ({ email: $("#email").value.trim(), password: $("#mdp").value });
  $("#voir").addEventListener("change", (e) => { $("#mdp").type = e.target.checked ? "text" : "password"; });
  $("#oubli").addEventListener("click", () => vueMotDePasseOublie($("#email").value.trim()));
  const occuper = (b, t) => { app.querySelectorAll("#f button").forEach((x) => { x.disabled = true; }); b.textContent = t; };
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    occuper($("#f button[type=submit]"), "Connexion…");
    const { error } = await sb.auth.signInWithPassword(lire());
    if (error) vueConnexion(error.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect. Si vous n'avez pas encore de compte, saisissez votre adresse et un mot de passe, puis utilisez le bouton « Créer mon compte »." : error.message === "Email not confirmed" ? "Adresse non confirmée : cliquez d'abord sur le lien reçu par e-mail." : msgErreur(error));
  });
  $("#creer").addEventListener("click", async () => {
    if (!$("#f").reportValidity()) return;
    occuper($("#creer"), "Création du compte…");
    const { data, error } = await sb.auth.signUp({ ...lire(), options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return vueConnexion(msgErreur(error));
    if (!data.session) vueConnexion("Compte créé. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien qu'il contient, puis revenez vous connecter ici.", "info");
  });
}

function gabaritAccueil(interieur) {
  masquerLateral();
  app.innerHTML = `
    <div class="accueil" id="accueil">
    <div class="accueil-fond" id="accueil-fond" aria-hidden="true"></div>
    <div class="carte accueil-carte">${interieur}</div>
    </div>`;
  monterAccueil();
}
const erreurAuth = (e) => {
  const m = (e && e.message) || "";
  if ((e && e.status === 429) || /rate limit|security purposes/i.test(m)) return "Trop de demandes en peu de temps. Patientez quelques minutes avant de réessayer.";
  if (/different from the old password/i.test(m)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/at least \d+ characters|weak/i.test(m)) return "Ce mot de passe est trop court ou trop simple. Choisissez-en un d'au moins 8 caractères.";
  if (/session.*missing|not authenticated|jwt/i.test(m)) return "Ce lien n'est plus valable. Demandez-en un nouveau avec « Mot de passe oublié ? ».";
  return msgErreur(e);
};

function vueMotDePasseOublie(emailInitial = "", message = "", type = "erreur") {
  gabaritAccueil(`
      <h1>Mot de passe oublié</h1>
      <p class="sous" style="margin-top:6px">Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      <div role="alert">${message ? `<div class="message ${type}">${message}</div>` : ""}</div>
      <form id="f">
        <label for="email">Adresse e-mail</label>
        <input id="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required value="${esc(emailInitial)}">
        <div style="display:grid;gap:10px;margin-top:18px">
          <button class="btn plein large" type="submit">Recevoir le lien</button>
          <button class="btn large" type="button" id="retour-connexion">Retour à la connexion</button>
        </div>
      </form>`);
  $("#retour-connexion").addEventListener("click", () => vueConnexion());
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), b = $("#f button[type=submit]");
    b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = "Envoi…";
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) return vueMotDePasseOublie(email, erreurAuth(error));
    // Même message qu'un compte existe ou non : on ne révèle pas quelles adresses ont un compte
    vueMotDePasseOublie(email, "Si un compte existe pour cette adresse, un e-mail vient de lui être envoyé. Ouvrez-le et cliquez sur le lien sans trop attendre : il n'est valable qu'un temps limité. Pensez à regarder dans les indésirables.", "info");
  });
}

function vueNouveauMotDePasse(message = "") {
  if (!message && $("#nouveau-mdp")) return; // déjà affiché : on ne vide pas la saisie en cours
  gabaritAccueil(`
      <h1>Nouveau mot de passe</h1>
      <p class="sous" style="margin-top:6px">Choisissez le mot de passe que vous utiliserez désormais pour vous connecter.</p>
      <div role="alert">${message ? `<div class="message erreur">${message}</div>` : ""}</div>
      <form id="f">
        <label for="nouveau-mdp">Nouveau mot de passe</label>
        <input id="nouveau-mdp" type="password" autocomplete="new-password" minlength="8" required aria-describedby="nmdp-aide">
        <p class="aide" id="nmdp-aide">8 caractères minimum.</p>
        <label class="coche" for="voir"><input id="voir" type="checkbox"> Afficher le mot de passe</label>
        <div style="display:grid;gap:10px;margin-top:18px">
          <button class="btn plein large" type="submit">Enregistrer le mot de passe</button>
        </div>
      </form>`);
  $("#voir").addEventListener("change", (e) => { $("#nouveau-mdp").type = e.target.checked ? "text" : "password"; });
  $("#nouveau-mdp").focus();
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mdp = $("#nouveau-mdp").value;
    if (mdp.length < 8) return vueNouveauMotDePasse("Le mot de passe doit comporter au moins 8 caractères.");
    const b = $("#f button[type=submit]"); b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = "Enregistrement…";
    const { error } = await sb.auth.updateUser({ password: mdp });
    if (error) return vueNouveauMotDePasse(erreurAuth(error));
    recuperation = false;
    try { history.replaceState(null, "", location.pathname); } catch (_) {}
    const { data } = await sb.auth.getSession();
    etat.utilisateur = null;
    await demarrer(data.session);
    bandeau("Mot de passe modifié. Vous êtes connecté.");
  });
}

function vueNonAutorise(email) {
  masquerLateral();
  app.innerHTML = `
    <div class="carte" style="max-width:420px;margin:8vh auto 0">
      <h1>Accès non autorisé</h1>
      <p>L'adresse <strong>${esc(email)}</strong> n'est pas encore dans la liste des personnes autorisées.</p>
      <button class="btn large" id="sortir">Se déconnecter</button>
    </div>`;
  $("#sortir").addEventListener("click", () => sb.auth.signOut());
}

async function demarrer(session) {
  if (!session) { etat.utilisateur = null; return vueConnexion(); }
  if (etat.utilisateur === session.user.id) return;
  etat.utilisateur = session.user.id;
  const { data, error } = await sb.from("membres").select("email,admin,tutoriel_vu").limit(1);
  if (error) return vueConnexion(msgErreur(error));
  if (!data.length) return vueNonAutorise(session.user.email);
  etat.admin = !!data[0].admin; etat.email = data[0].email; etat.tutorielVu = data[0].tutoriel_vu !== false;
  try { await chargerChamps(); } catch (_) { etat.champs = []; }
  try { await chargerTarifs(); } catch (_) { etat.tarifs = []; }
  vueListe();
  if (!etat.tutorielVu) setTimeout(() => { if (etat.utilisateur && !etat.tutorielVu) lancerTutoriel(); }, 1200); // première connexion
}
