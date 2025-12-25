const serverless = require('serverless-http');
const app = require('../app');
const db = require('../lib/db');

// Ensure the database connection is established before the first request
let handler;
module.exports = async function (req, res) {
	try {
		const conn = await db.connect();
		try {
			const mongoose = require('mongoose');
			const state = mongoose.connection ? mongoose.connection.readyState : 'unknown';
			console.log(new Date().toISOString(), 'serverless entry: DB connect ok, readyState=', state);
		} catch (e) {
			console.log(new Date().toISOString(), 'serverless entry: DB connect ok');
		}
	} catch (err) {
		console.error(new Date().toISOString(), 'DB connect error in serverless entry:', err && err.message);
		// proceed anyway; routes will fallback if needed
	}
	if (!handler) handler = serverless(app);
	return handler(req, res);
};
