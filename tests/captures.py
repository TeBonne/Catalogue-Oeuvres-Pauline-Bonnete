"""Captures d'écran du back-office sur la fausse base, pour contrôler visuellement une évolution.

    python tests/captures.py dossier                      # toutes les vues, téléphone et ordinateur
    python tests/captures.py dossier "nom=vueVentes()"    # une vue précise (code JavaScript exécuté dans la page)
"""
import functools, http.server, os, pathlib, sys, threading
from playwright.sync_api import sync_playwright

RACINE = pathlib.Path(__file__).resolve().parent.parent
FAUX = (RACINE / "tests" / "faux-supabase.js").read_text(encoding="utf-8")
VUES = [("catalogue", ""), ("catalogue-liste", "etat.vue = 'liste'; vueListe()"), ("fiche", "vueFiche('o0')"), ("fiche-neuve", "vueFiche(null)"),
        ("administration", "etat.modifie = false; vueAdmin()"), ("corbeille", "vueCorbeille()"), ("import", "vueImport()"), ("ventes", "vueVentes()"),
        ("certificats", "vueCertificats()"), ("certificat", "vueCertificat('k1')"), ("certificat-nouveau", "vueCertificatNouveau('o0')")]


class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    sortie = pathlib.Path(sys.argv[1]); sortie.mkdir(parents=True, exist_ok=True)
    vues = [tuple(a.split("=", 1)) for a in sys.argv[2:]] or VUES
    serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Silencieux, directory=str(RACINE)))
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    site = f"http://127.0.0.1:{serveur.server_address[1]}/"
    with sync_playwright() as p:
        nav = p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for nom, (l, h) in {"telephone": (390, 844), "ordinateur": (1280, 800)}.items():
            page = nav.new_context(viewport={"width": l, "height": h}, reduced_motion="reduce").new_page()
            erreurs = []; page.on("pageerror", lambda e: erreurs.append(str(e)))
            page.route("https://cdn.jsdelivr.net/npm/@supabase/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
            if not sys.argv[2:]:
                page.goto(site + "#connexion"); page.wait_for_timeout(700); page.screenshot(path=str(sortie / f"{nom}-connexion.png"))
                page.goto("about:blank")
            page.goto(site); page.wait_for_timeout(900)
            for vue, code in vues:
                if code:
                    try: page.evaluate("(() => { " + code + "; return 1; })()")
                    except Exception as e: print(nom, vue, "ÉCHEC :", str(e).split("\n")[0][:120])
                page.wait_for_timeout(900)
                page.screenshot(path=str(sortie / f"{nom}-{vue}.png"), full_page=True)
            if erreurs: print(nom, "ERREURS JS :", erreurs[:5])
        nav.close()
    serveur.shutdown()


main()
