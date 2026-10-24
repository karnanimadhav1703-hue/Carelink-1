export function authMessage(error) {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect. Please try again.',
    'auth/user-not-found': 'The email or password is incorrect. Please try again.',
    'auth/wrong-password': 'The email or password is incorrect. Please try again.',
    'auth/email-already-in-use': 'This email already has an account. Choose Sign in.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/password-does-not-meet-requirements': 'Your password does not meet this Firebase project’s password policy.',
    'auth/network-request-failed': 'We could not connect. Check your internet connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little before trying again.',
    'auth/operation-not-allowed': 'Enable Email/Password sign-in in the Firebase console.',
    'auth/configuration-not-found': 'Firebase Authentication is not set up for this project. Open Firebase Console → Build → Authentication → Get started, then enable Email/Password sign-in.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key is invalid. Copy apiKey from Firebase Project settings into VITE_FIREBASE_API_KEY in .env.local, then restart Vite.',
    'auth/app-not-authorized': 'This app is not authorized to use Firebase Authentication. Check the web app configuration and API key restrictions in the Firebase project.',
    'auth/unauthorized-domain': 'Add this website’s domain to Firebase Authentication’s authorized domains.',
    'auth/invalid-api-key': 'Check the Firebase web app configuration in .env.local.',
    'auth/user-disabled': 'This account is disabled. Contact the project owner.',
    'permission-denied': 'Your profile could not be accessed. Check the Firestore rules and their expiry date.',
    'unavailable': 'The database is unavailable. Check your connection and try again.',
  };
  if (messages[error?.code]) return messages[error.code];
  // Only show a short SDK code, never a raw error containing request details.
  const code = typeof error?.code === 'string' && /^[a-z][a-z0-9/.-]{0,100}$/.test(error.code)
    ? { key: ' Error code: {code}.', values: { code: error.code } } : '';
  return { key: 'Something went wrong. Please try again. If it continues, check the Firebase setup.{code}', values: { code } };
}
