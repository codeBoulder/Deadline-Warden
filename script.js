document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // СТАН ДОДАТКУ (STATE)
  // ==========================================
  let tasks = JSON.parse(localStorage.getItem('dw_tasks')) || [];

  // ==========================================
  // DOM ЕЛЕМЕНТИ
  // ==========================================
  const DOM = {
    // Навігація
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.section'),
    burgerBtn: document.getElementById('burger-btn'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('sidebar-overlay'),
    
    // Форма
    form: document.getElementById('task-form') || document.querySelector('.form-card'),
    subject: document.getElementById('f-subject'),
    topic: document.getElementById('f-topic'),
    type: document.getElementById('f-type'),
    deadline: document.getElementById('f-deadline'),
    btnAdd: document.getElementById('btn-add'),
    
    // Списки
    tasksList: document.getElementById('tasks-list'),
    archiveList: document.getElementById('archive-list'),
    
    // Лічильники та бейджі
    activeCountSidebar: document.getElementById('sidebar-active-count'),
    chipUrgent: document.getElementById('chip-urgent'),
    chipTotal: document.getElementById('chip-total'),
    taskCountBadge: document.getElementById('task-count-badge'),
    
    // Аналітика
    anTotal: document.getElementById('an-total'),
    anDone: document.getElementById('an-done'),
    anOverdue: document.getElementById('an-overdue'),
    anActive: document.getElementById('an-active'),
    anSubjectsTable: document.getElementById('an-subjects-table')
  };

  // ==========================================
  // ІНІЦІАЛІЗАЦІЯ
  // ==========================================
  init();

  function init() {
    setupNavigation();
    setupForm();
    checkOverdueTasks();
    renderAll();
    
    // Перевірка прострочених завдань кожну хвилину
    setInterval(() => {
      checkOverdueTasks();
      renderDashboard();
    }, 60000);
  }

  // ==========================================
  // НАВІГАЦІЯ ТА МОБІЛЬНЕ МЕНЮ
  // ==========================================
  function setupNavigation() {
    DOM.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Оновлення активного лінку
        DOM.navLinks.forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Перемикання секцій
        const targetId = e.currentTarget.dataset.section;
        DOM.sections.forEach(sec => {
          sec.classList.remove('active');
          if (sec.id === targetId) sec.classList.add('active');
        });

        closeMobileMenu();
      });
    });

    DOM.burgerBtn?.addEventListener('click', () => {
      DOM.sidebar.style.transform = 'translateX(0)';
      DOM.overlay.classList.add('active');
    });

    DOM.overlay?.addEventListener('click', closeMobileMenu);
  }

  function closeMobileMenu() {
    if (window.innerWidth <= 768) {
      DOM.sidebar.style.transform = 'translateX(-100%)';
      DOM.overlay.classList.remove('active');
    }
  }

  // ==========================================
  // ЛОГІКА ЗАВДАНЬ
  // ==========================================
  function setupForm() {
    const submitHandler = (e) => {
      e.preventDefault();
      
      const subject = DOM.subject.value.trim();
      const topic = DOM.topic.value.trim();
      const type = DOM.type.value.trim();
      const deadline = DOM.deadline.value;

      if (!subject || !deadline) {
        alert('Будь ласка, заповніть хоча б Предмет та Дедлайн.');
        return;
      }

      const newTask = {
        id: Date.now().toString(),
        subject,
        topic,
        type: type || 'Завдання',
        deadline,
        status: 'active', // active, done, overdue
        createdAt: new Date().toISOString()
      };

      tasks.push(newTask);
      saveTasks();
      
      // Очищення форми
      if (DOM.form.tagName === 'FORM') DOM.form.reset();
      else {
        DOM.subject.value = ''; DOM.topic.value = '';
        DOM.type.value = ''; DOM.deadline.value = '';
      }

      renderAll();
    };

    if (DOM.form.tagName === 'FORM') {
      DOM.form.addEventListener('submit', submitHandler);
    } else {
      DOM.btnAdd.addEventListener('click', submitHandler);
    }
  }

  function saveTasks() {
    localStorage.setItem('dw_tasks', JSON.stringify(tasks));
  }

  function checkOverdueTasks() {
    let changed = false;
    const now = new Date().getTime();
    
    tasks.forEach(task => {
      if (task.status === 'active' && new Date(task.deadline).getTime() < now) {
        task.status = 'overdue';
        changed = true;
      }
    });
    
    if (changed) {
      saveTasks();
      renderAll();
    }
  }

  window.markAsDone = function(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.status = 'done';
      saveTasks();
      renderAll();
    }
  };

  window.deleteTask = function(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderAll();
  };

  // ==========================================
  // ДОПОМІЖНІ ФУНКЦІЇ ЧАСУ
  // ==========================================
  function getTimeInfo(deadlineString) {
    const now = new Date().getTime();
    const deadline = new Date(deadlineString).getTime();
    const diff = deadline - now;

    if (diff <= 0) return { text: 'Прострочено', class: 'status-red', isUrgent: false };

    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const daysLeft = Math.floor(hoursLeft / 24);

    if (hoursLeft < 24) {
      return { text: `${hoursLeft} год`, class: 'status-yellow', isUrgent: true };
    }
    return { text: `${daysLeft} дн`, class: 'status-green', isUrgent: false };
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ==========================================
  // РЕНДЕР ИНТЕРФЕЙСУ
  // ==========================================
  function renderAll() {
    renderDashboard();
    renderArchive();
    renderAnalytics();
  }

  function renderDashboard() {
    const activeTasks = tasks.filter(t => t.status === 'active');
    
    // Сортування за найближчим дедлайном
    activeTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    let urgentCount = 0;
    DOM.tasksList.innerHTML = '';

    if (activeTasks.length === 0) {
      DOM.tasksList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">☕</div>
          <p>Немає активних завдань. Можна відпочити!</p>
        </div>`;
    } else {
      activeTasks.forEach(task => {
        const timeInfo = getTimeInfo(task.deadline);
        if (timeInfo.isUrgent) urgentCount++;

        DOM.tasksList.innerHTML += `
          <div class="task-card ${timeInfo.class}">
            <div class="task-card-top">
              <div>
                <h3 class="task-subject">${task.subject}</h3>
                <p class="task-topic">${task.topic}</p>
              </div>
              <span class="task-type-badge">${task.type}</span>
            </div>
            <div class="task-timer">${timeInfo.text}</div>
            <div class="task-card-bottom">
              <span class="task-deadline-text">${formatDate(task.deadline)}</span>
              <button class="btn-done" onclick="markAsDone('${task.id}')">✓ Виконано</button>
            </div>
          </div>
        `;
      });
    }

    // Оновлення лічильників Dashboard
    DOM.taskCountBadge.textContent = activeTasks.length;
    DOM.chipTotal.textContent = activeTasks.length;
    DOM.chipUrgent.textContent = urgentCount;
    DOM.activeCountSidebar.textContent = `${activeTasks.length} активних`;
  }

  function renderArchive() {
    const archiveTasks = tasks.filter(t => t.status !== 'active');
    
    // Найновіші зверху
    archiveTasks.sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
    
    DOM.archiveList.innerHTML = '';

    if (archiveTasks.length === 0) {
      DOM.archiveList.innerHTML = `
        <div class="empty-state">
          <p>Архів порожній.</p>
        </div>`;
      return;
    }

    archiveTasks.forEach(task => {
      const isDone = task.status === 'done';
      const statusClass = isDone ? 'done' : 'overdue';
      const statusText = isDone ? 'Виконано' : 'Прострочено';

      DOM.archiveList.innerHTML += `
        <div class="archive-item">
          <div class="archive-item-info">
            <h3 class="archive-subject">${task.subject} <span style="font-weight:400; font-size:0.85rem">(${task.type})</span></h3>
            <p class="archive-meta">${task.topic} • ${formatDate(task.deadline)}</p>
          </div>
          <span class="archive-status ${statusClass}">${statusText}</span>
          <button class="btn-delete" title="Видалити назавжди" onclick="deleteTask('${task.id}')">✖</button>
        </div>
      `;
    });
  }

  function renderAnalytics() {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => t.status === 'overdue').length;
    const active = tasks.filter(t => t.status === 'active').length;

    DOM.anTotal.textContent = total;
    DOM.anDone.textContent = done;
    DOM.anOverdue.textContent = overdue;
    DOM.anActive.textContent = active;

    // Збір статистики по предметах
    const subjectsCount = {};
    tasks.forEach(t => {
      subjectsCount[t.subject] = (subjectsCount[t.subject] || 0) + 1;
    });

    DOM.anSubjectsTable.innerHTML = '';
    
    if (Object.keys(subjectsCount).length === 0) {
      DOM.anSubjectsTable.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem">Немає даних для відображення.</p>';
      return;
    }

    // Сортування предметів за кількістю (спадання)
    const sortedSubjects = Object.entries(subjectsCount).sort((a, b) => b[1] - a[1]);
    const maxCount = sortedSubjects[0][1]; // Для обчислення % ширини прогрес-бару

    sortedSubjects.forEach(([subj, count]) => {
      const percentage = (count / maxCount) * 100;
      DOM.anSubjectsTable.innerHTML += `
        <div class="subject-row">
          <div class="subject-name" title="${subj}">${subj}</div>
          <div class="subject-bar-wrap">
            <div class="subject-bar" style="width: ${percentage}%"></div>
          </div>
          <div class="subject-count">${count}</div>
        </div>
      `;
    });
  }
});