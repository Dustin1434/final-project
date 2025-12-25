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
    console.log(new Date().toISOString(), 'MongoDB: initiating connection to', mongoUri.replace(/:[^:@]+@/, ':****@'));
    const opts = {
      // keepAlive options to avoid premature socket close in serverless
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      cached.conn = mongooseInstance;
      try {
        const ready = mongoose.connection && mongoose.connection.readyState;
        console.log(new Date().toISOString(), 'MongoDB: connected, readyState=', ready);
      } catch (e) {
        console.log(new Date().toISOString(), 'MongoDB: connected (ready state unknown)');
      }
      return cached.conn;
    }).catch((err) => {
      cached.promise = null;
      console.error(new Date().toISOString(), 'MongoDB: connection error:', err && err.message);
      throw err;
    });
  }
  return cached.promise;
}

module.exports = { connect };
