import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { masteryCatalog } from '../content/entries/masteries';
import { MASTERY_BRIEFS } from '../content/mastery-briefs';
import { masterySource } from '../lib/overlay';
import { XRef } from './bits';
import '../styles/mastery-tree.css';

export type MasteryInfo = (typeof masteryCatalog)[number];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];
export const tierNumeral = (tier: number) => NUMERALS[tier - 1] ?? String(tier);
type NodeState = 'learned' | 'next' | 'locked' | 'plain';
const STATE_LABEL: Record<NodeState, string> = { learned: '배움', next: '다음 해금', locked: '잠김', plain: '' };

/** Feature on top, Tier I–V below, joined like a tech tree: learned nodes filled, the next one dashed, the rest faded. */
export function MasteryTree({ mastery, learned, featureOpen = learned > 0, full = false, plain = false, selected, onSelect, label }: {
  mastery: MasteryInfo;
  /** last unlocked tier, 0 when none */
  learned: number;
  featureOpen?: boolean;
  /** show every node's cost and full text (choosing a Mastery) instead of names only */
  full?: boolean;
  /** reference view: no learned/locked styling */
  plain?: boolean;
  selected?: number | 'feature' | null;
  onSelect?: (node: number | 'feature') => void;
  label?: string;
}) {
  const node = (id: number | 'feature', state: NodeState, head: ReactNode, body: ReactNode) => {
    const pressed = selected === id;
    const content = <>
      <span className="mastery-node-mark" aria-hidden="true">{id === 'feature' ? '' : tierNumeral(id)}</span>
      <span className="mastery-node-head">{head}{state !== 'plain' && <span className="sr-only"> · {STATE_LABEL[state]}</span>}
        {state === 'next' && <span className="mastery-node-tag" aria-hidden="true">다음</span>}</span>
    </>;
    return (
      <li key={id} className={`mastery-node is-${state}${id === 'feature' ? ' is-feature' : ''}${pressed ? ' is-selected' : ''}`}>
        {onSelect ? <button type="button" className="mastery-node-button" aria-pressed={pressed} onClick={() => onSelect(id)}>{content}</button>
          : <div className="mastery-node-button">{content}</div>}
        {full && <div className="mastery-node-body">{body}</div>}
      </li>
    );
  };
  return (
    <ol className={`mastery-tree${full ? ' is-full' : ''}`} aria-label={label ?? `${mastery.name} 테크트리`}>
      {node('feature', plain ? 'plain' : featureOpen ? 'learned' : 'locked',
        <><span className="mastery-node-tier">Feature</span> <span className="mastery-node-name" lang="en">{mastery.feature.name}</span></>,
        <MasteryText text={mastery.feature.text} original={masterySource(mastery.id, mastery.feature.name)} />)}
      {mastery.abilities.map((ability) => {
        const state: NodeState = plain ? 'plain' : ability.tier <= learned ? 'learned' : ability.tier === learned + 1 ? 'next' : 'locked';
        return node(ability.tier, state,
          <><span className="mastery-node-tier">Tier {tierNumeral(ability.tier)}</span> <span className="mastery-node-name" lang="en">{ability.name}</span></>,
          <MasteryText use={ability.use} text={ability.text} original={masterySource(mastery.id, ability.name)} />);
      })}
    </ol>
  );
}

function MasteryText({ use, text, original }: { use?: string; text: string; original?: string }) {
  return <>
    {use && <span className="mastery-node-use">{use.split(' · ').map((part) => <span key={part}>{part}</span>)}</span>}
    <p className="mastery-node-text">{text}</p>
    {original && <p className="mastery-original" lang="en">{original}</p>}
  </>;
}

