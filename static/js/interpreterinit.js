let editor = null;
let pyodide = null;
let isRunning = false;
let stopRequested = false;

// ----------------------- Статус Python -----------------------
function updatePythonStatus(status, text) {
    const statusEl = document.getElementById('python-status');
    const textEl = document.getElementById('python-status-text');
    const loadingEl = document.getElementById('python-loading');

    if (!statusEl || !textEl || !loadingEl) return;

    textEl.textContent = `Python: ${text}`;

    if (status === 'loading') {
        statusEl.style.backgroundColor = '#ffc107';
        loadingEl.style.display = 'inline-block';
    } else if (status === 'success') {
        statusEl.style.backgroundColor = '#28a745';
        loadingEl.style.display = 'none';
    } else if (status === 'error') {
        statusEl.style.backgroundColor = '#dc3545';
        loadingEl.style.display = 'none';
    }
}

// ----------------------- Ошибки -----------------------
function showError(message) {
    const alert = document.getElementById('error-alert');
    const messageEl = document.getElementById('error-message');
    if (!alert || !messageEl) return;

    messageEl.textContent = message;
    alert.classList.remove('alert-hidden');
}

function hideError() {
    const alert = document.getElementById('error-alert');
    if (alert) alert.classList.add('alert-hidden');
}

// ----------------------- Консоль -----------------------
function appendToConsole(text) {
    const log = document.getElementById('console-log');
    if (!log) return;

    // Убираем лишние переносы в начале текста, если консоль уже заканчивается переносом
    if (text.startsWith('\n') && log.textContent.endsWith('\n')) {
        text = text.substring(1);
    }
    
    log.textContent += text;
    log.scrollTop = log.scrollHeight;
}

// ----------------------- Инициализация Monaco Editor -----------------------
function initMonaco() {
    if (window.monaco) {
        createEditor();
        return;
    }

    const loaderScript = document.createElement('script');
    loaderScript.src = '/static/monaco/min/vs/loader.js';
    loaderScript.crossOrigin = 'anonymous';

    loaderScript.onload = () => {
        require.config({ paths: { vs: '/static/monaco/min/vs' } });
        require(['vs/editor/editor.main'], () => createEditor());
    };

    loaderScript.onerror = () => fallbackToTextarea();
    document.head.appendChild(loaderScript);
}

function createEditor() {
    const container = document.getElementById('editor');
    if (!container) return;

    container.innerHTML = '';

    editor = monaco.editor.create(container, {
        value: `print("Привет, Python!")\nname = input("Как тебя зовут? ")\nprint(f"Приятно познакомиться, {name}!")`,
        language: 'python',
        theme: localStorage.getItem('theme') === 'dark' ? 'vs-dark' : 'vs',
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        wordWrap: 'on'
    });

    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.disabled = false;

    window.addEventListener('themeChanged', (e) => {
        if (editor) {
            const theme = e.detail.theme === 'dark' ? 'vs-dark' : 'vs';
            editor.updateOptions({ theme: theme });
        }
    });
}

function fallbackToTextarea() {
    const container = document.getElementById('editor');
    if (!container) return;

    container.innerHTML = `<textarea id="simple-editor" style="width:100%;height:100%;border:none;padding:10px;font-family:monospace;background:var(--bs-body-bg);color:var(--bs-body-color);">print("Привет, Python!")\nname = input("Как тебя зовут? ")\nprint(f"Приятно познакомиться, {name}!")</textarea>`;

    editor = {
        getValue: () => {
            const el = document.getElementById('simple-editor');
            return el ? el.value : '';
        },
        setValue: (value) => {
            const el = document.getElementById('simple-editor');
            if (el) el.value = value;
        }
    };

    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.disabled = false;
}

// ----------------------- Загрузка Pyodide -----------------------
async function loadPyodideAndInit() {
    updatePythonStatus('loading', 'Загрузка...');

    try {
        await loadPyodideScript();
        await initPyodideRuntime();
        updatePythonStatus('success', 'Готов');
        appendToConsole('\n[✓ Python готов]\n');
    } catch (err) {
        console.error('Детальная ошибка Pyodide:', err);
        updatePythonStatus('error', 'Ошибка');
        showError('Ошибка инициализации Python: ' + err.message);
    }
}

function loadPyodideScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/static/pyodide/pyodide.js';
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Не удалось загрузить Pyodide'));
        document.head.appendChild(script);
    });
}

