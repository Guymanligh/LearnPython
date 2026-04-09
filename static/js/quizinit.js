// 🔔 Показ уведомления
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 shadow`;
    notification.style.zIndex = '9999';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ✅ Завершение урока
async function completeLesson() {
    window.location.href = `/lessons?t=${Date.now()}`;
}

(function() {
    const e = React.createElement;
    const { useState, useEffect } = React;

    function PythonQuiz() {
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [quizState, setQuizState] = useState({
            currentQuestion: null,
            total: 0,
            currentIndex: 0,
            score: 0,
            answerChecked: false,
            selectedAnswer: null,
            correctIndex: null,
            explanation: '',
            finished: false,
            finalData: null
        });

        useEffect(() => { startQuiz(); }, []);

        async function startQuiz() {
            try {
                const res = await fetch(`/api/quiz/start/${LESSON_ID}`, { method: 'POST' });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setQuizState(prev => ({
                    ...prev,
                    currentQuestion: data.question,
                    total: data.total,
                    currentIndex: data.current,
                }));
            } catch (err) { setError(err.message); }
            finally { setLoading(false); }
        }

        async function handleAnswer(selected) {
            if (quizState.answerChecked) return;

            const selectedIdx = Number(selected);
            setQuizState(prev => ({ ...prev, selectedAnswer: selectedIdx }));

            try {
                const res = await fetch('/api/quiz/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lesson_id: LESSON_ID,
                        question_id: quizState.currentQuestion.id,
                        selected: selectedIdx
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                if (data.finished) {
                    // Квиз окончен – показываем экран результата
                    setQuizState(prev => ({
                        ...prev,
                        finished: true,
                        finalData: data
                    }));
                    document.getElementById('complete-lesson').style.display = 'inline-block';
                } else {
                    // Промежуточный ответ
                    const correctIdx = Number(data.correct_index);
                    setQuizState(prev => ({
                        ...prev,
                        answerChecked: true,
                        correctIndex: correctIdx,
                        explanation: data.explanation,
                        score: data.score
                    }));

                    setTimeout(() => {
                        setQuizState(prev => ({
                            ...prev,
                            currentQuestion: data.next_question,
                            currentIndex: data.next_index,
                            answerChecked: false,
                            selectedAnswer: null,
                            correctIndex: null,
                            explanation: ''
                        }));
                    }, 1500);
                }
            } catch (err) { showNotification('Ошибка: ' + err.message, 'danger'); }
        }

        const restartQuiz = () => {
            setLoading(true);
            setQuizState({
                currentQuestion: null,
                total: 0,
                currentIndex: 0,
                score: 0,
                answerChecked: false,
                selectedAnswer: null,
                correctIndex: null,
                explanation: '',
                finished: false,
                finalData: null
            });
            document.getElementById('complete-lesson').style.display = 'none';
            startQuiz();
        };

        if (loading) return e('div', { className: 'text-center p-5' }, e('div', { className: 'spinner-border text-primary' }));
        if (error) return e('div', { className: 'alert alert-danger' }, error);

        // Экран завершения (старый дизайн)
        if (quizState.finished) {
            const d = quizState.finalData;
            const percentage = (d.score / d.total) * 100;
            let message = percentage === 100 ? "🎉 Превосходно! Ты настоящий знаток Python!" :
                          percentage >= 80 ? "🌟 Отлично! Ты хорошо усвоил материал!" :
                          percentage >= 60 ? "👍 Хорошо! Продолжай изучать Python!" :
                          "📚 Неплохо! Перечитай урок и попробуй ещё раз!";

            return e('div', { className: 'card shadow-lg border-0' },
                e('div', { className: 'card-body text-center p-5' },
                    e('div', { className: 'display-1' }, '🏆'),
                    e('h2', { className: 'mt-3' }, 'Квиз завершён!'),
                    e('div', { className: 'display-3 fw-bold text-primary my-4' }, `${d.score}/${d.total}`),
                    e('p', { className: 'lead' }, message),
                    e('button', { className: 'btn btn-outline-primary btn-lg mt-3', onClick: restartQuiz }, '🔄 Пройти снова')
                )
            );
        }

        // Обычный экран вопроса
        const q = quizState.currentQuestion;
        if (!q) return null;

        const isCorrect = quizState.selectedAnswer === quizState.correctIndex;

        return e('div', { className: 'card shadow-lg border-0' },
            e('div', { className: 'card-body p-4' },
                e('div', { className: 'd-flex justify-content-between align-items-center mb-4' },
                    e('span', { className: 'badge bg-primary fs-6' }, `Вопрос ${quizState.currentIndex} из ${quizState.total}`),
                    e('span', { className: 'badge bg-warning text-dark fs-6' }, `⭐ Очки: ${quizState.score}`)
                ),
                e('div', { className: 'progress mb-4', style: { height: '10px' } },
                    e('div', {
                        className: 'progress-bar bg-success',
                        style: { width: `${(quizState.currentIndex)/quizState.total*100}%` }
                    })
                ),
                e('h4', { className: 'mb-4' }, q.text),
                e('div', { className: 'd-grid gap-3 mb-4' },
                    q.options.map((opt, idx) => {
                        let btnClass = 'btn btn-outline-secondary text-start py-3';
                        if (quizState.answerChecked) {
                            if (idx === quizState.correctIndex) {
                                btnClass = 'btn btn-success text-start py-3';
                            } else if (idx === quizState.selectedAnswer) {
                                btnClass = 'btn btn-danger text-start py-3';
                            }
                        } else if (idx === quizState.selectedAnswer) {
                            btnClass = 'btn btn-primary text-start py-3';
                        }
                        return e('button', {
                            key: idx,
                            className: btnClass,
                            onClick: () => handleAnswer(idx),
                            disabled: quizState.answerChecked,
                            style: { transition: 'all 0.2s' }
                        },
                            e('span', { className: 'me-2' }, idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : 'D'),
                            opt
                        );
                    })
                ),
                quizState.answerChecked && e('div', {
                    className: `alert ${isCorrect ? 'alert-success' : 'alert-info'} mb-4`
                },
                    e('strong', null, isCorrect ? '✅ Верно! ' : '💡 Подсказка: '),
                    quizState.explanation
                )
            )
        );
    }

    const root = ReactDOM.createRoot(document.getElementById('quiz-root'));
    root.render(e(PythonQuiz));
})();