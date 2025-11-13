import { Client } from '@xmtp/browser-sdk';
import { BrowserProvider, getBytes } from 'ethers';

// ============================================
// ESTADO GLOBAL
// ============================================
let xmtpClient = null;
let currentConversation = null;
let provider = null;
let signer = null;
let walletAddress = null;
let conversations = [];
let userProfile = {
    username: ''
};
let friendDirectory = [];

const STORAGE_KEYS = {
    profile: 'xmtpUserProfile',
    friends: 'xmtpFriendDirectory'
};

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const connectBtn = document.getElementById('connectBtn');
const statusEl = document.getElementById('status');
const walletInfo = document.getElementById('walletInfo');
const conversationsSection = document.getElementById('conversationsSection');
const messagesSection = document.getElementById('messagesSection');
const recipientInput = document.getElementById('recipientAddress');
const startDmBtn = document.getElementById('startDmBtn');
const conversationsList = document.getElementById('conversationsList');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const logsDiv = document.getElementById('logs');
const clearLogsBtn = document.getElementById('clearLogs');
const landingView = document.getElementById('landingView');
const chatView = document.getElementById('chatView');
const navProfileTrigger = document.getElementById('navProfileTrigger');
const displayNameInput = document.getElementById('displayNameInput');
const saveDisplayNameBtn = document.getElementById('saveDisplayNameBtn');
const profileChip = document.getElementById('profileChip');
const friendDirectoryCard = document.getElementById('friendDirectory');
const friendSearchInput = document.getElementById('friendSearch');
const friendUsernameInput = document.getElementById('friendUsername');
const friendInboxInput = document.getElementById('friendInboxId');
const friendTypeSelect = document.getElementById('friendContactType');
const addFriendBtn = document.getElementById('addFriendBtn');
const friendListDiv = document.getElementById('friendList');

// ============================================
// PERFIL DEL USUARIO
// ============================================
function loadUserProfile() {
    if (!window.localStorage) return;
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.profile);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed.username === 'string') {
                userProfile.username = parsed.username;
            }
        }
    } catch (error) {
        console.warn('Unable to load profile from storage', error);
    }
    if (displayNameInput && userProfile.username) {
        displayNameInput.value = userProfile.username;
    }
    updateProfileUI();
}

function saveUserProfile() {
    if (!window.localStorage) return;
    try {
        localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(userProfile));
    } catch (error) {
        console.warn('Unable to persist profile', error);
    }
}

function normalizeDisplayName(rawName) {
    if (!rawName) return '';
    const trimmed = rawName.trim().replace(/^@+/, '');
    return trimmed;
}

function setDisplayName(rawName) {
    const normalized = normalizeDisplayName(rawName);
    if (!normalized) {
        alert('Display name cannot be empty.');
        return false;
    }
    if (normalized.length < 3 || normalized.length > 32) {
        alert('Display name must be between 3 and 32 characters.');
        return false;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
        alert('Display name can only include letters, numbers, dots, underscores, or hyphens.');
        return false;
    }
    userProfile.username = normalized;
    saveUserProfile();
    updateProfileUI();
    if (displayNameInput && document.activeElement !== displayNameInput) {
        displayNameInput.value = normalized;
    }
    if (walletAddress) {
        renderWalletInfo(walletAddress);
    }
    log(`🪪 Display name set to @${normalized}`, 'success');
    return true;
}

function updateProfileUI() {
    const hasName = Boolean(userProfile.username);
    if (navProfileTrigger) {
        navProfileTrigger.textContent = hasName ? `@${userProfile.username}` : 'Set display name';
    }
    if (profileChip) {
        if (hasName) {
            profileChip.style.display = 'inline-flex';
            profileChip.innerHTML = `
                <span>@${userProfile.username}</span>
                <span class="chip-secondary">Share this with your inbox ID</span>
            `;
        } else {
            profileChip.style.display = 'none';
            profileChip.innerHTML = '';
        }
    }
    if (displayNameInput && !displayNameInput.matches(':focus')) {
        displayNameInput.value = userProfile.username || '';
    }
}

function openDisplayNamePrompt() {
    const current = userProfile.username ? `@${userProfile.username}` : '';
    const result = prompt('Set your display name', current);
    if (result === null) return;
    setDisplayName(result);
}

