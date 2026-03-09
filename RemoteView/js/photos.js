/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Photo Management
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.photos = {};

SAB.photos.addPhoto = function (dataUrl, seq) {
    var state = SAB.state;
    var cfg = SAB.config;
    if (state.photos.length >= cfg.MAX_PHOTOS) {
        var oldest = state.photos.shift();
        if (oldest.slotEl && oldest.slotEl.parentNode) oldest.slotEl.parentNode.removeChild(oldest.slotEl);
        SAB.utils.showToast('Photo limit reached \u2014 oldest removed');
    }
    var p = { id: 'p_' + Date.now(), dataUrl: dataUrl, hidden: false, slotEl: null };
    if (seq != null) p.seq = seq;
    state.photos.push(p);
    SAB.photos.layoutPhotos();
    SAB.toolbar.hideWelcome();
    SAB.photos.updatePhotoCount();
};

SAB.photos.findPhotoBySeq = function (seq) {
    return SAB.state.photos.find(function (p) { return p.seq === seq; });
};

SAB.photos.removePhoto = function (id) {
    var state = SAB.state;
    state.photos = state.photos.filter(function (p) {
        if (p.id === id && p.slotEl && p.slotEl.parentNode) p.slotEl.parentNode.removeChild(p.slotEl);
        return p.id !== id;
    });
    SAB.photos.layoutPhotos();
    SAB.photos.updatePhotoCount();
    if (!state.localDisplay && !state.connected && state.photos.length === 0 &&
        state.strokes.length === 0 && state.stamps.length === 0 && state.texts.length === 0) {
        SAB.toolbar.showWelcome();
    }
};

SAB.photos.rotatePhoto = function (id) {
    var photo = SAB.state.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    SAB.utils.rotateDataUrl(photo.dataUrl, function (newUrl) {
        photo.dataUrl = newUrl;
        SAB.photos.layoutPhotos();
    });
};

