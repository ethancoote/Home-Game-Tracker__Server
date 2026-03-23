import sqlite3 from 'sqlite3';
import fs from 'fs/promises';
import crypto from 'crypto';

export async function startDB () {
    // create DB if it doesn't exist
    try {
        const file = await fs.open('./database/database.db', 'wx');
        console.log(`Database created successfully.`);
        await file.close();
    } catch (err) {
        if (err.code === 'EEXIST') {
            console.log("Database already exists.");
        } else {
            console.error(err);
        }
    }

    const db = new sqlite3.Database('./database/database.db', sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err);
        }
    });
    return db;
}

export function initDB (db) {
    const sql = 
    `CREATE TABLE IF NOT EXISTS users (
        user_id integer NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
        username varchar(50) NOT NULL UNIQUE,
        pass varchar(100) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
        game_id integer NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
        owner_id int NOT NULL,
        title varchar(100) NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(user_id)
    );
    CREATE TABLE IF NOT EXISTS players (
        player_id integer NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
        name varchar(24) NOT NULL,
        net_profit decimal(19, 4) NOT NULL,
        game_id int NOT NULL,
        profile_img varchar(255),
        previous_session_profit decimal(19, 4),
        FOREIGN KEY(game_id) REFERENCES games(game_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
        session_id integer NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
        player_id int,
        profit decimal(19, 4) NOT NULL,
        FOREIGN KEY(player_id) REFERENCES players(player_id)
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
        token varchar(128) NOT NULL UNIQUE PRIMARY KEY,
        user_id int NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(user_id)
    );
    `;
    db.exec(sql, (err) => {
        if (err) {
            console.error(err);
        }
    });
}

// temp TESTING ONLY
export function clearDB (db) {
    const sql = 
    `DROP TABLE users;
    DROP TABLE games;
    DROP TABLE players;
    DROP TABLE sessions;
    `;
    db.exec(sql, (err) => {
        if (err) {
            console.error(err);
        }
    });
}

//setters
export function setUser (db, {username, passHash}, cb) {
    const sql = `INSERT OR IGNORE INTO users (username, pass) VALUES (?, ?)`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(username, passHash, function (err) {
        if (err) {
            console.error(err);
            cb(500, {res: "error"});
            return null;
        }
        
        if (this.changes) {
            console.log(`New user created - ${username}`);
            cb(200, {res: "new user created"});
        } else {
            console.log(`User already exists - ${username}`);
            cb(409, {res: "error"});
        }
    });
}

export function setGame (db, {ownerId, title}, cb) {
    const sql = `INSERT INTO games (owner_id, title) VALUES (?, ?)`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(ownerId, title, function (err) {
        if (err) {
            console.error(err);
            cb(500, {res: "error"});
        }
        cb(200, {gameId: this.lastID});
    });

}

export function setPlayer (db, {name, profileImg = null, gameId}, cb) {
    const sql = `INSERT INTO players (name, net_profit, profile_img, game_id) VALUES (?, ?, ?, ?)`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(name, 0.00, profileImg, gameId, (err) => {
        if (err) {
            console.error(err);
            cb(500, {res: "bad request"});
            return null;
        }
        cb(200, {res: "success"});
    });
}

export function setSession (db, {playerId, profit}) {
    const sessionSql = `INSERT INTO sessions (player_id, profit) VALUES (?, ?)`;
    const sessionPrepStatement = db.prepare(sessionSql);
    sessionPrepStatement.run(playerId, profit, (err) => {
        if (err) {
            console.error(err);
            return null;
        }
    });

    const playerSql = `UPDATE players SET previous_session_profit = ?, net_profit = net_profit + ? WHERE player_id = ?`;
    const playerPrepStatement = db.prepare(playerSql);
    playerPrepStatement.run(profit, profit, playerId, (err) => {
        if (err) {
            console.error(err);
            return null;
        }
    });

    return 1;
}

