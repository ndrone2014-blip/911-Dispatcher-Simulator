// Department, unit-type and radio-channel database.
// To add a department or unit type in a future update, add an entry here – every
// other system (CAD, map, radio, recommendations, settings) reads from these tables.

export const CHANNELS = [
  { id: 'police', name: 'Police Dispatch', short: 'PD-1', color: '#4f8cff' },
  { id: 'sheriff', name: 'Sheriff Dispatch', short: 'SO-1', color: '#d9a441' },
  { id: 'specops', name: 'Special Operations', short: 'SPEC', color: '#8b9bb4' },
  { id: 'investigations', name: 'Investigations', short: 'INV', color: '#6fa8dc' },
  { id: 'federal', name: 'Federal Communications', short: 'FED', color: '#9aa5b1' },
  { id: 'fire', name: 'Fire Dispatch', short: 'FD-1', color: '#ff5a4e' },
  { id: 'ems', name: 'EMS Dispatch', short: 'EMS-1', color: '#2fd08a' },
  { id: 'em', name: 'Emergency Management', short: 'EOC', color: '#b47cff' },
  { id: 'services', name: 'Public Services', short: 'SVC', color: '#f2c94c' },
];

export const DEPARTMENTS = [
  { id: 'police', name: 'Police Department', short: 'PD', color: '#4f8cff', channel: 'police', group: 'Police' },
  { id: 'sheriff', name: "Sheriff's Office", short: 'SO', color: '#d9a441', channel: 'sheriff', group: 'Police' },
  { id: 'federal', name: 'Federal Agencies', short: 'FED', color: '#9aa5b1', channel: 'federal', group: 'Federal' },
  { id: 'fire', name: 'Fire Department', short: 'FD', color: '#ff5a4e', channel: 'fire', group: 'Fire' },
  { id: 'ems', name: 'EMS Department', short: 'EMS', color: '#2fd08a', channel: 'ems', group: 'EMS' },
  { id: 'em', name: 'Emergency Management', short: 'EM', color: '#b47cff', channel: 'em', group: 'Services' },
  { id: 'sar', name: 'Search and Rescue', short: 'SAR', color: '#ff9f43', channel: 'em', group: 'Services' },
  { id: 'publicworks', name: 'Public Works', short: 'PW', color: '#f2c94c', channel: 'services', group: 'Services' },
  { id: 'animal', name: 'Animal Control', short: 'AC', color: '#a3d977', channel: 'services', group: 'Services' },
  { id: 'dot', name: 'Department of Transportation', short: 'DOT', color: '#ffb84d', channel: 'services', group: 'Services' },
  { id: 'utility', name: 'Utility Response', short: 'UTL', color: '#7fd1d9', channel: 'services', group: 'Services' },
  { id: 'coastguard', name: 'Coast Guard', short: 'USCG', color: '#ff7a59', channel: 'em', group: 'Federal' },
  { id: 'disaster', name: 'Disaster Response', short: 'DRT', color: '#e879f9', channel: 'em', group: 'Services' },
  { id: 'comms', name: 'Emergency Communications', short: 'ECOM', color: '#94e2ff', channel: 'em', group: 'Services' },
];

// Capability tags describe what a unit is good at. Incidents list the capabilities
// they need; ANY unit can still be assigned to ANY incident (player freedom).
export const CAPABILITY_LABELS = {
  patrol: 'Patrol / scene security', traffic: 'Traffic control', police_command: 'Police supervision',
  investigation: 'Investigation', k9: 'K-9 search', tactical: 'Tactical (SWAT)', gang: 'Gang intelligence',
  cyber: 'Cybercrime', forensics: 'Crime scene forensics', bomb: 'Explosives disposal', air: 'Air support',
  marine: 'Marine operations', federal: 'Federal jurisdiction', narcotics: 'Narcotics',
  suppression: 'Fire suppression', ladder: 'Aerial / ventilation', rescue: 'Rescue / extrication',
  fire_investigation: 'Fire investigation', hazmat: 'Hazardous materials', tech_rescue: 'Technical rescue',
  wildland: 'Wildland firefighting', fire_command: 'Fire command', bls: 'Basic life support',
  als: 'Advanced life support', transport: 'Patient transport', ems_command: 'EMS supervision',
  critical_care: 'Critical care', air_medical: 'Air medical', em: 'Emergency management', sar: 'Search & rescue',
  public_works: 'Public works', animal: 'Animal handling', dot: 'Road management', utility: 'Utilities',
  coast_guard: 'Coast Guard', disaster: 'Disaster logistics', comms: 'Mobile communications',
};

