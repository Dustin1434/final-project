// Fetch and display presents/notes
async function fetchPresents() {
	const res = await fetch('/api/presents');
	const presents = await res.json();
	renderPresents(presents);
}

function renderPresents(presents) {
	const container = document.getElementById('presents-container');
	container.innerHTML = '';
	container.style.position = 'relative';
	presents.forEach((present, idx) => {
		const div = document.createElement('div');
		div.style.position = 'absolute';
		// div.style.left = (present.x || 100) + 'px';
		// div.style.top = (present.y || 100) + 'px';
	
		const presentHeight = 150; // fixed height of present display
		const presentWidth = 150;

		div.style.left = Math.random() * (container.clientWidth - presentWidth) + 'px';
		div.style.top = Math.random() * (container.clientHeight - presentHeight) + 'px';

		div.setAttribute('data-idx', idx);
		let inner = '';
		// Only envelope/note is supported now
		inner += `
			<div style="position: relative; width: ${presentWidth}px; height: ${presentHeight}px;">
				<img src="/images/present${(idx+1)%3}.png" alt="Present" style="width: 100%; height: 100%; display: block;" />
				<div style="position: absolute; top: 35px; left: 25px; width: 100px; height: 80px; display: flex; align-items: center; justify-content: center; text-align: center; color: #333; font-size: 16px; overflow-wrap: break-word; word-break: break-word; pointer-events: none;">
					
				</div>
			</div>
		`;
		div.innerHTML = inner;

		// Make the present image non-draggable and guard against default drag behavior
		const img = div.querySelector('img');
		if (img) {
			img.draggable = false;
			img.ondragstart = () => false;
			// Extra inline style fallback for browsers that honor these CSS properties
			img.style.webkitUserDrag = 'none';
			img.style.userSelect = 'none';
		}
		div.addEventListener('click', function() {
			alert(present.note);
		});
		container.appendChild(div);
	});
}
// Notes are intentionally non-draggable; positions are fixed by the layout logic.

async function updateNotePosition(idx, x, y) {
	// Send PATCH to backend to update position
	await fetch('/api/presents/position', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ idx, x, y })
	});
}

// Add present/note event
document.addEventListener('DOMContentLoaded', () => {
	fetchPresents();
	// Removed 'Leave Present' button logic
	document.getElementById('add-note-btn').addEventListener('click', async () => {
		const noteInput = document.getElementById('note-input');
		const note = noteInput.value.trim();
		if (!note) {
			alert('Please enter a note.');
			return;
		}
			// Compute a non-overlapping fixed position for the new note
			const container = document.getElementById('presents-container');
			const presentsRes = await fetch('/api/presents');
			const existing = await presentsRes.json();
			const { x, y } = computeFreePosition(container, existing);
			const addBtn = document.getElementById('add-note-btn');
			addBtn.disabled = true;
			let postJson = {};
			try {
				const postRes = await fetch('/api/presents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ note, type: 'note', x, y })
				});
				try { postJson = await postRes.json(); } catch (e) { console.warn('Could not parse POST response JSON', e); }
				if (postJson && postJson.fallback) {
					alert('Note saved to a temporary fallback (not persisted). Please check deployment logs or retry later.');
				}
			} finally {
				addBtn.disabled = false;
				noteInput.value = '';
			}
			// Check runtime debug info (will show mongooseState if accessible)
			try {
				const dbg = await fetch('/api/debug');
				if (dbg.ok) {
					const js = await dbg.json();
					console.log('Runtime debug:', js);
				} else {
					console.log('Runtime debug request returned', dbg.status);
				}
			} catch (e) {
				console.warn('Could not reach /api/debug:', e && e.message);
			}
			fetchPresents();
	});
});

// Compute a free grid-based position inside the container that doesn't overlap existing presents
function computeFreePosition(container, existing) {
	const padding = 20; // margin around each present
	const presentW = 150; // present display size (matches render)
	const presentH = 150;
	const cellW = presentW + padding;
	const cellH = presentH + padding;
	const width = Math.max(container.clientWidth, window.innerWidth);
	const height = Math.max(container.clientHeight, window.innerHeight);
	const cols = Math.max(1, Math.floor(width / cellW));
	const rows = Math.max(1, Math.floor(height / cellH));

	// Helper to check overlap
	function overlaps(x1, y1) {
		for (let p of existing) {
			const px = (p.x || 0);
			const py = (p.y || 0);
			if (Math.abs(px - x1) < presentW && Math.abs(py - y1) < presentH) return true;
		}
		return false;
	}

	// Try grid positions first
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = Math.floor((c * cellW) + padding/2);
			const y = Math.floor((r * cellH) + padding/2);
			if (!overlaps(x, y)) return { x, y };
		}
	}

	// Fallback: random positions until one fits (avoids infinite loops)
	for (let i = 0; i < 50; i++) {
		const x = Math.floor(Math.random() * Math.max(50, width - presentW));
		const y = Math.floor(Math.random() * Math.max(50, height - presentH));
		if (!overlaps(x, y)) return { x, y };
	}

	// Last resort, return 100,100
	return { x: 100, y: 100 };
}