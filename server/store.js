import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const seed = {
  users: [
    { id: 'admin-1', name: 'Alice Admin', role: 'admin' },
    { id: 'owner-1', name: 'Oscar Owner', role: 'owner' },
    { id: 'user-1', name: 'Uma User', role: 'user' },
  ],
  bookings: [],
};

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.memory = filePath === ':memory:';
    if (this.memory) this.data = structuredClone(seed);
    else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(seed, null, 2));
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }

  save() {
    if (!this.memory) {
      const temp = `${this.filePath}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(this.data, null, 2));
      fs.renameSync(temp, this.filePath);
    }
  }

  users() { return [...this.data.users]; }
  user(id) { return this.data.users.find((item) => item.id === id); }
  bookings() { return [...this.data.bookings].sort((a, b) => a.startTime.localeCompare(b.startTime)); }

  createUser(name, role) {
    const user = { id: crypto.randomUUID(), name, role };
    this.data.users.push(user); this.save(); return user;
  }

  updateUser(id, role) {
    const user = this.user(id); user.role = role; this.save(); return user;
  }

  deleteUser(id) {
    this.data.users = this.data.users.filter((item) => item.id !== id);
    this.data.bookings = this.data.bookings.filter((item) => item.userId !== id);
    this.save();
  }

  createBooking(userId, startTime, endTime) {
    const booking = { id: crypto.randomUUID(), userId, startTime, endTime, createdAt: new Date().toISOString() };
    this.data.bookings.push(booking); this.save(); return booking;
  }

  deleteBooking(id) {
    this.data.bookings = this.data.bookings.filter((item) => item.id !== id); this.save();
  }
}
