import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from './api';

type HKTask = {
  id: number;
  room_number: string;
  status: string;
  is_rush: number;
  housekeeper_id: number;
  housekeeper_name?: string;
  has_note?: number;
  has_maintenance?: number;
  checkout_time?: string | null; // "HH:MM" or null
};

type Ticket = {
  id: number;
  room_number: string;
  description: string;
  priority: string;
  status: string;
};

type HKNote = {
  id: number;
  author_name: string;
  text: string;
  created_at: string;
};

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch {
      setError('Login failed');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Hotel Ops Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username:&nbsp;</label>
          <input value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div>
          <label>Password:&nbsp;</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit">Login</button>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </form>
    </div>
  );
}

// Core manager/headHK board component (no auth inside, just props)
function ManagerHeadHKBoardCore({
  user,
  logout,
}: {
  user: { name: string; role: string } | null;
  logout: () => void;
}) {
  const [tab, setTab] = useState<'dashboard' | 'housekeeping' | 'maintenance'>('dashboard');

  const [tasks, setTasks] = useState<HKTask[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [assignHousekeeperId, setAssignHousekeeperId] = useState('');
  const [assignRoomNumbers, setAssignRoomNumbers] = useState('');
  const [selectedTaskNotes, setSelectedTaskNotes] = useState<HKNote[] | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const [newTicketRoomNumber, setNewTicketRoomNumber] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<'normal' | 'rush'>('normal');

  // For headHK adding notes from board
  const [boardNoteTaskId, setBoardNoteTaskId] = useState<number | null>(null);
  const [boardNoteText, setBoardNoteText] = useState('');

  const loadData = async () => {
    const [tasksRes, ticketsRes] = await Promise.all([
      api.get('/housekeeping/board'),
      api.get('/maintenance/board')
    ]);
    setTasks(tasksRes.data);
    setTickets(ticketsRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const assignTasks = async () => {
    if (!assignHousekeeperId || !assignRoomNumbers) return;
    const roomNumbers = assignRoomNumbers
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (roomNumbers.length === 0) return;

    await api.post('/housekeeping/assign', {
      housekeeperId: Number(assignHousekeeperId),
      roomNumbers
    });
    setAssignRoomNumbers('');
    await loadData();
  };

  const resetTodayTasks = async () => {
    if (!window.confirm("Delete all housekeeping tasks for today?")) return;
    await api.post('/housekeeping/reset-today');
    await loadData();
  };

  const toggleRush = async (task: HKTask) => {
    await api.post('/housekeeping/rush', { taskId: task.id, isRush: task.is_rush ? 0 : 1 });
    await loadData();
  };

  const inspectTask = async (taskId: number) => {
    await api.post('/housekeeping/inspect', { taskId });
    await loadData();
  };

  const loadNotes = async (taskId: number) => {
    const res = await api.get(`/housekeeping/notes/${taskId}`);
    setSelectedTaskId(taskId);
    setSelectedTaskNotes(res.data);
  };

  const createTicket = async () => {
    if (!newTicketRoomNumber || !newTicketDesc) return;
    await api.post('/maintenance', {
      roomNumber: newTicketRoomNumber.trim(),
      description: newTicketDesc,
      priority: newTicketPriority
    });
    setNewTicketRoomNumber('');
    setNewTicketDesc('');
    await loadData();
  };

  const updateTicket = async (ticket: Ticket, status: string) => {
    await api.post('/maintenance/update', { ticketId: ticket.id, status });
    await loadData();
  };

  const deleteTicket = async (ticketId: number) => {
    await api.delete(`/maintenance/${ticketId}`);
    await loadData();
  };

  const deleteTask = async (taskId: number) => {
    if (!window.confirm('Delete this housekeeping task?')) return;
    await api.delete(`/housekeeping/${taskId}`);
    await loadData();
  };

  const headHKUpdateStatus = async (taskId: number, status: string) => {
    await api.post('/housekeeping/update-status-any', { taskId, status });
    await loadData();
  };

  const openBoardNote = (taskId: number) => {
    setBoardNoteTaskId(taskId);
    setBoardNoteText('');
  };

  const saveBoardNote = async () => {
    if (!boardNoteTaskId || !boardNoteText) return;
    await api.post('/housekeeping/note', {
      taskId: boardNoteTaskId,
      text: boardNoteText,
    });
    setBoardNoteTaskId(null);
    setBoardNoteText('');
    await loadData();
  };

  const managerSetStayover = async (taskId: number) => {
    await api.post('/housekeeping/set-stayover', { taskId });
    await loadData();
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10 }}>
        <strong>User:</strong> {user?.name} ({user?.role}){' '}
        <button onClick={logout}>Logout</button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setTab('dashboard')}>Dashboard</button>
        <button onClick={() => setTab('housekeeping')}>Housekeeping</button>
        <button onClick={() => setTab('maintenance')}>Maintenance</button>
      </div>

      {tab === 'dashboard' && (
        <>
          <h2>Dashboard</h2>
          <p>
            Total housekeeping tasks today: {tasks.length} | Total maintenance tickets: {tickets.length}
          </p>
        </>
      )}

      {tab === 'housekeeping' && (
        <>
          <h2>Housekeeping - Assign & Board</h2>

          <h3>Assign rooms to housekeeper</h3>
          <div>
            <input
              placeholder="Housekeeper user id"
              value={assignHousekeeperId}
              onChange={e => setAssignHousekeeperId(e.target.value)}
            />
          </div>
          <div>
            <input
              placeholder="Room numbers comma separated (e.g., 101,102)"
              value={assignRoomNumbers}
              onChange={e => setAssignRoomNumbers(e.target.value)}
            />
          </div>
          <button onClick={assignTasks}>Assign</button>

          <div style={{ marginTop: 10 }}>
            <button onClick={resetTodayTasks}>Reset today&apos;s housekeeping tasks</button>
          </div>

          <h3 style={{ marginTop: 20 }}>Housekeeping board (today)</h3>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Room</th>
                <th>Housekeeper</th>
                <th>Status</th>
                <th>Change status</th>
                <th>Checkout time</th>
                <th>Rush</th>
                <th>Inspect</th>
                <th>Note?</th>
                <th>Maint.?</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>{t.room_number}</td>
                  <td>{t.housekeeper_name}</td>
                  <td>{t.status}</td>
                  <td>
                    {t.status === 'stayover' ? (
                      <span>Stayover</span>
                    ) : user?.role === 'headhousekeeper' && t.status !== 'inspected' ? (
                      // Head HK: only normal cleaning statuses
                      <>
                        <button onClick={() => headHKUpdateStatus(t.id, 'dirty')}>Dirty</button>
                        <button onClick={() => headHKUpdateStatus(t.id, 'cleaning')}>Cleaning</button>
                        <button onClick={() => headHKUpdateStatus(t.id, 'ready_for_inspection')}>
                          Ready
                        </button>
                      </>
                    ) : user?.role === 'manager' && t.status !== 'inspected' ? (
                      // Manager: normal statuses + Stayover
                      <>
                        <button onClick={() => headHKUpdateStatus(t.id, 'dirty')}>Dirty</button>
                        <button onClick={() => headHKUpdateStatus(t.id, 'cleaning')}>Cleaning</button>
                        <button onClick={() => headHKUpdateStatus(t.id, 'ready_for_inspection')}>
                          Ready
                        </button>
                        <button onClick={() => managerSetStayover(t.id)}>Stayover</button>
                      </>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    <input
                      type="time"
                      value={t.checkout_time || ''}
                      onChange={async e => {
                        const time = e.target.value; // "HH:MM" or ""
                        await api.post('/housekeeping/checkout-time', {
                          taskId: t.id,
                          checkoutTime: time
                        });
                        await loadData();
                      }}
                    />
                  </td>
                  <td>
                    <button onClick={() => toggleRush(t)}>{t.is_rush ? 'Unrush' : 'Rush'}</button>
                  </td>
                  <td>
                    {t.status === 'ready_for_inspection' ? (
                      <button onClick={() => inspectTask(t.id)}>Mark inspected</button>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {t.has_note ? (
                      <button onClick={() => loadNotes(t.id)}>📝 View</button>
                    ) : user?.role === 'headhousekeeper' ? (
                      <button onClick={() => openBoardNote(t.id)}>Add note</button>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {t.has_maintenance ? (
                      <span>Has ticket</span>
                    ) : (
                      <button
                        onClick={async () => {
                          const desc = window.prompt(
                            'Maintenance issue description for room ' + t.room_number
                          );
                          if (!desc) return;
                          await api.post('/maintenance/from-housekeeping', {
                            taskId: t.id,
                            description: desc,
                            priority: t.is_rush ? 'rush' : 'normal'
                          });
                          await loadData();
                        }}
                      >
                        Create ticket
                      </button>
                    )}
                  </td>
                  <td>
                    <button onClick={() => deleteTask(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedTaskNotes && (
            <div style={{ marginTop: 10 }}>
              <h3>Notes for task {selectedTaskId}</h3>
              <ul>
                {selectedTaskNotes.map(n => (
                  <li key={n.id}>
                    <strong>{n.author_name}</strong> ({new Date(n.created_at).toLocaleTimeString()}):{' '}
                    {n.text}
                  </li>
                ))}
              </ul>
              <button onClick={() => setSelectedTaskNotes(null)}>Close notes</button>
            </div>
          )}

          {boardNoteTaskId && (
            <div style={{ marginTop: 10 }}>
              <h3>Add note for task {boardNoteTaskId}</h3>
              <textarea
                rows={3}
                cols={40}
                value={boardNoteText}
                onChange={e => setBoardNoteText(e.target.value)}
              />
              <div>
                <button onClick={saveBoardNote}>Save note</button>
                <button onClick={() => setBoardNoteTaskId(null)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'maintenance' && (
        <>
          <h2>Maintenance tickets</h2>
          <div>
            <input
              placeholder="Room number"
              value={newTicketRoomNumber}
              onChange={e => setNewTicketRoomNumber(e.target.value)}
            />
            <input
              placeholder="Description"
              value={newTicketDesc}
              onChange={e => setNewTicketDesc(e.target.value)}
            />
            <select
              value={newTicketPriority}
              onChange={e => setNewTicketPriority(e.target.value as 'normal' | 'rush')}
            >
              <option value="normal">Normal</option>
              <option value="rush">Rush</option>
            </select>
            <button onClick={createTicket}>Create ticket</button>
          </div>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Room</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td>{t.room_number}</td>
                  <td>{t.description}</td>
                  <td>{t.priority}</td>
                  <td>{t.status}</td>
                  <td>
                    <button onClick={() => updateTicket(t, 'in_progress')}>Start</button>
                    <button onClick={() => updateTicket(t, 'done')}>Done</button>
                    <button onClick={() => deleteTicket(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function HousekeeperView() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = React.useState<HKTask[]>([]);
  const [noteText, setNoteText] = React.useState('');
  const [noteTaskId, setNoteTaskId] = React.useState<number | null>(null);

  const loadTasks = async () => {
    const res = await api.get('/housekeeping/my-tasks');
    setTasks(res.data);
  };

  React.useEffect(() => {
    loadTasks();
  }, []);

  const updateStatus = async (taskId: number, status: string) => {
    await api.post('/housekeeping/update-status', { taskId, status });
    await loadTasks();
  };

  const openNote = (taskId: number) => {
    setNoteTaskId(taskId);
    setNoteText('');
  };

  const saveNote = async () => {
    if (!noteTaskId || !noteText) return;
    await api.post('/housekeeping/note', {
      taskId: noteTaskId,
      text: noteText
    });
    setNoteTaskId(null);
    setNoteText('');
    await loadTasks();
  };

  return (
    <div style={{ padding: 20 }}>
      <div>
        <strong>User:</strong> {user?.name} ({user?.role}){' '}
        <button onClick={logout}>Logout</button>
      </div>
      <h2>My rooms (today)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Room</th>
            <th>Status</th>
            <th>Checkout time</th>
            <th>Actions</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => {
            const isInspected = t.status === 'inspected';
            const isStayover = t.status === 'stayover';
            return (
              <tr key={t.id}>
                <td>{t.room_number}</td>
                <td>{t.status}</td>
                <td>{t.checkout_time || ''}</td>
                <td>
                  {isInspected ? (
                    <span>Inspected</span>
                  ) : isStayover ? (
                    <span>Stayover</span>
                  ) : (
                    <>
                      <button onClick={() => updateStatus(t.id, 'dirty')}>Dirty</button>
                      <button onClick={() => updateStatus(t.id, 'cleaning')}>Cleaning</button>
                      <button onClick={() => updateStatus(t.id, 'ready_for_inspection')}>
                        Ready for inspection
                      </button>
                    </>
                  )}
                </td>
                <td>
                  <button onClick={() => openNote(t.id)}>Add note</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {noteTaskId && (
        <div style={{ marginTop: 10 }}>
          <h3>Add note for task {noteTaskId}</h3>
          <textarea
            rows={3}
            cols={40}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
          />
          <div>
            <button onClick={saveNote}>Save note</button>
            <button onClick={() => setNoteTaskId(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenanceView() {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);

  const loadTickets = async () => {
    const res = await api.get('/maintenance/my');
    setTickets(res.data);
  };

  React.useEffect(() => {
    loadTickets();
  }, []);

  const updateTicket = async (ticket: Ticket, status: string) => {
    await api.post('/maintenance/update', {
      ticketId: ticket.id,
      status
    });
    await loadTickets();
  };

  return (
    <div style={{ padding: 20 }}>
      <div>
        <strong>User:</strong> {user?.name} ({user?.role}){' '}
        <button onClick={logout}>Logout</button>
      </div>
      <h2>My maintenance tickets</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Room</th>
            <th>Description</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => (
            <tr key={t.id}>
              <td>{t.room_number}</td>
              <td>{t.description}</td>
              <td>{t.priority}</td>
              <td>{t.status}</td>
              <td>
                <button onClick={() => updateTicket(t, 'in_progress')}>Start</button>
                <button onClick={() => updateTicket(t, 'done')}>Done</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Head HK view: can use board + own rooms via tabs
function HeadHKView() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'board' | 'my-rooms'>('board');

  return (
    <div>
      <div style={{ padding: 10 }}>
        <strong>User:</strong> {user?.name} ({user?.role}){' '}
        <button onClick={logout}>Logout</button>
      </div>
      <div style={{ padding: 10 }}>
        <button onClick={() => setTab('board')}>Board</button>
        <button onClick={() => setTab('my-rooms')}>My rooms</button>
      </div>
      {tab === 'board' && <ManagerHeadHKBoardCore user={user} logout={logout} />}
      {tab === 'my-rooms' && <HousekeeperView />}
    </div>
  );
}

const App: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Login />;
  }

  if (user.role === 'housekeeper') {
    return <HousekeeperView />;
  }

  if (user.role === 'maintenance') {
    return <MaintenanceView />;
  }

  if (user.role === 'headhousekeeper') {
    return <HeadHKView />;
  }

  // manager uses the same core board
  return <ManagerHeadHKBoardCore user={user} logout={logout} />;
};

export default App;
