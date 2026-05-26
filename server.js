const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();

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
// DB
// ======================
const db = mysql.createConnection({
    host: "sql306.infinityfree.com",
    user: "if0_42025033",
    password: "budQIQWw1u",
    database: "if0_42025033_panel",
    port: 3306
});

db.connect(err => {
    if (err) console.log(err);
    else console.log("DB verbunden");
});

// ======================
// LOGIN PAGE (SCHÖN WIE PANEL)
// ======================
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Login</title>
<style>
body{
margin:0;
background:#0b1220;
color:white;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}
.box{
background:#111827;
padding:40px;
border-radius:15px;
text-align:center;
}
a{
background:#5865F2;
padding:12px 20px;
color:white;
text-decoration:none;
border-radius:8px;
display:inline-block;
margin-top:15px;
}
a:hover{background:#4752c4;}
</style>
</head>
<body>
<div class="box">
<h1>📌 Beschwerde Panel</h1>
<p>Login mit Discord</p>
<a href="/login">Einloggen</a>
</div>
</body>
</html>
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
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const user = await axios.get("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token.data.access_token}`
            }
        });

        // USER IN DB SPEICHERN / ROLE MEMBER DEFAULT
        db.query(
            "INSERT IGNORE INTO users (discord_id, username, avatar, role) VALUES (?, ?, ?, 'member')",
            [user.data.id, user.data.username, user.data.avatar]
        );

        req.session.user = user.data;
        res.redirect("/dashboard");

    } catch (err) {
        console.log(err);
        res.send("Login Fehler");
    }
});

// ======================
// DASHBOARD (CLEAN PANEL DESIGN)
// ======================
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Dashboard</title>

<style>
body{margin:0;font-family:Arial;background:#0b1220;color:white;display:flex;}
.sidebar{width:250px;height:100vh;background:#111827;padding:20px;}
.sidebar h2{color:#5865F2;}
.sidebar a{display:block;color:white;text-decoration:none;margin:10px 0;padding:8px;border-radius:6px;}
.sidebar a:hover{background:#1f2937;}
.main{flex:1;padding:30px;}
.card{background:#111827;padding:20px;border-radius:12px;margin-bottom:20px;}
input,textarea{width:100%;padding:10px;margin:10px 0;background:#1f2937;color:white;border:none;border-radius:6px;}
button{background:#5865F2;color:white;padding:10px;border:none;border-radius:6px;cursor:pointer;}
button:hover{background:#4752c4;}
</style>

</head>
<body>

<div class="sidebar">
<h2>Panel</h2>
<p>${req.session.user.username}</p>
<a href="/dashboard">Dashboard</a>
<a href="/complaints">Beschwerden</a>
</div>

<div class="main">

<div class="card">
<h2>Willkommen ${req.session.user.username}</h2>
</div>

<div class="card">
<h2>Beschwerde erstellen</h2>

<form method="POST" action="/create-complaint">

<input name="title" placeholder="Titel" required>

<input name="target_user" placeholder="Gegen wen (Discord Name)" required>

<textarea name="description" placeholder="Beschreibung" required></textarea>

<button type="submit">Senden</button>

</form>

</div>

</div>
</body>
</html>
    `);
});

// ======================
// CREATE COMPLAINT
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
                return res.send("Fehler");
            }

            res.redirect("/complaints");
        }
    );
});

// ======================
// COMPLAINTS PAGE
// ======================
app.get("/complaints", (req, res) => {

    if (!req.session.user) return res.redirect("/");

    db.query("SELECT * FROM complaints ORDER BY id DESC", (err, rows) => {

        let html = `
<!DOCTYPE html>
<html>
<head>
<style>
body{background:#0b1220;color:white;font-family:Arial;padding:20px;}
.box{background:#111827;padding:15px;margin:10px;border-radius:10px;}
a{color:#5865F2;}
</style>
</head>
<body>

<h1>Beschwerden</h1>
<a href="/dashboard">Zurück</a>
`;

        rows.forEach(c => {
            html += `
            <div class="box">
                <b>Titel:</b> ${c.title}<br>
                <b>Gegen:</b> ${c.target_user}<br>
                <b>Status:</b> ${c.status}<br>
                <p>${c.description}</p>
            </div>
            `;
        });

        html += `</body></html>`;
        res.send(html);
    });
});

// ======================
app.listen(3000, () => {
    console.log("Server läuft");
});
