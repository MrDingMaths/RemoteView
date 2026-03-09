/* ═══════════════════════════════════════════════════════════════════════
   BEAMIT — Canvas Drawing Engine
   ═══════════════════════════════════════════════════════════════════════ */
window.SAB = window.SAB || {};

SAB.drawing = {};

SAB.drawing.resizeCanvas = function () {
    var drawCanvas = SAB.els.drawCanvas;
    var canvasArea = SAB.els.canvasArea;
    if (!drawCanvas || !canvasArea) return;
    var w = canvasArea.clientWidth, h = canvasArea.clientHeight;
    if (w === 0 || h === 0) return;
    drawCanvas.width = w;
    drawCanvas.height = h;
    SAB.drawing.redrawStrokes();
    if (SAB.state.spotlight) SAB.drawing.renderSpotlight();
    if (SAB.state.visRotation) SAB.visualiser.applyRotation();
};

SAB.drawing.redrawStrokes = function () {
    var ctx = SAB.els.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, SAB.els.drawCanvas.width, SAB.els.drawCanvas.height);
    SAB.state.strokes.forEach(function (s) { SAB.drawing.drawStroke(s); });
};

SAB.drawing.drawArrowhead = function (cx, fromX, fromY, toX, toY, size) {
    var angle = Math.atan2(toY - fromY, toX - fromX);
    cx.beginPath();
    cx.moveTo(toX, toY);
    cx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
    cx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
    cx.closePath();
    cx.fill();
};

SAB.drawing.drawStroke = function (stroke) {
    if (!stroke.points || stroke.points.length < 2) return;
    var drawCanvas = SAB.els.drawCanvas;
    var ctx = SAB.els.ctx;
    var w = drawCanvas.width, h = drawCanvas.height;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = stroke.width * 3;
    } else if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,230,0,0.35)';
        ctx.lineWidth = stroke.width * 4;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (var i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
    }
    ctx.stroke();

    if (stroke.tool === 'arrow' && stroke.points.length >= 2) {
        var p0 = stroke.points[0], p1 = stroke.points[1];
        ctx.fillStyle = stroke.color;
        SAB.drawing.drawArrowhead(ctx, p0.x * w, p0.y * h, p1.x * w, p1.y * h, Math.max(12, stroke.width * 4));
    }

    ctx.restore();
};

SAB.drawing.getPointerPos = function (e) {
    var drawCanvas = SAB.els.drawCanvas;
    var rect = drawCanvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx / drawCanvas.width, y: cy / drawCanvas.height };
};

SAB.drawing.startDrawing = function (e) {
    var state = SAB.state;
    if (state.role === 'camera') return;
    if (state.locked) return;
    e.preventDefault();

    var pos = SAB.drawing.getPointerPos(e);

    if (state.tool === 'stamp') {
        SAB.toolbar.hideWelcome();
        SAB.annotations.placeStamp(state.stampChar, pos.x, pos.y);
        return;
    }

    if (state.tool === 'text') {
        SAB.toolbar.hideWelcome();
        SAB.annotations.placeText(pos.x, pos.y);
        return;
    }

    if (state.tool === 'arrow') {
        SAB.toolbar.hideWelcome();
        state.lineStart = pos;
        state.isDrawing = true;
        return;
    }

    if (state.tool === 'eraser') {
        SAB.toolbar.hideWelcome();
        state.isDrawing = true;
        SAB.drawing.eraseStrokeAt(pos);
        return;
    }

    SAB.toolbar.hideWelcome();
    state.isDrawing = true;
    state.currentStroke = {
        points: [pos],
        color: state.penColor,
        width: state.penWidth,
        tool: state.tool
    };
};

