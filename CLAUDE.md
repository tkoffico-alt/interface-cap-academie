# Cap Académie / EdukaTchat — notes projet (version allégée au 23/10/2026)

> L'historique détaillé (bugs, tests, décisions, jusqu'au 23/10/2026) est dans
> `archives\HISTORIQUE_CLAUDE_MD.md`. **Ne le lire que sur demande ou pour retrouver un diagnostic
> précis** (utiliser Grep sur un mot-clé, jamais une lecture complète : ~890 Ko).
> Chaque nouveau chantier : ajouter ici 5 à 10 lignes maximum, pas un récit complet.

## Structure
- `interface/` — frontend statique (index.html, app.js, style.css, manifest.json, service-worker.js,
  carnet.html, essai-enseignant.html, merci.html, images). Constant le synchronise vers le dépôt
  déployé via GitHub Desktop.
- `gateway/main.py` — backend FastAPI sur VPS Contabo. Fichiers de données lus au runtime à
  déployer à côté (`illustrations_manifest.json`, `08_…`, `18_…`, `21`–`26_ANGLAIS_*.md`).
  ```
  scp C:\Users\fraon\Desktop\Cap_Academie_Projet\gateway\main.py consty@178.238.224.136:/home/consty/cap-academie-gateway/main.py
  ssh consty@178.238.224.136 "sudo systemctl restart edukatchat.service"
  ```
  Ne PAS utiliser l'ancien `main_serveur_avec_illustrations.py`.
- `prompts_agents_primaire\`, `prompts_agents_secondaire\`, `prompts_agents_general\` — copies de
  référence des prompts Dify. Règle : corriger ici d'abord, recopier dans Dify Studio, **Publier**.
- `bibliotheque_*` — miroirs locaux des bases de connaissance Dify.
- Dépôt GitHub de sauvegarde `tkoffico-alt/cap-academie-gateway` : un envoi sur main redéploie TOUT
  vers le VPS (workflow). N'envoyer que des fichiers locaux à jour, jamais `.env`, `credentials.json`, `.db`.

## RÈGLE PWA — bump obligatoire
À chaque modification de `index.html`, `app.js` ou `style.css`, incrémenter `CACHE_VERSION` dans
`interface/service-worker.js` (actuellement **v111**) dans le même lot, et rappeler à Constant de
déployer `service-worker.js` avec les fichiers modifiés. `carnet.html`, `merci.html`,
`essai-enseignant.html` sont hors précache (pas de bump).

## Conventions
- Interface et commentaires de code en français. Bleu `#3B82F6` = secondaire, vert `#10B981` = primaire.
- Thème : clair = base CSS, sombre = `body.dark-theme` posé juste après la règle de base.
- Sceaux : `ELV-` élève (`eduka_sceau`), `ENS-` enseignant (`eduka_sceau_enseignant`), cloisonnés
  côté backend (`est_sceau_valide(..., prefixe_attendu=...)`) et frontend.
