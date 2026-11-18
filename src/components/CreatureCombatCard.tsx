import { useState } from 'react';
import { titleOf } from '../content';
import { creatureDefenses } from '../content/creature-defenses';
import { armorKo, TYPE_KO, type CreatureRecord } from '../content/entries/creatures';
import type { Entry } from '../content/schema';
import { calculateCreatureAdaptation, readCreatureLevel } from '../lib/creature-adaptation';
import { creatureActionTable, creatureHitTable, creatureSpoilsTables } from '../lib/creature-combat';
import { creatureActionSource } from '../lib/overlay';
import { OracleBody } from '../views/Oracle';
import { XRef } from './bits';
import { CreatureAdaptation } from './CreatureAdaptation';
import '../styles/creature-combat.css';

export function CreatureCombatCard({ creature, entry }: { creature: CreatureRecord; entry: Entry }) {
  const [levelText, setLevelText] = useState('');
  const [mode, setMode] = useState<'action' | 'hit'>('action');
  const [actionValue, setActionValue] = useState<number | null>(null);
  const [hitValue, setHitValue] = useState<number | null>(null);
  const adjustment = calculateCreatureAdaptation(creature, readCreatureLevel(levelText));
  const action = creatureActionTable(creature, entry);
  const hit = creatureHitTable(creature, entry, adjustment.armorBonuses);
  const spoils = creatureSpoilsTables(creature);
  const kind = creature.group === 'overseer' ? 'Overseer' : creature.group === 'overseer-summon' ? 'Overseer 소환수' : creature.group === 'minion' ? 'Mastery 소환수' : '일반 생물';
  const ruthlessness = creature.traits.map((trait) => /^Ruthlessness \((\d+)\)$/i.exec(trait)).find(Boolean);
  const defenses = creatureDefenses(creature);

  return (
    <section className="creature-combat" aria-label="전투 카드">
      <header className="creature-combat-head">
        <h2>전투 카드</h2>
        <span>{kind} · {creature.types.map((type) => TYPE_KO[type] ?? type).join(' · ')}</span>
      </header>
      <CreatureAdaptation creature={creature} levelText={levelText} onLevelChange={setLevelText} />
      <dl className="creature-combat-meta">
        <div><dt>개체 수</dt><dd>{creature.number}</dd></div>
        <div><dt>Armor</dt><dd>{armorKo(creature.armor)}</dd></div>
        <div><dt>명중 부위</dt><dd>{entry.stats?.['Hit Location']}</dd></div>
        {ruthlessness && <div><dt>라운드당 턴</dt><dd>{Number(ruthlessness[1]) + 1} <XRef id="ruthlessness">{ruthlessness[0]}</XRef></dd></div>}
      </dl>
      <CreatureDefenseSummary defenses={defenses} />
      {defenses.otherTraits.length > 0 && <p className="creature-combat-traits"><XRef id="creature-traits">특성</XRef> {defenses.otherTraits.join(' · ')}</p>}
      <div className="creature-roll-tools">
        <div className="seg" role="group" aria-label="전투 도구">
          <button type="button" aria-pressed={mode === 'action'} onClick={() => setMode('action')}>행동 {action.dice}</button>
          <button type="button" aria-pressed={mode === 'hit'} onClick={() => setMode('hit')}>명중 부위{hit ? ` ${hit.dice}` : ''}</button>
        </div>
        <div hidden={mode !== 'action'}>
          <OracleBody t={action} value={actionValue} onValue={setActionValue} compact collapseTableBeforeRoll
            rollLabel={`${action.dice} 굴리기`} sourceForRow={(row) => row.label ? creatureActionSource(creature.id, row.label) : undefined} />
        </div>
        <div hidden={mode !== 'hit'}>
          {hit ? <OracleBody t={hit} value={hitValue} onValue={setHitValue} compact collapseTableBeforeRoll rollLabel={`${hit.dice} 굴리기`} />
            : <p className="creature-fixed-hit">{entry.stats?.['Hit Location']}</p>}
        </div>
      </div>
      <section className="creature-reactions" aria-label="방어 동작과 펌블">
        <h3>방어 동작과 펌블</h3>
        <div className="creature-reaction-links">
          <XRef id="t-defensive-move-pc">PC 방어 동작</XRef>
          <XRef id="t-defensive-move-npc">적 방어 동작</XRef>
          <XRef id="t-fumble-pc">PC 공격자 펌블</XRef>
          <XRef id="t-fumble-npc">적 공격자 펌블</XRef>
        </div>
      </section>
      <CreatureAftermath creature={creature} spoils={spoils} />
      <details className="fold creature-other-stats">
        <summary>기타 능력치와 레벨 적응</summary>
        <dl className="creature-combat-meta">
          <div><dt>Mind</dt><dd>{creature.mind}</dd></div>
          <div><dt>Body</dt><dd>{creature.body}</dd></div>
          <div><dt>Endurance</dt><dd>{creature.endurance}</dd></div>
        </dl>
        {creature.levelAdaptation && (
          <div className="creature-adaptation-source">
            <h3>레벨 적응 기준</h3>
            <ul>
              {creature.levelAdaptation.split(/(?=After level \d+:)/i).map((part) => <li key={part}>{part.trim()}</li>)}
            </ul>
          </div>
        )}
      </details>
    </section>
  );
}

