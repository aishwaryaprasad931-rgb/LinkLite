
const STORAGE_KEY = "linklite_links";

const form = document.getElementById("shortenForm");
const longUrlInput = document.getElementById("longUrl");
const customAliasInput = document.getElementById("customAlias");
const resultBox = document.getElementById("resultBox");
const shortUrlElement = document.getElementById("shortUrl");
const copyBtn = document.getElementById("copyBtn");
const copyMessage = document.getElementById("copyMessage");
const errorMessage = document.getElementById("errorMessage");
const tableBody = document.getElementById("linkTableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

let links = loadLinks();
let latestShortUrl = "";

// Load saved links safely
function loadLinks() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter(link =>
            link &&
            typeof link.id === "string" &&
            typeof link.code === "string" &&
            typeof link.originalUrl === "string" &&
            typeof link.clicks === "number"
        ) : [];
    } catch {
        return [];
    }
}

// Save links
function saveLinks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

// Generate unique short code
function generateCode() {
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code;

    do {
        code = "";
        for (let i = 0; i < 6; i++) {
            code += characters[Math.floor(Math.random() * characters.length)];
        }
    } while (links.some(link => link.code === code));

    return code;
}

// Create short URL using the current page URL
function getShortUrl(code) {
    return window.location.href.split("#")[0] + "#" + code;
}

// Validate URL
function validateUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

// Generate short link
form.addEventListener("submit", function(event) {
    event.preventDefault();

    errorMessage.textContent = "";
    resultBox.classList.add("hidden");
    copyMessage.textContent = "";

    const originalUrl = longUrlInput.value.trim();
    const customAlias = customAliasInput.value.trim();

    if (!validateUrl(originalUrl)) {
        errorMessage.textContent = "Please enter a valid HTTP or HTTPS URL.";
        return;
    }

    if (customAlias && !/^[a-zA-Z0-9_-]{3,25}$/.test(customAlias)) {
        errorMessage.textContent = "Alias must contain 3–25 letters, numbers, hyphens or underscores.";
        return;
    }

    const code = customAlias || generateCode();

    if (links.some(link => link.code.toLowerCase() === code.toLowerCase())) {
        errorMessage.textContent = "This alias is already taken. Please choose another.";
        return;
    }

    const newLink = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        code: code,
        originalUrl: originalUrl,
        clicks: 0,
        createdAt: new Date().toISOString()
    };

    links.unshift(newLink);
    saveLinks();

    latestShortUrl = getShortUrl(code);
    shortUrlElement.textContent = latestShortUrl;
    resultBox.classList.remove("hidden");

    longUrlInput.value = "";
    customAliasInput.value = "";

    renderDashboard();
});

// Copy latest generated link
copyBtn.addEventListener("click", async function() {
    await copyText(latestShortUrl, copyMessage);
});

// Copy helper
async function copyText(text, messageElement) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const temporary = document.createElement("textarea");
            temporary.value = text;
            temporary.style.position = "fixed";
            temporary.style.opacity = "0";
            document.body.appendChild(temporary);
            temporary.select();

            const copied = document.execCommand("copy");
            temporary.remove();

            if (!copied) throw new Error("Copy failed");
        }

        messageElement.textContent = "Copied successfully!";
    } catch {
        messageElement.textContent = "Unable to copy. Please copy the link manually.";
    }
}

// Render dashboard
function renderDashboard() {
    const totalLinks = links.length;
    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const averageClicks = totalLinks
        ? (totalClicks / totalLinks).toFixed(1)
        : 0;

    document.getElementById("totalLinks").textContent = totalLinks;
    document.getElementById("totalClicks").textContent = totalClicks;
    document.getElementById("averageClicks").textContent = averageClicks;

    renderTable(searchInput.value);
}

// Render links table
function renderTable(search = "") {
    tableBody.replaceChildren();

    const filteredLinks = links.filter(link =>
        link.code.toLowerCase().includes(search.toLowerCase()) ||
        link.originalUrl.toLowerCase().includes(search.toLowerCase())
    );

    emptyState.style.display = filteredLinks.length ? "none" : "block";

    filteredLinks.forEach(link => {
        const row = document.createElement("tr");

        const shortCell = document.createElement("td");
        shortCell.className = "short-cell";
        shortCell.textContent = getShortUrl(link.code);

        const originalCell = document.createElement("td");
        originalCell.className = "original-cell";
        originalCell.textContent = link.originalUrl;

        const clicksCell = document.createElement("td");
        clicksCell.textContent = link.clicks;

        const dateCell = document.createElement("td");
        dateCell.textContent = new Date(link.createdAt).toLocaleDateString();

        const actionCell = document.createElement("td");

        const copyButton = document.createElement("button");
        copyButton.className = "action-btn copy-action";
        copyButton.textContent = "Copy";
        copyButton.addEventListener("click", () => {
            copyText(getShortUrl(link.code), copyMessage);
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "action-btn delete-action";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteLink(link.id));

        actionCell.append(copyButton, deleteButton);
        row.append(shortCell, originalCell, clicksCell, dateCell, actionCell);
        tableBody.appendChild(row);
    });
}

// Search
searchInput.addEventListener("input", function() {
    renderTable(this.value);
});

// Delete individual link
function deleteLink(id) {
    links = links.filter(link => link.id !== id);
    saveLinks();
    renderDashboard();
}

// Clear all links
document.getElementById("clearAllBtn").addEventListener("click", function() {
    if (!links.length) return;

    if (confirm("Are you sure you want to delete all your links?")) {
        links = [];
        saveLinks();
        renderDashboard();
        resultBox.classList.add("hidden");
    }
});

// Open short link and track click
function handleShortLink() {
    const code = window.location.hash.slice(1);

    if (!code) return;

    const link = links.find(item => item.code === code);

    if (link) {
        link.clicks++;
        saveLinks();

        // Redirect to original destination
        window.location.replace(link.originalUrl);
    } else {
        alert("This short link was not found in this browser.");
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
}

// Start application
handleShortLink();
renderDashboard();
