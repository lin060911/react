/* arrow.js — 箭头反应测试 */
(function () {
    const arrow = document.getElementById('arrow');
    const flowTip = document.getElementById('flowTip');
    const timer = document.getElementById('timer');

    const currentFastestEl = document.getElementById('currentFastest');
    const currentAvgEl = document.getElementById('currentAvg');
    const currentCorrectEl = document.getElementById('currentCorrect');
    const bestFastestEl = document.getElementById('bestFastest');
    const bestAvgEl = document.getElementById('bestAvg');
    const bestCorrectEl = document.getElementById('bestCorrect');

    const DIRECTIONS = ['up', 'down', 'left', 'right'];
    const KEY_MAPPING = {
        up: ['ArrowUp', 'KeyW'],
        down: ['ArrowDown', 'KeyS'],
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD']
    };
    const MIN_DELAY = 20;
    const MAX_DELAY = 200;
    const TOUCH_DELAY = 0;
    const TIMEOUT_DURATION = 600;

    let testActive = false;
    let isCooldown = false;
    let currentDirection = '';
    let reactionTimes = [];
    let startTime = 0;
    let arrowTimer = null;
    let reactionTimer = null;
    let testEnded = false;
    let timeoutTimer = null;

    let bestScores = {
        fastest: localStorage.getItem('bestFastest') || '--',
        avg: localStorage.getItem('bestAvg') || '--',
        correct: localStorage.getItem('bestCorrect') || 0
    };

    function getRandomDirection() {
        return DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    }

    function fullReset() {
        testActive = false;
        isCooldown = false;
        testEnded = false;
        currentDirection = '';
        reactionTimes = [];
        startTime = 0;
        clearTimeout(arrowTimer);
        clearInterval(reactionTimer);
        clearTimeout(timeoutTimer);
        arrow.className = 'arrow';
        timer.classList.remove('visible');
        timer.textContent = '';
        flowTip.textContent = '点击屏幕或按空格键开始测试';
        flowTip.className = 'flow-tip text-gray';
        updateCurrentStats();
    }

    function updateCurrentStats() {
        const fastest = reactionTimes.length > 0 ? Math.min(...reactionTimes) : '--';
        const avg = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) : '--';
        const correct = reactionTimes.length;
        currentFastestEl.textContent = fastest === '--' ? '-- ms' : `${fastest} ms`;
        currentAvgEl.textContent = avg === '--' ? '-- ms' : `${avg} ms`;
        currentCorrectEl.textContent = correct;
    }

    function updateBestStats() {
        bestFastestEl.textContent = bestScores.fastest === '--' ? '-- ms' : `${bestScores.fastest} ms`;
        bestAvgEl.textContent = bestScores.avg === '--' ? '-- ms' : `${bestScores.avg} ms`;
        bestCorrectEl.textContent = bestScores.correct;
    }

    function checkAndUpdateBestScores() {
        if (reactionTimes.length === 0) return;
        const currentFastest = Math.min(...reactionTimes);
        const currentAvg = Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length);
        const currentCorrect = reactionTimes.length;

        if (bestScores.fastest === '--' || currentFastest < bestScores.fastest) {
            bestScores.fastest = currentFastest;
            localStorage.setItem('bestFastest', currentFastest);
        }
        if (bestScores.avg === '--' || currentAvg < bestScores.avg) {
            bestScores.avg = currentAvg;
            localStorage.setItem('bestAvg', currentAvg);
        }
        if (currentCorrect > bestScores.correct) {
            bestScores.correct = currentCorrect;
            localStorage.setItem('bestCorrect', currentCorrect);
        }
        updateBestStats();
    }

    function handleTimeout() {
        if (testEnded || !testActive) return;
        clearInterval(reactionTimer);
        clearTimeout(timeoutTimer);
        timer.classList.remove('visible');
        testEnded = true;
        flowTip.textContent = `超时！600ms内未操作，测试结束 | 正确次数: ${reactionTimes.length}`;
        flowTip.className = 'flow-tip text-red';
        updateCurrentStats();
        arrow.className = 'arrow';
        startTime = 0;
        startCooldown();
    }

    function showArrow() {
        if (testEnded) return;
        currentDirection = getRandomDirection();
        arrow.className = `arrow ${currentDirection} visible`;
        const symbols = { up:'⇧', down:'⇩', left:'⇦', right:'⇨' };
        arrow.textContent = symbols[currentDirection];
        startTime = performance.now();
        flowTip.textContent = '按对应方向键/WASD';
        flowTip.className = 'flow-tip text-yellow';
        timer.classList.add('visible');
        timer.textContent = '0 ms';
        clearInterval(reactionTimer);
        reactionTimer = setInterval(updateReactionTimer, 10);
        clearTimeout(timeoutTimer);
        timeoutTimer = setTimeout(handleTimeout, TIMEOUT_DURATION);
    }

    function updateReactionTimer() {
        if (startTime === 0 || testEnded) return;
        timer.textContent = `${Math.round(performance.now() - startTime)} ms`;
    }

    function startCooldown() {
        isCooldown = true;
        setTimeout(() => {
            isCooldown = false;
            if (!testEnded) {
                arrowTimer = setTimeout(showArrow, Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY);
            } else {
                checkAndUpdateBestScores();
                flowTip.textContent = `${flowTip.textContent} | 按空格键或点击屏幕重新开始`;
                arrow.className = 'arrow';
            }
        }, 500);
    }

    function startTest() {
        fullReset();
        testActive = true;
        flowTip.textContent = '准备开始...';
        flowTip.className = 'flow-tip text-yellow';
        arrowTimer = setTimeout(showArrow, 500);
    }

    function handleInputValidation(inputValue) {
        if (!testActive || isCooldown || startTime === 0 || testEnded) return;
        clearTimeout(timeoutTimer);
        clearInterval(reactionTimer);
        timer.classList.remove('visible');
        const reactionTime = Math.round(performance.now() - startTime);
        const isCorrect = KEY_MAPPING[currentDirection].includes(inputValue);

        if (isCorrect) {
            reactionTimes.push(reactionTime);
            flowTip.textContent = `反应时间: ${reactionTime} ms`;
            flowTip.className = 'flow-tip text-green';
            updateCurrentStats();
            arrow.className = 'arrow';
            startTime = 0;
            startCooldown();
        } else {
            testEnded = true;
            flowTip.textContent = `输入错误！测试结束 | 最后反应时间: ${reactionTime} ms`;
            flowTip.className = 'flow-tip text-red';
            updateCurrentStats();
            arrow.className = 'arrow';
            startTime = 0;
            startCooldown();
        }
    }

    function handleKeydown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!testActive || testEnded) startTest();
            return;
        }
        for (const [direction, keys] of Object.entries(KEY_MAPPING)) {
            if (keys.includes(e.code)) {
                e.preventDefault();
                handleInputValidation(e.code);
                return;
            }
        }
    }

    function handleInteraction(e) {
        e.preventDefault();
        if (isCooldown) return;
        if (!testActive || testEnded) {
            if (e.type === 'touchstart') {
                setTimeout(startTest, TOUCH_DELAY);
            } else {
                startTest();
            }
        }
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction, { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    updateCurrentStats();
    updateBestStats();
})();
