import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import Auth from './Auth'; 
import { auth, db } from './firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';

// --- Допоміжні функції ---
const getPrioLabel = (p) => {
  if (p === 'high') return '🔥';
  if (p === 'medium') return '⚡';
  return '☕';
};

const getTimeInfo = (deadlineString) => {
  const diff = new Date(deadlineString).getTime() - Date.now();
  if (diff <= 0) return { text: 'Час вийшов', class: 'status-red', isUrgent: false };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return { text: `${hours} год`, class: 'status-yellow', isUrgent: true };
  return { text: `${Math.floor(hours / 24)} дн`, class: 'status-green', isUrgent: false };
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

  // 1. Слідкуємо за станом авторизації
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Отримуємо завдання з Firestore (тільки для поточного юзера)
  useEffect(() => {
    if (!user) {
      setTasks([]); // Якщо вийшов — очищуємо список
      return;
    }

    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(tasksData);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Перевірка прострочених завдань раз на хвилину
  useEffect(() => {
    const interval = setInterval(() => {
      tasks.forEach(async (task) => {
        if (task.status === 'active' && new Date(task.deadline).getTime() < Date.now()) {
          const taskRef = doc(db, "tasks", task.id);
          await updateDoc(taskRef, { status: 'overdue' });
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Операції з БД
  const addTask = async (newTask) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      await addDoc(collection(db, "tasks"), {
        ...newTask,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setActiveSection('dashboard');
    } catch (e) {
      console.error("Помилка додавання:", e);
    }
  };

  const markAsDone = async (id) => {
    const taskRef = doc(db, "tasks", id);
    await updateDoc(taskRef, { status: 'done' });
  };

  const deleteTask = async (id) => {
    if (window.confirm('Видалити назавжди?')) {
      await deleteDoc(doc(db, "tasks", id));
    }
  };

  const handleLogout = () => signOut(auth);

  const activeTasksCount = tasks.filter(t => t.status === 'active').length;

  return (
    <>
      {/* Мобільний хедер */}
      <div className="mobile-header">
        <div className="logo-wrap">
          <span className="logo-icon">⏳</span>
          <span className="logo-text">Deadline<strong>Warden</strong></span>
        </div>
        <button className="burger-btn" onClick={() => setIsSidebarOpen(true)}>
          <span></span><span></span><span></span>
        </button>
      </div>

      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <div className="app-shell">
        {/* Сайдбар */}
        <aside className="sidebar" style={{ transform: isSidebarOpen ? 'translateX(0)' : '' }}>
          <div className="sidebar-logo">
            <span className="logo-icon">⏳</span>
            <span className="logo-text">Deadline<strong>Warden</strong></span>
          </div>

          <nav className="sidebar-nav">
            <button className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveSection('dashboard'); setIsSidebarOpen(false); }}>
              <span className="nav-icon">🏠</span> Dashboard
            </button>
            <button className={`nav-link ${activeSection === 'archive' ? 'active' : ''}`} onClick={() => { setActiveSection('archive'); setIsSidebarOpen(false); }}>
              <span className="nav-icon">📦</span> Архів
            </button>
            <button className={`nav-link ${activeSection === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveSection('analytics'); setIsSidebarOpen(false); }}>
              <span className="nav-icon">📊</span> Аналітика
            </button>
          </nav>

          <div className="sidebar-footer" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '15px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div className="status-dot" style={{background: user ? 'var(--green)' : '#94a3b8'}}></div>
              <span>{user ? `${activeTasksCount} активних` : 'Гість'}</span>
            </div>
            
            {user ? (
              <button onClick={handleLogout} className="btn-logout-simple">
                🚪 Вийти з акаунту
              </button>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="btn-login-sidebar">
                👤 Увійти / Реєстрація
              </button>
            )}
          </div>
        </aside>

        {/* Основний контент */}
        <main className="main-content">
          {activeSection === 'dashboard' && (
            <Dashboard 
              tasks={tasks} 
              addTask={addTask} 
              markAsDone={markAsDone} 
              user={user}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          )}
          {activeSection === 'archive' && <Archive tasks={tasks} deleteTask={deleteTask} />}
          {activeSection === 'analytics' && <Analytics tasks={tasks} />}
        </main>
      </div>

      {/* Модалка авторизації */}
      {isAuthModalOpen && <Auth onClose={() => setIsAuthModalOpen(false)} />}
    </>
  );
}

// --- Компонент Dashboard ---
function Dashboard({ tasks, addTask, markAsDone, user, onRequireAuth }) {
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');

  const uniqueSubjects = useMemo(() => [...new Set(tasks.map(t => t.subject))], [tasks]);

  const activeTasks = tasks.filter(t => t.status === 'active');
  const filteredTasks = useMemo(() => {
    return activeTasks.filter(t => {
      const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) || 
                          t.topic.toLowerCase().includes(search.toLowerCase());
      const matchSubj = filterSubject === 'all' || t.subject === filterSubject;
      const matchPrio = filterPriority === 'all' || t.priority === filterPriority;
      return matchSearch && matchSubj && matchPrio;
    }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, [activeTasks, search, filterSubject, filterPriority]);

  const urgentCount = filteredTasks.filter(t => getTimeInfo(t.deadline).isUrgent).length;

  const handleAddTask = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!subject.trim() || !deadline) {
      alert('Заповніть предмет та дату!');
      return;
    }
    addTask({
      subject: subject.trim(),
      topic: topic.trim() || 'Без опису',
      priority,
      deadline,
      status: 'active'
    });
    setSubject(''); setTopic(''); setDeadline(''); setPriority('medium');
  };

  return (
    <section className="section active">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Твої актуальні завдання та дедлайни</p>
        </div>
        <div className="header-stats">
          <div className="stat-chip" id="stat-urgent">
            <span className="chip-num">{urgentCount}</span>
            <span className="chip-label">Критичних</span>
          </div>
          <div className="stat-chip" id="stat-total">
            <span className="chip-num">{activeTasks.length}</span>
            <span className="chip-label">Всього</span>
          </div>
        </div>
      </div>

      {/* Панель інструментів */}
      <div className="card toolbar-card">
        <div className="toolbar-grid">
          <div className="search-box">
            <input type="text" placeholder="🔍 Пошук..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filters-group">
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
              <option value="all">Усі предмети</option>
              {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="all">Будь-який пріоритет</option>
              <option value="high">🔥 Високий</option>
              <option value="medium">⚡ Середній</option>
              <option value="low">☕ Низький</option>
            </select>
          </div>
        </div>
      </div>

      {/* Форма додавання */}
      <div className="card form-card">
        <h2 className="card-title">➕ Нове завдання</h2>
        <div className="form-grid">
          <div className="field">
            <label>Предмет</label>
            <input type="text" placeholder="Напр: Алгоритми" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Тема</label>
            <input type="text" placeholder="Напр: Лабораторна №4" value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="field">
            <label>Пріоритет</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">☕ Низький</option>
              <option value="medium">⚡ Середній</option>
              <option value="high">🔥 Високий</option>
            </select>
          </div>
          <div className="field">
            <label>Дедлайн</label>
            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={handleAddTask}>
          {user ? 'Створити дедлайн' : 'Увійдіть, щоб додати'}
        </button>
      </div>

      {/* Список карток */}
      <div className="tasks-header">
        <h2 className="section-heading">Активні завдання</h2>
        <span className="task-count-badge">{filteredTasks.length}</span>
      </div>

      <div className="tasks-grid">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">Поки що немає завдань ☕</div>
        ) : (
          filteredTasks.map(task => {
            const timeInfo = getTimeInfo(task.deadline);
            return (
              <div key={task.id} className={`task-card ${timeInfo.class}`}>
                <div className="task-card-top">
                  <span className={`badge-prio prio-${task.priority}`}>{getPrioLabel(task.priority)}</span>
                  <h3 className="task-subject">{task.subject}</h3>
                  <p className="task-topic">{task.topic}</p>
                </div>
                <div className="task-timer">{timeInfo.text}</div>
                <div className="task-card-bottom">
                  <span className="task-deadline-text">{formatDate(task.deadline)}</span>
                  <button className="btn-done-circle" onClick={() => markAsDone(task.id)}>✓</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// --- Компонент Archive ---
function Archive({ tasks, deleteTask }) {
  const archiveTasks = tasks.filter(t => t.status !== 'active');

  return (
    <section className="section active">
      <div className="page-header">
        <h1 className="page-title">Архів</h1>
        <p className="page-subtitle">Історія виконаних та пропущених робіт</p>
      </div>
      <div className="archive-list">
        {archiveTasks.length === 0 ? <p className="empty-state">Архів порожній</p> : archiveTasks.map(task => (
          <div key={task.id} className="archive-item">
            <div className="archive-item-info">
              <div className="archive-subject">{task.subject} <small>- {task.topic}</small></div>
              <div className="archive-meta">{formatDate(task.deadline)}</div>
            </div>
            <span className={`archive-status ${task.status}`}>
              {task.status === 'done' ? 'Виконано' : 'Пропущено'}
            </span>
            <button className="btn-delete" onClick={() => deleteTask(task.id)}>✖</button>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Компонент Analytics ---
function Analytics({ tasks }) {
  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    active: tasks.filter(t => t.status === 'active').length
  };

  const subjectsMap = {};
  tasks.forEach(t => { subjectsMap[t.subject] = (subjectsMap[t.subject] || 0) + 1; });
  const subjectsArray = Object.entries(subjectsMap).sort((a, b) => b[1] - a[1]);
  const maxTasks = subjectsArray.length > 0 ? subjectsArray[0][1] : 1;

  return (
    <section className="section active">
      <div className="page-header">
        <h1 className="page-title">Аналітика</h1>
        <p className="page-subtitle">Статистика твоєї успішності</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card accent-blue">
          <div className="analytics-num">{stats.total}</div>
          <div className="analytics-label">Створено</div>
        </div>
        <div className="analytics-card accent-green">
          <div className="analytics-num">{stats.done}</div>
          <div className="analytics-label">Виконано</div>
        </div>
        <div className="analytics-card accent-red">
          <div className="analytics-num">{stats.overdue}</div>
          <div className="analytics-label">Прострочено</div>
        </div>
        <div className="analytics-card accent-yellow">
          <div className="analytics-num">{stats.active}</div>
          <div className="analytics-label">В роботі</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '28px' }}>
        <h2 className="card-title">Навантаження за предметами</h2>
        <div className="subjects-table">
          {subjectsArray.length === 0 ? <p className="empty-state">Немає даних</p> : subjectsArray.map(([subject, count]) => (
            <div key={subject} className="subject-row">
              <span className="subject-name">{subject}</span>
              <div className="subject-bar-wrap">
                <div className="subject-bar" style={{ width: `${(count / maxTasks) * 100}%` }}></div>
              </div>
              <span className="subject-count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}