import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js';

/**
 * Fetch a single document from Firestore.
 * @param {Firestore} db 
 * @param {string} coll 
 * @param {string} id 
 */
export const fetchDbDoc = async (db, coll, id) => {
    const snap = await getDoc(doc(db, coll, id));
    return snap.exists() ? { id: snap.id, ...snap.data(), _docRef: snap.ref } : null;
};

/**
 * Fetch documents matching a simple field/op/value query.
 * @param {Firestore} db
 * @param {string} coll
 * @param {string} field
 * @param {string} op
 * @param {*} value
 */
export const fetchDbDocsByQuery = async (db, coll, field, op, value) => {
    const q = query(collection(db, coll), where(field, op, value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), _docRef: d.ref }));
};

/**
 * Update a Firestore document.
 */
export const updateDbDoc = async (db, coll, id, data) => updateDoc(doc(db, coll, id), data);

/**
 * Set (create or merge) a Firestore document.
 */
export const setDbDoc = async (db, coll, id, data) => setDoc(doc(db, coll, id), data, { merge: true });

/**
 * Delete a Firestore document.
 */
export const deleteDbDoc = async (db, coll, id) => deleteDoc(doc(db, coll, id));

/**
 * Add a new document to a collection with a server timestamp.
 */
export const addDbDocWithTimestamp = async (db, coll, data) => {
    return addDoc(collection(db, coll), {
        ...data,
        timestamp: serverTimestamp(),
    });
};
