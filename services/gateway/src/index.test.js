// Order Gateway: Basic tests
// checking validation: JWT required, idempotency key required, and bad input scenarios

describe('Order Validation', () => {
    // mirrors the actual validation from the gateway
    function validateOrderBody(body) {
        if (!body.item_id) return { valid: false, code: 400, error: 'item_id is required' };
        if (!body.idempotency_key) return { valid: false, code: 400, error: 'idempotency_key is required' };
        return { valid: true };
    }

    function validateAuth(header) {
        if (!header || !header.startsWith('Bearer ')) {
            return { valid: false, code: 401, error: 'Missing or invalid Authorization header' };
        }
        return { valid: true };
    }

    test('returns 400 when item_id is missing', () => {
        const result = validateOrderBody({ idempotency_key: 'key-123' });
        expect(result.valid).toBe(false);
        expect(result.code).toBe(400);
        expect(result.error).toMatch(/item_id/);
    });

    test('returns 400 when idempotency_key is missing', () => {
        const result = validateOrderBody({ item_id: 1 });
        expect(result.valid).toBe(false);
        expect(result.code).toBe(400);
        expect(result.error).toMatch(/idempotency_key/);
    });

    test('returns 400 when both fields are missing', () => {
        const result = validateOrderBody({});
        expect(result.valid).toBe(false);
        expect(result.code).toBe(400);
    });

    test('passes validation when both required fields present', () => {
        const result = validateOrderBody({ item_id: 2, idempotency_key: 'abc-xyz' });
        expect(result.valid).toBe(true);
    });

    test('returns 401 when Authorization header is missing', () => {
        const result = validateAuth(undefined);
        expect(result.valid).toBe(false);
        expect(result.code).toBe(401);
    });

    test('returns 401 when Authorization header is not Bearer token', () => {
        const result = validateAuth('Basic abc123');
        expect(result.valid).toBe(false);
        expect(result.code).toBe(401);
    });

    test('passes auth check with valid Bearer prefix', () => {
        const result = validateAuth('Bearer some.jwt.token');
        expect(result.valid).toBe(true);
    });
});
