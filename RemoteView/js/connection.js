/* ═══════════════════════════════════════════════════════════════════════
   SHOW ALL BOARD — PeerJS Connection & Communication
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.connection = {};

SAB.connection.loadPeerJS = function (cb) {
    if (window.Peer) { cb(); return; }
    var s = document.createElement('script');
    s.src = SAB.config.PEERJS_CDN;
    s.onload = cb;
    s.onerror = function () {
        console.warn('PeerJS CDN failed');
        if (SAB.state.role === 'camera') SAB.connection.showPhoneError('Could not load connection library. Check your internet and refresh.');
    };
    document.head.appendChild(s);
};

SAB.connection.generateCode = function () {
    var cfg = SAB.config;
    var code = '';
    for (var i = 0; i < cfg.CODE_LEN; i++) code += cfg.CODE_CHARS.charAt(Math.floor(Math.random() * cfg.CODE_CHARS.length));
    return code;
};

SAB.connection.updateRoomCodeUI = function (code) {
    var H = SAB.config.H;
    if (SAB.els.roomCodeBig) SAB.els.roomCodeBig.textContent = code;
    if (SAB.els.roomCodeSmall) SAB.els.roomCodeSmall.textContent = code;
    if (SAB.els.qr) {
        var url = SAB.config.BASE_URL + '?code=' + code;
        var svgChild = SAB.els.qr.querySelector('svg');
        var label = SAB.els.qr.querySelector('.' + H + '_qr_label');
        var svg = SAB.utils.makeQRSvg(url);
        if (svg) {
            if (svgChild) svgChild.remove();
            SAB.els.qr.insertAdjacentHTML('afterbegin', svg);
        }
        if (label) label.textContent = 'Scan to connect instantly';
    }
};

SAB.connection.updateConnectionUI = function (connected) {
    var H = SAB.config.H;
    if (connected) {
        SAB.els.statusDot.classList.add(H + '_dot_on');
        SAB.els.roomBadge.classList.add(H + '_connected');
        SAB.els.waiting.classList.add(H + '_visible');
    } else {
        SAB.els.statusDot.classList.remove(H + '_dot_on');
        SAB.els.roomBadge.classList.remove(H + '_connected');
        SAB.els.waiting.classList.remove(H + '_visible');
    }
};

/* ─── Display Mode — host the room ─── */
SAB.connection.initDisplay = function () {
    var state = SAB.state;
    var cfg = SAB.config;
    var code = SAB.connection.generateCode();
    state.roomCode = code;
    SAB.connection.updateRoomCodeUI(code);

    try {
        state.peer = new Peer(cfg.PEER_PREFIX + code, { debug: 0 });
    } catch (e) { console.warn('Peer create failed:', e); return; }

    state.peer.on('open', function () { state.peerReady = true; });

    state.peer.on('connection', function (conn) {
        SAB.connection.setupDisplayConn(conn);
    });

    state.peer.on('error', function (err) {
        if (err.type === 'unavailable-id') {
            state.peer.destroy();
            SAB.connection.initDisplay();
        }
    });

    state.peer.on('disconnected', function () {
        if (state.peer && !state.peer.destroyed) {
            try { state.peer.reconnect(); } catch (e) {}
        }
    });
};

