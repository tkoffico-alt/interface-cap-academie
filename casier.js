/* Mon casier — fiches et devoirs rangés par l'élève. Tout texte venant du serveur est inséré avec textContent. */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api/casier';
  var etat = { sceau: '', fiches: [], courante: null, maximum: 60 };

  function $(id) { return document.getElementById(id); }
  function lire(c) { try { return localStorage.getItem(c) || ''; } catch (e) { return ''; } }
  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }
  function ecran(nom) {
    ['chargement', 'erreur', 'liste', 'fiche'].forEach(function (n) { $('ecran-' + n).classList.toggle('cache', n !== nom); });
    window.scrollTo(0, 0);
  }
  function erreur(titre, texte) { $('erreur-titre').textContent = titre; $('erreur-texte').textContent = texte; ecran('erreur'); }
  function appel(chemin, corps) {
    var complet = Object.assign({ matricule: etat.sceau }, corps || {});
    return fetch(API + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(complet) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, statut: r.status, donnees: d }; });
    }).catch(function () { return { ok: false, statut: 0, donnees: {} }; });
  }
  function messageErreur(res) {
    if (res.statut === 0) return 'Connexion impossible. Vérifie ta connexion et réessaie.';
    if (res.statut === 403) return 'Code d’accès invalide. Ouvre EdukaTchat, entre ton code (ELV-…) puis reviens ici.';
    if (res.statut === 429) return 'Trop de demandes. Réessaie dans une minute.';
    var d = res.donnees && res.donnees.detail;
    return typeof d === 'string' ? d : 'Une erreur est survenue. Réessaie.';
  }
  function dateCourte(s) { return String(s || '').slice(0, 10).split('-').reverse().join('/'); }

  /* ---------- Rendu Markdown sûr (DOM, jamais innerHTML) ---------- */
  function inline(parent, texte) {
    var morceaux = texte.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
    morceaux.forEach(function (m) {
      if (!m) return;
      if (/^\*\*[^*]+\*\*$/.test(m)) parent.appendChild(el('strong', '', m.slice(2, -2)));
      else if (/^\*[^*]+\*$/.test(m)) parent.appendChild(el('em', '', m.slice(1, -1)));
      else parent.appendChild(document.createTextNode(m));
    });
  }
  function cellules(ligne) { return ligne.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); }); }
  function rendre(markdown, conteneur) {
    conteneur.textContent = '';
    var lignes = String(markdown || '').replace(/\\\[([\s\S]*?)\\\]/g, function (m, x) { return '\\[' + x.replace(/\s+/g, ' ').trim() + '\\]'; }).split('\n');
    var i = 0, liste = null, typeListe = '';
    function fermerListe() { liste = null; typeListe = ''; }
    while (i < lignes.length) {
      var l = lignes[i], t = l.trim();
      if (!t) { fermerListe(); i++; continue; }
      if (t.indexOf('```') === 0) {
        fermerListe(); var bloc = el('div', 'carte-devoir'); i++;
        bloc.style.cssText = 'background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:12px 14px;margin:10px 0;';
        while (i < lignes.length && lignes[i].trim().indexOf('```') !== 0) { var d = el('div', '', lignes[i] || ' '); d.style.whiteSpace = 'pre-wrap'; bloc.appendChild(d); i++; }
        i++; conteneur.appendChild(bloc); continue;
      }
      var m;
      if ((m = /^(#{1,4})\s+(.*)$/.exec(t))) { fermerListe(); var h = el('h' + Math.min(m[1].length + 1, 4)); inline(h, m[2]); conteneur.appendChild(h); i++; continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { fermerListe(); conteneur.appendChild(el('hr')); i++; continue; }
      if (t.charAt(0) === '|' && i + 1 < lignes.length && /^\s*\|?[\s:\-|]+\|?\s*$/.test(lignes[i + 1]) && lignes[i + 1].indexOf('-') >= 0) {
        fermerListe();
        var table = el('table', 'tableau-suivi'), tete = el('tr');
        cellules(t).forEach(function (c) { var th = el('th'); inline(th, c); tete.appendChild(th); });
        table.appendChild(tete); i += 2;
        while (i < lignes.length && lignes[i].trim().charAt(0) === '|') {
          var tr = el('tr'); cellules(lignes[i].trim()).forEach(function (c) { var td = el('td'); inline(td, c); tr.appendChild(td); });
          table.appendChild(tr); i++;
        }
        var enveloppe = el('div', 'tableau-defil'); enveloppe.appendChild(table); conteneur.appendChild(enveloppe); continue;
      }
      if ((m = /^([-*•])\s+(.*)$/.exec(t)) || (m = /^(\d+)[.)]\s+(.*)$/.exec(t))) {
        var ordonnee = /\d/.test(m[1]);
        if (!liste || typeListe !== (ordonnee ? 'ol' : 'ul')) { typeListe = ordonnee ? 'ol' : 'ul'; liste = el(typeListe); conteneur.appendChild(liste); }
        var li = el('li'); inline(li, m[2]); liste.appendChild(li); i++; continue;
      }
      fermerListe();
      var p = el('p'); inline(p, t); conteneur.appendChild(p); i++;
    }
  }

  /* ---------- Formules mathématiques (KaTeX) ---------- */
  var katexPret = null;
  function chargerKatex(suite) {
    if (window.renderMathInElement) { suite(); return; }
    if (katexPret) { katexPret.push(suite); return; }
    katexPret = [suite];
    var base = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/';
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'katex.min.css'; document.head.appendChild(css);
    var s1 = document.createElement('script'); s1.src = base + 'katex.min.js';
    s1.onload = function () {
      var s2 = document.createElement('script'); s2.src = base + 'contrib/auto-render.min.js';
      s2.onload = function () { var l = katexPret; katexPret = null; l.forEach(function (f) { f(); }); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  }
  function formules(zone) {
    if (!/\\\(|\\\[|\$\$/.test(zone.textContent)) return;
    chargerKatex(function () {
      try { window.renderMathInElement(zone, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false }); } catch (e) { /* texte brut conservé */ }
    });
  }

  /* ---------- Liste ---------- */
  function ligne(titre, info, texteBouton, action) {
    var li = el('li', 'tache');
    var corps = el('div', 'tache-corps');
    corps.appendChild(el('div', 'tache-nom', titre));
    if (info) corps.appendChild(el('div', 'tache-info', info));
    li.appendChild(corps);
    var b = el('button', 'btn-petit', texteBouton); b.type = 'button';
    b.addEventListener('click', action);
    li.appendChild(b);
    return li;
  }
  function afficherListe(donnees) {
    var attente = donnees.devoirs_en_attente || [];
    $('bloc-afaire').classList.toggle('cache', !attente.length);
    var ua = $('liste-afaire'); ua.textContent = '';
    attente.forEach(function (d) {
      ua.appendChild(ligne('Devoir de ' + d.matiere, d.date ? 'donné le ' + dateCourte(d.date) : '', 'Ouvrir', function () { ouvrir({ devoir_matiere: d.matiere }); }));
    });
    var ul = $('liste-fiches'); ul.textContent = '';
    etat.fiches.forEach(function (f) {
      var type = f.source === 'devoir' ? '📝 Devoir' : '📄 Fiche';
      var infos = [type, f.matiere, dateCourte(f.date)].filter(Boolean).join(' · ');
      ul.appendChild(ligne(f.titre, infos, 'Ouvrir', function () { ouvrir({ id: f.id }); }));
    });
    $('liste-vide').classList.toggle('cache', etat.fiches.length > 0);
    $('liste-compteur').textContent = etat.fiches.length ? (etat.fiches.length + ' rangé(s) sur ' + etat.maximum + ' possibles.') : '';
    ecran('liste');
  }
  function chargerListe() {
    ecran('chargement');
    appel('/liste').then(function (res) {
      if (!res.ok) { erreur('Casier indisponible', messageErreur(res)); return; }
      etat.fiches = res.donnees.fiches || []; etat.maximum = res.donnees.maximum || 60;
      afficherListe(res.donnees);
    });
  }

  /* ---------- Fiche ---------- */
  function ouvrir(corps) {
    ecran('chargement');
    appel('/lire', corps).then(function (res) {
      if (!res.ok) { erreur('Introuvable', messageErreur(res)); return; }
      var f = res.donnees; etat.courante = { id: corps.id, contenu: f.contenu, enAttente: !!corps.devoir_matiere };
      $('fiche-titre').textContent = f.titre;
      $('fiche-meta').textContent = [f.source === 'devoir_en_attente' ? 'Devoir à faire' : (f.source === 'devoir' ? 'Devoir' : 'Fiche'), f.matiere, f.date ? dateCourte(f.date) : ''].filter(Boolean).join(' · ');
      rendre(f.contenu, $('fiche-corps'));
      formules($('fiche-corps'));
      $('btn-supprimer').classList.toggle('cache', etat.courante.enAttente);
      preparerPartage(f.source === 'fiche');
      $('fiche-msg').textContent = '';
      ecran('fiche');
    });
  }
  function copier() {
    var f = etat.courante; if (!f) return;
    var texte = f.contenu + '\n\n© EdukaTchat™ - Propriété Intellectuelle Exclusive';
    var ok = function () { $('fiche-msg').textContent = 'Texte copié ✓'; };
    var ko = function () { $('fiche-msg').textContent = 'Copie impossible : sélectionne le texte à la main.'; };
    try { navigator.clipboard.writeText(texte).then(ok, ko); } catch (e) { ko(); }
  }
  function supprimer() {
    var f = etat.courante;
    if (!f || f.enAttente || !window.confirm('Retirer cet élément de ton casier ?')) return;
    appel('/supprimer', { id: f.id }).then(function (res) {
      if (!res.ok) { $('fiche-msg').textContent = messageErreur(res); return; }
      etat.courante = null; chargerListe();
    });
  }

  /* ---------- Partage dans une salle d'étude (salles mémorisées sur cet appareil) ---------- */
  function sallesMemorisees() {
    try { var l = JSON.parse(lire('eduka_salles') || '[]'); return Array.isArray(l) ? l.filter(function (x) { return x && x.code; }) : []; } catch (e) { return []; }
  }
  function preparerPartage(estFiche) {
    var zone = $('zone-partage'), aide = $('p-aide');
    zone.classList.add('cache'); aide.classList.add('cache');
    if (!estFiche) return;
    var salles = sallesMemorisees();
    if (!salles.length) { aide.classList.remove('cache'); return; }
    var sel = $('p-salle'); sel.textContent = '';
    salles.forEach(function (s) { var o = el('option', '', s.titre || s.code); o.value = s.code; sel.appendChild(o); });
    zone.classList.remove('cache');
  }
  function partagerSalle() {
    var f = etat.courante; var msg = $('fiche-msg'); msg.textContent = '';
    var code = $('p-salle').value;
    if (!f || !f.id || !code) return;
    fetch('https://api.edukatchat.org/api/salles/' + encodeURIComponent(code) + '/fiche/partager', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricule: etat.sceau, appareil: lire('eduka_appareil_defi'), id: f.id })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        msg.textContent = r.ok ? 'Fiche partagée dans la salle ✓' : (typeof d.detail === 'string' ? d.detail : 'Partage impossible pour le moment.');
      });
    }).catch(function () { msg.textContent = 'Connexion impossible. Réessaie dans un instant.'; });
  }

  function demarrer() {
    var retour = $('btn-retour-app');
    try { if (document.referrer && new URL(document.referrer).origin === location.origin) retour.addEventListener('click', function (e) { e.preventDefault(); history.back(); }); } catch (e) {}
    etat.sceau = lire('eduka_sceau');
    if (!etat.sceau || etat.sceau.indexOf('ELV-') !== 0) { erreur('🔒 Mon casier : réservé aux abonnés Premium', 'Avec l’abonnement Premium élève, tu ranges ici tes fiches et tes devoirs corrigés pour les retrouver quand tu veux. Ouvre EdukaTchat, entre ton code d’accès élève (ELV-…), puis reviens ici.'); return; }
    $('btn-retour-liste').addEventListener('click', chargerListe);
    $('btn-copier').addEventListener('click', copier);
    $('btn-imprimer').addEventListener('click', function () { window.print(); });
    $('btn-supprimer').addEventListener('click', supprimer);
    $('btn-partager-salle').addEventListener('click', partagerSalle);
    chargerListe();
  }
  document.addEventListener('DOMContentLoaded', demarrer);
})();
