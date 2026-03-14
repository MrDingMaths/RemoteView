/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Visualiser (Live Camera Feed)
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.visualiser = {};

var visCaptureCanvas = null;
var visCaptureCtx = null;

/* ─── Phone Side ─── */
SAB.visualiser.bindPhone = function () {
    var startBtn = SAB.$('visStartBtn');
    var stopBtn = SAB.$('visStopBtn');
    var freezeBtn = SAB.$('visFreezeBtn');
    var flipBtn = SAB.$('visFlipBtn');
    if (!startBtn) return;

    startBtn.addEventListener('click', function () {
        if (SAB.state.visStreaming) return;
        SAB.visualiser.startPhone();
    });
    if (stopBtn) stopBtn.addEventListener('click', function () { SAB.visualiser.stopPhone(); });
    if (freezeBtn) freezeBtn.addEventListener('click', function () { SAB.visualiser.toggleFreezePhone(); });
    if (flipBtn) flipBtn.addEventListener('click', function () { SAB.visualiser.flipCamera(); });
    var phoneCaptureBtn = SAB.$('visPhoneCaptureBtn');
    if (phoneCaptureBtn) phoneCaptureBtn.addEventListener('click', function () {
        if (!SAB.state.visStreaming || !SAB.state.visFrozen) return;
        SAB.connection.sendRemoteCmd({ type: 'visualiser_capture' });
        phoneCaptureBtn.textContent = '\u2713 Captured';
        setTimeout(function () { phoneCaptureBtn.textContent = '\uD83D\uDCF7 Capture'; }, 1500);
    });
    var phoneRotateBtn = SAB.$('visPhoneRotateBtn');
    if (phoneRotateBtn) phoneRotateBtn.addEventListener('click', function () {
        if (!SAB.state.visStreaming) return;
        SAB.connection.sendRemoteCmd({ type: 'visualiser_rotate' });
    });
};

