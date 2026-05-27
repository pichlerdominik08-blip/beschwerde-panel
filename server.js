const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= CONFIG =================

const CLIENT_ID = "1508836298713206876"; 
const CLIENT_SECRET = "_tvGiwdTngoNYt0jzVqrsCR-7mLGjN9A"; 
const REDIRECT_URI = "https://beschwerde-panel.onrender.com/callback"; 

// ================= MIDDLEWARE =================

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

// ================= DB =================

const db = mysql.createConnection({ 
   host: "sql306.infinityfree.com",
   user: "if0_42025033", 
   password: "budQIQWw1u", 
   database: "if0_42025033_panel", 
   port: 3306 
   ssl: {}
});

db.connect(err => {
    if (err) console.log(err);
    else console.log("DB connected");
});

db.connect(err => {

if(err){
console.log("MYSQL FEHLER:");
console.log(err);
} else {
console.log("MYSQL VERBUNDEN");
}

});

// ================= TABLES =================

db.query(`
CREATE TABLE IF NOT EXISTS users (
id INT AUTO_INCREMENT PRIMARY KEY,
discord_id VARCHAR(255) UNIQUE,
username VARCHAR(255),
avatar TEXT,
role VARCHAR(50) DEFAULT 'member'
)
`);

db.query(`
CREATE TABLE IF NOT EXISTS complaints (
id INT AUTO_INCREMENT PRIMARY KEY,
user_id VARCHAR(255),
title TEXT,
description TEXT,
target_user TEXT,
status VARCHAR(50) DEFAULT 'offen',
taken_by VARCHAR(255) DEFAULT NULL
)
`);

// ================= AUTH =================

function auth(req,res,next){
    if(!req.session.user) return res.redirect("/");
    next();
}

// ================= CSS =================

const css = `
<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
font-family:Inter,sans-serif;
}

body{
background:#060b23;
color:white;
overflow-x:hidden;
}

/* LOGIN */

.login-page{
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}

.login-box{
width:450px;
background:#101935;
padding:40px;
border-radius:24px;
border:1px solid #1f2b50;
box-shadow:0 0 40px rgba(0,0,0,.4);
}

.logo{
font-size:32px;
font-weight:700;
margin-bottom:40px;
color:#7c5cff;
}

.login-title{
font-size:42px;
font-weight:700;
margin-bottom:15px;
}

.login-sub{
color:#94a3b8;
margin-bottom:35px;
line-height:1.5;
}

.btn{
display:inline-block;
padding:15px 20px;
border-radius:14px;
background:#6d5dfc;
color:white;
text-decoration:none;
border:none;
cursor:pointer;
transition:.2s;
font-weight:600;
}

.btn:hover{
transform:translateY(-2px);
opacity:.9;
}

.btn.full{
width:100%;
text-align:center;
}

.container{
display:flex;
min-height:100vh;
}

/* SIDEBAR */

.sidebar{
width:260px;
background:#101935;
padding:30px 20px;
border-right:1px solid #1f2b50;
}

.sidebar .logo{
margin-bottom:50px;
}

.nav a{
display:block;
padding:15px;
border-radius:14px;
margin-bottom:10px;
text-decoration:none;
color:#cbd5e1;
transition:.2s;
font-weight:500;
}

.nav a:hover{
background:#6d5dfc;
color:white;
}

/* CONTENT */

.content{
flex:1;
padding:50px;
}

.header{
margin-bottom:40px;
}

.header h1{
font-size:48px;
margin-bottom:10px;
}

.header p{
color:#94a3b8;
font-size:18px;
}

/* CARDS */

.cards{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(350px,1fr));
gap:25px;
}

.card{
background:#101935;
border:1px solid #1f2b50;
border-radius:24px;
padding:25px;
transition:.2s;
}

.card:hover{
transform:translateY(-3px);
}

.card h2{
font-size:24px;
margin-bottom:15px;
}

.card p{
color:#cbd5e1;
line-height:1.6;
}

.small{
margin-top:10px;
font-size:14px;
color:#94a3b8;
}

/* STATUS */

.status{
display:inline-block;
padding:8px 16px;
border-radius:999px;
margin-top:18px;
font-size:14px;
font-weight:600;
}

.offen{
background:#f59e0b20;
color:#fbbf24;
}

.angenommen{
background:#10b98120;
color:#34d399;
}

.abgelehnt{
background:#ef444420;
color:#f87171;
}

/* FORM */

.form-box{
max-width:600px;
background:#101935;
padding:40px;
border-radius:24px;
border:1px solid #1f2b50;
}

.input{
width:100%;
padding:16px;
margin-bottom:20px;
border:none;
border-radius:14px;
background:#0b122b;
color:white;
font-size:15px;
}

textarea{
resize:none;
height:180px;
}

.actions{
margin-top:20px;
display:flex;
gap:10px;
flex-wrap:wrap;
}

</style>
`;

