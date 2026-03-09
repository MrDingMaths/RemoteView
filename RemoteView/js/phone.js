/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Phone Panel & Remote Draw
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.phone = {};

SAB.phone.bindPhone = function () {
    var H = SAB.config.H;
    var cfg = SAB.config;
    var state = SAB.state;

    if (SAB.els.connectBtn) SAB.els.connectBtn.addEventListener('click', function () {
        var code = SAB.els.codeInput.value.trim().toUpperCase();
        if (code.length !== cfg.CODE_LEN || !/^[A-Z0-9]{6}$/.test(code)) { SAB.connection.showPhoneError('Please enter the 6-character code'); return; }
        SAB.connection.connectToRoom(code);
    });

    if (SAB.els.codeInput) SAB.els.codeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') SAB.els.connectBtn.click(); });

    if (SAB.els.disconnectBtn) SAB.els.disconnectBtn.addEventListener('click', function () {
        state.reconnectCode = null;
        SAB.visualiser.stopPhone();
        if (state.conn) { try { state.conn.close(); } catch (e) {} }
        if (state.peer) { try { state.peer.destroy(); } catch (e) {} }
        state.connected = false; state.conn = null; state.peer = null;
        SAB.els.phoneConnected.classList.remove(H + '_visible');
        SAB.els.phoneConnect.style.display = '';
        SAB.els.connectBtn.disabled = false;
        SAB.els.sentThumbs.innerHTML = '';
        SAB.phonePhotoSeq = 0;
        SAB.remote.bgImage = null;
        SAB.remote.strokes = [];
        SAB.els.codeInput.value = '';
        SAB.connection.showPhoneError('');
        var ppb = SAB.$('phonePageBar');
        if (ppb) ppb.classList.add(H + '_hidden');
    });

    /* Phone page controls */
    var phonePagePrev = SAB.$('phonePagePrev');
    var phonePageNext = SAB.$('phonePageNext');
    var phonePageAdd  = SAB.$('phonePageAdd');
    if (phonePagePrev) phonePagePrev.addEventListener('click', function () {
        if (state.conn && state.connected) state.conn.send({ type: 'remote_switch_page', page: state._phoneActivePage - 1 });
    });
    if (phonePageNext) phonePageNext.addEventListener('click', function () {
        if (state.conn && state.connected) state.conn.send({ type: 'remote_switch_page', page: state._phoneActivePage + 1 });
    });
    if (phonePageAdd) phonePageAdd.addEventListener('click', function () {
        if (state.conn && state.connected) state.conn.send({ type: 'remote_add_page' });
    });

    if (SAB.els.takePhotoBtn) SAB.els.takePhotoBtn.addEventListener('click', function () { SAB.els.camCapture.click(); });
    if (SAB.els.camCapture) SAB.els.camCapture.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) SAB.utils.processImageFile(e.target.files[0], SAB.connection.sendPhoto);
        SAB.els.camCapture.value = '';
    });

    if (SAB.els.choosePhotoBtn) SAB.els.choosePhotoBtn.addEventListener('click', function () { SAB.els.camLibrary.click(); });
    if (SAB.els.camLibrary) SAB.els.camLibrary.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) SAB.utils.processImageFile(e.target.files[0], SAB.connection.sendPhoto);
        SAB.els.camLibrary.value = '';
    });

    /* Tab switching */
    var tabBtns = SAB.els.app.querySelectorAll('.' + H + '_phone_tab');
    var tabCamera = SAB.$('tabCamera');
    var tabVisualiser = SAB.$('tabVisualiser');
    var tabAnnotate = SAB.$('tabAnnotate');
    for (var t = 0; t < tabBtns.length; t++) {
        tabBtns[t].addEventListener('click', function () {
            var tab = this.getAttribute('data-tab');
            for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove(H + '_phone_tab_active');
            this.classList.add(H + '_phone_tab_active');
            if (tabCamera) tabCamera.classList.remove(H + '_visible');
            if (tabVisualiser) tabVisualiser.classList.remove(H + '_visible');
            if (tabAnnotate) tabAnnotate.classList.remove(H + '_visible');
            if (tab === 'camera' && tabCamera) tabCamera.classList.add(H + '_visible');
            if (tab === 'visualiser' && tabVisualiser) tabVisualiser.classList.add(H + '_visible');
            if (tab === 'annotate' && tabAnnotate) {
                tabAnnotate.classList.add(H + '_visible');
                SAB.phone.resizeRemoteCanvas();
                SAB.connection.sendRemoteCmd({ type: 'request_board_snapshot' });
            }
        });
    }

    /* Switch from camera → display mode */
    var switchToDisplay = document.getElementById(H + '_switchToDisplay');
    if (switchToDisplay) switchToDisplay.addEventListener('click', function () {
        state.reconnectCode = null;
        if (state.conn) { try { state.conn.close(); } catch (e) {} }
        if (state.peer) { try { state.peer.destroy(); } catch (e) {} }
        state.connected = false; state.conn = null; state.peer = null;
        state.localDisplay = true;
        SAB.app.setRole('display');
        SAB.drawing.resizeCanvas();
        SAB.toolbar.hideWelcome();
        SAB.connection.loadPeerJS(function () { SAB.connection.initDisplay(); });
    });
};

