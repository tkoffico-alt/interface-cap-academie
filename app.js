/* EdukaTchat - Propriété Intellectuelle Exclusive */

let pendingSpaceToOpen = null;
let avatarActif = "general"; // Mémorise l'avatar choisi
let espaceActuel = "";       // Mémorise la porte choisie
let disciplineEnAttente = ""; // Retient la matière pendant le questionnaire de diversion

// ❖ Mémorisés depuis le questionnaire de diversion (profil-modal) puis
// réellement transmis au serveur — auparavant collectés mais jamais
// envoyés, remplacés côté backend par des valeurs génériques figées.
let classeActive = "";
let methodeTravailActive = "";
let gestionStressActive = "";

// ❖ Garde-fou anti double-envoi entre l'amorçage automatique (setTimeout,
// voir validerProfilEtEntrer) et un clic sur une suggestion rapide pendant
// la même fenêtre de 800ms : le premier des deux qui agit désarme l'autre.
let sasPremierEchangeEnAttente = false;

// ❖ L'AMORÇAGE AUTOMATIQUE DE L'ESPACE ENSEIGNANT (Atelier, Forge, Cabinet) :
// même logique que le Sas côté élève — un enseignant qui ouvre un outil pour
// la première fois sur cet appareil ne doit jamais affronter un champ vide
// en silence. outilsDejaAmorces évite un double déclenchement si l'on
// bascule rapidement d'onglet avant la fin du premier échange (le vrai
// garde-fou inter-sessions reste l'historique localStorage, voir
// switchTeacherTool ci-dessous).
let outilsDejaAmorces = new Set();
const MESSAGES_AMORCAGE_ENSEIGNANT = {
    atelier: "C'est ma première visite dans l'Atelier des Évaluations : présente-moi en quelques lignes ce que tu peux concevoir ici, puis propose-moi un exemple concret pour démarrer.",
    forge: "C'est ma première visite dans la Forge des Leçons : présente-moi en quelques lignes ce que tu peux produire ici, puis propose-moi un exemple concret pour démarrer.",
    cabinet: "C'est ma première visite dans le Cabinet d'Étude : présente-moi en quelques lignes comment tu peux m'accompagner ici, puis propose-moi un exemple concret pour démarrer."
};

// ❖ LES SUGGESTIONS RAPIDES (Sas/Académie + Espace Enseignant) ❖
// Toujours visibles, jamais obligatoires : un élève ou un enseignant qui ne
// sait pas quoi demander peut cliquer plutôt que d'affronter un champ vide.
// Écouteur délégué sur document pour fonctionner quel que soit le moment où
// les boutons apparaissent dans le DOM. data-outil distingue le Sas (valeur
// par défaut "sas", champ dédié) des outils enseignants (routés vers
// sendTeacherMessage).
document.addEventListener('click', function (evenement) {
    const bouton = evenement.target.closest('.btn-suggestion');
    if (!bouton) return;
    const outil = bouton.dataset.outil || 'sas';
    if (outil === 'sas') {
        sasPremierEchangeEnAttente = false;
        const champ = document.getElementById('sas-user-input');
        if (champ && !champ.disabled) {
            champ.value = bouton.dataset.message || "";
            sendSasMessage();
        }
    } else {
        outilsDejaAmorces.add(outil); // un clic manuel vaut amorçage : plus d'auto-envoi ensuite
        const champ = document.getElementById(`${outil}-user-input`);
        if (champ && !champ.disabled) {
            // ❖ Un clic sur une suggestion ouvre un nouveau sujet : on repart
            // d'un fil Dify vierge (voir reinitialiserConversationEnseignant).
            // La logique est volontairement inversée -- on réinitialise PAR
            // DÉFAUT, sauf pour les rares boutons qui prolongent l'échange
            // précédent. Une première version ne déclenchait que sur
            // « Nouvelle fiche… » et laissait donc le Cabinet, dont les
            // boutons s'appellent « Conseil pédagogique », « Un élève en
            // difficulté » et « Gestion de classe », accumuler indéfiniment
            // ses consultations dans un seul fil.
            const libelle = `${bouton.textContent || ''} ${bouton.dataset.message || ''}`;
            const prolongeLEchange = /ajoute[rz]?\s+des\s+exercices|derni[èe]re\s+fiche/i.test(libelle);
            if (!prolongeLEchange) reinitialiserConversationEnseignant(outil);
            champ.value = bouton.dataset.message || "";
            sendTeacherMessage(outil);
        }
    }
});

// =======================================================================
// ❖ LA GESTION DES ESPACES ET DE L'AIGUILLAGE ❖
// =======================================================================

async function openSpace(space) {
    espaceActuel = space;

    if (space === 'eleve') {
        const codeAcces = localStorage.getItem('eduka_sceau');

        if (!codeAcces) {
            pendingSpaceToOpen = 'eleve';
            openPremiumModal();
            return;
        }

        // Illusion de fluidité : on affiche la modale immédiatement pour masquer l'attente
        openPremiumModal();
        const feedback = document.getElementById('modal-feedback');
        if (feedback) {
            feedback.textContent = "Authentification automatique en cours...";
            feedback.style.color = "#60A5FA";
        }

        try {
            const response = await fetch('https://api.edukatchat.org/verifier-sceau', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Le Sceau est transmis avec l'identité de la porte (la variable 'space')
                body: JSON.stringify({ sceau: codeAcces, espace_cible: space })
            });
            const data = await response.json();

            if (data.valide) {
                closePremiumModal();
                document.getElementById('discipline-modal').classList.add('active');
            } else {
                localStorage.removeItem('eduka_sceau');
                if (feedback) {
                    feedback.textContent = "Votre précédent accès a expiré. Veuillez saisir un nouveau Code.";
                    feedback.style.color = "#F59E0B";
                }
            }
        } catch (error) {
            console.error("Erreur de vérification", error);
            if (feedback) {
                feedback.textContent = "Le réseau est instable. Impossible de vérifier l'accès.";
                feedback.style.color = "#F87171";
            }
        }

    } else if (space === 'sas') {
        document.getElementById('discipline-modal').classList.add('active');

    } else if (space === 'enseignant') {
        const codeEnseignant = localStorage.getItem('eduka_sceau_enseignant');

        if (!codeEnseignant) {
            ouvrirModaleAccesEnseignant();
            return;
        }

        // ❖ Revérification silencieuse à chaque entrée (le code peut avoir
        // expiré depuis la dernière visite) -- même logique que l'accès
        // élève ci-dessus.
        try {
            const response = await fetch('https://api.edukatchat.org/verifier-sceau', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sceau: codeEnseignant, espace_cible: 'enseignant' })
            });
            const data = await response.json();
            if (data.valide) {
                entrerDansEspaceEnseignant();
            } else {
                localStorage.removeItem('eduka_sceau_enseignant');
                ouvrirModaleAccesEnseignant();
            }
        } catch (error) {
            console.error("Erreur de vérification enseignant", error);
            // ❖ Réseau instable : on ne bloque pas un enseignant déjà
            // abonné -- si son Sceau s'avère finalement invalide, le
            // serveur le lui signalera au premier envoi de message (plus
            // d'essai Freemium en repli depuis le 28/08/2026 : sans Sceau
            // ENS- valide, le serveur bloque directement).
            entrerDansEspaceEnseignant();
        }
    }
}

// ❖ Sépare l'affichage effectif de l'espace enseignant (appelé une fois
// le Code d'accès validé) de la
// décision d'accès elle-même (openSpace ci-dessus).
function entrerDansEspaceEnseignant() {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    document.querySelectorAll('iframe').forEach(frame => frame.classList.remove('active'));
    document.getElementById('container-sas-custom').classList.remove('active');
    document.getElementById('teacher-tabs-container').style.display = 'flex';
    const btnMatieresEnseignant = document.getElementById('btn-matieres');
    if (btnMatieresEnseignant) btnMatieresEnseignant.style.display = 'none';
    switchTeacherTool('atelier');
}

// =======================================================================
// ❖ LA MODALE D'ACCÈS ESPACE ENSEIGNANT (CODE OPTIONNEL) ❖
// =======================================================================
function ouvrirModaleAccesEnseignant() {
    const feedback = document.getElementById('modal-feedback-enseignant');
    if (feedback) feedback.textContent = '';
    const champ = document.getElementById('matricule-enseignant-input');
    if (champ) champ.value = '';
    document.getElementById('enseignant-code-modal').classList.add('active');
}

function fermerModaleAccesEnseignant() {
    document.getElementById('enseignant-code-modal').classList.remove('active');
}

function handleMatriculeEnseignantKeyPress(event) {
    if (event.key === 'Enter') {
        verifyMatriculeEnseignant();
    }
}

async function verifyMatriculeEnseignant() {
    const matricule = document.getElementById('matricule-enseignant-input').value.trim();
    const feedback = document.getElementById('modal-feedback-enseignant');

    if (!matricule) {
        feedback.textContent = "Le Code d'accès ne peut être vide.";
        feedback.style.color = "#F87171";
        return;
    }

    feedback.textContent = "Vérification de votre Code en cours...";
    feedback.style.color = "#60A5FA";

    try {
        const response = await fetch('https://api.edukatchat.org/verifier-sceau', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceau: matricule, espace_cible: 'enseignant' })
        });
        const data = await response.json();

        if (data.valide === true) {
            feedback.textContent = data.message;
            feedback.style.color = "#10B981";
            localStorage.setItem('eduka_sceau_enseignant', matricule);

            setTimeout(() => {
                fermerModaleAccesEnseignant();
                entrerDansEspaceEnseignant();
            }, 700);
        } else {
            feedback.textContent = data.message || "Code invalide.";
            feedback.style.color = "#F87171";
        }
    } catch (error) {
        console.error("Erreur de vérification enseignant", error);
        feedback.textContent = "Le réseau est instable. Impossible de vérifier l'accès.";
        feedback.style.color = "#F87171";
    }
}

// ❖ continuerEnFreemiumEnseignant() a été retirée le 28/08/2026 : l'essai
// gratuit sans code de l'Espace Enseignant a été supprimé (décision de
// Constant, déconseillé sur le plan commercial). Le bouton correspondant
// n'existe plus dans index.html -- seule la voie du Code d'accès
// (verifyMatriculeEnseignant) mène désormais à entrerDansEspaceEnseignant().
// Le palier gratuit de l'Espace de Préparation et des Ateliers de Maîtrise
// côté élève, lui, reste inchangé (voir sendSasMessage / verifier_freemium
// côté serveur pour ces deux-là).

function fermerVestibule() {
    document.getElementById('discipline-modal').classList.remove('active');
}

// =======================================================================
// ❖ LE PLANIFICATEUR DE RÉVISION (PHOTO D'EMPLOI DU TEMPS) ❖
// =======================================================================
function ouvrirPlanningModal() {
    // ❖ Fonctionnalité réservée aux porteurs de Sceau : sans matricule
    // stable, le planning ne peut être rattaché à personne de façon
    // durable (contrairement à une adresse IP, qui change).
    const sceau = localStorage.getItem('eduka_sceau') || "";
    if (!sceau) {
        openPremiumModal();
        return;
    }
    const feedback = document.getElementById('planning-feedback');
    if (feedback) { feedback.textContent = ""; }
    document.getElementById('planning-modal').classList.add('active');
}

function fermerPlanningModal() {
    document.getElementById('planning-modal').classList.remove('active');
}

// =======================================================================
// ❖ L'ESPACE PARENTS (CHOIX EDT TALLY / EDT PROGRESSION) ❖
// =======================================================================
function ouvrirParentsModal() {
    document.getElementById('parents-modal').classList.add('active');
}

function fermerParentsModal() {
    document.getElementById('parents-modal').classList.remove('active');
}

function ouvrirEnseignantAboModal() {
    document.getElementById('enseignant-abo-modal').classList.add('active');
}

function fermerEnseignantAboModal() {
    document.getElementById('enseignant-abo-modal').classList.remove('active');
}

// ❖ EDT Progression, avant abonnement : la photo de l'emploi du temps est
// envoyée AVANT le paiement (aucun Sceau/matricule n'existe encore), donc
// on identifie la famille par son numéro WhatsApp. Une fois la photo lue
// avec succès, on bascule directement vers la page de paiement Paystack ;
// le webhook de paiement se chargera de récupérer ce planning dès que le
// nouveau Sceau sera généré.
const LIEN_PAIEMENT_PAYSTACK = "https://paystack.shop/pay/edukatchat-eleves-parents";

async function envoyerPhotoPreAbonnement() {
    const telephone = document.getElementById('pre-abo-telephone').value.trim();
    const nomEleve = document.getElementById('pre-abo-nom-eleve').value.trim();
    const inputFichier = document.getElementById('pre-abo-photo-input');
    const feedback = document.getElementById('pre-abo-feedback');
    const bouton = document.getElementById('btn-pre-abonnement');

    if (!telephone) {
        feedback.textContent = "Le numéro WhatsApp du parent est requis.";
        feedback.style.color = "#F59E0B";
        return;
    }
    if (!nomEleve) {
        feedback.textContent = "Le nom de l'élève est requis.";
        feedback.style.color = "#F59E0B";
        return;
    }
    if (!inputFichier || !inputFichier.files || inputFichier.files.length === 0) {
        feedback.textContent = "Choisis d'abord une photo.";
        feedback.style.color = "#F59E0B";
        return;
    }

    bouton.disabled = true;
    feedback.textContent = "Lecture de la photo en cours...";
    feedback.style.color = "#60A5FA";

    const formulaire = new FormData();
    formulaire.append('telephone', telephone);
    formulaire.append('nom_eleve', nomEleve);
    formulaire.append('photo', inputFichier.files[0]);

    try {
        const response = await fetch('https://api.edukatchat.org/api/planning/pre_abonnement', {
            method: 'POST',
            body: formulaire
        });
        const data = await response.json();

        if (data.status === 'success') {
            feedback.textContent = `✔ ${data.message}`;
            feedback.style.color = "#10B981";
            setTimeout(() => { window.location.href = LIEN_PAIEMENT_PAYSTACK; }, 1200);
        } else {
            feedback.textContent = data.message || "Une erreur est survenue.";
            feedback.style.color = (data.status === 'vide') ? "#F59E0B" : "#F87171";
            bouton.disabled = false;
        }
    } catch (err) {
        feedback.textContent = "Le réseau est instable. Réessaie dans un instant.";
        feedback.style.color = "#F87171";
        bouton.disabled = false;
    }
}

async function envoyerPhotoEmploiDuTemps() {
    const sceau = localStorage.getItem('eduka_sceau') || "";
    const inputFichier = document.getElementById('planning-photo-input');
    const feedback = document.getElementById('planning-feedback');
    const bouton = document.getElementById('btn-envoyer-planning');

    if (!sceau) {
        openPremiumModal();
        return;
    }
    if (!inputFichier || !inputFichier.files || inputFichier.files.length === 0) {
        feedback.textContent = "Choisis d'abord une photo.";
        feedback.style.color = "#F59E0B";
        return;
    }

    bouton.disabled = true;
    feedback.textContent = "Lecture de la photo en cours...";
    feedback.style.color = "#60A5FA";

    const formulaire = new FormData();
    formulaire.append('matricule', sceau);
    formulaire.append('photo', inputFichier.files[0]);

    try {
        const response = await fetch('https://api.edukatchat.org/api/planning/lire_photo', {
            method: 'POST',
            body: formulaire
        });
        const data = await response.json();

        if (data.status === 'success') {
            feedback.textContent = `✔ ${data.message}`;
            feedback.style.color = "#10B981";
            setTimeout(fermerPlanningModal, 2000);
        } else {
            // ❖ 'vide' (rien lu) et 'error' partagent le même traitement
            // visuel côté élève — seule la couleur diffère légèrement.
            feedback.textContent = data.message || "Une erreur est survenue.";
            feedback.style.color = (data.status === 'vide') ? "#F59E0B" : "#F87171";
        }
    } catch (err) {
        feedback.textContent = "Le réseau est instable. Réessaie dans un instant.";
        feedback.style.color = "#F87171";
    } finally {
        bouton.disabled = false;
    }
}

// ❖ Le profil (classe, méthode de révision, gestion du stress) est
// mémorisé par appareil dès la première saisie -- inutile de reposer les
// mêmes questions à chaque connexion, l'IA connaît déjà l'élève. Voir
// validerProfilEtEntrer() (qui l'enregistre) et ouvrirModificationProfil()
// (qui permet de le corriger plus tard).
function obtenirProfilEleveSauvegarde() {
    try {
        const brut = localStorage.getItem('eduka_profil_eleve');
        if (!brut) return null;
        const profil = JSON.parse(brut);
        if (profil && profil.classe && profil.methode_travail && profil.gestion_stress) {
            return profil;
        }
    } catch (e) {
        // Profil corrompu : on redemande simplement, sans planter.
    }
    return null;
}

function entrerDansLeChat(matiereChoisie) {
    disciplineEnAttente = matiereChoisie;
    fermerVestibule();

    const profilSauvegarde = obtenirProfilEleveSauvegarde();
    if (profilSauvegarde) {
        appliquerProfilEtEntrerDansEspace(profilSauvegarde.classe, profilSauvegarde.methode_travail, profilSauvegarde.gestion_stress);
        return;
    }

    document.getElementById('profil-modal').classList.add('active');
}

// ❖ Rouvre "Configuration de la session" pré-remplie avec le profil déjà
// enregistré, pour le corriger (changement de classe en cours d'année,
// etc.) sans que cela ne déclenche par effet de bord un changement de
// matière : si un avatar est déjà actif, on le préserve explicitement.
function ouvrirModificationProfil() {
    const profil = obtenirProfilEleveSauvegarde();
    const champClasse = document.getElementById('niveau-classe');
    const champMethode = document.getElementById('habitudes-revision');
    const champStress = document.getElementById('gestion-stress');
    if (profil) {
        if (champClasse) champClasse.value = profil.classe;
        if (champMethode) champMethode.value = profil.methode_travail;
        if (champStress) champStress.value = profil.gestion_stress;
    }
    if (typeof verifierFormulaire === 'function') verifierFormulaire();
    if (avatarActif) {
        disciplineEnAttente = avatarActif;
    }
    fermerVestibule();
    document.getElementById('profil-modal').classList.add('active');
}

function validerProfilEtEntrer() {
    document.getElementById('profil-modal').classList.remove('active');

    const champClasse = document.getElementById('niveau-classe');
    const classe = champClasse ? champClasse.value : "";
    const methode = document.getElementById('habitudes-revision').value;
    const stress = document.getElementById('gestion-stress').value;

    localStorage.setItem('eduka_profil_eleve', JSON.stringify({
        classe: classe,
        methode_travail: methode,
        gestion_stress: stress
    }));

    appliquerProfilEtEntrerDansEspace(classe, methode, stress);
}

function appliquerProfilEtEntrerDansEspace(classe, methode, stress) {
    classeActive = classe;
    methodeTravailActive = methode;
    gestionStressActive = stress;

    avatarActif = disciplineEnAttente;
    mettreAJourBanniereMatiere();

    document.getElementById('home-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    document.querySelectorAll('iframe').forEach(frame => frame.classList.remove('active'));
    document.getElementById('container-sas-custom').classList.remove('active');
    document.getElementById('container-atelier-custom').classList.remove('active');
    document.getElementById('container-forge-custom').classList.remove('active');
    document.getElementById('container-cabinet-custom').classList.remove('active');
    document.getElementById('teacher-tabs-container').style.display = 'none';

    // ❖ Le bouton "Changer de matière" ne concerne que l'Académie Premium
    // ("eleve") -- pas l'Espace de Préparation freemium ("sas"), pour
    // garder la friction volontaire de cet espace-là intacte.
    const btnMatieres = document.getElementById('btn-matieres');
    if (btnMatieres) {
        btnMatieres.style.display = (espaceActuel === 'eleve') ? 'flex' : 'none';
    }

    if(espaceActuel === 'sas' || espaceActuel === 'eleve') {
        document.getElementById('container-sas-custom').classList.add('active');

        const chatHistory = document.getElementById('sas-chat-history');
        chatHistory.innerHTML = '';

        // ❖ Isolation par avatar : chaque matière a son propre historique,
        // pour qu'une conversation de SVT ne se mélange jamais à celle de Français.
        const historiqueSauvegarde = localStorage.getItem(`eduka_chat_sas_${avatarActif}`);

        if (historiqueSauvegarde) {
            chatHistory.innerHTML = historiqueSauvegarde;
        } else {
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'message system-message';

            // ❖ Le nom de la matière n'a plus besoin d'être répété ici :
            // la bannière persistante au-dessus du fil (voir
            // #banniere-matiere) le montre déjà en grand, en permanence.
            // Ce message se concentre donc sur l'invitation à démarrer.
            if (espaceActuel === 'eleve') {
                welcomeDiv.innerHTML = `L'Académie Premium vous ouvre ses portes. Votre répétiteur vous écoute.`;
            } else {
                welcomeDiv.innerHTML = `L'espace est prêt. Posez votre première question pour commencer.`;
            }

            chatHistory.appendChild(welcomeDiv);

            // ❖ L'AMORÇAGE AUTOMATIQUE (première visite uniquement) :
            // un élève qui découvre l'outil face à un champ vide ne sait
            // souvent pas quoi demander et se décourage avant même de
            // commencer. L'absence d'historique sauvegardé ci-dessus prouve
            // qu'il s'agit d'un tout premier contact avec CET avatar sur CET
            // appareil (le drapeau se pose tout seul dès qu'un échange a lieu,
            // voir eduka_chat_sas_${avatarActif} plus haut) — donc on amorce
            // l'échange à sa place. Aux visites suivantes, l'historique existera
            // déjà et cette branche ne sera plus jamais exécutée.
            sasPremierEchangeEnAttente = true;
            setTimeout(() => {
                const inputField = document.getElementById('sas-user-input');
                if (sasPremierEchangeEnAttente && inputField && !inputField.value.trim()) {
                    inputField.value = `C'est ma première fois ici, aide-moi à démarrer en ${formaterNomMatiere(avatarActif)}.`;
                    sendSasMessage();
                }
                sasPremierEchangeEnAttente = false;
            }, 800);
        }

        scrollToBottom('sas-chat-history');
    }
}

function formaterNomMatiere(code) {
    const noms = {
        'maths': 'Mathématiques', 'physique': 'Physique-Chimie', 'svt': 'SVT',
        'tice': 'TICE (Informatique)',
        'francais': 'Français', 'philosophie': 'Philosophie', 'histoire_geo': 'Histoire-Géo',
        'edhc': 'EDHC', 'anglais': 'Anglais', 'espagnol': 'Espagnol', 'allemand': 'Allemand',
        'musique': 'Éducation Musicale', 'arts_plastiques': 'Arts Plastiques'
    };
    return noms[code] || 'cette discipline';
}

// ❖ Icônes vectorielles au trait fin (style feather-icons : stroke
// currentColor, sans remplissage), en remplacement des émojis colorés
// d'origine -- demande de Constant du 27/08/2026 pour un rendu plus
// sobre et "intellectuel" du bandeau de discipline. currentColor permet
// à chaque icône d'hériter automatiquement de la couleur du texte
// (.banniere-matiere-icone), sans déclaration de couleur ici.
const SVG_MATIERE_DEFAUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5c-2-1.3-4.5-2-7-2v14c2.5 0 5 .7 7 2 2-1.3 4.5-2 7-2V3c-2.5 0-5 .7-7 2Z"/><path d="M12 5v14"/></svg>';

const ICONES_MATIERES = {
    'maths': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 21 19 3 19Z"/><circle cx="12" cy="14" r="4"/></svg>',
    'physique': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3.5L14 9V3"/></svg>',
    'svt': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20c9 0 14-5 14-14 0-1 0-2-.3-3C9 3.5 5 8 5 17c0 1 0 2 0 3Z"/><path d="M5 20c3-6 6-9 12-13"/></svg>',
    'tice': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
    'francais': SVG_MATIERE_DEFAUT,
    'philosophie': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9c0-3 2.5-6 7-6s7 3 7 6"/><circle cx="8.5" cy="10" r="2.4"/><circle cx="15.5" cy="10" r="2.4"/><path d="M12 12.2 10.7 14h2.6Z"/><path d="M6 15c0 3 2.5 5 6 5s6-2 6-5"/></svg>',
    'histoire_geo': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.5 4.5 5.8 4.5 9s-1.7 6.5-4.5 9c-2.8-2.5-4.5-5.8-4.5-9s1.7-6.5 4.5-9Z"/></svg>',
    'edhc': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>',
    'anglais': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4v-4H4Z"/><path d="M8 10h8M8 13h5"/></svg>',
    'espagnol': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4v-4H4Z"/><path d="M8 10h8M8 13h5"/></svg>',
    'allemand': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4v-4H4Z"/><path d="M8 10h8M8 13h5"/></svg>',
    'musique': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="18" r="2.5"/><circle cx="16" cy="16" r="2.5"/><path d="M9.5 18V6l9-1.8V14"/></svg>',
    'arts_plastiques': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 8 0 1 0 0 16c1 0 1.8-.7 1.8-1.6 0-.4-.2-.8-.4-1.1-.2-.3-.4-.6-.4-1 0-.7.6-1.3 1.3-1.3H16a5 4.5 0 0 0 5-4.5C21 5.9 17 3 12 3Z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.8" r="1" fill="currentColor" stroke="none"/></svg>'
};

function iconePourMatiere(code) {
    return ICONES_MATIERES[code] || SVG_MATIERE_DEFAUT;
}

// ❖ Met à jour la bannière persistante d'identité de matière (voir
// #banniere-matiere dans index.html). Appelée dès que avatarActif
// change -- première entrée dans l'espace ou changement de matière en
// cours de route via le bouton "📚" -- pour que le repère visuel reste
// toujours synchronisé avec la matière réellement active.
function mettreAJourBanniereMatiere() {
    const nomEl = document.getElementById('banniere-matiere-nom');
    const iconeEl = document.getElementById('banniere-matiere-icone');
    if (nomEl) nomEl.textContent = formaterNomMatiere(avatarActif);
    // ❖ innerHTML (pas textContent) : ces icônes sont du SVG, pas du texte
    // brut. Toutes les valeurs viennent du dictionnaire fixe ci-dessus
    // (jamais d'entrée utilisateur), donc aucun risque d'injection.
    if (iconeEl) iconeEl.innerHTML = iconePourMatiere(avatarActif);
}

function switchTeacherTool(toolID) {
    document.getElementById('container-atelier-custom').classList.remove('active');
    document.getElementById('container-forge-custom').classList.remove('active');
    document.getElementById('container-cabinet-custom').classList.remove('active');
    document.getElementById('container-forge_primaire-custom').classList.remove('active');
    document.getElementById('container-cabinet_primaire-custom').classList.remove('active');

    document.getElementById('tab-atelier').classList.remove('active');
    document.getElementById('tab-forge').classList.remove('active');
    document.getElementById('tab-cabinet').classList.remove('active');
    document.getElementById('tab-forge_primaire').classList.remove('active');
    document.getElementById('tab-cabinet_primaire').classList.remove('active');

    if (toolID === 'atelier') {
        document.getElementById('container-atelier-custom').classList.add('active');
        document.getElementById('tab-atelier').classList.add('active');
    } else if (toolID === 'forge') {
        document.getElementById('container-forge-custom').classList.add('active');
        document.getElementById('tab-forge').classList.add('active');
    } else if (toolID === 'cabinet') {
        document.getElementById('container-cabinet-custom').classList.add('active');
        document.getElementById('tab-cabinet').classList.add('active');
    } else if (toolID === 'forge_primaire') {
        document.getElementById('container-forge_primaire-custom').classList.add('active');
        document.getElementById('tab-forge_primaire').classList.add('active');
    } else if (toolID === 'cabinet_primaire') {
        document.getElementById('container-cabinet_primaire-custom').classList.add('active');
        document.getElementById('tab-cabinet_primaire').classList.add('active');
    }

    scrollToBottom(`${toolID}-chat-history`);

    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        let activeContainer = document.querySelector('.custom-chat-container.active') || document.querySelector('iframe.active');
        if (activeContainer && activeContainer.requestFullscreen) {
            activeContainer.requestFullscreen();
        } else if (activeContainer && activeContainer.webkitRequestFullscreen) {
            activeContainer.webkitRequestFullscreen();
        }
    }

    // ❖ AMORÇAGE AUTOMATIQUE DE L'ESPACE ENSEIGNANT : au tout premier passage
    // sur cet outil pour cet appareil (aucun historique localStorage), l'IA
    // se présente et propose un exemple concret plutôt que de laisser
    // l'enseignant face au message d'accueil statique et un champ vide.
    // Se déclenche une seule fois par outil et par appareil.
    if (!outilsDejaAmorces.has(toolID) && !localStorage.getItem(`eduka_chat_${toolID}`)) {
        outilsDejaAmorces.add(toolID);
        setTimeout(() => {
            const inputField = document.getElementById(`${toolID}-user-input`);
            if (inputField && !inputField.value.trim() && !inputField.disabled) {
                inputField.value = MESSAGES_AMORCAGE_ENSEIGNANT[toolID] || "C'est ma première visite ici, présente-moi cet espace et propose-moi un exemple concret pour démarrer.";
                sendTeacherMessage(toolID);
            }
        }, 800);
    }
}

