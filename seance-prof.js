/* Séances de classe — page de l'enseignant. Les matricules de la liste de classe restent dans le
   navigateur (localStorage de cet appareil) : seuls des noms « Prénom + initiale » partent au serveur.
   Tout texte venant du serveur est inséré avec textContent. */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api/seances';
  var etat = { sceau: '', sections: [], questions: [], code: '', tableau: null, rosterCopie: null };

  function $(id) { return document.getElementById(id); }
  function lire(c) { try { return localStorage.getItem(c) || ''; } catch (e) { return ''; } }
  function ecrire(c, v) { try { localStorage.setItem(c, v); } catch (e) { /* indisponible */ } }
  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }
  function ecran(nom) {
    ['chargement', 'erreur', 'liste', 'creation', 'cree', 'tableau'].forEach(function (n) { $('ecran-' + n).classList.toggle('cache', n !== nom); });
    window.scrollTo(0, 0);
  }
  function erreur(titre, texte) { $('erreur-titre').textContent = titre; $('erreur-texte').textContent = texte; ecran('erreur'); }
  function appel(chemin, corps) {
    var corpsComplet = Object.assign({ matricule: etat.sceau }, corps || {});
    return fetch(API + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpsComplet) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, statut: r.status, donnees: d }; });
    }).catch(function () { return { ok: false, statut: 0, donnees: {} }; });
  }
  function messageErreur(res) {
    if (res.statut === 0) return 'Connexion impossible. Vérifiez votre connexion et réessayez.';
    if (res.statut === 404) return 'Cet espace est réservé aux enseignants (code ENS-). Si vous êtes élève, vous rejoignez une séance avec le lien donné par votre enseignant.';
    return (res.donnees && typeof res.donnees.detail === 'string') ? res.donnees.detail : 'Une erreur est survenue. Réessayez.';
  }
  function quand(t) { return t ? t.slice(8, 10) + '/' + t.slice(5, 7) + ' ' + t.slice(11, 16) : ''; }
  function copier(texte, cible, ok) {
    function fin(bon) { cible.textContent = bon ? ok : 'Copie impossible : sélectionnez le lien à la main.'; }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(texte).then(function () { fin(true); }, function () { fin(false); }); return; } } catch (e) { /* repli */ }
    fin(false);
  }

  /* ---------- Liste de classe (local) ---------- */
  function capitaliser(mot) { return mot ? mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase() : ''; }
  function separer(texte) {
    var mots = String(texte).split(/\s+/).filter(Boolean), nom = [], prenom = [];
    mots.forEach(function (m) {
      if (!prenom.length && m.length >= 2 && m === m.toUpperCase() && m !== m.toLowerCase()) nom.push(m); else prenom.push(m);
    });
    if (!nom.length) { nom = [mots[0] || '']; prenom = mots.slice(1); }
    return { nom: nom.join(' '), prenom: prenom.join(' ') };
  }
  function analyserListe(texte) {
    var lignes = String(texte || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var eleves = lignes.map(function (l) {
      var p = l.split(/;|\t/).map(function (x) { return x.trim(); });
      var matricule = '', nom = '', prenom = '', r;
      if (p.length >= 3) { matricule = p[0]; nom = p[1]; prenom = p.slice(2).join(' '); }
      else if (p.length === 2) { matricule = p[0]; r = separer(p[1]); nom = r.nom; prenom = r.prenom; }
      else { r = separer(p[0]); nom = r.nom; prenom = r.prenom; }
      return { matricule: matricule, nomComplet: (nom + ' ' + prenom).trim(), nom: nom, prenom: prenom };
    }).filter(function (e) { return e.nomComplet; });
    // nom affiché : « Prénom N. », rallongé (« Prénom KO. », puis numéro) si deux élèves ont le même
    var pris = {};
    eleves.forEach(function (e) {
      var pre = capitaliser((e.prenom || e.nom).split(/\s+/)[0]);
      var nomLettres = (e.prenom ? e.nom : '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
      var n = 1, affiche = '';
      for (;;) {
        affiche = nomLettres ? pre + ' ' + nomLettres.slice(0, n).toUpperCase() + '.' : pre;
        if (!pris[affiche.toLowerCase()] || n >= nomLettres.length) break;
        n++;
      }
      var base = affiche, k = 2;
      while (pris[affiche.toLowerCase()]) { affiche = base + ' ' + k; k++; }
      affiche = affiche.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9 .'\-]/g, '').slice(0, 30);
      pris[affiche.toLowerCase()] = true;
      e.affiche = affiche;
    });
    return eleves;
  }
  function apercuListe() {
    var l = analyserListe($('c-roster').value);
    $('roster-apercu').textContent = l.length ? l.length + ' élève(s) : ' + l.slice(0, 4).map(function (e) { return e.affiche; }).join(', ') + (l.length > 4 ? '…' : '') : '';
  }
  function listeLocale(code) { try { var l = JSON.parse(lire('eduka_seance_roster_' + code) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function memoriserListe(code, liste) {
    ecrire('eduka_seance_roster_' + code, JSON.stringify(liste.map(function (e) { return { matricule: e.matricule, nomComplet: e.nomComplet, affiche: e.affiche }; })));
  }

  /* ---------- Questions ---------- */
  function majNb() {
    var blocNb = $('bloc-nb'); if (blocNb) blocNb.style.display = etat.sections.length ? 'none' : '';
    var n = etat.questions.length, sel = $('c-nb'), valeur = parseInt(sel.value, 10) || 10;
    var maxi = Math.min(30, Math.max(n, 5));
    sel.textContent = '';
    for (var k = 5; k <= maxi; k++) { var o = el('option', '', k + ' questions'); o.value = String(k); sel.appendChild(o); }
    sel.value = String(Math.min(Math.max(valeur, 5), maxi));
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /* Aperçu des formules : même rendu que celui de l'élève (KaTeX, après échappement complet). */
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
  var apercus = [];
  window.addEventListener('load', function () { apercus.forEach(function (f) { f(); }); });
  function dessinerSections() {
    var zone = $('liste-sections'); zone.textContent = '';
    etat.sections.forEach(function (sec, i) {
      var ligne = el('div', 'ligne-opt'); ligne.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px';
      var nom = el('input'); nom.type = 'text'; nom.maxLength = 30; nom.value = sec.nom; nom.placeholder = 'Nom (ex. Vocabulaire)';
      nom.setAttribute('aria-label', 'Nom de la section ' + (i + 1)); nom.style.flex = '1 1 150px';
      nom.addEventListener('input', function () { sec.nom = nom.value; });
      nom.addEventListener('change', function () {
        var nouveau = nom.value.trim();
        etat.questions.forEach(function (q) { if (sec.prec && q.section === sec.prec) q.section = nouveau; });
        sec.prec = nouveau; dessinerQuestions();
      });
      var nb = el('input'); nb.type = 'number'; nb.min = '1'; nb.max = '15'; nb.value = String(sec.nb); nb.style.width = '70px';
      nb.setAttribute('aria-label', 'Questions par élève dans la section ' + (i + 1));
      nb.addEventListener('input', function () { sec.nb = Math.min(15, Math.max(1, parseInt(nb.value, 10) || 1)); });
      var gen = el('button', 'btn btn-sec', '✨ Générer'); gen.type = 'button';
      gen.addEventListener('click', function () { genererSection(i, gen); });
      var ret = el('button', 'lien-discret', 'Retirer'); ret.type = 'button';
      ret.addEventListener('click', function () {
        etat.questions.forEach(function (q) { if (q.section === sec.nom.trim()) q.section = ''; });
        etat.sections.splice(i, 1); dessinerSections(); dessinerQuestions();
      });
      ligne.appendChild(nom); ligne.appendChild(el('span', 'doux', 'questions par élève :')); ligne.appendChild(nb); ligne.appendChild(gen); ligne.appendChild(ret);
      zone.appendChild(ligne);
    });
  }
  function genererSection(i, b) {
    var sec = etat.sections[i], msg = $('gen-msg'); msg.textContent = '';
    if (!sec.nom.trim()) { msg.textContent = 'Donnez d’abord un nom à la section.'; return; }
    if (!$('c-chapitre').value.trim()) { msg.textContent = 'Indiquez d’abord le chapitre.'; return; }
    var ancien = b.textContent; b.disabled = true; b.textContent = 'Génération…';
    appel('/generer', { chapitre: ($('c-chapitre').value.trim() + ' — ' + sec.nom.trim()).slice(0, 120), matiere: $('c-matiere').value.trim(), classe: $('c-classe').value.trim(),
      nb: Math.min(25, Math.max(6, 2 * sec.nb)), extrait: $('c-extrait').value || $('c-texte').value }).then(function (res) {
      b.disabled = false; b.textContent = ancien;
      if (!res.ok) { msg.textContent = messageErreur(res); return; }
      var nouvelles = res.donnees.questions.map(function (q) { q.section = sec.nom.trim(); return q; });
      etat.questions = etat.questions.concat(nouvelles).slice(0, 40);
      dessinerQuestions();
      msg.textContent = nouvelles.length + ' questions générées pour « ' + sec.nom.trim() + ' » : relisez-les avant de lancer la séance.';
    });
  }
  function dessinerQuestions() {
    var zone = $('liste-questions'); zone.textContent = ''; apercus = [];
    etat.questions.forEach(function (q, i) {
      var bloc = el('div', 'q-edit');
      bloc.appendChild(el('div', 'doux', 'Question ' + (i + 1) + ' · source : ' + (q.source === 'ia' ? 'IA (à vérifier)' : 'enseignant')));
      if (etat.sections.length) {
        var selSec = el('select'); selSec.setAttribute('aria-label', 'Section de la question ' + (i + 1));
        var o0 = el('option', '', '(aucune section : question non utilisée)'); o0.value = ''; selSec.appendChild(o0);
        etat.sections.forEach(function (sec) { if (sec.nom.trim()) { var o = el('option', '', sec.nom.trim()); o.value = sec.nom.trim(); selSec.appendChild(o); } });
        selSec.value = q.section || '';
        selSec.addEventListener('change', function () { q.section = selSec.value; });
        bloc.appendChild(selSec);
      }
      var t = el('textarea'); t.value = q.question; t.maxLength = 300; t.setAttribute('aria-label', 'Énoncé de la question ' + (i + 1));
      t.addEventListener('input', function () { q.question = t.value; });
      bloc.appendChild(t);
      q.options.forEach(function (o, k) {
        var ligne = el('div', 'ligne-opt');
        var r = el('input'); r.type = 'radio'; r.name = 'bonne-' + i; r.checked = (q.bonne === k);
        r.setAttribute('aria-label', 'Bonne réponse : option ' + ['A', 'B', 'C', 'D'][k]);
        r.addEventListener('change', function () { q.bonne = k; });
        var inp = el('input'); inp.type = 'text'; inp.maxLength = 150; inp.value = o; inp.setAttribute('aria-label', 'Option ' + ['A', 'B', 'C', 'D'][k]);
        inp.addEventListener('input', function () { q.options[k] = inp.value; });
        ligne.appendChild(r); ligne.appendChild(inp); bloc.appendChild(ligne);
      });
      bloc.appendChild(el('div', 'doux', 'Cochez la bonne réponse.'));
      var ex = el('textarea'); ex.value = q.explication || ''; ex.maxLength = 300; ex.placeholder = 'Explication affichée à l’élève après sa réponse';
      ex.addEventListener('input', function () { q.explication = ex.value; });
      bloc.appendChild(ex);
      var ap = el('div', 'doux'); ap.style.cssText = 'margin-top:8px;padding:8px 10px;border:1px dashed currentColor;border-radius:8px';
      var majAp = function () {
        var brut = q.question + ' ' + q.options.join(' ') + ' ' + (q.explication || '');
        if (!/\$|\\\(|\\\[/.test(brut)) { ap.style.display = 'none'; return; }
        ap.style.display = '';
        var h = '<div><b>Aperçu élève</b></div><div>' + rendreTexte(q.question) + '</div>';
        q.options.forEach(function (o, k) { h += '<div>' + ['A', 'B', 'C', 'D'][k] + '. ' + rendreTexte(o) + (q.bonne === k ? ' ✓' : '') + '</div>'; });
        if (q.explication) h += '<div><i>' + rendreTexte(q.explication) + '</i></div>';
        ap.innerHTML = h;
      };
      bloc.appendChild(ap); apercus.push(majAp); majAp();
      bloc.addEventListener('input', majAp); bloc.addEventListener('change', majAp);
      var sup = el('button', 'lien-discret', 'Supprimer cette question'); sup.type = 'button';
      sup.addEventListener('click', function () { etat.questions.splice(i, 1); dessinerQuestions(); });
      bloc.appendChild(sup);
      zone.appendChild(bloc);
    });
    majNb();
  }
  function generer() {
    var msg = $('gen-msg'); msg.textContent = '';
    if (!$('c-chapitre').value.trim()) { msg.textContent = 'Indiquez d’abord le chapitre.'; return; }
    var b = $('btn-generer'); b.disabled = true; b.textContent = 'Génération en cours… (jusqu’à 1 minute)';
    appel('/generer', { chapitre: $('c-chapitre').value.trim(), matiere: $('c-matiere').value.trim(), classe: $('c-classe').value.trim(), nb: 15, extrait: $('c-extrait').value || $('c-texte').value }).then(function (res) {
      b.disabled = false; b.textContent = '✨ Générer 15 questions avec l’IA';
      if (!res.ok) { msg.textContent = messageErreur(res); return; }
      etat.questions = etat.questions.concat(res.donnees.questions).slice(0, 40);
      dessinerQuestions();
      msg.textContent = res.donnees.questions.length + ' questions générées : relisez-les avant de lancer la séance.';
    });
  }

  /* ---------- Création ---------- */
  function dateLocale(d) {
    function p(n) { return ('0' + n).slice(-2); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function viderFormulaire() {
    ['c-titre', 'c-matiere', 'c-classe', 'c-chapitre', 'c-extrait', 'c-texte', 'c-ecrit', 'c-roster'].forEach(function (id) { $(id).value = ''; });
    $('c-mode').value = 'devoir'; $('c-duree').value = '45'; $('c-photo').checked = false;
    etat.questions = []; etat.sections = []; etat.rosterCopie = null; $('roster-apercu').textContent = ''; $('btn-vider-roster').classList.add('cache');
    $('gen-msg').textContent = '';
  }
  function ouvrirCreation() {
    var maintenant = new Date();
    $('c-ouvre').value = dateLocale(new Date(maintenant.getTime() + 10 * 60000));
    $('c-ferme').value = dateLocale(new Date(maintenant.getTime() + 48 * 3600 * 1000));
    $('creation-msg').textContent = '';
    dessinerSections();
    dessinerQuestions();
    ecran('creation');
  }
  function creer() {
    var msg = $('creation-msg'); msg.textContent = '';
    var liste = analyserListe($('c-roster').value);
    if (!liste.length && etat.rosterCopie) liste = etat.rosterCopie;
    var corps = {
      titre: $('c-titre').value.trim(), matiere: $('c-matiere').value.trim(), classe: $('c-classe').value.trim(),
      chapitre: $('c-chapitre').value.trim(), mode: $('c-mode').value, duree_question: parseInt($('c-duree').value, 10),
      ouvre_le: $('c-ouvre').value, ferme_le: $('c-ferme').value, nb_questions: parseInt($('c-nb').value, 10) || 10,
      texte_support: $('c-texte').value, consigne_ecrite: $('c-ecrit').value, copie_photo: !!$('c-photo').checked, questions: etat.questions,
      sections: etat.sections.filter(function (x) { return x.nom.trim(); }).map(function (x) { return { nom: x.nom.trim(), nb: x.nb }; }), roster: liste.map(function (e) { return e.affiche; })
    };
    var b = $('btn-creer'); b.disabled = true; b.textContent = 'Création…';
    appel('', corps).then(function (res) {
      b.disabled = false; b.textContent = 'Lancer la séance';
      if (!res.ok) { msg.textContent = messageErreur(res); return; }
      var code = res.donnees.code, lien = res.donnees.lien;
      etat.code = code;
      if (liste.length) memoriserListe(code, liste);
      $('cree-lien').textContent = lien;
      $('btn-copier').textContent = 'Copier le lien';
      $('btn-copier').onclick = function () { copier(lien, $('btn-copier'), 'Lien copié ✓'); };
      $('btn-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent('Séance de classe EdukaTchat : ' + corps.titre + '. Ouverte du ' + corps.ouvre_le.replace('T', ' à ') + ' au ' + corps.ferme_le.replace('T', ' à ') + '. Lien : ' + lien);
      etat.questions = []; etat.rosterCopie = null;
      ecran('cree');
    });
  }

  function dupliquer(code) {
    ecran('chargement');
    appel('/' + code + '/contenu').then(function (res) {
      if (!res.ok) { erreur('Duplication impossible', messageErreur(res)); return; }
      var d = res.donnees;
      viderFormulaire();
      $('c-titre').value = (d.titre + ' (2)').slice(0, 80); $('c-matiere').value = d.matiere || ''; $('c-classe').value = d.classe || '';
      $('c-chapitre').value = d.chapitre || ''; $('c-mode').value = d.mode; $('c-duree').value = String(d.duree_question);
      $('c-texte').value = d.texte_support || ''; $('c-ecrit').value = d.consigne_ecrite || ''; $('c-photo').checked = !!d.copie_photo;
      etat.sections = (d.sections || []).map(function (x) { return { nom: x.nom, nb: x.nb, prec: x.nom }; });
      etat.questions = d.questions;
      var local = listeLocale(code);
      etat.rosterCopie = local.length ? local : d.roster.map(function (n) { return { matricule: '', nomComplet: n, affiche: n }; });
      if (!etat.rosterCopie.length) etat.rosterCopie = null;
      ouvrirCreation();
      $('c-nb').value = String(Math.min(d.nb_questions, Math.max(etat.questions.length, 5)));
      if (etat.rosterCopie) {
        $('roster-apercu').textContent = 'Liste de classe reprise de la séance précédente : ' + etat.rosterCopie.length + ' élève(s). Vous pouvez coller une autre liste pour la remplacer.';
        $('btn-vider-roster').classList.remove('cache');
      }
      $('creation-msg').textContent = 'Séance copiée : choisissez les nouveaux horaires, modifiez les questions si vous le souhaitez, puis lancez.';
    });
  }

  /* ---------- Liste ---------- */
  function afficherListe() {
    ecran('chargement');
    appel('/mes-seances').then(function (res) {
      if (!res.ok) { erreur('Séances de classe', messageErreur(res)); return; }
      var ul = $('liste-seances'); ul.textContent = '';
      if (!res.donnees.seances.length) ul.appendChild(el('li', 'doux', 'Aucune séance pour le moment.'));
      res.donnees.seances.forEach(function (s) {
        var li = el('li', 'membre');
        li.appendChild(el('span', 'membre-nom', s.titre + ' — ' + [s.matiere, s.classe].filter(Boolean).join(' ')));
        li.appendChild(el('span', 'membre-score', quand(s.ouvre_le) + ' → ' + quand(s.ferme_le)));
        var b = el('button', 'btn-petit', 'Ouvrir'); b.type = 'button';
        b.addEventListener('click', function () { ouvrirTableau(s.code); });
        var b2 = el('button', 'btn-petit', 'Dupliquer'); b2.type = 'button';
        b2.addEventListener('click', function () { dupliquer(s.code); });
        li.appendChild(b); li.appendChild(b2); ul.appendChild(li);
      });
      ecran('liste');
    });
  }

  /* ---------- Tableau ---------- */
  function ouvrirTableau(code) {
    etat.code = code; ecran('chargement');
    appel('/' + code + '/tableau').then(function (res) {
      if (!res.ok) { erreur('Tableau indisponible', messageErreur(res)); return; }
      etat.tableau = res.donnees; dessinerTableau(); ecran('tableau');
    });
  }
  function noteSur20(score, total) { return (score == null || !total) ? '' : (Math.round(score / total * 200) / 10); }
  function virgule(v) { return String(v).replace('.', ','); }
  document.addEventListener('click', function (ev) {
    if (ev.target && ev.target.id === 't-photo-fermer') { $('t-photo-zone').classList.add('cache'); }
  });
  function dessinerTableau() {
    var d = etat.tableau, local = listeLocale(etat.code), parAffiche = {};
    local.forEach(function (l) { parAffiche[l.affiche.toLowerCase()] = l; });
    $('t-titre').textContent = d.titre;
    $('t-etat').textContent = { avenir: 'À venir', ouverte: 'Ouverte', fermee: 'Fermée' }[d.etat] || d.etat;
    $('t-mode').textContent = d.mode === 'examen' ? 'Examen' : 'Devoir';
    $('t-dates').textContent = 'Du ' + quand(d.ouvre_le) + ' au ' + quand(d.ferme_le) + ' · ' + d.nb_questions + ' questions par élève';
    $('t-lien').textContent = d.lien;
    $('t-copier').textContent = 'Copier le lien'; $('t-copier').onclick = function () { copier(d.lien, $('t-copier'), 'Lien copié ✓'); };
    var termines = d.eleves.filter(function (e) { return e.statut === 'termine'; }).length;
    $('t-resume').textContent = d.eleves.length + ' élève(s) ont commencé, ' + termines + ' ont terminé' + (d.moyenne != null ? ' · moyenne ' + virgule(d.moyenne) + ' / ' + d.nb_questions : '') + '.';
    var t = $('t-table'); t.textContent = '';
    var entete = el('tr');
    ['Élève'].concat(local.length ? ['Matricule'] : [], ['État', 'Score', 'Note /20', 'Temps moyen'], d.copie_photo ? ['Copie'] : [], ['']).forEach(function (h) { entete.appendChild(el('th', '', h)); });
    t.appendChild(entete);
    var eleves = d.eleves.slice();
    if (local.length) {
      var ordre = {}; local.forEach(function (l, i) { ordre[l.affiche.toLowerCase()] = i; });
      var rang = function (e) { var o = ordre[e.nom.toLowerCase()]; return o == null ? 9999 : o; };
      eleves.sort(function (a, b) { return rang(a) - rang(b); });
    }
    eleves.forEach(function (e) {
      var tr = el('tr'), l = parAffiche[e.nom.toLowerCase()];
      tr.appendChild(el('td', '', l ? l.nomComplet + ' (' + e.nom + ')' : e.nom));
      if (local.length) tr.appendChild(el('td', '', l ? l.matricule : ''));
      tr.appendChild(el('td', '', e.statut === 'termine' ? 'Terminé' : 'En cours (' + e.repondu + '/' + e.total + ')'));
      tr.appendChild(el('td', '', e.score == null ? '—' : e.score + ' / ' + e.total));
      tr.appendChild(el('td', '', e.score == null ? '—' : virgule(noteSur20(e.score, e.total))));
      tr.appendChild(el('td', '', e.temps_moyen == null ? '—' : virgule(e.temps_moyen) + ' s'));
      if (d.copie_photo) {
        var tdC = el('td'), cp = d.copies && d.copies[e.nom];
        if (cp) {
          var bv = el('button', 'btn-petit', '📷 Voir'); bv.type = 'button';
          bv.title = 'Envoyée le ' + quand(cp.cree_le) + ' · supprimée le ' + quand(cp.expire_le);
          bv.addEventListener('click', function () { voirCopie(cp.id, e.nom, cp); });
          tdC.appendChild(bv);
        } else { tdC.textContent = '—'; }
        tr.appendChild(tdC);
      }
      var tdA = el('td'), b = el('button', 'btn-petit', 'Libérer'); b.type = 'button';
      b.title = 'Efface sa tentative : il pourra recommencer, ou un autre appareil pourra prendre ce nom';
      b.addEventListener('click', function () { if (confirm('Libérer le nom « ' + e.nom + ' » ? Sa tentative sera effacée.')) liberer(e.nom); });
      tdA.appendChild(b); tr.appendChild(tdA); t.appendChild(tr);
    });
    var nCopies = d.copies ? Object.keys(d.copies).length : 0;
    $('t-photo-note').classList.toggle('cache', !d.copie_photo);
    $('t-photo-note').textContent = d.copie_photo ? ('Photos de copies reçues : ' + nCopies + ' · supprimées automatiquement ' + (d.copie_jours || 7) + ' jours après leur envoi (pensez à les corriger ou les enregistrer avant).') : '';
    $('t-photo-zone').classList.add('cache');
    $('t-absents').textContent = d.absents.length
      ? 'Pas encore passés (' + d.absents.length + ') : ' + d.absents.map(function (n) { var l = parAffiche[n.toLowerCase()]; return l ? l.nomComplet : n; }).join(', ') : '';
    var r = $('t-ratees'); r.textContent = '';
    $('t-carte-q').classList.toggle('cache', !d.questions_ratees.length);
    d.questions_ratees.forEach(function (q) {
      var li = el('li', 'membre'); li.appendChild(el('span', 'membre-nom', q.question));
      li.appendChild(el('span', 'membre-score', q.pct_reussite + ' % de réussite (' + q.nb + ' réponses)')); r.appendChild(li);
    });
    var s = $('t-signaux'); s.textContent = '';
    $('t-carte-signaux').classList.toggle('cache', !d.signaux.length);
    d.signaux.forEach(function (x) { s.appendChild(el('li', 'membre', x)); });
    $('t-msg').textContent = '';
  }
  function voirCopie(id, nom, cp) {
    $('t-msg').textContent = '';
    fetch(API + '/' + etat.code + '/copie/' + id + '/voir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricule: etat.sceau }) })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(typeof d.detail === 'string' ? d.detail : 'Photo indisponible.'); });
        return r.blob();
      })
      .then(function (blob) {
        var img = $('t-photo-img');
        if (img.dataset.url) { URL.revokeObjectURL(img.dataset.url); }
        var url = URL.createObjectURL(blob); img.dataset.url = url; img.src = url;
        $('t-photo-titre').textContent = 'Copie de ' + nom + ' · envoyée le ' + quand(cp.cree_le) + ' · supprimée automatiquement le ' + quand(cp.expire_le) + '.';
        $('t-photo-zone').classList.remove('cache');
        $('t-photo-zone').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (e) { $('t-msg').textContent = (e && e.message) || 'Photo indisponible.'; });
  }
  function liberer(nom) {
    appel('/' + etat.code + '/liberer', { nom: nom }).then(function (res) {
      if (!res.ok) { $('t-msg').textContent = messageErreur(res); return; }
      ouvrirTableau(etat.code);
    });
  }
  function csvCellule(v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exporter() {
    var d = etat.tableau, local = listeLocale(etat.code), parAffiche = {}, vus = {}, parNom = {};
    local.forEach(function (l) { parAffiche[l.affiche.toLowerCase()] = l; });
    d.eleves.forEach(function (e) { parNom[e.nom.toLowerCase()] = e; });
    var lignes = [['Matricule', 'Nom complet', 'Nom affiché', 'État', 'Score', 'Total', 'Note /20']];
    function ajouter(affiche, e) {
      var l = parAffiche[affiche.toLowerCase()]; vus[affiche.toLowerCase()] = true;
      lignes.push([l ? l.matricule : '', l ? l.nomComplet : affiche, affiche,
        e ? (e.statut === 'termine' ? 'Terminé' : 'En cours') : 'Absent', e && e.score != null ? e.score : '', e ? e.total : d.nb_questions,
        e && e.score != null ? virgule(noteSur20(e.score, e.total)) : '']);
    }
    local.forEach(function (l) { ajouter(l.affiche, parNom[l.affiche.toLowerCase()]); });
    d.eleves.forEach(function (e) { if (!vus[e.nom.toLowerCase()]) ajouter(e.nom, e); });
    var csv = '﻿' + lignes.map(function (l) { return l.map(csvCellule).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var a = el('a'); a.href = url; a.download = 'resultats-' + etat.code + '.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function associerListe() {
    var l = analyserListe($('t-roster').value);
    if (!l.length) { $('t-roster-msg').textContent = 'Collez d’abord votre liste.'; return; }
    memoriserListe(etat.code, l);
    $('t-roster-msg').textContent = l.length + ' élèves enregistrés sur cet appareil.';
    dessinerTableau();
  }

  /* ---------- Démarrage ---------- */
  function init() {
    etat.sceau = lire('eduka_sceau_enseignant') || lire('eduka_sceau');
    if (!etat.sceau) {
      erreur('Réservé aux enseignants', 'Connectez-vous d’abord à l’Espace Enseignants d’EdukaTchat avec votre code ENS-, puis revenez sur cette page.');
      return;
    }
    $('btn-retour-app').addEventListener('click', function (e) {
      try { if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); } } catch (err) { /* lien normal */ }
    });
    $('btn-nouvelle').addEventListener('click', function () { viderFormulaire(); ouvrirCreation(); });
    $('btn-vider-roster').addEventListener('click', function () { etat.rosterCopie = null; $('roster-apercu').textContent = ''; $('btn-vider-roster').classList.add('cache'); });
    $('t-dupliquer').addEventListener('click', function () { dupliquer(etat.code); });
    $('btn-annuler').addEventListener('click', afficherListe);
    $('btn-generer').addEventListener('click', generer);
    $('btn-ajouter-section').addEventListener('click', function () {
      if (etat.sections.length >= 6) return;
      etat.sections.push({ nom: '', nb: 3, prec: '' }); dessinerSections(); dessinerQuestions();
    });
    $('btn-ajouter-q').addEventListener('click', function () {
      if (etat.questions.length >= 40) return;
      etat.questions.push({ question: '', options: ['', '', '', ''], bonne: 0, explication: '', source: 'enseignant' }); dessinerQuestions();
    });
    $('c-roster').addEventListener('input', apercuListe);
    $('btn-creer').addEventListener('click', creer);
    $('btn-voir-tableau').addEventListener('click', function () { ouvrirTableau(etat.code); });
    $('btn-retour-liste').addEventListener('click', afficherListe);
    $('t-actualiser').addEventListener('click', function () { ouvrirTableau(etat.code); });
    $('t-export').addEventListener('click', exporter);
    $('t-roster-ok').addEventListener('click', associerListe);
    $('t-retirer').addEventListener('click', function () {
      if (!confirm('Retirer définitivement cette séance et ses résultats ?')) return;
      appel('/' + etat.code + '/retirer').then(function (res) { if (!res.ok) { $('t-msg').textContent = messageErreur(res); return; } afficherListe(); });
    });
    afficherListe();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
