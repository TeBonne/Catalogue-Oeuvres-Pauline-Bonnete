"use strict";
/* Import en lot de photos : une œuvre créée par fichier. */

/* ---------- Import en lot ---------- */
async function fichiersDejaImportes() {
  const noms = new Set();
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await sb.from("oeuvres").select("fichier_origine").not("fichier_origine", "is", null).order("id").range(debut, debut + 999);
    if (error) throw error;
    data.forEach((d) => noms.add(d.fichier_origine));
    if (data.length < 1000) break;
  }
  return noms;
}

function vueImport() {
  etat.gardien = null; etat.modifie = false; etat.retour = null; etat.section = "import"; arriver();
  document.body.classList.remove("barre-visible");
  window.scrollTo(0, 0);
  app.innerHTML = `
    ${entete("Import en lot")}
    <div class="carte etroit">
      <p>Sélectionnez plusieurs photos : une fiche « À compléter » est créée par photo, avec le nom du fichier comme titre provisoire.</p>
      <p class="sous">Les photos sont compressées avant l'envoi ; les originaux restent sur l'appareil. Un fichier dont le nom a déjà été importé est ignoré, ce qui permet de reprendre un import interrompu. Gardez cette page ouverte pendant l'import.</p>
      <label class="zone-photo" for="lot" id="zone">Choisir les photos</label>
      <input class="cache" id="lot" type="file" accept="image/*" multiple>
      <div id="suivi" hidden style="margin-top:16px">
        <progress id="barre" value="0" max="1"></progress>
        <p id="etatImport" aria-live="polite"></p>
        <ul class="journal" id="journal"></ul>
      </div>
      <button class="btn plein large" id="lancer" disabled style="margin-top:16px">Lancer l'import</button>
    </div>`;
  let enCours = false;
  $("#retour").addEventListener("click", () => { if (!enCours) vueListe(); });
  let fichiers = [];
  $("#lot").addEventListener("change", (e) => {
    fichiers = [...e.target.files];
    $("#zone").textContent = fichiers.length ? `${fichiers.length} photo${fichiers.length > 1 ? "s" : ""} sélectionnée${fichiers.length > 1 ? "s" : ""}` : "Choisir les photos";
    $("#lancer").disabled = !fichiers.length;
  });
  $("#lancer").addEventListener("click", async () => {
    if (enCours || !fichiers.length) return;
    enCours = true; etat.occupe = true; $("#lancer").disabled = true; $("#suivi").hidden = false; $("#journal").innerHTML = "";
    const maj = (t) => { $("#etatImport").textContent = t; };
    let faits = 0, ignores = 0, erreurs = 0, traites = 0;
    try {
      maj("Vérification des fichiers déjà importés…");
      const deja = await fichiersDejaImportes();
      const file = fichiers.filter((f) => { if (deja.has(f.name)) { ignores++; return false; } deja.add(f.name); return true; });
      const total = file.length; $("#barre").max = Math.max(1, total);
      const suivant = async () => {
        for (let f; (f = file.shift()); ) {
          try {
            const id = crypto.randomUUID();
            const chemins = await envoyerPhoto(id, f);
            const { error } = await sb.from("oeuvres").insert({ id, titre: f.name.replace(/\.[^.]+$/, "") || "Sans titre", fichier_origine: f.name, ...chemins });
            if (error) { await sb.storage.from(BUCKET).remove([chemins.photo_path, chemins.vignette_path]); throw error; }
            faits++;
          } catch (err) {
            erreurs++; const li = document.createElement("li"); li.textContent = `${f.name} : ${err.message || err}`; $("#journal").append(li);
          }
          traites++; $("#barre").value = traites;
          maj(`${traites} / ${total} traitées — ${faits} importées, ${erreurs} en erreur, ${ignores} déjà présentes`);
        }
      };
      await Promise.all([suivant(), suivant(), suivant()]);
      maj(`Import terminé : ${faits} importées, ${erreurs} en erreur, ${ignores} déjà présentes (ignorées).`);
    } catch (err) { maj("Import interrompu : " + (err.message || err)); }
    enCours = false; etat.occupe = false; fichiers = []; $("#lot").value = ""; $("#zone").textContent = "Choisir les photos";
  });
}

window.addEventListener("beforeunload", (e) => { if (etat.modifie || etat.occupe) { e.preventDefault(); e.returnValue = ""; } });
