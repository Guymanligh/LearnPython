// auto_translator.js
// Глобальный словарь переводов (из translations.json)
let globalDict = null;

// Обратный словарь: Русская строка -> Строка целевого языка
let reverseDict = {};

// Язык страницы
const currentLang = document.documentElement.lang || 'ru';

async function initTranslator() {
    // Если язык 'ru', перевод не нужен (оставляем оригинал)
    if (currentLang === 'ru') return;

    try {
        const response = await fetch('/api/translations');
        globalDict = await response.json();
        
        // Строим reverse-lookup словарь (Русский -> Текущий)
        // Ключами будут служить оригинальные русские строки из словаря
        Object.keys(globalDict).forEach(key => {
            const entry = globalDict[key];
            if (entry && entry['ru'] && entry[currentLang]) {
                const ruStr = entry['ru'].trim();
                const targetStr = entry[currentLang].trim();
                if (ruStr) {
                    reverseDict[ruStr] = targetStr;
                }
            }
        });

        // 1. Статический проход по уже существующему DOM
        translateNode(document.body);

        // 2. Динамический проход MutationObserver
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        translateNode(node);
                    });
                } else if (mutation.type === 'characterData') {
                    translateTextNode(mutation.target);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        console.log(`Auto-translator initialized for language: ${currentLang}`);

    } catch (err) {
        console.error("Failed to load translations:", err);
    }
}

function translateNode(node) {
    if (!node) return;

    // Не переводим содержимое script и style
    if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;

    // Специфично: если это input с placeholder
    if (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') {
        if (node.placeholder) {
            const translated = getTranslation(node.placeholder);
            if (translated !== node.placeholder) {
                node.placeholder = translated;
            }
        }
    }

    if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node);
    } else {
        node.childNodes.forEach(child => translateNode(child));
    }
}

function translateTextNode(node) {
    const originalText = node.nodeValue;
    if (!originalText || !originalText.trim()) return;

    const translated = getTranslation(originalText);
    if (translated !== originalText) {
        node.nodeValue = translated;
    }
}

function getTranslation(text) {
    let trimmed = text.trim();
    if (reverseDict[trimmed]) {
        return text.replace(trimmed, reverseDict[trimmed]);
    }
    
    // Проверка на частичное совпадение (если текст склеен в JS, например 'Очки: 10')
    // Это более тяжелая операция, но полезна для составных строк.
    // Итерируемся по словарю от самых длинных фраз к коротким (optional)
    return text;
}

// Запуск после загрузки документа
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslator);
} else {
    initTranslator();
}
