/* ═══════════════════════════════════════════════════════════════════════
   SHOW ALL BOARD — Toolbar & Keyboard Shortcuts
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.toolbar = {};

/* ─── Fullscreen ─── */
SAB.toolbar.toggleFullscreen = function () {
    SAB.els.app.classList.add(SAB.cls('fs'));
    document.body.style.overflow = 'hidden';
    setTimeout(function () { SAB.drawing.resizeCanvas(); SAB.photos.layoutPhotos(); }, 50);
};

SAB.toolbar.exitFullscreen = function () {
    SAB.els.app.classList.remove(SAB.cls('fs'));
    document.body.style.overflow = '';
    setTimeout(function () { SAB.drawing.resizeCanvas(); SAB.photos.layoutPhotos(); }, 50);
};

/* ─── Welcome Overlay ─── */
SAB.toolbar.hideWelcome = function () {
    if (SAB.els.welcome) { SAB.els.welcome.style.display = 'none'; SAB.state.welcomeVisible = false; }
};

SAB.toolbar.showWelcome = function () {
    if (SAB.els.welcome) { SAB.els.welcome.style.display = ''; SAB.state.welcomeVisible = true; }
};

/* ─── Lock / Freeze ─── */
SAB.toolbar.toggleLock = function () {
    if (SAB.state.locked) SAB.toolbar.unlockBoard();
    else SAB.toolbar.lockBoard();
};

SAB.toolbar.lockBoard = function () {
    SAB.state.locked = true;
    SAB.els.app.classList.add(SAB.cls('locked'));
    SAB.els.lockBtn.classList.add(SAB.cls('lock_active'));
};

SAB.toolbar.unlockBoard = function () {
    SAB.state.locked = false;
    SAB.els.app.classList.remove(SAB.cls('locked'));
    SAB.els.lockBtn.classList.remove(SAB.cls('lock_active'));
};

SAB.toolbar.bindLock = function () {
    if (!SAB.els.lockBtn) return;
    SAB.els.lockBtn.addEventListener('click', function () { SAB.toolbar.toggleLock(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'l' || e.key === 'L') {
            if (SAB.utils.isTypingTarget(e)) return;
            e.preventDefault();
            SAB.toolbar.toggleLock();
        }
    });
};

/* ─── More / Stamp Toggle Panels ─── */
SAB.toolbar.closeStampPanel = function () {
    var btn = SAB.$('stampToggle');
    var panel = SAB.$('stampPanel');
    if (!btn || !panel) return;
    panel.classList.remove(SAB.cls('stamp_visible'));
    btn.classList.remove(SAB.cls('stamp_open'));
};

SAB.toolbar.closeMorePanel = function () {
    var btn = SAB.$('moreToggle');
    var panel = SAB.$('morePanel');
    if (!btn || !panel) return;
    panel.classList.remove(SAB.cls('more_visible'));
    btn.classList.remove(SAB.cls('more_open'));
};

SAB.toolbar.bindMoreToggle = function () {
    var btn = SAB.$('moreToggle');
    var panel = SAB.$('morePanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
        SAB.toolbar.closeStampPanel();
        var open = panel.classList.toggle(SAB.cls('more_visible'));
        btn.classList.toggle(SAB.cls('more_open'), open);
    });
};

SAB.toolbar.bindStampToggle = function () {
    var H = SAB.config.H;
    var btn = SAB.$('stampToggle');
    var panel = SAB.$('stampPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
        SAB.toolbar.closeMorePanel();
        var open = panel.classList.toggle(H + '_stamp_visible');
        btn.classList.toggle(H + '_stamp_open', open);
    });
    var stampBtns = panel.querySelectorAll('[data-tool="stamp"]');
    for (var i = 0; i < stampBtns.length; i++) {
        stampBtns[i].addEventListener('click', function () {
            btn.classList.add(H + '_stamp_open');
        });
    }
};

