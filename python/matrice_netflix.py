"""Chargement de la matrice Netflix collectée et complétion par ALS (rang faible).

Usage :
    python matrice_netflix.py notes.csv            # fichier téléchargé depuis resultats.html
    python matrice_netflix.py "https://script.google.com/macros/s/.../exec?action=csv"
"""
import csv
import io
import sys
import urllib.request

import numpy as np


def charger(source):
    """Renvoie (M, films) : M de taille (étudiants x films).

    1 = j'aime, 2 = j'aime beaucoup, np.nan = pas vu (inconnue).
    """
    if source.startswith("http"):
        texte = urllib.request.urlopen(source).read().decode("utf-8")
    else:
        texte = open(source, encoding="utf-8").read()
    lignes = list(csv.reader(io.StringIO(texte)))
    films = lignes[0][1:]
    M = np.array([[float(x) if x else np.nan for x in l[1:]] for l in lignes[1:]])
    return M, films


def als(M, r=3, lam=0.1, iterations=50, graine=0):
    """Moindres carrés alternés : M ≈ U V^T sur les cases connues, avec régularisation lam."""
    m, n = M.shape
    connu = ~np.isnan(M)
    rng = np.random.default_rng(graine)
    U = rng.standard_normal((m, r))
    V = rng.standard_normal((n, r))
    I = lam * np.eye(r)
    for _ in range(iterations):
        for i in range(m):
            Vi = V[connu[i]]
            U[i] = np.linalg.solve(Vi.T @ Vi + I, Vi.T @ M[i, connu[i]])
        for j in range(n):
            Uj = U[connu[:, j]]
            V[j] = np.linalg.solve(Uj.T @ Uj + I, Uj.T @ M[connu[:, j], j])
    return U, V


def validation(M, r, lam, frac=0.1, graine=0):
    """RMSE sur une fraction des notes connues masquée avant l'apprentissage."""
    rng = np.random.default_rng(graine)
    idx = np.argwhere(~np.isnan(M))
    test = idx[rng.random(len(idx)) < frac]
    A = M.copy()
    A[test[:, 0], test[:, 1]] = np.nan
    mu = np.nanmean(A)
    U, V = als(A - mu, r, lam)
    pred = mu + (U @ V.T)[test[:, 0], test[:, 1]]
    return np.sqrt(np.mean((pred - M[test[:, 0], test[:, 1]]) ** 2))


if __name__ == "__main__":
    M, films = charger(sys.argv[1])
    m, n = M.shape
    print(f"{m} étudiants x {n} films, {np.sum(~np.isnan(M))} notes connues "
          f"({100 * np.mean(~np.isnan(M)):.1f} %)")

    for r in (1, 2, 3, 5):
        print(f"rang {r} : RMSE de validation = {validation(M, r, lam=1.0):.3f}")

    mu = np.nanmean(M)
    U, V = als(M - mu, r=2, lam=1.0)
    P = np.clip(mu + U @ V.T, 1, 2)
    print("\nRecommandation pour le premier étudiant :")
    inconnus = np.where(np.isnan(M[0]))[0]
    for j in inconnus[np.argsort(-P[0, inconnus])][:5]:
        print(f"  {films[j]:40s} note prédite {P[0, j]:.2f}")
