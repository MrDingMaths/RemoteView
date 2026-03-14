/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Configuration & Constants
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.config = {
    H: 'show_mB4x',
    MAX_PHOTOS: 8,
    MAX_PAGES: 3,
    MAX_IMAGE_DIM: 1600,
    JPEG_QUALITY: 0.82,
    PEER_PREFIX: 'showallboard-',
    BASE_URL: location.href.split('?')[0],
    PEERJS_CDN: 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
    CHUNK_SIZE: 60000,
    CODE_CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
    CODE_LEN: 6,
    STAMP_COLORS: { '\u2713': '#38a169', '\u2717': '#e53e3e', '?': '#2b6cb0', '\u2605': '#d69e2e' },
    PEN_COLORS: ['#2c3e50', '#2b6cb0', '#e53e3e', '#38a169'],
    VIS_FPS: 24,
    VIS_QUALITY: 0.75,
    VIS_MAX_W: 1280,
    VIS_MAX_H: 960,
    MAX_UNDO: 100
};

SAB.cls = function (name) { return SAB.config.H + '_' + name; };