/** The selected node of a compact tree, with its full rule text. */
export function MasteryNodeDetail({ mastery, node, children }: { mastery: MasteryInfo; node: number | 'feature'; children?: ReactNode }) {
  const ability = node === 'feature' ? null : mastery.abilities[node - 1];
  return (
    <div className="mastery-node-detail" role="region" aria-label={`${mastery.name} ${ability ? `Tier ${ability.tier}` : 'Feature'} 설명`}>
      <p className="mastery-node-detail-head"><span lang="en">{mastery.name}</span> · {ability ? `Tier ${tierNumeral(ability.tier)}` : 'Feature'}
        {' · '}<strong lang="en">{ability?.name ?? mastery.feature.name}</strong></p>
      <MasteryText use={ability?.use} text={ability?.text ?? mastery.feature.text}
        original={masterySource(mastery.id, ability?.name ?? mastery.feature.name)} />
      {children}
    </div>
  );
}

/** How a Mastery's five abilities work: weapon techniques (attack checks), Aether abilities, passives, and the rest. */
export function masteryMix(mastery: MasteryInfo) {
  const mix = { weapon: 0, aether: 0, passive: 0, other: 0 };
  for (const { use } of mastery.abilities) {
    if (use === '패시브') mix.passive += 1;
    else if (/공격 판정|무기 Skill|Weapons 판정/.test(use)) mix.weapon += 1;
    else if (/Aether/.test(use)) mix.aether += 1;
    else mix.other += 1;
  }
  return mix;
}
const MIX_LABEL = { aether: 'Aether 능력', weapon: '무기 기술', passive: '패시브', other: '기타' } as const;
export const masteryMixText = (mastery: MasteryInfo) => (Object.entries(masteryMix(mastery)) as [keyof typeof MIX_LABEL, number][])
  .filter(([, count]) => count > 0).sort(([a], [b]) => Object.keys(MIX_LABEL).indexOf(a) - Object.keys(MIX_LABEL).indexOf(b))
  .map(([kind, count]) => `${MIX_LABEL[kind]} ${count}`).join(' · ');