SAB.drawing.continueDrawing = function (e) {
    var state = SAB.state;
    if (!state.isDrawing) return;
    e.preventDefault();
    var pos = SAB.drawing.getPointerPos(e);
    var drawCanvas = SAB.els.drawCanvas;
    var ctx = SAB.els.ctx;

    if (state.tool === 'eraser') {
        SAB.drawing.eraseStrokeAt(pos);
        return;
    }

    if (state.tool === 'arrow' && state.lineStart) {
        SAB.drawing.redrawStrokes();
        var w = drawCanvas.width, h = drawCanvas.height;
        var sx = state.lineStart.x * w, sy = state.lineStart.y * h;
        var ex = pos.x * w, ey = pos.y * h;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = state.penColor;
        ctx.lineWidth = state.penWidth;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = state.penColor;
        SAB.drawing.drawArrowhead(ctx, sx, sy, ex, ey, Math.max(12, state.penWidth * 4));
        ctx.restore();
        return;
    }

    if (!state.currentStroke) return;
    state.currentStroke.points.push(pos);

    var pts = state.currentStroke.points;
    var w = drawCanvas.width, h = drawCanvas.height;

    if (state.currentStroke.tool === 'highlighter') {
        SAB.drawing.redrawStrokes();
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,230,0,0.35)';
        ctx.lineWidth = state.currentStroke.width * 4;
        ctx.beginPath();
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x * w, pts[j].y * h);
        ctx.stroke();
        ctx.restore();
        return;
    }

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = state.currentStroke.color;
    ctx.lineWidth = state.currentStroke.width;
    if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 2].x * w, pts[pts.length - 2].y * h);
        ctx.lineTo(pts[pts.length - 1].x * w, pts[pts.length - 1].y * h);
        ctx.stroke();
    }
    ctx.restore();
};

SAB.drawing.stopDrawing = function (e) {
    var state = SAB.state;
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (state.tool === 'eraser') return;

    if (state.tool === 'arrow' && state.lineStart) {
        var pos = SAB.drawing.getPointerPos(e);
        var arrowStroke = {
            points: [state.lineStart, pos],
            color: state.penColor,
            width: state.penWidth,
            tool: 'arrow'
        };
        state.strokes.push(arrowStroke);
        state.undoStack.push({ type: 'stroke' });
        state.redoStack.length = 0;
        state.lineStart = null;
        SAB.drawing.redrawStrokes();
        return;
    }

    if (state.currentStroke && state.currentStroke.points.length >= 2) {
        state.strokes.push(state.currentStroke);
        state.undoStack.push({ type: 'stroke' });
        state.redoStack.length = 0;
    }
    state.currentStroke = null;
};

/* ─── Stroke-based Eraser ─── */
SAB.drawing.eraseStrokeAt = function (pos) {
    var state = SAB.state;
    var w = SAB.els.drawCanvas.width, h = SAB.els.drawCanvas.height;
    var px = pos.x * w, py = pos.y * h;
    var threshold = Math.max(10, state.penWidth * 3);

    for (var i = state.strokes.length - 1; i >= 0; i--) {
        var s = state.strokes[i];
        if (!s.points || s.points.length < 2) continue;
        var sw = (s.tool === 'highlighter') ? s.width * 4 : (s.tool === 'eraser') ? s.width * 3 : s.width;
        var hitDist = Math.max(threshold, sw / 2 + 5);
        for (var j = 1; j < s.points.length; j++) {
            var ax = s.points[j - 1].x * w, ay = s.points[j - 1].y * h;
            var bx = s.points[j].x * w, by = s.points[j].y * h;
            if (SAB.drawing.distToSegment(px, py, ax, ay, bx, by) < hitDist) {
                var removed = state.strokes.splice(i, 1)[0];
                state.undoStack.push({ type: 'erase', data: removed, index: i });
                state.redoStack.length = 0;
                SAB.drawing.redrawStrokes();
                return;
            }
        }
    }
};

