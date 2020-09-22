
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    function create_animation(node, from, fn, params) {
        if (!from)
            return noop;
        const to = node.getBoundingClientRect();
        if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
            return noop;
        const { delay = 0, duration = 300, easing = identity, 
        // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
        start: start_time = now() + delay, 
        // @ts-ignore todo:
        end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
        let running = true;
        let started = false;
        let name;
        function start() {
            if (css) {
                name = create_rule(node, 0, 1, duration, delay, easing, css);
            }
            if (!delay) {
                started = true;
            }
        }
        function stop() {
            if (css)
                delete_rule(node, name);
            running = false;
        }
        loop(now => {
            if (!started && now >= start_time) {
                started = true;
            }
            if (started && now >= end) {
                tick(1, 0);
                stop();
            }
            if (!running) {
                return false;
            }
            if (started) {
                const p = now - start_time;
                const t = 0 + 1 * easing(p / duration);
                tick(t, 1 - t);
            }
            return true;
        });
        start();
        tick(0, 1);
        return stop;
    }
    function fix_position(node) {
        const style = getComputedStyle(node);
        if (style.position !== 'absolute' && style.position !== 'fixed') {
            const { width, height } = style;
            const a = node.getBoundingClientRect();
            node.style.position = 'absolute';
            node.style.width = width;
            node.style.height = height;
            add_transform(node, a);
        }
    }
    function add_transform(node, a) {
        const b = node.getBoundingClientRect();
        if (a.left !== b.left || a.top !== b.top) {
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function fix_and_outro_and_destroy_block(block, lookup) {
        block.f();
        outro_and_destroy_block(block, lookup);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.25.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    async function call (rpc, method, params) {
      return fetch(rpc, {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params
        }),
        headers: {
          'Content-Type': 'application/json'
        },
      }).then(function(response) {
        return response.json();
      }).then(function(json) {
        return json.result;
      })
    }

    /* src/Wallet.svelte generated by Svelte v3.25.1 */

    const { console: console_1 } = globals;
    const file = "src/Wallet.svelte";

    // (1:0) <script>     import { call }
    function create_catch_block_2(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_2.name,
    		type: "catch",
    		source: "(1:0) <script>     import { call }",
    		ctx
    	});

    	return block;
    }

    // (68:61) <strong>{balance}
    function create_then_block_2(ctx) {
    	let strong;
    	let t0_value = /*balance*/ ctx[5] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			strong = element("strong");
    			t0 = text(t0_value);
    			t1 = text(" Nibble");
    			add_location(strong, file, 67, 61, 1538);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, strong, anchor);
    			append_dev(strong, t0);
    			append_dev(strong, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*balance*/ 32 && t0_value !== (t0_value = /*balance*/ ctx[5] + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(strong);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_2.name,
    		type: "then",
    		source: "(68:61) <strong>{balance}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { call }
    function create_pending_block_2(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_2.name,
    		type: "pending",
    		source: "(1:0) <script>     import { call }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { call }
    function create_catch_block_1(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_1.name,
    		type: "catch",
    		source: "(1:0) <script>     import { call }",
    		ctx
    	});

    	return block;
    }

    // (69:62) <input type="text" readonly style="width: 170px;" value={pubKey}
    function create_then_block_1(ctx) {
    	let input;
    	let input_value_value;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "text");
    			input.readOnly = true;
    			set_style(input, "width", "170px");
    			input.value = input_value_value = /*pubKey*/ ctx[4];
    			add_location(input, file, 68, 62, 1649);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pubKey*/ 16 && input_value_value !== (input_value_value = /*pubKey*/ ctx[4]) && input.value !== input_value_value) {
    				prop_dev(input, "value", input_value_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_1.name,
    		type: "then",
    		source: "(69:62) <input type=\\\"text\\\" readonly style=\\\"width: 170px;\\\" value={pubKey}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { call }
    function create_pending_block_1(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_1.name,
    		type: "pending",
    		source: "(1:0) <script>     import { call }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { call }
    function create_catch_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script>     import { call }",
    		ctx
    	});

    	return block;
    }

    // (79:48) <input type="text" readonly style="width: 170px;" value={randomPubKey}
    function create_then_block(ctx) {
    	let input;
    	let input_value_value;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "text");
    			input.readOnly = true;
    			set_style(input, "width", "170px");
    			input.value = input_value_value = /*randomPubKey*/ ctx[6];
    			add_location(input, file, 78, 48, 2207);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*randomPubKey*/ 64 && input_value_value !== (input_value_value = /*randomPubKey*/ ctx[6]) && input.value !== input_value_value) {
    				prop_dev(input, "value", input_value_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(79:48) <input type=\\\"text\\\" readonly style=\\\"width: 170px;\\\" value={randomPubKey}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { call }
    function create_pending_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script>     import { call }",
    		ctx
    	});

    	return block;
    }

    // (84:16) {#if !isNaN(pubKeyBalance)}
    function create_if_block(ctx) {
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text(/*pubKeyBalance*/ ctx[3]);
    			t1 = text(" Nibble");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pubKeyBalance*/ 8) set_data_dev(t0, /*pubKeyBalance*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(84:16) {#if !isNaN(pubKeyBalance)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div14;
    	let h20;
    	let t1;
    	let div4;
    	let div0;
    	let div1;
    	let promise;
    	let t3;
    	let div2;
    	let div3;
    	let promise_1;
    	let t5;
    	let button0;
    	let t7;
    	let hr0;
    	let t8;
    	let h21;
    	let t10;
    	let div9;
    	let div5;
    	let div6;
    	let input0;
    	let t12;
    	let div7;
    	let div8;
    	let input1;
    	let t14;
    	let button1;
    	let t16;
    	let hr1;
    	let t17;
    	let h22;
    	let t19;
    	let div10;
    	let promise_2;
    	let t20;
    	let button2;
    	let t22;
    	let button3;
    	let t24;
    	let hr2;
    	let t25;
    	let h23;
    	let t27;
    	let div13;
    	let div11;
    	let div12;
    	let input2;
    	let t29;
    	let button4;
    	let t31;
    	let strong;
    	let show_if = !isNaN(/*pubKeyBalance*/ ctx[3]);
    	let mounted;
    	let dispose;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_2,
    		then: create_then_block_2,
    		catch: create_catch_block_2,
    		value: 5
    	};

    	handle_promise(promise = /*balance*/ ctx[5], info);

    	let info_1 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_1,
    		then: create_then_block_1,
    		catch: create_catch_block_1,
    		value: 4
    	};

    	handle_promise(promise_1 = /*pubKey*/ ctx[4], info_1);

    	let info_2 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 6
    	};

    	handle_promise(promise_2 = /*randomPubKey*/ ctx[6], info_2);
    	let if_block = show_if && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Wallet";
    			t1 = space();
    			div4 = element("div");
    			div0 = element("div");
    			div0.textContent = "Balance:";
    			div1 = element("div");
    			info.block.c();
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = "Public Key:";
    			div3 = element("div");
    			info_1.block.c();
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "Copy";
    			t7 = space();
    			hr0 = element("hr");
    			t8 = space();
    			h21 = element("h2");
    			h21.textContent = "Send";
    			t10 = space();
    			div9 = element("div");
    			div5 = element("div");
    			div5.textContent = "To: ";
    			div6 = element("div");
    			input0 = element("input");
    			t12 = space();
    			div7 = element("div");
    			div7.textContent = "Amount:";
    			div8 = element("div");
    			input1 = element("input");
    			t14 = space();
    			button1 = element("button");
    			button1.textContent = "Send";
    			t16 = space();
    			hr1 = element("hr");
    			t17 = space();
    			h22 = element("h2");
    			h22.textContent = "Random Public Key";
    			t19 = space();
    			div10 = element("div");
    			info_2.block.c();
    			t20 = space();
    			button2 = element("button");
    			button2.textContent = "Copy";
    			t22 = space();
    			button3 = element("button");
    			button3.textContent = "New";
    			t24 = space();
    			hr2 = element("hr");
    			t25 = space();
    			h23 = element("h2");
    			h23.textContent = "Get Balance";
    			t27 = space();
    			div13 = element("div");
    			div11 = element("div");
    			div11.textContent = "Public Key:";
    			div12 = element("div");
    			input2 = element("input");
    			t29 = space();
    			button4 = element("button");
    			button4.textContent = "Go";
    			t31 = space();
    			strong = element("strong");
    			if (if_block) if_block.c();
    			add_location(h20, file, 65, 4, 1438);
    			add_location(div0, file, 67, 8, 1485);
    			add_location(div1, file, 67, 27, 1504);
    			add_location(div2, file, 68, 8, 1595);
    			add_location(button0, file, 68, 138, 1725);
    			add_location(div3, file, 68, 30, 1617);
    			attr_dev(div4, "class", "grid svelte-yz4xpt");
    			add_location(div4, file, 66, 4, 1458);
    			add_location(hr0, file, 70, 4, 1790);
    			add_location(h21, file, 71, 4, 1801);
    			add_location(div5, file, 73, 8, 1846);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Receiver pubkey");
    			add_location(input0, file, 73, 28, 1866);
    			add_location(div6, file, 73, 23, 1861);
    			add_location(div7, file, 74, 8, 1956);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "placeholder", "Enter amount to send");
    			add_location(input1, file, 74, 31, 1979);
    			add_location(button1, file, 74, 114, 2062);
    			add_location(div8, file, 74, 26, 1974);
    			attr_dev(div9, "class", "grid svelte-yz4xpt");
    			add_location(div9, file, 72, 4, 1819);
    			add_location(hr1, file, 76, 4, 2121);
    			add_location(h22, file, 77, 4, 2132);
    			add_location(button2, file, 78, 130, 2289);
    			add_location(button3, file, 78, 180, 2339);
    			add_location(div10, file, 78, 4, 2163);
    			add_location(hr2, file, 79, 4, 2402);
    			add_location(h23, file, 80, 4, 2413);
    			add_location(div11, file, 82, 8, 2465);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "placeholder", "pubkey");
    			add_location(input2, file, 82, 35, 2492);
    			add_location(button4, file, 82, 105, 2562);
    			add_location(div12, file, 82, 30, 2487);
    			add_location(strong, file, 83, 8, 2618);
    			attr_dev(div13, "class", "grid svelte-yz4xpt");
    			add_location(div13, file, 81, 4, 2438);
    			attr_dev(div14, "class", "wallet svelte-yz4xpt");
    			add_location(div14, file, 64, 0, 1413);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div14, anchor);
    			append_dev(div14, h20);
    			append_dev(div14, t1);
    			append_dev(div14, div4);
    			append_dev(div4, div0);
    			append_dev(div4, div1);
    			info.block.m(div1, info.anchor = null);
    			info.mount = () => div1;
    			info.anchor = null;
    			append_dev(div4, t3);
    			append_dev(div4, div2);
    			append_dev(div4, div3);
    			info_1.block.m(div3, info_1.anchor = null);
    			info_1.mount = () => div3;
    			info_1.anchor = t5;
    			append_dev(div3, t5);
    			append_dev(div3, button0);
    			append_dev(div14, t7);
    			append_dev(div14, hr0);
    			append_dev(div14, t8);
    			append_dev(div14, h21);
    			append_dev(div14, t10);
    			append_dev(div14, div9);
    			append_dev(div9, div5);
    			append_dev(div9, div6);
    			append_dev(div6, input0);
    			set_input_value(input0, /*sendPubKey*/ ctx[0]);
    			append_dev(div9, t12);
    			append_dev(div9, div7);
    			append_dev(div9, div8);
    			append_dev(div8, input1);
    			set_input_value(input1, /*sendAmount*/ ctx[1]);
    			append_dev(div8, t14);
    			append_dev(div8, button1);
    			append_dev(div14, t16);
    			append_dev(div14, hr1);
    			append_dev(div14, t17);
    			append_dev(div14, h22);
    			append_dev(div14, t19);
    			append_dev(div14, div10);
    			info_2.block.m(div10, info_2.anchor = null);
    			info_2.mount = () => div10;
    			info_2.anchor = t20;
    			append_dev(div10, t20);
    			append_dev(div10, button2);
    			append_dev(div10, t22);
    			append_dev(div10, button3);
    			append_dev(div14, t24);
    			append_dev(div14, hr2);
    			append_dev(div14, t25);
    			append_dev(div14, h23);
    			append_dev(div14, t27);
    			append_dev(div14, div13);
    			append_dev(div13, div11);
    			append_dev(div13, div12);
    			append_dev(div12, input2);
    			set_input_value(input2, /*balancePubKey*/ ctx[2]);
    			append_dev(div12, t29);
    			append_dev(div12, button4);
    			append_dev(div13, t31);
    			append_dev(div13, strong);
    			if (if_block) if_block.m(strong, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*copyPubKey*/ ctx[7], false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[13]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[14]),
    					listen_dev(button1, "click", /*send*/ ctx[9], false, false, false),
    					listen_dev(button2, "click", /*copyRandomPubKey*/ ctx[8], false, false, false),
    					listen_dev(button3, "click", /*generateRandomPubKey*/ ctx[10], false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[15]),
    					listen_dev(button4, "click", /*getBalance*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*balance*/ 32 && promise !== (promise = /*balance*/ ctx[5]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[5] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			info_1.ctx = ctx;

    			if (dirty & /*pubKey*/ 16 && promise_1 !== (promise_1 = /*pubKey*/ ctx[4]) && handle_promise(promise_1, info_1)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[4] = info_1.resolved;
    				info_1.block.p(child_ctx, dirty);
    			}

    			if (dirty & /*sendPubKey*/ 1 && input0.value !== /*sendPubKey*/ ctx[0]) {
    				set_input_value(input0, /*sendPubKey*/ ctx[0]);
    			}

    			if (dirty & /*sendAmount*/ 2 && to_number(input1.value) !== /*sendAmount*/ ctx[1]) {
    				set_input_value(input1, /*sendAmount*/ ctx[1]);
    			}

    			info_2.ctx = ctx;

    			if (dirty & /*randomPubKey*/ 64 && promise_2 !== (promise_2 = /*randomPubKey*/ ctx[6]) && handle_promise(promise_2, info_2)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[6] = info_2.resolved;
    				info_2.block.p(child_ctx, dirty);
    			}

    			if (dirty & /*balancePubKey*/ 4 && input2.value !== /*balancePubKey*/ ctx[2]) {
    				set_input_value(input2, /*balancePubKey*/ ctx[2]);
    			}

    			if (dirty & /*pubKeyBalance*/ 8) show_if = !isNaN(/*pubKeyBalance*/ ctx[3]);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(strong, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			info.block.d();
    			info.token = null;
    			info = null;
    			info_1.block.d();
    			info_1.token = null;
    			info_1 = null;
    			info_2.block.d();
    			info_2.token = null;
    			info_2 = null;
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Wallet", slots, []);
    	let { rpc } = $$props;
    	let pubKey;
    	let balance;
    	let sendPubKey;
    	let sendAmount;
    	let balancePubKey;
    	let pubKeyBalance;
    	let randomPubKey;

    	function copyPubKey() {
    		navigator.clipboard.writeText(pubKey);
    	}

    	function copyRandomPubKey() {
    		navigator.clipboard.writeText(randomPubKey);
    	}

    	async function send() {
    		await call(rpc, "send", [sendPubKey, sendAmount]);
    		$$invalidate(1, sendAmount = undefined);
    		$$invalidate(0, sendPubKey = undefined);
    	}

    	async function generateRandomPubKey() {
    		$$invalidate(6, randomPubKey = await call(rpc, "newpubkey", []));
    	}

    	async function getBalance() {
    		$$invalidate(3, pubKeyBalance = await call(rpc, "getbalance", [balancePubKey]));
    		console.log(pubKeyBalance);
    		$$invalidate(2, balancePubKey = null);
    	}

    	(async function () {
    		$$invalidate(4, pubKey = await call(rpc, "getpubkey", []));
    		$$invalidate(5, balance = await call(rpc, "getbalance", [pubKey]));
    		generateRandomPubKey();

    		setInterval(
    			async () => {
    				$$invalidate(5, balance = await call(rpc, "getbalance", [pubKey]));
    			},
    			5000
    		);
    	})();

    	const writable_props = ["rpc"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Wallet> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		sendPubKey = this.value;
    		$$invalidate(0, sendPubKey);
    	}

    	function input1_input_handler() {
    		sendAmount = to_number(this.value);
    		$$invalidate(1, sendAmount);
    	}

    	function input2_input_handler() {
    		balancePubKey = this.value;
    		$$invalidate(2, balancePubKey);
    	}

    	$$self.$$set = $$props => {
    		if ("rpc" in $$props) $$invalidate(12, rpc = $$props.rpc);
    	};

    	$$self.$capture_state = () => ({
    		call,
    		rpc,
    		pubKey,
    		balance,
    		sendPubKey,
    		sendAmount,
    		balancePubKey,
    		pubKeyBalance,
    		randomPubKey,
    		copyPubKey,
    		copyRandomPubKey,
    		send,
    		generateRandomPubKey,
    		getBalance
    	});

    	$$self.$inject_state = $$props => {
    		if ("rpc" in $$props) $$invalidate(12, rpc = $$props.rpc);
    		if ("pubKey" in $$props) $$invalidate(4, pubKey = $$props.pubKey);
    		if ("balance" in $$props) $$invalidate(5, balance = $$props.balance);
    		if ("sendPubKey" in $$props) $$invalidate(0, sendPubKey = $$props.sendPubKey);
    		if ("sendAmount" in $$props) $$invalidate(1, sendAmount = $$props.sendAmount);
    		if ("balancePubKey" in $$props) $$invalidate(2, balancePubKey = $$props.balancePubKey);
    		if ("pubKeyBalance" in $$props) $$invalidate(3, pubKeyBalance = $$props.pubKeyBalance);
    		if ("randomPubKey" in $$props) $$invalidate(6, randomPubKey = $$props.randomPubKey);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		sendPubKey,
    		sendAmount,
    		balancePubKey,
    		pubKeyBalance,
    		pubKey,
    		balance,
    		randomPubKey,
    		copyPubKey,
    		copyRandomPubKey,
    		send,
    		generateRandomPubKey,
    		getBalance,
    		rpc,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Wallet extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { rpc: 12 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Wallet",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*rpc*/ ctx[12] === undefined && !("rpc" in props)) {
    			console_1.warn("<Wallet> was created without expected prop 'rpc'");
    		}
    	}

    	get rpc() {
    		throw new Error("<Wallet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rpc(value) {
    		throw new Error("<Wallet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    function flip(node, animation, params) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        const scaleX = animation.from.width / node.clientWidth;
        const scaleY = animation.from.height / node.clientHeight;
        const dx = (animation.from.left - animation.to.left) / scaleX;
        const dy = (animation.from.top - animation.to.top) / scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
        return {
            delay,
            duration: is_function(duration) ? duration(d) : duration,
            easing,
            css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
        };
    }

    /* src/Explorer.svelte generated by Svelte v3.25.1 */
    const file$1 = "src/Explorer.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (132:8) {:else}
    function create_else_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Empty");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(132:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (117:8) {#if mempool.length}
    function create_if_block_1(ctx) {
    	let table;
    	let thead;
    	let td0;
    	let t1;
    	let td1;
    	let t3;
    	let td2;
    	let t5;
    	let each_value_2 = /*mempool*/ ctx[0];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			thead = element("thead");
    			td0 = element("td");
    			td0.textContent = "From";
    			t1 = space();
    			td1 = element("td");
    			td1.textContent = "To";
    			t3 = space();
    			td2 = element("td");
    			td2.textContent = "Value";
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(td0, "class", "svelte-19rqxfk");
    			add_location(td0, file$1, 119, 16, 2571);
    			attr_dev(td1, "class", "svelte-19rqxfk");
    			add_location(td1, file$1, 120, 16, 2601);
    			attr_dev(td2, "class", "svelte-19rqxfk");
    			add_location(td2, file$1, 121, 16, 2629);
    			attr_dev(thead, "class", "svelte-19rqxfk");
    			add_location(thead, file$1, 118, 12, 2547);
    			attr_dev(table, "class", "table svelte-19rqxfk");
    			add_location(table, file$1, 117, 8, 2513);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, thead);
    			append_dev(thead, td0);
    			append_dev(thead, t1);
    			append_dev(thead, td1);
    			append_dev(thead, t3);
    			append_dev(thead, td2);
    			append_dev(table, t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*mempool*/ 1) {
    				each_value_2 = /*mempool*/ ctx[0];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(117:8) {#if mempool.length}",
    		ctx
    	});

    	return block;
    }

    // (124:12) {#each mempool as item}
    function create_each_block_2(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*item*/ ctx[7].transaction.from + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*item*/ ctx[7].transaction.to + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*item*/ ctx[7].transaction.amount + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			attr_dev(td0, "class", "svelte-19rqxfk");
    			add_location(td0, file$1, 125, 20, 2742);
    			attr_dev(td1, "class", "svelte-19rqxfk");
    			add_location(td1, file$1, 126, 20, 2795);
    			attr_dev(td2, "class", "svelte-19rqxfk");
    			add_location(td2, file$1, 127, 20, 2846);
    			attr_dev(tr, "class", "svelte-19rqxfk");
    			add_location(tr, file$1, 124, 16, 2717);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, t4);
    			append_dev(tr, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*mempool*/ 1 && t0_value !== (t0_value = /*item*/ ctx[7].transaction.from + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*mempool*/ 1 && t2_value !== (t2_value = /*item*/ ctx[7].transaction.to + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*mempool*/ 1 && t4_value !== (t4_value = /*item*/ ctx[7].transaction.amount + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(124:12) {#each mempool as item}",
    		ctx
    	});

    	return block;
    }

    // (140:12) {#each blocks.slice().reverse() as block (block)}
    function create_each_block_1(key_1, ctx) {
    	let button;
    	let t0;
    	let t1_value = /*block*/ ctx[10] + "";
    	let t1;
    	let t2;
    	let button_class_value;
    	let button_intro;
    	let button_outro;
    	let rect;
    	let stop_animation = noop;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			button = element("button");
    			t0 = text("No. ");
    			t1 = text(t1_value);
    			t2 = space();

    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(/*block*/ ctx[10] === /*selectedBlockNumber*/ ctx[2]
    			? "selected"
    			: "") + " svelte-19rqxfk"));

    			add_location(button, file$1, 140, 12, 3158);
    			this.first = button;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			append_dev(button, t2);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*selectBlock*/ ctx[4](/*block*/ ctx[10]))) /*selectBlock*/ ctx[4](/*block*/ ctx[10]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*blocks*/ 2) && t1_value !== (t1_value = /*block*/ ctx[10] + "")) set_data_dev(t1, t1_value);

    			if (!current || dirty & /*blocks, selectedBlockNumber*/ 6 && button_class_value !== (button_class_value = "" + (null_to_empty(/*block*/ ctx[10] === /*selectedBlockNumber*/ ctx[2]
    			? "selected"
    			: "") + " svelte-19rqxfk"))) {
    				attr_dev(button, "class", button_class_value);
    			}
    		},
    		r: function measure() {
    			rect = button.getBoundingClientRect();
    		},
    		f: function fix() {
    			fix_position(button);
    			stop_animation();
    			add_transform(button, rect);
    		},
    		a: function animate() {
    			stop_animation();
    			stop_animation = create_animation(button, rect, flip, {});
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (button_outro) button_outro.end(1);
    				if (!button_intro) button_intro = create_in_transition(button, fade, { delay: 500, duration: 1000 });
    				button_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (button_intro) button_intro.invalidate();
    			button_outro = create_out_transition(button, fly, { x: 100 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching && button_outro) button_outro.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(140:12) {#each blocks.slice().reverse() as block (block)}",
    		ctx
    	});

    	return block;
    }

    // (148:8) {#if selectedBlock}
    function create_if_block$1(ctx) {
    	let div;
    	let p;
    	let t0_value = /*selectedBlock*/ ctx[3].hash + "";
    	let t0;
    	let t1;
    	let table;
    	let thead;
    	let td0;
    	let t3;
    	let td1;
    	let t5;
    	let td2;
    	let t7;
    	let each_value = /*selectedBlock*/ ctx[3].transactions;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			table = element("table");
    			thead = element("thead");
    			td0 = element("td");
    			td0.textContent = "From";
    			t3 = space();
    			td1 = element("td");
    			td1.textContent = "To";
    			t5 = space();
    			td2 = element("td");
    			td2.textContent = "Value";
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(p, file$1, 149, 12, 3517);
    			attr_dev(td0, "class", "svelte-19rqxfk");
    			add_location(td0, file$1, 152, 20, 3627);
    			attr_dev(td1, "class", "svelte-19rqxfk");
    			add_location(td1, file$1, 153, 20, 3661);
    			attr_dev(td2, "class", "svelte-19rqxfk");
    			add_location(td2, file$1, 154, 20, 3693);
    			attr_dev(thead, "class", "svelte-19rqxfk");
    			add_location(thead, file$1, 151, 16, 3599);
    			attr_dev(table, "class", "txs table svelte-19rqxfk");
    			add_location(table, file$1, 150, 12, 3557);
    			attr_dev(div, "class", "block-detail svelte-19rqxfk");
    			add_location(div, file$1, 148, 8, 3478);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(div, t1);
    			append_dev(div, table);
    			append_dev(table, thead);
    			append_dev(thead, td0);
    			append_dev(thead, t3);
    			append_dev(thead, td1);
    			append_dev(thead, t5);
    			append_dev(thead, td2);
    			append_dev(table, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*selectedBlock*/ 8 && t0_value !== (t0_value = /*selectedBlock*/ ctx[3].hash + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*selectedBlock*/ 8) {
    				each_value = /*selectedBlock*/ ctx[3].transactions;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(148:8) {#if selectedBlock}",
    		ctx
    	});

    	return block;
    }

    // (157:16) {#each selectedBlock.transactions as item}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*item*/ ctx[7].transaction.from + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*item*/ ctx[7].transaction.to + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*item*/ ctx[7].transaction.amount + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			attr_dev(td0, "class", "svelte-19rqxfk");
    			add_location(td0, file$1, 158, 24, 3841);
    			attr_dev(td1, "class", "svelte-19rqxfk");
    			add_location(td1, file$1, 159, 24, 3898);
    			attr_dev(td2, "class", "svelte-19rqxfk");
    			add_location(td2, file$1, 160, 24, 3953);
    			attr_dev(tr, "class", "svelte-19rqxfk");
    			add_location(tr, file$1, 157, 20, 3812);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, t4);
    			append_dev(tr, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*selectedBlock*/ 8 && t0_value !== (t0_value = /*item*/ ctx[7].transaction.from + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*selectedBlock*/ 8 && t2_value !== (t2_value = /*item*/ ctx[7].transaction.to + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*selectedBlock*/ 8 && t4_value !== (t4_value = /*item*/ ctx[7].transaction.amount + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(157:16) {#each selectedBlock.transactions as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div3;
    	let h20;
    	let t1;
    	let div0;
    	let t2;
    	let hr;
    	let t3;
    	let h21;
    	let t5;
    	let div2;
    	let div1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t6;
    	let current;

    	function select_block_type(ctx, dirty) {
    		if (/*mempool*/ ctx[0].length) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let each_value_1 = /*blocks*/ ctx[1].slice().reverse();
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*block*/ ctx[10];
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	let if_block1 = /*selectedBlock*/ ctx[3] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Mempool";
    			t1 = space();
    			div0 = element("div");
    			if_block0.c();
    			t2 = space();
    			hr = element("hr");
    			t3 = space();
    			h21 = element("h2");
    			h21.textContent = "Blocks";
    			t5 = space();
    			div2 = element("div");
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			if (if_block1) if_block1.c();
    			add_location(h20, file$1, 114, 4, 2449);
    			add_location(div0, file$1, 115, 4, 2470);
    			add_location(hr, file$1, 135, 4, 2999);
    			add_location(h21, file$1, 136, 4, 3010);
    			attr_dev(div1, "class", "block-list svelte-19rqxfk");
    			add_location(div1, file$1, 138, 8, 3059);
    			attr_dev(div2, "class", "blocks svelte-19rqxfk");
    			add_location(div2, file$1, 137, 4, 3030);
    			attr_dev(div3, "class", "explorer svelte-19rqxfk");
    			add_location(div3, file$1, 113, 0, 2422);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h20);
    			append_dev(div3, t1);
    			append_dev(div3, div0);
    			if_block0.m(div0, null);
    			append_dev(div3, t2);
    			append_dev(div3, hr);
    			append_dev(div3, t3);
    			append_dev(div3, h21);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(div2, t6);
    			if (if_block1) if_block1.m(div2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			}

    			if (dirty & /*blocks, selectedBlockNumber, selectBlock*/ 22) {
    				const each_value_1 = /*blocks*/ ctx[1].slice().reverse();
    				validate_each_argument(each_value_1);
    				group_outros();
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, div1, fix_and_outro_and_destroy_block, create_each_block_1, null, get_each_context_1);
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
    				check_outros();
    			}

    			if (/*selectedBlock*/ ctx[3]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					if_block1.m(div2, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_block0.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Explorer", slots, []);
    	let { rpc } = $$props;
    	let mempool = [];
    	let blocks = [];
    	let selectedBlockNumber;
    	let selectedBlock;

    	async function updateData() {
    		$$invalidate(0, mempool = await call(rpc, "mempool", []));
    		const latest_block = await call(rpc, "blockheight", []);
    		const current_block = blocks[blocks.length - 1];
    		if (latest_block === current_block) return;

    		if (blocks.length) {
    			const block_difference = latest_block - current_block;
    			const newBlocks = [];

    			for (let i = 0; i < block_difference; i++) {
    				const block = current_block + i + 1;
    				newBlocks.push(block);
    			}

    			$$invalidate(1, blocks = [...blocks, ...newBlocks]);
    		} else {
    			$$invalidate(1, blocks = [latest_block]);
    		}
    	}

    	async function selectBlock(block) {
    		$$invalidate(2, selectedBlockNumber = block);
    		$$invalidate(3, selectedBlock = await call(rpc, "getblock", [block]));
    	}

    	(async function () {
    		await updateData();

    		setInterval(
    			async () => {
    				await updateData();
    			},
    			5000
    		);
    	})();

    	const writable_props = ["rpc"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Explorer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("rpc" in $$props) $$invalidate(5, rpc = $$props.rpc);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		fly,
    		flip,
    		call,
    		rpc,
    		mempool,
    		blocks,
    		selectedBlockNumber,
    		selectedBlock,
    		updateData,
    		selectBlock
    	});

    	$$self.$inject_state = $$props => {
    		if ("rpc" in $$props) $$invalidate(5, rpc = $$props.rpc);
    		if ("mempool" in $$props) $$invalidate(0, mempool = $$props.mempool);
    		if ("blocks" in $$props) $$invalidate(1, blocks = $$props.blocks);
    		if ("selectedBlockNumber" in $$props) $$invalidate(2, selectedBlockNumber = $$props.selectedBlockNumber);
    		if ("selectedBlock" in $$props) $$invalidate(3, selectedBlock = $$props.selectedBlock);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [mempool, blocks, selectedBlockNumber, selectedBlock, selectBlock, rpc];
    }

    class Explorer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { rpc: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Explorer",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*rpc*/ ctx[5] === undefined && !("rpc" in props)) {
    			console.warn("<Explorer> was created without expected prop 'rpc'");
    		}
    	}

    	get rpc() {
    		throw new Error("<Explorer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rpc(value) {
    		throw new Error("<Explorer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.25.1 */
    const file$2 = "src/App.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let h1;
    	let t1;
    	let div0;
    	let t2;
    	let input;
    	let t3;
    	let wallet;
    	let updating_rpc;
    	let t4;
    	let explorer;
    	let updating_rpc_1;
    	let current;
    	let mounted;
    	let dispose;

    	function wallet_rpc_binding(value) {
    		/*wallet_rpc_binding*/ ctx[2].call(null, value);
    	}

    	let wallet_props = {};

    	if (/*rpc*/ ctx[0] !== void 0) {
    		wallet_props.rpc = /*rpc*/ ctx[0];
    	}

    	wallet = new Wallet({ props: wallet_props, $$inline: true });
    	binding_callbacks.push(() => bind(wallet, "rpc", wallet_rpc_binding));

    	function explorer_rpc_binding(value) {
    		/*explorer_rpc_binding*/ ctx[3].call(null, value);
    	}

    	let explorer_props = {};

    	if (/*rpc*/ ctx[0] !== void 0) {
    		explorer_props.rpc = /*rpc*/ ctx[0];
    	}

    	explorer = new Explorer({ props: explorer_props, $$inline: true });
    	binding_callbacks.push(() => bind(explorer, "rpc", explorer_rpc_binding));

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "NIBBLE";
    			t1 = space();
    			div0 = element("div");
    			t2 = text("Node: ");
    			input = element("input");
    			t3 = space();
    			create_component(wallet.$$.fragment);
    			t4 = space();
    			create_component(explorer.$$.fragment);
    			attr_dev(h1, "class", "svelte-jdyva7");
    			add_location(h1, file$2, 32, 1, 499);
    			attr_dev(input, "name", "rpc");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Node address");
    			add_location(input, file$2, 34, 8, 542);
    			attr_dev(div0, "class", "rpc svelte-jdyva7");
    			add_location(div0, file$2, 33, 1, 516);
    			attr_dev(div1, "class", "container svelte-jdyva7");
    			add_location(div1, file$2, 31, 0, 474);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, t2);
    			append_dev(div0, input);
    			set_input_value(input, /*rpc*/ ctx[0]);
    			append_dev(div1, t3);
    			mount_component(wallet, div1, null);
    			append_dev(div1, t4);
    			mount_component(explorer, div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[1]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*rpc*/ 1 && input.value !== /*rpc*/ ctx[0]) {
    				set_input_value(input, /*rpc*/ ctx[0]);
    			}

    			const wallet_changes = {};

    			if (!updating_rpc && dirty & /*rpc*/ 1) {
    				updating_rpc = true;
    				wallet_changes.rpc = /*rpc*/ ctx[0];
    				add_flush_callback(() => updating_rpc = false);
    			}

    			wallet.$set(wallet_changes);
    			const explorer_changes = {};

    			if (!updating_rpc_1 && dirty & /*rpc*/ 1) {
    				updating_rpc_1 = true;
    				explorer_changes.rpc = /*rpc*/ ctx[0];
    				add_flush_callback(() => updating_rpc_1 = false);
    			}

    			explorer.$set(explorer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(wallet.$$.fragment, local);
    			transition_in(explorer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(wallet.$$.fragment, local);
    			transition_out(explorer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(wallet);
    			destroy_component(explorer);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let rpc = "http://localhost:1337";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		rpc = this.value;
    		$$invalidate(0, rpc);
    	}

    	function wallet_rpc_binding(value) {
    		rpc = value;
    		$$invalidate(0, rpc);
    	}

    	function explorer_rpc_binding(value) {
    		rpc = value;
    		$$invalidate(0, rpc);
    	}

    	$$self.$capture_state = () => ({ Wallet, Explorer, rpc });

    	$$self.$inject_state = $$props => {
    		if ("rpc" in $$props) $$invalidate(0, rpc = $$props.rpc);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [rpc, input_input_handler, wallet_rpc_binding, explorer_rpc_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
