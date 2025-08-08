
import React, { useEffect, useMemo, useRef, useState } from "react";

const BOARD_SIZE = 10;
const CELL = 32;
const GAP = 4;

type Shape = number[][];

const BASE_SHAPES: Shape[] = [
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[1,0],[1,1]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  [[0,0],[0,1],[0,2],[1,1]],
  [[0,1],[1,0],[1,1],[1,2],[2,1]],
  [[0,0],[1,0],[2,0],[3,0],[3,1]],
  [[0,0],[1,0],[1,1],[2,1],[3,1]],
];

function rotate(shape: Shape, times: number): Shape {
  let s = shape.map(([r,c]) => [r, c] as [number, number]);
  for (let t=0; t<((times%4)+4)%4; t++) {
    s = s.map(([r,c]) => [c, -r] as [number, number]);
    const minR = Math.min(...s.map(v=>v[0]));
    const minC = Math.min(...s.map(v=>v[1]));
    s = s.map(([r,c]) => [r-minR, c-minC] as [number, number]);
  }
  return s as Shape;
}

function bounds(shape: Shape) {
  const maxR = Math.max(...shape.map(v=>v[0]));
  const maxC = Math.max(...shape.map(v=>v[1]));
  return {h: maxR+1, w: maxC+1};
}

function randomShape(): Shape {
  const base = BASE_SHAPES[Math.floor(Math.random()*BASE_SHAPES.length)];
  const rot = Math.floor(Math.random()*4);
  return rotate(base, rot);
}

function canPlace(board: number[][], shape: Shape, r0: number, c0: number): boolean {
  for (const [dr, dc] of shape) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return false;
    if (board[r][c] === 1) return false;
  }
  return true;
}

function place(board: number[][], shape: Shape, r0: number, c0: number): number[][] {
  const next = board.map(row => row.slice());
  for (const [dr, dc] of shape) next[r0+dr][c0+dc] = 1;
  return next;
}

function checkClears(board: number[][]) {
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let r=0; r<BOARD_SIZE; r++) if (board[r].every(v => v === 1)) fullRows.push(r);
  for (let c=0; c<BOARD_SIZE; c++) {
    let full = true;
    for (let r=0; r<BOARD_SIZE; r++) if (board[r][c] !== 1) { full = false; break; }
    if (full) fullCols.push(c);
  }
  return { fullRows, fullCols };
}

function clearLines(board: number[][], fullRows: number[], fullCols: number[]) {
  const next = board.map(row => row.slice());
  for (const r of fullRows) for (let c=0;c<BOARD_SIZE;c++) next[r][c] = 0;
  for (const c of fullCols) for (let r=0;r<BOARD_SIZE;r++) next[r][c] = 0;
  return next;
}

function anyMovesLeft(board: number[][], pieces: (Shape | null)[]): boolean {
  for (const p of pieces) {
    if (!p) continue;
    for (let r=0; r<BOARD_SIZE; r++) {
      for (let c=0; c<BOARD_SIZE; c++) {
        if (canPlace(board, p, r, c)) return true;
      }
    }
  }
  return false;
}

function cellKey(r:number,c:number){return `${r}:${c}`}