function handleDisplayNameSave() {
    if (!displayNameInput) return;
    setDisplayName(displayNameInput.value);
}

// ============================================
// DIRECTORIO DE CONTACTOS
// ============================================
function loadFriendDirectory() {
    friendDirectory = [];
    if (!window.localStorage) {
        renderFriendList();
        return;
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.friends);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                friendDirectory = parsed.filter(item =>
                    item &&
                    typeof item.id === 'string' &&
                    typeof item.username === 'string' &&
                    typeof item.value === 'string' &&
                    (item.type === 'inbox' || item.type === 'address')
                );
            }
        }
    } catch (error) {
        console.warn('Unable to load friend directory', error);
    }
    renderFriendList();
}

function saveFriendDirectory() {
    if (!window.localStorage) return;
    try {
        localStorage.setItem(STORAGE_KEYS.friends, JSON.stringify(friendDirectory));
    } catch (error) {
        console.warn('Unable to persist friend directory', error);
    }
}

function renderFriendList(filterText = '') {
    if (!friendListDiv) return;
    const query = filterText.trim().toLowerCase();
    friendListDiv.innerHTML = '';

    const filtered = friendDirectory.filter(friend => {
        if (!query) return true;
        return (
            friend.username.toLowerCase().includes(query) ||
            friend.value.toLowerCase().includes(query)
        );
    });

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'friend-empty';
        empty.textContent = query
            ? 'No friends match that search.'
            : 'Save a friend above to create quick shortcuts.';
        friendListDiv.appendChild(empty);
        return;
    }

    filtered.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.dataset.friendId = friend.id;
        item.innerHTML = `
            <div class="friend-meta">
                <span class="friend-handle">@${friend.username}</span>
                <span class="friend-hint">${friend.value}</span>
            </div>
            <div class="friend-controls">
                <span class="friend-tag">${friend.type === 'inbox' ? 'Inbox ID' : 'Ethereum'}</span>
                <button class="friend-remove" data-role="remove">Remove</button>
            </div>
        `;
        item.addEventListener('click', (event) => {
            if (event.target && event.target.dataset.role === 'remove') {
                return;
            }
            handleFriendSelection(friend);
        });
        const removeBtn = item.querySelector('.friend-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                handleRemoveFriend(friend.id);
            });
        }
        friendListDiv.appendChild(item);
    });
}

function handleFriendSelection(friend) {
    if (!friend) return;
    const addressRadio = document.querySelector('input[name="addressType"][value="address"]');
    const inboxRadio = document.querySelector('input[name="addressType"][value="inboxId"]');

    if (friend.type === 'inbox' && inboxRadio) {
        inboxRadio.checked = true;
        recipientInput.value = '';
        if (friendInboxInput) friendInboxInput.value = friend.value;
        const inboxField = document.getElementById('recipientInboxId');
        if (inboxField) inboxField.value = friend.value;
    } else if (friend.type === 'address' && addressRadio) {
        addressRadio.checked = true;
        const addressField = document.getElementById('recipientAddress');
        if (addressField) addressField.value = friend.value;
        if (friendInboxInput) friendInboxInput.value = '';
    }
    log(`🔎 Friend selected: @${friend.username}`, 'info');
}

function handleRemoveFriend(friendId) {
    const originalLength = friendDirectory.length;
    friendDirectory = friendDirectory.filter(friend => friend.id !== friendId);
    if (friendDirectory.length !== originalLength) {
        saveFriendDirectory();
        renderFriendList(friendSearchInput ? friendSearchInput.value : '');
        log('🗑️ Friend removed from directory', 'warning');
    }
}