function goHome() {
    document.getElementById('app-view').style.display = 'none';
    document.getElementById('home-view').style.display = 'flex';

    document.querySelectorAll('iframe').forEach(frame => frame.classList.remove('active'));
    document.getElementById('container-sas-custom').classList.remove('active');
    document.getElementById('container-atelier-custom').classList.remove('active');
    document.getElementById('container-forge-custom').classList.remove('active');
    document.getElementById('container-cabinet-custom').classList.remove('active');
    document.getElementById('teacher-tabs-container').style.display = 'none';
    const btnMatieresAccueil = document.getElementById('btn-matieres');
    if (btnMatieresAccueil) btnMatieresAccueil.style.display = 'none';
}

// ❖ LE MENU DE NAVIGATION (remplace le simple bouton "Retour") : chaque
// destination de l'accueil est déjà une fonction autonome (ouvertes
// jusqu'ici uniquement depuis les cartes de l'accueil) -- on les réutilise
// telles quelles, sans dupliquer leur logique. Volontairement identique
// dans tous les espaces (pas de cloisonnement élève/enseignant) : les
// espaces protégés (Académie, Espace Enseignant) restent de toute façon
// filtrés par le code d'accès, et un enseignant curieux qui explore le Sas
// n'est pas un problème -- plutôt un bon ambassadeur du projet.
function toggleMenuNavigation() {
    const panel = document.getElementById('menu-navigation-panel');
    const btn = document.getElementById('btn-menu-nav');
    if (!panel || !btn) return;
    const estOuvert = panel.classList.toggle('ouvert');
    btn.setAttribute('aria-expanded', estOuvert ? 'true' : 'false');
}

function fermerMenuNavigation() {
    const panel = document.getElementById('menu-navigation-panel');
    const btn = document.getElementById('btn-menu-nav');
    if (panel) panel.classList.remove('ouvert');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', function(event) {
    const wrapper = document.querySelector('.menu-navigation-wrapper');
    if (wrapper && !wrapper.contains(event.target)) {
        fermerMenuNavigation();
    }
});

function naviguerVers(destination) {
    fermerMenuNavigation();
    if (destination === 'home') {
        goHome();
    } else if (destination === 'sas' || destination === 'eleve' || destination === 'enseignant') {
        openSpace(destination);
    } else if (destination === 'orateur') {
        ouvrirAtelier();
    } else if (destination === 'philo') {
        ouvrirPhilo();
    } else if (destination === 'sciences') {
        ouvrirSciences();
    } else if (destination === 'boussole') {
        ouvrirBoussole();
    } else if (destination === 'boussole-univ') {
        ouvrirBoussoleUniv();
    } else if (destination === 'parents') {
        ouvrirParentsModal();
    }
}

// ❖ "DONNER MON AVIS" — WHATSAPP PRÉ-REMPLI VERS LE FONDATEUR (PAS LE
// GARDIEN DE L'ACCUEIL) ❖
// Distinct du bouton "Besoin d'aide ?" (qui pointe vers le numéro
// professionnel, géré par l'agent Gardien de l'Accueil) : celui-ci
// pointe vers le numéro personnel de Constant, pour que les retours
// arrivent directement chez lui, sans qu'un agent IA ne réponde à la
// place avec un message d'accueil générique. Rien n'est envoyé
// automatiquement -- WhatsApp s'ouvre avec le message déjà rempli,
// l'utilisateur reste libre de le modifier avant d'envoyer.
const NUMERO_AVIS_FONDATEUR = "2250748337699"; // 07 48 33 76 99 -- le 0 initial est CONSERVÉ après l'indicatif
// 225, à l'identique du numéro "Besoin d'aide ?" déjà en place (2250142674315) : contrairement à
// la règle E.164 habituelle, WhatsApp Business ne reconnaît ce numéro que sous cette forme ici.

const NOMS_ESPACES_POUR_AVIS = {
    atelier: "L'Atelier des Évaluations",
    forge: "La Forge des Leçons",
    cabinet: "Le Cabinet d'Étude",
    forge_primaire: "La Forge (Primaire)",
    cabinet_primaire: "Le Cabinet (Primaire)"
};

function detecterEspaceActuelPourAvis() {
    for (const [outil, nom] of Object.entries(NOMS_ESPACES_POUR_AVIS)) {
        const conteneur = document.getElementById(`container-${outil}-custom`);
        if (conteneur && conteneur.classList.contains('active')) return nom;
    }
    const conteneurSas = document.getElementById('container-sas-custom');
    if (conteneurSas && conteneurSas.classList.contains('active')) {
        return "Espace Élève";
    }
    // Repli générique : l'espace n'a pas pu être identifié précisément
    // (accueil, Espace Parents, Boussole, etc.) -- pas bloquant, le
    // message reste utile même sans cette précision.
    return "EdukaTchat";
}

function donnerAvisWhatsApp() {
    const espace = detecterEspaceActuelPourAvis();
    const texte = `Bonjour ! Je donne mon avis sur EdukaTchat 😊\nEspace : ${espace}\nMon impression : `;
    const url = `https://wa.me/${NUMERO_AVIS_FONDATEUR}?text=${encodeURIComponent(texte)}`;
    window.open(url, '_blank', 'noopener');
}

// ❖ LE FONDU PROGRESSIF DE LA RÉPONSE ❖
// botLoadingDiv.innerHTML est réécrit en entier à chaque fragment reçu du
// flux SSE (nécessaire pour que marked.parse() reforme correctement le
// markdown au fur et à mesure — gras, listes, etc.). Une simple
// réaffectation d'innerHTML ne déclenche aucune animation CSS, même si la
// classe "apparition-fluide" est déjà posée : elle n'a joué qu'une fois, à
// la création de la bulle. Cette fonction retire puis repose la classe de
// fondu à chaque mise à jour (avec un reflow forcé entre les deux pour que
// l'animation CSS soit bien relancée), pour que l'arrivée de chaque
// fragment de texte se fasse en fondu, comme souhaité, au lieu d'un
// remplacement sec.
// ❖ Le bloc de propriété intellectuelle (❖ Architecture Pédagogique
// EdukaTchat ❖ ...) que l'agent Enseignant ajoute en fin de document est
// utile à l'impression/la copie, mais alourdit visuellement la bulle de
// discussion. On l'entoure de jetons sentinelles AVANT le passage par
// marked.parse() (pour rester du texte brut, jamais interprété comme du
// Markdown), puis on remplace ces jetons par un <span> discret une fois le
// HTML généré -- le texte lui-même n'est jamais retiré, seulement restylé.
const JETON_SIGNATURE_DEBUT = '§§SIGNATURE_DEBUT§§';
const JETON_SIGNATURE_FIN = '§§SIGNATURE_FIN§§';

function attenuerSignatureDocument(texteMarkdown) {
    // ❖ Le prompt demande explicitement que rien ne suive la signature,
    // mais le modèle s'en affranchit parfois (« Si cette fiche vous
    // convient, je peux préparer la suivante... N'hésitez pas... »). Comme
    // la regex ci-dessous capture tout ce qui suit le losange ❖ pour le
    // restyler en bloc signature, une phrase d'accompagnement placée APRÈS
    // la signature se retrouvait entraînée avec elle et s'affichait quand
    // même, restylée mais bien visible. On applique donc le même nettoyage
    // que celui utilisé pour la trace écrite (retirerPhrasesAccompagnementFiche)
    // sur le texte entier avant de repérer la signature, pour intercepter
    // ce cas comme celui, plus courant, où la phrase précède la signature.
    const texteNettoye = retirerPhrasesAccompagnementFiche(texteMarkdown);
    return texteNettoye.replace(
        /(❖\s*Architecture Pédagogique EdukaTchat[\s\S]*)/,
        `${JETON_SIGNATURE_DEBUT}$1${JETON_SIGNATURE_FIN}`
    );
}

// =======================================================================
// ❖ LA CARTE "FICHE DE LEÇON" — RESKIN VISUEL (FORGE / FORGE PRIMAIRE) ❖
// =======================================================================
// La Forge (secondaire et primaire) répond en texte structuré par des
// libellés de section (EN-TÊTE ADMINISTRATIF, TABLEAU DES HABILETÉS ET
// CONTENUS, SITUATION D'APPRENTISSAGE, DÉROULEMENT DU COURS, puis pour
// chaque phase ACTIVITÉ DU PROFESSEUR / ACTIVITÉ DE LA CLASSE / TRACE
// ÉCRITE VALIDÉE) -- jamais de tableau Markdown (interdit par le prompt).
// Plutôt que de laisser ce texte s'afficher comme un simple bloc de
// paragraphes, on le découpe ici en sections reconnues pour le présenter
// en badges de métadonnées, cartes arrondies et lignes horizontales
// discrètes (voir les classes .fiche-* dans style.css).
//
// Ces libellés existent aussi en anglais/espagnol/allemand depuis la
// règle de langue des langues vivantes -- les motifs ci-dessous
// reconnaissent les quatre variantes. Le TEXTE AFFICHÉ pour chaque titre
// de section, lui, n'est jamais traduit ici : on réutilise tel quel le
// libellé écrit par le modèle (déjà dans la bonne langue), ce qui évite
// tout dictionnaire de traduction à maintenir côté interface.
//
// Sécurité : si l'en-tête ou le déroulement ne sont pas identifiés sans
// ambiguïté, analyserFicheLecon() renvoie null et l'appelant se replie
// silencieusement sur le rendu standard (marked.parse) -- cette carte ne
// remplace jamais un contenu qu'elle ne comprend pas complètement.

// ❖ Titres de GRANDE section : toujours seuls sur leur ligne dans les
// exemples observés ("HEADER", "EN-TÊTE ADMINISTRATIF :", "LEARNING
// SITUATION", etc.) -- on exige donc que la ligne entière (une fois les
// puces/# et le ':' final retirés) corresponde exactement au libellé.
const ALTERNATIVES_SECTION_FICHE = {
    header: ["EN-?T[ÊE]TE ADMINISTRATIF", "HEADER", "ENCABEZADO", "KOPFDATEN"],
    tableau: [
        "TABLEAU DES HABIL[ÉE]T[ÉE]S ET CONTENUS",
        "TABLE OF SKILLS AND CONTENTS",
        "TABLA DE HABILIDADES Y CONTENIDOS",
        "TABELLE DER F[ÄA]HIGKEITEN UND INHALTE"
    ],
    situation: [
        "SITUATION D['’]APPRENTISSAGE",
        "LEARNING SITUATION",
        "SITUACI[ÓO]N DE APRENDIZAJE",
        "LERNSITUATION"
    ],
    deroulement: [
        "D[ÉE]ROULEMENT DU COURS(?:\\s*\\([^)]*\\))?",
        "LESSON PROCEDURE",
        "DESARROLLO DE LA CLASE",
        "UNTERRICHTSABLAUF"
    ]
};

// ❖ Libellés de PHASE : d'après la structure exigée par le prompt
// ("- ACTIVITÉ DU PROFESSEUR : [...]"), le modèle écrit le libellé ET son
// contenu sur la MÊME ligne, séparés par ':'. Ces motifs ne matchent donc
// que le DÉBUT de la ligne (pas la ligne entière) -- tout ce qui suit le
// ':' est capturé comme contenu par analyserFicheLecon().
const ALTERNATIVES_PHASE_FICHE = {
    prof: ["ACTIVIT[ÉE] DU PROFESSEUR", "TEACHER['’]S ACTIVITY", "ACTIVIDAD DEL PROFESOR", "LEHRERAKTIVIT[ÄA]T"],
    classe: ["ACTIVIT[ÉE] DE LA CLASSE", "STUDENTS['’] ACTIVITY", "ACTIVIDAD DE LA CLASE", "SCH[ÜU]LERAKTIVIT[ÄA]T"],
    trace: ["TRACE [ÉE]CRITE VALID[ÉE]E", "VALIDATED NOTES", "APUNTES VALIDADOS", "G[ÜU]LTIGE MITSCHRIFT"]
};

function nettoyerLigneFiche(ligne) {
    return ligne.trim()
        .replace(/^[#*>\-•\s]+/, '')
        .replace(/^\d+[.)]\s*/, '') // ex: "1. IDENTIFICATION" -> "IDENTIFICATION" (numérotation du canevas primaire)
        .replace(/[\s:]+$/, '');
}

// Repère, dans le TEXTE ENTIER (pas ligne par ligne), toutes les
// occurrences de libellés de section et de phase, avec leur position
// exacte (utile pour ensuite découper le contenu associé à chacune par
// simple différence de position avec l'occurrence suivante -- quel que
// soit son type). Triées par ordre d'apparition dans le document.
function trouverOccurrencesFiche(texte) {
    const occurrences = [];

    Object.entries(ALTERNATIVES_SECTION_FICHE).forEach(([type, variantes]) => {
        // ❖ Permissif à dessein : le modèle ne se limite pas toujours au
        // libellé nu ("PARTIE A") -- il écrit parfois "PARTIE A :
        // ÉVALUATION DES RESSOURCES (10 POINTS)" sur la même ligne. On
        // exige seulement que la ligne COMMENCE par le libellé recherché ;
        // tout ce qui suit sur cette même ligne est absorbé dans la
        // légende affichée plutôt que de faire échouer la détection.
        const re = new RegExp(`^[ \\t]*(?:[-•#*>]\\s*)?(?:${variantes.join('|')}).*$`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++; // garde-fou anti-boucle infinie
        }
    });

    Object.entries(ALTERNATIVES_PHASE_FICHE).forEach(([type, variantes]) => {
        const re = new RegExp(`^[ \\t]*(?:[-•]\\s*)?(?:${variantes.join('|')})[ \\t]*:[ \\t]*`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++;
        }
    });

    occurrences.sort((a, b) => a.start - b.start);
    return occurrences;
}

// ❖ Le prompt de la Forge n'interdit pas non plus les séparateurs visuels
// ("---", "***", parfois un vrai tableau Markdown "| A | B |" avec sa ligne
// "|---|---|") : sans ce filtre, ces lignes se seraient affichées telles
// quelles comme un badge/une ligne de contenu vide ou du charabia à
// pipes ("| Habiletés | Contenus |" littéral) une fois sorties du contexte
// où marked.parse les interprétait auparavant comme un <hr>/<table>.
function estLigneSeparatriceFiche(ligne) {
    return /^[\s\-_*|:]{3,}$/.test(ligne);
}

// ❖ Champs d'identification reconnus. Le prompt exige "un champ par ligne"
// (Classe, Matière, Leçon, Semaine, Documents de référence, etc.), mais le
// modèle agglutine parfois plusieurs champs sur une seule ligne malgré
// cette consigne ("Leçon : X : Semaine : Y Documents de référence : Z").
// Comme la règle est déterministe (l'ordre des champs n'a pas besoin
// d'interprétation), on la fait respecter ici plutôt que d'empiler encore
// des reformulations de prompt qui ne changent rien à ce genre d'oubli
// ponctuel du modèle.
const CHAMPS_IDENTIFICATION_CONNUS_FICHE = [
    'Classe', 'Mati[èe]re', 'Effectif', 'Dur[ée]e', 'Le[çc]on', 'Semaine',
    'S[ée]quence', 'S[ée]ance', 'Support', 'Documents?\\s+de\\s+r[ée]f[ée]rence',
    'Th[èe]me', 'Comp[ée]tence',
    // ❖ Champs propres au canevas "Plan de session hebdomadaire" (PNAPAS,
    // classe hétérogène) -- voir analyserFichePlanHebdo().
    'Groupe de niveau', 'Objectif mensuel', 'Objectif de la semaine'
];

// Sépare une ligne d'identification qui agglutine plusieurs champs connus
// ("Label : valeur Label2 : valeur2") en autant de lignes "Label : valeur"
// distinctes. Ligne sans agglutination (0 ou 1 champ reconnu) -> renvoyée
// telle quelle, dans un tableau à un seul élément : aucun changement de
// comportement pour le cas normal, déjà correctement géré ligne par ligne.
function decouperChampsAgglutinesLigneFiche(ligne) {
    const motif = new RegExp(`(?:${CHAMPS_IDENTIFICATION_CONNUS_FICHE.join('|')})\\s*:`, 'gi');
    const positions = [];
    let m;
    while ((m = motif.exec(ligne)) !== null) {
        positions.push(m.index);
        if (m[0].length === 0) motif.lastIndex++;
    }
    if (positions.length <= 1) return [ligne];
    return positions.map((debut, i) => {
        const fin = i + 1 < positions.length ? positions[i + 1] : ligne.length;
        return ligne.slice(debut, fin).trim().replace(/[\s:]+$/, '');
    });
}

// ❖ Filet de sécurité pour les valeurs "creuses" (placeholders) que le
// modèle glisse parfois malgré la consigne explicite de les omettre
// ("Effectif : (à compléter)", "Semaine : (à préciser)"...) — y compris
// pour Effectif, alors même que le prompt cite déjà cet exemple précis
// comme interdit. Plutôt que d'empiler une énième reformulation de
// prompt pour un cas déjà nommé explicitement, on neutralise ici le
// symptôme visible, de façon déterministe : si la valeur entière n'est
// qu'un tel commentaire, elle est vidée. Le badge garde son étiquette
// ("Effectif :") mais reste vide -- exactement le rendu voulu pour un
// champ que l'instituteur remplit lui-même à la main.
const MOTIF_VALEUR_CREUSE_FICHE = /^\(?\s*[àa]\s*(compl[ée]ter|pr[ée]ciser|remplir|d[ée]finir|ajuster)\b[^)]*\)?\.?\s*$/i;
function nettoyerValeurChampCreuseFiche(valeur) {
    return MOTIF_VALEUR_CREUSE_FICHE.test((valeur || '').trim()) ? '' : valeur;
}

// Si le modèle a malgré tout écrit une vraie ligne de tableau Markdown
// ("| Expliquer | La formation... |"), on retire les pipes et on
// recompose une ligne lisible plutôt que d'afficher les barres verticales
// littéralement.
function nettoyerLigneTableauFiche(ligne) {
    if (/^\s*\|.*\|\s*$/.test(ligne)) {
        const cellules = ligne.split('|').map(c => c.trim()).filter(Boolean);
        return cellules.join('  —  ');
    }
    return ligne;
}

