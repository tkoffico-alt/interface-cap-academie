/* EdukaTchat - Propriété Intellectuelle Exclusive */

let pendingSpaceToOpen = null;
let avatarActif = "general"; // Mémorise l'avatar choisi
let espaceActuel = "";       // Mémorise la porte choisie
let disciplineEnAttente = ""; // Retient la matière pendant le questionnaire de diversion

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
                body: JSON.stringify({ sceau: codeAcces })
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

function entrerDansLeChat(matiereChoisie) {
    disciplineEnAttente = matiereChoisie; 
    fermerVestibule(); 
    document.getElementById('profil-modal').classList.add('active');
}

function validerProfilEtEntrer() {
    document.getElementById('profil-modal').classList.remove('active');
    
    const methodeTravail = document.getElementById('habitudes-revision').value;
    const gestionStress = document.getElementById('gestion-stress').value;
    
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
        
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'message system-message';
        
        if (espaceActuel === 'eleve') {
            welcomeDiv.innerHTML = `L'Académie Premium vous ouvre ses portes. Le Répétiteur de <strong>${formaterNomMatiere(avatarActif)}</strong> est à votre écoute.`;
        } else {
            welcomeDiv.innerHTML = `L'Espace de Préparation est prêt. Le Répétiteur de <strong>${formaterNomMatiere(avatarActif)}</strong> vous écoute.`;
        }
        
        chatHistory.appendChild(welcomeDiv);
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
        localStorage.setItem(`eduka_chat_${outil}`, historyDiv.innerHTML);
        
        if (outil === 'sas') {
            localStorage.setItem(`eduka_conv_sas`, JSON.stringify(sasConversationIds));
        } else {
            localStorage.setItem(`eduka_conv_${outil}`, teacherConversationIds[outil]);
        }
    }
}