SAB.visualiser.startPhone = function () {
    var state = SAB.state;
    var H = SAB.config.H;
    var cfg = SAB.config;
    var preview = SAB.$('visPreview');
    var placeholder = SAB.$('visPlaceholder');
    var startBtn = SAB.$('visStartBtn');
    var stopBtn = SAB.$('visStopBtn');
    var freezeBtn = SAB.$('visFreezeBtn');
    var flipBtn = SAB.$('visFlipBtn');

    if (!preview || !state.peer || !state.connected) {
        SAB.visualiser.showStatus('Not connected to a display.');
        return;
    }

    SAB.visualiser.showStatus('Starting camera\u2026');
    var constraints = {
        video: { facingMode: { ideal: state.visFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {
            state.visStream = stream;
            state.visStreaming = true;
            state.visFrozen = false;

            preview.srcObject = stream;
            preview.play().catch(function () {});
            if (placeholder) placeholder.classList.add(H + '_hidden');

            if (!visCaptureCanvas) {
                visCaptureCanvas = document.createElement('canvas');
                visCaptureCtx = visCaptureCanvas.getContext('2d');
            }

            SAB.connection.sendRemoteCmd({ type: 'visualiser_start' });

            setTimeout(function () {
                if (!state.visStreaming) return;
                state._visLastFrameTime = 0;
                (function tick(now) {
                    if (!state.visStreaming) return;
                    state.visFrameRaf = requestAnimationFrame(tick);
                    if (now - state._visLastFrameTime >= 1000 / cfg.VIS_FPS) {
                        state._visLastFrameTime = now;
                        SAB.visualiser.captureAndSendFrame();
                    }
                })(0);
                SAB.visualiser.showStatus('');
            }, 400);

            if (startBtn) startBtn.classList.add(H + '_hidden');
            if (stopBtn) stopBtn.classList.remove(H + '_hidden');
            if (freezeBtn) freezeBtn.classList.remove(H + '_hidden');
            if (flipBtn) flipBtn.classList.remove(H + '_hidden');
            var phoneRotateBtn = SAB.$('visPhoneRotateBtn');
            if (phoneRotateBtn) phoneRotateBtn.classList.remove(H + '_hidden');

            SAB.visualiser.requestWakeLock();
        })
        .catch(function (err) {
            console.warn('Visualiser camera error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                SAB.visualiser.showStatus('Camera permission denied. Check your browser settings.');
            } else {
                SAB.visualiser.showStatus('Could not access camera: ' + (err.message || 'Unknown error'));
            }
        });
};

SAB.visualiser.captureAndSendFrame = function () {
    var state = SAB.state;
    var cfg = SAB.config;
    if (!state.visStreaming || state.visFrozen) return;
    var preview = SAB.$('visPreview');
    if (!preview || !preview.videoWidth) return;

    if (state.conn && state.conn.dataChannel && state.conn.dataChannel.bufferedAmount > 128000) return;

    var vw = preview.videoWidth, vh = preview.videoHeight;
    var scale = Math.min(cfg.VIS_MAX_W / vw, cfg.VIS_MAX_H / vh, 1);
    var cw = Math.round(vw * scale);
    var ch = Math.round(vh * scale);
    if (visCaptureCanvas.width !== cw || visCaptureCanvas.height !== ch) {
        visCaptureCanvas.width = cw;
        visCaptureCanvas.height = ch;
    }

    visCaptureCtx.drawImage(preview, 0, 0, cw, ch);
    var dataUrl = visCaptureCanvas.toDataURL('image/webp', cfg.VIS_QUALITY);
    if (dataUrl.indexOf('data:image/webp') !== 0) {
        dataUrl = visCaptureCanvas.toDataURL('image/jpeg', cfg.VIS_QUALITY);
    }
    SAB.connection.sendRemoteCmd({ type: 'visualiser_frame', dataUrl: dataUrl });
};

SAB.visualiser.stopPhone = function () {
    var state = SAB.state;
    var H = SAB.config.H;
    var preview = SAB.$('visPreview');
    var placeholder = SAB.$('visPlaceholder');
    var startBtn = SAB.$('visStartBtn');
    var stopBtn = SAB.$('visStopBtn');
    var freezeBtn = SAB.$('visFreezeBtn');
    var flipBtn = SAB.$('visFlipBtn');
    var frozenBadge = SAB.$('visFrozenBadge');

    if (state.visFrameRaf) { cancelAnimationFrame(state.visFrameRaf); state.visFrameRaf = null; }

    if (state.visStream) {
        state.visStream.getTracks().forEach(function (t) { t.stop(); });
        state.visStream = null;
    }
    if (state.connected) SAB.connection.sendRemoteCmd({ type: 'visualiser_stop' });

    state.visStreaming = false;
    state.visFrozen = false;

    if (preview) preview.srcObject = null;
    if (placeholder) placeholder.classList.remove(H + '_hidden');
    if (startBtn) startBtn.classList.remove(H + '_hidden');
    if (stopBtn) stopBtn.classList.add(H + '_hidden');
    if (freezeBtn) { freezeBtn.classList.add(H + '_hidden'); freezeBtn.classList.remove(H + '_vis_is_frozen'); freezeBtn.textContent = '\u23F8 Freeze'; }
    if (flipBtn) flipBtn.classList.add(H + '_hidden');
    if (frozenBadge) frozenBadge.classList.add(H + '_hidden');
    var phoneCaptureBtn = SAB.$('visPhoneCaptureBtn');
    if (phoneCaptureBtn) { phoneCaptureBtn.classList.add(H + '_hidden'); phoneCaptureBtn.textContent = '\uD83D\uDCF7 Capture'; }
    var phoneRotateBtn = SAB.$('visPhoneRotateBtn');
    if (phoneRotateBtn) phoneRotateBtn.classList.add(H + '_hidden');
    SAB.visualiser.showStatus('');

    SAB.visualiser.releaseWakeLock();
};

SAB.visualiser.toggleFreezePhone = function () {
    var state = SAB.state;
    var H = SAB.config.H;
    var freezeBtn = SAB.$('visFreezeBtn');
    var frozenBadge = SAB.$('visFrozenBadge');
    var phoneCaptureBtn = SAB.$('visPhoneCaptureBtn');

    if (!state.visStreaming) return;
    state.visFrozen = !state.visFrozen;

    if (state.visFrozen) {
        SAB.connection.sendRemoteCmd({ type: 'visualiser_freeze' });
        if (freezeBtn) { freezeBtn.classList.add(H + '_vis_is_frozen'); freezeBtn.textContent = '\u25B6 Resume'; }
        if (frozenBadge) frozenBadge.classList.remove(H + '_hidden');
        if (phoneCaptureBtn) phoneCaptureBtn.classList.remove(H + '_hidden');
    } else {
        SAB.connection.sendRemoteCmd({ type: 'visualiser_unfreeze' });
        if (freezeBtn) { freezeBtn.classList.remove(H + '_vis_is_frozen'); freezeBtn.textContent = '\u23F8 Freeze'; }
        if (frozenBadge) frozenBadge.classList.add(H + '_hidden');
        if (phoneCaptureBtn) { phoneCaptureBtn.classList.add(H + '_hidden'); phoneCaptureBtn.textContent = '\uD83D\uDCF7 Capture'; }
    }
};

SAB.visualiser.flipCamera = function () {
    var state = SAB.state;
    if (!state.visStreaming) return;
    state.visFacingMode = (state.visFacingMode === 'environment') ? 'user' : 'environment';

    if (state.visFrameRaf) { cancelAnimationFrame(state.visFrameRaf); state.visFrameRaf = null; }
    if (state.visStream) { state.visStream.getTracks().forEach(function (t) { t.stop(); }); state.visStream = null; }
    state.visStreaming = false;
    state.visFrozen = false;
    SAB.visualiser.startPhone();
};

SAB.visualiser.showStatus = function (msg) {
    var H = SAB.config.H;
    var el = SAB.$('visStatus');
    if (!el) return;
    if (!msg) { el.classList.add(H + '_hidden'); el.textContent = ''; }
    else { el.textContent = msg; el.classList.remove(H + '_hidden'); }
};

SAB.visualiser.requestWakeLock = function () {
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen')
            .then(function (lock) { SAB.state.visWakeLock = lock; })
            .catch(function () {});
    }
};

SAB.visualiser.releaseWakeLock = function () {
    if (SAB.state.visWakeLock) {
        try { SAB.state.visWakeLock.release(); } catch (e) {}
        SAB.state.visWakeLock = null;
    }
};

/* ─── Display Side ─── */
SAB.visualiser.bindDisplay = function () {
    var H = SAB.config.H;
    var freezeBtn = SAB.$('visDisplayFreezeBtn');
    var rotateBtn = SAB.$('visDisplayRotateBtn');
    var endBtn = SAB.$('visDisplayEndBtn');
    if (freezeBtn) freezeBtn.addEventListener('click', function () {
        if (SAB.state.visFrozen) {
            SAB.visualiser.unfreezeDisplay();
            for (var i = 0; i < SAB.state.connections.length; i++) {
                try { SAB.state.connections[i].send({ type: 'visualiser_unfreeze_request' }); } catch (e) {}
            }
        } else {
            SAB.visualiser.freezeDisplay();
            for (var i = 0; i < SAB.state.connections.length; i++) {
                try { SAB.state.connections[i].send({ type: 'visualiser_freeze_request' }); } catch (e) {}
            }
        }
    });
    if (rotateBtn) rotateBtn.addEventListener('click', function () { SAB.visualiser.rotateDisplay(); });
    if (endBtn) endBtn.addEventListener('click', function () {
        SAB.visualiser.hideDisplay();
        for (var i = 0; i < SAB.state.connections.length; i++) {
            try { SAB.state.connections[i].send({ type: 'visualiser_end_request' }); } catch (e) {}
        }
    });
    var captureBtn = SAB.$('visDisplayCaptureBtn');
    if (captureBtn) captureBtn.addEventListener('click', function () { SAB.visualiser.captureFrame(); });
};

SAB.visualiser.captureFrame = function () {
    var state = SAB.state;
    var img = SAB.$('visDisplayImg');
    if (!img || !img.src || !state.visFrozen) return;
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) { SAB.photos.addPhoto(img.src); return; }

    var deg = state.visRotation || 0;
    var swapped = (deg === 90 || deg === 270);
    var capCanvas = document.createElement('canvas');
    capCanvas.width  = swapped ? ih : iw;
    capCanvas.height = swapped ? iw : ih;
    var capCtx = capCanvas.getContext('2d');

    capCtx.translate(capCanvas.width / 2, capCanvas.height / 2);
    capCtx.rotate(deg * Math.PI / 180);
    capCtx.drawImage(img, -iw / 2, -ih / 2, iw, ih);

    var hiResUrl = capCanvas.toDataURL('image/jpeg', 0.92);
    SAB.photos.addPhoto(hiResUrl);
    SAB.utils.showToast('Frame captured as photo ' + SAB.state.photos.length);
};

