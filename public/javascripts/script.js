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
		div.style.left = (present.x || 100) + 'px';
		div.style.top = (present.y || 100) + 'px';
		div.style.cursor = 'grab';
		div.setAttribute('data-idx', idx);
		let inner = '';
		// Only envelope/note is supported now
		inner += `
			<div style="position: relative; width: 150px; height: 150px;">
				<img src="/images/envelope.png" alt="Envelope" style="width: 100%; height: 100%; display: block;" />
				<div style="position: absolute; top: 35px; left: 25px; width: 100px; height: 80px; display: flex; align-items: center; justify-content: center; text-align: center; color: #333; font-size: 16px; overflow-wrap: break-word; word-break: break-word; pointer-events: none;">
					${present.note}
				</div>
			</div>
		`;
		div.innerHTML = inner;
		makeDraggable(div, idx, present);
		container.appendChild(div);
	});
}

function makeDraggable(element, idx, present) {
	let offsetX, offsetY, startX, startY;
	let dragging = false;

	element.addEventListener('pointerdown', function(e) {
		dragging = true;
		startX = e.clientX;
		startY = e.clientY;
		offsetX = element.offsetLeft;
		offsetY = element.offsetTop;
		element.setPointerCapture(e.pointerId);
		element.style.zIndex = 1000;
		document.body.style.userSelect = 'none';
	});

	element.addEventListener('pointermove', function(e) {
		if (!dragging) return;
		let dx = e.clientX - startX;
		let dy = e.clientY - startY;
		element.style.left = (offsetX + dx) + 'px';
		element.style.top = (offsetY + dy) + 'px';
	});

	element.addEventListener('pointerup', async function(e) {
		if (!dragging) return;
		dragging = false;
		element.releasePointerCapture(e.pointerId);
		document.body.style.userSelect = '';
		// Save new position to backend
		const newX = element.offsetLeft;
		const newY = element.offsetTop;
		await updateNotePosition(idx, newX, newY);
		element.style.zIndex = '';
	});
}

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
		await fetch('/api/presents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ note, type: 'note' })
		});
		noteInput.value = '';
		fetchPresents();
	});
});