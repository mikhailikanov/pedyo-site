// Pedyo — in-flow image cropper
//
// Sits between a file input and the upload: the user pans, zooms and resizes a
// crop region, and this module bakes that region into a square JPEG. Only the
// finished file ever leaves the browser — the crop lives on in the pixels, not
// in a coordinate some later reader would have to re-apply.
import { icon } from './icons.js';
import { escapeHtml } from './ui.js';

const FRAME_MIN = 110;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.12;

// CSS px per source px at which the image exactly covers a `side` square.
// Every allowed zoom is a multiple of this, so the stage is never empty.
export function coverScale(imgW, imgH, side) {
  return Math.max(side / imgW, side / imgH);
}

// The image rect must contain the stage rect. With scale >= coverScale the two
// bounds below never cross, so clamping is always satisfiable.
export function clampOffset(offset, imgSide, scale, side) {
  return Math.min(0, Math.max(offset, side - imgSide * scale));
}

const CORNERS = {
  nw: f => [f.x, f.y],
  ne: f => [f.x + f.size, f.y],
  sw: f => [f.x, f.y + f.size],
  se: f => [f.x + f.size, f.y + f.size]
};
const OPPOSITE = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };

// Dragging a corner keeps the opposite corner fixed and the region square, so
// it grows or shrinks toward the pointer instead of sliding away from it.
export function resizeFrame(frame, handle, dx, dy, side) {
  const [ax, ay] = CORNERS[OPPOSITE[handle]](frame);
  const [mx0, my0] = CORNERS[handle](frame);
  const mx = mx0 + dx, my = my0 + dy;
  const right = mx >= ax, down = my >= ay;
  // Room left for a square anchored on the fixed corner, inside the stage.
  const room = Math.min(right ? side - ax : ax, down ? side - ay : ay);
  // Never below a grabbable size, never bigger than the stage. Dragged past an
  // edge, the anchor slides rather than the region collapsing.
  const size = Math.max(Math.min(Math.max(Math.abs(mx - ax), Math.abs(my - ay)), room), Math.min(FRAME_MIN, side));
  return {
    x: Math.max(0, Math.min(right ? ax : ax - size, side - size)),
    y: Math.max(0, Math.min(down ? ay : ay - size, side - size)),
    size
  };
}

// Dragging the region itself: it keeps its size and stays inside the stage.
export function moveFrame(frame, dx, dy, side) {
  const max = side - frame.size;
  return { ...frame, x: Math.min(max, Math.max(0, frame.x + dx)), y: Math.min(max, Math.max(0, frame.y + dy)) };
}

// The square of source pixels under the frame — the argument list for drawImage.
export function sourceRect(img, view, frame) {
  const sw = frame.size / view.scale;
  const sh = frame.size / view.scale;
  return {
    sx: Math.max(0, Math.min((frame.x - view.x) / view.scale, img.w - sw)),
    sy: Math.max(0, Math.min((frame.y - view.y) / view.scale, img.h - sh)),
    sw: Math.min(sw, img.w),
    sh: Math.min(sh, img.h)
  };
}

export function drawCrop(img, view, frame, output) {
  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const r = sourceRect({ w: img.naturalWidth, h: img.naturalHeight }, view, frame);
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, output, output);
  return canvas;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Could not build the cropped image.')),
      'image/jpeg', 0.92
    );
  });
}

