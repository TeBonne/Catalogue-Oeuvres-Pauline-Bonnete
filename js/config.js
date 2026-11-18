"use strict";
/* Configuration : accès Supabase, constantes, état global de l'application. */

/* ---------- Configuration ---------- */
const SUPABASE_URL = "https://yvgdxhzeyvubmfzeejia.supabase.co";
const SUPABASE_CLE = "sb_publishable__RZy5M7fjfUObsQqjHFjsw_jqfSaOJb"; // clé publique : la protection repose sur les règles d'accès de la base
const BUCKET = "oeuvres";
const PAGE = 60;
const STATUTS = {
  a_completer: "À compléter", disponible: "Disponible", reserve: "Réservé",
  vendu: "Vendu", pas_a_vendre: "Pas à vendre"
};
const LISTES = { // listes fermées, traitées comme le statut
  technique: ["Acrylique", "Aquarelle", "Pastel", "Peinture à l'huile"],
  support: ["Toile", "Papier type Canson", "Bois"],
  nature: ["Original", "Commande", "Reproduction"]
};

const app = document.getElementById("app");
const LIEN_ARRIVEE = new URLSearchParams(location.hash.slice(1));
let recuperation = LIEN_ARRIVEE.get("type") === "recovery";                     // arrivée par un lien « mot de passe oublié »
let lienInvalide = !!(LIEN_ARRIVEE.get("error_code") || LIEN_ARRIVEE.get("error")); // lien expiré ou déjà utilisé
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLE);
// Tris proposés : [libellé, colonne, croissant]. Les fiches sans valeur (année, prix) passent toujours en fin de liste.
const TRIS_VENTES = { "date-desc": "Date récente", "date-asc": "Date ancienne", "prix-desc": "Prix décroissant", "prix-asc": "Prix croissant", "titre-asc": "Titre A → Z" };
const TRIS = {
  "ajout-desc":  ["Derniers ajouts", "cree_le", false],
  "ajout-asc":   ["Premiers ajouts", "cree_le", true],
  "titre-asc":   ["Titre A → Z", "titre_tri", true],
  "titre-desc":  ["Titre Z → A", "titre_tri", false],
  "annee-desc":  ["Année récente", "annee", false],
  "annee-asc":   ["Année ancienne", "annee", true],
  "prix-asc":    ["Prix croissant", "prix_eur", true],
  "prix-desc":   ["Prix décroissant", "prix_eur", false]
};
let triMemorise = "ajout-desc";
try { const t = localStorage.getItem("catalogue-tri"); if (TRIS[t]) triMemorise = t; } catch (_) {}
let vueMemorisee = "grille";
try { vueMemorisee = localStorage.getItem("catalogue-vue") === "liste" ? "liste" : "grille"; } catch (_) {}
const LIBELLES_DEFAUT = { technique: "Technique", support: "Support", nature: "Nature" };
const TYPES = { texte: "Texte", nombre: "Nombre", liste: "Liste de choix", case: "Case à cocher" };
const lateral = document.getElementById("lateral");
const etat = { selection: null, dernier: null, ventes: { grain: "mois", annee: null, periode: null, panneau: false, tri: "date-desc", f: { q: "", du: "", au: "", min: null, max: null, nature: "", technique: "", port: "", etat: "" } }, jeton: 0, retour: null, gardien: null, modifie: false, adminOuvert: null, adminOnglet: "fiches", section: "liste:", occupe: false, enCorbeille: 0, vue: vueMemorisee, tri: triMemorise, tarifs: [], admin: false, champs: [], utilisateur: null, statut: "", q: "", items: [], total: 0, page: 0, comptes: {}, total_general: 0 };
