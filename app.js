/* EdukaTchat - Propriété Intellectuelle Exclusive */

let pendingSpaceToOpen = null;
let avatarActif = "general"; // Mémorise l'avatar choisi
let espaceActuel = "";       // Mémorise la porte choisie

// =======================================================================
// ❖ LA GESTION DES ESPACES ET DE L'AIGUILLAGE ❖
// =======================================================================

async function openSpace(space) {
    espaceActuel = space; // On enregistre immédiatement l'espace demandé

    if (space === 'eleve') {
        const codeAcces = localStorage.getItem('eduka_sceau');
        
        if (!codeAcces) {
            pendingSpaceToOpen = 'eleve';
            openPremiumModal();
            return;
        }
        
        try {
            const response = await fetch('https://api.edukatchat.org/verifier-sceau', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sceau: codeAcces })
            });
            const data = await response.json();
            
            if (data.valide) {
                // Le sceau est valide : on ouvre le vestibule !
                document.getElementById('discipline-modal').classList.add('active');
            } else {
                openPremiumModal();
            }
        } catch (error) {
            console.error("Erreur de vérification", error);
        }

    } else if (space === 'sas') {
        // Pour le Sas (accès libre), on ouvre directement le vestibule
        document.getElementById('discipline-modal').classList.add('active');

    } else if (space === 'enseignant') {
        // L'Espace Enseignant n'a pas de vestibule, il s'ouvre directement
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
    avatarActif = matiereChoisie;
    fermerVestibule();
    
    // On masque l'accueil et on affiche l'espace de travail
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    // ❖ NETTOYAGE VISUEL GLOBAL ❖
    document.querySelectorAll('iframe').forEach(frame => frame.classList.remove('active'));
    document.getElementById('container-sas-custom').classList.remove('active');
    document.getElementById('container-atelier-custom').classList.remove('active');
    document.getElementById('container-forge-custom').classList.remove('active');
    document.getElementById('container-cabinet-custom').classList.remove('active');
    document.getElementById('teacher-tabs-container').style.display = 'none';
    
    // On active le bon conteneur selon l'espace (Sas ou Élève)
    if(espaceActuel === 'sas') {
        document.getElementById('container-sas-custom').classList.add('active');
        scrollToBottom('sas-chat-history');
    } else if (espaceActuel === 'eleve') {
        document.getElementById('iframe-eleve').classList.add('active');
    }
}

function formaterNomMatiere(code) {
    const noms = {
        'maths': 'Mathématiques', 'physique': 'Physique-Chimie', 'svt': 'SVT',
        'francais': 'Français', 'philosophie': 'Philosophie', 'histoire_geo': 'Histoire-Géo',
        'edhc': 'EDHC', 'anglais': 'Anglais', 'espagnol': 'Espagnol', 'allemand': 'Allemand'
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

    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function toggleFullScreen() {
    let activeElement = document.querySelector('.custom-chat-container.active') || document.querySelector('iframe.active');
    if (!activeElement) return;
    
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        if (activeElement.requestFullscreen) {
            activeElement.requestFullscreen();
        } else if (activeElement.webkitRequestFullscreen) {
            activeElement.webkitRequestFullscreen();
        } else if (activeElement.mozRequestFullScreen) {
            activeElement.mozRequestFullScreen();
        } else if (activeElement.msRequestFullscreen) {
            activeElement.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
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
            localStorage.setItem(`eduka_conv_sas`, sasConversationId);
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
                sasConversationId = savedConvId;
            } else {
                teacherConversationIds[outil] = savedConvId;
            }
        }
    });
}

// --- HARMONIE VISUELLE (MÉMOIRE DU THÈME) ---
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
// ❖ GESTION DU CODE D'ACCÈS ❖
// =======================================================================
function openPremiumModal() {
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
        console.error("Erreur de vérification du Code:", error);
    }
}

function triggerVisionUpsell(chatHistoryId) {
    const chatHistory = document.getElementById(chatHistoryId);
    
    const botUpsellDiv = document.createElement('div');
    botUpsellDiv.className = 'message bot-message';
    botUpsellDiv.innerHTML = "<strong>L'analyse visuelle est restreinte.</strong><br><br>L'analyse visuelle de documents ou de supports photographiés est une fonctionnalité avancée réservée à <strong>l'accès complet</strong>.<br><br><button onclick='openPremiumModal()' style='display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;'>Saisir le Code d'accès</button>";
    
    chatHistory.appendChild(botUpsellDiv);
    scrollToBottom(chatHistoryId);
    
    const outil = chatHistoryId.split('-')[0];
    saveChatHistory(outil);
}

// =======================================================================
// ❖ LOGIQUE DE L'ESPACE DE PRÉPARATION (LE SAS) ❖
// =======================================================================
let sasConversationId = ""; 

function handleSasKeyPress(event) {
    if (event.key === 'Enter') {
        sendSasMessage();
    }
}

