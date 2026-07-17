import express from 'express';
import cors from 'cors';

const roles = ['admin', 'owner', 'user'];
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const requireRole = (...allowed) => (req, res, next) => allowed.includes(req.user.role)
  ? next() : fail(res, 403, 'FORBIDDEN', 'Your role does not have permission to perform this action.');

export function createApp(store) {
  const app = express();
  app.use(cors()); app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/session/users', (_req, res) => res.json({ data: store.users() }));

  app.use('/api', (req, res, next) => {
    const id = req.header('x-user-id');
    const user = store.user(id);
    if (!user) return fail(res, 401, 'UNAUTHENTICATED', 'Select a valid user to continue.');
    req.user = user; next();
  });

  app.get('/api/users', requireRole('admin'), (_req, res) => res.json({ data: store.users() }));
  app.post('/api/users', requireRole('admin'), (req, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = body.role;
    if (!name) return fail(res, 400, 'VALIDATION_ERROR', 'Name is required.');
    if (!roles.includes(role)) return fail(res, 400, 'VALIDATION_ERROR', 'Role must be admin, owner, or user.');
    res.status(201).json({ data: store.createUser(name, role) });
  });
  app.patch('/api/users/:id/role', requireRole('admin'), (req, res) => {
    const user = store.user(req.params.id);
    if (!user) return fail(res, 404, 'NOT_FOUND', 'User was not found.');
    const role = (req.body ?? {}).role;
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
    const body = req.body ?? {};
    const explicitZone = (value) => typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/i.test(value);
    const start = new Date(body.startTime); const end = new Date(body.endTime);
    if (!explicitZone(body.startTime) || !explicitZone(body.endTime) || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()))
      return fail(res, 400, 'VALIDATION_ERROR', 'startTime and endTime must be valid ISO 8601 date-times with Z or an explicit UTC offset.');
    if (start >= end) return fail(res, 400, 'INVALID_TIME_RANGE', 'startTime must be before endTime.');
    const conflict = store.bookings().find((b) => start < new Date(b.endTime) && end > new Date(b.startTime));
    if (conflict) return fail(res, 409, 'BOOKING_CONFLICT', `This time overlaps booking ${conflict.id}.`);
    res.status(201).json({ data: store.createBooking(req.user.id, start.toISOString(), end.toISOString()) });
  });
  app.delete('/api/bookings/:id', (req, res) => {
    const booking = store.bookings().find((item) => item.id === req.params.id);
    if (!booking) return fail(res, 404, 'NOT_FOUND', 'Booking was not found.');
    if (req.user.role === 'user' && booking.userId !== req.user.id)
      return fail(res, 403, 'FORBIDDEN', 'Users may only delete their own bookings.');
    store.deleteBooking(booking.id); res.status(204).end();
  });
  app.get('/api/summary', requireRole('owner', 'admin'), (_req, res) => {
    const users = store.users(); const bookings = store.bookings();
    const data = users.map((user) => ({ user, totalBookings: bookings.filter((b) => b.userId === user.id).length,
      bookings: bookings.filter((b) => b.userId === user.id) }));
    res.json({ data, totalBookings: bookings.length });
  });

  app.use('/api', (_req, res) => fail(res, 404, 'NOT_FOUND', 'API endpoint was not found.'));
  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && 'body' in err) return fail(res, 400, 'INVALID_JSON', 'Request body contains invalid JSON.');
    console.error(err); return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  });
  return app;
}
