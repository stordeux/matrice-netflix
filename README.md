# Projet « Matrice Netflix » — collecte anonyme

```
docs/               site GitHub Pages (page étudiants + matrice en direct)
  index.html        phase 1 : proposer 3 films / phase 2 : noter le catalogue
  resultats.html    matrice affichée en direct + lien CSV
  config.js         ← coller ici l'URL de l'Apps Script
apps_script/Code.gs backend à coller dans un Google Sheet
python/matrice_netflix.py  lecture du CSV + complétion par ALS
```

## 1. Google Sheet (stockage des réponses)

1. Créer un Google Sheet vide (par ex. « Netflix L3 »).
2. **Extensions › Apps Script**, remplacer le contenu de `Code.gs` par `apps_script/Code.gs`, enregistrer.
3. Choisir la fonction `initialiser` dans la liste et cliquer **Exécuter**, puis accepter les autorisations.
   Cela crée les feuilles `Config`, `Propositions`, `Catalogue` et `Notes`.
4. **Déployer › Nouveau déploiement › Application Web**
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
5. Copier l'URL `https://script.google.com/macros/s/…/exec` dans `docs/config.js` (`API_URL`).

> Après toute modification de `Code.gs` : **Déployer › Gérer les déploiements › Modifier › Nouvelle version**.
> Sinon l'URL continue de servir l'ancienne version.

## 2. Déroulement

| Étape | Ce que fait l'enseignant |
|---|---|
| Phase 1 | `Config!B1 = 1`. Les étudiants proposent 3 films. |
| Entre les phases | Exécuter `construireCatalogue`. La feuille `Catalogue_brut` liste les titres regroupés, triés par popularité. Fusionner les doublons restants, puis copier 40 à 60 titres dans `Catalogue` (colonne A, sous l'en-tête `film`). Ajouter quelques grands classiques pour augmenter les recoupements. |
| Phase 2 | `Config!B1 = 2`. Pour chaque film, les étudiants choisissent « pas vu » (case vide), « je n'aime pas » (codé 1), « j'aime » (codé 2) ou « j'aime beaucoup » (codé 3). Ils peuvent revenir modifier leurs réponses. |
| Fin | `Config!B1 = 0` ferme la collecte. Télécharger le CSV depuis `resultats.html`. |

**Anonymat** : chaque navigateur reçoit un identifiant aléatoire `u_xxxxxxxx`, stocké en `localStorage`.
Aucun nom ni e-mail n'est collecté. La page des résultats n'affiche même pas les identifiants.
Limite : un étudiant qui change de navigateur ou vide ses données apparaît comme une nouvelle ligne.

## 3. Exploitation (Python)

```bash
python python/matrice_netflix.py notes.csv
python python/matrice_netflix.py "https://script.google.com/macros/s/…/exec?action=csv"
```

Le script calcule la RMSE de validation selon le rang, puis fait des recommandations par ALS.
C'est un point de départ pour le sujet : SVD tronquée, ALS, choix du rang, régularisation, etc.
