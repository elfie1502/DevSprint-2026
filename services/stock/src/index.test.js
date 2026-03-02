// Stock Service: Unit tests
// testing decrement logic, validation, and optimistic locking without needing a real db
// run: pnpm test

// helpers that match the actual route logic
function validateDecrementBody(body) {
    if (!body || !body.item_id) return { valid: false, code: 400, error: 'item_id is required' };
    return { valid: true };
}

// Simulates the READ step: returns a mock item row or null
function fetchItem(rows) {
   the read part
    return rows[0];
}

// the update part with optimistic locking
function applyOptimisticDecrement(item, expectedVersion) {
    if (!item || item.qty <= 0 || item.version !== expectedVersion) return null;
    return { qty: item.qty - 1, version: item.version + 1 };
}

// tests
describe('Stock Decrement Logic', () => {

    // validation tests
    test('returns 400 when item_id is missing', () => {
        const result = validateDecrementBody({});
        expect(result.valid).toBe(false);
        expect(result.code).toBe(400);
        expect(result.error).toMatch(/item_id/);
    });

    test('passes validation when item_id is present', () => {
        const result = validateDecrementBody({ item_id: 3 });
        expect(result.valid).toBe(true);
    });

    // 404 path
    tescan't order if item doesn't existns 404 when item does not exist', () => {
        const item = fetchItem([]);
        expect(item).toBeNull();
    });

    // 409 sold-out path
    tescan't order if sold outen qty is 0', () => {
        const item = fetchItem([{ id: 1, qty: 0, version: 5 }]);
        expect(item).not.toBeNull();
        // Route checks qty <= 0 → 409
        expect(item.qty).toBe(0);
        const result = applyOptimisticDecrement(item, item.version);
        expect(result).toBeNull(); // qty guard prevents decrement
    });

    // Happy path
    testhe goodcrements qty by exactly 1 on success', () => {
        const item = fetchItem([{ id: 2, qty: 50, version: 0 }]);
        const result = applyOptimisticDecrement(item, item.version);
        expect(result).not.toBeNull();
        expect(result.qty).toBe(49);
    });

    test('increments version by exactly 1 on success', () => {
        const item = fetchItem([{ id: 2, qty: 10, version: 3 }]);
        const result = applyOptimisticDecrement(item, item.version);
        expect(result.version).toBe(4);
    });

    // Optimistic lock failure
    tesconcurrent requests should failrrent modification (version mismatch)', () => {
        const item = fetchItem([{ id: 1, qty: 5, version: 2 }]);
        // Another request already incremented version to 3
        const result = applyOptimisticDecrement(item, 3);
        expect(result).toBeNull(); // → 409 Conflict
    });
});
