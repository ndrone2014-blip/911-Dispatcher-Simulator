// CAD incident type catalog. `needs` drives recommendations (never enforced).
// Priority: 1 = emergency, 2 = urgent, 3 = routine, 4 = low / service.

export const INCIDENT_CATEGORIES = {
  police: { label: 'Police', color: '#4f8cff' },
  traffic: { label: 'Traffic', color: '#ffb84d' },
  fire: { label: 'Fire', color: '#ff5a4e' },
  medical: { label: 'Medical', color: '#2fd08a' },
  rescue: { label: 'Rescue', color: '#ff9f43' },
  hazard: { label: 'Hazard', color: '#e8e05a' },
  service: { label: 'Service', color: '#9fb3c8' },
  federal: { label: 'Federal / Special', color: '#b0b8c4' },
  weather: { label: 'Weather / Disaster', color: '#b47cff' },
};

const T = (id, label, code, category, priority, severity, workload, needs) => ({ id, label, code, category, priority, severity, workload, needs });

export const INCIDENT_TYPES = [
  // Police – small/medium
  T('NOISE', 'Noise Complaint', 'NOISE', 'police', 4, 'small', 45, { patrol: 1 }),
  T('PARKING', 'Parking Complaint', 'PARK', 'police', 4, 'small', 35, { patrol: 0.5, traffic: 0.5 }),
  T('SUSP', 'Suspicious Activity', 'SUSP', 'police', 3, 'small', 60, { patrol: 2 }),
  T('SUSP_VEH', 'Suspicious Vehicle', 'SUSPV', 'police', 3, 'small', 50, { patrol: 1 }),
  T('WELFARE', 'Welfare Check', 'WELF', 'police', 3, 'small', 60, { patrol: 1 }),
  T('DISTURB', 'Disturbance', 'DIST', 'police', 2, 'medium', 80, { patrol: 2 }),
  T('DOMESTIC', 'Domestic Disturbance', 'DOM', 'police', 1, 'medium', 110, { patrol: 2, police_command: 0.5 }),
  T('THEFT', 'Theft Report', 'THEFT', 'police', 3, 'small', 70, { patrol: 1, investigation: 0.3 }),
  T('SHOPLIFT', 'Shoplifter in Custody', 'SHOP', 'police', 3, 'small', 60, { patrol: 1 }),
  T('BURGLARY', 'Burglary', 'BURG', 'police', 2, 'medium', 110, { patrol: 2, investigation: 0.5, k9: 0.5 }),
  T('BURG_PROG', 'Burglary in Progress', 'BURGIP', 'police', 1, 'medium', 120, { patrol: 3, k9: 1, police_command: 0.5 }),
  T('VANDAL', 'Vandalism', 'VAND', 'police', 4, 'small', 45, { patrol: 1 }),
  T('TRESPASS', 'Trespassing', 'TRESP', 'police', 3, 'small', 50, { patrol: 1 }),
  T('ASSAULT', 'Assault', 'ASLT', 'police', 1, 'medium', 120, { patrol: 2, bls: 1, investigation: 0.5 }),
  T('ROBBERY', 'Robbery', 'ROB', 'police', 1, 'medium', 140, { patrol: 3, k9: 0.5, investigation: 1, air: 0.3 }),
  T('ARMED', 'Armed Subject', 'ARMED', 'police', 1, 'major', 220, { patrol: 4, police_command: 1, tactical: 1, bls: 1 }),
  T('SHOTS', 'Shots Fired', 'SHOTS', 'police', 1, 'major', 200, { patrol: 4, police_command: 1, forensics: 0.5, bls: 1, investigation: 0.5 }),
  T('BARRICADE', 'Barricaded Subject', 'BARR', 'police', 1, 'major', 360, { patrol: 4, tactical: 2, police_command: 1, bls: 1, comms: 0.5 }),
  T('HOSTAGE', 'Hostage Situation', 'HOST', 'police', 1, 'major', 420, { patrol: 4, tactical: 3, police_command: 1, federal: 0.5, bls: 1, comms: 1 }),
  T('MISSING', 'Missing Person', 'MISS', 'police', 2, 'medium', 200, { patrol: 2, k9: 1, sar: 0.5, air: 0.5 }),
  T('MISSING_CHILD', 'Missing Child', 'MISSC', 'police', 1, 'major', 260, { patrol: 4, k9: 1, sar: 1, air: 1, police_command: 1 }),
  T('PURSUIT', 'Vehicle Pursuit', 'PURS', 'police', 1, 'major', 160, { patrol: 3, air: 1, police_command: 1, traffic: 1 }),
  T('FRAUD', 'Fraud / Scam Report', 'FRAUD', 'police', 4, 'small', 60, { patrol: 0.5, cyber: 0.5 }),
  T('CYBER', 'Cybercrime / Online Threat', 'CYBER', 'police', 3, 'small', 100, { cyber: 1, investigation: 0.5 }),
  T('GANG', 'Gang Activity', 'GANG', 'police', 2, 'medium', 140, { patrol: 2, gang: 1 }),
  T('NARCOTICS', 'Narcotics Activity', 'NARC', 'police', 3, 'medium', 140, { patrol: 2, narcotics: 1 }),
  T('DRUG_LAB', 'Suspected Drug Lab', 'DLAB', 'federal', 2, 'major', 320, { narcotics: 2, hazmat: 1, patrol: 2, federal: 1 }),
  T('BOMB', 'Suspicious Package / Bomb Threat', 'BOMB', 'federal', 1, 'major', 300, { bomb: 1, patrol: 3, police_command: 1, suppression: 1, bls: 1 }),
  T('FEDERAL', 'Federal Incident', 'FED', 'federal', 2, 'major', 260, { federal: 2, patrol: 2 }),
  T('INTOX', 'Intoxicated Person', 'INTOX', 'police', 3, 'small', 60, { patrol: 1, bls: 0.5 }),
  T('ASSIST', 'Public Assistance', 'ASSIST', 'service', 4, 'small', 40, { patrol: 1 }),
  T('LOCKOUT', 'Vehicle / Home Lockout', 'LOCK', 'service', 4, 'small', 40, { patrol: 0.5 }),
  T('ALARM_RES', 'Residential Alarm', 'ALRMR', 'police', 3, 'small', 55, { patrol: 1 }),
  T('ALARM_COM', 'Commercial Alarm', 'ALRMC', 'police', 3, 'small', 55, { patrol: 1 }),
  T('PANIC', 'Panic / Hold-up Alarm', 'PANIC', 'police', 1, 'medium', 90, { patrol: 3 }),
  T('TRAFFIC_STOP', 'Traffic Stop', 'TSTOP', 'traffic', 4, 'small', 50, { patrol: 1 }),
  // Traffic
  T('MVA_MINOR', 'Minor Vehicle Accident', 'MVA', 'traffic', 3, 'small', 70, { patrol: 1, traffic: 0.5 }),
  T('MVA_INJ', 'Vehicle Accident with Injuries', 'MVAI', 'traffic', 2, 'medium', 140, { patrol: 1, traffic: 1, bls: 1, suppression: 1 }),
  T('MVA_ENTRAP', 'Vehicle Accident – Entrapment', 'MVAE', 'traffic', 1, 'major', 240, { patrol: 2, traffic: 1, rescue: 1, suppression: 1, als: 1, bls: 1, fire_command: 0.5 }),
  T('MVA_MAJOR', 'Major Multi-Vehicle Accident', 'MVAM', 'traffic', 1, 'major', 380, { patrol: 3, traffic: 2, rescue: 1, suppression: 2, als: 2, bls: 2, fire_command: 1, ems_command: 1, dot: 1 }),
  T('HIT_RUN', 'Hit and Run', 'HITR', 'traffic', 2, 'medium', 90, { patrol: 2, traffic: 1 }),
  T('DUI', 'Reckless / Impaired Driver', 'DUI', 'traffic', 2, 'small', 60, { patrol: 1, traffic: 1 }),
  T('DISABLED', 'Disabled Vehicle', 'DISV', 'traffic', 4, 'small', 45, { traffic: 1 }),
  T('OBSTRUCT', 'Road Obstruction / Debris', 'OBST', 'traffic', 3, 'small', 50, { traffic: 0.5, public_works: 1 }),
  T('SIGNAL', 'Traffic Signal Out', 'SIGNL', 'traffic', 3, 'small', 60, { traffic: 1, dot: 1 }),
  T('ROAD_CLOSE', 'Road Closure', 'RDCL', 'traffic', 3, 'medium', 140, { traffic: 1, dot: 1, public_works: 0.5 }),
  T('PED_STRUCK', 'Pedestrian Struck', 'PEDS', 'traffic', 1, 'medium', 160, { patrol: 2, traffic: 1, als: 1, bls: 1 }),
  // Fire
  T('FIRE_ALARM', 'Fire Alarm', 'FALRM', 'fire', 3, 'medium', 60, { suppression: 1, ladder: 0.5 }),
  T('FIRE_STR', 'Structure Fire', 'STRF', 'fire', 1, 'major', 360, { suppression: 3, ladder: 1, rescue: 0.5, fire_command: 1, bls: 1, patrol: 1 }),
  T('FIRE_STR_LG', 'Large Commercial Fire', 'COMF', 'fire', 1, 'major', 520, { suppression: 5, ladder: 2, rescue: 1, fire_command: 1, bls: 1, als: 0.5, patrol: 2, utility: 0.5 }),
  T('FIRE_VEH', 'Vehicle Fire', 'VEHF', 'fire', 2, 'small', 80, { suppression: 1, traffic: 0.5 }),
  T('FIRE_BRUSH', 'Brush / Grass Fire', 'BRSH', 'fire', 2, 'medium', 160, { wildland: 1, suppression: 1 }),
  T('FIRE_WILD', 'Wildland Fire', 'WILD', 'fire', 1, 'major', 420, { wildland: 2, suppression: 2, fire_command: 1, air: 0.5, em: 0.5 }),
  T('FIRE_TRASH', 'Dumpster / Trash Fire', 'TRSH', 'fire', 3, 'small', 50, { suppression: 1 }),
  T('SMOKE', 'Smoke Investigation', 'SMOK', 'fire', 2, 'small', 60, { suppression: 1 }),
  T('ODOR_GAS', 'Gas Leak / Odor', 'GAS', 'hazard', 2, 'medium', 110, { suppression: 1, utility: 1, hazmat: 0.3 }),
  T('CO_ALARM', 'Carbon Monoxide Alarm', 'CO', 'hazard', 2, 'small', 60, { suppression: 1, bls: 0.5 }),
  T('HAZMAT', 'Hazardous Materials Incident', 'HAZ', 'hazard', 1, 'major', 400, { hazmat: 2, suppression: 2, fire_command: 1, bls: 1, patrol: 1, em: 0.5 }),
  T('WIRES', 'Wires Down', 'WIRE', 'hazard', 2, 'small', 80, { utility: 1, suppression: 0.5 }),
  T('ELEVATOR', 'Elevator Rescue', 'ELEV', 'rescue', 3, 'small', 70, { rescue: 0.5, suppression: 1 }),
  T('EXPLOSION', 'Explosion', 'EXPL', 'fire', 1, 'major', 480, { suppression: 3, rescue: 1, hazmat: 1, fire_command: 1, als: 1, bls: 2, patrol: 2, bomb: 0.5 }),
  // Medical
  T('MED_MINOR', 'Minor Medical', 'MEDM', 'medical', 3, 'small', 70, { bls: 1 }),
  T('MED_FALL', 'Fall / Lift Assist', 'FALL', 'medical', 3, 'small', 60, { bls: 1 }),
  T('MED_CHEST', 'Chest Pain', 'CHST', 'medical', 1, 'medium', 120, { als: 1, bls: 0.5 }),
  T('MED_BREATH', 'Difficulty Breathing', 'BRTH', 'medical', 1, 'medium', 120, { als: 1, bls: 0.5 }),
  T('MED_ARREST', 'Cardiac Arrest', 'ARST', 'medical', 1, 'major', 200, { als: 2, bls: 1, suppression: 1, ems_command: 0.5 }),
  T('MED_STROKE', 'Stroke', 'STRK', 'medical', 1, 'medium', 120, { als: 1, bls: 0.5 }),
  T('MED_OD', 'Overdose', 'OD', 'medical', 1, 'medium', 120, { als: 1, patrol: 0.5 }),
  T('MED_DIABETIC', 'Diabetic Emergency', 'DIAB', 'medical', 2, 'small', 90, { als: 0.5, bls: 1 }),
  T('MED_SEIZURE', 'Seizure', 'SEIZ', 'medical', 2, 'medium', 100, { als: 1 }),
  T('MED_ALLERGIC', 'Allergic Reaction', 'ALRG', 'medical', 1, 'medium', 100, { als: 1 }),
  T('MED_BIRTH', 'Childbirth / Labor', 'OB', 'medical', 1, 'medium', 120, { als: 1, bls: 1 }),
  T('MED_INJURY', 'Injury', 'INJ', 'medical', 2, 'small', 90, { bls: 1 }),
  T('MED_SICK', 'Sick Person', 'SICK', 'medical', 3, 'small', 80, { bls: 1 }),
  T('MED_PSYCH', 'Behavioral Health Crisis', 'PSYC', 'medical', 2, 'medium', 140, { patrol: 1, bls: 1 }),
  T('MED_MCI', 'Mass Casualty Incident', 'MCI', 'medical', 1, 'major', 500, { als: 3, bls: 3, ems_command: 1, critical_care: 1, suppression: 2, fire_command: 1, patrol: 2, air_medical: 0.5 }),
  // Rescue
  T('WATER_RESCUE', 'Water Rescue', 'WATR', 'rescue', 1, 'major', 260, { marine: 1, tech_rescue: 1, coast_guard: 0.5, als: 1, sar: 0.5 }),
  T('SAR', 'Search and Rescue', 'SAR', 'rescue', 2, 'major', 360, { sar: 2, k9: 0.5, air: 1, bls: 1 }),
  T('TRENCH', 'Collapse / Trench Rescue', 'TRCH', 'rescue', 1, 'major', 380, { tech_rescue: 1, rescue: 1, suppression: 1, als: 1, fire_command: 1 }),
  T('BOAT', 'Boat in Distress', 'BOAT', 'rescue', 2, 'medium', 200, { coast_guard: 1, marine: 1 }),
  // Service
  T('ANIMAL', 'Animal Complaint', 'ANML', 'service', 4, 'small', 55, { animal: 1 }),
  T('ANIMAL_BITE', 'Animal Bite', 'BITE', 'service', 2, 'small', 80, { animal: 1, bls: 0.5 }),
  T('ANIMAL_DANGER', 'Dangerous Animal', 'DANML', 'service', 2, 'medium', 100, { animal: 1, patrol: 1 }),
  T('WATER_MAIN', 'Water Main Break', 'WMAIN', 'service', 3, 'medium', 180, { public_works: 1, traffic: 0.5, dot: 0.5 }),
  T('UTIL_OUT', 'Power Outage', 'POWR', 'service', 3, 'medium', 160, { utility: 1, traffic: 0.5 }),
  T('TREE_DOWN', 'Tree Down', 'TREE', 'service', 3, 'small', 80, { public_works: 1, utility: 0.3 }),
  T('FLOODING', 'Street Flooding', 'FLOOD', 'weather', 3, 'medium', 160, { public_works: 1, dot: 1 }),
  T('SINKHOLE', 'Sinkhole / Road Collapse', 'SINK', 'service', 2, 'medium', 200, { public_works: 1, dot: 1, traffic: 1 }),
  // Weather / disaster
  T('STORM_DAMAGE', 'Storm Damage', 'STRM', 'weather', 2, 'medium', 200, { public_works: 1, utility: 1, suppression: 0.5 }),
  T('SEVERE_WX', 'Severe Weather Emergency', 'SVRWX', 'weather', 1, 'major', 480, { em: 1, disaster: 1, suppression: 2, public_works: 1, utility: 1, patrol: 1, sar: 0.5 }),
  T('EVAC', 'Large-Scale Evacuation', 'EVAC', 'weather', 1, 'major', 520, { em: 1, patrol: 4, traffic: 2, disaster: 1, comms: 1, bls: 1 }),
  T('INFRA', 'Infrastructure Failure', 'INFR', 'weather', 1, 'major', 450, { em: 1, public_works: 2, utility: 1, dot: 1, rescue: 1, traffic: 1 }),
  T('PUBLIC_MAJOR', 'Major Public Incident', 'PUBL', 'police', 1, 'major', 420, { patrol: 5, police_command: 1, bls: 2, comms: 1, em: 0.5 }),
  // Rural White County
  T('GRAIN_BIN', 'Grain Bin Entrapment', 'GRBN', 'rescue', 1, 'major', 380, { tech_rescue: 1, rescue: 1, suppression: 2, als: 1, fire_command: 1 }),
  T('FARM_ACCIDENT', 'Farm Machinery Accident', 'FARM', 'rescue', 1, 'medium', 200, { rescue: 1, als: 1, suppression: 1, patrol: 0.5 }),
  T('BARN_FIRE', 'Barn / Outbuilding Fire', 'BARN', 'fire', 2, 'medium', 240, { suppression: 2, fire_command: 0.5, bls: 0.5 }),
  T('OIL_FIRE', 'Oil Well / Tank Battery Fire', 'OILF', 'fire', 1, 'major', 420, { suppression: 3, hazmat: 1, fire_command: 1, bls: 1, patrol: 1 }),
  T('H2S', 'H2S / Oil Field Gas Release', 'H2S', 'hazard', 1, 'medium', 260, { hazmat: 1, suppression: 1, patrol: 1, bls: 1 }),
  T('LIVESTOCK', 'Livestock on Roadway', 'LVSK', 'service', 3, 'small', 70, { patrol: 1, animal: 0.5 }),
  T('OTHER', 'Other / Unknown', 'UNK', 'service', 3, 'small', 60, { patrol: 1 }),
];

