/**
 * Dora AI Web UI - Single Page Chat Application
 * Clean, modern interface with real-time messaging & image support
 */

const DORA_API = window.DORA_API || 'https://dora-ai-api.onrender.com';

// DOM Elements
let chatMessages, messageInput, sendBtn, clearBtn, statusIndicator, typingIndicator;
let userId = generateUserId();
let conversationHistory = [];
let isAiTyping = false;

// --- NEW: Image related variables ---
let attachBtn, imageInput;            // File input & button
let currentImage = null;              // Stores base64 string of selected image
let imagePreview = null;              // Preview element

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  // --- NEW: Create image upload button & hidden file input ---
  createImageUploadElements();
  loadHistory();
  setupEventListeners();
  checkApiHealth();
  updateUserId();
});

function initElements() {
  chatMessages = document.getElementById('chat-messages');
  messageInput = document.getElementById('message-input');
  sendBtn = document.getElementById('send-btn');
  clearBtn = document.getElementById('clear-btn');
  statusIndicator = document.getElementById('status-indicator');
  typingIndicator = document.getElementById('typing-indicator');
}

// --- NEW: Add attach button & hidden file input next to the message input ---
function createImageUploadElements() {
  const inputContainer = messageInput.parentElement; // assume input is wrapped in a div
  if (!inputContainer) return;

  // Attach button
  attachBtn = document.createElement('button');
  attachBtn.id = 'attach-btn';
  attachBtn.className = 'attach-btn';
  attachBtn.title = 'Attach image';
  attachBtn.innerHTML = '📎';
  attachBtn.addEventListener('click', () => imageInput.click());
  inputContainer.insertBefore(attachBtn, messageInput);

  // Hidden file input
  imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.style.display = 'none';
  imageInput.addEventListener('change', handleFileSelect);
  inputContainer.appendChild(imageInput);

  // Image preview area (appears when an image is selected)
  imagePreview = document.createElement('div');
  imagePreview.id = 'image-preview';
  imagePreview.className = 'image-preview';
  imagePreview.style.display = 'none';
  inputContainer.appendChild(imagePreview);
}

// --- NEW: Handle file selection from the attach button ---
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  encodeImageToBase64(file);
}

// --- NEW: Paste event listener for images from clipboard ---
function setupClipboardPaste() {
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // Prevent default paste
        const blob = item.getAsFile();
        if (blob) {
          encodeImageToBase64(blob);
          break;
        }
      }
    }
  });
}

// --- NEW: Drag & drop support on the chat container ---
function setupDragAndDrop() {
  const chatArea = document.getElementById('chat-container') || document.body;
  chatArea.addEventListener('dragover', (e) => e.preventDefault());
  chatArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      encodeImageToBase64(file);
    }
  });
}

// --- NEW: Encode image file to base64 and show preview ---
function encodeImageToBase64(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    currentImage = event.target.result; // data:image/...;base64,...
    showImagePreview(currentImage);
  };
  reader.readAsDataURL(file);
}

// --- NEW: Show the image preview thumbnail with remove button ---
function showImagePreview(base64) {
  imagePreview.innerHTML = `
    <img src="${base64}" alt="Preview" class="preview-thumb" />
    <button class="remove-img-btn" title="Remove image">✕</button>
  `;
  imagePreview.style.display = 'flex';
  // Remove button action
  imagePreview.querySelector('.remove-img-btn').addEventListener('click', () => {
    currentImage = null;
    imagePreview.style.display = 'none';
    imageInput.value = ''; // reset file input
  });
}

// --- UPDATED: setupEventListeners now also adds paste, drag/drop, and attach actions ---
function setupEventListeners() {
  // Send on button click
  sendBtn.addEventListener('click', sendMessage);

  // Send on Enter (Shift+Enter for newline)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
  });

  // Clear conversation
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear conversation history?')) {
      conversationHistory = [];
      localStorage.removeItem('dora_conversation');
      chatMessages.innerHTML = '';
      addSystemMessage('Conversation cleared.');
    }
  });

  // --- NEW: Enable clipboard paste & drag/drop after DOM is ready ---
  setupClipboardPaste();
  setupDragAndDrop();
}

