import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const dtLocal = (date) => {
  const d = new Date(date); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function App() {
  const [users, setUsers] = useState([]); const [userId, setUserId] = useState(localStorage.userId || '');
  const [bookings, setBookings] = useState([]); const [summary, setSummary] = useState([]);
  const [notice, setNotice] = useState(null); const [busy, setBusy] = useState(false);
  const [times, setTimes] = useState({ startTime: dtLocal(Date.now() + 3600000), endTime: dtLocal(Date.now() + 7200000) });
  const [newUser, setNewUser] = useState({ name: '', role: 'user' });
  const current = users.find((u) => u.id === userId);
  const names = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users]);

  async function api(url, options = {}, auth = true) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(auth && userId ? { 'x-user-id': userId } : {}), ...options.headers } });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error?.message || `Request failed (${response.status})`); }
    return response.status === 204 ? null : response.json();
  }
  async function loadUsers(selected = userId) {
    const body = await api('/api/session/users', {}, false); setUsers(body.data);
    if (!selected || !body.data.some((u) => u.id === selected)) {
      const next = body.data[0]?.id || ''; setUserId(next); localStorage.userId = next;
    }
  }
  async function refresh() {
    if (!userId) return;
    try { const body = await api('/api/bookings'); setBookings(body.data);
      if (current && current.role !== 'user') setSummary((await api('/api/summary')).data); else setSummary([]);
    } catch (e) { setNotice({ type: 'error', text: e.message }); }
  }
  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { refresh(); }, [userId, current?.role]);

  async function action(fn, success) {
    setBusy(true); setNotice(null);
    try { await fn(); setNotice({ type: 'success', text: success }); await loadUsers(userId); await refresh(); }
    catch (e) { setNotice({ type: 'error', text: e.message }); } finally { setBusy(false); }
  }
  const selectUser = (id) => { setUserId(id); localStorage.userId = id; setNotice(null); };
  const canDelete = (b) => current?.role !== 'user' || b.userId === current.id;

  if (!current) return <main className="shell"><p>Loading application…</p></main>;
  return <>
    <header><div><span className="eyebrow">SINGLE ROOM</span><h1>Meeting Room Booking</h1></div>
      <label className="identity">Signed in as<select value={userId} onChange={(e) => selectUser(e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}</select></label>
    </header>
    <main className="shell">
      <div className="roleline">Current role <strong className={`pill ${current.role}`}>{current.role}</strong><span>Times are shown in your local timezone and stored in UTC.</span></div>
      {notice && <div role="alert" className={`notice ${notice.type}`}>{notice.text}<button onClick={() => setNotice(null)}>×</button></div>}
      <div className="grid">
        {current.role !== 'admin' && <section className="card booking-form"><div className="section-title"><span>New booking</span><small>Back-to-back slots are allowed</small></div>
          <form onSubmit={(e) => { e.preventDefault(); action(() => api('/api/bookings', { method: 'POST', body: JSON.stringify({ startTime: new Date(times.startTime).toISOString(), endTime: new Date(times.endTime).toISOString() }) }), 'Booking created.'); }}>
            <label>Starts<input type="datetime-local" required value={times.startTime} onChange={(e) => setTimes({ ...times, startTime: e.target.value })}/></label>
            <label>Ends<input type="datetime-local" required value={times.endTime} onChange={(e) => setTimes({ ...times, endTime: e.target.value })}/></label>
            <button className="primary" disabled={busy}>Book the room</button>
          </form>
        </section>}
        <section className="card bookings"><div className="section-title"><span>Upcoming bookings</span><small>{bookings.length} total</small></div>
          {bookings.length === 0 ? <div className="empty">The room is wide open. Create the first booking.</div> : <div className="booking-list">{bookings.map((b) => <article key={b.id}>
            <div className="datebox"><strong>{new Date(b.startTime).toLocaleDateString([], { day: '2-digit' })}</strong><span>{new Date(b.startTime).toLocaleDateString([], { month: 'short' })}</span></div>
            <div className="booking-info"><strong>{new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><span>Booked by {names[b.userId] || 'Deleted user'}</span></div>
            {canDelete(b) && <button className="danger ghost" disabled={busy} onClick={() => action(() => api(`/api/bookings/${b.id}`, { method: 'DELETE' }), 'Booking deleted.')}>Delete</button>}
          </article>)}</div>}
        </section>
      </div>
      {current.role !== 'user' && <section className="card summary"><div className="section-title"><span>Bookings grouped by user</span><small>Owner & admin view</small></div><div className="stats">{summary.map((row) => <div key={row.user.id}><strong>{row.totalBookings}</strong><span>{row.user.name}</span><small>{row.user.role}</small>{row.bookings.length > 0 && <ul>{row.bookings.map((booking) => <li key={booking.id}>{new Date(booking.startTime).toLocaleString()} – {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</li>)}</ul>}</div>)}</div></section>}
      {current.role === 'admin' && <section className="card admin"><div className="section-title"><span>User management</span><small>Deleting a user also deletes their bookings</small></div>
        <form onSubmit={(e) => { e.preventDefault(); action(() => api('/api/users', { method: 'POST', body: JSON.stringify(newUser) }), 'User created.'); setNewUser({ name: '', role: 'user' }); }}><input aria-label="New user name" placeholder="New user's name" required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}/><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}><option>user</option><option>owner</option><option>admin</option></select><button className="primary" disabled={busy}>Add user</button></form>
        <div className="user-list">{users.map((u) => <div key={u.id}><span><strong>{u.name}</strong><small>{u.id}</small></span><select aria-label={`Role for ${u.name}`} value={u.role} disabled={busy} onChange={(e) => action(() => api(`/api/users/${u.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }), 'Role updated.')}>{['user','owner','admin'].map((r) => <option key={r}>{r}</option>)}</select><button className="danger ghost" disabled={busy || u.id === current.id} onClick={() => action(() => api(`/api/users/${u.id}`, { method: 'DELETE' }), 'User and their bookings deleted.')}>Delete</button></div>)}</div>
      </section>}
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
