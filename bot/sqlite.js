const sqlite3 = require("better-sqlite3");
const path = require("path");
class FranzDB {
	constructor(dbPath = "franz.db") {
		this.db = new sqlite3(dbPath);

		// Initialize tables
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS txt(
				uid TEXT,
				row INTEGER,
				code TEXT
			);

			CREATE TABLE IF NOT EXISTS clipboard(
				uid TEXT,
				row INTEGER,
				code TEXT
			);
		`);
	}
				//PRIMARY KEY(uid, row)
				//PRIMARY KEY(uid, row)
	// --- Helper to run transactions ---
	transaction(fn) {
		this.db.prepare('BEGIN').run();
		try {
			fn();
			this.db.prepare('COMMIT').run();
		} catch (err) {
			this.db.prepare('ROLLBACK').run();
			throw err;
		}
	}

	// .cut x y: Cut lines from x to y and move to clipboard
	cut(uid, start, end) {
		this.transaction(() => {
			const count = end - start + 1;
			// 1. Clear existing clipboard for this user
			this.db.prepare(`DELETE FROM clipboard WHERE uid = ?`)
				.run(uid);

			this.db.prepare(`
				INSERT INTO clipboard (uid, row, code)
				SELECT uid, row - ? + 1, code FROM txt 
				WHERE uid = ? AND row BETWEEN ? AND ?
			`).run(start, uid, start, end);

			// 3. Delete from main table
			this.db.prepare(`DELETE FROM txt WHERE uid = ? `
				+ `AND row BETWEEN ? AND ?`
			)
				.run(uid, start, end);

			// 4. Shift remaining rows up
			this.db.prepare(`
				UPDATE txt SET row = row - ? 
				WHERE uid = ? AND row > ?
			`).run(count, uid, end);
		});
	}

	// .paste x: Insert clipboard at line x, moving code down
	paste(uid, x) {
		this.transaction(() => {
			const clipboardItems = this.db.prepare(
				`SELECT COUNT(*) as count FROM  `
				+ `clipboard WHERE uid = ?`)
				.get(uid)
			;
			const count = clipboardItems.count;
			if (count === 0)
				return
			;

			// 1. Shift existing code down to make room
			this.db.prepare(`
				UPDATE txt SET row = row + ? 
				WHERE uid = ? AND row >= ?
			`).run(count, uid, x);

			// 2. Insert from clipboard
			this.db.prepare(`
				INSERT INTO txt (uid, row, code)
				SELECT uid, row + ? - 1, code FROM 
				clipboard WHERE uid = ?
			`).run(x, uid);
		});
	}

	// .insert x: Shift code below x down, insert code at x
	insert(uid, x, code) {
		this.transaction(() => {
			this.db.prepare(`UPDATE txt SET row = row + 1 WHERE `
				+ `uid = ? AND row >= ?`)
				.run(uid, x)
			;
			this.db.prepare(`INSERT INTO txt (uid, row, code) `
				+ `VALUES (?, ?, ?)`)
				.run(uid, x, code)
			;
		});
	}

	// .delete x: Delete code at x and move code below up
	delete(uid, x) {
		this.transaction(() => {
			this.db.prepare(`DELETE FROM txt WHERE `
				+ `uid = ? AND row = ?`)
				.run(uid, x)
			;
			this.db.prepare(`UPDATE txt SET row = row - 1`
				+ ` WHERE uid = ? AND row > ?`)
				.run(uid, x)
			;
		});
	}

	// .get x: Get 50 lines of code starting at x
	get(uid, x) {
		return this.db.prepare(`
			SELECT row, code FROM txt 
			WHERE uid = ? AND row >= ? 
			ORDER BY row ASC LIMIT 50
		`).all(uid, x);
	}

	// .set x: Overwrites lines starting from x
	// 'lines' should be an array of strings
	set(uid, x, lines) {
		this.transaction(() => {
			const dstmt = this.db.prepare(`
				DELETE FROM txt WHERE uid = ? AND row = ?
			`);

			const stmt = this.db.prepare(`
				INSERT INTO txt (uid, row, code) VALUES (?, ?, ?)
			`);
			lines.forEach((line, index) => {
				dstmt.run(uid, x + index);
				stmt.run(uid, x + index, line);
			});
		});
	}

	// .compile: Gather every code from every user into a single string
	compile(uid) {
		const rows = this.db.prepare(`
			SELECT code FROM txt WHERE uid = ? ORDER BY uid, row ASC
		`).all(uid);
		return rows.map(r => r.code).join('\n');
	}
}

module.exports = FranzDB;
