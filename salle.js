/* EdukaTchat - Salle d'étude (phase 1, 30/10/2026).
   Aucune dépendance. Tout texte venant du serveur est inséré avec textContent (jamais innerHTML).
   Voir cahiers_des_charges/CAHIER_espace_collaboratif_SALLE_D_ETUDE.md */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api/salles';
  var code = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
  var etat = { appareil: '', pseudo: '', donnees: null, occupe: false };
  var minuterie = null;
  var OBJECTIFS = { devoir: 'Devoir', bepc: 'BEPC', bac: 'BAC', expose: 'Exposé', autre: 'Révisions' };
  var REACTIONS = { bravo: '👏 Bravo', courage: '💪 Courage', merci: '🙏 Merci' };

  function $(id) { return document.getElementById(id); }
  function lire(cle) { try { return localStorage.getItem(cle) || ''; } catch (e) { return ''; } }
  function ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { /* indisponible */ } }
  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  function identifiantAppareil() {
    var id = lire('eduka_appareil_defi');   // même identifiant que le Défi : jamais lié à une personne
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

  function ecran(nom) {
    ['chargement', 'erreur', 'creation', 'cree', 'accueil', 'salle'].forEach(function (n) {
      $('ecran-' + n).classList.toggle('cache', n !== nom);
    });
  }
  function erreur(titre, texte) {
    $('erreur-titre').textContent = titre;
    $('erreur-texte').textContent = texte;
    ecran('erreur');
  }
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
  function lienSalle(c) { return 'https://edukatchat.org/salle.html?c=' + c; }

  function copier(texte, messageEl, ok) {
    function fin(bon) { if (messageEl) { messageEl.textContent = bon ? ok : 'Copie impossible : sélectionne le lien et copie-le à la main.'; } }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(texte).then(function () { fin(true); }, function () { fin(false); }); return; }
    } catch (e) { /* repli ci-dessous */ }
    fin(false);
  }

  /* ---------- Création ---------- */
  function afficherCreation() {
    var sceau = lire('eduka_sceau');
    if (!sceau) { erreur('Réservé aux abonnés Premium', "Pour créer une salle, connecte-toi à EdukaTchat avec ton abonnement Premium, puis reviens sur cette page."); return; }
    $('c-pseudo').value = lire('eduka_salle_pseudo');
    ecran('creation');
  }
  function creer() {
    var msg = $('creation-msg'); msg.textContent = '';
    var chapitres = $('c-chapitres').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!$('c-titre').value.trim()) { msg.textContent = 'Donne un titre à la salle.'; return; }
    if (chapitres.length < 2 || chapitres.length > 12) { msg.textContent = 'Écris entre 2 et 12 chapitres, un par ligne.'; return; }
    if (!$('c-pseudo').value.trim()) { msg.textContent = 'Choisis un pseudonyme.'; return; }
    var b = $('btn-creer'); b.disabled = true; b.textContent = 'Création…';
    appel('', 'POST', {
      matricule: lire('eduka_sceau'), appareil: etat.appareil, pseudo: $('c-pseudo').value.trim(),
      titre: $('c-titre').value.trim(), matiere: $('c-matiere').value.trim(), classe: $('c-classe').value.trim(),
      objectif: $('c-objectif').value, date_cible: $('c-date').value, taches: chapitres
    }).then(function (res) {
      b.disabled = false; b.textContent = 'Créer la salle';
      if (!res.ok) { msg.textContent = (res.statut === 404) ? "Cette fonction n'est pas disponible pour le moment." : messageErreur(res); return; }
      ecrire('eduka_salle_pseudo', $('c-pseudo').value.trim());
      code = res.donnees.code;
      var lien = res.donnees.lien;
      $('cree-lien').textContent = lien;
      $('btn-copier').onclick = function () { copier(lien, $('btn-copier'), ''); $('btn-copier').textContent = 'Lien copié ✓'; };
      $('btn-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent('Rejoins ma salle d’étude EdukaTchat : ' + lien);
      $('btn-entrer').onclick = function () { history.replaceState(null, '', '?c=' + code); charger(); };
      ecran('cree');
    });
  }

  /* ---------- Accueil (rejoindre) ---------- */
  function afficherAccueil(d) {
    var meta = [OBJECTIFS[d.objectif] || '', d.matiere, d.classe].filter(Boolean).join(' · ');
    $('accueil-meta').textContent = meta || 'Salle d’étude';
    $('accueil-meta').classList.toggle('cache', !meta);
    $('accueil-titre').textContent = d.titre;
    $('accueil-createur').textContent = 'Salle ouverte par ' + d.createur_pseudo;
    var p = d.places_restantes;
    $('accueil-infos').textContent = d.nb_taches + ' chapitres à réviser · ' + d.nb_membres + ' membre' + (d.nb_membres > 1 ? 's' : '') +
      ' · ' + (p > 1 ? p + ' places restantes' : (p === 1 ? 'dernière place' : 'salle complète'));
    $('pseudo').value = lire('eduka_salle_pseudo');
    if (p <= 0) { $('accueil-msg').textContent = 'Cette salle est complète.'; $('btn-rejoindre').disabled = true; }
    ecran('accueil');
  }
  function rejoindre() {
    if (etat.occupe) return;
    var pseudo = $('pseudo').value.trim();
    if (!pseudo) { $('accueil-msg').textContent = 'Choisis un pseudonyme.'; return; }
    etat.occupe = true; $('btn-rejoindre').disabled = true; $('accueil-msg').textContent = '';
    appel('/' + code + '/rejoindre', 'POST', { appareil: etat.appareil, pseudo: pseudo }).then(function (res) {
      etat.occupe = false; $('btn-rejoindre').disabled = false;
      if (!res.ok) { $('accueil-msg').textContent = messageErreur(res); return; }
      ecrire('eduka_salle_pseudo', res.donnees.pseudo);
      actualiser();
    });
  }

  /* ---------- La salle ---------- */
  function jours(d) {
    if (d.jours_restants == null) return 'Ouverte jusqu’au ' + d.expire_le.slice(8, 10) + '/' + d.expire_le.slice(5, 7);
    if (d.jours_restants < 0) return 'Date passée';
    if (d.jours_restants === 0) return 'C’est aujourd’hui !';
    return 'J-' + d.jours_restants;
  }
  function afficherSalle(d) {
    etat.donnees = d;
    $('salle-meta').textContent = [OBJECTIFS[d.objectif] || '', d.matiere, d.classe].filter(Boolean).join(' · ') || 'Salle';
    $('salle-jours').textContent = jours(d);
    $('salle-titre').textContent = d.titre;
    $('salle-pct').textContent = d.progression_groupe + ' %';
    $('salle-barre').style.width = d.progression_groupe + '%';

    var plan = $('liste-plan'); plan.textContent = '';
    d.plan.forEach(function (t, i) {
      var fait = d.mes_faits.indexOf(i) !== -1;
      var li = el('li', 'tache' + (fait ? ' fait' : ''));
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = fait;
      cb.setAttribute('aria-label', 'Chapitre révisé : ' + t.texte);
      cb.addEventListener('change', function () { cocher(i, cb.checked); });
      var corps = el('div', 'tache-corps');
      corps.appendChild(el('div', 'tache-nom', t.texte));
      var info = t.nb_faits + ' / ' + d.membres.length + ' ont révisé ce chapitre';
      if (t.aides.length) info += ' · 🙋 ' + t.aides.join(', ') + (t.aides.length > 1 ? ' demandent' : ' demande') + ' de l’aide';
      corps.appendChild(el('div', 'tache-info', info));
      var moiAide = t.aides.indexOf(d.moi) !== -1;
      var aide = el('button', 'btn-petit' + (moiAide ? ' actif' : ''), moiAide ? '🙋 Aide demandée' : '🙋 Besoin d’aide');
      aide.type = 'button';
      if (fait) aide.classList.add('cache');
      aide.addEventListener('click', function () { demanderAide(i, !moiAide); });
      li.appendChild(cb); li.appendChild(corps); li.appendChild(aide);
      plan.appendChild(li);
    });

    var liste = $('liste-membres'); liste.textContent = '';
    d.membres.forEach(function (m) {
      var li = el('li', 'membre' + (m.moi ? ' moi' : ''));
      li.appendChild(el('span', 'membre-nom', m.pseudo + (m.createur ? ' ⭐' : '') + (m.moi ? ' (moi)' : '')));
      li.appendChild(el('span', 'membre-score', m.nb_faits + ' / ' + d.plan.length));
      if (!m.moi) {
        var r = el('div', 'reactions');
        Object.keys(REACTIONS).forEach(function (cle) {
          var b = el('button', 'btn-petit', REACTIONS[cle]); b.type = 'button';
          b.addEventListener('click', function () { reagir(m.pseudo, cle); });
          r.appendChild(b);
        });
        li.appendChild(r);
        if (d.est_createur) {
          var ret = el('button', 'btn-petit', 'Retirer'); ret.type = 'button';
          ret.addEventListener('click', function () { if (confirm('Retirer ' + m.pseudo + ' de la salle ?')) action('retirer', { cible: m.pseudo }); });
          li.appendChild(ret);
        } else {
          var sig = el('button', 'btn-petit', '⚑'); sig.type = 'button'; sig.title = 'Signaler'; sig.setAttribute('aria-label', 'Signaler ' + m.pseudo);
          sig.addEventListener('click', function () { if (confirm('Signaler ' + m.pseudo + ' ? Deux signalements retirent la personne de la salle.')) action('signaler', { cible: m.pseudo }, 'Merci, signalement enregistré.'); });
          li.appendChild(sig);
        }
      }
      liste.appendChild(li);
    });

    var zone = $('liste-recu'); zone.textContent = '';
    $('zone-recu').classList.toggle('cache', !d.reactions.length);
    d.reactions.forEach(function (r) { zone.appendChild(el('span', 'recu', (REACTIONS[r.type] || r.type) + ' de ' + r.de)); });

    $('btn-quitter').classList.toggle('cache', d.est_createur);
    $('btn-fermer').classList.toggle('cache', !d.est_createur);
    $('btn-prolonger').classList.toggle('cache', !d.est_createur);
    ecran('salle');
  }

  function actualiser(silencieux) {
    return appel('/' + code + '/etat', 'POST', { appareil: etat.appareil }).then(function (res) {
      if (res.ok) { afficherSalle(res.donnees); return true; }
      if (res.statut === 403) { return false; }
      if (res.statut === 410 || res.statut === 404) { erreur('Salle terminée', messageErreur(res)); return true; }
      if (!silencieux) $('salle-msg').textContent = messageErreur(res);
      return true;
    });
  }
  function message(texte) { $('salle-msg').textContent = texte || ''; }
  function cocher(i, fait) {
    appel('/' + code + '/cocher', 'POST', { appareil: etat.appareil, index: i, fait: fait }).then(function (res) {
      if (!res.ok) message(messageErreur(res)); actualiser(true);
    });
  }
  function demanderAide(i, active) {
    appel('/' + code + '/aide', 'POST', { appareil: etat.appareil, index: i, active: active }).then(function (res) {
      if (!res.ok) message(messageErreur(res)); actualiser(true);
    });
  }
  function reagir(vers, type) {
    message('');
    appel('/' + code + '/reagir', 'POST', { appareil: etat.appareil, vers: vers, type: type }).then(function (res) {
      message(res.ok ? 'Message envoyé à ' + vers + ' ✓' : messageErreur(res));
    });
  }
  function action(nom, corps, ok) {
    corps = corps || {}; corps.appareil = etat.appareil;
    appel('/' + code + '/' + nom, 'POST', corps).then(function (res) {
      if (!res.ok) { message(messageErreur(res)); return; }
      if (nom === 'quitter' || nom === 'fermer') { erreur(nom === 'quitter' ? 'Tu as quitté la salle' : 'Salle fermée', 'À bientôt sur EdukaTchat !'); return; }
      message(ok || ''); actualiser(true);
    });
  }

  function charger() {
    ecran('chargement');
    if (!code) { afficherCreation(); return; }
    appel('/' + code + '/etat', 'POST', { appareil: etat.appareil }).then(function (res) {
      if (res.ok) { afficherSalle(res.donnees); demarrerSuivi(); return; }
      if (res.statut === 403) {   // pas encore membre : page d'accueil
        appel('/' + code, 'GET').then(function (r2) {
          if (r2.ok) { afficherAccueil(r2.donnees); return; }
          erreur(r2.statut === 410 ? 'Salle terminée' : 'Salle introuvable', messageErreur(r2));
        });
        return;
      }
      erreur(res.statut === 410 ? 'Salle terminée' : 'Salle introuvable', messageErreur(res));
    });
  }
  function demarrerSuivi() {
    if (minuterie) return;
    minuterie = setInterval(function () { if (!document.hidden && etat.donnees) actualiser(true); }, 20000);
  }

  function init() {
    etat.appareil = identifiantAppareil();
    $('btn-creer').addEventListener('click', creer);
    $('btn-rejoindre').addEventListener('click', function () { rejoindre(); demarrerSuivi(); });
    $('pseudo').addEventListener('keydown', function (e) { if (e.key === 'Enter') { rejoindre(); demarrerSuivi(); } });
    $('btn-actualiser').addEventListener('click', function () { message(''); actualiser(); });
    $('btn-partager').addEventListener('click', function () { copier(lienSalle(code), $('salle-msg'), 'Lien copié : envoie-le à ton camarade.'); });
    $('btn-quitter').addEventListener('click', function () { if (confirm('Quitter la salle ?')) action('quitter'); });
    $('btn-prolonger').addEventListener('click', function () { action('prolonger', {}, 'Salle prolongée de 30 jours.'); });
    $('btn-fermer').addEventListener('click', function () { if (confirm('Fermer la salle pour tout le monde ?')) action('fermer'); });
    charger();
  }
  init();
})();