function restoreChatHistories() {
    const outils = ['sas', 'atelier', 'forge', 'cabinet'];
    
    outils.forEach(outil => {
        const savedHtml = localStorage.getItem(`eduka_chat_${outil}`);
        const historyDiv = document.getElementById(`${outil}-chat-history`);
        
        if (savedHtml && historyDiv) {
            historyDiv.innerHTML = savedHtml;
        }
        
        const savedConvId = localStorage.getItem(`eduka_conv_${outil}`);
        if (savedConvId) {
            if (outil === 'sas') {
                try {
                    sasConversationIds = JSON.parse(savedConvId);
                } catch (e) {
                    sasConversationIds = {};
                }
            } else {
                teacherConversationIds[outil] = savedConvId;
            }
        }
    });
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
    const lien = document.getElementById('lien-abonnement-dynamique');
    if (lien) {
        if (espaceActuel === 'enseignant') {
            lien.href = "https://tally.so/r/RGgdb4"; 
            lien.textContent = "Accéder au Cabinet (Enseignants)";
        } else {
            lien.href = "https://tally.so/r/ODE4rA"; 
            lien.textContent = "Accéder au Bureau des Parents";
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
            body: JSON.stringify({ sceau: matricule })
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

async function sendSasMessage() {
    const inputField = document.getElementById('sas-user-input');
    const button = inputField.nextElementSibling; 
    const message = inputField.value.trim();
    
    if (!message) return;

    const QUOTA_MAX = 10;
    const aujourdhui = new Date().toLocaleDateString(); 
    
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
    botLoadingDiv.textContent = "L'Assistant rassemble son savoir...";
    chatHistory.appendChild(botLoadingDiv);
    scrollToBottom('sas-chat-history');

    const sceau = localStorage.getItem('eduka_sceau') || "";

    try {
        const response = await fetch('https://api.edukatchat.org/api/sas/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: message, 
                conversation_id: sasConversationIds[avatarActif] || "", 
                matricule: sceau,
                avatar: avatarActif
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
            botLoadingDiv.innerHTML = "";
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
                                botLoadingDiv.innerHTML = marked.parse(texteIntegralSas);
                                scrollToBottom('sas-chat-history');
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
    botLoadingDiv.textContent = "Le Cabinet compile les données. L'esprit rassemble le savoir...";
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
                matricule: sceau
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
            botLoadingDiv.innerHTML = ""; 
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
                                botLoadingDiv.innerHTML = marked.parse(texteIntegralTeacher);
                                scrollToBottom(`${outil}-chat-history`);
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
    const bouton = document.getElementById('btn-commencer');
    
    if (habitude !== "" && stress !== "") {
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
// ❖ L'ARÈNE COMMUNE (LE VOILE D'IMMERSION POUR LES ATELIERS) ❖
// =======================================================================

function lancerAreneCommune(url) {
    const conteneur = document.getElementById("arene-conteneur");
    const iframe = document.getElementById("iframe-examinateur");
    const loader = document.getElementById("souffle-attente");

    conteneur.className = "eduka-arene-active";
    loader.style.display = "flex";
    iframe.style.opacity = "0";
    iframe.src = url;

    iframe.onload = function() {
        loader.style.display = "none";
        iframe.style.opacity = "1";
    };
}

function fermerArene() {
    document.getElementById("arene-conteneur").className = "eduka-arene-cache";
    document.getElementById("iframe-examinateur").src = ""; // Brise la connexion pour purifier la mémoire
}

// --- 4. LA BOUSSOLE UNIVERSITAIRE (POST-BAC) ---
function ouvrirBoussoleUniv() { 
    document.getElementById('univ-modal').classList.add('active'); 
}

function fermerBoussoleUniv() { 
    document.getElementById('univ-modal').classList.remove('active'); 
}

function invoquerConseiller() {
    const serie = document.getElementById('univ-serie').value;
    const annee = document.getElementById('univ-annee').value;
    
    // Récupération des énergies (notes). Si le champ est vide, la valeur par défaut est 0
    const maths = document.getElementById('univ-maths').value || 0;
    const francais = document.getElementById('univ-francais').value || 0;
    const philo = document.getElementById('univ-philo').value || 0;
    const pc = document.getElementById('univ-pc').value || 0;
    const svt = document.getElementById('univ-svt').value || 0;
    const hg = document.getElementById('univ-hg').value || 0;
    
    const moyenne = document.getElementById('univ-moyenne').value;

    if (!serie || !annee || !moyenne) { 
        alert("L'algorithme requiert au moins votre série, votre année de naissance et votre moyenne générale pour tracer votre voie."); 
        return; 
    }

    fermerBoussoleUniv();
    
    // Remplace VOTRE_CLE_CONSEILLER par l'identifiant réel généré dans Dify
    const urlDify = "https://ia.edukatchat.org/chat/VOTRE_CLE_CONSEILLER"; 
    
    // Le fil d'invocation qui transmet toutes les variables au Conseiller
    const urlFinale = `${urlDify}?serie_bac=${encodeURIComponent(serie)}&annee_naissance=${encodeURIComponent(annee)}&note_maths=${encodeURIComponent(maths)}&note_francais=${encodeURIComponent(francais)}&note_philo=${encodeURIComponent(philo)}&note_pc=${encodeURIComponent(pc)}&note_svt=${encodeURIComponent(svt)}&note_hg=${encodeURIComponent(hg)}&moyenne_bac=${encodeURIComponent(moyenne)}`;

    // L'éveil de l'arène
    lancerAreneCommune(urlFinale);
}

// --- 1. ATELIER DE L'ORATEUR ---
function checkAtelierQuota() {
    if (localStorage.getItem('eduka_sceau')) return true;
    const aujourdhui = new Date().toLocaleDateString();
    let quota = JSON.parse(localStorage.getItem('eduka_quota_atelier')) || { date: aujourdhui, requetes: 0 };
    if (quota.date !== aujourdhui) quota = { date: aujourdhui, requetes: 0 };
    if (quota.requetes >= 3) {
        alert("Tu as atteint ta limite de 3 essais gratuits pour l'Atelier aujourd'hui. Le savoir demande un Sceau pour continuer sans limite.");
        if (typeof openPremiumModal === 'function') openPremiumModal(); 
        return false;
    }
    quota.requetes++; localStorage.setItem('eduka_quota_atelier', JSON.stringify(quota)); return true;
}

function invoquerJury() {
    if (!checkAtelierQuota()) return;
    const sujet = document.getElementById('orateur-sujet').value;
    const cadre = document.getElementById('orateur-cadre').value;

    if (!sujet || !cadre) { alert("Le jury exige que vous précisiez l'œuvre et le cadre de l'épreuve."); return; }

    fermerAtelier();
    const urlDify = "https://ia.edukatchat.org/chat/UEtRcXzRm3NKj4rq"; // Ta clé Orateur
    const urlFinale = `${urlDify}?sujet_etudie=${encodeURIComponent(sujet)}&cadre_epreuve=${encodeURIComponent(cadre)}`;
    
    lancerAreneCommune(urlFinale);
}

// --- 2. ATELIER DE PHILOSOPHIE ---
function checkPhiloQuota() {
    if (localStorage.getItem('eduka_sceau')) return true;
    const aujourdhui = new Date().toLocaleDateString();
    let quota = JSON.parse(localStorage.getItem('eduka_quota_philo')) || { date: aujourdhui, requetes: 0 };
    if (quota.date !== aujourdhui) quota = { date: aujourdhui, requetes: 0 };
    if (quota.requetes >= 3) {
        alert("Tu as atteint ta limite pour la Philosophie aujourd'hui. Un Sceau est requis.");
        openPremiumModal(); return false;
    }
    quota.requetes++; localStorage.setItem('eduka_quota_philo', JSON.stringify(quota)); return true;
}

function invoquerMaitrePhilo() {
    if (!checkPhiloQuota()) return;
    const sujet = document.getElementById('philo-sujet').value;
    const cadre = document.getElementById('philo-cadre').value;

    if (!sujet || !cadre) { alert("Le Maître exige un sujet et un cadre de réflexion."); return; }

    fermerPhilo();
    const urlDify = "https://ia.edukatchat.org/chat/qjBE3bTsjC1SIWiP"; // Ta clé Philosophie
    const urlFinale = `${urlDify}?sujet_etudie=${encodeURIComponent(sujet)}&cadre_epreuve=${encodeURIComponent(cadre)}`;

    lancerAreneCommune(urlFinale);
}

// --- 3. LABORATOIRE DES SCIENCES ---
function checkSciencesQuota() {
    if (localStorage.getItem('eduka_sceau')) return true;
    const aujourdhui = new Date().toLocaleDateString();
    let quota = JSON.parse(localStorage.getItem('eduka_quota_sciences')) || { date: aujourdhui, requetes: 0 };
    if (quota.date !== aujourdhui) quota = { date: aujourdhui, requetes: 0 };
    if (quota.requetes >= 3) {
        alert("Tu as atteint ta limite pour les Sciences aujourd'hui. Un Sceau est requis.");
        openPremiumModal(); return false;
    }
    quota.requetes++; localStorage.setItem('eduka_quota_sciences', JSON.stringify(quota)); return true;
}

function invoquerLaboratoire() {
    if (!checkSciencesQuota()) return;
    const sujet = document.getElementById('sciences-sujet').value;
    const cadre = document.getElementById('sciences-cadre').value;

    if (!sujet || !cadre) { alert("Les protocoles exigent un sujet et une méthode."); return; }

    fermerSciences();
    const urlDify = "https://ia.edukatchat.org/chat/oxjmp0xUaVqNtASg"; // Ta clé Sciences
    const urlFinale = `${urlDify}?sujet_etudie=${encodeURIComponent(sujet)}&cadre_epreuve=${encodeURIComponent(cadre)}`;

    lancerAreneCommune(urlFinale);
}

// --- 4. BOUSSOLE UNIVERSITAIRE (POST-BAC) ---
function invoquerConseiller() {
    const serie = document.getElementById('univ-serie').value;
    const annee = document.getElementById('univ-annee').value;
    const maths = document.getElementById('univ-maths').value;
    const francais = document.getElementById('univ-francais').value;
    const philo = document.getElementById('univ-philo').value;
    const hg = document.getElementById('univ-hg').value;
    const moyenne = document.getElementById('univ-moyenne').value;

    if (!serie || !annee || !maths || !francais || !philo || !hg || !moyenne) { 
        alert("L'algorithme requiert toutes vos notes (Maths, Français, Philo, HG et Moyenne) pour être précis."); 
        return; 
    }

    fermerBoussoleUniv();
    
    // N'oublie pas de remplacer la valeur ci-dessous par la clé Dify réelle de l'Assistant
    const urlDify = "https://ia.edukatchat.org/chat/VOTRE_CLE_CONSEILLER"; 
    const urlFinale = `${urlDify}?serie_bac=${encodeURIComponent(serie)}&annee_naissance=${encodeURIComponent(annee)}&note_maths=${encodeURIComponent(maths)}&note_francais=${encodeURIComponent(francais)}&note_philo=${encodeURIComponent(philo)}&note_hg=${encodeURIComponent(hg)}&moyenne_bac=${encodeURIComponent(moyenne)}`;

    lancerAreneCommune(urlFinale);
}