function template(title, hint) {
  return `
    <div class="modal-overlay crop-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal modal-crop">
        <div class="crop-head">
          <h2 class="crop-title">${escapeHtml(title)}</h2>
          <button type="button" class="crop-x" data-crop="cancel" aria-label="Cancel cropping">${icon('x', { size: 16, stroke: 2.5 })}</button>
        </div>
        <p class="crop-hint">${escapeHtml(hint)}</p>
        <div class="crop-stage" data-crop="stage" tabindex="0">
          <img class="crop-img" alt="" draggable="false"/>
          <div class="crop-frame" data-crop="frame">
            <span class="crop-grid"></span>
            <button type="button" class="crop-handle crop-handle-nw" data-handle="nw" aria-label="Resize from the top left corner"></button>
            <button type="button" class="crop-handle crop-handle-ne" data-handle="ne" aria-label="Resize from the top right corner"></button>
            <button type="button" class="crop-handle crop-handle-sw" data-handle="sw" aria-label="Resize from the bottom left corner"></button>
            <button type="button" class="crop-handle crop-handle-se" data-handle="se" aria-label="Resize from the bottom right corner"></button>
          </div>
        </div>
        <div class="crop-zoom">
          <span class="crop-zoom-icon">${icon('zoom-out', { size: 16 })}</span>
          <input class="crop-range" data-crop="zoom" type="range" min="0" max="100" step="1" value="0"
                 aria-label="Zoom into the photo"/>
          <span class="crop-zoom-icon">${icon('zoom-in', { size: 16 })}</span>
        </div>
        <div class="crop-foot">
          <div class="crop-preview" aria-hidden="true"><img alt=""/></div>
          <div class="crop-actions">
            <button type="button" class="btn btn-ghost" data-crop="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-crop="apply">Use photo</button>
          </div>
        </div>
      </div>
    </div>`;
}

