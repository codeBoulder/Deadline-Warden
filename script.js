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
    
    // Форма додавання
    subject: document.getElementById('f-subject'),
    topic: document.getElementById('f-topic'),
    priority: document.getElementById('f-priority'),
    deadline: document.getElementById('f-deadline'),
    btnAdd: document.getElementById('btn-add'),
    
    // Фільтри та пошук
    searchInput: document.getElementById('search-input'),
    filterSubj: document.getElementById('filter-subject'),
    filterPrio: document.getElementById('filter-priority'),
    
    // Списки та лічильники
    tasksList: document.getElementById('tasks-list'),
    archiveList: document.getElementById('archive-list'),
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
    setupEventListeners();
    checkOverdueTasks();
    renderAll();
    
    // Перевірка дедлайнів кожну хвилину
    setInterval(() => {
      checkOverdueTasks();
      renderDashboard();
    }, 60000);
  }

  // ==========================================
  // СЛУХАЧІ ПОДІЙ
  // ==========================================
  function setupEventListeners() {
    // Додавання завдання
    DOM.btnAdd.addEventListener('click', addTask);

    // Фільтрація та пошук (подія 'input' спрацьовує миттєво)
    [DOM.searchInput, DOM.filterSubj, DOM.filterPrio].forEach(el => {
      el.addEventListener('input', renderDashboard);
    });

    // Мобільне меню
    DOM.burgerBtn?.addEventListener('click', openMobileMenu);
    DOM.overlay?.addEventListener('click', closeMobileMenu);
  }

  function setupNavigation() {
    DOM.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.currentTarget.dataset.section;
        
        DOM.navLinks.forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        DOM.sections.forEach(sec => {
          sec.classList.toggle('active', sec.id === targetId);
        });

        closeMobileMenu();
      });
    });
  }

  // ==========================================
  // ЛОГІКА ЗАВДАНЬ
  // ==========================================
  function addTask() {
    const subject = DOM.subject.value.trim();
    const topic = DOM.topic.value.trim();
    const priority = DOM.priority.value;
    const deadline = DOM.deadline.value;

    if (!subject || !deadline) {
      alert('Заповніть предмет та дату!');
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      subject,
      topic: topic || 'Без опису',
      priority,
      deadline,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    saveAndSync();
    
    // Очищення полів
    DOM.subject.value = ''; DOM.topic.value = ''; DOM.deadline.value = '';
    
    // Перехід на головну після додавання
    document.querySelector('[data-section="dashboard"]').click();
  }

  function saveAndSync() {
    localStorage.setItem('dw_tasks', JSON.stringify(tasks));
    updateSubjectFilterOptions();
    renderAll();
  }

  function checkOverdueTasks() {
    const now = new Date().getTime();
    tasks.forEach(task => {
      if (task.status === 'active' && new Date(task.deadline).getTime() < now) {
        task.status = 'overdue';
      }
    });
    localStorage.setItem('dw_tasks', JSON.stringify(tasks));
  }

  window.markAsDone = (id) => {
    const task = tasks.find(t => t.id === id);
    if (task) task.status = 'done';
    saveAndSync();
  };

  window.deleteTask = (id) => {
    if(confirm('Видалити назавжди?')) {
      tasks = tasks.filter(t => t.id !== id);
      saveAndSync();
    }
  };

  // ==========================================
  // РЕНДЕРИНГ
  // ==========================================
  function renderDashboard() {
    let filtered = tasks.filter(t => t.status === 'active');

    // 1. Пошук
    const query = DOM.searchInput.value.toLowerCase();
    if (query) {
      filtered = filtered.filter(t => 
        t.subject.toLowerCase().includes(query) || 
        t.topic.toLowerCase().includes(query)
      );
    }

    // 2. Фільтр за предметом
    const subjVal = DOM.filterSubj.value;
    if (subjVal !== 'all') {
      filtered = filtered.filter(t => t.subject === subjVal);
    }

    // 3. Фільтр за пріоритетом
    const prioVal = DOM.filterPrio.value;
    if (prioVal !== 'all') {
      filtered = filtered.filter(t => t.priority === prioVal);
    }

    // Сортування: спочатку найближчі дедлайни
    filtered.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    DOM.tasksList.innerHTML = '';
    let urgentCount = 0;

    if (filtered.length === 0) {
      DOM.tasksList.innerHTML = `<div class="empty-state">Нічого не знайдено ☕</div>`;
    } else {
      filtered.forEach(task => {
        const timeInfo = getTimeInfo(task.deadline);
        if (timeInfo.isUrgent) urgentCount++;

        DOM.tasksList.innerHTML += `
          <div class="task-card ${timeInfo.class}">
            <div class="task-card-top">
              <div>
                <span class="badge-prio prio-${task.priority}">${getPrioLabel(task.priority)}</span>
                <h3 class="task-subject">${task.subject}</h3>
                <p class="task-topic">${task.topic}</p>
              </div>
            </div>
            <div class="task-timer">${timeInfo.text}</div>
            <div class="task-card-bottom">
              <span class="task-deadline-text">${formatDate(task.deadline)}</span>
              <button class="btn-done" onclick="markAsDone('${task.id}')">✓</button>
            </div>
          </div>
        `;
      });
    }

    // Оновлення цифр
    DOM.taskCountBadge.textContent = filtered.length;
    DOM.chipTotal.textContent = tasks.filter(t => t.status === 'active').length;
    DOM.chipUrgent.textContent = urgentCount;
    DOM.activeCountSidebar.textContent = `${DOM.chipTotal.textContent} активних`;
  }

  function updateSubjectFilterOptions() {
    const subjects = [...new Set(tasks.map(t => t.subject))];
    const current = DOM.filterSubj.value;
    
    let html = '<option value="all">Усі предмети</option>';
    subjects.forEach(s => {
      html += `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`;
    });
    DOM.filterSubj.innerHTML = html;
  }

  // Інші функції (formatDate, getTimeInfo, renderAnalytics) залишаються аналогічними до вашої бази, 
  // але з додаванням обробки пріоритетів в аналітиці за бажанням.

  function getPrioLabel(p) {
    if (p === 'high') return '🔥';
    if (p === 'medium') return '⚡';
    return '☕';
  }

  function getTimeInfo(deadlineString) {
    const diff = new Date(deadlineString).getTime() - new Date().getTime();
    if (diff <= 0) return { text: 'Час вийшов', class: 'status-red', isUrgent: false };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return { text: `${hours} год`, class: 'status-yellow', isUrgent: true };
    return { text: `${Math.floor(hours/24)} дн`, class: 'status-green', isUrgent: false };
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function renderAll() {
    renderDashboard();
    renderArchive();
    renderAnalytics();
  }

  // (renderArchive та renderAnalytics можна залишити без змін з вашого коду)

  function openMobileMenu() {
    DOM.sidebar.style.transform = 'translateX(0)';
    DOM.overlay.classList.add('active');
  }

  function closeMobileMenu() {
    if (window.innerWidth <= 768) {
      DOM.sidebar.style.transform = 'translateX(-100%)';
      DOM.overlay.classList.remove('active');
    }
  }

  function renderArchive() {
    const archiveTasks = tasks.filter(t => t.status !== 'active');
    DOM.archiveList.innerHTML = archiveTasks.length ? '' : '<p>Архів порожній</p>';
    archiveTasks.forEach(task => {
      DOM.archiveList.innerHTML += `
        <div class="archive-item">
          <div>
            <strong>${task.subject}</strong> - ${task.topic}
            <div style="font-size:0.7rem">${formatDate(task.deadline)}</div>
          </div>
          <span class="archive-status ${task.status}">${task.status === 'done' ? 'Виконано' : 'Пропущено'}</span>
          <button class="btn-delete" onclick="deleteTask('${task.id}')">✖</button>
        </div>
      `;
    });
  }

  function renderAnalytics() {
    const total = tasks.length;
    DOM.anTotal.textContent = total;
    DOM.anDone.textContent = tasks.filter(t => t.status === 'done').length;
    DOM.anOverdue.textContent = tasks.filter(t => t.status === 'overdue').length;
    DOM.anActive.textContent = tasks.filter(t => t.status === 'active').length;
    // ... логіка таблиці предметів ...
  }
});