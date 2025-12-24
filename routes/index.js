
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const notes = await Note.find();
      return res.json(notes);
    }
  } catch (err) {
    console.error('Mongo read failed, falling back to memory store:', err && err.message);
  }
  // Fallback to memory
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
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const newNote = new Note({ note, type, x, y });
      await newNote.save();
      return res.status(201).json({ success: true });
    }
  } catch (err) {
    console.error('Mongo write failed, falling back to memory store:', err && err.message);
  }
  // Fallback: save to in-memory array
  const mem = { _id: generateId(), note, type, x, y };
  memoryNotes.push(mem);
  res.status(201).json({ success: true, fallback: true });
});

// PATCH: Update note position by _id
router.patch('/api/presents/position', express.json(), async function(req, res) {
  const { id, x, y } = req.body;
  if (!id || typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'Invalid id or coordinates' });
  }
  try {
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
  res.json({ success: true, fallback: true });
});

module.exports = router;
