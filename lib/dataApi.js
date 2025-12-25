// Lightweight wrapper for MongoDB Atlas Data API (https://www.mongodb.com/docs/atlas/api/data-api/)
const ATLAS_API_URL = process.env.ATLAS_DATA_API_URL; // e.g. https://data.mongodb-api.com/app/<APP_ID>/endpoint/data/v1
const ATLAS_API_KEY = process.env.ATLAS_DATA_API_KEY;
const DATA_SOURCE = process.env.ATLAS_DATA_SOURCE || 'Cluster0';
const DB_NAME = process.env.ATLAS_DB || 'finalproject';
const COLLECTION = process.env.ATLAS_COLLECTION || 'notes';

async function send(action, body) {
  if (!ATLAS_API_URL || !ATLAS_API_KEY) throw new Error('Atlas Data API not configured');
  const url = `${ATLAS_API_URL}/action/${action}`;
  const payload = Object.assign({ dataSource: DATA_SOURCE, database: DB_NAME, collection: COLLECTION }, body || {});
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': ATLAS_API_KEY
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlas Data API ${action} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function normalizeId(doc) {
  if (!doc) return doc;
  if (doc._id) {
    // _id may come back as { $oid: '...' } or as a string
    if (typeof doc._id === 'object' && doc._id.$oid) {
      doc._id = doc._id.$oid;
    }
  }
  return doc;
}

module.exports = {
  async findAll() {
    const js = await send('find', { filter: {} });
    // Data API returns documents in `documents` array
    const docs = Array.isArray(js.documents) ? js.documents.map(normalizeId) : [];
    return docs;
  },
  async find(filter) {
    const js = await send('find', { filter: filter || {} });
    const docs = Array.isArray(js.documents) ? js.documents.map(normalizeId) : [];
    return docs;
  },
  async insertOne(doc) {
    const js = await send('insertOne', { document: doc });
    // insertedId may be { $oid: '...' }
    const idObj = js.insertedId;
    const id = (idObj && idObj.$oid) ? idObj.$oid : idObj;
    return id;
  },
  async updateOne(filter, update) {
    // `update` should be the update document (e.g. { $set: { x: 10 } })
    const js = await send('updateOne', { filter, update });
    return js; // contains matchedCount/modifiedCount
  }
};