function echapperHTMLFiche(s) {
    return (s || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Conversion très légère (paragraphes/listes) sans passer par marked.parse
// en entier -- les astérisques de gras résiduels sont déjà neutralisés en
// amont par analyserFicheLecon(), il ne reste ici qu'à filtrer les lignes
// purement séparatrices ("---", etc., voir estLigneSeparatriceFiche) et à
// reconstituer paragraphes/listes.
function texteVersHtmlLegerFiche(bloc) {
    if (!bloc) return '';
    const echappe = echapperHTMLFiche(bloc);
    const paragraphes = echappe.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    // ❖ Le modèle produit souvent des listes "aérées" : une puce isolée
    // par paragraphe, séparée de la suivante par une ligne vide (plutôt
    // que des puces collées sur des lignes consécutives). Sans ce
    // regroupement, chaque puce isolée retombait dans la branche <p>
    // ci-dessous avec son "- " laissé tel quel au lieu de devenir une
    // vraie liste -- visible par ex. sur OBJECTIFS DE L'ÉVALUATION
    // (Forge Primaire) ou BARÈME.
    const blocs = [];
    paragraphes.forEach(p => {
        const lignes = p.split('\n').map(l => l.trim()).filter(l => l && !estLigneSeparatriceFiche(l));
        if (!lignes.length) return;
        const estPuceUnique = lignes.length === 1 && /^[-•]\s+/.test(lignes[0]);
        const dernier = blocs[blocs.length - 1];
        if (estPuceUnique && dernier && dernier.estListe) {
            dernier.lignes.push(lignes[0]);
        } else if (estPuceUnique) {
            blocs.push({ estListe: true, lignes: [lignes[0]] });
        } else {
            blocs.push({ estListe: false, lignes });
        }
    });

    return blocs.map(b => {
        const toutesEnListe = b.estListe || (b.lignes.length > 1 && b.lignes.every(l => /^[-•]\s+/.test(l)));
        if (toutesEnListe) {
            return '<ul>' + b.lignes.map(l => `<li>${l.replace(/^[-•]\s+/, '')}</li>`).join('') + '</ul>';
        }
        return `<p>${b.lignes.join('<br>')}</p>`;
    }).filter(Boolean).join('');
}

// Sépare un segment de texte (contenu entre la fin d'une "TRACE ÉCRITE
// VALIDÉE" et le début de la phase suivante) entre la trace elle-même et
// le titre de la phase suivante (ex: "2. Développement :"), sur la base
// du dernier paragraphe s'il est court -- heuristique volontairement
// prudente : en cas de doute, tout reste dans la trace plutôt que de
// risquer de tronquer un titre au mauvais endroit.
function separerTraceEtTitreSuivant(segment) {
    const paragraphes = segment.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphes.length === 0) return { trace: '', titreSuivant: '' };
    if (paragraphes.length === 1) return { trace: paragraphes[0], titreSuivant: '' };
    const dernier = paragraphes[paragraphes.length - 1];
    if (dernier.length <= 80 && !dernier.includes('\n')) {
        return { trace: paragraphes.slice(0, -1).join('\n\n'), titreSuivant: dernier.replace(/^[-•\s]+/, '') };
    }
    return { trace: paragraphes.join('\n\n'), titreSuivant: '' };
}

function analyserFicheLecon(texteBrut) {
    // ❖ Le prompt de la Forge n'interdit pas explicitement le Markdown
    // (contrairement à celui de l'Atelier des Évaluations) : le modèle
    // décore parfois ses propres titres de section avec des "**" (gras).
    // Comme la détection des libellés ci-dessous exige une correspondance
    // exacte de la ligne, un seul "**" résiduel suffisait à la faire
    // échouer entièrement (repli silencieux vers l'affichage brut). On
    // neutralise donc toute étoile avant l'analyse -- la fiche ne contient
    // jamais de vrai Markdown à préserver, cette perte est sans risque.
    const texte = (texteBrut || '')
        .replace(/❖\s*Architecture Pédagogique EdukaTchat[\s\S]*/, '')
        .replace(/\*/g, '')
        // ❖ Le modèle décore parfois ses titres avec du vrai Markdown de
        // titre ("### BARÈME", "#### EXERCICE 1 : ...") -- la détection de
        // libellé ci-dessous ne tolérait qu'UN SEUL "#" en préfixe, donc
        // un "###"/"####" faisait échouer le repérage de toute la section
        // (repli silencieux vers l'affichage brut, "###"/"####" laissés
        // tels quels dans le texte). On retire toute suite de "#" en
        // début de ligne, comme pour les "*" ci-dessus.
        .replace(/^#+\s*/gm, '')
        .trim();
    if (!texte) return null;

    const occurrences = trouverOccurrencesFiche(texte);
    const aHeader = occurrences.some(o => o.type === 'header');
    const aDeroulement = occurrences.some(o => o.type === 'deroulement');
    if (!aHeader || !aDeroulement) return null;

    // Le contenu associé à une occurrence s'arrête pile au début de la
    // PROCHAINE occurrence (quel que soit son type) -- fonctionne aussi
    // bien pour les grandes sections (contenu jusqu'au prochain titre) que
    // pour les libellés de phase (contenu jusqu'au libellé suivant).
    function contenuApres(occ) {
        const idx = occurrences.indexOf(occ);
        const finBorne = idx + 1 < occurrences.length ? occurrences[idx + 1].start : texte.length;
        // ❖ Un <br> littéral s'infiltre parfois hors du tableau de
        // déroulement (le seul endroit où il est légitime, cf.
        // nettoyerLigneTableauFiche) -- notamment dans le TABLEAU
        // HABILETÉS/CONTENUS -- et s'affichait alors comme du texte brut
        // ("... <br> - Calculer...") au lieu d'un retour à la ligne. On le
        // convertit ici, au point d'extraction partagé par toutes les
        // sections hors tableau.
        return texte.slice(occ.end, finBorne).replace(/<br\s*\/?>/gi, '\n').trim();
    }

    const titres = {};
    occurrences.forEach(o => { if (!(o.type in titres)) titres[o.type] = o.texte; });

    const occHeader = occurrences.find(o => o.type === 'header');
    const occTableau = occurrences.find(o => o.type === 'tableau');
    const occSituation = occurrences.find(o => o.type === 'situation');
    const occDeroulement = occurrences.find(o => o.type === 'deroulement');

    // --- En-tête : lignes "Label : Valeur" -> badges. Les lignes
    // purement séparatrices ("---" utilisé par le modèle comme délimiteur
    // visuel entre sections) sont ignorées plutôt que de devenir un badge
    // vide.
    const badges = [];
    if (occHeader) {
        contenuApres(occHeader).split('\n').flatMap(decouperChampsAgglutinesLigneFiche).forEach(l => {
            // ❖ Retire un éventuel marqueur de liste ("- Classe : CM2")
            // AVANT de chercher le ":" -- sinon il reste collé au libellé
            // du badge ("- Classe" au lieu de "Classe").
            // ❖ "+" et non un seul caractère : une ligne séparatrice ("---")
            // ne perdait qu'UN tiret ("- Classe" -> "Classe" fonctionnait,
            // mais "---" -> "--" ne faisait plus les 3 caractères exigés par
            // estLigneSeparatriceFiche ci-dessous, et survivait comme badge
            // fantôme vide en fin d'identification.
            const l2 = l.trim().replace(/^[-•]+\s*/, '');
            if (!l2 || estLigneSeparatriceFiche(l2)) return;
            const sepIdx = l2.indexOf(':');
            if (sepIdx > -1 && sepIdx < 60) {
                badges.push({ label: l2.slice(0, sepIdx).trim(), valeur: nettoyerValeurChampCreuseFiche(l2.slice(sepIdx + 1).trim()) });
            } else {
                badges.push({ label: '', valeur: l2 });
            }
        });
    }

    // --- Tableau des habiletés : liste simple (une ligne = une rangée),
    // sans grille -- exactement l'esprit "ligne horizontale subtile"
    // demandé plutôt qu'un vrai tableau à colonnes. Si le modèle a quand
    // même produit un vrai tableau Markdown ("| A | B |" + sa ligne
    // "|---|---|"), on retire les pipes/séparateurs plutôt que de les
    // afficher tels quels.
    // ❖ Les deux mots de l'en-tête (ex: "Habiletés" / "Contenus") sont
    // parfois écrits sur deux lignes SÉPARÉES plutôt que combinées sur une
    // seule -- le second mot, seul sur sa ligne, ne matchait alors jamais
    // (le groupe 1 exigeait "Habiletés", le groupe 2 "Contenus" était
    // optionnel mais ne pouvait pas apparaître seul) et se glissait comme
    // fausse ligne de tableau. Les deux mots sont donc désormais acceptés
    // indifféremment en position 1 OU 2, seuls ou combinés.
    const motifEnTeteColonnes = /^(Habilet[ée]s?|Skills?|Habilidades?|F[äa]higkeiten|Contenus?|Contents?|Contenidos?|Inhalte)\s*[:\-]?\s*(Habilet[ée]s?|Skills?|Habilidades?|F[äa]higkeiten|Contenus?|Contents?|Contenidos?|Inhalte)?$/i;
    const lignesTableau = occTableau
        ? contenuApres(occTableau)
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !estLigneSeparatriceFiche(l))
            .map(l => nettoyerLigneTableauFiche(l))
            .filter(l => !motifEnTeteColonnes.test(l.replace(/\s*—\s*/g, ' ').trim()))
        : [];

    // --- Situation d'apprentissage
    const situationTexte = occSituation ? contenuApres(occSituation) : '';

    // --- Déroulement : repérage des triples prof/classe/trace, dans
    // l'ordre, sans supposer un nombre fixe de phases (le bouton "Ajouter
    // des activités" peut en générer davantage). Le déroulement est
    // toujours la dernière grande section du document.
    const deroulementDebut = occDeroulement.end;
    const deroulementFin = texte.length;
    const marqueursPhase = occurrences.filter(o =>
        ['prof', 'classe', 'trace'].includes(o.type) && o.start >= deroulementDebut && o.start < deroulementFin
    );

    const phases = [];
    let titreCourant = (() => {
        const premierProf = marqueursPhase.find(m => m.type === 'prof');
        if (!premierProf) return '';
        return texte.slice(deroulementDebut, premierProf.start).replace(/^[\s\-•]+/, '').trim();
    })();

    for (let k = 0; k < marqueursPhase.length;) {
        const mProf = marqueursPhase[k];
        if (!mProf || mProf.type !== 'prof') { k++; continue; }
        const mClasse = marqueursPhase[k + 1] && marqueursPhase[k + 1].type === 'classe' ? marqueursPhase[k + 1] : null;
        const mTrace = mClasse && marqueursPhase[k + 2] && marqueursPhase[k + 2].type === 'trace' ? marqueursPhase[k + 2] : null;

        const contenuProf = texte.slice(mProf.end, mClasse ? mClasse.start : deroulementFin).trim();
        const contenuClasse = mClasse ? texte.slice(mClasse.end, mTrace ? mTrace.start : deroulementFin).trim() : '';

        let contenuTrace = '';
        let titreSuivant = '';
        if (mTrace) {
            const prochainProf = marqueursPhase.slice(k + 3).find(m => m.type === 'prof');
            const finSegment = prochainProf ? prochainProf.start : deroulementFin;
            // On ne coupe pas juste avant le prochain "prof" : il faut
            // englober aussi son titre de phase pour pouvoir l'en extraire.
            const separation = separerTraceEtTitreSuivant(texte.slice(mTrace.end, finSegment).trim());
            contenuTrace = separation.trace;
            titreSuivant = separation.titreSuivant;
        }

        phases.push({ titre: titreCourant, prof: contenuProf, classe: contenuClasse, trace: contenuTrace });
        titreCourant = titreSuivant;
        k += mTrace ? 3 : (mClasse ? 2 : 1);
    }

    if (!phases.length) return null;

    return { badges, lignesTableau, situationTexte, phases, titres };
}

function construireHTMLFiche(analyse, classeAccent) {
    const { badges, lignesTableau, situationTexte, phases, titres } = analyse;
    let html = '';

    if (badges.length) {
        html += `<div class="fiche-section-titre">🧭 ${echapperHTMLFiche(titres.header || '')}</div>`;
        html += '<div class="fiche-bloc-entete">';
        badges.forEach(b => {
            const estCompetence = /comp[ée]t|competenc|kompetenz/i.test(b.label);
            html += `<span class="fiche-badge${estCompetence ? ' fiche-badge-competence' : ''}">`;
            if (b.label) html += `<span class="fiche-badge-label">${echapperHTMLFiche(b.label)} :</span> `;
            html += `${echapperHTMLFiche(b.valeur)}</span>`;
        });
        html += '</div>';
    }

    if (lignesTableau.length) {
        html += `<div class="fiche-section-titre">📋 ${echapperHTMLFiche(titres.tableau || '')}</div>`;
        html += '<div class="fiche-carte fiche-liste-simple">';
        lignesTableau.forEach(l => {
            html += `<div>${echapperHTMLFiche(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</div>`;
        });
        html += '</div>';
    }

    if (situationTexte) {
        html += `<div class="fiche-section-titre">💡 ${echapperHTMLFiche(titres.situation || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(situationTexte)}</div>`;
    }

    if (phases.length) {
        html += `<div class="fiche-section-titre">🧑‍🏫 ${echapperHTMLFiche(titres.deroulement || '')}</div>`;
        phases.forEach(p => {
            html += '<div class="fiche-carte fiche-phase">';
            if (p.titre) html += `<div class="fiche-phase-titre">${echapperHTMLFiche(p.titre)}</div>`;
            if (p.prof) html += `<div class="fiche-phase-ligne"><span class="fiche-phase-legende legende-prof">🗣️ ${echapperHTMLFiche(titres.prof || '')}</span>${texteVersHtmlLegerFiche(p.prof)}</div>`;
            if (p.classe) html += `<div class="fiche-phase-ligne"><span class="fiche-phase-legende">✍️ ${echapperHTMLFiche(titres.classe || '')}</span>${texteVersHtmlLegerFiche(p.classe)}</div>`;
            if (p.trace) html += `<div class="fiche-phase-ligne"><span class="fiche-phase-legende legende-trace">📌 ${echapperHTMLFiche(titres.trace || '')}</span>${texteVersHtmlLegerFiche(p.trace)}</div>`;
            html += '</div>';
        });
    }

    return `<div class="fiche-lecon${classeAccent || ''}">${html}</div>`;
}

// Point d'entrée : tente le rendu enrichi, ou renvoie null pour laisser
// l'appelant se replier sur marked.parse (comportement historique).
function construireRenduFiche(source, outil) {
    let corps = source;
    let signatureHTML = '';
    const idxDebut = corps.indexOf(JETON_SIGNATURE_DEBUT);
    if (idxDebut !== -1) {
        signatureHTML = corps.slice(idxDebut);
        corps = corps.slice(0, idxDebut);
    }

    const analyse = analyserFicheLecon(corps);
    if (!analyse) return null;

    const classeAccent = outil === 'forge_primaire' ? ' accent-vert' : '';
    let html = construireHTMLFiche(analyse, classeAccent);

    if (signatureHTML) {
        let sigParsed = marked.parse(signatureHTML);
        sigParsed = sigParsed
            .replace(JETON_SIGNATURE_DEBUT, '<span class="signature-doc">')
            .replace(JETON_SIGNATURE_FIN, '</span>');
        html += sigParsed;
    }
    return html;
}

// =======================================================================
// ❖ LA CARTE "FICHE PRIMAIRE" — RESKIN VISUEL (FORGE PRIMAIRE) ❖
// =======================================================================
// La Forge Primaire suit un canevas propre au primaire ivoirien, distinct
// de celui du secondaire : 8 sections numérotées (IDENTIFICATION,
// COMPÉTENCE, THÈME, LEÇON, SITUATION D'APPRENTISSAGE, TABLEAU
// HABILÉTÉS/CONTENUS, MATÉRIEL DIDACTIQUE, DÉROULEMENT PÉDAGOGIQUE), ce
// dernier se déclinant en trois moments simples (PRÉSENTATION,
// DÉVELOPPEMENT, ÉVALUATION/RÉINVESTISSEMENT) -- PAS le triple ACTIVITÉ DU
// PROFESSEUR / ACTIVITÉ DE LA CLASSE / TRACE ÉCRITE du secondaire. Toutes
// ces sections sont des titres seuls sur leur ligne (parfois précédés
// d'un numéro "1.", "8."), jamais des libellés en ligne avec leur
// contenu -- un seul type de motif suffit donc ici, pas de distinction
// majeures/inline comme pour le secondaire.
const ALTERNATIVES_SECTION_FICHE_PRIMAIRE = {
    // ❖ "FICHE DE PR[ÉE]PARATION" ajouté le 29/08/2026 : le modèle renomme
    // parfois tout le bloc d'en-tête ainsi au lieu de "IDENTIFICATION"
    // (observé sur une fiche CE1 Français "La phrase" qui ne comportait
    // aucun titre IDENTIFICATION du tout -- toute la fiche échouait alors
    // silencieusement à être reconnue, repli sur l'affichage brut
    // générique). Risque théorique non observé en pratique : si une fiche
    // portait un jour un titre de couverture "FICHE DE PRÉPARATION" suivi
    // PLUS LOIN d'un vrai titre IDENTIFICATION distinct, seul le premier
    // (la couverture) serait retenu comme zone d'identification -- à
    // surveiller si ce cas se présente un jour.
    identification: ["IDENTIFICATION", "FICHE DE PR[ÉE]PARATION"],
    competence: ["COMP[ÉE]TENCE"],
    theme: ["TH[ÈE]ME"],
    lecon: ["LE[ÇC]ON"],
    situation: ["SITUATION D['’]APPRENTISSAGE"],
    // ❖ "CONTENUS" seul est accepté en plus des deux libellés complets :
    // au CE2 en français, le PNAPAS supprime le tableau des habiletés et
    // rebaptise la section "Contenus" (phrases verbales). Sans cet alias,
    // la ligne n'était pas reconnue comme un titre de section et son
    // contenu se retrouvait absorbé dans la SITUATION D'APPRENTISSAGE.
    tableau: ["TABLEAU HABIL[ÉE]T[ÉE]S\\s*/?\\s*CONTENUS", "TABLEAU DES HABIL[ÉE]T[ÉE]S ET CONTENUS", "CONTENUS\\s*:?\\s*$"],
    materiel: ["MAT[ÉE]RIEL DIDACTIQUE"],
    deroulement: ["D[ÉE]ROULEMENT P[ÉE]DAGOGIQUE"],
    presentation: ["PR[ÉE]SENTATION"],
    developpement: ["D[ÉE]VELOPPEMENT"],
    evaluationPhase: ["[ÉE]VALUATION\\s*/?\\s*R[ÉE]INVESTISSEMENT", "R[ÉE]INVESTISSEMENT", "[ÉE]VALUATION"],
    // ❖ La trace écrite n'était reconnue nulle part dans la carte APC :
    // faute d'être un titre de section, elle était absorbée dans le contenu
    // de la phase qui la précédait (le plus souvent ÉVALUATION) et
    // s'affichait noyée à l'intérieur de celle-ci. Or c'est ce que
    // l'instituteur recopie au tableau : il doit la retrouver d'un coup
    // d'œil. La déclarer ici la borne proprement et lui rend sa section.
    trace: ["TRACE [ÉE]CRITE"]
};

function trouverOccurrencesFichePrimaire(texte) {
    const occurrences = [];
    Object.entries(ALTERNATIVES_SECTION_FICHE_PRIMAIRE).forEach(([type, variantes]) => {
        // ❖ Préfixe élargi par rapport au secondaire : le canevas primaire
        // numérote explicitement chaque section ("1. IDENTIFICATION",
        // "8. DÉROULEMENT PÉDAGOGIQUE").
        const re = new RegExp(`^[ \\t]*(?:[-•#*>]\\s*|\\d+[.)]\\s*)?(?:${variantes.join('|')}).*$`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++;
        }
    });
    occurrences.sort((a, b) => a.start - b.start);
    return occurrences;
}

// ❖ Le canevas officiel PNAPAS présente le déroulement sous forme de
// tableau à quatre colonnes (Phases didactiques / Activités de
// l'enseignant.e / Stratégies pédagogiques / Activités des apprenant.e.s).
// Les trois moments s'y trouvent donc DANS des cellules
// ("| PRÉSENTATION | ... |"), alors que trouverOccurrencesFichePrimaire()
// exige un titre seul en début de ligne (préfixes tolérés : -, •, #, *, >
// ou un numéro, mais pas "|"). Sans conversion préalable, `phases` restait
// vide et, le rendu du déroulement étant conditionné à `if (phases.length)`,
// TOUT le bloc disparaissait de la carte alors que le texte était bien là.
// On réécrit donc chaque ligne de tableau dont la première cellule est un
// nom de phase en "titre de phase + contenu étiqueté" ; le reste du
// parseur est inchangé.
const MOTIF_PHASE_CELLULE_FICHE = /^(PR[ÉE]SENTATION|D[ÉE]VELOPPEMENT|[ÉE]VALUATION(?:\s*\/?\s*R[ÉE]INVESTISSEMENT)?|R[ÉE]INVESTISSEMENT)$/i;
const ETIQUETTES_DEFAUT_DEROULEMENT_FICHE = [
    "Activités de l'enseignant.e",
    'Stratégies pédagogiques',
    'Activités des apprenant.e.s'
];

function decouperCellulesTableauFiche(ligne) {
    return ligne.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

function normaliserTableauDeroulementFiche(texte) {
    const lignes = texte.split('\n');
    const sortie = [];
    // Libellés de colonnes du dernier en-tête de tableau rencontré : ils
    // servent à étiqueter les cellules des lignes de phase qui suivent,
    // pour ne pas perdre l'information "qui fait quoi".
    let etiquettes = null;

    lignes.forEach(ligne => {
        if (!/^\s*\|.*\|\s*$/.test(ligne)) { sortie.push(ligne); return; }

        const cellules = decouperCellulesTableauFiche(ligne);
        const premiere = (cellules[0] || '').trim();

        if (!MOTIF_PHASE_CELLULE_FICHE.test(premiere)) {
            // En-tête de tableau (au moins trois colonnes, et pas une
            // ligne de séparation "|---|---|") -> on mémorise ses libellés.
            if (cellules.length >= 3 && !/^[\s\-:|]+$/.test(ligne)) etiquettes = cellules.slice(1);
            sortie.push(ligne);
            return;
        }

        sortie.push(premiere);
        cellules.slice(1).forEach((cellule, i) => {
            // Les cellules multi-lignes sont écrites avec des <br> : on les
            // rend au parseur sous forme de vraies lignes.
            const contenu = cellule.replace(/<br\s*\/?>/gi, '\n').trim();
            if (!contenu) return;
            const etiquette = (etiquettes && etiquettes[i]) || ETIQUETTES_DEFAUT_DEROULEMENT_FICHE[i] || '';
            if (etiquette) sortie.push(`${etiquette} :`);
            contenu.split('\n').forEach(l => {
                const l2 = l.trim();
                if (l2) sortie.push(/^[-•]/.test(l2) ? l2 : `- ${l2}`);
            });
        });
    });

    return sortie.join('\n');
}

function analyserFichePrimaire(texteBrut) {
    const texteNettoye = (texteBrut || '')
        .replace(/❖\s*Architecture Pédagogique EdukaTchat[\s\S]*/, '')
        .replace(/\*/g, '')
        // ❖ Le modèle décore parfois ses titres avec du vrai Markdown de
        // titre ("### BARÈME", "#### EXERCICE 1 : ...") -- la détection de
        // libellé ci-dessous ne tolérait qu'UN SEUL "#" en préfixe, donc
        // un "###"/"####" faisait échouer le repérage de toute la section
        // (repli silencieux vers l'affichage brut, "###"/"####" laissés
        // tels quels dans le texte). On retire toute suite de "#" en
        // début de ligne, comme pour les "*" ci-dessus.
        .replace(/^#+\s*/gm, '')
        .trim();
    if (!texteNettoye) return null;

    const texte = normaliserTableauDeroulementFiche(texteNettoye);

    // ❖ Même ambiguïté que la fiche PNAPAS (voir analyserFichePNAPAS) : la
    // fiche APC a ses propres sections COMPÉTENCE / THÈME / LEÇON, mais le
    // modèle les glisse parfois comme simples champs dans le bloc
    // IDENTIFICATION ("Leçon : La multiplication : Semaine : …"). Sans
    // filtre, cette ligne est détectée comme le TITRE d'une section
    // "LEÇON" à part entière, ce qui tronque l'identification en plein
    // milieu et fait disparaître tous les champs suivants (Semaine,
    // Documents de référence...). Distinction retenue : un titre de
    // section est seul sur sa ligne, un champ d'identification porte sa
    // valeur après un deux-points.
    const occurrences = trouverOccurrencesFichePrimaire(texte).filter(o => {
        if (!['competence', 'theme', 'lecon'].includes(o.type)) return true;
        const apresDeuxPoints = (o.texte || '').split(':').slice(1).join(':').trim();
        return !apresDeuxPoints;
    });
    const aIdentification = occurrences.some(o => o.type === 'identification');
    // ❖ Une fiche d'ÉVALUATION primaire suit un canevas différent (pas de
    // DÉROULEMENT PÉDAGOGIQUE) -- son propre parseur dédié prend le relais
    // dans ce cas, voir analyserEvaluationPrimaire() et son appel depuis
    // construireRenduFichePrimaire().
    const aDeroulement = occurrences.some(o => o.type === 'deroulement');
    if (!aIdentification || !aDeroulement) return null;

    function contenuApres(occ) {
        const idx = occurrences.indexOf(occ);
        const finBorne = idx + 1 < occurrences.length ? occurrences[idx + 1].start : texte.length;
        // ❖ Un <br> littéral s'infiltre parfois hors du tableau de
        // déroulement (le seul endroit où il est légitime, cf.
        // nettoyerLigneTableauFiche) -- notamment dans le TABLEAU
        // HABILETÉS/CONTENUS -- et s'affichait alors comme du texte brut
        // ("... <br> - Calculer...") au lieu d'un retour à la ligne. On le
        // convertit ici, au point d'extraction partagé par toutes les
        // sections hors tableau.
        return texte.slice(occ.end, finBorne).replace(/<br\s*\/?>/gi, '\n').trim();
    }

    const titres = {};
    occurrences.forEach(o => { if (!(o.type in titres)) titres[o.type] = o.texte; });

    function contenuDe(type) {
        const occ = occurrences.find(o => o.type === type);
        return occ ? contenuApres(occ) : '';
    }

    // --- En-tête : IDENTIFICATION (Classe/Matière/Effectif/Durée) fournit
    // déjà des lignes "Label : Valeur" -> badges. On y ajoute Compétence,
    // Thème et Leçon comme badges supplémentaires plutôt que d'ouvrir
    // trois mini-sections séparées, pour garder une vue d'ensemble
    // compacte (dans l'esprit "respiration visuelle" demandé).
    const badges = [];
    const occIdentification = occurrences.find(o => o.type === 'identification');
    if (occIdentification) {
        contenuApres(occIdentification).split('\n').flatMap(decouperChampsAgglutinesLigneFiche).forEach(l => {
            // ❖ Retire un éventuel marqueur de liste ("- Classe : CM2")
            // AVANT de chercher le ":" -- sinon il reste collé au libellé
            // du badge ("- Classe" au lieu de "Classe").
            // ❖ "+" et non un seul caractère : une ligne séparatrice ("---")
            // ne perdait qu'UN tiret ("- Classe" -> "Classe" fonctionnait,
            // mais "---" -> "--" ne faisait plus les 3 caractères exigés par
            // estLigneSeparatriceFiche ci-dessous, et survivait comme badge
            // fantôme vide en fin d'identification.
            const l2 = l.trim().replace(/^[-•]+\s*/, '');
            if (!l2 || estLigneSeparatriceFiche(l2)) return;
            const sepIdx = l2.indexOf(':');
            if (sepIdx > -1 && sepIdx < 60) {
                badges.push({ label: l2.slice(0, sepIdx).trim(), valeur: nettoyerValeurChampCreuseFiche(l2.slice(sepIdx + 1).trim()) });
            } else {
                badges.push({ label: '', valeur: l2 });
            }
        });
    }
    ['competence', 'theme', 'lecon'].forEach(type => {
        // ❖ Le modèle intercale volontiers une règle horizontale Markdown
        // ("---") entre deux sections. Sans filtrage, elle restait collée à
        // la valeur du badge ("Le groupement par 10 et la notion de
        // dizaine. ---"). On écarte donc les lignes purement séparatrices,
        // et on recompose la valeur sur une seule ligne.
        const valeur = contenuDe(type)
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !estLigneSeparatriceFiche(l))
            .join(' ')
            .trim();
        if (valeur) badges.push({ label: titres[type] || type, valeur });
    });

    // ❖ Même correctif que la Forge secondaire (voir trouverOccurrencesFiche
    // ci-dessus) : "Habiletés" et "Contenus" acceptés seuls ou combinés,
    // dans n'importe quel ordre.
    const motifEnTeteColonnes = /^(Habilet[ée]s?|Skills?|Contenus?|Contents?)\s*[:\-]?\s*(Habilet[ée]s?|Skills?|Contenus?|Contents?)?$/i;
    const lignesTableau = occurrences.some(o => o.type === 'tableau')
        ? contenuDe('tableau')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !estLigneSeparatriceFiche(l))
            .map(l => nettoyerLigneTableauFiche(l))
            .filter(l => !motifEnTeteColonnes.test(l.replace(/\s*—\s*/g, ' ').trim()))
        : [];

    const situationTexte = contenuDe('situation');
    const materielTexte = contenuDe('materiel');

    // --- Déroulement pédagogique : trois moments simples (titre + texte
    // libre), pas de triple à décoder comme au secondaire.
    // ❖ Bug réel trouvé le 29/08/2026 (fiche CE1 Français "La phrase") : le
    // modèle scinde parfois DÉVELOPPEMENT en plusieurs sous-blocs titrés
    // séparément ("DÉVELOPPEMENT … Je fais" puis "DÉVELOPPEMENT … Nous
    // faisons", convention PNAPAS -- section "Je fais/Nous faisons/Tu fais"
    // du prompt Forge Primaire). L'ancien code ne retenait que la PREMIÈRE
    // occurrence de chaque type (via contenuDe, qui fait occurrences.find),
    // donc le second bloc DÉVELOPPEMENT disparaissait silencieusement --
    // son contenu n'était capté nulle part, y compris pas absorbé par la
    // section suivante. On construit donc désormais une carte par
    // OCCURRENCE de phase (contenuApres, borné par l'occurrence suivante
    // quel que soit son type), pas une carte par type fixe : le cas normal
    // (une seule occurrence par type) produit exactement le même résultat
    // qu'avant, le cas à sous-blocs répétés produit désormais une carte par
    // sous-bloc au lieu d'en perdre le contenu.
    const TYPES_PHASE_FICHE_PRIMAIRE = ['presentation', 'developpement', 'evaluationPhase'];
    const phases = occurrences
        .filter(o => TYPES_PHASE_FICHE_PRIMAIRE.includes(o.type))
        .map(o => ({ type: o.type, titre: o.texte, contenu: contenuApres(o) }))
        .filter(p => p.contenu);

    const traceTexte = contenuDe('trace');

    return { badges, lignesTableau, situationTexte, materielTexte, phases, traceTexte, titres };
}

// ❖ Coloration douce du déroulement de la Fiche APC Primaire par grande
//   phase (28/08/2026 -> 29/08/2026, demande de Constant après la
//   coloration par niveau du Plan de session hebdomadaire) -- volontairement
//   limitée à construireHTMLFichePrimaire (le canevas APC général, cartes
//   empilées) et jamais à .fiche-deroulement-table (le vrai tableau à 4
//   colonnes, partagé par la carte PNAPAS native et l'évaluation, qui n'a
//   pas été demandé ici). Classification par le TITRE de la phase, déjà
//   fiable puisque le prompt impose "PRÉSENTATION", "DÉVELOPPEMENT" et
//   "ÉVALUATION / RÉINVESTISSEMENT" comme intitulés (section 5 du prompt
//   Forge Primaire) -- un titre non reconnu (cas rare) retombe simplement
//   sur l'apparence neutre déjà existante, sans erreur.
function classerPhaseFichePrimaire(titre) {
    const t = (titre || '').toUpperCase();
    if (/PR[ÉE]SENTATION|ROUTINE|CALCULINE/.test(t)) return 'fiche-phase-presentation';
    if (/D[ÉE]VELOPPEMENT/.test(t)) return 'fiche-phase-developpement';
    if (/[ÉE]VALUATION|R[ÉE]INVESTISSEMENT/.test(t)) return 'fiche-phase-evaluation';
    return '';
}

function construireHTMLFichePrimaire(analyse) {
    const { badges, lignesTableau, situationTexte, materielTexte, phases, traceTexte, titres } = analyse;
    let html = '';

    if (badges.length) {
        html += `<div class="fiche-section-titre">🧭 ${echapperHTMLFiche(titres.identification || '')}</div>`;
        html += '<div class="fiche-bloc-entete">';
        badges.forEach(b => {
            const estCompetence = /comp[ée]t/i.test(b.label);
            html += `<span class="fiche-badge${estCompetence ? ' fiche-badge-competence' : ''}">`;
            if (b.label) html += `<span class="fiche-badge-label">${echapperHTMLFiche(b.label)} :</span> `;
            html += `${echapperHTMLFiche(b.valeur)}</span>`;
        });
        html += '</div>';
    }

    if (situationTexte) {
        html += `<div class="fiche-section-titre">💡 ${echapperHTMLFiche(titres.situation || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(situationTexte)}</div>`;
    }

    if (lignesTableau.length) {
        html += `<div class="fiche-section-titre">📋 ${echapperHTMLFiche(titres.tableau || '')}</div>`;
        html += '<div class="fiche-carte fiche-liste-simple">';
        lignesTableau.forEach(l => {
            html += `<div>${echapperHTMLFiche(l)}</div>`;
        });
        html += '</div>';
    }

    if (materielTexte) {
        html += `<div class="fiche-section-titre">🧰 ${echapperHTMLFiche(titres.materiel || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(materielTexte)}</div>`;
    }

    if (phases.length) {
        html += `<div class="fiche-section-titre">🧑‍🏫 ${echapperHTMLFiche(titres.deroulement || '')}</div>`;
        phases.forEach(p => {
            const classePhase = classerPhaseFichePrimaire(p.titre);
            html += `<div class="fiche-carte fiche-phase${classePhase ? ' ' + classePhase : ''}">`;
            html += `<div class="fiche-phase-titre">${echapperHTMLFiche(p.titre)}</div>`;
            html += `<div class="fiche-phase-ligne">${texteVersHtmlLegerFiche(p.contenu)}</div>`;
            html += '</div>';
        });
    }

    // Section à part entière, après le déroulement -- même traitement que
    // dans la carte PNAPAS, pour que les deux canevas se ressemblent.
    if (traceTexte) {
        html += `<div class="fiche-section-titre">✍️ ${echapperHTMLFiche(titres.trace || 'TRACE ÉCRITE')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(traceTexte)}</div>`;
    }

    return `<div class="fiche-lecon accent-vert">${html}</div>`;
}

// =======================================================================
// ❖ LA CARTE "FICHE PNAPAS NATIVE" (FORGE PRIMAIRE) ❖
// =======================================================================
// Le canevas officiel PNAPAS diffère de celui de l'APC sur trois points :
// son identification regroupe thème, séquence, séance, durée, support,
// matériel et documents (là où l'APC ouvre une section COMPÉTENCE, absente
// du modèle PNAPAS) ; son déroulement est un tableau à quatre colonnes
// (Phases didactiques / Activités de l'enseignant.e / Stratégies
// pédagogiques / Activités des apprenant.e.s) ; et au CE2 en français le
// tableau des habiletés disparaît au profit de « Contenus » en phrases
// verbales.
//
// On rend donc ce canevas tel quel plutôt que de le replier dans la carte
// APC : c'est la forme que l'instituteur a sous les yeux en formation, et
// celle que son conseiller pédagogique attend.
//
// Déclencheur : la présence d'un vrai tableau de déroulement à au moins
// trois colonnes dont la première cellule porte un nom de phase. Si le
// modèle n'a pas produit ce tableau, ou si le niveau relève du CM (où le
// PNAPAS n'est pas en vigueur), on renvoie null et la carte APC reprend la
// main -- silencieusement, comme partout ailleurs ici.

const NIVEAUX_HORS_PNAPAS_FICHE = /\bCM\s*[12]\b/i;

// ❖ Le modèle referme volontiers sa réponse par une phrase adressée à
// l'instituteur (« Cette fiche est prête à être utilisée en classe. Si vous
// avez besoin d'une autre séance, n'hésitez pas… »). Placée avant la
// signature, elle atterrissait dans la carte de la trace écrite et se
// retrouvait imprimée au milieu du document que l'instituteur range dans
// son cahier de préparation. On retire donc les derniers paragraphes qui
// s'adressent visiblement au lecteur -- jamais ceux du milieu, pour ne pas
// amputer un contenu pédagogique qui emploierait « vous ».
const MOTIF_PHRASE_ACCOMPAGNEMENT_FICHE = /n'h[ée]sitez pas|si vous (?:avez besoin|souhaitez|voulez|le souhaitez)|cette fiche est pr[êe]te|dites-moi si|je (?:peux|reste) (?:vous|[àa] votre)|souhaitez-vous (?:que|des|une)/i;

function retirerPhrasesAccompagnementFiche(texte) {
    const paragraphes = texte.split(/\n\s*\n/);
    // ❖ Un simple séparateur ("---") qui introduisait la phrase
    // d'accompagnement devient orphelin une fois celle-ci retirée : on le
    // retire lui aussi, sans quoi il s'affiche tel quel (marked.parse ne le
    // reconnaît plus comme ligne horizontale une fois collé au jeton de fin
    // de signature).
    const estParagrapheAccessoire = p =>
        MOTIF_PHRASE_ACCOMPAGNEMENT_FICHE.test(p) || estLigneSeparatriceFiche(p.trim());
    while (paragraphes.length && estParagrapheAccessoire(paragraphes[paragraphes.length - 1])) {
        paragraphes.pop();
    }
    return paragraphes.join('\n\n').trim();
}

function extraireLignesTableauDeroulementFiche(region) {
    const lignes = region.split('\n').map(l => l.trim()).filter(Boolean);
    const enTetes = [];
    const rangs = [];

    lignes.forEach(ligne => {
        if (!/^\|.*\|$/.test(ligne)) return;
        if (/^[\s\-:|]+$/.test(ligne)) return;
        const cellules = decouperCellulesTableauFiche(ligne);
        if (cellules.length < 3) return;

        // ❖ La cellule de phase porte souvent un sous-titre sur une seconde
        // ligne ("PRÉSENTATION <br> Routine", "DÉVELOPPEMENT <br>
        // J'apprends") : on teste donc sa PREMIÈRE ligne, une fois les
        // <br> convertis, et non la cellule entière.
        const premiereLigne = (cellules[0] || '').replace(/<br\s*\/?>/gi, '\n').split('\n')[0].trim();
        if (MOTIF_PHASE_CELLULE_FICHE.test(premiereLigne)) {
            rangs.push(cellules.map(c => c.replace(/<br\s*\/?>/gi, '\n').trim()));
        } else if (!enTetes.length && !rangs.length) {
            enTetes.push(...cellules);
        }
    });

    return { enTetes, rangs };
}

function analyserFichePNAPAS(texteBrut) {
    const texte = (texteBrut || '')
        .replace(/❖\s*Architecture Pédagogique EdukaTchat[\s\S]*/, '')
        .replace(/\*/g, '')
        .replace(/^#+\s*/gm, '')
        .trim();
    if (!texte) return null;

    // ❖ L'identification PNAPAS contient des champs « Thème : … » et
    // « Leçon : … » qui, dans le canevas APC, sont des TITRES de section.
    // Sans ce filtre, la première de ces lignes clôturait l'identification
    // et avalait tous les champs suivants (séquence, séance, support,
    // documents) comme s'ils étaient le contenu de la section THÈME.
    // Distinction retenue : un titre de section est seul sur sa ligne
    // ("3. THÈME"), un champ d'identification porte sa valeur après un
    // deux-points ("- Thème : Nombres et opérations").
    const occurrences = trouverOccurrencesFichePrimaire(texte).filter(o => {
        if (o.type !== 'theme' && o.type !== 'lecon') return true;
        const apresDeuxPoints = (o.texte || '').split(':').slice(1).join(':').trim();
        return !apresDeuxPoints;
    });
    const occIdentification = occurrences.find(o => o.type === 'identification');
    const occDeroulement = occurrences.find(o => o.type === 'deroulement');
    if (!occIdentification || !occDeroulement) return null;

    function contenuApres(occ) {
        const idx = occurrences.indexOf(occ);
        const finBorne = idx + 1 < occurrences.length ? occurrences[idx + 1].start : texte.length;
        // ❖ Un <br> littéral s'infiltre parfois hors du tableau de
        // déroulement (le seul endroit où il est légitime, cf.
        // nettoyerLigneTableauFiche) -- notamment dans le TABLEAU
        // HABILETÉS/CONTENUS -- et s'affichait alors comme du texte brut
        // ("... <br> - Calculer...") au lieu d'un retour à la ligne. On le
        // convertit ici, au point d'extraction partagé par toutes les
        // sections hors tableau.
        return texte.slice(occ.end, finBorne).replace(/<br\s*\/?>/gi, '\n').trim();
    }
    function contenuDe(type) {
        const occ = occurrences.find(o => o.type === type);
        return occ ? contenuApres(occ) : '';
    }

    // La région de déroulement court jusqu'à la fin du texte : les phases y
    // sont des cellules, pas des titres de section, donc aucune occurrence
    // ne vient la borner.
    const region = texte.slice(occDeroulement.end);
    const { enTetes, rangs } = extraireLignesTableauDeroulementFiche(region);
    if (!rangs.length) return null;

    const identificationTexte = contenuApres(occIdentification);
    if (NIVEAUX_HORS_PNAPAS_FICHE.test(identificationTexte)) return null;

    const champs = [];
    identificationTexte.split('\n').flatMap(decouperChampsAgglutinesLigneFiche).forEach(l => {
        const l2 = l.trim().replace(/^[-•]+\s*/, '');
        // ❖ estLigneSeparatriceFiche exige au moins trois caractères : une
        // règle courte ("--") passait donc au travers et s'affichait comme
        // un badge vide en fin d'identification. Le "+" ci-dessus (plutôt
        // qu'un seul caractère) traite la cause à la racine : "---" ne perd
        // plus qu'UN tiret ("---" -> "--", toujours trop court) mais la
        // totalité de la ligne séparatrice.
        if (!l2 || estLigneSeparatriceFiche(l2) || /^[\s\-_—–]+$/.test(l2)) return;
        const sepIdx = l2.indexOf(':');
        if (sepIdx > -1 && sepIdx < 60) {
            const label = l2.slice(0, sepIdx).trim();
            let valeur = l2.slice(sepIdx + 1).trim();
            // ❖ Le modèle répète volontiers le libellé dans sa valeur
            // ("Séance : Séance 1 : Lecture de…"), ce qui donne un badge
            // bègue. On retire la répétition en gardant le numéro, qui lui
            // porte une information : "Séance : 1 — Lecture de…".
            const motifRepetition = new RegExp(
                '^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\d+)?\\s*[:.\\-—]?\\s*', 'i');
            valeur = valeur.replace(motifRepetition, (m, num) => (num ? num + ' — ' : ''));
            champs.push({ label, valeur: nettoyerValeurChampCreuseFiche(valeur.trim() || l2.slice(sepIdx + 1).trim()) });
        } else {
            champs.push({ label: '', valeur: l2 });
        }
    });

    // Le thème et la leçon peuvent figurer À LA FOIS comme champ
    // d'identification PNAPAS et comme section APC : on ne les ajoute en
    // badge que s'ils n'ont pas déjà été relevés plus haut.
    const clef = v => v.toLowerCase().replace(/[\s.;:,]+/g, ' ').trim();
    const dejaPresents = new Set(champs.map(c => clef(c.valeur)));
    ['theme', 'lecon'].forEach(type => {
        const valeur = contenuDe(type)
            .split('\n').map(l => l.trim())
            .filter(l => l && !estLigneSeparatriceFiche(l))
            .join(' ').trim();
        if (valeur && !dejaPresents.has(clef(valeur))) {
            champs.push({ label: (titresDe(occurrences, type) || type), valeur });
            dejaPresents.add(clef(valeur));
        }
    });

    // Le reste du déroulement après la dernière ligne de tableau (trace
    // écrite, remarques) : on le conserve plutôt que de le perdre. Si le
    // tableau termine le texte, il n'y a pas de retour à la ligne après le
    // dernier pipe -- sans ce garde-fou, indexOf renvoie -1 et l'on
    // récupérerait le tableau entier en guise de « suite ».
    const idxDernierPipe = region.lastIndexOf('|');
    const idxFinTableau = idxDernierPipe === -1 ? -1 : region.indexOf('\n', idxDernierPipe);
    const apresTableau = idxFinTableau === -1
        ? ''
        : retirerPhrasesAccompagnementFiche(region.slice(idxFinTableau + 1).trim());

    const titres = {};
    occurrences.forEach(o => { if (!(o.type in titres)) titres[o.type] = o.texte; });

    // ❖ Les habiletés/contenus arrivent tantôt en liste, tantôt en tableau
    // Markdown : on décompose les lignes de tableau comme le fait la carte
    // APC, pour ne pas afficher de barres verticales à l'écran.
    const motifEnTeteHabiletes = /^(Habilet[ée]s?|Contenus?)\s*[:\-]?\s*(Habilet[ée]s?|Contenus?)?$/i;
    const contenusTexte = contenuDe('tableau')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !estLigneSeparatriceFiche(l))
        .map(l => (/^\|.*\|$/.test(l) ? nettoyerLigneTableauFiche(l) : l))
        .filter(l => !motifEnTeteHabiletes.test(l.replace(/\s*—\s*/g, ' ').trim()))
        .join('\n');

    return {
        champs,
        situationTexte: contenuDe('situation'),
        contenusTexte,
        materielTexte: contenuDe('materiel'),
        enTetes: enTetes.length >= 3 ? enTetes : ['Phases didactiques', "Activités de l'enseignant.e", 'Stratégies pédagogiques', 'Activités des apprenant.e.s'],
        rangs,
        apresTableau: apresTableau && !/^[\s\-:|]+$/.test(apresTableau) ? apresTableau : '',
        titres,
        // ❖ Coloration par phase (29/08/2026) : une vraie fiche PNAPAS ne
        // comporte jamais de section COMPÉTENCE (section 6 du prompt Forge
        // Primaire) -- sa présence, détectée ici via la même reconnaissance
        // de titres de section que le reste de ce parseur, signale donc
        // sans ambiguïté une fiche APC qui s'est simplement rédigée sous
        // forme de tableau plutôt que de cartes.
        estFicheAPC: occurrences.some(o => o.type === 'competence')
    };
}

function titresDe(occurrences, type) {
    const occ = occurrences.find(o => o.type === type);
    return occ ? occ.texte : '';
}

// ❖ Exception PNAPAS : au CE2 en français, le tableau des habiletés a été
// supprimé au profit d'une simple rubrique « CONTENUS » rédigée en phrases
// verbales. La règle est fixe et sans jugement à porter -- or le modèle
// retombe régulièrement sur le titre par défaut malgré des consignes
// répétées (trois échecs mesurés). On l'impose donc ici, où le résultat est
// déterministe, plutôt que de continuer à le demander au modèle.
function titreContenusFichePNAPAS(champs, titreParDefaut) {
    const valeurDe = motifLabel => {
        const champ = (champs || []).find(c => motifLabel.test(c.label || ''));
        return champ ? (champ.valeur || '') : '';
    };
    const estCE2 = /\bCE\s*2\b/i.test(valeurDe(/classe/i));
    const estFrancais = /fran[çc]ais/i.test(valeurDe(/mati[èe]re/i));
    return (estCE2 && estFrancais) ? 'CONTENUS' : titreParDefaut;
}

function construireHTMLFichePNAPAS(analyse) {
    const { champs, situationTexte, contenusTexte, materielTexte, enTetes, rangs, apresTableau, titres, estFicheAPC } = analyse;
    let html = '';

    if (champs.length) {
        html += `<div class="fiche-section-titre">🧭 ${echapperHTMLFiche(titres.identification || '')}</div>`;
        html += '<div class="fiche-bloc-entete">';
        champs.forEach(c => {
            html += '<span class="fiche-badge">';
            if (c.label) html += `<span class="fiche-badge-label">${echapperHTMLFiche(c.label)} :</span> `;
            html += `${echapperHTMLFiche(c.valeur)}</span>`;
        });
        html += '</div>';
    }

    if (situationTexte) {
        html += `<div class="fiche-section-titre">💡 ${echapperHTMLFiche(titres.situation || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(situationTexte)}</div>`;
    }

    if (contenusTexte) {
        const titreContenus = titreContenusFichePNAPAS(champs, titres.tableau || '');
        html += `<div class="fiche-section-titre">📋 ${echapperHTMLFiche(titreContenus)}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(contenusTexte)}</div>`;
    }

    if (materielTexte) {
        html += `<div class="fiche-section-titre">🧰 ${echapperHTMLFiche(titres.materiel || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(materielTexte)}</div>`;
    }

    // ❖ Coloration par phase du tableau à 4 colonnes (29/08/2026, étendue le
    // 29/08/2026 aux vraies fiches PNAPAS elles-mêmes à la demande de
    // Constant -- "on n'a pas prévu d'embellir ici aussi ?"). Ce même
    // tableau sert à la fois à la vraie fiche PNAPAS (maths/français
    // CP-CE2, jamais de section COMPÉTENCE) et à une fiche APC dont l'agent
    // a spontanément rédigé le déroulement sous forme de tableau plutôt que
    // de cartes (ex. ESC -- voir CLAUDE.md). classerPhaseFichePrimaire ne
    // regarde que le nom de la phase (PRÉSENTATION/DÉVELOPPEMENT/
    // ÉVALUATION), identique dans les deux canevas -- estFicheAPC ne sert
    // donc plus à restreindre la coloration, seulement conservé au cas où
    // un autre usage en aurait besoin plus tard.
    html += `<div class="fiche-section-titre">🧑‍🏫 ${echapperHTMLFiche(titres.deroulement || '')}</div>`;
    html += '<div class="fiche-carte fiche-carte-tableau">';
    html += '<table class="fiche-deroulement-table"><thead><tr>';
    enTetes.forEach(t => { html += `<th>${echapperHTMLFiche(t)}</th>`; });
    html += '</tr></thead><tbody>';
    rangs.forEach(rang => {
        const classePhase = classerPhaseFichePrimaire(rang[0]);
        html += classePhase ? `<tr class="${classePhase}">` : '<tr>';
        enTetes.forEach((enTete, i) => {
            const cellule = rang[i] || '';
            // data-libelle porte le nom de la colonne : c'est lui qui
            // s'affiche en étiquette quand le tableau se replie en cartes
            // sur les petits écrans (voir style.css).
            html += `<td data-libelle="${echapperHTMLFiche(enTete)}">${texteVersHtmlLegerFiche(cellule)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    if (apresTableau) {
        // ❖ La trace écrite est la seule section qui suivait le tableau sans
        // titre : elle s'affichait en carte nue au milieu de sections toutes
        // coiffées d'un intitulé. On la détecte pour lui rendre le sien.
        const motifTrace = /^\s*(TRACE\s+[ÉE]CRITE)\s*:?\s*\n?/i;
        const correspondance = apresTableau.match(motifTrace);
        if (correspondance) {
            html += `<div class="fiche-section-titre">✍️ ${echapperHTMLFiche(correspondance[1])}</div>`;
            html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(apresTableau.slice(correspondance[0].length).trim())}</div>`;
        } else {
            html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(apresTableau)}</div>`;
        }
    }

    return `<div class="fiche-lecon accent-vert fiche-lecon-pnapas">${html}</div>`;
}

// =======================================================================
// ❖ LA CARTE "PLAN DE SESSION HEBDOMADAIRE" (FORGE PRIMAIRE, REMÉDIATION
// PNAPAS, CLASSE HÉTÉROGÈNE) ❖
// =======================================================================
// Ajoutée le 28/08/2026 : ce canevas n'a rien à voir avec une fiche de
// leçon quotidienne -- c'est le plan d'une semaine entière (répartition
// par jour, plusieurs catégories d'activités détaillées, matériel,
// points d'observation), tel que décrit dans le "Guide de Remédiation
// Mathématiques CE-CM" du PNAPAS. Jusqu'ici affiché en Markdown brut,
// faute d'un parseur dédié.
// ❖ Deux variantes réelles observées pour ce canevas (28/08/2026) :
// 1. Une SEULE semaine, détaillée : titre + champs + "DÉTAIL DU PLAN PAR
//    JOUR" (titre explicite) + tableau 7 colonnes + Détail des activités +
//    Matériel + Points d'observation.
// 2. UN MOIS entier, condensé : titre unique, puis plusieurs blocs
//    "Semaine : N" à la suite, chacun avec ses propres champs et son
//    propre tableau (5 colonnes, PAS de titre "DÉTAIL DU PLAN PAR JOUR"),
//    sans Détail des activités/Matériel/Points d'observation.
// "semaine" sert de frontière entre blocs répétés -- "tableau" reste un
// simple titre optionnel À L'INTÉRIEUR d'un bloc (jamais une frontière),
// pour rester transparent dans les deux cas (voir analyserFichePlanHebdo).
const ALTERNATIVES_SECTION_PLAN_HEBDO = {
    identification: ["PLAN DE SESSION HEBDOMADAIRE"],
    semaine: ["Semaine\\b"],
    tableau: ["D[ÉE]TAIL DU PLAN PAR JOUR", "Tableau\\s+hebdomadaire"],
    activites: ["D[ÉE]TAIL DES ACTIVIT[ÉE]S"],
    materiel: ["MAT[ÉE]RIEL N[ÉE]CESSAIRE(?:\\s+POUR\\s+LA\\s+SEMAINE)?"],
    observations: ["POINTS\\s+D['’]OBSERVATION(?:\\s+POUR\\s+L['’]ENSEIGNANT)?"]
};

// Types d'occurrence qui délimitent un bloc "semaine" (jamais "tableau",
// qui n'est qu'un titre optionnel transparent à l'intérieur d'un bloc --
// voir le commentaire ci-dessus).
const TYPES_FRONTIERE_SEMAINE_PLAN_HEBDO = ['semaine', 'activites', 'materiel', 'observations'];

// Une ligne qui est en réalité un TITRE de section connu (ex. "DÉTAIL DU
// PLAN PAR JOUR" isolé dans le bloc d'une semaine, cas de la variante 1)
// ne doit jamais être avalée comme un champ "Label : valeur" -- elle est
// déjà repérée par ailleurs comme occurrence de type 'tableau'.
function estTitreSectionPlanHebdoConnu(ligne) {
    return Object.values(ALTERNATIVES_SECTION_PLAN_HEBDO).some(variantes => {
        const re = new RegExp(`^(?:${variantes.join('|')})\\s*:?\\s*$`, 'i');
        return re.test(ligne.trim());
    });
}

function trouverOccurrencesPlanHebdo(texte) {
    const occurrences = [];
    Object.entries(ALTERNATIVES_SECTION_PLAN_HEBDO).forEach(([type, variantes]) => {
        const re = new RegExp(`^[ \\t]*(?:[-•#*>]\\s*|\\d+[.)]\\s*)?(?:${variantes.join('|')}).*$`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++;
        }
    });
    occurrences.sort((a, b) => a.start - b.start);
    return occurrences;
}

// Contrairement au tableau de déroulement (dont la 1ère colonne porte des
// libellés de PHASE reconnus, voir MOTIF_PHASE_CELLULE_FICHE), le tableau
// hebdomadaire n'a pas de vocabulaire fixe en 1ère colonne (ce sont des
// jours de la semaine) : la 1ère ligne de tableau rencontrée est donc
// toujours l'en-tête, toutes les suivantes sont des rangs de données.
function extraireLignesTableauPlanHebdo(region) {
    const lignes = region.split('\n').map(l => l.trim()).filter(Boolean);
    const enTetes = [];
    const rangs = [];
    lignes.forEach(ligne => {
        if (!/^\|.*\|$/.test(ligne)) return;
        if (/^[\s\-:|]+$/.test(ligne)) return;
        const cellules = decouperCellulesTableauFiche(ligne);
        if (cellules.length < 3) return;
        if (!enTetes.length) {
            enTetes.push(...cellules);
        } else {
            rangs.push(cellules.map(c => c.replace(/<br\s*\/?>/gi, '\n').trim()));
        }
    });
    return { enTetes, rangs };
}

// Découpe le bloc "DÉTAIL DES ACTIVITÉS" en sa hiérarchie réelle :
// catégories numérotées ("1. Lecture des nombres de deux chiffres :") ->
// activités ("- Activité 1 : Lecture du tableau des nombres.") -> points
// (puces libres sous chaque activité). Aucun des découpeurs génériques
// existants (texteVersHtmlLegerFiche) ne préserve cette hiérarchie à trois
// niveaux -- elle est propre à ce canevas.
function structurerActivitesPlanHebdo(texte) {
    if (!texte) return [];
    const lignes = texte.split('\n').map(l => l.trim()).filter(Boolean);
    const categories = [];
    let categorieCourante = null;
    let activiteCourante = null;

    const motifCategorie = /^\d+[.)]\s*(.+?)\s*:?\s*$/;
    const motifActivite = /^[-•]\s*Activit[ée]\s*\d*\s*:\s*(.+)$/i;
    const motifPuce = /^[-•]\s*(.+)$/;

    lignes.forEach(ligne => {
        if (estLigneSeparatriceFiche(ligne)) return;

        const mCategorie = ligne.match(motifCategorie);
        if (mCategorie) {
            categorieCourante = { titre: mCategorie[1].trim(), activites: [] };
            categories.push(categorieCourante);
            activiteCourante = null;
            return;
        }
        if (!categorieCourante) return; // texte avant la première catégorie numérotée -- ignoré

        const mActivite = ligne.match(motifActivite);
        if (mActivite) {
            activiteCourante = { titre: mActivite[1].trim(), points: [] };
            categorieCourante.activites.push(activiteCourante);
            return;
        }

        const mPuce = ligne.match(motifPuce);
        if (mPuce) {
            if (!activiteCourante) {
                // Puce orpheline directement sous la catégorie (pas
                // d'activité nommée) : on lui crée un conteneur sans titre
                // plutôt que de la perdre.
                activiteCourante = { titre: '', points: [] };
                categorieCourante.activites.push(activiteCourante);
            }
            activiteCourante.points.push(mPuce[1].trim());
        }
    });

    return categories;
}

// Découpe le contenu d'UN bloc "Semaine : ..." (déjà isolé par
// analyserFichePlanHebdo, frontières incluses) en ses champs
// d'identification (Groupe de niveau / Objectif mensuel / Objectif de la
// semaine, éventuellement un titre "DÉTAIL DU PLAN PAR JOUR" à ignorer) et
// son propre tableau -- la 1ère ligne "| ... |" rencontrée marque la
// bascule de l'un vers l'autre.
function decouperBlocSemaine(texteBloc) {
    const lignes = texteBloc.split('\n');
    const idxPremiereLigneTableau = lignes.findIndex(l => /^\s*\|.*\|\s*$/.test(l.trim()));
    const champsBrut = idxPremiereLigneTableau === -1 ? texteBloc : lignes.slice(0, idxPremiereLigneTableau).join('\n');
    const tableauBrut = idxPremiereLigneTableau === -1 ? '' : lignes.slice(idxPremiereLigneTableau).join('\n');

    const champs = [];
    champsBrut.split('\n').flatMap(decouperChampsAgglutinesLigneFiche).forEach(l => {
        const l2 = l.trim().replace(/^[-•]+\s*/, '');
        if (!l2 || estLigneSeparatriceFiche(l2) || /^[\s\-_—–]+$/.test(l2)) return;
        if (estTitreSectionPlanHebdoConnu(l2)) return;
        const sepIdx = l2.indexOf(':');
        if (sepIdx > -1 && sepIdx < 60) {
            champs.push({ label: l2.slice(0, sepIdx).trim(), valeur: nettoyerValeurChampCreuseFiche(l2.slice(sepIdx + 1).trim()) });
        } else if (champs.length) {
            // ❖ Ligne sans deux-points : presque toujours la suite d'une
            // valeur rédigée sur plusieurs lignes par l'agent (ex. "Objectif
            // mensuel : ..." suivi d'une deuxième phrase sur sa propre
            // ligne), jamais un nouveau champ indépendant dans cette zone
            // d'identification -- on la rattache donc au champ précédent
            // plutôt que d'en faire une pastille fantôme sans étiquette.
            const dernier = champs[champs.length - 1];
            dernier.valeur = dernier.valeur ? `${dernier.valeur} ${l2}` : l2;
        } else {
            champs.push({ label: '', valeur: l2 });
        }
    });

    // ❖ Même prudence que dans analyserFichePlanHebdo : on ne convertit les
    // <br> qu'à l'intérieur des cellules, jamais avant, sous peine de
    // casser les lignes "| ... |" du tableau en plein milieu.
    const { enTetes, rangs } = extraireLignesTableauPlanHebdo(tableauBrut);

    return { champs, enTetes, rangs };
}

function htmlActivitesPlanHebdo(categories) {
    if (!categories || !categories.length) return '';
    let html = '<div class="plan-hebdo-activites">';
    categories.forEach(cat => {
        html += '<div class="plan-hebdo-categorie">';
        html += `<div class="plan-hebdo-categorie-titre">${echapperHTMLFiche(cat.titre)}</div>`;
        cat.activites.forEach(act => {
            html += '<div class="plan-hebdo-activite">';
            if (act.titre) html += `<div class="plan-hebdo-activite-titre">${echapperHTMLFiche(act.titre)}</div>`;
            if (act.points.length) {
                html += '<ul class="plan-hebdo-activite-points">';
                act.points.forEach(p => { html += `<li>${echapperHTMLFiche(p)}</li>`; });
                html += '</ul>';
            }
            html += '</div>';
        });
        html += '</div>';
    });
    html += '</div>';
    return html;
}

function analyserFichePlanHebdo(texteBrut) {
    const texte = (texteBrut || '')
        .replace(/❖\s*Architecture Pédagogique EdukaTchat[\s\S]*/, '')
        .replace(/\*/g, '')
        .replace(/^#+\s*/gm, '')
        .trim();
    if (!texte) return null;

    const occurrences = trouverOccurrencesPlanHebdo(texte);
    const occIdentification = occurrences.find(o => o.type === 'identification');
    const occsSemaine = occurrences.filter(o => o.type === 'semaine');
    // Signature exigée : sans le titre du canevas ET au moins un bloc
    // "Semaine", ce n'est presque certainement pas un plan de session --
    // repli silencieux vers l'affichage brut.
    if (!occIdentification || !occsSemaine.length) return null;

    function contenuApres(occ) {
        const idx = occurrences.indexOf(occ);
        const finBorne = idx + 1 < occurrences.length ? occurrences[idx + 1].start : texte.length;
        return texte.slice(occ.end, finBorne).replace(/<br\s*\/?>/gi, '\n').trim();
    }
    function contenuDe(type) {
        const occ = occurrences.find(o => o.type === type);
        return occ ? contenuApres(occ) : '';
    }

    // Le titre principal ("PLAN DE SESSION HEBDOMADAIRE — MATHÉMATIQUES CE2")
    // porte souvent la matière/le niveau après le tiret : on le garde comme
    // sous-titre de la carte plutôt que de le perdre. Absent dans la
    // variante "plan mensuel", où le titre est nu -- titrePrincipal reste
    // alors vide, ce que le rendu gère déjà.
    const titrePrincipal = occIdentification.texte
        .replace(/^PLAN\s+DE\s+SESSION\s+HEBDOMADAIRE\s*[—\-:]*\s*/i, '')
        .trim();

    // Chaque bloc "Semaine" s'étend jusqu'à la PROCHAINE frontière (une
    // autre "Semaine", ou Détail des activités/Matériel/Points
    // d'observation) -- jamais jusqu'à une occurrence "tableau", qui n'est
    // qu'un titre optionnel transparent À L'INTÉRIEUR du bloc (variante 1).
    // On tranche le texte BRUT (pas contenuApres, qui convertirait les
    // <br> et casserait les lignes "| ... |" du tableau en plein milieu) --
    // decouperBlocSemaine() et extraireLignesTableauPlanHebdo() se
    // chargent de cette conversion cellule par cellule, une fois les
    // colonnes déjà découpées.
    const semaines = occsSemaine.map(occSem => {
        const idx = occurrences.indexOf(occSem);
        const suivante = occurrences.slice(idx + 1).find(o => TYPES_FRONTIERE_SEMAINE_PLAN_HEBDO.includes(o.type));
        const finBloc = suivante ? suivante.start : texte.length;
        const bloc = decouperBlocSemaine(texte.slice(occSem.end, finBloc));

        // ❖ Le champ "Semaine" lui-même (ex. "Semaine : n°--- du -- au --"
        // ou "Semaine : 3") est porté par l'occurrence-frontière, pas par
        // decouperBlocSemaine -- on le réinjecte en tête des champs pour ne
        // jamais perdre l'information (numéro, date). construireHTMLFiche-
        // PlanHebdo() décide ensuite de l'afficher en badge (une seule
        // semaine) ou en sous-titre (plusieurs semaines, où libelleSemaine
        // sert de numéro affiché plutôt que la simple position dans la
        // liste).
        const sepIdx = occSem.texte.indexOf(':');
        const libelleSemaine = (sepIdx > -1 ? occSem.texte.slice(sepIdx + 1) : '').trim();
        bloc.champs.unshift({ label: 'Semaine', valeur: libelleSemaine });
        bloc.libelleSemaine = libelleSemaine;
        return bloc;
    }).filter(s => s.rangs.length); // garde-fou : une "semaine" sans tableau n'est pas exploitable

    if (!semaines.length) return null;

    return {
        titrePrincipal,
        semaines,
        activites: structurerActivitesPlanHebdo(contenuDe('activites')),
        materielTexte: contenuDe('materiel'),
        observationsTexte: contenuDe('observations')
    };
}

function construireHTMLFichePlanHebdo(analyse) {
    const { titrePrincipal, semaines, activites, materielTexte, observationsTexte } = analyse;
    let html = '';

    html += '<div class="fiche-section-titre">🗓️ PLAN DE SESSION HEBDOMADAIRE'
        + (titrePrincipal ? ' — ' + echapperHTMLFiche(titrePrincipal) : '') + '</div>';

    html += '<div class="fiche-section-titre">📅 Détail du plan par jour</div>';
    semaines.forEach((sem, index) => {
        html += '<div class="plan-hebdo-semaine">';
        // ❖ Le sous-titre "Semaine N" n'apparaît que s'il y a plusieurs
        // semaines (variante "plan mensuel") -- pour une seule semaine
        // (variante détaillée), le badge "Semaine" (avec sa date, ex.
        // "n°--- du -- au --") suffit à s'identifier, un sous-titre
        // répétitif n'apporterait rien. Le libellé réel (numéro déclaré
        // par l'agent) est préféré à la simple position dans la liste,
        // au cas où la numérotation ne serait pas parfaitement séquentielle.
        // Une fois affiché en sous-titre, le badge "Semaine" redondant est
        // retiré des badges pour ne pas répéter l'information deux fois.
        let champsAffiches = sem.champs;
        if (semaines.length > 1) {
            html += `<div class="plan-hebdo-semaine-titre">Semaine ${echapperHTMLFiche(sem.libelleSemaine || String(index + 1))}</div>`;
            champsAffiches = sem.champs.filter(c => c.label !== 'Semaine');
        }
        if (champsAffiches.length) {
            html += '<div class="fiche-bloc-entete">';
            champsAffiches.forEach(c => {
                html += '<span class="fiche-badge">';
                if (c.label) html += `<span class="fiche-badge-label">${echapperHTMLFiche(c.label)} :</span> `;
                html += `${echapperHTMLFiche(c.valeur)}</span>`;
            });
            html += '</div>';
        }
        html += '<div class="fiche-carte fiche-carte-tableau">';
        html += '<table class="fiche-deroulement-table tableau-plan-hebdo"><thead><tr>';
        sem.enTetes.forEach(t => { html += `<th>${echapperHTMLFiche(t)}</th>`; });
        html += '</tr></thead><tbody>';
        // ❖ Coloration douce par niveau (cas hétérogène uniquement, quand une
        // colonne "Groupes de niveau" existe) : la 1ère colonne "Jour" n'est
        // renseignée que sur le 1er rang d'une journée (les rangs suivants
        // l'ont vide) -- ce vide sert de repère naturel pour détecter le
        // début d'une nouvelle journée, sans dépendre d'un nombre de rangs
        // fixe. Le cycle niveau 1/2/3 repart à zéro à chaque journée et
        // tourne indéfiniment si jamais une journée en compte plus de trois,
        // plutôt que de casser l'affichage.
        const idxGroupesNiveau = sem.enTetes.findIndex(t => /groupes?\s+de\s+niveau/i.test(t));
        let niveauCycle = 0;
        sem.rangs.forEach(rang => {
            const nouvelleJournee = (rang[0] || '').trim() !== '';
            if (nouvelleJournee) niveauCycle = 0;
            const classesRang = [];
            if (nouvelleJournee) classesRang.push('plan-hebdo-jour-debut');
            if (idxGroupesNiveau !== -1) classesRang.push(`plan-hebdo-niveau-${(niveauCycle % 3) + 1}`);
            niveauCycle++;
            html += classesRang.length ? `<tr class="${classesRang.join(' ')}">` : '<tr>';
            sem.enTetes.forEach((enTete, i) => {
                const cellule = rang[i] || '';
                const classeCellule = i === idxGroupesNiveau ? ' class="plan-hebdo-cellule-groupe"' : '';
                html += `<td data-libelle="${echapperHTMLFiche(enTete)}"${classeCellule}>${texteVersHtmlLegerFiche(cellule)}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';
    });

    if (activites.length) {
        html += '<div class="fiche-section-titre">🧩 Détail des activités</div>';
        html += '<div class="fiche-carte">' + htmlActivitesPlanHebdo(activites) + '</div>';
    }

    if (materielTexte) {
        html += '<div class="fiche-section-titre">🧰 Matériel nécessaire pour la semaine</div>';
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(materielTexte)}</div>`;
    }

    if (observationsTexte) {
        html += '<div class="fiche-section-titre">🔎 Points d\'observation pour l\'enseignant</div>';
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(observationsTexte)}</div>`;
    }

    return `<div class="fiche-lecon accent-vert fiche-lecon-plan-hebdo">${html}</div>`;
}

// =======================================================================
// ❖ LA CARTE "ÉVALUATION PRIMAIRE" (FORGE PRIMAIRE) ❖
// =======================================================================
// La Forge Primaire ne produit pas que des fiches de préparation : sur
// demande ("Nouvelle fiche d'évaluation"), elle suit un second canevas,
// distinct de celui de la préparation (IDENTIFICATION/.../DÉROULEMENT
// PÉDAGOGIQUE) ET de l'Atelier des Évaluations secondaire (PARTIE A/B) :
// 1. IDENTIFICATION, 2. OBJECTIFS DE L'ÉVALUATION, 3. EXERCICES
// D'ÉVALUATION, 4. BARÈME, 5. CORRIGÉ -- numérotées comme le reste du
// canevas primaire.
// ❖ "exercices" doit repérer le DÉBUT du bloc d'exercices même quand le
// modèle omet le titre de section formel "EXERCICES D'ÉVALUATION" et
// enchaîne directement sur "EXERCICE 1 : ...", "EXERCICE 2 : ...", etc.
// -- cas réel observé. On ajoute donc "EXERCICE 1" (au singulier, avec le
// numéro 1 précisément) comme ancre de repli : elle marque le début du
// bloc SANS créer une nouvelle occurrence à chaque "EXERCICE 2/3/4"
// suivant (qui casserait la découpe en s'arrêtant après le premier
// exercice) -- ceux-ci restent de simples lignes de contenu.
const ALTERNATIVES_SECTION_EVALUATION_PRIMAIRE = {
    identification: ["IDENTIFICATION"],
    objectifs: ["OBJECTIFS DE L['’]?[ÉE]VALUATION", "OBJECTIFS"],
    exercices: ["EXERCICES D['’]?[ÉE]VALUATION", "EXERCICE\\s*(?:N|n)?°?\\s*1\\b"],
    bareme: ["BAR[ÈE]ME"],
    corrige: ["CORRIG[ÉE]"]
};

function trouverOccurrencesEvaluationPrimaire(texte) {
    const occurrences = [];
    Object.entries(ALTERNATIVES_SECTION_EVALUATION_PRIMAIRE).forEach(([type, variantes]) => {
        const re = new RegExp(`^[ \\t]*(?:[-•#*>]\\s*|\\d+[.)]\\s*)?(?:${variantes.join('|')}).*$`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++;
        }
    });
    occurrences.sort((a, b) => a.start - b.start);

    // ❖ "EXERCICE 1" (ancre de repli, voir ALTERNATIVES_SECTION_EVALUATION_
    // PRIMAIRE) réapparaît presque toujours une seconde fois, bien plus
    // loin dans le texte -- le BARÈME et le CORRIGÉ listent chacun "EXERCICE
    // 1 : ..." comme simple sous-point. Sans ce filtre, cette répétition
    // était détectée comme une NOUVELLE occurrence "exercices", ce qui
    // coupait le BARÈME en plein milieu et faisait perdre le CORRIGÉ
    // (absorbé dans le mauvais bloc). Seule la toute première occurrence
    // "exercices" -- la vraie, en tête du bloc -- doit compter.
    let dejaVuExercices = false;
    return occurrences.filter(o => {
        if (o.type !== 'exercices') return true;
        if (dejaVuExercices) return false;
        dejaVuExercices = true;
        return true;
    });
}

function analyserEvaluationPrimaire(texteBrut) {
    const texte = (texteBrut || '')
        .replace(/❖\s*Architecture Pédagogique EdukaTchat[\s\S]*/, '')
        .replace(/\*/g, '')
        // ❖ Le modèle décore parfois ses titres avec du vrai Markdown de
        // titre ("### BARÈME", "#### EXERCICE 1 : ...") -- la détection de
        // libellé ci-dessous ne tolérait qu'UN SEUL "#" en préfixe, donc
        // un "###"/"####" faisait échouer le repérage de toute la section
        // (repli silencieux vers l'affichage brut, "###"/"####" laissés
        // tels quels dans le texte). On retire toute suite de "#" en
        // début de ligne, comme pour les "*" ci-dessus.
        .replace(/^#+\s*/gm, '')
        .trim();
    if (!texte) return null;

    const occurrences = trouverOccurrencesEvaluationPrimaire(texte);
    // ❖ IDENTIFICATION n'est PAS une ancre fiable ici : le modèle omet
    // parfois cette section et enchaîne directement sur un titre libre
    // ("ÉVALUATION DE MATHÉMATIQUES - CM2", Thème/Durée en lignes libres)
    // avant EXERCICE 1 -- ce texte reste alors capté par preambuleTexte
    // (voir plus bas). Seul EXERCICES est systématiquement présent :
    // c'est la seule ancre requise pour reconnaître ce canevas.
    const aExercices = occurrences.some(o => o.type === 'exercices');
    if (!aExercices) return null;

    function contenuApres(occ) {
        const idx = occurrences.indexOf(occ);
        const finBorne = idx + 1 < occurrences.length ? occurrences[idx + 1].start : texte.length;
        // ❖ Un <br> littéral s'infiltre parfois hors du tableau de
        // déroulement (le seul endroit où il est légitime, cf.
        // nettoyerLigneTableauFiche) -- notamment dans le TABLEAU
        // HABILETÉS/CONTENUS -- et s'affichait alors comme du texte brut
        // ("... <br> - Calculer...") au lieu d'un retour à la ligne. On le
        // convertit ici, au point d'extraction partagé par toutes les
        // sections hors tableau.
        return texte.slice(occ.end, finBorne).replace(/<br\s*\/?>/gi, '\n').trim();
    }

    const titres = {};
    occurrences.forEach(o => { if (!(o.type in titres)) titres[o.type] = o.texte; });

    function contenuDe(type) {
        const occ = occurrences.find(o => o.type === type);
        return occ ? contenuApres(occ) : '';
    }

    // ❖ Même filet de sécurité que l'Atelier des Évaluations : le modèle
    // introduit parfois librement la fiche avant "1. IDENTIFICATION"
    // ("Voici une fiche d'évaluation de mathématiques pour le niveau
    // CM2..."), sans quoi cette phrase disparaîtrait silencieusement.
    const preambuleTexte = texte.slice(0, occurrences[0].start).trim();

    const badges = [];
    const occIdentification = occurrences.find(o => o.type === 'identification');
    if (occIdentification) {
        contenuApres(occIdentification).split('\n').flatMap(decouperChampsAgglutinesLigneFiche).forEach(l => {
            // ❖ Retire un éventuel marqueur de liste ("- Classe : CM2")
            // AVANT de chercher le ":" -- sinon il reste collé au libellé
            // du badge ("- Classe" au lieu de "Classe").
            // ❖ "+" et non un seul caractère : une ligne séparatrice ("---")
            // ne perdait qu'UN tiret ("- Classe" -> "Classe" fonctionnait,
            // mais "---" -> "--" ne faisait plus les 3 caractères exigés par
            // estLigneSeparatriceFiche ci-dessous, et survivait comme badge
            // fantôme vide en fin d'identification.
            const l2 = l.trim().replace(/^[-•]+\s*/, '');
            if (!l2 || estLigneSeparatriceFiche(l2)) return;
            const sepIdx = l2.indexOf(':');
            if (sepIdx > -1 && sepIdx < 60) {
                badges.push({ label: l2.slice(0, sepIdx).trim(), valeur: nettoyerValeurChampCreuseFiche(l2.slice(sepIdx + 1).trim()) });
            } else {
                badges.push({ label: '', valeur: l2 });
            }
        });
    }

    const objectifsTexte = contenuDe('objectifs');
    const exercicesTexte = contenuDe('exercices');
    const baremeTexte = contenuDe('bareme');

    // ❖ Même précaution que l'Atelier des Évaluations (secondaire) : le
    // corrigé reprend souvent ses propres numéros d'exercices en
    // sous-titres, qui seraient sinon redétectés comme de nouvelles
    // occurrences et tronqueraient le corrigé après quelques mots -- on
    // va donc jusqu'à la fin du texte plutôt que jusqu'à la prochaine
    // occurrence.
    const occCorrige = occurrences.find(o => o.type === 'corrige');
    const corrigeTexte = occCorrige ? texte.slice(occCorrige.end).trim() : '';

    return { preambuleTexte, badges, objectifsTexte, exercicesTexte, baremeTexte, corrigeTexte, titres };
}

function construireHTMLEvaluationPrimaire(analyse) {
    const { preambuleTexte, badges, objectifsTexte, exercicesTexte, baremeTexte, corrigeTexte, titres } = analyse;
    let html = '';

    if (preambuleTexte) {
        html += `<div class="fiche-preambule">${texteVersHtmlLegerFiche(preambuleTexte)}</div>`;
    }

    if (badges.length) {
        html += `<div class="fiche-section-titre">🧭 ${echapperHTMLFiche(titres.identification || '')}</div>`;
        html += '<div class="fiche-bloc-entete">';
        badges.forEach(b => {
            html += `<span class="fiche-badge">`;
            if (b.label) html += `<span class="fiche-badge-label">${echapperHTMLFiche(b.label)} :</span> `;
            html += `${echapperHTMLFiche(b.valeur)}</span>`;
        });
        html += '</div>';
    }

    if (objectifsTexte) {
        html += `<div class="fiche-section-titre">🎯 ${echapperHTMLFiche(titres.objectifs || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(objectifsTexte)}</div>`;
    }

    if (exercicesTexte) {
        html += `<div class="fiche-section-titre">✏️ ${echapperHTMLFiche(titres.exercices || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(exercicesTexte)}</div>`;
    }

    if (baremeTexte) {
        html += `<div class="fiche-section-titre">📊 ${echapperHTMLFiche(titres.bareme || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(baremeTexte)}</div>`;
    }

    if (corrigeTexte) {
        html += `<div class="fiche-section-titre">🔑 ${echapperHTMLFiche(titres.corrige || '')}</div>`;
        html += `<div class="fiche-carte fiche-corrige">${texteVersHtmlLegerFiche(corrigeTexte)}</div>`;
    }

    return `<div class="fiche-lecon accent-vert">${html}</div>`;
}

function construireRenduFichePrimaire(source) {
    let corps = source;
    let signatureHTML = '';
    const idxDebut = corps.indexOf(JETON_SIGNATURE_DEBUT);
    if (idxDebut !== -1) {
        signatureHTML = corps.slice(idxDebut);
        corps = corps.slice(0, idxDebut);
    }

    // ❖ Deux canevas possibles pour un même outil (forge_primaire) : on
    // tente d'abord la fiche de préparation (la plus fréquente), puis la
    // fiche d'évaluation si la première échoue -- silencieusement, sans
    // jamais afficher d'erreur : si aucune des deux ne correspond, on se
    // replie sur le rendu Markdown standard (voir afficherReponseAvecFondu).
    // ❖ Le plan de session hebdomadaire est tenté en tout premier : son
    // titre ("PLAN DE SESSION HEBDOMADAIRE") est une signature tellement
    // distinctive qu'il n'y a aucun risque de confusion avec les autres
    // canevas -- pas besoin d'attendre que les autres échouent par
    // élimination (ajouté le 28/08/2026).
    const anaPlanHebdo = analyserFichePlanHebdo(corps);
    let html = anaPlanHebdo ? construireHTMLFichePlanHebdo(anaPlanHebdo) : null;

    // ❖ On tente ensuite le canevas PNAPAS natif : il est le plus exigeant
    // (il réclame un vrai tableau de déroulement à quatre colonnes et un
    // niveau du CP au CE2), donc s'il accepte, c'est à coup sûr la bonne
    // carte. La carte APC, plus tolérante, prendrait sinon la main sur des
    // fiches PNAPAS et les afficherait dans le mauvais canevas.
    if (html === null) {
        const anaPnapas = analyserFichePNAPAS(corps);
        html = anaPnapas ? construireHTMLFichePNAPAS(anaPnapas) : null;
    }

    if (html === null) {
        const anaPreparation = analyserFichePrimaire(corps);
        if (anaPreparation) html = construireHTMLFichePrimaire(anaPreparation);
    }

    if (html === null) {
        const anaEvaluation = analyserEvaluationPrimaire(corps);
        if (anaEvaluation) html = construireHTMLEvaluationPrimaire(anaEvaluation);
    }

    if (html === null) return null;

    if (signatureHTML) {
        let sigParsed = marked.parse(signatureHTML);
        sigParsed = sigParsed
            .replace(JETON_SIGNATURE_DEBUT, '<span class="signature-doc">')
            .replace(JETON_SIGNATURE_FIN, '</span>');
        html += sigParsed;
    }
    return html;
}

// =======================================================================
// ❖ LA CARTE "ÉVALUATION" — RESKIN VISUEL (ATELIER DES ÉVALUATIONS) ❖
// =======================================================================
// Même principe que la carte "fiche de leçon" ci-dessus, mais adapté à la
// structure propre à l'Atelier des Évaluations : PARTIE A / PARTIE B
// (terminée par un "BARÈME TOTAL : XX points" en ligne, pas un titre à
// part) / CORRIGÉ. Réutilise les mêmes fonctions génériques
// (echapperHTMLFiche, texteVersHtmlLegerFiche, estLigneSeparatriceFiche,
// nettoyerLigneFiche) -- seuls les libellés reconnus changent.

const ALTERNATIVES_SECTION_EVALUATION = {
    partieA: ["PARTIE A(?:\\s*\\([^)]*\\))?", "PART A(?:\\s*\\([^)]*\\))?", "PARTE A(?:\\s*\\([^)]*\\))?", "TEIL A(?:\\s*\\([^)]*\\))?"],
    partieB: ["PARTIE B(?:\\s*\\([^)]*\\))?", "PART B(?:\\s*\\([^)]*\\))?", "PARTE B(?:\\s*\\([^)]*\\))?", "TEIL B(?:\\s*\\([^)]*\\))?"],
    corrige: ["CORRIG[ÉE]", "ANSWER KEY", "SOLUCIONARIO", "L[ÖO]SUNGEN"]
};

// ❖ Le barème n'est pas un titre à part : le prompt demande explicitement
// "la PARTIE B se termine par 'BARÈME TOTAL : XX points'" -- un libellé en
// tête de ligne suivi de son contenu sur la même ligne, comme les
// libellés de phase de la Forge.
const ALTERNATIVES_INLINE_EVALUATION = {
    bareme: ["BAR[ÈE]ME TOTAL", "TOTAL SCORE", "PUNTUACI[ÓO]N TOTAL", "GESAMTPUNKTZAHL"]
};

function trouverOccurrencesEvaluation(texte) {
    const occurrences = [];

    Object.entries(ALTERNATIVES_SECTION_EVALUATION).forEach(([type, variantes]) => {
        // ❖ Permissif à dessein : le modèle ne se limite pas toujours au
        // libellé nu ("PARTIE A") -- il écrit parfois "PARTIE A :
        // ÉVALUATION DES RESSOURCES (10 POINTS)" sur la même ligne. On
        // exige seulement que la ligne COMMENCE par le libellé recherché ;
        // tout ce qui suit sur cette même ligne est absorbé dans la
        // légende affichée plutôt que de faire échouer la détection.
        const re = new RegExp(`^[ \\t]*(?:[-•#*>]\\s*)?(?:${variantes.join('|')}).*$`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++;
        }
    });

    Object.entries(ALTERNATIVES_INLINE_EVALUATION).forEach(([type, variantes]) => {
        const re = new RegExp(`^[ \\t]*(?:[-•]\\s*)?(?:${variantes.join('|')})[ \\t]*:[ \\t]*`, 'gim');
        let m;
        while ((m = re.exec(texte)) !== null) {
            occurrences.push({ type, start: m.index, end: m.index + m[0].length, texte: nettoyerLigneFiche(m[0]) });
            if (m[0].length === 0) re.lastIndex++;
        }
    });

    occurrences.sort((a, b) => a.start - b.start);
    return occurrences;
}

function analyserEvaluation(texteBrut) {
    const texte = (texteBrut || '')
        .replace(/❖\s*Architecture Pédagogique EdukaTchat[\s\S]*/, '')
        .replace(/\*/g, '')
        // ❖ Le modèle décore parfois ses titres avec du vrai Markdown de
        // titre ("### BARÈME", "#### EXERCICE 1 : ...") -- la détection de
        // libellé ci-dessous ne tolérait qu'UN SEUL "#" en préfixe, donc
        // un "###"/"####" faisait échouer le repérage de toute la section
        // (repli silencieux vers l'affichage brut, "###"/"####" laissés
        // tels quels dans le texte). On retire toute suite de "#" en
        // début de ligne, comme pour les "*" ci-dessus.
        .replace(/^#+\s*/gm, '')
        .trim();
    if (!texte) return null;

    const occurrences = trouverOccurrencesEvaluation(texte);
    const aPartieA = occurrences.some(o => o.type === 'partieA');
    const aPartieB = occurrences.some(o => o.type === 'partieB');
    if (!aPartieA || !aPartieB) return null;

    function contenuApres(occ) {
        const idx = occurrences.indexOf(occ);
        const finBorne = idx + 1 < occurrences.length ? occurrences[idx + 1].start : texte.length;
        // ❖ Un <br> littéral s'infiltre parfois hors du tableau de
        // déroulement (le seul endroit où il est légitime, cf.
        // nettoyerLigneTableauFiche) -- notamment dans le TABLEAU
        // HABILETÉS/CONTENUS -- et s'affichait alors comme du texte brut
        // ("... <br> - Calculer...") au lieu d'un retour à la ligne. On le
        // convertit ici, au point d'extraction partagé par toutes les
        // sections hors tableau.
        return texte.slice(occ.end, finBorne).replace(/<br\s*\/?>/gi, '\n').trim();
    }

    const titres = {};
    occurrences.forEach(o => { if (!(o.type in titres)) titres[o.type] = o.texte; });

    // ❖ Le prompt n'impose aucun en-tête formel : le modèle écrit souvent
    // librement un titre avant "PARTIE A" (ex: "DEVOIR DE SVT - NIVEAU 6E
    // / THÈME : ..."). Sans cette capture, ce texte disparaissait
    // silencieusement -- perte d'information plutôt qu'un simple défaut
    // esthétique.
    const preambuleTexte = texte.slice(0, occurrences[0].start).trim();

    const occPartieA = occurrences.find(o => o.type === 'partieA');
    const occPartieB = occurrences.find(o => o.type === 'partieB');
    const occBareme = occurrences.find(o => o.type === 'bareme');
    const occCorrige = occurrences.find(o => o.type === 'corrige');

    const partieATexte = contenuApres(occPartieA);
    const partieBTexte = contenuApres(occPartieB);
    const baremeTexte = occBareme ? contenuApres(occBareme).split('\n')[0].trim() : '';
    // ❖ Le CORRIGÉ est toujours la toute dernière partie du document (règle
    // explicite du prompt) et reprend souvent ses propres sous-titres
    // "PARTIE A"/"PARTIE B" à l'identique -- on prend donc tout ce qui
    // suit jusqu'à la fin du texte plutôt que jusqu'à la PROCHAINE
    // occurrence, qui serait alors l'un de ces sous-titres dupliqués (et
    // couperait le corrigé après seulement quelques mots).
    const corrigeTexte = occCorrige ? texte.slice(occCorrige.end).trim() : '';

    return { preambuleTexte, partieATexte, partieBTexte, baremeTexte, corrigeTexte, titres };
}

function construireHTMLEvaluation(analyse, classeAccent) {
    const { preambuleTexte, partieATexte, partieBTexte, baremeTexte, corrigeTexte, titres } = analyse;
    let html = '';

    if (preambuleTexte) {
        html += `<div class="fiche-preambule">${texteVersHtmlLegerFiche(preambuleTexte)}</div>`;
    }

    if (partieATexte) {
        html += `<div class="fiche-section-titre">📄 ${echapperHTMLFiche(titres.partieA || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(partieATexte)}</div>`;
    }

    if (partieBTexte || baremeTexte) {
        html += `<div class="fiche-section-titre">🧩 ${echapperHTMLFiche(titres.partieB || '')}</div>`;
        html += `<div class="fiche-carte">${texteVersHtmlLegerFiche(partieBTexte)}</div>`;
        if (baremeTexte) {
            html += `<div class="fiche-bloc-entete"><span class="fiche-badge fiche-badge-competence">${echapperHTMLFiche(titres.bareme || 'BARÈME TOTAL')} : ${echapperHTMLFiche(baremeTexte)}</span></div>`;
        }
    }

    if (corrigeTexte) {
        html += `<div class="fiche-section-titre">🔑 ${echapperHTMLFiche(titres.corrige || '')}</div>`;
        html += `<div class="fiche-carte fiche-corrige">${texteVersHtmlLegerFiche(corrigeTexte)}</div>`;
    }

    return `<div class="fiche-lecon${classeAccent || ''}">${html}</div>`;
}

function construireRenduEvaluation(source) {
    let corps = source;
    let signatureHTML = '';
    const idxDebut = corps.indexOf(JETON_SIGNATURE_DEBUT);
    if (idxDebut !== -1) {
        signatureHTML = corps.slice(idxDebut);
        corps = corps.slice(0, idxDebut);
    }

    const analyse = analyserEvaluation(corps);
    if (!analyse) return null;

    let html = construireHTMLEvaluation(analyse, '');

    if (signatureHTML) {
        let sigParsed = marked.parse(signatureHTML);
        sigParsed = sigParsed
            .replace(JETON_SIGNATURE_DEBUT, '<span class="signature-doc">')
            .replace(JETON_SIGNATURE_FIN, '</span>');
        html += sigParsed;
    }
    return html;
}

// ❖ LA CARTE "MISSION" (DEVOIR) — ESPACE ÉLÈVE ❖
// Remplace le bloc de code brut (gris, monospace, généré par
// marked.parse pour un ```...```) par une carte arrondie identifiable,
// sans changer le contenu texte du devoir lui-même. Opère sur le HTML déjà
// généré par marked.parse -- pas de parsing du texte source, juste un
// habillage visuel du bloc <pre><code> qu'il a produit.
function habillerBlocsDevoirs(html) {
    return html.replace(
        /<pre><code(?:\s+class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g,
        (correspondanceComplete, contenu) =>
            `<div class="mission-devoir"><div class="mission-devoir-titre">📘 Devoir</div><pre class="mission-devoir-contenu"><code>${contenu}</code></pre></div>`
    );
}

// ❖ TAILLE DES ILLUSTRATIONS (grande / compacte) ❖
// L'IA ne connaît QUE l'URL de l'image (voir illustrations_disponibles côté
// gateway) et se contente de la recopier en Markdown ![alt](url) -- elle ne
// choisit jamais elle-même le format. La taille est décidée par nous, au
// niveau du catalogue (champ "taille" de illustrations_manifest.json), puis
// appliquée ici côté client par simple correspondance d'URL, une fois le
// HTML déjà généré. Ce choix délibéré évite de dépendre d'une consigne de
// formatage que l'IA devrait suivre à la lettre (cf. le bouton de
// prononciation, où une consigne de ce type s'est révélée peu fiable).
let tailleIllustrationsParUrl = new Map();

async function chargerTaillesIllustrations() {
    try {
        const reponse = await fetch('https://api.edukatchat.org/api/illustrations');
        const data = await reponse.json();
        (data.illustrations || []).forEach((img) => {
            if (img.url && img.taille) {
                tailleIllustrationsParUrl.set(img.url, img.taille);
            }
        });
    } catch (error) {
        // Silencieux : en cas d'échec, toutes les images restent au format
        // "grande" par défaut (comportement actuel, aucune régression).
    }
}
chargerTaillesIllustrations();

function appliquerTailleIllustrations(element) {
    element.querySelectorAll('img').forEach((img) => {
        const taille = tailleIllustrationsParUrl.get(img.getAttribute('src'));
        if (taille === 'compacte') {
            img.classList.add('illustration-compacte');
        }
    });
}

// ❖ RESTITUTION DU FLUX — style « professionnel » (ChatGPT/Claude/Gemini) ❖
// Ancien comportement : chaque fragment reçu rejouait le fondu CSS sur TOUT
// le texte déjà affiché (remove/reflow/add à chaque appel), ce qui provoquait
// un scintillement continu et peu soigné le temps que la réponse s'écrive.
// Nouveau comportement : le fondu d'entrée ne joue plus qu'UNE fois, au tout
// premier fragment (transition douce depuis la bulle de réflexion) ; les
// fragments suivants mettent simplement le texte à jour sans réanimation.
// Pendant la frappe, un curseur clignotant (▍) marque la fin du texte déjà
// reçu -- signal de frappe en cours standard, retiré au rendu final.
function afficherReponseAvecFondu(element, texteMarkdown, attenuerSignature, enCoursDeFrappe, outil, styliserDevoir) {
    const source = attenuerSignature ? attenuerSignatureDocument(texteMarkdown) : texteMarkdown;

    // ❖ Reskin visuel enrichi : tenté uniquement une fois la réponse
    // entièrement reçue (jamais pendant la frappe, pour ne pas afficher
    // une structure encore incomplète), et uniquement pour les outils
    // dont la structure est connue (Forge/Forge Primaire = fiche de
    // leçon, Atelier = évaluation). Repli automatique sur le rendu
    // standard sinon.
    let html = null;
    if (!enCoursDeFrappe && outil === 'forge') {
        html = construireRenduFiche(source, outil);
    } else if (!enCoursDeFrappe && outil === 'forge_primaire') {
        html = construireRenduFichePrimaire(source);
    } else if (!enCoursDeFrappe && outil === 'atelier') {
        html = construireRenduEvaluation(source);
    }

    if (html === null) {
        html = marked.parse(source);
        if (attenuerSignature) {
            html = html
                .replace(JETON_SIGNATURE_DEBUT, '<span class="signature-doc">')
                .replace(JETON_SIGNATURE_FIN, '</span>');
        }
        // ❖ "Mission" (Espace Élève) : le prompt du Sas est délibérément
        // conversationnel et sans structure (ni listes, ni emoji hors
        // clôture) -- on ne touche pas à cette philosophie. Le seul
        // élément régulier et détectable est le devoir, que le prompt
        // demande explicitement de générer "à l'intérieur d'un bloc de
        // code en texte brut" : marked.parse le transforme en
        // <pre><code>...</code></pre>, qu'on habille ici en carte
        // "Mission" plutôt que de le laisser en bloc de code brut gris.
        // N'agit que sur la réponse finale (jamais pendant la frappe, un
        // bloc de code encore ouvert se parse mal) et seulement si un tel
        // bloc est réellement présent.
        if (styliserDevoir && !enCoursDeFrappe) {
            html = habillerBlocsDevoirs(html);
        }
    }
    if (enCoursDeFrappe) {
        html += '<span class="curseur-frappe">▍</span>';
    }
    element.innerHTML = html;
    appliquerTailleIllustrations(element);
    if (!element.dataset.fonduJoue) {
        element.dataset.fonduJoue = "1";
        element.classList.remove('fondu-reponse');
        void element.offsetWidth; // force le reflow : lance l'animation CSS
        element.classList.add('fondu-reponse');
    }
}

function scrollToBottom(elementId) {
    const el = document.getElementById(elementId);
    if(el) {
        el.scrollTop = el.scrollHeight;
    }
}

// ❖ POSITIONNEMENT SUR LE DÉBUT D'UNE RÉPONSE (et non sur sa fin) ❖
// Une réponse longue qui dépasse la hauteur visible forçait jusqu'ici
// l'utilisateur à remonter manuellement pour en lire le début, puisque le
// défilement suivait le bas du flux à chaque fragment reçu. On aligne
// désormais le haut de la bulle de réponse avec le haut de la zone visible
// dès qu'elle commence à s'afficher, et on la maintient à cette position
// pendant tout le flux (au lieu de continuer à suivre le bas) -- l'élève
// lit sa réponse depuis le début, comme un texte normal, sans manipulation.
function scrollToElementTop(elementId, element) {
    const conteneur = document.getElementById(elementId);
    if (!conteneur || !element) return;
    const rectConteneur = conteneur.getBoundingClientRect();
    const rectElement = element.getBoundingClientRect();
    const decalage = rectElement.top - rectConteneur.top;
    conteneur.scrollTop += decalage - 8; // légère marge de respiration en haut
}

// =======================================================================
// ❖ LA MÉMOIRE LOCALE (HISTORIQUE) ❖
// =======================================================================
function saveChatHistory(outil) {
    const historyDiv = document.getElementById(`${outil}-chat-history`);
    if(historyDiv) {
        // ❖ Le Sas est sauvegardé sous une clé propre à l'avatar actif,
        // pour ne jamais mélanger les matières entre elles.
        const cle = (outil === 'sas') ? `eduka_chat_sas_${avatarActif}` : `eduka_chat_${outil}`;
        localStorage.setItem(cle, historyDiv.innerHTML);

        if (outil === 'sas') {
            localStorage.setItem(`eduka_conv_sas`, JSON.stringify(sasConversationIds));
        } else {
            localStorage.setItem(`eduka_conv_${outil}`, teacherConversationIds[outil]);
        }
    }
}

function restoreChatHistories() {
    // ❖ Le Sas n'est plus restauré ici : son historique dépend de l'avatar
    // choisi, connu seulement une fois le portail de matière franchi
    // (voir validerProfilEtEntrer). On restaure ici uniquement les outils
    // de l'espace enseignant, qui n'ont qu'un seul historique chacun.
    const outils = ['atelier', 'forge', 'cabinet', 'forge_primaire', 'cabinet_primaire'];

    outils.forEach(outil => {
        const savedHtml = localStorage.getItem(`eduka_chat_${outil}`);
        const historyDiv = document.getElementById(`${outil}-chat-history`);

        if (savedHtml && historyDiv) {
            historyDiv.innerHTML = savedHtml;
        }

        const savedConvId = localStorage.getItem(`eduka_conv_${outil}`);
        if (savedConvId) {
            teacherConversationIds[outil] = savedConvId;
        }
    });

    const savedConvSas = localStorage.getItem('eduka_conv_sas');
    if (savedConvSas) {
        try {
            sasConversationIds = JSON.parse(savedConvSas);
        } catch (e) {
            sasConversationIds = {};
        }
    }
}

function initTheme() {
    // ❖ Clair = base par défaut, désormais directement dans le CSS (plus
    // besoin d'ajouter de classe) -- le sombre devient l'exception,
    // activée via la classe 'dark-theme' (voir style.css : chaque règle
    // "body.dark-theme .xxx" est posée juste après sa règle de base).
    // Un visiteur sans préférence enregistrée démarre donc en clair ; seul
    // un choix explicite 'dark' (bouton ☀️/🌙) ajoute la classe.
    const savedTheme = localStorage.getItem('eduka_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        updateThemeButtonUI(false);
    } else {
        updateThemeButtonUI(true);
    }
}

// ❖ Mode Mascotte : purement visuel, optionnel, mémorisé par appareil
// (même mécanisme que le thème). Désactivé par défaut -- chacun choisit
// l'habillage qui lui convient plutôt que de l'imposer.
// ❖ La mascotte n'est plus optionnelle : elle accompagne systématiquement
// les réponses de l'IA dans l'Espace de Préparation, pour tous les enfants
// -- plus de bouton dédié dans la barre d'outils (voir historique Git pour
// toggleMascotte()/updateMascotteButtonUI(), conservées mais plus reliées
// à aucun bouton, au cas où l'idée d'un réglage reviendrait un jour).
function initMascotte() {
    document.body.classList.add('mode-mascotte');
}

function toggleMascotte() {
    const actif = document.body.classList.toggle('mode-mascotte');
    localStorage.setItem('eduka_mascotte', actif ? 'on' : 'off');
    updateMascotteButtonUI(actif);
}

function updateMascotteButtonUI(actif) {
    const btn = document.getElementById('btn-mascotte');
    if (btn) {
        btn.style.opacity = actif ? '1' : '0.45';
        btn.title = actif ? "Mascotte activée (cliquer pour désactiver)" : "Activer la mascotte";
    }
}

// ❖ Le visage du hibou compagnon : trois expressions simples (réflexion,
// succès, erreur) obtenues en ne faisant varier que les sourcils, les
// pupilles et la bouche -- le reste du dessin (yeux, bec) reste
// identique, pour une lecture claire même en tout petit format.
function creerAvatarMascotte(etat) {
    const expressions = {
        reflexion: {
            pupilleY: 9.4,
            sourcils: '<path d="M6,7.3 h4" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M14,7.3 h4" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
            bouche: '<path d="M9.5,17 h5" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/>'
        },
        succes: {
            pupilleY: 11,
            sourcils: '<path d="M6,7 q2,-1.4 4,0" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M14,7 q2,-1.4 4,0" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
            bouche: '<path d="M7.5,15.5 Q12,19.5 16.5,15.5" stroke="#78350F" stroke-width="1.3" stroke-linecap="round" fill="none"/>'
        },
        erreur: {
            pupilleY: 11.6,
            sourcils: '<path d="M6,7.6 q2,1.6 4,0.6" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M14,8.2 q2,-1.6 4,-0.6" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
            bouche: '<path d="M8,17.5 Q12,15 16,17.5" stroke="#78350F" stroke-width="1.3" stroke-linecap="round" fill="none"/>'
        }
    };
    const c = expressions[etat] || expressions.reflexion;
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="11" r="3.2" fill="#FFFFFF" stroke="#92400E" stroke-width="1"/>
        <circle cx="16" cy="11" r="3.2" fill="#FFFFFF" stroke="#92400E" stroke-width="1"/>
        <circle cx="8" cy="${c.pupilleY}" r="1.3" fill="#451A03"/>
        <circle cx="16" cy="${c.pupilleY}" r="1.3" fill="#451A03"/>
        ${c.sourcils}
        <path d="M11,13.3 L13,13.3 L12,15.3 Z" fill="#92400E"/>
        ${c.bouche}
    </svg>`;
}

// ❖ Attache (ou met à jour) le médaillon-mascotte sur une bulle de
// réponse -- ne fait rien si le Mode Mascotte est désactivé. Doit
// toujours être appelé APRÈS toute réaffectation de innerHTML/textContent
// sur la bulle (qui effacerait sinon l'avatar déjà posé).
function ajouterMascotte(bulleDiv, etat) {
    if (!document.body.classList.contains('mode-mascotte') || !bulleDiv) return;
    let avatar = bulleDiv.querySelector('.mascotte-avatar');
    if (!avatar) {
        avatar = document.createElement('div');
        avatar.className = 'mascotte-avatar';
        bulleDiv.appendChild(avatar);
    }
    avatar.innerHTML = creerAvatarMascotte(etat);
}

// ❖ Petite étincelle d'encouragement, discrète et non-infantilisante --
// une seule apparition brève au succès d'une réponse, jamais répétée ni
// intrusive. Disparaît d'elle-même, aucune trace ne persiste dans
// l'historique sauvegardé au-delà de son animation.
function declencherEtincelleMascotte(bulleDiv) {
    if (!document.body.classList.contains('mode-mascotte') || !bulleDiv) return;
    const avatar = bulleDiv.querySelector('.mascotte-avatar');
    if (!avatar) return;
    const etincelle = document.createElement('span');
    etincelle.className = 'mascotte-etincelle';
    etincelle.textContent = '✨';
    avatar.appendChild(etincelle);
    setTimeout(() => { etincelle.remove(); }, 1500);
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('eduka_theme', isDark ? 'dark' : 'light');
    updateThemeButtonUI(!isDark);
}

function updateThemeButtonUI(isLight) {
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
        themeBtn.textContent = isLight ? "🌙" : "☀️";
        themeBtn.title = isLight ? "Passer en mode sombre" : "Passer en mode clair";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMascotte();
    restoreChatHistories();
});

// =======================================================================
// ❖ GESTION DU CODE D'ACCÈS ET DES MODALES ❖
// =======================================================================
function openPremiumModal() {
    // ❖ Correction : ce lien pointait auparavant directement vers un
    // formulaire Tally figé (Révision d'Emploi du Temps pour les parents,
    // Cabinet brut pour les enseignants) — désormais périmé depuis la
    // création des modales dédiées (Espace Parents avec choix EDT
    // Tally/Progression + rappel WhatsApp, et Abonnement Espace Enseignant).
    // Le lien ouvre maintenant la bonne modale au lieu de sauter directement
    // sur un formulaire.
    const lien = document.getElementById('lien-abonnement-dynamique');
    if (lien) {
        lien.href = "#";
        lien.removeAttribute('target');
        if (espaceActuel === 'enseignant') {
            lien.textContent = "Accéder au Cabinet (Enseignants)";
            lien.onclick = function(e) {
                e.preventDefault();
                closePremiumModal();
                ouvrirEnseignantAboModal();
            };
        } else {
            lien.textContent = "Accéder au Bureau des Parents";
            lien.onclick = function(e) {
                e.preventDefault();
                closePremiumModal();
                ouvrirParentsModal();
            };
        }
    }

    document.getElementById('premium-modal').classList.add('active');
    // ❖ Sur mobile (Android en particulier), un focus() déclenché par
    // script -- même via un simple setTimeout -- n'est pas considéré comme
    // un geste utilisateur "de confiance" par le navigateur : le clavier
    // virtuel ne s'affiche alors pas, et le champ reste bloqué en focus
    // "silencieux" (souvent impossible d'y écrire même en le retouchant).
    // On réserve donc l'auto-focus au clavier/souris (desktop) ; sur
    // tactile, l'utilisateur touche lui-même le champ, ce qui est un vrai
    // geste utilisateur et fait apparaître le clavier de façon fiable.
    const estTactile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!estTactile) {
        setTimeout(() => document.getElementById('matricule-input').focus(), 100);
    }
}

function closePremiumModal() {
    document.getElementById('premium-modal').classList.remove('active');
    document.getElementById('modal-feedback').textContent = '';
    document.getElementById('matricule-input').value = '';
}

function handleMatriculeKeyPress(event) {
    if (event.key === 'Enter') {
        verifyMatricule();
    }
}

async function verifyMatricule() {
    const matricule = document.getElementById('matricule-input').value.trim();
    const feedback = document.getElementById('modal-feedback');

    if(!matricule) {
        feedback.textContent = "Le Code d'accès ne peut être vide.";
        feedback.style.color = "#F87171";
        return;
    }

    feedback.textContent = "Vérification de votre Code en cours...";
    feedback.style.color = "#60A5FA";

    try {
        const response = await fetch('https://api.edukatchat.org/verifier-sceau', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // On utilise ta variable 'espaceActuel' pour déclarer la provenance
            body: JSON.stringify({
                sceau: matricule,
                espace_cible: espaceActuel
            })
        });

        const data = await response.json();

        if (data.valide === true) {
            feedback.textContent = data.message;
            feedback.style.color = "#10B981";

            localStorage.setItem('eduka_sceau', matricule);

            setTimeout(() => {
                closePremiumModal();
                if (pendingSpaceToOpen) {
                    openSpace(pendingSpaceToOpen);
                    pendingSpaceToOpen = null;
                }
            }, 1500);
        } else {
            feedback.textContent = data.message;
            feedback.style.color = "#F87171";
        }
    } catch (error) {
        feedback.textContent = "La connexion au serveur a échoué. Veuillez vérifier votre réseau.";
        feedback.style.color = "#F87171";
    }
}

function triggerVisionUpsell(chatHistoryId) {
    const chatHistory = document.getElementById(chatHistoryId);

    const botUpsellDiv = document.createElement('div');
    botUpsellDiv.className = 'message bot-message';
    botUpsellDiv.innerHTML = `
        <div style="font-size: 0.9em; line-height: 1.4;">
            <strong>📸 Analyse visuelle restreinte</strong><br>
            Cette fonction avancée requiert l'accès complet.<br>
            <button onclick='openPremiumModal()' style='margin-top: 8px; padding: 6px 12px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.9em;'>Saisir le Code</button>
        </div>
    `;

    chatHistory.appendChild(botUpsellDiv);
    scrollToBottom(chatHistoryId);

    const outil = chatHistoryId.split('-')[0];
    saveChatHistory(outil);
}

// =======================================================================
// ❖ L'ANALYSE VISUELLE RÉELLE (JOINDRE UNE IMAGE) ❖
// =======================================================================
// ❖ Jusqu'ici, le bouton trombone de chaque outil se contentait toujours
// d'afficher l'upsell ci-dessus, sans jamais vérifier le vrai statut
// Premium ni proposer d'envoi réel. Corrigé le 27/08/2026 : un Sceau local
// présent déclenche désormais un vrai sélecteur de fichier puis un
// téléversement vers /api/chat/televerser_image (voir gateway/main.py,
// section 9.4) ; l'upsell ci-dessus ne s'affiche plus que si le serveur
// confirme l'absence de droit Premium (ou si aucun Sceau n'est enregistré
// localement, ce qui évite un aller-retour serveur inutile).

// ❖ Un seul input file caché, réutilisé par tous les outils.
let inputFichierImageCache = null;

// ❖ Formats acceptés par le trombone (01/09/2026) : étendu au-delà des
// photos aux documents (PDF, Word, TXT, CSV, Excel) -- voir
// gateway/main.py, type_fichier_dify, qui reste la source de vérité côté
// serveur (ce simple attribut "accept" ne fait que présélectionner les
// fichiers dans le sélecteur du navigateur, il n'empêche pas d'en choisir
// un autre via "Tous les fichiers"). L'attribut "capture" (ouverture
// directe de l'appareil photo) reste sans effet sur les documents -- les
// navigateurs l'ignorent silencieusement en dehors des images/vidéos.
const EXTENSIONS_FICHIER_ACCEPTEES = 'image/*,.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx';

function obtenirInputFichierImage() {
    if (!inputFichierImageCache) {
        inputFichierImageCache = document.createElement('input');
        inputFichierImageCache.type = 'file';
        inputFichierImageCache.accept = EXTENSIONS_FICHIER_ACCEPTEES;
        inputFichierImageCache.capture = 'environment';
        inputFichierImageCache.style.display = 'none';
        document.body.appendChild(inputFichierImageCache);
    }
    return inputFichierImageCache;
}

// ❖ fichiersEnAttente[chatHistoryId] = { id: <upload_file_id Dify>, nom,
// type: <"image"|"document", voir type_fichier_dify côté serveur> } --
// vidé après l'envoi du message suivant, ou par annulation manuelle.
const fichiersEnAttente = {};

function declencherJoindreImage(chatHistoryId, contexte) {
    const sceau = contexte === 'sas'
        ? (localStorage.getItem('eduka_sceau') || "")
        : (localStorage.getItem('eduka_sceau_enseignant') || "");

    if (!sceau) {
        // ❖ Sans Sceau local, le serveur refuserait de toute façon --
        // inutile de solliciter le réseau pour afficher l'upsell.
        triggerVisionUpsell(chatHistoryId);
        return;
    }

    const input = obtenirInputFichierImage();
    input.value = ''; // permet de resélectionner le même fichier deux fois de suite
    input.onchange = () => {
        const fichier = input.files && input.files[0];
        if (!fichier) return;
        televerserImageChat(chatHistoryId, contexte, sceau, fichier);
    };
    input.click();
}

async function televerserImageChat(chatHistoryId, contexte, sceau, fichier) {
    const chatHistory = document.getElementById(chatHistoryId);

    const bulleEnvoi = document.createElement('div');
    bulleEnvoi.className = 'message bot-message';
    bulleEnvoi.innerHTML = `<div style="font-size: 0.9em;">📎 Envoi du fichier en cours...</div>`;
    chatHistory.appendChild(bulleEnvoi);
    scrollToBottom(chatHistoryId);

    try {
        const formData = new FormData();
        formData.append('fichier', fichier);
        formData.append('contexte', contexte);
        formData.append('matricule', sceau);

        const response = await fetch('https://api.edukatchat.org/api/chat/televerser_image', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        bulleEnvoi.remove();

        if (data.success) {
            // ❖ data.type ("image" ou "document", voir type_fichier_dify côté
            // serveur) est conservé ici pour être retransmis tel quel dans
            // fichier_type au moment de l'envoi du message (voir sendSasMessage
            // / sendTeacherMessage) -- c'est le serveur qui a déterminé le type
            // au moment du téléversement, le frontend se contente de le
            // reporter plutôt que de deviner à partir de l'extension.
            fichiersEnAttente[chatHistoryId] = { id: data.id, nom: fichier.name, type: data.type || 'image' };
            const bulleConfirmation = document.createElement('div');
            bulleConfirmation.className = 'message bot-message';
            bulleConfirmation.innerHTML = `<div style="font-size: 0.9em;">📎 Fichier joint (« ${fichier.name} ») — il sera envoyé avec ton prochain message. <a href="#" onclick="annulerImageJointe('${chatHistoryId}', this); return false;" style="color:#EF4444;">Annuler</a></div>`;
            chatHistory.appendChild(bulleConfirmation);
            scrollToBottom(chatHistoryId);
        } else if (data.premium_requis) {
            triggerVisionUpsell(chatHistoryId);
        } else {
            const bulleErreur = document.createElement('div');
            bulleErreur.className = 'message bot-message';
            bulleErreur.textContent = data.message || "L'envoi du fichier a échoué. Réessaie dans un instant.";
            chatHistory.appendChild(bulleErreur);
            scrollToBottom(chatHistoryId);
        }
    } catch (e) {
        bulleEnvoi.remove();
        const bulleErreur = document.createElement('div');
        bulleErreur.className = 'message bot-message';
        bulleErreur.textContent = "L'envoi du fichier a échoué. Vérifie ta connexion et réessaie.";
        chatHistory.appendChild(bulleErreur);
        scrollToBottom(chatHistoryId);
    }
}

function annulerImageJointe(chatHistoryId, lien) {
    delete fichiersEnAttente[chatHistoryId];
    const bulle = lien.closest('.message');
    if (bulle) bulle.remove();
}

// =======================================================================
// ❖ LOGIQUE DE L'ESPACE DE PRÉPARATION (LE SAS) ❖
// =======================================================================
let sasConversationIds = {};

// ❖ CLÔTURE AUTOMATIQUE DE SESSION — Le protocole de clôture (bilan,
// mémoire, rapport aux parents) ne doit plus dépendre du seul jugement
// de l'agent quant à la "fin" d'une conversation : un élève qui ferme
// l'onglet, met l'application en arrière-plan, ou s'arrête simplement
// de répondre après une seule question, ne dit jamais explicitement
// "au revoir". On détecte donc ces trois cas côté interface et on
// envoie un message sentinelle que le prompt Sas est instruit à
// reconnaître pour déclencher immédiatement la clôture.
const SENTINEL_FIN_SESSION_SAS = "[FIN_DE_SESSION_AUTOMATIQUE]";
const DELAI_INACTIVITE_CLOTURE_MS = 15 * 60 * 1000; // 15 minutes sans nouveau message
let sasSessionOuverte = false;       // vrai dès qu'un premier échange a réussi
let sasClotureDejaEnvoyee = false;   // évite les doublons de rapport
let minuteurInactiviteSas = null;

function reinitialiserMinuteurInactiviteSas() {
    if (minuteurInactiviteSas) clearTimeout(minuteurInactiviteSas);
    minuteurInactiviteSas = setTimeout(() => {
        declencherClotureAutomatiqueSas('inactivite');
    }, DELAI_INACTIVITE_CLOTURE_MS);
}

function declencherClotureAutomatiqueSas(raison) {
    if (!sasSessionOuverte || sasClotureDejaEnvoyee) return;
    const sceau = localStorage.getItem('eduka_sceau') || "";
    if (!sceau) return; // pas d'abonné identifié, rien à clôturer/rapporter

    sasClotureDejaEnvoyee = true;
    if (minuteurInactiviteSas) clearTimeout(minuteurInactiviteSas);

    try {
        const payload = JSON.stringify({
            query: SENTINEL_FIN_SESSION_SAS,
            conversation_id: sasConversationIds[avatarActif] || "",
            matricule: sceau,
            avatar: avatarActif,
            device_id: (typeof obtenirDeviceId === 'function') ? obtenirDeviceId() : "",
            classe: classeActive,
            methode_travail: (typeof methodeTravailActive !== 'undefined') ? methodeTravailActive : "",
            gestion_stress: (typeof gestionStressActive !== 'undefined') ? gestionStressActive : ""
        });

        // fetch({keepalive:true}) plutôt que sendBeacon : autorise un
        // Content-Type JSON explicite tout en survivant à la fermeture
        // de l'onglet, ce que sendBeacon ne garantit pas aussi proprement.
        fetch('https://api.edukatchat.org/api/sas/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(() => {});
    } catch (e) {
        console.warn("Clôture automatique impossible :", e);
    }
}

window.addEventListener('beforeunload', () => declencherClotureAutomatiqueSas('fermeture'));

// ❖ Délai de grâce avant de clôturer sur mise en arrière-plan : un
// verrouillage d'écran ou un changement furtif d'application pendant que
// l'élève réfléchit à sa réponse (sans toucher à rien) déclenchait la
// même clôture qu'un abandon réel -- la session semblait "se déconnecter"
// en pleine réflexion, alors que l'élève n'était jamais parti. On
// n'envoie la sentinelle que si l'onglet reste caché au-delà de ce délai.
const DELAI_GRACE_ARRIERE_PLAN_MS = 5 * 60 * 1000; // 5 minutes -- le minuteur d'inactivité (15 min) reste le vrai filet contre un abandon réel, celui-ci n'est qu'un raccourci plus rapide
let minuteurGraceArrierePlan = null;

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        if (minuteurGraceArrierePlan) clearTimeout(minuteurGraceArrierePlan);
        minuteurGraceArrierePlan = setTimeout(() => {
            declencherClotureAutomatiqueSas('arriere-plan');
        }, DELAI_GRACE_ARRIERE_PLAN_MS);
    } else if (document.visibilityState === 'visible') {
        if (minuteurGraceArrierePlan) {
            clearTimeout(minuteurGraceArrierePlan);
            minuteurGraceArrierePlan = null;
        }
    }
});

function handleSasKeyPress(event) {
    if (event.key === 'Enter') sendSasMessage();
}

// ❖ LE PASSE-UNIQUE — Identifiant d'appareil persistant.
// Généré une seule fois par navigateur/appareil et conservé dans
// localStorage. Transmis avec chaque requête premium pour permettre au
// serveur de reconnaître un changement d'appareil (remplacement
// silencieux : le nouvel appareil prend le relais).
// ❖ LA BULLE DE RÉFLEXION VIVANTE — remplace l'ancien texte statique
// immobile par trois points animés, façon "en train d'écrire". Le style
// n'est injecté qu'une seule fois dans la page. Dès que le premier
// fragment de la réponse arrive, cette bulle est naturellement écrasée
// par le texte réel (aucune logique supplémentaire n'est nécessaire).
function injecterStyleReflexion() {
    if (document.getElementById('eduka-style-reflexion')) return;
    const style = document.createElement('style');
    style.id = 'eduka-style-reflexion';
    style.textContent = `
        @keyframes edukaTypingBounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-6px); opacity: 1; }
        }
        .eduka-typing {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            vertical-align: middle;
        }
        .eduka-typing-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #6B7280;
            animation: edukaTypingBounce 1.2s infinite ease-in-out;
        }
        .eduka-typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .eduka-typing-dot:nth-child(3) { animation-delay: 0.3s; }
        .eduka-typing-texte { margin-left: 8px; opacity: 0.75; color: #6B7280; }
    `;
    document.head.appendChild(style);
}
injecterStyleReflexion();

function creerBulleReflexion(texte) {
    return `<span class="eduka-typing">
        <span class="eduka-typing-dot"></span>
        <span class="eduka-typing-dot"></span>
        <span class="eduka-typing-dot"></span>
    </span><span class="eduka-typing-texte">${texte}</span>`;
}

// ❖ Réutiliser une question déjà posée : plutôt qu'un simple copier-coller
// vers le presse-papiers (qui exige ensuite un collage manuel), ce bouton
// reverse directement le texte dans le champ de saisie correspondant --
// l'élève/enseignant n'a plus qu'à cliquer "Envoyer" (ou modifier avant).
// Construit en DOM pur (pas d'innerHTML avec le texte interpolé) pour ne
// jamais casser si la question contient des caractères spéciaux.
function creerBoutonReutiliser(message, champSaisieId) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn-reutiliser-question';
    bouton.title = 'Réutiliser cette question';
    bouton.textContent = '↻';
    bouton.onclick = function (evenement) {
        evenement.stopPropagation();
        const champ = document.getElementById(champSaisieId);
        if (champ) {
            champ.value = message;
            champ.focus();
        }
    };
    return bouton;
}

function obtenirDeviceId() {
    let deviceId = localStorage.getItem('eduka_device_id');
    if (!deviceId) {
        deviceId = (crypto.randomUUID && crypto.randomUUID()) ||
            'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem('eduka_device_id', deviceId);
    }
    return deviceId;
}

// ❖ LE MICRO — transcription vocale sur le site (jamais WhatsApp) ❖
// Un élève qui présente mal sa pensée par écrit peut enregistrer sa
// question à l'oral : le texte transcrit vient simplement pré-remplir la
// zone de saisie, sans envoi automatique — il garde la main pour relire.
// Cible "sas" (Espace de Préparation + Académie, mêmes champs) ou "arene"
// (Ateliers Orateur/Philo/Sciences) : les deux partagent la même logique
// d'enregistrement, seuls les identifiants de bouton/champ diffèrent.
const CIBLES_MICRO = {
    sas: { bouton: 'btn-micro-sas', champ: 'sas-user-input' },
    arene: { bouton: 'btn-micro-arene', champ: 'arene-user-input' }
};

let mediaRecorderVocal = null;
let chunksAudioVocal = [];
let enregistrementVocalEnCours = false;
let cibleMicroActive = null;

async function toggleEnregistrementVocal(cible) {
    const infosCible = CIBLES_MICRO[cible];
    if (!infosCible) return;
    const bouton = document.getElementById(infosCible.bouton);
    if (!bouton) return;

    if (!enregistrementVocalEnCours) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Ce navigateur ne permet pas l'enregistrement vocal. Écris directement ta question.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chunksAudioVocal = [];
            cibleMicroActive = cible;
            mediaRecorderVocal = new MediaRecorder(stream);
            mediaRecorderVocal.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksAudioVocal.push(e.data); };
            mediaRecorderVocal.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                envoyerVocalPourTranscription(cible);
            };
            mediaRecorderVocal.start();
            enregistrementVocalEnCours = true;
            bouton.style.backgroundColor = '#EF4444';
            bouton.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.35)';
            bouton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>';
            bouton.title = "Arrêter l'enregistrement";
        } catch (err) {
            alert("Impossible d'accéder au microphone. Vérifie les autorisations de ton navigateur pour ce site.");
        }
    } else {
        mediaRecorderVocal.stop();
        enregistrementVocalEnCours = false;
        bouton.style.backgroundColor = '#8B5CF6';
        bouton.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.35)';
        bouton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>';
        bouton.title = (cible === 'arene') ? "Parler au lieu d'écrire" : "Poser ma question à l'oral";
    }
}

async function envoyerVocalPourTranscription(cible) {
    const infosCible = CIBLES_MICRO[cible];
    if (!infosCible) return;
    const inputField = document.getElementById(infosCible.champ);
    if (!inputField) return;
    const placeholderOriginal = inputField.placeholder;
    inputField.placeholder = "Transcription de ta voix en cours...";
    inputField.disabled = true;

    try {
        const blobAudio = new Blob(chunksAudioVocal, { type: (mediaRecorderVocal && mediaRecorderVocal.mimeType) || 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blobAudio, 'vocal.webm');

        const response = await fetch('https://api.edukatchat.org/api/sas/transcrire_vocal', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.status === 'success' && data.texte) {
            inputField.value = data.texte;
            inputField.placeholder = placeholderOriginal;
        } else {
            inputField.placeholder = data.message || "La transcription a échoué. Réessaie ou écris ta question.";
            setTimeout(() => { inputField.placeholder = placeholderOriginal; }, 4000);
        }
    } catch (err) {
        inputField.placeholder = "Le réseau est instable. Réessaie dans un instant.";
        setTimeout(() => { inputField.placeholder = placeholderOriginal; }, 4000);
    } finally {
        inputField.disabled = false;
        inputField.focus();
    }
}

async function sendSasMessage() {
    const inputField = document.getElementById('sas-user-input');
    const button = inputField.nextElementSibling;
    const message = inputField.value.trim();

    if (!message) return;

    // ❖ L'AJUSTEMENT DU SCEAU — Étape 2 : extraction anticipée du sceau.
    // On récupère l'identité premium AVANT toute logique de quota, afin
    // qu'elle puisse neutraliser le compteur local dès son origine.
    const sceau = localStorage.getItem('eduka_sceau') || "";

    const QUOTA_MAX = 10;
    const aujourdhui = new Date().toLocaleDateString();

    // ❖ L'AJUSTEMENT DU SCEAU — Étape 3 : le mur Freemium local ne
    // s'applique désormais QUE si aucun sceau n'est présent. Un porteur
    // de Sceau (EDU-CREATEUR ou tout Premium valide) traverse sans
    // jamais toucher ce compteur.
    if (!sceau) {
        let suiviQuota = JSON.parse(localStorage.getItem('eduka_quota_sas')) || { date: aujourdhui, requetes: 0 };

        if (suiviQuota.date !== aujourdhui) {
            suiviQuota = { date: aujourdhui, requetes: 0 };
        }

        if (suiviQuota.requetes >= QUOTA_MAX) {
            const chatHistory = document.getElementById('sas-chat-history');
            const botUpsellDiv = document.createElement('div');
            botUpsellDiv.className = 'message bot-message apparition-fluide';

            botUpsellDiv.innerHTML = `
                <div style="font-size: 0.95em; line-height: 1.5; color: #B45309; background: #FEF3C7; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B;">
                    <strong>⏳ L'Énergie du jour est épuisée</strong><br><br>
                    Tu as atteint ta limite de ${QUOTA_MAX} requêtes gratuites pour aujourd'hui. L'esprit a besoin de repos pour assimiler le savoir.<br><br>
                    Reviens <strong>demain dès 00h00</strong> pour un nouveau cycle de préparation, ou demande à tes parents de déverrouiller l'Académie Premium pour un accompagnement sans limite.
                    <button onclick='openPremiumModal()' style='display: block; width: 100%; margin-top: 15px; padding: 10px; background-color: #F59E0B; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-align: center;'>Déverrouiller l'Accès Complet</button>
                </div>
            `;

            chatHistory.appendChild(botUpsellDiv);
            scrollToBottom('sas-chat-history');
            inputField.value = '';
            return;
        }

        suiviQuota.requetes++;
        localStorage.setItem('eduka_quota_sas', JSON.stringify(suiviQuota));
    }

    inputField.disabled = true;
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';

    const chatHistory = document.getElementById('sas-chat-history');

    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message user-message';
    userMsgDiv.textContent = message;
    userMsgDiv.appendChild(creerBoutonReutiliser(message, 'sas-user-input'));
    chatHistory.appendChild(userMsgDiv);

    inputField.value = '';
    scrollToBottom('sas-chat-history');

    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message bot-message apparition-fluide';
    botLoadingDiv.innerHTML = creerBulleReflexion("L'Assistant rassemble son savoir...");
    ajouterMascotte(botLoadingDiv, 'reflexion');
    chatHistory.appendChild(botLoadingDiv);
    scrollToElementTop('sas-chat-history', botLoadingDiv);

    try {
        // ❖ Une image jointe via le trombone (voir declencherJoindreImage)
        // reste en attente jusqu'à l'envoi du prochain message -- inclue
        // ici puis effacée juste après, pour ne pas la réenvoyer avec les
        // messages suivants.
        const imageJointeSas = fichiersEnAttente['sas-chat-history'];

        const response = await fetch('https://api.edukatchat.org/api/sas/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: message,
                conversation_id: sasConversationIds[avatarActif] || "",
                matricule: sceau,
                avatar: avatarActif,
                device_id: obtenirDeviceId(),
                classe: classeActive,
                methode_travail: methodeTravailActive,
                gestion_stress: gestionStressActive,
                fichier_id: (imageJointeSas && imageJointeSas.id) || "",
                fichier_type: (imageJointeSas && imageJointeSas.type) || "image"
            })
        });
        // ❖ Correction (27/08/2026) : l'image jointe n'est plus effacée
        // ici, juste après l'envoi -- elle ne l'était pas seulement en cas
        // de vrai succès, mais aussi quand Dify répondait en erreur (message
        // de repli "L'Assistant est momentanément indisponible..."),
        // faisant perdre silencieusement l'image jointe et obligeant à la
        // rejoindre avant de pouvoir réessayer. On ne l'efface désormais
        // qu'une fois un vrai conversation_id Dify obtenu (voir plus bas),
        // signe que le message -- et l'image -- ont bien été reçus.
        let imageEnvoyeeAvecSucces = false;

        // 1. Vérification de la stabilité
        if (!response.ok) {
            throw new Error(`Le serveur a répondu avec l'état : ${response.status}`);
        }

        // ❖ Un échange a bien eu lieu : la session est "ouverte" et pourra
        // donc être clôturée automatiquement (fermeture d'onglet, mise en
        // arrière-plan, ou inactivité prolongée) même si l'élève ne dit
        // jamais explicitement au revoir.
        sasSessionOuverte = true;
        sasClotureDejaEnvoyee = false;
        reinitialiserMinuteurInactiviteSas();

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            botLoadingDiv.textContent = data.answer || "Le silence est la seule réponse obtenue.";
            if (data.answer) {
                ajouterMascotte(botLoadingDiv, 'succes');
                declencherEtincelleMascotte(botLoadingDiv);
            } else {
                ajouterMascotte(botLoadingDiv, 'erreur');
            }
            if (data.conversation_id) {
                sasConversationIds[avatarActif] = data.conversation_id;
                imageEnvoyeeAvecSucces = true;
            }
        }
        else {
            // ❖ La bulle de réflexion (points animés) reste affichée telle
            // quelle ici — on ne l'efface plus par avance. Elle ne sera
            // remplacée qu'au moment où un vrai fragment de texte arrive
            // (voir plus bas), pour ne jamais laisser un vide entre
            // l'animation et la restitution de la pensée de l'agent.
            let texteIntegralSas = "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = ""; // 2. Le réceptacle des fragments

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Protège le fragment en cours

                for (let line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const payload = trimmedLine.substring(6).trim();
                        if (payload === "[DONE]") continue;

                        try {
                            const dataObj = JSON.parse(payload);
                            if (dataObj.event === 'message' || dataObj.event === 'agent_message' || dataObj.answer) {
                                texteIntegralSas += (dataObj.answer || "");
                                // On ne remplace la bulle animée que lorsqu'il y a
                                // vraiment quelque chose à montrer.
                                if (texteIntegralSas.length > 0) {
                                    afficherReponseAvecFondu(botLoadingDiv, texteIntegralSas, false, true);
                                    scrollToElementTop('sas-chat-history', botLoadingDiv);
                                }
                            }
                            if (dataObj.conversation_id) {
                                sasConversationIds[avatarActif] = dataObj.conversation_id;
                                imageEnvoyeeAvecSucces = true;
                            }
                        } catch(e) {
                            console.warn("L'équilibre se rétablit : un fragment de conscience a été réassemblé.");
                        }
                    }
                }
            }

            // Filet de sécurité : si le flux s'est terminé sans jamais
            // produire le moindre texte, on arrête l'animation et on
            // l'explique plutôt que de la laisser tourner indéfiniment.
            if (!texteIntegralSas) {
                botLoadingDiv.innerHTML = "Je n'ai pas de réponse à formuler pour l'instant. Peux-tu reformuler ta question ?";
                ajouterMascotte(botLoadingDiv, 'erreur');
            } else {
                afficherReponseAvecFondu(botLoadingDiv, texteIntegralSas, false, false, undefined, true); // rendu final, curseur retiré, carte "Mission" pour un éventuel devoir
                ajouterMascotte(botLoadingDiv, 'succes');
                declencherEtincelleMascotte(botLoadingDiv);
            }
        }

        if (imageJointeSas && imageEnvoyeeAvecSucces) delete fichiersEnAttente['sas-chat-history'];

        // ❖ Prononciation ciblée : on insère un petit haut-parleur juste
        // après chaque phrase entre guillemets (c'est déjà la convention que
        // l'agent utilise pour citer les mots/phrases en langue étrangère),
        // plutôt qu'un bouton unique qui lirait tout le message français
        // compris. Seulement pour les avatars de langue.
        if (['anglais', 'espagnol', 'allemand'].includes(avatarActif)) {
            ajouterBoutonsPrononciationInline(botLoadingDiv);
        }

        if (botLoadingDiv.textContent.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="btn-action-doc" onclick="copierTexte(this)" title="Copier pour Word" aria-label="Copier pour Word"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg></button>
                <button class="btn-action-doc" onclick="imprimerDocument(this)" title="Imprimer / Enregistrer en PDF" aria-label="Imprimer ou enregistrer en PDF"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg></button>
            `;
            botLoadingDiv.appendChild(actionsDiv);
        }
        saveChatHistory('sas');

    } catch (error) {
        console.error("Détail de la perturbation :", error);
        botLoadingDiv.innerHTML = `<span style="color:#EF4444;">Le lien avec la source a été interrompu (${error.message}). Reprenez votre respiration et essayez à nouveau.</span>`;
        ajouterMascotte(botLoadingDiv, 'erreur');
        saveChatHistory('sas');
    } finally {
        inputField.disabled = false;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        inputField.focus();
        // ❖ Volontairement pas de scrollToBottom ici : on reste ancré sur le
        // début de la réponse (voir scrollToElementTop plus haut) plutôt que
        // de sauter à la fin une fois le flux terminé.
    }
}

// =======================================================================
// ❖ LOGIQUE DES OUTILS ENSEIGNANT ❖
// =======================================================================
let teacherConversationIds = {
    'atelier': "",
    'forge': "",
    'cabinet': "",
    'forge_primaire': "",
    'cabinet_primaire': ""
};

// ❖ Repartir d'une conversation Dify vierge.
// Sans cela, le conversation_id d'un outil enseignant est créé au premier
// message puis conservé indéfiniment (persisté dans localStorage par
// saveChatHistory, restauré par restoreChatHistories) : toutes les fiches
// jamais produites par cet instituteur s'accumulaient dans UN SEUL fil
// Dify. Conséquences observées en production :
//   - le modèle reste cohérent avec ses propres réponses antérieures et
//     recopie leur structure au lieu de suivre le contexte fraîchement
//     récupéré -- une fiche fautive se reproduisait ainsi mot pour mot,
//     même après correction du prompt, du modèle et des bases ;
//   - le coût en jetons croît à chaque fiche, l'historique étant renvoyé
//     en entier à chaque appel.
// On remet donc le compteur à zéro quand l'instituteur demande une
// NOUVELLE fiche. « Ajouter des exercices », en revanche, se rapporte à la
// fiche précédente : ce bouton doit conserver le fil.
function reinitialiserConversationEnseignant(outil) {
    if (!(outil in teacherConversationIds)) return;
    teacherConversationIds[outil] = "";
    try {
        localStorage.removeItem(`eduka_conv_${outil}`);
    } catch (e) {
        // localStorage indisponible (navigation privée stricte) : le
        // simple reset en mémoire ci-dessus suffit pour la session.
    }
}

function handleTeacherKeyPress(event, outil) {
    if (event.key === 'Enter') sendTeacherMessage(outil);
}

async function sendTeacherMessage(outil) {
    const inputField = document.getElementById(`${outil}-user-input`);
    const button = inputField.nextElementSibling;
    const message = inputField.value.trim();

    if (!message) return;

    inputField.disabled = true;
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';

    const chatHistory = document.getElementById(`${outil}-chat-history`);
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message user-message';
    userMsgDiv.textContent = message;
    userMsgDiv.appendChild(creerBoutonReutiliser(message, `${outil}-user-input`));
    chatHistory.appendChild(userMsgDiv);

    inputField.value = '';
    scrollToBottom(`${outil}-chat-history`);

    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message bot-message apparition-fluide';
    botLoadingDiv.innerHTML = creerBulleReflexion("Le Cabinet compile les données. L'esprit rassemble le savoir...");
    chatHistory.appendChild(botLoadingDiv);
    scrollToElementTop(`${outil}-chat-history`, botLoadingDiv);

    // ❖ Sceau propre à l'espace enseignant (voir ouvrirModaleAccesEnseignant),
    // distinct de 'eduka_sceau' (élève) -- vide si l'enseignant a choisi
    // l'essai Freemium, auquel cas le serveur applique de lui-même son quota.
    const sceau = localStorage.getItem('eduka_sceau_enseignant') || "";

    // ❖ Voir la note équivalente dans sendSasMessage.
    const imageJointeTeacher = fichiersEnAttente[`${outil}-chat-history`];

    try {
        const response = await fetch('https://api.edukatchat.org/api/enseignant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: message,
                conversation_id: teacherConversationIds[outil] || "",
                outil: outil,
                matricule: sceau,
                device_id: obtenirDeviceId(),
                fichier_id: (imageJointeTeacher && imageJointeTeacher.id) || "",
                fichier_type: (imageJointeTeacher && imageJointeTeacher.type) || "image"
            })
        });
        // ❖ Voir la note équivalente dans sendSasMessage : l'image jointe
        // n'est effacée qu'une fois un vrai conversation_id Dify obtenu,
        // jamais juste après l'envoi (sinon un échec Dify fait perdre
        // l'image en silence).
        let imageEnvoyeeAvecSucces = false;

        // 1. Vérification de la stabilité du serveur
        if (!response.ok) {
            throw new Error(`Le serveur a répondu avec l'état : ${response.status}`);
        }

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (data.answer && (data.answer.includes("votre quota") || data.answer.includes("épuisé"))) {
                botLoadingDiv.innerHTML = data.answer + "<br><br><button onclick='ouvrirModaleAccesEnseignant()' style='display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;'>Saisir le Code d'accès</button>";
            } else {
                botLoadingDiv.textContent = data.answer || "La source est silencieuse.";
            }
            if (data.conversation_id) {
                teacherConversationIds[outil] = data.conversation_id;
                imageEnvoyeeAvecSucces = true;
            }
        }
        else {
            // ❖ Voir la note équivalente dans sendSasMessage : la bulle
            // animée n'est plus effacée par avance.
            let texteIntegralTeacher = "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = ""; // 2. Le réceptacle des fragments

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Protège le fragment incomplet pour le cycle suivant

                for (let line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const payload = trimmedLine.substring(6).trim();
                        if (payload === "[DONE]") continue;

                        try {
                            const dataObj = JSON.parse(payload);
                            if (dataObj.event === 'message' || dataObj.event === 'agent_message' || dataObj.answer) {
                                texteIntegralTeacher += (dataObj.answer || "");
                                if (texteIntegralTeacher.length > 0) {
                                    afficherReponseAvecFondu(botLoadingDiv, texteIntegralTeacher, true, true, outil);
                                    scrollToElementTop(`${outil}-chat-history`, botLoadingDiv);
                                }
                            }
                            if (dataObj.conversation_id) {
                                teacherConversationIds[outil] = dataObj.conversation_id;
                                imageEnvoyeeAvecSucces = true;
                            }
                        } catch(e) {
                            console.warn("L'équilibre se rétablit : un fragment de conscience a été réassemblé.");
                        }
                    }
                }
            }

            if (!texteIntegralTeacher) {
                botLoadingDiv.innerHTML = "Je n'ai pas de réponse à formuler pour l'instant. Peux-tu reformuler ta demande ?";
            } else {
                afficherReponseAvecFondu(botLoadingDiv, texteIntegralTeacher, true, false, outil); // rendu final, curseur retiré
            }
        }

        if (imageJointeTeacher && imageEnvoyeeAvecSucces) delete fichiersEnAttente[`${outil}-chat-history`];

        if (botLoadingDiv.textContent.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="btn-action-doc" onclick="copierTexte(this)" title="Copier pour Word" aria-label="Copier pour Word"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg></button>
                <button class="btn-action-doc" onclick="imprimerDocument(this)" title="Imprimer / Enregistrer en PDF" aria-label="Imprimer ou enregistrer en PDF"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg></button>
            `;
            botLoadingDiv.appendChild(actionsDiv);
        }
        saveChatHistory(outil);

    } catch (error) {
        console.error("Détail de la perturbation :", error);
        botLoadingDiv.innerHTML = `<span style="color:#EF4444;">Une perturbation traverse l'Espace (${error.message}). Reprenez votre souffle et essayez à nouveau.</span>`;
        saveChatHistory(outil);
    } finally {
        inputField.disabled = false;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        inputField.focus();
        // ❖ Volontairement pas de scrollToBottom ici : voir sendSasMessage.
    }
}

