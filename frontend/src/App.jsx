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

  // Cargar tareas desde AWS
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (err) { console.error("Error cargando:", err); }
  };

  useEffect(() => { fetchTasks(); }, []);

  // Agregar nueva tarea
  const addTask = async () => {
    if (!newTask) return;
    try {
      await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // <-- MUY IMPORTANTE PARA DYNAMODB
        body: JSON.stringify({ title: newTask }),
      });
      setNewTask(''); // Limpia el cuadro de texto
      fetchTasks();   // Recarga la lista automáticamente
    } catch (err) { console.error("Error agregando:", err); }
  };

  // Eliminar tarea
  const deleteTask = async (id) => {
    try {
      await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
      fetchTasks(); // Recarga la lista automáticamente
    } catch (err) { console.error("Error eliminando:", err); }
  };

  return (
    <div className="container">
      <h1>Gestor de Tareas Fullstack</h1>

      {/* --- EL LOGIN DE COGNITO --- */}
      <Authenticator>
        {({ signOut, user }) => (
          <main className="private-view">
            <h2>Panel de Control - ¡Hola, {user.username}!</h2>

            <div className="form">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="¿Qué nueva tarea tienes por hacer?"
              />
              <button onClick={addTask}>Agregar</button>
            </div>

            <ul>
              {tasks.map(task => (
                <li key={task.id}>
                  <span>{task.title}</span>
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