SAB.visualiser.showDisplay = function () {
    var H = SAB.config.H;
    var wrap = SAB.$('visDisplayWrap');
    var bar = SAB.$('visDisplayBar');
    if (!wrap) return;

    SAB.toolbar.hideWelcome();
    wrap.classList.remove(H + '_hidden');
    if (bar) bar.classList.remove(H + '_hidden');
    SAB.state.visFrozen = false;
    SAB.state.visRotation = 0;
    SAB.visualiser.applyRotation();
    SAB.visualiser.updateBarUI();
    SAB.visualiser.resetBarFade();
};

SAB.visualiser.updateFrame = function (dataUrl) {
    if (SAB.state.visFrozen) return;
    var img = SAB.$('visDisplayImg');
    if (img) img.src = dataUrl;
};

SAB.visualiser.hideDisplay = function () {
    var H = SAB.config.H;
    var wrap = SAB.$('visDisplayWrap');
    var img = SAB.$('visDisplayImg');
    var bar = SAB.$('visDisplayBar');

    if (img) img.src = '';
    if (wrap) wrap.classList.add(H + '_hidden');
    if (bar) bar.classList.add(H + '_hidden');
    SAB.visualiser.stopBarFade();

    SAB.state.visFrozen = false;
    SAB.state.visRotation = 0;
    SAB.visualiser.applyRotation();
};

