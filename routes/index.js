
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../lib/db');

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
});
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
  // Try DB first; if it's not connected, use in-memory fallback
  try {
    // Ensure a DB connect is attempted for this invocation
    try {
      await db.connect();
    } catch (e) {
      console.warn(new Date().toISOString(), 'POST /api/presents - DB connect attempt failed:', e && e.message);
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const newNote = new Note({ note, type, x, y });
      await newNote.save();
      console.log(new Date().toISOString(), 'POST /api/presents - saved to MongoDB');
      const state = mongoose.connection ? mongoose.connection.readyState : 'unknown';
      return res.status(201).json({ success: true, mongooseState: state });
    }
  } catch (err) {
    console.error(new Date().toISOString(),'Mongo write failed, falling back to memory store:', err && err.message);
  }
  // Fallback: save to in-memory array
  const mem = { _id: generateId(), note, type, x, y };
  memoryNotes.push(mem);
  console.log(new Date().toISOString(), 'POST /api/presents - saved to memory fallback');
  const state = mongoose.connection ? mongoose.connection.readyState : 0;
  res.status(201).json({ success: true, fallback: true, mongooseState: state });
});

// PATCH: Update note position by _id
router.patch('/api/presents/position', express.json(), async function(req, res) {
  const { id, x, y } = req.body;
  if (!id || typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'Invalid id or coordinates' });
  }
  try {
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
