// node_modules/.pnpm/hookable@5.4.2/node_modules/hookable/dist/index.mjs
function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === "object" && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === "function") {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
function mergeHooks(...hooks) {
  const finalHooks = {};
  for (const hook of hooks) {
    const flatenHook = flatHooks(hook);
    for (const key in flatenHook) {
      if (finalHooks[key]) {
        finalHooks[key].push(flatenHook[key]);
      } else {
        finalHooks[key] = [flatenHook[key]];
      }
    }
  }
  for (const key in finalHooks) {
    if (finalHooks[key].length > 1) {
      const array = finalHooks[key];
      finalHooks[key] = (...arguments_) => serial(array, (function_) => function_(...arguments_));
    } else {
      finalHooks[key] = finalHooks[key][0];
    }
  }
  return finalHooks;
}
function serial(tasks, function_) {
  return tasks.reduce((promise, task) => promise.then(() => function_(task)), Promise.resolve());
}
function serialCaller(hooks, arguments_) {
  return hooks.reduce((promise, hookFunction) => promise.then(() => hookFunction.apply(void 0, arguments_)), Promise.resolve());
}
function parallelCaller(hooks, arguments_) {
  return Promise.all(hooks.map((hook) => hook.apply(void 0, arguments_)));
}
function callEachWith(callbacks, argument0) {
  for (const callback of callbacks) {
    callback(argument0);
  }
}
var Hookable = class {
  constructor() {
    this._hooks = {};
    this._before = void 0;
    this._after = void 0;
    this._deprecatedMessages = void 0;
    this._deprecatedHooks = {};
    this.hook = this.hook.bind(this);
    this.callHook = this.callHook.bind(this);
    this.callHookWith = this.callHookWith.bind(this);
  }
  hook(name, function_, options = {}) {
    if (!name || typeof function_ !== "function") {
      return () => {
      };
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    this._hooks[name] = this._hooks[name] || [];
    this._hooks[name].push(function_);
    return () => {
      if (function_) {
        this.removeHook(name, function_);
        function_ = void 0;
      }
    };
  }
  hookOnce(name, function_) {
    let _unreg;
    let _function = (...arguments_) => {
      if (typeof _unreg === "function") {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    this._hooks[name] = void 0;
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  callHook(name, ...arguments_) {
    return this.callHookWith(serialCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    return this.callHookWith(parallelCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(this._hooks[name] || [], arguments_);
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      const index = this._before.indexOf(function_);
      if (index !== -1) {
        this._before.splice(index, 1);
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      const index = this._after.indexOf(function_);
      if (index !== -1) {
        this._after.splice(index, 1);
      }
    };
  }
};
function createHooks() {
  return new Hookable();
}
var isBrowser = typeof window !== "undefined";
function createDebugger(hooks, _options = {}) {
  const options = {
    inspect: isBrowser,
    group: isBrowser,
    filter: () => true,
    ..._options
  };
  const _filter = options.filter;
  const filter = typeof _filter === "string" ? (name) => name.startsWith(_filter) : _filter;
  const _tag = options.tag ? `[${options.tag}] ` : "";
  const logPrefix = (event) => _tag + event.name + "".padEnd(event._id, "\0");
  const _idCtr = {};
  const unsubscribeBefore = hooks.beforeEach((event) => {
    if (!filter(event.name)) {
      return;
    }
    _idCtr[event.name] = _idCtr[event.name] || 0;
    event._id = _idCtr[event.name]++;
    console.time(logPrefix(event));
  });
  const unsubscribeAfter = hooks.afterEach((event) => {
    if (!filter(event.name)) {
      return;
    }
    if (options.group) {
      console.groupCollapsed(event.name);
    }
    if (options.inspect) {
      console.timeLog(logPrefix(event), event.args);
    } else {
      console.timeEnd(logPrefix(event));
    }
    if (options.group) {
      console.groupEnd();
    }
    _idCtr[event.name]--;
  });
  return {
    close: () => {
      unsubscribeBefore();
      unsubscribeAfter();
    }
  };
}
export {
  Hookable,
  createDebugger,
  createHooks,
  flatHooks,
  mergeHooks,
  parallelCaller,
  serial,
  serialCaller
};
//# sourceMappingURL=hookable.js.map