// ================= HOME =================

app.get("/", (req,res)=>{

res.send(`
<html>
<head>
<title>Login</title>
${css}
</head>
<body>

<div class="login-page">

<div class="login-box">

<div class="logo">TeamPanel</div>

<div class="login-title">
Willkommen zurück
</div>

<div class="login-sub">
Melde dich an um auf das Team Panel zuzugreifen.
</div>

<a class="btn full" href="/login">
Jetzt einloggen
</a>

</div>

</div>

</body>
</html>
`);

});

// ================= LOGIN =================

app.get("/login",(req,res)=>{

const params = new URLSearchParams({
client_id: CLIENT_ID,
redirect_uri: REDIRECT_URI,
response_type:"code",
scope:"identify"
});

res.redirect(
"https://discord.com/oauth2/authorize?"+params
);

});

// ================= CALLBACK =================

app.get("/callback", async (req,res)=>{

const code = req.query.code;

if(!code){
return res.send("Kein Code erhalten");
}

try {

const tokenRes = await axios.post(
"https://discord.com/api/oauth2/token",

new URLSearchParams({
client_id: CLIENT_ID,
client_secret: CLIENT_SECRET,
grant_type: "authorization_code",
code: code,
redirect_uri: REDIRECT_URI
}),

{
headers:{
"Content-Type":"application/x-www-form-urlencoded"
}
}
);

const access_token = tokenRes.data.access_token;

if(!access_token){
console.log(tokenRes.data);
return res.send("Kein Access Token");
}

const userRes = await axios.get(
"https://discord.com/api/users/@me",
{
headers:{
Authorization:`Bearer ${access_token}`
}
}
);

const user = userRes.data;

console.log(user);

// USER SPEICHERN

db.query(
"INSERT IGNORE INTO users (discord_id,username,avatar) VALUES (?,?,?)",
[
user.id,
user.username,
user.avatar
],
(err)=>{

if(err){
console.log(err);
return res.send("DB Fehler");
}

// USER ROLLE HOLEN

db.query(
"SELECT * FROM users WHERE discord_id=?",
[user.id],

(err2,rows)=>{

if(err2){
console.log(err2);
return res.send("Role Fehler");
}

// ERSTER USER = LEITUNG

if(rows.length > 0 && !rows[0].role){

db.query(
"UPDATE users SET role='leitung' WHERE discord_id=?",
[user.id]
);

rows[0].role = "leitung";
}

req.session.user = {
id:user.id,
username:user.username,
avatar:user.avatar,
role:rows[0]?.role || "member"
};

res.redirect("/dashboard");

});

});

} catch(err){

console.log(err.response?.data || err);

res.send(`
<h1>Login Fehler</h1>
<pre>
${JSON.stringify(err.response?.data || err,null,2)}
</pre>
`);

}

});
// ================= DASHBOARD =================

