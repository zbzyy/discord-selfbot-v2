/**
 * @fileoverview HTML generation utilities for chat logs.
 * Provides XSS-safe HTML sanitization and Discord-styled templates.
 * @module utils/html
 */

/**
 * Sanitizes a string for safe HTML output (prevents XSS).
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for HTML
 */
export function sanitizeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Discord-styled CSS for chat logs.
 * @type {string}
 */
const DISCORD_CHAT_STYLES = `
    * { box-sizing: border-box; }
    body { 
        font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        background-color: #36393f;
        color: #dcddde;
        padding: 20px;
        margin: 0;
        line-height: 1.4;
    }
    .log-header {
        color: #7289da;
        margin-bottom: 20px;
        border-bottom: 2px solid #4f545c;
        padding-bottom: 10px;
        font-size: 1.5rem;
    }
    .log-meta {
        color: #72767d;
        font-size: 0.85rem;
        margin-bottom: 20px;
    }
    .msg {
        display: flex;
        margin-bottom: 15px;
        padding: 8px 0;
        border-radius: 4px;
    }
    .msg:hover {
        background-color: rgba(4, 4, 5, 0.07);
    }
    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 15px;
        flex-shrink: 0;
        object-fit: cover;
        background-color: #2f3136;
    }
    .content {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }
    .header {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px;
    }
    .username {
        font-weight: 600;
        color: #fff;
    }
    .timestamp {
        font-size: 0.75rem;
        color: #72767d;
    }
    .text {
        margin-top: 4px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 0.9375rem;
    }
    .attachment {
        display: inline-block;
        margin-top: 8px;
        padding: 8px 12px;
        background-color: #2f3136;
        border-radius: 4px;
        color: #00b0f4;
        text-decoration: none;
        font-size: 0.875rem;
    }
    .attachment:hover {
        text-decoration: underline;
    }
    .attachment::before {
        content: '📎 ';
    }
    .empty-content {
        color: #72767d;
        font-style: italic;
    }
    .embed-indicator {
        color: #5865f2;
        font-size: 0.8rem;
        margin-top: 4px;
    }
`;

/**
 * Formats a message object for HTML display.
 * @param {Object} msg - Message object
 * @returns {string} HTML for the message
 */
function formatMessage(msg) {
    const avatarUrl = sanitizeHTML(msg.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png');
    const authorTag = sanitizeHTML(msg.authorTag);
    const timestamp = sanitizeHTML(msg.timestamp);

    let contentHtml;
    if (msg.content) {
        contentHtml = `<div class="text">${sanitizeHTML(msg.content)}</div>`;
    } else {
        contentHtml = '<div class="text empty-content">[No text content]</div>';
    }

    const attachmentsHtml = msg.attachments?.map(url => {
        const filename = url.split('/').pop()?.split('?')[0] || 'file';
        return `<a class="attachment" href="${sanitizeHTML(url)}" target="_blank" rel="noopener noreferrer">${sanitizeHTML(filename)}</a>`;
    }).join('') || '';

    const embedHtml = msg.hasEmbeds
        ? '<div class="embed-indicator">📋 Contains embed</div>'
        : '';

    return `
        <div class="msg">
            <img class="avatar" src="${avatarUrl}" alt="Avatar" loading="lazy">
            <div class="content">
                <div class="header">
                    <span class="username">${authorTag}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                ${contentHtml}
                ${attachmentsHtml}
                ${embedHtml}
            </div>
        </div>
    `;
}

/**
 * Generates a complete HTML chat log document.
 * @param {string} channelName - Name of the channel
 * @param {Object[]} messages - Array of message objects
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.title] - Custom page title
 * @param {string} [options.description] - Description/context
 * @returns {string} Complete HTML document
 */
export function generateChatLogHTML(channelName, messages, options = {}) {
    const title = options.title || `Chat Log: ${sanitizeHTML(channelName)}`;
    const description = options.description || `${messages.length} messages exported`;

    const messagesHtml = messages.map(formatMessage).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${DISCORD_CHAT_STYLES}</style>
</head>
<body>
    <h1 class="log-header">${title}</h1>
    <p class="log-meta">${sanitizeHTML(description)}</p>
    ${messagesHtml}
</body>
</html>`;
}

/**
 * Generates a simple HTML document with custom content.
 * @param {string} title - Page title
 * @param {string} content - HTML content body
 * @returns {string} Complete HTML document
 */
export function generateSimpleHTML(title, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${sanitizeHTML(title)}</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background-color: #36393f;
            color: #dcddde;
            padding: 20px;
            margin: 0;
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

export default {
    sanitizeHTML,
    generateChatLogHTML,
    generateSimpleHTML,
};