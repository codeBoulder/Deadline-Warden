import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import Auth from './Auth'; 
import { auth, db } from './firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, addDoc, 
  updateDoc, doc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';

// --- Допоміжні функції ---
const getPrioLabel = (p) => {
  if (p === 'high') return '🔥';
  if (p === 'medium') return '⚡';
  return '☕';
};

const getTimeInfo = (deadlineString, estimatedHours) => {
  const diffMs = new Date(deadlineString).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffMs <= 0) return { text: 'Час вийшов', class: 'status-red', warning: false };
  const warning = estimatedHours && diffHours < estimatedHours;

  if (diffHours < 24) return { text: `${Math.floor(diffHours)} год`, class: 'status-yellow', warning };
  return { text: `${Math.floor(diffHours / 24)} дн`, class: 'status-green', warning };
};

const formatDate = (iso) => {
  return new Date(iso).toLocaleString('uk-UA', { 
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
  });
};

// --- Основний компонент App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pomodoro, setPomodoro] = useState({ active: false, task: null, timeLeft: 25 * 60, isRunning: false });

  // 🌙 Темна тема (зберігається в localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Авторизація та завантаження завдань
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setTasks([]); return; }
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // 🔔 Push-сповіщення (за 1 годину до дедлайну)
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      tasksRef.current.forEach(task => {
        if (task.status !== 'done' && !task.notified) {
          const diffHours = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
          if (diffHours > 0 && diffHours <= 1) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏳ Дедлайн близько!", {
                body: `Завдання "${task.subject}" потрібно здати менш ніж за годину!`,
                icon: 'https://cdn-icons-png.flaticon.com/512/1000/1000300.png'
              });
              updateTask(task.id, { notified: true }); // Щоб не спамити
            }
          }
        }
      });
    }, 60000); // Перевірка кожну хвилину
    return () => clearInterval(interval);
  }, []);

  // Таймер Pomodoro
  useEffect(() => {
    let interval;
    if (pomodoro.active && pomodoro.isRunning && pomodoro.timeLeft > 0) {
      interval = setInterval(() => setPomodoro(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 })), 1000);
    } else if (pomodoro.timeLeft === 0) {
      alert(`Час вийшов! Ви добре попрацювали над: ${pomodoro.task.subject}`);
      setPomodoro(prev => ({ ...prev, isRunning: false }));
    }
    return () => clearInterval(interval);
  }, [pomodoro]);

  const addTask = async (newTask) => {
    if (!user) return setIsAuthModalOpen(true);
    await addDoc(collection(db, "tasks"), { ...newTask, userId: user.uid, createdAt: serverTimestamp(), notified: false });
    setActiveSection('dashboard');
  };

  const updateTask = async (id, data) => await updateDoc(doc(db, "tasks", id), data);
  const deleteTask = async (id) => {
    if (window.confirm('Видалити назавжди?')) await deleteDoc(doc(db, "tasks", id));
  };
  const startPomodoro = (task) => setPomodoro({ active: true, task, timeLeft: 25 * 60, isRunning: true });

  return (
    <>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <div className="app-shell">
        
        {/* Сайдбар */}
        <aside className="sidebar" style={{ transform: isSidebarOpen ? 'translateX(0)' : '' }}>
          <div className="sidebar-logo"><span className="logo-icon">⏳</span><span className="logo-text">Deadline<strong>Warden</strong></span></div>
          
          <nav className="sidebar-nav">
            <button className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}><span className="nav-icon">🏠</span> Dashboard</button>
            <button className={`nav-link ${activeSection === 'kanban' ? 'active' : ''}`} onClick={() => setActiveSection('kanban')}><span className="nav-icon">📋</span> Канбан-дошка</button>
            <button className={`nav-link ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}><span className="nav-icon">📅</span> Календар</button>
            <button className={`nav-link ${activeSection === 'archive' ? 'active' : ''}`} onClick={() => setActiveSection('archive')}><span className="nav-icon">📦</span> Архів</button>
          </nav>

          <div className="sidebar-footer">
            <button className="nav-link toggle-theme-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
              <span className="nav-icon">{isDarkMode ? '☀️' : '🌙'}</span> {isDarkMode ? 'Світла тема' : 'Темна тема'}
            </button>
            <div className="user-status">
              <div className="status-dot" style={{ background: user ? 'var(--green)' : '#94a3b8' }}></div>
              <span>{user ? `${tasks.filter(t => t.status !== 'done').length} активних` : 'Гість'}</span>
            </div>
            {user ? (
              <button onClick={() => signOut(auth)} className="btn-logout-simple">🚪 Вийти</button>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="btn-login-sidebar">👤 Увійти</button>
            )}
          </div>
        </aside>

        {/* Контент */}
        <main className="main-content">
          {activeSection === 'dashboard' && <Dashboard tasks={tasks} addTask={addTask} updateTask={updateTask} user={user} onRequireAuth={() => setIsAuthModalOpen(true)} startPomodoro={startPomodoro} />}
          {activeSection === 'kanban' && <KanbanBoard tasks={tasks} updateTask={updateTask} startPomodoro={startPomodoro} />}
          {activeSection === 'calendar' && <CalendarView tasks={tasks} />}
          {activeSection === 'archive' && <Archive tasks={tasks} updateTask={updateTask} deleteTask={deleteTask} />}
        </main>
      </div>

      {pomodoro.active && (
        <div className="pomodoro-widget">
          <div className="pomo-header"><span>🍅 {pomodoro.task.subject}</span><button onClick={() => setPomodoro({ active: false })} className="pomo-close">✖</button></div>
          <div className="pomo-time">{String(Math.floor(pomodoro.timeLeft / 60)).padStart(2, '0')}:{String(pomodoro.timeLeft % 60).padStart(2, '0')}</div>
          <div className="pomo-controls">
            <button onClick={() => setPomodoro(p => ({ ...p, isRunning: !p.isRunning }))}>{pomodoro.isRunning ? '⏸ Пауза' : '▶ Старт'}</button>
            <button onClick={() => setPomodoro(p => ({ ...p, timeLeft: 25 * 60, isRunning: false }))}>⏹ Скинути</button>
          </div>
        </div>
      )}
      {isAuthModalOpen && <Auth onClose={() => setIsAuthModalOpen(false)} />}
    </>
  );
}

// --- Dashboard ---
function Dashboard({ tasks, addTask, updateTask, user, onRequireAuth, startPomodoro }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasksList, setSubtasksList] = useState([]);

  const activeTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in-progress').sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasksList([...subtasksList, { id: Date.now(), text: subtaskInput, isDone: false }]);
    setSubtaskInput('');
  };

  const handleAddTask = () => {
    if (!user) return onRequireAuth();
    if (!subject.trim() || !deadline) return alert('Заповніть предмет та дату!');
    
    addTask({
      subject: subject.trim(),
      description: description.trim(),
      attachment: attachment.trim(),
      priority,
      deadline,
      estimatedHours: parseFloat(estimatedHours) || 0,
      subtasks: subtasksList,
      status: 'todo'
    });
    setSubject(''); setDescription(''); setAttachment(''); setDeadline(''); setEstimatedHours(''); setSubtasksList([]);
  };

  return (
    <section className="section active">
      <div className="page-header"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Ваш центр керування часом</p></div></div>

      <div className="card form-card">
        <h2 className="card-title">➕ Нове завдання</h2>
        <div className="form-grid">
          <div className="field"><label>Предмет / Назва</label><input type="text" value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="field"><label>Дедлайн</label><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
          <div className="field"><label>Оцінка часу (год)</label><input type="number" min="0.5" step="0.5" placeholder="Напр: 4" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} /></div>
          <div className="field"><label>Посилання (Матеріали)</label><input type="url" placeholder="https://docs.google.com/..." value={attachment} onChange={e => setAttachment(e.target.value)} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Детальний опис / Умови / Формули</label>
            <textarea className="textarea-field" rows="3" placeholder="Вимоги викладача, нотатки..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        
        <div className="subtasks-creator">
          <label className="field-label">Підзадачі (Чекліст)</label>
          <div className="subtask-input-group">
            <input type="text" placeholder="Додати крок..." value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubtask()} />
            <button onClick={handleAddSubtask} className="btn-secondary">Додати</button>
          </div>
          <ul className="subtasks-preview">{subtasksList.map((st, i) => <li key={i}>🔹 {st.text}</li>)}</ul>
        </div>
        <button className="btn-primary mt-3" onClick={handleAddTask}>Створити завдання</button>
      </div>

      <div className="tasks-grid">
        {activeTasks.map(task => <TaskCardItem key={task.id} task={task} updateTask={updateTask} startPomodoro={startPomodoro} />)}
      </div>
    </section>
  );
}

// --- Картка завдання (З підтримкою розширення) ---
function TaskCardItem({ task, updateTask, startPomodoro }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timeInfo = getTimeInfo(task.deadline, task.estimatedHours);
  
  const doneSubtasks = task.subtasks?.filter(s => s.isDone).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const progress = totalSubtasks === 0 ? 0 : Math.round((doneSubtasks / totalSubtasks) * 100);

  const toggleSubtask = (subtaskId) => {
    const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isDone: !st.isDone } : st);
    updateTask(task.id, { subtasks: newSubtasks });
  };

  const isLongDesc = task.description && task.description.length > 80;
  const displayDesc = isExpanded ? task.description : task.description?.slice(0, 80) + (isLongDesc && !isExpanded ? '...' : '');

  return (
    <div className={`task-card ${timeInfo.class}`}>
      <div className="task-card-top">
        <span className={`badge-prio prio-${task.priority}`}>{getPrioLabel(task.priority)}</span>
        <h3 className="task-subject">{task.subject}</h3>
        
        {task.description && (
          <div className="task-description">
            {displayDesc}
            {isLongDesc && (
              <button className="btn-link" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? 'Згорнути' : 'Читати далі'}
              </button>
            )}
          </div>
        )}

        {task.attachment && (
          <a href={task.attachment} target="_blank" rel="noreferrer" className="attachment-link">🔗 Відкрити матеріали</a>
        )}

        {timeInfo.warning && <div className="warning-badge">⚠️ Часу менше, ніж оцінено!</div>}
      </div>

      {totalSubtasks > 0 && (
        <div className="task-progress">
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--green)' : 'var(--accent)' }}></div>
          </div>
          <div className="subtasks-list">
            {task.subtasks.map(st => (
              <label key={st.id} className="subtask-item">
                <input type="checkbox" checked={st.isDone} onChange={() => toggleSubtask(st.id)} />
                <span className={st.isDone ? 'st-done' : ''}>{st.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="task-card-bottom">
        <div className="task-timer">{timeInfo.text}</div>
        <button className="btn-pomodoro" onClick={() => startPomodoro(task)}>🍅 Фокус</button>
        <button className="btn-done-circle" title="Позначити виконаним" onClick={() => updateTask(task.id, { status: 'done' })}>✓</button>
      </div>
    </div>
  );
}

// --- KanbanBoard (Без змін, адаптується під тему) ---
function KanbanBoard({ tasks, updateTask, startPomodoro }) {
  const columns = [{ id: 'todo', title: '⏳ Треба зробити' }, { id: 'in-progress', title: '🔥 В процесі' }, { id: 'done', title: '✅ Виконано' }];
  const handleDrop = (e, status) => updateTask(e.dataTransfer.getData('taskId'), { status });

  return (
    <section className="section active">
      <div className="page-header"><h1 className="page-title">Канбан-дошка</h1></div>
      <div className="kanban-board">
        {columns.map(col => (
          <div key={col.id} className="kanban-column" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.id)}>
            <h3 className="kanban-col-title">{col.title}</h3>
            <div className="kanban-col-content">
              {tasks.filter(t => t.status === col.id).map(task => (
                <div key={task.id} className="kanban-card" draggable onDragStart={e => e.dataTransfer.setData('taskId', task.id)}>
                  <h4>{task.subject}</h4>
                  <div className="kanban-card-actions mt-2">
                    <span className="kanban-date">{formatDate(task.deadline).split(',')[0]}</span>
                    {col.id !== 'done' && <button className="btn-icon" onClick={() => startPomodoro(task)}>🍅</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- CalendarView (Без змін, адаптується під тему) ---
function CalendarView({ tasks }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const emptyDays = firstDay === 0 ? 6 : firstDay - 1; 
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <section className="section active">
      <div className="page-header calendar-header">
        <h1 className="page-title">Календар Дедлайнів</h1>
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>◀</button>
          <h2>{currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>▶</button>
        </div>
      </div>
      <div className="calendar-grid">
        {['Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => <div key={d} className="cal-day-header">{d}</div>)}
        {Array.from({ length: emptyDays }).map((_, i) => <div key={`empty-${i}`} className="cal-day empty"></div>)}
        {daysArray.map(day => {
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasks.filter(t => t.deadline.startsWith(dateStr));
          return (
            <div key={day} className={`cal-day ${dayTasks.length > 0 ? 'has-tasks' : ''}`}>
              <span className="day-num">{day}</span>
              <div className="cal-tasks">{dayTasks.map(t => <div key={t.id} className={`cal-task-chip prio-${t.priority}`}>{t.subject}</div>)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- Оновлений красивий Архів ---
function Archive({ tasks, updateTask, deleteTask }) {
  const archiveTasks = tasks.filter(t => t.status === 'done' || t.status === 'overdue');

  return (
    <section className="section active">
      <div className="page-header"><h1 className="page-title">Архів</h1><p className="page-subtitle">Виконані та пропущені завдання</p></div>
      
      {archiveTasks.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '3rem' }}>🍃</span><p>Архів порожній</p>
        </div>
      ) : (
        <div className="archive-grid">
          {archiveTasks.map(task => (
            <div key={task.id} className={`archive-card ${task.status}`}>
              <div className="archive-header">
                <span className={`archive-badge ${task.status}`}>{task.status === 'done' ? '✅ Виконано' : '❌ Прострочено'}</span>
                <span className="archive-date">{formatDate(task.deadline).split(',')[0]}</span>
              </div>
              <h3 style={{ marginBottom: '8px' }}>{task.subject}</h3>
              {task.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{task.description.slice(0, 50)}...</p>}
              
              <div className="archive-actions">
                <button className="btn-restore" onClick={() => updateTask(task.id, { status: 'todo' })}>🔄 Відновити</button>
                <button className="btn-delete-forever" onClick={() => deleteTask(task.id)}>🗑 Видалити</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}