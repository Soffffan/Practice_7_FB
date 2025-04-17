const VAPID_PUBLIC_KEY = 'BPhJLEvjafw9mcDxsqpEwmIgxs6GIN8HP5aomtu9dW3KNgIdkZem1yvjbZe629GpklxkoVL1Nv7Pe0LqMs0DPAM';

let tasks = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadTasksFromStorage();
  renderTasks();
  setupUI();
  await registerServiceWorker();
  setupReminders();
}

// Загружаем задачи из localStorage
function loadTasksFromStorage() {
  const stored = localStorage.getItem('tasks');
  if (stored) {
    try {
      tasks = JSON.parse(stored);
      if (!Array.isArray(tasks)) tasks = [];
    } catch {
      tasks = [];
    }
  }
}

// Сохраняем задачи
function saveTasksToStorage() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
  updateTasksOnServer();
}

// Отправка задач на сервер
async function updateTasksOnServer() {
  const activeTasks = tasks.filter(t => !t.completed);

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await fetch('/update-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        activeTasks
      })
    });
  }
}

function setupUI() {
  const input = document.getElementById('note-input');
  const addBtn = document.getElementById('add-note-btn');
  const toggleBtn = document.getElementById('toggle-add-btn');

  addBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;

    const newTask = { text, completed: false };
    tasks.push(newTask);
    saveTasksToStorage();
    input.value = '';
    renderTasks();
    document.getElementById('app').style.display = 'none';

    await sendTaskNotification('Добавлена новая задача', text);
  });

  toggleBtn.addEventListener('click', () => {
    const app = document.getElementById('app');
    app.style.display = app.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('#filters button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  window.addEventListener('online', () => {
    document.getElementById('offline-notice').style.display = 'none';
  });

  window.addEventListener('offline', () => {
    document.getElementById('offline-notice').style.display = 'block';
  });
}

function renderTasks() {
  const container = document.getElementById('notes-container');
  container.innerHTML = '';

  const filtered = tasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });

  filtered.forEach((task, index) => {
    const div = document.createElement('div');
    div.className = 'task';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', async () => {
      tasks[index].completed = !tasks[index].completed;
      saveTasksToStorage();
      renderTasks();

      if (tasks[index].completed) {
        await sendTaskNotification('Задача выполнена', task.text);
      }
    });

    const span = document.createElement('span');
    span.textContent = task.text;
    if (task.completed) span.style.textDecoration = 'line-through';

    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.onclick = () => {
      tasks.splice(index, 1);
      saveTasksToStorage();
      renderTasks();
    };

    div.append(checkbox, span, del);
    container.appendChild(div);
  });
}

async function sendTaskNotification(title, body) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await fetch('/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
  }
}

// Push и Service Worker
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker зарегистрирован');

      const subscription = await reg.pushManager.getSubscription();
      updateUI(subscription);

      document.getElementById('subscribeBtn').addEventListener('click', async () => {
        if (subscription) {
          await unsubscribe(subscription);
          updateUI(null);
        } else {
          const newSub = await subscribe(reg);
          updateUI(newSub);
        }
      });
    } catch (error) {
      console.error('Ошибка SW:', error);
      updateStatus(`Ошибка: ${error.message}`, 'red');
    }
  } else {
    updateStatus('Service Worker не поддерживается', 'red');
    document.getElementById('subscribeBtn').disabled = true;
  }
}

async function subscribe(reg) {
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  await fetch('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, activeTasks: tasks.filter(t => !t.completed) })
  });

  return subscription;
}

async function unsubscribe(subscription) {
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch('/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  });

  console.log('Подписка отменена на клиенте:', endpoint);
}

function updateUI(subscription) {
  const btn = document.getElementById('subscribeBtn');
  if (subscription) {
    btn.textContent = 'Отписаться';
    updateStatus('Подписка активна', 'green');
  } else {
    btn.textContent = 'Подписаться';
    updateStatus('Не подписано', 'gray');
  }
}

function updateStatus(text, color) {
  const el = document.getElementById('status');
  el.textContent = `Статус: ${text}`;
  el.style.color = color;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Локальное напоминание (по желанию)
function setupReminders() {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      setInterval(() => {
        const activeTasks = tasks.filter(t => !t.completed);
        if (activeTasks.length > 0) {
          new Notification('Напоминание!', {
            body: `У вас ${activeTasks.length} невыполненных задач`,
            icon: '/icons/pen.png'
          });
        }
      }, 10 * 1000);
    }
  }
}