function handleAddFriend() {
    if (!friendUsernameInput || !friendInboxInput || !friendTypeSelect) return;
    const rawUsername = friendUsernameInput.value.trim();
    const value = friendInboxInput.value.trim();
    const type = friendTypeSelect.value;

    if (!rawUsername) {
        alert('Please provide a username for your friend.');
        return;
    }

    const normalizedUsername = normalizeDisplayName(rawUsername);
    if (normalizedUsername.length < 3 || normalizedUsername.length > 32) {
        alert('Usernames must be between 3 and 32 characters.');
        return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
        alert('Usernames can only include letters, numbers, dots, underscores, or hyphens.');
        return;
    }

    if (!value) {
        alert('Please provide an inbox ID or wallet address.');
        return;
    }

    if (type === 'address' && !/^0x[a-fA-F0-9]{40}$/i.test(value)) {
        alert('Enter a valid Ethereum address (0x...).');
        return;
    }

    if (type === 'inbox' && value.length < 6) {
        alert('Inbox IDs should be at least 6 characters.');
        return;
    }

    const existing = friendDirectory.find(friend => friend.username.toLowerCase() === normalizedUsername.toLowerCase());
    if (existing) {
        existing.value = value;
        existing.type = type;
        log(`✏️ Updated @${normalizedUsername} in your directory`, 'info');
    } else {
        friendDirectory.push({
            id: `${normalizedUsername}-${Date.now()}`,
            username: normalizedUsername,
            value,
            type
        });
        log(`🤝 Added @${normalizedUsername} to your friend directory`, 'success');
    }

    saveFriendDirectory();
    renderFriendList(friendSearchInput ? friendSearchInput.value : '');

    friendUsernameInput.value = '';
    friendInboxInput.value = '';
    friendTypeSelect.value = 'inbox';
}

if (saveDisplayNameBtn) {
    saveDisplayNameBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleDisplayNameSave();
    });
}

if (displayNameInput) {
    displayNameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleDisplayNameSave();
        }
    });
}

if (navProfileTrigger) {
    navProfileTrigger.addEventListener('click', (event) => {
        event.preventDefault();
        openDisplayNamePrompt();
    });
}

if (addFriendBtn) {
    addFriendBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleAddFriend();
    });
}

if (friendSearchInput) {
    friendSearchInput.addEventListener('input', (event) => {
        renderFriendList(event.target.value);
    });
}

// ============================================
// SISTEMA DE LOGS
// ============================================
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logsDiv.appendChild(logEntry);
    logsDiv.scrollTop = logsDiv.scrollHeight;
    console.log(`[${type.toUpperCase()}]`, message);
}

clearLogsBtn.addEventListener('click', () => {
    logsDiv.innerHTML = '';
    log('Activity log cleared', 'info');
});

// ============================================
// CREAR SIGNER COMPATIBLE CON XMTP V3 (MetaMask)
// ============================================
function createXmtpSigner(ethersSigner) {
    return {
        type: 'EOA',
        getIdentifier: async () => {
            const address = await ethersSigner.getAddress();
            return {
                identifier: address.toLowerCase(),
                identifierKind: 'Ethereum'
            };
        },
        signMessage: async (message) => {
            const signature = await ethersSigner.signMessage(message);
            return getBytes(signature);
        }
    };
}

// ============================================
// CONECTAR CON METAMASK
// ============================================
connectBtn.addEventListener('click', async () => {
    try {
        if (!window.ethereum) {
            alert('❌ MetaMask not detected. Please install MetaMask from metamask.io');
            return;
        }

        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        statusEl.className = 'status loading';
        statusEl.textContent = 'Connecting';
        
        log('🦊 Connecting to MetaMask...', 'info');
        
        // Conectar con MetaMask
        provider = new BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        
        const address = await signer.getAddress();
        walletAddress = address;
        log(`✅ MetaMask connected: ${address}`, 'success');
        
        log('🔧 Creating XMTP V3 signer...', 'info');
        const xmtpSigner = createXmtpSigner(signer);
        
        log('🚀 Initializing XMTP V3 client...', 'info');
        log('⏳ This can take 10-30 seconds...', 'warning');
        
        // Crear cliente XMTP V3
        xmtpClient = await Client.create(xmtpSigner, {
            env: 'dev' // Cambiar a 'production' para red real
        });
        
        log('✅ XMTP V3 client ready!', 'success');
        log(`📬 Inbox ID: ${xmtpClient.inboxId}`, 'info');
        
        // Actualizar UI
        renderWalletInfo(address);
        
        statusEl.className = 'status connected';
        statusEl.textContent = 'Connected';
        connectBtn.style.display = 'none';
        if (landingView) {
            landingView.style.display = 'none';
        }
        if (chatView) {
            chatView.style.display = '';
        }
        if (friendDirectoryCard) {
            friendDirectoryCard.style.display = 'block';
        }
        renderFriendList(friendSearchInput ? friendSearchInput.value : '');
        
        conversationsSection.style.display = 'block';
        messagesSection.style.display = 'block';
        
        await loadConversations();
        streamConversations();
        
    } catch (error) {
        log(`❌ Error: ${error.message}`, 'error');
        console.error('Full error:', error);
        
        if (error.code === 4001) {
            log('⚠️ User rejected the connection request', 'warning');
        }
        
        statusEl.className = 'status disconnected';
        statusEl.textContent = 'Error';
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect with MetaMask';
        walletAddress = null;
        if (landingView) {
            landingView.style.display = '';
        }
        if (chatView) {
            chatView.style.display = 'none';
        }
        if (friendDirectoryCard) {
            friendDirectoryCard.style.display = 'none';
        }
    }
});

