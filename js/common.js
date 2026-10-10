/* ============================================================
   common.js — Reaction Lab 公共工具库
   统一提供：本地存储 / 计时器 / 提示 / 随机 / 布局 / 事件绑定
   v2：渲染帧计时（afterPaint）+ 失焦保护 + 激活事件排除面板
   ============================================================ */
(function (global) {
    'use strict';

    var NS = 'rl.';   // 统一存储前缀；legacyKey 用于迁移旧版本成绩

    /* ---------- 本地存储 ---------- */
    var store = {
        get: function (key, legacyKey) {
            var v = null;
            try { v = localStorage.getItem(NS + key); } catch (e) { return null; }
            if (v === null && legacyKey) {
                try {
                    v = localStorage.getItem(legacyKey);
                    if (v !== null) localStorage.setItem(NS + key, v);
                } catch (e) { /* ignore */ }
            }
            return v;
        },
        set: function (key, value) {
            try { localStorage.setItem(NS + key, value); } catch (e) { /* ignore */ }
        },
        clearAll: function () {
            try {
                Object.keys(localStorage)
                    .filter(function (k) { return k.indexOf(NS) === 0; })
                    .forEach(function (k) { localStorage.removeItem(k); });
            } catch (e) { /* ignore */ }
        }
    };

    /* ---------- 基础工具 ---------- */
    var $ = function (id) { return document.getElementById(id); };
    var rand = function (min, max) { return Math.random() * (max - min) + min; };
    var randInt = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };
    var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
    var min = function (list) { return list.length ? Math.min.apply(null, list) : null; };
    var avg = function (list) {
        return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : null;
    };

    /* 统一格式化：-- ms / -- % */
    var fmtMs = function (v) {
        return (v === null || v === undefined || v === '--' || v === '' || !isFinite(Number(v)))
            ? '-- ms' : Math.round(Number(v)) + ' ms';
    };
    var fmtPct = function (v) {
        return (v === null || v === undefined || v === '--' || v === '' || !isFinite(Number(v)))
            ? '-- %' : Math.round(Number(v)) + ' %';
    };

    /* ============================================================
       渲染帧工具（准确性核心）
       ------------------------------------------------------------
       ★ 计时锚点（TIME_ANCHOR）—— 这是全站反应时间基准的唯一定义点 ★

       'task'（默认）：起点 = 调用 afterPaint 那一刻的 performance.now()，
                       也就是「刺激的 DOM 改动发生的那一刻」。
                       与旧版以及绝大多数在线反应测试的写法一致，
                       读数可直接横向对比。缺点：改动之后到像素真正出现
                       还隔着本帧剩余时间（高刷屏约 4-9ms），起点略微偏早。

       'frame'       ：起点 = 下一个渲染帧的起始时间戳。
                       更晚、更保守（读数更大），但与常见参照物不可比。

       为什么默认选 'task'：实测反馈「新版本比参照页偏慢约 30ms」。原因是
       参照实现普遍在改动那一刻取时间，而帧时间戳落在这一帧的开头，两者
       相差约一帧（120Hz 下 8.3ms）加上帧内绘制耗时。把锚点对齐到任务时刻
       后，本页与参照页的读数口径一致。

       两个锚点都在「下一个渲染帧的回调」里交付，也就是说：无论选哪个，
       回调运行时刺激的画面都已经可见 —— 这一点是"提前反应"判定的基础，
       与锚点选择无关。
       ============================================================ */

    var TIME_ANCHOR = 'task';   // 'task' | 'frame'

    var frameCbs = [];
    var stamp = 0;
    var frameTick = function (now) { stamp = now; };

    function tick(now) {
        stamp = now;
        if (!frameCbs.length) return;
        var list = frameCbs;
        frameCbs = [];
        for (var i = 0; i < list.length; i++) {
            /* 每项形如 { t: 任务时刻, cb: 回调 } */
            var item = list[i];
            try {
                item.cb(TIME_ANCHOR === 'frame' ? now : item.t);
            } catch (e) { /* 单个回调异常不影响其它 */ }
        }
    }

    function loopOn() {
        if (!frameCbs.length) return;
        if (global.requestAnimationFrame) global.requestAnimationFrame(tick);
        else setTimeout(function () { tick(performance.now()); }, 16);
    }

    /* 最近一帧的时间戳（与 performance.now 同一时间基准） */
    function frameStamp() { return stamp; }
    if (global.requestAnimationFrame) global.requestAnimationFrame(frameTick);

    /* 在下一个渲染帧的回调阶段执行回调。
       此时本次 DOM 改动已经画在屏幕上，因此可以安全地开放作答；
       回调参数按 TIME_ANCHOR 给出计时起点。 */
    function afterPaint(cb) {
        frameCbs.push({ t: performance.now(), cb: cb });
        loopOn();
    }

    /* 强制浏览器立刻结算样式与布局，避免后续读取尺寸拿到过期值 */
    function forceReflow(node) {
        return node ? node.offsetHeight : void 0;
    }

    /* ---------- 提示条 ---------- */
    function Tip(node) {
        return function (text, tone) {
            node.textContent = text || '';
            node.className = 'flow-tip' + (tone ? ' text-' + tone : '');
        };
    }

    /* ---------- 计时器（rAF 驱动，读数平滑） ----------
       计时权威值来自 mark() 记下的帧时间戳，而不是显示循环的起点，
       因此「屏幕读数」与「最终成绩」之间不会出现偏差。 */
    function Stopwatch(node, prefix) {
        var raf = 0;
        var t0 = 0;
        var has = false;
        var label = prefix || '';

        function loop() {
            node.textContent = label + Math.round(performance.now() - t0) + ' ms';
            raf = requestAnimationFrame(loop);
        }

        return {
            /* 开始显示计时（用于不计入成绩的辅助计时器） */
            start: function () {
                cancelAnimationFrame(raf);
                t0 = (stamp || performance.now());
                has = true;
                node.textContent = label + '0 ms';
                node.classList.add('visible');
                raf = requestAnimationFrame(loop);
                return t0;
            },
            /* 用指定帧时间戳作为计时起点（不启动读数循环） */
            mark: function (t) {
                cancelAnimationFrame(raf);
                t0 = (t === undefined ? (stamp || performance.now()) : t);
                has = true;
                node.textContent = label + '0 ms';
                node.classList.add('visible');
                return t0;
            },
            /* 停止并返回毫秒读数；未曾开始则返回 null */
            stop: function () {
                cancelAnimationFrame(raf);
                node.classList.remove('visible');
                if (!has) return null;
                var dt = Math.round(performance.now() - t0);
                has = false;
                return dt < 0 ? 0 : dt;
            },
            /* 读取当前毫秒读数，不停止计时 */
            elapsed: function () {
                return has ? Math.round(performance.now() - t0) : null;
            },
            /* 隐藏读数但继续计时（用于闪现的辅助计时器） */
            mute: function () {
                cancelAnimationFrame(raf);
                node.classList.remove('visible');
            },
            reset: function () {
                cancelAnimationFrame(raf);
                has = false;
                node.classList.remove('visible');
                node.textContent = '';
            }
        };
    }

    /* ---------- 统一激活事件（点击 / 触摸 / 空格） ----------
       以下区域的点击不触发激活，避免误触：
       · [data-passive]        显式声明的被动区（数字键盘、模式开关条）
       · 任何可交互控件         按钮 / 链接 / 开关 / 文本输入
       · .rule-card            规则卡（点击「测试规则」不应开始测试）
       · .result-container     成绩面板
       · .back-link            返回主页 */
    var ACTIVATE_SKIP = '[data-passive], .rule-card, .result-container, .back-link, ' +
                        'button, a, input, select, textarea, label, summary';

    function onActivate(handler) {
        function blocked(node) {
            return !!(node && node.closest && node.closest(ACTIVATE_SKIP));
        }
        function domHandler(e) {
            if (e.type === 'click' && e.button !== undefined && e.button !== 0) return;
            if (blocked(e.target)) return;
            if (e.type === 'touchstart') e.preventDefault();
            handler(e);
        }
        function keyHandler(e) {
            if (e.code !== 'Space' && e.key !== ' ') return;
            e.preventDefault();
            if (blocked(e.target)) return;
            handler(e);
        }
        document.addEventListener('click', domHandler);
        document.addEventListener('touchstart', domHandler, { passive: false });
        document.addEventListener('keydown', keyHandler);
        /* 测试区内禁止滚动，避免触屏滑动导致舞台位移与误触 */
        document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    }

    /* ---------- 失焦保护 ----------
       切标签页 / 切窗口 / 点出页面时，页面可能被浏览器降频甚至冻结，
       离屏时间一旦被算进反应时间就会产生巨大的假成绩。 */
    function onFocusLost(handler) {
        var busy = false;
        function fire() {
            if (busy || document.hidden) return;
            busy = true;
            setTimeout(function () { busy = false; }, 800);
            handler();
        }
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) handler();
        });
        global.addEventListener('blur', fire);
    }

    /* ---------- 布局：在容器内生成尽量分散、互不重叠的坐标 ---------- */
    function scatter(box, count, size, padding) {
        var w = box.clientWidth || box.offsetWidth;
        var h = box.clientHeight || box.offsetHeight;
        var pad = (padding === undefined) ? size * 0.9 : padding;
        var maxX = Math.max(pad, w - pad);
        var maxY = Math.max(pad, h - pad);
        var pts = [];
        var gap = size * 1.75;

        for (var i = 0; i < count; i++) {
            var best = { x: maxX / 2, y: maxY / 2 };
            var bestD = -1;
            for (var k = 0; k < 160; k++) {
                var p = { x: rand(pad, maxX), y: rand(pad, maxY) };
                var d = Infinity;
                for (var j = 0; j < pts.length; j++) {
                    d = Math.min(d, Math.hypot(p.x - pts[j].x, p.y - pts[j].y));
                }
                if (d > bestD) { bestD = d; best = p; }
                if (d >= gap) break;
            }
            pts.push(best);
            /* 自适应放宽间距要求，保证一定能放下 */
            if (bestD < gap) gap = Math.max(size * 0.85, bestD * 0.9);
        }
        return pts;
    }

    /* ---------- 成绩对比：越小越好 / 越大越好 ---------- */
    function betterLower(saved, current) {
        return (saved === null || saved === '--' || Number(current) < Number(saved))
            ? Number(current) : Number(saved);
    }
    function betterHigher(saved, current) {
        return (saved === null || saved === '--' || Number(current) > Number(saved))
            ? Number(current) : Number(saved);
    }

    global.RL = {
        store: store,
        $: $,
        rand: rand,
        randInt: randInt,
        pick: pick,
        min: min,
        avg: avg,
        fmtMs: fmtMs,
        fmtPct: fmtPct,
        Tip: Tip,
        Stopwatch: Stopwatch,
        onActivate: onActivate,
        onFocusLost: onFocusLost,
        afterPaint: afterPaint,
        frameStamp: frameStamp,
        forceReflow: forceReflow,
        scatter: scatter,
        betterLower: betterLower,
        betterHigher: betterHigher
    };
})(window);
