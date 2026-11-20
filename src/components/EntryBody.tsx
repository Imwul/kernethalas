import { useRef, type ReactNode } from 'react';
import type { Entry } from '../content/schema';
import { CATEGORY_LABEL } from '../content';
import { creatureById } from '../content/entries/creatures';
import { bestiaryEncounterHref } from '../lib/bestiary-encounter';
import { isUsageDieRule } from '../lib/usage-die';
import { CreatureCombatCard } from './CreatureCombatCard';
import { DamageCalculator } from './DamageCalculator';
import { RulingNote } from './RulingNote';
import { UsageDieTool } from './UsageDieTool';
import { Link } from '../lib/router';
import { Cite, Notes, Relations, VChip, XRef } from './bits';

export function EntryBody({ e, compact = false, hideTitle = false, actions }: { e: Entry; compact?: boolean; hideTitle?: boolean; actions?: ReactNode }) {
  const cat = CATEGORY_LABEL[e.category];
  const isMastery = e.tags?.includes('Mastery') ?? false;
  const Title = compact ? 'h2' : 'h1';
  const related = useRef<HTMLElement>(null);
  const creature = creatureById.get(e.id);
  const hasDetails = !!(e.resolution?.length || e.outcomes?.length || (!creature && e.stats) || e.details?.length);
  const hasRelated = !!(e.related.length || e.tables?.length || e.procedures?.length);
  return (
    <article className="folio reference-folio">
      {!(creature && hideTitle) && <header className={`folio-head${hideTitle ? ' folio-head-compact' : ''}`}>
        <div className="reference-category">{cat?.ko}</div>
        {!hideTitle && <Title className="folio-title">{e.ko}{e.ko !== e.en && <span className="en">{e.en}</span>}</Title>}
        {hideTitle && e.ko !== e.en && <span className="en">{e.en}</span>}
        <div className="marks"><VChip v={e.verification} /> <Cite source={e.source} /></div>
        {actions && <div className="actions">{actions}</div>}
      </header>}

      {creature && <div className="creature-reference-actions">
        <Link className="btn ghost" to={bestiaryEncounterHref(creature.id)}
          aria-label={`${creature.name} 조우에 추가`}>조우에 추가</Link>
      </div>}
      <RulingNote key={`note:${e.id}`} id={e.id} />

      {creature ? <CreatureCombatCard key={creature.id} creature={creature} entry={e} /> : <section className="reference-quick">
        <h2 className="reference-label">빠른 답</h2>
        <p className="reference-summary">{e.summary}</p>
        {e.when && <p className="reference-when"><strong>적용 시점</strong> {e.when}</p>}
        {e.exceptions?.length ? (
          <div className="reference-exceptions">
            <h3>예외와 주의</h3>
            <ul className="bullets">{e.exceptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>
        ) : null}
        {isUsageDieRule(e.id) && <UsageDieTool key={e.id} rule={e.id} />}
        {e.id === 'damage-to-pc' && <DamageCalculator pc confirmedFirst unlocatedArmor={null} initialCritical={false} />}
        {hasRelated && (
          <button className="reference-related-jump linkbtn" onClick={() => {
            related.current?.scrollIntoView({ block: 'start' });
            related.current?.focus({ preventScroll: true });
          }}>관련 항목으로 이동</button>
        )}
      </section>}

      {hasDetails && (
        <section className="reference-details">
          <h2 className="reference-label">세부 규칙</h2>
          {e.resolution?.length ? (
            <div className="block">
              <h3>판정 순서</h3>
              <ol className="steps">{e.resolution.map((item, index) => <li key={index}>{item}</li>)}</ol>
            </div>
          ) : null}
          {e.outcomes?.length ? (
            <div className="block">
              <h3>{isMastery ? 'Feature와 능력' : e.kind === 'trait' || e.kind === 'term' ? '항목' : '결과와 효과'}</h3>
              <dl className={`outcomes${isMastery ? ' tiers' : ''}`}>
                {e.outcomes.map((outcome, index) => (
                  <div className={`outcome${isMastery && index === 0 ? ' feature' : ''}`} key={index}>
                    <dt>{outcome.label}</dt>
                    <dd>{outcome.meta && <span className="o-meta">{outcome.meta}</span>}{outcome.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          {!creature && e.stats && (
            <dl className="statgrid">
              {Object.entries(e.stats).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          )}
          {e.details?.length ? (
            <div className="block">
              <h3>세부 사항</h3>
              <ul className="bullets">{e.details.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </div>
          ) : null}
        </section>
      )}

      {hasRelated && (
        <aside className="reference-related" aria-label="관련 항목" ref={related} tabIndex={-1}>
          <h2 className="reference-label">관련 항목</h2>
          {(e.tables?.length || e.procedures?.length) ? (
            <div className="reference-related-links">
              {e.procedures?.map((id) => <XRef key={id} id={id} showKind />)}
              {e.tables?.map((id) => <XRef key={id} id={id} showKind />)}
            </div>
          ) : null}
          <Relations related={e.related} />
        </aside>
      )}

      <section className="reference-source">
        <h2 className="reference-label">출처와 검증</h2>
        <p>Gravebound Edition v1.2</p>
        <Cite source={e.source} />
        <Link className="reference-source-link" to="/sources">출처 및 검증 기준</Link>
        <Notes notes={e.notes} />
      </section>
    </article>
  );
}
