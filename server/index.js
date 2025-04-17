require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const VAPID_PUBLIC_KEY = 'BPhJLEvjafw9mcDxsqpEwmIgxs6GIN8HP5aomtu9dW3KNgIdkZem1yvjbZe629GpklxkoVL1Nv7Pe0LqMs0DPAM';
const VAPID_PRIVATE_KEY = '2UdBnqiVhKRHrCv7q92umdL2NNWdkGHrRg6QXpHnt64';
const VAPID_EMAIL = 'your@email.com';

webPush.setVapidDetails(
  `mailto:${VAPID_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Подписки + актуальные активные задачи
let subscriptions = [];

function plural(n, forms) {
  return forms[
    (n % 10 === 1 && n % 100 !== 11)
      ? 0
      : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20))
        ? 1
        : 2
  ];
}

// Пуш каждые 10 секунд
setInterval(() => {
  if (subscriptions.length === 0) return;

  subscriptions.forEach(({ subscription, tasks }) => {
    const active = tasks.filter(t => !t.completed);
    if (active.length === 0) return;

    const count = active.length;
    const payload = JSON.stringify({
      title: 'Напоминание о задачах',
      body: `У вас ${count} активн${plural(count, ['ая задача', 'ые задачи', 'ых задач'])}`,
      icon: '/icons/pen.png',
      url: '/'
    });

    webPush.sendNotification(subscription, payload).catch(err => {
      console.error('Ошибка отправки уведомления:', err.message);
    });
  });
}, 10 * 1000); // каждые 10 сек

// Подписка
app.post('/subscribe', (req, res) => {
  const { subscription, activeTasks } = req.body;

  const exists = subscriptions.find(s => s.subscription.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push({ subscription, tasks: activeTasks });
    console.log('Добавлена подписка:', subscription.endpoint);
  } else {
    exists.tasks = activeTasks;
  }

  res.status(201).json({});
});

// Обновление задач
app.post('/update-tasks', (req, res) => {
  const { subscription, activeTasks } = req.body;
  const found = subscriptions.find(s => s.subscription.endpoint === subscription.endpoint);
  if (found) {
    found.tasks = activeTasks;
    console.log('Обновлены задачи для подписки:', subscription.endpoint);
  }
  res.sendStatus(200);
});

// Отписка
app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  const before = subscriptions.length;
  subscriptions = subscriptions.filter(s => s.subscription.endpoint !== endpoint);
  const after = subscriptions.length;

  if (before !== after) {
    console.log('Удалена подписка:', endpoint);
  } else {
    console.log('Подписка не найдена для удаления:', endpoint);
  }

  res.sendStatus(200);
});

// Ручное пуш-уведомление
app.post('/send-notification', (req, res) => {
  const { title, body } = req.body;

  const payload = JSON.stringify({
    title: title || 'Тестовое уведомление',
    body: body || 'Это тестовое сообщение',
    icon: '/icons/pen.png',
    url: '/'
  });

  const results = [];
  const promises = subscriptions.map(sub =>
    webPush.sendNotification(sub.subscription, payload)
      .then(() => results.push({ status: 'success', endpoint: sub.subscription.endpoint }))
      .catch(err => {
        console.error('Ошибка отправки:', err.message);
        results.push({ status: 'error', endpoint: sub.subscription.endpoint, error: err.message });
      })
  );

  Promise.all(promises)
    .then(() => res.json({ results }))
    .catch(err => res.status(500).json({ error: err.message }));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