// =======================================================================
// ❖ OUTILS D'ÉDITION PURES ET VALIDATION ❖
// =======================================================================
// ❖ Cause probable de l'affichage intermittent du logo signalé en test réel :
// ce lien pointait vers la page "blob" de GitHub avec ?raw=true, qui répond
// par une redirection 302 vers raw.githubusercontent.com -- suivie de façon
// peu fiable selon le contexte de rendu (impression, export PDF, connexion
// mobile instable), et parfois soumise aux limites/anti-hotlinking de GitHub.
// logo-entete.png (utilisé pour l'en-tête du site) fonctionne de façon fiable
// via un chemin relatif local -- même logique appliquée ici. IMPORTANT :
// s'assurer que le fichier logo-signature-doc.png est bien déployé à la
// racine du site (même dossier que logo-entete.png) sous ce nom exact.
const urlSceau = "logo-signature-doc.png";

function imprimerDocument(bouton) {
    const documentDiv = bouton.closest('.bot-message');
    const clone = documentDiv.cloneNode(true);
    const actions = clone.querySelector('.message-actions');
    if (actions) actions.remove();

    const contenuHTML = clone.innerHTML;

    const printArea = document.getElementById('print-area');

    printArea.innerHTML = `
        <style>
            .document-aere {
                font-family: Arial, sans-serif;
                font-size: 12pt;
                color: #000;
                background: #fff;
                padding: 20px;
                line-height: 1.6;
                white-space: pre-wrap;
            }
            .document-aere h1, .document-aere h2, .document-aere h3, .document-aere h4 {
                margin-top: 1.5em;
                margin-bottom: 0.5em;
                color: #1F2937;
            }
            .document-aere p {
                margin-bottom: 1em;
            }
            .document-aere ul, .document-aere ol {
                margin-top: 0.5em;
                margin-bottom: 1em;
                padding-left: 20px;
            }
            .document-aere li {
                margin-bottom: 0.5em;
            }
            /* ❖ Reskin "fiche de leçon" : cette zone d'impression est un
               <style> isolé (voir commentaire plus haut sur la cause du
               logo intermittent) -- il ne reprend pas automatiquement
               style.css, donc les classes .fiche-* doivent être redéfinies
               ici en version imprimable (fond blanc, pas d'ombre, accent
               conservé pour le repérage bleu/vert secondaire/primaire). */
            .document-aere .fiche-lecon {
                white-space: normal;
                --fiche-accent: #3B82F6;
                --fiche-accent-douce: #EFF6FF;
            }
            .document-aere .fiche-lecon.accent-vert {
                --fiche-accent: #059669;
                --fiche-accent-douce: #ECFDF5;
            }
            .document-aere .fiche-lecon > * + * { margin-top: 1.1em; }
            .document-aere .fiche-section-titre {
                font-size: 10pt;
                letter-spacing: 0.04em;
                font-weight: 700;
                color: var(--fiche-accent);
                text-transform: uppercase;
                margin-top: 1.2em;
            }
            .document-aere .fiche-bloc-entete {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 0.4em;
            }
            .document-aere .fiche-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 999px;
                background: var(--fiche-accent-douce);
                color: var(--fiche-accent);
                border: 1px solid var(--fiche-accent);
                font-size: 10pt;
                font-weight: 600;
            }
            .document-aere .fiche-badge-label { opacity: 0.75; font-weight: 500; }
            .document-aere .fiche-badge.fiche-badge-competence {
                display: block;
                width: 100%;
                background: #F1F5F9;
                color: #0F172A;
                border-color: #CBD5E1;
            }
            .document-aere .fiche-carte {
                border: 1px solid #CBD5E1;
                border-radius: 10px;
                padding: 12px 16px;
                margin-top: 0.4em;
            }
            .document-aere .fiche-liste-simple > div,
            .document-aere .fiche-phase-ligne {
                padding: 6px 0;
                border-top: 1px solid #E5E7EB;
            }
            .document-aere .fiche-liste-simple > div:first-child,
            .document-aere .fiche-phase-ligne:first-of-type {
                border-top: none;
                padding-top: 0;
            }
            .document-aere .fiche-phase-titre {
                font-weight: 700;
                color: var(--fiche-accent);
            }
            .document-aere .fiche-phase-legende {
                display: block;
                font-size: 8.5pt;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                font-weight: 700;
                color: #475569;
                margin-bottom: 2px;
            }
            .document-aere .fiche-lecon p { margin: 0 0 0.4em; white-space: normal; }
            .document-aere .fiche-lecon p:last-child { margin-bottom: 0; }
            .document-aere .fiche-lecon ul { margin: 0.3em 0 0.4em 1.1em; padding: 0; }
            .document-aere .fiche-lecon + .signature-doc,
            .document-aere .fiche-lecon .signature-doc {
                display: block;
                margin-top: 1em;
                opacity: 0.6;
                font-size: 9pt;
            }
            .document-aere .fiche-carte.fiche-corrige {
                border-color: #FBBF24;
                background: #FFFBEB;
            }
            .document-aere .mission-devoir {
                border: 1px solid #BFDBFE;
                background: #EFF6FF;
                border-radius: 14px;
                padding: 12px 16px;
                margin-top: 0.6em;
            }
            .document-aere .mission-devoir-titre {
                font-size: 9pt;
                letter-spacing: 0.04em;
                font-weight: 700;
                color: #2563EB;
                text-transform: uppercase;
                margin-bottom: 6px;
            }
            .document-aere .mission-devoir-contenu {
                background: transparent;
                border: none;
                padding: 0;
                margin: 0;
                white-space: pre-wrap;
                font-family: inherit;
            }
        </style>

        <div class="document-aere">
            ${contenuHTML}
        </div>`;
        // ❖ Aucun pied de page n'est ajouté ici : la fiche porte déjà sa
        // propre signature (« ❖ Architecture Pédagogique EdukaTchat ❖ »),
        // mieux intégrée à la mise en page. Le bloc précédent — sceau,
        // « EdukaTchat™ » et mention de propriété — faisait doublon et,
        // avec ses 50 px de marge haute et son image de 60 px, poussait
        // régulièrement une page supplémentaire ne contenant que lui.

    window.print();
}

