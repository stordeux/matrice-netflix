/**
 * Backend de la collecte « Matrice Netflix » — à coller dans Google Sheets :
 *   Extensions > Apps Script, remplacer le contenu de Code.gs, enregistrer,
 *   exécuter une fois `initialiser`, puis Déployer > Nouveau déploiement >
 *   Application Web (Exécuter en tant que : moi ; Accès : tout le monde).
 *
 * Feuilles utilisées (créées par `initialiser`) :
 *   Config      : A1 = "phase", B1 = 1 | 2 | 0 (0 = collecte fermée)
 *   Propositions: horodatage | uid | film
 *   Catalogue   : film   (une ligne par film, rempli par l'enseignant en phase 2)
 *   Notes       : horodatage | uid | film | note
 */

const ss = () => SpreadsheetApp.getActiveSpreadsheet();

function feuille_(nom, entetes) {
  let sh = ss().getSheetByName(nom);
  if (!sh) {
    sh = ss().insertSheet(nom);
    if (entetes) sh.appendRow(entetes);
  }
  return sh;
}

function initialiser() {
  const cfg = feuille_('Config');
  if (!cfg.getRange('A1').getValue()) cfg.getRange('A1:B1').setValues([['phase', 1]]);
  feuille_('Propositions', ['horodatage', 'uid', 'film']);
  feuille_('Catalogue', ['film']);
  feuille_('Notes', ['horodatage', 'uid', 'film', 'note']);
}

/**
 * Fin de phase 1 : écrit dans la feuille « Catalogue_brut » les titres proposés
 * (regroupés sans tenir compte des majuscules/accents) triés par popularité.
 * L'enseignant corrige/fusionne à la main puis copie la liste retenue dans « Catalogue ».
 */
function construireCatalogue() {
  const v = feuille_('Propositions').getDataRange().getValues().slice(1);
  const cle = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(the|le|la|les|l')\s*/, '').replace(/[^a-z0-9]/g, '');
  const groupes = {};
  v.forEach(r => {
    const titre = String(r[2]).trim();
    const k = cle(titre);
    if (!k) return;
    if (!groupes[k]) groupes[k] = { titre: titre, n: 0 };
    groupes[k].n++;
  });
  const lignes = Object.values(groupes).sort((a, b) => b.n - a.n).map(g => [g.titre, g.n]);
  let sh = ss().getSheetByName('Catalogue_brut');
  if (sh) sh.clear(); else sh = ss().insertSheet('Catalogue_brut');
  sh.appendRow(['film', 'nb_propositions']);
  if (lignes.length) sh.getRange(2, 1, lignes.length, 2).setValues(lignes);
}

function phase_() {
  return Number(feuille_('Config').getRange('B1').getValue()) || 0;
}

function catalogue_() {
  const v = feuille_('Catalogue', ['film']).getDataRange().getValues().slice(1);
  return v.map(r => String(r[0]).trim()).filter(Boolean);
}

/** Dernière note de chaque (uid, film) : une ré-soumission écrase la précédente. */
function notes_() {
  const v = feuille_('Notes', ['horodatage', 'uid', 'film', 'note']).getDataRange().getValues().slice(1);
  const d = {};
  v.forEach(([, uid, film, note]) => {
    if (!d[uid]) d[uid] = {};
    if (note === '' || note === null) delete d[uid][film];
    else d[uid][film] = Number(note);
  });
  Object.keys(d).forEach(u => { if (!Object.keys(d[u]).length) delete d[u]; });
  return d;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function csv_(texte) {
  return ContentService.createTextOutput(texte).setMimeType(ContentService.MimeType.CSV);
}

function doGet(e) {
  const action = (e.parameter.action || 'config');
  if (action === 'config') {
    return json_({ phase: phase_(), catalogue: catalogue_() });
  }
  if (action === 'mesnotes') {
    return json_({ notes: notes_()[e.parameter.uid] || {} });
  }
  if (action === 'matrice') {
    const films = catalogue_();
    const notes = notes_();
    const uids = Object.keys(notes);
    return json_({
      films: films,
      lignes: uids.map(u => films.map(f => (f in notes[u] ? notes[u][f] : null))),
    });
  }
  if (action === 'csv') {
    // Matrice utilisateurs x films, cellule vide = film non vu.
    const films = catalogue_();
    const notes = notes_();
    const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
    const lignes = [['uid'].concat(films).map(esc).join(',')];
    Object.keys(notes).forEach(u => {
      lignes.push([esc(u)].concat(films.map(f => (f in notes[u] ? notes[u][f] : ''))).join(','));
    });
    return csv_(lignes.join('\n'));
  }
  return json_({ erreur: 'action inconnue' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const uid = String(d.uid || '').slice(0, 40);
    if (!/^u_[a-z0-9]+$/.test(uid)) return json_({ ok: false, erreur: 'identifiant invalide' });
    const t = new Date();
    const p = phase_();

    if (d.type === 'propositions') {
      if (p !== 1) return json_({ ok: false, erreur: 'La phase 1 est fermée.' });
      const films = (d.films || []).map(f => String(f).trim().slice(0, 120)).filter(Boolean);
      if (films.length !== 3) return json_({ ok: false, erreur: 'Il faut exactement 3 films.' });
      const sh = feuille_('Propositions');
      const deja = sh.getDataRange().getValues().some(r => r[1] === uid);
      if (deja) return json_({ ok: false, erreur: 'Vous avez déjà proposé vos 3 films.' });
      films.forEach(f => sh.appendRow([t, uid, f]));
      return json_({ ok: true });
    }

    if (d.type === 'notes') {
      if (p !== 2) return json_({ ok: false, erreur: 'La phase 2 est fermée.' });
      const cat = new Set(catalogue_());
      const sh = feuille_('Notes');
      const rows = [];
      Object.entries(d.notes || {}).forEach(([film, note]) => {
        if (!cat.has(film)) return;
        const n = note === null ? '' : Number(note);
        if (n !== '' && !(n >= 1 && n <= 5 && Number.isInteger(n))) return;
        rows.push([t, uid, film, n]);
      });
      if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
      return json_({ ok: true, enregistrees: rows.length });
    }

    return json_({ ok: false, erreur: 'type inconnu' });
  } finally {
    lock.releaseLock();
  }
}