/* ─── Tool Activation ─── */
SAB.toolbar.activatePenByIndex = function (idx) {
    var H = SAB.config.H;
    var cfg = SAB.config;
    if (idx < 0 || idx >= cfg.PEN_COLORS.length) return;
    var color = cfg.PEN_COLORS[idx];
    var toolBtns = SAB.els.app.querySelectorAll('[data-tool]');
    for (var j = 0; j < toolBtns.length; j++) toolBtns[j].classList.remove(H + '_tool_active');
    var penBtn = SAB.els.app.querySelector('[data-tool="pen"][data-color="' + color + '"]');
    if (penBtn) penBtn.classList.add(H + '_tool_active');
    SAB.state.tool = 'pen';
    SAB.state.penColor = color;
    if (SAB.els.drawCanvas) SAB.els.drawCanvas.style.cursor = 'crosshair';
    if (SAB.state.spotlight) SAB.drawing.spotlightOff();
    SAB.toolbar.closeStampPanel();
};

SAB.toolbar.activateTool = function (toolName) {
    var H = SAB.config.H;
    var app = SAB.els.app;
    var toolBtns = app.querySelectorAll('[data-tool]');
    var targetBtn = app.querySelector('[data-tool="' + toolName + '"]');
    if (!targetBtn) return;

    if (targetBtn.classList.contains(H + '_tool_active') && toolName !== 'pen') {
        for (var j = 0; j < toolBtns.length; j++) toolBtns[j].classList.remove(H + '_tool_active');
        var penRestore = app.querySelector('[data-tool="pen"][data-color="' + SAB.state.penColor + '"]');
        if (penRestore) penRestore.classList.add(H + '_tool_active');
        SAB.state.tool = 'pen';
        if (SAB.els.drawCanvas) { SAB.els.drawCanvas.style.cursor = 'crosshair'; SAB.els.drawCanvas.style.pointerEvents = ''; }
        if (SAB.state.spotlight) SAB.drawing.spotlightOff();
        SAB.toolbar.closeStampPanel();
        return;
    }

    for (var j = 0; j < toolBtns.length; j++) toolBtns[j].classList.remove(H + '_tool_active');
    targetBtn.classList.add(H + '_tool_active');
    SAB.state.tool = toolName;
    if (SAB.state.spotlight) SAB.drawing.spotlightOff();
    if (toolName !== 'stamp') SAB.toolbar.closeStampPanel();
    if (SAB.els.drawCanvas) {
        SAB.els.drawCanvas.style.cursor = (toolName === 'eraser') ? 'cell' : (toolName === 'text' || toolName === 'stamp') ? 'pointer' : 'crosshair';
        SAB.els.drawCanvas.style.pointerEvents = '';
    }
};

/* ─── Clear All ─── */
SAB.toolbar.doClearAll = function () {
    var state = SAB.state;
    state.photos = [];
    state.strokes = [];
    state.stamps = [];
    state.texts = [];
    state.undoStack = [];
    state.redoStack = [];
    SAB.els.photoLayer.innerHTML = '';
    SAB.els.stampLayer.innerHTML = '';
    SAB.els.textLayer.innerHTML = '';
    SAB.drawing.redrawStrokes();
    SAB.photos.updatePhotoCount();
    if (!state.localDisplay && !state.connected) SAB.toolbar.showWelcome();
};

