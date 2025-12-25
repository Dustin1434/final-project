
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../lib/db');
let dataApi = null;
try {
  // Optional: use Atlas Data API when configured (no IP whitelist required)
  if (process.env.ATLAS_DATA_API_URL && process.env.ATLAS_DATA_API_KEY) {
    dataApi = require('../lib/dataApi');
    console.log(new Date().toISOString(), 'Routes: Atlas Data API enabled');
  }
} catch (e) {
  console.warn(new Date().toISOString(), 'Routes: failed to load dataApi:', e && e.message);
}

// In-memory fallback store used when MongoDB is not available (useful for Vercel without env set)
const memoryNotes = [];
function generateId() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
}

const noteSchema = new mongoose.Schema({
  note: { type: String, required: true, maxlength: 100 },
  type: { type: String, default: 'note' },
  x: { type: Number, default: 100 },
  y: { type: Number, default: 100 }
}, { timestamps: true });
let Note;
try {
  // Only register the model if mongoose exists
  Note = mongoose.model && mongoose.model('Note') ? mongoose.model('Note') : mongoose.model('Note', noteSchema);
} catch (e) {
  Note = mongoose.model('Note', noteSchema);
}


// GET home page
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Public Archive' });
});


// API: Get all notes
router.get('/api/presents', async function(req, res) {
  try {
    // Prefer Data API if configured (avoids IP whitelist issues)
    if (dataApi) {
      try {
        const docs = await dataApi.findAll();
        console.log(new Date().toISOString(), 'GET /api/presents - returning', docs.length, 'records from Data API');
        return res.json(docs);
      } catch (e) {
        console.warn(new Date().toISOString(), 'GET /api/presents - Data API read failed:', e && e.message);
        // fall through to try mongoose connector
      }
    }
    // Ensure we attempt a DB connect for this invocation (helps serverless cold starts)
    try {
      await db.connect();
    } catch (e) {
      console.warn(new Date().toISOString(), 'GET /api/presents - DB connect attempt failed:', e && e.message);
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const notes = await Note.find();
      console.log(new Date().toISOString(), 'GET /api/presents - returning', notes.length, 'records from MongoDB');
      return res.json(notes);
    }
  } catch (err) {
    console.error(new Date().toISOString(),'Mongo read failed, falling back to memory store:', err && err.message);
  }
  // Fallback to memory
  console.log(new Date().toISOString(), 'GET /api/presents - returning', memoryNotes.length, 'records from memory fallback');
  res.json(memoryNotes);
});