/** Every Mastery as a short card: play style, tags and how its abilities are paid for. */
export function MasteryList({ chosen, current, onOpen }: { chosen: string[]; current?: string; onOpen: (id: string) => void }) {
  return (
    <ul className="mastery-list" aria-label="Mastery 목록">
      {masteryCatalog.map((mastery) => {
        const brief = MASTERY_BRIEFS[mastery.id];
        const picked = chosen.indexOf(mastery.id);
        return (
          <li key={mastery.id}>
            <button type="button" className={`mastery-list-card${picked >= 0 ? ' is-chosen' : ''}`} aria-current={mastery.id === current ? 'true' : undefined}
              onClick={() => onOpen(mastery.id)}>
              <span className="mastery-list-head"><span className="mastery-list-name" lang="en">{mastery.name}</span>
                {picked >= 0 && <span className="mastery-list-pick">선택 {picked + 1}</span>}</span>
              {brief && <span className="mastery-list-style">{brief.style}</span>}
              <span className="mastery-list-tags">{brief?.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
              <span className="mastery-list-mix">{masteryMixText(mastery)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Flip through all 20 Masteries with buttons, ←/→ keys, a swipe, or the name strip; each page shows the whole tree
 * with every cost and effect, so choosing never needs the book.
 */
export function MasteryBrowser({ current, onCurrent, chosen, limit, onToggle, learnedFor, unavailable = [], initialView = 'list' }: {
  current: string;
  onCurrent: (id: string) => void;
  chosen: string[];
  limit: number;
  onToggle: (id: string) => void;
  /** Masteries that cannot be picked here (already learned) */
  unavailable?: string[];
  /** tiers this Mastery would open if picked (Tier 1 at creation) */
  learnedFor?: (id: string) => number;
  initialView?: 'list' | 'page';
}) {
  const [view, setView] = useState(initialView);
  const index = Math.max(0, masteryCatalog.findIndex(({ id }) => id === current));
  const mastery = masteryCatalog[index];
  const strip = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const go = (step: number) => {
    const next = masteryCatalog[(index + step + masteryCatalog.length) % masteryCatalog.length];
    onCurrent(next.id);
    setAnnounce(`${next.name} · ${masteryCatalog.indexOf(next) + 1} / ${masteryCatalog.length}`);
  };
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);
  const onKey = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest('input, select, textarea')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
  };
  const onDown = (event: PointerEvent) => { if (event.pointerType === 'touch') swipe.current = { x: event.clientX, y: event.clientY }; };
  const onUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 60 && Math.abs(event.clientY - start.y) < 50) go(dx < 0 ? 1 : -1);
  };
  if (view === 'list') {
    return (
      <section className="mastery-browser" aria-label="Mastery 둘러보기">
        <MasteryList chosen={chosen} current={current} onOpen={(id) => { onCurrent(id); setView('page'); }} />
      </section>
    );
  }
  const order = chosen.indexOf(mastery.id);
  const full = chosen.length >= limit && order < 0;
  const taken = unavailable.includes(mastery.id);
  return (
    <section className="mastery-browser" aria-label="Mastery 둘러보기" onKeyDown={onKey}>
      <button type="button" className="linkbtn mastery-browser-back" onClick={() => setView('list')}>‹ 전체 목록</button>
      <div className="mastery-browser-strip" ref={strip} role="group" aria-label="Mastery 목록">
        {masteryCatalog.map((item) => {
          const picked = chosen.indexOf(item.id);
          return <button key={item.id} type="button" lang="en" aria-current={item.id === mastery.id ? 'true' : undefined}
            className={picked >= 0 ? 'is-chosen' : undefined} onClick={() => onCurrent(item.id)}>
            {item.name}{picked >= 0 && <span className="mastery-browser-pick" lang="ko"> · 선택 {picked + 1}</span>}
          </button>;
        })}
      </div>
      <div className="mastery-browser-page" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { swipe.current = null; }}>
        <div className="mastery-browser-head">
          <button type="button" className="btn ghost mastery-browser-step" onClick={() => go(-1)}
            aria-label={`이전 Mastery ${masteryCatalog[(index + masteryCatalog.length - 1) % masteryCatalog.length].name}`}>‹</button>
          <div className="mastery-browser-title">
            <h3 lang="en">{mastery.name}</h3>
            <span className="mastery-browser-count">{index + 1} / {masteryCatalog.length}</span>
          </div>
          <button type="button" className="btn ghost mastery-browser-step" onClick={() => go(1)}
            aria-label={`다음 Mastery ${masteryCatalog[(index + 1) % masteryCatalog.length].name}`}>›</button>
        </div>
        <p className="mastery-browser-role">{MASTERY_BRIEFS[mastery.id]?.style ?? mastery.role}</p>
        {MASTERY_BRIEFS[mastery.id] && <p className="mastery-list-tags">{MASTERY_BRIEFS[mastery.id].tags.map((tag) => <span key={tag}>{tag}</span>)}</p>}
        <div className="mastery-browser-actions">
          <button type="button" className={order >= 0 ? 'btn ghost' : 'btn primary'} disabled={full || taken} aria-pressed={order >= 0}
            onClick={() => onToggle(mastery.id)}>{taken ? '이미 배운 Mastery' : order >= 0 ? `선택 ${order + 1} 해제` : full ? `${limit}개를 이미 골랐습니다` : '이 Mastery 선택'}</button>
          <XRef id={mastery.id}>도감 페이지</XRef>
        </div>
        <MasteryTree mastery={mastery} learned={learnedFor?.(mastery.id) ?? 0} full />
        {mastery.notes.length > 0 && <ul className="mastery-browser-notes" aria-label="규칙상 열린 부분">
          {mastery.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>}
        <p className="mastery-browser-hint">← → 키나 옆으로 밀어서 넘길 수 있습니다.</p>
      </div>
      <p className="sr-only" role="status">{announce}</p>
    </section>
  );
}