/* Message dispatch map for display-side data handler */
var displayHandlers = {
    'photo': function (data) { SAB.photos.addPhoto(data.dataUrl, data.seq); },
    'chunk_start': function (data, chunkBuf) {
        chunkBuf[data.id] = { total: data.total, parts: [], received: 0, seq: data.seq };
    },
    'chunk': function (data, chunkBuf) {
        var buf = chunkBuf[data.id];
        if (buf) {
            buf.parts[data.idx] = data.data;
            buf.received++;
            if (buf.received === buf.total) {
                var full = buf.parts.join('');
                SAB.photos.addPhoto(full, buf.seq);
                delete chunkBuf[data.id];
            }
        }
    },
    'remote_delete_photo': function (data) {
        var dp = SAB.photos.findPhotoBySeq(data.seq);
        if (dp) SAB.photos.removePhoto(dp.id);
    },
    'remote_rotate_photo': function (data) {
        var rp = SAB.photos.findPhotoBySeq(data.seq);
        if (rp) SAB.photos.rotatePhoto(rp.id);
    },
    'remote_zoom_photo': function (data) {
        var zp = SAB.photos.findPhotoBySeq(data.seq);
        if (zp) {
            if (SAB.state.zoomedPhotoId === zp.id) SAB.photos.unzoomPhoto();
            else SAB.photos.zoomPhoto(zp.id);
        }
    },
    'remote_stroke': function (data) {
        SAB.toolbar.hideWelcome();
        SAB.state.strokes.push(data.stroke);
        SAB.state.undoStack.push({ type: 'stroke' });
        SAB.state.redoStack.length = 0;
        SAB.drawing.redrawStrokes();
    },
    'remote_stamp': function (data) {
        SAB.toolbar.hideWelcome();
        SAB.annotations.placeStamp(data.ch, data.x, data.y);
    },
    'remote_undo': function () { SAB.annotations.handleUndo(); },
    'remote_clear_draw': function () {
        SAB.state.strokes = [];
        SAB.state.stamps = [];
        SAB.state.undoStack = SAB.state.undoStack.filter(function (a) { return a.type === 'text'; });
        SAB.state.redoStack = [];
        SAB.drawing.redrawStrokes();
        SAB.annotations.redrawStamps();
    },
    'visualiser_freeze': function () { SAB.visualiser.freezeDisplay(); },
    'visualiser_unfreeze': function () { SAB.visualiser.unfreezeDisplay(); },
    'visualiser_stop': function () { SAB.visualiser.hideDisplay(); },
    'visualiser_start': function () { SAB.visualiser.showDisplay(); },
    'visualiser_rotate': function () { SAB.visualiser.rotateDisplay(); },
    'visualiser_capture': function () { SAB.visualiser.captureFrame(); },
    'remote_switch_page': function (data) {
        if (data.page != null && data.page >= 0 && data.page < SAB.state.pages.length) {
            SAB.pages.switchPage(data.page);
        }
    },
    'remote_add_page': function () { SAB.pages.addPage(); },
    'request_sync': function (data, chunkBuf, conn) {
        try { conn.send({ type: 'page_sync', activePage: SAB.state.activePage, totalPages: SAB.state.pages.length }); } catch (e) {}
    },
    'request_board_snapshot': function (data, chunkBuf, conn) {
        SAB.connection.sendBoardSnapshot(conn);
    },
    'visualiser_frame': function (data) { SAB.visualiser.updateFrame(data.dataUrl); }
};

SAB.connection.setupDisplayConn = function (conn) {
    var state = SAB.state;
    state.connections.push(conn);
    state.connected = true;
    SAB.connection.updateConnectionUI(true);

    try { conn.send({ type: 'page_sync', activePage: state.activePage, totalPages: state.pages.length }); } catch (e) {}

    var chunkBuf = {};

    conn.on('data', function (data) {
        if (data && data.type && displayHandlers[data.type]) {
            displayHandlers[data.type](data, chunkBuf, conn);
        }
    });

    conn.on('close', function () { SAB.connection.removeConn(conn); });
    conn.on('error', function () { SAB.connection.removeConn(conn); });
};

SAB.connection.removeConn = function (conn) {
    var state = SAB.state;
    state.connections = state.connections.filter(function (c) { return c !== conn; });
    if (state.connections.length === 0) {
        state.connected = false;
        SAB.connection.updateConnectionUI(false);
    }
};

