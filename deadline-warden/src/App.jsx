import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import Auth from './Auth'; 
import { auth, db } from './firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, addDoc, 
  updateDoc, doc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';

const Icon = ({ name, className = '', filled = false }) => (
  <span className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}>
    {name}
  </span>
);

const getPrioIcon = (p) => {
  if (p === 'high') return 'local_fire_department';
  if (p === 'medium') return 'bolt';
  return 'coffee';
};

const getPrioText = (p) => {
  if (p === 'high') return 'Високий';
  if (p === 'medium') return 'Середній';
  return 'Низький';
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

export default function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pomodoro, setPomodoro] = useState({ active: false, task: null, timeLeft: 25 * 60, isRunning: false });
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
              new Notification("Дедлайн близько!", {
                body: `Завдання "${task.subject}" потрібно здати менш ніж за годину!`,
              });
              updateTask(task.id, { notified: true }); 
            }
          }
        }
      });
    }, 60000); 
    return () => clearInterval(interval);
  }, []);

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
    <div className="app-shell">
      <button className="mobile-nav-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        <Icon name={isSidebarOpen ? "close" : "menu"} />
      </button>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <aside className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon"><Icon name="hourglass_bottom" /></div>
          <span className="logo-text">Deadline<strong>Warden</strong></span>
        </div>
        
        <nav className="sidebar-nav">
          <button className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => {setActiveSection('dashboard'); setIsSidebarOpen(false);}}>
            <Icon name="space_dashboard" className="nav-icon" /> Dashboard
          </button>
          <button className={`nav-link ${activeSection === 'kanban' ? 'active' : ''}`} onClick={() => {setActiveSection('kanban'); setIsSidebarOpen(false);}}>
            <Icon name="view_kanban" className="nav-icon" /> Канбан-дошка
          </button>
          <button className={`nav-link ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => {setActiveSection('calendar'); setIsSidebarOpen(false);}}>
            <Icon name="calendar_month" className="nav-icon" /> Календар
          </button>
          <button className={`nav-link ${activeSection === 'archive' ? 'active' : ''}`} onClick={() => {setActiveSection('archive'); setIsSidebarOpen(false);}}>
            <Icon name="archive" className="nav-icon" /> Архів
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-link toggle-theme-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
            <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="nav-icon" /> {isDarkMode ? 'Світла тема' : 'Темна тема'}
          </button>
          <div className="user-status">
            <div className="status-dot" style={{ background: user ? 'var(--success)' : 'var(--text-secondary)' }}></div>
            <span>{user ? `${tasks.filter(t => t.status !== 'done').length} активних завдань` : 'Режим Гостя'}</span>
          </div>
          {user ? (
            <button onClick={() => signOut(auth)} className="btn-logout-simple"><Icon name="logout"/> Вийти</button>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="btn-login-sidebar"><Icon name="login"/> Увійти</button>
          )}
        </div>
      </aside>

      <main className="main-content">
        {activeSection === 'dashboard' && <Dashboard tasks={tasks} addTask={addTask} updateTask={updateTask} user={user} onRequireAuth={() => setIsAuthModalOpen(true)} startPomodoro={startPomodoro} />}
        {activeSection === 'kanban' && <KanbanBoard tasks={tasks} updateTask={updateTask} startPomodoro={startPomodoro} />}
        {activeSection === 'calendar' && <CalendarView tasks={tasks} />}
        {activeSection === 'archive' && <Archive tasks={tasks} updateTask={updateTask} deleteTask={deleteTask} />}
      </main>

      {pomodoro.active && (
        <div className="pomodoro-widget">
          <div className="pomo-header">
            <span><Icon name="timer" /> {pomodoro.task.subject}</span>
            <button onClick={() => setPomodoro({ active: false })} className="pomo-close"><Icon name="close" /></button>
          </div>
          <div className="pomo-time">
            {String(Math.floor(pomodoro.timeLeft / 60)).padStart(2, '0')}:{String(pomodoro.timeLeft % 60).padStart(2, '0')}
          </div>
          <div className="pomo-controls">
            <button onClick={() => setPomodoro(p => ({ ...p, isRunning: !p.isRunning }))}>
              <Icon name={pomodoro.isRunning ? "pause" : "play_arrow"} /> {pomodoro.isRunning ? 'Пауза' : 'Старт'}
            </button>
            <button onClick={() => setPomodoro(p => ({ ...p, timeLeft: 25 * 60, isRunning: false }))}>
              <Icon name="replay" /> Скинути
            </button>
          </div>
        </div>
      )}
      {isAuthModalOpen && <Auth onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}

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
    setSubject('');
    setDescription('');
    setAttachment('');
    setDeadline('');
    setEstimatedHours('');
    setSubtasksList([]);
  };

  return (
    <section className="section active">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Ваш центр керування часом та дедлайнами.</p>
      </div>

      <div className="card form-card">
        <h2 className="card-title"><Icon name="add_circle" /> Створити нове завдання</h2>
        <div className="form-grid">
          <div className="field">
            <label>Предмет / Назва</label>
            <input type="text" placeholder="Назва завдання..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Пріоритет</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="high">Високий</option>
              <option value="medium">Середній</option>
              <option value="low">Низький</option>
            </select>
          </div>
          <div className="field">
            <label>Дедлайн</label>
            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <div className="field">
            <label>Оцінка часу (год)</label>
            <input type="number" min="0.5" step="0.5" placeholder="Напр: 4" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} />
          </div>
          <div className="field">
            <label>Посилання (Матеріали)</label>
            <input type="url" placeholder="https://docs.google.com/..." value={attachment} onChange={e => setAttachment(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Детальний опис / Умови</label>
            <textarea className="textarea-field" placeholder="Вимоги викладача, нотатки..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        
        <div className="subtasks-creator">
          <label className="field-label">Підзадачі (Чекліст)</label>
          <div className="subtask-input-group">
            <input type="text" placeholder="Додати крок..." value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubtask()} />
            <button onClick={handleAddSubtask} className="btn-secondary">Додати крок</button>
          </div>
          {subtasksList.length > 0 && (
            <ul className="subtasks-preview">
              {subtasksList.map((st, i) => <li key={i}><Icon name="check_box_outline_blank" className="text-muted"/> {st.text}</li>)}
            </ul>
          )}
        </div>
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={handleAddTask}><Icon name="add" /> Створити завдання</button>
        </div>
      </div>

      <div className="tasks-grid">
        {activeTasks.map(task => <TaskCardItem key={task.id} task={task} updateTask={updateTask} startPomodoro={startPomodoro} />)}
      </div>
    </section>
  );
}

function TaskCardItem({ task, updateTask, startPomodoro }) {
  const timeInfo = getTimeInfo(task.deadline, task.estimatedHours);
  const doneSubtasks = task.subtasks?.filter(s => s.isDone).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const progress = totalSubtasks === 0 ? 0 : Math.round((doneSubtasks / totalSubtasks) * 100);

  const toggleSubtask = (subtaskId) => {
    const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isDone: !st.isDone } : st);
    updateTask(task.id, { subtasks: newSubtasks });
  };

  return (
    <div className={`task-card prio-${task.priority}`}>
      <div className="task-card-top">
        <div className="badge-wrapper">
          <span className={`badge-prio prio-${task.priority}`}>
            <Icon name={getPrioIcon(task.priority)} /> {getPrioText(task.priority)}
          </span>
          {task.attachment && (
            <a href={task.attachment} target="_blank" rel="noreferrer" className="attachment-link">
              <Icon name="link" /> Матеріали
            </a>
          )}
        </div>
        
        <h3 className="task-subject">{task.subject}</h3>
        
        {task.description && (
          <div className="task-description">{task.description.length > 100 ? task.description.slice(0, 100) + '...' : task.description}</div>
        )}
      </div>

      {totalSubtasks > 0 && (
        <div className="task-progress">
          <div className="progress-header"><span>Прогрес виконання</span><span>{progress}%</span></div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
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
        <div className={`task-timer ${timeInfo.class}`}>
          <Icon name="schedule" /> {timeInfo.text}
        </div>
        <div className="task-actions">
          <button className="btn-pomodoro" title="Запустити таймер фокусу" onClick={() => startPomodoro(task)}>
            <Icon name="timer" />
          </button>
          <button className="btn-done-circle" title="Позначити виконаним" onClick={() => updateTask(task.id, { status: 'done' })}>
            <Icon name="done" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({ tasks, updateTask, startPomodoro }) {
  const columns = [
    { id: 'todo', title: 'Треба зробити', icon: 'format_list_bulleted' }, 
    { id: 'in-progress', title: 'В процесі', icon: 'trending_up' }, 
    { id: 'done', title: 'Виконано', icon: 'task_alt' }
  ];
  const handleDrop = (e, status) => updateTask(e.dataTransfer.getData('taskId'), { status });

  return (
    <section className="section active">
      <div className="page-header"><h1 className="page-title">Канбан-дошка</h1></div>
      <div className="kanban-board">
        {columns.map(col => (
          <div key={col.id} className="kanban-column" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.id)}>
            <h3 className="kanban-col-title"><Icon name={col.icon} /> {col.title}</h3>
            <div className="kanban-col-content">
              {tasks.filter(t => t.status === col.id).map(task => (
                <div key={task.id} className="kanban-card" draggable onDragStart={e => e.dataTransfer.setData('taskId', task.id)}>
                  <h4>{task.subject}</h4>
                  <div className="kanban-card-actions">
                    <span className="kanban-date"><Icon name="event" /> {formatDate(task.deadline).split(',')[0]}</span>
                    {col.id !== 'done' && <button className="btn-secondary" style={{padding: '6px 10px'}} onClick={() => startPomodoro(task)}><Icon name="timer" /></button>}
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

function CalendarView({ tasks }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const emptyDays = firstDay === 0 ? 6 : firstDay - 1; 
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <section className="section active">
      <div className="calendar-header">
        <h1 className="page-title">Календар</h1>
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}><Icon name="chevron_left" /></button>
          <h2>{currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}><Icon name="chevron_right" /></button>
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

function Archive({ tasks, updateTask, deleteTask }) {
  const archiveTasks = tasks.filter(t => t.status === 'done' || t.status === 'overdue');

  return (
    <section className="section active">
      <div className="page-header">
        <h1 className="page-title">Архів</h1>
        <p className="page-subtitle">Історія виконаних та пропущених завдань</p>
      </div>
      
      {archiveTasks.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>
          <Icon name="inbox" style={{ fontSize: '4rem', opacity: 0.5, marginBottom: '16px' }} />
          <h3>Архів порожній</h3>
        </div>
      ) : (
        <div className="archive-grid">
          {archiveTasks.map(task => (
            <div key={task.id} className="archive-card">
              <div className="archive-header">
                <span className={`archive-badge ${task.status}`}>
                  <Icon name={task.status === 'done' ? 'check_circle' : 'cancel'} /> 
                  {task.status === 'done' ? 'Виконано' : 'Прострочено'}
                </span>
                <span className="archive-date">{formatDate(task.deadline).split(',')[0]}</span>
              </div>
              <h3 style={{ marginBottom: '12px', fontSize: '1.2rem' }}>{task.subject}</h3>
              
              <div className="archive-actions">
                <button className="btn-restore" onClick={() => updateTask(task.id, { status: 'todo' })}><Icon name="restore" /> Відновити</button>
                <button className="btn-delete-forever" onClick={() => deleteTask(task.id)}><Icon name="delete" /> Видалити</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}