// ============================================
// CARGAR CONVERSACIONES
// ============================================
async function loadConversations() {
    try {
        log('📂 Loading conversations...', 'info');
        conversations = await xmtpClient.conversations.list();
        
        log(`✅ ${conversations.length} conversation(s) found`, 'success');
        
        if (conversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    No conversations yet. Start one above.
                </div>
            `;
            return;
        }
        
        conversationsList.innerHTML = conversations.map((conv, idx) => {
            const isDm = conv.version === 'DM';
            
            // Título según tipo
            let title = 'Conversation';
            let subtitle = '';
            
            if (isDm && conv.peerInboxId) {
                title = `${conv.peerInboxId.slice(0, 8)}...${conv.peerInboxId.slice(-6)}`;
                subtitle = conv.peerInboxId;
            } else if (conv.memberInboxIds && conv.memberInboxIds.length > 0) {
                // Es un grupo
                title = `Group: ${conv.id.slice(0, 8)}...`;
                subtitle = `${conv.memberInboxIds.length} members`;
            } else {
                // Conversación sin peer info (puede pasar durante creación)
                title = `Chat: ${conv.id.slice(0, 8)}...`;
                subtitle = conv.id;
            }
            
            return `
                <div class="conversation-item" data-index="${idx}">
                    <strong>${title}</strong>
                    <span class="conv-type ${isDm ? 'dm' : 'group'}">
                        ${isDm ? 'DM' : 'GROUP'}
                    </span>
                    <br>
                    <small style="color: #718096;">${subtitle}</small>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                selectConversation(idx);
            });
        });
        
    } catch (error) {
        log(`❌ Error al cargar conversaciones: ${error.message}`, 'error');
    }
}

// ============================================
// STREAM DE NUEVAS CONVERSACIONES
// ============================================
async function streamConversations() {
    try {
        log('👂 Listening for new conversations...', 'info');
        const stream = await xmtpClient.conversations.stream();
        
        for await (const conversation of stream) {
            log('✨ New conversation detected!', 'success');
            await loadConversations();
        }
    } catch (error) {
        log(`❌ Conversation stream error: ${error.message}`, 'error');
    }
}