/* ─── Camera Mode — connect to a room ─── */
SAB.connection.connectToRoom = function (code) {
    var state = SAB.state;
    var cfg = SAB.config;
    var H = cfg.H;
    if (!window.Peer) { SAB.connection.showPhoneError('Connection library not loaded. Refresh.'); return; }
    SAB.els.connectBtn.disabled = true;
    SAB.connection.showPhoneError('');
    state.reconnectCode = code;

    try { state.peer = new Peer(undefined, { debug: 0 }); }
    catch (e) { SAB.connection.showPhoneError('Could not start. Refresh.'); SAB.els.connectBtn.disabled = false; return; }

    state.peer.on('open', function () {
        var conn = state.peer.connect(cfg.PEER_PREFIX + code, { reliable: true });

        conn.on('open', function () {
            state.conn = conn;
            state.connected = true;
            state.roomCode = code;
            SAB.els.phoneConnect.style.display = 'none';
            SAB.els.phoneConnected.classList.add(H + '_visible');

            SAB.connection.updatePhonePageBar(0, 1);

            conn.on('data', function (data) {
                if (data && data.type === 'visualiser_end_request') {
                    SAB.visualiser.stopPhone();
                } else if (data && data.type === 'visualiser_freeze_request') {
                    if (state.visStreaming && !state.visFrozen) SAB.visualiser.toggleFreezePhone();
                } else if (data && data.type === 'visualiser_unfreeze_request') {
                    if (state.visStreaming && state.visFrozen) SAB.visualiser.toggleFreezePhone();
                } else if (data && data.type === 'zoom_sync') {
                    var allWraps = SAB.els.sentThumbs.querySelectorAll('.' + H + '_sent_thumb_wrap');
                    for (var j = 0; j < allWraps.length; j++) {
                        if (data.seq != null && allWraps[j].getAttribute('data-seq') == data.seq) {
                            allWraps[j].classList.add(H + '_sent_zoomed');
                        } else {
                            allWraps[j].classList.remove(H + '_sent_zoomed');
                        }
                    }
                } else if (data && data.type === 'page_sync') {
                    SAB.connection.updatePhonePageBar(data.activePage, data.totalPages);
                } else if (data && data.type === 'board_snapshot') {
                    var img = new Image();
                    img.onload = function () {
                        SAB.remote.bgImage = img;
                        SAB.phone.redrawRemote();
                    };
                    img.src = data.dataUrl;
                }
            });

            try { conn.send({ type: 'request_sync' }); } catch (e) {}
        });

        conn.on('close', function () { SAB.connection.handleCameraDisconnect(true); });
        conn.on('error', function () {
            SAB.connection.showPhoneError('Connection failed. Check the code.');
            SAB.els.connectBtn.disabled = false;
        });

        setTimeout(function () {
            if (!state.connected) {
                SAB.connection.showPhoneError('Could not connect. Check code and try again.');
                SAB.els.connectBtn.disabled = false;
                if (state.peer && !state.peer.destroyed) state.peer.destroy();
            }
        }, 10000);
    });

    state.peer.on('error', function (err) {
        SAB.connection.showPhoneError('Error: ' + (err.message || 'Try again.'));
        SAB.els.connectBtn.disabled = false;
    });
};

SAB.connection.handleCameraDisconnect = function (tryReconnect) {
    var state = SAB.state;
    var H = SAB.config.H;
    state.connected = false;
    state.conn = null;
    SAB.visualiser.stopPhone();

    if (tryReconnect && state.reconnectCode) {
        SAB.connection.showPhoneError('Connection lost. Reconnecting\u2026');
        if (state.peer && !state.peer.destroyed) { try { state.peer.destroy(); } catch (e) {} }
        state.peer = null;
        setTimeout(function () {
            if (!state.connected && state.reconnectCode) {
                SAB.connection.connectToRoom(state.reconnectCode);
            }
        }, 2000);
        return;
    }

    SAB.els.phoneConnected.classList.remove(H + '_visible');
    SAB.els.phoneConnect.style.display = '';
    SAB.els.connectBtn.disabled = false;
    SAB.connection.showPhoneError('Disconnected.');
};

SAB.connection.showPhoneError = function (msg) {
    var H = SAB.config.H;
    var el = SAB.els.phoneError;
    if (!msg) { el.classList.remove(H + '_visible'); el.textContent = ''; }
    else { el.textContent = msg; el.classList.add(H + '_visible'); }
};

