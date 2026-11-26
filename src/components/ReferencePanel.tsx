import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { entryById, hrefOf, procById, rulingById, tableById, titleOf } from '../content';
import { oraclePageHref, type OracleViewState } from '../lib/oracle';
import { Link } from '../lib/router';
import { OracleBody } from '../views/Oracle';
import { BenchButton, Cite, Notes, PinButton, VChip, XRef } from './bits';
import { EntryBody } from './EntryBody';
import { IClose } from './icons';
import { RulingBody } from './RulingBody';
import { RulingNote } from './RulingNote';
import { procedureTools } from './procedure-tools';

export interface ReferenceFrame extends OracleViewState {
  key: number;
  id: string;
  opener?: HTMLElement;
  fromSearch?: boolean;
}

const desktopQuery = '(min-width: 1200px)';
function subscribeDesktop(listener: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

interface PanelProps {
  stack: ReferenceFrame[];
  onBack: () => void;
  onClose: () => void;
  onNavigate: () => void;
  onViewChange: (key: number, change: OracleViewState) => void;
}

export function ReferencePanel({ stack, onBack, onClose, onNavigate, onViewChange }: PanelProps) {
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const current = stack.at(-1);
  const currentKey = current?.key;
  const open = Boolean(current);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    if (desktop && !document.querySelector('dialog:modal')) element.show();
    else element.showModal();
    return () => element.close();
  }, [open, desktop]);

  useLayoutEffect(() => {
    if (currentKey !== undefined) title.current?.focus({ preventScroll: true });
  }, [currentKey]);

  useEffect(() => {
    if (!open || !desktop) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog:modal')) return;
      event.preventDefault();
      onBack();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, desktop, onBack]);

  const parent = stack.at(-2);
  const fullPage = !current ? '' : tableById.has(current.id)
    ? oraclePageHref(current.id, { ...current, only: current.only ?? (current.result !== undefined) })
    : hrefOf(current.id);
  return (
    <dialog
      ref={dialog}
      className="reference-panel"
      aria-labelledby="reference-panel-title"
      onCancel={(event) => { event.preventDefault(); onBack(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onBack(); }}
    >
      {current && (
        <div className="reference-panel-inner">
          <div className="reference-panel-bar">
            {parent || current.fromSearch ? (
              <button className="ref-back" onClick={onBack}>
                <span aria-hidden="true">‹</span> {current.fromSearch || !parent ? '검색 결과로' : titleOf(parent.id).ko}
              </button>
            ) : <span>참고 패널</span>}
            <button className="iconbtn" onClick={onClose} aria-label="참고 패널 닫기"><IClose /></button>
          </div>
          <div className="reference-panel-heading">
            <h2 id="reference-panel-title" tabIndex={-1} ref={title}>{titleOf(current.id).ko}</h2>
            <div className="reference-panel-tools">
              <Link className="ref-full" to={fullPage} onClick={(event) => {
                if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate();
              }}>전체 페이지</Link>
              <PinButton id={current.id} compact />
              <BenchButton key={current.key} id={current.id} compact oracleView={tableById.has(current.id) ? {
                result: current.result, only: current.only, encounterPlace: current.encounterPlace,
              } : undefined} />
            </div>
          </div>
          {stack.map((frame) => (
            <div className="reference-panel-scroll" key={frame.key} hidden={frame !== current}>
              <PreviewBody frame={frame} onViewChange={(change) => onViewChange(frame.key, change)} />
            </div>
          ))}
        </div>
      )}
    </dialog>
  );
}

function PreviewBody({ frame, onViewChange }: { frame: ReferenceFrame; onViewChange: (change: OracleViewState) => void }) {
  const { id } = frame;
  const e = entryById.get(id);
  if (e) return <EntryBody e={e} compact hideTitle />;
  const table = tableById.get(id);
  if (table) return (
    <article className="preview-detail">
      <div className="marks"><VChip v={table.verification} /> <Cite source={table.source} /></div>
      <p className="usage">{table.usage}</p>
      <RulingNote id={table.id} />
      <OracleBody t={table} value={frame.result ?? null} onValue={(value) => onViewChange({ result: value ?? undefined })}
        only={frame.only ?? true} onOnly={(only) => onViewChange({ only })}
        encounterPlace={frame.encounterPlace ?? null} onEncounterPlace={(encounterPlace) => onViewChange({ encounterPlace })} compact />
    </article>
  );
  const procedure = procById.get(id);
  const Tool = procedureTools[id];
  if (procedure) return (
    <article className="preview-detail">
      <div className="marks"><VChip v={procedure.verification} /> <Cite source={procedure.source} /></div>
      <p className="summary">{procedure.summary}</p>
      {Tool && <Tool />}
      <ol className="steps">
        {[...procedure.nodes].sort((a, b) => a.row - b.row || a.col - b.col).map((node) => (
          <li key={node.id}>
            <strong>{node.title}</strong>
            <p>{node.body}</p>
            <div className="preview-links">{[...(node.refs ?? []), ...(node.tables ?? [])].map((target) => <XRef key={target} id={target} showKind />)}</div>
          </li>
        ))}
      </ol>
      <Notes notes={procedure.notes} />
    </article>
  );
  const ruling = rulingById.get(id);
  if (!ruling) return null;
  return (
    <article className="preview-detail">
      <RulingBody ruling={ruling} showVerification compare />
    </article>
  );
}
