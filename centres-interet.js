/* ❖ Mes centres d'intérêt (01/11/2026) — test d'intérêts inspiré du modèle RIASEC (Holland).
 *
 * Principes (décidés avec Constant) :
 *  - 12 questions, 2 par dimension, réponse de 1 à 4 ;
 *  - AUCUN appel serveur, AUCUN jeton : le calcul se fait ici, dans le navigateur ;
 *  - RIEN n'est enregistré (ni serveur, ni stockage du navigateur) : aucun profil conservé sur un mineur ;
 *  - le résultat est présenté comme une aide à la réflexion, jamais comme un diagnostic ;
 *  - aucune promesse d'admission, aucun salaire, aucune condition inventée.
 * Ouverture : ouvrirCentresInteret() (bouton dans la Boussole d'Orientation).
 */
(function () {
    'use strict';

    var DIMENSIONS = {
        R: {
            emoji: '🔧', nom: 'Le bâtisseur',
            texte: "Tu aimes le concret : réparer, construire, manipuler, travailler dehors ou avec des machines.",
            domaines: "mécanique, électricité, bâtiment et travaux publics, agriculture, énergie, électronique",
            pistes: "les filières techniques et professionnelles ; la Seconde C ouvre aussi vers l'ingénierie.",
            pistesBac: "les filières techniques et d'ingénierie (BTS, écoles d'ingénieurs, instituts techniques) en électricité, mécanique, génie civil, énergie ou agronomie."
        },
        I: {
            emoji: '🔬', nom: 'Le chercheur',
            texte: "Tu es curieux : tu veux comprendre comment les choses marchent, tester, résoudre des problèmes difficiles.",
            domaines: "sciences, médecine et pharmacie, ingénierie, informatique, recherche, agronomie",
            pistes: "la Seconde C (scientifique), qui ouvre ensuite aux séries scientifiques.",
            pistesBac: "les filières scientifiques, de santé, d'ingénierie, d'informatique ou de recherche, à l'université ou en école spécialisée."
        },
        A: {
            emoji: '🎨', nom: 'Le créatif',
            texte: "Tu as besoin de t'exprimer : écrire, dessiner, chanter, jouer, inventer, avoir ton propre style.",
            domaines: "lettres et langues, journalisme et communication, arts et musique, audiovisuel, design",
            pistes: "la Seconde A (littéraire) ; les métiers d'art ont aussi des écoles spécialisées.",
            pistesBac: "les lettres, langues, communication, journalisme, arts et audiovisuel, à l'université ou en école spécialisée."
        },
        S: {
            emoji: '🤝', nom: "L'aidant",
            texte: "Tu aimes les autres : aider, expliquer, écouter, soigner, travailler en équipe.",
            domaines: "enseignement, santé, travail social, psychologie, droit, accompagnement",
            pistes: "la Seconde A pour l'enseignement, le droit ou le travail social ; la Seconde C pour les métiers de la santé.",
            pistesBac: "les filières d'enseignement, de santé, de droit, de psychologie et de travail social."
        },
        E: {
            emoji: '🚀', nom: 'Le meneur',
            texte: "Tu aimes prendre des initiatives : convaincre, diriger, organiser, lancer des projets.",
            domaines: "commerce et marketing, gestion, entrepreneuriat, droit, management, communication",
            pistes: "la Seconde A ou la Seconde C selon le métier visé ; les filières de gestion et de commerce.",
            pistesBac: "les filières de commerce, de gestion, de droit, de marketing et de management, à l'université ou en école de commerce."
        },
        C: {
            emoji: '📊', nom: "L'organisateur",
            texte: "Tu aimes que les choses soient claires et en ordre : classer, calculer, suivre des règles, gérer avec soin.",
            domaines: "comptabilité, banque et assurance, administration, statistiques, logistique, secrétariat",
            pistes: "les filières de gestion et de comptabilité ; la Seconde A ou C pour l'économie et la finance.",
            pistesBac: "les filières de comptabilité, de gestion, de banque et d'assurance, d'administration et de statistiques."
        }
    };
    var ORDRE = ['R', 'I', 'A', 'S', 'E', 'C'];

    // Les dimensions alternent pour éviter deux questions voisines sur le même thème.
    var QUESTIONS = [
        ['R', "Réparer un appareil, bricoler ou construire quelque chose de mes mains."],
        ['I', "Comprendre comment les choses fonctionnent et faire des expériences."],
        ['A', "Dessiner, écrire, chanter, jouer la comédie ou inventer des histoires."],
        ['S', "Aider quelqu'un qui a un problème ou lui expliquer une leçon."],
        ['E', "Convaincre les autres, diriger un groupe ou organiser un projet."],
        ['C', "Classer, ranger et tenir en ordre des documents, des chiffres ou un cahier."],
        ['R', "Travailler dehors, avec des machines, des animaux ou des plantes."],
        ['I', "Résoudre un problème de maths ou de logique difficile."],
        ['A', "Créer quelque chose d'original, avec mon propre style."],
        ['S', "Travailler en équipe, soigner, conseiller ou éduquer les autres."],
        ['E', "Prendre des initiatives, avoir des responsabilités ou lancer une activité."],
        ['C', "Suivre des règles précises et gérer un budget ou des comptes avec soin."]
    ];
    var CHOIX = [
        [1, 'Pas du tout'],
        [2, 'Un peu'],
        [3, 'Assez'],
        [4, 'Beaucoup']
    ];

    var CSS = '' +
        '.ci-boite{max-width:560px;background:#F8FAFC;border:1px solid #E2E8F0;color:#0F172A;position:relative;max-height:92vh;overflow-y:auto}' +
        '.ci-boite h2{color:#0F172A;margin:0 0 6px;text-align:center}' +
        '.ci-fermer{position:absolute;top:10px;right:14px;background:none;border:none;font-size:1.7rem;line-height:1;cursor:pointer;color:#0F172A}' +
        '.ci-sous{color:#475569;font-size:.92rem;text-align:center;margin:0 0 14px;line-height:1.45}' +
        '.ci-liste{margin:0 0 16px;padding-left:20px;color:#334155;font-size:.92rem;line-height:1.55;text-align:left}' +
        '.ci-barre{height:8px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin:6px 0 4px}' +
        '.ci-barre>span{display:block;height:100%;background:linear-gradient(90deg,#F59E0B,#EF4444);border-radius:99px;transition:width .3s}' +
        '.ci-compteur{font-size:.82rem;color:#64748B;text-align:right;margin:0 0 14px}' +
        '.ci-question{font-size:1.12rem;font-weight:600;line-height:1.45;margin:6px 0 16px;color:#0F172A;text-align:center}' +
        '.ci-choix{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
        '.ci-choix button{padding:14px 10px;border-radius:12px;border:2px solid #CBD5E1;background:#fff;color:#0F172A;font-size:1rem;font-weight:600;cursor:pointer;font-family:inherit}' +
        '.ci-choix button:hover,.ci-choix button:focus-visible{border-color:#F59E0B;background:#FFFBEB;outline:none}' +
        '.ci-choix button.ci-actif{border-color:#F59E0B;background:#FEF3C7}' +
        '.ci-nav{display:flex;justify-content:space-between;margin-top:16px}' +
        '.ci-lien{background:none;border:none;color:#475569;font-size:.9rem;cursor:pointer;text-decoration:underline;font-family:inherit}' +
        '.ci-btn{display:block;width:100%;padding:13px;border:none;border-radius:10px;font-size:1.02rem;font-weight:700;cursor:pointer;color:#fff;background:#F59E0B;font-family:inherit;margin-top:10px}' +
        '.ci-bac .ci-btn{background:#14B8A6}' +
        '.ci-bac .ci-barre>span{background:linear-gradient(90deg,#14B8A6,#0D9488)}' +
        '.ci-bac .ci-choix button:hover,.ci-bac .ci-choix button:focus-visible{border-color:#14B8A6;background:#F0FDFA}' +
        '.ci-bac .ci-choix button.ci-actif{border-color:#14B8A6;background:#CCFBF1}' +
        '.ci-btn.ci-vert{background:#16A34A}' +
        '.ci-btn.ci-gris{background:#64748B}' +
        '.ci-carte{border:1px solid #E2E8F0;background:#fff;border-radius:12px;padding:14px;margin:0 0 12px}' +
        '.ci-carte h3{margin:0 0 4px;font-size:1.08rem;color:#0F172A}' +
        '.ci-carte p{margin:6px 0 0;font-size:.92rem;color:#334155;line-height:1.5;text-align:left}' +
        '.ci-note{font-size:.82rem;color:#64748B;line-height:1.5;margin:10px 0 0;text-align:center}' +
        '.ci-alerte{background:#FEF3C7;border-radius:10px;padding:10px 12px;font-size:.9rem;color:#78350F;margin:0 0 12px;line-height:1.45}' +
        '@media (prefers-reduced-motion:reduce){.ci-barre>span{transition:none}}';

    var overlay = null, boite = null;
    var reponses = [];   // reponses[i] = 1..4 (jamais conservées après fermeture)
    var index = 0;
    var resCourant = null;   // résultat actuellement affiché (pour WhatsApp / copie du lien)
    var contexte = 'bepc';   // 'bepc' (Boussole 3e) ou 'bac' (Boussole Universitaire)

    function creer() {
        if (overlay) return;
        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'ci-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', "Mes centres d'intérêt");
        boite = document.createElement('div');
        boite.className = 'glass-card modal-content ci-boite';
        overlay.appendChild(boite);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) fermer(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) fermer();
        });
    }

    function croix() {
        return '<button class="ci-fermer" type="button" aria-label="Fermer" data-ci="fermer">×</button>';
    }

    function ecranIntro() {
        boite.innerHTML = croix() +
            '<div style="text-align:center;font-size:2.4rem">🎯</div>' +
            "<h2>Mes centres d'intérêt</h2>" +
            '<p class="ci-sous">12 phrases, 2 minutes. Ce n\'est pas un examen : il n\'y a pas de bonne ou de mauvaise réponse.</p>' +
            '<ul class="ci-liste">' +
            "<li>Réponds avec ton cœur, pas avec ce que les autres attendent de toi.</li>" +
            "<li>Le test t'aide à réfléchir à ce qui te plaît. Il ne décide pas de ton avenir.</li>" +
            "<li>Rien n'est enregistré : tes réponses restent sur ton écran.</li>" +
            '</ul>' +
            '<button class="ci-btn" type="button" data-ci="commencer">Commencer</button>';
    }

    function ecranQuestion() {
        var q = QUESTIONS[index];
        var pct = Math.round((index / QUESTIONS.length) * 100);
        var html = croix() +
            '<h2>Mes centres d\'intérêt</h2>' +
            '<div class="ci-barre" role="progressbar" aria-valuemin="0" aria-valuemax="12" aria-valuenow="' + index + '"><span style="width:' + pct + '%"></span></div>' +
            '<p class="ci-compteur">Question ' + (index + 1) + ' sur ' + QUESTIONS.length + '</p>' +
            '<p class="ci-sous" style="margin-bottom:4px">J\'aime…</p>' +
            '<p class="ci-question" aria-live="polite">' + q[1] + '</p>' +
            '<div class="ci-choix">';
        for (var i = 0; i < CHOIX.length; i++) {
            var actif = reponses[index] === CHOIX[i][0] ? ' ci-actif' : '';
            html += '<button type="button" class="' + actif.trim() + '" data-ci="rep" data-val="' + CHOIX[i][0] + '">' + CHOIX[i][1] + '</button>';
        }
        html += '</div><div class="ci-nav">' +
            (index > 0 ? '<button class="ci-lien" type="button" data-ci="retour">← Question précédente</button>' : '<span></span>') +
            '</div>';
        boite.innerHTML = html;
    }

    function calculer() {
        var score = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
        for (var i = 0; i < QUESTIONS.length; i++) {
            score[QUESTIONS[i][0]] += (reponses[i] || 0);
        }
        var tri = ORDRE.slice().sort(function (a, b) {
            if (score[b] !== score[a]) return score[b] - score[a];
            return ORDRE.indexOf(a) - ORDRE.indexOf(b);
        });
        // Un centre d'intérêt n'est « dominant » qu'à partir de 5 points sur 8
        // (réponses plutôt « Assez/Beaucoup »). On garde toujours le premier ;
        // le deuxième et un éventuel troisième ex æquo seulement s'ils atteignent 5.
        var SEUIL = 5;
        var dominants = [tri[0]];
        if (score[tri[1]] >= SEUIL) {
            dominants.push(tri[1]);
            if (score[tri[2]] === score[tri[1]]) dominants.push(tri[2]);
        } else if (score[tri[0]] < SEUIL) {
            dominants.push(tri[1]);   // profil peu marqué : on montre quand même les deux premiers
        }
        var homogene = (score[tri[0]] - score[tri[5]]) <= 1 || score[tri[0]] < SEUIL;
        return { score: score, dominants: dominants, homogene: homogene };
    }

    function texteParents(res) {
        // Pas d'emoji ici : certains navigateurs les affichent en « � » dans le lien WhatsApp.
        var noms = res.dominants.map(function (c) { return DIMENSIONS[c].nom; }).join(', ');
        return "Voici ce que mon test d'intérêts EdukaTchat a fait ressortir : " + noms + ". " +
            "Ce sont des pistes pour réfléchir, pas un diagnostic. Voir le résultat : " + lienResultat(res);
    }

    // partage = tableau de codes (ex. ['I','E']) quand la page est ouverte depuis le lien envoyé à un parent.
    // memo = profil déjà calculé (réouverture depuis la réponse du Conseiller), sans refaire le test.
    function lienResultat(res) {
        return 'https://edukatchat.org/?ci=' + res.dominants.join('') + '&c=' + contexte;
    }

    function copierTexte(texte, bouton, libelleOk) {
        var ancien = bouton.textContent;
        function ok() { bouton.textContent = libelleOk; setTimeout(function () { bouton.textContent = ancien; }, 2200); }
        function secours() {
            try {
                var ta = document.createElement('textarea');
                ta.value = texte; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                ok();
            } catch (e) { bouton.textContent = 'Copie impossible : sélectionne et copie à la main'; }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, secours);
        else secours();
    }

    function phraseAssistant(res) {
        var mo = window.__moResultat ? 'Ma moyenne d\'orientation est ' + window.__moResultat + '. ' : '';
        var noms = res.dominants.map(function (c) { return DIMENSIONS[c].nom + ' (' + c + ')'; }).join(', ');
        return 'Je voudrais de l\'aide pour mon orientation après le BEPC. ' + mo +
            'Mon test de centres d\'intérêt a fait ressortir : ' + noms + '.';
    }

    function ecranResultat(partage, memo) {
        var res = partage ? { score: null, dominants: partage, homogene: false }
            : (memo ? { score: memo.score, dominants: memo.codes, homogene: !!memo.homogene } : calculer());
        resCourant = res;
        var html = croix() + '<div style="text-align:center;font-size:2.2rem">✨</div>' +
            (partage
                ? '<h2>Résultat du test de votre enfant</h2>' +
                  '<p class="ci-sous">Voici les centres d\'intérêt qui sont ressortis du test EdukaTchat passé par votre enfant.</p>'
                : '<h2>Ce qui te ressemble</h2>' +
                  '<p class="ci-sous">Voici les centres d\'intérêt qui ressortent le plus de tes réponses.</p>');
        if (res.homogene) {
            html += '<div class="ci-alerte">Tes réponses sont très proches les unes des autres, ou peu marquées : tout t\'intéresse un peu, ou presque rien ne t\'attire encore. C\'est normal à ton âge. Tu peux refaire le test en étant plus tranché, ou en parler avec un adulte de confiance.</div>';
        }
        for (var k = 0; k < res.dominants.length; k++) {
            var code = res.dominants[k], d = DIMENSIONS[code];
            var pct = res.score ? Math.round((res.score[code] / 8) * 100) : 0;
            html += '<div class="ci-carte"><h3>' + d.emoji + ' ' + d.nom + '</h3>' +
                (res.score ? '<div class="ci-barre" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' : '') +
                (partage ? '' : '<p>' + d.texte + '</p>') +
                '<p><strong>Des domaines qui peuvent ' + (partage ? 'lui' : 'te') + ' plaire :</strong> ' + d.domaines + '.</p>' +
                '<p><strong>' + (contexte === 'bac' ? 'Pour y réfléchir après le BAC :' : 'Pour y réfléchir au lycée :') + '</strong> ' +
                (contexte === 'bac' ? d.pistesBac : d.pistes) + '</p></div>';
        }
        html += '<div class="ci-carte" style="background:#EFF6FF;border-color:#BFDBFE"><h3>🌍 Et à l\'étranger ?</h3>' +
            '<p>Des formations dans ces domaines existent aussi dans d\'autres pays (France, Canada, Maroc, et bien d\'autres), y compris dans des établissements réputés. ' +
            'Si cela vous intéresse, renseignez-vous tôt auprès des organismes officiels (par exemple Campus France Côte d\'Ivoire pour la France) : les démarches, les dates et les conditions changent chaque année.</p></div>';
        if (partage) {
            html += '<p class="ci-note">Ce test donne des pistes pour réfléchir ; il ne décide pas de l\'avenir de votre enfant, et ses goûts évolueront. ' +
                'Échangez-en avec lui, avec ses professeurs et son conseiller d\'orientation, et vérifiez toujours les conditions d\'accès auprès des sources officielles.</p>' +
                '<button class="ci-btn" type="button" data-ci="refaire">Faire le test à mon tour</button>' +
                '<button class="ci-lien" type="button" data-ci="fermer" style="display:block;margin:12px auto 0">Fermer</button>';
            boite.innerHTML = html;
            return;
        }
        if (contexte === 'bac' && !memo) {
            html += '<button class="ci-btn" type="button" data-ci="conseiller">🎓 Continuer avec le Conseiller Universitaire</button>' +
                '<p class="ci-note" style="margin-top:6px">Étape suivante : tu saisis tes notes, et le Conseiller tient compte de ce profil.</p>';
        }
        html += '<p class="ci-note">Ce test donne des pistes pour réfléchir ; il ne décide pas de ton avenir, et tes goûts évolueront. ' +
            'Parles-en avec tes parents, tes professeurs et ton conseiller d\'orientation, et vérifie toujours les conditions d\'accès auprès des sources officielles.</p>' +
            (contexte === 'bac' ? '' :
                '<button class="ci-btn" type="button" data-ci="phrase">💬 Copier ma phrase pour l\'assistant d\'orientation</button>' +
                '<p class="ci-note" style="margin-top:6px">Colle-la dans ton Espace Élève : l\'assistant s\'en servira avec ta moyenne d\'orientation.</p>') +
            '<button class="ci-btn ci-vert" type="button" data-ci="parents">📲 Envoyer à mes parents (WhatsApp)</button>' +
            '<button class="ci-btn ci-vert" type="button" data-ci="copier">🔗 Copier le lien (SMS, e-mail…)</button>' +
            '<button class="ci-btn ci-gris" type="button" data-ci="refaire">↺ Refaire le test</button>' +
            '<button class="ci-lien" type="button" data-ci="fermer" style="display:block;margin:12px auto 0">Fermer</button>';
        boite.innerHTML = html;
    }

    function demarrer() { reponses = []; index = 0; ecranQuestion(); }

    function repondre(val) {
        reponses[index] = val;
        if (index < QUESTIONS.length - 1) { index++; ecranQuestion(); }
        else { ecranResultat(); }
    }

    function fermer() {
        if (!overlay) return;
        overlay.classList.remove('active');
        reponses = []; index = 0;   // rien n'est conservé
        boite.innerHTML = '';
    }

    function clic(e) {
        var cible = e.target.closest ? e.target.closest('[data-ci]') : null;
        if (!cible) return;
        var action = cible.getAttribute('data-ci');
        if (action === 'fermer') fermer();
        else if (action === 'commencer' || action === 'refaire') demarrer();
        else if (action === 'rep') repondre(parseInt(cible.getAttribute('data-val'), 10));
        else if (action === 'retour') { if (index > 0) { index--; ecranQuestion(); } }
        else if (action === 'conseiller') {
            var r = calculer();   // profil gardé en mémoire de la page seulement (jamais enregistré)
            window.__profilInterets = { codes: r.dominants.slice(), noms: r.dominants.map(function (c) { return DIMENSIONS[c].nom; }),
                score: r.score, homogene: r.homogene };
            fermer();
            if (typeof ouvrirBoussoleUniv === 'function') ouvrirBoussoleUniv();
        }
        else if (action === 'copier') { copierTexte(lienResultat(resCourant || calculer()), cible, '✅ Lien copié'); }
        else if (action === 'phrase') { copierTexte(phraseAssistant(resCourant || calculer()), cible, '✅ Phrase copiée : colle-la dans ton Espace Élève'); }
        else if (action === 'parents') {
            var res = resCourant || calculer();
            window.open('https://wa.me/?text=' + encodeURIComponent(texteParents(res)), '_blank', 'noopener');
        }
    }

    function ouvrir(ctx, partage, memo) {
        contexte = (ctx === 'bac') ? 'bac' : 'bepc';
        creer();
        boite.className = 'glass-card modal-content ci-boite' + (contexte === 'bac' ? ' ci-bac' : '');
        boite.removeEventListener('click', clic);
        boite.addEventListener('click', clic);
        if (partage || memo) ecranResultat(partage, memo); else ecranIntro();
        overlay.classList.add('active');
    }

    window.ouvrirCentresInteret = function (ctx) { ouvrir(ctx, null, null); };

    // Réouvre le résultat déjà obtenu (bouton sous la réponse du Conseiller), pour le partager.
    window.afficherMonProfilInterets = function () {
        if (window.__profilInterets) ouvrir('bac', null, window.__profilInterets);
    };

    // Bandeau « profil pris en compte » dans le formulaire du Conseiller Universitaire.
    window.majBandeauProfilInterets = function () {
        var el = document.getElementById('univ-profil-ci');
        if (!el) return;
        var p = window.__profilInterets;
        if (!p || !p.noms || !p.noms.length) { el.style.display = 'none'; return; }
        el.textContent = '✅ Ton profil d\'intérêts sera pris en compte par le Conseiller : ' + p.noms.join(', ') + '.';
        el.style.display = 'block';
    };

    // Lien envoyé à un parent : https://edukatchat.org/?ci=IE&c=bac  → ouvre directement le résultat.
    // Le lien ne contient que 1 à 3 lettres (aucun nom, aucune note) ; tout le reste est ignoré.
    function lireLienPartage() {
        try {
            var q = new URLSearchParams(location.search);
            var ci = q.get('ci');
            if (!ci || !/^[RIASEC]{1,3}$/.test(ci)) return;
            var codes = ci.split('');
            for (var i = 0; i < codes.length; i++) { if (codes.indexOf(codes[i]) !== i) return; }
            var ctx = q.get('c') === 'bac' ? 'bac' : 'bepc';
            history.replaceState(null, '', location.pathname);
            setTimeout(function () { ouvrir(ctx, codes); }, 600);
        } catch (e) { /* jamais bloquant */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lireLienPartage);
    else lireLienPartage();

    // Exposé pour les tests automatisés uniquement (aucun effet sur le site).
    window.__ciTest = { calculer: function (r) { reponses = r; return calculer(); }, QUESTIONS: QUESTIONS };
})();
