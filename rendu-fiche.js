/* Rendu sûr d'une fiche (Markdown simple + formules). Tout texte est inséré avec textContent. Extrait de casier.js. */
(function () {
  'use strict';
  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }
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

  window.EdukaRendu = { rendre: rendre, formules: formules };
})();