SAB.connection.sendPhoto = function (dataUrl) {
    var state = SAB.state;
    var H = SAB.config.H;
    var cfg = SAB.config;
    if (!state.conn || !state.connected) { SAB.connection.showPhoneError('Not connected.'); return; }
    SAB.els.sendingStatus.classList.remove(H + '_hidden');

    var seq = ++SAB.phonePhotoSeq;

    try {
        if (dataUrl.length > cfg.CHUNK_SIZE) {
            var id = 'img_' + Date.now();
            var chunks = [];
            for (var i = 0; i < dataUrl.length; i += cfg.CHUNK_SIZE) {
                chunks.push(dataUrl.substring(i, i + cfg.CHUNK_SIZE));
            }
            state.conn.send({ type: 'chunk_start', id: id, total: chunks.length, seq: seq });
            for (var c = 0; c < chunks.length; c++) {
                state.conn.send({ type: 'chunk', id: id, idx: c, data: chunks[c] });
            }
        } else {
            state.conn.send({ type: 'photo', dataUrl: dataUrl, seq: seq });
        }
    } catch (e) {
        SAB.connection.showPhoneError('Send failed. Try again.');
        SAB.els.sendingStatus.classList.add(H + '_hidden');
        return;
    }

    /* Build interactive thumbnail */
    var wrap = document.createElement('div');
    wrap.className = H + '_sent_thumb_wrap';
    wrap.setAttribute('data-seq', seq);

    var thumb = document.createElement('img');
    thumb.className = H + '_sent_thumb';
    thumb.src = dataUrl;
    thumb.addEventListener('click', function () {
        state.conn.send({ type: 'remote_zoom_photo', seq: seq });
        var allWraps = SAB.els.sentThumbs.querySelectorAll('.' + H + '_sent_thumb_wrap');
        for (var j = 0; j < allWraps.length; j++) {
            if (allWraps[j] !== wrap) allWraps[j].classList.remove(H + '_sent_zoomed');
        }
        wrap.classList.toggle(H + '_sent_zoomed');
    });

    var delBtn = document.createElement('button');
    delBtn.className = H + '_sent_thumb_btn ' + H + '_sent_thumb_del';
    delBtn.textContent = '\u2715';
    delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.conn.send({ type: 'remote_delete_photo', seq: seq });
        wrap.remove();
    });

    var rotBtn = document.createElement('button');
    rotBtn.className = H + '_sent_thumb_btn ' + H + '_sent_thumb_rot';
    rotBtn.textContent = '\u21BB';
    rotBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.conn.send({ type: 'remote_rotate_photo', seq: seq });
    });

    wrap.appendChild(thumb);
    wrap.appendChild(delBtn);
    wrap.appendChild(rotBtn);
    SAB.els.sentThumbs.appendChild(wrap);

    setTimeout(function () { SAB.els.sendingStatus.classList.add(H + '_hidden'); }, 600);
};

SAB.connection.updatePhonePageBar = function (activePage, totalPages) {
    var H = SAB.config.H;
    SAB.state._phoneActivePage = activePage;
    SAB.state._phoneTotalPages = totalPages;
    var bar   = SAB.$('phonePageBar');
    var label = SAB.$('phonePageLabel');
    var prev  = SAB.$('phonePagePrev');
    var next  = SAB.$('phonePageNext');
    var addB  = SAB.$('phonePageAdd');
    if (!bar) return;
    bar.classList.remove(H + '_hidden');
    if (label) label.textContent = 'Page ' + (activePage + 1) + ' / ' + totalPages;
    if (prev) prev.disabled = (activePage <= 0);
    if (next) next.disabled = (activePage >= totalPages - 1);
    if (addB) addB.style.display = (totalPages >= SAB.config.MAX_PAGES) ? 'none' : '';
};

SAB.connection.sendRemoteCmd = function (data) {
    if (SAB.state.conn && SAB.state.connected) {
        try { SAB.state.conn.send(data); } catch (e) {}
    }
};

