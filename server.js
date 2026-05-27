const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= DISCORD CONFIG =================

const CLIENT_ID = "1508836298713206876";
const CLIENT_SECRET = "_tvGiwdTngoNYt0jzVqrsCR-7mLGjN9A";
const REDIRECT_URI = "https://DEINE-APP.onrender.com/callback";

// ================= MIDDLEWARE =================

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false
}));

// ================= MYSQL (RAILWAY) =================

const db = mysql.createConnection({
    host: "yamanote.proxy.rlwy.net",
    user: "root",
    password: "TcZJFNCVixAGMPRydyYXaLLHgmbICDBN",
    database: "railway",
    port: 3306
});

db.connect(err => {
    if (err) console.log("MYSQL FEHLER:", err);
    else console.log("MYSQL VERBUNDEN");
});

// ================= AUTO TABLES =================

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

// ================= AUTH =================

function auth(req,res,next){
    if(!req.session.user) return res.redirect("/");
    next();
}

// ================= DESIGN =================

const css = `
<style>
body{margin:0;font-family:Arial;background:#0b1020;color:white;}

.login{display:flex;justify-content:center;align-items:center;height:100vh;}
.box{background:#111827;padding:40px;border-radius:18px;width:350px;text-align:center;border:1px solid #1f2a44;}

.btn{display:inline-block;padding:12px 18px;background:#6d5dfc;color:white;border-radius:10px;text-decoration:none;margin-top:15px;}

.container{display:flex;min-height:100vh;}

.sidebar{width:220px;background:#111827;padding:20px;border-right:1px solid #1f2a44;}
.sidebar a{display:block;color:white;text-decoration:none;padding:10px;border-radius:8px;margin-bottom:6px;}
.sidebar a:hover{background:#6d5dfc;}

.content{flex:1;padding:20px;}

.card{background:#111827;padding:15px;margin:10px;border-radius:12px;border:1px solid #1f2a44;}

.status{padding:5px 10px;border-radius:6px;display:inline-block;margin-top:8px;}
.offen{background:#fbbf2420;color:#fbbf24;}
.angenommen{background:#22c55e20;color:#22c55e;}
.abgelehnt{background:#ef444420;color:#ef4444;}
</style>
`;

// ================= HOME =================

app.get("/", (req,res)=>{
res.send(`
<html><head>${css}</head><body>
<div class="login">
<div class="box">
<h2>Beschwerde Panel</h2>
<p>Login mit Discord</p>
<a class="btn" href="/login">Login</a>
</div>
</div>
</body></html>
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
res.redirect("https://discord.com/oauth2/authorize?"+params);
});

// ================= CALLBACK =================

app.get("/callback", async (req,res)=>{

const code = req.query.code;
if(!code) return res.send("No Code");

try {

const tokenRes = await axios.post(
"https://discord.com/api/oauth2/token",
new URLSearchParams({
client_id: CLIENT_ID,
client_secret: CLIENT_SECRET,
grant_type:"authorization_code",
code,
redirect_uri: REDIRECT_URI
}),
{headers:{"Content-Type":"application/x-www-form-urlencoded"}}
);

const userRes = await axios.get(
"https://discord.com/api/users/@me",
{headers:{Authorization:`Bearer ${tokenRes.data.access_token}`}}
);

const user = userRes.data;

// insert user
db.query(
"INSERT IGNORE INTO users (discord_id,username,avatar) VALUES (?,?,?)",
[user.id,user.username,user.avatar]
);

// role logic
db.query("SELECT * FROM users",(err,rows)=>{

let role = "member";
if(rows.length === 0) role = "leitung";

db.query(
"UPDATE users SET role=? WHERE discord_id=?",
[role,user.id]
);

req.session.user = {
id:user.id,
username:user.username,
role:role
};

res.redirect("/dashboard");

});

} catch(err){
console.log(err.response?.data || err);
res.send("Login Fehler");
}

});

// ================= DASHBOARD =================

app.get("/dashboard",auth,(req,res)=>{

db.query("SELECT * FROM complaints ORDER BY id DESC",(err,rows)=>{

let html = "";

rows.forEach(c=>{
html += `
<div class="card">
<h3>${c.title}</h3>
<p>${c.description}</p>
<p>Target: ${c.target_user}</p>
<p>By: ${c.taken_by || "-"}</p>

<div class="status ${c.status}">${c.status}</div>
<br>

<a href="/take/${c.id}">Take</a> |
<a href="/accept/${c.id}">Accept</a> |
<a href="/reject/${c.id}">Reject</a>
</div>
`;
});

res.send(`
<html><head>${css}</head><body>

<div class="container">

<div class="sidebar">
<h3>Menu</h3>
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

// ================= CREATE =================

app.get("/create",auth,(req,res)=>{
res.send(`
<html><head>${css}</head><body>

<div class="login">
<div class="box">
<h2>Create Complaint</h2>

<form method="POST">
<input name="title" placeholder="Title"><br><br>
<input name="target_user" placeholder="Target"><br><br>
<textarea name="description"></textarea><br><br>
<button class="btn">Send</button>
</form>

</div>
</div>

</body></html>
`);
});

app.post("/create",auth,(req,res)=>{

db.query(
"INSERT INTO complaints (user_id,title,description,target_user) VALUES (?,?,?,?)",
[req.session.user.id,req.body.title,req.body.description,req.body.target_user]
);

res.redirect("/dashboard");

});

// ================= ACTIONS =================

app.get("/take/:id",auth,(req,res)=>{
db.query("UPDATE complaints SET taken_by=? WHERE id=?",[req.session.user.username,req.params.id]);
res.redirect("/dashboard");
});

app.get("/accept/:id",auth,(req,res)=>{
db.query("UPDATE complaints SET status='angenommen' WHERE id=?",[req.params.id]);
res.redirect("/dashboard");
});

app.get("/reject/:id",auth,(req,res)=>{
db.query("UPDATE complaints SET status='abgelehnt' WHERE id=?",[req.params.id]);
res.redirect("/dashboard");
});

// ================= LOGOUT =================

app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/"));
});

// ================= START =================

app.listen(PORT,()=>{
console.log("Server läuft auf " + PORT);
});
