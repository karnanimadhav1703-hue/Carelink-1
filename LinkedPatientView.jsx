import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { familyServices } from '../lib/familyDatabase';
import { alertName, createAlertTracker, dateTime, newestAlerts, todaysLogs } from '../lib/familyView';
import { directionsUrl, locationMapUrl } from '../lib/nearby';
import { timeLabel } from '../lib/doses';

const initial = { profile: null, medicines: [], logs: [], alerts: [], ready: false, fromCache: true, alertsFromCache: true };
export default function LinkedPatientView({ link, onNewAlerts, services = familyServices }) {
  useLanguage();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const tracker = useRef(createAlertTracker());
  useEffect(() => {
    let active = true;
    tracker.current = createAlertTracker(); setData(initial); setError('');
    const stop = services.watchLinkedPatient(link.patientId, (snapshot) => {
      if (!active) return;
      setData(snapshot);
      const added = tracker.current(snapshot.alerts, snapshot.ready && !snapshot.alertsFromCache);
      if (added.length) onNewAlerts({ patientId: link.patientId, patientName: snapshot.profile?.name || link.patientName || t('Patient'), alerts: added });
    }, () => { if (active) setError('Live updates could not be read. Check your connection and access, then reload.'); });
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 30000); window.addEventListener('focus', tick);
    return () => { active = false; stop(); clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [link.patientId, link.patientName, services, onNewAlerts]);
  const name = data.profile?.name || link.patientName || t('Patient');
  if (!data.ready) return <section className="family-card"><h2>{name}</h2>{error ? <p role="alert" className="error-message">{t(error)}</p> : <p role="status">{t("Loading the live care view…")}</p>}</section>;
  if (!data.profile) return <section className="family-card"><h2>{name}</h2><p role="alert">{t("This patient profile is unavailable.")}</p></section>;
  const logs = todaysLogs(data.logs, now);
  const alerts = newestAlerts(data.alerts);
  const taken = logs.filter((log) => log.status === 'taken').length;
  const missed = logs.filter((log) => log.status === 'missed').length;
  const nearby = data.profile.nearby || null;
  const hospital = nearby?.nearestHospital;
  return <section className="patient-live-view" aria-label={t('Live care for {name}', { name })}>
    <div className="family-heading"><h2>{t('{name}’s care', { name })}</h2><span className="sync-badge">{error ? t("Updates interrupted") : data.fromCache ? t("Cached data · reconnecting") : t("Connected to Firestore")}</span></div>
    {error && <p role="alert" className="error-message">{t(error)}</p>}
    <p className="family-note">{t("Updates arrive while this dashboard is open. The patient’s app must stay open to detect missed doses. No recent alert does not mean the patient is okay.")}</p>
    <div className="dose-counts"><div><strong>{taken}</strong><span>{t("Taken today")}</span></div><div><strong>{missed}</strong><span>{t("Missed today")}</span></div></div>
    <div className="family-card"><h3>{t("Today’s dose history")}</h3><p>{t("Dates and times use this viewer’s timezone: ")}{Intl.DateTimeFormat().resolvedOptions().timeZone}{t(". Only saved logs are counted; an unlogged dose is not assumed missed.")}</p>
      {!logs.length ? <p>{t("No dose logs for today yet.")}</p> : <ul className="dose-history">{logs.map((log) => <li key={log.id}>
        <div><strong>{log.medicineName || data.medicines.find((medicine) => medicine.id === log.medicineId)?.name || t("Medicine")}</strong><span>{timeLabel(log.scheduledTime)}{log.demo && t(" · Demo")}</span></div>
        <span className={`dose-status ${log.status}`}>{log.status === 'taken' ? (log.wasMissed ? t("Taken late") : t("Taken")) : t("Missed")}</span>
      </li>)}</ul>}
    </div>
    <div className="family-card"><h3>{t("Current medicines")}</h3>{!data.medicines.length ? <p>{t("No medicines saved.")}</p> : <ul className="connection-list">{data.medicines.map((medicine) => <li key={medicine.id}><strong>{medicine.name}</strong><span>{medicine.dose} · {medicine.times.join(' · ')}</span></li>)}</ul>}<p className="family-note">{t("Schedule times were entered on the patient’s device. CareLink does not recommend medicines or doses.")}</p></div>
    <div className="family-card"><h3>{t("Nearest listed hospital")}</h3>
      {!nearby ? <p>{t("No location lookup has been shared yet. The patient can use Help Near Me.")}</p> : <>
        <p>{t("Last lookup: ")}{dateTime(nearby.updatedAt)}{t(". This is a saved location, not continuous tracking.")}</p>
        {hospital ? <><h4>{hospital.name}</h4><p>{hospital.distanceKm.toFixed(2)}{t(" km from the captured location · straight-line estimate.")}</p><a className="secondary-button directions-link" href={directionsUrl(hospital)} target="_blank" rel="noopener noreferrer">{t("Hospital directions ↗")}</a></> : <p>{nearby.hospitalStatus === 'empty' ? t("No hospitals were returned within 5 km.") : t("Nearest hospital unavailable for this lookup.")}</p>}
        {locationMapUrl(nearby.location) ? <p><a className="back-link" href={locationMapUrl(nearby.location)} target="_blank" rel="noopener noreferrer">{t("View patient’s saved location ↗")}</a></p> : <p>{t("GPS unavailable")}{nearby.locationStatus === 'denied' ? t(" — location permission was denied") : ''}.</p>}
      </>}
      <p className="family-note">{t("Listings do not confirm emergency services or availability.")}</p>
    </div>
    <section className="family-card" id={`alerts-${link.patientId}`} aria-label={t('Latest alerts for {name}', { name })}><h3>{t("Latest alerts")}</h3><p>{t("Showing the latest 20 saved alerts. Historical alerts remain visible after a late Taken confirmation.")}</p>
      {!alerts.length ? <p>{t("No alerts saved yet.")}</p> : <ol className="family-alert-list">{alerts.slice(0, 20).map((alert) => <li className={`family-alert alert-${alert.type}`} key={alert.id}>
        <h4>{alertName(alert)}{alert.demo && t(" · Demo reminder")}</h4><p>{dateTime(alert.createdAt)}</p>
        {alert.type === 'fall' && <p>{t("Manual simulation; no real fall was detected.")}</p>}
        {alert.type === 'missedDose' && <p>{t("Scheduled dose: ")}{dateTime(alert.scheduledTime)}.{data.logs.find((log) => log.id === alert.doseLogId)?.status === 'taken' && t(" This dose was later logged as taken.")}</p>}
        {locationMapUrl(alert.location) ? <p><a className="secondary-button directions-link" href={locationMapUrl(alert.location)} target="_blank" rel="noopener noreferrer" aria-label={t('View location for {alert} at {time}, opens Google Maps', { alert: alertName(alert), time: dateTime(alert.createdAt) })}>{t("View alert location ↗")}</a></p> : <p>{alert.type === 'missedDose' ? t("Location is not collected for medicine reminders.") : t(alert.locationStatus === 'denied' ? 'GPS unavailable — permission denied.' : 'GPS unavailable.')}</p>}
        {alert.nearestHospital && <p>{t("Nearest listed: ")}<a href={directionsUrl(alert.nearestHospital)} target="_blank" rel="noopener noreferrer">{alert.nearestHospital.name} ↗</a></p>}
        <details><summary>{t("Medicines at alert time (")}{alert.medicines?.length || 0})</summary>{alert.medicines?.length ? <ul>{alert.medicines.map((medicine, index) => <li key={medicine.medicineId || index}>{medicine.name} · {medicine.dose} · {medicine.times.join(' · ')}</li>)}</ul> : <p>{t("No medicines were included.")}</p>}</details>
      </li>)}</ol>}
    </section>
  </section>;
}
