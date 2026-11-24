import { useState } from 'react';
import { ROOM_EXIT_MARKS, type RoomExitMark, type RoomShapeState } from '../RoomShapeDiagram';
import { TogglePanel } from '../TogglePanel';

export const EMPTY_ROOM_SHAPE: RoomShapeState = { turns: 0, entrance: null, marks: {} };

export function PlayTileControls({ exits, state, open, onOpen, onChange, onInvestigateExit }: {
  exits: number;
  state: RoomShapeState;
  open: boolean;
  onOpen: (value: boolean) => void;
  onChange: (state: RoomShapeState) => void;
  onInvestigateExit?: (exit: number) => void;
}) {
  const [selected, setSelected] = useState(0);
  const activeExit = Math.min(selected, exits - 1);
  const options = Array.from({ length: exits }, (_, i) => i);
  const mark = state.marks[activeExit] ?? 'unexplored';

  return (
    <TogglePanel className="play-tile-controls" label="종이 지도에 모양 옮기기" open={open} onOpenChange={onOpen}>
      <section className="play-explore-action-body" aria-label="방·통로 모양 편집">
        <div className="play-explore-next">
          <div className="play-tile-turns" role="group" aria-label="모양 회전">
            <button type="button" className="btn ghost" aria-label="왼쪽 90° 회전" onClick={() => onChange({ ...state, turns: (state.turns + 3) % 4 })}>
              왼쪽 90°
            </button>
            <button type="button" className="btn ghost" aria-label="오른쪽 90° 회전" onClick={() => onChange({ ...state, turns: (state.turns + 1) % 4 })}>
              오른쪽 90°
            </button>
          </div>
          {state.turns !== 0 && <button type="button" className="btn ghost" onClick={() => onChange({ ...state, turns: 0 })}>회전 초기화</button>}
        </div>
        <div className="play-tile-fields">
          <label className="field">
            <span>들어온 출입구</span>
            <select value={state.entrance ?? ''} onChange={(event) => {
              const value = event.target.value;
              onChange({ ...state, entrance: value === '' ? null : Number(value) });
            }}>
              <option value="">입구 선택</option>
              {options.map((index) => <option key={index} value={index}>{index + 1}번</option>)}
            </select>
          </label>
          <label className="field">
            <span>표시할 출입구</span>
            <select value={activeExit} onChange={(event) => setSelected(Number(event.target.value))}>
              {options.map((index) => <option key={index} value={index}>{index + 1}번</option>)}
            </select>
          </label>
          <label className="field">
            <span>출입구 상태</span>
            <select value={mark} onChange={(event) => onChange({
              ...state,
              marks: { ...state.marks, [activeExit]: event.target.value as RoomExitMark },
            })}>
              {Object.entries(ROOM_EXIT_MARKS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
            </select>
          </label>
        </div>
        <p className="play-explore-note" role="status">
          {[
            state.turns !== 0 ? `${state.turns * 90}°` : '',
            state.entrance !== null ? `입구 ${state.entrance + 1}번` : '',
            ...options.flatMap((index) => state.marks[index] && state.marks[index] !== 'unexplored'
              ? [`${index + 1}번 ${ROOM_EXIT_MARKS[state.marks[index]]}`] : []),
          ].filter(Boolean).join(' · ')}
        </p>
        {onInvestigateExit && <button type="button" className="btn ghost play-explore-action-btn"
          onClick={() => onInvestigateExit(activeExit)}>{activeExit + 1}번 출입구 조사</button>}
      </section>
    </TogglePanel>
  );
}