// ============================================
// INICIAR DM (Soporta Dirección o Inbox ID)
// ============================================
startDmBtn.addEventListener('click', async () => {
    const addressInput = recipientInput.value.trim().toLowerCase();
    const inboxIdInput = document.getElementById('recipientInboxId').value.trim().toLowerCase();
    const useInboxId = document.querySelector('input[name="addressType"]:checked').value === 'inboxId';
    
    const input = useInboxId ? inboxIdInput : addressInput;
    
    if (!input) {
        alert('Please enter an Ethereum address or inbox ID.');
        return;
    }
    
    try {
        startDmBtn.disabled = true;
        startDmBtn.textContent = useInboxId ? 'Connecting...' : 'Verifying...';
        
        let inboxId = null;
        
        if (useInboxId) {
            // Usar Inbox ID directamente (método rápido)
            log(`📬 Using inbox ID: ${input.slice(0, 16)}...`, 'info');
            inboxId = input;
        } else {
            // Validar formato de dirección
            if (!/^0x[a-fA-F0-9]{40}$/i.test(input)) {
                alert('Invalid address. Please use a valid Ethereum address (0x...).');
                startDmBtn.disabled = false;
                startDmBtn.textContent = 'Start DM';
                return;
            }
            
            log(`🔍 Looking up ${input}...`, 'info');
            log('⏳ This can take a while on the dev network...', 'warning');
            
            // Intentar obtener el inbox ID con reintentos
            let retries = 5;
            
            while (retries > 0 && !inboxId) {
                try {
                    inboxId = await xmtpClient.getInboxIdByAddress(input);
                    if (inboxId) {
                    log(`✅ Inbox ID found: ${inboxId.slice(0, 16)}...`, 'success');
                        break;
                    }
                } catch (e) {
                    log(`⏳ Retry ${6 - retries}/5...`, 'info');
                }
                
                if (!inboxId && retries > 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                retries--;
            }
            
            if (!inboxId) {
                log('❌ Unable to resolve inbox ID', 'error');
                alert('⚠️ Unable to locate an inbox for this address.\n\n' +
                      '🔄 Try this:\n' +
                      '1. Ask your contact for their inbox ID (visible after they connect)\n' +
                      '2. Switch the selector above to "Inbox ID"\n' +
                      '3. Paste the full inbox ID\n' +
                      '4. Click "Start DM"\n\n' +
                      'This path is faster and more reliable on the dev network.');
                startDmBtn.disabled = false;
                startDmBtn.textContent = 'Start DM';
                return;
            }
        }
        
        log('💬 Creating DM conversation...', 'info');
        
        // En browser-sdk, un DM es un grupo con un solo miembro
        // Intentar obtener DM existente primero
        let dm = await xmtpClient.conversations.getDmByInboxId(inboxId);
        
        if (!dm) {
            // Si no existe, crear nuevo grupo con ese inbox ID (esto crea un DM en V3)
            dm = await xmtpClient.conversations.newGroup([inboxId]);
            log(`✅ New DM conversation created!`, 'success');
        } else {
            log(`✅ DM conversation ready!`, 'success');
        }
        
        // Limpiar inputs
        recipientInput.value = '';
        document.getElementById('recipientInboxId').value = '';
        
        await loadConversations();
        
        // Seleccionar la conversación creada
        const idx = conversations.findIndex(c => c.peerInboxId === inboxId);
        if (idx !== -1) {
            selectConversation(idx);
        }
        
    } catch (error) {
        log(`❌ Error: ${error.message}`, 'error');
        console.error('Error completo:', error);
        alert('Unable to create conversation: ' + error.message);
    } finally {
        startDmBtn.disabled = false;
        startDmBtn.textContent = 'Start DM';
    }
});

// ============================================
// SELECCIONAR CONVERSACIÓN
// ============================================
async function selectConversation(index) {
    currentConversation = conversations[index];
    
    document.querySelectorAll('.conversation-item').forEach((item, idx) => {
        item.className = idx === index ? 'conversation-item active' : 'conversation-item';
    });
    
    const isDm = currentConversation.version === 'DM';
    const title = isDm 
        ? `DM with: ${currentConversation.peerInboxId}`
        : `Group: ${currentConversation.id}`;
    
    document.getElementById('currentConversation').innerHTML = `
        <strong>💬 ${title}</strong>
    `;
    
    log(`📨 Conversation selected`, 'info');
    
    await loadMessages();
    streamMessages();
}

// ============================================
// CARGAR MENSAJES
// ============================================
async function loadMessages() {
    messagesDiv.innerHTML = '<div class="empty-state">Loading…</div>';
    
    try {
        log('📬 Loading messages...', 'info');
        
        await currentConversation.sync();
        const messages = await currentConversation.messages();
        
        log(`✅ ${messages.length} message(s) loaded`, 'success');
        
        if (messages.length === 0) {
            messagesDiv.innerHTML = '<div class="empty-state">No messages yet. Be the first to say hi!</div>';
            return;
        }
        
        messagesDiv.innerHTML = '';
        messages.forEach(msg => displayMessage(msg));
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        log(`❌ Message load failed: ${error.message}`, 'error');
        messagesDiv.innerHTML = '<div class="empty-state">Unable to load messages</div>';
    }
}

// ============================================
// STREAM DE MENSAJES
// ============================================
async function streamMessages() {
    try {
        log('👂 Listening for new messages...', 'info');
        
        // En browser-sdk v4, el stream se hace diferente
        const stream = await currentConversation.stream();
        
        for await (const message of stream) {
            log('✨ New message received!', 'success');
            displayMessage(message);
        }
    } catch (error) {
        log(`❌ Message stream error: ${error.message}`, 'error');
        console.error('Stream error:', error);
    }
}

// ============================================
// MOSTRAR MENSAJE
// ============================================
function displayMessage(message) {
    if (messagesDiv.querySelector('.empty-state')) {
        messagesDiv.innerHTML = '';
    }
    
    const date = new Date(Number(message.sentAtNs) / 1000000);
    
    // Detectar si es un mensaje del sistema (content no es string)
    if (!message.content || typeof message.content !== 'string') {
        // Mensaje del sistema - renderizar de forma especial
        let systemText = 'System event';
        
        // Intentar extraer información útil del contentType
        if (message.contentType) {
            const typeStr = typeof message.contentType === 'string' 
                ? message.contentType 
                : JSON.stringify(message.contentType);
            
            if (typeStr.includes('membership') || typeStr.includes('Membership')) {
                systemText = 'Group membership updated';
            } else if (typeStr.includes('transcript') || typeStr.includes('Transcript')) {
                systemText = 'Conversation created';
            }
        }
        
        const systemEl = document.createElement('div');
        systemEl.className = 'message system';
        systemEl.innerHTML = `
            <div style="text-align: center; color: #718096; font-size: 13px; font-style: italic;">
                ${systemText} • ${date.toLocaleTimeString()}
            </div>
        `;
        messagesDiv.appendChild(systemEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
    }
    
    const isSent = message.senderInboxId === xmtpClient.inboxId;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
    messageEl.innerHTML = `
        <div class="message-header">
            <span>${isSent ? '📤 You' : '📥 ' + message.senderInboxId.slice(0, 8)}</span>
            <span>${date.toLocaleTimeString()}</span>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
    `;
    
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ============================================
// ENVIAR MENSAJE
// ============================================
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    if (!currentConversation) {
        alert('Select a conversation first.');
        return;
    }
    
    const content = messageInput.value.trim();
    if (!content) return;
    
    try {
        sendBtn.disabled = true;
        log('📤 Sending message...', 'info');
        
        await currentConversation.send(content);
        
        log('✅ Message delivered!', 'success');
        messageInput.value = '';
        
    } catch (error) {
        log(`❌ Send error: ${error.message}`, 'error');
        alert('Send error: ' + error.message);
    } finally {
        sendBtn.disabled = false;
    }
}

// ============================================
// UTILIDADES
// ============================================
function renderWalletInfo(address) {
    if (!walletInfo || !xmtpClient) return;
    const hasName = Boolean(userProfile.username);
    const displayNameLabel = hasName
        ? `@${escapeHtml(userProfile.username)}`
        : '<span class="wallet-subtext muted">Not set yet</span>';

    walletInfo.innerHTML = `
        <div class="wallet-line">
            <div>
                <p><strong>🙋 Display name</strong></p>
                <p class="wallet-subtext">${displayNameLabel}</p>
            </div>
            <button id="editDisplayNameBtn" class="ghost-action tiny">Edit</button>
        </div>
        <p><strong>🦊 Wallet:</strong> MetaMask</p>
        <p><strong>🔑 Address:</strong> <code>${address}</code></p>
        <p><strong>📬 Inbox ID:</strong> <code>${xmtpClient.inboxId}</code></p>
        <p><strong>🌐 XMTP network:</strong> DEV (testing)</p>
        <p class="wallet-subtext success">✅ Your MetaMask identity is now live on XMTP</p>
    `;
    walletInfo.style.display = 'block';

    const editBtn = walletInfo.querySelector('#editDisplayNameBtn');
    if (editBtn) {
        editBtn.addEventListener('click', (event) => {
            event.preventDefault();
            openDisplayNamePrompt();
        });
    }

    updateProfileUI();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INICIALIZACIÓN
// ============================================
// Detectar cambios de cuenta en MetaMask
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            log('⚠️ MetaMask disconnected', 'warning');
        } else {
            log('🔄 Account changed, reloading page', 'warning');
            setTimeout(() => window.location.reload(), 2000);
        }
    });
}

loadUserProfile();
loadFriendDirectory();

log('🚀 XMTP V3 + MetaMask demo ready', 'success');
log('🦊 Click "Connect with MetaMask" to get started', 'info');