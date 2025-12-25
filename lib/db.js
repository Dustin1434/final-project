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
    // Tuned options for serverless: larger selection timeout and limited pool size.
    const opts = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // increased from 5000 to tolerate DNS/latency
      socketTimeoutMS: 45000,
      // useUnifiedTopology and useNewUrlParser are defaults in mongoose 6+
    };

    // Add a small retry/backoff to reduce transient failures on cold starts or DNS flakiness.
    const maxAttempts = 3;
    const attemptConnect = async (attempt) => {
      try {
        const mongooseInstance = await mongoose.connect(mongoUri, opts);
        cached.conn = mongooseInstance;
        try {
          const ready = mongoose.connection && mongoose.connection.readyState;
          console.log(new Date().toISOString(), 'MongoDB: connected, readyState=', ready);
        } catch (e) {
          console.log(new Date().toISOString(), 'MongoDB: connected (ready state unknown)');
        }
        return cached.conn;
      } catch (err) {
        console.error(new Date().toISOString(), `MongoDB: connection attempt ${attempt} failed:`, err && err.message);
        if (attempt < maxAttempts) {
          const delay = 250 * Math.pow(2, attempt - 1); // 250ms, 500ms, ...
          console.log(new Date().toISOString(), `MongoDB: retrying in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          return attemptConnect(attempt + 1);
        }
        // After exhausting attempts, clear cached.promise so future calls can retry
        cached.promise = null;
        console.error(new Date().toISOString(), 'MongoDB: connection error (all attempts failed):', err && err.message);
        throw err;
      }
    };

    cached.promise = attemptConnect(1);
  }
  return cached.promise;
}

module.exports = { connect };
