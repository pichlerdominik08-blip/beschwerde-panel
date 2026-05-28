const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= SAFETY ================= */
process.on("uncaughtException", (err) => {
    console.log("CRASH:", err);
});

/* ================= DISCORD ================= */

// 1. Timeout erhöhen in axios
const tokenRes = await axios.post(
    "https://discord.com/api/oauth2/token",
    new URLSearchParams({...}),
    { 
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000  // 10 Sekunden
    }
);

// 2. Oder Environment-Variablen nutzen statt hardcodiert
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1455173278376136788";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "U3iGnMV0TcVqiBvWmf1GNzGybg-aXiqd";
const REDIRECT_URI = process.env.REDIRECT_URI || "https://beschwerde-panel.onrender.com/callback";

// 3. Oder zu einem einfacheren Discord-Login wechseln

/* ================= MIDDLEWARE ================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: "secret123",
    resave: false,
    saveUninitialized: false
}));

/* ================= MYSQL POOL ================= */

const pool = mysql.createPool({
    host: "yamanote.proxy.rlwy.net",
    user: "root",
    password: "TcZJFNCVixAGMPRydyYXaLLHgmbICDBN",
    database: "railway",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10
});

/* ================= TABLES ================= */

async function initTables() {
    const connection = await pool.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                discord_id VARCHAR(255) UNIQUE,
                username VARCHAR(255),
                avatar TEXT,
                role VARCHAR(50) DEFAULT 'member'
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS complaints (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255),
                title TEXT,
                description TEXT,
                target_user TEXT,
                status VARCHAR(50) DEFAULT 'offen',
                taken_by VARCHAR(255)
            )
        `);

        console.log("✅ Tabellen erfolgreich erstellt");
    } catch (err) {
        console.log("❌ Fehler beim Erstellen der Tabellen:", err);
    } finally {
        connection.release();
    }
}

initTables();

/* ================= AUTH ================= */

function auth(req, res, next) {
    if (!req.session.user) return res.redirect("/");
    next();
}

/* ================= DESIGN ================= */

const css = `
<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    background: #0b1020;
    color: #fff;
}

/* ===== LOGIN PAGE ===== */
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(135deg, #0b1020 0%, #1a1f3a 100%);
}

.login-box {
    background: #111827;
    border: 1px solid #1f2a44;
    border-radius: 16px;
    padding: 50px 40px;
    width: 100%;
    max-width: 420px;
    text-align: center;
}

.login-logo {
    width: 60px;
    height: 60px;
    margin: 0 auto 30px;
    background: linear-gradient(135deg, #6d5dfc 0%, #5a4fcc 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
}

.login-box h1 {
    font-size: 32px;
    margin-bottom: 12px;
    font-weight: 600;
}

.login-box p {
    color: #8b94a8;
    margin-bottom: 40px;
    font-size: 14px;
}

.login-form input {
    width: 100%;
    padding: 12px 14px;
    margin-bottom: 16px;
    background: #1a2640;
    border: 1px solid #2a3a52;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
}

.login-form input::placeholder {
    color: #6b7280;
}

.login-form input:focus {
    outline: none;
    border-color: #6d5dfc;
    background: #1f2a40;
}

.checkbox-group {
    display: flex;
    align-items: center;
    margin-bottom: 24px;
}

.checkbox-group input[type="checkbox"] {
    width: auto;
    margin: 0;
    margin-right: 8px;
    cursor: pointer;
}

.checkbox-group label {
    font-size: 13px;
    color: #8b94a8;
    cursor: pointer;
}

.btn {
    width: 100%;
    padding: 13px 16px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
}

.btn-primary {
    background: linear-gradient(135deg, #6d5dfc 0%, #5a4fcc 100%);
    color: white;
    margin-bottom: 12px;
}

.btn-primary:hover {
    background: linear-gradient(135deg, #5a4fcc 0%, #4a3fbc 100%);
    transform: translateY(-2px);
}

.btn-secondary {
    background: #1a2640;
    color: #8b94a8;
    border: 1px solid #2a3a52;
}

.btn-secondary:hover {
    background: #1f2a40;
    border-color: #3a4a62;
}

.divider {
    text-align: center;
    margin: 24px 0;
    color: #6b7280;
    font-size: 13px;
}

.login-footer {
    margin-top: 30px;
    padding-top: 24px;
    border-top: 1px solid #1f2a44;
    color: #6b7280;
    font-size: 12px;
}

/* ===== DASHBOARD ===== */
.dashboard {
    display: flex;
    min-height: 100vh;
    background: #0b1020;
}

.sidebar {
    width: 240px;
    background: #111827;
    border-right: 1px solid #1f2a44;
    padding: 20px;
    overflow-y: auto;
}

.sidebar-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 30px;
    font-size: 18px;
    font-weight: 600;
}

.sidebar-logo {
    width: 32px;
    height: 32px;
    background: #6d5dfc;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.nav-section {
    margin-bottom: 24px;
}

.nav-section-title {
    font-size: 11px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
}

.nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    color: #8b94a8;
    text-decoration: none;
    border-radius: 8px;
    margin-bottom: 6px;
    transition: all 0.2s ease;
    font-size: 14px;
}

.nav-link:hover {
    background: #1a2640;
    color: #fff;
}

.nav-link.active {
    background: linear-gradient(135deg, #6d5dfc 0%, #5a4fcc 100%);
    color: white;
}

.logout-link {
    color: #ef4444;
    margin-top: 20px;
}

.logout-link:hover {
    background: #ef444420;
}

.main-content {
    flex: 1;
    padding: 30px;
    overflow-y: auto;
}

.top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid #1f2a44;
}

.top-bar-left {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 14px;
    color: #8b94a8;
}

.top-bar-right {
    display: flex;
    align-items: center;
    gap: 20px;
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #1a2640;
    border-radius: 8px;
}

.user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6d5dfc 0%, #5a4fcc 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
}

