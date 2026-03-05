# TG-CRM — Спецификация проекта

## Обзор
Веб-прокладка для личного Telegram-аккаунта с ручной модерацией клиентов, анонимизацией и CRM-интерфейсом для операторов.

---

## 1. Роли и онбординг

### Super Admin (владелец)
- Первый пользователь системы, создаётся при `/setup`
- Подключает Telegram-аккаунт через MTProto (номер → код → session)
- Имеет доступ ко всему, включая реальные данные клиентов

### Admin
- Создаётся Super Admin'ом
- Модерирует входящие чаты (pending → approved/blocked)
- Управляет операторами (создание, блокировка, назначение)
- Видит реальные данные клиентов (скрыто по умолчанию, раскрывается по клику)
- Назначает клиентов на операторов вручную

### Operator
- Создаётся по инвайт-ссылке от Admin
- Видит ТОЛЬКО псевдонимы клиентов (никаких реальных данных)
- Переписывается с назначенными клиентами
- Ставит теги, добавляет заметки

### Добавление операторов
1. Admin → раздел "Команда" → "Создать инвайт"
2. Генерируется одноразовая ссылка с TTL 48 часов
3. Оператор регистрируется: email + пароль
4. Admin подтверждает и может назначить роль

---

## 2. Архитектура системы

```
[Telegram Personal Account]
         ↓ MTProto (Telethon)
[Python Backend — FastAPI]
    ├── WebSocket Handler (real-time)
    ├── REST API
    ├── Telegram Userbot Listener
    └── Notification Bot (aiogram)
         ↓
[PostgreSQL]
         ↓
[Next.js PWA — CRM Interface]
```