// station: facility kind units are housed at. numbers: callsign numbers (also unit count).
export const UNIT_TYPES = [
  // ---- Police ----
  { id: 'patrol', dept: 'police', name: 'Police Patrol', prefix: 'Police', glyph: 'P', station: ['police_hq', 'precinct'], channel: 'police',
    numbers: [201, 204, 207, 211, 214, 218, 222, 226, 301, 306, 309, 312, 315, 319, 402, 408], speed: 1.05, caps: { patrol: 1, traffic: 0.5, investigation: 0.15 } },
  { id: 'traffic', dept: 'police', name: 'Traffic Enforcement', prefix: 'Traffic', glyph: 'T', station: ['police_hq', 'precinct'], channel: 'police',
    numbers: [51, 52, 53, 54], speed: 1.1, caps: { traffic: 1, patrol: 0.6 } },
  { id: 'police_sup', dept: 'police', name: 'Police Supervisor', prefix: 'Sergeant', glyph: 'SG', station: ['police_hq', 'precinct'], channel: 'police',
    numbers: [11, 12, 13], speed: 1.05, caps: { police_command: 1, patrol: 0.6 } },
  { id: 'detective', dept: 'police', name: 'Detectives', prefix: 'Detective', glyph: 'D', station: ['police_hq'], channel: 'investigations',
    numbers: [14, 18, 22, 27], speed: 0.95, caps: { investigation: 1, patrol: 0.2 } },
  { id: 'cid', dept: 'police', name: 'Criminal Investigations', prefix: 'CID', glyph: 'CI', station: ['police_hq'], channel: 'investigations',
    numbers: [4, 6], speed: 0.95, caps: { investigation: 1, forensics: 0.2 } },
  { id: 'k9', dept: 'police', name: 'K-9 Unit', prefix: 'K9', glyph: 'K9', station: ['precinct'], channel: 'specops',
    numbers: [3, 7, 9], speed: 1.05, caps: { k9: 1, patrol: 0.7 } },
  { id: 'swat', dept: 'police', name: 'SWAT', prefix: 'SWAT', glyph: 'SW', station: ['police_hq'], channel: 'specops',
    numbers: [1, 2, 3], speed: 1.0, caps: { tactical: 1, patrol: 0.5 } },
  { id: 'gang', dept: 'police', name: 'Gang Investigation', prefix: 'Gang', glyph: 'G', station: ['police_hq'], channel: 'investigations',
    numbers: [3, 5], speed: 1.0, caps: { gang: 1, investigation: 0.5, patrol: 0.3 } },
  { id: 'cyber', dept: 'police', name: 'Cybercrime Investigation', prefix: 'Cyber', glyph: 'CY', station: ['police_hq'], channel: 'investigations',
    numbers: [2, 8], speed: 0.9, caps: { cyber: 1, investigation: 0.5 } },
  { id: 'csi', dept: 'police', name: 'Crime Scene Investigation', prefix: 'CSI', glyph: 'CS', station: ['police_hq'], channel: 'investigations',
    numbers: [5, 9], speed: 0.9, caps: { forensics: 1, investigation: 0.3 } },
  { id: 'bomb', dept: 'police', name: 'Bomb Squad', prefix: 'Bomb', glyph: 'BS', station: ['police_hq'], channel: 'specops',
    numbers: [1], speed: 0.95, caps: { bomb: 1, hazmat: 0.2 } },
  { id: 'aviation', dept: 'police', name: 'Aviation Unit', prefix: 'Air', glyph: 'AIR', station: ['airport'], channel: 'specops',
    numbers: [1], speed: 2.4, air: true, caps: { air: 1, sar: 0.4, k9: 0.2 } },
  { id: 'marine', dept: 'police', name: 'Marine Patrol', prefix: 'Marine', glyph: 'M', station: ['marina'], channel: 'specops',
    numbers: [2, 4], speed: 1.0, caps: { marine: 1, sar: 0.4 } },
  { id: 'siu', dept: 'police', name: 'Special Investigations', prefix: 'SIU', glyph: 'SI', station: ['police_hq'], channel: 'investigations',
    numbers: [6, 7], speed: 1.0, caps: { investigation: 0.8, narcotics: 0.6 } },
  // ---- Sheriff ----
  { id: 'deputy', dept: 'sheriff', name: 'Sheriff Deputies', prefix: 'Sheriff', glyph: 'S', station: ['sheriff'], channel: 'sheriff',
    numbers: [41, 43, 45, 47, 52, 58], speed: 1.05, caps: { patrol: 1, traffic: 0.5, sar: 0.2 } },
  // ---- Federal ----
  { id: 'fbi', dept: 'federal', name: 'FBI', prefix: 'FBI', glyph: 'FBI', station: ['federal'], channel: 'federal',
    numbers: [1, 2, 3], speed: 1.0, caps: { federal: 1, investigation: 0.8, tactical: 0.3, cyber: 0.4 } },
  { id: 'dea', dept: 'federal', name: 'DEA', prefix: 'DEA', glyph: 'DEA', station: ['federal'], channel: 'federal',
    numbers: [1, 3, 5], speed: 1.0, caps: { federal: 0.8, narcotics: 1, investigation: 0.4 } },
  { id: 'fed_inv', dept: 'federal', name: 'Federal Investigators', prefix: 'Federal', glyph: 'FI', station: ['federal'], channel: 'federal',
    numbers: [2, 4], speed: 0.95, caps: { federal: 1, investigation: 0.7, forensics: 0.3 } },
  { id: 'task_force', dept: 'federal', name: 'Federal Task Force', prefix: 'Task Force', glyph: 'TF', station: ['federal'], channel: 'federal',
    numbers: [1], speed: 1.0, caps: { federal: 1, tactical: 0.7, narcotics: 0.5, gang: 0.5 } },
  // ---- Fire ----
  { id: 'engine', dept: 'fire', name: 'Fire Engine', prefix: 'Engine', glyph: 'E', station: ['fire'], channel: 'fire',
    numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], perStation: true, speed: 0.95, caps: { suppression: 1, bls: 0.3, rescue: 0.3, hazmat: 0.15 } },
  { id: 'ladder', dept: 'fire', name: 'Ladder Truck', prefix: 'Ladder', glyph: 'L', station: ['fire'], channel: 'fire',
    numbers: [1, 2, 6], stationNumbers: true, speed: 0.85, caps: { ladder: 1, rescue: 0.5, suppression: 0.4 } },
  { id: 'heavy_rescue', dept: 'fire', name: 'Heavy Rescue', prefix: 'Rescue', glyph: 'R', station: ['fire'], channel: 'fire',
    numbers: [1, 3], stationNumbers: true, speed: 0.9, caps: { rescue: 1, tech_rescue: 0.5, bls: 0.4 } },
  { id: 'fire_inv', dept: 'fire', name: 'Fire Investigation', prefix: 'Investigator', glyph: 'FI', station: ['fire_hq'], channel: 'fire',
    numbers: [2, 3], speed: 1.0, caps: { fire_investigation: 1, investigation: 0.3 } },
  { id: 'hazmat', dept: 'fire', name: 'HazMat', prefix: 'HazMat', glyph: 'HM', station: ['fire'], channel: 'fire',
    numbers: [1], stationNumbers: true, speed: 0.85, caps: { hazmat: 1, suppression: 0.2 } },
  { id: 'tech_rescue', dept: 'fire', name: 'Technical Rescue', prefix: 'Tech Rescue', glyph: 'TR', station: ['fire'], channel: 'fire',
    numbers: [6], stationNumbers: true, speed: 0.85, caps: { tech_rescue: 1, rescue: 0.7, sar: 0.3 } },
  { id: 'wildland', dept: 'fire', name: 'Wildland Fire Unit', prefix: 'Brush', glyph: 'BR', station: ['fire'], channel: 'fire',
    numbers: [3, 9], stationNumbers: true, speed: 1.0, caps: { wildland: 1, suppression: 0.5 } },
  { id: 'fire_marshal', dept: 'fire', name: 'Fire Marshal', prefix: 'Marshal', glyph: 'FM', station: ['fire_hq'], channel: 'fire',
    numbers: [1], speed: 1.0, caps: { fire_investigation: 0.8, fire_command: 0.4 } },
  { id: 'battalion', dept: 'fire', name: 'Battalion Chief', prefix: 'Battalion', glyph: 'BC', station: ['fire'], channel: 'fire',
    numbers: [1, 2], speed: 1.1, caps: { fire_command: 1 } },
  { id: 'fire_sup', dept: 'fire', name: 'Fire Supervisor', prefix: 'Safety', glyph: 'SO', station: ['fire_hq'], channel: 'fire',
    numbers: [1, 2], speed: 1.1, caps: { fire_command: 0.7, hazmat: 0.1 } },
  // ---- EMS ----
  { id: 'bls', dept: 'ems', name: 'Basic Life Support', prefix: 'BLS', glyph: 'B', station: ['ems', 'fire'], channel: 'ems',
    numbers: [21, 22, 23, 24], speed: 1.0, caps: { bls: 1, transport: 1 } },
  { id: 'als', dept: 'ems', name: 'Advanced Life Support', prefix: 'ALS', glyph: 'A', station: ['ems'], channel: 'ems',
    numbers: [31, 32, 33, 34], speed: 1.0, caps: { als: 1, bls: 1, transport: 1 } },
  { id: 'medic', dept: 'ems', name: 'Paramedics', prefix: 'Medic', glyph: 'MD', station: ['ems', 'fire'], channel: 'ems',
    numbers: [7, 9, 12, 15], speed: 1.1, caps: { als: 1, bls: 0.8 } },
  { id: 'ambulance', dept: 'ems', name: 'Ambulance', prefix: 'Ambulance', glyph: 'AM', station: ['ems', 'hospital'], channel: 'ems',
    numbers: [3, 5, 8, 11], speed: 1.0, caps: { bls: 1, transport: 1 } },
  { id: 'ems_sup', dept: 'ems', name: 'EMS Supervisor', prefix: 'EMS', glyph: 'ES', station: ['ems'], channel: 'ems',
    numbers: [1], speed: 1.1, caps: { ems_command: 1, als: 0.5 } },
  { id: 'cct', dept: 'ems', name: 'Critical Care Transport', prefix: 'CCT', glyph: 'CC', station: ['hospital'], channel: 'ems',
    numbers: [2], speed: 1.0, caps: { critical_care: 1, als: 1, transport: 1 } },
  { id: 'air_medical', dept: 'ems', name: 'Air Medical', prefix: 'LifeFlight', glyph: 'LF', station: ['hospital_helipad'], channel: 'ems',
    numbers: [1], speed: 2.6, air: true, caps: { air_medical: 1, critical_care: 1, transport: 1, als: 1 } },
  // ---- Additional services ----
  { id: 'em', dept: 'em', name: 'Emergency Management', prefix: 'EM', glyph: 'EM', station: ['eoc'], channel: 'em',
    numbers: [1, 2], speed: 1.0, caps: { em: 1, disaster: 0.4 } },
  { id: 'sar', dept: 'sar', name: 'Search and Rescue', prefix: 'SAR', glyph: 'SR', station: ['sar'], channel: 'em',
    numbers: [2, 5], speed: 0.95, caps: { sar: 1, tech_rescue: 0.3, bls: 0.3 } },
  { id: 'public_works', dept: 'publicworks', name: 'Public Works', prefix: 'PW', glyph: 'PW', station: ['public_works'], channel: 'services',
    numbers: [11, 14, 17], speed: 0.85, caps: { public_works: 1, dot: 0.4 } },
  { id: 'animal', dept: 'animal', name: 'Animal Control', prefix: 'Animal', glyph: 'AC', station: ['animal_control'], channel: 'services',
    numbers: [3, 6], speed: 0.9, caps: { animal: 1 } },
  { id: 'dot', dept: 'dot', name: 'Transportation', prefix: 'DOT', glyph: 'DT', station: ['dot'], channel: 'services',
    numbers: [8, 12], speed: 0.95, caps: { dot: 1, traffic: 0.5 } },
  { id: 'utility', dept: 'utility', name: 'Utility Response', prefix: 'Utility', glyph: 'UT', station: ['utility'], channel: 'services',
    numbers: [6, 9], speed: 0.9, caps: { utility: 1 } },
  { id: 'coastguard', dept: 'coastguard', name: 'Coast Guard', prefix: 'Coast Guard', glyph: 'CG', station: ['coastguard'], channel: 'em',
    numbers: [45, 47], speed: 1.1, caps: { coast_guard: 1, marine: 1, sar: 0.6 } },
  { id: 'disaster', dept: 'disaster', name: 'Disaster Response', prefix: 'DRT', glyph: 'DR', station: ['eoc'], channel: 'em',
    numbers: [1], speed: 0.85, caps: { disaster: 1, em: 0.4, sar: 0.3 } },
  { id: 'comms', dept: 'comms', name: 'Mobile Command', prefix: 'Comms', glyph: 'MC', station: ['eoc'], channel: 'em',
    numbers: [1], speed: 0.8, caps: { comms: 1, em: 0.3, police_command: 0.2, fire_command: 0.2 } },
];

