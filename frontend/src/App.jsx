import { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

// Configuración de Cognito
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    }
  }
});

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  // 1. Vista Pública: Cargar tareas (GET)
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (err) { console.error("Error cargando:", err); }
  };

  useEffect(() => { fetchTasks(); }, []);

  // 2. Funciones CRUD (Solo para Vista Privada)
  const addTask = async () => {
    if (!newTask) return;
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: newTask }),
    });
    setNewTask('');
    fetchTasks();
  };

  const deleteTask = async (id) => {
    await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  return (
    <div className="container">
      <h1>Gestor de Tareas Fullstack</h1>

      {/* --- VISTA PÚBLICA --- */}
      <section className="public-view">
        <h2>Lista Global (Pública)</h2>
        <ul>
          {tasks.map(task => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      </section>

      <hr />

      {/* --- VISTA PRIVADA (PROTEGIDA) --- */}
      <Authenticator>
        {({ signOut, user }) => (
          <main className="private-view">
            <h2>Panel CRUD - Hola, {user.username}</h2>
            <div className="form">
              <input 
                value={newTask} 
                onChange={(e) => setNewTask(e.target.value)} 
                placeholder="Nueva tarea..." 
              />
              <button onClick={addTask}>Agregar</button>
            </div>

            <ul>
              {tasks.map(task => (
                <li key={task.id}>
                  {task.title} 
                  <button className="delete-btn" onClick={() => deleteTask(task.id)}>Eliminar</button>
                </li>
              ))}
            </ul>
            <button className="signout-btn" onClick={signOut}>Cerrar Sesión</button>
          </main>
        )}
      </Authenticator>
    </div>
  );
}

export default App;