### Деплой
- Docker Compose на VPS (Hetzner CX21 ~5€/мес достаточно для старта)
- Nginx reverse proxy + SSL (Let's Encrypt)
- `.session` файл хранится только на сервере, в .gitignore

---

## 3. База данных — схема

```sql
-- Пользователи системы (операторы/админы)
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  role VARCHAR NOT NULL, -- 'super_admin' | 'admin' | 'operator'
  name VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Telegram-аккаунты подключённые к системе
CREATE TABLE tg_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR UNIQUE NOT NULL,
  session_file VARCHAR NOT NULL, -- путь к .session файлу
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP DEFAULT NOW()
);

-- Клиенты (Telegram пользователи)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_account_id UUID REFERENCES tg_accounts(id),
  
  -- Реальные данные (зашифровано AES-256)
  real_tg_id BIGINT NOT NULL,
  real_name_encrypted TEXT,
  real_username_encrypted TEXT,
  
  -- Публичные данные
  alias VARCHAR NOT NULL UNIQUE, -- псевдоним напр. "Ин-01"
  status VARCHAR DEFAULT 'pending', -- 'pending' | 'approved' | 'blocked'
  
  -- CRM данные
  assigned_to UUID REFERENCES staff(id),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  last_message_at TIMESTAMP
);

-- Сообщения
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  tg_message_id INTEGER, -- ID в Telegram
  direction VARCHAR NOT NULL, -- 'incoming' | 'outgoing'
  content TEXT,
  sent_by UUID REFERENCES staff(id), -- кто отправил (если outgoing)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Теги
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  color VARCHAR DEFAULT '#6366f1',
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Инвайт-ссылки
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR UNIQUE NOT NULL,
  role VARCHAR DEFAULT 'operator',
  created_by UUID REFERENCES staff(id),
  used_by UUID REFERENCES staff(id),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);
```

---

## 4. API Endpoints

### Auth
```
POST /api/auth/login          — вход (email + password → JWT)
POST /api/auth/register       — регистрация по инвайт-токену
POST /api/auth/refresh        — обновить токен
```

### Telegram Account
```
POST /api/tg/connect          — начать подключение (отправить код)
POST /api/tg/verify           — подтвердить код
GET  /api/tg/status           — статус подключения
DELETE /api/tg/disconnect     — отключить аккаунт
```

### Contacts (Clients)
```
GET  /api/contacts            — список (фильтры: status, assigned_to, tag)
GET  /api/contacts/:id        — детали контакта
PATCH /api/contacts/:id       — обновить (alias, tags, notes, assigned_to)
POST /api/contacts/:id/approve — одобрить
POST /api/contacts/:id/block   — заблокировать

# Только для admin+:
GET  /api/contacts/:id/reveal  — раскрыть реальные данные
```

### Messages
```
GET  /api/messages/:contact_id       — история сообщений
POST /api/messages/:contact_id/send  — отправить сообщение
PATCH /api/messages/:id/read         — отметить прочитанным
```

### Staff
```
GET  /api/staff               — список операторов
POST /api/staff/invite        — создать инвайт
PATCH /api/staff/:id          — обновить роль/статус
DELETE /api/staff/:id         — деактивировать
```

### WebSocket
```
WS /ws?token=JWT
  Events:
    → new_message      { contact_id, message }
    → new_pending      { contact_id, alias }
    → contact_approved { contact_id }
    → contact_blocked  { contact_id }
    → typing           { contact_id }
```

---

## 5. Генерация псевдонима

```python
def generate_alias(real_name: str, sequence: int) -> str:
    # "Иван" → первые 2 буквы + порядковый номер
    clean = real_name.strip()
    if not clean:
        return f"User-{sequence:03d}"
    
    prefix = clean[:2] if len(clean) >= 2 else clean
    return f"{prefix}-{sequence:03d}"

# Примеры:
# "Иван Петров" → "Ив-001"
# "Maria"       → "Ma-002"
# ""            → "User-003"
```

Псевдоним можно переименовать вручную в карточке клиента.

---

## 6. Логика Telethon Listener

```python
@client.on(events.NewMessage(incoming=True))
async def handle_incoming(event):
    sender = await event.get_sender()
    tg_id = sender.id
    
    contact = await db.get_contact_by_tg_id(tg_id)
    
    if not contact:
        # Новый пользователь
        alias = generate_alias(sender.first_name, await db.count_contacts())
        contact = await db.create_contact(
            real_tg_id=tg_id,
            real_name=encrypt(sender.first_name),
            real_username=encrypt(sender.username),
            alias=alias,
            status='pending'
        )
        await notify_admin_bot(contact, sender)
    
    elif contact.status == 'blocked':
        return  # игнорируем
    
    # Сохраняем сообщение в любом случае
    await db.save_message(
        contact_id=contact.id,
        tg_message_id=event.message.id,
        direction='incoming',
        content=event.message.text
    )
    
    if contact.status == 'approved':
        # Пушим в WebSocket всем кто смотрит этот чат
        await ws_manager.broadcast_to_chat(contact.id, {
            'type': 'new_message',
            'message': message_to_dict(event.message)
        })
```

---

## 7. Уведомление в Telegram-бот (модерация)

```
📥 Новый клиент

Псевдоним: Ив-001
Имя: Иван Петров
Username: @ivan_test
ID: 123456789
Сообщение: "Привет, хочу узнать про услуги"

[✅ Одобрить]  [❌ Заблокировать]
```

---

## 8. PWA конфигурация

`manifest.json`:
```json
{
  "name": "TG-CRM",
  "short_name": "CRM",
  "display": "standalone",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "start_url": "/",
  "icons": [...]
}
```

Push-уведомления через Web Push API (VAPID ключи на бэкенде).
На iOS — через Safari PWA (ограниченная поддержка, но базово работает).

---

## 9. UX Flow

### Оператор
1. Логин → список назначенных чатов
2. Клик на чат → переписка
3. Видит: псевдоним, теги, заметки, историю с момента одобрения
4. Может: отвечать, добавлять теги, писать заметки

### Admin
1. Логин → дашборд (ожидающие модерации + статистика)
2. Pending-очередь → карточка клиента с реальными данными → Одобрить/Заблокировать
3. После одобрения — назначить на оператора
4. Раздел "Команда" — управление операторами
5. Раздел "Blacklist" — заблокированные контакты

---

## 10. Этапы разработки (с оценками)

| Этап | Описание | Время |
|------|----------|-------|
| 1 | PostgreSQL схема + FastAPI skeleton | 2 дня |
| 2 | Telethon listener + сохранение сообщений | 2 дня |
| 3 | Auth (JWT, роли, инвайты) | 2 дня |
| 4 | Telegram-бот модерации | 1 день |
| 5 | WebSocket real-time | 2 дня |
| 6 | REST API полностью | 3 дня |
| 7 | Next.js CRM интерфейс (MVP) | 5 дней |
| 8 | PWA + push-уведомления | 2 дня |
| 9 | Тестирование + деплой Docker | 2 дня |
| **Итого** | | **~3 недели** |

---

## 11. Стек

| Компонент | Технология |
|-----------|-----------|
| Userbot | Python 3.11 + Telethon |
| Notification Bot | aiogram 3.x |
| API | FastAPI + SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Cache/Sessions | Redis |
| Frontend | Next.js 14 (App Router) + Tailwind |
| Real-time | WebSockets (FastAPI native) |
| Auth | JWT (access 15min + refresh 30days) |
| Encryption | cryptography (Fernet/AES-256) |
| Deploy | Docker Compose + Nginx + Certbot |

---

## 12. Безопасность

- `.session` файл: chmod 600, не в git, бэкап зашифрован
- Реальные данные клиентов: AES-256 в БД
- API: JWT + роль-проверки на каждом эндпоинте
- Операторы физически не получают `real_tg_id` / `real_name` из API
- Rate limiting на API (slowapi)
- CORS whitelist только свой домен
