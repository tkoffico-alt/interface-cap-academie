// ❖ Service worker EdukaTchat — installabilité mobile (PWA)
//
// Rôle volontairement minimal : ce service worker n'existe QUE pour
// satisfaire la condition technique exigée par Chrome/Android pour
// proposer "Ajouter à l'écran d'accueil" / "Installer l'application"
// (présence d'un handler 'fetch'), et pour mettre en cache la coquille
// statique de l'app (HTML/CSS/JS) afin qu'elle s'ouvre plus vite et
// reste utilisable hors-ligne pour la partie interface.
//
// Il ne met JAMAIS en cache les appels vers l'API (api.edukatchat.org
// ou toute URL contenant '/api/'), qui doivent toujours repartir en
// réseau pour rester dynamiques (chat, vérification de sceau, etc.).
//
// ⚠️ Incrémenter CACHE_VERSION à chaque déploiement d'index.html/app.js/
// style.css pour forcer les appareils déjà installés à récupérer la
// nouvelle version (sinon ils resteraient sur une version mise en cache).

const CACHE_VERSION = 'edukatchat-shell-v9';

const FICHIERS_COQUILLE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/favicon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(FICHIERS_COQUILLE))
            .catch(() => {
                // Un fichier manquant (ex: favicon.png absent sur ce déploiement)
                // ne doit pas empêcher l'installation du service worker.
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((noms) => Promise.all(
            noms
                .filter((nom) => nom !== CACHE_VERSION)
                .map((nom) => caches.delete(nom))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ne jamais intercepter les appels API / cross-origin (chat, sceau, etc.)
    // -- toujours réseau, jamais de cache, pour rester 100% dynamique.
    if (url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.includes('verifier-sceau')) {
        return;
    }

    // Coquille statique : réseau en priorité (pour avoir la dernière version
    // dès que possible), avec repli sur le cache si hors-ligne.
    event.respondWith(
        fetch(event.request)
            .then((reponse) => {
                const copie = reponse.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copie));
                return reponse;
            })
            .catch(() => caches.match(event.request))
    );
});
