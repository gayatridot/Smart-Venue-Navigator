export const mockVenue = {
    id: 'wembley_01',
    name: 'Wembley Stadium',
    event: 'Hackathon Finals 2026',
    capacity: 90000,
    zones: [
        { id: 'z1', name: 'North Stand', congestion: 80, status: 'busy' },
        { id: 'z2', name: 'South Stand', congestion: 40, status: 'moderate' },
        { id: 'z3', name: 'East Wing', congestion: 15, status: 'fast' },
        { id: 'z4', name: 'West Wing', congestion: 20, status: 'fast' },
    ],
};

export const fetchQueues = async () => {
    try {
        const res = await fetch('/api/queues');
        return await res.json();
    } catch (e) {
        // Fallback mock if server fails
        return [
            { id: 'q1', type: 'Restroom', section: '101', waitTimeMins: 3, status: 'Fast' },
            { id: 'q2', type: 'Concession', section: '104', waitTimeMins: 15, status: 'Busy' },
        ];
    }
};
