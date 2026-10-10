/* ============================================================
   nogo.js — Go / No-Go 抑制反应测试
   绿色 GO 立即点击 / 红色 NO-GO 必须忍住
   计时规则：以「刺激真正绘制到屏幕」的那一帧为起点。
   ============================================================ */
(function () {
    'use strict';

    var circle   = RL.$('circle');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');
    var timerEl  = RL.$('timer');

    var goRateEl    = RL.$('goRate');
    var noGoRateEl  = RL.$('noGoRate');
    var avgRTEl     = RL.$('avgRT');
    var bestNoGoEl  = RL.$('bestNoGoRate');
    var bestAvgRTEl = RL.$('bestAvgRT');

    var TOTAL_TRIALS = 10;
    var GO_PROBABILITY = 0.7;
    var MIN_STIMULUS = 800;
    var MAX_STIMULUS = 1000;
    var MIN_INTERVAL = 700;
    var MAX_INTERVAL = 1500;
    var RESET_DELAY = 2000;

    var STATE = { IDLE: 'idle', INTERVAL: 'interval', STIMULUS: 'stimulus', DONE: 'done' };

    var sw = RL.Stopwatch(timerEl);

    var state = STATE.IDLE;
    var trial = 0;
    var stimulusStart = 0;    // 0 表示刺激尚未上屏，此时点击按提前反应处理
    var isGo = false;
    var handled = false;
    var timer = null;

    var goCount = 0, goCorrect = 0;
    var noGoCount = 0, noGoCorrect = 0;
    var goTimes = [];

    /* ---------- 最佳成绩 ---------- */
    var best = (function () {
        var raw = RL.store.get('nogo.best', 'gngBestScores');
        var d = { noGoRate: null, avgRT: null };
        if (raw) {
            try {
                var p = JSON.parse(raw);
                d.noGoRate = p.noGoRate || null;
                d.avgRT = (p.avgRT && isFinite(p.avgRT)) ? p.avgRT : null;
            } catch (e) { /* ignore */ }
        }
        return d;
    })();

    function renderBest() {
        bestNoGoEl.textContent = RL.fmtPct(best.noGoRate);
        bestAvgRTEl.textContent = RL.fmtMs(best.avgRT);
    }

    function saveBest() {
        RL.store.set('nogo.best', JSON.stringify(best));
    }

    /* ---------- 渲染 ---------- */
    function renderCircle(text, cls, sub) {
        circle.className = 'stimulus-circle ' + cls;
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

    function resetUI() {
        renderCircle('开始', 'circle-wait', '点击或按空格开始');
        flowTip('点击圆形或按空格键开始测试', 'gray');
        progress.textContent = '';
        goRateEl.textContent = '-- %';
        noGoRateEl.textContent = '-- %';
        avgRTEl.textContent = '-- ms';
    }

    /* ---------- 流程 ---------- */
    function clearTimer() { clearTimeout(timer); timer = null; }

    function resetCounters() {
        trial = 0;
        goCount = goCorrect = noGoCount = noGoCorrect = 0;
        goTimes = [];
        clearTimer();
    }

    function showInterval() {
        if (trial >= TOTAL_TRIALS) { endTest(); return; }
        state = STATE.INTERVAL;
        handled = false;
        stimulusStart = 0;
        sw.reset();
        renderCircle('准备', 'circle-interval', '第 ' + (trial + 1) + ' / ' + TOTAL_TRIALS + ' 次');
        flowTip('准备…等待信号出现', 'gray');
        clearTimer();
        timer = setTimeout(startTrial, RL.randInt(MIN_INTERVAL, MAX_INTERVAL));
    }

    function startTrial() {
        trial++;
        progress.textContent = '第 ' + trial + ' / ' + TOTAL_TRIALS + ' 次';
        isGo = Math.random() < GO_PROBABILITY;
        handled = false;
        stimulusStart = 0;
        state = STATE.STIMULUS;

        if (isGo) {
            goCount++;
            renderCircle('GO！', 'circle-go', '立即点击');
            flowTip('绿色：立即点击', 'green');
        } else {
            noGoCount++;
            renderCircle('NO-GO', 'circle-nogo', '不要点击');
            flowTip('红色：不要点击', 'red');
        }

        /* 关键：起点取「刺激已上屏」那一帧的时间戳 */
        RL.afterPaint(function (ts) {
            if (state !== STATE.STIMULUS || handled) return;
            stimulusStart = ts || performance.now();
            sw.mark(stimulusStart);
        });

        clearTimer();
        timer = setTimeout(function () {
            if (state !== STATE.STIMULUS) return;
            handled = true;
            sw.reset();
            if (!isGo) {
                noGoCorrect++;                 // 忍住了 = 正确抑制
                flowTip('正确抑制！', 'green');
            } else {
                flowTip('错过 GO 信号', 'orange');
            }
            next();
        }, RL.randInt(MIN_STIMULUS, MAX_STIMULUS));
    }

    function next() {
        if (trial >= TOTAL_TRIALS) { endTest(); return; }
        showInterval();
    }

    function startTest() {
        resetCounters();
        renderCircle('准备', 'circle-interval', '测试开始');
        flowTip('测试开始！绿色点击，红色忍住', 'yellow');
        showInterval();
    }

    function endTest() {
        clearTimer();
        state = STATE.DONE;
        sw.reset();
        stimulusStart = 0;

        /* 没出现过的类型记 null（显示 -- %），不要用 0 去污染显示与最佳成绩 */
        var goRate = goCount ? (goCorrect / goCount) * 100 : null;
        var noGoRate = noGoCount ? (noGoCorrect / noGoCount) * 100 : null;
        var a = RL.avg(goTimes);

        goRateEl.textContent = RL.fmtPct(goRate);
        noGoRateEl.textContent = RL.fmtPct(noGoRate);
        avgRTEl.textContent = RL.fmtMs(a);

        if (noGoRate !== null) best.noGoRate = RL.betterHigher(best.noGoRate, noGoRate);
        if (a !== null) best.avgRT = RL.betterLower(best.avgRT, a);
        saveBest();
        renderBest();

        renderCircle('完成', 'circle-wait', 'Go ' + goCorrect + '/' + goCount + ' · No-Go ' + noGoCorrect + '/' + noGoCount);
        flowTip('测试结束 · 2 秒后可重新开始', 'yellow');
        progress.textContent = '';

        setTimeout(function () {
            if (state === STATE.DONE) { state = STATE.IDLE; resetUI(); }
        }, RESET_DELAY);
    }

    /* ---------- 失焦保护 ---------- */
    RL.onFocusLost(function () {
        if (state === STATE.IDLE || state === STATE.DONE) return;
        clearTimer();
        sw.reset();
        state = STATE.IDLE;
        resetCounters();
        resetUI();
        flowTip('检测到切换窗口 · 本次作废 · 点击或按空格重新开始', 'red');
    });

    /* ---------- 交互 ---------- */
    RL.onActivate(function () {
        if (state === STATE.DONE) return;

        if (state === STATE.IDLE) { startTest(); return; }

        if (state === STATE.INTERVAL) {
            flowTip('等待信号出现，稍安勿躁', 'gray');
            return;
        }

        if (state === STATE.STIMULUS && !handled) {
            /* 刺激还没上屏就点击：属于提前反应，本次记为错误 */
            if (!stimulusStart) {
                handled = true;
                clearTimer();
                sw.reset();
                renderCircle('过早反应', 'circle-nogo', '信号未出现');
                flowTip('信号还没出现就点击，本次失败', 'red');
                setTimeout(next, 600);
                return;
            }

            handled = true;
            clearTimer();

            if (isGo) {
                var rt = Math.round(performance.now() - stimulusStart);
                sw.stop();
                stimulusStart = 0;
                goTimes.push(rt);
                goCorrect++;
                renderCircle(rt + ' ms', 'circle-go');
                flowTip('反应时间：' + rt + ' ms', 'green');
            } else {
                sw.reset();
                stimulusStart = 0;
                renderCircle('错误！', 'circle-nogo', '红色不应点击');
                flowTip('红色不应点击，本次失败', 'red');
            }
            setTimeout(next, 600);
        }
    });

    renderBest();
    resetUI();
})();
