// Scenario library index. Add new template files here.
import police from './police.js';
import traffic from './traffic.js';
import fire from './fire.js';
import medical from './medical.js';
import rescueService from './rescue_service.js';
import misc from './misc.js';

export const SCENARIOS = [...police, ...traffic, ...fire, ...medical, ...rescueService, ...misc];
export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
