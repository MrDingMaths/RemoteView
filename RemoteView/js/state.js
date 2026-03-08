/* ═══════════════════════════════════════════════════════════════════════
   SHOW ALL BOARD — State Management
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.state = {
    role: null,
    roomCode: '',
    connected: false,
    peer: null,
    connections: [],
    conn: null,
    photos: [],
    strokes: [],
    stamps: [],
    texts: [],
    currentStroke: null,
    lineStart: null,
    tool: 'pen',
    penColor: '#2c3e50',
    penWidth: 3,
    stampChar: '\u2713',
    isDrawing: false,
    peerReady: false,
    welcomeVisible: true,
    clearConfirm: false,
    clearTimer: null,
    background: 'white',
    reconnectCode: null,
    undoStack: [],
    redoStack: [],
    spotlight: false,
    spotlightX: 0.5,
    spotlightY: 0.5,
    spotlightR: 120,
    locked: false,
    localDisplay: false,
    visStreaming: false,
    visFrozen: false,
    visStream: null,
    visFrameTimer: null,
    visFacingMode: 'environment',
    visWakeLock: null,
    visRotation: 0,
    visBarFadeTimer: null,
    zoomedPhotoId: null,
    pages: [],
    activePage: 0
};

SAB.phonePhotoSeq = 0;

/* DOM element registry — populated during init */
SAB.els = {};

/* Remote draw state (phone annotation canvas) */
SAB.remote = {
    canvas: null,
    ctx: null,
    tool: 'pen',
    color: '#2c3e50',
    width: 4,
    stampChar: '\u2713',
    isDrawing: false,
    currentStroke: null,
    lineStart: null,
    strokes: [],
    bgImage: null
};