function CreatureDefenseSummary({ defenses }: { defenses: ReturnType<typeof creatureDefenses> }) {
  const rows = [
    { key: 'vulnerable', label: '취약 ×2', items: defenses.vulnerable },
    { key: 'resistant', label: '저항 ½', items: defenses.resistant },
    { key: 'restored', label: '회복', items: defenses.restored },
    { key: 'immune', label: '상태 면역', items: defenses.immuneConditions.map((condition) => titleOf(condition.toLowerCase()).ko) },
  ].filter(({ items }) => items.length > 0);
  if (!rows.length) return null;

  return (
    <section className="creature-defenses" aria-label="피해 반응과 상태 면역">
      <h3><XRef id="vulnerability">피해 반응</XRef></h3>
      <dl>
        {rows.map(({ key, label, items }) => <div key={key} className={key}><dt>{label}</dt><dd>{items.join(' · ')}</dd></div>)}
      </dl>
    </section>
  );
}

function CreatureAftermath({ creature, spoils }: { creature: CreatureRecord; spoils: string[] }) {
  const overseer = creature.group === 'overseer';
  const hasSpoils = spoils.length > 0 || (creature.spoils && !/^[–—-]$/.test(creature.spoils));

  return (
    <section className="creature-aftermath" aria-label="전투 종료">
      <h3>전투 종료</h3>
      <dl className="creature-aftermath-list">
        <div><dt><XRef id="combat-end">회복</XRef></dt><dd>전투가 끝나면 Toughness D4 회복</dd></div>
        <div><dt><XRef id="armor-integrity">방어구 내구도</XRef></dt><dd>이번 전투에서 사용한 방어구의 Integrity 굴림</dd></div>
        <div><dt><XRef id="lingering-damage">지속 피해</XRef></dt><dd>출혈·화상·중독이 남으면 상태마다 방당 Health 1 피해</dd></div>
        {(overseer || creature.group === 'creature') && <div>
          <dt><XRef id={overseer ? 'overseers' : 'leveling-up'}>경험치</XRef></dt>
          <dd>{overseer ? 'Overseer 처치 시 XP +200, Sanity D4 회복' : '일반 전투 조우에서 승리하면 XP +50'}</dd>
        </div>}
      </dl>
      {hasSpoils && (
        <section className="creature-spoils" aria-label="처치 보상">
          <h4>처치 보상</h4>
          {spoils.length > 0 ? (
            <div className="creature-spoils-links">
              {spoils.map((id) => <XRef key={id} id={id} showKind />)}
              {overseer && <XRef id="overseers">Overseer 처치 효과</XRef>}
            </div>
          ) : <p>{creature.spoils}</p>}
        </section>
      )}
    </section>
  );
}
