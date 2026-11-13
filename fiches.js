/* Page publique « Fiches et schémas par chapitre » — lecture seule, aucune donnée d'élève. */
(function () {
  'use strict';
  var API = 'https://api.edukatchat.org/api';

  var MATIERES = [
    { cle: 'maths', nom: 'Mathématiques', icone: '📐', sets: ['maths'] },
    { cle: 'physique', nom: 'Physique-Chimie', icone: '⚗️', sets: ['physique', 'chimie', 'physique-chimie'] },
    { cle: 'svt', nom: 'SVT', icone: '🌿', sets: ['svt'] },
    { cle: 'histoire', nom: 'Histoire', icone: '🏛️', sets: ['histoire'] },
    { cle: 'geographie', nom: 'Géographie', icone: '🌍', sets: ['geographie'] },
    { cle: 'francais', nom: 'Français', icone: '📖', sets: ['francais'] },
    { cle: 'philosophie', nom: 'Philosophie', icone: '💭', sets: ['philosophie'] },
    { cle: 'anglais', nom: 'Anglais', icone: '🇬🇧', sets: ['anglais'] },
    { cle: 'espagnol', nom: 'Espagnol', icone: '🇪🇸', sets: ['espagnol'] },
    { cle: 'allemand', nom: 'Allemand', icone: '🇩🇪', sets: ['allemand'] },
    { cle: 'edhc', nom: 'EDHC', icone: '⚖️', sets: ['edhc'] },
    { cle: 'tice', nom: 'TICE', icone: '💻', sets: ['tice'] },
    { cle: 'arts', nom: 'Arts plastiques', icone: '🎨', sets: ['arts_plastiques'] },
    { cle: 'musique', nom: 'Musique', icone: '🎵', sets: ['musique'] }
  ];
  var NIVEAUX = [
    ['6e', '6ème'], ['5e', '5ème'], ['4e', '4ème'], ['3e', '3ème'],
    ['2nde', 'Seconde'], ['1ere', 'Première'], ['terminale', 'Terminale']
  ];
  // Matières du collège dont les schémas attendent encore la relecture d'un enseignant.
  var A_RELIRE = { maths: ['6e', '5e', '4e', '3e'], histoire: ['6e', '5e', '4e', '3e'], geographie: ['6e', '5e', '4e', '3e'] };

  var images = [], formules = [];
  var etat = { matiere: '', niveau: '', chapitre: '' };
  var zone = document.getElementById('f-contenu');
  var chemin = document.getElementById('f-chemin');

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cleTexte(t) { return String(t || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); }
  function nomMatiere(cle) { for (var i = 0; i < MATIERES.length; i++) if (MATIERES[i].cle === cle) return MATIERES[i]; return null; }
  function nomNiveau(cle) { for (var i = 0; i < NIVEAUX.length; i++) if (NIVEAUX[i][0] === cle) return NIVEAUX[i][1]; return cle; }

  function imagesDe(m, niveau) {
    var def = nomMatiere(m);
    if (!def) return [];
    var vus = {}, res = [];
    images.forEach(function (im) {
      if (def.sets.indexOf(im.matiere) < 0) return;
      if (niveau && im.niveau !== niveau) return;
      if (vus[im.fichier]) return;
      vus[im.fichier] = 1;
      res.push(im);
    });
    return res;
  }
  function formulesDe(m, niveau) {
    var def = nomMatiere(m);
    return formules.filter(function (f) { return def && def.sets.indexOf(f.matiere) >= 0 && f.niveau === niveau; });
  }
  function aRelire(m, niveau) { return (A_RELIRE[m] || []).indexOf(niveau) >= 0; }

  function ecrireHash() {
    var h = [etat.matiere, etat.niveau, etat.chapitre ? encodeURIComponent(etat.chapitre) : ''].filter(Boolean).join('/');
    try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) {}
  }
  function lireHash() {
    var p = (location.hash || '').replace(/^#/, '').split('/');
    etat.matiere = nomMatiere(p[0]) ? p[0] : '';
    etat.niveau = etat.matiere && NIVEAUX.some(function (n) { return n[0] === p[1]; }) ? p[1] : '';
    etat.chapitre = etat.niveau && p[2] ? decodeURIComponent(p[2]) : '';
  }
  function aller(m, n, c) { etat.matiere = m || ''; etat.niveau = n || ''; etat.chapitre = c || ''; ecrireHash(); afficher(); window.scrollTo(0, 0); }

  function chapitresDe(m, niveau) {
    var groupes = {}, ordre = [];
    imagesDe(m, niveau).forEach(function (im) {
      var nom = (im.theme || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim() || 'Autres schémas';
      var k = cleTexte(nom);
      if (!groupes[k]) { groupes[k] = { nom: nom, images: [] }; ordre.push(k); }
      groupes[k].images.push(im);
    });
    return ordre.map(function (k) { return groupes[k]; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
  }

  function afficherChemin() {
    var h = '<a href="#" data-aller="">Matières</a>';
    if (etat.matiere) h += ' › <a href="#" data-aller="' + etat.matiere + '">' + esc(nomMatiere(etat.matiere).nom) + '</a>';
    if (etat.niveau) h += ' › <a href="#" data-aller="' + etat.matiere + '/' + etat.niveau + '">' + esc(nomNiveau(etat.niveau)) + '</a>';
    if (etat.chapitre) h += ' › <span class="doux">' + esc(etat.chapitre) + '</span>';
    chemin.innerHTML = h;
  }

  function afficher() {
    afficherChemin();
    if (!etat.matiere) {
      zone.innerHTML = '<div class="f-grille">' + MATIERES.map(function (m) {
        var n = imagesDe(m.cle, '').length;
        return '<button type="button" class="f-choix" data-matiere="' + m.cle + '"' + (n ? '' : ' disabled') + '><span aria-hidden="true" style="font-size:1.5rem">' + m.icone + '</span>' +
          esc(m.nom) + '<small>' + (n ? n + ' schéma' + (n > 1 ? 's' : '') : 'bientôt') + '</small></button>';
      }).join('') + '</div>';
      return;
    }
    if (!etat.niveau) {
      zone.innerHTML = '<h2>' + esc(nomMatiere(etat.matiere).nom) + ' — quel niveau ?</h2><div class="f-grille">' + NIVEAUX.map(function (n) {
        var k = imagesDe(etat.matiere, n[0]).length;
        return '<button type="button" class="f-choix" data-niveau="' + n[0] + '"' + (k ? '' : ' disabled') + '>' + n[1] +
          '<small>' + (k ? k + ' schéma' + (k > 1 ? 's' : '') : 'bientôt disponible') + '</small></button>';
      }).join('') + '</div>';
      return;
    }
    var chapitres = chapitresDe(etat.matiere, etat.niveau);
    if (!etat.chapitre) {
      var h = '<h2>' + esc(nomMatiere(etat.matiere).nom) + ' — ' + esc(nomNiveau(etat.niveau)) + '</h2>';
      if (aRelire(etat.matiere, etat.niveau)) h += '<span class="f-relecture">En cours de relecture par un enseignant</span>';
      var fs = formulesDe(etat.matiere, etat.niveau);
      if (fs.length) {
        h += '<h3 style="margin-top:16px;">Fiches-formules</h3>' + fs.map(function (f, i) {
          return '<details class="f-formule"><summary>' + esc(f.titre || f.chapitre) + '</summary><pre>' + esc(f.contenu) + '</pre>' +
            '<button type="button" class="btn btn-sec" data-copier="' + i + '" style="margin-top:0;margin-bottom:10px;">Copier le texte</button></details>';
        }).join('');
      }
      h += '<h3 style="margin-top:16px;">Chapitres</h3>';
      if (!chapitres.length) h += '<p class="doux">Pas encore de schémas pour ce niveau : bientôt disponible.</p>';
      else h += '<ul class="liste">' + chapitres.map(function (c, i) {
        return '<li><button type="button" class="f-chapitre" data-chapitre="' + i + '"><span>' + esc(c.nom) + '</span><span>' + c.images.length + ' schéma' + (c.images.length > 1 ? 's' : '') + '</span></button></li>';
      }).join('') + '</ul>';
      zone.innerHTML = h;
      zone._formules = fs; zone._chapitres = chapitres;
      return;
    }
    var cle = cleTexte(etat.chapitre);
    var ch = chapitres.filter(function (c) { return cleTexte(c.nom) === cle; })[0];
    if (!ch) { aller(etat.matiere, etat.niveau, ''); return; }
    zone.innerHTML = '<h2>' + esc(ch.nom) + '</h2>' +
      (aRelire(etat.matiere, etat.niveau) ? '<span class="f-relecture">En cours de relecture par un enseignant</span>' : '') +
      '<div class="f-grille f-grille-img">' + ch.images.map(function (im, i) {
        var leg = im.legende || im.fiche || im.theme || 'Schéma';
        return '<figure class="f-vignette" tabindex="0" role="button" data-image="' + i + '" aria-label="Agrandir : ' + esc(leg) + '">' +
          '<img loading="lazy" src="' + esc(im.url) + '" alt="' + esc(leg) + '"><figcaption>' + esc(leg) + '</figcaption></figure>';
      }).join('') + '</div>';
    zone._images = ch.images;
  }

  /* Agrandissement */
  var boite = document.getElementById('f-boite');
  var courante = null;
  function ouvrir(im) {
    courante = im;
    document.getElementById('f-boite-msg').style.display = 'none';
    document.getElementById('f-boite-img').src = im.url;
    document.getElementById('f-boite-img').alt = im.legende || '';
    document.getElementById('f-boite-legende').textContent = im.legende || im.fiche || '';
    boite.classList.add('ouverte');
    document.getElementById('f-fermer').focus();
  }
  function fermer() { boite.classList.remove('ouverte'); }
  /* « Demander à l'assistant » : réservé aux abonnés Premium élèves (code ELV-). Le serveur revérifie le code à l'envoi. */
  var AVATAR = { physique: 'physique', chimie: 'physique', 'physique-chimie': 'physique', histoire: 'histoire_geo', geographie: 'histoire_geo', arts_plastiques: 'arts_plastiques' };
  document.getElementById('f-assistant').addEventListener('click', function () {
    var msg = document.getElementById('f-boite-msg');
    var sceau = '';
    try { sceau = localStorage.getItem('eduka_sceau') || ''; } catch (e) {}
    if (!courante) return;
    if (!sceau || sceau.indexOf('ENS-') === 0) {
      msg.innerHTML = '🔒 Cette fonction est réservée aux abonnés Premium. <a href="https://edukatchat.org/">Découvrir l\'abonnement</a>';
      msg.style.display = 'block';
      return;
    }
    try {
      var titre = courante.fiche || courante.legende || courante.theme || 'ce schéma';
      localStorage.setItem('eduka_schema', JSON.stringify({
        matiere: AVATAR[courante.matiere] || courante.matiere,
        niveau: nomNiveau(courante.niveau),
        titre: String(titre).slice(0, 120),
        t: Date.now()
      }));
      window.location.href = 'index.html?schema=1';
    } catch (e) {
      msg.textContent = 'Impossible d\'ouvrir l\'assistant sur cet appareil.';
      msg.style.display = 'block';
    }
  });
  document.getElementById('f-fermer').addEventListener('click', fermer);
  boite.addEventListener('click', function (e) { if (e.target === boite) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  document.getElementById('f-imprimer').addEventListener('click', function () {
    document.body.classList.add('f-impression');
    window.print();
    setTimeout(function () { document.body.classList.remove('f-impression'); }, 500);
  });

  /* Clics */
  chemin.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-aller]');
    if (!a) return;
    e.preventDefault();
    var p = a.getAttribute('data-aller').split('/');
    aller(p[0], p[1], '');
  });
  zone.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-matiere]'))) return aller(b.getAttribute('data-matiere'), '', '');
    if ((b = e.target.closest('[data-niveau]'))) return aller(etat.matiere, b.getAttribute('data-niveau'), '');
    if ((b = e.target.closest('[data-chapitre]'))) return aller(etat.matiere, etat.niveau, zone._chapitres[+b.getAttribute('data-chapitre')].nom);
    if ((b = e.target.closest('[data-image]'))) return ouvrir(zone._images[+b.getAttribute('data-image')]);
    if ((b = e.target.closest('[data-copier]'))) {
      var f = zone._formules[+b.getAttribute('data-copier')];
      try { navigator.clipboard.writeText(f.contenu); b.textContent = 'Copié ✓'; } catch (err) { b.textContent = 'Copie impossible'; }
    }
  });
  zone.addEventListener('keydown', function (e) {
    var b = e.target.closest && e.target.closest('[data-image]');
    if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrir(zone._images[+b.getAttribute('data-image')]); }
  });
  window.addEventListener('hashchange', function () { lireHash(); afficher(); });

  /* Chargement */
  function charger(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  Promise.all([charger(API + '/illustrations'), charger(API + '/formules')]).then(function (res) {
    images = (res[0].illustrations || []).filter(function (im) { return im.usage !== 'sans_legendes' && im.usage !== 'a_completer'; });
    formules = res[1].formules || [];
    lireHash();
    afficher();
  }).catch(function () {
    zone.innerHTML = '<p class="erreur-msg">Impossible de charger les schémas pour le moment. Réessaie dans un instant.</p>';
  });
})();