// API: Add a note
router.post('/api/presents', express.json(), async function(req, res) {
  const note = req.body.note?.toString().slice(0, 100) || '';
  const type = req.body.type === 'present' ? 'present' : 'note';
  let x = typeof req.body.x === 'number' ? req.body.x : Math.floor(Math.random() * 400) + 50;
  let y = typeof req.body.y === 'number' ? req.body.y : Math.floor(Math.random() * 300) + 50;
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }
  // Try Data API first (if configured), then DB, else fallback
  if (dataApi) {
    try {
      // Server-side dedupe: check for an existing note with same text and coords
      try {
        // Find recent documents with same note text
        const found = await dataApi.find({ note: note });
        if (Array.isArray(found) && found.length > 0) {
          const now = Date.now();
          const windowMs = 10000; // 10 seconds
          const recent = found.filter(p => {
            const t = p.createdAt ? Date.parse(p.createdAt) : 0;
            return (now - t) <= windowMs;
          });
          if (recent.length > 0) {
            console.log(new Date().toISOString(), 'POST /api/presents - duplicate detected via Data API (time window), skipping insert');
            return res.status(200).json({ success: true, duplicate: true, dbDriver: 'dataApi', existingCount: recent.length });
          }
        }
      } catch (e) {
        console.warn(new Date().toISOString(), 'POST /api/presents - Data API dedupe check failed:', e && e.message);
      }
      const doc = { note, type, x, y, createdAt: new Date().toISOString() };
      const insertedId = await dataApi.insertOne(doc);
      console.log(new Date().toISOString(), 'POST /api/presents - saved via Data API, id=', insertedId);
      return res.status(201).json({ success: true, dbDriver: 'dataApi', insertedId });
    } catch (e) {
      console.warn(new Date().toISOString(), 'POST /api/presents - Data API write failed:', e && e.message);
      // fall through to try mongoose connector
    }
  }

  // Try DB first; if it's not connected, use in-memory fallback
  let connectError = null;
  try {
    // Ensure a DB connect is attempted for this invocation
    try {
      await db.connect();
    } catch (e) {
      connectError = e && (e.message || String(e));
      console.warn(new Date().toISOString(), 'POST /api/presents - DB connect attempt failed:', connectError);
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      // Server-side dedupe for mongoose path
      try {
        // Mongoose dedupe: check recent entries with same note text
        const recentDoc = await Note.findOne({ note: note }).sort({ createdAt: -1 }).lean();
        if (recentDoc) {
          const now = Date.now();
          const windowMs = 10000; // 10 seconds
          const t = recentDoc.createdAt ? new Date(recentDoc.createdAt).getTime() : 0;
          if ((now - t) <= windowMs) {
            console.log(new Date().toISOString(), 'POST /api/presents - duplicate detected via mongoose (time window), skipping insert, id=', recentDoc._id);
            return res.status(200).json({ success: true, duplicate: true, mongooseState: mongoose.connection.readyState, existingId: recentDoc._id });
          }
        }
      } catch (e) {
        console.warn(new Date().toISOString(), 'POST /api/presents - mongoose dedupe check failed:', e && e.message);
      }
      const newNote = new Note({ note, type, x, y });
      const saved = await newNote.save();
      console.log(new Date().toISOString(), 'POST /api/presents - saved to MongoDB, id=', saved._id);
      const state = mongoose.connection ? mongoose.connection.readyState : 'unknown';
      return res.status(201).json({ success: true, mongooseState: state, insertedId: saved._id });
    }
  } catch (err) {
    console.error(new Date().toISOString(),'Mongo write failed, falling back to memory store:', err && err.message);
    if (!connectError) connectError = err && (err.message || String(err));
  }
  // Fallback: save to in-memory array
  const mem = { _id: generateId(), note, type, x, y };
  memoryNotes.push(mem);
  console.log(new Date().toISOString(), 'POST /api/presents - saved to memory fallback');
  const state = mongoose.connection ? mongoose.connection.readyState : 0;
  const resp = { success: true, fallback: true, mongooseState: state };
  if (connectError) resp.dbError = connectError;
  res.status(201).json(resp);
});

// PATCH: Update note position by _id
router.patch('/api/presents/position', express.json(), async function(req, res) {
  const { id, x, y } = req.body;
  if (!id || typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'Invalid id or coordinates' });
  }
  try {
    // Try Data API update first
    if (dataApi) {
      try {
        // Data API expects extended JSON for filter when using ObjectId
        const filter = { _id: { $oid: id } };
        const update = { $set: { x, y } };
        await dataApi.updateOne(filter, update);
        console.log(new Date().toISOString(), 'PATCH /api/presents/position - updated via Data API, id=', id);
        return res.json({ success: true, dbDriver: 'dataApi' });
      } catch (e) {
        console.warn(new Date().toISOString(), 'PATCH /api/presents/position - Data API update failed:', e && e.message);
        // fall through to mongoose
      }
    }

    // Try to connect before updating (serverless cold start guard)
    try {
      await db.connect();
    } catch (e) {
      console.warn(new Date().toISOString(), 'PATCH /api/presents/position - DB connect attempt failed:', e && e.message);
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await Note.findByIdAndUpdate(id, { x, y });
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('Mongo update failed, falling back to memory store:', err && err.message);
  }
  // Fallback update in memory
  const idx = memoryNotes.findIndex(n => String(n._id) === String(id));
  if (idx === -1) {
    return res.status(404).json({ error: 'Not found' });
  }
  memoryNotes[idx].x = x;
  memoryNotes[idx].y = y;
  console.log(new Date().toISOString(), 'PATCH /api/presents/position - updated in memory fallback, id=', id);
  res.json({ success: true, fallback: true });
});

// Debug endpoint (useful on deployments) - shows mongoose connection state and fallback size
// GET /api/debug
router.get('/api/debug', function(req, res) {
  const state = mongoose.connection ? mongoose.connection.readyState : 0;
  console.log(new Date().toISOString(), '/api/debug - mongooseState=', state, 'memoryNotes=', memoryNotes.length);
  res.json({
    mongooseState: state, // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    memoryNotes: memoryNotes.length,
    usingFallback: (state !== 1)
  });
});

module.exports = router;