/* ─── Shortcut Help ─── */
SAB.toolbar.showShortcutHelp = function () {
    var H = SAB.config.H;
    var app = SAB.els.app;
    var existing = app.querySelector('.' + H + '_shortcut_help');
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.className = H + '_shortcut_help';
    overlay.innerHTML =
        '<div class="' + H + '_shortcut_card">' +
        '<h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#2d3748">\u2328 Keyboard Shortcuts</h3>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.6">' +
        '<tr><td style="padding:2px 12px 2px 0"><kbd>1</kbd> \u2013 <kbd>8</kbd></td><td>Zoom photo by number</td></tr>' +
        '<tr><td><kbd>\u2190</kbd> <kbd>\u2192</kbd></td><td>Previous / next photo (when zoomed)</td></tr>' +
        '<tr><td><kbd>Q</kbd> <kbd>W</kbd> <kbd>R</kbd> <kbd>G</kbd></td><td>Pen: Black / Blue / Red / Green</td></tr>' +
        '<tr><td><kbd>E</kbd></td><td>Toggle eraser</td></tr>' +
        '<tr><td><kbd>S</kbd></td><td>Toggle spotlight</td></tr>' +
        '<tr><td><kbd>L</kbd></td><td>Lock / unlock board</td></tr>' +
        '<tr><td><kbd>H</kbd></td><td>Hide / show all photos</td></tr>' +
        '<tr><td><kbd>R</kbd></td><td>Rotate visualiser feed (when active)</td></tr>' +
        '<tr><td><kbd>F</kbd></td><td>Toggle fullscreen</td></tr>' +
        '<tr><td><kbd>Shift</kbd>+<kbd>C</kbd></td><td>Clear drawings</td></tr>' +
        '<tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo</td></tr>' +
        '<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Redo</td></tr>' +
        '<tr><td><kbd>Esc</kbd></td><td>Exit zoom / fullscreen / spotlight</td></tr>' +
        '<tr><td><kbd>PgUp</kbd> <kbd>PgDn</kbd></td><td>Previous / next page</td></tr>' +
        '<tr><td><kbd>?</kbd></td><td>Toggle this help</td></tr>' +
        '</table>' +
        '<p style="margin:10px 0 0;font-size:11px;color:#a0aec0;text-align:center">Click anywhere to close</p>' +
        '</div>';

    overlay.addEventListener('click', function () { overlay.remove(); });
    function closeOnEsc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', closeOnEsc); } }
    document.addEventListener('keydown', closeOnEsc);

    app.appendChild(overlay);
};

