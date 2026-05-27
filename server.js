const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= SAFETY ================= */
process.on("uncaughtException", (err) => {
    console.log("CRASH:", err);
});

/* ================= DISCORD ================= */

const CLIENT_ID = "1455173278376136788";
const CLIENT_SECRET = "U3iGnMV0TcVqiBvWmf1GNzGybg-aXiqd";
const REDIRECT_URI = "https://beschwerde-panel.onrender.com/callback";

/* ================= MIDDLEWARE ================= */

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "secret123",
    resave: false,
    saveUninitialized: false
}));

/* ================= MYSQL (SAFE POOL) ================= */

const db = mysql.createPool({
    host: "yamanote.proxy.rlwy.net",
    user: "root",
    password: "TcZJFNCVixAGMPRydyYXaLLHgmbICDBN",
    database: "railway",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10
});

/* ================= TABLES ================= */

db.query(`
CREATE TABLE IF NOT EXISTS users (
id INT AUTO_INCREMENT PRIMARY KEY,
discord_id VARCHAR(255) UNIQUE,
username VARCHAR(255),
avatar TEXT,
role VARCHAR(50) DEFAULT 'member'
)`);

db.query(`
CREATE TABLE IF NOT EXISTS complaints (
id INT AUTO_INCREMENT PRIMARY KEY,
user_id VARCHAR(255),
title TEXT,
description TEXT,
target_user TEXT,
status VARCHAR(50) DEFAULT 'offen',
taken_by VARCHAR(255)
)`);

/* ================= AUTH ================= */

function auth(req, res, next) {
    if (!req.session.user) return res.redirect("/");
    next();
}

/* ================= DESIGN ================= */

const css = `
<style>
body{margin:0;font-family:Arial;background:#0b1020;color:white;}

.login{display:flex;justify-content:center;align-items:center;height:100vh;}
.box{background:#111827;padding:40px;border-radius:16px;width:340px;text-align:center;border:1px solid #1f2a44;}

.btn{display:inline-block;padding:12px 18px;background:#6d5dfc;color:white;border-radius:10px;text-decoration:none;margin-top:15px;}

.container{display:flex;min-height:100vh;}

.sidebar{width:240px;background:#111827;padding:20px;border-right:1px solid #1f2a44;}
.sidebar a{display:block;padding:10px;color:white;text-decoration:none;border-radius:8px;margin-bottom:6px;}
.sidebar a:hover{background:#6d5dfc;}

.content{flex:1;padding:25px;}

.card{background:#111827;padding:15px;margin-bottom:12px;border-radius:12px;border:1px solid #1f2a44;}

.status{padding:4px 8px;border-radius:6px;font-size:12px;display:inline-block;margin-top:6px;}
.offen{background:#fbbf2420;color:#fbbf24;}
.angenommen{background:#22c55e20;color:#22c55e;}
.abgelehnt{background:#ef444420;color:#ef4444;}
</style>
`;

/* ================= HOME ================= */

app.get("/", (req,res)=>{
res.send(`
<html><head>${css}</head>
<body>
<div class="login">
<div class="box">
<h2>Beschwerde Panel</h2>
<a class="btn" href="/login">Login mit Discord</a>
</div>
</div>
</body></html>
`);
});

/* ================= LOGIN ================= */

app.get("/login", (req,res)=>{
const url =
`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;

res.redirect(url);
});

/* ================= CALLBACK (FAST + NO HANG) ================= */

app.get("/callback", async (req, res) => {

const code = req.query.code;
if (!code) return res.send("No Code");

try {

// 1. TOKEN
const token = await axios.post(
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

// 2. USER
const userRes = await axios.get(
"https://discord.com/api/users/@me",
{
headers: {
Authorization: `Bearer ${token.data.access_token}`
}
}
);

const user = userRes.data;

// 3. DB INSERT (ASYNC - NICHT BLOCKIEREND)
db.query(
"INSERT IGNORE INTO users (discord_id, username, avatar) VALUES (?,?,?)",
[user.id, user.username, user.avatar]
);

// 4. ROLE FIX (KEIN COUNT, KEIN STRESS)
db.query(
"SELECT role FROM users WHERE discord_id=?",
[user.id],
(err, rows) => {

const role = rows?.[0]?.role || "member";

db.query(
"UPDATE users SET role=? WHERE discord_id=?",
[role, user.id]
);

// 🔥 WICHTIG: SOFORT REDIRECT (KEIN WAITEN!)
req.session.user = {
id: user.id,
username: user.username,
role
};

return res.redirect("/dashboard");

});

} catch (err) {
console.log("LOGIN ERROR:", err.response?.data || err);
return res.send("Login Fehler");
}

});

/* ================= DASHBOARD ================= */

app.get("/dashboard", auth, (req,res)=>{

db.query("SELECT * FROM complaints ORDER BY id DESC",(err,rows)=>{

let html = "";

rows.forEach(c=>{
html += `
<div class="card">
<h3>${c.title}</h3>
<p>${c.description}</p>
<p>Target: ${c.target_user}</p>
<p>By: ${c.taken_by || "-"}</p>

<div class="status ${c.status}">
${c.status}
</div>

<br>

<a href="/take/${c.id}">Take</a> |
<a href="/accept/${c.id}">Accept</a> |
<a href="/reject/${c.id}">Reject</a>
</div>
`;
});

res.send(`
<html><head>${css}</head>
<body>

<div class="container">

<div class="sidebar">
<h3>Panel</h3>
<a href="/dashboard">Dashboard</a>
<a href="/create">Create</a>
<a href="/logout">Logout</a>
</div>

<div class="content">
<h1>Dashboard</h1>
${html}
</div>

</div>

</body></html>
`);
});

});

/* ================= CREATE ================= */

app.get("/create", auth, (req,res)=>{
res.send(`
<html><head>${css}</head>
<body>
<div class="login">
<div class="box">
<h2>Neue Beschwerde</h2>

<form method="POST">
<input name="title" placeholder="Titel"><br><br>
<input name="target_user" placeholder="Target"><br><br>
<textarea name="description"></textarea><br><br>
<button class="btn">Senden</button>
</form>

</div>
</div>
</body></html>
`);
});

app.post("/create", auth, (req,res)=>{
db.query(
"INSERT INTO complaints (user_id,title,description,target_user) VALUES (?,?,?,?)",
[req.session.user.id, req.body.title, req.body.description, req.body.target_user]
);
res.redirect("/dashboard");
});

/* ================= ACTIONS ================= */

app.get("/take/:id", auth,(req,res)=>{
db.query("UPDATE complaints SET taken_by=? WHERE id=?",[req.session.user.username,req.params.id]);
res.redirect("/dashboard");
});

app.get("/accept/:id", auth,(req,res)=>{
db.query("UPDATE complaints SET status='angenommen' WHERE id=?",[req.params.id]);
res.redirect("/dashboard");
});

app.get("/reject/:id", auth,(req,res)=>{
db.query("UPDATE complaints SET status='abgelehnt' WHERE id=?",[req.params.id]);
res.redirect("/dashboard");
});

/* ================= LOGOUT ================= */

app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/"));
});

/* ================= START ================= */

app.listen(PORT, ()=>{
console.log("Server läuft auf Port " + PORT);
});