function copierTexte(bouton) {
    const documentDiv = bouton.closest('.bot-message');
    const clone = documentDiv.cloneNode(true);
    const actions = clone.querySelector('.message-actions');
    if (actions) actions.remove();

    const contenuHTML = clone.innerHTML;
    const texteBrut = clone.innerText;

    const signatureHTML = `
        <br><br>
        <div style="text-align: center; font-family: Arial, sans-serif; border-top: 2px solid #E5E7EB; padding-top: 20px;">
            <img src="${urlSceau}" alt="Sceau EdukaTchat" style="height: 60px; width: auto; display: block; margin: 0 auto;">
            <strong style="font-size: 14pt; color: #1F2937; display: block; margin-top: -12px;">EdukaTchat™</strong>
            <span style="font-size: 10pt; color: #6B7280; display: block; margin-top: 2px;">© Propriété Intellectuelle Exclusive</span>
        </div>`;

    const blobHtml = new Blob([contenuHTML + signatureHTML], { type: "text/html" });
    const blobText = new Blob([texteBrut + "\n\n© EdukaTchat™ - Propriété Intellectuelle Exclusive"], { type: "text/plain" });

    try {
        const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
        navigator.clipboard.write(data).then(() => {
            animerBoutonCopie(bouton);
        });
    } catch (err) {
        navigator.clipboard.writeText(texteBrut + "\n\n© EdukaTchat™ - Propriété Intellectuelle").then(() => {
            animerBoutonCopie(bouton);
        });
    }
}

