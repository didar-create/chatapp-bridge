const Pusher = require('pusher-js');
const fetch = require('node-fetch');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const LICENSE_ID   = process.env.LICENSE_ID;
const N8N_WEBHOOK  = process.env.N8N_WEBHOOK_URL;

console.log('🚀 ChatApp Bridge запускается...');
console.log('License ID:', LICENSE_ID);
console.log('N8N Webhook:', N8N_WEBHOOK);

const pusher = new Pusher('ChatsAppApiProdKey', {
  wsHost: 'socket.chatapp.online',
  wssPort: 6001,
  disableStats: true,
  authEndpoint: 'https://api.chatapp.online/broadcasting/auth',
  auth: {
    headers: {
      'Authorization': ACCESS_TOKEN
    }
  },
  enabledTransports: ['ws'],
  forceTLS: true
});

pusher.connection.bind('connected', () => {
  console.log('✅ Подключено к ChatApp WebSocket');
});

pusher.connection.bind('error', (err) => {
  console.error('❌ Ошибка подключения:', err);
});

const channel = pusher.subscribe(`private-v1.licenses.${LICENSE_ID}.messengers.caWhatsApp`);

channel.bind('pusher:subscription_succeeded', () => {
  console.log('✅ Подписка на канал успешна');
});

channel.bind('pusher:subscription_error', (err) => {
  console.error('❌ Ошибка подписки на канал:', err);
});

channel.bind('message', async (data) => {
  try {
    const messages = data.data;
    for (const msg of messages) {
      // Пропускаем исходящие (от бота/оператора)
      if (msg.fromMe) {
        console.log('⏩ Пропускаем исходящее сообщение');
        continue;
      }

      console.log('📨 Входящее сообщение от:', msg.chat?.phone, '| Текст:', msg.message?.text);

      const payload = {
        chatId:   msg.chat?.id,
        phone:    msg.chat?.phone,
        name:     msg.chat?.name,
        text:     msg.message?.text,
        time:     msg.time,
        msgId:    msg.id,
        licenseId: LICENSE_ID
      };

      const response = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('✅ Отправлено в n8n, статус:', response.status);
    }
  } catch (err) {
    console.error('❌ Ошибка при обработке сообщения:', err);
  }
});

// Keepalive чтобы Railway не останавливал процесс
setInterval(() => {
  console.log('💓 Heartbeat — мост работает,', new Date().toISOString());
}, 30000);