/* ─── Remote Draw Canvas ─── */
SAB.phone.resizeRemoteCanvas = function () {
    var remote = SAB.remote;
    if (!remote.canvas) return;
    var wrap = remote.canvas.parentElement;
    if (!wrap) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    remote.canvas.width = w;
    remote.canvas.height = h;
    SAB.phone.redrawRemote();
};

SAB.phone.redrawRemote = function () {
    var remote = SAB.remote;
    if (!remote.ctx) return;
    var c = remote.canvas, cx = remote.ctx;
    cx.clearRect(0, 0, c.width, c.height);
    if (remote.bgImage) {
        cx.globalAlpha = 0.45;
        cx.drawImage(remote.bgImage, 0, 0, c.width, c.height);
        cx.globalAlpha = 1;
    }
    remote.strokes.forEach(function (s) { SAB.phone.drawRemoteStroke(s); });
};

SAB.phone.drawRemoteStroke = function (stroke) {
    if (!stroke.points || stroke.points.length < 2) return;
    var remote = SAB.remote;
    var c = remote.canvas, cx = remote.ctx;
    var w = c.width, h = c.height;
    cx.save();
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    if (stroke.tool === 'eraser') {
        cx.globalCompositeOperation = 'destination-out';
        cx.strokeStyle = 'rgba(0,0,0,1)';
        cx.lineWidth = stroke.width * 3;
    } else {
        cx.strokeStyle = stroke.color;
        cx.lineWidth = stroke.width;
    }
    cx.beginPath();
    cx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (var i = 1; i < stroke.points.length; i++) {
        cx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
    }
    cx.stroke();
    if (stroke.tool === 'arrow' && stroke.points.length >= 2) {
        var p0 = stroke.points[0], p1 = stroke.points[1];
        cx.fillStyle = stroke.color;
        SAB.drawing.drawArrowhead(cx, p0.x * w, p0.y * h, p1.x * w, p1.y * h, Math.max(10, stroke.width * 3));
    }
    cx.restore();
};

SAB.phone.getRemotePos = function (e) {
    var remote = SAB.remote;
    var rect = remote.canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx / remote.canvas.width, y: cy / remote.canvas.height };
};

