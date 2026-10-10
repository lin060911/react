/* ============================================================
   recognize.js — 辨别反应测试（按颜色 + 形状锁定目标图形）
   计时规则：以「本组图形真正绘制到屏幕」的那一帧为起点。
   统计口径：一组 = 一次点击。点错同样消耗一组，只影响准确率，
             因此准确率恒等于 正确数 / 总组数，不可能超过 100%。
   ============================================================ */
(function () {
    'use strict';

    var box      = RL.$('gameContainer');
    var timerEl  = RL.$('timer');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');

    var currentAvgEl       = RL.$('currentAvg');
    var currentAccuracyEl  = RL.$('currentAccuracy');
    var currentCountEl     = RL.$('currentCount');
    var bestAvgEl          = RL.$('bestAvg');
    var bestAccuracyEl     = RL.$('bestAccuracy');

    var SHAPES = [
        { name: '圆形', cls: 'shape-circle' },
        { name: '正方形', cls: 'shape-square' },
        { name: '三角形', cls: 'shape-triangle' },
        { name: '菱形', cls: 'shape-diamond' },
        { name: '圆环', cls: 'shape-ring' },
        { name: '五边形', cls: 'shape-pentagon' },
        { name: '六边形', cls: 'shape-hexagon' },
        { name: '四角星', cls: 'shape-four-star' },
        { name: '五角星', cls: 'shape-five-star' }
    ];
    var COLORS = [
        { name: '红色', value: '#fd4b4b' },
        { name: '橙色', value: '#ff8f49' },
        { name: '黄色', value: '#f4ff57' },
        { name: '绿色', value: '#3eff48' },
        { name: '蓝色', value: '#3f88fd' },
        { name: '白色', value: '#f0f0f0' }
    ];

    var TOTAL_ROUNDS = 15;
    var MIN_SHAPES = 4;
    var MAX_SHAPES = 8;
    var COOLDOWN = 420;

    var sw = RL.Stopwatch(timerEl);

    var playing = false;
    var armed = false;        // 本组图形已上屏，处于可测量状态
    var cooling = false;
    var ended = false;
    var round = 0;            // 已完成组数（对错都算）
    var hitTimes = [];        // 仅正确时的用时
    var hitCount = 0;         // 正确组数
    var pending = null;
    var target = null;

    var best = {
        avg: RL.store.get('recognize.avg', 'discriminationBestAvg'),
        accuracy: RL.store.get('recognize.accuracy', 'discriminationBestAccuracy')
    };

    /* ---------- 渲染 ---------- */
    function renderCurrent() {
        currentAvgEl.textContent = RL.fmtMs(RL.avg(hitTimes));
        var acc = round > 0 ? (hitCount / round) * 100 : null;
        currentAccuracyEl.textContent = RL.fmtPct(acc);
        currentCountEl.textContent = round + ' / ' + TOTAL_ROUNDS;
    }

    function renderBest() {
        bestAvgEl.textContent = RL.fmtMs(best.avg);
        bestAccuracyEl.textContent = RL.fmtPct(best.accuracy);
    }

    /* 图形尺寸跟着舞台一起放大（舞台现在占屏幕大部分高度） */
    function shapeSize() {
        var w = box.clientWidth || 1180;
        return Math.round(Math.max(52, Math.min(118, w / 11)));
    }

    /* ---------- 一组 ---------- */
    function clearStage() {
        var nodes = box.querySelectorAll('.shape');
        for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    }

    function buildShape(shape, color, isCorrect, size) {
        var node = document.createElement('div');
        node.className = 'shape ' + shape.cls;
        node.dataset.correct = isCorrect ? 'true' : 'false';

        if (shape.cls === 'shape-triangle') {
            node.style.borderLeftWidth = (size / 2) + 'px';
            node.style.borderRightWidth = (size / 2) + 'px';
            node.style.borderBottomWidth = (size * 0.87) + 'px';
            node.style.borderBottomColor = color.value;
        } else if (shape.cls === 'shape-ring') {
            node.style.width = size + 'px';
            node.style.height = size + 'px';
            node.style.borderWidth = Math.max(6, Math.round(size * 0.16)) + 'px';
            node.style.borderColor = color.value;
        } else {
            node.style.width = size + 'px';
            node.style.height = size + 'px';
            node.style.backgroundColor = color.value;
        }
        return node;
    }

    function showRound() {
        if (!playing) return;
        clearStage();
        armed = false;
        sw.reset();

        var count = RL.randInt(MIN_SHAPES, MAX_SHAPES);
        var tColor = RL.pick(COLORS);
        var tShape = RL.pick(SHAPES);
        target = { color: tColor, shape: tShape };

        var size = shapeSize();
        var pts = RL.scatter(box, count, size);

        flowTip('选择 [ ' + tColor.name + ' ] 的 [ ' + tShape.name + ' ]', 'imp');
        progress.textContent = '第 ' + (round + 1) + ' / ' + TOTAL_ROUNDS + ' 组 · 图形 ' + count + ' 个';

        var correctIndex = RL.randInt(0, count - 1);
        for (var i = 0; i < count; i++) {
            var isCorrect = (i === correctIndex);
            var shape, color;
            if (isCorrect) {
                shape = tShape;
                color = tColor;
            } else {
                /* 干扰项：不允许与目标完全相同 */
                do {
                    shape = RL.pick(SHAPES);
                    color = RL.pick(COLORS);
                } while (shape.name === tShape.name && color.name === tColor.name);
            }

            var node = buildShape(shape, color, isCorrect, size);
            node.style.left = pts[i].x + 'px';
            node.style.top = pts[i].y + 'px';
            node.addEventListener('click', onClick);
            node.addEventListener('touchstart', function (e) {
                e.preventDefault();
                onClick.call(this, e);
            }, { passive: false });
            /* 直接插入即可见：不使用淡入 / 缩放动画，避免影响反应计时 */
            box.appendChild(node);
        }

        /* 关键：起点取「图形已上屏」那一帧的时间戳 */
        RL.afterPaint(function (ts) {
            if (!playing || ended || armed) return;
            armed = true;
            sw.mark(ts || performance.now());
        });
    }

    function onClick(e) {
        e.stopPropagation();
        if (!playing || cooling || ended) return;
        if (!armed) return;                 // 未上屏的点击不计入成绩

        var cost = sw.stop();
        armed = false;
        var isCorrect = this.dataset.correct === 'true';
        this.classList.add(isCorrect ? 'correct' : 'wrong');

        round++;
        if (isCorrect) {
            hitTimes.push(cost);
            hitCount++;
            flowTip('正确！用时 ' + cost + ' ms', 'green');
        } else {
            flowTip('错误！目标：' + target.color.name + '的' + target.shape.name, 'red');
        }
        renderCurrent();

        cooling = true;
        if (round >= TOTAL_ROUNDS) { pending = setTimeout(finish, COOLDOWN); return; }
        pending = setTimeout(function () { cooling = false; showRound(); }, COOLDOWN);
    }

    /* ---------- 流程 ---------- */
    function startGame() {
        clearTimeout(pending);
        playing = true;
        armed = false;
        ended = false;
        cooling = false;
        round = 0;
        hitTimes = [];
        hitCount = 0;
        sw.reset();
        clearStage();
        renderCurrent();
        progress.textContent = '';
        flowTip('测试开始！寻找目标图形', 'yellow');
        pending = setTimeout(showRound, 420);
    }

    function abort(reason) {
        clearTimeout(pending);
        playing = false;
        armed = false;
        cooling = false;
        ended = true;
        sw.reset();
        clearStage();
        progress.textContent = '';
        flowTip(reason + ' · 按空格或点击屏幕重新开始', 'red');
    }

    function finish() {
        playing = false;
        armed = false;
        ended = true;
        cooling = false;      // 必须解锁，否则结束后点击 / 空格永远无法重开
        clearStage();
        sw.reset();

        var a = RL.avg(hitTimes);
        /* 准确率 = 正确组数 / 实际完成组数，天然不超过 100% */
        var acc = round > 0 ? (hitCount / round) * 100 : null;
        if (a !== null) best.avg = RL.betterLower(best.avg, a);
        if (acc !== null) best.accuracy = RL.betterHigher(best.accuracy, acc);
        if (a !== null) RL.store.set('recognize.avg', Math.round(best.avg));
        if (acc !== null) RL.store.set('recognize.accuracy', Math.round(best.accuracy));
        renderBest();

        progress.textContent = '测试完成 · 共 ' + round + ' 组';
        flowTip('测试结束！准确率 ' + Math.round(acc || 0) + '% · 按空格或点击屏幕重来', 'yellow');
    }

    /* ---------- 失焦保护 ---------- */
    RL.onFocusLost(function () {
        if (!playing && !cooling) return;
        abort('检测到切换窗口 · 本次作废');
    });

    RL.onActivate(function () {
        if (cooling) return;
        if (playing) return;
        startGame();
    });

    renderCurrent();
    renderBest();
})();
