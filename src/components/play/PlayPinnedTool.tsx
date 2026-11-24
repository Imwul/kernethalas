import { useState } from 'react';
import { kindOf, titleOf } from '../../content';
import { PlayReferenceTool } from '../../lib/play-draft';
import { useNav } from '../../lib/store';
import { PaneBody } from '../../views/Workbench';
import { XRef } from '../bits';

const STORAGE_KEY = 'kn-play-pinned-tool';
const TOOLS = ['p-attack', 'conditions', 'p-tension', 't-defensive-move-pc', 't-traps', 'p-rest'];

export function PlayPinnedTool() {
  const { pins, open } = useNav();
  const [selected, setSelected] = useState(() => {
    try {
      const id = localStorage.getItem(STORAGE_KEY);
      return id && kindOf(id) ? id : '';
    } catch { return ''; }
  });
  const options = [...new Set([...TOOLS, ...pins, ...open, selected])].filter((id) => id && kindOf(id));
  const choose = (id: string) => {
    setSelected(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* this tab can still use the tool */ }
  };

  return (
    <div className="play-pinned-tool play-pinned-body" data-selected={selected || undefined}>
        <label className="field"><span>플레이에 고정할 도구</span>
          <select value={selected} onChange={(event) => choose(event.currentTarget.value)}>
            <option value="">도구 선택</option>
            {options.map((id) => <option key={id} value={id}>{titleOf(id).ko}</option>)}
          </select>
        </label>
        {selected && <div className="play-pinned-preview" role="region" aria-label="고정 도구 내용" tabIndex={0}>
          <XRef id={selected}>참조 패널에서 보기</XRef>
          <PlayReferenceTool><PaneBody key={selected} id={selected} /></PlayReferenceTool>
        </div>}
    </div>
  );
}
