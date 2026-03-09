/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Main Application (Init & Boot)
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.app = {};

/* ─── Element Registry ─── */
var elNames = [
    'canvasArea', 'drawCanvas', 'photoLayer', 'stampLayer', 'textLayer', 'welcome',
    'roomCodeBig', 'roomCodeSmall', 'roomBadge', 'statusDot', 'waiting', 'pageUrl', 'qr',
    'loadPhotoBtn', 'saveBtn', 'clearAllBtn', 'hideAllBtn',
    'photoCount', 'pagePills',
    'phonePanel', 'phoneConnect', 'phoneConnected', 'phoneError',
    'codeInput', 'connectBtn', 'disconnectBtn',
    'takePhotoBtn', 'choosePhotoBtn', 'camCapture', 'camLibrary',
    'sendingStatus', 'sentThumbs',
    'undoBtn', 'redoBtn', 'clearDrawBtn',
    'desktopFileInput',
    'spotlightOverlay', 'spotlightBtn', 'spotlightMinus', 'spotlightPlus',
    'lockBtn', 'shortcutHelpBtn', 'helpBtn', 'toast'
];

function populateElements() {
    for (var i = 0; i < elNames.length; i++) {
        SAB.els[elNames[i]] = SAB.$(elNames[i]);
    }
    SAB.els.app = document.getElementById(SAB.config.H + '_app');
    SAB.els.ctx = SAB.els.drawCanvas ? SAB.els.drawCanvas.getContext('2d') : null;
}

/* ─── Role Detection ─── */
SAB.app.detectRole = function () {
    var params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'display') { SAB.app.setRole('display'); return; }
    if (params.get('role') === 'camera') { SAB.app.setRole('camera'); return; }
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    var isTouchDevice = isMobile || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    SAB.app.setRole(isTouchDevice ? 'camera' : 'display');
};

SAB.app.setRole = function (role) {
    var H = SAB.config.H;
    SAB.state.role = role;
    SAB.els.app.classList.remove(H + '_role_camera', H + '_role_display');
    SAB.els.app.classList.add(H + '_role_' + role);
};

/* ─── Init ─── */
function init() {
    populateElements();
    if (!SAB.els.app) return;
    document.body.style.overflow = 'hidden';

    var H = SAB.config.H;
    var canvasArea = SAB.els.canvasArea;

    /* Floating zoom navigation buttons */
    var zoomBackBtn = document.createElement('button');
    zoomBackBtn.className = H + '_zoom_back_btn';
    zoomBackBtn.textContent = '\u2190 All';
    zoomBackBtn.setAttribute('title', 'Back to grid (Esc)');
    zoomBackBtn.addEventListener('click', function (e) { e.stopPropagation(); SAB.photos.unzoomPhoto(); });
    canvasArea.appendChild(zoomBackBtn);

    var zoomPrevBtn = document.createElement('button');
    zoomPrevBtn.className = H + '_zoom_nav_btn ' + H + '_zoom_prev';
    zoomPrevBtn.textContent = '\u2039';
    zoomPrevBtn.setAttribute('title', 'Previous photo (\u2190)');
    zoomPrevBtn.addEventListener('click', function (e) { e.stopPropagation(); SAB.photos.cycleZoom(-1); });
    canvasArea.appendChild(zoomPrevBtn);

    var zoomNextBtn = document.createElement('button');
    zoomNextBtn.className = H + '_zoom_nav_btn ' + H + '_zoom_next';
    zoomNextBtn.textContent = '\u203A';
    zoomNextBtn.setAttribute('title', 'Next photo (\u2192)');
    zoomNextBtn.addEventListener('click', function (e) { e.stopPropagation(); SAB.photos.cycleZoom(1); });
    canvasArea.appendChild(zoomNextBtn);

    SAB.app.detectRole();
    SAB.pages.initPages();
    SAB.drawing.resizeCanvas();
    window.addEventListener('resize', SAB.drawing.resizeCanvas);

    if (SAB.els.pageUrl) SAB.els.pageUrl.textContent = SAB.config.BASE_URL;

    SAB.toolbar.bindToolbar();
    SAB.drawing.bindDrawing();
    SAB.phone.bindPhone();
    SAB.drawing.bindSpotlight();
    SAB.toolbar.bindLock();
    SAB.toolbar.bindMoreToggle();
    SAB.toolbar.bindStampToggle();
    SAB.phone.bindRemoteDraw();
    SAB.visualiser.bindPhone();
    SAB.visualiser.bindDisplay();
    SAB.visualiser.initBarFadeListeners();

    SAB.connection.loadPeerJS(function () {
        if (SAB.state.role === 'display') SAB.connection.initDisplay();
        if (SAB.state.role === 'camera') {
            var params = new URLSearchParams(window.location.search);
            var autoCode = (params.get('code') || '').trim().toUpperCase();
            if (autoCode.length === SAB.config.CODE_LEN && /^[A-Z0-9]+$/.test(autoCode)) {
                if (SAB.els.codeInput) SAB.els.codeInput.value = autoCode;
                SAB.connection.connectToRoom(autoCode);
            }
        }
    });
}

/* ─── Boot ─── */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
