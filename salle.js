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
    ['chargement', 'erreur', 'liste', 'creation', 'cree', 'accueil', 'salle'].forEach(function (n) {
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


  /* ---------- Libellés selon l'objectif ---------- */
  function adapterFormulaire() {
    var expose = ($('c-objectif').value === 'expose');
    $('c-titre-label').textContent = expose ? 'Thème de l\u2019exposé' : 'Titre de la salle';
    $('c-titre').placeholder = expose ? 'Ex. : Le cacao en Côte d\u2019Ivoire' : 'Ex. : Révision BEPC de maths';
    $('c-chap-label').textContent = expose ? 'Parties de l\u2019exposé (une par ligne, une par élève)' : 'Chapitres à réviser (un par ligne, de 1 à 12)';
    $('c-chap-aide').textContent = expose ? 'Un exposé porte sur un thème : découpe-le en parties que vous vous répartirez (de 1 à 12).' : '';
    var zone = $('c-chapitres');
    if (expose && !zone.value.trim()) zone.value = 'Introduction\nDéveloppement\nConclusion';
    zone.placeholder = expose ? 'Introduction\nLes origines\nConclusion' : 'Calcul littéral\nThéorème de Thalès\nStatistiques';
  }

  /* ---------- Mes salles (mémorisées sur cet appareil) ---------- */
  function salleMemorisees() {
    try { var l = JSON.parse(lire('eduka_salles') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  function memoriserSalle(c, titre) {
    var l = salleMemorisees().filter(function (x) { return x && x.code !== c; });
    l.unshift({ code: c, titre: String(titre || '').slice(0, 60) });
    ecrire('eduka_salles', JSON.stringify(l.slice(0, 8)));
  }
  function afficherListe(l) {
    var ul = $('liste-salles'); ul.textContent = '';
    l.forEach(function (x) {
      var li = el('li', 'membre');
      var a = el('a', 'membre-nom', '👥 ' + x.titre); a.href = '?c=' + encodeURIComponent(x.code);
      li.appendChild(a); ul.appendChild(li);
    });
    ecran('liste');
  }

  /* ---------- Création ---------- */
  function afficherCreation() {
    var sceau = lire('eduka_sceau');
    if (!sceau) { erreur('Créer une salle : réservé aux abonnés Premium', "Pour créer une salle, connecte-toi à EdukaTchat avec ton abonnement Premium. Pour rejoindre la salle d\u2019un camarade, ouvre le lien qu\u2019il t\u2019a envoyé : aucun abonnement n\u2019est nécessaire."); return; }
    $('c-pseudo').value = lire('eduka_salle_pseudo');
    adapterFormulaire();
    ecran('creation');
  }
  function creer() {
    var msg = $('creation-msg'); msg.textContent = '';
    var chapitres = $('c-chapitres').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!$('c-titre').value.trim()) { msg.textContent = 'Donne un titre à la salle.'; return; }
    if (chapitres.length < 1 || chapitres.length > 12) { msg.textContent = 'Écris entre 1 et 12 lignes, une par partie ou par chapitre.'; return; }
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
    memoriserSalle(code, d.titre);
    $('salle-meta').textContent = [OBJECTIFS[d.objectif] || '', d.matiere, d.classe].filter(Boolean).join(' · ') || 'Salle';
    $('salle-jours').textContent = jours(d);
    $('salle-titre').textContent = d.titre;
    $('salle-pct').textContent = d.progression_groupe + ' %';
    $('salle-barre').style.width = d.progression_groupe + '%';

    $('consigne-bloc').classList.toggle('cache', !d.consigne);
    $('consigne-texte').textContent = d.consigne || '';
    $('consigne-edition').classList.toggle('cache', !d.est_createur);
    if (d.est_createur && $('consigne-form').classList.contains('cache')) { $('consigne-saisie').value = d.consigne || ''; }
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
      if (t.commentaire) info += ' · 💬 commentaire du créateur';
      corps.appendChild(el('div', 'tache-info', info));
      if (d.objectif === 'expose') {
        var act = el('div', 'tache-info');
        if (!t.auteur) {
          var prendre = el('button', 'btn-petit', '✍️ Je prends cette section'); prendre.type = 'button';
          prendre.addEventListener('click', function () { prendreSection(i); });
          act.appendChild(prendre);
        } else {
          var mienne = (t.auteur === d.moi);
          act.appendChild(document.createTextNode('✍️ ' + (mienne ? 'Ta section' : 'Section de ' + t.auteur) + ' · ' + t.nb_car + ' caractère' + (t.nb_car > 1 ? 's' : '') + ' '));
          if (mienne || t.nb_car > 0 || d.est_createur) {
            var ouvrir = el('button', 'btn-petit', mienne ? 'Écrire / modifier' : 'Lire'); ouvrir.type = 'button';
            ouvrir.addEventListener('click', function () { ouvrirSection(i); });
            act.appendChild(ouvrir);
          }
        }
        corps.appendChild(act);
      }
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

    var ld = $('liste-defis'); ld.textContent = '';
    (d.defis || []).forEach(function (x) {
      var li2 = el('li', 'membre');
      var a2 = el('a', 'membre-nom', '⚔️ ' + x.titre + ' (par ' + x.pseudo + ')');
      a2.href = 'https://edukatchat.org/defi.html?c=' + encodeURIComponent(x.code); a2.target = '_blank'; a2.rel = 'noopener';
      li2.appendChild(a2); ld.appendChild(li2);
    });
    $('carte-suivi').classList.toggle('cache', !d.est_createur);
    $('btn-expose').classList.toggle('cache', d.objectif !== 'expose');
    $('plan-titre').textContent = (d.objectif === 'expose') ? 'Les sections de l\u2019exposé' : 'Mon plan de révision';
    $('plan-aide').textContent = (d.objectif === 'expose')
      ? 'Prends une section, rédige-la et dépose-la ; coche-la quand elle est terminée. Tout le monde peut lire les sections des autres.'
      : 'Coche un chapitre quand tu l\u2019as révisé. Si tu bloques, demande de l\u2019aide : tes camarades le verront.';
    $('btn-quitter').classList.toggle('cache', d.est_createur);
    $('btn-fermer').classList.toggle('cache', !d.est_createur);
    $('btn-prolonger').classList.toggle('cache', !d.est_createur);
    ecran('salle');
  }


  /* ---------- Exposé : sections ---------- */
  function prendreSection(i) {
    appel('/' + code + '/section/prendre', 'POST', { appareil: etat.appareil, index: i }).then(function (res) {
      if (!res.ok) message(messageErreur(res));
      actualiser(true).then(function () { if (res.ok) ouvrirSection(i); });
    });
  }
  function fermerPanneaux() { $('panneau-section').classList.add('cache'); $('panneau-expose').classList.add('cache'); }
  function compter() { $('ps-compteur').textContent = $('ps-texte').value.length + ' / 3000 caractères'; }
  function ouvrirSection(i) {
    fermerPanneaux(); $('ps-msg').textContent = '';
    appel('/' + code + '/section/lire', 'POST', { appareil: etat.appareil, index: i }).then(function (res) {
      if (!res.ok) { message(messageErreur(res)); return; }
      var d = etat.donnees, r = res.donnees, mienne = (r.auteur === d.moi);
      $('ps-titre').textContent = r.titre_section;
      $('ps-auteur').textContent = r.auteur ? ('Section rédigée par ' + (mienne ? 'toi' : r.auteur)) : 'Section libre';
      $('ps-texte').value = r.texte || '';
      $('ps-texte').readOnly = !mienne;
      $('ps-enregistrer').classList.toggle('cache', !mienne);
      $('ps-liberer').classList.toggle('cache', !(mienne || d.est_createur));
      $('ps-relire').classList.toggle('cache', !mienne); $('ps-relecture').classList.add('cache'); $('ps-relecture').textContent = '';
      $('ps-relire').onclick = function () { relire(i); };
      $('ps-enregistrer').onclick = function () {
        $('ps-msg').textContent = '';
        appel('/' + code + '/section/deposer', 'POST', { appareil: etat.appareil, index: i, texte: $('ps-texte').value }).then(function (r2) {
          $('ps-msg').textContent = r2.ok ? 'Section enregistrée ✓' : messageErreur(r2);
          if (r2.ok) actualiser(true);
        });
      };
      $('ps-liberer').onclick = function () {
        if (!confirm('Libérer cette section ? Le texte déposé sera effacé.')) return;
        appel('/' + code + '/section/liberer', 'POST', { appareil: etat.appareil, index: i }).then(function (r3) {
          if (!r3.ok) { $('ps-msg').textContent = messageErreur(r3); return; }
          fermerPanneaux(); actualiser(true);
        });
      };
      $('ps-comm-lecture').classList.toggle('cache', !r.commentaire);
      $('ps-comm-texte-lu').textContent = r.commentaire || '';
      var peutCommenter = d.est_createur && r.auteur && !mienne;
      $('ps-comm-edition').classList.toggle('cache', !peutCommenter);
      $('ps-comm-saisie').value = r.commentaire || ''; $('ps-comm-msg').textContent = '';
      $('ps-comm-enregistrer').onclick = function () {
        $('ps-comm-msg').textContent = '';
        appel('/' + code + '/section/commenter', 'POST', { appareil: etat.appareil, index: i, texte: $('ps-comm-saisie').value }).then(function (r4) {
          $('ps-comm-msg').textContent = r4.ok ? 'Commentaire enregistré ✓' : messageErreur(r4);
          if (r4.ok) { $('ps-comm-lecture').classList.toggle('cache', !r4.donnees.commentaire); $('ps-comm-texte-lu').textContent = r4.donnees.commentaire || ''; actualiser(true); }
        });
      };
      compter();
      $('panneau-section').classList.remove('cache');
      $('panneau-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function enregistrerConsigne() {
    var msg = $('consigne-msg'); msg.textContent = '';
    appel('/' + code + '/consigne', 'POST', { appareil: etat.appareil, texte: $('consigne-saisie').value }).then(function (res) {
      if (!res.ok) { msg.textContent = messageErreur(res); return; }
      $('consigne-form').classList.add('cache'); actualiser(true);
    });
  }
  function relire(i) {
    var b = $('ps-relire'), zone = $('ps-relecture'); $('ps-msg').textContent = '';
    b.disabled = true; b.textContent = 'Relecture en cours…';
    appel('/' + code + '/section/relire', 'POST', { appareil: etat.appareil, index: i, matricule: lire('eduka_sceau') }).then(function (res) {
      b.disabled = false; b.textContent = '🔍 Demander une relecture (IA)';
      if (!res.ok) { $('ps-msg').textContent = messageErreur(res); return; }
      var r = res.donnees; zone.textContent = '';
      function bloc(titre, liste) {
        if (!liste || !liste.length) return;
        zone.appendChild(el('h3', '', titre));
        var ul = el('ul', 'liste');
        liste.forEach(function (t) { ul.appendChild(el('li', '', t)); });
        zone.appendChild(ul);
      }
      bloc('👍 Ce qui est réussi', r.points_forts);
      bloc('💡 À améliorer', r.a_ameliorer);
      bloc('✏️ Fautes repérées', (r.fautes || []).map(function (f) { return f.avant + ' → ' + f.apres; }));
      zone.appendChild(el('p', 'doux', 'L\u2019IA te guide, mais c\u2019est toi qui corriges. Vérifie toujours les faits dans ton cours.'));
      zone.classList.remove('cache');
    });
  }
  function suggerer() {
    var msg = $('creation-msg'); msg.textContent = '';
    if (!$('c-titre').value.trim()) { msg.textContent = 'Écris d\u2019abord le titre ou le thème.'; return; }
    var b = $('btn-suggerer'); b.disabled = true; b.textContent = 'Réflexion…';
    appel('/suggerer', 'POST', { matricule: lire('eduka_sceau'), objectif: $('c-objectif').value, titre: $('c-titre').value.trim(),
      matiere: $('c-matiere').value.trim(), classe: $('c-classe').value.trim() }).then(function (res) {
      b.disabled = false; b.textContent = '💡 Suggérer des parties (IA, facultatif)';
      if (!res.ok) { msg.textContent = messageErreur(res); return; }
      $('c-chapitres').value = res.donnees.parties.join('\n');
      msg.textContent = 'Proposition de l\u2019IA : modifie-la comme tu veux avant de créer la salle.';
    });
  }
  function posterDefi() {
    var msg = $('sd-msg'); msg.textContent = '';
    var m = $('sd-lien').value.toUpperCase().match(/[A-Z0-9]{8}(?![A-Z0-9])/);
    if (!m) { msg.textContent = 'Colle le lien du défi ou son code (8 caractères).'; return; }
    appel('/' + code + '/defi', 'POST', { appareil: etat.appareil, defi_code: m[0] }).then(function (res) {
      if (!res.ok) { msg.textContent = messageErreur(res); return; }
      $('sd-lien').value = ''; actualiser(true);
    });
  }
  function voirSuivi() {
    var zone = $('suivi-contenu'); zone.textContent = 'Chargement…';
    appel('/' + code + '/suivi', 'POST', { appareil: etat.appareil }).then(function (res) {
      zone.textContent = '';
      if (!res.ok) { zone.textContent = messageErreur(res); return; }
      var d = res.donnees, t = el('table', 'tableau-suivi');
      var tr = el('tr'); tr.appendChild(el('th', '', 'Élève'));
      d.plan.forEach(function (p, i) { var th = el('th', '', String(i + 1)); th.title = p; tr.appendChild(th); });
      tr.appendChild(el('th', '', 'Vu le')); t.appendChild(tr);
      d.membres.forEach(function (m) {
        var r = el('tr'); r.appendChild(el('td', '', m.pseudo + (m.createur ? ' ⭐' : '')));
        m.faits.forEach(function (f) { r.appendChild(el('td', '', f ? '✅' : '·')); });
        r.appendChild(el('td', '', (m.derniere_visite || '').slice(5, 16).replace('-', '/')));
        t.appendChild(r);
      });
      zone.appendChild(t);
      var lg = el('ol', 'doux'); d.plan.forEach(function (p) { lg.appendChild(el('li', '', p)); }); zone.appendChild(lg);
      var rediges = [];
      d.membres.forEach(function (m) { m.sections.forEach(function (s) { rediges.push(m.pseudo + ' : partie ' + (s.index + 1) + ', ' + s.nb_car + ' caractères'); }); });
      if (rediges.length) zone.appendChild(el('p', 'doux', 'Sections déposées — ' + rediges.join(' ; ')));
    });
  }
  function echapperHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ouvrirExpose() {
    fermerPanneaux();
    appel('/' + code + '/expose', 'POST', { appareil: etat.appareil }).then(function (res) {
      if (!res.ok) { message(messageErreur(res)); return; }
      var donnees = res.donnees, zone = $('pe-contenu'); zone.textContent = '';
      var brut = donnees.titre + '\n\n', html = '<h1>' + echapperHtml(donnees.titre) + '</h1>';
      donnees.sections.forEach(function (sec, k) {
        var titre = (k + 1) + '. ' + sec.titre;
        zone.appendChild(el('h2', '', titre));
        zone.appendChild(el('p', sec.texte ? '' : 'doux', sec.texte || '(section pas encore rédigée' + (sec.auteur ? ' — ' + sec.auteur : '') + ')'));
        zone.lastChild.style.whiteSpace = 'pre-wrap';
        brut += titre + '\n' + (sec.texte || '(à rédiger)') + '\n\n';
        html += '<h2>' + echapperHtml(titre) + '</h2><p>' + echapperHtml(sec.texte || '(à rédiger)').replace(/\n/g, '<br>') + '</p>';
      });
      $('pe-copier').onclick = function () { copier(brut, $('pe-msg'), 'Texte copié ✓'); };
      $('pe-telecharger').onclick = function () {
        try {
          var blob = new Blob(['<html><head><meta charset="utf-8"></head><body>' + html + '</body></html>'], { type: 'application/msword' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'expose.doc';
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e) { $('pe-msg').textContent = 'Téléchargement impossible : utilise « Copier le texte ».'; }
      };
      $('pe-msg').textContent = '';
      $('panneau-expose').classList.remove('cache');
      $('panneau-expose').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
    if (!code) { var l = salleMemorisees(); if (l.length) afficherListe(l); else afficherCreation(); return; }
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
    $('c-objectif').addEventListener('change', adapterFormulaire);
    $('btn-nouvelle').addEventListener('click', afficherCreation);
    $('btn-rejoindre').addEventListener('click', function () { rejoindre(); demarrerSuivi(); });
    $('pseudo').addEventListener('keydown', function (e) { if (e.key === 'Enter') { rejoindre(); demarrerSuivi(); } });
    $('btn-expose').addEventListener('click', ouvrirExpose);
    $('btn-suggerer').addEventListener('click', suggerer);
    $('btn-consigne').addEventListener('click', function () {
      var f = $('consigne-form'); f.classList.toggle('cache');
      if (!f.classList.contains('cache')) { $('consigne-saisie').value = (etat.donnees && etat.donnees.consigne) || ''; $('consigne-saisie').focus(); }
    });
    $('consigne-enregistrer').addEventListener('click', enregistrerConsigne);
    $('sd-poster').addEventListener('click', posterDefi);
    $('btn-suivi').addEventListener('click', voirSuivi);
    $('ps-fermer').addEventListener('click', fermerPanneaux);
    $('pe-fermer').addEventListener('click', fermerPanneaux);
    $('ps-texte').addEventListener('input', compter);
    $('btn-actualiser').addEventListener('click', function () { message(''); actualiser(); });
    $('btn-partager').addEventListener('click', function () { copier(lienSalle(code), $('salle-msg'), 'Lien copié : envoie-le à ton camarade.'); });
    $('btn-quitter').addEventListener('click', function () { if (confirm('Quitter la salle ?')) action('quitter'); });
    $('btn-prolonger').addEventListener('click', function () { action('prolonger', {}, 'Salle prolongée de 30 jours.'); });
    $('btn-fermer').addEventListener('click', function () { if (confirm('Fermer la salle pour tout le monde ?')) action('fermer'); });
    charger();
  }
  init();
})();
