import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';

let server; let base;
before(async () => {
  server = createApp(new Store(':memory:')).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function request(path, user = 'user-1', options = {}) {
  const response = await fetch(base + path, { ...options, headers: { 'content-type': 'application/json', 'x-user-id': user, ...options.headers } });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test('rejects invalid ranges and all forms of overlap, but permits back-to-back', async () => {
  let result = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime: '2030-01-01T10:00:00Z', endTime: '2030-01-01T11:00:00Z' }) });
  assert.equal(result.response.status, 201);
  for (const [startTime, endTime] of [
    ['2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z'],
    ['2030-01-01T09:30:00Z', '2030-01-01T10:30:00Z'],
    ['2030-01-01T10:30:00Z', '2030-01-01T11:30:00Z'],
    ['2030-01-01T10:15:00Z', '2030-01-01T10:45:00Z'],
    ['2030-01-01T09:00:00Z', '2030-01-01T12:00:00Z'],
  ]) {
    result = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime, endTime }) });
    assert.equal(result.response.status, 409);
  }
  result = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime: '2030-01-01T11:00:00Z', endTime: '2030-01-01T12:00:00Z' }) });
  assert.equal(result.response.status, 201);
  result = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime: '2030-01-02T12:00:00Z', endTime: '2030-01-02T11:00:00Z' }) });
  assert.equal(result.response.status, 400);
});

test('enforces booking deletion permissions', async () => {
  const made = await request('/bookings', 'owner-1', { method: 'POST', body: JSON.stringify({ startTime: '2031-01-01T10:00:00Z', endTime: '2031-01-01T11:00:00Z' }) });
  let result = await request(`/bookings/${made.body.data.id}`, 'user-1', { method: 'DELETE' });
  assert.equal(result.response.status, 403);
  result = await request(`/bookings/${made.body.data.id}`, 'admin-1', { method: 'DELETE' });
  assert.equal(result.response.status, 204);
});

test('allows only admins to manage users and cascades booking deletion', async () => {
  let result = await request('/users', 'owner-1'); assert.equal(result.response.status, 403);
  result = await request('/users', 'admin-1', { method: 'POST', body: JSON.stringify({ name: 'Temporary', role: 'user' }) });
  const id = result.body.data.id; assert.equal(result.response.status, 201);
  await request('/bookings', id, { method: 'POST', body: JSON.stringify({ startTime: '2032-01-01T10:00:00Z', endTime: '2032-01-01T11:00:00Z' }) });
  result = await request(`/users/${id}`, 'admin-1', { method: 'DELETE' }); assert.equal(result.response.status, 204);
  const bookings = await request('/bookings', 'admin-1'); assert.equal(bookings.body.data.some((b) => b.userId === id), false);
});

test('restricts summary to owner and admin', async () => {
  assert.equal((await request('/summary', 'user-1')).response.status, 403);
  assert.equal((await request('/summary', 'owner-1')).response.status, 200);
  assert.equal((await request('/summary', 'admin-1')).response.status, 200);
});

test('enforces the complete role permission matrix', async () => {
  for (const roleId of ['user-1', 'owner-1']) {
    assert.equal((await request('/users', roleId)).response.status, 403);
    assert.equal((await request('/users', roleId, { method: 'POST', body: JSON.stringify({ name: 'Blocked', role: 'user' }) })).response.status, 403);
    assert.equal((await request('/users/user-1/role', roleId, { method: 'PATCH', body: JSON.stringify({ role: 'owner' }) })).response.status, 403);
    assert.equal((await request('/users/admin-1', roleId, { method: 'DELETE' })).response.status, 403);
  }
  assert.equal((await request('/bookings', 'admin-1', { method: 'POST', body: JSON.stringify({ startTime: '2033-01-01T10:00:00Z', endTime: '2033-01-01T11:00:00Z' }) })).response.status, 403);

  const own = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime: '2033-02-01T10:00:00Z', endTime: '2033-02-01T11:00:00Z' }) });
  assert.equal((await request(`/bookings/${own.body.data.id}`, 'user-1', { method: 'DELETE' })).response.status, 204);
  const forOwner = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime: '2033-03-01T10:00:00Z', endTime: '2033-03-01T11:00:00Z' }) });
  assert.equal((await request(`/bookings/${forOwner.body.data.id}`, 'owner-1', { method: 'DELETE' })).response.status, 204);
});

test('returns clear authentication and validation errors', async () => {
  let result = await fetch(`${base}/bookings`);
  assert.equal(result.status, 401);
  assert.equal((await result.json()).error.code, 'UNAUTHENTICATED');

  result = await fetch(`${base}/bookings`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': 'user-1' }, body: '{bad json' });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).error.code, 'INVALID_JSON');

  const noBody = await request('/bookings', 'user-1', { method: 'POST' });
  assert.equal(noBody.response.status, 400);
  assert.equal(noBody.body.error.code, 'VALIDATION_ERROR');
  const ambiguousTime = await request('/bookings', 'user-1', { method: 'POST', body: JSON.stringify({ startTime: '2034-01-01T10:00:00', endTime: '2034-01-01T11:00:00' }) });
  assert.equal(ambiguousTime.response.status, 400);
});

test('admin can list, create, change, and delete users but cannot self-delete', async () => {
  assert.equal((await request('/users', 'admin-1')).response.status, 200);
  const made = await request('/users', 'admin-1', { method: 'POST', body: JSON.stringify({ name: 'Role Test', role: 'user' }) });
  assert.equal(made.response.status, 201);
  const id = made.body.data.id;
  const changed = await request(`/users/${id}/role`, 'admin-1', { method: 'PATCH', body: JSON.stringify({ role: 'owner' }) });
  assert.equal(changed.response.status, 200); assert.equal(changed.body.data.role, 'owner');
  assert.equal((await request('/users/admin-1', 'admin-1', { method: 'DELETE' })).response.status, 400);
  assert.equal((await request(`/users/${id}`, 'admin-1', { method: 'DELETE' })).response.status, 204);
});
