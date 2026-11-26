import type { ComponentType } from 'react';
import { CampCalculator } from './CampCalculator';
import { CharacterCreator } from './CharacterCreator';
import { CheckCalculator } from './CheckCalculator';
import { EncounterStart } from './EncounterStart';
import { LockTrapTool } from './LockTrapTool';
import { LootJournal } from './LootJournal';
import { TensionTool } from './TensionTool';

export const procedureTools: Partial<Record<string, ComponentType>> = {
  'p-new-run': () => <CharacterCreator />,
  'p-attack': () => <CheckCalculator attackOnly />,
  'p-initiative': EncounterStart,
  'p-locks-traps': LockTrapTool,
  'p-tension': TensionTool,
  'p-rest': CampCalculator,
  'p-potion': () => <LootJournal kind="potion" />,
  'p-magic-item': () => <LootJournal kind="magic-item" />,
};
