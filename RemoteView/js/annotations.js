/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Stamps & Text Annotations
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.annotations = {};

/* ─── Stamps ─── */
SAB.annotations.placeStamp = function (ch, x, y) {
    var state = SAB.state;
    var stamp = { ch: ch, x: x, y: y, color: SAB.config.STAMP_COLORS[ch] || '#2c3e50' };
    state.stamps.push(stamp);
    state.undoStack.push({ type: 'stamp' });
    SAB.drawing._capUndo();
    state.redoStack.length = 0;
    SAB.annotations.renderStamp(stamp, true);
};

SAB.annotations.renderStamp = function (stamp, isNew) {
    var H = SAB.config.H;
    var el = document.createElement('span');
    el.className = H + '_stamp_item' + (isNew ? ' ' + H + '_stamp_new' : '');
    el.textContent = stamp.ch;
    el.style.left = (stamp.x * 100) + '%';
    el.style.top = (stamp.y * 100) + '%';
    el.style.color = stamp.color || SAB.config.STAMP_COLORS[stamp.ch] || '#2c3e50';
    SAB.els.stampLayer.appendChild(el);
    if (isNew) setTimeout(function () { el.classList.remove(H + '_stamp_new'); }, 250);
};

SAB.annotations.redrawStamps = function () {
    SAB.els.stampLayer.innerHTML = '';
    SAB.state.stamps.forEach(function (s) { SAB.annotations.renderStamp(s, false); });
};

/* ─── Text Labels ─── */
SAB.annotations.placeText = function (x, y) {
    var state = SAB.state;
    var id = 'txt_' + Date.now();
    var textObj = { id: id, x: x, y: y, text: '', color: state.penColor };
    state.texts.push(textObj);
    state.undoStack.push({ type: 'text', id: id });
    SAB.drawing._capUndo();
    state.redoStack.length = 0;
    SAB.annotations.buildTextEl(textObj, true);
};

/**
 * Build a text label DOM element. Used for both new and restored text labels.
 * Attaches a cleanup() function to textObj that removes document-level pointer
 * listeners — call it before discarding the text object (page switch, clear).
 */
SAB.annotations.buildTextEl = function (textObj, autoFocus) {
    var H = SAB.config.H;
    var id = textObj.id;
    var canvasArea = SAB.els.canvasArea;
    var textLayer = SAB.els.textLayer;

    var wrap = document.createElement('div');
    wrap.className = H + '_text_wrap';
    wrap.setAttribute('data-id', id);
    wrap.style.left = (textObj.x * 100) + '%';
    wrap.style.top = (textObj.y * 100) + '%';

    var input = document.createElement('span');
    input.className = H + '_text_item';
    input.contentEditable = 'true';
    input.style.color = textObj.color || SAB.state.penColor;
    if (textObj.size) input.style.fontSize = textObj.size + 'px';
    input.setAttribute('data-id', id);
    if (textObj.text) input.textContent = textObj.text;

    var del = document.createElement('button');
    del.className = H + '_text_del';
    del.textContent = '\u2715';
    del.setAttribute('aria-label', 'Delete text label');
    del.addEventListener('click', function (e) {
        e.stopPropagation();
        SAB.state.texts = SAB.state.texts.filter(function (t) { return t.id !== id; });
        if (textObj.cleanup) textObj.cleanup();
        wrap.parentNode.removeChild(wrap);
    });

    /* Drag to move — store handlers so they can be removed on cleanup */
    var dragOff = { x: 0, y: 0 };
    var isDragging = false;

    input.addEventListener('pointerdown', function (e) {
        if (document.activeElement === input) return;
        isDragging = true;
        dragOff.x = e.clientX - wrap.offsetLeft;
        dragOff.y = e.clientY - wrap.offsetTop;
        e.preventDefault();
    });

    function onPointerMove(e) {
        if (!isDragging) return;
        var newLeft = e.clientX - dragOff.x;
        var newTop  = e.clientY - dragOff.y;
        var areaW = canvasArea.clientWidth;
        var areaH = canvasArea.clientHeight;
        var nx = areaW ? newLeft / areaW : 0;
        var ny = areaH ? newTop  / areaH : 0;
        wrap.style.left = (nx * 100) + '%';
        wrap.style.top  = (ny * 100) + '%';
        var t = SAB.state.texts.find(function (t) { return t.id === id; });
        if (t) { t.x = nx; t.y = ny; }
    }

    function onPointerUp() { isDragging = false; }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    /* Expose cleanup so callers can remove these document-level listeners */
    textObj.cleanup = function () {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    };

    input.addEventListener('input', function () {
        var t = SAB.state.texts.find(function (t) { return t.id === id; });
        if (t) t.text = input.textContent;
    });

    wrap.appendChild(input);
    wrap.appendChild(del);
    textLayer.appendChild(wrap);

    textObj.el = input;
    textObj.wrap = wrap;

    if (autoFocus) setTimeout(function () { input.focus(); }, 50);
};

/* ─── Undo / Redo ─── */
SAB.annotations.handleUndo = function () {
    var state = SAB.state;
    if (state.undoStack.length === 0) return;
    var action = state.undoStack.pop();

    if (action.type === 'stroke') {
        var stroke = state.strokes.pop();
        state.redoStack.push({ type: 'stroke', data: stroke });
        SAB.drawing.redrawStrokes();

    } else if (action.type === 'erase') {
        /* Re-insert the erased stroke at the end of the draw order */
        state.strokes.push(action.data);
        state.redoStack.push({ type: 'erase', data: action.data });
        SAB.drawing.redrawStrokes();

    } else if (action.type === 'stamp') {
        var stamp = state.stamps.pop();
        state.redoStack.push({ type: 'stamp', data: stamp });
        SAB.annotations.redrawStamps();

    } else if (action.type === 'text') {
        var textObj = null;
        state.texts = state.texts.filter(function (t) {
            if (t.id === action.id) { textObj = t; return false; }
            return true;
        });
        if (textObj && textObj.cleanup) textObj.cleanup();
        state.redoStack.push({ type: 'text', data: textObj });
        var el = SAB.els.textLayer.querySelector('[data-id="' + action.id + '"]');
        if (el && el.parentElement) el.parentElement.remove();
    }
};

SAB.annotations.handleRedo = function () {
    var state = SAB.state;
    if (state.redoStack.length === 0) return;
    var action = state.redoStack.pop();

    if (action.type === 'stroke' && action.data) {
        state.strokes.push(action.data);
        state.undoStack.push({ type: 'stroke' });
        SAB.drawing._capUndo();
        SAB.drawing.redrawStrokes();

    } else if (action.type === 'erase' && action.data) {
        /* Find the stroke by object reference and remove it */
        var idx = state.strokes.indexOf(action.data);
        if (idx >= 0) state.strokes.splice(idx, 1);
        state.undoStack.push({ type: 'erase', data: action.data });
        SAB.drawing._capUndo();
        SAB.drawing.redrawStrokes();

    } else if (action.type === 'stamp' && action.data) {
        state.stamps.push(action.data);
        state.undoStack.push({ type: 'stamp' });
        SAB.drawing._capUndo();
        SAB.annotations.renderStamp(action.data, false);

    } else if (action.type === 'text' && action.data) {
        state.texts.push(action.data);
        state.undoStack.push({ type: 'text', id: action.data.id });
        SAB.drawing._capUndo();
        SAB.annotations.buildTextEl(action.data, false);
    }
};
