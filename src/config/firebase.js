import admin from 'firebase-admin';
import env from './env.js';
import logger from './logger.js';

let firebaseAdmin;

try {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    // Handle escaped newlines from environment variables
    const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    logger.info('Firebase Admin initialized successfully using env credentials.');
  } else {
    // Fallback to application default credentials if available
    firebaseAdmin = admin.initializeApp();
    logger.info('Firebase Admin initialized using default application credentials.');
  }
} catch (error) {
  logger.error({ err: error }, 'Failed to initialize Firebase Admin');
}

export default firebaseAdmin;
