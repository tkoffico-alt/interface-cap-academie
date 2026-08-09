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
        document.getElementById('home-view').style.display = 'none';
        document.getElementById('app-view').style.display = 'flex';

        document.querySelectorAll('iframe').forEach(frame => frame.classList.remove('active'));
        document.getElementById('container-sas-custom').classList.remove('active');
        document.getElementById('teacher-tabs-container').style.display = 'flex';
        switchTeacherTool('atelier');
    }
}

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

function entrerDansLeChat(matiereChoisie) {
    disciplineEnAttente = matiereChoisie;
    fermerVestibule();
    document.getElementById('profil-modal').classList.add('active');
}

function validerProfilEtEntrer() {
    document.getElementById('profil-modal').classList.remove('active');

    const champClasse = document.getElementById('niveau-classe');
    classeActive = champClasse ? champClasse.value : "";
    methodeTravailActive = document.getElementById('habitudes-revision').value;
    gestionStressActive = document.getElementById('gestion-stress').value;

    avatarActif = disciplineEnAttente;

    document.getElementById('home-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    document.querySelectorAll('iframe').forEach(frame => frame.classList.remove('active'));
    document.getElementById('container-sas-custom').classList.remove('active');
    document.getElementById('container-atelier-custom').classList.remove('active');
    document.getElementById('container-forge-custom').classList.remove('active');
    document.getElementById('container-cabinet-custom').classList.remove('active');
    document.getElementById('teacher-tabs-container').style.display = 'none';

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

            if (espaceActuel === 'eleve') {
                welcomeDiv.innerHTML = `L'Académie Premium vous ouvre ses portes. Le Répétiteur de <strong>${formaterNomMatiere(avatarActif)}</strong> est à votre écoute.`;
            } else {
                welcomeDiv.innerHTML = `L'Espace de Préparation est prêt. Le Répétiteur de <strong>${formaterNomMatiere(avatarActif)}</strong> vous écoute.`;
            }

            chatHistory.appendChild(welcomeDiv);
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

function switchTeacherTool(toolID) {
    document.getElementById('container-atelier-custom').classList.remove('active');
    document.getElementById('container-forge-custom').classList.remove('active');
    document.getElementById('container-cabinet-custom').classList.remove('active');

    document.getElementById('tab-atelier').classList.remove('active');
    document.getElementById('tab-forge').classList.remove('active');
    document.getElementById('tab-cabinet').classList.remove('active');

    if (toolID === 'atelier') {
        document.getElementById('container-atelier-custom').classList.add('active');
        document.getElementById('tab-atelier').classList.add('active');
    } else if (toolID === 'forge') {
        document.getElementById('container-forge-custom').classList.add('active');
        document.getElementById('tab-forge').classList.add('active');
    } else if (toolID === 'cabinet') {
        document.getElementById('container-cabinet-custom').classList.add('active');
        document.getElementById('tab-cabinet').classList.add('active');
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
}

function scrollToBottom(elementId) {
    const el = document.getElementById(elementId);
    if(el) {
        el.scrollTop = el.scrollHeight;
    }
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
    const outils = ['atelier', 'forge', 'cabinet'];

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
    const savedTheme = localStorage.getItem('eduka_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeButtonUI(true);
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('eduka_theme', isLight ? 'light' : 'dark');
    updateThemeButtonUI(isLight);
}

function updateThemeButtonUI(isLight) {
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
        if (isLight) {
            themeBtn.innerHTML = "Mode Sombre";
        } else {
            themeBtn.innerHTML = "Mode Clair";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
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
    setTimeout(() => document.getElementById('matricule-input').focus(), 100);
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
// ❖ LOGIQUE DE L'ESPACE DE PRÉPARATION (LE SAS) ❖
// =======================================================================
let sasConversationIds = {};

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
            bouton.textContent = '⏹️';
            bouton.title = "Arrêter l'enregistrement";
        } catch (err) {
            alert("Impossible d'accéder au microphone. Vérifie les autorisations de ton navigateur pour ce site.");
        }
    } else {
        mediaRecorderVocal.stop();
        enregistrementVocalEnCours = false;
        bouton.style.backgroundColor = '#8B5CF6';
        bouton.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.25)';
        bouton.textContent = '🎤';
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
    chatHistory.appendChild(userMsgDiv);

    inputField.value = '';
    scrollToBottom('sas-chat-history');

    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message bot-message apparition-fluide';
    botLoadingDiv.innerHTML = creerBulleReflexion("L'Assistant rassemble son savoir...");
    chatHistory.appendChild(botLoadingDiv);
    scrollToBottom('sas-chat-history');

    try {
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
                gestion_stress: gestionStressActive
            })
        });

        // 1. Vérification de la stabilité
        if (!response.ok) {
            throw new Error(`Le serveur a répondu avec l'état : ${response.status}`);
        }

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            botLoadingDiv.textContent = data.answer || "Le silence est la seule réponse obtenue.";
            if (data.conversation_id) sasConversationIds[avatarActif] = data.conversation_id;
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
                                    botLoadingDiv.innerHTML = marked.parse(texteIntegralSas);
                                    scrollToBottom('sas-chat-history');
                                }
                            }
                            if (dataObj.conversation_id) {
                                sasConversationIds[avatarActif] = dataObj.conversation_id;
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
            }
        }

        if (botLoadingDiv.textContent.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="btn-action-doc" onclick="copierTexte(this)">📋 Copier pour Word</button>
                <button class="btn-action-doc" onclick="imprimerDocument(this)">🖨️ Imprimer / Enregistrer en PDF</button>
            `;
            botLoadingDiv.appendChild(actionsDiv);
        }
        saveChatHistory('sas');

    } catch (error) {
        console.error("Détail de la perturbation :", error);
        botLoadingDiv.innerHTML = `<span style="color:#EF4444;">Le lien avec la source a été interrompu (${error.message}). Reprenez votre respiration et essayez à nouveau.</span>`;
        saveChatHistory('sas');
    } finally {
        inputField.disabled = false;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        inputField.focus();
        scrollToBottom('sas-chat-history');
    }
}

// =======================================================================
// ❖ LOGIQUE DES OUTILS ENSEIGNANT ❖
// =======================================================================
let teacherConversationIds = {
    'atelier': "",
    'forge': "",
    'cabinet': ""
};

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
    chatHistory.appendChild(userMsgDiv);

    inputField.value = '';
    scrollToBottom(`${outil}-chat-history`);

    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message bot-message apparition-fluide';
    botLoadingDiv.innerHTML = creerBulleReflexion("Le Cabinet compile les données. L'esprit rassemble le savoir...");
    chatHistory.appendChild(botLoadingDiv);
    scrollToBottom(`${outil}-chat-history`);

    const sceau = localStorage.getItem('eduka_sceau') || "";

    try {
        const response = await fetch('https://api.edukatchat.org/api/enseignant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: message,
                conversation_id: teacherConversationIds[outil] || "",
                outil: outil,
                matricule: sceau,
                device_id: obtenirDeviceId()
            })
        });

        // 1. Vérification de la stabilité du serveur
        if (!response.ok) {
            throw new Error(`Le serveur a répondu avec l'état : ${response.status}`);
        }

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (data.answer && (data.answer.includes("votre quota") || data.answer.includes("épuisé"))) {
                botLoadingDiv.innerHTML = data.answer + "<br><br><button onclick='openPremiumModal()' style='display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;'>Saisir le Code d'accès</button>";
            } else {
                botLoadingDiv.textContent = data.answer || "La source est silencieuse.";
            }
            if (data.conversation_id) teacherConversationIds[outil] = data.conversation_id;
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
                                    botLoadingDiv.innerHTML = marked.parse(texteIntegralTeacher);
                                    scrollToBottom(`${outil}-chat-history`);
                                }
                            }
                            if (dataObj.conversation_id) {
                                teacherConversationIds[outil] = dataObj.conversation_id;
                            }
                        } catch(e) {
                            console.warn("L'équilibre se rétablit : un fragment de conscience a été réassemblé.");
                        }
                    }
                }
            }

            if (!texteIntegralTeacher) {
                botLoadingDiv.innerHTML = "Je n'ai pas de réponse à formuler pour l'instant. Peux-tu reformuler ta demande ?";
            }
        }

        if (botLoadingDiv.textContent.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="btn-action-doc" onclick="copierTexte(this)">📋 Copier pour Word</button>
                <button class="btn-action-doc" onclick="imprimerDocument(this)">🖨️ Imprimer / Enregistrer en PDF</button>
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
        scrollToBottom(`${outil}-chat-history`);
    }
}

