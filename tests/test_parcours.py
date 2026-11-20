import re, subprocess, sys
from conftest import js, base, deborde, RACINE


def test_estampilles_des_fichiers():
    r = subprocess.run([sys.executable, str(RACINE / "outils" / "versionner.py"), "--verifier"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


SANS_ESPACES = lambda t: re.sub(r"[  ]", " ", t)


# ---------- Connexion ----------
def test_mot_de_passe_oublie(ouvrir):
    p = ouvrir("#connexion")
    p.fill("#email", "pauline.bonnete@gmail.com"); p.click("#oubli")
    assert p.locator("h1").inner_text() == "Mot de passe oublié"
    assert p.input_value("#email") == "pauline.bonnete@gmail.com"
    p.click("#f button[type=submit]"); p.wait_for_timeout(300)
    assert p.evaluate("window.__reset.email") == "pauline.bonnete@gmail.com"
    assert "Si un compte existe" in p.locator(".message.info").inner_text()
    p.fill("#email", "trop@exemple.fr"); p.click("#f button[type=submit]"); p.wait_for_timeout(300)
    assert "Trop de demandes" in p.locator(".message.erreur").inner_text()
    p.click("#retour-connexion"); assert p.locator("#oubli").count() == 1


def test_nouveau_mot_de_passe_par_lien(ouvrir):
    p = ouvrir("#access_token=x&type=recovery", 500)
    assert p.locator("h1").inner_text() == "Nouveau mot de passe"
    assert p.locator("#grille").count() == 0, "le catalogue ne doit pas s'afficher avant le choix du mot de passe"
    p.fill("#nouveau-mdp", "ancien-mot-de-passe"); p.click("#f button[type=submit]"); p.wait_for_timeout(300)
    assert "différent de l'ancien" in p.locator(".message.erreur").inner_text()
    p.fill("#nouveau-mdp", "un-nouveau-mot-de-passe"); p.click("#f button[type=submit]"); p.wait_for_timeout(900)
    assert p.locator("#grille").count() == 1
    assert p.locator(".bandeau").inner_text() == "Mot de passe modifié. Vous êtes connecté."


def test_lien_expire(ouvrir):
    p = ouvrir("#error=access_denied&error_code=otp_expired", 500)
    assert "Ce lien a expiré" in p.locator(".message.erreur").inner_text()
    assert p.evaluate("location.hash") == ""


def test_image_de_l_ecran_de_connexion(ouvrir):
    p = ouvrir()
    assert p.evaluate("window.__listes") >= 1, "un administrateur vérifie à l'ouverture que l'image existe"
    assert not p.evaluate("(window.__envois || []).includes('accueil/fond.jpg')"), "image présente : rien n'est envoyé"
    js(p, "window.__accueil_absente = true; window.__db.oeuvres[0].id = ACCUEIL_OEUVRE_INITIALE; assurerImageAccueil()"); p.wait_for_timeout(1200)
    assert p.evaluate("window.__envois.includes('accueil/fond.jpg')"), "image absente : elle est recréée à partir de l'œuvre initiale"
    q = ouvrir("#connexion")
    assert q.locator("#accueil.avec-oeuvre").count() == 1, "l'image choisie s'affiche en fond de l'écran de connexion"


# ---------- Catalogue ----------
def test_tri_du_catalogue(ouvrir):
    p = ouvrir()
    assert p.input_value("#tri") == "ajout-desc"
    lire = lambda col: p.evaluate(f"etat.items.map((o) => o.{col})")
    p.select_option("#tri", "prix-asc"); p.wait_for_timeout(350)
    prix = lire("prix_eur"); connus = [x for x in prix if x is not None]
    assert connus == sorted(connus) and prix[len(connus):] == [None] * (len(prix) - len(connus)), "sans prix en fin de liste"
    p.select_option("#tri", "annee-desc"); p.wait_for_timeout(350)
    annees = [x for x in lire("annee") if x is not None]; assert annees == sorted(annees, reverse=True)
    p.select_option("#tri", "titre-asc"); p.wait_for_timeout(350)
    assert lire("titre")[0] == "83159" and lire("titre")[-1] == "Titre 1"
    assert p.evaluate("localStorage.getItem('catalogue-tri')") == "titre-asc"
    pastille = p.evaluate("(() => { const c = getComputedStyle(document.querySelector('#grille .pastille')); return [c.backgroundColor, c.width, c.height]; })()")
    assert pastille == ["rgb(212, 53, 28)", "10px", "10px"], "repère des œuvres vendues : pastille ronde vermillon"
    assert not deborde(p)


def test_fiche_modifier_et_quitter(ouvrir):
    p = ouvrir()
    p.click('[data-id="o0"]'); p.wait_for_timeout(400)
    p.fill("#titre", "Girafe bis"); p.click("#retour"); p.wait_for_timeout(200)
    assert p.locator(".dialogue h2").inner_text() == "Quitter sans enregistrer ?"
    p.click('.dialogue [data-r="non"]'); assert p.locator("#f").count() == 1
    p.fill("#annee", "20"); p.click("#valider"); p.wait_for_timeout(200)
    assert "quatre chiffres" in p.locator("#alerte .message").inner_text()
    assert p.get_attribute("#annee", "aria-invalid") == "true"
    p.fill("#annee", "2021"); p.click("#valider"); p.wait_for_timeout(500)
    assert p.locator("#grille").count() == 1
    assert base(p, "oeuvres.find(o => o.id === 'o0').titre") == "Girafe bis"


def test_vente_et_frais_de_port(ouvrir):
    p = ouvrir()
    js(p, "vueFiche('o1')"); p.wait_for_timeout(500)
    assert p.locator("#bloc-vente").is_hidden()
    assert [SANS_ESPACES(t) for t in p.locator("#port_type option").all_inner_texts()] == ["Non défini", "Petit (15 €)", "Moyen (28,50 €)", "Gros (45 €)", "Très gros", "Remise en main propre"]
    p.select_option("#port_type", "moyen"); p.select_option("#statut", "vendu")
    assert p.locator("#bloc-vente").is_visible() and p.input_value("#port_facture") == "28,50"
    p.select_option("#port_type", "gros"); assert p.input_value("#port_facture") == "45"
    p.fill("#port_facture", "30"); p.select_option("#port_type", "petit")
    assert p.input_value("#port_facture") == "30", "un montant saisi à la main n'est pas écrasé"
    p.fill("#prix_vendu", "abc"); p.click("#valider"); p.wait_for_timeout(200)
    assert "prix de vente" in p.locator("#alerte .message").inner_text()
    p.fill("#prix_vendu", "300"); p.fill("#date_vente", "2026-11-10"); p.fill("#port_facture", "32,50"); p.click("#valider"); p.wait_for_timeout(600)
    o = "oeuvres.find(o => o.id === 'o1')"
    assert [base(p, o + ".statut"), base(p, o + ".port_type"), base(p, o + ".port_facture_eur"), base(p, o + ".prix_vendu_eur")] == ["vendu", "petit", 32.5, 300]
    js(p, "vueFiche('o1')"); p.wait_for_timeout(500)
    p.select_option("#statut", "disponible"); p.click("#valider"); p.wait_for_timeout(600)
    assert [base(p, o + ".port_type"), base(p, o + ".port_facture_eur"), base(p, o + ".prix_vendu_eur")] == ["petit", None, None]


def test_remise_en_main_propre(ouvrir):
    p = ouvrir()
    o = "oeuvres.find(o => o.id === 'o3')"                  # vendue 400 €, port facturé 28,50 €
    js(p, "vueFiche('o3')"); p.wait_for_timeout(600)
    assert p.locator("#port_facture").is_visible() and p.input_value("#port_facture") == "28,50"
    p.select_option("#port_type", "main_propre")
    assert p.locator("#port_facture").is_hidden() and p.locator("#main-propre-note").is_visible()
    p.click("#valider"); p.wait_for_timeout(600)
    assert [base(p, o + ".port_type"), base(p, o + ".port_facture_eur")] == ["main_propre", None]
    # un retour à un tarif d'envoi repropose son montant
    js(p, "vueFiche('o3')"); p.wait_for_timeout(600)
    assert p.locator("#port_facture").is_hidden()
    p.select_option("#port_type", "gros"); assert p.locator("#port_facture").is_visible() and p.input_value("#port_facture") == "45"
    # suivi des ventes : mention dans la liste, filtre dédié, colonne de l'export
    js(p, "etat.modifie = false; vueVentes()"); p.wait_for_timeout(900)
    assert "Remise en main propre" in p.locator(".vente", has_text="Marée basse à Cancale").inner_text()
    p.click("#v-filtres"); p.select_option("#vf-port", "main"); p.click("#v-panneau button[type=submit]"); p.wait_for_timeout(150)
    assert p.locator(".vente .titre").all_inner_texts() == ["Marée basse à Cancale"] and p.locator(".actif").inner_text().strip() == "Remise en main propre"
    with p.expect_download() as d: p.click("#v-export")
    assert open(d.value.path(), "rb").read().decode("utf-8-sig").strip().split("\r\n")[1] == "02/06/2026;Marée basse à Cancale;Original;Peinture à l'huile;400;400;;Remise en main propre;400;Complète"
    # administration : quatre tarifs modifiables, la remise en main propre n'en fait pas partie
    js(p, "etat.adminOnglet = 'vente'; vueAdmin()"); p.wait_for_timeout(600)
    assert p.locator('[data-quoi="libelle"]').count() == 4 and "main propre" in p.locator("#tarifs-port").inner_text()


def test_selection_multiple(ouvrir):
    p = ouvrir(); ids = ["o0", "o1", "o3"]
    techniques = lambda: p.evaluate("(ids) => ids.map(i => __db.oeuvres.find(x => x.id === i).technique)", ids)
    avant = techniques()
    p.click("#sel-entrer")
    for i in ids: p.click(f'[data-id="{i}"]')
    assert p.locator("#f").count() == 0, "en sélection, un clic n'ouvre pas la fiche"
    p.click('[data-lot="technique"]'); p.wait_for_timeout(150)
    p.select_option("#lot-valeur", "Pastel"); p.click('.dialogue [data-r="oui"]'); p.wait_for_timeout(500)
    assert techniques() == ["Pastel"] * 3
    p.click(".bandeau button"); p.wait_for_timeout(500)
    assert techniques() == avant, "l'annulation rétablit les valeurs d'origine"
    assert not deborde(p)


# ---------- Suivi des ventes ----------
def test_suivi_des_ventes(ouvrir):
    p = ouvrir()
    js(p, "vueVentes()"); p.wait_for_timeout(900)
    tuiles = [SANS_ESPACES(t).replace("\n", " | ") for t in p.locator(".tuile").all_inner_texts()]
    assert tuiles == ["2 950 € | Total des ventes, hors port", "85,50 € | Frais de port facturés", "8 | Œuvres vendues", "492 € | Prix de vente moyen"]
    assert [p.locator(".seg.tab").count(), p.locator(".seg.port").count()] == [4, 2]
    assert p.locator(".legende").inner_text().split() == ["Tableaux", "Frais", "de", "port"]
    colonne = p.locator(".col:has(.seg.port)").first
    assert SANS_ESPACES(colonne.get_attribute("aria-label")) == "juin 2026 : 400 € de tableaux et 28,50 € de frais de port, 1 vente"
    colonne.hover(); p.wait_for_timeout(150)
    assert "428,50" in p.locator("#infobulle").inner_text()
    p.locator(".graphe .col").nth(2).click(); p.wait_for_timeout(250)
    assert p.locator(".vente").count() == 2 and p.locator(".actif").inner_text().strip() == "Période : mars 2026"
    p.click('[data-retirer="periode"]'); p.wait_for_timeout(250)
    assert p.locator(".vente").count() == 8 and p.locator('.graphe .col[aria-pressed="true"]').count() == 0
    p.click('[data-grain="annee"]'); p.wait_for_timeout(250); assert p.locator(".graphe .col").count() == 2
    assert not deborde(p)


def test_filtres_des_ventes(ouvrir):
    p = ouvrir()
    js(p, "vueVentes()"); p.wait_for_timeout(900)
    titres = lambda: p.locator(".vente .titre").all_inner_texts()
    resume = lambda: SANS_ESPACES(p.locator("#v-resume").inner_text())
    p.fill("#v-q", "maree"); p.wait_for_timeout(350); assert titres() == ["Marée basse à Cancale"]
    p.fill("#v-q", ""); p.wait_for_timeout(350)
    p.select_option("#v-tri", "prix-asc"); assert titres()[0] == "83187" and titres()[-1] == "83159"
    p.select_option("#v-tri", "date-desc")
    p.click("#v-filtres"); assert p.locator("#v-panneau").is_visible()
    p.fill("#vf-du", "2026-09-01"); p.fill("#vf-au", "2026-03-01"); p.click("#v-panneau button[type=submit]")
    assert "postérieure" in p.locator("#vf-erreur").inner_text()
    p.fill("#vf-du", "2026-01-01"); p.fill("#vf-au", "2026-12-31"); p.fill("#vf-min", "500"); p.fill("#vf-max", "400"); p.click("#v-panneau button[type=submit]")
    assert "supérieur au prix maximum" in p.locator("#vf-erreur").inner_text()
    p.fill("#vf-min", "400"); p.fill("#vf-max", "700"); p.select_option("#vf-port", "avec"); p.click("#v-panneau button[type=submit]"); p.wait_for_timeout(150)
    assert titres() == ["Titre 1", "Marée basse à Cancale"] and p.locator("#v-panneau").is_hidden()
    assert resume() == "2 ventes sur 8 : 1 100 € de tableaux et 57 € de frais de port."
    assert p.locator("#v-nb").inner_text() == "3" and p.locator(".actif").count() == 3
    p.click('[data-retirer="port"]'); assert p.locator(".vente").count() == 4
    p.locator(".vente").first.click(); p.wait_for_timeout(500); p.click("#retour"); p.wait_for_timeout(900)
    assert p.locator(".vente").count() == 4, "les filtres sont conservés après un aller-retour sur une fiche"
    p.click("#v-tout"); p.wait_for_timeout(100); assert p.locator(".vente").count() == 8
    p.click("#v-filtres"); p.fill("#vf-min", "5000"); p.click("#v-panneau button[type=submit]"); p.wait_for_timeout(100)
    assert "Aucune vente ne correspond" in p.locator(".vide-filtre").inner_text() and p.locator("#v-export").is_disabled()
    p.click("#v-tout-2"); assert p.locator(".vente").count() == 8
    assert not deborde(p)


def test_export_csv(ouvrir):
    p = ouvrir()
    js(p, """window.__db.oeuvres[0].titre = '=SOMME(A1);"test"'; vueVentes()"""); p.wait_for_timeout(900)
    with p.expect_download() as d: p.click("#v-export")
    brut = open(d.value.path(), "rb").read()
    assert brut[:3] == b"\xef\xbb\xbf", "BOM attendu pour Excel"
    lignes = brut.decode("utf-8-sig").strip().split("\r\n")
    assert lignes[0].startswith("Date de vente;Titre;Nature;Technique;") and len(lignes) == 9
    assert lignes[1] == "30/10/2026;Titre 1;Original;Acrylique;700;700;28,5;Envoi;728,5;Complète"
    assert "\"'=SOMME(A1);\"\"test\"\"\"" in brut.decode("utf-8"), "une formule dans un titre doit être neutralisée"
    assert re.fullmatch(r"ventes-pauline-bonnete-\d{4}-\d{2}-\d{2}\.csv", d.value.suggested_filename)


# ---------- Administration ----------
def test_tarifs_de_port(ouvrir):
    p = ouvrir()
    js(p, "vueAdmin()"); p.wait_for_timeout(600)
    assert p.locator("#tarifs-port").is_hidden(), "les tarifs sont dans la sous-rubrique Frais de port"
    p.click('[data-onglet="vente"]')
    champ = lambda cle, quoi: f'[data-tarif="{cle}"][data-quoi="{quoi}"]'
    p.fill(champ("petit", "montant"), "douze"); p.click("#tp-enregistrer"); p.wait_for_timeout(150)
    assert "doit être un nombre" in p.locator("#tp-erreur").inner_text()
    p.fill(champ("petit", "montant"), "18,50"); p.fill(champ("moyen", "libelle"), ""); p.click("#tp-enregistrer"); p.wait_for_timeout(150)
    assert "libellé" in p.locator("#tp-erreur").inner_text()
    p.fill(champ("moyen", "libelle"), "Moyen format"); p.click("#tp-enregistrer"); p.wait_for_timeout(600)
    assert p.locator("#alerte").inner_text() == "Tarifs de frais de port enregistrés."
    assert p.get_attribute('[data-onglet="vente"]', "aria-selected") == "true" and p.locator("#tarifs-port").is_visible(), "on reste dans la même sous-rubrique"
    assert base(p, "tarifs_port.map(t => [t.libelle, t.montant_eur])")[:2] == [["Petit", 18.5], ["Moyen format", 28.5]]
    assert base(p, "oeuvres.find(o => o.id === 'o3').port_facture_eur") == 28.5, "les ventes passées ne changent pas"


def test_sous_rubriques_de_l_administration(ouvrir):
    p = ouvrir()
    js(p, "vueAdmin()"); p.wait_for_timeout(600)
    assert p.locator("#adm-onglets [role=tab]").all_inner_texts() == ["Œuvres", "Frais de port", "Certificats", "Maintenance"]
    visibles = lambda: p.evaluate("[...document.querySelectorAll('.adm-panneau')].filter(x => !x.hidden).map(x => x.id)")
    assert visibles() == ["adm-fiches"] and p.locator("#n-ajouter").is_visible()
    p.click('[data-onglet="certificats"]'); assert visibles() == ["adm-certificats"] and "Signature" in p.locator("#adm-certificats").inner_text()
    p.keyboard.press("ArrowRight"); assert visibles() == ["adm-maintenance"]
    assert p.locator("#corbeille").is_visible() and p.locator("#revoir-tuto").is_visible()
    js(p, "vueFiche('o1')"); p.wait_for_timeout(500); js(p, "vueAdmin()"); p.wait_for_timeout(600)
    assert visibles() == ["adm-maintenance"], "la sous-rubrique est conservée au retour"
    assert not deborde(p)


def test_listes_de_choix(ouvrir):
    p = ouvrir()
    js(p, "etat.adminOuvert = 'c1'; vueAdmin()"); p.wait_for_timeout(500)
    coche = p.locator('[data-action="renommer"]').first
    assert not coche.is_enabled()
    p.fill('[data-option="0"]', "Acrylique mate"); assert coche.is_enabled()
    assert not deborde(p)


# ---------- Certificats ----------
def test_emission_d_un_certificat(ouvrir):
    p = ouvrir()
    js(p, "vueCertificatNouveau('o0')"); p.wait_for_timeout(700)
    assert p.input_value("#c-annee") and p.input_value("#c-technique") and p.input_value("#c-dimensions"), "repris de la fiche"
    p.fill("#c-date", "2026-11-11"); p.fill("#c-email", "pas-un-mail"); p.click("#c-emettre"); p.wait_for_timeout(150)
    assert p.locator("#alerte").inner_text().strip(), "une adresse e-mail invalide est refusée"
    p.fill("#c-prenom", "Jean"); p.fill("#c-nom", "Dupont"); p.fill("#c-email", "jean.dupont@exemple.fr")
    p.click("#c-emettre"); p.wait_for_timeout(200); p.click('.dialogue [data-r="oui"]'); p.wait_for_timeout(900)
    emis = base(p, "certificats.filter(c => c.oeuvre_id === 'o0' && c.statut === 'valide').map(c => [c.numero, c.acheteur_nom])")
    assert emis == [["PB-2026-0002", "Dupont"]]
    assert "Dupont" not in str(base(p, "certificats.find(c => c.numero === 'PB-2026-0002').donnees")), "aucun nom d'acheteur dans le certificat"


# ---------- Tutoriel ----------
def test_tutoriel_premiere_connexion(ouvrir):
    p = ouvrir("?premiere=1", 2600)
    assert p.locator(".tuto-carte").count() == 1
    assert p.locator(".tuto-avancement span").count() == 8
    p.click('[data-tuto="passer"]'); p.wait_for_timeout(300)
    assert p.locator(".tuto-carte").count() == 0 and base(p, "membres[0].tutoriel_vu") is True


# ---------- Toutes les vues s'affichent sans erreur ni débordement ----------
def test_toutes_les_vues(ouvrir):
    p = ouvrir()
    for vue in ["vueFiche('o0')", "vueFiche(null)", "etat.modifie = false; vueAdmin()", "vueCorbeille()", "vueImport()", "vueVentes()",
                "vueCertificats()", "vueCertificat('k1')", "vueAcheteurs()", "vueAcheteur('a1')", "etat.vue = 'liste'; vueListe()"]:
        js(p, vue); p.wait_for_timeout(500)
        assert p.locator("#app").inner_text().strip(), vue
        assert not deborde(p), f"débordement horizontal : {vue}"


# ---------- Navigation ----------
def test_menu_sur_telephone(ouvrir, ecran):
    p = ouvrir()
    if ecran == "ordinateur":
        assert p.locator("#menu").is_hidden() and p.locator('#lateral [data-nav="certificats"]').is_visible()
        return
    lien = p.locator('#lateral [data-nav="certificats"]')
    assert not lien.is_visible(), "menu fermé au départ"
    p.click("#menu"); p.wait_for_timeout(400)
    assert lien.is_visible() and p.get_attribute("#menu", "aria-expanded") == "true"
    p.keyboard.press("Escape"); p.wait_for_timeout(400); assert not lien.is_visible()
    p.click("#menu"); p.wait_for_timeout(400); lien.click(); p.wait_for_timeout(600)
    assert p.locator("h1").inner_text() == "Certificats d'authenticité"
    assert not p.evaluate("document.body.classList.contains('menu-ouvert')")
    assert not deborde(p)


# ---------- Acheteurs ----------
def test_fichier_des_acheteurs(ouvrir):
    p = ouvrir()
    js(p, "vueAcheteurs()"); p.wait_for_timeout(700)
    lignes = [SANS_ESPACES(t).replace("\n", " | ") for t in p.locator("#liste-acheteurs .vente").all_inner_texts()]
    assert lignes[0].startswith("PD | Paul Durand") and "Aucun achat rattaché" in lignes[0]
    assert "Hélène Martin" in lignes[1] and "1 100 €" in lignes[1] and "2 achats" in lignes[1]
    p.fill("#ach-q", "helene"); p.wait_for_timeout(350); assert p.locator("#liste-acheteurs .vente").count() == 1
    p.fill("#ach-q", ""); p.wait_for_timeout(350)
    # création : erreurs puis enregistrement
    p.click("#ach-ajouter"); p.wait_for_timeout(400)
    p.click("#ach-valider"); assert "au moins un prénom" in p.locator("#alerte").inner_text()
    p.fill("#ach-nom", "Le Gall"); p.fill("#ach-email", "pas-un-mail"); p.click("#ach-valider")
    assert "e-mail n'est pas valide" in p.locator("#alerte").inner_text()
    p.fill("#ach-email", "Yann.LeGall@Exemple.fr"); p.click("#ach-valider"); p.wait_for_timeout(600)
    assert "a été ajouté" in p.locator("#alerte").inner_text()
    assert base(p, "acheteurs.find(a => a.nom === 'Le Gall').email") == "yann.legall@exemple.fr"
    # fiche d'un acheteur : ses achats, puis suppression (les ventes restent)
    p.locator("#liste-acheteurs .vente", has_text="Hélène Martin").click(); p.wait_for_timeout(600)
    assert p.locator("#ach-achats .vente").count() == 2
    p.click("#ach-supprimer"); p.wait_for_timeout(2400); p.click('.dialogue [data-r="oui"]'); p.wait_for_timeout(600)
    assert base(p, "acheteurs.some(a => a.id === 'a1')") is False
    assert base(p, "oeuvres.find(o => o.id === 'o3').statut") == "vendu" and base(p, "oeuvres.find(o => o.id === 'o3').acheteur_id") is None
    assert not deborde(p)


def test_acheteur_depuis_la_fiche(ouvrir):
    p = ouvrir()
    o = "oeuvres.find(o => o.id === 'o0')"
    js(p, "vueFiche('o0')"); p.wait_for_timeout(600)     # œuvre vendue, sans acheteur
    assert p.input_value("#acheteur") == ""
    p.select_option("#acheteur", "a2"); p.click("#valider"); p.wait_for_timeout(600)
    assert base(p, o + ".acheteur_id") == "a2"
    js(p, "vueFiche('o0')"); p.wait_for_timeout(600)
    p.select_option("#acheteur", "__nouveau"); assert p.locator("#acheteur-nouveau").is_visible()
    p.click("#valider"); p.wait_for_timeout(200); assert "nouvel acheteur" in p.locator("#alerte .message").inner_text()
    p.fill("#na-prenom", "Anne"); p.fill("#na-nom", "Riou"); p.click("#valider"); p.wait_for_timeout(700)
    assert base(p, "acheteurs.find(a => a.id === window.__db." + o + ".acheteur_id).nom") == "Riou"
    # le certificat reprend l'acheteur de la vente
    js(p, "vueCertificatNouveau('o0')"); p.wait_for_timeout(800)
    assert [p.input_value("#c-prenom"), p.input_value("#c-nom")] == ["Anne", "Riou"]
    # quitter le statut « Vendu » détache l'acheteur
    js(p, "etat.modifie = false; vueFiche('o0')"); p.wait_for_timeout(600)
    p.select_option("#statut", "disponible"); p.click("#valider"); p.wait_for_timeout(600)
    assert base(p, o + ".acheteur_id") is None


# ---------- Photos complémentaires ----------
import base64
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP8z8Dwn4EIwESMolGFAEo5AQ9XtVgkAAAAAElFTkSuQmCC")


def test_photos_complementaires(ouvrir):
    p = ouvrir()
    photos = lambda: base(p, "photos_oeuvre.filter(x => x.oeuvre_id === 'o0').map(x => x.photo_path)")
    js(p, "vueFiche('o0')"); p.wait_for_timeout(700)
    assert p.locator(".galerie figure").count() == 2 and "2 sur 8" in p.locator(".galerie-titre").inner_text()
    p.set_input_files("#photos-plus", [{"name": f"detail-{i}.png", "mimeType": "image/png", "buffer": PNG} for i in range(2)]); p.wait_for_timeout(1200)
    assert p.locator(".galerie figure").count() == 4 and "2 photos ajoutées" in p.locator("#galerie-message").inner_text()
    assert len(photos()) == 4 and all(c.startswith("o0/plus-") for c in photos()[2:])
    assert p.evaluate("etat.modifie") is False, "ajouter une photo ne marque pas la fiche comme modifiée"
    # suppression
    p.locator('.galerie figure [data-g="supprimer"]').last.click(); p.wait_for_timeout(2400); p.click('.dialogue [data-r="oui"]'); p.wait_for_timeout(500)
    assert len(photos()) == 3
    # photo principale : refusée tant que la fiche a des modifications, puis échange
    p.fill("#titre", "Girafe modifiée"); p.locator('.galerie figure [data-g="principale"]').first.click(); p.wait_for_timeout(300)
    assert "Enregistrez d'abord la fiche" in p.locator("#galerie-message").inner_text()
    js(p, "etat.modifie = false; vueFiche('o0')"); p.wait_for_timeout(700)
    p.locator('.galerie figure [data-g="principale"]').first.click(); p.wait_for_timeout(900)
    assert base(p, "oeuvres.find(o => o.id === 'o0').photo_path") == "p5"
    assert photos()[0] == "p0", "l'ancienne photo principale devient une photo complémentaire"
    assert p.locator(".bandeau").inner_text() == "Photo principale changée"
    assert not deborde(p)


def test_limite_de_photos(ouvrir):
    p = ouvrir()
    js(p, "vueFiche('o0')"); p.wait_for_timeout(700)
    p.set_input_files("#photos-plus", [{"name": f"p{i}.png", "mimeType": "image/png", "buffer": PNG} for i in range(9)]); p.wait_for_timeout(2500)
    assert p.locator(".galerie figure").count() == 8 and p.locator(".galerie-ajout").count() == 0
    assert "3 non envoyées" in p.locator("#galerie-message").inner_text()
