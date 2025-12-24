const serverless = require('serverless-http');
const app = require('../app');
const db = require('../lib/db');

// Ensure the database connection is established before the first request
let handler;
module.exports = async function (req, res) {
	try {
		await db.connect();
	} catch (err) {
		console.error('DB connect error in serverless entry:', err && err.message);
		// proceed anyway; routes will fallback if needed
	}
	if (!handler) handler = serverless(app);
	return handler(req, res);
};
