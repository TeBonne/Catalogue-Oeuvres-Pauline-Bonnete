# Catalogue des œuvres — Pauline Bonneté

Back-office de gestion du catalogue d'œuvres : fiches, photos, ventes, frais de port, certificats d'authenticité.
Prototype : application web statique (sans étape de compilation), hébergée sur GitHub Pages, données dans Supabase.

- Site : https://tebonne.github.io/Catalogue-Oeuvres-Pauline-Bonnete/
- Données : projet Supabase `yvgdxhzeyvubmfzeejia` (base, authentification, stockage des photos)

## Organisation du code

```
index.html            Page unique : charge les feuilles de style puis les scripts, dans l'ordre
verification.html     Page publique de vérification d'un certificat (autonome)
css/                  Une feuille par écran ou par famille de composants, chargées dans cet ordre :
  socle.css           Variables, polices, éléments de base, mise en page générale, animations
  formulaires.css     Libellés, champs, cases à cocher, états d'erreur
  composants.css      Boutons, cartes, messages, fenêtres de confirmation, pastilles, onglets
  navigation.css      Barre latérale (écran large), menu coulissant (téléphone)
  connexion.css       Écran de connexion
  catalogue.css       Vignettes, liste, outils, sélection multiple, corbeille
  fiche.css           Fiche d'une œuvre, photos complémentaires, éditeur de recadrage
  ventes.css          Suivi des ventes, fichier des acheteurs
  certificats.css     Certificats d'authenticité
  administration.css  Sous-rubriques, tarifs de frais de port
  tutoriel.css        Tutoriel de prise en main
js/
  config.js           Accès Supabase, constantes, état global (`etat`)
  outils.js           Formats, dates, photos, fenêtres de confirmation, bandeaux
  navigation.js       Barre latérale et menu
  connexion.js        Écran d'accueil, mot de passe oublié, ouverture de session
  catalogue.js        Liste des œuvres : recherche, filtres, tri
  selection.js        Sélection multiple et actions en lot
  fiche.js            Fiche d'une œuvre
  ventes.js           Suivi des ventes : graphique, filtres, export CSV
  corbeille.js        Corbeille
  administration.js   Champs des fiches, listes de choix, tarifs de frais de port
  import.js           Import en lot de photos
  photos.js           Photos complémentaires d'une œuvre
  acheteurs.js        Fichier des acheteurs (administrateur)
  certificats.js      Certificats d'authenticité (émission, PDF, historique)
  recadrage.js        Éditeur de photo
  tutoriel.js         Tutoriel de prise en main
  demarrage.js        Point d'entrée : réagit à l'état de la session (chargé en dernier)
lib/, polices/        Bibliothèques et polices hébergées avec le site
tests/                Tests automatiques (voir ci-dessous)
```

Règles à connaître avant de modifier :

- **Pas de compilation.** Les scripts sont des fichiers classiques qui partagent le même espace global : une fonction
  définie dans un fichier est utilisable dans les autres. L'ordre des balises `<script>` de `index.html` compte ;
  `demarrage.js` reste en dernier.
- **Une vue = une fonction `vue…()`** (`vueListe`, `vueFiche`, `vueVentes`…) qui réécrit le contenu de `#app`.
- **Avant chaque commit : `python outils/versionner.py`.** Il estampille les adresses des scripts et des styles dans
  `index.html` ; sans cela, un navigateur peut garder un ancien fichier quelques minutes. Les tests échouent si c'est oublié.
- **Une règle de style va dans la feuille de son écran**, à la fin. À l'intérieur d'une feuille, l'ordre compte :
  une règle placée plus bas l'emporte sur une règle équivalente placée plus haut.
- **Les grandes vues se lisent de haut en bas** : chargement, affichage (`gabarit()`), puis un bloc nommé par sujet
  (`brancherVente()`, `brancherPhoto()`…). Ces blocs partagent les variables déclarées en tête de la vue.
- **Les droits sont appliqués par la base** (règles d'accès Supabase), pas par l'interface : masquer un bouton ne
  protège rien.

## Tests

Les parcours principaux sont joués dans un navigateur, sur une fausse base en mémoire (`tests/faux-supabase.js`),
en taille téléphone et en taille ordinateur. Ils ne touchent jamais la vraie base.

```
pip install -r tests/requirements.txt
python -m playwright install chromium
python -m pytest tests -q
```

GitHub les rejoue à chaque modification poussée sur `main` (onglet **Actions** du dépôt). Une croix rouge signale
un parcours cassé ; le site reste publié dans tous les cas.

Pour contrôler une évolution à l'œil : `python tests/captures.py dossier` produit une capture de chaque écran.
