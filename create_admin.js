import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function createAdmin() {
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'admin@incomezone.com', 'Admin123!');
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: 'System Admin',
      email: 'admin@incomezone.com',
      isAdmin: true,
      balance: 0,
      createdAt: new Date()
    });
    console.log('Admin user created successfully');
    process.exit(0);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists.');
      process.exit(0);
    }
    console.error(e);
    process.exit(1);
  }
}
createAdmin();
