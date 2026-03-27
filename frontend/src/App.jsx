import { useState, useEffect, useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    }
  }
});

const API_URL = import.meta.env.VITE_API_URL;
const OFFLINE_KEY = 'tareas_offline_queue';

function TaskApp({ signOut, user }) {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [notification, setNotification] = useState(null);

  // ── Notificación flotante ─────────────────────────────────────────
  const showNotif = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Cola offline (localStorage) ───────────────────────────────────
  const getQueue = () => JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  const saveQueue = (q) => localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));

  const enqueueOffline = (action) => {
    const q = getQueue();
    q.push({ ...action, id: crypto.randomUUID() });
    saveQueue(q);
  };

  // ── Sincronizar cola al recuperar conexión ────────────────────────
  const syncQueue = useCallback(async () => {
    const q = getQueue();
    if (q.length === 0) return;
    setSyncing(true);
    const failed = [];
    for (const action of q) {
      try {
        if (action.type === 'ADD') {
          await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: action.title }),
          });
        } else if (action.type === 'DELETE') {
          await fetch(`${API_URL}/tasks/${action.taskId}`, { method: 'DELETE' });
        }
      } catch {
        failed.push(action);
      }
    }
    saveQueue(failed);
    setSyncing(false);
    if (failed.length === 0) {
      showNotif(`✅ ${q.length} tarea(s) sincronizada(s)`, 'success');
      fetchTasks();
    }
  }, []);

  // ── Detectar cambios de conexión ──────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showNotif('🌐 Conexión restaurada. Sincronizando...', 'success');
      syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showNotif('📴 Sin conexión. Las tareas se guardarán localmente.', 'warning');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  // ── Carga inicial ─────────────────────────────────────────────────
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch {
      showNotif('No se pudo cargar la lista', 'error');
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  // ── Agregar tarea ─────────────────────────────────────────────────
  const addTask = async () => {
    const title = newTask.trim();
    if (!title) return;

    // Optimistic UI: agrega localmente de inmediato
    const tempId = crypto.randomUUID();
    setTasks(prev => [...prev, { id: tempId, title, _pending: true }]);
    setNewTask('');

    if (!isOnline) {
      enqueueOffline({ type: 'ADD', title });
      showNotif('💾 Guardado localmente (sin conexión)', 'warning');
      return;
    }

    try {
      await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      fetchTasks();
    } catch {
      enqueueOffline({ type: 'ADD', title });
      showNotif('💾 Sin respuesta del servidor. Guardado localmente.', 'warning');
    }
  };

  // ── Tecla Enter ───────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addTask();
  };

  // ── Eliminar tarea ────────────────────────────────────────────────
  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));

    if (!isOnline) {
      enqueueOffline({ type: 'DELETE', taskId: id });
      showNotif('💾 Eliminación guardada localmente', 'warning');
      return;
    }

    try {
      await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch {
      enqueueOffline({ type: 'DELETE', taskId: id });
    }
  };

  const pendingCount = getQueue().length;

  return (
    <main className="private-view">
      {/* Banner de estado de conexión */}
      <div className={`status-bar ${isOnline ? 'online' : 'offline'}`}>
        <span className="status-dot" />
        {isOnline
          ? syncing ? '🔄 Sincronizando...' : '🌐 En línea'
          : '📴 Sin conexión'}
        {pendingCount > 0 && (
          <span className="pending-badge">{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Notificación flotante */}
      {notification && (
        <div className={`notification notif-${notification.type}`}>
          {notification.msg}
        </div>
      )}

      <div className="panel-header">
        <div className="avatar">{user.username[0].toUpperCase()}</div>
        <div>
          <h2>Panel de Control</h2>
          <p className="username-label">{user.username}</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="form">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué nueva tarea tienes por hacer?"
          autoFocus
        />
        <button className="add-btn" onClick={addTask}>
          + Agregar
        </button>
      </div>

      {/* Lista de tareas */}
      <ul>
        {tasks.length === 0 && (
          <li className="empty-state">🎉 No hay tareas pendientes</li>
        )}
        {tasks.map(task => (
          <li key={task.id} className={task._pending ? 'task-item pending' : 'task-item'}>
            <span className="task-title">{task.title}</span>
            {task._pending && <span className="sync-icon">⏳</span>}
            <button className="delete-btn" onClick={() => deleteTask(task.id)}>✕</button>
          </li>
        ))}
      </ul>

      <button className="signout-btn" onClick={signOut}>
        Cerrar Sesión
      </button>
    </main>
  );
}

function App() {
  return (
    <div className="container">
      <h1>✅ Gestor de Tareas</h1>
      <Authenticator>
        {({ signOut, user }) => (
          <TaskApp signOut={signOut} user={user} />
        )}
      </Authenticator>
    </div>
  );
}

export default App;