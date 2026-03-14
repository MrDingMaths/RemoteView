/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Multi-Page Management
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.pages = {};

SAB.pages.makeEmptyPage = function () {
    return { photos: [], strokes: [], stamps: [], texts: [],
             undoStack: [], redoStack: [], zoomedPhotoId: null };
};

SAB.pages.initPages = function () {
    SAB.state.pages = [SAB.pages.makeEmptyPage()];
    SAB.state.activePage = 0;
    SAB.pages.buildPagePills();
};

SAB.pages.saveActivePage = function () {
    var state = SAB.state;
    var pg = state.pages[state.activePage];
    if (!pg) return;
    /* Shallow-copy each array so the page slot and state.xxx are independent
       references. The contained objects (strokes, photos, etc.) are shared
       but are never mutated in-place, so this is safe. */
    pg.photos    = state.photos.slice();
    pg.strokes   = state.strokes.slice();
    pg.stamps    = state.stamps.slice();
    pg.texts     = state.texts.slice();
    pg.undoStack = state.undoStack.slice();
    pg.redoStack = state.redoStack.slice();
    pg.zoomedPhotoId = state.zoomedPhotoId;
};

SAB.pages.loadPage = function (idx) {
    var state = SAB.state;
    var H = SAB.config.H;
    var pg = state.pages[idx];
    if (!pg) return;
    state.activePage = idx;

    /* Clean up text drag listeners from the page being left */
    state.texts.forEach(function (t) { if (t.cleanup) t.cleanup(); });

    state.photos    = pg.photos.slice();
    state.strokes   = pg.strokes.slice();
    state.stamps    = pg.stamps.slice();
    state.texts     = pg.texts.slice();
    state.undoStack = pg.undoStack.slice();
    state.redoStack = pg.redoStack.slice();
    state.zoomedPhotoId = null;

    SAB.els.photoLayer.innerHTML = '';
    SAB.els.stampLayer.innerHTML = '';
    SAB.els.textLayer.innerHTML = '';
    SAB.els.canvasArea.classList.remove(H + '_zoom_active');
    SAB.photos.layoutPhotos();
    SAB.drawing.redrawStrokes();
    SAB.annotations.redrawStamps();
    SAB.pages.rebuildTextElements();
    SAB.photos.updatePhotoCount();
    SAB.photos.updateHideAllBtn();

    if (state.photos.length === 0 && state.strokes.length === 0 &&
        state.stamps.length === 0 && state.texts.length === 0 &&
        !state.localDisplay && !state.connected) {
        SAB.toolbar.showWelcome();
    } else {
        SAB.toolbar.hideWelcome();
    }
};

SAB.pages.switchPage = function (idx) {
    var state = SAB.state;
    if (idx === state.activePage) return;
    if (idx < 0 || idx >= state.pages.length) return;
    SAB.pages.saveActivePage();
    SAB.pages.loadPage(idx);
    SAB.pages.buildPagePills();
    SAB.pages.broadcastPageState();
};

SAB.pages.addPage = function () {
    var state = SAB.state;
    if (state.pages.length >= SAB.config.MAX_PAGES) return;
    SAB.pages.saveActivePage();
    state.pages.push(SAB.pages.makeEmptyPage());
    SAB.pages.loadPage(state.pages.length - 1);
    SAB.pages.buildPagePills();
    SAB.pages.broadcastPageState();
};

SAB.pages.buildPagePills = function () {
    var state = SAB.state;
    var H = SAB.config.H;
    var wrap = SAB.els.pagePills;
    if (!wrap) return;
    wrap.innerHTML = '';
    for (var i = 0; i < state.pages.length; i++) {
        var pill = document.createElement('button');
        pill.className = H + '_page_pill' + (i === state.activePage ? ' ' + H + '_page_active' : '');
        pill.textContent = i + 1;
        pill.setAttribute('title', 'Page ' + (i + 1) + ' (PgUp/PgDn)');
        pill.setAttribute('aria-label', 'Go to page ' + (i + 1));
        pill.setAttribute('aria-pressed', i === state.activePage ? 'true' : 'false');
        (function (idx) {
            pill.addEventListener('click', function () { SAB.pages.switchPage(idx); });
        })(i);
        wrap.appendChild(pill);
    }
    if (state.pages.length < SAB.config.MAX_PAGES) {
        var addBtn = document.createElement('button');
        addBtn.className = H + '_page_pill ' + H + '_page_pill_add';
        addBtn.textContent = '+';
        addBtn.setAttribute('title', 'Add new page');
        addBtn.setAttribute('aria-label', 'Add new page');
        addBtn.addEventListener('click', function () { SAB.pages.addPage(); });
        wrap.appendChild(addBtn);
    }
};

SAB.pages.broadcastPageState = function () {
    var state = SAB.state;
    var msg = { type: 'page_sync', activePage: state.activePage, totalPages: state.pages.length };
    for (var i = 0; i < state.connections.length; i++) {
        try { state.connections[i].send(msg); } catch (e) { console.warn('broadcastPageState send failed:', e); }
    }
};

SAB.pages.rebuildTextElements = function () {
    SAB.els.textLayer.innerHTML = '';
    SAB.state.texts.forEach(function (t) {
        SAB.annotations.buildTextEl(t, false);
    });
};
