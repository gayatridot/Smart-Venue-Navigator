module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/tests/**/*.test.js'],
    moduleNameMapper: {
        '^https://www.gstatic.com/firebasejs/([^/]+)/firebase-app.js$': 'firebase/app',
        '^https://www.gstatic.com/firebasejs/([^/]+)/firebase-firestore.js$': 'firebase/firestore',
        '^https://www.gstatic.com/firebasejs/([^/]+)/firebase-auth.js$': 'firebase/auth',
        '^https://www.gstatic.com/firebasejs/([^/]+)/firebase-messaging.js$': 'firebase/messaging',
    },
    transform: {
        '^.+\\.[t|j]sx?$': 'babel-jest',
    },
};
