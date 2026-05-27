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
    secret: process.env.SESSION_SECRET || "secret",
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
});

db.connect(err => {
    if (err) console.log(err);
    else console.log("DB connected");
});

// ================= TABLES =================
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
taken_by VARCHAR(255) DEFAULT NULL
)`);

// ================= AUTH =================
function auth(req,res,next){
    if(!req.session.user) return res.redirect("/");
    next();
}

// ================= HOME =================
app.get("/", (req,res)=>{
res.send(`
<h1>Discord Panel</h1>
<a href="/login">Login</a>
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

try {

const token = await axios.post(
"https://discord.com/api/oauth2/token",
new URLSearchParams({
client_id: CLIENT_ID,
client_secret: CLIENT_SECRET,
grant_type:"authorization_code",
code,
redirect_uri: REDIRECT_URI
}),
{ headers:{ "Content-Type":"application/x-www-form-urlencoded" } }
);

const userRes = await axios.get(
"https://discord.com/api/users/@me",
{ headers:{ Authorization:`Bearer ${token.data.access_token}` } }
);

const user = userRes.data;

// USER IN DB
db.query(
"INSERT IGNORE INTO users (discord_id, username, avatar) VALUES (?,?,?)",
[user.id,user.username,user.avatar]
);

// ROLE CHECK / FIRST USER = LEITUNG
db.query("SELECT * FROM users",(err,rows)=>{

let role = "member";

// 🔥 erster User im System wird Leitung
if(rows.length === 0){
role = "leitung";

db.query(
"UPDATE users SET role='leitung' WHERE discord_id=?",
[user.id]
);
}

db.query(
"SELECT role FROM users WHERE discord_id=?",
[user.id],
(err2,roleRows)=>{

req.session.user = {
id:user.id,
username:user.username,
avatar:user.avatar,
role: roleRows[0]?.role || role
};

res.redirect("/dashboard");
});

});

} catch(err){
console.log(err);
res.send("Login Fehler");
}
});

// ================= DASHBOARD =================
app.get("/dashboard",auth,(req,res)=>{

let sql = "";

if(req.session.user.role === "member"){
sql = "WHERE user_id='"+req.session.user.id+"'";
}

db.query("SELECT * FROM complaints "+sql+" ORDER BY id DESC",(err,rows)=>{

let html = "";

rows.forEach(c=>{
html += `
<div style="background:#1f2937;padding:10px;margin:10px;border-radius:8px;">
<h3>${c.title}</h3>
<p>${c.description}</p>
<p>Status: ${c.status}</p>
<p>Übernommen von: ${c.taken_by || "niemand"}</p>

${
req.session.user.role !== "member"
? `<a href="/take/${c.id}">Take</a> | 
<a href="/accept/${c.id}">Accept</a> | 
<a href="/reject/${c.id}">Reject</a>`
: ""
}

</div>`;
});

res.send(`
<h1>Dashboard (${req.session.user.role})</h1>

<a href="/create">Beschwerde erstellen</a>
<br><br>

${html}

<br><br>

${req.session.user.role === "leitung"
? `<a href="/setrole">Rollen vergeben</a>`
: ""}

<br><br>
<a href="/logout">Logout</a>
`);
});
});

// ================= CREATE =================
app.get("/create",auth,(req,res)=>{
res.send(`
<form method="POST">
<input name="title" placeholder="Titel"><br>
<input name="target_user" placeholder="Gegen wen"><br>
<textarea name="description"></textarea><br>
<button>Senden</button>
</form>
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
if(req.session.user.role === "member") return res.send("No");

db.query("UPDATE complaints SET taken_by=? WHERE id=?",
[req.session.user.username,req.params.id]);

res.redirect("/dashboard");
});

app.get("/accept/:id",auth,(req,res)=>{
if(req.session.user.role === "member") return res.send("No");

db.query("UPDATE complaints SET status='angenommen' WHERE id=?",[req.params.id]);
res.redirect("/dashboard");
});

app.get("/reject/:id",auth,(req,res)=>{
if(req.session.user.role === "member") return res.send("No");

db.query("UPDATE complaints SET status='abgelehnt' WHERE id=?",[req.params.id]);
res.redirect("/dashboard");
});

// ================= ROLE SYSTEM =================
app.get("/setrole",auth,(req,res)=>{
if(req.session.user.role !== "leitung")
return res.send("No rights");

res.send(`
<form method="POST">
<input name="discord_id" placeholder="Discord ID"><br>
<select name="role">
<option>member</option>
<option>konfliktmanager</option>
<option>leitung</option>
</select><br>
<button>Set</button>
</form>
`);
});

app.post("/setrole",auth,(req,res)=>{
if(req.session.user.role !== "leitung")
return res.send("No rights");

db.query(
"UPDATE users SET role=? WHERE discord_id=?",
[req.body.role,req.body.discord_id]
);

res.send("Role updated");
});

// ================= LOGOUT =================
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/"));
});

// ================= START =================
app.listen(PORT,()=>console.log("Server läuft auf "+PORT));
