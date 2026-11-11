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

const CACHE_VERSION = 'edukatchat-shell-v220';

// ❖ Images (schémas, illustrations) : cache d'abord (09/11/2026), pour économiser les données mobiles de l'élève —
// un schéma déjà vu ne se retélécharge plus et reste visible hors connexion. Cache SÉPARÉ de la coquille
// (il survit aux changements de CACHE_VERSION). ⚠️ Si une image est REMPLACÉE sous le même nom de fichier,
// incrémenter IMG_CACHE (ex. v1 → v2) pour que les appareils la récupèrent. Au plus IMG_MAX images gardées.
const IMG_CACHE = 'edukatchat-images-v1';
const IMG_MAX = 150;

const FICHIERS_COQUILLE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/visite-guidee.js',
    '/centres-interet.js',
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
                .filter((nom) => nom !== CACHE_VERSION && nom !== IMG_CACHE)
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

    if (event.request.method === 'GET' && url.pathname.indexOf('/images/illustrations/') === 0) {
        event.respondWith(
            caches.open(IMG_CACHE).then((cache) =>
                cache.match(event.request).then((trouvee) => {
                    if (trouvee) return trouvee;
                    return fetch(event.request).then((reponse) => {
                        if (reponse && reponse.ok) {
                            cache.put(event.request, reponse.clone()).then(() => cache.keys()).then((cles) => {
                                if (cles.length > IMG_MAX) return cache.delete(cles[0]); // la plus ancienne
                            }).catch(() => {});
                        }
                        return reponse;
                    });
                })
            )
        );
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
