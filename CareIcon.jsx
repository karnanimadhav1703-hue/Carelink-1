export default function CareIcon({ name }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'medicine' && <><path d="M10 6a7 7 0 0 1 10 10l-4 4A7 7 0 0 1 6 10z" transform="translate(3 3)" /><path d="m11 11 10 10" /></>}
    {name === 'location' && <><path d="M26 13c0 8-10 15-10 15S6 21 6 13a10 10 0 1 1 20 0Z" /><circle cx="16" cy="13" r="3" /></>}
    {name === 'sos' && <><path d="M16 4 30 27H2L16 4Z" /><path d="M16 12v7m0 4v.2" /></>}
    {name === 'calendar' && <><rect x="5" y="7" width="22" height="21" rx="3" /><path d="M10 4v6m12-6v6M5 14h22m-16 6h3m4 0h3" /></>}
  </svg>;
}
