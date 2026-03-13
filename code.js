// ─── Frame Tidy — Figma Plugin ───────────────────────────────────────────────
// Equalizes frame spacing, cleans up text labels, and tidies sections.

figma.showUI(__html__, { width: 260, height: 330, title: 'Frame Tidy' });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'tidy') {
    runTidy(msg.frameGap, msg.textGap, msg.sectionPadding);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────

function runTidy(frameGap, textGap, sectionPadding = 40) {
  const sel = [...figma.currentPage.selection];

  if (sel.length === 0) {
    figma.notify('⚠️ Select frames or sections first.');
    figma.ui.postMessage({ type: 'status', ok: false, text: 'Nothing selected.' });
    return;
  }

  const sections = sel.filter(n => n.type === 'SECTION');
  const frames   = sel.filter(n =>
    n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
  );

  let count = 0;

  // ── Sections ──
  if (sections.length > 0) {
    // Equalize spacing between sections (use 3× frame gap)
    if (sections.length > 1) {
      tidyNodes(sections, frameGap * 3);
    }
    sections.forEach(section => {
      const children = getFrameChildren(section);
      if (children.length > 1) tidyNodes(children, frameGap);
      if (children.length > 0) tidyLabels(children, textGap);
      resizeSectionToFit(section, sectionPadding);
      count += children.length || 1;
    });
  }

  // ── Loose frames (grouped by parent) ──
  if (frames.length > 0) {
    const groups = groupByParent(frames);
    groups.forEach(group => {
      if (group.length > 1) {
        tidyNodes(group, frameGap);
        count += group.length;
      } else {
        count += 1; // single frame — still clean up its label
      }
      tidyLabels(group, textGap);
    });
  }

  if (count === 0) {
    figma.notify('No frames found in selection.');
    figma.ui.postMessage({ type: 'status', ok: false, text: 'No frames found.' });
    return;
  }

  figma.notify(`✦ Tidied ${count} item${count === 1 ? '' : 's'}`);
  figma.ui.postMessage({ type: 'status', ok: true, text: `✦ Tidied ${count} item${count === 1 ? '' : 's'}` });
}

// ─── Core algorithms ──────────────────────────────────────────────────────────

/**
 * Equalize spacing between nodes.
 * - Detects horizontal vs vertical layout automatically.
 * - Top-aligns nodes in a row; left-aligns nodes in a column.
 * - Equalizes gaps using the supplied `gap` value.
 */
function tidyNodes(nodes, gap) {
  if (nodes.length < 2) return;

  const horiz  = isHorizontal(nodes);
  const sorted = [...nodes].sort((a, b) => horiz ? a.x - b.x : a.y - b.y);

  // Align perpendicular axis
  if (horiz) {
    const topY = Math.min(...sorted.map(n => n.y));
    sorted.forEach(n => { n.y = topY; });
  } else {
    const leftX = Math.min(...sorted.map(n => n.x));
    sorted.forEach(n => { n.x = leftX; });
  }

  // Equalize spacing
  for (let i = 1; i < sorted.length; i++) {
    if (horiz) {
      sorted[i].x = sorted[i - 1].x + sorted[i - 1].width + gap;
    } else {
      sorted[i].y = sorted[i - 1].y + sorted[i - 1].height + gap;
    }
  }
}

/**
 * Fix the gap between each frame and its text label directly above it.
 * Also left-aligns the label with the frame.
 *
 * Handles two cases:
 *  1. Label is a sibling that has drifted inside the frame visually → reposition above.
 *  2. Label is a child of the frame (accidentally dropped inside) → reparent out first.
 */
function tidyLabels(frames, gap) {
  frames.forEach(frame => {
    const parent = frame.parent;
    if (!parent || !('children' in parent)) return;

    // If a text child looks like an external label (near the top of the frame),
    // move it out to be a sibling so we can position it cleanly above.
    extractLabelFromFrame(frame, parent);

    const label = findLabelAbove(frame, parent.children);
    if (!label) return;

    label.y = frame.y - gap - label.height;
    label.x = frame.x;
  });
}

/**
 * If the frame has a TEXT child near its top edge that looks like an external label
 * (i.e. it was accidentally dragged inside), reparent it to the frame's parent.
 * Uses a conservative threshold: top 15% of frame height or 60px, whichever is smaller.
 */
function extractLabelFromFrame(frame, parent) {
  if (!('children' in frame) || frame.children.length === 0) return;

  const threshold = Math.min(60, frame.height * 0.15);
  const candidates = frame.children.filter(n => n.type === 'TEXT' && n.y < threshold);
  if (candidates.length === 0) return;

  // Pick the topmost text node
  const label = candidates.reduce((best, n) => n.y < best.y ? n : best);

  // Convert from frame-relative to parent-relative coords before reparenting
  const absX = frame.x + label.x;
  const absY = frame.y + label.y;
  parent.appendChild(label);
  label.x = absX;
  label.y = absY;
}

/**
 * Resize a section to snugly fit its children with `padding` on all sides.
 * Leaves extra room at the top (40px) for the Figma section header label.
 */
function resizeSectionToFit(section, padding) {
  const children = section.children;
  if (children.length === 0) return;

  const HEADER = 40; // Figma section title bar height

  // Compute bounding box of all children (in section-relative coords)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  children.forEach(c => {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  });

  // Shift children so content starts at (padding, HEADER + padding)
  const offsetX = padding - minX;
  const offsetY = HEADER + padding - minY;
  children.forEach(c => {
    c.x += offsetX;
    c.y += offsetY;
  });

  // Resize section to wrap content
  const newW = (maxX - minX) + padding * 2;
  const newH = (maxY - minY) + padding * 2 + HEADER;
  section.resizeWithoutConstraints(newW, newH);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if nodes are spread more horizontally than vertically. */
function isHorizontal(nodes) {
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  return (Math.max(...xs) - Math.min(...xs)) >= (Math.max(...ys) - Math.min(...ys));
}

/** Returns FRAME/COMPONENT/COMPONENT_SET direct children of a container. */
function getFrameChildren(container) {
  if (!('children' in container)) return [];
  return container.children.filter(n =>
    n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
  );
}

/** Groups nodes by their parent id. Returns array of arrays. */
function groupByParent(nodes) {
  const map = new Map();
  nodes.forEach(n => {
    const key = n.parent ? n.parent.id : '__root__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(n);
  });
  return [...map.values()];
}

/**
 * Find the TEXT sibling that is most likely a label for the given frame.
 * Criteria:
 *   - Text TOP is within [frame.top - 200px … frame.top + 120px]
 *     (allows text that is properly above AND text that has drifted inside the frame)
 *   - x-range overlaps with the frame
 * Returns the candidate whose bottom edge is closest to the frame top.
 */
function findLabelAbove(frame, siblings) {
  const MAX_GAP     = 200; // how far above the frame top is still considered a label
  const MAX_OVERLAP = 120; // how far inside the frame top is still considered a label

  const candidates = siblings.filter(node => {
    if (node.type !== 'TEXT') return false;
    if (node.id === frame.id) return false;

    // Accept text whose top is within the search window
    if (node.y < frame.y - MAX_GAP)     return false; // too far above
    if (node.y > frame.y + MAX_OVERLAP) return false; // too deep inside

    // x overlap
    const tL = node.x, tR = node.x + node.width;
    const fL = frame.x, fR = frame.x + frame.width;
    return tR > fL && tL < fR;
  });

  if (candidates.length === 0) return null;

  // Pick the node whose bottom edge is closest to the frame's top edge
  return candidates.reduce((best, n) => {
    const dN = Math.abs(frame.y - (n.y + n.height));
    const dB = Math.abs(frame.y - (best.y + best.height));
    return dN < dB ? n : best;
  });
}