// =======================================================================
// ❖ OUTILS D'ÉDITION PURES ET VALIDATION ❖
// =======================================================================
const urlSceau = "https://github.com/tkoffico-alt/interface-cap-academie/blob/main/logo-signature-doc.png?raw=true";

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
        </style>

        <div class="document-aere">
            ${contenuHTML}

            <div style="margin-top: 50px; text-align: center; border-top: 2px solid #E5E7EB; padding-top: 20px; white-space: normal; line-height: 1.2;">
                <img src="${urlSceau}" alt="Sceau EdukaTchat" style="height: 60px; width: auto; display: block; margin: 0 auto;">
                <strong style="font-size: 14pt; color: #1F2937; letter-spacing: 1px; display: block; margin-top: -12px;">EdukaTchat</strong>
                <span style="font-size: 10pt; color: #6B7280; display: block; margin-top: 2px;">© Propriété Intellectuelle Exclusive | Document officiel généré par IA</span>
            </div>
        </div>`;

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
            <strong style="font-size: 14pt; color: #1F2937; display: block; margin-top: -12px;">EdukaTchat</strong>
            <span style="font-size: 10pt; color: #6B7280; display: block; margin-top: 2px;">© Propriété Intellectuelle Exclusive</span>
        </div>`;

    const blobHtml = new Blob([contenuHTML + signatureHTML], { type: "text/html" });
    const blobText = new Blob([texteBrut + "\n\n© EdukaTchat - Propriété Intellectuelle Exclusive"], { type: "text/plain" });

    try {
        const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
        navigator.clipboard.write(data).then(() => {
            animerBoutonCopie(bouton);
        });
    } catch (err) {
        navigator.clipboard.writeText(texteBrut + "\n\n© EdukaTchat - Propriété Intellectuelle").then(() => {
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
            if (btn) btn.innerHTML = "⛶ Quitter Plein Écran";
        }
    } else {
        if (cancelFullScreen) {
            cancelFullScreen.call(doc);
            if (btn) btn.innerHTML = "⛶ Plein Écran";
        }
    }
}

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-fullscreen');
    if (!document.fullscreenElement && btn) {
        btn.innerHTML = "⛶ Plein Écran";
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
    chatHistory.appendChild(userMsgDiv);

    inputField.value = '';
    scrollToBottom('arene-chat-history');

    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message bot-message apparition-fluide';
    botLoadingDiv.innerHTML = creerBulleReflexion("L'esprit rassemble le savoir...");
    chatHistory.appendChild(botLoadingDiv);
    scrollToBottom('arene-chat-history');

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
                                    botLoadingDiv.innerHTML = marked.parse(texteIntegral);
                                    scrollToBottom('arene-chat-history');
                                }
                            }
                            if (dataObj.conversation_id) areneConversationId = dataObj.conversation_id;
                        } catch(e) { }
                    }
                }
            }

            if (!texteIntegral) {
                botLoadingDiv.innerHTML = "Je n'ai pas de réponse à formuler pour l'instant. Peux-tu reformuler ?";
            }
        }

        if (botLoadingDiv.textContent.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `<button class="btn-action-doc" onclick="copierTexte(this)">📋 Copier</button><button class="btn-action-doc" onclick="imprimerDocument(this)">🖨️ Imprimer</button>`;
            botLoadingDiv.appendChild(actionsDiv);
        }
    } catch (error) {
        botLoadingDiv.innerHTML = `<span style="color:#EF4444;">Le lien a été rompu. Reprenez votre respiration et essayez à nouveau.</span>`;
    } finally {
        inputField.disabled = false;
        button.disabled = false;
        button.style.opacity = '1';
        inputField.focus();
        scrollToBottom('arene-chat-history');
    }
}