.page-title {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 8px;
}

.page-subtitle {
    color: #8b94a8;
    font-size: 14px;
    margin-bottom: 30px;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
}

.card {
    background: #111827;
    border: 1px solid #1f2a44;
    border-radius: 12px;
    padding: 24px;
    transition: all 0.3s ease;
}

.card:hover {
    border-color: #2a3a52;
    transform: translateY(-4px);
}

.card h3 {
    font-size: 16px;
    margin-bottom: 12px;
}

.card p {
    color: #8b94a8;
    font-size: 13px;
    margin-bottom: 12px;
    line-height: 1.6;
}

.status {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 16px;
}

.status.offen {
    background: #fbbf2420;
    color: #fbbf24;
}

.status.angenommen {
    background: #22c55e20;
    color: #22c55e;
}

.status.abgelehnt {
    background: #ef444420;
    color: #ef4444;
}

.card-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}

.card-btn {
    flex: 1;
    padding: 8px 12px;
    background: #1a2640;
    border: 1px solid #2a3a52;
    border-radius: 6px;
    color: #8b94a8;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
    text-decoration: none;
    display: block;
    text-align: center;
}

.card-btn:hover {
    background: #2a3a52;
    color: #fff;
}

.section-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    margin-top: 20px;
}

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #8b94a8;
}

.empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
    .dashboard {
        flex-direction: column;
    }

    .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid #1f2a44;
        display: flex;
        gap: 20px;
        overflow-x: auto;
        padding: 15px;
    }

    .nav-section {
        display: flex;
        gap: 10px;
        margin: 0;
    }

    .nav-section-title {
        display: none;
    }

    .cards-grid {
        grid-template-columns: 1fr;
    }

    .login-box {
        margin: 20px;
    }
}
</style>
`;

/* ================= HOME / LOGIN ================= */

app.get("/", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${css}
    </head>
    <body>
    <div class="login-container">
        <div class="login-box">
            <div class="login-logo">📚</div>
            <h1>Willkommen zurück</h1>
            <p>Melde dich an, um auf das NRW Team-Panel zuzugreifen.</p>
            
            <div class="login-form">
                <a href="/login" class="btn btn-primary">🔑 Jetzt einloggen</a>
                <div class="divider">oder</div>
                <a href="/login" class="btn btn-secondary">💬 Discord Login</a>
                <div style="margin-top: 20px; text-align: left;">
                    <a href="#" style="color: #6d5dfc; font-size: 13px; text-decoration: none;">ℹ️ Infos zum Dashboard</a>
                </div>
            </div>
            
            <div class="login-footer">
                © 2026 NRW - Team Management
            </div>
        </div>
    </div>
    </body>
    </html>
    `);
});

/* ================= LOGIN ================= */

app.get("/login", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
    res.redirect(url);
});

/* ================= CALLBACK ================= */

app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("❌ Kein Code erhalten");

    try {
        console.log("🔐 Token wird angefordert...");
        const tokenRes = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        console.log("👤 Benutzerdaten werden abgerufen...");
        const userRes = await axios.get(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization: `Bearer ${tokenRes.data.access_token}`
                }
            }
        );

        const user = userRes.data;
        console.log(`✅ Benutzer angemeldet: ${user.username} (${user.id})`);

        const connection = await pool.getConnection();
        try {
            await connection.query(
                "INSERT IGNORE INTO users (discord_id, username, avatar, role) VALUES (?, ?, ?, 'member')",
                [user.id, user.username, user.avatar]
            );

            const [rows] = await connection.query(
                "SELECT role FROM users WHERE discord_id=?",
                [user.id]
            );

            const role = rows?.[0]?.role || "member";

            req.session.user = {
                id: user.id,
                username: user.username,
                role,
                avatar: user.avatar
            };

            console.log(`✅ Session erstellt für ${user.username}`);
            return res.redirect("/dashboard");

        } finally {
            connection.release();
        }

    } catch (err) {
        console.log("❌ LOGIN ERROR:", err.response?.data || err.message);
        return res.send("❌ Login Fehler: " + (err.response?.data?.error || err.message));
    }
});