- Parseurs de fiches (`analyserFicheLecon`, `analyserFichePrimaire`, `analyserEvaluation`,
  `analyserEvaluationPrimaire`) partagent le même nettoyage : toute correction s'applique aux 4.
  Vérifier par harnais (V8/mini-racer, `outils_verification\`) sur du vrai texte généré.
- Anti-hallucination : jamais de contenu factuel sans vérification externe ; données objectives
  (dates, %, année scolaire, durées) calculées côté serveur, pas demandées au modèle.
- Diagnostic serveur : l'horloge du VPS est en CEST (Abidjan + 2 h) ; vérifier `date` d'abord.
- Variables `.env` : ajouter avec `grep -q CLE .env || echo 'CLE=valeur' >> .env`, jamais `sed -i` seul.
- Les diagnostics fiables partent du **texte brut** (contenu) ; une position visuelle exige une
  capture ou une inspection DOM.
- Dify : toute nouvelle donnée d'un Outil Personnalisé s'ajoute au prompt ET au schéma OpenAPI.
  Un test fait avant « Publier » ne prouve rien. Conversation Dify figée : nouvelle conversation.

## Points d'architecture à connaître
- Un seul worker uvicorn : tout appel bloquant (gspread, Whisper) passe par `asyncio.to_thread`.
- Suivi élève (SQLite `edukatchat_registre.db`) : `notes_suivi`, `progression_matiere`,
  `devoirs_en_attente`, `historique_notions`, `paiements_codes`, `essais_enseignant`.
  `devoir_du` (10 j) et `devoir_perime` (14 j) calculés par `/api/suivi/lire`.
- Abonnements : Paystack (Starter Business, validé le 05/10/2026), caisse maison
  `/api/paiement/initialiser`, grille FCFA élève 5 000/13 500/25 000/48 000, enseignant
  3 000/8 000/15 000/29 000 ; `/webhook/paiement` ; page `merci.html` affiche le Code.
  CinetPay en réserve. Feuille Google « Abonnements » colonnes A:H.
- Illustrations : 454 entrées au manifeste (maths, physique/chimie, SVT, langues, etc.). Filtre
  `#illu-filtre-matiere` à mettre à jour avec toute nouvelle matière. Rendu : KaTeX (LaTeX), abcjs
  (portées ```abc), ```quiz, ```graphique ; fiches Forge : page Illustrations, plan du cahier de texte.
- Bibliothèque Lettres, citations de philosophie (25, vérifiées), progressions DPFC 2026-2027
  (fichiers 01–29 de `bibliotheque_PROGRAMMES_SECONDAIRE_2026_2027`).

## Chantier en cours : « Format officiel » de l'Atelier des Évaluations
Mode « épreuve type BEPC/BAC » (EXERCICE N, BARÈME TOTAL 20, CORRIGÉ en dernier), bouton dédié.
- Validé en production : Maths, SVT, Physique-Chimie, EDHC (BEPC). Non-régression PARTIE A/B OK.
- **Français : gabarit écrit le 23/10/2026** dans `PROMPT_COMPLET_Atelier_Evaluations.md`
  (orthographe 4+4+12, résumé 6+14, sujet de réflexion 2+4+14), prompt publié, synthèse 29 mise à
  jour. **Validé en production le 23/10/2026** (orthographe 4e, résumé 3e). 5 contrôles qualité
  ajoutés au prompt (relecture dictée, genre/nombre explicite, nb d'éléments = corrigé, dictée
  « évaluée à part », décompte réel des mots) : tous respectés sur F1/F2 (écart ≤ 1 mot). Reste à
  tester seulement le sujet de réflexion (texte argumentatif) si besoin. **Français clos.**
- **Anglais BEPC : gabarit écrit le 23/10/2026** (source : document DPFC « Format_Anglais_2 ») dans
  `PROMPT_COMPLET_Atelier_Evaluations.md` : EXERCISE 1 Reading comprehension 8 (vocabulary 4 +
  comprehension 4), EXERCISE 2 Writing 6, EXERCISE 3 Language in use 6 (12 items x 0,5), TOTAL SCORE,
  ANSWER KEY. Libellés EXERCISE N (et non PART ONE) car seul EXERCISE N est reconnu par le parseur.
  9 contrôles qualité (v2 du 23/10 : exemple repris, pas de « Accept other », vocabulaire ivoirien ; v3 du 24/10 : cloze testé mot par mot dans chaque trou, cohérence des chiffres, modèle de Writing sans le personnage du texte). Synthèse 29 mise à jour. **Validé en production le 23/10/2026**
  (3e, thème santé : 8+6+6, texte numéroté, cloze correct). **4e (environnement) validée aussi** : règle v2 OK
  (exemples repris, vocabulaire ivoirien), Writing en message amical OK. 6e (famille) : structure OK mais 2 erreurs de cloze
  (3 enfants au lieu de 4 ; teeth/feet) d'où la règle v3 (24/10), **à recopier dans Dify, Publier**, puis retester la 6e.
  Règle v4 (24/10) : en-tête BEPC seulement en 3e,
  « ENGLISH COMPOSITION » en 6e/5e/4e/2nde/1ère (durée et coefficient laissés au prof), « BAC » en Tle ; cloze : pas deux
  verbes de même forme dans la banque ; mots de la colonne A identiques au texte. **v4 + en-tête commun à toutes les disciplines (BEPC en 3e, COMPOSITION ailleurs, BAC en Tle ; durées officielles affichées en 3e seulement, sinon pointillés ; COMPOSITION traduit pour les langues vivantes) à recopier dans Dify (24/10).**
  Reste à tester : un texte de type dialogue ; Bac Anglais non intégré (le prompt demande l'accord de l'enseignant).
  Sauvegarde avant modif : `archives\PROMPT_COMPLET_Atelier_Evaluations_avant_anglais_23-10-2026.md`.
- À venir : Espagnol, Allemand, primaire, CAFOP, Bac A1/A2/D ; test de correction non
  indulgente avec de vraies copies.

## Chantier schémas SVT dans l'Atelier (décidé le 24/10/2026)
- Constat : l'Atelier dessinait un « schéma » en caractères (illisible). La bibliothèque d'illustrations
  (SVT 3e : img447 à 451, img414…) n'est injectée que dans `chat_sas_api` (élèves), pas dans
  `chat_enseignant_api` (Atelier). img448 est déjà légendée : inutilisable telle quelle pour « Nomme ».
- A (fait, prompt) : interdiction du dessin en caractères ; ligne « [Schéma à insérer par l'enseignant …] » ;
  Vrai/Faux : pas d'alternance V/F/V/F. **À recopier dans Dify.**
- B (**validé en production le 24/10** : vrais schémas SVT 3e dans l'épreuve ; Dify prend les inputs à CHAQUE message, pas de gel) : `main.py` section 4.6 (`illustrations_pour_atelier`, appelée dans
  `chat_enseignant_api` pour l'outil `atelier` uniquement ; SVT et Physique-Chimie seulement, constante
  `ATELIER_MATIERES_ILLUSTREES`). Côté Dify : variable Paragraphe `illustrations_disponibles` (non requise) +
  section « SCHÉMAS DE LA BIBLIOTHÈQUE » du prompt. Ordre : Dify d'abord, puis scp de `main.py`. Aucun
  changement d'interface (le front rend déjà `![](https://edukatchat.org/images/illustrations/…)`).
  Sauvegarde : `archives\main_avant_atelier_illustrations_24-10-2026.py`.
  Constat : « variante » perdait les schémas (message sans matière). **v5 (24/10, à déployer + recopier dans Dify)** :
  mémoire par matricule (3 h) `illustrations_atelier_avec_memoire` ; prompt : Anglais = exactement 12 items notés
  (faute 13 → 20,5 pts), Vrai/Faux 4 affirmations avec ordres imposés, réponses équivalentes acceptées.
  Tests du 24/10 : SVT 3e (schéma VIH inséré, V/F F-V-V-F OK), Physique-Chimie 3e électrolyse (schéma inséré,
  8+7+5, calculs justes), Anglais 6e (12 items OK) : **v5 validée côté prompt**. Reste : confirmer que la mémoire
  des schémas marche (test décisif : après une épreuve SVT avec schéma, écrire « Remplace l'Exercice 2 par une
  question d'interprétation à partir d'un schéma de la bibliothèque »). v6 (cloze : un seul trou de
  préposition, pas de My/The échangeables ; mêmes noms propres dans tout le sujet) ; **v7** : l'ANSWER KEY recopie le texte
  à trous complet avec les réponses entre crochets (item 9 « carefully » sans phrase correcte, 24/10). **v8 (24/10)** : « Bank check » dans l'ANSWER KEY
  (chaque mot de la banque → n° du trou, un seul « not used », jamais le même mot deux fois ; faute vue : My/my) et
  interdiction de commenter une « image jointe » (hallucination constatée en conversation neuve). **v6+v7+v8 recopiées et
  testées 2 fois le 24/10 : Bank check respecté, plus d'erreur de banque. ANGLAIS BEPC CLOS.** Limites connues : le mot en trop
  peut encore convenir à un trou (ex. « purple » : « It is purple »), et le mot de l'exemple (« am ») peut convenir au
  trou 1 ; corrigé dans le prompt v9 (24/10). L'ANSWER KEY contient
  « Completed paragraph » + « Bank check » : l'enseignant vérifie en 30 s. Mémoire des schémas VALIDÉE le 24/10 (suite sans matière : le schéma VIH est réinséré).
  Ensuite : étape C (schémas sans légendes), en commençant par SVT 3e.
- C (24/10/2026) : versions SANS légendes (éléments numérotés) des schémas clés, SVT 3e d'abord.
  **Schéma 1 fait et VALIDÉ en test réel le 24/10 (appareil génital féminin)** : redessiné dans un style anatomique (utérus en poire, pavillon à
  franges, follicules), validé par l'utilisateur. Fichiers : `…/svt/3e/104_appareil_genital_feminin.png` (légendé,
  remplacé ; ancienne version en archives/) et `…/111_appareil_genital_feminin_sans_legendes.png` (numéros 1 ovaire,
  2 pavillon, 3 trompe, 4 utérus, 5 col, 6 vagin). Script de fabrication : `outils/schema_genital_feminin.py`
  (modes "numero" / "legende" ; à réutiliser comme modèle pour les 3 schémas suivants : appareil génital masculin,
  ovulation-fécondation-nidation, placenta). Il n'existe qu'UN manifeste (`gateway/illustrations_manifest.json`,
  pas de copie dans interface). Entrée img461 avec `"usage": "sans_legendes"` + `"numeros"` ; main.py : ces
  entrées sont retirées du catalogue élève et ne servent qu'à l'Atelier (étiquettes [LÉGENDÉ, pour lecture] /
  [SANS LÉGENDES, pour « Nomme / Légende »]). Prompt v9 : règle des deux étiquettes + correctifs anglais (mot en
  trop hors adjectif, mot d'exemple ne convenant à aucun autre trou). Sauvegardes `archives/*_avant_v9*`.
  **Schéma 2 fait et VALIDÉ en test réel le 24/10 (appareil génital masculin)** : 112 (légendé, anatomique, 10 éléments) + 113 (numéroté :
  1 vessie, 2 vésicule séminale, 3 prostate, 4 canal déférent, 5 urètre, 6 pénis, 7 épididyme, 8 testicule,
  9 gland, 10 bourse) ; entrées img462/img463 ; script `outils/schema_genital_masculin.py`. Le 103 (organigramme
  du trajet des spermatozoïdes) est CONSERVÉ comme document de lecture. **Schéma 3 fait et VALIDÉ en test réel le 24/10 (ovulation-fécondation-nidation)** : 115 (légendé) + 114 (numéroté, 12 éléments : 1 ovaire,
  2 ovule libéré, 3 pavillon, 4 trompe, 5 spermatozoïdes, 6 cellule-œuf, 7 embryon 2 cellules, 8 4 cellules, 9 morula,
  10 blastocyste, 11 muqueuse utérine, 12 embryon implanté) ; entrées img464/img465 ; script `outils/schema_ovulation_nidation.py` ;
  trompe en continuité avec l'utérus et au contact de l'ovaire (remarque de l'utilisateur). Le 105 (4 cases) est conservé.
  Prompt v10 : règle « plus de 8 numéros → n'en demander que 6 à 8 ». À déployer + tester (nouvelle conversation). **Schéma 4 fait et VALIDÉ en test réel le 24/10 (placenta)** : 117 (légendé) + 116 (numéroté, 11 éléments : 1 utérus, 2 amnios, 3 liquide amniotique,
  4 fœtus, 5 cordon, 6 placenta, 7 artère maternelle, 8 veine maternelle, 9 veine ombilicale, 10 artères ombilicales, 11 col) ;
  entrées img466/img467 ; script `outils/schema_placenta.py` ; refait d'après les références de l'utilisateur (coupe
  de l'utérus + circulation au niveau du placenta, légende des couleurs). Le 106 (ancien schéma) est conservé.
  Test placenta : légende de 6 numéros (5 à 10) + corrigé exact, barème 8+12=20. Défaut mineur à corriger au prochain lot du
  prompt : dans le QCM (4 questions) la bonne réponse était TOUJOURS la 1re ou la 2e proposition (a, a, b, a) → ajouter une
  règle « varie la position de la bonne réponse d'un QCM à l'autre ». **Fait dans le prompt v11 (25/10) : séries imposées 2-3-1-2, 3-1-2-3, 2-1-3-2, 3-2-1-3 ; à coller dans Dify + Publier, puis tester 2 générations.** Test 25/10 : 4 questions OK (2-3-1-2) ; 5 questions
  partiellement raté (b,b,a,b,c) → séries pour 5 et 6 questions ajoutées (v11b). **VALIDÉ le 25/10 : 5 QCM = b,c,a,b,c (2-3-1-2-3).**
  **Les 4 schémas SVT 3e de l'étape C sont faits.** À déployer : images 116/117 (GitHub Desktop) + manifeste (scp) ; tester.
  Suite possible : schémas sans légendes pour d'autres classes/matières (SVT 4e/5e/6e, Physique-Chimie).
  **Phase « autres classes » (25/10) — liste dans l'ordre : 1 fleur SVT 6e (FAIT, validé 25/10 : 201 légendé + 202 numéroté, 10 éléments :
  1 pédoncule, 2 sépale, 3 pétale, 4 anthère, 5 filet, 6 stigmate, 7 style, 8 ovaire, 9 ovule, 10 réceptacle ; img114 repointée sur 201, nouvelle img468 ;
  script `outils/schema_fleur.py`) ; 2 appareil digestif (SVT 5e/3e) + villosité ; 3 cœur/circulation (SVT 3e/4e) ;
  4 montages de séparation Physique-Chimie 5e (filtration, décantation, distillation) ; 5 circuit électrique simple.
  À déployer pour la fleur : images 201/202 (GitHub Desktop) + manifeste (scp) + restart ; test « Évaluation SVT 6e, la fleur ».**
  Réglage fait dans le prompt v10 (24/10) : si le schéma a plus de 8 numéros, ne demander que 6 à 8 d'entre eux
  (indiquer lesquels) pour garder une question de légende raisonnable en 3e (test : les 10 ont été demandés, 5 pts).
  À déployer : images via GitHub Desktop (interface), main.py + manifeste par scp + restart, prompt dans Dify +
  Publier. Test : Atelier SVT 3e « reproduction humaine, légender l'appareil génital féminin », nouvelle conversation.

## Autres points ouverts
- **Migration OpenAI** : GPT-4o / 4o-mini / 4.1 retirés le 14/01/2027. Test gpt-6-luna concluant sur
  Forge et Atelier ; migrer les autres agents (nov.-déc. 2026) en retestant chaque prompt.
  **Demande explicite de l'utilisateur (25/10/2026) : ne pas oublier de remplacer les modèles GPT de l'ESPACE DES ÉLÈVES**
  (agents élèves : chat, SAS, etc.) → à planifier avant le 14/01/2027 : lister les agents élèves et leur modèle actuel dans
  Dify, tester gpt-6-luna (ou équivalent) agent par agent, republier.
  **État constaté le 25/10/2026 (captures Dify)** : DÉJÀ sous gpt-6-luna (Max Tokens 12000) : Forge secondaire « Maître Pédagogue Universel »,
  Atelier des Évaluations, Forge Primaire. ENCORE sous gpt-4o-mini : Consultant Pédagogique (+ Primaire), Gardien de l'Accueil, Examinateur-Orateur,
  Répétiteur, Maître de la Dialectique, Atelier de l'Élan, Conseiller Universitaire, Lecteur d'Emploi du Temps, EdukaTchat Élève Général (type AGENT).
  **Atelier de l'Élan (25/10)** : luna, règle anti-question-symptômes ajoutée (local+Dify), Max Tokens 1500 conseillé ; tests OK. **Conseiller Universitaire (25/10)** : luna, 3000 OK, règle PÉRIMÈTRE ajoutée et testée (restaurant refusé) ; prompt sauvegardé en local (PROMPT_COMPLET_Conseiller_Universitaire.md). **DÉCIDÉ 25/10 : volet « 7 axes / profil cognitif » RETIRÉ** du prompt Conseiller (local fait, copie dans archives/) et de l'Espace de Préparation (bloc « éclairage par cycle de naissance » + outil calculer_profil_orientation retirés, local fait) → à recoller dans Dify + Publier. Idée future (non urgente) : vrai questionnaire d'intérêts type RIASEC (6 à 10 questions), présenté honnêtement comme aide à la réflexion. (ancien constat :) POINT OUVERT : les 7 axes du profil cognitif (axe_zan…axe_synthese) ne sont envoyés ni par interface/app.js (invoquerConseiller) ni par la gateway → le volet « profil cognitif » du Conseiller ne fonctionne pas (luna dit « données non disponibles » ; 4o-mini inventait peut-être). À examiner : outil calculer_profil_orientation ? **Dossier `prompts_a_coller/` (25/10)** : versions sans en-tête, prêtes à coller dans Dify (Atelier de l'Élan, Espace Préparation, Conseiller Universitaire) — à régénérer depuis `prompts_agents_secondaire/` après toute modif. **Lecteur d'Emploi du Temps** : prompt sauvegardé en local (PROMPT_COMPLET_Lecteur_Emploi_du_Temps.md), migration luna en cours (sortie JSON stricte à tester). Ordre prévu : Consultants → Examinateur/Répétiteur/Dialectique/Élan/Conseiller/Lecteur → Gardien (WhatsApp) → Élève Général en dernier.
  Méthode : changer le modèle, tester 2-3 questions types en NOUVELLE conversation, régler Max Tokens, Publier. Vérifier qu'un fiche très longue
  n'est pas coupée (le Max Tokens peut inclure le raisonnement) ; Élève Général : tester l'usage des outils (type AGENT) avec luna.
  **Consultant Pédagogique (25/10)** : passé à gpt-6-luna, Max Tokens 4000 (OK), 3 tests sur 4 parfaits. Défaut connu : sur « Bonjour » seul, luna décrit un « cachet
  et une signature » = images des PDF de la base de connaissances transmises au modèle. Règle ajoutée dans le prompt (PROMPT_COMPLET_Cabinet.md, section ŒIL DU MAÎTRE)
  insuffisante ; le seuil de score (0,2 à 0,5) ne sépare pas « Bonjour » des vraies questions → seuil laissé désactivé. À retraiter plus tard
  (idée : retirer les images/pages scannées des PDF de la base, ou règle côté gateway). Même risque pour les autres agents avec bases de connaissances.
  Cause trouvée : l'option Vision d'un agent transmet à luna les images des PDF de la base → Vision gardée (photos d'enseignants). Consultant : Top K 8, score pondéré
  0,5/0,5, pas de modèle de reclassement disponible (« Incompatible ») ; la recherche des progressions de maths 6e reste mauvaise (mélange de 8 bases) — non bloquant.
  **Examinateur-Orateur (25/10)** : gpt-6-luna, Max Tokens 3000, 4 tests parfaits → à publier. **Maître de la Dialectique (25/10)** : gpt-6-luna, 3000, 4 tests parfaits (faute « u es » dans le prompt Dify à corriger avant publication). **Répétiteur de la Méthode (25/10)** : gpt-6-luna, 3000, 4 tests OK (sentinelle d'ouverture, définition directe, maïeutique, salutation) ; défaut mineur : signature collée à la fin d'une réponse d'une ligne. Prochains : Élan, Conseiller Univ., Lecteur Emploi du Temps, Gardien, Élève Général.
- **Vérifié (25/10/2026)** : image svt/6e/114_structure_dune_fleur.png bien en ligne sur edukatchat.org (absente du dossier local seulement) → les ~180 entrées « absentes en local » sont probablement déployées ; pas d'action sauf constat contraire.
- Rapport hebdo parents : ajouter `TWILIO_TEMPLATE_SID_RAPPORT_HEBDO` au `.env`, déployer
  `rapport_hebdo.sh`, simulation puis cron (voir historique).
- Code ELV-IV1JA : Date_Fin expirée (2026-10-15), à prolonger si besoin.
- DFE définitive à poursuivre (repasser en Registered Business avant 3 000 000 XOF/an).
- Objectif du mois (depuis 02/09/2026) : étoffer les bibliothèques à chaque session qui en touche une.
- Rappel dominical : renvoyer `main.py` vers GitHub.

## Lecteur d'Emploi du Temps — état au 25/10/2026 (soir)
- Prompt mis à jour (règle "manuscrit ≠ programme perso", ALIGNEMENT, DURÉE, EPS/Travaux Manuels/Bibliothèque) : local + `prompts_a_coller/A_COLLER_Lecteur_Emploi_du_Temps.txt`. Sauvegardes dans archives/.
- `gateway/main.py` : fonction `nettoyer_creneaux()` (écarte <40 min, doublons, EPS, tri) appliquée dans lire_photo ET pre_abonnement. DÉPLOYÉ par scp + restart (25/10).
- Tests : photo nette OK (low 11 s / medium 33 s) ; photo floue : décalages + cours inventés (mercredi SVT/PH.CH) même en medium (43 s) -> le flou est la limite, pas le réglage. Décision : rester sur Reasoning Effort LOW.
- À FAIRE (pas encore) : étape de relecture/correction du planning par l'élève/parent AVANT enregistrement (aujourd'hui lire_photo enregistre directement ; /api/planning/enregistrer est un outil Dify, pas pour l'interface) ; message conseil photo nette/droite/page entière ; retest limiteur (5/jour/IP) demain.

## Gardien de l'Accueil — migration luna (25/10/2026)
- gpt-6-luna, Max Tokens 1500 (déjà 1500 avant). Tests : Bonjour OK, tarifs OK (conformes au prompt), parent 4e maths OK (EDT Progression, même numéro), HORS-SUJET KO (restaurant Saakan inventé).
- Prompt mis à jour local + `prompts_a_coller/A_COLLER_Gardien_Accueil.txt` : règle PÉRIMÈTRE STRICT ; Espace Enseignants corrigé (Atelier = évaluations dont « Format officiel » BEPC/BAC + correction de copies + schémas SVT/Phys-Chim auto ; Forge = fiches de leçon ; Cabinet) ; conseil de qualité de la photo EDT. À coller dans Dify + retester restaurant + Publier. Sauvegarde : archives/PROMPT_COMPLET_Gardien_WhatsApp_avant_luna_25-10-2026.md

## Forge secondaire — richesse des fiches SVT (25/10/2026)
- Constat : fiche SVT 3e = 8467 caractères (~3000 tokens sur 12000) : le Max Tokens n'est PAS la limite ; la sobriété venait du prompt (traces « courtes », 1 exercice). Max Tokens laissé à 12000.
- Section F (SVT) de PROMPT_COMPLET_Forge.md modifiée : une activité par hypothèse (obligatoire), 3-5 questions/activité, trace 3-6 phrases, résumé complet en IV (6-10 lignes), 2 exercices d'application, 2-3 consignes en VI, étendue ~1500-2200 mots. Fichier prêt à coller : prompts_a_coller/A_COLLER_Forge_Secondaire.txt (= copie intégrale du prompt). Sauvegarde : archives/PROMPT_COMPLET_Forge_avant_richesse_SVT_25-10-2026.md. À coller dans Dify + Publier, puis tester « SVT 3e : la reproduction et l'hérédité chez l'homme » et comparer. Autres disciplines : PAS touchées (formats propres, risque de régression).
- Forge SVT, v2 (25/10 soir) : test v1 OK (13407 caractères vs 8467, 3 activités/3 hypothèses, 2 exercices). Règles ajoutées : DOCUMENTS (jamais la réponse) + COHÉRENCE HYPOTHÈSES/ACTIVITÉS. Sauvegarde archives/PROMPT_COMPLET_Forge_avant_regle_documents_SVT_25-10-2026.md. À coller (A_COLLER_Forge_Secondaire.txt) + retester + Publier. Prochaine discipline : Physique-Chimie (canevas par défaut Présentation/Développement/Évaluation, « enrichissement modéré » ; pas de section dédiée) → d'abord générer 2 fiches de référence (baseline), puis fourchettes dédiées.
- 26/10 : Forge SVT v2 testée OK (12387 caractères, documents = données, activités = hypothèses). Baseline Physique-Chimie : 5e filtration 6838 car., 3e poids/masse 5372 car. (sobres : 1 seul Développement, ρ/densité non découverts avant calcul). Section G « PHYSIQUE-CHIMIE — COMPLÉMENTS » ajoutée (séquences, matériel/mode opératoire, tableau de données + exemple résolu, 3 exercices croissants, 1300-2000 mots) + pointeur dans le préambule 4 BIS. Prêt à coller : A_COLLER_Forge_Secondaire.txt. Sauvegarde SVT-v2-seule : archives/PROMPT_COMPLET_Forge_SVT_v2_avant_PC_26-10-2026.md. À tester sur les 2 mêmes requêtes avant publication. À vérifier au programme : allèles/génotypes ABO en 3e SVT.
- 26/10 (suite) : tests PC v1 OK mais perfectibles (5e 7939 car. ; 3e 8146 car.) : défauts = formule ρ/a « proposée » sans tableau de données, aucun exercice sur masse volumique/densité, sécurité « chauffage » hors sujet, question sur eau salée filtrée non réalisée. Affinage v2 de la section G appliqué (mode opératoire numéroté, tableau obligatoire pour grandeur-quotient, cohérence question/manipulation, ordre des séquences, un exercice par notion). Sauvegarde PC-v1 : archives/PROMPT_COMPLET_Forge_PC_v1_avant_affinage_26-10-2026.md. Notation officielle CI : masse volumique « a » (pas ρ), confirmée par la bibliothèque. SVT : utilisateur confirme que allèles/génotypes ABO sont au programme de 3e ; le tableau d'habiletés SVT 3e varie d'une génération à l'autre (retrieval KB) → à surveiller.
- 26/10 (PC v2 testée) : 5e 9432 car., 3e 8433 car. : séquences, modes opératoires numérotés, tableau ρ (A,B,C), évaluation couvrant toutes les notions 3e → OK à publier après test de non-régression (SVT + 1 fiche Maths). À intégrer au PROCHAIN lot (non testé) : exercices d'évaluation avec valeurs DIFFÉRENTES des exemples résolus (3e : 216/80 repris tel quel) ; exercice couvrant aussi le vocabulaire (émulsion/suspension, sédiment) ; tableau de données aussi pour la densité. À TRANCHER avec l'utilisateur : notation officielle de la masse volumique (« a » vs « ρ ») — les générations varient selon la recherche dans la bibliothèque.

26/10 (Forge Maths) : section H « MATHÉMATIQUES — COMPLÉMENTS » ajoutée (séquences + découverte avant énoncé, exemples résolus Données/Propriété/Calcul/Conclusion, évaluation 3 exercices avec valeurs différentes des exemples, Durée vide si absente) + pointeur section 4. Backups : archives/A_COLLER_Forge_SVT_PC_avant_Maths_26-10-2026.txt. À TESTER : « Mathématiques 4e : le théorème de Pythagore » + une autre classe/chapitre (ex. 3e). Jeton GitHub « Serveur Contabo » : non utilisé sur le serveur (aucun identifiant mémorisé), laissé expirer le 26/10.

26/10 (suite) : Forge Maths v2 testée (Pythagore 4e 8267 car., équations 3e OK) → à publier. Français testé (état de départ) : COD/COI 4e 7172 car. (sobre, 1 seul Développement), lecture méthodique « Le Dormeur du val » 8927 car. (excellente, citations exactes), récit 6e 4333 car. (trop court, pas de corpus). Ajout section I (Français langue/expression écrite) dans la Forge (sauvegarde archives/A_COLLER_Forge_Maths_v2_avant_Francais_26-10-2026.txt). Atelier des évaluations : Maths 4e OK (barème 20 juste), SVT 3e : numérotation fausse (1..5 puis 6 puis 3) + « b)) » → règle NUMÉROTATION DES QUESTIONS GROUPÉES ajoutée (sauvegarde archives/PROMPT_COMPLET_Atelier_avant_numerotation_26-10-2026.md ; fichier prêt à coller prompts_a_coller/A_COLLER_Atelier_Evaluations.txt). IDÉE FUTURE : formulaire à renseigner (durée, source, nb d'exercices, barème…) sur la page essai-enseignant.

26/10 soir : tests Français avec section I OK (récit 6e 8874 car., COD/COI 4e 6715 car.) ; Atelier SVT 3e numérotation corrigée (10+10), Maths 4e 8+12 OK. Affinage section I (habileté temps verbaux, énoncés d'exercices complets dans l'activité du professeur) – sauvegarde archives/A_COLLER_Forge_Francais_v1_avant_affinage_26-10-2026.txt. Constat : répartition Partie A/B de l'Atelier varie (8/12 en maths, 10/10 en SVT) – à fixer si l'on veut une règle. À PUBLIER : Forge + Atelier.

26/10 soir : Forge (SVT/PC/Maths/Français), Atelier évaluations, Gardien PUBLIÉS. Consultant Primaire sous gpt-6-luna Max 8192 : tests OK (Bonjour sobre, CP1 Routine + leçon 17 « m » séance 2 réelle dans la bibliothèque, CM2 Calculine refusé à bon droit, CE2 sem.10 jour 1 correct) MAIS : tutoiement dans la séance CP1 ("Fais lire"), et « je n'ai pas les autres jours » alors que la bibliothèque a les 4 jours de la sem.10 CE2 (récupération limitée par Top K). Ajout de 3 règles (vouvoiement, partiel ≠ inexistant, cadrage) dans prompts_a_coller/A_COLLER_Consultant_Primaire.txt (sauvegarde archives/PROMPT_COMPLET_Cabinet_Primaire_avant_luna_tests_26-10-2026.md). À vérifier : Top K des paramètres de récupération du Consultant Primaire.

26/10 soir : Consultant Primaire publié-prêt (règle NE JAMAIS MÉLANGER LES CLASSES ; progressions CE2 français re-structurée ; CP1/CP2 sem.10 = révision ; réglages base 0,3/0,7 Top K 10). FORMULAIRE essai-enseignant : champs facultatifs (durée, matériel, consigne ; évaluation : type, durée, nb exercices, barème ; primaire : durée, consigne) → gateway ajoute « Précisions de l'enseignant (à respecter à la lettre) : … » à la requête ; lignes PRÉCISIONS ajoutées aux prompts Forge secondaire et Atelier (sauvegardes archives/*avant_precisions_26-10-2026*, essai-enseignant.avant_formulaire, main.avant_formulaire_essai). NON DÉPLOYÉ. Forge Primaire : test post-luna reporté après les chantiers.
26/10 soir : FORMULAIRE GUIDÉ Forge secondaire (bouton « 📋 Formulaire guidé » à côté des suggestions, fonction ouvrirFormulaireGuide dans app.js, garde dans le gestionnaire .btn-suggestion). Sauvegardes archives/app.avant_formulaire_guide_26-10-2026.js et index.avant_formulaire_guide_26-10-2026.html. app.js?v=3.6, service-worker v112. NON DÉPLOYÉ ; Atelier à suivre après test Forge.
26/10 soir : formulaire guidé Forge TESTÉ OK (durée 55 min respectée). Ajout formulaire guidé ATELIER (app.js v=3.7, service-worker v113, sauvegardes archives/*avant_formulaire_atelier_26-10-2026*). À déployer + tester (Pythagore 4e, devoir, 2 exercices, Partie A 8 / B 12). Constat mineur Forge : mot « Développement » parfois isolé en fin de trace de Présentation.
26/10 soir : BUG Atelier : PARTIE A absente de l'énoncé quand le modèle écrit « EXERCICE 1 » sous PARTIE A (l'occurrence 'exercice' coupait la partie). Correctif app.js (exercice filtré en canevas PARTIE A/B), v=3.8, SW v114. Règle PRÉCISIONS/en-tête ajoutée au prompt Atelier (aussi utile). Sauvegarde archives/app.avant_correctif_exercice_26-10-2026.js.
26/10 soir : Atelier retesté OK après correctif (Partie A/B affichées, 8+12=20, durée 55 min). Ajout règle en-tête minimal (pas de Type/Nombre d'exercices inventés) dans prompt Atelier — à coller dans Dify.
27/10 : PALETTE boutons rapides sémantique (sug-principal bleu profond / sug-outil turquoise / sug-ponctuel orange / sug-violet / sug-secondaire gris) appliquée à Sas, Atelier, Forge ; onglets renommés Leçons ; boutons Sas Quiz + Explique-moi autrement ; prompt Espace Préparation : bloc « QUIZ À LA DEMANDE » (5 blocs quiz consécutifs) + « Explique-moi autrement ». Élève Général passé sur gpt-6-luna (Max 3501, à relever ~6000 ; reasoning effort off). SW v115. NON DÉPLOYÉ. Sauvegardes archives/*avant_palette_boutons_27-10-2026*, *avant_quiz_bouton_27-10-2026*.
27/10 : Palette en couleurs PLEINES (principal bleu #1D4ED8 plus grand+ombre, outil #0F766E, ponctuel #C2410C, violet #6D28D9, secondaire gris), Formulaire guidé placé en premier (Atelier, Forge). Nouveau formulaire « Épreuve BEPC / BAC » (atelier_officiel dans FORMULAIRE_GUIDE, envoie le message « Épreuve type BEPC/BAC au format officiel — … » vers l'Atelier). app.js v=3.9, SW v116. ALERTE : Élève Général répond « Je n'ai pas de réponse à formuler » (gpt-6-luna, Max 3501 puis 6000 → vérifier publication + Reasoning Effort low).
27/10 : couleurs v2 (dégradés vifs : turquoise/vert/ambre/corail/violet, gris atténué, bleu Formulaire guidé inchangé) ; Sas : Exercice=vert, Explique=ambre ; formulaire « Corriger des copies » (atelier_copies : avertissement bonus/appréciation enseignant + rappel photo + bandeau + trombone surligné, SANS envoi auto). app.js v=3.10, SW v117. Sauvegardes archives/*avant_degrades_27-10-2026*, *avant_form_copies_27-10-2026*.

- 27/10/2026 : Élève Général OK sous gpt-6-luna (Reasoning Effort = none, Max Tokens 8000 ; "low"/"medium" échouent avec les outils : « function tools require the Responses API with this reasoning effort »). Outils testés avec compte ELV- : generer_bilan_session OK (WhatsApp parent), ecrire_suivi OK. PROBLÈME CORRIGÉ : l'agent ne voit pas les clics du quiz -> bilan 18/20 alors que 1/5. app.js v3.11 : relais des résultats (enregistrerResultatEvaluation / resumeResultatsEvaluations) joint à la fin de session et aux demandes de bilan ; service-worker v118. Reste : règle de notation dans A_COLLER_Espace_Preparation.txt (coller dans Dify).
- 27/10/2026 : prompt Élève Général : bloc « LA NOTE DU BILAN » + sentinelle « COMMENCE par » (à coller dans Dify + publier). Backup archives/A_COLLER_Espace_Preparation_avant_note_bilan_27-10-2026.txt
- 27/10/2026 : palette des boutons étendue à Cabinet, Forge primaire, Cabinet primaire (index.html, service-worker v119). Sauvegarde archives/index.avant_palette_cabinet_primaire_27-10-2026.html

- 27/10/2026 : palette validée par l'utilisateur sur Cabinet / Forge primaire / Cabinet primaire. À FAIRE PLUS TARD : revoir les onglets « Évaluations / Leçons / Cabinet » (barre de catégories en haut). Aussi à tester plus tard : « Corriger des copies » avec une vraie photo, formulaire BEPC/BAC, Forge Primaire sous luna, noter_notion / notification_parent. Option : retirer le mot « cliquable » de l'intensité du bilan (prompt Élève Général).

## FILE DES CHANTIERS (27/10/2026, décidée avec l'utilisateur)
1. Lecteur d'Emploi du Temps : étape de relecture/correction avant enregistrement + conseil photo + retest limiteur 5/jour/IP (EN COURS)
2. Bibliothèque Philosophie
3. Formats d'épreuve de certaines disciplines
4. Consignes pour des leçons/évaluations moins brèves selon les matières (vérifier ce qui est déjà fait : SVT, PC, Maths, Français faits le 25-26/10 ; restent les autres)
5. EN DERNIER : informer le Gardien WhatsApp de toutes ces améliorations (prompt A_COLLER_Gardien_Accueil.txt)

- 27/10/2026 LECTEUR EDT : relecture avant enregistrement. gateway/main.py : /api/planning/lire_photo accepte apercu=1 (ne sauvegarde pas, renvoie status "apercu"), nouvelle route POST /api/planning/valider (matricule ELV-, créneaux relus, nettoyer_creneaux, max 80). index.html : conseil photo + bloc #planning-relecture ; app.js v3.12 (planningAfficherRelecture/Ajouter/Valider/ReprendrePhoto) ; SW v120. Sauvegardes archives/*avant_relecture_planning_27-10-2026*. À déployer (scp + restart + GitHub) puis tester avec une photo. Non couvert : /api/planning/pre_abonnement (parent avant paiement) reste sans relecture.
- 27/10/2026 : BUG limiteur planning : verifier_freemium compte À VIE (pas de date) -> « réessayer demain » faux. Ajout verifier_quota_quotidien (date dans le nom de l'outil), limite 8/jour pour planning_photo et planning_pre_abonnement. À déployer (scp+restart) et purger les anciens compteurs : sqlite3 sur la base, DELETE FROM freemium_usage WHERE outil IN ('planning_photo','planning_pre_abonnement'). Sauvegarde archives/main.avant_quota_quotidien_27-10-2026.py
- 27/10/2026 : RELECTURE AVANT PAIEMENT (parcours parent EDT Progression) : pre_abonnement?apercu=1 + route /api/planning/pre_abonnement_valider ; index.html (#pre-abo-relecture, bouton « Lire la photo ») ; app.js v3.13 (preAboAfficherRelecture/Valider/...) ; SW v121. Sauvegardes archives/*avant_relecture_pre_abo*. À déployer scp+restart+GitHub.
- 27/10/2026 : relecture EDT v2 : onglets par jour (Lun..Sam avec compteur), photo envoyée en miniature agrandissable, suppression/ajout par jour (relectureAfficher/Refiltrer/Ajouter/Supprimer/AgrandirPhoto). app.js v3.14, SW v122. Sauvegarde archives/app.avant_relecture_jours_photo_27-10-2026.js. Idée future : saisie directe jour par jour sans photo si beaucoup d'EDT manuscrits ratés.
- 27/10/2026 : correctifs relecture EDT espace élève : modal planning scrollable (max-height 90vh) ; /api/planning/valider accepte MATRICULE_CREATEUR ou ELV- valide (est_sceau_valide) — l'ancien contrôle « commence par ELV- » refusait le code de test du créateur. app.js v3.15 (inchangé hors version), SW v123. Décision : le modal 📅 reste dans l'espace élève (réservé aux porteurs de Sceau ; sans Sceau -> modal Premium).
- 27/10/2026 : Lecteur EDT (relecture élève + parent, onglets, photo, quota/jour, valider) TESTÉ OK et déployé. Prochain chantier : Bibliothèque Philosophie.
- 27/10/2026 : onglets Espace Enseignant redessinés (rectangles, dégradés : famille indigo pour Professeur, émeraude pour Instituteur, repos = carte blanche + liseré, actif = dégradé + lueur ; bouton Catégorie rectangulaire). index.html, SW v124. Sauvegarde archives/index.avant_onglets_rectangulaires_27-10-2026.html

## Sas des ateliers Enseignant (27/10/2026)
Apres le choix Professeur/Instituteur, un sas (#teacher-atelier-chooser) affiche des cartes Evaluations/Lecons/Cabinet (ou Lecons/Cabinet primaire); plus aucun atelier ne se lance automatiquement (fini l amorcage IA sur Evaluations). Fonctions app.js: afficherSasAteliersEnseignant, masquerSasAteliersEnseignant. app.js v3.16, SW v125. Philosophie: PDF DPFC progressions 2026-2027 (Premieres A1-A2 / C-D-E, Terminales A1-A2 / C-D-E) et programmes 2018-2019 fournis par Constant, a integrer.

Philosophie 27/10/2026: 09_PHILOSOPHIE_progressions_2026_2027.md reecrit avec progressions semaine par semaine + habiletes/contenus (Premieres, Terminales A, Terminales C-D-E) + rythme des evaluations. Reste: guides d execution pages 17-65 Premiere non integres; fiches de notions et citations manquantes.

Philosophie 27/10/2026: fiches de notions Terminale lots 1-4 valides et ranges dans bibliotheque_PHILOSOPHIE_FICHES_NOTIONS/ (01 a 04; les BROUILLON_* sont a supprimer par Constant). Reste: methode dissertation/commentaire, histoire de la philosophie Premiere, citations manquantes (Langage et verite, Histoire et humanite). A televerser dans la base Dify Philosophie.

Philosophie 27/10/2026: methode 05_methode_dissertation_commentaire (+ bar emes /16 bac et /20 DPFC) rangee; point 8 ajoute a A_COLLER_Atelier_Evaluations.txt (section LA CORRECTION DE COPIE) + regle grille dissertation Philosophie; a republier dans Dify (Atelier Evaluations). Sauvegarde archives/A_COLLER_Atelier_Evaluations_avant_baremes_philo_27-10-2026.txt.

27/10/2026: FORMULAIRE GUIDE PRIMAIRE (forge_primaire dans FORMULAIRE_GUIDE; bouton Formulaire guide + sug-ambre sur Fiche evaluation); app.js v3.17, SW v127; PRECISIONS ajoutees a PROMPT_COMPLET_Forge_Primaire.md (a republier dans Dify). Sauvegardes archives/*avant_formulaire_primaire_27-10-2026*. Non deploye/non teste.

27/10/2026: Forge Primaire: la duree saisie par linstituteur prime sur celle de la progression (pas de question; ajustement signale en une phrase); formulaire primaire teste OK. app.js v3.18, SW v128. A republier: PROMPT_COMPLET_Forge_Primaire.md.

## 28/10/2026 — Visite guidée + badges « Nouveau »
- Nouveau fichier interface/visite-guidee.js (moteur + définitions VISITES + registre NOUVEAUTES), chargé après app.js (index.html : app.js?v=3.19, visite-guidee.js?v=1). Ajouté à FICHIERS_COQUILLE, SW v129.
- Boutons « ❓ Aide » : barre des onglets enseignant (.btn-aide-visite) et bannière du Sas (.btn-banniere-aide). Lancement auto à la 1re visite (aucun historique) via demarrerVisiteAuto() appelé dans switchTeacherTool, afficherSasAteliersEnseignant et l'ouverture du Sas.
- Pour documenter un nouveau bouton : ajouter une étape dans VISITES (sélecteur CSS) ; pour le badge « Nouveau » : une ligne dans NOUVEAUTES.
- Sauvegardes : archives/*avant_visite_guidee_28-10-2026*.

## 28/10/2026 — Citations philosophie lot 5 + quota freemium
- Lot 5 (12 citations : Camus, Wittgenstein x2, Boileau, Aristote, Marx x2, Kant, Valéry, Lévi-Strauss, Montaigne, Hampâté Bâ) versé dans bibliotheque_PHILOSOPHIE_CITATIONS/01_citations_verifiees_terminale.md (total 37). Nouvelle règle : l'agent indique le statut (authentique / reformulation courante / attribuée). À ré-uploader dans la base Dify Philosophie. Le BROUILLON_citations_lot5_* est à supprimer à la main.
- Quota freemium Sas (MAJ 01/11/2026) : 7 messages par APPAREIL (device_id, à vie) + garde-fou 21/semaine/IP (constantes QUOTA_GRATUIT_APPAREIL / QUOTA_GRATUIT_IP_SEMAINE dans main.py ; sans device_id repli IP à vie). Ancien système : 10 messages ENVOYÉS par l'élève (compteur par IP, à vie, +1 par requête reçue ; réponses non comptées ; le message d'amorçage automatique compte). nginx transmet X-Forwarded-For (IP réelle OK). Constant envisage de baisser la limite (main.py : verifier_freemium(client_ip, limite=10, outil="sas")) — vérifier alors les textes/Gardien mentionnant « 10 ».

## 29/10/2026 — Lecture mobile élargie + fiches histoire de la philo (Première)
- style.css : bloc « LECTURE SUR TÉLÉPHONE » (≤700px) : marges du fil réduites, bulle assistant pleine largeur, bulle qui entoure une fiche (:has(> .fiche-lecon / .fiche-carte)) rendue transparente, barre de saisie compacte. Bureau inchangé. SW v130. Sauvegardes archives/*avant_largeur_mobile_29-10-2026*.
- BROUILLON_fiches_histoire_philosophie_premiere.md (4 leçons Compétence III Première) en attente de validation de Constant ; à renommer 06_fiches_histoire_philosophie_premiere.md puis à uploader dans la base Dify Philosophie une fois validé.
- 29/10/2026 (suite) : fiches histoire philo Première VALIDÉES -> 06_fiches_histoire_philosophie_premiere.md (avec section « Repères africains »). Citations lot 6 ajoutées (Césaire authentique ; Ki-Zerbo, Diop, Senghor « assimiler » = ATTRIBUÉES), total 41. À ré-uploader dans Dify (06 + 01_citations). BROUILLON_fiches_histoire_philosophie_premiere.md à supprimer à la main.
- Correctif mobile (style.css) : plus de glissement latéral (overflow-x hidden, min-width 0, retrait de width:100% qui s'ajoutait à la marge de l'avatar mascotte), avatar mascotte visible, bulle de fiche transparente seulement si elle contient une .fiche-carte.
- 29/10/2026 (soir) : BUG quiz Sas affichés en JSON brut (clôture « ``} » abîmée / étiquette absente) -> extraireEtRendreQuiz tolérant (app.js v3.20, SW v131 ; sauvegardes archives/*avant_quiz_tolerant_29-10-2026*). Un bloc sans étiquette « quiz » n'est transformé que si son JSON est un vrai quiz.
- FILE DES CHANTIERS (mise à jour) : (3) formats d'épreuve : commencer par PHILOSOPHIE puis autres matières ; (4) consignes leçons/évaluations moins brèves ; (5) Gardien WhatsApp en dernier ; NOUVEAU (idée à cadrer) : espace collaboratif — proposition : phase 1 « défi par lien » (quiz partagé, correction côté navigateur), phase 2 « classe avec code » pilotée par l'enseignant, pas de chat libre entre élèves.
- 29/10/2026 (nuit) : FORMAT D'ÉPREUVE PHILOSOPHIE ajouté (gabarit « PHILOSOPHIE — BAC » dans A_COLLER_Atelier_Evaluations.txt + PROMPT_COMPLET_Atelier_Evaluations.md ; section Philosophie dans 29_FORMATS_EPREUVES_BEPC_BAC_synthese.md). ⚠️ structure 4 pts (questions de cours) + 16 pts (dissertation OU commentaire, au choix) à confirmer avec un sujet officiel ; durée/coefficient jamais inventés. À republier dans Dify (Atelier Évaluations) + remplacer 29_FORMATS dans la base si elle y figure. Sauvegardes archives/*avant_format_philo_29-10-2026*.
- CHANTIER « Défi par lien » : cahier des charges dans cahiers_des_charges/CDC_defi_par_lien.md (v1, à valider). Visible du créateur seul via FONCTIONS_EN_TEST (variable .env serveur, mode CREATEUR/BETA/TOUS) + /api/fonctions-actives ; routes de création en 404 pour les autres. Aucun code écrit à ce jour.
- 29/10/2026 (fin de soirée) : format philo CONFIRMÉ par Constant (sujet officiel BAC 2026 A1-A2 : 4 + 16) ; règle commentaire : texte fourni par l'enseignant, sinon « Texte conçu pour l'évaluation » jamais attribué à un auteur réel ; un seul sujet demandé -> uniquement ce sujet /16. À republier dans Dify (Atelier Évaluations).
- DÉFI PAR LIEN : décisions de la section 14 validées. ÉTAPE 1 FAITE : gateway/main.py (FONCTIONS_EN_TEST, MATRICULES_BETA, fonction_visible_pour, POST /api/fonctions-actives) + app.js v3.21 (fonctionActive, chargerFonctionsActives) + SW v132. Déploiement : scp main.py ; ajouter dans le .env du serveur la ligne FONCTIONS_EN_TEST=defi=CREATEUR ; redémarrer edukatchat.service. Sauvegardes archives/*avant_interrupteur_fonctions_29-10-2026*.

- 29/10/2026 — Défi par lien, étape 1 déployée/testée ; étape 2 codée (tables defis/defis_resultats + purge 30 j, boucle 6 h dans main.py), à déployer par scp + restart. Sauvegarde archives/main.avant_defi_etape2_29-10-2026.py.
- 29/10/2026 — Défi, étape 2 déployée ; étape 3 codée (POST /api/defis dans main.py ; app.js v3.22 : data-quiz-source sur .quiz-carte, bouton défi, fenêtre ; style.css bloc DÉFI ; service-worker v133). À déployer : scp main.py + restart, puis GitHub. Sauvegardes archives/*avant_defi_etape3*.
- 29/10/2026 — Défi, étape 3 validée ; boutons rapides resserrés (style.css, SW v134) ; étape 4 codée : routes jeu dans main.py + interface/defi.html + defi.js (à déployer).
- 29/10/2026 — Défi étape 4 validée sur téléphone. Correctif « code du quiz visible un instant pendant la frappe » : app.js v3.23 (extraireEtRendreQuiz(texte, enCours) masque le bloc non refermé), index.html, service-worker v135 : À POUSSER sur GitHub. IDÉE à cadrer : images (catalogue illustrations_manifest.json : 467 dont 18 photos réelles) dans les cartes de quiz via un champ optionnel « image » ; attention droits, convenance pour mineurs, poids mobile.
- 29/10/2026 — Défi étape 5 codée (classement + signalement : main.py routes /classement et /signaler + table defis_signalements ; defi.html/defi.js v2). À déployer : scp main.py + restart ; GitHub defi.html, defi.js, app.js v3.23, index.html, service-worker v135.
- 30/10/2026 — Boutons de la bannière du Sas (Nouvelle session / Historique / Aide) rendus plus discrets (style.css, SW v136). Défi étape 5 déployée et vue sur téléphone. Étape 6 : cahiers_des_charges/PLAN_ESSAIS_defi_etape6.md.

- 30/10/2026 BOUTONS RAPIDES : supprimés Évaluation libre, Leçon libre, En-tête, Nouvelle fiche prépa/éval (primaire). Ajoutés : data-prefill (modèle à compléter, 0 jeton) pour situation-problème, difficulté, élève en difficulté, exercice précis ; data-apres-doc (visibles après un document) : sources, variante, corrigé-type, remédiation, activités, éval de fin de séance, différenciation, exercices ; formulaires primaire séparés (préparation / évaluation). app.js v3.24, SW v137. Sauvegardes archives/*avant_boutons_utiles_30-10-2026*.

- 30/10/2026 STYLE BOUTONS RAPIDES « vivants » : bloc final de style.css (verre teinté par rôle, bouton principal dégradé indigo→bleu avec reflet, survol/appui, apparition en cascade, thème sombre, prefers-reduced-motion). Aussi : Sas — Réviser en prefill, Quiz/Explique-moi après 1re explication, Préparer la rentrée visible juillet-septembre. SW v140, app.js v3.26.

- 30/10/2026 CORRECTION : le style « vivant » des boutons rapides a été ANNULÉ (malentendu : il s'agissait du menu ☰ et des boutons thème/plein écran). Boutons rapides revenus à leur style d'avant. Menu ☰ (SVG, croix à l'ouverture), thème (halo lune/soleil), plein écran (SVG turquoise) embellis : bloc final de style.css. SW v141.

- 30/10/2026 : bouton Sas « Nouvelle session » renommé « Nouvelle discussion » (index.html, visite guidée, messages app.js). Sélecteur de photo à bouton « + » (Appareil photo / Galerie) pour l'emploi du temps élève (planning-photo-input) et l'étape 3/3 de l'abonnement parent (pre-abo-photo-input) : installerSelecteurPhoto() dans app.js, input d'origine conservé masqué. app.js v3.27, SW v142.

- 30/10/2026 QUIZ : la bonne réponse était presque toujours en A -> melangerOptionsQuiz() dans app.js (mélange déterministe au rendu, sauf Vrai/Faux et options « toutes/aucune/A et B »), data-quiz-source reflète l'ordre mélangé (Défi cohérent). app.js v3.28, SW v144.
- 30/10/2026 NOUVEAU CHANTIER (demandé par l'utilisateur) : ESPACE COLLABORATIF ENSEIGNANT -- activité de l'enseignant avec ses élèves et ses collègues + travail collaboratif sur les exposés à créer. À cadrer APRÈS les formats d'épreuve (lien avec Défi phase 2 « classe avec code », sans chat libre entre élèves).
- 30/10/2026 FORMATS D'ÉPREUVE : déjà faits = Maths BEPC/BAC (général), SVT, PC, EDHC, Français (3 épreuves), Philosophie, Anglais BEPC. ORDRE PROPOSÉ : 1 Histoire-Géographie (BEPC+BAC) ; 2 Anglais BAC + Espagnol + Allemand ; 3 BAC par série (Maths C/D/A, PC, SVT) ; 4 Primaire (CEPE/compositions) ; 5 CAFOP. Fichiers sources : bibliotheque_PROGRAMMES_SECONDAIRE_2026_2027/29_FORMATS_EPREUVES_BEPC_BAC_synthese.md, 27_HG_methodologie..., 28_HG_graphiques.


## Chantier ESPACE COLLABORATIF « Salle d'étude » (cadré le 30/10/2026)
- Cadre complet : `cahiers_des_charges/CAHIER_espace_collaboratif_SALLE_D_ETUDE.md` (élèves entre eux d'abord, aucun texte libre, code comme le Défi, phases 1 à 4). Rien n'est codé ; à lancer après le Défi étape 7.

## Schémas Histoire-Géographie (30/10/2026) — priorité décidée par Claude (HG n'avait que 13 schémas)
- Étape 1 faite : cartes de la Côte d'Ivoire (script de fabrication en cloud, contours Natural Earth) : `…/geographie/3e/120_fond_carte_CI_vierge.png` (img469, sans_legendes, fond vierge à colorier/compléter), `121_carte_CI_villes.png` (img470, légendée), `122_carte_CI_villes_sans_legendes.png` (img471, 10 villes numérotées). main.py : `histoire_geo` ajouté à ATELIER_MATIERES_ILLUSTREES et MOTS_CLES_MATIERE_ATELIER ; prompt Atelier : règle FOND DE CARTE. À déployer : images (GitHub Desktop), manifeste + main.py (scp), restart, prompt Dify + Publier ; test « BEPC HG 3e, carte des ressources naturelles ». Sauvegardes `archives/*avant_cartes*` et `main.avant_hg_atelier_30-10-2026.py`.
- Suite : ressources naturelles CI (mines, hydrocarbures, littoral : positions à valider avec Constant), Afrique de l'Ouest / Afrique / monde vierges, frises chronologiques vierges, modèles de diagrammes semi-circulaires et courbes ; puis SVT (digestif, cœur, villosité) et Physique-Chimie (montages, circuit).
- Défi PUBLIC décidé le 30/10/2026 : FONCTIONS_EN_TEST passe à defi=TOUS dans le .env serveur (aucun changement de code), tests de bout en bout à poursuivre ensuite.

## Salle d'étude — phase 1 codée (30/10/2026)
- Serveur : gateway/main.py (section « SALLE D'ÉTUDE », tables salles / salles_membres / salles_aides / salles_reactions / salles_signalements, routes /api/salles…). Fonction « salle » fermée au public (absente de FONCTIONS_EN_TEST = CREATEUR). Création : ELV- ou ENS- Premium ; 2 à 6 membres ; plan de 2 à 12 chapitres ; 30 jours ; aucun texte libre entre élèves (réactions Bravo / Courage / Merci, « Besoin d'aide »).
- Page : interface/salle.html + salle.js (sans code dans l'adresse = création ; avec ?c=CODE = rejoindre / salle). Testée en local (Playwright) avec le vrai code serveur.
- À faire ensuite : bouton d'accès dans l'application (gardé par fonctionActive('salle')), plan de révision proposé par l'IA, quiz de groupe + classement, vue enseignant, autorisation parentale (à décider), prolongation de la salle.
- Déploiement : scp main.py + redémarrage ; copier salle.html et salle.js dans le dépôt GitHub. Pour ouvrir à tous plus tard : FONCTIONS_EN_TEST=defi=TOUS,salle=TOUS.
- Salle d'étude phase 2 (30/10/2026, décision de Constant : texte d'exposé déposé dans la salle validé) : table salles_sections, routes /api/salles/{code}/section/(prendre|liberer|deposer|lire) et /expose ; 3 000 caractères par section, filtre liens et mots interdits, visible des seuls membres, effacé si l'auteur est retiré. Durée : date cible + 7 jours (30 jours minimum, 150 maximum), 60 jours sans date, prolongation de 30 jours par le créateur (240 jours maximum). Décisions : pas d'autorisation parentale ; nom « Salle d'étude » conservé ; IA rarement sollicitée (suggestion de plan et relecture seulement à la demande, quota de l'élève).
- Reste à faire : bouton d'accès dans l'application (fonctionActive('salle')), suggestion de plan par l'IA à la demande, relecture d'une section à la demande, lancer un Défi depuis la salle, vue enseignant.
- Salle d'étude : bouton d'accès ajouté (30/10/2026) : menu de navigation « 📚 Salle d'étude » (index.html, bloc menu-nav-salle-bloc, affiché par app.js v3.30 seulement si fonctionActive('salle') ; service-worker v147). Page salle.html sans code = liste « Mes salles » mémorisées sur l'appareil (clé eduka_salles) ou création. Exposé : le formulaire parle de « thème » et de « parties » (préremplies Introduction / Développement / Conclusion) ; 1 à 12 lignes de plan pour tous les objectifs.


## Salle d'étude — phase 3 (30/10/2026)
- Défis dans la salle (table salles_defis, POST /api/salles/{code}/defi, liste dans /etat), suggestion de parties à la création (POST /api/salles/suggerer, créateur Premium, 5/jour), relecture de SA section (POST /api/salles/{code}/section/relire, 3/jour Premium, 1/jour gratuit), suivi créateur (POST /api/salles/{code}/suivi : jamais de conversations privées).
- Agent Dify « Salle d'étude » (application de type Terminaison, variable query paragraphe 4000 car., endpoint completion-messages) : prompt dans prompts_a_coller/A_COLLER_Salle_d_etude.txt ; ajouter DIFY_API_KEY_SALLE dans le .env (sans clé : « IA pas encore activée »).
- Reste : option de partage de défi directement depuis la fenêtre Défi de l'application (aujourd'hui : coller le lien dans la salle).
- Partage de défi en un clic (30/10/2026) : la fenêtre « Défier un camarade » de app.js propose « Partager aussi dans une salle d'étude » (salles mémorisées dans localStorage eduka_salles) et appelle POST /api/salles/{code}/defi après création. app.js?v=3.31, service-worker v148. Non testé dans un navigateur.
- Visite guidée (texte du quiz/défi) et Gardien WhatsApp (paragraphe Salle d'étude) mis à jour le 30/10/2026 ; service-worker v149, visite-guidee.js?v=4. Gardien à re-coller dans Dify.
- Salle : consigne épinglée (POST /api/salles/{code}/consigne, 300 car.) et commentaire de section (POST …/section/commenter, 400 car.), créateur seulement ; tables salles_consignes/salles_commentaires. salle.js?v=8, service-worker v151. Testé en TestClient.
- 30/10/2026 : le code d'accès n'est plus effacé sur erreur passagère (verifier-sceau renvoie temporaire:true ; 429/erreur réseau ne vident plus eduka_sceau). app.js?v=3.32, sw v153.

## Idée à instruire plus tard : « Mon Avenir » / orientation (30/10/2026, source : discussion ChatGPT fournie par Constant, tronquée à la rubrique 4)
- Ne pas créer un nouvel espace : enrichir Boussole / Boussole universitaire (relire d'abord leurs agents pour éviter les doublons).
- Ordre proposé : (1) « À quoi ça sert ? » dans le répétiteur (1-2 métiers liés au chapitre) ; (2) ~10 puis ~30 fiches métiers illustrées, centrées Côte d'Ivoire, sans salaires ; (3) parcours après la 3e / après le BAC avec sources officielles datées (jamais de conditions d'admission, concours ou bourses inventés) ; (4) dialogue « Quel avenir me ressemble ? » en dernier, sans profil conservé sur un mineur.
- Piste Premium : rapport d'orientation pour les parents (Espace Parents).

## Séances de classe (31/10/2026) — quiz cliquables à créneau horaire pour toute une classe
- Décisions de Constant : classe entière (jusqu'à 80 élèves), fenêtre horaire (pas de direct), questions générées par l'IA puis relues par l'enseignant, élève = « Prénom + initiale » ou nom choisi dans la liste de classe ; l'élève voit son résultat ; les MATRICULES ne quittent jamais le navigateur de l'enseignant (le serveur ne reçoit que des noms).
- Serveur (main.py, testé en TestClient) : tables seances / seances_eleves ; POST /api/seances/generer, POST /api/seances, GET /api/seances/{code}, POST …/rejoindre /question /repondre /resultat /tableau /liberer /retirer, POST /api/seances/mes-seances. Fonction « seance » dans FONCTIONS_CONNUES (absente de FONCTIONS_EN_TEST = visible du seul Créateur ; ouvrir avec seance=TOUS). Agent Dify : application Terminaison, variable query (paragraphe 4000 car.), clé DIFY_API_KEY_QUIZ, prompt prompts_a_coller/A_COLLER_Generateur_Quiz.txt.
- Anti-triche : tirage aléatoire dans la banque, ordre des questions et des choix propre à chaque élève, minuteur serveur, correction jamais envoyée avant la réponse (examen : seulement après fermeture), signaux (réponses très rapides, mêmes erreurs) sans sanction automatique.
- Pages faites et testées avec Playwright (31/10/2026) : seance.html/seance.js (élève), seance-prof.html/seance-prof.js (enseignant), seance.css ; entrée de menu « 📝 Séances de classe » (index.html, app.js?v=3.33, sw v155) visible selon fonctionActive('seance') ; paragraphe Gardien ajouté. KaTeX non vérifié (CDN bloqué en test) ; agent Dify réel non testé.
- À faire plus tard : visite guidée pour les enseignants, ouverture à tous (FONCTIONS_EN_TEST …,seance=TOUS), éventuelle vue enseignant dans l'Espace Enseignants.

## Dupliquer une séance (31/10/2026)
- Route `POST /api/seances/{code}/contenu` (propriétaire ENS- uniquement, 403 autre prof, 404 élève/inconnue) : renvoie titre, matière, classe, chapitre, mode, nb, durée, questions, liste d'élèves (jamais les résultats).
- seance-prof.js : bouton « Dupliquer » dans la liste et dans le tableau ; préremplit le formulaire (titre + " (2)"), reprend la liste de classe (matricules locaux sinon noms serveur), l'enseignant choisit les nouveaux horaires.
- Prochaine étape : bibliothèque enseignant (« Enregistrer » sur les fiches Atelier/Forge, texte + métadonnées, hors copies d'élèves).

## Bibliothèque enseignant — étape 1 (31/10/2026)
- Fonction `bibliotheque` (FONCTIONS_CONNUES ; absente de FONCTIONS_EN_TEST = visible au Créateur seul ; `bibliotheque=TOUS` pour ouvrir).
- Table `bibliotheque` (proprietaire_hash = empreinte du code ENS-, titre, outil, matiere, classe, demande, contenu texte, empreinte sha256 anti-doublon). Max 150 fiches/enseignant, 40 000 caractères/fiche. Pas d'expiration, pas de PDF stocké.
- Routes `/api/bibliotheque/{enregistrer,liste,lire,renommer,supprimer}`. Refus serveur des « Correction de copie » (noms/notes d'élèves). Essai gratuit sans code ENS- : pas de bibliothèque.
- Front : bouton « 📚 Enregistrer » (app.js : boutonBibliotheque / enregistrerDansBibliotheque, sous les fiches Atelier/Forge/Cabinet) ; page bibliotheque.html/js (liste, filtre matière, lecture, copier, imprimer PDF, renommer, supprimer) ; entrée de menu « Ma bibliothèque » (menu-nav-biblio-bloc). app.js?v=3.35, SW v158, seance.css?v=3.
- Étape 2 à faire : « Réutiliser » (rouvrir une fiche dans l'Atelier/Forge avec demande préremplie), partage entre enseignants bien plus tard, visite guidée.

## Ajustements du 31/10/2026 (menu, bouton bibliothèque, accueil)
- Menu de navigation : max-height + défilement interne (index.html, .menu-navigation-panel). Badge « Nouveau » sans retour à la ligne.
- Bouton « 📚 Enregistrer dans ma bibliothèque » : rangée .message-actions en flex-wrap, note « Proposition à relire… » sur sa propre ligne (style.css, bas de fichier).
- /api/fonctions-actives : le front envoie eduka_sceau, à défaut eduka_sceau_enseignant.
- Notice & Mode d'emploi et Journal de Bord (index.html) mis à jour : Séances de classe + Dupliquer, Ma bibliothèque, Salle d'étude. Gardien (A_COLLER_Gardien_Accueil.txt) : Dupliquer + bibliothèque ajoutés. app.js?v=3.37, SW v160.

## Bibliothèque : conservation de la mise en page (31/10/2026)
- Problème : innerText d'un clone détaché donnait un texte sans retours à la ligne et du CSS parasite (SVG musique). Corrigé : app.js enregistre (1) le HTML nettoyé de la fiche (sans boutons/scripts/on*) et (2) un texte lisible obtenu via un hôte hors écran (SVG → « [Figure…] », KaTeX → $…$).
- Serveur : colonne `contenu_html` (ALTER TABLE auto), max 300 000 car., refus des balises/attributs dangereux (script, iframe, on*=, javascript:).
- bibliotheque.js : affiche le HTML assaini dans un Shadow DOM avec style.css + KaTeX (isolé de la page) ; sans HTML (anciennes fiches), repli sur le rendu texte. app.js?v=3.39, SW v162, bibliotheque.js?v=2.
- Les fiches enregistrées avant ce correctif ont un texte dégradé : à supprimer et ré-enregistrer.

## Bibliothèque — « Réutiliser » (31/10/2026, étape 2)
- bibliotheque.html/js : bouton « ✏️ Réutiliser dans <outil> » → index.html?reutiliser=ID.
- app.js : reutiliserFicheBibliotheque(id) lit la fiche (/api/bibliotheque/lire), ouvre l'espace enseignant dans le bon outil SANS amorçage IA, ré-affiche la fiche (HTML nettoyé) avec crayon/copier/imprimer (sans bouton Enregistrer), préremplit « Modifie cette fiche : ». Le premier envoi suivant joint la fiche comme document de référence (reutilisationEnCours + derniereReponseEnseignant). modeleActionsFicheEnseignant() factorise la rangée d'actions.
- Serveur : colonne `contenu_source` (markdown brut, utile à la Forge). app.js?v=3.40, SW v163, bibliotheque.js?v=3.
- Reste : partage entre enseignants (plus tard), visite guidée de la bibliothèque.

## Illustrations SVT 3e — appareil digestif, villosité, cœur (31/10/2026)
- Scripts : outils/schema_outils.py (helpers communs), schema_digestif.py, schema_villosite.py, schema_coeur.py (matplotlib, lancer `python schema_xxx.py`).
- Images 143–148 dans interface/images/illustrations/svt/3e/ (paires anatomie / sans_legendes) ; manifest img483–img488 (usage "sans_legendes" + "numeros").
- Règle : cœur = 13 repères, digestif = 12 → n'en demander que 6 à 8 au maximum à l'élève.
- File d'attente : Physique-Chimie (montages de séparation, circuit électrique), puis Histoire-Géographie (fonds de carte, frises).

## Illustrations Physique-Chimie 5e — montages de séparation (31/10/2026)
- Script outils/schema_separation.py (filtration, décantation avec ampoule à décanter, distillation simple), images 209–214 dans interface/images/illustrations/physique/5e/.
- img156/157/158 repointées vers les versions légendées 209/211/213 (les anciennes images « Schéma recréé » restent dans le dépôt, non référencées) ; nouvelles entrées img489–491 « sans_legendes » (7, 8 et 10 repères ; distillation = n'en demander que 6 à 8).
- Reste : circuit électrique simple (niveau scolaire à confirmer avec Constant avant de l'étiqueter), puis Histoire-Géographie (fonds de carte vierges, frises).
- Circuit électrique simple (Physique-Chimie **6e**, d'après le programme : « le circuit électrique ; la commande d'un circuit ») : outils/schema_circuit.py, images 215/216 dans physique/6e/, manifeste img492 (légendé) + img493 (sans_legendes, 6 repères). L'ancienne img145 (classée 2nde) reste inchangée.
- Suite : Histoire-Géographie (fonds de carte vierges, frises chronologiques).

## Cartes Histoire-Géographie — Afrique de l'Ouest (31/10/2026)
- outils/cartes/carte_afrique_ouest.py (+ geo_ao.json extrait de world-atlas/Natural Earth par ext2.js ; domaine public). Images 217 (fond vierge), 218 (15 pays nommés), 219 (15 pays numérotés) dans geographie/4e/.
- Manifeste img494–499 : mêmes 3 images enregistrées deux fois — geographie 4e (CEDEAO/UE, regroupements économiques) et histoire 5e (empires de l'Afrique de l'Ouest, Mali). Volontairement SANS carte des membres de la CEDEAO (appartenance en évolution : politique, à ne pas figer).
- Reste : Afrique et monde vierges, frises chronologiques vierges.
- Planisphère et Afrique (31/10/2026) : outils/cartes/carte_monde.py (+ geo_monde.json, ext3.js ; antiméridien déplié, Somalie+Somaliland fusionnés via shapely). Images 220–225 dans geographie/6e/ : 220 planisphère vierge, 221/222 continents et océans (11 repères), 223/224 repères de la Terre (équateur, tropiques, cercles polaires, Greenwich : 6 repères), 225 Afrique vierge (frontières ACTUELLES).
  Manifeste img500–508 : planisphère vierge (geographie 6e + histoire 6e), repères et continents (geographie 6e, leçon « Le repérage sur la Terre »), Afrique vierge (histoire 6e, histoire 1ere « partage de l'Afrique », geographie terminale « Afrique face à la mondialisation »).
- Reste : frises chronologiques vierges.

## Frises chronologiques vierges (31/10/2026)
- 3 frises vierges (aucune date/événement inscrit) : 226 libre (histoire 6e→terminale), 227 des siècles (6e→3e), 228 avant/après J.-C. (6e, 5e). Dossier interface/images/illustrations/histoire/frises/, script outils/frises.py.
- Manifeste : 13 entrées (img509–img521), usage "sans_legendes", numeros "AUCUN numéro…". Sauvegarde archives/illustrations_manifest.avant_frises_31-10-2026.json.
- File d'attente illustrations (SVT → Physique-Chimie → Histoire-Géographie) TERMINÉE.

- 31/10/2026 FORMATS D'ÉPREUVE (suite) : gabarits ajoutés dans A_COLLER_Atelier_Evaluations.txt + PROMPT_COMPLET_Atelier_Evaluations.md : Histoire-Géographie BEPC (3 exercices 4+10+6) et BAC A-B-C-D (3+3+7+7), Espagnol BEPC et BAC A2, Allemand BAC A2, Anglais BAC A1-A2 (sur 100 → /20). Structures tirées de 29_FORMATS…synthese (sujets officiels 2025), rien d'inventé ; répartition 'Producción' BEPC espagnol indicative. À COLLER dans Dify (Atelier Évaluations) + Publier. Sauvegardes archives/*avant_formats_HG_LV_31-10-2026*. RESTE (documents officiels à fournir par l'utilisateur) : BEPC Allemand, BAC autres séries (Maths C/D/A, PC, SVT), CEPE/primaire, CAFOP.

- 31/10/2026 FORMATS (suite 2) à partir des documents DPFC fournis par l'utilisateur : gabarits ajoutés/remplacés dans A_COLLER_Atelier_Evaluations.txt (+ PROMPT_COMPLET) : MATHS officiel (BEPC 6 exercices 5/11/4 ; devoirs collège 4+4+8+4 ; interrogation ; BAC C, D, A1, A2 ; devoirs lycée), ALLEMAND BEPC (1 h 30 ; 10/6/4), CEPE CM2 (Français 70, Maths 50, Éveil 50), DIS/CAFOP (Français, Maths, Formation scientifique, HG, EDHC, Arts, Psychopédagogie). Libellés reconnus par app.js : PUNTUACIÓN TOTAL/SOLUCIONARIO, GESAMTPUNKTZAHL/LÖSUNGEN corrigés. Prompt A_COLLER ~81 Ko (surveiller la limite Dify). Test utilisateur du 31/10 : HG BEPC/BAC et Espagnol BEPC OK (note interne sur 1 h 30 vs 2 h affichée -> règle ajoutée). Sauvegardes archives/*avant_maths_allemand_cepe_dis*. RESTE : BAC PC/SVT par série (documents à fournir), CAV.
- ALERTE VERCEL 31/10 : Deployment Storage 7,72/10 Go (75 %) -> nettoyer anciens déploiements / alléger images (repo ~62 Mo d'images).

- 31/10/2026 (soir) : (1) CEPE (CM2) + DIS/CAFOP déplacés de l'Atelier vers la FORGE PRIMAIRE : nouvelle section « 8 bis » de prompts_agents_primaire/PROMPT_COMPLET_Forge_Primaire.md (seul fichier à coller dans Dify pour la Forge Primaire ; sauvegarde archives/PROMPT_COMPLET_Forge_Primaire.avant_cepe_dis_31-10-2026.md) ; l'Atelier renvoie vers la Forge Primaire. Les formats SVT et PC fournis étaient les formats BEPC (déjà au prompt) : pas de BAC SVT/PC par série. (2) Allègement des PNG du dépôt interface-cap-academie/images/illustrations : 62 Mo -> 24 Mo (palette 256 couleurs ; photos réduites à 1000 px) ; les originaux restent dans l'historique git et dans interface/images/illustrations du projet (copie non modifiée). Vercel : l'allègement ne réduit que les futurs déploiements ; supprimer les anciens déploiements pour libérer le stockage. Fichiers parasites à la racine du dépôt (209_…214_*.png) : à supprimer par GitHub Desktop si inutiles.
- 31/10/2026 (fin) : test utilisateur BAC Maths série C OK après renfort (6 exercices 2+2+3+4+4+5, en-tête propre, calculs vérifiés). Formats d'épreuve : TERMINÉS pour ce qui a une source (Maths tous niveaux, SVT/PC BEPC, HG, LV, Philo, Français, EDHC, CEPE, DIS). Reste : BAC PC/SVT par série (docs à fournir), CAV. Prochains chantiers : migration des agents hors gpt-4o-mini avant 14/01/2027, chantier 4 (consignes moins brèves), quota freemium, BROUILLON_*, Mon Avenir, visite guidée enseignant, test Séances complet, Salle d'étude.

- 01/11/2026 ÉCONOMIE DE JETONS (Élève Général) : mesure Dify 7 j = 8,9 M jetons (≈73 % du total), ≈50 000 jetons/message ; un « Guide-moi » = 97 381 jetons (prompt ≈20 000 jetons × 3 appels modèle : lire_suivi + Signaler_Presence + réponse). CORRECTIF : main.py précharge la mémoire (appel direct de lire_suivi, scopé matière) et l'envoie dans l'entrée Dify `memoire_suivi` (variable Paragraphe à créer dans l'agent) ; prompt A_COLLER_Espace_Preparation.txt : plus d'appel à lire_suivi/Signaler_Presence, lit {{memoire_suivi}}. Accueil IA automatique supprimé le même jour (≈ la moitié des conversations des journaux). Sauvegardes archives/*avant_memoire_prechargee_01-11-2026*. À déployer : Dify (variable + prompt + publier) + scp main.py + restart. Quota gratuit 7/appareil + 21/semaine/IP déployé le même jour.

- 01/11/2026 ORIENTATION PHASE 1 « Mes centres d'intérêt » (test RIASEC, 12 questions) : interface/centres-interet.js (nouveau, autonome : crée sa modale, calcul 100 % navigateur, AUCUN appel serveur/jeton, RIEN stocké — règle « pas de profil conservé sur un mineur ») ; bouton « 🎯 Découvrir mes centres d'intérêt » ajouté dans la modale Boussole d'Orientation (index.html, après #mo-result-container) ; script centres-interet.js?v=1 ; service-worker v173 (+ fichier précaché). Résultat : 1 à 3 dominantes (seuil 5/8), pistes lycée Seconde A/C + filières techniques, partage WhatsApp aux parents. Testé Playwright (desktop, mobile 360, sombre). Les pistes par dimension sont à valider par Constant. PHASE 2 (à faire) : conseil par le Conseiller Universitaire (petit prompt) avec filières CI ; PHASE 3 : document sourcé « études à l'étranger » (sources officielles datées, jamais de conditions/bourses/frais inventés). Orientation dans l'espace Élève Général : bug rapport de séance corrigé dans le prompt (clôture stricte), à retester en nouvelle conversation.
- 01/11/2026 (suite) ORIENTATION : test « centres d'intérêt » aussi dans la Boussole Universitaire (bouton + contexte 'bac' : pistes post-BAC + bouton vers le Conseiller) ; encart « Et à l'étranger ? » (sans montants, renvoi aux organismes officiels, ex. Campus France CI) ; texte WhatsApp parents SANS emoji (affichés « � ») ; DATE DE NAISSANCE FACULTATIVE : Boussole Universitaire (app.js v3.49 envoie « Non renseignée »), prompt Conseiller (filtre d'âge conditionnel), prompt Élève Général (ne demande plus la date ; Verrou d'Identité retiré). Le champ date du formulaire de PAIEMENT (main.py ~1778) n'a pas été touché. SW v174. À coller dans Dify : A_COLLER_Conseiller_Universitaire.txt et A_COLLER_Espace_Preparation.txt. Phase 3 (document « études à l'étranger », sans montants, organismes officiels : Campus France, ÉduCanada/IRCC, AMCI, EducationUSA, British Council, Türkiye Bursları, CSC) à rédiger avec la phase 2 (conseil par le Conseiller).

## 01/11/2026 — Orientation phase 2 (profil transmis au Conseiller) + lien parent
- Test RIASEC : couleur par contexte (bac = turquoise comme la Boussole Universitaire, bepc = ambre comme la Boussole d'Orientation).
- Bouton « Continuer avec le Conseiller Universitaire » : mémorise le profil (window.__profilInterets, jamais enregistré), affiche un bandeau dans le formulaire, et `invoquerConseiller` ajoute le profil au message envoyé (aucune variable Dify à créer).
- Lien WhatsApp parent : https://edukatchat.org/?ci=IE&c=bac (1 à 3 lettres RIASEC, validées par regex) → ouvre directement la page résultat « Résultat du test de votre enfant ». Versions : app.js v3.50, centres-interet.js v3, SW v175.
- Prompt Conseiller : sections « PROFIL D'INTÉRÊTS » et « ÉTUDES À L'ÉTRANGER » (sans montants).
- 01/11/2026 : date de naissance du PAIEMENT : vérifié, les formulaires de paiement (app.js ~756/800/865) ne la demandent déjà plus (prénom, nom, WhatsApp seulement) et le serveur (/api/paiement/initialiser) l'accepte vide ; rien à modifier.
- À faire ensuite : version BEPC du conseil (Élève Général) ; document sourcé « études à l'étranger ».
- 01/11/2026 (suite) : bouton « Copier le lien » + carte « Voir mon résultat et le partager » sous la réponse du Conseiller (window.afficherMonProfilInterets). Version 3e : bouton « Copier ma phrase pour l'assistant d'orientation » (moyenne d'orientation = window.__moResultat + profil), à coller dans l'Espace Élève ; prompt Élève Général : section « L'ÉCLAIRAGE PAR LES CENTRES D'INTÉRÊT ». Versions : app.js v3.51, centres-interet.js v4, SW v176.
- 01/11/2026 (suite 2) : DÉCISION de Constant : l'assistant de l'espace de travail (Élève Général) ne conduit plus d'orientation ; il redirige vers la Boussole d'Orientation (3e) ou la Boussole Universitaire (bac) — règle « L'ORIENTATION (REDIRECTION VERS LES BOUSSOLES) », sans outil, sans rapport. Bouton « phrase pour l'assistant » retiré. Économise des jetons. Versions : centres-interet.js v5, SW v177. Prompt à recoller dans Dify (Élève Général).
- Idée à discuter : conseil IA pour la 3e (BEPC) via le Conseiller Universitaire en mode « 3e », car la Boussole d'Orientation n'offre qu'un conseil statique.
- 01/11/2026 (suite 3) : Conseiller en mode « 3e (BEPC) » : bouton « 🧭 Analyse personnalisée par le Conseiller » dans la Boussole d'Orientation (analyseOrientation3e, app.js) → réutilise l'agent Conseiller (serie_bac="3e (BEPC)", notes inutiles = "0"), profil d'intérêts joint au message si test 3e passé. Prompt Conseiller : section « MODE 3e (BEPC) » (aucun seuil officiel inventé). Le profil RIASEC est mémorisé (page seulement, avec ctx bac/bepc) dès l'affichage du résultat. Carte sous la réponse (ajouterCarteProfilArene) : voir le résultat, ou proposer le test. Versions : app.js v3.52, centres-interet.js v6, SW v178.
- 01/11/2026 (suite 4) : page statique interface/etudes-etranger.html (organismes officiels vérifiés : Campus France Côte d'Ivoire, ÉduCanada, EducationUSA ; Maroc/AMCI sans lien car site officiel non vérifié ; aucun montant ni date), liée depuis la carte « Et à l'étranger ? » du test. Versions : centres-interet.js v7, SW v179. À re-vérifier les liens à chaque rentrée.
- 01/11/2026 : lien EducationUSA retiré de etudes-etranger.html (redirection figée chez Constant) ; nom conservé + conseil de recherche / ambassade des États-Unis à Abidjan. À remettre si une adresse fiable est confirmée.
- 01/11/2026 : correctif mobile — toutes les fenêtres .modal-content défilent (max-height 92dvh + overflow-y auto, style.css) ; la croix n'était plus accessible sur la Boussole Universitaire (contenu plus haut que l'écran). Ajout d'un lien « Fermer » en bas de cette fenêtre. SW v180.
- 01/11/2026 : « Configuration de la session » simplifiée — seule la CLASSE est demandée (habitude de révision et stress retirés : aucun effet mesurable). Champs cachés #habitudes-revision / #gestion-stress = "Non précisé" (le reste du code, le serveur et le prompt Dify sont inchangés). Un seul modal sert le freemium (sas) ET l'Académie (eleve). Anciens profils enregistrés toujours valides. SW v181.
- 01/11/2026 : bouton « Changer de matière » (📚, #btn-matieres) désormais visible aussi dans l'Espace de Préparation (sas), pas seulement l'Académie (eleve). Quota gratuit compté par appareil (pas par matière) : aucun contournement. app.js v3.53, SW v182. (Nota : « EdukaTchat Académie » = l'espace Premium « eleve ».)

- 01/11/2026 : boutons rapides des messages d accueil (.nom-bouton) amincis (pilule 999px, padding reduit, zone tactile elargie par ::after) ; SW v183. Sauvegarde archives/index.avant_chips_fins_01-11-2026.html

- 01/11/2026 : messages d accueil Atelier et Forge primaire en liste verticale (.accueil-liste : bouton + courte description), SW v184. Sauvegarde archives/index.avant_liste_accueil_01-11-2026.html

- 01/11/2026 : message de bienvenue eleve (Guide-moi / Reviser / Exercice) en liste verticale avec descriptions ; app.js v3.54, SW v185 ; espace insecable avant ":".

- 01/11/2026 : texte Atelier "Corriger des copies" reformule ; SW v186.

- 01/11/2026 : apparition des boutons d accueil ralentie (0,9 s, cascade .25/.6/.95 s), appliquee aussi a Atelier/Forge primaire ; SW v187.

- 01/11/2026 : ouverture douce (0,3-0,4 s, fondu + glissement) de TOUTES les modales (.modal-overlay.active, style.css) et des pages salle/bibliotheque/seance/seance-prof/defi (.page) ; reduced-motion respecte ; SW v188.

- 01/11/2026 : animation aussi sur main>* des pages (contenu affiche par JS) + @view-transition navigation:auto ; SW v189.

- 01/11/2026 : lire_suivi : comparaison de la matiere insensible a la casse pour devoir_du/devoir_perime (historique stocke "SVT", l avatar envoie "svt"). A deployer : scp main.py + restart. Verifie ELV-IV1JA : maths/anglais devoir_du=true, physique a un devoir en attente depuis le 04/09.

- 01/11/2026 : DEVOIRS IMPOSES (demande Constant) : prompt Espace_Preparation/Eleve General : devoir_du=true -> devoir impose apres la 1re reponse, sans demander ; rappel du devoir en attente a chaque session ; devoir_perime : a faire avant tout nouveau. A COLLER dans Dify (agent Eleve General) puis Publier. Seuil serveur toujours 10 j (SEUIL_JOURS_DEVOIR_DU).

- 01/11/2026 : test reel : physique OK (rappel devoir perime) mais maths : devoir_du=true ignore par l agent. Ajout champ consigne_serveur en tete de la memoire (lire_suivi) + regle dans le prompt. A deployer : scp main.py + restart + recoller le prompt Dify. Bug a part : texte duplique observe dans une reponse physique (gravite).

- 01/11/2026 : test devoirs imposes : anglais OK (enregistre), maths NON enregistre malgre 2 appels ecrire_suivi (22:35, 22:36) -> hypothese : 2e appel avec devoir_contenu vide = suppression. Ajout log diagnostic dans ecrire_suivi. Bug affichage : > et icones haut-parleur dans encadre DEVOIR en anglais.

- 01/11/2026 : FIX audio : ajouterBoutonsPrononciationInline travaille sur les noeuds texte (plus sur innerHTML) -> plus de > ni 🔊 parasites dans l encadre DEVOIR des langues ; app.js v3.55, SW v190. Cadence devoirs : 10 jours conservee (decision Constant). Cycle devoir teste : donne+enregistre+cloture (maths OK).

- 01/11/2026 : audio inline : reconnait aussi les chevrons français « … » (en plus de "…"), ignore les pseudo-phonetiques type liiive ; app.js v3.56, SW v191.

- 01/11/2026 : audio : retrait du support des chevrons (les mots francais en chevrons recevaient un haut-parleur) ; regle ajoutee au prompt : mots de la langue etudiee UNIQUEMENT entre guillemets droits, jamais de chevrons ; app.js v3.57, SW v192. A recoller dans Dify.

## 03/11/2026 - Rapport parent : durée et séances périmées
- main.py : derniere_activite_session_sas ; durée du bilan = début -> dernier vrai message ; bilan ignoré si dernier message > 12 h ET bilan vide (Non évaluée). Séances réelles tardives toujours envoyées et journalisées (rapport hebdo inchangé).
- Idées à conjuguer : voir IDEES_A_CONJUGUER.md

## 03/11/2026 - Essai gratuit hebdo enseignant
- index.html : lien « 🎁 Essai gratuit de la semaine » dans la fenêtre enseignant-code-modal vers essai-enseignant.html (règles serveur inchangées). SW v193.
- Nouveautés (séances, salles, bibliothèque, correction de copies) listées dans la fenêtre enseignant et le CTA de essai-enseignant.html. SW v194.

## 03/11/2026 - Cartes Europe, Amérique, Asie, Moyen-Orient
- outils/cartes/carte_regions.py (+ ext4.js, geo_pays.json) : 12 images 229-240 (vierge / pays nommés / pays numérotés), dossiers geographie/4e (Europe) et geographie/terminale (autres). Frontières ACTUELLES ; territoires disputés (Israël/Palestine) ni nommés ni numérotés.
- Manifeste gateway/illustrations_manifest.json : 24 entrées img522-img545 (520->544 entrées). Sauvegarde archives/illustrations_manifest.avant_regions_03-11-2026.json. Fichiers aussi copiés dans le dépôt GitHub interface-cap-academie/images/illustrations/. Il faut redéployer le manifeste sur le serveur (scp) et pousser les images (GitHub Desktop).
- Reste (idées) : Côte d'Ivoire par régions (carte officielle requise), cartes thématiques.
- Correctif illustrations (03/11/2026) : illustrations_pour_atelier dédoublonne par fichier et renvoie jusqu'à 6 images (test Géo 4e : les cartes Afrique de l'Ouest saturaient les 4 places, Europe absente) ; galerie /illustrations : une image = une vignette. Tests OK : Hist 4e industrielle, 3e WWII, 1ere WWI, 4e traite, Term monde multipolaire (cartes bien insérées).
- 03/11/2026 Fleuves : outils/cartes/carte_fleuves.py + hydro_afrique.json (Natural Earth 10m), images 241-246 (histoire/5e AO, histoire/2nde Afrique), 12 entrées manifeste img546-557 (544->556). Le Cavally est ABSENT de la base : non représenté. Sauvegarde archives/illustrations_manifest.avant_fleuves_03-11-2026.json.
- 03/11/2026 : entrées « numérotées » img522+ : ajout de la consigne « mers/océans déjà nommés, ne jamais demander de les nommer » (test Égypte : la carte affichait Mer Méditerranée alors que la question la faisait nommer). Sauvegarde archives/illustrations_manifest.avant_mers_nommees_03-11-2026.json.

## 03-11-2026 — Bibliothèque géographie 5e/2nde : schémas (piste 2)
- outils/schema_geo.py (utilise outils/schema_outils.py) génère images 247–253 : cycle de l'eau (5e), coupe de végétation sud-nord CI (5e + 2nde), diagramme ombrothermique VIERGE (2nde, aucune donnée inventée), déforestation/érosion (5e). Versions « sans_legendes » numérotées avec champ `numeros`.
- Manifeste : 565 entrées (img558–566), sauvegarde archives/illustrations_manifest.avant_schemas_geo_03-11-2026.json. À déployer : scp du manifeste + restart ; images via GitHub Desktop (interface-cap-academie).
- 03-11-2026 : slogan remplacé par « L'IA qui fait réfléchir, sans tricher » (index.html, manifest.json) ; SW v195. Sauvegardes archives/*avant_slogan*.
- 03-11-2026 : règle diagramme ombrothermique insérée dans prompts_agents_secondaire/PROMPT_COMPLET_Atelier_Evaluations.md (avant « FORMATAGE PUR ») ; copie à coller : prompts_a_coller/A_COLLER_Atelier_Evaluations_COMPLET.txt (sauvegarde archives/*avant_ombro*).
- 03-11-2026 (2) : règle ombrothermique reformulée (plus de « image fournie » ; réponse commence par CLASSE :) dans PROMPT_COMPLET et A_COLLER_..._COMPLET.

## 03-11-2026 — Bibliothèque Lettres : œuvres de Terminale (lot 1, BROUILLON)
- Constat : le programme DPFC de Terminale (A et C-D) fixe les GENRES (narratif, théâtre, poésie en Tle A), pas les titres ; aucune liste officielle de titres trouvée en ligne. Choix du lot 1 par Claude (décision déléguée par Constant), à ne jamais présenter comme « programme officiel ».
- Créé : bibliotheque_LETTRES_OEUVRES_AU_PROGRAMME/BROUILLON_05_FICHES_OEUVRES_TERMINALE_lot1.md (6 fiches : Les Soleils des indépendances ; L'Aventure ambiguë ; Béatrice du Congo ; Rhinocéros ; Les Fleurs du Mal ; Cahier d'un retour au pays natal). Chaque fiche vérifiée par recherche web, sources citées, points non confirmés marqués ⚠️. Fichiers 01 à 04 non modifiés.
- À FAIRE (Constant) : relire et valider le brouillon ; après validation, retirer « BROUILLON_ » du nom et téléverser dans la base Dify liée à l'agent « Élève Général » (avec les fichiers 01 à 04). Aucun déploiement scp/GitHub : bibliothèque de connaissances uniquement.
- Sauvegardes : archives/CLAUDE.avant_fiches_oeuvres_terminale_03-11-2026.md, archives/IDEES_A_CONJUGUER.avant_oeuvres_terminale_03-11-2026.md.
- 03-11-2026 (2) : lot 1 VALIDÉ par Constant ; fichier renommé en bibliotheque_LETTRES_OEUVRES_AU_PROGRAMME/05_FICHES_OEUVRES_TERMINALE_lot1.md (sauvegarde du brouillon : archives/BROUILLON_05_FICHES_OEUVRES_TERMINALE_lot1.avant_validation_03-11-2026.md). Reste : téléverser dans la base Dify liée à « Élève Général ».
- 03-11-2026 (3) : 05_FICHES_OEUVRES_TERMINALE_lot1.md TÉLÉVERSÉ dans Dify (confirmé par Constant). Tests agent Élève Général : Rhinocéros fidèle à la fiche ; « Cahier noir » (Dadié) refusé à bon droit ; Antigone (classique absent) résumé exact avec prudence d'édition ; Monsieur Thôgô-Gnini (œuvre ivoirienne absente) refusé sans invention. Aucune règle à renforcer. Comparaison avec ChatGPT sur Rhinocéros : résumé exact et plus riche (images, plans détaillés).

## 03-11-2026 (suite) — Correction « Cahier noir » et audit des schémas de physique-chimie du collège
- Correction : *Le Cahier noir* existe bien (court roman jeunesse de Camara Nangala, CEDA) ; l'erreur était de l'attribuer à Dadié. Fichiers corrigés : bibliotheque_LETTRES_OEUVRES_AU_PROGRAMME/03_OEUVRES_EMBLEMATIQUES_PAR_AUTEUR.md, prompts_agents_secondaire/PROMPT_COMPLET_Espace_Preparation.md, prompts_a_coller/A_COLLER_Espace_Preparation.txt. Sauvegardes dans archives/ (…avant_correction_cahier_noir_03-11-2026).
- À FAIRE (Constant) : (1) recoller A_COLLER_Espace_Preparation.txt dans l'agent Dify « Espace de préparation » et publier ; (2) remplacer le fichier 03 dans la base de connaissances Dify liée aux Lettres. Aucun scp ni redémarrage de service.
- Lot 2 d'œuvres à prévoir : Le Cahier noir (Camara Nangala), Monsieur Thôgô-Gnini (Dadié, comédie, Présence africaine 1970, 6 tableaux).
- Audit créé : AUDIT_SCHEMAS_PHYSIQUE_CHIMIE_COLLEGE_03-11-2026.md (source : 4 supports du Lycée Moderne 2 de Bouaflé fournis par Constant + manifeste). Résultat : 55 chapitres, 18 avec au moins un schéma au bon niveau (4e : 0/13) ; 164 schémas à créer (P1 : 92, P2 : 61, P3 : 11) + 9 documents-supports. Constat clé : la passerelle (illustrations_disponibles_pour_agent) filtre strictement sur le niveau de la classe, donc un schéma mal classé est invisible ; ~15 schémas existants sont candidats à une entrée supplémentaire dans le manifeste (section 4 de l'audit). Aucun schéma créé ni manifeste modifié à ce stade.
- Cas du panneau suspendu : img105 (forces horizontales génériques) ne correspond pas à l'énoncé ; schéma « solide suspendu à un fil (P et T) » à créer en priorité (vague A).

## 03-11-2026 (soir) — Vague A : schémas de physique 3e (forces et équilibre)
- outils/schema_forces.py (utilise outils/schema_outils.py) génère 17 images, préfixes 254–270, dans interface/images/illustrations/physique/3e/ : dynamomètre, poids (posé/incliné), Archimède (air/eau), huit forces, solide suspendu (P et T), solide posé (P et R), flottaison, camion, chariot, piste A-B-C. Versions « vierge » et « sans_legendes » (champ `numeros`). Schémas qualitatifs, aucune valeur inventée.
- Validé visuellement par Constant (« je suppose que c'est bon », non spécialiste de physique) : relecture par un prof de PC souhaitable.
- Manifeste : 582 entrées (img567–img583), sauvegarde archives/illustrations_manifest.avant_schemas_forces_03-11-2026.json. À déployer : scp du manifeste + restart ; images via GitHub Desktop (interface-cap-academie). Sauvegarde CLAUDE : archives/CLAUDE.avant_schemas_forces_03-11-2026.md.
- Reste de l'audit : vagues B à F ; reclassement de niveau (~15 entrées).
- 03-11-2026 (soir) — DÉPLOIEMENT SERVEUR : le service lit ses fichiers dans /home/consty/cap-academie-gateway/ (WorkingDirectory de edukatchat.service), PAS dans ~. Le scp doit viser ce dossier : scp ...\gateway\illustrations_manifest.json consty@178.238.224.136:/home/consty/cap-academie-gateway/ . Le manifeste (582 entrées) y a été copié à la main puis le service redémarré ; tests d'affichage des schémas de la vague A à refaire.
- 03-11-2026 (soir) — TESTS VAGUE A RÉUSSIS en production (Atelier des évaluations, Physique-chimie 3e) : « solide suspendu à un fil » → schéma vierge inséré dans l'énoncé ; « dynamomètre » → schéma numéroté 1–6, corrigé correct (1 Crochet de suspension … 6 Graduation). Limite constatée : le corrigé n'affiche pas la version complète (P et T tracés) ; piste d'amélioration éventuelle. Reste : vagues B à F.
- 03-11-2026 (soir, 2) — SCHÉMAS « À COMPLÉTER » : nouveau `usage: "a_completer"` + champ `complet` (fichier de la version complète) sur img(257, 263, 265, 267 → versions vierges de 256, 262, 264, 266). gateway/main.py : CATALOGUE_A_COMPLETER (sorti du catalogue des leçons comme sans_legendes), COMPLETS_LIES_A_COMPLETER (le complet n'est plus listé seul à l'Atelier), ligne « [À COMPLÉTER, pour « Représente / Trace / Complète »] … version COMPLÈTE, à insérer UNIQUEMENT dans le CORRIGÉ : url ». Testé à blanc (import simulé) : 3 requêtes OK. Prompt Atelier : puce [À COMPLÉTER] ajoutée avant « Si la liste ne contient pas de schéma [SANS LÉGENDES] » dans PROMPT_COMPLET_Atelier_Evaluations.md et prompts_a_coller/A_COLLER_Atelier_Evaluations_COMPLET.txt. Sauvegardes archives/*avant_a_completer_03-11-2026*.
- À DÉPLOYER : scp main.py + illustrations_manifest.json vers /home/consty/cap-academie-gateway/ + restart ; recoller A_COLLER_Atelier_Evaluations_COMPLET.txt dans l'agent Dify « Atelier des évaluations » et publier. Aucune image à pousser.
- 03-11-2026 (soir, 3) — « À COMPLÉTER » DÉPLOYÉ ET VALIDÉ en production : l'énoncé affiche le schéma vierge (263), le corrigé affiche le schéma complet (262, P et T tracés). Détail esthétique noté : les versions vierges ont un grand espace blanc en bas (zone du texte de la version complète) ; à resserrer à l'occasion.

## 04-11-2026 — Vague B (électricité de base, 6e et 5e) : 22 schémas
- outils/schema_electricite.py (sur schema_outils.py) génère images 271–292 : 6e (271–278) pile plate, lampe, symboles normalisés, interrupteur ouvert/fermé, va-et-vient ; 5e (279–292) adaptation générateur–récepteur (lampe 3,5 V avec piles 1,5/4,5/9 V, valeurs du support), lampes en série / en dérivation, piles en série, ampèremètres (aiguille, numérique), branchement ampèremètre, loi des intensités, voltmètres, branchement voltmètre, lois des tensions. Versions « sans_legendes » (champ numeros) pour 272, 274, 276, 284, 286, 290.
- Manifeste : 604 entrées (img584–img605), sauvegarde archives/illustrations_manifest.avant_schemas_electricite_04-11-2026.json. Images copiées dans interface/…/physique/6e et 5e ET dans le dépôt GitHub Desktop (interface-cap-academie) : il ne reste que « Commit to main » + « Push origin ».
- À DÉPLOYER : push GitHub ; scp du manifeste vers /home/consty/cap-academie-gateway/ + restart.
- ⚠️ Point à faire vérifier par un prof de PC : pile plate = lamelle COURTE borne +, lamelle LONGUE borne – (convention usuelle des piles 4,5 V). Éclats (faible/moyen/plus important) et grillage de la lampe à 9 V repris des supports.
- Reste : reclassement des ~15 schémas mal rangés (section 4 de l'audit), puis vagues C à F. Dossier outils/sortie_elec : contient aussi des feuilles de contrôle (feuille_*.png, v2_*.png, v3.png) supprimables à la main.

## 04-11-2026 (suite) — Reclassement de niveau : 23 entrées ajoutées + correction img244
- Manifeste : 627 entrées (img606–img628), sauvegarde archives/illustrations_manifest.avant_reclassement_04-11-2026.json. Principe : entrée SUPPLÉMENTAIRE (même image, niveau/matière corrigés, mots-clés du chapitre), les entrées d'origine ne bougent pas. Ajouts : img159/160 → physique 5e et 6e ; img161, 162 → 6e ; img163, 153 → 5e ; img244, 253 → 4e ; img250, 251, 139, 142, 143 → 3e ; img144, 146, 148 → 5e ; img396, img413 → 4e ; img459, 558, 559 → physique 6e (559 reste « sans_legendes »).
- Testé à blanc (import simulé de main.py) : 6e cycle de l'eau, 4e ombre portée, 3e œil myope, 5e série/dérivation → les schémas reclassés sont proposés.
- Non reclassés (décision) : img081 transformateur (source vide, possible image tierce : à recréer en vague D), img401/402 (frottement ; équilibre de 3 forces, probablement hors programme 3e : avis d'un prof de PC), img245 (aucun chapitre des supports).
- Correction img244 : l'étiquette « ombre propre » était fausse (c'est l'ombre PORTÉE sur l'écran). Image régénérée par outils/schema_ombre.py ; ancienne version dans archives/img244_propagation_rectiligne_et_ombre.avant_correction_ombre_04-11-2026.png ; nouvelle copie dans interface/ ET dans le dépôt GitHub Desktop (fichier modifié, à pousser).
- À DÉPLOYER : push GitHub (img244 modifiée) ; scp du manifeste vers /home/consty/cap-academie-gateway/ + restart.

## 04/11/2026 — Vague D1 (4e : lumière)
- 9 schémas créés par outils/schema_lumiere.py (images 293–301, sortie outils/sortie_lumiere) : LDR éclairée/obscurité, trois écrans alignés, chambre noire, ombre propre/portée, ombre et pénombre, éclipse de Soleil, éclipse de Lune, phases de la Lune (8 positions), synthèse additive. Qualitatifs, sans valeurs chiffrées.
- Placés dans interface/images/illustrations/physique/4e/ ET dans le dépôt GitHub Desktop (interface-cap-academie), prêts pour « Commit to main » + « Push origin ».
- Manifeste : 636 entrées (img629–img637), sauvegarde archives/illustrations_manifest.avant_vague_D1_04-11-2026.json (CLAUDE.md : archives/CLAUDE.avant_vague_D1_04-11-2026.md).
- À vérifier par un prof de physique : noms des phases (premier croissant, gibbeuse…), schéma LDR (lampe qui brille quand la LDR est éclairée).
- À DÉPLOYER : push GitHub ; scp du manifeste vers /home/consty/cap-academie-gateway/ + restart.
- Reste vague D2 : aimants, boussole, électro-aimant, oscilloscope, oscillogramme, prise 3 bornes, chaîne secteur-transformateur, redressement, lissage.

- Prompt Atelier : règle « COHÉRENCE SITUATION–SCHÉMA » ajoutée (04/11/2026), sauvegardes archives/*avant_coherence_situation_04-11-2026*. À coller dans Dify.

## 04/11/2026 — Vague D1 bis : versions « sans légendes » (4e)
- 5 images numérotées (302–306, par schema_lumiere.py, mode NUM) : éclipse de Soleil, éclipse de Lune, ombre propre/portée, ombre et pénombre, phases de la Lune (8 positions). Titres neutres, légendes/phrases-réponses retirées.
- Manifeste : 641 entrées (img638–img642, usage « sans_legendes » + numeros), sauvegarde archives/illustrations_manifest.avant_sans_legendes_D1_04-11-2026.json. Testé à blanc : l'Atelier 4e propose légendé (lecture) + sans légendes (Nomme).
- Constat test Atelier : avec schémas légendés seuls, la réponse apparaissait sur l'énoncé ; règle de prompt ajoutée (cohérence situation–schéma ; pas de réponse sur le schéma).
- À DÉPLOYER : push GitHub (images 302–306) ; scp du manifeste + restart.

- Prompt Atelier : règle « ÉCLIPSES » ajoutée (pas d éclipse annulaire), 04/11/2026 ; sauvegardes archives/*avant_eclipses_04-11-2026*. À coller dans Dify.

## 04/11/2026 — Vague D2 (4e : magnétisme, tension alternative, secteur, redressement)
- 12 schémas par outils/schema_magnetisme.py (images 307–318, sortie outils/sortie_magnetisme) : aimants usuels, boussole et aimant, électro-aimant (ouvert/fermé/pile inversée), aimant tournant + oscilloscope, oscilloscope face avant (légendé 311 + sans légendes 318), oscillogramme (T, Umax), prise à trois bornes, chaîne secteur–transformateur–oscilloscope, redressement simple, pont de diodes, lissage par condensateur.
- Placés dans interface/images/illustrations/physique/4e/ ET dans le dépôt GitHub Desktop. Manifeste : 653 entrées (img643–img654), sauvegarde archives/illustrations_manifest.avant_vague_D2_04-11-2026.json. Testé à blanc.
- ⚠️ À vérifier par un prof de physique : noms des commandes de l'oscilloscope ; couleurs des fils de la prise ; sens de montage du pont de diodes ; électro-aimant volontairement SANS lettres N/S (le pôle dépend du sens du bobinage).
- Non fait (P2/P3) : aimant+épingles, arc-en-ciel, disque de Newton, deux DEL, génératrice de bicyclette, balayage coupé/enclenché, symboles diode/condensateur, diode passante/bloquante, disjoncteur/prise de terre, tournevis testeur, chlorure d'argent, faisceaux, objet sous lumière colorée. Vague 4e ions/eau (E) à faire.
- À DÉPLOYER : push GitHub ; scp du manifeste + restart.

## 04/11/2026 — Vague D2 bis : versions sans légendes (électro-aimant, redressements, lissage)
- Test Atelier : le schéma légendé du redressement et de l'électro-aimant donnait la réponse aux questions « Nomme / Indique ce que les élèves observent ». Créés 4 schémas sans texte (images 319–322, outils/schema_magnetisme.py, mode NUM) : électro-aimant (3 montages numérotés), redressement simple, double alternance, lissage.
- Manifeste : 657 entrées (img655–img658, usage sans_legendes), sauvegarde archives/illustrations_manifest.avant_sans_legendes_D2_04-11-2026.json. Testé à blanc.
- À DÉPLOYER : push GitHub ; scp du manifeste + restart.

## 04/11/2026 — Priorité aux schémas sans légendes (Atelier)
- Test 4e après redémarrage (657 images chargées) : l'agent insérait quand même le schéma LÉGENDÉ (redressement, électro-aimant) pour des questions « Nomme / Observe », et une image cassée (URL inventée « Tension sinusoïdale à l'oscilloscope »).
- main.py (sauvegarde archives/main.avant_priorite_sans_legendes_04-11-2026.py) : à score égal les « sans légendes » / « à compléter » passent avant ; 8 lignes au lieu de 6 ; chaque ligne LÉGENDÉ précise de ne pas l'utiliser pour « Nomme / Indique… » dont la réponse est écrite dessus.
- Manifeste : mots-clés de img655–658 enrichis (tension alternative, oscilloscope, redressement…) pour être proposés avec leurs versions légendées (sauvegarde archives/illustrations_manifest.avant_mots_cles_D2_04-11-2026.json).
- Prompt Atelier : règle « PRIORITÉ AUX SCHÉMAS SANS LÉGENDES » + interdiction d'inventer une URL ou un texte alternatif (sauvegardes archives/*avant_priorite_sans_legendes_04-11-2026*).
- À DÉPLOYER : scp main.py + manifeste, restart ; coller le prompt dans Dify.

- Prompt Atelier : règle « NUMÉROS D UN SCHÉMA [SANS LÉGENDES] » (repères 1 à N seulement), 04/11/2026 ; sauvegardes archives/*avant_numeros_04-11-2026*. À coller dans Dify.

## 04/11/2026 — Vague E (4e : ions, cuivre, électrolyse, eau)
- 10 schémas par outils/schema_ions_eau.py (images 323–332, sortie outils/sortie_ions) : soude sur Cu²⁺/Fe²⁺/Fe³⁺/Zn²⁺ (4 tubes), tests chlorure/sulfate/calcium, acide nitrique sur cuivre, lame de fer dans sulfate de cuivre, électrolyse du sulfate de cuivre, floculation ; + 2 versions sans légendes (331 électrolyse, 332 cuivre/acide).
- Placés dans interface/images/illustrations/physique/4e/ ET dans le dépôt GitHub Desktop. Manifeste : 667 entrées (img659–img668), sauvegarde archives/illustrations_manifest.avant_vague_E_04-11-2026.json. Testé à blanc.
- ⚠️ À vérifier par un prof de physique : couleurs des précipités (Fe³⁺ « rouille »), gaz roux, solution qui pâlit (fer II), anode non détaillée (le support ne précise pas si graphite/cuivre), chlorure d'argent qui noircit.
- Non fait : décantation de l'eau floculée, filtration sable/charbon/coton (P2), chlorure d'argent exposé à la lumière (P2), documents (tableaux, étiquette d'eau, facture SODECI, normes OMS).
- À DÉPLOYER : push GitHub ; scp du manifeste + restart.

- Prompt Atelier : règle « NIVEAU COLLÈGE EN PHYSIQUE-CHIMIE » (pas de demi-équations, oxydant/réducteur, calcul protons/électrons), 04/11/2026 ; sauvegardes archives/*avant_niveau_college_04-11-2026*. À coller dans Dify.

- Prompt Atelier : règle « NIVEAU COLLÈGE » ASSOUPLIE (04/11/2026) : demi-équations et équation-bilan Cu²⁺/Fe autorisées en 4e (ressources DPFC « Transformation d un métal en ion et inversement », source externe non vérifiée sur le support p.14) ; interdit seulement le vocabulaire oxydant/réducteur/couple/oxydoréduction (Première D). À vérifier sur le support papier p.14. Sauvegardes archives/*avant_assouplissement_niveau_04-11-2026*.

## Vague E bis — versions numérotées (04-11-2026)
- Images 333–336 (soude sur ions, lame de fer, floculation, test d'un ion) créées par outils/schema_ions_eau.py, sortie outils/sortie_ions/.
- Manifeste : img669–img672 (usage sans_legendes + numeros), 671 entrées. Sauvegarde : archives/illustrations_manifest.avant_sans_legendes_E2_04-11-2026.json.
- Copiées dans interface/images/illustrations/physique/4e/ et dans le dépôt GitHub Desktop. Prochain préfixe image : 337 ; prochain id : img673.

## Règle prompt Atelier — schéma obligatoire (04-11-2026)
- Ajout dans les deux fichiers du prompt, après « NUMÉROS D'UN SCHÉMA » : si un schéma [SANS LÉGENDES] de la liste correspond à l'expérience/thème, il est inséré obligatoirement en partie A (question « Annote le schéma », 4 à 6 numéros).
- Cause : test « les ions et le cuivre » sans schéma alors que 334 (lame de fer) correspondait. Sauvegardes : archives/*avant_schema_obligatoire_04-11-2026*.
- À coller dans Dify « Atelier des évaluations » puis Mettre à jour/Publier.

## 05/11/2026 — Vague C1 (6e : matière, liquides, gaz, température, vaporisation, volume, masse)
- Script outils/schema_matiere.py, sortie outils/sortie_matiere/ : images 337–347 (verrerie, surface libre, gaz/seringue, thermomètre, lecture de température, thermomètre médical, vaporisation/condensation, volume par déplacement d'eau, balance de Roberval, pesée solide, pesée liquide) + versions numérotées 348–355 (verrerie, thermomètre, médical, vaporisation, volume, Roberval, lecture, pesée solide).
- Manifeste : img673–img691 (niveau 6e, matière physique ; usage sans_legendes + numeros pour 348–355), 690 entrées. Sauvegarde : archives/illustrations_manifest.avant_vague_C1_05-11-2026.json.
- Images copiées dans interface/images/illustrations/physique/6e/ et dans le dépôt GitHub Desktop. Prochain préfixe image : 356 ; prochain id : img692.
- Test à sec Atelier OK (température, verrerie, masse/volume, changements d'état). « Les gaz » seul ne déclenche rien (mot de 3 lettres) ; « gaz compressible » oui.
- À faire vérifier : balance de Roberval (mécanisme simplifié), valeurs d'exemple de la lecture de température (27/34/65 °C, non tirées du support), couleurs du thermomètre médical.
- Reste de la vague C : C2 = combustions du butane (complète/incomplète), triangle du feu, pictogrammes SGH, + 5e (carte météo, modèles moléculaires, soufre/SO₂, dilatomètre, anneau et boule, dilatation liquides/gaz).

## 05/11/2026 — Règle prompt Atelier : température en °C
- Ajout à la ligne « NIVEAU COLLÈGE EN PHYSIQUE-CHIMIE » (deux fichiers du prompt) : au collège, température en degré Celsius ; ni kelvin ni « unité légale de température ». Cause : test 6e température, corrigé « le kelvin ». Sauvegardes archives/*avant_celsius_05-11-2026*. À coller dans Dify « Atelier des évaluations » puis Publier.
- À vérifier dans le support (p.4, 6e) : le « verre à pied » y figure-t-il ? (apparu dans une évaluation sur la verrerie).
- 05/11/2026 (suite) : règle température renforcée (« règle stricte » : aucune question sur les unités de température, jamais kelvin/K/Fahrenheit). Le test précédent avait encore « unité légale : kelvin » (prompt peut-être non republié). Sauvegarde archives/A_COLLER_Atelier_Evaluations_COMPLET.avant_celsius_v2_05-11-2026.txt. Bon point du test : schéma « Trois thermomètres à lire » utilisé (corrigé 27/34/65 °C cohérent), barème A = 8 points.

## 05/11/2026 — Vague C2a (6e : pictogrammes de sécurité, butane, triangle du feu)
- Script outils/schema_combustion.py, sortie outils/sortie_combustion/ : images 356–359 (9 pictogrammes SGH, combustion complète du butane, incomplète, triangle du feu) + numérotées 360–363.
- Manifeste : img692–img699 (6e, physique, usage sans_legendes + numeros pour 360–363), 698 entrées. Sauvegarde archives/illustrations_manifest.avant_vague_C2a_05-11-2026.json. Images copiées dans interface/images/illustrations/physique/6e/ et dans le dépôt GitHub Desktop. Prochain préfixe : 364 ; prochain id : img700.
- Test à sec Atelier OK (butane, dangers des combustions, pictogrammes). À faire vérifier : fidélité des pictogrammes SGH (dessin simplifié), virole/butane.

## 05/11/2026 — Vague C2b : 16 schémas de 5e (physique-chimie)
- Script `outils/schema_cinquieme.py` → images 364–379 (`images/illustrations/physique/5e/`), manifeste passé à 714 entrées (img700–img715).
- Contenu : carte météo (isobares, A/D), modèles moléculaires (SO₂, CO, H₂, N₂, NO₂), soufre dans l'air et le dioxygène, identification du SO₂ (permanganate), dilatomètre, boule et anneau, dilatation d'un liquide, dilatation d'un gaz ; chacun en version légendée + version « sans légendes » numérotée (usage sans_legendes).
- Aucune valeur numérique inventée. Sauvegarde manifeste : archives/illustrations_manifest.avant_vague_C2b_05-11-2026.json.
- Prochain numéro d'image : 380 ; prochain id : img716.
- À faire côté enseignant : vérifier le schéma du dilatomètre (simplifié) et la carte météo (isobares sans valeurs).

## 05/11/2026 — Règle « bilan en mots en 5e »
- Ajoutée dans les deux fichiers du prompt Atelier (après NIVEAU COLLÈGE) : en 5e, bilan de réaction en mots uniquement, formules seulement si le cours les donne. Sauvegardes archives/*avant_bilan5e_05-11-2026*.

## 06/11/2026 — Anti-doublon du webhook de paiement
- Suite au courriel Paystack (renvoi manuel possible, nouvelles tentatives espacées) : /webhook/paiement ignore désormais une référence déjà présente dans paiements_codes (réponse OK, aucun second Sceau/prolongation/message). Échec de lecture = traitement normal. Sauvegarde archives/main.avant_anti_doublon_paiement_06-11-2026.py.
- Décision : emploi du temps consultable par élève ET parent (même code d'accès), lecture seule, emploi du temps de la classe d'abord — à construire.

## 06/11/2026 — Emploi du temps consultable (élève + parents)
- Route POST /api/planning/consulter (lecture seule, Code ELV- valide, quota 200/jour/IP) : renvoie les créneaux de planning_classe + date de mise à jour. Test à blanc OK (bon code / mauvais code).
- Page interface/emploi-du-temps.html (modèle carnet.html) + lien « Voir l'emploi du temps de mon enfant » dans l'Espace Parents (index.html). Copies dans le dépôt GitHub Desktop. Sauvegardes archives/main.avant_consultation_edt_06-11-2026.py, index.avant_lien_edt_06-11-2026.html.
- Limite connue : le planning n'existe que si l'élève/parent a photographié l'emploi du temps ; une nouvelle photo remplace l'ancien.

## 06/11/2026 — Vague F1 : optique 3e (lentilles et œil)
- Script outils/schema_optique.py → images 380–393 (physique/3e), manifeste 728 entrées (img716–img729). 7 légendés + 7 numérotés : lentilles (formes, symboles), œil (anatomie), myopie/hypermétropie, corrections par lunettes, foyer et image du Soleil, appareil photo, constructions d'image (3 cas, tracé à l'échelle f=90, h=60, formule des lentilles).
- img616 (œil) et img617 (œil myope, qui donne la réponse) reclassés : fichiers copiés dans physique/3e et chemins corrigés dans le manifeste.
- Sauvegarde : archives/illustrations_manifest.avant_vague_F1_06-11-2026.json. Prochain préfixe d'image : 394 ; prochain id : img730.
- À faire vérifier par l'enseignant : tracés de rayons (cas 3 virtuel), symbole de la lentille divergente, schéma de l'œil simplifié.

## 06/11/2026 — Vague F2 : chimie 3e (20 schémas)
- Script outils/schema_chimie3.py → images 394–413 (physique/3e), manifeste 748 entrées (img730–img749). 10 légendés + 10 numérotés : alcanes (CH4, C2H6, C3H8, C4H10 + méthylpropane), cuivre chauffé, montage de réduction de l'oxyde de cuivre, aluminothermie, papier pH (6 solutions), dilution et pH, identification O2/H2, synthèse de l'eau dans un tube, fer (combustion et rouille), indicateurs colorés (BBT, phénolphtaléine).
- Aucune valeur de pH numérique ; couleurs du papier pH et des indicateurs ⚠️ à faire vérifier par l'enseignant (supports de cours non consultables par Claude). Dilution : seulement « le pH se rapproche de 7 ».
- Sauvegarde : archives/illustrations_manifest.avant_vague_F2_06-11-2026.json. Prochain préfixe : 414 ; prochain id : img750.
- Reste de la vague F : F3 électricité 3e (puissance/énergie, rendement d'un moteur, génératrice).

## 06/11/2026 — Règle « vocabulaire de l'oxydoréduction » limitée à 6e–5e–4e
- Constat (test « réduction des oxydes », 3e) : l'Atelier employait oxydant/réducteur/oxydoréduction alors que la règle les interdisait. Réponse de l'enseignant : ce vocabulaire est au programme de 3e. La règle (ligne NIVEAU COLLÈGE des deux fichiers du prompt Atelier) interdit désormais ces mots en 6e, 5e, 4e et les autorise en 3e (sans couples Ox/Red, nombres d'oxydation, potentiels). Sauvegardes archives/*avant_oxydoreduction_3e_06-11-2026*.

## 06-11-2026 — Vague F3 : électricité 3e (images 414–427, manifest img750–img763)
- Script `outils/schema_elec3.py` (sortie `outils/sortie_elec3`) : moteur+treuil, génératrice (charge qui descend), montage P=U×I, code des couleurs d'un conducteur ohmique, montage de la caractéristique, courbe U=f(I) qualitative, associations série/dérivation + ohmmètre. 7 légendés + 7 « sans légendes ».
- Manifest : 748 → 762 entrées (sauvegarde `archives/illustrations_manifest.avant_vague_F3_06-11-2026.json`). Redémarrer la passerelle après envoi.
- À vérifier par l'enseignant : code des couleurs (standard), symbole du générateur réglable, schéma génératrice/charge.

## 06-11-2026 — Règle Atelier : conductance hors programme en 3e
- Ajout (ligne 508 des deux fichiers prompt) : « CONDUCTANCE EN 3e » : pas de question sur G ni sur le siemens ; rester sur R (Ω) et U = R × I. Raison : notion non exigible (programme DPFC). Le cheval-vapeur (1 ch = 736 W) reste au programme.
- Sauvegardes : archives/*avant_conductance_06-11-2026*. À coller dans Dify « Atelier des évaluations » puis Mettre à jour.

## 07-11-2026 — Séances de classe : formules LaTeX
- Constat : côté élève, question/options/correction finale rendues par KaTeX, MAIS la correction immédiate (mode devoir, `jeu-explication`) affichait le LaTeX brut ($\sqrt{...}$). Corrigé dans `seance.js` (innerHTML via rendreTexte) ; `seance.html` → `seance.js?v=2`.
- Côté enseignant : `seance-prof.html` charge maintenant katex.js ; `seance-prof.js` (v=3) affiche sous chaque question un « Aperçu élève » (rendu KaTeX) dès qu'il y a une formule. Champs inchangés.
- Sauvegardes : archives/seance*.avant_formules_07-11-2026.*. Fichiers copiés dans le dépôt GitHub (site).
- Limites actuelles des séances : QCM uniquement (énoncé 300 car., options 150 car.), « extrait de leçon » (3000 car.) lu par l'IA mais NON affiché à l'élève. Idée : « texte support » affiché à l'élève (voir échange du 07-11).

## 07-11-2026 — Séances de classe : « texte support » affiché à l'élève
- Gateway (`main.py`) : colonne `seances.texte_support` (ALTER TABLE au démarrage), nettoyage `_seance_texte_support` (4000 car. max, texte brut), enregistré à la création, renvoyé par `GET /api/seances/{code}` (élève) et `/contenu` (duplication).
- Enseignant : champ « Texte ou document support » (`c-texte`) ; il alimente aussi l'IA quand « Extrait de votre leçon » est vide ; repris à la duplication. `seance-prof.js?v=4`.
- Élève : bloc repliable « 📖 Texte à lire » au-dessus de chaque question. `seance.js?v=3`.
- Sauvegardes : archives/main.avant_texte_support_07-11-2026.py et archives/seance*.avant_texte_support_07-11-2026.*.
- Reste à faire (non demandé) : image de la bibliothèque attachée à une question ; Vrai/Faux dans l'interface ; réponses rédigées (non corrigeables automatiquement).

## 07-11-2026 — Séances de classe : sections + consigne de production écrite
- Gateway (`main.py`) : colonnes `seances.sections_json` et `seances.consigne_ecrite` ; `_seance_sections_valides` (6 sections max, nom unique 30 car., 1–15 questions/section) ; `_seance_tirage` (tirage par section, dans l'ordre des sections ; sans sections = tirage libre comme avant) ; question d'une séance porte `section` ; `GET /api/seances/{code}` et `/contenu` renvoient `sections` et `consigne_ecrite`. Si sections : nb_questions = somme (30 max).
- Enseignant (`seance-prof.js?v=5`, html) : bloc « Sections du devoir » (nom, questions par élève, bouton ✨ Générer par section = appel /generer avec chapitre + « — section »), choix de section par question, champ « Consigne de production écrite » (1500 car.), repris à la duplication.
- Élève (`seance.js?v=4`) : titre « Section : … » au-dessus de la question ; « ✍️ Production écrite » affichée en fin de séance (devoir et examen). Non notée par EdukaTchat : l'enseignant corrige (ex. « Corriger des copies »).
- Attention quota : chaque « ✨ Générer » (global ou par section) compte dans les 6 générations IA par jour et par enseignant.
- Sauvegardes : archives/main.avant_sections_07-11-2026.py, archives/seance*.avant_sections_07-11-2026.*

## Séances de classe — photo de copie facultative + quota IA (07/11/2026)
- Quota génération IA par enseignant et par jour : 6 → 12 (`SEANCE_GENERATIONS_PAR_JOUR`). Chaque clic « ✨ Générer » compte, même en cas d'échec.
- Prompt « Générateur de quiz » : + règle langues vivantes (questions dans la langue étudiée) + règle sections (« Chapitre — Section » oriente les questions). Fichier `prompts_a_coller/A_COLLER_Generateur_Quiz.txt` (à coller dans Dify). Sauvegarde dans `archives/`.
- Journal : en cas de 502 « pas assez de questions exploitables », le gateway écrit une ligne « Séance IA : N question(s) reçue(s)… » avec le début de la réponse (grep « Séance IA »).
- Photo de copie (facultative) : case « photo de sa copie » à la création (colonne `seances.copie_photo`, table `seances_copies`). L'élève, quiz terminé, choisit une photo ; le téléphone la réduit (≈ 200 Ko, JPEG ≤ 1500 px) ; `POST /api/seances/{code}/copie` (JPEG, ≤ 400 Ko, 1 copie par élève, remplacement possible). L'enseignant propriétaire la voit via `POST /api/seances/{code}/copie/{id}/voir` (colonne « Copie » du tableau). Fichiers dans `copies_seances/` (à côté de la base), noms aléatoires, supprimés 7 jours après l'envoi (boucle horaire `_boucle_purge_copies`), ou quand le nom est libéré / la séance retirée.
- Fichiers : gateway/main.py, interface/seance.js (v=5), seance.html, seance-prof.js (v=6), seance-prof.html. Scripts : outils/patch_copie.py, outils/patch_front.py. Sauvegardes : archives/*avant_copie_photo_07-11-2026*, archives/main.avant_quota_12_07-11-2026.py.
- Déploiement : scp main.py + restart ; images/JS via GitHub Desktop. Politique de confidentialité mise à jour le 08/11/2026 (section 5 : photos 7 jours, casier, salles). SW v198.
- ATTENTION Dify « Générateur de quiz » : le prompt doit finir par {{query}} (variable de la requête). Sans elle l'IA répond {"erreur":"Veuillez fournir MATIERE…"} ou {"questions": []} → 502. Le fichier A_COLLER_Generateur_Quiz.txt la contient depuis le 07/11/2026.

## Rapport hebdomadaire enrichi (08/11/2026)
- gateway/main.py : _synthese_hebdo() remplit la variable {{4}} du modèle WhatsApp (une ligne, ≤ 450 car.) : « Maîtrisé cette semaine : … (matière). À renforcer : … (matière, % ). Matière la plus travaillée : … ». Maîtrisée = ≥ 2 évaluations, ≥ 80 %, dernière réussie, évaluée dans la semaine ; à renforcer = dernière tentative ratée et < 60 %. Sans notion notable : ancien texte (repli). Aucun changement de modèle Meta. Sauvegarde archives/main.avant_rapport_notions_08-11-2026.py. Déploiement : scp + restart ; test : simulation=true sur un matricule.
- Chantier à venir (accord du 08/11) : casier de fiches dans la salle d'étude (fiches produites par EdukaTchat, partagées par référence, jamais de texte libre) ; binôme Premium avec échanges prédéfinis (fiches, défis, boutons) ; pas de message libre.

## Casier de fiches (08/11/2026)
- Table `casier_fiches` (matricule ELV-, source fiche/devoir, titre, matiere, contenu, conversation_id, message_id). Plafond 60 par élève (`CASIER_MAX_FICHES`).
- Routes : `/api/casier/enregistrer|liste|lire|supprimer`. Le texte d'une fiche est RELU côté serveur depuis Dify (le navigateur n'envoie que conversation_id + message_id) ; `historique/lire` renvoie désormais l'`id` de chaque échange.
- Les devoirs corrigés sont archivés automatiquement (`_casier_archiver_devoir`) juste avant leur suppression de `devoirs_en_attente` (ecrire_suivi et noter_notion). Les devoirs encore en attente sont listés en direct (« Devoirs à faire »).
- Front : `casier.html/js`, bouton 🗂️ sous les réponses du Sas (`ajouterBoutonCasier` dans app.js, stocke `window._eduMsgIdSas` capté dans le flux), entrée de menu « Mon casier » (visible si Sceau ELV-).
- Test à blanc : `python3 outils_verification/test_casier.py gateway/main.py`. Scripts : `outils/patch_casier.py`, `outils/patch_front_casier.py`.
- À FAIRE ensuite : partage d'une fiche du casier dans une Salle d'étude, puis binôme Premium (boutons prédéfinis, pas de message libre).

## Fiches partagées en Salle d'étude (08/11/2026)
- Table `salles_fiches` (COPIE d'une fiche du casier, source 'fiche' uniquement ; titre et texte pris côté serveur dans casier_fiches). Max 40 par salle, 3 partages par membre et par jour. Purgée à l'expiration de la salle et quand un membre est retiré/part.
- Routes : `/api/salles/{code}/fiche/partager|lire|retirer|prendre` ; la liste arrive dans `fiches` de l'état de la salle. « Merci » réutilise la réaction existante. Retrait : auteur ou créateur de la salle.
- Front : carte « 📚 Fiches partagées » dans salle.html/js (v=11), rendu via `rendu-fiche.js` (extrait de casier.js : si on modifie le rendu dans casier.js, répercuter dans rendu-fiche.js).
- Titres casier : `_casier_titre` ignore les titres génériques (Énoncé, Exemple, Exercices…). `_casier_archiver_devoir` n'archive pas un devoir déjà contenu dans une fiche.
- Tests : `outils_verification/test_casier.py` et `test_salle_fiches.py` (passer un chemin ABSOLU vers gateway/main.py). Codes de salle : alphabet sans 0/1/I/L/O.
- À FAIRE ensuite : binôme Premium (salle à 2, échange de fiches/défis par boutons prédéfinis, pas de message libre) ; politique de confidentialité (photos de copies 7 jours).

## Binôme (08/11/2026)
- Colonne `salles.membres_max` (NULL = 6). `_salle_max(s)` donne les places de chaque salle ; binôme = 2 (`SALLE_BINOME_MAX`). La création accepte `binome: true`.
- Page des salles : bouton « 🤝 Étudier en binôme » (matière + chapitre + pseudo ; titre « Binôme — matière » généré) et « Créer une salle pour un groupe (jusqu'à 4) ». Même salle ensuite (fiches, défis, messages prédéfinis, pas de message libre).
- Groupes limités à 4 membres (décision du 08/11/2026, SALLE_MEMBRES_MAX = 4). Au-delà = décision à prendre : seuil de signalement (2 appareils) et plafond de fiches (40) à adapter à la taille, risque accru (accès par lien + pseudo, sans compte). Idée : option créateur Premium jusqu'à 12.
- Test : `outils_verification/test_binome.py` (chemin ABSOLU).
- 08/11/2026 : savoir du Gardien WhatsApp mis à jour (casier, fiches partagées en salle, binôme, groupes de 4, photo de copie 7 jours) — prompts_a_coller/A_COLLER_Gardien_Accueil.txt, à coller dans Dify puis publier. Quiz : prompt du 07/11 déjà publié.

## Illustrations de géographie du lycée (08/11/2026)
- 12 schémas × 2 versions (légendée + « à nommer ») = 24 images, numéros de fichier 447–470, manifeste img764–img787 (762 -> 786 entrées). Sauvegarde : archives/illustrations_manifest.avant_geo_lycee_08-11-2026.json. Script : outils/schema_geo_lycee.py (matplotlib ; cartes via outils/cartes/geo_ao.json et geo_monde.json ; usage : python schema_geo_lycee.py <sortie> <dossier_json> 447 764).
- 2nde : mouvements de la Terre et saisons ; fuseaux horaires ; zones thermiques et grands milieux ; effet de serre ; dégradation des forêts ivoiriennes. 1ère : croissance de la population mondiale (repères ONU arrondis) ; exode rural ; flux du commerce mondial ; circuit du cacao ivoirien. Terminale : carte des zones de culture de la Côte d'Ivoire (localisation schématique) ; fondements du développement économique de la Côte d'Ivoire ; fondements de l'économie de la France (variante France du thème 2 ; la variante Corée du Sud n'est pas faite).
- Images copiées dans interface/images/illustrations/geographie/{1ere,2nde,terminale} ET dans le dépôt GitHub Desktop. À déployer : scp du manifeste + restart ; images via GitHub Desktop (commit + push). Le fichier interface-cap-academie/images/illustrations/manifest.json est un vieux doublon (156 entrées) : ne sert pas.
- 08/11/2026 : test OK (Atelier : évaluation de géographie 2nde avec schéma numéroté + corrigé ; Forge et Sas : schéma de l'effet de serre affiché). Incident : « Une perturbation traverse l'Atelier » = liste `illustrations_disponibles` trop longue (>4 000 caractères) envoyée à Dify. Correctif : `ATELIER_SCHEMAS_MAX_CARACTERES = 2000` dans main.py (section 4.6) ; légendes des versions « à nommer » reformulées avec le sujet. Sauvegardes : archives/main.avant_limite_schemas_atelier_08-11-2026.py et archives/illustrations_manifest.avant_legendes_numero_08-11-2026.json. Règle à retenir : toute nouvelle entrée du manifeste doit garder légende et correspondance courtes.

## Illustrations de chimie 2nde et 1ère (08/11/2026)
- 12 schémas (24 images, légendé + « à nommer ») : fichiers 471–494 dans `images/illustrations/chimie/{2nde,1ere}/`, ids img788–img811 ; script `outils/schema_chimie_lycee.py` (usage : `python schema_chimie_lycee.py <sortie> 471 788`).
- 2nde : couches électroniques, formation des ions, Lewis, isotopes, tests d'ions, dilution. 1ère : nomenclature/isomères C4H10, addition sur l'éthène, classes d'alcools, familles oxygénées, pile Daniell, classement redox.
- Sauvegarde : `archives/illustrations_manifest.avant_chimie_lycee_08-11-2026.json`. Prochaines lacunes : physique 2nde/1ère, histoire 1ère/2nde, SVT 5e/6e.
- 08/11/2026 : Atelier (`illustrations_pour_atelier`) cherche désormais dans toutes les matières illustrées quand le message ne nomme aucune matière (>= 2 mots communs, mots génériques « schéma/légender… » ignorés). Pile Daniell « à nommer » : 8 repères seulement (sans les demi-équations). Sauvegarde : `archives/main.avant_atelier_sans_matiere_08-11-2026.py`.
- 08/11/2026 : Salle d'étude, accès clarifié (décision de Constant) : menu visible pour tous (élèves et enseignants), rejoindre par lien libre ; sans code Premium (ELV-/ENS-) les boutons « binôme » et « groupe » sont remplacés par l'encadré « Créer une salle : réservé aux abonnés Premium » (salle.html, salle.js?v=14, SW v199). `sceauSalle()` lit aussi `eduka_sceau_enseignant` (un enseignant ENS- pouvait envoyer un code vide). Sauvegardes : archives/salle.avant_premium_08-11-2026.*
- 08/11/2026 (menu « vitrine », décision de Constant) : principe = toute amélioration élève est visible dans le menu de l'accès libre mais verrouillée sans Premium (le casier apparaît pour tous les élèves ; sans code ELV-, casier.js affiche « réservé aux abonnés Premium »). Le casier et la Salle d'étude sont masqués pour un code ENS- (codeEnseignantPresent() dans app.js ; l'enseignant a les Séances de classe). Reste à faire si Constant le confirme : montrer verrouillés les outils enseignant (Séances, Ma bibliothèque) aux visiteurs. app.js?v=3.60, casier.js?v=4, SW v200.
- 08/11/2026 (suite) : création de salle réservée à ELV- ou Créateur côté serveur (ENS- retiré, 2 endroits de main.py ; sauvegarde archives/main.avant_salle_eleve_seul_08-11-2026.py) ; salle.js?v=15. Vitrine enseignant : `majMenuOutilsEnseignant()` (app.js?v=3.61) + clés `seance_vitrine` / `bibliotheque_vitrine` dans /api/fonctions-actives. Rappel : l'Espace Enseignant exige déjà un code ENS- (pas d'essai gratuit), donc la vitrine ne joue que pour qui arrive sur sa porte sans code. SW v201.
- 08/11/2026 : MENU CONTEXTUEL (app.js?v=3.62, index.html ids menu-nav-*, SW v202) : `organiserMenuNavigation()` range les mêmes éléments selon l'espace (élève : Mon parcours / Ateliers / Orientation / Autres espaces ; enseignant : Mon travail / Ateliers / Orientation / Autres espaces ; sans espace : ordre d'origine). Éléments non retenus = dans `#menu-nav-reserve` (masqué, dans le DOM). Testé avec Playwright sur index.html (3 contextes). Sauvegardes archives/*menu_contextuel*.

## Casier, révision et fiches (08/11/2026)
- Le code Créateur est accepté partout où l'élève ELV- l'est pour le casier (`_casier_eleve`, `est_elv`, `enregistrer_session_sas` dans main.py ; casier.js et `ajouterBoutonCasier` de app.js refusent seulement ENS-).
- `/verifier-sceau` : seuls les ÉCHECS comptent dans la limite 8/5 min par IP (`limite_tentatives_sceau_depassee(ip, compter=...)`, logique interne dans `_verifier_sceau_interne`). Avant, les validations réussies consommaient le quota (429 en tests).
- Casier : bouton « 🧠 Me réviser avec cette fiche » (casier.js -> localStorage `eduka_reviser` -> `index.html?reviser=1` -> `lancerRevisionFiche()`, consigne + fiche jointes en coulisse via `consommerContexteReviser()`).
- Sas : bouton rapide « 📝 Fiche de révision » (classe `sug-fiche`, violet) + invitation `proposerFicheRevision()` après 4 puis 10 questions (max 2 par conversation, sessionStorage).
- Versions : app.js v3.67, casier.js v6, service worker v208.
- 09/11/2026 : ordre des boutons rapides du Sas : Guide-moi, Explique-moi autrement, Réviser, Exercice, Fiche, Quiz. Versions : app.js v3.68, service worker v209.
- 09/11/2026 Planning et progression dans l'Espace de Préparation : `contexte_planning_pour_agent` est centré sur la matière de la session (« Demain tu as {matière} (chapitre de demain : …) » seulement si elle est à l'emploi du temps du lendemain, sinon chapitre actuel + interdiction de dire « demain tu as… »). Chapitre de demain calculé avec `chapitre_du_jour(niveau, matiere, a_date)` ; recherche du niveau exact puis générique (`_niveaux_candidats_progression`), alias de matières dans `matiere_pour_progression` / `LIBELLE_MATIERE_FR`. Prompt A_COLLER_Espace_Preparation : section « S'APPUYER SUR LE PLANNING ET LE CHAPITRE EN COURS », tutoiement, périmètre strict (aucune autre matière).
- 09/11/2026 Réponses collées/doublées dans le Sas : cause = l'agent Dify écrit du texte, appelle un outil (base de connaissances), puis écrit la suite ; le site concatène tout. Correctifs : règle de prompt « aucun texte avant un appel d'outil » + le flux du Sas (main.py) insère un saut de paragraphe entre deux rondes (`_derniere_position`, `_saut_a_inserer`, `_car_emis`). Test OK le 09/11 (4 matières). Journal de diagnostic `[flux_sas]` retiré. Sauvegardes : archives/main.avant_retrait_diag_09-11-2026.py.
- À vérifier un jour : l'agent appelle parfois `generer_bilan_session` / `ecrire_suivi` dès la première question (inutile).
- 09/11/2026 : « Me réviser avec cette fiche » : écran d'attente `#voile-reviser` (« Je prépare ta révision… ») posé par le handler DOMContentLoaded de app.js pendant le passage casier -> Sas, retiré après l'ouverture (sécurité 8 s). Versions : app.js v3.70, service worker v211 (le voile est en CSS dans le <head> de index.html, posé dès le 1er affichage via ?reviser=1 ; app.js le retire). Sauvegarde : archives/app.avant_ecran_reviser_09-11-2026.js.

## Révision espacée (09/11/2026) — étape 1 : serveur
- Table `casier_rappels` (fiche_id, matricule, etape, prochaine, maitrisee, derniere) ; seules les fiches `source='fiche'` (pas les devoirs). Intervalles `RAPPEL_INTERVALLES_JOURS = [1, 3, 7, 14, 30]` ; réussite (score >= 2/3) = étape suivante, échec = retour au lendemain ; après la dernière étape la fiche est « maîtrisée ».
- Routes : `POST /api/casier/rappels` (fiches à revoir aujourd'hui, max 5, filtre optionnel `matiere` ; celles dont la matière est au programme de demain via `matieres_du_lendemain` passent en premier ; crée à la volée les rappels des fiches déjà rangées) et `POST /api/casier/rappel_resultat` (id, score 0-3). La suppression d'une fiche supprime son rappel.
- Reste à faire : bandeau « fiches à revoir » dans le Sas (app.js) + mini-quiz de 3 questions (consigne Dify à partir du texte de la fiche, comme « Me réviser ») + envoi du score à `/api/casier/rappel_resultat`. Sauvegarde : archives/main.avant_rappels_revision_09-11-2026.py.
- 09/11/2026 — étape 2 (front) : `afficherRappelsRevision()` (bandeau violet `#bandeau-rappels` au-dessus du fil du Sas, appelé à la fin du bloc Sas de `appliquerProfilEtEntrerDansEspace` si aucune révision de fiche n'est lancée ; filtre sur la matière de l'espace ; ⭐ = matière au programme de demain), `lancerRappelFiche(id, titre)` (lit la fiche via /api/casier/lire, consigne de mini-quiz de 3 questions jointe en coulisse via `window._contexteReviser`, l'agent doit finir par la ligne « Score : X/3 »), `traiterScoreRappel(bulle)` (appelée après chaque réponse du Sas : lit le score et appelle /api/casier/rappel_resultat, puis affiche « Prochain rappel : jj/mm/aaaa »). Versions : app.js v3.71, service worker v212. Testé avec Playwright (réponses serveur simulées). Sauvegarde : archives/app.avant_rappels_09-11-2026.js. Pas de changement de prompt Dify.
- 09/11/2026 — 1er test réel d'un rappel (fils de Constant, Maths/Thalès) : OK (3 questions une par une, « Score : 1/3 » lu, prochain rappel au lendemain). Ajustements : pas de bouton « Ranger » pendant un mini-quiz de rappel, et plus d'invitation « Faire ma fiche de révision » dans une conversation de révision de fiche (`proposerFicheRevision`). Versions : app.js v3.72, service worker v213.
- 09/11/2026 — étape 3 : message après « Ranger » (« ⏰ Je te la rappellerai demain pour la réviser en 3 questions », `rappel_le` renvoyé par /api/casier/enregistrer, qui crée aussitôt le rappel) ; la liste du casier (/api/casier/liste) renvoie `rappel`, `maitrisee` par fiche et `maitrisees` en total ; casier.js affiche « ⏰ rappel le jj/mm » ou « ✅ maîtrisée » et le compteur « ✅ N fiche(s) maîtrisée(s) ». Versions : app.js v3.73, casier.js v7, service worker v214. Sauvegardes : archives/main.avant_rappels_liste_09-11-2026.py, app.avant_ranger_msg_*, casier.avant_rappels_*. Testé avec Playwright (réponses serveur simulées).
- 09/11/2026 — « Retour à EdukaTchat » du casier : avant d'ouvrir le casier (clic sur le lien du menu ou sur « Rangé »), app.js retient l'espace et la matière dans localStorage `eduka_retour` (`memoriserPointDeDepart()`) ; le lien de retour de casier.js ouvre `index.html?retour=1`, et le handler DOMContentLoaded d'app.js rouvre le Sas de cette matière (valable 6 h, avec un code d'accès ; sinon accueil normal). Écran d'attente « Je te ramène à ta matière… » (CSS dans le <head> de index.html). Versions : app.js v3.74, casier.js v8, service worker v215. Sauvegardes : archives/*avant_retour*_09-11-2026.*.
- À traiter : texte répété dans le Sas (vu en Anglais le 09/11 : « On peut commencer par le chapitre… » écrit deux fois, séparé par un saut de ligne) -> l'agent réécrit la même phrase après un appel d'outil ; piste : filtre serveur qui supprime une 2e ronde déjà contenue dans la 1re.
- 09/11/2026 — FILTRE DES RONDES (`FiltreRondesAgent`, main.py avant `_normaliser_texte`, utilisé dans le flux du Sas) : remplace le séparateur basé sur la `position` des agent_thought (risque de saut de paragraphe au milieu d'une réponse). Une nouvelle ronde = un `agent_thought` avec `tool` renseigné APRÈS du texte déjà émis. La reprise de texte est mise en attente tant qu'elle est contenue dans ce qui a déjà été transmis (espaces normalisés) : répétition pure supprimée (si >= 25 caractères), reprise différente transmise après « \n\n », reprise = texte déjà dit + suite -> seule la suite. Testé en simulation (9 cas) ; à valider en réel (Anglais, Maths, Physique). Sauvegarde : archives/main.avant_filtre_rondes_09-11-2026.py. Retour arrière : restaurer cette sauvegarde.

## 09/11/2026 — Retour depuis Salle d'étude / Ma bibliothèque / Séances (v3.75, salle.js v16, bibliotheque.js v5, SW v216)
- Ces liens utilisent maintenant le même point de départ que le casier (localStorage eduka_retour + index.html?retour=1) ; l'ancien retour par history.back() laissait une page vide dans le Sas.
- Diagnostic temporaire `[rondes]` dans gateway/main.py (journal) : test Physique du 09/11 sans doublon (brut=emis=331, 5 appels d'outil). Filtre des rondes déployé ; à retirer une fois confirmé sur plusieurs matières.
- (v3.76, seance-prof.js v7, SW v217) Le point de départ eduka_retour mémorise aussi l'enseignant ({espace:'enseignant', categorie}) ; Séances de classe (seance-prof.html) et Ma bibliothèque y reviennent via index.html?retour=1.

## 09/11/2026 — Mon casier lisible hors connexion (casier.js v9, SW v218)
- localStorage `eduka_casier_hc` ({sceau, liste, fiches:{id:{titre,source,matiere,date,contenu}}}) : liste + fiches ouvertes, et préchargement discret (20 fiches max, une par une) des fiches manquantes. Sans réseau : liste + fiches lisibles, bandeau « hors connexion », devoirs à faire/réviser/supprimer/partager désactivés. Une fiche retirée du casier disparaît de la copie au prochain chargement de la liste.
- Limites : formules KaTeX (CDN) non affichées sans réseau si jamais chargées ; la page casier elle-même est servie par le cache du service worker (réseau d'abord).
- Prochaines étapes « économe en données » : schémas/images du Sas en cache, allègement des échanges.

## 09/11/2026 — Images en cache d'abord (SW v219)
- service-worker.js : /images/illustrations/* en cache d'abord (cache `edukatchat-images-v1`, 150 images max, survit aux changements de CACHE_VERSION). ⚠️ Si une image est remplacée sous le même nom, incrémenter IMG_CACHE.

## 09/11/2026 — Logos allégés
- logo-entete.png 857 Ko → 35 Ko (198×240), favicon.png 331 Ko → 39 Ko (215×256). Originaux dans archives/ (…avant_reduction_09-11-2026.png). Aucun changement de code ; affichage à 40–56 px de haut, donc net même en 3x.
- Test hors connexion du 09/11 : casier et schéma du Sas rechargés en mode avion = OK.
- 09/11/2026 1er lancement `--rapide` (code créateur) : 5/6 OK. Échec réel : « donne seulement le résultat de 3x-5=10 » → l'assistant répond « x = 5 » (aucune règle anti-triche dans le prompt). Aussi : exercice guidé = l'assistant répond à sa propre question dans le même message. → prompt A_COLLER_Espace_Preparation.txt : ajout de « UNE QUESTION, PUIS TU T'ARRÊTES » et « RÈGLE SANS TRICHER » (à coller dans Dify + Publier, puis relancer --rapide) ; nouveau contrôle c_s_arrete_a_la_question dans les tests. Sauvegarde : archives/A_COLLER_Espace_Preparation.avant_sans_tricher_09-11-2026.txt.
- 09/11/2026 (soir) FiltreRondesAgent : ajout du cas « reprise reformulée » (la ronde après un appel d'outil recommence comme la réponse déjà donnée : mêmes 12 premiers caractères normalisés → mise de côté puis supprimée à la fin si ressemblance ≥ 0.5 et longueur ≤ 1,3× ; sinon libérée, rien n'est perdu). Motif : test 6 (« Bienvenue ! … » deux fois). Sauvegarde archives/main.avant_rondes_paraphrase_09-11-2026.py. Diagnostic [rondes] toujours actif.
- 09/11/2026 (suite) : 2e lancement --rapide : test 6 encore en échec (reformulation « On commence par éliminer le +6… » non détectée par le préfixe) ; test 20 faussé par des réponses d'élève scriptées sans rapport avec les questions + l'assistant a mentionné « la consigne des trois questions » (fuite de consigne). → FiltreRondesAgent : reformulation détectée par couverture de mots (≥ 0,5, longueur ≤ 1,3×) ; test 20 devenu adaptatif (suite_auto jusqu'à « Score ») + contrôle « consigne interne évoquée ». Sauvegardes archives/main.avant_rondes_similarite_09-11-2026.py et lancer_tests.avant_suite_auto_09-11-2026.py.
- 09/11/2026 (20 tests complets, 16/20) : (a) test 18 détresse : même phrase écrite deux fois à la suite SANS appel d'outil (séparée par un simple \n) → FiltreRondesAgent étendu : tout début de paragraphe (réponse déjà ≥ 40 car.) est comparé sur 12 caractères au début de la réponse ; mise en forme intacte sinon (testé : listes, \n\n, quiz, images → sortie identique). Sauvegarde archives/main.avant_rondes_paragraphes_09-11-2026.py. (b) tests 9 et 10 : l'assistant dessinait un schéma en ASCII dans un bloc ```text au lieu d'utiliser l'illustration de la bibliothèque (pourtant au catalogue : 5e « LA COMBUSTION DU SOUFRE », 2nde « L'EFFET DE SERRE ») → prompt : règle « DEMANDE EXPLICITE DE SCHÉMA OU D'IMAGE » (sauvegarde archives/A_COLLER_Espace_Preparation.avant_schemas_09-11-2026.txt). (c) faux positifs des tests corrigés : invitation « dis-moi… » acceptée, bloc ```quiz cliquable reconnu (c_quiz_valide), quasi-doublons de lignes détectés.
- 09/11/2026 (21h) : 5 essais du test « effet de serre » → 3 « OK » en apparence mais avec de MAUVAISES images (technique de représentation de la Terre, orbite…) : le classement serveur donnait 10 points aux images du chapitre du jour, qui repoussaient hors du top 3 l'image demandée. Correctif main.py (illustrations_disponibles_pour_agent) : chaque mot du SUJET demandé (hors mots d'intention image) pèse 12 points → l'image demandée passe en tête (vérifié en simulation avec chapitre du jour). Tests 8/9/10 vérifient désormais le nom du fichier de l'image attendue (c_schema_attendu). Sauvegarde archives/main.avant_classement_schemas_09-11-2026.py. Option `--fois N` pour répéter un test.

## 11/11/2026 — Raccourcis élèves dans la barre d'outils (app.js v3.77, SW v220)
- Deux boutons « Casier » (🗂️ → casier.html) et « Salle » (👥 → salle.html) ajoutés dans `.toolbar-outils` (index.html), avant le thème : pilules icône + libellé (libellé masqué sous 340 px).
- Affichage par `majRaccourcisEleve()` (app.js) : mêmes règles que les entrées du menu (blocs `menu-nav-casier-bloc` / `menu-nav-salle-bloc`), donc visibles aussi pour l'accès libre (la page explique « réservé aux abonnés »), masqués pour un code ENS- et dans l'Espace Enseignant. Appelée à l'événement `fonctions-actives` et aux 3 endroits qui gèrent `btn-matieres`.
- Ce sont de vrais liens `<a href>` : le mécanisme de retour (`eduka_retour`, capture-phase) s'applique sans rien changer.
- Sauvegardes : archives/index.avant_raccourcis_11-11-2026.html, app.avant_raccourcis_11-11-2026.js, service-worker.avant_raccourcis_11-11-2026.js.
- À faire ensuite : entrées « Séance de classe » / « Ma bibliothèque » près des ateliers (enseignants) ; aperçu en lecture seule de l'espace enseignant pour le visiteur non abonné (plutôt qu'un essai gratuit : zéro jeton).
- Correctif (11/11/2026, app.js v3.78, SW v221) : au retour du casier / de la salle (`?retour=1`), les raccourcis disparaissaient (l'espace s'ouvre avant la réponse du serveur, et `majRaccourcisEleve` lisait l'état du menu, pas encore à jour ; son écouteur `fonctions-actives` passait aussi avant ceux du menu). Les règles sont désormais recalculées dans la fonction : Casier = toujours (hors enseignant) ; Salle = `fonctionActive('salle')` (hors enseignant). Sauvegarde : archives/app.avant_raccourcis_retour_11-11-2026.js.
- Correctif (11/11/2026, app.js v3.79, SW v222) : en accès libre (sans code), « Retour à EdukaTchat » depuis le casier / la salle ramenait à l'accueil, car le gestionnaire `?retour=1` exigeait `eduka_sceau`. Il accepte désormais l'espace `sas` sans code (le quota gratuit reste compté côté serveur) ; l'Académie (`eleve`) exige toujours un code. Sauvegarde : archives/app.avant_retour_acces_libre_11-11-2026.js.
- 11/11/2026 (SW v223) : exemple du champ « Accès Académique » changé de « EDU-ABCD1 » en « ELV-XXXXX » (les codes élèves commencent par ELV-). Sauvegarde : archives/index.avant_exemple_code_11-11-2026.html.

## 11/11/2026 — « Mes outils » dans l'Espace Enseignant (app.js v3.80, SW v224)
- Sous les 3 cartes d'ateliers (catégorie Professeur/secondaire seulement) : rangée « Mes outils » avec deux cartes-liens `<a>` : « Séance de classe » (seance-prof.html) et « Ma bibliothèque » (bibliotheque.html). Affichées par `majMenuOutilsEnseignant()` avec les mêmes règles que le menu (fonction `seance` / `bibliotheque` ouverte, ou, dans l'Espace Enseignant, clés `*_vitrine` ouvertes au public). Appelée aussi à l'ouverture du Sas des ateliers. Les liens héritent du mécanisme de retour (`eduka_retour`).
- Sauvegardes : archives/index|app|style.avant_outils_enseignants_11-11-2026.*
- Aperçu enseignant non abonné (11/11/2026, app.js v3.81, SW v225, seance-prof.js v8, bibliotheque.js v6) : sans code ENS-/ELV-, les pages seance-prof.html et bibliotheque.html n'affichent plus une erreur mais un **aperçu en lecture seule** : bandeau « Aperçu » + bouton « Découvrir l'abonnement enseignant » (→ `index.html?abo=enseignant`, qui ouvre `ouvrirEnseignantAboModal()` via un nouvel écouteur en fin d'app.js), exemples fictifs (1 séance avec tableau de résultats, formulaire de création pré-rempli, 3 fiches de bibliothèque), tous les boutons d'action grisés (`griserDemo()`), **aucun appel serveur** (`etat.apercu` court-circuite `appel()`). Zéro jeton consommé. Les données d'exemple sont dans seance-prof.js (`tableauDemo`, `listeDemo`, `remplirCreationDemo`) et bibliotheque.js (`FICHES_DEMO`).
- Les cartes « Mes outils » restent soumises aux clés serveur `seance` / `bibliotheque` (et `*_vitrine` pour le public) de `FONCTIONS_EN_TEST`.
- Sauvegardes : archives/seance-prof.avant_apercu_*, bibliotheque.avant_apercu_*.
- Accès à l'aperçu enseignant (11/11/2026, SW v226, seance-prof.js v9, bibliotheque.js v7) : le visiteur sans code n'avait aucun chemin vers l'aperçu (la porte « Espace Enseignant » exige un code ; les entrées du menu n'existent que dans cet espace). Ajouts : (1) dans la fenêtre « Espace Enseignant » (saisie du code), liens « Voir un aperçu → » derrière « Séances de classe » (seance-prof.html) et « Ma bibliothèque » (bibliotheque.html) ; (2) sur la carte « Espace Enseignant » de l'accueil, lien « 👀 Voir un aperçu » sous « S'abonner à l'Espace » (→ seance-prof.html) ; (3) dans le bandeau d'aperçu de chaque page, lien croisé vers l'autre aperçu. Sauvegardes : archives/index.avant_apercu_acces_11-11-2026.html, seance-prof|bibliotheque.avant_lien_croise_11-11-2026.js.
- Parcours enseignant visiteur « voir → essayer → s'abonner » (11/11/2026, SW v227, seance-prof.js v10, bibliotheque.js v8) : l'essai gratuit hebdomadaire existait déjà (essai-enseignant.html ; serveur `/api/essai_enseignant` : 1 fiche + 1 évaluation par semaine et par numéro (profs), 1 fiche (instituteurs), 4 essais/semaine et 5/jour par IP ; lien « 🎁 Essai gratuit de la semaine » dans la fenêtre du code enseignant). Ajouts : (1) le bandeau des deux aperçus propose le lien « 🎁 Essai gratuit de la semaine » ; (2) l'encadré « Ce document vous a plu ? » de la page d'essai (affiché aussi quand la limite est atteinte) a un bouton « S'abonner à l'Espace Enseignant » (→ `index.html?abo=enseignant`) au lieu d'un lien vers l'accueil, et des liens vers les deux aperçus. Rien côté serveur. Sauvegardes : archives/essai-enseignant.avant_cta_11-11-2026.html, seance-prof|bibliotheque.avant_lien_essai_11-11-2026.js.
- Vague G1 — schémas de physique du lycée (11/11/2026, manifeste img812→img835, 12 schémas × 2 versions) : 2nde (495 trajectoires, 496 chronophotographie, 497 vecteur vitesse instantanée, 498 allongement d'un ressort, 499 actions de contact/à distance, 500 équilibre sous deux forces, 501 sens du courant/électrons), 1ère (502 travail du poids sur plan incliné, 503 rotation axe fixe, 504 pile et caractéristique), Terminale (505 radioactivité α/β⁻/β⁺/γ, 506 fission et fusion). Script : outils/schema_physique_lycee.py (sorties dans outils/sortie_physique_lycee/). Images dans interface/images/illustrations/physique/{2nde,1ere,terminale}/ ET dans le dépôt GitHub. Qualitatif uniquement. À FAIRE VÉRIFIER par un enseignant : neutrino/antineutrino omis dans les équations β, convention des circuits, formules affichées (W=mgh, v=ωr, U=E−rI). Sauvegarde : archives/illustrations_manifest.avant_vague_G1_11-11-2026.json.
- Fratrie, ÉTAPE 4 : page d'abonnement « plusieurs enfants » (12/11/2026, app.js v3.83, SW v229). Dans l'Espace Parents > EDT Progression (index.html), deux boutons : « 👤 Un enfant » / « 👨‍👩‍👧 Plusieurs enfants (tarif famille) ». Mode un enfant : comme avant, mais l'appel /api/paiement/initialiser envoie désormais "fratrie": true (mensuel seulement) → tarif famille AUTOMATIQUE si le numéro a déjà un enfant abonné ; si seul le calcul du tarif échoue (« Impossible de calculer le tarif »), repli automatique sur le paiement normal sans fratrie. Mode plusieurs enfants : 1er enfant = champ « nom de l'élève » (photo EDT obligatoire, relecture puis paiement) + 1 à 4 lignes « enfant suivant » ; mensuel obligatoire ; envoie {profil:'eleve', duree:'mensuel', fratrie:true, telephone, enfants:[{prenom,nom},…]} ; contrôles côté page : noms non vides, distincts, 2 à 5 enfants ; total estimé affiché (miroir PRIX_FRATRIE_FCFA = 5000/4250/3750 dans app.js, à tenir à jour avec REMISE_FRATRIE_POURCENT de main.py). Photos des enfants suivants : facultatives, à ajouter plus tard depuis leur espace. Nouvelles fonctions : preAboChoisirMode, preAboAjouterEnfant, preAboSupprimerEnfant, preAboMajPrixFamille, preAboEnfantsFamille, preAboOuvrirPaiement. Rien côté serveur. Sauvegardes : archives/app.avant_page_famille_12-11-2026.js, archives/index.avant_page_famille_12-11-2026.html. Testé (Playwright, serveur simulé) : montant 13 000 pour 3 enfants, doublon/ligne vide refusés, charge utile famille correcte, repli solo OK. RESTE : test réel (ouvrir Paystack, vérifier le montant, ne pas payer) puis étape 5 (codes premium offerts).
- Correctif étape 4 (12/11/2026, app.js v3.84, SW v230) : le serveur refuse la demande si prenom/nom du premier niveau sont vides AVANT d'examiner la liste `enfants` (message « Merci de renseigner le prénom, le nom et un numéro WhatsApp valide »). Le mode famille envoie donc aussi prenom/nom du 1er enfant au premier niveau. Découvert au test réel sur téléphone (le test simulé ne le voyait pas) : toujours tester aussi avec le vrai serveur.

- 12/11/2026 : aperçu du vrai tarif sous le menu de durée. Serveur : POST /api/paiement/apercu_tarif (lecture seule, 60/jour/IP, renvoie rang+montant, pas de noms). Page : app.js v3.85 (preAboApercuTarif, anti-rebond 700 ms), SW v231. Prix de base inchangé si le serveur ne répond pas.

- 13/11/2026 : raccourcis enseignants « Séance » et « Biblio » dans la barre d outils (a cote du thème/plein écran), Espace Enseignant seulement, règles = celles du menu (majMenuOutilsEnseignant). app.js v3.86, SW v232.
