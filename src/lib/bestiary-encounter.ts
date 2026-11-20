import { campaignHref, DEFAULT_PLAY_CAMPAIGN, readTabCampaign } from './play-campaigns';

export const BESTIARY_CREATURE_PARAM = 'encounter-creature';

export function bestiaryEncounterHref(creatureId: string) {
  const params = new URLSearchParams({ [BESTIARY_CREATURE_PARAM]: creatureId });
  const campaign = readTabCampaign();
  return campaign && campaign !== DEFAULT_PLAY_CAMPAIGN ? campaignHref(campaign, params) : `/play?${params}`;
}
