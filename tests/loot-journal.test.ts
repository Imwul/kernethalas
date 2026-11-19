import { describe, expect, it } from 'vitest';
import { journalPropertyText, journalRarity, journalRow, potionJournalLine, propertyCount } from '../src/lib/loot-journal';

describe('loot journal summaries', () => {
  it('shows the potion effect and an aging modifier together, except when aging replaces the effect', () => {
    const heal = journalRow('t-potions', 7)!;
    expect(potionJournalLine(heal, journalRow('t-potion-aging', 12)!, false)).toBe('Heal 물약 · 기본 효과 D6+2 Wounds 즉시 회복');
    expect(potionJournalLine(heal, journalRow('t-potion-aging', 9)!, false)).toContain('효과 절반');
    expect(potionJournalLine(heal, journalRow('t-potion-aging', 2)!, true)).toBe('Heal 물약 (마심) · 노화 독으로 변함 — Endurance 실패 시 Poisoned (1)');
    expect(potionJournalLine(heal, journalRow('t-potion-aging', 6)!, false)).not.toContain('Wounds 즉시 회복');
  });

  it('takes the property count from rarity and selects the corresponding formula without changing other text', () => {
    const uncommon = journalRarity(journalRow('t-item-rarity', 5))!;
    const rare = journalRarity(journalRow('t-item-rarity', 6))!;
    const epic = journalRarity(journalRow('t-item-rarity', 10))!;
    expect([uncommon, rare, epic].map(propertyCount)).toEqual([1, 2, 3]);
    expect(journalPropertyText(journalRow('t-props-armor', 16)!, rare)).toContain('D10+3 Wounds');
    expect(journalPropertyText(journalRow('t-props-weapon', 9)!, epic)).toContain('+3D6');
    expect(journalPropertyText(journalRow('t-props-weapon', 8)!, rare, { subject: 'Undead' })).toContain('추가 피해 +2 (Undead)');
    expect(journalPropertyText(journalRow('t-props-boots', 19)!, uncommon)).toContain('Unarmed/Fist');
    expect(journalPropertyText(journalRow('t-props-gloves', 20)!, uncommon, { fixedD10: 7 })).toBe('최대 Toughness +7');
  });
});
