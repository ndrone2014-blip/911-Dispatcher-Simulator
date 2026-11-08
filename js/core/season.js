// Seasonal decorations. 'auto' turns Thanksgiving decor on for the whole month of November.
export function isThanksgivingSeason(date = new Date()) { return date.getMonth() === 10; }

export function thanksgivingOn(settings, date = new Date()) {
  const mode = settings?.get ? settings.get('ui.seasonal') : settings?.ui?.seasonal;
  if (mode === 'on' || mode === 'thanksgiving') return true;
  if (mode === 'off') return false;
  return isThanksgivingSeason(date);
}
