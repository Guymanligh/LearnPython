import os
import sqlite3
import json
import firebase_admin
from firebase_admin import credentials, db
from dotenv import load_dotenv

load_dotenv()

# Firebase Config from app.py
firebase_config = {
    "databaseURL": "https://learnpython-79e9a-default-rtdb.asia-southeast1.firebasedatabase.app"
}

try:
    cred = credentials.Certificate(os.environ.get('FIREBASE_SERVICE_ACCOUNT', 'serviceAccountKey.json'))
    firebase_admin.initialize_app(cred, {'databaseURL': firebase_config['databaseURL']})
    print("Успешное подключение к Firebase!")
except Exception as e:
    print(f"Ошибка подключения к Firebase: {e}")
    exit(1)

# SQLite Initialization
DB_PATH = 'app.db'
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Создаем схему
tables = [
    """CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        provider TEXT,
        created_at TEXT,
        verified BOOLEAN,
        verification_code TEXT,
        total_xp INTEGER DEFAULT 0,
        game_xp INTEGER DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS user_lessons (
        uid TEXT,
        lesson_key TEXT,
        completed BOOLEAN,
        score INTEGER,
        total INTEGER,
        percentage REAL,
        completed_at TEXT,
        xp_earned INTEGER,
        max_possible_xp INTEGER,
        PRIMARY KEY (uid, lesson_key),
        FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
    )""",
    """CREATE TABLE IF NOT EXISTS user_levels (
        uid TEXT,
        level_id TEXT,
        completed BOOLEAN,
        xp_earned INTEGER,
        completed_at TEXT,
        PRIMARY KEY (uid, level_id),
        FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
    )""",
    """CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        uid TEXT,
        email TEXT,
        created_at TEXT,
        expires_at TEXT,
        FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
    )""",
    """CREATE TABLE IF NOT EXISTS teachers (
        uid TEXT PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        region TEXT,
        city TEXT,
        school TEXT,
        invite_token TEXT,
        created_at TEXT,
        FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
    )""",
    """CREATE TABLE IF NOT EXISTS teacher_students (
        teacher_uid TEXT,
        student_uid TEXT,
        full_name TEXT,
        region TEXT,
        city TEXT,
        school TEXT,
        class_name TEXT,
        email TEXT,
        joined_at TEXT,
        PRIMARY KEY (teacher_uid, student_uid),
        FOREIGN KEY (teacher_uid) REFERENCES teachers(uid) ON DELETE CASCADE,
        FOREIGN KEY (student_uid) REFERENCES users(uid) ON DELETE CASCADE
    )"""
]

for q in tables:
    cursor.execute(q)
conn.commit()

# Функция для безопасного получения данных
def safe_str(val): return str(val) if val is not None else None
def safe_bool(val): return bool(val) if val is not None else False
def safe_int(val): 
    try: return int(val) 
    except (ValueError, TypeError): return 0
def safe_float(val): 
    try: return float(val) 
    except (ValueError, TypeError): return 0.0

print("Начинаем миграцию...")

# Миграция Пользователей (Users)
try:
    users_data = db.reference('users').get() or {}
    print(f"Найдено {len(users_data)} пользователей. Переносим...")
    for uid, ud in users_data.items():
        if not isinstance(ud, dict): continue
        cursor.execute('''INSERT OR IGNORE INTO users 
                          (uid, email, password_hash, provider, created_at, verified, verification_code) 
                          VALUES (?, ?, ?, ?, ?, ?, ?)''',
                       (uid,
                        ud.get('email', '').lower(),
                        ud.get('password_hash'),
                        ud.get('provider', 'email'),
                        ud.get('created_at'),
                        safe_bool(ud.get('verified')),
                        ud.get('verification_code')))
    conn.commit()
    print("Пользователи перенесены.")
except Exception as e:
    print(f"Ошибка при миграции пользователей: {e}")