export default function IzzyBlock() {
  const [board, setBoard] = useState<number[][]>(Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0)));
  const [pieces, setPieces] = useState<Shape[]>([randomShape(), randomShape(), randomShape()]);
  const [used, setUsed] = useState<boolean[]>([false,false,false]);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{x:number,y:number} | null>(null);
  const [dropCell, setDropCell] = useState<{r:number,c:number} | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const activePieces = pieces.map((p,i)=> used[i] ? null : p);
  const trayEmpty = useMemo(() => activePieces.every(p => p === null), [activePieces]);

  function newTray() {
    setUsed([false,false,false]);
    setPieces([randomShape(), randomShape(), randomShape()]);
  }

  function scoreAndAdvance(nextBoard: number[][], placedTiles: number) {
    let add = placedTiles;
    const { fullRows, fullCols } = checkClears(nextBoard);
    if (fullRows.length || fullCols.length) {
      nextBoard = clearLines(nextBoard, fullRows, fullCols);
      add += 10 * (fullRows.length + fullCols.length);
    }
    setBoard(nextBoard);
    setScore(s => s + add);
    setTimeout(() => {
      const haveMoves = anyMovesLeft(nextBoard, pieces.map((p,i)=> used[i]?null:p));
      if (!haveMoves) setGameOver(true);
    }, 0);
  }

  function tryPlaceAt(idx:number, r:number, c:number) {
    if (idx == null) return false;
    const p = activePieces[idx];
    if (!p) return false;
    if (!canPlace(board, p, r, c)) return false;
    const next = place(board, p, r, c);
    const nextUsed = used.slice();
    nextUsed[idx] = true;
    setUsed(nextUsed);
    setSelected(null);
    scoreAndAdvance(next, p.length);
    if (nextUsed.every(b=>b)) newTray();
    return true;
  }

  function nearestValidCellFromPoint(pt:{x:number,y:number}, piece:Shape | null){
    if (!boardRef.current || !piece) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const step = CELL + GAP;
    let best: {r:number,c:number, d:number} | null = null;
    for (let r=0; r<BOARD_SIZE; r++){
      for (let c=0; c<BOARD_SIZE; c++){
        if (!canPlace(board, piece, r, c)) continue;
        const cx = rect.left + c*step + CELL/2;
        const cy = rect.top + r*step + CELL/2;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const d = dx*dx + dy*dy;
        if (best==null || d < best.d) best = {r,c,d};
      }
    }
    return best ? {r:best.r, c:best.c} : null;
  }

  function onTrayPointerDown(e: React.PointerEvent, i:number) {
    if (used[i]) return;
    setSelected(i);
    setDragIdx(i);
    const pt = {x: e.clientX, y: e.clientY};
    setDragPoint(pt);
    updateDropFromPoint(pt);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function updateDropFromPoint(pt:{x:number,y:number}) {
    if (dragIdx==null) { setDropCell(null); return; }
    const p = activePieces[dragIdx];
    const snapped = nearestValidCellFromPoint(pt, p);
    setDropCell(snapped);
  }

  function onGlobalPointerMove(e: PointerEvent) {
    if (dragIdx==null) return;
    const pt = {x: e.clientX, y: e.clientY};
    setDragPoint(pt);
    updateDropFromPoint(pt);
  }

  function onGlobalPointerUp() {
    if (dragIdx==null) return;
    if (dragPoint!=null) {
      const p = activePieces[dragIdx];
      const snapped = nearestValidCellFromPoint(dragPoint, p);
      if (snapped) tryPlaceAt(dragIdx, snapped.r, snapped.c);
    }
    setDragIdx(null);
    setDragPoint(null);
    setDropCell(null);
  }

  useEffect(() => {
    window.addEventListener("pointermove", onGlobalPointerMove);
    window.addEventListener("pointerup", onGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", onGlobalPointerMove);
      window.removeEventListener("pointerup", onGlobalPointerUp);
    };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent){
      if (selected==null) return;
      if (e.key.toLowerCase()==="q") rotateSelected(-1);
      if (e.key.toLowerCase()==="e") rotateSelected(1);
    }
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  }, [selected, pieces]);

  function rotateSelected(dir: 1 | -1) {
    if (selected === null) return;
    const p = activePieces[selected];
    if (!p) return;
    const rotated = rotate(pieces[selected], dir === 1 ? 1 : 3);
    const nextPieces = pieces.slice();
    nextPieces[selected] = rotated;
    setPieces(nextPieces);
  }

  function reset(){
    setBoard(Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0)));
    setPieces([randomShape(), randomShape(), randomShape()]);
    setUsed([false,false,false]);
    setSelected(null);
    setScore(0);
    setGameOver(false);
    setDragIdx(null);
    setDragPoint(null);
    setDropCell(null);
  }

  function renderMini(p:Shape){
    const {h, w} = bounds(p);
    const box = Array.from({length: h}, () => Array(w).fill(0));
    for (const [r,c] of p) box[r][c] = 1;
    return (
      <div className="grid" style={{gridTemplateColumns: `repeat(${w}, 16px)`, gap: 2}}>
        {box.flat().map((v, idx) => (
          <div key={idx} className={(v?"bg-sky-400":"bg-slate-900") + " w-4 h-4 rounded-sm border border-slate-700"} />
        ))}
      </div>
    );
  }

  const ghost = useMemo(() => {
    if (dropCell==null || dragIdx==null) return new Set<string>();
    const p = activePieces[dragIdx];
    if (!p) return new Set<string>();
    const s = new Set<string>();
    for (const [dr,dc] of p) {
      const r = dropCell.r + dr;
      const c = dropCell.c + dc;
      s.add(cellKey(r,c));
    }
    return s;
  }, [dropCell, dragIdx, activePieces]);

  const ghostValid = useMemo(() => dropCell!=null && dragIdx!=null, [dropCell, dragIdx]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center p-4 gap-4 select-none">
      <div className="w-full max-w-3xl flex items-center justify-between">
        <h1 className="text-2xl font-bold">IZZY BLOCK</h1>
        <div className="flex items-center gap-2">
          <span className="text-lg">Score: <b>{score}</b></span>
          <button onClick={reset} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700">Reset</button>
        </div>
      </div>

      <div ref={boardRef} className="grid relative"
           style={{gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL}px)`, gap: GAP}}>
        {board.map((row, r) => row.map((val, c) => {
          const key = cellKey(r,c);
          const filled = val === 1;
          const isGhost = ghost.has(key);
          return (
            <div
              key={key}
              className={"w-8 h-8 rounded-md border " +
                (filled ? "bg-sky-400 border-slate-700" : isGhost ? "bg-sky-400/40 border-sky-400/60" : "bg-slate-900 border-slate-700")}
            />
          );
        }))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={()=>rotateSelected(-1)} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700">Rotate Left (Q)</button>
        <button onClick={()=>rotateSelected(1)} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700">Rotate Right (E)</button>
      </div>

      <div className="w-full max-w-3xl">
        <h2 className="mt-2 mb-1 text-lg font-semibold">Pieces</h2>
        <div className="flex gap-4 flex-wrap">
          {pieces.map((p, i) => {
            const isUsed = used[i];
            if (!p) return null;
            return (
              <button
                key={i}
                onPointerDown={(e)=>onTrayPointerDown(e, i)}
                onClick={()=>setSelected(i)}
                className={
                  "p-2 rounded-xl border touch-none " +
                  (isUsed ? "opacity-40 cursor-not-allowed border-slate-800" : selected===i ? "border-sky-400" : "border-slate-700 hover:border-slate-500")
                }
                disabled={isUsed}
                title="Drag onto the board or click to select"
              >
                {renderMini(p)}
              </button>
            )
          })}
        </div>
      </div>

      {dragIdx!=null && dragPoint && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div style={{position:"absolute", left: dragPoint.x + 8, top: dragPoint.y + 8}}>
            {(() => {
              const p = activePieces[dragIdx]!;
              const {h,w} = bounds(p);
              const box = Array.from({length: h}, () => Array(w).fill(0));
              for (const [r,c] of p) box[r][c] = 1;
              return (
                <div className="grid opacity-80 drop-shadow-xl" style={{gridTemplateColumns: `repeat(${w}, 16px)`, gap: 2}}>
                  {box.flat().map((v, idx) => (
                    <div key={idx} className={(v?"bg-sky-400":"bg-slate-700/30") + " w-4 h-4 rounded-sm border border-slate-700"} />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {gameOver && (
        <div className="mt-2 p-3 bg-red-900/40 border border-red-700 rounded-xl">
          <b>Game over.</b> No moves left.
        </div>
      )}

      <div className="opacity-70 text-sm mt-4 text-center">
        <p>Drag a piece anywhere near the grid and release. It snaps to the nearest valid spot. Use Q and E to rotate while selected. Clear full rows or columns for bonuses.</p>
      </div>
    </div>
  );
}