SAB.drawing.distToSegment = function (px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

SAB.drawing.bindDrawing = function () {
    var drawCanvas = SAB.els.drawCanvas;
    drawCanvas.addEventListener('pointerdown', SAB.drawing.startDrawing);
    drawCanvas.addEventListener('pointermove', SAB.drawing.continueDrawing);
    drawCanvas.addEventListener('pointerup', SAB.drawing.stopDrawing);
    drawCanvas.addEventListener('pointerleave', SAB.drawing.stopDrawing);
    drawCanvas.addEventListener('pointercancel', SAB.drawing.stopDrawing);
    drawCanvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
};

/* ─── Spotlight ─── */
SAB.drawing.bindSpotlight = function () {
    var spotlightBtn = SAB.els.spotlightBtn;
    var spotlightOverlay = SAB.els.spotlightOverlay;
    if (!spotlightBtn || !spotlightOverlay) return;

    spotlightBtn.addEventListener('click', function () {
        if (SAB.state.spotlight) SAB.drawing.spotlightOff();
        else SAB.drawing.spotlightOn();
    });

    var SPOT_STEP = 30;
    var spotlightMinus = SAB.els.spotlightMinus;
    var spotlightPlus = SAB.els.spotlightPlus;
    if (spotlightMinus) spotlightMinus.addEventListener('click', function () {
        if (!SAB.state.spotlight) return;
        SAB.state.spotlightR = Math.max(40, SAB.state.spotlightR - SPOT_STEP);
        SAB.drawing.renderSpotlight();
    });
    if (spotlightPlus) spotlightPlus.addEventListener('click', function () {
        if (!SAB.state.spotlight) return;
        SAB.state.spotlightR = Math.min(500, SAB.state.spotlightR + SPOT_STEP);
        SAB.drawing.renderSpotlight();
    });

    spotlightOverlay.addEventListener('pointermove', function (e) {
        if (!SAB.state.spotlight) return;
        e.preventDefault();
        SAB.drawing.moveSpotlightTo(e);
    });
    spotlightOverlay.addEventListener('pointerdown', function (e) {
        if (!SAB.state.spotlight) return;
        e.preventDefault();
        SAB.drawing.moveSpotlightTo(e);
    });

    spotlightOverlay.addEventListener('wheel', function (e) {
        if (!SAB.state.spotlight) return;
        e.preventDefault();
        SAB.state.spotlightR = Math.max(40, Math.min(500, SAB.state.spotlightR - e.deltaY * 0.5));
        SAB.drawing.renderSpotlight();
    }, { passive: false });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && SAB.state.spotlight) SAB.drawing.spotlightOff();
    });
};

SAB.drawing.moveSpotlightTo = function (e) {
    var rect = SAB.els.spotlightOverlay.getBoundingClientRect();
    SAB.state.spotlightX = (e.clientX - rect.left) / rect.width;
    SAB.state.spotlightY = (e.clientY - rect.top) / rect.height;
    SAB.drawing.renderSpotlight();
};

SAB.drawing.spotlightOn = function () {
    var H = SAB.config.H;
    SAB.state.spotlight = true;
    SAB.els.spotlightOverlay.classList.add(H + '_spotlight_on');
    SAB.els.spotlightBtn.classList.add(H + '_spotlight_active');
    if (SAB.els.spotlightMinus) SAB.els.spotlightMinus.classList.add(H + '_visible');
    if (SAB.els.spotlightPlus) SAB.els.spotlightPlus.classList.add(H + '_visible');
    SAB.drawing.renderSpotlight();
};

SAB.drawing.spotlightOff = function () {
    var H = SAB.config.H;
    SAB.state.spotlight = false;
    SAB.els.spotlightOverlay.classList.remove(H + '_spotlight_on');
    SAB.els.spotlightBtn.classList.remove(H + '_spotlight_active');
    if (SAB.els.spotlightMinus) SAB.els.spotlightMinus.classList.remove(H + '_visible');
    if (SAB.els.spotlightPlus) SAB.els.spotlightPlus.classList.remove(H + '_visible');
    SAB.els.spotlightOverlay.style.background = '';
};

SAB.drawing.renderSpotlight = function () {
    var rect = SAB.els.spotlightOverlay.getBoundingClientRect();
    var x = SAB.state.spotlightX * rect.width;
    var y = SAB.state.spotlightY * rect.height;
    var r = SAB.state.spotlightR;
    var feather = Math.max(8, r * 0.12);
    SAB.els.spotlightOverlay.style.background =
        'radial-gradient(circle ' + r + 'px at ' + x + 'px ' + y + 'px, ' +
        'transparent ' + Math.max(0, r - feather) + 'px, ' +
        'rgba(0,0,0,0.78) ' + (r + feather) + 'px)';
};
