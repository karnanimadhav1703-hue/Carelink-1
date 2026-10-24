export const MODES = [
  { id: 'standard', name: 'Standard', symbol: '01', description: 'Familiar cards and comfortable everyday text.' },
  { id: 'elderly', name: 'Elderly', symbol: '02', description: 'Very large text, high contrast, and big home buttons.' },
  { id: 'vision-assist', name: 'Vision-assist', symbol: '03', description: 'Spoken screen summaries, high contrast, and strong keyboard focus.' },
];
export const isMode = (value) => MODES.some((mode) => mode.id === value);
export const modeName = (value) => MODES.find((mode) => mode.id === value)?.name || 'Standard';
// Stage 1 profiles have a default mode but have never explicitly chosen one.
export const needsModeSelection = (profile) => profile?.role === 'patient'
  && (profile.modeSelected !== true || !isMode(profile.mode));
