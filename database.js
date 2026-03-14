import sqlite3 from 'sqlite3';
import fs from 'fs/promises';

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
        username varchar(50) NOT NULL UNIQUE
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
export function setUser (db, username) {
    const sql = `INSERT INTO users (username) VALUES (?)`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(username, (err) => {
        if (err) {
            console.error(err);
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

export function setPlayer (db, {name, profileImg = null, gameId}) {
    const sql = `INSERT INTO players (name, net_profit, profile_img, game_id) VALUES (?, ?, ?, ?)`;
    const prepStatement = db.prepare(sql);
    prepStatement.run(name, 0.00, profileImg, gameId, (err) => {
        if (err) {
            console.error(err);
            return null;
        }
    });
    
    return 1;
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

// getters
export function getUser (db, userId) {
    const sql = `SELECT * FROM users WHERE user_id = ?`;
    const prepStatement = db.prepare(sql);
    prepStatement.get(userId, (err, table) => {
        if (err) {
            console.error(err);
        }
        console.log(table);
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

