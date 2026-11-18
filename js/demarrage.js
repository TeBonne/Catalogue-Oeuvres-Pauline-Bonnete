"use strict";
/* Démarrage : réagit à l'état de la session. Chargé en dernier, une fois toutes les vues définies. */

/* ---------- Démarrage ---------- */
sb.auth.onAuthStateChange((evenement, session) => {
  if (evenement === "PASSWORD_RECOVERY") recuperation = true;
  if (evenement === "TOKEN_REFRESHED" || evenement === "USER_UPDATED") return;
  setTimeout(() => {
    if (recuperation && session) return vueNouveauMotDePasse();           // lien « mot de passe oublié » : on choisit d'abord le nouveau
    if (lienInvalide && !session) {                                         // lien expiré ou déjà utilisé
      lienInvalide = false; recuperation = false;
      try { history.replaceState(null, "", location.pathname); } catch (_) {}
      etat.utilisateur = null;
      return vueConnexion("Ce lien a expiré ou a déjà été utilisé. Pour un nouveau mot de passe, utilisez « Mot de passe oublié ? » ; pour confirmer un compte, connectez-vous simplement.");
    }
    demarrer(session);
  }, 0);
});
