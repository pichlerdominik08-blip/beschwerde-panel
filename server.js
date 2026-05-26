const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "supersecret123",
    resave: false,
    saveUninitialized: false
}));

// ======================
// DISCORD CONFIG
// ======================
const CLIENT_ID = "1508836298713206876";
const CLIENT_SECRET = "_tvGiwdTngoNYt0jzVqrsCR-7mLGjN9A";
const REDIRECT_URI = "https://beschwerde-panel.onrender.com/callback";

// ======================
// DATABASE
// ======================
const db = mysql.createConnection({
    host: "sql306.infinityfree.com",
    user: "if0_42025033",
    password: "1508836298713206876",
    database: "if0_42025033_panel",
    port: 3306
});

db.connect(err => {
    if (err) {
        console.log("DB Fehler:", err);
    } else {
        console.log("MySQL verbunden");
    }
});

// ======================
// HOME
// ======================
app.get("/", (req, res) => {
    res.send(`
        <h1>Beschwerde Panel</h1>
        <a href="/login">Mit Discord einloggen</a>
    `);
});

// ======================
// DISCORD LOGIN
// ======================
app.get("/login", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
    res.redirect(url);
});

// ======================
// CALLBACK
// ======================
app.get("/callback", async (req, res) => {
    const code = req.query.code;

    try {
        const token = await axios.post("https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI
            }), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        const user = await axios.get("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token.data.access_token}`
            }
        });

        req.session.user = user.data;

        res.redirect("/dashboard");

    } catch (err) {
        console.log(err);
        res.send("Login Fehler");
    }
});

// ======================
// DASHBOARD
// ======================
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    res.send(`
        <h1>Dashboard</h1>
        <p>Willkommen ${req.session.user.username}</p>

        <img src="https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png" width="100"/>

        <hr>

        <h2>Beschwerde erstellen</h2>

        <form method="POST" action="/create-complaint">

            <input name="title" placeholder="Titel" required><br><br>

            <input name="target_user" placeholder="Gegen wen (Discord Name)" required><br><br>

            <textarea name="description" placeholder="Beschreibung" required></textarea><br><br>

            <button type="submit">Senden</button>

        </form>

        <br>

        <a href="/complaints">Alle Beschwerden ansehen</a>
    `);
});

// ======================
// BESCHWERDE ERSTELLEN
// ======================
app.post("/create-complaint", (req, res) => {

    if (!req.session.user) return res.redirect("/");

    const { title, description, target_user } = req.body;

    db.query(
        "INSERT INTO complaints (user_id, title, description, target_user, status) VALUES (?, ?, ?, ?, 'offen')",
        [req.session.user.id, title, description, target_user],
        (err) => {
            if (err) {
                console.log(err);
                return res.send("Fehler beim Speichern");
            }

            res.send("Beschwerde erfolgreich erstellt!");
        }
    );
});

// ======================
// BESCHWERDEN ANZEIGEN
// ======================
app.get("/complaints", (req, res) => {

    if (!req.session.user) return res.redirect("/");

    db.query("SELECT * FROM complaints ORDER BY id DESC", (err, results) => {

        let html = "<h1>Beschwerden</h1>";

        results.forEach(c => {
            html += `
                <div style="border:1px solid #ccc; padding:10px; margin:10px;">
                    <p><b>Titel:</b> ${c.title}</p>
                    <p><b>Gegen:</b> ${c.target_user}</p>
                    <p><b>Beschreibung:</b> ${c.description}</p>
                    <p><b>Status:</b> ${c.status}</p>
                </div>
            `;
        });

        res.send(html);
    });
});

// ======================
// START SERVER
// ======================
app.listen(3000, () => {
    console.log("Server läuft auf Port 3000");
});
