// Guest book page: load the wall, submit messages, poll for new ones.
// All message text is rendered with textContent, so it can never inject markup.

(function () {
    const form = document.getElementById('gb-form');
    const nameEl = document.getElementById('gb-name');
    const msgEl = document.getElementById('gb-message');
    const hpEl = form.querySelector('input[name="website"]');
    const submitBtn = document.getElementById('gb-submit');
    const statusEl = document.getElementById('gb-status');
    const listEl = document.getElementById('gb-list');
    const wallTitle = document.getElementById('gb-wall-title');

    let token = '';

    function timeAgo(ts) {
        const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
        if (s < 45) return 'just now';
        const m = Math.floor(s / 60);
        if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
        const h = Math.floor(m / 60);
        if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
        const d = Math.floor(h / 24);
        return d + (d === 1 ? ' day ago' : ' days ago');
    }

    function renderWall(messages) {
        listEl.textContent = '';
        if (!messages.length) {
            const empty = document.createElement('p');
            empty.className = 'gb-empty';
            empty.textContent = 'Be the first to share a memory.';
            listEl.appendChild(empty);
            wallTitle.textContent = 'Memories';
            return;
        }
        wallTitle.textContent = `Memories (${messages.length})`;
        // newest first
        messages.slice().sort((a, b) => b.ts - a.ts).forEach((m) => {
            const card = document.createElement('div');
            card.className = 'gb-card';

            const body = document.createElement('p');
            body.className = 'gb-card-message';
            body.textContent = m.message;

            const meta = document.createElement('div');
            meta.className = 'gb-card-meta';
            const nm = document.createElement('span');
            nm.className = 'gb-card-name';
            nm.textContent = m.name;
            const tm = document.createElement('span');
            tm.className = 'gb-card-time';
            tm.textContent = timeAgo(m.ts);
            meta.appendChild(nm);
            meta.appendChild(tm);

            card.appendChild(body);
            card.appendChild(meta);
            listEl.appendChild(card);
        });
    }

    async function loadWall() {
        try {
            const r = await fetch('/api/guestbook', { headers: { 'Accept': 'application/json' } });
            const data = await r.json();
            if (data.token) token = data.token;
            renderWall(Array.isArray(data.messages) ? data.messages : []);
        } catch (e) {
            // network hiccup — leave the current wall as-is
        }
    }

    function setStatus(text, kind) {
        statusEl.textContent = text || '';
        statusEl.className = 'gb-status' + (kind ? ' ' + kind : '');
    }

    async function submit(e) {
        e.preventDefault();
        const name = nameEl.value.trim();
        const message = msgEl.value.trim();
        if (!name || !message) { setStatus('Please add your name and a message.', 'error'); return; }

        submitBtn.disabled = true;
        setStatus('Sending…');
        try {
            const r = await fetch('/api/guestbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, message, website: hpEl.value, token }),
            });
            const data = await r.json();
            if (!r.ok) {
                setStatus(data.error || 'Something went wrong. Please try again.', 'error');
                submitBtn.disabled = false;
                return;
            }
            setStatus('Thank you — your memory has been shared. 💛', 'success');
            msgEl.value = '';
            await loadWall();
        } catch (err) {
            setStatus('Couldn’t send — check your connection and try again.', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    }

    form.addEventListener('submit', submit);
    loadWall();
    // refresh the wall periodically so people see others' messages
    setInterval(loadWall, 20000);
})();
