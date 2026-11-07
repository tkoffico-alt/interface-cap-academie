/* Séance de classe — page de l'élève. Tout texte venant du serveur est inséré avec textContent,
   sauf les formules, rendues par KaTeX après échappement complet. */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api/seances/';
  var code = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
  var etat = { appareil: '', info: null, mode: '', minuterie: null, occupe: false };

  function $(id) { return document.getElementById(id); }
  function lire(c) { try { return localStorage.getItem(c) || ''; } catch (e) { return ''; } }
  function ecrire(c, v) { try { localStorage.setItem(c, v); } catch (e) { /* indisponible */ } }
  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rendreTexte(s) {
    s = String(s == null ? '' : s);
    var ok = (typeof katex !== 'undefined');
    var motif = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
    var sortie = '', dernier = 0, m;
    while ((m = motif.exec(s)) !== null) {
      sortie += esc(s.slice(dernier, m.index));
      var expr = m[1] || m[2] || m[3] || m[4];
      if (ok) { try { sortie += katex.renderToString(expr, { displayMode: !!(m[1] || m[2]), throwOnError: false }); } catch (e) { sortie += esc(m[0]); } }
      else { sortie += esc(m[0]); }
      dernier = motif.lastIndex;
    }
    return sortie + esc(s.slice(dernier));
  }
  function attendreKatex() {
    return new Promise(function (resolve) {
      var n = 0;
      (function boucle() { if (typeof katex !== 'undefined' || n++ > 30) return resolve(); setTimeout(boucle, 100); })();
    });
  }
  function identifiantAppareil() {
    var id = lire('eduka_appareil_defi');
    if (id && id.length >= 16) return id;
    try {
      if (window.crypto && crypto.randomUUID) id = crypto.randomUUID();
      else { var t = new Uint8Array(16); crypto.getRandomValues(t); id = Array.prototype.map.call(t, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
    } catch (e) { id = String(Date.now()) + Math.random().toString(16).slice(2) + 'xxxxxxxxxxxxxxxx'; }
    ecrire('eduka_appareil_defi', id);
    return id;
  }
  function ecran(nom) {
    ['chargement', 'erreur', 'accueil', 'jeu', 'fin'].forEach(function (n) { $('ecran-' + n).classList.toggle('cache', n !== nom); });
    window.scrollTo(0, 0);
  }
  function erreur(titre, texte) { $('erreur-titre').textContent = titre; $('erreur-texte').textContent = texte; ecran('erreur'); }
  function appel(chemin, methode, corps) {
    var options = { method: methode };
    if (corps) { options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(corps); }
    return fetch(API + chemin, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, statut: r.status, donnees: d }; });
    }).catch(function () { return { ok: false, statut: 0, donnees: {} }; });
  }
  function messageErreur(res) {
    if (res.statut === 0) return 'Connexion impossible. Vérifie ta connexion et réessaie.';
    return (res.donnees && typeof res.donnees.detail === 'string') ? res.donnees.detail : 'Une erreur est survenue. Réessaie.';
  }
  function quand(t) { return t ? t.slice(8, 10) + '/' + t.slice(5, 7) + ' à ' + t.slice(11, 16) : ''; }

  /* ---------- Accueil ---------- */
  function afficherAccueil(d) {
    etat.info = d;
    $('accueil-meta').textContent = [d.matiere, d.classe].filter(Boolean).join(' · ') || 'Séance de classe';
    $('accueil-titre').textContent = d.titre;
    $('accueil-infos').textContent = (d.chapitre ? d.chapitre + ' · ' : '') + d.nb_questions + ' questions · ' +
      (d.mode === 'examen' ? 'mode examen (correction à la fin du créneau)' : 'mode devoir (correction après chaque question)') +
      (d.duree_question ? ' · ' + d.duree_question + ' s par question' : '');
    var form = $('accueil-form');
    if (d.etat === 'avenir') {
      $('accueil-etat').textContent = 'La séance ouvrira le ' + quand(d.ouvre_le) + ' et fermera le ' + quand(d.ferme_le) + '.';
      form.classList.add('cache'); $('btn-actualiser').classList.remove('cache');
    } else if (d.etat === 'fermee') {
      $('accueil-etat').textContent = 'Cette séance est fermée depuis le ' + quand(d.ferme_le) + '.';
      form.classList.add('cache'); $('btn-actualiser').classList.add('cache');
    } else {
      $('accueil-etat').textContent = 'La séance est ouverte jusqu’au ' + quand(d.ferme_le) + '. Une fois commencée, ne ferme pas la page : le temps continue de courir.';
      form.classList.remove('cache'); $('btn-actualiser').classList.add('cache');
      var liste = !!d.roster;
      $('nom-liste').classList.toggle('cache', !liste); $('nom-liste-label').classList.toggle('cache', !liste);
      $('nom-libre').classList.toggle('cache', liste); $('nom-libre-label').classList.toggle('cache', liste);
      if (liste) {
        var sel = $('nom-liste'); sel.textContent = '';
        var o0 = el('option', '', '— Choisis ton nom —'); o0.value = ''; sel.appendChild(o0);
        d.roster.forEach(function (r) { var o = el('option', '', r.nom + (r.pris ? ' (déjà pris)' : '')); o.value = r.nom; o.disabled = !!r.pris; sel.appendChild(o); });
      }
    }
    ecran('accueil');
  }
  function commencer() {
    if (etat.occupe) return;
    var d = etat.info, nom = d.roster ? $('nom-liste').value : $('nom-libre').value.trim();
    if (!nom) { $('accueil-msg').textContent = d.roster ? 'Choisis ton nom dans la liste.' : 'Écris ton prénom et l’initiale de ton nom.'; return; }
    etat.occupe = true; $('btn-commencer').disabled = true; $('accueil-msg').textContent = '';
    rejoindre(nom).then(function (res) {
      etat.occupe = false; $('btn-commencer').disabled = false;
      if (!res.ok) { $('accueil-msg').textContent = messageErreur(res); return; }
      ecrire('eduka_seance_' + code, res.donnees.nom);
      continuer();
    });
  }
  function rejoindre(nom) { return appel(code + '/rejoindre', 'POST', { appareil: etat.appareil, nom: nom }); }

  /* ---------- Passation ---------- */
  function arreterChrono() { if (etat.minuterie) { clearInterval(etat.minuterie); etat.minuterie = null; } }
  function continuer() {
    appel(code + '/question', 'POST', { appareil: etat.appareil }).then(function (res) {
      if (!res.ok) { erreur('Impossible de continuer', messageErreur(res)); return; }
      if (res.donnees.termine) { afficherResultat(); return; }
      afficherQuestion(res.donnees);
    });
  }
  function afficherQuestion(q) {
    arreterChrono();
    attendreKatex().then(function () {
      $('jeu-position').textContent = 'Question ' + q.position + ' sur ' + q.total;
      $('jeu-mode').textContent = q.mode === 'examen' ? 'Examen' : 'Devoir';
      $('jeu-barre').style.width = Math.round(100 * (q.position - 1) / q.total) + '%';
      var secNom = q.section || '';
      $('jeu-section').textContent = secNom ? 'Section : ' + secNom : '';
      $('jeu-section').classList.toggle('cache', !secNom);
      var support = (etat.info && etat.info.texte_support) || '';
      $('jeu-texte-corps').textContent = support;
      $('jeu-texte').classList.toggle('cache', !support);
      $('jeu-question').innerHTML = rendreTexte(q.question);
      var zone = $('jeu-options'); zone.textContent = '';
      var lettres = ['A', 'B', 'C', 'D'];
      q.options.forEach(function (texte, i) {
        var b = el('button', 'option'); b.type = 'button';
        b.appendChild(el('span', 'lettre', lettres[i]));
        var t = el('span', 'texte-option'); t.innerHTML = rendreTexte(texte); b.appendChild(t);
        b.addEventListener('click', function () { repondre(i); });
        zone.appendChild(b);
      });
      ['jeu-explication', 'btn-suivant'].forEach(function (id) { $(id).classList.add('cache'); });
      $('jeu-msg').textContent = '';
      etat.mode = q.mode; etat.envoye = false;
      if (q.restant != null) {
        var total = etat.info && etat.info.duree_question ? etat.info.duree_question : q.restant;
        var fin = Date.now() + q.restant * 1000;
        $('jeu-chrono-zone').classList.remove('cache');
        var maj = function () {
          var reste = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
          $('jeu-temps').textContent = reste + ' s';
          $('jeu-chrono').style.width = Math.max(0, Math.min(100, 100 * reste / total)) + '%';
          if (reste <= 0) { arreterChrono(); if (!etat.envoye) repondre(-1); }
        };
        maj(); etat.minuterie = setInterval(maj, 1000);
      } else { $('jeu-chrono-zone').classList.add('cache'); }
      ecran('jeu');
    });
  }
  function repondre(i) {
    if (etat.envoye) return;
    etat.envoye = true; arreterChrono();
    var boutons = Array.prototype.slice.call($('jeu-options').children);
    boutons.forEach(function (b) { b.disabled = true; });
    appel(code + '/repondre', 'POST', { appareil: etat.appareil, choix: i }).then(function (res) {
      if (!res.ok) {
        etat.envoye = false; boutons.forEach(function (b) { b.disabled = false; });
        $('jeu-msg').textContent = messageErreur(res); return;
      }
      var d = res.donnees;
      if (d.delai_depasse && i >= 0) $('jeu-msg').textContent = 'Temps écoulé : cette réponse n’a pas été comptée.';
      if (etat.mode === 'devoir' && d.bonne !== undefined) {
        boutons.forEach(function (b, k) {
          if (k === d.bonne) b.classList.add('juste');
          else if (k === i) b.classList.add('faux');
        });
        $('jeu-explication').innerHTML = rendreTexte((d.correct ? '✅ Bravo ! ' : (i < 0 ? '⏱️ Pas de réponse. ' : '❌ Ce n’est pas la bonne réponse. ')) + (d.explication || ''));
        $('jeu-explication').classList.remove('cache');
        var s = $('btn-suivant'); s.textContent = d.termine ? 'Voir mon résultat' : 'Question suivante'; s.classList.remove('cache');
        s.onclick = function () { if (d.termine) afficherResultat(); else continuer(); };
      } else {
        if (d.termine) afficherResultat(); else continuer();
      }
    });
  }

  /* ---------- Résultat ---------- */
  /* Réduit la photo avant l'envoi (≈ 150-250 Ko au lieu de plusieurs Mo) : ménage les données mobiles de l'élève. */
  function reduirePhoto(fichier) {
    return new Promise(function (resolve, reject) {
      var lecteur = new FileReader();
      lecteur.onerror = function () { reject(); };
      lecteur.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(); };
        img.onload = function () {
          var essais = [[1500, 0.72], [1300, 0.62], [1100, 0.55], [900, 0.5]];
          for (var i = 0; i < essais.length; i++) {
            var ratio = Math.min(1, essais[i][0] / Math.max(img.width, img.height));
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(img.width * ratio)); cv.height = Math.max(1, Math.round(img.height * ratio));
            var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
            cx.drawImage(img, 0, 0, cv.width, cv.height);
            var url = cv.toDataURL('image/jpeg', essais[i][1]);
            if (url.length * 0.75 <= 300000 || i === essais.length - 1) { resolve(url); return; }
          }
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }
  function blocPhoto(corps, d) {
    if (!(etat.info && etat.info.copie_photo)) return;
    var bloc = el('div'); bloc.style.marginTop = '14px';
    bloc.appendChild(el('h2', '', '📷 Envoyer ma copie en photo (facultatif)'));
    var info = el('p', 'doux', d && d.copie_envoyee
      ? 'Ta copie a été envoyée ✓ Tu peux en envoyer une autre pour la remplacer.'
      : 'Quand tu as fini sur ton cahier : prends ta feuille en photo, bien à plat et bien éclairée. La photo est réduite avant l’envoi et supprimée automatiquement 7 jours après.');
    bloc.appendChild(info);
    var champ = document.createElement('input'); champ.type = 'file'; champ.accept = 'image/*'; champ.style.display = 'none';
    var choisir = el('button', 'btn btn-sec', d && d.copie_envoyee ? 'Choisir une autre photo' : 'Choisir ou prendre une photo'); choisir.type = 'button';
    var aper = document.createElement('img'); aper.alt = 'Aperçu de ta copie'; aper.style.cssText = 'display:none;max-width:100%;margin:10px 0;border:1px solid #cbd5e1;border-radius:8px';
    var envoyer = el('button', 'btn', 'Envoyer cette photo'); envoyer.type = 'button'; envoyer.style.display = 'none'; envoyer.style.marginTop = '8px';
    var msg = el('p', 'erreur-msg'); msg.setAttribute('role', 'alert');
    var prete = '';
    choisir.addEventListener('click', function () { champ.click(); });
    champ.addEventListener('change', function () {
      var f = champ.files && champ.files[0]; msg.textContent = ''; msg.style.color = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { msg.textContent = 'Choisis une photo (image).'; return; }
      choisir.disabled = true; choisir.textContent = 'Préparation de la photo…';
      reduirePhoto(f).then(function (url) {
        prete = url; aper.src = url; aper.style.display = 'block'; envoyer.style.display = 'block';
        choisir.disabled = false; choisir.textContent = 'Choisir une autre photo';
      }, function () {
        choisir.disabled = false; choisir.textContent = 'Choisir ou prendre une photo';
        msg.textContent = 'Photo illisible. Essaie une autre photo.';
      });
    });
    envoyer.addEventListener('click', function () {
      if (!prete) return;
      envoyer.disabled = true; envoyer.textContent = 'Envoi en cours…'; msg.textContent = ''; msg.style.color = '';
      appel(code + '/copie', 'POST', { appareil: etat.appareil, image: prete }).then(function (res) {
        envoyer.disabled = false; envoyer.textContent = 'Envoyer cette photo';
        if (!res.ok) { msg.textContent = messageErreur(res); return; }
        msg.style.color = 'var(--vrai-texte, #166534)';
        msg.textContent = 'Ta copie a été envoyée à ton enseignant ✓';
        info.textContent = 'Ta copie a été envoyée ✓ Tu peux en envoyer une autre pour la remplacer.';
        envoyer.style.display = 'none'; aper.style.display = 'none'; prete = '';
      });
    });
    bloc.appendChild(champ); bloc.appendChild(choisir); bloc.appendChild(aper); bloc.appendChild(envoyer); bloc.appendChild(msg);
    corps.appendChild(bloc);
  }
  function ajouterConsigne(corps, d) {
    var c = etat.info && etat.info.consigne_ecrite;
    if (!c) return;
    corps.appendChild(el('h2', '', '✍️ Production écrite'));
    var p = el('p'); p.style.whiteSpace = 'pre-wrap'; p.textContent = c; corps.appendChild(p);
    corps.appendChild(el('p', 'doux', 'À rédiger sur ton cahier ou sur une feuille : elle n’est pas notée ici, ton enseignant la corrigera.'));
    blocPhoto(corps, d);
  }
  function afficherResultat() {
    arreterChrono();
    appel(code + '/resultat', 'POST', { appareil: etat.appareil }).then(function (res) {
      if (!res.ok) { erreur('Résultat indisponible', messageErreur(res)); return; }
      var d = res.donnees, corps = $('fin-corps'); corps.textContent = '';
      $('btn-fin-actualiser').classList.add('cache');
      if (!d.termine) { continuer(); return; }
      if (!d.disponible) {
        corps.appendChild(el('p', '', 'Tu as répondu à toutes les questions. Bravo !'));
        corps.appendChild(el('p', 'doux', 'En mode examen, la note et la correction apparaissent à la fermeture de la séance, le ' + quand(d.ferme_le) + '. Reviens sur cette page à ce moment-là.'));
        ajouterConsigne(corps, d);
        $('btn-fin-actualiser').classList.remove('cache');
        ecran('fin'); return;
      }
      attendreKatex().then(function () {
        corps.appendChild(el('div', 'score-grand', d.score + ' / ' + d.total));
        if (d.moyenne_classe != null) corps.appendChild(el('p', 'doux', 'Moyenne de la classe : ' + String(d.moyenne_classe).replace('.', ',') + ' / ' + d.total + ' (' + d.nb_termines + ' élèves).'));
        ajouterConsigne(corps, d);
        corps.appendChild(el('h2', '', 'Ma correction'));
        d.correction.forEach(function (c, n) {
          var bloc = el('div', 'corr');
          var q = el('div'); q.style.fontWeight = '600';
          q.innerHTML = (n + 1) + '. ' + rendreTexte(c.question); bloc.appendChild(q);
          var opts = el('div', 'options');
          c.options.forEach(function (o, k) {
            var b = el('div', 'option' + (k === c.bonne ? ' juste' : (k === c.choix ? ' faux' : '')));
            b.appendChild(el('span', 'lettre', ['A', 'B', 'C', 'D'][k]));
            var t = el('span', 'texte-option'); t.innerHTML = rendreTexte(o) + (k === c.choix ? ' ← ta réponse' : ''); b.appendChild(t);
            opts.appendChild(b);
          });
          bloc.appendChild(opts);
          if (c.choix < 0) bloc.appendChild(el('p', 'doux', 'Pas de réponse.'));
          if (c.explication) { var ex = el('div', 'explication'); ex.innerHTML = rendreTexte(c.explication); bloc.appendChild(ex); }
          corps.appendChild(bloc);
        });
        ecran('fin');
      });
    });
  }

  /* ---------- Démarrage ---------- */
  function charger() {
    ecran('chargement');
    appel(code, 'GET').then(function (res) {
      if (res.statut === 404) { erreur('Séance introuvable', 'Ce lien ne correspond à aucune séance, ou elle a été retirée par l’enseignant.'); return; }
      if (res.statut === 410) { erreur('Séance terminée', 'Cette séance est terminée et ses données ont été effacées.'); return; }
      if (!res.ok) { erreur('Connexion impossible', messageErreur(res)); return; }
      etat.info = res.donnees;
      var memo = lire('eduka_seance_' + code);
      if (memo) {
        rejoindre(memo).then(function (r) { if (r.ok) continuer(); else afficherAccueil(res.donnees); });
      } else { afficherAccueil(res.donnees); }
    });
  }
  function init() {
    if (!/^[A-HJKMNP-Z2-9]{8}$/.test(code)) { erreur('Lien incomplet', 'Ouvre le lien complet envoyé par ton enseignant.'); return; }
    etat.appareil = identifiantAppareil();
    $('btn-commencer').addEventListener('click', commencer);
    $('nom-libre').addEventListener('keydown', function (e) { if (e.key === 'Enter') commencer(); });
    $('btn-actualiser').addEventListener('click', charger);
    $('btn-fin-actualiser').addEventListener('click', afficherResultat);
    document.addEventListener('visibilitychange', function () { /* le minuteur est contrôlé par le serveur */ });
    charger();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
