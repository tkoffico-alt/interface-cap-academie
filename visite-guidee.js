// =======================================================================
// ❖ VISITE GUIDÉE + BADGES « NOUVEAU » (28/10/2026) ❖
// =======================================================================
// Une visite pas à pas : un bouton est mis en lumière à la fois, avec une
// flèche et une bulle qui explique sa fonction. Elle fonctionne au toucher
// comme à la souris (contrairement aux infobulles qui exigent un survol).
//  - lancement automatique à la PREMIÈRE visite d'un espace (aucun historique) ;
//  - bouton « ❓ Aide » pour la relancer à tout moment ;
//  - badges « Nouveau » sur les boutons récents, retirés au premier clic.
// Pour ajouter un bouton à une visite : ajouter une étape dans VISITES.
// Pour signaler un nouveau bouton : ajouter une ligne dans NOUVEAUTES.
(function () {
    'use strict';

    const F = (o) => `[onclick="ouvrirFormulaireGuide('${o}')"]`;
    const tools = (c) => `#container-${c}-custom`;

    const VISITES = {
        sas: [
            { s: '#container-sas-custom .btn-banniere-nouvelle', t: 'Nouvelle discussion', x: 'Terminez cette discussion et commencez-en une nouvelle.' },
            { s: '#container-sas-custom .btn-banniere-historique', t: 'Historique', x: 'Revoyez vos sessions précédentes.' },
            { s: '#sas-suggestions-rapides .btn-suggestion-guide', t: 'Guide-moi', x: 'Vous ne savez pas par où commencer ? L’assistant vous pose quelques questions et vous guide.' },
            { s: '#sas-suggestions-rapides .btn-suggestion-reviser', t: 'Réviser un chapitre', x: 'Indiquez le chapitre à réviser (il suffit de compléter la phrase) : l’assistant l’explique pas à pas.' },
            { s: '#sas-suggestions-rapides .btn-suggestion-exercice', t: 'Un exercice précis', x: 'Vous bloquez sur un exercice ? Expliquez-le, on le travaille ensemble.' },
            { s: '#sas-suggestions-rapides .sug-ponctuel', t: 'Quiz sur cette leçon', x: 'Après une première explication, testez-vous avec 5 questions à choix sur la leçon. Puis défiez un camarade : un lien à partager sur WhatsApp, et vous comparez vos scores.' },
            { s: '#sas-suggestions-rapides .sug-ambre', t: 'Explique-moi autrement', x: 'Après une première explication : pas compris ? Demandez la même explication, plus simple, avec un exemple de la vie en Côte d’Ivoire.' },
            { s: '#sas-suggestions-rapides .btn-suggestion-rentree', t: 'Préparer la rentrée', x: 'Visible de juillet à septembre : pendant les vacances, préparez la rentrée prochaine.' },
            { s: '#container-sas-custom .btn-icone-neutre', t: 'Joindre une photo', x: 'Envoyez la photo de votre exercice ou de votre leçon.' },
            { s: '#container-sas-custom .btn-icone-bleu', t: 'Emploi du temps', x: 'Ajoutez l’emploi du temps de la classe pour être mieux accompagné (fonction Premium).' },
            { s: '#btn-micro-sas', t: 'Parler au lieu d’écrire', x: 'Posez votre question à l’oral.' },
            { s: '#sas-user-input', t: 'Votre question', x: 'Écrivez ici votre question ou votre difficulté.' },
            { s: '#container-sas-custom .btn-envoyer-icon', t: 'Envoyer', x: 'Envoyez votre message.' }
        ],
        choix_atelier: [
            { s: '#sas-ateliers-professeur .sas-atelier-evaluations', t: 'Évaluations', x: 'Créez devoirs, compositions et épreuves, ou faites corriger des copies.' },
            { s: '#sas-ateliers-professeur .sas-atelier-lecons', t: 'Leçons', x: 'Préparez vos fiches de leçon et vos exercices.' },
            { s: '#sas-ateliers-professeur .sas-atelier-cabinet', t: 'Cabinet', x: 'Demandez un conseil pédagogique ou aidez un élève en difficulté.' },
            { s: '#sas-ateliers-instituteur .sas-atelier-card:nth-child(1)', t: 'Leçons (primaire)', x: 'Préparez vos fiches de séance et d’évaluation, du CP1 au CM2.' },
            { s: '#sas-ateliers-instituteur .sas-atelier-card:nth-child(2)', t: 'Cabinet (primaire)', x: 'Élève en difficulté, conseil pédagogique, gestion de classe.' },
            { s: '.btn-changer-categorie-enseignant', t: 'Catégorie', x: 'Revenez au choix Professeur / Instituteur.' }
        ],
        atelier: [
            { s: tools('atelier') + ' ' + F('atelier'), t: 'Formulaire guidé', x: 'Indiquez matière, classe, durée, nombre d’exercices et répartition des points : vous obtenez exactement l’évaluation voulue.' },
            { s: tools('atelier') + ' [data-message^="Propose-moi une variante"]', t: 'Variante', x: 'Après une première évaluation, ce bouton crée une autre version (sujet B), avec un barème ajusté.' },
            { s: tools('atelier') + ' ' + F('atelier_copies'), t: 'Corriger des copies', x: 'Fonction bonus : photographiez une copie et obtenez une proposition de correction que vous relisez et ajustez.' },
            { s: tools('atelier') + ' ' + F('atelier_officiel'), t: 'Épreuve BEPC / BAC', x: 'Une épreuve au format officiel : exercices numérotés et barème sur 20.' },
            { s: tools('atelier') + ' .btn-icone-neutre', t: 'Joindre une photo', x: 'Joignez une photo (JPG ou PNG), par exemple une copie d’élève : une copie par photo, bien éclairée.' },
            { s: tools('atelier') + ' .btn-icone-teal', t: 'Bibliothèque d’illustrations', x: 'Insérez des illustrations dans vos évaluations.' },
            { s: tools('atelier') + ' .btn-icone-ambre', t: 'Fiches-formules', x: 'Insérez des fiches de formules prêtes à l’emploi (Maths, Physique-Chimie, SVT).' },
            { s: '#atelier-user-input', t: 'Votre demande', x: 'Écrivez ici votre demande : matière, classe, chapitre…' },
            { s: tools('atelier') + ' .btn-envoyer-icon', t: 'Envoyer', x: 'Envoyez votre message.' },
            { s: '.btn-changer-categorie-enseignant', t: 'Changer de catégorie', x: 'Revenez au choix Professeur / Instituteur.' }
        ],
        forge: [
            { s: tools('forge') + ' ' + F('forge'), t: 'Formulaire guidé', x: 'Indiquez matière, classe, chapitre, durée et matériel : vous obtenez exactement la fiche voulue.' },
            { s: tools('forge') + ' [data-message^="Ajoute des activités"]', t: 'Ajouter des activités', x: 'Après une première fiche, ajoute des activités ou exercices d’application à la dernière fiche.' },
            { s: tools('forge') + ' .btn-icone-neutre', t: 'Joindre une photo', x: 'Joignez une photo (JPG ou PNG), bien éclairée et à plat.' },
            { s: tools('forge') + ' .btn-icone-teal', t: 'Bibliothèque d’illustrations', x: 'Insérez des illustrations dans vos fiches.' },
            { s: tools('forge') + ' .btn-icone-ambre', t: 'Fiches-formules', x: 'Insérez des fiches de formules prêtes à l’emploi.' },
            { s: '#forge-user-input', t: 'Votre demande', x: 'Écrivez ici votre demande : matière, classe, chapitre…' },
            { s: tools('forge') + ' .btn-envoyer-icon', t: 'Envoyer', x: 'Envoyez votre message.' },
            { s: '.btn-changer-categorie-enseignant', t: 'Changer de catégorie', x: 'Revenez au choix Professeur / Instituteur.' }
        ],
        cabinet: [
            { s: tools('cabinet') + ' [data-prefill^="Situation-problème"]', t: 'Une situation-problème', x: 'Soumettez une situation de classe : l’assistant vous aide à l’analyser.' },
            { s: tools('cabinet') + ' [data-message^="Donne-moi un conseil"]', t: 'Conseil pédagogique', x: 'Obtenez un conseil sur un point du programme que vous maîtrisez moins.' },
            { s: tools('cabinet') + ' [data-prefill^="Difficulté"]', t: 'Analyser une difficulté', x: 'Analysez une difficulté récurrente rencontrée avec vos élèves.' },
            { s: tools('cabinet') + ' .btn-icone-neutre', t: 'Joindre une photo', x: 'Joignez une photo (JPG ou PNG), bien éclairée et à plat.' },
            { s: '#cabinet-user-input', t: 'Votre question', x: 'Écrivez ici votre question pédagogique.' },
            { s: tools('cabinet') + ' .btn-envoyer-icon', t: 'Envoyer', x: 'Envoyez votre message.' },
            { s: '.btn-changer-categorie-enseignant', t: 'Changer de catégorie', x: 'Revenez au choix Professeur / Instituteur.' }
        ],
        forge_primaire: [
            { s: tools('forge_primaire') + ' ' + F('forge_primaire'), t: 'Formulaire de préparation', x: 'Indiquez la classe, la matière, la leçon, et si vous voulez la semaine et le jour de la progression, la durée et le matériel.' },
            { s: tools('forge_primaire') + ' ' + F('forge_primaire_eval'), t: 'Formulaire d’évaluation', x: 'Indiquez la classe, la matière, la leçon, le type d’évaluation, la durée, le nombre d’exercices et le barème : vous obtenez la fiche d’évaluation voulue.' },
            { s: tools('forge_primaire') + ' [data-message^="Ajoute des exercices"]', t: 'Ajouter des exercices', x: 'Après une première fiche, ajoute des exercices d’application à la dernière fiche.' },
            { s: tools('forge_primaire') + ' .btn-icone-neutre', t: 'Joindre une photo', x: 'Joignez une photo (JPG ou PNG), bien éclairée et à plat.' },
            { s: '#forge_primaire-user-input', t: 'Votre demande', x: 'Écrivez ici votre demande : fiche, classe, matière, leçon.' },
            { s: tools('forge_primaire') + ' .btn-envoyer-icon', t: 'Envoyer', x: 'Envoyez votre message.' },
            { s: '.btn-changer-categorie-enseignant', t: 'Changer de catégorie', x: 'Revenez au choix Professeur / Instituteur.' }
        ],
        cabinet_primaire: [
            { s: tools('cabinet_primaire') + ' [data-message^="Donne-moi un conseil"]', t: 'Conseil pédagogique', x: 'Obtenez un conseil sur un point du programme que vous maîtrisez moins.' },
            { s: tools('cabinet_primaire') + ' [data-prefill^="Élève"]', t: 'Un élève en difficulté', x: 'Décrivez la situation d’un élève : l’assistant vous aide à l’analyser.' },
            { s: tools('cabinet_primaire') + ' [data-message^="Comment gérer"]', t: 'Gestion de classe', x: 'Conseils pour une classe à plusieurs niveaux de compréhension.' },
            { s: tools('cabinet_primaire') + ' .btn-icone-neutre', t: 'Joindre une photo', x: 'Joignez une photo (JPG ou PNG), bien éclairée et à plat.' },
            { s: '#cabinet_primaire-user-input', t: 'Votre question', x: 'Écrivez ici votre question pédagogique.' },
            { s: tools('cabinet_primaire') + ' .btn-envoyer-icon', t: 'Envoyer', x: 'Envoyez votre message.' },
            { s: '.btn-changer-categorie-enseignant', t: 'Changer de catégorie', x: 'Revenez au choix Professeur / Instituteur.' }
        ]
    };

    // Boutons récents : badge « Nouveau » jusqu'au premier clic (ou 30 jours).
    const NOUVEAUTES = [
        { id: 'fg_atelier', depuis: '2026-10-27', s: tools('atelier') + ' ' + F('atelier') },
        { id: 'fg_forge', depuis: '2026-10-27', s: tools('forge') + ' ' + F('forge') },
        { id: 'fg_primaire', depuis: '2026-10-27', s: tools('forge_primaire') + ' ' + F('forge_primaire') },
        { id: 'fg_primaire_eval', depuis: '2026-10-30', s: tools('forge_primaire') + ' ' + F('forge_primaire_eval') },
        { id: 'copies', depuis: '2026-10-27', s: tools('atelier') + ' ' + F('atelier_copies') },
        { id: 'officiel', depuis: '2026-10-27', s: tools('atelier') + ' ' + F('atelier_officiel') }
    ];

    const CLE = (id) => `eduka_visite_${id}`;
    const CLE_NOUVEAU = (id) => `eduka_nouveau_${id}`;
    const lire = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible : sans conséquence */ } };

    let etat = null; // { id, etapes, i, elements }

    function visible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none';
    }

    function construireEtapes(id) {
        const brut = VISITES[id] || [];
        const etapes = [];
        brut.forEach((e) => {
            const el = document.querySelector(e.s);
            if (visible(el)) etapes.push({ el, t: e.t, x: e.x });
        });
        return etapes;
    }

    function fermer(marquer) {
        if (!etat) return;
        if (marquer) ecrire(CLE(etat.id), '1');
        const ov = document.getElementById('visite-guidee-overlay');
        if (ov) ov.remove();
        window.removeEventListener('resize', repositionner);
        document.removeEventListener('keydown', surTouche);
        etat = null;
    }

    function surTouche(e) {
        if (!etat) return;
        if (e.key === 'Escape') fermer(true);
        else if (e.key === 'ArrowRight' || e.key === 'Enter') suivant();
        else if (e.key === 'ArrowLeft') precedent();
    }

    function suivant() {
        if (!etat) return;
        if (etat.i >= etat.etapes.length - 1) { fermer(true); return; }
        etat.i += 1;
        afficher();
    }

    function precedent() {
        if (!etat || etat.i === 0) return;
        etat.i -= 1;
        afficher();
    }

    function repositionner() { if (etat) placer(); }

    function placer() {
        const ov = document.getElementById('visite-guidee-overlay');
        if (!ov || !etat) return;
        const e = etat.etapes[etat.i];
        const spot = ov.querySelector('.vg-spot');
        const bulle = ov.querySelector('.vg-bulle');
        const fleche = ov.querySelector('.vg-fleche');
        const r = e.el.getBoundingClientRect();
        const pad = 6;
        spot.style.left = (r.left - pad) + 'px';
        spot.style.top = (r.top - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';
        const vw = window.innerWidth, vh = window.innerHeight;
        bulle.style.maxWidth = Math.min(340, vw - 24) + 'px';
        bulle.style.left = '0px';
        bulle.style.top = '0px';
        const bw = bulle.offsetWidth, bh = bulle.offsetHeight;
        const peutHaut = r.top - bh - 22 >= 8;
        const peutBas = r.bottom + bh + 22 <= vh - 8;
        const enHaut = (r.top + r.height / 2 > vh / 2) ? (peutHaut || !peutBas) : (!peutBas && peutHaut);
        let top = enHaut ? Math.max(8, r.top - bh - 20) : Math.min(vh - bh - 8, r.bottom + 20);
        let left = r.left + r.width / 2 - bw / 2;
        left = Math.max(12, Math.min(vw - bw - 12, left));
        bulle.style.left = left + 'px';
        bulle.style.top = top + 'px';
        const cx = r.left + r.width / 2 - left - 9;
        fleche.style.left = Math.max(14, Math.min(bw - 32, cx)) + 'px';
        fleche.className = 'vg-fleche ' + (enHaut ? 'vg-fleche-bas' : 'vg-fleche-haut');
    }

    function afficher() {
        const ov = document.getElementById('visite-guidee-overlay');
        if (!ov || !etat) return;
        const e = etat.etapes[etat.i];
        const n = etat.etapes.length;
        ov.querySelector('.vg-compteur').textContent = `${etat.i + 1} / ${n}`;
        ov.querySelector('.vg-titre').textContent = e.t;
        ov.querySelector('.vg-texte').textContent = e.x;
        ov.querySelector('.vg-prec').style.visibility = etat.i === 0 ? 'hidden' : 'visible';
        ov.querySelector('.vg-suiv').textContent = etat.i === n - 1 ? 'Terminer' : 'Suivant';
        try { e.el.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (err) { /* ancien navigateur */ }
        placer();
        setTimeout(placer, 260);
    }

    function demarrer(id) {
        if (etat) fermer(false);
        const etapes = construireEtapes(id);
        if (!etapes.length) return false;
        const ov = document.createElement('div');
        ov.id = 'visite-guidee-overlay';
        ov.innerHTML =
            '<div class="vg-spot"></div>' +
            '<div class="vg-bulle" role="dialog" aria-live="polite">' +
            '<div class="vg-fleche"></div>' +
            '<div class="vg-compteur"></div>' +
            '<div class="vg-titre"></div>' +
            '<div class="vg-texte"></div>' +
            '<div class="vg-boutons">' +
            '<button type="button" class="vg-passer">Passer</button>' +
            '<span class="vg-espace"></span>' +
            '<button type="button" class="vg-prec">Précédent</button>' +
            '<button type="button" class="vg-suiv">Suivant</button>' +
            '</div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', (ev) => ev.stopPropagation());
        ov.querySelector('.vg-passer').onclick = () => fermer(true);
        ov.querySelector('.vg-prec').onclick = precedent;
        ov.querySelector('.vg-suiv').onclick = suivant;
        etat = { id, etapes, i: 0 };
        window.addEventListener('resize', repositionner);
        document.addEventListener('keydown', surTouche);
        afficher();
        return true;
    }

    function outilActif() {
        const outils = ['atelier', 'forge', 'cabinet', 'forge_primaire', 'cabinet_primaire'];
        for (const o of outils) {
            const c = document.getElementById(`container-${o}-custom`);
            if (c && c.classList.contains('active')) return o;
        }
        const choix = document.getElementById('teacher-atelier-chooser');
        if (choix && choix.style.display !== 'none' && visible(choix)) return 'choix_atelier';
        const sas = document.getElementById('container-sas-custom');
        if (sas && sas.classList.contains('active')) return 'sas';
        return null;
    }

    // Bouton « ❓ Aide » : relance la visite de l'écran affiché.
    window.lancerVisiteGuidee = function (id) {
        const cible = id || outilActif();
        if (cible) demarrer(cible);
    };

    // Appelé à l'entrée d'un espace : badges « Nouveau », puis visite automatique
    // une seule fois, uniquement pour un utilisateur qui n'a encore aucun historique ici.
    window.demarrerVisiteAuto = function (id) {
        appliquerBadgesNouveau();
        if (!VISITES[id] || lire(CLE(id))) return;
        const aHistorique = id === 'sas'
            ? lire(`eduka_chat_sas_${typeof avatarActif !== 'undefined' ? avatarActif : ''}`)
            : lire(`eduka_chat_${id}`);
        if (aHistorique) return;
        setTimeout(() => {
            if (outilActif() === id && !document.getElementById('visite-guidee-overlay')) demarrer(id);
        }, 1400);
    };

    function appliquerBadgesNouveau() {
        const maintenant = Date.now();
        NOUVEAUTES.forEach((n) => {
            if (lire(CLE_NOUVEAU(n.id))) return;
            if (maintenant - new Date(n.depuis).getTime() > 30 * 86400000) return;
            const el = document.querySelector(n.s);
            if (!el || el.querySelector('.badge-nouveau')) return;
            el.setAttribute('data-nouveau-id', n.id);
            const b = document.createElement('span');
            b.className = 'badge-nouveau';
            b.textContent = 'Nouveau';
            el.appendChild(b);
        });
    }

    // Le badge disparaît dès que l'utilisateur utilise le bouton.
    document.addEventListener('click', (ev) => {
        const bouton = ev.target.closest && ev.target.closest('[data-nouveau-id]');
        if (!bouton) return;
        ecrire(CLE_NOUVEAU(bouton.getAttribute('data-nouveau-id')), '1');
        const b = bouton.querySelector('.badge-nouveau');
        if (b) b.remove();
        bouton.removeAttribute('data-nouveau-id');
    }, true);

    document.addEventListener('DOMContentLoaded', appliquerBadgesNouveau);
})();
