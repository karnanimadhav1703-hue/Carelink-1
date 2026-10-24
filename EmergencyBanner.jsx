import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useEffect, useRef } from 'react';
import { useEmergency } from '../context/EmergencyContext';

export default function EmergencyBanner() {
  useLanguage();
  const emergency = useEmergency();
  const cancelButton = useRef(null);
  const phase = emergency?.state.phase;
  useEffect(() => {
    if (phase === 'countdown') {
      cancelButton.current?.focus();
      cancelButton.current?.scrollIntoView?.({ block: 'center' });
    }
  }, [phase]);
  if (!emergency || phase === 'idle') return null;
  const { state, cancel, retry, dismiss } = emergency;
  return <section className="emergency-banner" aria-label={t("Emergency alert status")}>
    {phase === 'countdown' && <>
      <h2 role="alert">{t("Are you okay?")}</h2>
      <p>{state.type === 'fall' ? t("Simulated fall") : t("SOS")}{t(" alert will be saved when the countdown ends.")}</p>
      <p className="countdown-number" aria-hidden="true">{state.remaining}<span>{t("seconds to cancel")}</span></p>
      <p className="sr-only">{t("A ten-second countdown has started. Select Cancel if you are okay.")}</p>
      <button ref={cancelButton} className="button" onClick={cancel}>{t("Cancel — I’m okay")}</button>
    </>}
    {phase === 'sending' && <><h2 role="status">{t("Saving your alert…")}</h2><p>{t("Finishing location lookup if needed, then saving your medicine list. Keep this page open.")}</p></>}
    {phase === 'saved' && <><h2 role="status">{t("Alert saved")}</h2><p>{state.type === 'fall' ? t("Your simulated-fall alert") : t("Your SOS alert")}{t(" is saved in CareLink with your medicine list.")}</p>
      <p>{state.result.location ? t("GPS location included.") : t("GPS was unavailable; the alert says so.")} {state.result.hospitals.length ? t("Nearest listed hospital included.") : t("No hospital could be included.")}</p>
      <p>{t("Linked family can see this in their live dashboard. Saving an alert does not confirm that anyone has seen it.")}</p></>}
    {phase === 'error' && <><h2 role="alert">{t("Alert not confirmed")}</h2><p>{t("We could not confirm the save. Check your internet connection and retry. A retry will not create a duplicate alert.")}</p><button className="button" onClick={retry}>{t("Retry saving alert")}</button></>}
    {phase === 'cancelled' && <><h2 role="status">{t("Cancelled")}</h2><p>{t("No emergency alert was created.")}</p></>}
    <p>{t("CareLink does not call emergency services.")}</p>
    <a className="emergency-button" href="tel:112">{t("Call 112 ")}<span>{t("Emergency assistance")}</span></a>
    {!['countdown', 'sending'].includes(phase) && <button className="secondary-button" onClick={dismiss}>{t("Dismiss status")}</button>}
  </section>;
}