app.get("/dashboard", auth, (req,res)=>{

let sql = "";

if(req.session.user.role === "member"){
sql = `WHERE user_id='${req.session.user.id}'`;
}

db.query(
"SELECT * FROM complaints "+sql+" ORDER BY id DESC",

(err,rows)=>{

let cards = "";

rows.forEach(c=>{

cards += `

<div class="card">

<h2>${c.title}</h2>

<p>${c.description}</p>

<div class="small">
Gegen: ${c.target_user}
</div>

<div class="small">
Übernommen von:
${c.taken_by || "Niemand"}
</div>

<div class="status ${c.status}">
${c.status}
</div>

${
req.session.user.role !== "member"

? `

<div class="actions">

<a class="btn" href="/take/${c.id}">
Take
</a>

<a class="btn" href="/accept/${c.id}">
Accept
</a>

<a class="btn" href="/reject/${c.id}">
Reject
</a>

</div>

`

: ""

}

</div>

`;

});

res.send(`

<html>
<head>
<title>Dashboard</title>
${css}
</head>
<body>

<div class="container">

<div class="sidebar">

<div class="logo">
TeamPanel
</div>

<div class="nav">

<a href="/dashboard">
Dashboard
</a>

<a href="/create">
Beschwerde
</a>

${
req.session.user.role === "leitung"

? `

<a href="/setrole">
Rollen
</a>

`

: ""
}

<a href="/logout">
Logout
</a>

</div>

</div>

<div class="content">

<div class="header">

<h1>
Hallo, ${req.session.user.username}.
</h1>

<p>
Hier ist dein Überblick über das Panel.
</p>

</div>

<div class="cards">
${cards}
</div>

</div>

</div>

</body>
</html>

`);

});

});

// ================= CREATE =================

app.get("/create", auth, (req,res)=>{

res.send(`

<html>
<head>
<title>Create</title>
${css}
</head>
<body>

<div class="login-page">

<div class="form-box">

<h1 style="margin-bottom:30px;">
Beschwerde erstellen
</h1>

<form method="POST">

<input
class="input"
name="title"
placeholder="Titel"
required
>

<input
class="input"
name="target_user"
placeholder="Gegen wen"
required
>

<textarea
class="input"
name="description"
placeholder="Beschreibung"
required
></textarea>

<button class="btn full">
Senden
</button>

</form>

</div>

</div>

</body>
</html>

`);

});

app.post("/create", auth, (req,res)=>{

db.query(
"INSERT INTO complaints (user_id,title,description,target_user) VALUES (?,?,?,?)",
[
req.session.user.id,
req.body.title,
req.body.description,
req.body.target_user
]
);

res.redirect("/dashboard");

});

// ================= ACTIONS =================

app.get("/take/:id", auth, (req,res)=>{

if(req.session.user.role === "member")
return res.send("Keine Rechte");

db.query(
"UPDATE complaints SET taken_by=? WHERE id=?",
[
req.session.user.username,
req.params.id
]
);

res.redirect("/dashboard");

});

app.get("/accept/:id", auth, (req,res)=>{

if(req.session.user.role === "member")
return res.send("Keine Rechte");

db.query(
"UPDATE complaints SET status='angenommen' WHERE id=?",
[req.params.id]
);

res.redirect("/dashboard");

});

app.get("/reject/:id", auth, (req,res)=>{

if(req.session.user.role === "member")
return res.send("Keine Rechte");

db.query(
"UPDATE complaints SET status='abgelehnt' WHERE id=?",
[req.params.id]
);

res.redirect("/dashboard");

});

// ================= ROLE =================

app.get("/setrole", auth, (req,res)=>{

if(req.session.user.role !== "leitung")
return res.send("Keine Rechte");

res.send(`

<html>
<head>
<title>Roles</title>
${css}
</head>
<body>

<div class="login-page">

<div class="form-box">

<h1 style="margin-bottom:30px;">
Rolle vergeben
</h1>

<form method="POST">

<input
class="input"
name="discord_id"
placeholder="Discord ID"
required
>

<select class="input" name="role">

<option>member</option>
<option>konfliktmanager</option>
<option>leitung</option>

</select>

<button class="btn full">
Speichern
</button>

</form>

</div>

</div>

</body>
</html>

`);

});

app.post("/setrole", auth, (req,res)=>{

if(req.session.user.role !== "leitung")
return res.send("Keine Rechte");

db.query(
"UPDATE users SET role=? WHERE discord_id=?",
[
req.body.role,
req.body.discord_id
]
);

res.redirect("/dashboard");

});

// ================= LOGOUT =================

app.get("/logout",(req,res)=>{

req.session.destroy(()=>{
res.redirect("/");
});

});

// ================= START =================

app.listen(PORT,()=>{
console.log("Server läuft auf Port "+PORT);
});
