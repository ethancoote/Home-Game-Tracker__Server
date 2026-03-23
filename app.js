import express from 'express';
import cors from 'cors';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { getGame, startDB, initDB, getPlayers, getSessions, setSession, setPlayer, updateProfileImg, setGame, updatePlayerName, deletePlayer, getRecentSession, setUser, getUser, setUserSession, deleteUserSession, getUserSession, verifyGameOwner, refreshUserSession, getUserById } from './database.js'; //REFACTOR JESUS
import { r2, uploadImage } from './r2.js';
import bcrypt from 'bcrypt';

const db = await startDB();
initDB(db);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

//middleware
const corsOptions = {
    origin: ['https://home-game-tracker.ecwebdev.ca', /*'http://localhost:4321'*/], // localhost for dev only // add env var
    credentials: true 
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

function requireAuth (req, res, next) {
    const token = req.cookies['session_token'];
    if (!token) {
        console.log('Session auth not found.');
        res.status(401).send({res: 'session token not found'});
        return null;
    }
    getUserSession(db, {token}, (userSession) => {
        if (userSession) {
            req.userId = userSession.user_id;
            refreshUserSession(db, {token}, (sessionToken, expiresAt) => {
                res.cookie('session_token', sessionToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    expires: expiresAt
                });
                next();
            });
        } else {
            console.log('Unverified user');
            res.status(401).send({res: 'Unverified user'});
            return null;
        }
    });
}

// This is for UI. This does not authorize the user.
function isLoggedIn (req) {
    const token = req.cookies['session_token'];
    if (!token) {
        return false;
    }
    return true;
}

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

app.get('/api/user', requireAuth, (req, res) => {
    const userId = req.userId;
    getUserById(db, {userId}, (status, user) => res.status(status).send({ 
        user_id: user.user_id,
        username: user.username,
    }));
});

app.get('/api/verify', (req, res) => {
    const loggedIn = isLoggedIn(req);
    if (!loggedIn) {
        res.status(200).send({ verified: false });
    } else {
        res.status(200).send({ verified: true });
    }
});

// post
app.post('/api/sessions/:playerId', requireAuth, (req, res) => {
    const playerId = req.params.playerId;
    const profit = req.body.profit;
    const gameId = req.body.gameId;
    const userId = req.userId;

    verifyGameOwner(db, { userId, gameId }, (verified) => {
        if (verified) {
            setSession(db, {playerId, profit});
            console.log(`New session created - player: ${playerId} profit: ${profit}`);
            res.status(200).send({res: "success"});
        } else {
            res.status(500).send({res: 'user_id does not match game owner.'});
        }
    })
});

app.post('/api/players/:gameId', requireAuth, (req, res) => {
    const userId = req.userId;
    const gameId = req.params.gameId;
    const name = req.body.name;

    verifyGameOwner(db, {userId, gameId}, (verified) => {
        if (verified) {
            setPlayer(db, {name, gameId}, (status, val) => {
                res.status(status).send(val);
            });
        } else {
            res.status(500).send({res: 'user_id does not match game owner.'});
        }
    });
});

app.post('/api/profile/:playerId', requireAuth, upload.single("profile-img"), async (req, res) => {
    const playerId = req.params.playerId;
    const file = req.file;
    const userId = req.userId;
    const gameId = req.body.gameId;
    const key = `players/${playerId}/${file.originalname}`;
    verifyGameOwner(db, { gameId, userId }, async (verified) => {
        if (verified) {
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
        } else {
            res.status(500).send({res: 'user_id does not match game owner.'});
        }
    });
    
});

app.post('/api/game/create', requireAuth, (req, res) => {
    const userId = req.userId;
    const name = req.body.name;
    setGame(db, { ownerId: userId, title: name }, (status, obj) => res.status(status).send(obj));
});

app.post('/api/player/:playerId', requireAuth, (req, res) => {
    const playerId = req.params.playerId;
    const name = req.body.name;
    const userId = req.userId;
    const gameId = req.body.gameId;

    verifyGameOwner(db, {userId, gameId}, (verified) => {
        if (verified) {
            updatePlayerName(db, { playerId, name }, (status, obj) => res.status(status).send(obj));
        } else {
            res.status(500).send({res: 'user_id does not match game owner.'});
        }
    });
    
});

// delete
app.delete('/api/player/:playerId', requireAuth, (req, res) => {
    const playerId = req.params.playerId;
    const gameId = req.body.gameId;
    const userId = req.userId;
    verifyGameOwner(db, { gameId, userId }, (verified) => {
        if (verified) {
            deletePlayer(db, { playerId }, (status, obj) => res.status(status).send(obj));
        } else {
            res.status(500).send({res: 'user_id does not match game owner.'});
        }
    });
});

// auth
app.post('/login', (req, res) => {
    const user = req.body.user;
    const pass = req.body.pass;
    getUser(db, { username: user }, async (status, userData) => {
        // verify pass
        if (userData && await bcrypt.compare(pass, userData.pass)) {
            // create session token
            setUserSession(db, { username: user }, (token, expiresAt) => {
                res.cookie('session_token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    expires: expiresAt
                });
                res.status(200).send({res: 'login success'});
            });
        } else {
            res.status(401).send({res: 'username or password is incorrect.'});
        }
    });
});

app.post('/signup', async (req, res) => {
    const user = req.body.user;
    const pass = req.body.pass;
    if (user.length < 3 || pass.length < 6) {
        res.status(400).send({res: 'Invalid credendials.'});
    } else {
        const passHash = await bcrypt.hash(pass, 11);
        setUser(db, {username: user, passHash}, (status, obj) => res.status(status).send(obj));
    }
    
});

app.post('/logout', (req, res) => {
    const token = req.cookies['session_token'];
    deleteUserSession(db, {token}, (status) => {
        res.clearCookie('session_token');
        res.status(status).send({ res: 'logged out' });
    });
});

app.listen(8080, () => {
    console.log("Server's live on 8080 bro...");
});