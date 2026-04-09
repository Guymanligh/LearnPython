(function() {
    // ID элементов
    const DESKTOP_BTN_ID = 'themeToggleBtn';
    const MOBILE_BTN_ID = 'mobile-theme-toggle';
    const HAMBURGER_ID = 'hamburger-toggle';
    const MOBILE_MENU_ID = 'mobile-menu';

    // Текущая тема (берём из localStorage или ставим 'dark')
    let currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', currentTheme);

    // ---------- Функции для Monaco ----------
    function updateMonaco(theme) {
        const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';
        if (window.monaco && window.monaco.editor) {
            try {
                window.monaco.editor.setTheme(monacoTheme);
            } catch (e) { }
        }
        if (window.editor && typeof window.editor.updateOptions === 'function') {
            try {
                window.editor.updateOptions({ theme: monacoTheme });
            } catch (e) { }
        }
        if (window.monaco && window.monaco.editor && window.monaco.editor.getEditors) {
            try {
                const editors = window.monaco.editor.getEditors();
                editors.forEach(ed => ed.updateOptions({ theme: monacoTheme }));
            } catch (e) { }
        }
    }

    function waitForMonaco(callback) {
        if (window.monaco && window.monaco.editor) {
            callback();
        } else if (window.require) {
            window.require(['vs/editor/editor.main'], callback);
        } else {
            setTimeout(() => waitForMonaco(callback), 100);
        }
    }

    // ---------- Основные функции ----------
    function setTheme(theme) {
        if (theme === currentTheme) return;
        currentTheme = theme;
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-bs-theme', theme);
        updateButtons(theme);
        updateMonaco(theme);
    }

    function toggleTheme() {
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }

    function updateButtons(theme) {
        // Десктопная кнопка
        const desktopBtn = document.getElementById(DESKTOP_BTN_ID);
        if (desktopBtn) {
            desktopBtn.innerHTML = theme === 'dark'
                ? '<i class="bi bi-sun-fill"></i>'
                : '<i class="bi bi-moon-fill"></i>';
            desktopBtn.className = `btn btn-outline-${theme === 'dark' ? 'light' : 'dark'} rounded-circle d-flex align-items-center justify-content-center`;
        } else {
        }

        // Мобильная кнопка (только текст)
        const mobileBtn = document.getElementById(MOBILE_BTN_ID);
        if (mobileBtn) {
            mobileBtn.textContent = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
        }
    }

    // Создание десктопной кнопки, если её нет в HTML
    function createDesktopButtonIfNeeded() {
        let container = document.getElementById('theme-btn-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'theme-btn-container';
            container.className = 'd-none d-md-flex align-items-center ms-auto';
            const nav = document.querySelector('.navbar .container-fluid');
            if (nav) {
                nav.insertBefore(container, nav.firstChild);
            } else {
                document.body.appendChild(container);
            }
        } else {
        }

        let btn = document.getElementById(DESKTOP_BTN_ID);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = DESKTOP_BTN_ID;
            btn.type = 'button';
            btn.style.width = '2.4rem';
            btn.style.height = '2.4rem';
            btn.className = `btn btn-outline-${currentTheme === 'dark' ? 'light' : 'dark'} rounded-circle d-flex align-items-center justify-content-center`;
            btn.innerHTML = currentTheme === 'dark'
                ? '<i class="bi bi-sun-fill"></i>'
                : '<i class="bi bi-moon-fill"></i>';
            btn.addEventListener('click', toggleTheme);
            container.appendChild(btn);
        } else {
            btn.removeEventListener('click', toggleTheme);
            btn.addEventListener('click', toggleTheme);
            // Обновляем внешний вид на случай, если тема изменилась до этого
            btn.innerHTML = currentTheme === 'dark'
                ? '<i class="bi bi-sun-fill"></i>'
                : '<i class="bi bi-moon-fill"></i>';
            btn.className = `btn btn-outline-${currentTheme === 'dark' ? 'light' : 'dark'} rounded-circle d-flex align-items-center justify-content-center`;
        }
    }

    // ---------- Обработчики событий (делегирование) ----------
    function setupEventListeners() {
        document.addEventListener('click', function(e) {
            // 1. Гамбургер
            const hamburger = e.target.closest('#' + HAMBURGER_ID);
            if (hamburger) {
                e.preventDefault();
                const menu = document.getElementById(MOBILE_MENU_ID);
                if (menu) {
                    menu.classList.toggle('show');
                    const icon = hamburger.querySelector('i');
                    if (icon) {
                        icon.className = menu.classList.contains('show') ? 'bi bi-x-lg' : 'bi bi-list';
                    }
                }
                return;
            }

            // 2. Мобильная кнопка темы
            const themeBtn = e.target.closest('#' + MOBILE_BTN_ID);
            if (themeBtn) {
                e.preventDefault();
                toggleTheme();
                const menu = document.getElementById(MOBILE_MENU_ID);
                if (menu) menu.classList.remove('show');
                const icon = document.querySelector('#' + HAMBURGER_ID + ' i');
                if (icon) icon.className = 'bi bi-list';
                return;
            }

            // 3. Любая другая ссылка в мобильном меню (закрыть меню)
            const otherLink = e.target.closest('#' + MOBILE_MENU_ID + ' a:not(#' + MOBILE_BTN_ID + ')');
            if (otherLink) {
                const menu = document.getElementById(MOBILE_MENU_ID);
                if (menu) menu.classList.remove('show');
                const icon = document.querySelector('#' + HAMBURGER_ID + ' i');
                if (icon) icon.className = 'bi bi-list';
            }
        });

        // Закрытие меню при клике вне его
        document.addEventListener('click', function(e) {
            const menu = document.getElementById(MOBILE_MENU_ID);
            const hamburger = document.getElementById(HAMBURGER_ID);
            if (!menu || !hamburger) return;
            if (!menu.contains(e.target) && !hamburger.contains(e.target)) {
                menu.classList.remove('show');
                const icon = hamburger.querySelector('i');
                if (icon) icon.className = 'bi bi-list';
            }
        });
    }

    // ---------- Запуск после загрузки DOM ----------
    document.addEventListener('DOMContentLoaded', function() {
        createDesktopButtonIfNeeded();
        setupEventListeners();
        updateButtons(currentTheme);

        // Ждём Monaco и применяем текущую тему
        waitForMonaco(() => {
            updateMonaco(currentTheme);
        });
    });
})();