/* Ma bibliothèque — fiches enregistrées par l'enseignant. Tout texte venant du serveur est inséré avec textContent. */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api/bibliotheque';
  var etat = { sceau: '', fiches: [], courante: null };
  var NOMS_OUTILS = { atelier: 'Atelier des Évaluations', forge: 'Forge des Leçons', cabinet: 'Cabinet d’Étude', forge_primaire: 'Forge (primaire)', cabinet_primaire: 'Cabinet (primaire)' };

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
    if (res.statut === 0) return 'Connexion impossible. Vérifiez votre connexion et réessayez.';
    if (res.statut === 404) return 'Cette fonction n’est pas disponible pour votre code pour le moment.';
    if (res.statut === 429) return 'Trop de demandes. Réessayez dans une minute.';
    var d = res.donnees && res.donnees.detail;
    return typeof d === 'string' ? d : 'Une erreur est survenue. Réessayez.';
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
    var lignes = String(markdown || '').split('\n');
    var i = 0, liste = null, typeListe = '';
    function fermerListe() { liste = null; typeListe = ''; }
    while (i < lignes.length) {
      var l = lignes[i], t = l.trim();
      if (!t) { fermerListe(); i++; continue; }
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

  /* ---------- Fiche avec sa mise en page d'origine (HTML nettoyé, isolé dans un Shadow DOM) ---------- */
  var BALISES_INTERDITES = /^(script|style|link|meta|base|iframe|object|embed|form|input|textarea|select|button|frame|frameset|applet|template|noscript)$/i;
  function urlSure(v, cible) {
    v = String(v || '').trim();
    if (cible === 'href') return /^(https?:|mailto:|#)/i.test(v);
    return /^(https:|data:image\/(png|jpe?g|gif|webp|svg\+xml);|\/|\.\/|[a-z0-9_\-]+\/|#)/i.test(v) || /^[a-z0-9_\-.]+\.(png|jpe?g|gif|webp|svg)$/i.test(v);
  }
  function assainir(html) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    var aSupprimer = [];
    doc.body.querySelectorAll('*').forEach(function (n) {
      if (BALISES_INTERDITES.test(n.localName)) { aSupprimer.push(n); return; }
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nom = a.name.toLowerCase();
        if (nom.indexOf('on') === 0) { n.removeAttribute(a.name); return; }
        if (nom === 'href' || nom === 'xlink:href') { if (!urlSure(a.value, 'href')) n.removeAttribute(a.name); return; }
        if (nom === 'src' || nom === 'srcset' || nom === 'poster' || nom === 'action' || nom === 'formaction') { if (nom !== 'src' || !urlSure(a.value, 'src')) n.removeAttribute(a.name); return; }
        if (nom === 'style' && /expression\s*\(|javascript:|@import/i.test(a.value)) n.removeAttribute(a.name);
      });
    });
    aSupprimer.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    return doc.body;
  }
  function rendreHtml(html, conteneur) {
    conteneur.textContent = '';
    var hote = el('div', 'fiche-html-hote');
    conteneur.appendChild(hote);
    var ombre = hote.attachShadow({ mode: 'open' });
    ['https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css', 'style.css?v=lib'].forEach(function (href) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; ombre.appendChild(l);
    });
    var st = document.createElement('style');
    st.textContent = ':host{display:block} .fiche-zone{background:#fff;color:#0F172A;padding:14px;border-radius:12px;overflow-wrap:anywhere;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.55} .fiche-zone img,.fiche-zone svg{max-width:100%;height:auto} .fiche-zone .bot-message{background:transparent;box-shadow:none;border:0;padding:0;margin:0;max-width:none;width:auto} .fiche-zone>p,.fiche-zone .bot-message>p{margin:0 0 .7em} .fiche-zone>ul,.fiche-zone>ol,.fiche-zone .bot-message>ul,.fiche-zone .bot-message>ol{margin:0 0 .7em;padding-left:1.4em}';
    ombre.appendChild(st);
    var zone = document.createElement('div'); zone.className = 'fiche-zone';
    var corps = assainir(html);
    while (corps.firstChild) zone.appendChild(corps.firstChild);
    ombre.appendChild(zone);
  }

  /* ---------- Liste ---------- */
  function remplirFiltre() {
    var sel = $('filtre-matiere'), courant = sel.value, vues = {};
    sel.textContent = ''; sel.appendChild(el('option', '', 'Toutes les matières')).value = '';
    etat.fiches.forEach(function (f) { if (f.matiere && !vues[f.matiere]) { vues[f.matiere] = 1; var o = el('option', '', f.matiere); o.value = f.matiere; sel.appendChild(o); } });
    sel.value = vues[courant] ? courant : '';
  }
  function afficherListe() {
    var filtre = $('filtre-matiere').value, ul = $('liste-fiches');
    ul.textContent = '';
    var visibles = etat.fiches.filter(function (f) { return !filtre || f.matiere === filtre; });
    $('liste-vide').classList.toggle('cache', etat.fiches.length > 0);
    visibles.forEach(function (f) {
      var li = el('li', 'tache');
      var corps = el('div', 'tache-corps');
      corps.appendChild(el('div', 'tache-nom', f.titre));
      var infos = [NOMS_OUTILS[f.outil] || f.outil, f.matiere, f.classe, dateCourte(f.cree_le)].filter(Boolean).join(' · ');
      corps.appendChild(el('div', 'tache-info', infos));
      li.appendChild(corps);
      var b = el('button', 'btn-petit', 'Ouvrir'); b.type = 'button';
      b.addEventListener('click', function () { ouvrirFiche(f.id); });
      li.appendChild(b); ul.appendChild(li);
    });
    $('liste-compteur').textContent = etat.fiches.length ? (etat.fiches.length + ' fiche(s) enregistrée(s) sur ' + etat.maximum + ' possibles.') : '';
    ecran('liste');
  }
  function chargerListe() {
    ecran('chargement');
    appel('/liste').then(function (res) {
      if (!res.ok) { erreur('Bibliothèque indisponible', messageErreur(res)); return; }
      etat.fiches = res.donnees.fiches || []; etat.maximum = res.donnees.maximum || 150;
      remplirFiltre(); afficherListe();
    });
  }

  /* ---------- Fiche ---------- */
  function ouvrirFiche(id) {
    ecran('chargement');
    appel('/lire', { id: id }).then(function (res) {
      if (!res.ok) { erreur('Fiche introuvable', messageErreur(res)); return; }
      var f = res.donnees.fiche; etat.courante = f;
      $('fiche-titre').textContent = f.titre;
      $('fiche-meta').textContent = [NOMS_OUTILS[f.outil] || f.outil, f.matiere, f.classe, 'enregistrée le ' + dateCourte(f.cree_le)].filter(Boolean).join(' · ');
      if (f.contenu_html) rendreHtml(f.contenu_html, $('fiche-corps')); else rendre(f.contenu, $('fiche-corps'));
      $('zone-renommer').classList.add('cache'); $('fiche-msg').textContent = '';
      ecran('fiche');
    });
  }
  function copier() {
    var f = etat.courante; if (!f) return;
    var texte = f.contenu + '\n\n© EdukaTchat™ - Propriété Intellectuelle Exclusive';
    var ok = function () { $('fiche-msg').textContent = 'Texte copié ✓'; };
    var ko = function () { $('fiche-msg').textContent = 'Copie impossible : sélectionnez le texte à la main.'; };
    try { navigator.clipboard.writeText(texte).then(ok, ko); } catch (e) { ko(); }
  }
  function renommer() {
    var f = etat.courante;
    appel('/renommer', { id: f.id, titre: $('r-titre').value, matiere: $('r-matiere').value, classe: $('r-classe').value }).then(function (res) {
      if (!res.ok) { $('fiche-msg').textContent = messageErreur(res); return; }
      ouvrirFiche(f.id);
    });
  }
  function supprimer() {
    var f = etat.courante;
    if (!f || !window.confirm('Supprimer définitivement cette fiche de votre bibliothèque ?')) return;
    appel('/supprimer', { id: f.id }).then(function (res) {
      if (!res.ok) { $('fiche-msg').textContent = messageErreur(res); return; }
      etat.courante = null; chargerListe();
    });
  }

  function demarrer() {
    var retour = $('btn-retour-app');
    try { if (document.referrer && new URL(document.referrer).origin === location.origin) retour.addEventListener('click', function (e) { e.preventDefault(); history.back(); }); } catch (e) {}
    etat.sceau = lire('eduka_sceau_enseignant') || lire('eduka_sceau');
    if (!etat.sceau) { erreur('Code enseignant nécessaire', 'Ouvrez EdukaTchat, entrez votre code d’accès enseignant (ENS-…), puis revenez ici.'); return; }
    $('filtre-matiere').addEventListener('change', afficherListe);
    $('btn-retour-liste').addEventListener('click', chargerListe);
    $('btn-copier').addEventListener('click', copier);
    $('btn-imprimer').addEventListener('click', function () { window.print(); });
    $('btn-renommer').addEventListener('click', function () {
      var f = etat.courante; $('r-titre').value = f.titre; $('r-matiere').value = f.matiere || ''; $('r-classe').value = f.classe || '';
      $('zone-renommer').classList.toggle('cache');
    });
    $('btn-valider-renommer').addEventListener('click', renommer);
    $('btn-supprimer').addEventListener('click', supprimer);
    chargerListe();
  }
  document.addEventListener('DOMContentLoaded', demarrer);
})();