function animerBoutonCopie(bouton) {
    const texteOriginal = bouton.innerHTML;
    bouton.innerHTML = "✨ Document et Sceau copiés !";
    bouton.style.color = "#10B981";
    bouton.style.borderColor = "#10B981";

    setTimeout(() => {
        bouton.innerHTML = texteOriginal;
        bouton.style.color = "";
        bouton.style.borderColor = "";
    }, 2000);
}

// ❖ LA PRONONCIATION À LA DEMANDE, CIBLÉE SUR LA PHRASE (langues uniquement) ❖
// Historique des tentatives :
//  1) Repérage par guillemets doubles ("..."). Le français utilise lui aussi
//     les guillemets pour citer un mot ("bonjour") -> bouton sur les deux.
//  2) Consigne de prompt demandant des BACKTICKS (`mot`) autour du seul mot
//     étranger. Résultat instable d'une réponse à l'autre : parfois respecté,
//     parfois non (l'IA revient aux guillemets classiques), donc aucun
//     bouton n'apparaissait du tout sur certaines réponses.
// Version actuelle : on revient aux guillemets doubles -- seul signe que
// l'IA utilise VRAIMENT de façon systématique, confirmé sur tous les essais
// -- et on compense le défaut n°1 avec un filtre local : on ignore tout
// segment entre guillemets qui correspond à un mot ou une expression
// française courante (salutations/politesse -- le vocabulaire typique de ce
// contexte, pas une détection de langue complète). Le prompt garde sa
// consigne en complément, mais le site ne dépend plus de son respect exact.
const phrasesAudioEnAttente = {};

