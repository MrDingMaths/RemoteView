/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Utility Functions
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.utils = {};

SAB.$ = function (id) {
    return document.getElementById(SAB.config.H + '_' + id);
};

/* ─── Toast Notification ─── */
var toastTimer;

SAB.utils.showToast = function (msg, duration) {
    var el = SAB.els.toast;
    if (!el) return;
    duration = duration || 2500;
    el.textContent = msg;
    el.classList.add(SAB.cls('toast_on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        el.classList.remove(SAB.cls('toast_on'));
    }, duration);
};

/* ─── QR Code SVG Generator ─── */
SAB.utils.makeQRSvg = function (text) {
    if (typeof qrcode !== 'function') return '';
    var qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    var size = qr.getModuleCount();
    var quiet = 2, total = size + quiet * 2;
    var paths = [];
    for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
            if (qr.isDark(y, x)) paths.push('M' + (x + quiet) + ',' + (y + quiet) + 'h1v1h-1z');
        }
    }
    return '<svg viewBox="0 0 ' + total + ' ' + total +
        '" xmlns="http://www.w3.org/2000/svg"><rect width="' + total + '" height="' + total +
        '" fill="#fff"/><path d="' + paths.join('') + '" fill="#2c3e50"/></svg>';
};

/* ─── Image Processing ─── */
SAB.utils.processImageFile = function (file, callback) {
    if (typeof createImageBitmap === 'function') {
        createImageBitmap(file, { imageOrientation: 'from-image' })
            .then(function (bmp) { SAB.utils.renderToDataUrl(bmp, bmp.width, bmp.height, callback); })
            .catch(function () { SAB.utils.processImageFileFallback(file, callback); });
    } else {
        SAB.utils.processImageFileFallback(file, callback);
    }
};

SAB.utils.processImageFileFallback = function (file, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
        var img = new Image();
        img.onload = function () { SAB.utils.renderToDataUrl(img, img.width, img.height, callback); };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

SAB.utils.renderToDataUrl = function (source, origW, origH, callback) {
    var cfg = SAB.config;
    var w = origW, h = origH;
    if (w > cfg.MAX_IMAGE_DIM || h > cfg.MAX_IMAGE_DIM) {
        var scale = cfg.MAX_IMAGE_DIM / Math.max(w, h);
        w = Math.round(w * scale); h = Math.round(h * scale);
    }
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(source, 0, 0, w, h);
    callback(c.toDataURL('image/jpeg', cfg.JPEG_QUALITY));
};

SAB.utils.rotateDataUrl = function (dataUrl, callback) {
    var img = new Image();
    img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.height; c.height = img.width;
        var cx = c.getContext('2d');
        cx.translate(c.width / 2, c.height / 2);
        cx.rotate(Math.PI / 2);
        cx.drawImage(img, -img.width / 2, -img.height / 2);
        callback(c.toDataURL('image/jpeg', SAB.config.JPEG_QUALITY));
    };
    img.src = dataUrl;
};

/* ─── Keyboard Helper ─── */
SAB.utils.isTypingTarget = function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || e.target.contentEditable === 'true';
};

/* ─── Photo Button Factory ─── */
SAB.utils.makePhotoBtn = function (text, cls, handler) {
    var H = SAB.config.H;
    var btn = document.createElement('button');
    btn.className = H + '_photo_btn ' + cls;
    btn.textContent = text;
    btn.addEventListener('click', function (e) { e.stopPropagation(); handler(); });
    return btn;
};
