const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/finalproject';

/**
 * Serverless-friendly mongoose connection cache.
 * Uses a global variable to avoid creating new connections on each invocation.
 */
let cached = global.__mongoose_cache__;
if (!cached) {
  cached = global.__mongoose_cache__ = { conn: null, promise: null };
}

async function connect() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const opts = {
      // keepAlive options to avoid premature socket close in serverless
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // use the new URL parser and unified topology by default in mongoose 6+
    };
    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      cached.conn = mongooseInstance;
      return cached.conn;
    }).catch((err) => {
      cached.promise = null;
      throw err;
    });
  }
  return cached.promise;
}

module.exports = { connect };