const MOTS_COURANTS_FRANCAIS = new Set([
    'bonjour', 'bonsoir', 'salut', 'au revoir', 'a plus', 'a bientot',
    'a tout a lheure', 'merci', 'merci beaucoup', 'de rien', 'pardon',
    'excuse-moi', 'excusez-moi', 'oui', 'non', 'peut-etre', 'sil vous plait',
    'sil te plait', 'comment allez-vous', 'comment vas-tu', 'comment ca va',
    'ca va', 'tres bien', 'bien', 'bienvenue', 'bonne journee', 'bonne soiree',
    'bonne nuit', 'enchante', 'enchantee', 's il te plait', 's il vous plait'
]);

function normaliserPourComparaison(texte) {
    return texte
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// ❖ Filtre complété (17 août) : MOTS_COURANTS_FRANCAIS seul ne couvrait
// que les salutations ("bonjour", "merci"...) -- une phrase française
// quelconque comme "j'ai faim" n'y figurait pas et recevait quand même un
// bouton d'écoute. ressembleAuFrancais() ajoute une heuristique légère
// (élisions "j'/l'/d'/qu'..." + mots-outils français + accents) plutôt
// qu'une liste figée, sans dépendre d'une vraie détection de langue.
const MOTS_OUTILS_FRANCAIS = new Set([
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'au', 'aux',
    'est', 'es', 'suis', 'ai', 'as', 'avons', 'avez', 'ont',
    'ne', 'pas', 'que', 'qui', 'quoi', 'et', 'mais', 'donc', 'car',
    'pour', 'avec', 'sans', 'dans', 'chez', 'vers', 'entre',
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
    'notre', 'votre', 'leur', 'leurs', 'ce', 'cet', 'cette', 'ces', 'tres'
]);

function ressembleAuFrancais(phrase) {
    const normalisee = normaliserPourComparaison(phrase);
    if (/[éèàçêîôûùïëœ]/.test(normalisee)) return true;
    const mots = normalisee.split(/\s+/).filter(Boolean);
    if (mots.length === 0) return false;
    let indicesFrancais = 0;
    for (const mot of mots) {
        if (/^(j|l|d|qu|n|s|m|t|c|jusqu|lorsqu|puisqu)['’]/i.test(mot)) {
            indicesFrancais++;
            continue;
        }
        const motNu = mot.replace(/^['’]+|['’.,!?;:]+$/g, '');
        if (MOTS_OUTILS_FRANCAIS.has(motNu)) indicesFrancais++;
    }
    return (indicesFrancais / mots.length) >= 0.5;
}

function ajouterBoutonsPrononciationInline(messageDiv) {
    const MOTIF_GUILLEMETS = /["“”]([^"“”<>]{1,150})["“”]/g;
    let indexPhrase = 0;
    const phrasesTrouvees = [];

    messageDiv.innerHTML = messageDiv.innerHTML.replace(MOTIF_GUILLEMETS, (correspondance, phraseBrute) => {
        const phrase = phraseBrute.trim();
        if (!phrase || MOTS_COURANTS_FRANCAIS.has(normaliserPourComparaison(phrase)) || ressembleAuFrancais(phrase)) {
            return correspondance; // phrase française (courante ou détectée) : pas de bouton
        }
        const id = `phrase-audio-${Date.now()}-${indexPhrase}`;
        indexPhrase++;
        phrasesTrouvees.push({ id, phrase });
        return `${correspondance}<button type="button" class="btn-ecoute-inline" data-phrase-id="${id}" onclick="ecouterPhraseParId(this)" title="Écouter la prononciation" aria-label="Écouter la prononciation">🔊</button>`;
    });

    phrasesTrouvees.forEach(({ id, phrase }) => {
        phrasesAudioEnAttente[id] = phrase;
    });
}

async function ecouterPhraseParId(bouton) {
    const texte = phrasesAudioEnAttente[bouton.dataset.phraseId];
    if (!texte) return;

    const contenuOriginal = bouton.innerHTML;
    bouton.innerHTML = '⏳';
    bouton.disabled = true;

    try {
        const reponse = await fetch('https://api.edukatchat.org/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texte: texte, avatar: avatarActif })
        });

        if (!reponse.ok) {
            throw new Error(`Le serveur a répondu avec l'état : ${reponse.status}`);
        }

        const blobAudio = await reponse.blob();
        const urlAudio = URL.createObjectURL(blobAudio);
        const lecteur = new Audio(urlAudio);
        lecteur.play();
        lecteur.onended = () => URL.revokeObjectURL(urlAudio);
    } catch (erreur) {
        console.error("Échec de la synthèse vocale :", erreur);
        bouton.innerHTML = '⚠️';
        setTimeout(() => { bouton.innerHTML = contenuOriginal; }, 2000);
        bouton.disabled = false;
        return;
    }

    bouton.innerHTML = contenuOriginal;
    bouton.disabled = false;
}

function verifierFormulaire() {
    const habitude = document.getElementById('habitudes-revision').value;
    const stress = document.getElementById('gestion-stress').value;
    const champClasse = document.getElementById('niveau-classe');
    // ❖ Le champ classe n'existe que si l'ajout HTML a été fait : tant
    // qu'il n'est pas présent, on ne bloque pas le formulaire pour autant.
    const classe = champClasse ? champClasse.value : "ok";
    const bouton = document.getElementById('btn-commencer');

    if (habitude !== "" && stress !== "" && classe !== "") {
        bouton.disabled = false;
        bouton.style.opacity = '1';
        bouton.style.cursor = 'pointer';
    } else {
        bouton.disabled = true;
        bouton.style.opacity = '0.5';
        bouton.style.cursor = 'not-allowed';
    }
}

// =======================================================================
// ❖ GESTION DU PLEIN ÉCRAN ❖
// =======================================================================
function toggleFullScreen() {
    const doc = window.document;
    const docEl = doc.documentElement;
    const btn = document.getElementById('btn-fullscreen');

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        if (requestFullScreen) {
            requestFullScreen.call(docEl);
            if (btn) btn.title = "Quitter le plein écran";
        }
    } else {
        if (cancelFullScreen) {
            cancelFullScreen.call(doc);
            if (btn) btn.title = "Plein écran";
        }
    }
}

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-fullscreen');
    if (!document.fullscreenElement && btn) {
        btn.title = "Plein écran";
    }
});

