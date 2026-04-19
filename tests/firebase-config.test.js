import { jest } from '@jest/globals';

// 1. Setup Mocks
const mockAuth = {
    currentUser: {
        uid: 'mock-user-id',
        delete: jest.fn().mockResolvedValue(true),
    },
};
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();

jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(() => mockAuth),
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: class {},
    GoogleAuthProvider_instance: {},
}));

jest.mock('firebase/messaging', () => ({
    getMessaging: jest.fn(),
}));

// Mock firestore methods
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'mock-id' });
const mockSetDoc = jest.fn().mockResolvedValue(true);
const mockUpdateDoc = jest.fn().mockResolvedValue(true);
const mockGetDoc = jest.fn().mockResolvedValue({ exists: () => true, data: () => ({}) });
const mockGetDocs = jest.fn().mockResolvedValue({ docs: [], size: 0, empty: true });
const mockDeleteDoc = jest.fn().mockResolvedValue(true);

jest.mock('firebase/firestore', () => {
    const actual = jest.requireActual('firebase/firestore');
    return {
        ...actual,
        getFirestore: jest.fn(),
        collection: jest.fn((db, ...paths) => ({ id: 'mock-collection', path: paths.join('/') })),
        doc: jest.fn((db, coll, id) => ({
            id: id || 'mock-id',
            path: `${coll.path || coll}/${id}`,
        })),
        setDoc: (...args) => mockSetDoc(...args),
        addDoc: (...args) => mockAddDoc(...args),
        updateDoc: (...args) => mockUpdateDoc(...args),
        getDoc: (...args) => mockGetDoc(...args),
        getDocs: (...args) => mockGetDocs(...args),
        deleteDoc: (...args) => mockDeleteDoc(...args),
        serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
        where: jest.fn(),
        query: jest.fn(),
        onSnapshot: jest.fn((ref, callback) => {
            if (typeof callback === 'function') {
                callback({
                    docs: [],
                    empty: true,
                    forEach: (fn) => [],
                    docChanges: () => [],
                });
            }
            return () => {};
        }),
    };
});

// 2. Import functions
import {
    initFirebase,
    saveEvent,
    issueTicketToUser,
    addMoreTickets,
    loginWithEmail,
    logoutUser,
    updateEvent,
    deleteEvent,
    submitAssistanceRequest,
    updateQueue,
    updateHeatmap,
    listenForQueues,
    listenForHeatmap,
    saveDevice,
    deleteDevice,
    listenForDevices,
    getUserProfile,
    cleanupExpiredData,
    getEventTicketsSummary,
    listenForEventTickets,
    signUpWithEmail,
    saveToSchedule,
    getUserSchedule,
} from '../public/js/firebase-config.js';

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

