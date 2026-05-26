const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();

app.use(session({
    secret: "secret123",
    resave: false,
    saveUninitialized: false
}));

// 🔥 HIER EINTRAGEN
const CLIENT_ID = "1508836298713206876";
const CLIENT_SECRET = "_tvGiwdTngoNYt0jzVqrsCR-7mLGjN9A";

// Render URL später ersetzen!
const REDIRECT_URI = "https://beschwerde-panel.onrender.com/callback";

// 👉 Startseite
app.get("/", (req, res) => {
    res.send(`
        <h1>Beschwerde Panel</h1>
        <a href="/login">Mit Discord einloggen</a>
    `);
});

// 👉 Login
app.get("/login", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
    res.redirect(url);
});

// 👉 Callback
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
        res.send("Fehler beim Login");
    }
});

// 👉 Dashboard
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    res.send(`
        <h1>Dashboard</h1>
        <p>Willkommen ${req.session.user.username}</p>
        <img src="https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png" width="100"/>
    `);
});

// Server Start
app.listen(3000, () => {
    console.log("Server läuft");
});