export function setUserSession (db, {username}, cb) {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 60 mins?

    getUser(db, {username}, (status, user) => {
        const sql = `INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`;
        const prepStatement = db.prepare(sql);
        prepStatement.run(token, user.user_id, expiresAt, (err) => {
            if (err) {
                console.error(err);
                return null;
            }
            cb(token, expiresAt);
        });
        return 1;
    });
    
}

function createSessionToken () {
    const token = crypto.randomBytes(32).toString('hex');
    return token;
}

// getters
export function getUser (db, {username}, cb) {
    const sql = `SELECT * FROM users WHERE username = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(username, (err, user) => {
        if (err) {
            console.error(err);
            cb(401, {});
        }
        cb(200, user);
    });
}

export function getUserById (db, {userId}, cb) {
    const sql = `SELECT * FROM users WHERE user_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(userId, (err, user) => {
        if (err) {
            console.error(err);
            cb(401, {});
        }
        cb(200, user);
    });
}

export function getGame (db, {gameId}, cb) {
    const sql = `SELECT * FROM games WHERE game_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(gameId, (err, game) => {
        if (err) {
            console.error(err);
        }
        cb(game);
    });
}

export function getPlayers (db, {gameId}, cb) {
    const sql = `SELECT * FROM players WHERE game_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.all(gameId, (err, players) => {
        if (err) {
            console.error(err);
        }
        cb(players);
    });
}

export function getSessions (db, {playerId}, cb) {
    const sql = `SELECT * FROM sessions WHERE player_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.all(playerId, (err, sessions) => {
        if (err) {
            console.error(err);
        }
        cb(sessions);
    });
}

export function getRecentSession (db, {playerId}, cb) {
    const sql = `SELECT profit FROM sessions WHERE player_id = ? ORDER BY session_id DESC LIMIT 1`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(playerId, function(err, profit) {
        if (err) {
            console.error(err);
            cb(500, profit);
        }
        cb(200, profit );
    });
}

export function getUserSession (db, {token}, cb) {
    const sql = `SELECT * FROM user_sessions WHERE token = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(token, (err, userSession) => {
        if (err) {
            console.error(err);
            return null;
        }
        cb(userSession);
    });
}

// updates
export function updateProfileImg (db, {playerId, imgUrl}) {
    const sql = `UPDATE players SET profile_img = ? WHERE player_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(imgUrl, playerId, (err) => {
        if (err) {
            console.error(err);
            return null;
        }
        
    });
    return 1;
}

export function updatePlayerName (db, {playerId, name}, cb) {
    const sql = `UPDATE players SET name = ? WHERE player_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(name, playerId, function(err) {
        if (err) {
            console.error(err);
            cb(500, { playerId: null });
        }
        cb(200, { playerId })
    });
}

export function refreshUserSession (db, {token}, cb) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    const sql = `UPDATE user_sessions SET expires_at = ? WHERE token = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(expiresAt, token, (err) => {
        if (err) {
            console.error(err);
            return null;
        }
        cb(token, expiresAt);
    });
}

// deletes
export function deletePlayer (db, {playerId}, cb) {
    const sql = `DELETE FROM players WHERE player_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(playerId, function(err) {
        if (err) {
            console.error(err);
            cb(500, { playerId: null });
        }
        cb(200, { playerId })
    });
}

export function deleteUserSession (db, {token}, cb) {
    const sql = `DELETE FROM user_sessions WHERE token = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(token, (err) => {
        if (err) {
            console.err(err);
            return null;
        }
        console.log('User session deleted.');
        cb(200);
    });
}

// run on cron
export function deleteUnusedSessions (db, cb) {
    const sql = `DELETE FROM user_sessions WHERE expires_at < DATETIME('now')`;
    const prepStatement = db.prepare(sql);
    prepStatement.run((err) => {
        if (err) {
            console.error();
            return null;
        }
        cb(200);
    });
}

// verify
export function verifyGameOwner (db, {userId, gameId}, cb) {
    const sql = `SELECT owner_id FROM games WHERE game_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(gameId, (err, user) => {
        if (err) {
            console.error(err);
            return null;
        }
        if (userId === user.owner_id) {
            cb(true);
        } else {
            console.log('user_id does not match game owner.');
            cb(false);
        }
    }); 
}

