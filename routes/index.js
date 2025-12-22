var express = require('express');
var router = express.Router();

// In-memory storage for presents/notes
const presents = [];


// GET home page
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Public Archive' });
});

// API: Get all presents/notes
router.get('/api/presents', function(req, res) {
  res.json(presents);
});

// API: Add a present or note
router.post('/api/presents', express.json(), function(req, res) {
  const note = req.body.note?.toString().slice(0, 100) || '';
  const type = req.body.type === 'present' ? 'present' : 'note';
  let x = typeof req.body.x === 'number' ? req.body.x : Math.floor(Math.random() * 400) + 50;
  let y = typeof req.body.y === 'number' ? req.body.y : Math.floor(Math.random() * 300) + 50;
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }
  presents.push({ note, type, x, y });
  res.status(201).json({ success: true });
});

// PATCH: Update note position
router.patch('/api/presents/position', express.json(), function(req, res) {
  const { idx, x, y } = req.body; 
  if (
    typeof idx !== 'number' ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !presents[idx]
  ) {
    return res.status(400).json({ error: 'Invalid index or coordinates' });
  }
  presents[idx].x = x;
  presents[idx].y = y;
  res.json({ success: true });
});

module.exports = router;
