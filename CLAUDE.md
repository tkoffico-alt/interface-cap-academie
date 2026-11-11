
### 11/11/2026 — Barres de valeur absolue `\|a\|` dans les fiches (app.js v3.82, SW v228)
- Symptôme : le modèle écrit `\|a\|` ; le convertisseur léger (`texteVersHtmlLegerFiche`) affichait les antislashs et le découpage des tableaux (`split('|')`) cassait les cellules (« √(a²) = \ — a\ »).
- Correctif : `\|` remplacé par un jeton () avant découpage, restitué en `|` après (texteVersHtmlLegerFiche, nettoyerLigneTableauFiche, decouperCellulesTableauFiche). Bibliothèque (rendu-fiche.js) non modifiée : à vérifier.

### À FAIRE PLUS TARD (idée notée le 11/11/2026) — Déploiement du backend via GitHub
- Aujourd'hui : `scp` de main.py vers le serveur, puis `sudo systemctl restart edukatchat.service` en ssh, puis envoi de main.py sur GitHub plus tard.
- Idée : faire récupérer main.py par le serveur directement depuis GitHub (git pull sur le serveur), pour supprimer le scp. Demande un peu de configuration (dépôt gateway, accès du serveur à GitHub, commande de mise à jour + redémarrage). À reprendre quand Constant le décidera.

### PLAN — Forfaits fratrie + codes premium offerts (décidé le 11/11/2026, RIEN DE CODÉ ENCORE)
Décisions de Constant :
- Fratrie en MENSUEL UNIQUEMENT (pas de durées longues, donc pas de cumul de remises). 1er enfant 5 000 FCFA ; 2e enfant −15 % = 4 250 ; 3e et suivants −25 % = 3 750.
- Le rang (1, 2, 3+) est FIXÉ à l'enregistrement de l'enfant (pas recalculé à chaque renouvellement, sinon deux frères se verraient mutuellement comme « déjà abonné »). Le 1er enfant paie toujours plein tarif. La famille est retrouvée par le numéro WhatsApp du parent (même préfixe ELV-).
- Ajout d'un enfant plus tard : accepté, sans prorata ; remise selon le rang, abonnement qui démarre à l'achat.
- Photo d'emploi du temps (option B) : obligatoire pour le 1er enfant (comme aujourd'hui, le paiement s'ouvre après validation de la photo), FACULTATIVE pour les suivants ; l'élève l'ajoute ensuite via le 📅 de son espace (planning rangé par matricule).
- Rapports de session et rapport hebdo : déjà envoyés par matricule vers le téléphone de la ligne du Registre Abonnements (colonne E), nom en colonne H ; relus en direct à chaque envoi. Pour les codes offerts : Constant saisit lui-même les numéros WhatsApp des parents dans le Registre (Google Sheet).
Étapes prévues : 1) main.py : grille fratrie + rang ; 2) paiement famille (un paiement Paystack -> plusieurs codes ELV, même téléphone, prénom/classe par enfant) ; 3) planning pré-abonnement : clé = téléphone + prénom (aujourd'hui clé = téléphone seul, la 2e photo écraserait la 1re ; la migration au paiement ne distingue pas les enfants) ; 4) page d'abonnement : choix « 1 enfant / plusieurs enfants » ; 5) outil d'administration pour générer des codes premium offerts (durée 2 mois, sans paiement, sans photo). Option plus tard : rapport du dimanche regroupé par famille.

### 11/11/2026 — Fratrie ÉTAPE 1 faite dans gateway/main.py (à déployer : scp + restart)
- Ajouts : `REMISE_FRATRIE_POURCENT` {1:0, 2:15, 3:25}, `prix_eleve_mensuel_selon_rang()` (5000 / 4250 / 3750), `determiner_rang_fratrie(telephone, nom)` (lit le Registre : renouvellement = rang mémorisé ; nouvel enfant = nb d'ELV- actifs du même numéro + 1), table SQLite `rang_famille` (matricule, telephone, rang, date_creation), rang mémorisé par le webhook (INSERT OR IGNORE).
- `/api/paiement/initialiser` : tarif fratrie UNIQUEMENT si le corps contient `"fratrie": true` (élève + mensuel, sinon erreur) ; renvoie `montant` et `rang`. Sans ce drapeau : comportement inchangé (la page actuelle n'est pas touchée).
- Testé hors serveur avec un faux registre (rangs 1/2/3, renouvellements, autre famille). Sauvegarde : archives/main.avant_fratrie_*.py.
- Reste : étape 2 (paiement famille : plusieurs codes pour un paiement), 3 (planning pré-abonnement par prénom), 4 (page d'abonnement), 5 (codes offerts).

### 11/11/2026 — Fratrie ÉTAPE 2 faite : paiement FAMILLE (main.py + merci.html) — à déployer
- `/api/paiement/initialiser` : corps `{"profil":"eleve","duree":"mensuel","fratrie":true,"telephone":...,"prenom":..., "enfants":[{"prenom":..,"nom":..},...]}` (2 à 5 enfants, prénoms obligatoires, noms complets distincts). Rang de chaque enfant calculé côté serveur (`determiner_rangs_famille`, lit le Registre une fois) ; montant = somme des prix (5000/4250/3750) ; renvoie `montant`, `enfants` (avec rang). metadata Paystack porte `enfants`.
- Webhook : si metadata.enfants (≥2) -> `traiter_paiement_famille` : renouvelle la ligne d'un enfant déjà connu (même nom + même numéro) sinon crée une ligne ELV- (code unique contrôlé sur la colonne B), mémorise rang_famille, table `paiements_codes_enfants` (reference, sceau, prenom, rang, date_fin), `paiements_codes` = code du 1er enfant (anti-doublon). Un message WhatsApp (modèle code) par enfant. Rejeu Paystack = aucun doublon (testé).
- `/api/paiement/code` renvoie aussi `enfants` [{prenom, sceau, rang}] ; `merci.html` affiche une carte par enfant (rendu vérifié en capture) ; paiement individuel inchangé.
- Limites connues : le planning (photo) n'est PAS encore migré pour les paiements famille (étape 3) ; renouvellement = nom complet identique à celui déjà enregistré, sinon un nouveau code est créé ; le message WhatsApp du modèle ne porte que le code (pas le prénom) : le prénom est sur merci.html.
- Sauvegardes : archives/main.avant_famille_*.py, merci.avant_famille_*.html.
