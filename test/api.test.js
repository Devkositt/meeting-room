import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';

let server; let base; const tokens = {};
before(async () => {
  server = createApp(new Store(':memory:')).listen(0); await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  tokens.admin = await login('koko', 'admin123'); tokens.owner = await login('mgmg', 'owner123');
  const made = await request('/users', 'admin', { method: 'POST', body: JSON.stringify({ name: 'SuSu', username: 'susu', password: 'user123', role: 'user' }) });
  assert.equal(made.response.status, 201); tokens.user = await login('susu', 'user123'); tokens.userId = made.body.data.id;
});
after(() => server.close());

async function login(username, password) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(response.status, 200); return (await response.json()).data.token;
}
async function request(path, role, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { 'content-type': 'application/json', ...(tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {}), ...options.headers } });
  return { response, body: response.status === 204 ? null : await response.json() };
}

test('requires login and rejects incorrect credentials', async () => {
  assert.equal((await request('/bookings', 'none')).response.status, 401);
  const bad = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'koko', password: 'wrong' }) });
  assert.equal(bad.status, 401); assert.equal((await bad.json()).error.code, 'INVALID_CREDENTIALS');
});

test('uses the requested default KoKo admin and MgMg owner accounts', async () => {
  assert.equal((await request('/auth/me', 'admin')).body.data.name, 'KoKo');
  assert.equal((await request('/auth/me', 'owner')).body.data.name, 'MgMg');
});

test('rejects every overlap shape and permits back-to-back ranges', async () => {
  assert.equal((await request('/bookings', 'user', { method: 'POST', body: JSON.stringify({ startTime: '2030-01-01T10:00:00Z', endTime: '2030-01-01T11:00:00Z' }) })).response.status, 201);
  for (const [startTime, endTime] of [['2030-01-01T10:00:00Z','2030-01-01T11:00:00Z'],['2030-01-01T09:30:00Z','2030-01-01T10:30:00Z'],['2030-01-01T10:30:00Z','2030-01-01T11:30:00Z'],['2030-01-01T10:15:00Z','2030-01-01T10:45:00Z'],['2030-01-01T09:00:00Z','2030-01-01T12:00:00Z']])
    assert.equal((await request('/bookings', 'owner', { method: 'POST', body: JSON.stringify({ startTime, endTime }) })).response.status, 409);
  assert.equal((await request('/bookings', 'owner', { method: 'POST', body: JSON.stringify({ startTime: '2030-01-01T11:00:00Z', endTime: '2030-01-01T12:00:00Z' }) })).response.status, 201);
});

test('enforces booking and user-management permission matrix', async () => {
  assert.equal((await request('/bookings', 'admin', { method: 'POST', body: JSON.stringify({ startTime: '2031-01-01T10:00:00Z', endTime: '2031-01-01T11:00:00Z' }) })).response.status, 403);
  for (const role of ['owner', 'user']) {
    assert.equal((await request('/users', role)).response.status, 403);
    assert.equal((await request('/users', role, { method: 'POST', body: '{}' })).response.status, 403);
  }
  const ownerBooking = await request('/bookings', 'owner', { method: 'POST', body: JSON.stringify({ startTime: '2032-01-01T10:00:00Z', endTime: '2032-01-01T11:00:00Z' }) });
  assert.equal((await request(`/bookings/${ownerBooking.body.data.id}`, 'user', { method: 'DELETE' })).response.status, 403);
  assert.equal((await request(`/bookings/${ownerBooking.body.data.id}`, 'admin', { method: 'DELETE' })).response.status, 204);
  assert.equal((await request('/summary', 'owner')).response.status, 200); assert.equal((await request('/summary', 'user')).response.status, 403);
});

test('admin-created accounts can log in and duplicate usernames are rejected', async () => {
  const duplicate = await request('/users', 'admin', { method: 'POST', body: JSON.stringify({ name: 'Other', username: 'susu', password: 'other123', role: 'user' }) });
  assert.equal(duplicate.response.status, 409);
  const users = await request('/users', 'admin'); assert.equal(users.response.status, 200);
  assert.equal(users.body.data.some((u) => 'passwordHash' in u), false);
});

test('logout invalidates the session token', async () => {
  const token = await login('mgmg', 'owner123');
  let response = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }); assert.equal(response.status, 204);
  response = await fetch(`${base}/bookings`, { headers: { authorization: `Bearer ${token}` } }); assert.equal(response.status, 401);
});