export const TYPE = Object.fromEntries(INCIDENT_TYPES.map((t) => [t.id, t]));

export const PRIORITY_LABELS = { 1: 'P1 – Emergency', 2: 'P2 – Urgent', 3: 'P3 – Routine', 4: 'P4 – Low' };
export const SEVERITY_LABELS = { small: 'Small', medium: 'Medium', major: 'Major' };

export const INCIDENT_STATUSES = ['new', 'pending', 'awaiting', 'assigned', 'active', 'under_control', 'completed', 'closed'];
export const INCIDENT_STATUS_LABELS = {
  new: 'New', pending: 'Pending', awaiting: 'Awaiting Assignment', assigned: 'Units Assigned', active: 'Active',
  under_control: 'Under Control', completed: 'Completed', closed: 'Closed',
};

export const UNIT_STATUS_LABELS = {
  available: 'Available', assigned: 'Assigned', responding: 'Responding', on_scene: 'On Scene', transporting: 'Transporting',
  busy: 'Busy', out_of_service: 'Out of Service', returning: 'Returning to Station', clearing: 'Clearing',
};
export const UNIT_STATUS_COLORS = {
  available: '#2fd08a', assigned: '#f2c94c', responding: '#ff9f43', on_scene: '#ff5a4e', transporting: '#b47cff',
  busy: '#8a94a6', out_of_service: '#5b6475', returning: '#4fc3f7', clearing: '#7fd1d9',
};

