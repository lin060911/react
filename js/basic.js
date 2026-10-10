/* ============================================================
   basic.js — 基础反应测试（看到绿色立即点击，5 次一组）
   计时规则：以「绿色真正绘制到屏幕」的那一帧为起点，
             避免把渲染延迟算进成绩（否则成绩系统性偏快）。
   ============================================================ */
(function () {
    'use strict';

    var circle   = RL.$('circle');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');
    var timerEl  = RL.$('timer');

    var currentAvgEl     = RL.$('currentAvg');
    var currentFastestEl = RL.$('currentFastest');
    var currentCountEl   = RL.$('currentCount');
    var bestAvgEl        = RL.$('bestAvg');
    var bestFastestEl    = RL.$('bestFastest');

    var TOTAL_ROUNDS = 5;
    var MIN_DELAY = 2000;
    var MAX_DELAY = 4000;
    var RETRY_DELAY = 800;   // 提前点击后重试
    var NEXT_DELAY = 700;    // 单次完成后的间隔

    var STATE = { IDLE: 'idle', WAITING: 'waiting', GO: 'go', RESULT: 'result', EARLY: 'early' };

    var sw = RL.Stopwatch(timerEl);

    var state = STATE.IDLE;
    var round = 0;            // 已完成的有效次数
    var times = [];
    var goStamp = 0;
    var waitTimer = null;
    var stepTimer = null;

    var bestAvg = RL.store.get('basic.avg', 'baselineBestAvg');
    var bestFastest = RL.store.get('basic.fastest');

    /* ---------- 渲染 ---------- */
    function renderCircle(text, cls, sub) {
        circle.className = 'reaction-circle ' + cls;
        circle.innerHTML = '';
        var main = document.createElement('div');
        main.textContent = text;
        circle.appendChild(main);
        if (sub) {
            var s = document.createElement('div');
            s.className = 'sub';
            s.textContent = sub;
            circle.appendChild(s);
        }
    }

    function renderProgress() {
        progress.textContent = round > 0 ? ('已完成 ' + round + ' / ' + TOTAL_ROUNDS + ' 次') : '';
    }

    function renderCurrent() {
        currentAvgEl.textContent = RL.fmtMs(RL.avg(times));
        currentFastestEl.textContent = RL.fmtMs(RL.min(times));
        currentCountEl.textContent = round + ' / ' + TOTAL_ROUNDS;
    }

    function renderBest() {
        bestAvgEl.textContent = RL.fmtMs(bestAvg);
        bestFastestEl.textContent = RL.fmtMs(bestFastest);
    }

    function resetUI() {
        renderCircle('准备', 'wait', '点击或按空格开始');
        flowTip('点击圆形或按空格键开始测试', 'gray');
        renderProgress();
        renderCurrent();
    }

    /* ---------- 流程 ---------- */
    function clearTimers() {
        clearTimeout(waitTimer);
        clearTimeout(stepTimer);
        waitTimer = stepTimer = null;
    }

    function startRound() {
        clearTimers();
        state = STATE.WAITING;
        goStamp = 0;
        sw.reset();
        renderCircle('等待', 'wait', '第 ' + (round + 1) + ' / ' + TOTAL_ROUNDS + ' 次');
        flowTip('等待变绿，不要提前点击', 'gray');

        waitTimer = setTimeout(function () {
            if (state !== STATE.WAITING) return;
            state = STATE.GO;
            renderCircle('点击！', 'go');
            flowTip('绿色！立即点击', 'green');
            /* 关键：起点取「绿色已上屏」那一帧的时间戳 */
            RL.afterPaint(function (ts) {
                if (state !== STATE.GO || goStamp !== 0) return;
                goStamp = ts || performance.now();
                sw.mark(goStamp);
            });
        }, RL.rand(MIN_DELAY, MAX_DELAY));
    }

    function startTest() {
        clearTimers();
        times = [];
        round = 0;
        renderCurrent();
        renderProgress();
        startRound();
    }

    function handleEarly() {
        clearTimers();
        state = STATE.EARLY;
        goStamp = 0;
        sw.reset();
        renderCircle('提前点击', 'tooearly', '本次无效');
        flowTip('提前点击，本次无效，稍后重试', 'red');
        stepTimer = setTimeout(function () {
            if (state !== STATE.EARLY) return;
            startRound();
        }, RETRY_DELAY);
    }

    function handleHit() {
        /* 绿色还没上屏就点击 → 按提前点击处理，避免算出一个假成绩 */
        if (!goStamp) { handleEarly(); return; }

        var rt = Math.round(performance.now() - goStamp);
        goStamp = 0;
        sw.stop();
        times.push(rt);
        round++;
        renderCurrent();
        renderProgress();

        state = STATE.RESULT;
        renderCircle(rt + ' ms', 'go');
        flowTip('反应时间：' + rt + ' ms', 'green');

        if (round >= TOTAL_ROUNDS) {
            stepTimer = setTimeout(finish, 900);
        } else {
            stepTimer = setTimeout(startRound, NEXT_DELAY);
        }
    }

    function finish() {
        clearTimers();
        state = STATE.IDLE;
        sw.reset();

        var a = RL.avg(times);
        var f = RL.min(times);
        bestAvg = RL.betterLower(bestAvg, a);
        bestFastest = RL.betterLower(bestFastest, f);
        RL.store.set('basic.avg', Math.round(bestAvg));
        RL.store.set('basic.fastest', Math.round(bestFastest));
        renderBest();

        renderCircle(Math.round(a) + ' ms', 'wait', '本组平均');
        flowTip('测试结束，平均 ' + Math.round(a) + ' ms · 按空格或点击重新开始', 'yellow');
        progress.textContent = '本组完成 · 共 ' + round + ' 次有效';
    }

    /* ---------- 失焦保护：作废本次整组测试 ---------- */
    RL.onFocusLost(function () {
        if (state === STATE.IDLE) return;
        clearTimers();
        sw.reset();
        goStamp = 0;
        state = STATE.IDLE;
        round = 0;
        times = [];
        renderCurrent();
        progress.textContent = '';
        renderCircle('已中断', 'tooearly', '切换窗口');
        flowTip('检测到切换窗口 · 本次作废 · 按空格或点击屏幕重新开始', 'red');
    });

    /* ---------- 交互 ---------- */
    RL.onActivate(act);

    function act() {
        if (state === STATE.IDLE) { startTest(); return; }
        if (state === STATE.WAITING) { handleEarly(); return; }
        if (state === STATE.GO) { handleHit(); return; }
    }

    renderBest();
    resetUI();
})();
