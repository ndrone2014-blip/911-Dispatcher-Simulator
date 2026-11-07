// Shared builders for scenario templates.
import { personDesc, vehicleDesc, DIRECTIONS } from '../../ai/dialogue.js';

export const S = (def) => ({ weight: 1, severity: 'small', zones: ['residential'], ...def });

export function pron(sex) {
  return sex === 'f' ? { he: 'she', him: 'her', his: 'her', He: 'She', His: 'Her', man: 'woman', guy: 'woman' } : { he: 'he', him: 'him', his: 'his', He: 'He', His: 'His', man: 'man', guy: 'guy' };
}

/** Patient vars: sex, age, pronouns, relation to caller. */
export function patientVars(r, { minAge = 18, maxAge = 90, relations } = {}) {
  const sex = r.pick(['m', 'f']);
  const age = r.int(minAge, maxAge);
  const rel = r.pick(relations || (sex === 'm' ? ['my husband', 'my dad', 'my neighbor', 'my brother', 'my coworker', 'this man', 'my son', 'my grandpa'] : ['my wife', 'my mom', 'my neighbor', 'my sister', 'my coworker', 'this woman', 'my daughter', 'my grandma']));
  return { psex: sex, page: age, rel, ...pron(sex) };
}

export function suspectVars(r, sex) {
  const d = personDesc(r, sex || (r.chance(0.8) ? 'm' : 'f'));
  return { sus: d.say, susNote: d.note, ...Object.fromEntries(Object.entries(pron(d.sex)).map(([k, v]) => [`s_${k}`, v])) };
}

export function vehicleVars(r) {
  const v = vehicleDesc(r);
  return { veh: v.say, vehNote: v.note, vehShort: `${v.color} ${v.make}` };
}

export function direction(r) { return r.pick(DIRECTIONS); }

export const AGE_WORDS = (age) => (age < 2 ? 'a baby' : age < 13 ? `${age} years old` : `${age}`);
