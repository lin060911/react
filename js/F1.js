/* ============================================================
   F1.js — F1 发车反应测试（五盏红灯依次亮起 → 熄灭瞬间发车）
   ============================================================ */
(function () {
    'use strict';

    var lights    = document.querySelectorAll('.f1-light');
    var resultEl  = RL.$('result');
    var timerEl   = RL.$('timer');
    var flowTip   = RL.Tip(RL.$('flowTip'));
    var bestEl    = RL.$('bestRecord');
    var greenMode = RL.$('greenModeToggle');
    var soundMode = RL.$('soundModeToggle');

    var sw = RL.Stopwatch(timerEl);

    var LIGHT_INTERVAL = 800;      // 每盏灯间隔
    var MIN_GO_DELAY = 500;        // 全亮后随机等待
    var MAX_GO_DELAY = 3000;
    var HUMAN_MIN_REACTION = 100;  // 低于此值判定抢跑
    var COOLDOWN = 1500;

    var running = false;    // 灯序进行中
    var measured = false;   // 已进入可测量状态（发车画面确实上屏）
    var goStamp = 0;        // 发车时刻（0 表示尚未发车）
    var cooling = false;
    var lightTimer = null;
    var goTimer = null;
    var audioCtx = null;

    var best = RL.store.get('f1.best');

    /* ---------- 渲染 ---------- */
    function renderResult(text, tone) {
        resultEl.textContent = text;
        resultEl.className = 'result-big' + (tone ? ' text-' + tone : '');
    }

    function renderBest() {
        bestEl.textContent = '最快成绩：' + RL.fmtMs(best);
    }

    function clearLights() {
        for (var i = 0; i < lights.length; i++) {
            lights[i].className = 'f1-light';
        }
    }

    /* 规则文字直接写在规则卡里，这里只按模式更新舞台底部提示 */
    function renderTip() {
        flowTip(greenMode.checked
            ? '红灯全亮后变绿 · 变绿瞬间点击'
            : '红灯全亮后熄灭 · 熄灭瞬间点击', 'gray');
    }

    /* ---------- 声音 ---------- */
    function beep(freq, dur, vol, type) {
        if (!soundMode.checked) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = type || 'sawtooth';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + dur);
        } catch (e) { /* ignore */ }
    }

    /* ---------- 流程 ---------- */
    function reset() {
        clearInterval(lightTimer);
        clearTimeout(goTimer);
        clearLights();
        sw.reset();
        running = false;
        measured = false;
        goStamp = 0;
    }

    function startTest() {
        reset();
        running = true;
        renderResult(greenMode.checked ? '等待红灯变绿' : '等待红灯熄灭', 'yellow');
        flowTip('集中注意力，盯住信号灯', 'gray');

        var i = 0;
        lightTimer = setInterval(function () {
            if (i < lights.length) {
                lights[i].classList.add('active');
                beep(220, 0.1, 0.08);
                i++;
                return;
            }
            clearInterval(lightTimer);
            goTimer = setTimeout(function () {
                if (!running) return;
                if (greenMode.checked) {
                    for (var k = 0; k < lights.length; k++) {
                        lights[k].classList.remove('active');
                        lights[k].classList.add('green');
                    }
                } else {
                    clearLights();
                }
                beep(990, 0.35, 0.16);
                renderResult('发车！', 'green');
                /* 关键：等发车画面真正上屏的那一帧再取起点，
                   否则起点会早于人眼看到信号约一帧，成绩系统性偏快。 */
                RL.afterPaint(function (ts) {
                    if (!running || goStamp !== 0) return;
                    goStamp = ts || performance.now();
                    measured = true;
                    sw.mark(goStamp);
                });
            }, RL.rand(MIN_GO_DELAY, MAX_GO_DELAY));
        }, LIGHT_INTERVAL);
    }

    function judge() {
        /* 画面还没上屏就点击 = 抢跑 */
        if (!measured) {
            reset();
            renderResult('提前发车 · 判罚', 'red');
            flowTip('信号未出现就点击，本次抢跑', 'red');
            cooldown();
            return;
        }

        var reaction = Math.round(performance.now() - goStamp);
        sw.stop();
        clearInterval(lightTimer);
        clearTimeout(goTimer);
        clearLights();
        running = false;
        measured = false;
        goStamp = 0;

        if (reaction < HUMAN_MIN_REACTION) {
            renderResult('❌ 无效成绩（< 100 ms）', 'red');
            flowTip('低于人类极限反应，本次不计入成绩', 'red');
        } else {
            renderResult(reaction + ' ms', 'green');
            flowTip('发车反应：' + reaction + ' ms', 'green');
            best = RL.betterLower(best, reaction);
            RL.store.set('f1.best', best);
            renderBest();
        }
        cooldown();
    }

    function cooldown() {
        cooling = true;
        setTimeout(function () {
            cooling = false;
            renderResult('点击屏幕或按空格键开始', 'gray');
            flowTip(greenMode.checked ? '红灯全亮后变绿 · 变绿瞬间点击'
                                      : '红灯全亮后熄灭 · 熄灭瞬间点击', 'gray');
        }, COOLDOWN);
    }

    /* ---------- 失焦保护：切走即作废本次 ---------- */
    RL.onFocusLost(function () {
        if (!running && !cooling) return;
        reset();
        cooling = false;
        renderResult('检测到切换窗口 · 本次作废', 'red');
        flowTip('离开页面会严重影响计时，请重新开始', 'red');
    });

    /* ---------- 交互 ---------- */
    RL.onActivate(function () {
        if (cooling) return;
        if (!running) { startTest(); return; }
        judge();
    });

    greenMode.addEventListener('change', renderTip);
    renderTip();
    renderBest();
})();