// ... (existing functions like generateUserId, updateUserId, loadHistory, saveHistory, checkApiHealth remain unchanged) ...

// --- MODIFIED: sendMessage now includes image data ---
async function sendMessage() {
  const text = messageInput.value.trim();
  // Only send if there is text OR an image attached
  if ((!text && !currentImage) || isAiTyping) return;

  // Build message display content – include a small image indicator if present
  let displayContent = text;
  let userMsgContent = text; // what we save in history

  // Add user message
  const userMsg = {
    role: 'user',
    content: userMsgContent || '(image)',  // fallback if only image sent
    timestamp: new Date().toISOString(),
    image: currentImage || undefined       // store base64 for potential history rendering
  };
  conversationHistory.push(userMsg);
  renderMessage(userMsg);
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Clear image preview and reset state
  currentImage = null;
  if (imagePreview) imagePreview.style.display = 'none';
  if (imageInput) imageInput.value = '';

  // Show typing indicator
  isAiTyping = true;
  typingIndicator.style.display = 'block';
  scrollToBottom();

  try {
    // --- Build request body with image if present ---
    const requestBody = {
      user_id: userId,
      message: text || ''  // API may require at least an empty string
    };
    if (userMsg.image) {
      requestBody.image = userMsg.image; // send base64 string
    }

    const res = await fetch(`${DORA_API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();

    if (data.error) {
      addErrorMessage(data.error);
    } else {
      const aiMsg = { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() };
      conversationHistory.push(aiMsg);

      if (data.actions && data.actions.length > 0) {
        renderMessageWithActions(aiMsg, data.actions);
      } else {
        renderMessage(aiMsg);
      }
    }
  } catch (e) {
    addErrorMessage(`Connection error: ${e.message}`);
  } finally {
    isAiTyping = false;
    typingIndicator.style.display = 'none';
    saveHistory();
    scrollToBottom();
  }
}

// --- UPDATED: renderMessage now shows images in the chat bubble ---
function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = `message message-${msg.role}`;

  const avatar = msg.role === 'user'
    ? '<div class="message-avatar">U</div>'
    : '<div class="message-avatar dora-avatar">D</div>';

  const content = escapeHtml(msg.content);
  // --- NEW: If the message has an image, embed it ---
  let imageHtml = '';
  if (msg.image) {
    imageHtml = `<img src="${escapeHtml(msg.image)}" class="message-image" alt="Sent image" />`;
  }

  div.innerHTML = `
    ${avatar}
    <div class="message-content">
      <div class="message-bubble">${content.replace(/\n/g, '<br>')}${imageHtml}</div>
      <div class="message-time">${formatTime(msg.timestamp)}</div>
    </div>
  `;

  chatMessages.appendChild(div);
  scrollToBottom();
}

// ... renderMessageWithActions, addSystemMessage, addErrorMessage, scrollToBottom, formatTime, escapeHtml remain unchanged ...

function renderMessageWithActions(msg, actions) {
  // Same as original, but could optionally include image support if needed
  const div = document.createElement('div');
  div.className = `message message-${msg.role}`;
  const avatar = msg.role === 'user'
    ? '<div class="message-avatar">U</div>'
    : '<div class="message-avatar dora-avatar">D</div>';
  const content = escapeHtml(msg.content);
  let imageHtml = '';
  if (msg.image) {
    imageHtml = `<img src="${escapeHtml(msg.image)}" class="message-image" alt="Sent image" />`;
  }
  let actionsHtml = '';
  if (actions && actions.length > 0) {
    actionsHtml = `<div class="message-actions"><small>${actions.length} action(s) performed</small></div>`;
  }
  div.innerHTML = `
    ${avatar}
    <div class="message-content">
      <div class="message-bubble">${content.replace(/\n/g, '<br>')}${imageHtml}</div>
      ${actionsHtml}
      <div class="message-time">${formatTime(msg.timestamp)}</div>
    </div>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
}

// ... rest of the helper functions remain identical ...
