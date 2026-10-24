// Read-only Firebase Auth configuration check. Never prints API keys or tokens.
const key = process.env.VITE_FIREBASE_API_KEY;
if (!key) {
  console.error('Missing VITE_FIREBASE_API_KEY. Run with --env-file=.env.local.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const result = await response.json();
    if (response.ok) {
      console.log('Firebase Authentication project configuration is accessible.');
      console.log('This does not verify Email/Password enablement or Firestore access.');
    } else {
      const knownErrors = ['CONFIGURATION_NOT_FOUND', 'API_KEY_INVALID', 'PROJECT_NOT_FOUND', 'PERMISSION_DENIED'];
      const description = JSON.stringify(result.error || {});
      const code = knownErrors.find((value) => description.includes(value)) || 'OTHER_CONFIGURATION_ERROR';
      console.error(`Firebase setup check: HTTP ${response.status}, ${code}`);
      process.exitCode = 1;
    }
  } catch {
    console.error('Firebase setup check could not reach the service (network failure or timeout).');
    process.exitCode = 1;
  }
}