/* ================= DASHBOARD ================= */

app.get("/dashboard", auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [complaints] = await connection.query("SELECT * FROM complaints ORDER BY id DESC");

        let html = "";
        complaints.forEach(c => {
            html += `
            <div class="card">
                <h3>${c.title}</h3>
                <div class="status ${c.status}">${c.status}</div>
                <p>${c.description}</p>
                <p><strong>👤 Target:</strong> ${c.target_user}</p>
                <p><strong>📝 Von:</strong> ${c.user_id}</p>
                <p><strong>✏️ Bearbeitet von:</strong> ${c.taken_by || "-"}</p>
                
                <div class="card-actions">
                    <a href="/take/${c.id}" class="card-btn">📋 Take</a>
                    <a href="/accept/${c.id}" class="card-btn">✅ Accept</a>
                    <a href="/reject/${c.id}" class="card-btn">❌ Reject</a>
                </div>
            </div>
            `;
        });

        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${css}
        </head>
        <body>
        <div class="dashboard">
            <div class="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">📚</div>
                    <span>TeamPanel</span>
                </div>
                
                <div class="nav-section">
                    <div class="nav-section-title">Navigation</div>
                    <a href="/dashboard" class="nav-link active">🏠 Dashboard</a>
                    <a href="/create" class="nav-link">➕ Neue Beschwerde</a>
                    <a href="/files" class="nav-link">📁 Dateimanager</a>
                </div>
                
                <div class="nav-section">
                    <div class="nav-section-title">Verwaltung</div>
                    <a href="#" class="nav-link">👥 Benutzer</a>
                    <a href="#" class="nav-link">⚙️ Einstellungen</a>
                </div>
                
                <a href="/logout" class="nav-link logout-link">🚪 Abmelden</a>
            </div>

            <div class="main-content">
                <div class="top-bar">
                    <div class="top-bar-left">
                        📅 Di., 26. Mai &nbsp; | &nbsp; 16:11
                    </div>
                    <div class="top-bar-right">
                        🔔
                        <div class="user-profile">
                            <div class="user-avatar">${req.session.user.username.charAt(0).toUpperCase()}</div>
                            <span>${req.session.user.username}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h1 class="page-title">Hallo, ${req.session.user.username.toUpperCase()}.</h1>
                    <p class="page-subtitle">Hier ist ein Überblick über das, was heute ansteht.</p>
                </div>

                <div class="section-title">📋 Beschwerden</div>
                ${complaints.length > 0 ? `<div class="cards-grid">${html}</div>` : '<div class="empty-state"><div class="empty-state-icon">📭</div><p>Keine Beschwerden vorhanden</p></div>'}
            </div>
        </div>
        </body>
        </html>
        `);
    } catch (err) {
        console.log("❌ Dashboard Fehler:", err);
        res.send("❌ Fehler beim Laden des Dashboards");
    } finally {
        connection.release();
    }
});

/* ================= CREATE ================= */

app.get("/create", auth, (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${css}
    </head>
    <body>
    <div class="login-container">
        <div class="login-box">
            <h1>➕ Neue Beschwerde</h1>
            
            <form method="POST" class="login-form">
                <input type="text" name="title" placeholder="Titel" required>
                <input type="text" name="target_user" placeholder="Target Benutzer" required>
                <textarea name="description" placeholder="Beschreibung" required style="min-height: 120px; resize: vertical;"></textarea>
                <button type="submit" class="btn btn-primary">📤 Senden</button>
            </form>
            
            <div style="margin-top: 20px;">
                <a href="/dashboard" style="color: #8b94a8; text-decoration: none;">← Zurück zum Dashboard</a>
            </div>
        </div>
    </div>
    </body>
    </html>
    `);
});

app.post("/create", auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.query(
            "INSERT INTO complaints (user_id, title, description, target_user) VALUES (?, ?, ?, ?)",
            [req.session.user.id, req.body.title, req.body.description, req.body.target_user]
        );
        console.log(`✅ Beschwerde erstellt von ${req.session.user.username}`);
        res.redirect("/dashboard");
    } catch (err) {
        console.log("❌ Fehler beim Erstellen der Beschwerde:", err);
        res.send("❌ Fehler beim Erstellen der Beschwerde");
    } finally {
        connection.release();
    }
});

/* ================= FILE MANAGER ================= */