describe('Firebase Config Tests', () => {
    beforeAll(async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ apiKey: 'VALID_TEST_KEY', projectId: 'test' }),
            })
        );
        await initFirebase();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window, 'localStorage', {
            value: { clear: jest.fn(), setItem: jest.fn(), getItem: jest.fn() },
            writable: true,
        });
        Object.defineProperty(window, 'sessionStorage', {
            value: { clear: jest.fn() },
            writable: true,
        });
    });

    describe('saveEvent', () => {
        it('should create an event document', async () => {
            const eventData = { title: 'Test Event', totalAttendees: 5 };
            await saveEvent(eventData, 'admin-uid');
            expect(mockAddDoc).toHaveBeenCalledTimes(1);
            expect(mockAddDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ title: 'Test Event', ownerId: 'admin-uid' })
            );
        });
    });

    describe('issueTicketToUser', () => {
        it('should assign a ticket if one is available', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [
                    {
                        ref: { id: 'seat-1' },
                        data: () => ({ isAssigned: false, ticketId: 'TKT-1' }),
                    },
                ],
            });
            const ticketId = await issueTicketToUser('event-1', 'user@test.com');
            expect(ticketId).toBe('TKT-1');
            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should throw an error if no tickets are generated', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: true });
            await expect(issueTicketToUser('event-1', 'user@test.com')).rejects.toThrow(
                'No tickets have been generated'
            );
        });

        it('should throw an error if all tickets are assigned', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [
                    {
                        ref: { id: 'seat-1' },
                        data: () => ({ isAssigned: true, assignedEmail: 'other@test.com' }),
                    },
                ],
            });
            await expect(issueTicketToUser('event-1', 'user@test.com')).rejects.toThrow(
                'No available tickets left'
            );
        });
    });

    describe('addMoreTickets', () => {
        it('should add tickets and update event capacity', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ totalAttendees: 5, numBatches: 1 }),
            });
            mockGetDocs.mockResolvedValueOnce({ size: 5 });
            await addMoreTickets('event-1', 2);
            expect(mockAddDoc).toHaveBeenCalledTimes(2);
            expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { totalAttendees: 7 });
        });
    });

    describe('Authentication', () => {
        it('loginWithGoogle should sign in and return user', async () => {
            const { loginWithGoogle } = await import('../public/js/firebase-config.js');
            const mockSignInWithPopup = jest.requireMock('firebase/auth').signInWithPopup;
            mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'google-123' } });

            const googleUser = await loginWithGoogle();
            expect(googleUser.uid).toBe('google-123');
        });

        it('loginWithEmail should sign in and return user', async () => {
            signInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
            const user = await loginWithEmail('test@test.com', 'password');
            expect(user.uid).toBe('123');
        });

        it('signUpWithEmail should create user and save profile', async () => {
            createUserWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
            const user = await signUpWithEmail('test@test.com', 'password', { name: 'Test' });
            expect(user.uid).toBe('123');
            expect(mockSetDoc).toHaveBeenCalled();
        });

        it('logoutUser should sign out and clear storage', async () => {
            signOut.mockResolvedValueOnce(true);
            await logoutUser();
            expect(window.localStorage.clear).toHaveBeenCalled();
        });

        it('deleteUserAccount should delete profile doc and user account', async () => {
            const { deleteUserAccount } = await import('../public/js/firebase-config.js');

            const mockUserDelete = jest.fn().mockResolvedValue(true);
            mockAuth.currentUser = { uid: 'mock-user-id', delete: mockUserDelete };

            mockDeleteDoc.mockResolvedValue(true);

            await deleteUserAccount();
            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockUserDelete).toHaveBeenCalled();
        });

        it('monitorAuth should set up an onAuthStateChanged listener', async () => {
            const { monitorAuth } = await import('../public/js/firebase-config.js');
            const onAuthStateChangedMock = jest.requireMock('firebase/auth').onAuthStateChanged;

            const callback = jest.fn();
            monitorAuth(callback);

            expect(onAuthStateChangedMock).toHaveBeenCalled();
            // Simulate the auth state changing
            const listener = onAuthStateChangedMock.mock.calls[0][1];
            listener({ uid: 'test-user' });
            expect(callback).toHaveBeenCalledWith({ uid: 'test-user' });
        });
    });

    describe('Schedule Operations', () => {
        it('saveToSchedule should call setDoc', async () => {
            await saveToSchedule('user-1', 'event-1');
            expect(mockSetDoc).toHaveBeenCalled();
        });

        it('getUserSchedule should return schedule IDs via listener', async () => {
            const { onSnapshot } = jest.requireMock('firebase/firestore');
            onSnapshot.mockImplementationOnce((ref, callback) => {
                callback({ docs: [{ id: 'event-1' }] });
                return () => {};
            });
            const sched = await getUserSchedule('user-1');
            expect(sched).toEqual(['event-1']);
        });
    });

    describe('Event Operations', () => {
        it('updateEvent should update doc', async () => {
            await updateEvent('event-1', { title: 'New Title' });
            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('deleteEvent should log deletion and delete subcollections', async () => {
            mockGetDocs.mockResolvedValue({ docs: [] });
            await deleteEvent('event-1');
            expect(mockDeleteDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'events/event-1' })
            );
        });
    });

    describe('submitAssistanceRequest', () => {
        it('should add assistance request', async () => {
            await submitAssistanceRequest({ message: 'Help' });
            expect(mockAddDoc).toHaveBeenCalled();
        });
    });

    describe('Queue & Heatmap Operations', () => {
        it('updateQueue should call updateDoc', async () => {
            await updateQueue('q1', { waitTimeMins: 5 });
            expect(mockUpdateDoc).toHaveBeenCalled();
        });
        it('updateHeatmap should call updateDoc', async () => {
            await updateHeatmap('h1', { congestion: 50 });
            expect(mockUpdateDoc).toHaveBeenCalled();
        });
        it('listenForQueues should call onSnapshot', () => {
            listenForQueues(() => {});
            expect(jest.requireMock('firebase/firestore').onSnapshot).toHaveBeenCalled();
        });
        it('listenForHeatmap should call onSnapshot', () => {
            listenForHeatmap(() => {});
            expect(jest.requireMock('firebase/firestore').onSnapshot).toHaveBeenCalled();
        });
    });

    describe('Device API', () => {
        it('saveDevice should call addDoc', async () => {
            await saveDevice('event-1', { name: 'Cam 1' }, 'uid');
            expect(mockAddDoc).toHaveBeenCalled();
        });
        it('deleteDevice should call deleteDoc', async () => {
            await deleteDevice('event-1', 'dev-1', 'uid');
            expect(mockDeleteDoc).toHaveBeenCalled();
        });
        it('listenForDevices should call onSnapshot', () => {
            listenForDevices('event-1', () => {});
            expect(jest.requireMock('firebase/firestore').onSnapshot).toHaveBeenCalled();
        });
    });

    describe('User Profile & Cleanup', () => {
        it('getUserProfile should get doc', async () => {
            await getUserProfile('uid');
            expect(mockGetDoc).toHaveBeenCalled();
        });
        it('cleanupExpiredData should get and delete docs', async () => {
            mockGetDocs
                .mockResolvedValueOnce({
                    docs: [{ id: 'req1', data: () => ({ eventDate: '2020-01-01' }) }],
                })
                .mockResolvedValueOnce({
                    docs: [{ id: 'req2', data: () => ({ date: '2020-01-01' }) }],
                });
            await cleanupExpiredData('uid');
            expect(mockGetDocs).toHaveBeenCalled();
            expect(mockDeleteDoc).toHaveBeenCalled();
        });
    });

    describe('Ticket Analytics API', () => {
        it('getEventTicketsSummary should return summary', async () => {
            mockGetDocs.mockResolvedValueOnce([
                { data: () => ({ isAssigned: false, batch: 1 }) },
                { data: () => ({ isAssigned: true, batch: 1 }) },
            ]);
            const summary = await getEventTicketsSummary('ev-1');
            expect(summary.total).toBe(2);
            expect(summary.unassigned).toBe(1);
        });
        it('listenForEventTickets should call onSnapshot', () => {
            listenForEventTickets('ev-1', () => {});
            expect(jest.requireMock('firebase/firestore').onSnapshot).toHaveBeenCalled();
        });
    });
});
