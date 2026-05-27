require("dotenv").config();

const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();

// ======================
// CONFIG
// ======================

const PORT = process.env.PORT || 3000;

const CLIENT_ID = "1508836298713206876"; 
const CLIENT_SECRET = "_tvGiwdTngoNYt0jzVqrsCR-7mLGjN9A"; 
const REDIRECT_URI = "https://beschwerde-panel.onrender.com/callback";

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false
    }
}));

// ======================
// MYSQL
// ======================

const db = mysql.createConnection({ 
    host: "sql306.infinityfree.com", 
    user: "if0_42025033", 
    password: "budQIQWw1u", 
    database: "if0_42025033_panel", 
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.log("DB Fehler:", err);
    } else {
        console.log("MySQL verbunden");
    }
});

// ======================
// CREATE TABLES
// ======================

db.query(`
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id VARCHAR(255) UNIQUE,
    username VARCHAR(255),
    avatar TEXT,
    role_name VARCHAR(50) DEFAULT 'member'
)
`);

db.query(`
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255),
    title VARCHAR(255),
    target_user VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'Offen',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

// ======================
// AUTH MIDDLEWARE
// ======================

function checkAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/");
    }

    next();
}

// ======================
// LOGIN PAGE
// ======================

app.get("/", (req, res) => {

    if (req.session.user) {
        return res.redirect("/dashboard");
    }

    res.send(`
<!DOCTYPE html>
<html lang="de">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>NRW Team Panel</title>

<script src="https://cdn.tailwindcss.com"></script>

<link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>

<style>

body{
background:#050816;
overflow:hidden;
}

.glow{
box-shadow:0 0 80px rgba(88,101,242,0.25);
}

</style>

</head>

<body class="flex justify-center items-center min-h-screen text-white">

<div class="bg-[#0f172a] border border-[#1e293b] p-10 rounded-3xl w-[420px] glow">

<div class="text-center">

<div class="text-6xl text-indigo-500 mb-5">
<i class='bx bxs-layer'></i>
</div>

<h1 class="text-4xl font-bold mb-3">
Willkommen zurück
</h1>

<p class="text-gray-400 mb-8">
Melde dich an um das Team Panel zu öffnen.
</p>

<a href="/login"
class="bg-indigo-600 hover:bg-indigo-700 transition p-4 rounded-2xl block font-bold text-lg">

<i class='bx bx-log-in'></i>
Jetzt einloggen

</a>

</div>

</div>

</body>
</html>
    `);
});

// ======================
// DISCORD LOGIN
// ======================

app.get("/login", (req, res) => {

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: "identify"
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// ======================
// CALLBACK
// ======================

app.get("/callback", async (req, res) => {

    const code = req.query.code;

    if (!code) {
        return res.send("Kein Code erhalten");
    }

    try {

        const tokenResponse = await axios.post(
            "https://discord.com/api/oauth2/token",

            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: REDIRECT_URI
            }),

            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const user = userResponse.data;

        db.query(
            "INSERT IGNORE INTO users (discord_id, username, avatar) VALUES (?, ?, ?)",
            [
                user.id,
                user.username,
                user.avatar
            ]
        );

        req.session.user = {
            id: user.id,
            username: user.username,
            avatar: user.avatar
        };

        res.redirect("/dashboard");

    } catch (err) {

        console.log(err.response?.data || err);

        res.send("Discord Login Fehler");
    }
});

// ======================
// DASHBOARD
// ======================

app.get("/dashboard", checkAuth, (req, res) => {

    db.query(
        "SELECT * FROM complaints ORDER BY id DESC LIMIT 5",
        (err, complaints) => {

            const avatar = req.session.user.avatar
                ? `https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png`
                : "https://cdn.discordapp.com/embed/avatars/0.png";

            let complaintsHtml = "";

            complaints.forEach(c => {

                complaintsHtml += `
                
<div class="bg-[#111827] p-5 rounded-2xl border border-[#1f2937]">

<div class="flex justify-between">

<div>
<h2 class="text-xl font-bold">${c.title}</h2>
<p class="text-gray-400 mt-1">Gegen: ${c.target_user}</p>
</div>

<div>
<span class="bg-indigo-600 px-3 py-1 rounded-lg text-sm">
${c.status}
</span>
</div>

</div>

<p class="text-gray-300 mt-4">
${c.description}
</p>

</div>

                `;
            });

            res.send(`

<!DOCTYPE html>
<html lang="de">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Dashboard</title>

<script src="https://cdn.tailwindcss.com"></script>

<link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>

<style>

body{
background:#050816;
color:white;
font-family:sans-serif;
}

.sidebar{
width:260px;
background:#0f172a;
border-right:1px solid #1e293b;
}

.card{
background:#111827;
border:1px solid #1f2937;
}

</style>

</head>

<body class="flex">

<!-- SIDEBAR -->

<div class="sidebar min-h-screen p-6">

<div class="flex items-center gap-3 mb-10">

<div class="text-indigo-500 text-4xl">
<i class='bx bxs-layer'></i>
</div>

<h1 class="text-2xl font-bold">
TeamPanel
</h1>

</div>

<div class="space-y-3">

<a href="/dashboard"
class="block bg-indigo-600 p-4 rounded-xl font-semibold">

<i class='bx bxs-dashboard'></i>
Dashboard

</a>

<a href="#create"
class="block hover:bg-[#1e293b] transition p-4 rounded-xl">

<i class='bx bx-message-square-detail'></i>
Beschwerden

</a>

<a href="/logout"
class="block hover:bg-red-500/20 text-red-400 transition p-4 rounded-xl mt-10">

<i class='bx bx-log-out'></i>
Abmelden

</a>

</div>

</div>

<!-- CONTENT -->

<div class="flex-1 p-10">

<!-- TOPBAR -->

<div class="flex justify-between items-center mb-10">

<div>

<h1 class="text-5xl font-bold">
Hallo, ${req.session.user.username}
</h1>

<p class="text-gray-400 mt-3">
Willkommen zurück im Dashboard.
</p>

</div>

<div class="flex items-center gap-4">

<img
src="${avatar}"
class="w-14 h-14 rounded-full border-2 border-indigo-500"
/>

</div>

</div>

<!-- STATS -->

<div class="grid md:grid-cols-3 gap-6 mb-10">

<div class="card p-6 rounded-2xl">

<h2 class="text-gray-400 mb-2">
Beschwerden
</h2>

<h1 class="text-5xl font-bold">
${complaints.length}
</h1>

</div>

<div class="card p-6 rounded-2xl">

<h2 class="text-gray-400 mb-2">
Status
</h2>

<h1 class="text-2xl font-bold text-green-400">
Online
</h1>

</div>

<div class="card p-6 rounded-2xl">

<h2 class="text-gray-400 mb-2">
Benutzer
</h2>

<h1 class="text-2xl font-bold">
${req.session.user.username}
</h1>

</div>

</div>

<!-- CREATE -->

<div id="create" class="card p-8 rounded-2xl mb-10">

<h1 class="text-3xl font-bold mb-6">
Beschwerde erstellen
</h1>

<form method="POST" action="/create-complaint">

<input
name="title"
placeholder="Titel"
required
class="w-full bg-[#0f172a] border border-[#1f2937] p-4 rounded-xl mb-4 outline-none"
/>

<input
name="target_user"
placeholder="Gegen wen?"
required
class="w-full bg-[#0f172a] border border-[#1f2937] p-4 rounded-xl mb-4 outline-none"
/>

<textarea
name="description"
placeholder="Beschreibung..."
required
class="w-full bg-[#0f172a] border border-[#1f2937] p-4 rounded-xl mb-4 outline-none h-40"
></textarea>

<button
class="bg-indigo-600 hover:bg-indigo-700 transition px-8 py-4 rounded-xl font-bold">

Beschwerde senden

</button>

</form>

</div>

<!-- LIST -->

<div>

<h1 class="text-3xl font-bold mb-6">
Letzte Beschwerden
</h1>

<div class="space-y-5">

${complaintsHtml || `
<div class="card p-8 rounded-2xl text-center text-gray-400">
Keine Beschwerden vorhanden.
</div>
`}

</div>

</div>

</div>

</body>
</html>

            `);
        }
    );
});

// ======================
// CREATE COMPLAINT
// ======================

app.post("/create-complaint", checkAuth, (req, res) => {

    const {
        title,
        target_user,
        description
    } = req.body;

    db.query(
        "INSERT INTO complaints (user_id, title, target_user, description) VALUES (?, ?, ?, ?)",
        [
            req.session.user.id,
            title,
            target_user,
            description
        ],
        (err) => {

            if (err) {
                console.log(err);
                return res.send("DB Fehler");
            }

            res.redirect("/dashboard");
        }
    );
});

// ======================
// LOGOUT
// ======================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/");
    });
});

// ======================
// START
// ======================

app.listen(PORT, () => {
    console.log("Server läuft auf Port " + PORT);
});
