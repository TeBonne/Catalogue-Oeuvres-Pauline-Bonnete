"""Estampille chaque feuille de style et chaque script de index.html avec l'empreinte de son contenu (?v=xxxxxxxx).

Pourquoi : GitHub Pages laisse les navigateurs garder les fichiers quelques minutes. Sans estampille, juste après une
publication, une page neuve pouvait charger d'anciens scripts. Avec elle, un fichier modifié change d'adresse.

    python outils/versionner.py            # met index.html à jour (à lancer avant chaque commit)
    python outils/versionner.py --verifier  # échoue si une estampille n'est pas à jour (utilisé par les tests)
"""
import hashlib, pathlib, re, sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
MOTIF = re.compile(r'(?P<attr>href|src)="(?P<chemin>(?:css|js|lib)/[^"?]+)(?:\?v=[0-9a-f]+)?"')


def estampiller(html):
    def remplacer(m):
        empreinte = hashlib.sha1((RACINE / m["chemin"]).read_bytes()).hexdigest()[:8]
        return f'{m["attr"]}="{m["chemin"]}?v={empreinte}"'
    return MOTIF.sub(remplacer, html)


if __name__ == "__main__":
    page = RACINE / "index.html"
    avant = page.read_text(encoding="utf-8"); apres = estampiller(avant)
    if "--verifier" in sys.argv:
        sys.exit(0 if avant == apres else "index.html : estampilles périmées, lancez python outils/versionner.py")
    page.write_text(apres, encoding="utf-8")
    print("index.html", "mis à jour" if avant != apres else "déjà à jour")
