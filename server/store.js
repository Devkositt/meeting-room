import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;

const seed = {
  users: [
    { id: 'admin-1', name: 'KoKo', username: 'koko', passwordHash: hashPassword('admin123'), role: 'admin' },
    { id: 'owner-1', name: 'MgMg', username: 'mgmg', passwordHash: hashPassword('owner123'), role: 'owner' },
  ],
  bookings: [],
};

export const publicUser = ({ passwordHash: _passwordHash, ...user }) => user;

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.memory = filePath === ':memory:';
    if (this.memory) this.data = structuredClone(seed);
    else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(seed, null, 2));
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.migrateLegacyUsers();
    }
  }

  migrateLegacyUsers() {
    const defaults = { 'admin-1': ['KoKo', 'koko', 'admin123'], 'owner-1': ['MgMg', 'mgmg', 'owner123'] };
    for (const user of this.data.users) {
      const fallback = defaults[user.id];
      if (fallback) {
        [user.name, user.username] = fallback;
        if (!user.passwordHash) user.passwordHash = hashPassword(fallback[2]);
      } else {
        user.username ||= `user-${user.id.slice(0, 6)}`;
        user.passwordHash ||= hashPassword('change123');
      }
    }
    this.save();
  }

  save() {
    if (!this.memory) {
      const temp = `${this.filePath}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(this.data, null, 2));
      fs.renameSync(temp, this.filePath);
    }
  }

  users() { return this.data.users.map(publicUser); }
  user(id) { return this.data.users.find((item) => item.id === id); }
  userByUsername(username) { return this.data.users.find((item) => item.username === username.toLowerCase()); }
  verifyPassword(user, password) {
    if (!user?.passwordHash || typeof password !== 'string') return false;
    const [salt, expected] = user.passwordHash.split(':');
    const actual = crypto.scryptSync(password, salt, 64);
    return expected?.length === actual.length * 2 && crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }
  bookings() { return [...this.data.bookings].sort((a, b) => a.startTime.localeCompare(b.startTime)); }

  createUser(name, username, password, role) {
    const user = { id: crypto.randomUUID(), name, username: username.toLowerCase(), passwordHash: hashPassword(password), role };
    this.data.users.push(user); this.save(); return publicUser(user);
  }
  updateUser(id, role) { const user = this.user(id); user.role = role; this.save(); return publicUser(user); }
  deleteUser(id) {
    this.data.users = this.data.users.filter((item) => item.id !== id);
    this.data.bookings = this.data.bookings.filter((item) => item.userId !== id); this.save();
  }
  createBooking(userId, startTime, endTime) {
    const booking = { id: crypto.randomUUID(), userId, startTime, endTime, createdAt: new Date().toISOString() };
    this.data.bookings.push(booking); this.save(); return booking;
  }
  deleteBooking(id) { this.data.bookings = this.data.bookings.filter((item) => item.id !== id); this.save(); }
}
