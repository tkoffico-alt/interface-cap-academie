
### 11/11/2026 — Barres de valeur absolue `\|a\|` dans les fiches (app.js v3.82, SW v228)
- Symptôme : le modèle écrit `\|a\|` ; le convertisseur léger (`texteVersHtmlLegerFiche`) affichait les antislashs et le découpage des tableaux (`split('|')`) cassait les cellules (« √(a²) = \ — a\ »).
- Correctif : `\|` remplacé par un jeton () avant découpage, restitué en `|` après (texteVersHtmlLegerFiche, nettoyerLigneTableauFiche, decouperCellulesTableauFiche). Bibliothèque (rendu-fiche.js) non modifiée : à vérifier.
