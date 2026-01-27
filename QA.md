# QA + Load Validation (Quick Checklist)

This repo includes a small QA harness and some practical checks for:

- Concurrent order creation
- WebSocket reconnect behavior
- Redis outage behavior (health endpoint)
- Refund edge cases

## 1) Concurrent Orders (Load)

Run inside the backend container (recommended), or anywhere `DATABASE_URL` is available.

1. Ensure loadtest users exist:
   - `node dist/src/utils/loadtest-bootstrap.js`
2. Run the QA harness:
   - `QA_ORDERS=50 QA_CONCURRENCY=20 node dist/src/utils/qa-load-validation.js`

Env vars:
- `QA_API_URL` (default `http://localhost:3001`)
- `QA_ORDERS` (default `20`)
- `QA_CONCURRENCY` (default `10`)
- `QA_CUSTOMER_EMAIL` / `QA_CUSTOMER_PASS`
- `QA_PHARMACY_EMAIL`

## 2) WebSocket Reconnects

Frontend WS behavior is handled in `uskery-frontend/src/providers/WSProvider.tsx`:
- On reconnect: refreshes pharmacy orders + notifications
- On disconnect: shows a warning toast (pharmacy/admin)

Manual test:
1. Open `/pharmacy/orders` in browser.
2. Restart backend container.
3. Confirm you see reconnect toast and list refresh after reconnect.

## 3) Redis Outage / Failover Behavior

Use `GET /health`:
- returns **200** when DB + Redis are up
- returns **503** when Redis (or DB) is down

Manual test:
1. Stop redis container
2. `curl http://localhost:3001/health` should fail with 503
3. Start redis container
4. `curl http://localhost:3001/health` should return ok again

## 4) Refund Edge Cases (Admin)

Endpoint: `POST /payments/refund` (ADMIN)

Behavior:
- idempotent if already refunded (`{ ok:true, refunded:true, already:true }`)
- validates refund amount (must be > 0 and ≤ charged amount)
- blocks refund unless transaction status is `SUCCESS` (except loadtest mode)
- blocks Razorpay refund if `providerPayment` is missing
- writes `PAYMENT_REFUNDED` timeline event for the order and notifies customer + pharmacy

