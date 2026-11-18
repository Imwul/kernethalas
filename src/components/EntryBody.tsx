import { useRef, type ReactNode } from 'react';
import type { Entry } from '../content/schema';
import { CATEGORY_LABEL } from '../content';
import { creatureActionSource } from '../lib/overlay';
import { Link } from '../lib/router';
import { Cite, Notes, Relations, VChip, XRef } from './bits';

export function EntryBody({ e, compact = false, hideTitle = false, actions }: { e: Entry; compact?: boolean; hideTitle?: boolean; actions?: ReactNode }) {
  const cat = CATEGORY_LABEL[e.category];
  const isMastery = e.tags?.includes('Mastery') ?? false;
  const Title = compact ? 'h2' : 'h1';
  const related = useRef<HTMLElement>(null);
  const hasDetails = !!(e.resolution?.length || e.outcomes?.length || e.stats || e.details?.length);
  const hasRelated = !!(e.related.length || e.tables?.length || e.procedures?.length);
  return (
    <article className="folio reference-folio">
      <header className={`folio-head${hideTitle ? ' folio-head-compact' : ''}`}>
        <div className="reference-category">{cat?.ko}</div>
        {!hideTitle && <Title className="folio-title">{e.ko}{e.ko !== e.en && <span className="en">{e.en}</span>}</Title>}
        {hideTitle && e.ko !== e.en && <span className="en">{e.en}</span>}
        <div className="marks"><VChip v={e.verification} /> <Cite source={e.source} /></div>
        {actions && <div className="actions">{actions}</div>}
      </header>

      <section className="reference-quick">
        <h2 className="reference-label">빠른 답</h2>
        <p className="reference-summary">{e.summary}</p>
        {e.when && <p className="reference-when"><strong>적용 시점</strong> {e.when}</p>}
        {e.exceptions?.length ? (
          <div className="reference-exceptions">
            <h3>예외와 주의</h3>
            <ul className="bullets">{e.exceptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>
        ) : null}
        {hasRelated && (
          <button className="reference-related-jump linkbtn" onClick={() => {
            related.current?.scrollIntoView({ block: 'start' });
            related.current?.focus({ preventScroll: true });
          }}>관련 항목으로 이동</button>
        )}
      </section>

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
          {e.stats && <Stats e={e} />}
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

const TAG_HINT: Record<string, string> = {
  Physical: 'Physical — 일반 공격 판정으로 처리',
  Magical: 'Magical 행동의 기본 저항은 Spellward다. 별도 판정은 해당 행동 설명을 확인한다.',
  '': '태그 없음 — 설명에 적힌 대로 처리',
};

function Stats({ e }: { e: Entry }) {
  const s = e.stats!;
  const actionsKey = Object.keys(s).find((k) => k.startsWith('Actions'));
  const plain = Object.entries(s).filter(([k]) => k !== actionsKey && k !== 'Level Adaptation' && k !== 'Traits' && k !== 'Spoils');
  return (
    <section className="block">
      <h3>능력치</h3>
      <dl className="statgrid" style={{ margin: 0 }}>
        {plain.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {['Traits', 'Spoils', 'Level Adaptation'].filter((k) => s[k]).map((k) => (
          <div key={k} className="wide">
            <dt>{k}</dt>
            <dd style={{ fontSize: 16.5 }}>
              {k === 'Level Adaptation'
                ? s[k].split(/(?=After level \d+:)/).map((part) => (
                    <span key={part} style={{ display: 'block' }}>
                      {part.trim()}
                    </span>
                  ))
                : s[k]}
            </dd>
          </div>
        ))}
      </dl>
      {actionsKey && (
        <table className="ttable actions" style={{ marginTop: 16 }}>
          <caption>{actionsKey} — 적 턴에 굴려 행동 결정</caption>
          <thead>
            <tr>
              <th scope="col">범위</th>
              <th scope="col">행동 · 효과</th>
            </tr>
          </thead>
          <tbody>
            {s[actionsKey].split('\n').map((line) => {
              const [rng, name, tag, effect] = line.split('\t');
              const src = creatureActionSource(e.id, name);
              return (
                <tr key={line}>
                  <td className="rng">{rng}</td>
                  <td>
                    <span className="lbl">
                      {name}
                      <span className={`atag ${tag ? `t-${tag.toLowerCase()}` : 't-none'}`} title={TAG_HINT[tag || '']}>
                        {tag ? tag : '설명대로 판정'}
                      </span>
                    </span>
                    {effect && <span className="fx">{effect}</span>}
                    {src && <span className="src">{src}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