/** Simple keyword → type guesser used when the player types a nature. */
export function guessTypeFromText(text) {
  const t = (text || '').toLowerCase();
  const rules = [
    [/grain bin|grain silo|in the corn|in the beans/, 'GRAIN_BIN'], [/tractor|combine|auger|farm equipment|baler|pto/, 'FARM_ACCIDENT'], [/oil well|tank battery|pump jack|crude/, 'OIL_FIRE'], [/h2s|rotten egg.*well|sour gas/, 'H2S'], [/cows?\b|cattle|horses? (out|loose)|hogs? (out|loose)|livestock/, 'LIVESTOCK'], [/barn|machine shed|outbuilding/, 'BARN_FIRE'], [/turkey fryer|deep fryer/, 'FIRE_STR'],
    [/hostage/, 'HOSTAGE'], [/barricad/, 'BARRICADE'], [/shot|gunfire|shooting/, 'SHOTS'], [/gun|armed|weapon|knife/, 'ARMED'],
    [/bomb|explosive|suspicious package/, 'BOMB'], [/explo/, 'EXPLOSION'], [/drug lab|meth/, 'DRUG_LAB'],
    [/cardiac|not breathing|no pulse|cpr/, 'MED_ARREST'], [/chest/, 'MED_CHEST'], [/breath/, 'MED_BREATH'], [/stroke/, 'MED_STROKE'],
    [/overdose|\bod\b/, 'MED_OD'], [/seizure/, 'MED_SEIZURE'], [/diabet|sugar/, 'MED_DIABETIC'], [/allerg/, 'MED_ALLERGIC'],
    [/labor|baby|birth|pregnan/, 'MED_BIRTH'], [/fell|fall/, 'MED_FALL'], [/mass casualty|multiple patients/, 'MED_MCI'],
    [/wildfire|wildland|forest fire/, 'FIRE_WILD'], [/brush|grass fire/, 'FIRE_BRUSH'], [/car fire|vehicle fire|car on fire/, 'FIRE_VEH'],
    [/dumpster|trash fire/, 'FIRE_TRASH'], [/fire alarm/, 'FIRE_ALARM'], [/house fire|structure|building fire|apartment fire|fire/, 'FIRE_STR'],
    [/smoke/, 'SMOKE'], [/gas/, 'ODOR_GAS'], [/carbon monoxide|\bco\b/, 'CO_ALARM'], [/chemical|hazmat|spill/, 'HAZMAT'],
    [/wire|power line/, 'WIRES'], [/elevator/, 'ELEVATOR'], [/trapped|entrap|pinned/, 'MVA_ENTRAP'], [/pileup|multi.?vehicle/, 'MVA_MAJOR'],
    [/pedestrian|hit by a car/, 'PED_STRUCK'], [/hit and run/, 'HIT_RUN'], [/drunk driv|reckless|swerving/, 'DUI'],
    [/accident|crash|collision|wreck/, 'MVA_INJ'], [/disabled|broke down|flat tire|stalled/, 'DISABLED'], [/debris|obstruct|in the road/, 'OBSTRUCT'],
    [/signal|traffic light/, 'SIGNAL'], [/drown|water rescue|in the river|in the water/, 'WATER_RESCUE'], [/boat/, 'BOAT'],
    [/lost hiker|search/, 'SAR'], [/missing child|lost child/, 'MISSING_CHILD'], [/missing/, 'MISSING'], [/collapse|trench/, 'TRENCH'],
    [/domestic|husband|wife|boyfriend|girlfriend/, 'DOMESTIC'], [/robb|held up|stick ?up/, 'ROBBERY'], [/break.?in|burglar/, 'BURGLARY'],
    [/assault|fight|attack|beat/, 'ASSAULT'], [/stole|theft|stolen/, 'THEFT'], [/shoplift/, 'SHOPLIFT'], [/vandal|graffiti/, 'VANDAL'],
    [/trespass/, 'TRESPASS'], [/noise|loud|music|party/, 'NOISE'], [/park/, 'PARKING'], [/suspicious vehicle/, 'SUSP_VEH'],
    [/suspicious|prowler|lurking/, 'SUSP'], [/welfare|haven't heard|check on/, 'WELFARE'], [/drunk|intoxicated/, 'INTOX'],
    [/scam|fraud/, 'FRAUD'], [/hack|online|cyber/, 'CYBER'], [/gang/, 'GANG'], [/drug|dealing/, 'NARCOTICS'], [/bite|bit by/, 'ANIMAL_BITE'],
    [/dog|cat|animal|raccoon|deer|snake|coyote/, 'ANIMAL'], [/water main/, 'WATER_MAIN'], [/flood/, 'FLOODING'], [/tree/, 'TREE_DOWN'],
    [/power out|outage|blackout/, 'UTIL_OUT'], [/sinkhole/, 'SINKHOLE'], [/storm|tornado/, 'STORM_DAMAGE'], [/alarm/, 'ALARM_RES'],
    [/locked out|lockout/, 'LOCKOUT'], [/suicid|crisis|mental/, 'MED_PSYCH'], [/injur|hurt|bleed/, 'MED_INJURY'], [/sick|vomit|fever/, 'MED_SICK'],
    [/disturb|yelling|argument/, 'DISTURB'],
  ];
  for (const [re, id] of rules) if (re.test(t)) return id;
  return null;
}