// =======================================================================
// ❖ LA MAÏEUTIQUE DE L'ORIENTATION (Version Holistique) ❖
// =======================================================================
function calculerMO() {
    const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;

    const frAn = getVal('mo-fr-an'), frBepc = getVal('mo-fr-bepc');
    const mathAn = getVal('mo-math-an'), mathBepc = getVal('mo-math-bepc');
    const pcAn = getVal('mo-pc-an'), pcBepc = getVal('mo-pc-bepc');
    const angAn = getVal('mo-ang-an'), angBepcE = getVal('mo-ang-bepc-e'), angBepcO = getVal('mo-ang-bepc-o');

    const angBepc = (angBepcE > 0 || angBepcO > 0) ? (angBepcE + angBepcO) / 2 : 0;

    const poidsLitteraire = ((frAn + frBepc) * 2) + ((angAn + angBepc) * 1);
    const poidsScientifique = ((mathAn + mathBepc) * 2) + ((pcAn + pcBepc) * 1);

    const grandTotal = poidsLitteraire + poidsScientifique;
    const mo = (grandTotal / 12).toFixed(2);

    const resultContainer = document.getElementById('mo-result-container');
    const scoreDisplay = document.getElementById('mo-score-display');
    const adviceDisplay = document.getElementById('mo-advice-display');

    scoreDisplay.textContent = mo;

    const moisActuel = new Date().getMonth();
    const estPeriodePostBepc = (moisActuel >= 6 && moisActuel <= 8);

    const possedeSceau = localStorage.getItem('eduka_sceau') !== null;
    let directiveCognitive = "";

    if (possedeSceau) {
        directiveCognitive = "<br><br><span style='color: #4B5563; font-size: 0.95em;'><strong>✧ Quête d'Orientation :</strong> Retourne dans ton Espace Élève et communique ce score à ton Répétiteur. Demande-lui de confronter cette moyenne avec ton profil cognitif profond pour découvrir ta véritable voie.</span>";
    }

    let conseil = "";
    let actionHTML = "";

    if (estPeriodePostBepc) {
        if (mo < 10) {
            conseil = "Les épreuves sont terminées. La marche était un peu haute cette année, mais chaque échec porte les graines de ta future réussite. Repose-toi, l'Académie t'aidera l'année prochaine.";
            resultContainer.style.borderLeftColor = "#6B7280";
            actionHTML = `<button onclick="fermerBoussole()" style="margin-top:20px; padding: 10px; width:100%; background-color: #6B7280; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight: bold;">Fermer et méditer</button>`;
        } else if (mo >= 10 && mo < 12) {
            conseil = "Félicitations, l'essentiel est accompli. Ton passage en Seconde est validé. Ton profil t'ouvre naturellement les portes de la série Littéraire (A). Profite d'un repos mérité.";
            resultContainer.style.borderLeftColor = "#F59E0B";
            actionHTML = `<button onclick="fermerBoussole()" style="margin-top:20px; padding: 10px; width:100%; background-color: #F59E0B; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight: bold;">Fermer la Boussole</button>`;
        } else {
            if (poidsLitteraire > poidsScientifique) {
                conseil = "Brillante réussite ! Ton profil est fortement marqué par les Lettres, t'assurant la série A. Cependant, ton excellente moyenne globale t'ouvre également les portes de la prestigieuse série Scientifique (C) si tel est ton choix.";
            } else {
                conseil = "Une victoire éclatante ! Ton esprit logique a triomphé. Les portes de la série Scientifique (C) te sont grandes ouvertes, te laissant le champ libre pour l'excellence.";
            }
            resultContainer.style.borderLeftColor = "#10B981";
            actionHTML = `<button onclick="fermerBoussole()" style="margin-top:20px; padding: 10px; width:100%; background-color: #10B981; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight: bold;">Fermer la Boussole</button>`;
        }
    } else {
        if (mo < 10) {
            conseil = "Ta dynamique actuelle est fragile. Ne laisse pas l'angoisse s'installer, il est encore temps d'agir. Cible tes lacunes dès aujourd'hui.";
            resultContainer.style.borderLeftColor = "#EF4444";
            actionHTML = `<button onclick="fermerBoussole(); window.scrollTo(0, document.body.scrollHeight);" style="margin-top:20px; padding: 10px; width:100%; background-color: #EF4444; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight: bold;">Fermer et agir</button>`;
        } else if (mo >= 10 && mo < 12) {
            conseil = "Tu es dans la course. Ton profil est équilibré pour la série A. Cependant, pour sécuriser une place en série C, il faut intensifier ton entraînement mathématique.";
            resultContainer.style.borderLeftColor = "#F59E0B";
            actionHTML = `<button onclick="fermerBoussole()" style="margin-top:20px; padding: 10px; width:100%; background-color: #F59E0B; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight: bold;">Fermer la Boussole</button>`;
        } else {
            conseil = "Excellente trajectoire. Que ton cœur penche vers les Lettres ou les Sciences, tes efforts actuels te garantissent le choix. Maintiens cette rigueur.";
            resultContainer.style.borderLeftColor = "#3B82F6";
            actionHTML = `<button onclick="fermerBoussole()" style="margin-top:20px; padding: 10px; width:100%; background-color: #3B82F6; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight: bold;">Fermer la Boussole</button>`;
        }
    }

    adviceDisplay.innerHTML = conseil + directiveCognitive + actionHTML;
    resultContainer.style.display = "block";
}

// =======================================================================
// ❖ LA RESPIRATION DES FENÊTRES (OUVERTURE ET FERMETURE) ❖
// =======================================================================
function ouvrirBoussole() {
    document.getElementById('mo-modal').classList.add('active');
}
function fermerBoussole() {
    document.getElementById('mo-modal').classList.remove('active');
}
function ouvrirAtelier() {
    document.getElementById('orateur-modal').classList.add('active');
}
function fermerAtelier() {
    document.getElementById('orateur-modal').classList.remove('active');
}
function ouvrirPhilo() { document.getElementById('philo-modal').classList.add('active'); }
function fermerPhilo() { document.getElementById('philo-modal').classList.remove('active'); }
function ouvrirSciences() { document.getElementById('sciences-modal').classList.add('active'); }
function fermerSciences() { document.getElementById('sciences-modal').classList.remove('active'); }
function ouvrirBoussoleUniv() { document.getElementById('univ-modal').classList.add('active'); }
function fermerBoussoleUniv() { document.getElementById('univ-modal').classList.remove('active'); }

// =======================================================================
// ❖ LA NOUVELLE ARÈNE UNIVERSELLE (ATELIERS & BOUSSOLE) ❖
// =======================================================================
let activeAtelier = "";
let activeAtelierInputs = {};
let areneConversationId = "";

function preparerArene(nomAtelier, messageBienvenue, inputs) {
    activeAtelier = nomAtelier;
    activeAtelierInputs = inputs;
    areneConversationId = "";

    // Basculer l'affichage
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    document.querySelectorAll('.custom-chat-container').forEach(c => c.classList.remove('active'));
    document.getElementById('container-arene-custom').classList.add('active');
    document.getElementById('teacher-tabs-container').style.display = 'none';

    // Purifier l'historique
    const chatHistory = document.getElementById('arene-chat-history');
    chatHistory.innerHTML = `<div class="message system-message">${messageBienvenue}</div>`;
}

function invoquerJury() {
    const sujet = document.getElementById('orateur-sujet').value;
    const cadre = document.getElementById('orateur-cadre').value;
    if (!sujet || !cadre) { alert("Le jury exige de préciser l'œuvre et le cadre."); return; }
    fermerAtelier();
    preparerArene('orateur', `Le Jury est prêt à vous écouter sur : <strong>${sujet}</strong> (${cadre}).`, { sujet_etudie: sujet, cadre_epreuve: cadre });
}

function invoquerMaitrePhilo() {
    const sujet = document.getElementById('philo-sujet').value;
    const cadre = document.getElementById('philo-cadre').value;
    if (!sujet || !cadre) { alert("Le Maître exige un sujet et un cadre de réflexion."); return; }
    fermerPhilo();
    preparerArene('philo', `L'Espace de réflexion est ouvert. Thème : <strong>${sujet}</strong>.`, { sujet_etudie: sujet, cadre_epreuve: cadre });
}

function invoquerLaboratoire() {
    const sujet = document.getElementById('sciences-sujet').value;
    const cadre = document.getElementById('sciences-cadre').value;
    if (!sujet || !cadre) { alert("Les protocoles exigent un sujet et une méthode."); return; }
    fermerSciences();
    preparerArene('sciences', `Le Laboratoire est actif. Protocole : <strong>${sujet}</strong>.`, { sujet_etudie: sujet, cadre_epreuve: cadre });
}

function invoquerConseiller() {
    const serie = document.getElementById('univ-serie').value;

    // ✦ CE QUI CHANGE : On supprime 'annee' et on capte la date complète ✦
    const dateNaissance = document.getElementById('univ-date-naissance').value;

    const maths = document.getElementById('univ-maths').value || "0";
const francais = document.getElementById('univ-francais').value || "0";
const philo = document.getElementById('univ-philo').value || "0";
const pc = document.getElementById('univ-pc').value || "0";
const svt = document.getElementById('univ-svt').value || "0";
const hg = document.getElementById('univ-hg').value || "0";
    const moyenne = document.getElementById('univ-moyenne').value;

    // ✦ CE QUI CHANGE : L'alerte exige désormais la date de naissance ✦
    if (!serie || !dateNaissance || !moyenne) {
        alert("L'algorithme requiert au moins votre série, votre date de naissance et votre moyenne."); return;
    }

    // ✦ L'accès est désormais libre pour tous les bacheliers ✦
    fermerBoussoleUniv();

    const inputs = {
        serie_bac: serie,
        date_naissance: dateNaissance,
        note_maths: maths,
        note_francais: francais,
        note_philo: philo,
        note_pc: pc,  // ✦ Retour à l'identifiant originel et correct
        note_svt: svt,
        note_hg: hg,
        moyenne_bac: moyenne
    };

    preparerArene('conseiller', `Le Conseiller Universitaire analyse vos résultats de la Série ${serie}... Que souhaitez-vous savoir sur vos orientations possibles ?`, inputs);

    // 3. Déclenchement automatique de l'IA (ON GARDE INTACT)
    setTimeout(() => {
        const inputField = document.getElementById('arene-user-input');
        if(inputField) {
            inputField.value = "Analyse mon profil, indique-moi mes chances et propose-moi des formations adaptées.";
            sendAreneMessage();
        }
    }, 800);
}
// --- LOGIQUE DE DIALOGUE ET DE FLUX CONTINU ---
function handleAreneKeyPress(event) {
    if (event.key === 'Enter') sendAreneMessage();
}

async function sendAreneMessage() {
    const inputField = document.getElementById('arene-user-input');
    const button = inputField.nextElementSibling;
    const message = inputField.value.trim();
    if (!message) return;

    inputField.disabled = true;
    button.disabled = true;
    button.style.opacity = '0.5';

    const chatHistory = document.getElementById('arene-chat-history');
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message user-message';
    userMsgDiv.textContent = message;
    userMsgDiv.appendChild(creerBoutonReutiliser(message, 'arene-user-input'));
    chatHistory.appendChild(userMsgDiv);

    inputField.value = '';
    scrollToBottom('arene-chat-history');

    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message bot-message apparition-fluide';
    botLoadingDiv.innerHTML = creerBulleReflexion("L'esprit rassemble le savoir...");
    chatHistory.appendChild(botLoadingDiv);
    scrollToElementTop('arene-chat-history', botLoadingDiv);

    const sceau = localStorage.getItem('eduka_sceau') || "";

    try {
        const response = await fetch('https://api.edukatchat.org/api/ateliers/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: message,
                conversation_id: areneConversationId,
                matricule: sceau,
                atelier: activeAtelier,
                inputs: activeAtelierInputs,
                device_id: obtenirDeviceId()
            })
        });

        if (!response.ok) throw new Error(`État : ${response.status}`);

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (data.answer && (data.answer.includes("limite") || data.answer.includes("épuisée"))) {
                botLoadingDiv.innerHTML = data.answer + "<br><br><button onclick='openPremiumModal()' style='display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;'>Déverrouiller l'Académie</button>";
            } else {
                botLoadingDiv.textContent = data.answer || "La source est silencieuse.";
            }
        } else {
            // ❖ Même principe : la bulle animée n'est plus effacée par avance.
            let texteIntegral = "";
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (let line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const payload = trimmedLine.substring(6).trim();
                        if (payload === "[DONE]") continue;
                        try {
                            const dataObj = JSON.parse(payload);
                            // ✦ NOUVEAU : On capte les erreurs internes du modèle IA de Dify
                            if (dataObj.event === 'error') {
                                botLoadingDiv.innerHTML = `<span style="color:#EF4444;">Erreur interne Dify : ${dataObj.message || dataObj.code}</span>`;
                                break; // On stoppe la boucle
                            }
                            if (dataObj.event === 'message' || dataObj.event === 'agent_message' || dataObj.answer) {
                                texteIntegral += (dataObj.answer || "");
                                if (texteIntegral.length > 0) {
                                    afficherReponseAvecFondu(botLoadingDiv, texteIntegral, false, true);
                                    scrollToElementTop('arene-chat-history', botLoadingDiv);
                                }
                            }
                            if (dataObj.conversation_id) areneConversationId = dataObj.conversation_id;
                        } catch(e) { }
                    }
                }
            }

            if (!texteIntegral) {
                botLoadingDiv.innerHTML = "Je n'ai pas de réponse à formuler pour l'instant. Peux-tu reformuler ?";
            } else {
                afficherReponseAvecFondu(botLoadingDiv, texteIntegral); // rendu final, curseur retiré
            }
        }

        if (botLoadingDiv.textContent.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `<button class="btn-action-doc" onclick="copierTexte(this)" title="Copier pour Word" aria-label="Copier pour Word"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg></button><button class="btn-action-doc" onclick="imprimerDocument(this)" title="Imprimer / Enregistrer en PDF" aria-label="Imprimer ou enregistrer en PDF"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg></button>`;
            botLoadingDiv.appendChild(actionsDiv);
        }
    } catch (error) {
        botLoadingDiv.innerHTML = `<span style="color:#EF4444;">Le lien a été rompu. Reprenez votre respiration et essayez à nouveau.</span>`;
    } finally {
        inputField.disabled = false;
        button.disabled = false;
        button.style.opacity = '1';
        inputField.focus();
        // ❖ Volontairement pas de scrollToBottom ici : voir sendSasMessage.
    }
}

// =====================================================================
// BIBLIOTHÈQUE D'ILLUSTRATIONS (Espace Enseignant — La Forge)
// =====================================================================
// ❖ Galerie de schémas recréés (vectoriel, sans risque de droits
// d'auteur) et de vraies photographies microscopiques libres de droits,
// consultable depuis La Forge des Leçons. Interroge le même gateway que
// le chat (GET /api/illustrations, sans authentification : ce sont des
// ressources pédagogiques publiques). Portée actuelle : SVT et
// Physique-Chimie, Terminale et Troisième (BEPC) — les autres
// classes/matières n'ont pas encore d'illustrations cataloguées.
let illuMinuteur = null;

function ouvrirBibliothequeIllustrations() {
    document.getElementById('illustrations-modal').classList.add('active');
    rechercherIllustrations();
}

function fermerBibliothequeIllustrations() {
    document.getElementById('illustrations-modal').classList.remove('active');
}

function rechercherIllustrationsDifferee() {
    clearTimeout(illuMinuteur);
    illuMinuteur = setTimeout(rechercherIllustrations, 350);
}

async function rechercherIllustrations() {
    const matiere = document.getElementById('illu-filtre-matiere').value;
    const niveau = document.getElementById('illu-filtre-niveau').value;
    const q = document.getElementById('illu-recherche').value.trim();
    const feedback = document.getElementById('illu-feedback');
    const conteneur = document.getElementById('illu-resultats');

    feedback.textContent = 'Recherche...';
    try {
        const params = new URLSearchParams();
        if (matiere) params.set('matiere', matiere);
        if (niveau) params.set('niveau', niveau);
        if (q) params.set('q', q);
        const reponse = await fetch(`https://api.edukatchat.org/api/illustrations?${params.toString()}`);
        const data = await reponse.json();
        afficherResultatsIllustrations(data.illustrations || []);
        feedback.textContent = data.total > 0
            ? `${data.total} illustration${data.total > 1 ? 's' : ''} trouvée${data.total > 1 ? 's' : ''}.`
            : "Aucune illustration ne correspond à cette recherche pour l'instant.";
    } catch (error) {
        conteneur.innerHTML = '';
        feedback.textContent = "La bibliothèque est momentanément indisponible. Réessayez dans un instant.";
    }
}

function afficherResultatsIllustrations(liste) {
    const conteneur = document.getElementById('illu-resultats');
    conteneur.innerHTML = '';
    liste.forEach((img) => {
        const carte = document.createElement('div');
        carte.style.cssText = 'background:#fff; border:1px solid #E5E7EB; border-radius:8px; overflow:hidden; cursor:pointer; transition:0.15s; display:flex; flex-direction:column;';
        carte.onmouseenter = () => carte.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        carte.onmouseleave = () => carte.style.boxShadow = 'none';
        carte.title = 'Cliquer pour copier le lien Markdown';
        carte.innerHTML = `
            <img src="${img.url}" alt="${img.legende || img.fiche}" style="width:100%; height:110px; object-fit:cover; display:block; background:#F3F4F6;">
            <div style="padding:8px; font-size:0.78em; color:#374151; flex:1;">${(img.legende || img.fiche || '').slice(0, 90)}</div>
        `;
        carte.onclick = () => copierLienIllustration(img.url, img.legende || img.fiche, carte);
        conteneur.appendChild(carte);
    });
}

function copierLienIllustration(url, legende, carteElement) {
    const markdown = `![${legende}](${url})`;
    navigator.clipboard.writeText(markdown).then(() => {
        const feedback = document.getElementById('illu-feedback');
        feedback.textContent = 'Lien Markdown copié — collez-le dans votre fiche (La Forge).';
        if (carteElement) {
            const ancienneBordure = carteElement.style.border;
            carteElement.style.border = '2px solid #10B981';
            setTimeout(() => { carteElement.style.border = ancienneBordure; }, 700);
        }
    }).catch(() => {
        document.getElementById('illu-feedback').textContent = "Impossible de copier automatiquement — clic droit sur l'image pour copier son adresse.";
    });
}

// =======================================================================
// ❖ LA BIBLIOTHÈQUE DE FICHES-FORMULES (Espace Enseignant) ❖
// Même logique que la Bibliothèque d'Illustrations juste au-dessus, mais
// il n'y a pas d'image à afficher : chaque carte montre le titre de la
// fiche, et un clic copie directement son CONTENU texte (le formulaire
// complet) dans le presse-papiers, prêt à coller dans un message adressé
// à l'IA (Forge/Atelier). Portée actuelle : Maths, Physique-Chimie et
// SVT, de la 6ème à la Terminale.
let formulesMinuteur = null;

function ouvrirBibliothequeFormules() {
    document.getElementById('formules-modal').classList.add('active');
    rechercherFormules();
}

function fermerBibliothequeFormules() {
    document.getElementById('formules-modal').classList.remove('active');
}

function rechercherFormulesDifferee() {
    clearTimeout(formulesMinuteur);
    formulesMinuteur = setTimeout(rechercherFormules, 350);
}

async function rechercherFormules() {
    const matiere = document.getElementById('formules-filtre-matiere').value;
    const niveau = document.getElementById('formules-filtre-niveau').value;
    const q = document.getElementById('formules-recherche').value.trim();
    const feedback = document.getElementById('formules-feedback');
    const conteneur = document.getElementById('formules-resultats');

    feedback.textContent = 'Recherche...';
    try {
        const params = new URLSearchParams();
        if (matiere) params.set('matiere', matiere);
        if (niveau) params.set('niveau', niveau);
        if (q) params.set('q', q);
        const reponse = await fetch(`https://api.edukatchat.org/api/formules?${params.toString()}`);
        const data = await reponse.json();
        afficherResultatsFormules(data.formules || []);
        feedback.textContent = data.total > 0
            ? `${data.total} fiche${data.total > 1 ? 's' : ''} trouvée${data.total > 1 ? 's' : ''}.`
            : "Aucune fiche ne correspond à cette recherche pour l'instant.";
    } catch (error) {
        conteneur.innerHTML = '';
        feedback.textContent = "La bibliothèque est momentanément indisponible. Réessayez dans un instant.";
    }
}

function afficherResultatsFormules(liste) {
    const conteneur = document.getElementById('formules-resultats');
    conteneur.innerHTML = '';
    liste.forEach((fiche) => {
        const carte = document.createElement('div');
        carte.style.cssText = 'background:#fff; border:1px solid #E5E7EB; border-radius:8px; padding:12px; cursor:pointer; transition:0.15s;';
        carte.onmouseenter = () => carte.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        carte.onmouseleave = () => carte.style.boxShadow = 'none';
        carte.title = 'Cliquer pour copier cette fiche';
        const apercu = (fiche.contenu || '').split('\n').slice(1, 4).join(' ').slice(0, 110);
        carte.innerHTML = `
            <div style="font-weight:600; font-size:0.88em; color:#111827; margin-bottom:4px;">${fiche.titre || fiche.chapitre}</div>
            <div style="font-size:0.78em; color:#6B7280;">${apercu}…</div>
        `;
        carte.onclick = () => copierFormule(fiche, carte);
        conteneur.appendChild(carte);
    });
}

function copierFormule(fiche, carteElement) {
    navigator.clipboard.writeText(fiche.contenu || '').then(() => {
        const feedback = document.getElementById('formules-feedback');
        feedback.textContent = 'Fiche copiée — collez-la dans votre message (La Forge/L\'Atelier).';
        if (carteElement) {
            const ancienneBordure = carteElement.style.border;
            carteElement.style.border = '2px solid #10B981';
            setTimeout(() => { carteElement.style.border = ancienneBordure; }, 700);
        }
    }).catch(() => {
        document.getElementById('formules-feedback').textContent = "Impossible de copier automatiquement.";
    });
}

// =======================================================================
// ❖ LA BANNIÈRE D'INSTALLATION PWA ❖
// =======================================================================
// Chrome/Edge sur Android ne rendent l'installation possible qu'après avoir
// capturé l'évènement `beforeinstallprompt` -- inexistant sur iOS Safari,
// qui garde son propre chemin ("Partager -> Sur l'écran d'accueil", déjà
// documenté dans index.html). La bannière ne s'affiche donc que là où cet
// évènement existe réellement : jamais de fausse promesse d'installation.
let evenementInstallationDiffere = null;
const CLE_BANNIERE_PWA_MASQUEE = 'eduka_banniere_pwa_masquee';

window.addEventListener('beforeinstallprompt', (evenement) => {
    evenement.preventDefault();
    evenementInstallationDiffere = evenement;
    if (localStorage.getItem(CLE_BANNIERE_PWA_MASQUEE)) return;
    const banniere = document.getElementById('pwa-install-banner');
    if (banniere) banniere.classList.add('active');
});

async function installerPWA() {
    const banniere = document.getElementById('pwa-install-banner');
    if (!evenementInstallationDiffere) {
        if (banniere) banniere.classList.remove('active');
        return;
    }
    evenementInstallationDiffere.prompt();
    await evenementInstallationDiffere.userChoice;
    evenementInstallationDiffere = null;
    if (banniere) banniere.classList.remove('active');
}

function fermerBanniereInstallationPWA() {
    const banniere = document.getElementById('pwa-install-banner');
    if (banniere) banniere.classList.remove('active');
    // ❖ Un refus explicite ne doit pas être réimposé à chaque visite.
    localStorage.setItem(CLE_BANNIERE_PWA_MASQUEE, '1');
}

window.addEventListener('appinstalled', () => {
    const banniere = document.getElementById('pwa-install-banner');
    if (banniere) banniere.classList.remove('active');
    localStorage.setItem(CLE_BANNIERE_PWA_MASQUEE, '1');
});