SAB.phone.bindRemoteDraw = function () {
    var H = SAB.config.H;
    var remote = SAB.remote;
    remote.canvas = SAB.$('remoteCanvas');
    if (!remote.canvas) return;
    remote.ctx = remote.canvas.getContext('2d');

    var rToolBtns = SAB.els.app.querySelectorAll('[data-rtool]');
    for (var i = 0; i < rToolBtns.length; i++) {
        rToolBtns[i].addEventListener('click', function () {
            var tool = this.getAttribute('data-rtool');
            var color = this.getAttribute('data-rcolor');
            var stamp = this.getAttribute('data-rstamp');

            if (this.classList.contains(H + '_rtool_active') && tool !== 'pen') {
                for (var j = 0; j < rToolBtns.length; j++) rToolBtns[j].classList.remove(H + '_rtool_active');
                var defaultBtn = SAB.els.app.querySelector('[data-rtool="pen"][data-rcolor="' + remote.color + '"]') ||
                                 SAB.els.app.querySelector('[data-rtool="pen"][data-rcolor="#2c3e50"]');
                if (defaultBtn) defaultBtn.classList.add(H + '_rtool_active');
                remote.tool = 'pen';
                remote.canvas.style.cursor = 'crosshair';
                return;
            }

            for (var j = 0; j < rToolBtns.length; j++) rToolBtns[j].classList.remove(H + '_rtool_active');
            this.classList.add(H + '_rtool_active');
            remote.tool = tool;
            if (color) remote.color = color;
            if (stamp) remote.stampChar = stamp;
            remote.canvas.style.cursor = (tool === 'stamp') ? 'pointer' : (tool === 'eraser') ? 'cell' : 'crosshair';
        });
    }

    var remoteUndoBtn = SAB.$('remoteUndoBtn');
    if (remoteUndoBtn) remoteUndoBtn.addEventListener('click', function () {
        if (remote.strokes.length > 0) remote.strokes.pop();
        SAB.phone.redrawRemote();
        SAB.connection.sendRemoteCmd({ type: 'remote_undo' });
    });

    var remoteClearBtn = SAB.$('remoteClearBtn');
    if (remoteClearBtn) remoteClearBtn.addEventListener('click', function () {
        remote.strokes = [];
        SAB.phone.redrawRemote();
        SAB.connection.sendRemoteCmd({ type: 'remote_clear_draw' });
    });

    var remoteRefreshBtn = SAB.$('remoteRefreshBtn');
    if (remoteRefreshBtn) remoteRefreshBtn.addEventListener('click', function () {
        SAB.connection.sendRemoteCmd({ type: 'request_board_snapshot' });
        remoteRefreshBtn.style.opacity = '0.4';
        setTimeout(function () { remoteRefreshBtn.style.opacity = ''; }, 800);
    });

    remote.canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var pos = SAB.phone.getRemotePos(e);

        if (remote.tool === 'stamp') {
            SAB.connection.sendRemoteCmd({ type: 'remote_stamp', ch: remote.stampChar, x: pos.x, y: pos.y });
            remote.ctx.font = '24px Arial';
            remote.ctx.textAlign = 'center';
            remote.ctx.textBaseline = 'middle';
            remote.ctx.fillStyle = SAB.config.STAMP_COLORS[remote.stampChar] || '#2c3e50';
            remote.ctx.fillText(remote.stampChar, pos.x * remote.canvas.width, pos.y * remote.canvas.height);
            return;
        }

        if (remote.tool === 'arrow') {
            remote.lineStart = pos;
            remote.isDrawing = true;
            return;
        }

        remote.isDrawing = true;
        remote.currentStroke = {
            points: [pos],
            color: remote.color,
            width: remote.width,
            tool: remote.tool === 'eraser' ? 'eraser' : 'pen'
        };
    });

    remote.canvas.addEventListener('pointermove', function (e) {
        if (!remote.isDrawing) return;
        e.preventDefault();
        var pos = SAB.phone.getRemotePos(e);

        if (remote.tool === 'arrow' && remote.lineStart) {
            SAB.phone.redrawRemote();
            var c = remote.canvas, cx = remote.ctx;
            var sx = remote.lineStart.x * c.width, sy = remote.lineStart.y * c.height;
            var ex = pos.x * c.width, ey = pos.y * c.height;
            cx.save();
            cx.lineCap = 'round';
            cx.strokeStyle = remote.color;
            cx.lineWidth = remote.width;
            cx.setLineDash([6, 4]);
            cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(ex, ey); cx.stroke();
            cx.setLineDash([]);
            cx.fillStyle = remote.color;
            SAB.drawing.drawArrowhead(cx, sx, sy, ex, ey, Math.max(10, remote.width * 3));
            cx.restore();
            return;
        }

        if (!remote.currentStroke) return;
        remote.currentStroke.points.push(pos);
        var pts = remote.currentStroke.points;
        var c = remote.canvas, cx = remote.ctx;
        if (pts.length >= 2) {
            cx.save();
            cx.lineCap = 'round'; cx.lineJoin = 'round';
            if (remote.currentStroke.tool === 'eraser') {
                cx.globalCompositeOperation = 'destination-out';
                cx.strokeStyle = 'rgba(0,0,0,1)';
                cx.lineWidth = remote.currentStroke.width * 3;
            } else {
                cx.strokeStyle = remote.currentStroke.color;
                cx.lineWidth = remote.currentStroke.width;
            }
            cx.beginPath();
            cx.moveTo(pts[pts.length - 2].x * c.width, pts[pts.length - 2].y * c.height);
            cx.lineTo(pts[pts.length - 1].x * c.width, pts[pts.length - 1].y * c.height);
            cx.stroke();
            cx.restore();
        }
    });

    function stopRemoteDraw(e) {
        if (!remote.isDrawing) return;
        remote.isDrawing = false;

        if (remote.tool === 'arrow' && remote.lineStart) {
            var pos = SAB.phone.getRemotePos(e);
            var arrowStroke = {
                points: [remote.lineStart, pos],
                color: remote.color,
                width: remote.width,
                tool: 'arrow'
            };
            remote.strokes.push(arrowStroke);
            remote.lineStart = null;
            SAB.phone.redrawRemote();
            SAB.connection.sendRemoteCmd({ type: 'remote_stroke', stroke: arrowStroke });
            return;
        }

        if (remote.currentStroke && remote.currentStroke.points.length >= 2) {
            remote.strokes.push(remote.currentStroke);
            SAB.connection.sendRemoteCmd({ type: 'remote_stroke', stroke: remote.currentStroke });
        }
        remote.currentStroke = null;
    }

    remote.canvas.addEventListener('pointerup', stopRemoteDraw);
    remote.canvas.addEventListener('pointerleave', stopRemoteDraw);
    remote.canvas.addEventListener('pointercancel', stopRemoteDraw);
    remote.canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
};