async function sendSasMessage() {
    const inputField = document.getElementById('sas-user-input');
    const button = inputField.nextElementSibling; 
    const message = inputField.value.trim();
    
    if (!message) return;

    // Le Silence : On désactive les contrôles
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
    botLoadingDiv.className = 'message bot-message';
    botLoadingDiv.textContent = "L'Assistant analyse votre demande...";
    chatHistory.appendChild(botLoadingDiv);
    scrollToBottom('sas-chat-history');

    const sceau = localStorage.getItem('eduka_sceau') || "";

    // La Maîtrise du Temps : Limite de 30 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch('https://cap-academie-gateway.onrender.com/api/sas/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: message, 
                conversation_id: sasConversationId,
                matricule: sceau,
                avatar: avatarActif // L'INJECTION DE L'AIGUILLAGE EST ICI
            }),
            signal: controller.signal 
        });

        clearTimeout(timeoutId); 
        
        const data = await response.json();
        
        botLoadingDiv.textContent = data.answer || "Une erreur est survenue lors de l'analyse.";
        
        if (data.answer && data.answer.length > 50) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="btn-action-doc" onclick="copierTexte(this)">📋 Copier pour Word</button>
                <button class="btn-action-doc" onclick="imprimerDocument(this)">🖨️ Imprimer / Enregistrer en PDF</button>
            `;
            botLoadingDiv.appendChild(actionsDiv);
        }
        
        if (data.conversation_id) {
            sasConversationId = data.conversation_id;
        }
        
        saveChatHistory('sas');
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            botLoadingDiv.textContent = "Le délai d'attente est dépassé. Le réseau semble saturé, veuillez réessayer.";
        } else {
            botLoadingDiv.textContent = "La connexion à la plateforme a été interrompue. Le réseau est instable.";
        }
        console.error("Erreur de transmission Sas:", error);
        saveChatHistory('sas');
        
    } finally {
        // Le Réveil : On restaure l'énergie de l'interface
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
    if (event.key === 'Enter') {
        sendTeacherMessage(outil);
    }
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
    botLoadingDiv.className = 'message bot-message';
    botLoadingDiv.textContent = "L'Assistant prépare sa réponse...";
    chatHistory.appendChild(botLoadingDiv);
    scrollToBottom(`${outil}-chat-history`);

    const sceau = localStorage.getItem('eduka_sceau') || "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch('https://cap-academie-gateway.onrender.com/api/enseignant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: message, 
                conversation_id: teacherConversationIds[outil],
                outil: outil,
                matricule: sceau
            }),
            signal: controller.signal 
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        
        if (data.answer && (data.answer.includes("votre quota") || data.answer.includes("épuisé"))) {
             botLoadingDiv.innerHTML = data.answer + "<br><br><button onclick='openPremiumModal()' style='display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;'>Saisir le Code d'accès</button>";
        } else {
             botLoadingDiv.textContent = data.answer || "Une erreur est survenue lors de l'analyse.";
             
             if (data.answer && data.answer.length > 50) {
                 const actionsDiv = document.createElement('div');
                 actionsDiv.className = 'message-actions';
                 actionsDiv.innerHTML = `
                     <button class="btn-action-doc" onclick="copierTexte(this)">📋 Copier pour Word</button>
                     <button class="btn-action-doc" onclick="imprimerDocument(this)">🖨️ Imprimer / Enregistrer en PDF</button>
                 `;
                 botLoadingDiv.appendChild(actionsDiv);
             }
        }

        if (data.conversation_id) {
            teacherConversationIds[outil] = data.conversation_id;
        }
        
        saveChatHistory(outil);
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            botLoadingDiv.textContent = "Le délai d'attente est dépassé. L'énergie du réseau fluctue, veuillez formuler votre demande à nouveau.";
        } else {
            botLoadingDiv.textContent = "La connexion à l'Espace a été interrompue. Le lien s'est dispersé.";
        }
        console.error("Erreur de transmission Enseignant:", error);
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
// ❖ OUTILS D'ÉDITION PURES (GÉNÉRATION TEXTUELLE) ❖
// =======================================================================
function imprimerDocument(bouton) {
    const documentDiv = bouton.closest('.bot-message');
    const clone = documentDiv.cloneNode(true);
    const actions = clone.querySelector('.message-actions');
    if (actions) actions.remove();

    const texteBrut = clone.innerText;
    const texteSecurise = texteBrut.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `<div style="font-family: Arial, sans-serif; font-size: 12pt; color: #000; background: #fff; white-space: pre-wrap; word-wrap: break-word;">${texteSecurise}</div>`;

    window.print();
}

function copierTexte(bouton) {
    const documentDiv = bouton.closest('.bot-message');
    const clone = documentDiv.cloneNode(true);
    const actions = clone.querySelector('.message-actions');
    if (actions) actions.remove();

    const texteBrut = clone.innerText;

    navigator.clipboard.writeText(texteBrut).then(() => {
        const texteOriginal = bouton.innerHTML;
        bouton.innerHTML = "✨ Texte copié !";
        bouton.style.color = "#10B981"; 
        bouton.style.borderColor = "#10B981";
        
        setTimeout(() => {
            bouton.innerHTML = texteOriginal;
            bouton.style.color = "";
            bouton.style.borderColor = "";
        }, 2000);
    }).catch(err => {
        console.error("L'énergie n'a pu être transmise :", err);
        alert("La copie automatique a échoué. Veuillez sélectionner le texte manuellement.");
    });
}