/* ─── Help Overlay ─── */
SAB.toolbar.showHelp = function () {
    var H = SAB.config.H;
    var app = SAB.els.app;
    var existing = app.querySelector('.' + H + '_help_overlay');
    if (existing) { existing.remove(); return; }

    var isCamera = SAB.state.role === 'camera';

    var overlay = document.createElement('div');
    overlay.className = H + '_help_overlay';

    var steps = isCamera
        ? '<div class="' + H + '_help_steps">' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_connect">\uD83D\uDCF1</div><div class="' + H + '_help_step_body"><h4>1. Connect</h4><p>Enter the 6-character code shown on the classroom display screen, or scan its QR code to connect instantly.</p></div></div>' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_capture">\uD83D\uDCF7</div><div class="' + H + '_help_step_body"><h4>2. Capture</h4><p>Tap <strong>Take Photo</strong> to snap student work with your camera, or <strong>Choose Photo</strong> to select from your library. Photos appear on the big screen instantly.</p></div></div>' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_annotate">\u270F\uFE0F</div><div class="' + H + '_help_step_body"><h4>3. Annotate</h4><p>Switch to the <strong>Annotate</strong> tab to draw or stamp directly from your device \u2014 your markings appear live on the display.</p></div></div>' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_visualiser">\uD83D\uDCF9</div><div class="' + H + '_help_step_body"><h4>4. Live Visualiser</h4><p>Use the <strong>Visualiser</strong> tab to stream your camera live to the display \u2014 perfect for modelling worked examples on paper. Freeze the frame to annotate.</p></div></div>' +
          '</div>'
        : '<div class="' + H + '_help_steps">' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_connect">\uD83D\uDCF1</div><div class="' + H + '_help_step_body"><h4>1. Connect your phone or tablet</h4><p>Open this page on your phone or tablet and scan the QR code to connect automatically. Or type the 6-character code shown above.</p></div></div>' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_capture">\uD83D\uDCF7</div><div class="' + H + '_help_step_body"><h4>2. Capture student work</h4><p>Use your phone or tablet to snap photos of student work \u2014 they appear on this screen instantly. You can also load photos directly using <strong>Load Photo</strong> above.</p></div></div>' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_annotate">\u270F\uFE0F</div><div class="' + H + '_help_step_body"><h4>3. Annotate &amp; discuss</h4><p>Draw on photos, add ticks and crosses, use the <strong>spotlight</strong> to focus attention, or <strong>hide photos</strong> for a structured reveal. All drawings stay separate from the photos.</p></div></div>' +
          '<div class="' + H + '_help_step"><div class="' + H + '_help_icon ' + H + '_help_icon_visualiser">\uD83D\uDCF9</div><div class="' + H + '_help_step_body"><h4>4. Live Visualiser</h4><p>Use the <strong>Visualiser</strong> tab on your phone or tablet to stream your camera live \u2014 like a document camera. <strong>Freeze</strong> the frame to annotate on top.</p></div></div>' +
          '</div>' +
          '<hr class="' + H + '_help_divider">' +
          '<div class="' + H + '_help_tip">Press <kbd>?</kbd> for keyboard shortcuts \u00B7 Images are never stored on any server</div>';

    overlay.innerHTML =
        '<div class="' + H + '_help_card">' +
          '<button class="' + H + '_help_close" title="Close">\u2715</button>' +
          '<div class="' + H + '_help_title">How to use the Show All Board</div>' +
          steps +
        '</div>';

    var closeOverlay = function () { overlay.remove(); document.removeEventListener('keydown', closeOnEsc); };
    overlay.querySelector('.' + H + '_help_close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    function closeOnEsc(e) { if (e.key === 'Escape') closeOverlay(); }
    document.addEventListener('keydown', closeOnEsc);

    app.appendChild(overlay);
};

/* ─── Main Toolbar Binding ─── */
SAB.toolbar.bindToolbar = function () {
    var H = SAB.config.H;
    var state = SAB.state;
    var app = SAB.els.app;

    if (SAB.els.fullscreenBtn) SAB.els.fullscreenBtn.addEventListener('click', SAB.toolbar.toggleFullscreen);
    if (SAB.els.fsExitBtn) SAB.els.fsExitBtn.addEventListener('click', SAB.toolbar.exitFullscreen);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && state.zoomedPhotoId) { SAB.photos.unzoomPhoto(); return; }
        if (e.key === 'Escape' && app.classList.contains(H + '_fs')) SAB.toolbar.exitFullscreen();
        if (e.key === 'ArrowLeft' && state.zoomedPhotoId) { e.preventDefault(); SAB.photos.cycleZoom(-1); return; }
        if (e.key === 'ArrowRight' && state.zoomedPhotoId) { e.preventDefault(); SAB.photos.cycleZoom(1); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && state.role === 'display') {
            e.preventDefault(); SAB.annotations.handleUndo();
        }
        if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y') && state.role === 'display') {
            e.preventDefault(); SAB.annotations.handleRedo();
        }

        if (state.role !== 'display' || SAB.utils.isTypingTarget(e)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.key) {
            case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8':
                e.preventDefault();
                var photoIdx = parseInt(e.key) - 1;
                if (photoIdx < state.photos.length && !state.photos[photoIdx].hidden) {
                    var pid = state.photos[photoIdx].id;
                    if (state.zoomedPhotoId === pid) SAB.photos.unzoomPhoto();
                    else { if (state.zoomedPhotoId) SAB.photos.unzoomPhoto(); SAB.photos.zoomPhoto(pid); }
                }
                break;
            case 'q': case 'Q': e.preventDefault(); SAB.toolbar.activatePenByIndex(0); break;
            case 'w': case 'W': e.preventDefault(); SAB.toolbar.activatePenByIndex(1); break;
            case 'r': case 'R':
                e.preventDefault();
                if (SAB.$('visDisplayWrap') && !SAB.$('visDisplayWrap').classList.contains(H + '_hidden')) {
                    SAB.visualiser.rotateDisplay();
                } else { SAB.toolbar.activatePenByIndex(2); }
                break;
            case 'g': case 'G': e.preventDefault(); SAB.toolbar.activatePenByIndex(3); break;
            case 's': case 'S':
                e.preventDefault();
                if (state.spotlight) SAB.drawing.spotlightOff(); else SAB.drawing.spotlightOn();
                break;
            case 'e': case 'E': e.preventDefault(); SAB.toolbar.activateTool('eraser'); break;
            case 'C':
                if (e.shiftKey) { e.preventDefault(); if (SAB.els.clearDrawBtn) SAB.els.clearDrawBtn.click(); }
                break;
            case 'f': case 'F':
                e.preventDefault();
                if (app.classList.contains(H + '_fs')) SAB.toolbar.exitFullscreen(); else SAB.toolbar.toggleFullscreen();
                break;
            case 'h': case 'H':
                e.preventDefault();
                if (SAB.els.hideAllBtn && SAB.els.hideAllBtn.classList.contains(H + '_visible')) SAB.els.hideAllBtn.click();
                break;
            case '?': e.preventDefault(); SAB.toolbar.showShortcutHelp(); break;
            case 'PageUp':
                e.preventDefault();
                if (state.activePage > 0) SAB.pages.switchPage(state.activePage - 1);
                break;
            case 'PageDown':
                e.preventDefault();
                if (state.activePage < state.pages.length - 1) SAB.pages.switchPage(state.activePage + 1);
                else if (state.pages.length < SAB.config.MAX_PAGES) SAB.pages.addPage();
                break;
        }
    });

    if (SAB.els.shortcutHelpBtn) SAB.els.shortcutHelpBtn.addEventListener('click', SAB.toolbar.showShortcutHelp);
    if (SAB.els.helpBtn) SAB.els.helpBtn.addEventListener('click', SAB.toolbar.showHelp);

    if (SAB.els.roomBadge) SAB.els.roomBadge.addEventListener('click', function () {
        if (state.welcomeVisible) SAB.toolbar.hideWelcome(); else SAB.toolbar.showWelcome();
    });

    if (SAB.els.loadPhotoBtn) SAB.els.loadPhotoBtn.addEventListener('click', function () { SAB.els.desktopFileInput.click(); });
    if (SAB.els.desktopFileInput) SAB.els.desktopFileInput.addEventListener('change', function (e) {
        var files = e.target.files;
        for (var i = 0; i < files.length && i < SAB.config.MAX_PHOTOS; i++) {
            SAB.utils.processImageFile(files[i], function (url) { SAB.photos.addPhoto(url); });
        }
        SAB.els.desktopFileInput.value = '';
    });

    if (SAB.els.saveBtn) SAB.els.saveBtn.addEventListener('click', SAB.connection.saveBoard);

    if (SAB.els.hideAllBtn) SAB.els.hideAllBtn.addEventListener('click', function () {
        var allHidden = state.photos.length > 0 && state.photos.every(function (p) { return p.hidden; });
        if (allHidden) SAB.photos.showAllPhotos(); else SAB.photos.hideAllPhotos();
    });

    if (SAB.els.clearAllBtn) SAB.els.clearAllBtn.addEventListener('click', function () {
        if (state.clearConfirm) {
            clearTimeout(state.clearTimer);
            state.clearConfirm = false;
            SAB.els.clearAllBtn.textContent = '\u21BA Clear All';
            SAB.els.clearAllBtn.classList.remove(H + '_pill_confirm');
            SAB.toolbar.doClearAll();
        } else {
            state.clearConfirm = true;
            SAB.els.clearAllBtn.textContent = '\u26A0 Are you sure?';
            SAB.els.clearAllBtn.classList.add(H + '_pill_confirm');
            state.clearTimer = setTimeout(function () {
                state.clearConfirm = false;
                SAB.els.clearAllBtn.textContent = '\u21BA Clear All';
                SAB.els.clearAllBtn.classList.remove(H + '_pill_confirm');
            }, 3000);
        }
    });

    /* Drawing tool buttons */
    var toolBtns = app.querySelectorAll('[data-tool]');
    var defaultPenBtn = app.querySelector('[data-tool="pen"][data-color="#2c3e50"]');
    for (var i = 0; i < toolBtns.length; i++) {
        toolBtns[i].addEventListener('click', function () {
            var tool = this.getAttribute('data-tool');
            var color = this.getAttribute('data-color');
            var stamp = this.getAttribute('data-stamp');

            if (this.classList.contains(H + '_tool_active') && tool !== 'pen') {
                for (var j = 0; j < toolBtns.length; j++) toolBtns[j].classList.remove(H + '_tool_active');
                var penRestore = app.querySelector('[data-tool="pen"][data-color="' + state.penColor + '"]') || defaultPenBtn;
                if (penRestore) penRestore.classList.add(H + '_tool_active');
                state.tool = 'pen';
                SAB.els.drawCanvas.style.cursor = 'crosshair';
                SAB.els.drawCanvas.style.pointerEvents = '';
                if (state.spotlight) SAB.drawing.spotlightOff();
                SAB.toolbar.closeStampPanel();
                return;
            }

            for (var j = 0; j < toolBtns.length; j++) toolBtns[j].classList.remove(H + '_tool_active');
            this.classList.add(H + '_tool_active');
            state.tool = tool;
            if (color) state.penColor = color;
            if (stamp) state.stampChar = stamp;
            if (tool !== 'stamp') SAB.toolbar.closeStampPanel();
            if (state.spotlight) SAB.drawing.spotlightOff();
            SAB.els.drawCanvas.style.cursor = (tool === 'eraser') ? 'cell' : (tool === 'text' || tool === 'stamp') ? 'pointer' : 'crosshair';
            SAB.els.drawCanvas.style.pointerEvents = '';
        });
    }

    /* Width buttons */
    var widthBtns = app.querySelectorAll('[data-width]');
    for (var w = 0; w < widthBtns.length; w++) {
        widthBtns[w].addEventListener('click', function () {
            for (var j = 0; j < widthBtns.length; j++) widthBtns[j].classList.remove(H + '_tool_active');
            this.classList.add(H + '_tool_active');
            state.penWidth = parseInt(this.getAttribute('data-width'), 10);
        });
    }

    /* Background buttons */
    var bgBtns = app.querySelectorAll('[data-bg]');
    for (var b = 0; b < bgBtns.length; b++) {
        bgBtns[b].addEventListener('click', function () {
            for (var j = 0; j < bgBtns.length; j++) bgBtns[j].classList.remove(H + '_tool_active');
            this.classList.add(H + '_tool_active');
            var bg = this.getAttribute('data-bg');
            SAB.els.canvasArea.classList.remove(H + '_bg_grid', H + '_bg_dots', H + '_bg_lined');
            if (bg !== 'white') SAB.els.canvasArea.classList.add(H + '_bg_' + bg);
            state.background = bg;
        });
    }

    if (SAB.els.undoBtn) SAB.els.undoBtn.addEventListener('click', SAB.annotations.handleUndo);
    if (SAB.els.redoBtn) SAB.els.redoBtn.addEventListener('click', SAB.annotations.handleRedo);

    if (SAB.els.clearDrawBtn) SAB.els.clearDrawBtn.addEventListener('click', function () {
        state.strokes = [];
        state.stamps = [];
        state.undoStack = state.undoStack.filter(function (a) { return a.type === 'text'; });
        state.redoStack = [];
        SAB.drawing.redrawStrokes();
        SAB.annotations.redrawStamps();
    });
};
