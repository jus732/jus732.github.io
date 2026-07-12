/**
 * Pure Tetris engine: no React, no DOM. Guideline-style rules: SRS
 * rotation with wall kicks, 7-bag randomizer, ghost position, hold with
 * one use per drop, 500ms lock delay with capped move resets, and
 * standard line-clear scoring. The UI drives it with tick(dt) and drains
 * `events` for effects (particles, shake, game over).
 */

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Cell = PieceType | null;
export type Rotation = 0 | 1 | 2 | 3;

export const COLS = 10;
export const ROWS = 20;
/** Spawn rows above the visible board. */
export const HIDDEN = 2;
export const TOTAL_ROWS = ROWS + HIDDEN;

export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
/** Interval between soft-drop rows while the key is held. */
export const SOFT_DROP_MS = 30;

export type ActivePiece = { type: PieceType; rot: Rotation; x: number; y: number };

export type TetrisEvent =
  | { kind: "lock"; cells: { x: number; y: number }[] }
  | {
      kind: "clear";
      count: number;
      rows: number[];
      cells: { x: number; y: number; type: PieceType }[];
    }
  | { kind: "hardDrop"; distance: number; cells: { x: number; y: number }[] }
  | { kind: "levelUp"; level: number }
  | { kind: "gameOver" };

/* ----- Shapes ----- */

