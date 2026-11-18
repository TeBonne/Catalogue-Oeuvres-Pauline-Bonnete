"""Banc de test du back-office.

Le site est servi tel quel par un petit serveur local ; seule la bibliothèque Supabase est remplacée
par tests/faux-supabase.js, une fausse base en mémoire (window.__db). Aucun test ne touche la vraie base.
Chaque test est joué deux fois : téléphone (390 px) et ordinateur (1280 px).
"""
import functools, http.server, os, pathlib, threading
import pytest
from playwright.sync_api import sync_playwright

RACINE = pathlib.Path(__file__).resolve().parent.parent
FAUX = (RACINE / "tests" / "faux-supabase.js").read_text(encoding="utf-8")
ECRANS = {"telephone": (390, 844), "ordinateur": (1280, 800)}


class _Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@pytest.fixture(scope="session")
def site():
    serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Silencieux, directory=str(RACINE)))
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{serveur.server_address[1]}/"
    serveur.shutdown()


@pytest.fixture(scope="session")
def navigateur():
    with sync_playwright() as p:
        chemin = os.environ.get("CHROME")
        nav = p.chromium.launch(executable_path=chemin or None, args=["--no-sandbox"])
        yield nav
        nav.close()


@pytest.fixture(params=list(ECRANS))
def ecran(request):
    return request.param


@pytest.fixture
def ouvrir(site, navigateur, ecran):
    """Renvoie une fonction ouvrir(suffixe="") -> page chargée. Toute erreur JavaScript fait échouer le test."""
    largeur, hauteur = ECRANS[ecran]
    contexte = navigateur.new_context(viewport={"width": largeur, "height": hauteur}, accept_downloads=True)
    erreurs = []

    def _ouvrir(suffixe="", attente=800):
        page = contexte.new_page()
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.route("https://cdn.jsdelivr.net/npm/@supabase/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
        page.goto(site + suffixe)
        page.wait_for_timeout(attente)
        return page

    yield _ouvrir
    contexte.close()
    assert not erreurs, f"Erreurs JavaScript : {erreurs}"


def js(page, code):
    """Exécute du code dans la page sans attendre ni renvoyer sa valeur (utile pour appeler une vue)."""
    page.evaluate("(() => { " + code + "; return 1; })()")


def base(page, expression):
    """Lit la fausse base : base(page, "oeuvres.find(o => o.id === 'o1').statut")."""
    return page.evaluate("window.__db." + expression)


def deborde(page):
    return page.evaluate("document.documentElement.scrollWidth > innerWidth")