app.get("/files", auth, (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${css}
    </head>
    <body>
    <div class="dashboard">
        <div class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">📁</div>
                <span>File Manager</span>
            </div>
            
            <div class="nav-section">
                <div class="nav-section-title">Quick Access</div>
                <a href="/files" class="nav-link active">🏠 Home</a>
                <a href="#" class="nav-link">📤 Upload Files</a>
                <a href="#" class="nav-link">📦 Upload & Unzip</a>
                <a href="#" class="nav-link">📁 New Folder</a>
                <a href="#" class="nav-link">📄 New File</a>
            </div>
            
            <div class="nav-section">
                <div class="nav-section-title">Actions</div>
                <a href="#" class="nav-link">🔄 Refresh</a>
                <a href="#" class="nav-link">☑️ Select All</a>
            </div>
            
            <div class="nav-section">
                <div class="nav-section-title">Preferences</div>
                <a href="#" class="nav-link">🌓 Toggle Theme</a>
                <a href="#" class="nav-link">📊 Toggle View</a>
                <a href="#" class="nav-link">⚙️ Reset Settings</a>
            </div>
        </div>

        <div class="main-content">
            <div class="top-bar">
                <div class="top-bar-left">
                    Home > htdocs
                </div>
                <div class="top-bar-right">
                    <button class="btn btn-primary" style="width: auto; padding: 8px 16px;">⬆️ Upload</button>
                    <button class="btn btn-secondary" style="width: auto; padding: 8px 12px;">+ New File</button>
                    <button class="btn btn-secondary" style="width: auto; padding: 8px 12px;">📁 New Folder</button>
                    <button class="btn btn-secondary" style="width: auto; padding: 8px 12px;">✏️ Edit</button>
                    <button class="btn btn-secondary" style="width: auto; padding: 8px 12px;">⬇️ Download</button>
                    <button style="width: auto; padding: 8px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">🗑️ Delete</button>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="border-bottom: 2px solid #1f2a44;">
                        <th style="padding: 12px; text-align: left; color: #6d5dfc; font-size: 12px; font-weight: 600;">NAME ↑</th>
                        <th style="padding: 12px; text-align: left; color: #6d5dfc; font-size: 12px; font-weight: 600;">EXTENSION</th>
                        <th style="padding: 12px; text-align: left; color: #6d5dfc; font-size: 12px; font-weight: 600;">SIZE</th>
                        <th style="padding: 12px; text-align: left; color: #6d5dfc; font-size: 12px; font-weight: 600;">MODIFIED</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #1f2a44;">
                        <td style="padding: 12px;">📁 files for your website should be uploaded here!</td>
                        <td style="padding: 12px; color: #8b94a8;">-</td>
                        <td style="padding: 12px; color: #8b94a8;">0 B</td>
                        <td style="padding: 12px; color: #8b94a8;">May 26 09:14</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #1f2a44;">
                        <td style="padding: 12px;">🔴 index2.html</td>
                        <td style="padding: 12px; color: #8b94a8;">html</td>
                        <td style="padding: 12px; color: #8b94a8;">9.92 KB</td>
                        <td style="padding: 12px; color: #8b94a8;">May 26 09:14</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                2 items &nbsp; • &nbsp; 0 selected
            </div>
        </div>
    </div>
    </body>
    </html>
    `);
});

/* ================= ACTIONS ================= */

app.get("/take/:id", auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.query("UPDATE complaints SET taken_by=? WHERE id=?", [req.session.user.username, req.params.id]);
        console.log(`✅ Beschwerde ${req.params.id} von ${req.session.user.username} übernommen`);
        res.redirect("/dashboard");
    } catch (err) {
        console.log("❌ Fehler beim Übernehmen:", err);
        res.send("❌ Fehler");
    } finally {
        connection.release();
    }
});

app.get("/accept/:id", auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.query("UPDATE complaints SET status='angenommen' WHERE id=?", [req.params.id]);
        console.log(`✅ Beschwerde ${req.params.id} angenommen`);
        res.redirect("/dashboard");
    } catch (err) {
        console.log("❌ Fehler beim Akzeptieren:", err);
        res.send("❌ Fehler");
    } finally {
        connection.release();
    }
});

app.get("/reject/:id", auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.query("UPDATE complaints SET status='abgelehnt' WHERE id=?", [req.params.id]);
        console.log(`✅ Beschwerde ${req.params.id} abgelehnt`);
        res.redirect("/dashboard");
    } catch (err) {
        console.log("❌ Fehler beim Ablehnen:", err);
        res.send("❌ Fehler");
    } finally {
        connection.release();
    }
});

/* ================= LOGOUT ================= */

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

/* ================= START ================= */

app.listen(PORT, () => {
    console.log("✅ Server läuft auf Port " + PORT);
});