SAB.visualiser.freezeDisplay = function () {
    SAB.state.visFrozen = true;
    SAB.visualiser.updateBarUI();
    SAB.visualiser.resetBarFade();
};

SAB.visualiser.unfreezeDisplay = function () {
    SAB.state.visFrozen = false;
    SAB.visualiser.updateBarUI();
    SAB.visualiser.resetBarFade();
};

SAB.visualiser.rotateDisplay = function () {
    SAB.state.visRotation = (SAB.state.visRotation + 90) % 360;
    SAB.visualiser.applyRotation();
    SAB.visualiser.resetBarFade();
};

SAB.visualiser.applyRotation = function () {
    var wrap = SAB.$('visDisplayWrap');
    if (!wrap) return;
    var deg = SAB.state.visRotation;
    var parent = wrap.parentElement;
    if (!parent) return;
    var cw = parent.clientWidth;
    var ch = parent.clientHeight;

    if (deg === 0) {
        wrap.style.transform = '';
        wrap.style.width = '';
        wrap.style.height = '';
        wrap.style.top = '';
        wrap.style.left = '';
    } else if (deg === 90 || deg === 270) {
        wrap.style.width = ch + 'px';
        wrap.style.height = cw + 'px';
        wrap.style.top = ((ch - cw) / 2) + 'px';
        wrap.style.left = ((cw - ch) / 2) + 'px';
        wrap.style.transform = 'rotate(' + deg + 'deg)';
    } else {
        wrap.style.transform = 'rotate(180deg)';
        wrap.style.width = '';
        wrap.style.height = '';
        wrap.style.top = '';
        wrap.style.left = '';
    }
};

SAB.visualiser.updateBarUI = function () {
    var H = SAB.config.H;
    var dot = SAB.$('visLiveDot');
    var label = SAB.$('visBarLabel');
    var freezeBtn = SAB.$('visDisplayFreezeBtn');
    var captureBtn = SAB.$('visDisplayCaptureBtn');
    if (SAB.state.visFrozen) {
        if (dot) dot.classList.add(H + '_vis_dot_frozen');
        if (label) label.textContent = 'FROZEN';
        if (freezeBtn) freezeBtn.textContent = '\u25B6 Resume';
        if (captureBtn) captureBtn.classList.remove(H + '_hidden');
    } else {
        if (dot) dot.classList.remove(H + '_vis_dot_frozen');
        if (label) label.textContent = 'LIVE';
        if (freezeBtn) freezeBtn.textContent = '\u23F8 Freeze';
        if (captureBtn) captureBtn.classList.add(H + '_hidden');
    }
};

/* ─── Bar Auto-Fade ─── */
SAB.visualiser.resetBarFade = function () {
    var H = SAB.config.H;
    var bar = SAB.$('visDisplayBar');
    if (!bar || bar.classList.contains(H + '_hidden')) return;
    bar.classList.remove(H + '_vis_bar_faded');
    clearTimeout(SAB.state.visBarFadeTimer);
    SAB.state.visBarFadeTimer = setTimeout(function () {
        if (bar && !bar.classList.contains(H + '_hidden')) {
            bar.classList.add(H + '_vis_bar_faded');
        }
    }, 3000);
};

SAB.visualiser.stopBarFade = function () {
    clearTimeout(SAB.state.visBarFadeTimer);
    SAB.state.visBarFadeTimer = null;
    var bar = SAB.$('visDisplayBar');
    if (bar) bar.classList.remove(SAB.config.H + '_vis_bar_faded');
};

SAB.visualiser.initBarFadeListeners = function () {
    var H = SAB.config.H;
    var area = SAB.els.canvasArea;
    if (!area) return;
    var events = ['mousemove', 'mousedown', 'touchstart'];
    for (var i = 0; i < events.length; i++) {
        area.addEventListener(events[i], function () {
            var bar = SAB.$('visDisplayBar');
            if (bar && !bar.classList.contains(H + '_hidden')) {
                SAB.visualiser.resetBarFade();
            }
        }, { passive: true });
    }
};
