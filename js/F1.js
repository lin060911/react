/* F1.js — F1 发车反应测试 */
(function () {
    const lights = document.querySelectorAll('.f1-light');
    const result = document.getElementById('result');
    const timer = document.getElementById('timer');
    const bestRecord = document.getElementById('bestRecord');
    const tip = document.getElementById('tip');
    const greenModeToggle = document.getElementById('greenModeToggle');
    const soundModeToggle = document.getElementById('soundModeToggle');
    const modeSwitchGroup = document.getElementById('modeSwitchGroup');

    let testActive = false;
    let isCooldown = false;
    let startTime = 0;
    let bestTime = null;
    let lightTimer = null;
    let goTimer = null;
    let reactionTimer = null;
    const HUMAN_MIN_REACTION = 100;
    let isTouchEvent = false;
    const TOUCH_DELAY = 50;
    let isGreenMode = false;
    let isSoundMode = false;

    let audioContext;
    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(type) {
        if (!isSoundMode) return;
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'light') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } else if (type === 'go') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(990, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.8);
        }
    }

    modeSwitchGroup.addEventListener('click', function (e) {
        e.stopPropagation();
        const target = e.target;
        if (target.closest('.mode-switch-item:nth-child(1)')) {
            greenModeToggle.checked = !greenModeToggle.checked;
            toggleGreenMode(greenModeToggle.checked);
        } else if (target.closest('.mode-switch-item:nth-child(2)')) {
            soundModeToggle.checked = !soundModeToggle.checked;
            isSoundMode = soundModeToggle.checked;
        }
    });

    document.querySelectorAll('.switch-label, .switch, .slider').forEach(element => {
        element.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    greenModeToggle.addEventListener('change', function (e) {
        e.stopPropagation();
        toggleGreenMode(this.checked);
    });

    soundModeToggle.addEventListener('change', function (e) {
        e.stopPropagation();
        isSoundMode = this.checked;
    });

    function toggleGreenMode(enabled) {
        isGreenMode = enabled;
        if (isGreenMode) {
            tip.innerHTML = "<strong>规则：</strong>来自真实F1发车信号灯规则<br>5盏红灯依次亮起 → 随机0.5s-3.0s红灯变绿 → 变绿瞬间点击<br>提前发车罚时 | 人类极限反应：≥100ms";
        } else {
            tip.innerHTML = "<strong>规则：</strong>来自真实F1发车信号灯规则<br>5盏红灯依次亮起 → 随机0.5s-3.0s红灯熄灭 → 熄灭瞬间点击<br>提前发车罚时 | 人类极限反应：≥100ms";
        }
    }

    function fullReset() {
        testActive = false;
        startTime = 0;
        clearInterval(lightTimer);
        clearTimeout(goTimer);
        clearInterval(reactionTimer);
        lights.forEach(light => {
            light.classList.remove('active');
            light.classList.remove('green');
        });
        timer.classList.remove('visible');
        timer.textContent = '';
    }

    function updateBestRecord() {
        bestRecord.textContent = bestTime === null ? '最快成绩：-- ms' : `最快成绩：${bestTime} ms`;
    }

    function startCooldown() {
        isCooldown = true;
        setTimeout(() => {
            isCooldown = false;
            result.textContent = '点击屏幕或按[空格键]开始';
            result.className = 'result text-gray';
        }, 2000);
    }

    function updateReactionTimer() {
        if (startTime === 0) return;
        const currentTime = performance.now();
        const elapsed = Math.round(currentTime - startTime);
        timer.textContent = `${elapsed} ms`;
    }

    function startTest() {
        fullReset();
        testActive = true;
        result.textContent = isGreenMode ? '等待红灯变绿' : '等待所有红灯熄灭';
        result.className = 'result text-yellow';
        timer.classList.remove('visible');

        let lightIndex = 0;
        lightTimer = setInterval(() => {
            if (lightIndex < 5) {
                lights[lightIndex].classList.add('active');
                playSound('light');
                lightIndex++;
            } else {
                clearInterval(lightTimer);
                const randomDelay = Math.random() * 2500 + 500;
                goTimer = setTimeout(() => {
                    if (isGreenMode) {
                        lights.forEach(l => { l.classList.remove('active'); l.classList.add('green'); });
                    } else {
                        lights.forEach(l => l.classList.remove('active'));
                    }
                    playSound('go');
                    startTime = performance.now();
                    result.textContent = '发车！';
                    result.className = 'result text-green';
                    timer.classList.add('visible');
                    timer.textContent = '0 ms';
                    clearInterval(reactionTimer);
                    reactionTimer = setInterval(updateReactionTimer, 10);
                }, randomDelay);
            }
        }, 800);
    }

    function handleInteraction(e) {
        if (e.target.closest('.mode-switch-group')) return;
        e.preventDefault();
        if (isCooldown) return;
        isTouchEvent = e.type === 'touchstart';

        if (!testActive) {
            if (isTouchEvent) {
                setTimeout(() => startTest(), TOUCH_DELAY);
            } else {
                startTest();
            }
            return;
        }

        const handleJudge = () => {
            const currentTime = performance.now();
            const start = startTime;
            clearInterval(reactionTimer);
            timer.classList.remove('visible');
            timer.textContent = '';
            lights.forEach(l => { l.classList.remove('active'); l.classList.remove('green'); });
            fullReset();

            if (start === 0) {
                result.textContent = '提前发车将被罚时';
                result.className = 'result text-red';
                startCooldown();
                return;
            }

            const reaction = Math.round(currentTime - start);
            if (reaction < HUMAN_MIN_REACTION) {
                result.textContent = '❌ 无效成绩';
                result.className = 'result text-red';
            } else {
                if (bestTime === null || reaction < bestTime) {
                    bestTime = reaction;
                    updateBestRecord();
                }
                result.textContent = `${reaction} ms`;
                result.className = 'result text-green';
            }
            startCooldown();
        };

        if (isTouchEvent) {
            setTimeout(handleJudge, TOUCH_DELAY);
        } else {
            handleJudge();
        }
    }

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction, { passive: false });
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') handleInteraction(e);
    });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    result.textContent = '点击屏幕或按[空格键]开始';
    updateBestRecord();
})();
