export type LockTarget = 'door' | 'container' | 'environment';
export type Detection = '' | 'success' | 'failure';
export type LockOutcome = Exclude<Detection, ''>;
export type TrapMethod = '' | 'disarm' | 'bypass' | 'trigger';

export interface TrapInvestigationProgress {
  kind: number | null;
  method: TrapMethod;
  result: LockOutcome | null;
  avoided: LockOutcome | null;
}

export interface DoorInvestigation {
  detection: Detection;
  touched: boolean;
  trapRoll: number | null;
  lockRoll: number | null;
  trapResolved: boolean;
  trap: TrapInvestigationProgress | null;
  pickFailures: number;
  forceFailures: number;
}

export const EMPTY_DOOR_INVESTIGATION: DoorInvestigation = {
  detection: '', touched: false, trapRoll: null, lockRoll: null, trapResolved: false, trap: null,
  pickFailures: 0, forceFailures: 0,
};

export const LOCK_THRESHOLDS = { door: 12, container: 10 } as const;
export const TRAP_THRESHOLD = 7;

/** Core pp.117–119. Environment here means a place with a known trap. */
export function trapInvestigation(target: LockTarget, detection: Detection, touched: boolean, trapDie: number | null) {
  if (!detection) return 'detect';
  if (target === 'environment') return detection === 'success' ? 'spotted' : 'triggered';
  if (detection === 'failure' && !touched) return 'choose';
  if (trapDie === null) return 'roll';
  if (trapDie < TRAP_THRESHOLD) return 'clear';
  return detection === 'success' ? 'spotted' : 'triggered';
}

export function forceOpeningBonus(previousFailures: number, crowbar: boolean) {
  return 20 * previousFailures + (crowbar ? 10 : 0);
}

export function lockpickDifficulty(previousFailures: number) {
  return Math.min(10 * previousFailures, 30);
}