export const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]));
export const TYPE_BY_ID = Object.fromEntries(UNIT_TYPES.map((t) => [t.id, t]));
export const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

// Which department to talk about when an incident needs a capability nobody on scene has.
export const CAPABILITY_PROVIDER = {
  patrol: 'patrol', traffic: 'traffic', police_command: 'police_sup', investigation: 'detective', k9: 'k9', tactical: 'swat',
  gang: 'gang', cyber: 'cyber', forensics: 'csi', bomb: 'bomb', air: 'aviation', marine: 'marine', federal: 'fbi', narcotics: 'dea',
  suppression: 'engine', ladder: 'ladder', rescue: 'heavy_rescue', fire_investigation: 'fire_inv', hazmat: 'hazmat',
  tech_rescue: 'tech_rescue', wildland: 'wildland', fire_command: 'battalion', bls: 'ambulance', als: 'medic', transport: 'ambulance',
  ems_command: 'ems_sup', critical_care: 'cct', air_medical: 'air_medical', em: 'em', sar: 'sar', public_works: 'public_works',
  animal: 'animal', dot: 'dot', utility: 'utility', coast_guard: 'coastguard', disaster: 'disaster', comms: 'comms',
};

// Plain-language "what to ask for" phrase used in radio requests.
export const CAPABILITY_REQUEST_PHRASE = {
  patrol: 'a couple of patrol units', traffic: 'traffic control', police_command: 'a supervisor', investigation: 'a detective',
  k9: 'a K-9 unit', tactical: 'SWAT', gang: 'the gang unit', cyber: 'cybercrime', forensics: 'CSI', bomb: 'the bomb squad',
  air: 'air support', marine: 'a marine unit', federal: 'federal partners', narcotics: 'DEA or narcotics', suppression: 'more engines',
  ladder: 'a ladder truck', rescue: 'heavy rescue', fire_investigation: 'a fire investigator', hazmat: 'HazMat',
  tech_rescue: 'technical rescue', wildland: 'brush units', fire_command: 'a battalion chief', bls: 'an ambulance',
  als: 'ALS / a medic unit', transport: 'a transport unit', ems_command: 'an EMS supervisor', critical_care: 'critical care transport',
  air_medical: 'LifeFlight', em: 'emergency management', sar: 'search and rescue', public_works: 'public works', animal: 'animal control',
  dot: 'DOT', utility: 'the utility company', coast_guard: 'the Coast Guard', disaster: 'disaster response', comms: 'mobile command',
};
