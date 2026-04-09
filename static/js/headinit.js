document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburger-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');

    if (hamburgerBtn && mobileMenu) {

        // Переключение видимости мобильного меню при клике на гамбургер
        hamburgerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            mobileMenu.classList.toggle('show');
        });

        // Закрытие меню при клике на любую ссылку внутри меню
        const menuLinks = mobileMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('show');
            });
        });

        // Закрытие меню при клике вне меню и кнопки гамбургера
        document.addEventListener('click', function(e) {
            if (!mobileMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                mobileMenu.classList.remove('show');
            }
        });

        // Переключение темы через мобильное меню
        if (mobileThemeToggle) {
            mobileThemeToggle.addEventListener('click', function(e) {
                e.preventDefault();

                // Получаем текущую тему и переключаем
                const currentTheme = localStorage.getItem('theme') || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

                // Устанавливаем новую тему
                document.documentElement.setAttribute('data-bs-theme', newTheme);
                localStorage.setItem('theme', newTheme);

                // Обновляем кнопку переключения темы для ПК
                const themeBtn = document.getElementById('themeToggleBtn');
                if (themeBtn) {
                    themeBtn.innerHTML = newTheme === 'dark'
                        ? '<i class="bi bi-sun-fill"></i>'
                        : '<i class="bi bi-moon-fill"></i>';
                    themeBtn.className = `btn btn-outline-${newTheme === 'dark' ? 'light' : 'dark'} rounded-circle d-flex align-items-center justify-content-center`;
                }

                // Закрываем мобильное меню
                mobileMenu.classList.remove('show');

            });
        }

    }
});