async function initPyodideRuntime() {
    pyodide = await loadPyodide({ indexURL: '/static/pyodide/' });

    pyodide.setStdout({ 
        batched: (text) => {
            if (text && !text.includes('Pyodide')) {
                appendToConsole(text);
            }
        } 
    });
    
    pyodide.setStderr({ 
        batched: (text) => {
            if (text) appendToConsole(`[Ошибка] ${text}`);
        } 
    });

    // Регистрируем асинхронный модуль для input с КОРРЕКТНЫМ ФОРМАТИРОВАНИЕМ
    pyodide.registerJsModule('browser_io', {
        input: (promptText) => {
            return new Promise((resolve) => {
                if (!isRunning || stopRequested) {
                    resolve('');
                    return;
                }
                
                const wrapper = document.getElementById('stdin-wrapper');
                const input = document.getElementById('stdin-input');
                const label = document.getElementById('prompt-label');
                const log = document.getElementById('console-log');

                if (!wrapper || !input || !label || !log) {
                    console.error('Элементы ввода не найдены в DOM');
                    resolve('');
                    return;
                }

                // === КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: ГАРАНТИРУЕМ ПЕРЕНОС СТРОКИ ПЕРЕД ПРИГЛАШЕНИЕМ ===
                // 1. Если консоль не пустая и не заканчивается переносом - добавляем перенос
                if (log.textContent && !log.textContent.endsWith('\n')) {
                    log.textContent += '\n';
                    log.scrollTop = log.scrollHeight;
                }

                // 2. Добавляем приглашение в консоль
                if (promptText) {
                    log.textContent += promptText;
                    log.scrollTop = log.scrollHeight;
                }

                // Показываем поле ввода
                label.textContent = promptText || '>>> ';
                wrapper.style.display = 'flex';
                input.value = '';
                input.focus();

                const handler = (e) => {
                    if (e.key === 'Enter') {
                        const value = input.value;
                        
                        // 3. Добавляем введенный текст и ОБЯЗАТЕЛЬНО перенос строки
                        log.textContent += value + '\n';
                        log.scrollTop = log.scrollHeight;
                        
                        // Скрываем поле ввода
                        wrapper.style.display = 'none';
                        input.removeEventListener('keydown', handler);
                        resolve(value);
                    }
                };
                
                input.addEventListener('keydown', handler);
            });
        }
    });

    // Переопределяем встроенный input в Python на асинхронную версию
    await pyodide.runPythonAsync(`
        import browser_io
        import builtins
        builtins.input = browser_io.input
    `);
}

// ----------------------- Запуск кода (С АВТОЗАМЕНОЙ input) -----------------------
async function runCode() {
    if (isRunning || !editor || !pyodide) {
        if (!pyodide) appendToConsole('[Python ещё не загружен, подождите...]\n');
        return;
    }

    isRunning = true;
    stopRequested = false;
    document.getElementById('run-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
    hideError();

    try {
        let code = editor.getValue();
        
        // Автоматически заменяем ВСЕ вызовы input() на await input()
        code = code.replace(/(?<!await\s*)\binput\s*\(/g, 'await input(');
        
        // Добавляем разделитель перед выполнением
        appendToConsole('\n--- Выполнение ---\n');
        await pyodide.runPythonAsync(code);
        
        if (!stopRequested) {
            // Гарантируем перенос строки перед завершением
            const log = document.getElementById('console-log');
            if (log && !log.textContent.endsWith('\n')) {
                log.textContent += '\n';
                log.scrollTop = log.scrollHeight;
            }
            appendToConsole('--- Завершено ---\n');
        }
    } catch (err) {
        appendToConsole(`\n[Ошибка: ${err.message}]\n`);
    } finally {
        isRunning = false;
        stopRequested = false;
        document.getElementById('run-btn').disabled = false;
        document.getElementById('stop-btn').disabled = true;
        
        // Скрываем поле ввода, если оно вдруг осталось видимым
        const wrapper = document.getElementById('stdin-wrapper');
        if (wrapper) wrapper.style.display = 'none';
    }
}

// ----------------------- Остановка кода -----------------------
function stopCode() {
    if (!isRunning) return;

    stopRequested = true;
    isRunning = false;
    const wrapper = document.getElementById('stdin-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    document.getElementById('run-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
    
    // Гарантируем перенос строки перед сообщением об остановке
    const log = document.getElementById('console-log');
    if (log && !log.textContent.endsWith('\n')) {
        log.textContent += '\n';
        log.scrollTop = log.scrollHeight;
    }
    
    appendToConsole('[Остановлено пользователем]\n');
}

// ----------------------- Очистка консоли -----------------------
function clearConsole() {
    const log = document.getElementById('console-log');
    if (log) {
        log.textContent = 'Добро пожаловать в Python интерпретатор! Введите код и нажмите "Запустить".';
    }
    const wrapper = document.getElementById('stdin-wrapper');
    if (wrapper) wrapper.style.display = 'none';
}

// ----------------------- Скачать код -----------------------
function downloadCode() {
    if (!editor) return alert('Редактор не готов');
    const code = editor.getValue();
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learnpython_${new Date().toISOString().split('T')[0]}.py`;
    a.click();
    URL.revokeObjectURL(url);
}

// ----------------------- Переключение темы -----------------------
function toggleTheme(e) {
    e.preventDefault();
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme);

    // Отправляем событие для Monaco Editor
    window.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { theme: newTheme } 
    }));
}

// ----------------------- DOMContentLoaded -----------------------
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем Pyodide и инициализируем редактор
    loadPyodideAndInit();
    initMonaco();

    // Настраиваем кнопки
    const runBtn = document.getElementById('run-btn');
    const stopBtn = document.getElementById('stop-btn');
    const clearBtn = document.getElementById('clear-btn');
    const downloadBtn = document.getElementById('download-btn');
    
    if (runBtn) runBtn.addEventListener('click', runCode);
    if (stopBtn) stopBtn.addEventListener('click', stopCode);
    if (clearBtn) clearBtn.addEventListener('click', clearConsole);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCode);

    // Применяем сохраненную тему
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    
    // Отправляем событие для инициализации темы в Monaco
    window.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { theme: savedTheme } 
    }));
});