# Миграция Прогресса (Lessons + total XP)
try:
    progress_data = db.reference('progress').get() or {}
    print(f"Переносим прогресс уроков...")
    count_lessons = 0
    for uid, prog in progress_data.items():
        if not isinstance(prog, dict): continue
        # Обновляем total_xp и game_xp
        total_xp = prog.get('total_xp', 0)
        game_xp = prog.get('game_xp', 0)
        cursor.execute("UPDATE users SET total_xp = ?, game_xp = ? WHERE uid = ?", (total_xp, game_xp, uid))
        
        # Уроки
        for key, val in prog.items():
            if key.startswith('lesson') and isinstance(val, dict):
                cursor.execute('''INSERT OR REPLACE INTO user_lessons 
                                  (uid, lesson_key, completed, score, total, percentage, completed_at, xp_earned, max_possible_xp) 
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                               (uid,
                                key,
                                safe_bool(val.get('completed')),
                                safe_int(val.get('score')),
                                safe_int(val.get('total')),
                                safe_float(val.get('percentage')),
                                val.get('completed_at'),
                                safe_int(val.get('xp_earned')),
                                safe_int(val.get('max_possible_xp'))))
                count_lessons += 1
    conn.commit()
    print(f"Перенесено {count_lessons} записей прогресса уроков.")
except Exception as e:
    print(f"Ошибка при миграции прогресса: {e}")

# Миграция Прогресса Игры (game_progress)
try:
    game_prog_data = db.reference('game_progress').get() or {}
    print(f"Переносим прогресс игры...")
    count_levels = 0
    for uid, levels in game_prog_data.items():
        if isinstance(levels, dict):
            iterator = levels.items()
        elif isinstance(levels, list):
            iterator = enumerate(levels)
        else: continue
        
        for lid, val in iterator:
            if val is None or not isinstance(val, dict): continue
            cursor.execute('''INSERT OR REPLACE INTO user_levels 
                              (uid, level_id, completed, xp_earned, completed_at) 
                              VALUES (?, ?, ?, ?, ?)''',
                           (uid,
                            str(lid),
                            safe_bool(val.get('completed')),
                            safe_int(val.get('xp_earned')),
                            val.get('completed_at')))
            count_levels += 1
    conn.commit()
    print(f"Перенесено {count_levels} записей прогресса игры.")
except Exception as e:
    print(f"Ошибка при миграции прогресса игры: {e}")

# Миграция Паролей (password_resets)
try:
    resets_data = db.reference('password_resets').get() or {}
    for token, val in resets_data.items():
        if not isinstance(val, dict): continue
        cursor.execute('''INSERT OR IGNORE INTO password_resets 
                          (token, uid, email, created_at, expires_at) 
                          VALUES (?, ?, ?, ?, ?)''',
                       (token, val.get('user_id'), val.get('email'), val.get('created_at'), val.get('expires_at')))
    conn.commit()
    print(f"Токены сброса паролей перенесены.")
except Exception as e:
    print(f"Ошибка при миграции токенов сброса паролей: {e}")

# Миграция Учителей (teachers)
try:
    teachers_data = db.reference('teachers').get() or {}
    print(f"Переносим учителей...")
    # Сначала проверяем есть ли пользователи с такими uid, иначе foreign key упадет
    for uid, val in teachers_data.items():
        if not isinstance(val, dict): continue
        # Проверяем пользователя
        cursor.execute('SELECT uid FROM users WHERE uid = ?', (uid,))
        if not cursor.fetchone():
             cursor.execute('''INSERT INTO users (uid, email, provider) VALUES (?, ?, 'teacher')''', (uid, val.get('email', '')))
        
        cursor.execute('''INSERT OR IGNORE INTO teachers 
                          (uid, email, full_name, region, city, school, invite_token, created_at) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                       (uid,
                        val.get('email'),
                        val.get('full_name'),
                        val.get('region'),
                        val.get('city'),
                        val.get('school'),
                        val.get('invite_token'),
                        val.get('created_at')))
    conn.commit()
    print(f"Учителя перенесены.")
except Exception as e:
    print(f"Ошибка при миграции учителей: {e}")

# Миграция Учеников Учителей (teacher_students)
try:
    students_data = db.reference('teacher_students').get() or {}
    print(f"Переносим связи ученик-учитель...")
    count_students = 0
    for teacher_uid, students in students_data.items():
        if not isinstance(students, dict): continue
        for student_uid, val in students.items():
            if not isinstance(val, dict): continue
            
            # Убеждаемся что ученик и учитель есть в БД
            cursor.execute('SELECT uid FROM teachers WHERE uid = ?', (teacher_uid,))
            if not cursor.fetchone(): continue
            cursor.execute('SELECT uid FROM users WHERE uid = ?', (student_uid,))
            if not cursor.fetchone(): continue
            
            cursor.execute('''INSERT OR IGNORE INTO teacher_students 
                              (teacher_uid, student_uid, full_name, region, city, school, class_name, email, joined_at) 
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                           (teacher_uid,
                            student_uid,
                            val.get('full_name'),
                            val.get('region'),
                            val.get('city'),
                            val.get('school'),
                            val.get('class_name'),
                            val.get('email'),
                            val.get('joined_at')))
            count_students += 1
    conn.commit()
    print(f"Перенесено {count_students} связей ученик-учитель.")
except Exception as e:
    print(f"Ошибка при миграции связей ученик-учитель: {e}")

conn.close()
print("Миграция завершена! Данные сохранены в 'app.db'.")