/* ─── Board Snapshot ─── */
SAB.connection.renderBoardSnapshot = function (callback, format, quality) {
    var state = SAB.state;
    var H = SAB.config.H;
    var canvasArea = SAB.els.canvasArea;
    var drawCanvas = SAB.els.drawCanvas;
    format = format || 'image/jpeg';
    quality = quality || 0.65;
    var w = canvasArea.clientWidth, h = canvasArea.clientHeight;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var cx = c.getContext('2d');

    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, w, h);

    if (state.background === 'grid') {
        cx.strokeStyle = '#e2e8f0'; cx.lineWidth = 1;
        for (var gx = 0; gx < w; gx += 30) { cx.beginPath(); cx.moveTo(gx, 0); cx.lineTo(gx, h); cx.stroke(); }
        for (var gy = 0; gy < h; gy += 30) { cx.beginPath(); cx.moveTo(0, gy); cx.lineTo(w, gy); cx.stroke(); }
    } else if (state.background === 'dots') {
        cx.fillStyle = '#cbd5e0';
        for (var dx = 15; dx < w; dx += 30) for (var dy = 15; dy < h; dy += 30) { cx.beginPath(); cx.arc(dx, dy, 1.2, 0, Math.PI * 2); cx.fill(); }
    } else if (state.background === 'lined') {
        cx.strokeStyle = '#e2e8f0'; cx.lineWidth = 1;
        for (var ly = 0; ly < h; ly += 30) { cx.beginPath(); cx.moveTo(0, ly); cx.lineTo(w, ly); cx.stroke(); }
    }

    var photoPromises = [];
    state.photos.forEach(function (photo) {
        if (photo.hidden || !photo.slotEl) return;
        photoPromises.push(new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var slot = photo.slotEl;
                var sl = parseInt(slot.style.left), st = parseInt(slot.style.top);
                var sw = parseInt(slot.style.width), sh = parseInt(slot.style.height);
                var scale = Math.min(sw / img.width, sh / img.height);
                var dw = img.width * scale, dh = img.height * scale;
                var ddx = sl + (sw - dw) / 2, ddy = st + (sh - dh) / 2;
                cx.drawImage(img, ddx, ddy, dw, dh);
                resolve();
            };
            img.onerror = resolve;
            img.src = photo.dataUrl;
        }));
    });

    Promise.all(photoPromises).then(function () {
        cx.drawImage(drawCanvas, 0, 0);

        state.stamps.forEach(function (stamp) {
            cx.font = '48px Arial';
            cx.textAlign = 'center';
            cx.textBaseline = 'middle';
            cx.fillStyle = stamp.color || SAB.config.STAMP_COLORS[stamp.ch] || '#2c3e50';
            cx.fillText(stamp.ch, stamp.x * w, stamp.y * h);
        });

        var textEls = SAB.els.textLayer.querySelectorAll('.' + H + '_text_item');
        for (var i = 0; i < textEls.length; i++) {
            var el = textEls[i];
            var wrap = el.parentElement;
            if (!el.textContent) continue;
            cx.font = '700 22px Arial';
            cx.textAlign = 'left';
            cx.textBaseline = 'top';
            cx.fillStyle = el.style.color || '#2c3e50';
            cx.fillText(el.textContent, wrap.offsetLeft + 6, wrap.offsetTop + 4);
        }

        callback(c.toDataURL(format, quality));
    });
};

SAB.connection.sendBoardSnapshot = function (conn) {
    SAB.connection.renderBoardSnapshot(function (fullUrl) {
        var img = new Image();
        img.onload = function () {
            var maxW = 640;
            var scale = Math.min(1, maxW / img.width);
            var sw = Math.round(img.width * scale);
            var sh = Math.round(img.height * scale);
            var sc = document.createElement('canvas');
            sc.width = sw; sc.height = sh;
            sc.getContext('2d').drawImage(img, 0, 0, sw, sh);
            var smallUrl = sc.toDataURL('image/jpeg', 0.55);
            try { conn.send({ type: 'board_snapshot', dataUrl: smallUrl }); } catch (e) {}
        };
        img.src = fullUrl;
    }, 'image/jpeg', 0.7);
};

SAB.connection.saveBoard = function () {
    SAB.connection.renderBoardSnapshot(function (dataUrl) {
        var link = document.createElement('a');
        link.download = 'showallboard-' + (new Date()).toISOString().slice(0, 10) + '.png';
        link.href = dataUrl;
        link.click();

        var saveBtn = SAB.els.saveBtn;
        if (saveBtn) {
            var orig = saveBtn.innerHTML;
            saveBtn.innerHTML = '\u2713 Saved';
            saveBtn.style.background = '#c6f6d5';
            setTimeout(function () {
                saveBtn.innerHTML = orig;
                saveBtn.style.background = '';
            }, 1500);
        }
    }, 'image/png', 1);
};