// Rendering above the size storage.js finally keeps (400) leaves the downscale
// something to work with, so a tight crop still lands sharp.
export async function openImageCropper({ file, title = 'Crop your photo', output = 512 } = {}) {
  if (!file) throw new Error('No image was selected.');
  const { img, url } = await loadImage(file);

  const side = Math.max(220, Math.min(360, window.innerWidth - 96, window.innerHeight - 340));
  const cover = coverScale(img.naturalWidth, img.naturalHeight, side);

  const host = document.createElement('div');
  host.innerHTML = template(
    title,
    'Drag the photo to move it, pull a corner to resize the crop, and use the slider to zoom.'
  );
  document.body.appendChild(host);
  const overlay = host.firstElementChild;
  const stage = overlay.querySelector('[data-crop="stage"]');
  const elImg = overlay.querySelector('.crop-img');
  const elFrame = overlay.querySelector('[data-crop="frame"]');
  const elRange = overlay.querySelector('[data-crop="zoom"]');
  const elPreview = overlay.querySelector('.crop-preview img');
  const previouslyFocused = document.activeElement;

  // Zoom 1 sits at the slider foot and grows quadratically: a linear slider
  // spends most of its travel in the range where nothing visibly changes.
  const state = {
    zoom: 1,
    x: (side - img.naturalWidth * cover) / 2,
    y: (side - img.naturalHeight * cover) / 2,
    frame: { x: side * 0.11, y: side * 0.11, size: side * 0.78 }
  };
  const scale = () => cover * state.zoom;

  elImg.src = url;
  elImg.style.width = `${img.naturalWidth}px`;
  elImg.style.height = `${img.naturalHeight}px`;
  stage.style.width = `${side}px`;
  stage.style.height = `${side}px`;

  let previewQueued = false;
  function paint() {
    const s = scale();
    state.x = clampOffset(state.x, img.naturalWidth, s, side);
    state.y = clampOffset(state.y, img.naturalHeight, s, side);
    elImg.style.transform = `translate(${state.x}px, ${state.y}px) scale(${s})`;
    elFrame.style.cssText = `left:${state.frame.x}px;top:${state.frame.y}px;width:${state.frame.size}px;height:${state.frame.size}px`;
    if (!previewQueued) {
      // The live preview is a second full draw; one per frame is enough.
      previewQueued = true;
      requestAnimationFrame(() => {
        previewQueued = false;
        elPreview.src = drawCrop(img, view(), state.frame, 96).toDataURL('image/jpeg', 0.8);
      });
    }
  }

  const view = () => ({ x: state.x, y: state.y, scale: scale() });

  const drag = { id: null, mode: null, handle: null, x: 0, y: 0, frame: null };
  function onDown(event, mode, handle) {
    if (drag.id !== null) return;
    Object.assign(drag, {
      id: event.pointerId, mode, handle: handle || null,
      x: event.clientX, y: event.clientY, frame: { ...state.frame }
    });
    event.preventDefault();
    // Capture keeps a fast drag inside the stage; a pointer the browser does
    // not know about (a scripted drag) must not cost the drag itself.
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* drag continues untracked */ }
  }
  function onMove(event) {
    if (drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.mode === 'pan') {
      state.x += dx; state.y += dy;
      drag.x = event.clientX; drag.y = event.clientY;
    } else if (drag.mode === 'move') {
      state.frame = moveFrame(drag.frame, dx, dy, side);
    } else if (drag.mode === 'size') {
      state.frame = resizeFrame(drag.frame, drag.handle, dx, dy, side);
    }
    paint();
  }
  function onUp(event) {
    if (drag.id === event.pointerId) drag.id = null;
  }

  stage.addEventListener('pointerdown', e => { if (!e.target.closest('[data-crop="frame"]')) onDown(e, 'pan'); });
  elFrame.addEventListener('pointerdown', e => { if (!e.target.classList.contains('crop-handle')) onDown(e, 'move'); });
  overlay.querySelectorAll('.crop-handle').forEach(h =>
    h.addEventListener('pointerdown', e => onDown(e, 'size', h.dataset.handle)));
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  function applyZoom(zoom) {
    state.zoom = Math.min(ZOOM_MAX, Math.max(1, zoom));
    elRange.value = String(Math.round(Math.sqrt((state.zoom - 1) / (ZOOM_MAX - 1)) * 100));
    paint();
  }
  elRange.addEventListener('input', () => applyZoom(1 + (ZOOM_MAX - 1) * (Number(elRange.value) / 100) ** 2));
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    applyZoom(state.zoom * (e.deltaY < 0 ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP)));
  }, { passive: false });

  stage.addEventListener('keydown', e => {
    const step = e.shiftKey ? 3 : 14;
    if (e.key === 'ArrowLeft') state.x += step;
    else if (e.key === 'ArrowRight') state.x -= step;
    else if (e.key === 'ArrowUp') state.y += step;
    else if (e.key === 'ArrowDown') state.y -= step;
    else if (e.key === '+' || e.key === '=') return applyZoom(state.zoom * (1 + ZOOM_STEP));
    else if (e.key === '-' || e.key === '_') return applyZoom(state.zoom / (1 + ZOOM_STEP));
    else return;
    e.preventDefault();
    paint();
  });

  let finish, fail;
  const result = new Promise((res, rej) => { finish = res; fail = rej; });

  function onEscape(e) { if (e.key === 'Escape') { e.preventDefault(); finish(null); } }
  document.addEventListener('keydown', onEscape);

  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) finish(null); });
  overlay.addEventListener('click', async e => {
    const btn = e.target.closest('[data-crop]');
    if (!btn) return;
    if (btn.dataset.crop === 'cancel') return finish(null);
    if (btn.dataset.crop !== 'apply') return;
    btn.disabled = true;
    try {
      const blob = await toBlob(drawCrop(img, view(), state.frame, output));
      const name = (file.name || 'photo').replace(/\.[^.]*$/, '') + '.jpg';
      finish(new File([blob], name, { type: 'image/jpeg' }));
    } catch (err) {
      fail(err);
    }
  });

  function teardown() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.removeEventListener('keydown', onEscape);
    URL.revokeObjectURL(url);
    overlay.remove();
    // The calling label is where focus sat before the modal opened.
    try { previouslyFocused?.focus?.(); } catch { /* the page may have moved on */ }
  }

  paint();
  stage.focus();

  try {
    return await result;
  } finally {
    teardown();
  }
}
