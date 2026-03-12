import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getGame, startDB, getPlayers, getSessions, setSession, setPlayer, updateProfileImg, setGame, updatePlayerName, deletePlayer, getRecentSession } from './database.js';
import { r2, uploadImage } from './r2.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

//middleware
const corsOptions = {
    origin: ['http://localhost:4321'],
}
app.use(cors(corsOptions));
app.use(express.json());

const db = startDB();

// get
app.get('/api/game/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    getGame(db, {gameId}, (obj) => res.status(200).send(obj));
});

app.get('/api/game/:gameId/players', (req, res) => {
    const gameId = req.params.gameId;
    getPlayers(db, {gameId}, (obj) => res.status(200).send(obj));
});

app.get('/api/sessions/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    getSessions(db, { playerId }, (obj) => res.status(200).send(obj));
});

app.get('/api/sessions/previous/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    getRecentSession(db, { playerId }, (status, obj) => res.status(status).send(obj));
});

// post
app.post('/api/sessions/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    const profit = req.body.profit;
    if (setSession(db, {playerId, profit})) {
        console.log(`New session created - player: ${playerId} profit: ${profit}`);
        res.status(200).send({res: "success"});
    } else {
        console.error("Failed to create new session.");
        res.status(400).send({res: "bad request"});
    }
});

app.post('/api/players/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    const name = req.body.name;
    if (setPlayer(db, {name, gameId})) {
        console.log(`New player created - game: ${gameId} name: ${name}`);
        res.status(200).send({res: "success"});
    } else {
        console.error("Failed to create new player.");
        res.status(400).send({res: "bad request"});
    }
});

app.post('/api/profile/:playerId', upload.single("profile-img"), async (req, res) => {
    const playerId = req.params.playerId;
    const file = req.file;
    const key = `players/${playerId}/${file.originalname}`;
    if (await uploadImage(r2, file, key)) {
        console.log(`Profile image stored in r2 - player: ${playerId}`);
        if (updateProfileImg(db, {imgUrl: `${process.env.R2_PUBLIC_DOMAIN}/${key}`, playerId})) {
            console.log("Database updated") 
            res.status(200).send({res: "success"});
        } else {
            console.error("Failed to update database.");
        }
    } else {
        console.error("Failed to upload player image.");
        res.status(500).send({res: "upload failed"});
    }
});

app.post('/api/game/:userId', (req, res) => {
    const userId = req.params.userId;
    const name = req.body.name;
    setGame(db, { ownerId: userId, title: name }, (status, obj) => res.status(status).send(obj));
});

app.post('/api/player/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    const name = req.body.name;
    updatePlayerName(db, { playerId, name }, (status, obj) => res.status(status).send(obj));
});

// delete
app.delete('/api/player/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    deletePlayer(db, { playerId }, (status, obj) => res.status(status).send(obj));
});

app.listen(8080, () => {
    console.log("Server's live on 8080 bro...");
});