// Base cell layout (rotation 0) inside each piece's SRS bounding box.
const BASE: Record<PieceType, { box: number; cells: [number, number][] }> = {
  I: { box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

function rotateCells(cells: [number, number][], box: number): [number, number][] {
  return cells.map(([x, y]) => [box - 1 - y, x]);
}

/** SHAPES[type][rotation] = cell offsets inside the piece's bounding box. */
export const SHAPES: Record<PieceType, [number, number][][]> = {} as never;
for (const type of Object.keys(BASE) as PieceType[]) {
  const { box, cells } = BASE[type];
  const rots: [number, number][][] = [cells];
  for (let i = 1; i < 4; i++) rots.push(rotateCells(rots[i - 1], box));
  SHAPES[type] = rots;
}

/** Rotation-0 cells rebased to their bounding box, for hold/next previews. */
export const PREVIEW_CELLS: Record<
  PieceType,
  { cells: [number, number][]; w: number; h: number }
> = {} as never;
for (const type of Object.keys(BASE) as PieceType[]) {
  const cells = BASE[type].cells;
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const rebased = cells.map(([x, y]) => [x - minX, y - minY] as [number, number]);
  PREVIEW_CELLS[type] = {
    cells: rebased,
    w: Math.max(...rebased.map(([x]) => x)) + 1,
    h: Math.max(...rebased.map(([, y]) => y)) + 1,
  };
}

/* ----- SRS wall kicks ----- */
// Standard tables use +y up; these are pre-negated for our y-down board.
// Indexed by "<from><to>" rotation states.
type KickTable = Record<string, [number, number][]>;

const KICKS_JLSTZ: KickTable = {
  "01": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "10": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "12": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "21": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "23": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "32": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "30": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "03": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const KICKS_I: KickTable = {
  "01": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "10": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "12": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "21": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "23": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "32": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "30": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "03": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

const SPAWN_X: Record<PieceType, number> = {
  I: 3,
  O: 4,
  T: 3,
  S: 3,
  Z: 3,
  J: 3,
  L: 3,
};

const CLEAR_SCORES = [0, 100, 300, 500, 800];

/** Gravity interval in ms for a level; tuned to ramp briskly but fairly. */
export function gravityMs(level: number) {
  return Math.max(45, Math.round(800 * Math.pow(0.82, level - 1)));
}

export class TetrisEngine {
  board: Cell[][];
  active: ActivePiece | null = null;
  hold: PieceType | null = null;
  canHold = true;
  queue: PieceType[] = [];
  score = 0;
  lines = 0;
  level = 1;
  over = false;
  events: TetrisEvent[] = [];

  private bag: PieceType[] = [];
  private rng: () => number;
  private gravityAcc = 0;
  private lockAcc = 0;
  private lockResets = 0;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.board = Array.from({ length: TOTAL_ROWS }, () =>
      Array<Cell>(COLS).fill(null)
    );
    while (this.queue.length < 5) this.queue.push(this.drawFromBag());
    this.spawn(this.nextFromQueue());
  }

  private drawFromBag(): PieceType {
    if (this.bag.length === 0) {
      this.bag = ["I", "O", "T", "S", "Z", "J", "L"];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }

  private nextFromQueue(): PieceType {
    const next = this.queue.shift()!;
    this.queue.push(this.drawFromBag());
    return next;
  }

  collides(type: PieceType, rot: Rotation, x: number, y: number): boolean {
    for (const [cx, cy] of SHAPES[type][rot]) {
      const bx = x + cx;
      const by = y + cy;
      if (bx < 0 || bx >= COLS || by < 0 || by >= TOTAL_ROWS) return true;
      if (this.board[by][bx]) return true;
    }
    return false;
  }

  private spawn(type: PieceType) {
    const piece: ActivePiece = { type, rot: 0, x: SPAWN_X[type], y: 0 };
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    if (this.collides(type, piece.rot, piece.x, piece.y)) {
      this.active = piece; // draw the blocked piece on the top-out frame
      this.over = true;
      this.events.push({ kind: "gameOver" });
      return;
    }
    this.active = piece;
  }

  private grounded(): boolean {
    const a = this.active;
    return !!a && this.collides(a.type, a.rot, a.x, a.y + 1);
  }

  /** Grounded moves/rotates re-arm the lock timer, up to a cap. */
  private onPieceAdjusted() {
    if (this.grounded() && this.lockResets < MAX_LOCK_RESETS) {
      this.lockAcc = 0;
      this.lockResets++;
    }
  }

  move(dx: -1 | 1): boolean {
    const a = this.active;
    if (!a || this.over) return false;
    if (this.collides(a.type, a.rot, a.x + dx, a.y)) return false;
    a.x += dx;
    this.onPieceAdjusted();
    return true;
  }

  rotate(dir: -1 | 1): boolean {
    const a = this.active;
    if (!a || this.over || a.type === "O") return a?.type === "O";
    const to = (((a.rot + dir) % 4) + 4) % 4 as Rotation;
    const table = a.type === "I" ? KICKS_I : KICKS_JLSTZ;
    for (const [kx, ky] of table[`${a.rot}${to}`]) {
      if (!this.collides(a.type, to, a.x + kx, a.y + ky)) {
        a.rot = to;
        a.x += kx;
        a.y += ky;
        this.onPieceAdjusted();
        return true;
      }
    }
    return false;
  }

  ghostY(): number {
    const a = this.active;
    if (!a) return 0;
    let y = a.y;
    while (!this.collides(a.type, a.rot, a.x, y + 1)) y++;
    return y;
  }

  activeCells(): { x: number; y: number }[] {
    const a = this.active;
    if (!a) return [];
    return SHAPES[a.type][a.rot].map(([cx, cy]) => ({ x: a.x + cx, y: a.y + cy }));
  }

  hardDrop() {
    const a = this.active;
    if (!a || this.over) return;
    const distance = this.ghostY() - a.y;
    a.y += distance;
    this.score += distance * 2;
    this.events.push({ kind: "hardDrop", distance, cells: this.activeCells() });
    this.lock();
  }

  holdPiece(): boolean {
    const a = this.active;
    if (!a || this.over || !this.canHold) return false;
    this.canHold = false;
    const held = this.hold;
    this.hold = a.type;
    this.spawn(held ?? this.nextFromQueue());
    return true;
  }

  private lock() {
    const a = this.active;
    if (!a) return;
    const cells = this.activeCells();
    for (const { x, y } of cells) this.board[y][x] = a.type;
    this.events.push({ kind: "lock", cells });

    // Lock-out: the piece settled entirely above the visible board.
    if (cells.every(({ y }) => y < HIDDEN)) {
      this.over = true;
      this.events.push({ kind: "gameOver" });
      return;
    }

    const fullRows: number[] = [];
    for (let y = 0; y < TOTAL_ROWS; y++) {
      if (this.board[y].every((cell) => cell !== null)) fullRows.push(y);
    }
    if (fullRows.length > 0) {
      const clearedCells = fullRows.flatMap((y) =>
        this.board[y].map((type, x) => ({ x, y, type: type as PieceType }))
      );
      for (const y of fullRows) {
        this.board.splice(y, 1);
        this.board.unshift(Array<Cell>(COLS).fill(null));
      }
      this.score += CLEAR_SCORES[fullRows.length] * this.level;
      this.lines += fullRows.length;
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        this.events.push({ kind: "levelUp", level: newLevel });
      }
      this.events.push({
        kind: "clear",
        count: fullRows.length,
        rows: fullRows,
        cells: clearedCells,
      });
    }

    this.canHold = true;
    this.spawn(this.nextFromQueue());
  }

  /**
   * Advance time. Gravity accumulates while airborne; the lock-delay timer
   * runs while grounded. Soft drop overrides the gravity interval and
   * scores one point per row descended.
   */
  tick(dtMs: number, softDrop: boolean) {
    if (this.over || !this.active) return;
    const a = this.active;

    if (this.grounded()) {
      this.gravityAcc = 0;
      this.lockAcc += dtMs;
      if (this.lockAcc >= LOCK_DELAY_MS) this.lock();
      return;
    }

    this.lockAcc = 0;
    this.gravityAcc += dtMs;
    const interval = softDrop
      ? Math.min(SOFT_DROP_MS, gravityMs(this.level))
      : gravityMs(this.level);

    while (this.gravityAcc >= interval) {
      this.gravityAcc -= interval;
      if (this.collides(a.type, a.rot, a.x, a.y + 1)) {
        this.gravityAcc = 0;
        break;
      }
      a.y++;
      this.lockResets = 0;
      if (softDrop) this.score += 1;
    }
  }

  drainEvents(): TetrisEvent[] {
    if (this.events.length === 0) return [];
    const drained = this.events;
    this.events = [];
    return drained;
  }
}