SAB.photos.downloadPhoto = function (id) {
    var photo = SAB.state.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    var idx = SAB.state.photos.indexOf(photo) + 1;
    var a = document.createElement('a');
    a.href = photo.dataUrl;
    a.download = 'photo_' + idx + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

SAB.photos.togglePhotoHide = function (id) {
    var photo = SAB.state.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    photo.hidden = !photo.hidden;
    SAB.photos.layoutPhotos();
};

SAB.photos.updatePhotoCount = function () {
    if (SAB.els.photoCount) SAB.els.photoCount.textContent = SAB.state.photos.length + ' / ' + SAB.config.MAX_PHOTOS + ' photos';
    SAB.photos.updateHideAllBtn();
};

SAB.photos.hideAllPhotos = function () {
    if (SAB.state.photos.length === 0) return;
    SAB.state.photos.forEach(function (p) { p.hidden = true; });
    SAB.photos.layoutPhotos();
};

SAB.photos.showAllPhotos = function () {
    SAB.state.photos.forEach(function (p) { p.hidden = false; });
    SAB.photos.layoutPhotos();
};

SAB.photos.updateHideAllBtn = function () {
    var H = SAB.config.H;
    var hideAllBtn = SAB.els.hideAllBtn;
    if (!hideAllBtn) return;
    if (SAB.state.photos.length === 0) {
        hideAllBtn.classList.remove(H + '_visible');
        return;
    }
    hideAllBtn.classList.add(H + '_visible');
    var allHidden = SAB.state.photos.every(function (p) { return p.hidden; });
    if (allHidden) {
        hideAllBtn.innerHTML = '\uD83D\uDC41\uFE0F Show All';
        hideAllBtn.classList.add(H + '_all_hidden');
    } else {
        hideAllBtn.innerHTML = '\uD83D\uDE48 Hide All';
        hideAllBtn.classList.remove(H + '_all_hidden');
    }
};

/* ─── Photo Zoom ─── */
SAB.photos.zoomPhoto = function (id) {
    var state = SAB.state;
    var H = SAB.config.H;
    var canvasArea = SAB.els.canvasArea;
    if (state.zoomedPhotoId) return;
    if (state.photos.length <= 1) return;
    var photo = state.photos.find(function (p) { return p.id === id; });
    if (!photo || !photo.slotEl || photo.hidden) return;

    state.zoomedPhotoId = id;
    var areaW = canvasArea.clientWidth;
    var areaH = canvasArea.clientHeight;
    var pad = 16;

    canvasArea.classList.add(H + '_zoom_active');

    state.photos.forEach(function (p, idx) {
        if (!p.slotEl) return;
        p._gridStyle = p.slotEl.style.cssText;
        if (p.id === id) {
            p.slotEl.style.left   = pad + 'px';
            p.slotEl.style.top    = pad + 'px';
            p.slotEl.style.width  = (areaW - pad * 2) + 'px';
            p.slotEl.style.height = (areaH - pad * 2) + 'px';
            p.slotEl.classList.add(H + '_photo_zoomed');
            var backBtn = canvasArea.querySelector('.' + H + '_zoom_back_btn');
            if (backBtn) backBtn.textContent = '\u2190 ' + (idx + 1) + ' / ' + state.photos.length;
        } else {
            p.slotEl.classList.add(H + '_photo_dimmed');
        }
    });
    SAB.photos.broadcastZoomState();
};

SAB.photos.unzoomPhoto = function () {
    var state = SAB.state;
    var H = SAB.config.H;
    var canvasArea = SAB.els.canvasArea;
    if (!state.zoomedPhotoId) return;
    state.zoomedPhotoId = null;

    canvasArea.classList.remove(H + '_zoom_active');
    var backBtn = canvasArea.querySelector('.' + H + '_zoom_back_btn');
    if (backBtn) backBtn.textContent = '\u2190 All';

    state.photos.forEach(function (p) {
        if (!p.slotEl) return;
        if (p._gridStyle) {
            p.slotEl.style.cssText = p._gridStyle;
            delete p._gridStyle;
        }
        p.slotEl.classList.remove(H + '_photo_zoomed');
        p.slotEl.classList.remove(H + '_photo_dimmed');
    });
    SAB.photos.broadcastZoomState();
};

SAB.photos.broadcastZoomState = function () {
    var state = SAB.state;
    var seq = null;
    if (state.zoomedPhotoId) {
        var zp = state.photos.find(function (p) { return p.id === state.zoomedPhotoId; });
        if (zp && zp.seq != null) seq = zp.seq;
    }
    for (var i = 0; i < state.connections.length; i++) {
        try { state.connections[i].send({ type: 'zoom_sync', seq: seq }); } catch (e) {}
    }
};

SAB.photos.cycleZoom = function (dir) {
    var state = SAB.state;
    if (!state.zoomedPhotoId) return;
    var curIdx = state.photos.findIndex(function (p) { return p.id === state.zoomedPhotoId; });
    if (curIdx === -1) return;
    var n = state.photos.length;
    for (var step = 1; step < n; step++) {
        var nextIdx = (curIdx + dir * step + n) % n;
        if (!state.photos[nextIdx].hidden) {
            SAB.photos.unzoomPhoto();
            SAB.photos.zoomPhoto(state.photos[nextIdx].id);
            return;
        }
    }
};

/* ─── Photo Grid Layout ─── */
SAB.photos.layoutPhotos = function () {
    var state = SAB.state;
    var H = SAB.config.H;
    var canvasArea = SAB.els.canvasArea;
    var photoLayer = SAB.els.photoLayer;

    state.zoomedPhotoId = null;
    canvasArea.classList.remove(H + '_zoom_active');
    SAB.photos.broadcastZoomState();
    photoLayer.innerHTML = '';
    var n = state.photos.length;
    if (n === 0) return;

    var areaW = canvasArea.clientWidth;
    var areaH = canvasArea.clientHeight;
    var pad = 16, gap = 10;

    var slots = [];
    if (n === 1) {
        slots = [{ x: pad, y: pad, w: areaW - pad * 2, h: areaH - pad * 2 }];
    } else if (n === 2) {
        var hw = (areaW - pad * 2 - gap) / 2;
        slots = [
            { x: pad, y: pad, w: hw, h: areaH - pad * 2 },
            { x: pad + hw + gap, y: pad, w: hw, h: areaH - pad * 2 }
        ];
    } else if (n === 3) {
        var lw3 = (areaW - pad * 2 - gap) * 0.55;
        var rw3 = areaW - pad * 2 - gap - lw3;
        var rh3 = (areaH - pad * 2 - gap) / 2;
        slots = [
            { x: pad, y: pad, w: lw3, h: areaH - pad * 2 },
            { x: pad + lw3 + gap, y: pad, w: rw3, h: rh3 },
            { x: pad + lw3 + gap, y: pad + rh3 + gap, w: rw3, h: rh3 }
        ];
    } else if (n === 4) {
        var hw4 = (areaW - pad * 2 - gap) / 2;
        var hh4 = (areaH - pad * 2 - gap) / 2;
        slots = [
            { x: pad, y: pad, w: hw4, h: hh4 },
            { x: pad + hw4 + gap, y: pad, w: hw4, h: hh4 },
            { x: pad, y: pad + hh4 + gap, w: hw4, h: hh4 },
            { x: pad + hw4 + gap, y: pad + hh4 + gap, w: hw4, h: hh4 }
        ];
    } else if (n === 5) {
        var cw5 = (areaW - pad * 2 - 2 * gap) / 3;
        var rh5 = (areaH - pad * 2 - gap) / 2;
        var off5 = pad + (cw5 + gap) / 2;
        for (var c5 = 0; c5 < 3; c5++) slots.push({ x: pad + c5 * (cw5 + gap), y: pad, w: cw5, h: rh5 });
        for (var c5b = 0; c5b < 2; c5b++) slots.push({ x: off5 + c5b * (cw5 + gap), y: pad + rh5 + gap, w: cw5, h: rh5 });
    } else if (n === 6) {
        var cw6 = (areaW - pad * 2 - 2 * gap) / 3;
        var rh6 = (areaH - pad * 2 - gap) / 2;
        for (var r6 = 0; r6 < 2; r6++)
            for (var c6 = 0; c6 < 3; c6++)
                slots.push({ x: pad + c6 * (cw6 + gap), y: pad + r6 * (rh6 + gap), w: cw6, h: rh6 });
    } else if (n === 7) {
        var cw7 = (areaW - pad * 2 - 3 * gap) / 4;
        var rh7 = (areaH - pad * 2 - gap) / 2;
        var off7 = pad + (cw7 + gap) / 2;
        for (var c7 = 0; c7 < 4; c7++) slots.push({ x: pad + c7 * (cw7 + gap), y: pad, w: cw7, h: rh7 });
        for (var c7b = 0; c7b < 3; c7b++) slots.push({ x: off7 + c7b * (cw7 + gap), y: pad + rh7 + gap, w: cw7, h: rh7 });
    } else {
        var cw8 = (areaW - pad * 2 - 3 * gap) / 4;
        var rh8 = (areaH - pad * 2 - gap) / 2;
        for (var r8 = 0; r8 < 2; r8++)
            for (var c8 = 0; c8 < 4; c8++)
                slots.push({ x: pad + c8 * (cw8 + gap), y: pad + r8 * (rh8 + gap), w: cw8, h: rh8 });
    }

    state.photos.forEach(function (photo, i) {
        if (i >= slots.length) return;
        var s = slots[i];
        var slot = document.createElement('div');
        slot.className = H + '_photo_slot ' + H + '_photo_new' + (photo.hidden ? ' ' + H + '_photo_hidden' : '');
        slot.style.cssText = 'left:' + s.x + 'px;top:' + s.y + 'px;width:' + s.w + 'px;height:' + s.h + 'px;';

        var img = document.createElement('img');
        img.src = photo.dataUrl;

        var cover = document.createElement('div');
        cover.className = H + '_photo_cover';
        cover.innerHTML = '<span class="' + H + '_photo_cover_num">' + (i + 1) + '</span><span class="' + H + '_photo_cover_label">Tap to reveal</span>';
        cover.addEventListener('click', function (e) { e.stopPropagation(); SAB.photos.togglePhotoHide(photo.id); });

        var rotBtn = SAB.utils.makePhotoBtn('\u21BB', H + '_photo_rotate', function () { SAB.photos.rotatePhoto(photo.id); });
        var hideBtn = SAB.utils.makePhotoBtn(photo.hidden ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDE48', H + '_photo_hide' + (photo.hidden ? ' ' + H + '_hiding' : ''), function () { SAB.photos.togglePhotoHide(photo.id); });
        var delBtn = SAB.utils.makePhotoBtn('\u2715', H + '_photo_remove', function () { SAB.photos.removePhoto(photo.id); });
        var dlBtn = SAB.utils.makePhotoBtn('\u2B07', H + '_photo_download', function () { SAB.photos.downloadPhoto(photo.id); });
        dlBtn.setAttribute('title', 'Download photo');

        var numBadge = document.createElement('button');
        numBadge.className = H + '_photo_num_badge';
        numBadge.textContent = i + 1;
        numBadge.setAttribute('title', 'Zoom in');
        (function (pid) {
            numBadge.addEventListener('click', function (e) {
                e.stopPropagation();
                if (state.zoomedPhotoId === pid) SAB.photos.unzoomPhoto();
                else if (!state.zoomedPhotoId) SAB.photos.zoomPhoto(pid);
            });
        })(photo.id);

        slot.appendChild(img);
        slot.appendChild(cover);
        slot.appendChild(numBadge);
        slot.appendChild(rotBtn);
        slot.appendChild(hideBtn);
        slot.appendChild(delBtn);
        slot.appendChild(dlBtn);
        photoLayer.appendChild(slot);
        photo.slotEl = slot;

        SAB.photos.bindSlotHover(slot);

        setTimeout(function () { slot.classList.remove(H + '_photo_new'); }, 500);
    });
    SAB.photos.updateHideAllBtn();
};

SAB.photos.bindSlotHover = function (slot) {
    var H = SAB.config.H;
    var timer = null;
    var GRACE = 450;
    var cls = H + '_slot_hover';

    function enter() { clearTimeout(timer); slot.classList.add(cls); }
    function leave() { clearTimeout(timer); timer = setTimeout(function () { slot.classList.remove(cls); }, GRACE); }

    var targets = slot.querySelectorAll('.' + H + '_photo_btn, .' + H + '_photo_num_badge');
    for (var i = 0; i < targets.length; i++) {
        targets[i].addEventListener('mouseenter', enter);
        targets[i].addEventListener('mouseleave', leave);
    }
};
