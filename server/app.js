import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { publicUser } from './store.js';

const roles = ['admin', 'owner', 'user'];
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const requireRole = (...allowed) => (req, res, next) => allowed.includes(req.user.role)
  ? next() : fail(res, 403, 'FORBIDDEN', 'Your role does not have permission to perform this action.');

export function createApp(store) {
  const app = express(); const sessions = new Map();
  app.use(cors()); app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const user = store.userByUsername(username);
    if (!user || !store.verifyPassword(user, req.body?.password)) return fail(res, 401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
    const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id);
    res.json({ data: { token, user: publicUser(user) } });
  });

  app.use('/api', (req, res, next) => {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const user = store.user(sessions.get(token));
    if (!user) return fail(res, 401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    req.token = token; req.user = user; next();
  });
  app.get('/api/auth/me', (req, res) => res.json({ data: publicUser(req.user) }));
  app.post('/api/auth/logout', (req, res) => { sessions.delete(req.token); res.status(204).end(); });

  app.get('/api/users', requireRole('admin'), (_req, res) => res.json({ data: store.users() }));
  app.post('/api/users', requireRole('admin'), (req, res) => {
    const body = req.body ?? {}; const name = typeof body.name === 'string' ? body.name.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!name || !/^[a-z0-9._-]{3,24}$/.test(username) || typeof body.password !== 'string' || body.password.length < 6)
      return fail(res, 400, 'VALIDATION_ERROR', 'Name, a 3–24 character username, and a password of at least 6 characters are required.');
    if (!roles.includes(body.role)) return fail(res, 400, 'VALIDATION_ERROR', 'Role must be admin, owner, or user.');
    if (store.userByUsername(username)) return fail(res, 409, 'USERNAME_TAKEN', 'That username is already in use.');
    res.status(201).json({ data: store.createUser(name, username, body.password, body.role) });
  });
  app.patch('/api/users/:id/role', requireRole('admin'), (req, res) => {
    const user = store.user(req.params.id); const role = req.body?.role;
    if (!user) return fail(res, 404, 'NOT_FOUND', 'User was not found.');
    if (!roles.includes(role)) return fail(res, 400, 'VALIDATION_ERROR', 'Role must be admin, owner, or user.');
    res.json({ data: store.updateUser(user.id, role) });
  });
  app.delete('/api/users/:id', requireRole('admin'), (req, res) => {
    if (!store.user(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'User was not found.');
    if (req.params.id === req.user.id) return fail(res, 400, 'SELF_DELETE', 'You cannot delete your current account.');
    store.deleteUser(req.params.id); res.status(204).end();
  });
  app.get('/api/bookings', (_req, res) => res.json({ data: store.bookings() }));
  app.post('/api/bookings', requireRole('user', 'owner'), (req, res) => {
    const body = req.body ?? {}; const explicitZone = (v) => typeof v === 'string' && /(Z|[+-]\d{2}:\d{2})$/i.test(v);
    const start = new Date(body.startTime); const end = new Date(body.endTime);
    if (!explicitZone(body.startTime) || !explicitZone(body.endTime) || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()))
      return fail(res, 400, 'VALIDATION_ERROR', 'Start and end must be ISO date-times with an explicit timezone.');
    if (start >= end) return fail(res, 400, 'INVALID_TIME_RANGE', 'Start time must be before end time.');
    const conflict = store.bookings().find((b) => start < new Date(b.endTime) && end > new Date(b.startTime));
    if (conflict) return fail(res, 409, 'BOOKING_CONFLICT', 'The room is already booked during part of this time.');
    res.status(201).json({ data: store.createBooking(req.user.id, start.toISOString(), end.toISOString()) });
  });
  app.delete('/api/bookings/:id', (req, res) => {
    const booking = store.bookings().find((item) => item.id === req.params.id);
    if (!booking) return fail(res, 404, 'NOT_FOUND', 'Booking was not found.');
    if (req.user.role === 'user' && booking.userId !== req.user.id) return fail(res, 403, 'FORBIDDEN', 'Users may only delete their own bookings.');
    store.deleteBooking(booking.id); res.status(204).end();
  });
  app.get('/api/summary', requireRole('owner', 'admin'), (_req, res) => {
    const users = store.users(); const bookings = store.bookings();
    res.json({ data: users.map((user) => ({ user, totalBookings: bookings.filter((b) => b.userId === user.id).length, bookings: bookings.filter((b) => b.userId === user.id) })), totalBookings: bookings.length });
  });
  app.use('/api', (_req, res) => fail(res, 404, 'NOT_FOUND', 'API endpoint was not found.'));
  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && 'body' in err) return fail(res, 400, 'INVALID_JSON', 'Request body contains invalid JSON.');
    console.error(err); return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  });
  return app;
}
