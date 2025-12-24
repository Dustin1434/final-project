const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/finalproject';

// Use a global cached promise/connection so serverless functions reuse the connection
if (!global.__mongo) {
  global.__mongo = { conn: null, promise: null };
}

async function connect() {
  if (global.__mongo.conn) {
    return global.__mongo.conn;
  }

  if (!global.__mongo.promise) {
    global.__mongo.promise = mongoose.connect(mongoUri, {
      // useNewUrlParser, useUnifiedTopology are defaults in newer mongoose versions
    }).then((m) => m.connection);
  }

  global.__mongo.conn = await global.__mongo.promise;
  return global.__mongo.conn;
}

module.exports = { connect };
