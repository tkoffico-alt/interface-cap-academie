/* EdukaTchat - Défi par lien : page de jeu (étape 4, 29/10/2026).
   Aucune dépendance sauf KaTeX (formules). La correction est faite par le serveur :
   la bonne réponse n'arrive qu'après le choix du joueur. Voir cahiers_des_charges/CDC_defi_par_lien.md */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api/defis/';
  var NB = 5;
  var code = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
  var etat = { appareil: '', pseudo: '', suivante: null, termine: false, score: 0, duree: null, occupe: false };

  function $(id) { return document.getElementById(id); }
  function lire(cle) { try { return localStorage.getItem(cle) || ''; } catch (e) { return ''; } }
  function ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { /* stockage indisponible */ } }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* Identifiant d'appareil : tiré au hasard une seule fois, jamais lié à une personne. */
  function identifiantAppareil() {
    var id = lire('eduka_appareil_defi');
    if (id && id.length >= 16) return id;
    try {
      if (window.crypto && crypto.randomUUID) id = crypto.randomUUID();
      else {
        var t = new Uint8Array(16); crypto.getRandomValues(t);
        id = Array.prototype.map.call(t, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      }
    } catch (e) { id = String(Date.now()) + Math.random().toString(16).slice(2) + 'xxxxxxxxxxxxxxxx'; }
    ecrire('eduka_appareil_defi', id);
    return id;
  }

  /* Texte avec formules : tout est échappé, seules les formules passent par KaTeX. */
  function rendreTexte(s) {
    s = String(s == null ? '' : s);
    var ok = (typeof katex !== 'undefined');
    var motif = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
    var sortie = '', dernier = 0, m;
    while ((m = motif.exec(s)) !== null) {
      sortie += esc(s.slice(dernier, m.index));
      var expr = m[1] || m[2] || m[3] || m[4];
      var bloc = !!(m[1] || m[2]);
      if (ok) {
        try { sortie += katex.renderToString(expr, { displayMode: bloc, throwOnError: false }); }
        catch (e) { sortie += esc(m[0]); }
      } else { sortie += esc(m[0]); }
      dernier = motif.lastIndex;
    }
    return sortie + esc(s.slice(dernier));
  }
  function attendreKatex() {
    return new Promise(function (resolve) {
      var essais = 0;
      (function boucle() {
        if (typeof katex !== 'undefined' || essais++ > 30) return resolve();
        setTimeout(boucle, 100);
      })();
    });
  }

  function ecran(nom) {
    ['chargement', 'erreur', 'accueil', 'jeu', 'resultat'].forEach(function (n) {
      $('ecran-' + n).classList.toggle('cache', n !== nom);
    });
  }
  function erreur(titre, texte) {
    $('erreur-titre').textContent = titre;
    $('erreur-texte').textContent = texte;
    ecran('erreur');
  }

  /* Appel réseau : renvoie {ok, statut, donnees} ; ne lève jamais. */
  function appel(chemin, methode, corps) {
    var options = { method: methode, headers: {} };
    if (corps) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(corps); }
    return fetch(API + chemin, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, statut: r.status, donnees: d }; });
    }).catch(function () { return { ok: false, statut: 0, donnees: {} }; });
  }
  function messageErreur(res) {
    if (res.statut === 0) return 'Connexion impossible. Vérifie ta connexion et réessaie.';
    return (typeof res.donnees.detail === 'string') ? res.donnees.detail : 'Une erreur est survenue. Réessaie dans un instant.';
  }

  function formaterDuree(s) {
    s = Number(s) || 0;
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60), r = s % 60;
    return m + ' min ' + (r < 10 ? '0' : '') + r + ' s';
  }

  /* ---------- Accueil ---------- */
  function afficherAccueil(d) {
    var meta = [d.matiere, d.classe].filter(Boolean).join(' · ');
    $('accueil-meta').textContent = meta || 'Défi';
    $('accueil-meta').classList.toggle('cache', !meta);
    $('accueil-titre').textContent = d.titre;
    $('accueil-createur').textContent = 'Défi lancé par ' + d.createur_pseudo;
    var places = d.places_restantes;
    $('accueil-infos').textContent = d.nb_questions + ' questions · environ 2 minutes · ' +
      (places > 1 ? places + ' places restantes' : (places === 1 ? 'dernière place' : 'plus de place'));
    $('pseudo').value = lire('eduka_defi_pseudo');
    if (places <= 0) {
      $('accueil-msg').textContent = 'Ce défi a déjà atteint son nombre maximum de joueurs.';
      $('btn-demarrer').disabled = true;
    }
    ecran('accueil');
  }

  function demarrer(pseudo, silencieux) {
    if (etat.occupe) return Promise.resolve();
    etat.occupe = true;
    $('btn-demarrer').disabled = true;
    $('accueil-msg').textContent = '';
    return appel(code + '/demarrer', 'POST', { appareil: etat.appareil, pseudo: pseudo }).then(function (res) {
      etat.occupe = false;
      if (!res.ok) {
        $('btn-demarrer').disabled = false;
        if (silencieux) return;   // reprise automatique impossible : l'appelant affichera l'accueil
        if (res.statut === 410 || res.statut === 404) { erreur('Défi indisponible', messageErreur(res)); return; }
        $('accueil-msg').textContent = messageErreur(res);
        return;
      }
      var d = res.donnees;
      etat.pseudo = d.pseudo;
      ecrire('eduka_defi_pseudo', d.pseudo);
      ecrire('eduka_defi_' + code, d.pseudo);
      if (d.termine) { etat.score = d.score; etat.duree = d.duree_s; return afficherResultat(); }
      return afficherQuestion(d.question);
    });
  }

  /* ---------- Jeu ---------- */
  function afficherQuestion(q) {
    return attendreKatex().then(function () {
      etat.suivante = null;
      $('jeu-progression').textContent = 'Question ' + (q.index + 1) + ' sur ' + NB;
      $('jeu-barre').style.width = Math.round((q.index / NB) * 100) + '%';
      $('jeu-question').innerHTML = rendreTexte(q.texte);
      var zone = $('jeu-options');
      zone.innerHTML = '';
      var lettres = 'ABCDEF';
      q.options.forEach(function (texte, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'option'; b.setAttribute('data-i', String(i));
        b.innerHTML = '<span class="lettre">' + lettres.charAt(i) + '</span><span class="texte-option">' + rendreTexte(texte) + '</span>';
        b.addEventListener('click', function () { choisir(i); });
        zone.appendChild(b);
      });
      ['jeu-retour', 'jeu-explication', 'btn-suivant'].forEach(function (id) { $(id).classList.add('cache'); });
      $('jeu-msg').textContent = '';
      ecran('jeu');
      $('jeu-question').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
  }

  function choisir(i) {
    if (etat.occupe) return;
    etat.occupe = true;
    var boutons = Array.prototype.slice.call(document.querySelectorAll('#jeu-options .option'));
    boutons.forEach(function (b) { b.disabled = true; });
    $('jeu-msg').textContent = '';
    appel(code + '/repondre', 'POST', { appareil: etat.appareil, choix: i }).then(function (res) {
      etat.occupe = false;
      if (!res.ok) {
        $('jeu-msg').textContent = messageErreur(res);
        if (res.statut !== 409 && res.statut !== 410 && res.statut !== 404) boutons.forEach(function (b) { b.disabled = false; });
        return;
      }
      var d = res.donnees;
      boutons.forEach(function (b) {
        var n = Number(b.getAttribute('data-i'));
        if (n === d.bonne) b.classList.add('juste');
        else if (n === i) b.classList.add('faux');
      });
      var retour = $('jeu-retour');
      retour.textContent = d.juste ? 'Bravo, bonne réponse !' : 'Pas tout à fait. La bonne réponse est en vert.';
      retour.className = 'retour ' + (d.juste ? 'juste' : 'faux');
      var expl = $('jeu-explication');
      if (d.explication) { expl.innerHTML = rendreTexte(d.explication); expl.classList.remove('cache'); }
      etat.suivante = d.question_suivante;
      etat.termine = !!d.termine;
      if (d.termine) { etat.score = d.score; etat.duree = d.duree_s; }
      $('jeu-barre').style.width = Math.round(((d.index + 1) / NB) * 100) + '%';
      var suivant = $('btn-suivant');
      suivant.textContent = d.termine ? 'Voir mon résultat' : 'Question suivante';
      suivant.classList.remove('cache');
      suivant.focus({ preventScroll: false });
    });
  }

  /* ---------- Résultat ---------- */
  function afficherResultat() {
    var s = etat.score;
    $('resultat-bravo').textContent = 'Merci d\'avoir joué, ' + etat.pseudo + ' !';
    $('resultat-score').textContent = s + ' / ' + NB;
    $('resultat-temps').textContent = etat.duree ? 'Temps : ' + formaterDuree(etat.duree) : '';
    $('resultat-phrase').textContent =
      s === NB ? 'Parfait, aucune erreur ! 🎉' :
      s === NB - 1 ? 'Très bien joué !' :
      s >= 3 ? 'Bien joué ! Tu peux encore progresser.' :
      'Courage ! Révise la leçon puis reviens tenter ta chance sur un autre défi.';
    ecran('resultat');
    window.scrollTo(0, 0);
  }

  /* ---------- Démarrage de la page ---------- */
  function init() {
    if (!code || !/^[A-HJKMNP-Z2-9]{8}$/.test(code)) {
      return erreur('Lien incorrect', 'Ce lien de défi n\'est pas valide. Demande à ton camarade de te le renvoyer.');
    }
    etat.appareil = identifiantAppareil();
    $('btn-demarrer').addEventListener('click', function () { demarrer($('pseudo').value, false); });
    $('pseudo').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); demarrer($('pseudo').value, false); } });
    $('btn-suivant').addEventListener('click', function () {
      if (etat.termine) afficherResultat();
      else if (etat.suivante) afficherQuestion(etat.suivante);
    });
    appel(code, 'GET').then(function (res) {
      if (!res.ok) {
        return erreur(res.statut === 410 ? 'Défi indisponible' : (res.statut === 404 ? 'Défi introuvable' : 'Oups'), messageErreur(res));
      }
      var d = res.donnees;
      var dejaJoue = lire('eduka_defi_' + code);
      if (dejaJoue) {   // cet appareil a déjà commencé ce défi : on reprend là où il en était
        return demarrer(dejaJoue, true).then(function () {
          if ($('ecran-chargement').classList.contains('cache')) return;   // partie reprise : rien à faire
          if (d.etat !== 'actif') return erreur('Ce défi est terminé', 'Le délai pour jouer est dépassé. Demande à ton camarade de te lancer un nouveau défi !');
          afficherAccueil(d);
        });
      }
      if (d.etat !== 'actif') return erreur('Ce défi est terminé', 'Le délai pour jouer est dépassé. Demande à ton camarade de te lancer un nouveau défi !');
      afficherAccueil(d);
    });
  }
  init();
})();
