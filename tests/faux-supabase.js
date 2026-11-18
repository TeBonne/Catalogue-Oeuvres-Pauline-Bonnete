(function () {
  const couleurs = ["#c98b6b","#7d9a8c","#d9b44a","#6c7a9c","#b5651d","#8e6c8a","#4f7c6b","#c0504d","#9aa66b","#5b8fb0","#d08c9e","#7a6a53","#a3b7c9","#e0a86a"];
  const img = (i, w, h) => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${couleurs[i % couleurs.length]}"/><circle cx="${w*0.35}" cy="${h*0.4}" r="${Math.min(w,h)*0.22}" fill="rgba(255,255,255,.35)"/><rect x="${w*0.5}" y="${h*0.55}" width="${w*0.35}" height="${h*0.3}" fill="rgba(0,0,0,.18)"/></svg>`);
  const titres = ["Girafe","Bouquet de pivoines sur fond bleu nuit","83187","Marée basse à Cancale","83183","Portrait de Jeanne","Les toits de Paris au petit matin","83173","Nature morte aux citrons","Titre 1","Forêt de Rambouillet","83159","Champ de coquelicots","Chat endormi"];
  const statuts = ["vendu","a_completer","vendu","vendu","a_completer","vendu","vendu","a_completer","pas_a_vendre","vendu","vendu","vendu","disponible","disponible"];
  const dv = ["2026-03-14",null,"2026-03-28","2026-06-02",null,"2025-11-20","2026-09-09",null,null,"2026-10-30",null,"2024-05-18",null,null];
  const pvd = [450,null,300,400,null,480,620,null,null,700,350,null,null,null];
  const tech = ["Aquarelle","Acrylique",null,"Peinture à l'huile",null,"Pastel","Acrylique",null,"Aquarelle","Acrylique","Peinture à l'huile",null,"Aquarelle","Pastel"];
  const db = {
    membres: [{ email: "antoine.bonnete@gmail.com", admin: true, tutoriel_vu: !location.search.includes("premiere") }],
    champs: [
      { id: "c1", cle: "technique", libelle: "Technique", type: "liste", options: ["Acrylique","Aquarelle","Pastel","Peinture à l'huile"], ordre: 1, systeme: true },
      { id: "c2", cle: "support", libelle: "Support", type: "liste", options: ["Toile","Papier type Canson","Bois"], ordre: 2, systeme: true },
      { id: "c3", cle: "nature", libelle: "Nature", type: "liste", options: ["Original","Commande","Reproduction"], ordre: 3, systeme: true },
      { id: "c4", cle: null, libelle: "Lieu de stockage", type: "texte", options: [], ordre: 4, systeme: false },
      { id: "c5", cle: null, libelle: "Signée", type: "case", options: [], ordre: 5, systeme: false }
    ],
    reglages: [{ id: 1, artiste: "Pauline Bonneté", lieu_emission: "Vannes", signature_path: "signature/s.png",
      texte_original: "Ce certificat garantit que cette œuvre est une création unique et originale. La vente de cette œuvre n'entraîne pas la cession des droits de reproduction et de représentation, qui restent la propriété exclusive de l'artiste, conformément au Code de la propriété intellectuelle.",
      texte_reproduction: "Ce certificat garantit que cette œuvre est une reproduction autorisée par l'artiste d'une de ses créations originales." }],
    certificats: [
      { id: "k1", annee: 2026, sequence: 1, numero: "PB-2026-0001", code_verif: "0123456789abcdef0123456789abcdef", oeuvre_id: "o3", emis_le: "2026-06-02", lieu: "Vannes", statut: "valide",
        donnees: { artiste: "Pauline Bonneté", titre: "Marée basse à Cancale", annee: "2023", technique: "Peinture à l'huile sur toile", dimensions: "33 cm × 43 cm", emplacement_signature: "En bas à droite", nature: "Original", texte: "Ce certificat garantit que cette œuvre est une création unique et originale." },
        photo_path: "certificats/k1/photo.jpg", acheteur_prenom: "Claire", acheteur_nom: "Martin", acheteur_email: "claire.martin@exemple.fr", annule_le: null, email_prepare_le: null },
      { id: "k0", annee: 2025, sequence: 1, numero: "PB-2025-0001", code_verif: "abcdef0123456789abcdef0123456789", oeuvre_id: "o5", emis_le: "2025-11-20", lieu: "Vannes", statut: "annule",
        donnees: { artiste: "Pauline Bonneté", titre: "Portrait de Jeanne", annee: "2025", technique: "Pastel sur toile", dimensions: "35 cm × 45 cm", emplacement_signature: null, nature: "Original", texte: "Ce certificat garantit que cette œuvre est une création unique et originale." },
        photo_path: "certificats/k0/photo.jpg", acheteur_prenom: null, acheteur_nom: null, acheteur_email: null, annule_le: "2025-11-22T10:00:00Z", email_prepare_le: null }
    ],
    tarifs_port: [{ cle: "petit", libelle: "Petit", montant_eur: 15, ordre: 1 }, { cle: "moyen", libelle: "Moyen", montant_eur: 28.5, ordre: 2 }, { cle: "gros", libelle: "Gros", montant_eur: 45, ordre: 3 }, { cle: "tres_gros", libelle: "Très gros", montant_eur: 0, ordre: 4 }],
    acheteurs: [{ id: "a1", prenom: "Hélène", nom: "Martin", email: "helene.martin@exemple.fr", telephone: null, ville: "Vannes", notes: null },
      { id: "a2", prenom: "Paul", nom: "Durand", email: null, telephone: "06 00 00 00 00", ville: null, notes: "Collectionneur" }],
    oeuvres: titres.map((t, i) => ({
      acheteur_id: i === 3 || i === 9 ? "a1" : null,
      port_type: statuts[i] === "vendu" && i % 2 ? "moyen" : null, port_facture_eur: statuts[i] === "vendu" && i % 2 ? 28.5 : null,
      id: "o" + i, titre: t, statut: statuts[i], technique: tech[i], support: tech[i] ? (i % 2 ? "Toile" : "Papier type Canson") : null, nature: tech[i] ? "Original" : null,
      serie: i % 3 === 0 ? "Bord de mer" : null, hauteur_cm: tech[i] ? 30 + i : null, largeur_cm: tech[i] ? 40 + i : null, annee: tech[i] ? 2020 + (i % 6) : null,
      prix_eur: tech[i] ? 250 + i * 50 : null, prix_masque: i === 3, encadre: null, notes_privees: null, photo_path: "p" + i, vignette_path: "v" + i,
      emplacement_signature: i === 0 ? "En bas à gauche" : null, description: null,
      fichier_origine: "IMG_" + (8300 + i) + ".jpg", poids_photo_octets: 120000 + i * 3000, poids_origine_octets: i > 9 ? 2400000 : null, champs_perso: {},
      prix_vendu_eur: statuts[i] === "vendu" ? pvd[i] : null, date_vente: statuts[i] === "vendu" ? dv[i] : null,
      supprime_le: i >= 12 ? "2026-11-1" + (i - 8) + "T10:00:00Z" : null, cree_le: "2026-11-17T1" + (i % 10) + ":00:00Z"
    }))
  };
  function Q(table) {
    let charge = null, rows = db[table].slice(), head = false, wantCount = false, single = false, range = null, op = "select";
    const q = {
      select(_, o) { if (o && o.count) wantCount = true; if (o && o.head) head = true; return q; },
      insert(v) { op = "i"; charge = v; return q; }, update(v) { op = "u"; charge = v; return q; }, delete() { op = "d"; return q; },
      in(c, l) { rows = rows.filter((r) => l.includes(r[c])); return q; },
      eq(c, v) { rows = rows.filter((r) => r[c] === v); return q; },
      is(c, v) { rows = rows.filter((r) => (r[c] ?? null) === v); return q; },
      not(c, o, v) { rows = rows.filter((r) => (r[c] ?? null) !== v); return q; },
      or() { return q; },
      order(c, o = {}) { // tri stable, enchaînable, valeurs absentes en fin (nullsFirst: false)
        (window.__ordres = window.__ordres || []).push([table, c, o.ascending !== false, o.nullsFirst]);
        const col = c === "titre_tri" ? "titre" : c, asc = o.ascending !== false, cmp = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
        const cles = (q.__cles = q.__cles || []); cles.push([col, asc]);
        rows = rows.map((r, i) => [r, i]).sort((a, b) => {
          for (const [k, s] of cles) {
            const x = a[0][k] ?? null, y = b[0][k] ?? null;
            if (x === null && y === null) continue; if (x === null) return 1; if (y === null) return -1;
            const d = typeof x === "number" ? x - y : cmp.compare(String(x), String(y));
            if (d) return s ? d : -d;
          }
          return a[1] - b[1];
        }).map((p) => p[0]);
        return q;
      }, limit(n) { rows = rows.slice(0, n); return q; },
      range(a, b) { range = [a, b]; return q; }, single() { single = true; return q; },
      then(ok) { if (op === "u") rows.forEach((r) => Object.assign(r, charge));
        if (op === "i") { rows = [].concat(charge).map((x) => ({ id: x.id || crypto.randomUUID(), ...JSON.parse(JSON.stringify(x)) })); db[table].push(...rows); }
        if (op === "d") { db[table] = db[table].filter((r) => !rows.includes(r)); if (table === "acheteurs") db.oeuvres.forEach((o) => { if (rows.some((r) => r.id === o.acheteur_id)) o.acheteur_id = null; }); } const count = rows.length; let data = range ? rows.slice(range[0], range[1] + 1) : rows; if (single) data = data[0]; if (head) data = null; if (data) data = JSON.parse(JSON.stringify(data)); /* comme une vraie API : des copies */ return Promise.resolve({ data, count: wantCount ? count : null, error: null }).then(ok); }
    };
    return q;
  }
  const depots = new Map();
  const sb = {
    auth: {
      onAuthStateChange(cb) {
        const h = location.hash, session = (h === "#connexion" || h.includes("error")) ? null : { user: { id: "u1", email: "antoine.bonnete@gmail.com" } };
        setTimeout(() => cb(h.includes("type=recovery") ? "PASSWORD_RECOVERY" : "SIGNED_IN", session), 0);
        if (h.includes("type=recovery")) setTimeout(() => cb("INITIAL_SESSION", session), 30); // comme la vraie bibliothèque : deux événements
      },
      signOut() {}, signInWithPassword: async () => ({ error: { message: "Invalid login credentials" } }), signUp: async () => ({ data: {}, error: null }),
      resetPasswordForEmail: async (email, o) => { window.__reset = { email, redirectTo: o.redirectTo }; return email.startsWith("trop") ? { error: { status: 429, message: "email rate limit exceeded" } } : { data: {}, error: null }; },
      updateUser: async (v) => { window.__maj_mdp = v.password.length; return v.password === "ancien-mot-de-passe" ? { error: { message: "New password should be different from the old password." } } : { data: {}, error: null }; },
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "antoine.bonnete@gmail.com" } } } })
    },
    from: (t) => Q(t),
    rpc: async (nom, a) => {
      if (nom !== "emettre_certificat") return { data: 0, error: null };
      const annee = +a.p_date.slice(0, 4), seq = 1 + Math.max(0, ...db.certificats.filter((c) => c.annee === annee).map((c) => c.sequence));
      const c = { id: a.p_id, annee, sequence: seq, numero: `PB-${annee}-${String(seq).padStart(4, "0")}`, code_verif: "fedcba9876543210fedcba9876543210", oeuvre_id: a.p_oeuvre,
        emis_le: a.p_date, lieu: a.p_lieu || null, donnees: a.p_donnees, photo_path: a.p_photo, acheteur_prenom: a.p_prenom || null, acheteur_nom: a.p_nom || null,
        acheteur_email: a.p_email || null, statut: "valide", annule_le: null, email_prepare_le: null };
      db.certificats.push(c); return { data: JSON.parse(JSON.stringify(c)), error: null };
    },
    storage: { from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: img(parseInt(p.slice(1)) || 0, p[0] === "p" ? 800 : [480, 300, 480, 360][(parseInt(p.slice(1)) || 0) % 4], p[0] === "p" ? 1000 : [480, 480, 280, 480][(parseInt(p.slice(1)) || 0) % 4]) } }), upload: async (chemin, blob) => { depots.set(chemin, blob); return { error: null }; }, remove: async () => ({}),
      download: async (chemin) => {
        const c = document.createElement("canvas"), x = c.getContext("2d");
        if (chemin.startsWith("signature/")) { // une signature tracée à l'encre, sur fond transparent
          c.width = 600; c.height = 220; x.strokeStyle = "#141a3a"; x.lineWidth = 7; x.lineCap = "round"; x.beginPath();
          x.moveTo(60, 150); x.bezierCurveTo(140, 20, 200, 210, 250, 90); x.bezierCurveTo(280, 30, 330, 190, 380, 110); x.bezierCurveTo(430, 60, 470, 150, 560, 70); x.stroke();
          return { data: await new Promise((r) => c.toBlob(r, "image/png")), error: null };
        }
        const n = parseInt((chemin.match(/k(\d)/) || [0, 0])[1]) || 0; c.width = 900; c.height = 1200;
        const im = new Image(); im.src = img(n + 3, 900, 1200); await im.decode(); x.drawImage(im, 0, 0);
        return { data: await new Promise((r) => c.toBlob(r, "image/jpeg", .85)), error: null };
      } }) }
  };
  window.__db = db; window.supabase = { createClient: () => sb };
})();
