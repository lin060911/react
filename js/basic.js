/* basic.js — 基础反应测试 */
(function () {
    const circle = document.getElementById('circle');
    const flowTip = document.getElementById('flowTip');
    const progress = document.getElementById('progress');
    const currentAvgEl = document.getElementById('currentAvg');
    const bestAvgEl = document.getElementById('bestAvg');

    const TOTAL_ROUNDS = 5;
    const MIN_DELAY = 2000;
    const MAX_DELAY = 4000;

    let state = 'idle'; 
    let currentRound = 0;
    let times = [];
    let goStartTime = 0;
    let waitTimer = null;

    let bestAvg = localStorage.getItem('baselineBestAvg') || '--';

    function resetUI() {
        circle.className = 'reaction-circle wait';
        circle.textContent = '准备';
        flowTip.textContent = '点击圆形或按空格键开始测试';
        flowTip.className = 'flow-tip text-gray';
        progress.textContent = '';
        currentAvgEl.textContent = '-- ms';
    }

    function updateCurrentAvg() {
        if (!times.length) {
            currentAvgEl.textContent = '-- ms';
            return;
        }
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        currentAvgEl.textContent = avg + ' ms';
    }

    function updateBestAvg() {
        bestAvgEl.textContent = bestAvg === '--' ? '-- ms' : bestAvg + ' ms';
    }

    function startRound() {
        state = 'waiting';
        currentRound++;
        circle.className = 'reaction-circle wait';

        const roundText = `第 ${currentRound}/${TOTAL_ROUNDS} 次`;
        circle.textContent = roundText;
        progress.textContent = '';

        flowTip.textContent = '等待颜色变绿，不要提前点击';
        flowTip.className = 'flow-tip text-gray';

        const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
        waitTimer = setTimeout(() => {
            if (state !== 'waiting') return;
            state = 'go';
            goStartTime = performance.now();
            circle.className = 'reaction-circle go';
            circle.textContent = '点击！';
            flowTip.textContent = '绿色！立即点击';
            flowTip.className = 'flow-tip text-yellow';
        }, delay);
    }

    function endTest() {
        state = 'idle';
        circle.className = 'reaction-circle wait';
        circle.textContent = '完成';
        flowTip.textContent = `测试结束（共 ${times.length} 次有效）`;
        flowTip.className = 'flow-tip text-yellow';
        progress.textContent = '';

        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        if (bestAvg === '--' || avg < Number(bestAvg)) {
            bestAvg = avg;
            localStorage.setItem('baselineBestAvg', avg);
        }
        updateBestAvg();
    }

    function handleAction(e) {
        e.preventDefault();

        if (state === 'idle') {
            times = [];
            currentRound = 0;
            updateCurrentAvg();
            startRound();
            return;
        }

        if (state === 'waiting') {
            clearTimeout(waitTimer);
            state = 'early';
            circle.className = 'reaction-circle tooearly';
            circle.textContent = '提前点击';
            flowTip.textContent = '提前点击，本次无效，稍后重试';
            flowTip.className = 'flow-tip text-red';

            setTimeout(() => {
                if (state !== 'early') return;
                startRound();
            }, 700);
            return;
        }

        if (state === 'go') {
            const rt = Math.round(performance.now() - goStartTime);
            times.push(rt);
            updateCurrentAvg();

            state = 'result';
            goStartTime = 0;

            circle.textContent = `${rt} ms`;
            flowTip.textContent = `反应时间：${rt} ms`;
            flowTip.className = 'flow-tip text-green';

            if (currentRound >= TOTAL_ROUNDS) {
                const lastRT = times[times.length - 1];
                circle.textContent = `${lastRT} ms`;
                flowTip.textContent = `反应时间：${lastRT} ms`;
                flowTip.className = 'flow-tip text-green';

                setTimeout(() => {
                    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                    circle.textContent = `平均：${avg} ms`;
                    circle.className = 'reaction-circle wait';
                    flowTip.textContent = `本组完成（共 ${times.length} 次）`;
                    flowTip.className = 'flow-tip text-yellow';

                    if (bestAvg === '--' || avg < Number(bestAvg)) {
                        bestAvg = avg;
                        localStorage.setItem('baselineBestAvg', avg);
                    }
                    updateBestAvg();

                    state = 'idle';
                    progress.textContent = '';
                }, 1000);
                return;
            }

            setTimeout(() => {
                startRound();
            }, 600);
            return;
        }
    }

    circle.addEventListener('mousedown', handleAction);
    circle.addEventListener('touchstart', handleAction, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            handleAction(e);
        }
    });

    resetUI();
    updateBestAvg();
})();
