import React, { useState, useEffect, useMemo } from 'react';
import './index.css'; // Ваш файл зі стилями

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
  return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};


export default function App() {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('dw_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('dw_tasks', JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    const checkOverdue = () => {
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.status === 'active' && new Date(task.deadline).getTime() < Date.now()) {
          return { ...task, status: 'overdue' };
        }
        return task;
      }));
    };
    checkOverdue(); 
    const interval = setInterval(checkOverdue, 60000);
    return () => clearInterval(interval);
  }, []);

  const addTask = (newTask) => {
    setTasks([...tasks, newTask]);
    setActiveSection('dashboard');
  };

  const markAsDone = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: 'done' } : t));
  };

  const deleteTask = (id) => {
    if (window.confirm('Видалити назавжди?')) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const activeTasksCount = tasks.filter(t => t.status === 'active').length;

  return (
    <>
     
      <div className="mobile-header">
        <div className="logo-wrap">
          <span className="logo-icon">⏳</span>
          <span className="logo-text">Deadline<strong>Warden</strong></span>
        </div>
        <button className="burger-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Меню">
          <span></span><span></span><span></span>
        </button>
      </div>


      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <div className="app-shell">
       
        <aside className="sidebar" style={{ transform: isSidebarOpen ? 'translateX(0)' : '' }}>
          <div className="sidebar-logo">
            <span className="logo-icon">⏳</span>
            <span className="logo-text">Deadline<strong>Warden</strong></span>
          </div>

          <nav className="sidebar-nav">
            <a href="#" className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSection('dashboard'); setIsSidebarOpen(false); }}>
              <span className="nav-icon">🏠</span> Dashboard
            </a>
            <a href="#" className={`nav-link ${activeSection === 'archive' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSection('archive'); setIsSidebarOpen(false); }}>
              <span className="nav-icon">📦</span> Архів
            </a>
            <a href="#" className={`nav-link ${activeSection === 'analytics' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSection('analytics'); setIsSidebarOpen(false); }}>
              <span className="nav-icon">📊</span> Аналітика
            </a>
          </nav>

          <div className="sidebar-footer">
            <div className="status-dot"></div>
            <span>{activeTasksCount} активних</span>
          </div>
        </aside>

        <main className="main-content">
          {activeSection === 'dashboard' && <Dashboard tasks={tasks} addTask={addTask} markAsDone={markAsDone} />}
          {activeSection === 'archive' && <Archive tasks={tasks} deleteTask={deleteTask} />}
          {activeSection === 'analytics' && <Analytics tasks={tasks} />}
        </main>
      </div>
    </>
  );
}


function Dashboard({ tasks, addTask, markAsDone }) {
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');

  const uniqueSubjects = useMemo(() => {
    return [...new Set(tasks.map(t => t.subject))];
  }, [tasks]);

  const activeTasks = tasks.filter(t => t.status === 'active');
  const filteredTasks = useMemo(() => {
    return activeTasks.filter(t => {
      const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) || t.topic.toLowerCase().includes(search.toLowerCase());
      const matchSubj = filterSubject === 'all' || t.subject === filterSubject;
      const matchPrio = filterPriority === 'all' || t.priority === filterPriority;
      return matchSearch && matchSubj && matchPrio;
    }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, [activeTasks, search, filterSubject, filterPriority]);

  const urgentCount = filteredTasks.filter(t => getTimeInfo(t.deadline).isUrgent).length;

  const handleAddTask = () => {
    if (!subject.trim() || !deadline) {
      alert('Заповніть предмет та дату!');
      return;
    }
    addTask({
      id: Date.now().toString(),
      subject: subject.trim(),
      topic: topic.trim() || 'Без опису',
      priority,
      deadline,
      status: 'active',
      createdAt: new Date().toISOString()
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

      <div className="card toolbar-card">
        <div className="toolbar-grid">
          <div className="search-box">
            <input type="text" placeholder="🔍 Пошук за темою або предметом..." value={search} onChange={e => setSearch(e.target.value)} />
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
        <button className="btn-primary" onClick={handleAddTask}>Створити дедлайн</button>
      </div>

      <div className="tasks-header">
        <h2 className="section-heading">Активні завдання</h2>
        <span className="task-count-badge">{filteredTasks.length}</span>
      </div>

      <div className="tasks-grid">
        {filteredTasks.length === 0 ? (
          <div className="empty-state" style={{gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-muted)'}}>Нічого не знайдено ☕</div>
        ) : (
          filteredTasks.map(task => {
            const timeInfo = getTimeInfo(task.deadline);
            return (
              <div key={task.id} className={`task-card ${timeInfo.class}`}>
                <div className="task-card-top">
                  <div>
                    <span className={`badge-prio prio-${task.priority}`}>{getPrioLabel(task.priority)}</span>
                    <h3 className="task-subject">{task.subject}</h3>
                    <p className="task-topic">{task.topic}</p>
                  </div>
                </div>
                <div className="task-timer">{timeInfo.text}</div>
                <div className="task-card-bottom" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span className="task-deadline-text" style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{formatDate(task.deadline)}</span>
                  <button className="btn-done" onClick={() => markAsDone(task.id)} style={{background: 'var(--green-light)', color: 'var(--green)', border: 'none', borderRadius: '50%', width: '30px', height: '30px'}}>✓</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Archive({ tasks, deleteTask }) {
  const archiveTasks = tasks.filter(t => t.status !== 'active');

  return (
    <section className="section active">
      <div className="page-header">
        <h1 className="page-title">Архів</h1>
        <p className="page-subtitle">Історія виконаних та пропущених робіт</p>
      </div>
      <div className="archive-list">
        {archiveTasks.length === 0 ? <p>Архів порожній</p> : archiveTasks.map(task => (
          <div key={task.id} className="archive-item">
            <div className="archive-item-info">
              <div className="archive-subject">{task.subject} <span style={{fontWeight: 'normal', color: 'var(--text-muted)'}}>- {task.topic}</span></div>
              <div className="archive-meta">{formatDate(task.deadline)}</div>
            </div>
            <span className={`archive-status ${task.status}`}>{task.status === 'done' ? 'Виконано' : 'Пропущено'}</span>
            <button className="btn-delete" onClick={() => deleteTask(task.id)}>✖</button>
          </div>
        ))}
      </div>
    </section>
  );
}


function Analytics({ tasks }) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const overdue = tasks.filter(t => t.status === 'overdue').length;
  const active = tasks.filter(t => t.status === 'active').length;

  const subjectsMap = {};
  tasks.forEach(t => {
    subjectsMap[t.subject] = (subjectsMap[t.subject] || 0) + 1;
  });
  
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
          <div className="analytics-num">{total}</div>
          <div className="analytics-label">Створено</div>
        </div>
        <div className="analytics-card accent-green">
          <div className="analytics-num">{done}</div>
          <div className="analytics-label">Виконано</div>
        </div>
        <div className="analytics-card accent-red">
          <div className="analytics-num">{overdue}</div>
          <div className="analytics-label">Прострочено</div>
        </div>
        <div className="analytics-card accent-yellow">
          <div className="analytics-num">{active}</div>
          <div className="analytics-label">В роботі</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '28px' }}>
        <h2 className="card-title">Розподіл навантаження</h2>
        <div className="subjects-table">
          {subjectsArray.length === 0 ? <p style={{color: 'var(--text-muted)'}}>Немає даних</p> : subjectsArray.map(([subject, count]) => (
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