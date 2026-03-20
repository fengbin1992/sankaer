"use strict";
(() => {
  // assets/scripts/core/EventManager.ts
  var EventManager = class _EventManager {
    constructor() {
      this._listeners = /* @__PURE__ */ new Map();
    }
    static get instance() {
      if (!this._instance) {
        this._instance = new _EventManager();
      }
      return this._instance;
    }
    init() {
      this._listeners.clear();
    }
    /** 注册事件监听 */
    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
    }
    /** 注销事件监听 */
    off(event, callback) {
      const callbacks = this._listeners.get(event);
      if (!callbacks) return;
      const idx = callbacks.indexOf(callback);
      if (idx >= 0) {
        callbacks.splice(idx, 1);
      }
    }
    /** 触发事件 */
    emit(event, ...args) {
      const callbacks = this._listeners.get(event);
      if (!callbacks) return;
      for (const cb of callbacks) {
        cb(...args);
      }
    }
    /** 只监听一次 */
    once(event, callback) {
      const wrapper = (...args) => {
        callback(...args);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    }
  };

  // assets/scripts/core/StorageManager.ts
  var StorageManager = class _StorageManager {
    constructor() {
      this._prefix = "sankaer_";
    }
    static get instance() {
      if (!this._instance) {
        this._instance = new _StorageManager();
      }
      return this._instance;
    }
    init() {
    }
    /** 保存字符串 */
    set(key, value) {
      try {
        if (typeof wx !== "undefined") {
          wx.setStorageSync(this._prefix + key, value);
        } else {
          localStorage.setItem(this._prefix + key, value);
        }
      } catch (e) {
        console.error("StorageManager.set failed:", e);
      }
    }
    /** 读取字符串 */
    get(key) {
      try {
        if (typeof wx !== "undefined") {
          return wx.getStorageSync(this._prefix + key) || null;
        } else {
          return localStorage.getItem(this._prefix + key);
        }
      } catch (e) {
        console.error("StorageManager.get failed:", e);
        return null;
      }
    }
    /** 保存对象（JSON 序列化）*/
    setObject(key, value) {
      this.set(key, JSON.stringify(value));
    }
    /** 读取对象（JSON 反序列化）*/
    getObject(key) {
      const str = this.get(key);
      if (!str) return null;
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    }
    /** 删除 */
    remove(key) {
      try {
        if (typeof wx !== "undefined") {
          wx.removeStorageSync(this._prefix + key);
        } else {
          localStorage.removeItem(this._prefix + key);
        }
      } catch (e) {
        console.error("StorageManager.remove failed:", e);
      }
    }
  };

  // assets/scripts/core/AudioManager.ts
  var SFX_PATHS = {
    click: "assets/resources/audio/sfx/click-a.ogg",
    deal: "assets/resources/audio/sfx/tap-a.ogg",
    play: "assets/resources/audio/sfx/click-b.ogg",
    warning: "assets/resources/audio/sfx/switch-b.ogg",
    win: "assets/resources/audio/sfx/tap-b.ogg",
    lose: "assets/resources/audio/sfx/switch-a.ogg",
    switch: "assets/resources/audio/sfx/switch-a.ogg"
  };
  var AudioManager = class _AudioManager {
    constructor() {
      this._unlocked = false;
      this._initialized = false;
      this._enabled = true;
    }
    static get instance() {
      if (!this._instance) {
        this._instance = new _AudioManager();
      }
      return this._instance;
    }
    init() {
      if (this._initialized || typeof document === "undefined") {
        return;
      }
      this._initialized = true;
      this._enabled = StorageManager.instance.get("audio_enabled") !== "0";
      const unlock = () => {
        this._unlocked = true;
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
      };
      document.addEventListener("pointerdown", unlock, { once: true });
      document.addEventListener("keydown", unlock, { once: true });
    }
    setEnabled(enabled) {
      this._enabled = enabled;
      StorageManager.instance.set("audio_enabled", enabled ? "1" : "0");
    }
    playSfx(name, volume = 0.7) {
      if (!this._enabled || !this._unlocked || typeof Audio === "undefined") {
        return;
      }
      const src = SFX_PATHS[name];
      const audio = new Audio(src);
      audio.volume = volume;
      void audio.play().catch(() => {
      });
    }
  };

  // assets/scripts/platform/PlatformAdapter.ts
  function createPlatform() {
    if (typeof wx !== "undefined" && wx.getSystemInfoSync) {
      return new WechatPlatform();
    }
    return new WebPlatform();
  }
  var platformInstance = null;
  function getPlatform() {
    if (!platformInstance) {
      platformInstance = createPlatform();
    }
    return platformInstance;
  }
  var WechatPlatform = class {
    login() {
      return new Promise((resolve, reject) => {
        wx.login({
          success: (res) => {
            resolve({ method: "wechat", code: res.code });
          },
          fail: (err) => reject(err)
        });
      });
    }
    pay(order) {
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          ...order.wxPayParams,
          success: () => resolve({ success: true }),
          fail: (err) => reject(err)
        });
      });
    }
    share(data) {
      wx.shareAppMessage({
        title: data.title,
        imageUrl: data.imageUrl,
        query: data.query
      });
      return Promise.resolve();
    }
    getSystemInfo() {
      const info = wx.getSystemInfoSync();
      return {
        platform: "wechat",
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight,
        pixelRatio: info.pixelRatio
      };
    }
    vibrate(type) {
      if (type === "light") {
        wx.vibrateShort({ type: "light" });
      } else {
        wx.vibrateLong();
      }
    }
    setClipboard(text) {
      wx.setClipboardData({ data: text });
    }
    createWebSocket(url) {
      return new WechatSocketAdapter(url);
    }
  };
  var WebPlatform = class {
    login() {
      return Promise.resolve({ method: "guest" });
    }
    pay(_order) {
      return Promise.reject(new Error("Web pay not implemented"));
    }
    share(data) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data.title + " " + window.location.href);
      }
      return Promise.resolve();
    }
    getSystemInfo() {
      return {
        platform: "web",
        screenWidth: typeof window !== "undefined" ? window.innerWidth : 720,
        screenHeight: typeof window !== "undefined" ? window.innerHeight : 1280,
        pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
      };
    }
    vibrate(type) {
      if (navigator.vibrate) {
        navigator.vibrate(type === "light" ? 50 : 200);
      }
    }
    setClipboard(text) {
      navigator.clipboard?.writeText(text);
    }
    createWebSocket(url) {
      return new BrowserSocketAdapter(url);
    }
  };
  var BrowserSocketAdapter = class {
    constructor(url) {
      this.onopen = null;
      this.onclose = null;
      this.onerror = null;
      this.onmessage = null;
      this._socket = new WebSocket(url);
      this._socket.onopen = () => this.onopen?.();
      this._socket.onclose = () => this.onclose?.();
      this._socket.onerror = (event) => this.onerror?.(event);
      this._socket.onmessage = (event) => {
        this.onmessage?.({
          data: event.data
        });
      };
    }
    get binaryType() {
      return this._socket.binaryType;
    }
    set binaryType(value) {
      this._socket.binaryType = value;
    }
    send(data) {
      this._socket.send(data);
    }
    close() {
      this._socket.close();
    }
  };
  var WechatSocketAdapter = class {
    constructor(url) {
      this.onopen = null;
      this.onclose = null;
      this.onerror = null;
      this.onmessage = null;
      this._task = wx.connectSocket({ url });
      this._task.onOpen(() => this.onopen?.());
      this._task.onClose(() => this.onclose?.());
      this._task.onError((error) => this.onerror?.(error));
      this._task.onMessage((message) => {
        const data = message.data;
        if (typeof data === "string" || data instanceof ArrayBuffer) {
          this.onmessage?.({ data });
          return;
        }
        this.onmessage?.({ data: JSON.stringify(data ?? {}) });
      });
    }
    send(data) {
      this._task.send({ data });
    }
    close() {
      this._task.close();
    }
  };

  // assets/scripts/core/LayoutManager.ts
  var LAYOUT_CONFIG = {
    portrait: {
      designWidth: 720,
      designHeight: 1280,
      scaleMode: "FIXED_WIDTH"
    },
    tablet: {
      designWidth: 1280,
      designHeight: 960,
      scaleMode: "SHOW_ALL"
    },
    landscape: {
      designWidth: 1920,
      designHeight: 1080,
      scaleMode: "FIXED_HEIGHT"
    }
  };
  var GAME_SEAT_LAYOUTS = {
    portrait: [
      { top: "82%", left: "50%", scale: 1 },
      { top: "58%", left: "12%", scale: 0.9 },
      { top: "17%", left: "25%", scale: 0.86 },
      { top: "17%", left: "75%", scale: 0.86 },
      { top: "58%", left: "88%", scale: 0.9 }
    ],
    tablet: [
      { top: "84%", left: "50%", scale: 1 },
      { top: "54%", left: "14%", scale: 0.92 },
      { top: "20%", left: "27%", scale: 0.88 },
      { top: "20%", left: "73%", scale: 0.88 },
      { top: "54%", left: "86%", scale: 0.92 }
    ],
    landscape: [
      { top: "82%", left: "50%", scale: 1 },
      { top: "57%", left: "16%", scale: 0.95 },
      { top: "20%", left: "31%", scale: 0.9 },
      { top: "20%", left: "69%", scale: 0.9 },
      { top: "57%", left: "84%", scale: 0.95 }
    ]
  };
  var ROOM_SEAT_LAYOUTS = {
    portrait: [
      { top: "78%", left: "50%", scale: 1 },
      { top: "56%", left: "16%", scale: 0.92 },
      { top: "26%", left: "28%", scale: 0.88 },
      { top: "26%", left: "72%", scale: 0.88 },
      { top: "56%", left: "84%", scale: 0.92 }
    ],
    tablet: [
      { top: "76%", left: "50%", scale: 1 },
      { top: "52%", left: "17%", scale: 0.94 },
      { top: "24%", left: "31%", scale: 0.9 },
      { top: "24%", left: "69%", scale: 0.9 },
      { top: "52%", left: "83%", scale: 0.94 }
    ],
    landscape: [
      { top: "72%", left: "50%", scale: 1 },
      { top: "50%", left: "20%", scale: 0.95 },
      { top: "22%", left: "34%", scale: 0.9 },
      { top: "22%", left: "66%", scale: 0.9 },
      { top: "50%", left: "80%", scale: 0.95 }
    ]
  };
  var LayoutManager = class _LayoutManager {
    constructor() {
      this._metrics = {
        mode: "portrait",
        screenWidth: 720,
        screenHeight: 1280,
        ...LAYOUT_CONFIG.portrait
      };
      this._started = false;
      this._resizeHandler = () => {
        this.refresh();
      };
    }
    static get instance() {
      if (!this._instance) {
        this._instance = new _LayoutManager();
      }
      return this._instance;
    }
    init() {
      if (this._started) {
        this.refresh();
        return;
      }
      this._started = true;
      this.refresh();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", this._resizeHandler);
        window.addEventListener("orientationchange", this._resizeHandler);
      }
    }
    destroy() {
      if (!this._started || typeof window === "undefined") {
        return;
      }
      window.removeEventListener("resize", this._resizeHandler);
      window.removeEventListener("orientationchange", this._resizeHandler);
      this._started = false;
    }
    refresh() {
      const platform = getPlatform();
      const systemInfo = platform.getSystemInfo();
      const nextMode = detectLayoutMode(systemInfo.screenWidth, systemInfo.screenHeight);
      const nextMetrics = {
        mode: nextMode,
        screenWidth: systemInfo.screenWidth,
        screenHeight: systemInfo.screenHeight,
        ...LAYOUT_CONFIG[nextMode]
      };
      const changed = nextMetrics.mode !== this._metrics.mode || nextMetrics.screenWidth !== this._metrics.screenWidth || nextMetrics.screenHeight !== this._metrics.screenHeight;
      this._metrics = nextMetrics;
      this.applyCssVars();
      if (changed) {
        EventManager.instance.emit("LAYOUT_CHANGED", this._metrics);
      }
    }
    get metrics() {
      return this._metrics;
    }
    get mode() {
      return this._metrics.mode;
    }
    getGameSeatPosition(seatIdx, mySeatIdx) {
      return getRelativeSeatPosition(GAME_SEAT_LAYOUTS[this._metrics.mode], seatIdx, mySeatIdx);
    }
    getRoomSeatPosition(seatIdx) {
      return ROOM_SEAT_LAYOUTS[this._metrics.mode][seatIdx] || ROOM_SEAT_LAYOUTS[this._metrics.mode][0];
    }
    getHandCardWidth(cardCount) {
      const base = this._metrics.mode === "landscape" ? 94 : this._metrics.mode === "tablet" ? 88 : 76;
      if (cardCount <= 10) return base;
      if (cardCount <= 15) return base - 8;
      return Math.max(base - 14, 52);
    }
    applyCssVars() {
      if (typeof document === "undefined") {
        return;
      }
      const root = document.documentElement;
      root.dataset.layout = this._metrics.mode;
      root.style.setProperty("--app-screen-width", `${this._metrics.screenWidth}px`);
      root.style.setProperty("--app-screen-height", `${this._metrics.screenHeight}px`);
      root.style.setProperty("--app-design-width", `${this._metrics.designWidth}px`);
      root.style.setProperty("--app-design-height", `${this._metrics.designHeight}px`);
      root.style.setProperty("--app-scale-mode", this._metrics.scaleMode);
      root.style.setProperty("--safe-gap", this._metrics.mode === "portrait" ? "16px" : "24px");
      root.style.setProperty("--seat-scale-self", "1");
    }
  };
  function detectLayoutMode(width, height) {
    if (height <= 0) {
      return "portrait";
    }
    const ratio = width / height;
    if (ratio >= 1.45) {
      return "landscape";
    }
    if (ratio >= 0.9) {
      return "tablet";
    }
    return "portrait";
  }
  function getRelativeSeatPosition(layout, seatIdx, mySeatIdx) {
    if (mySeatIdx < 0) {
      return layout[seatIdx] || layout[0];
    }
    const relative = (seatIdx - mySeatIdx + 5) % 5;
    return layout[relative] || layout[0];
  }

  // assets/scripts/core/GameManager.ts
  var GameManager = class _GameManager {
    static get instance() {
      if (!this._instance) {
        this._instance = new _GameManager();
      }
      return this._instance;
    }
    /** 初始化所有子管理器 */
    async init() {
      EventManager.instance.init();
      StorageManager.instance.init();
      LayoutManager.instance.init();
      AudioManager.instance.init();
    }
    /** 设置布局模式 */
    static setLayout(layout) {
      EventManager.instance.emit("LAYOUT_CHANGED", layout);
    }
    /** 获取当前布局模式 */
    static getLayout() {
      return LayoutManager.instance.mode;
    }
  };

  // assets/scripts/protocol/ProtobufCodec.ts
  var _seq = 0;
  function nextSeq() {
    return ++_seq;
  }
  function encode(msgType, payload) {
    const pkt = {
      msg_type: msgType,
      seq: nextSeq(),
      payload: payload || {}
    };
    const json = JSON.stringify(pkt);
    const encoder = new TextEncoder();
    return encoder.encode(json).buffer;
  }
  function decode(data) {
    try {
      const decoder = new TextDecoder();
      const json = decoder.decode(data);
      return JSON.parse(json);
    } catch (e) {
      console.error("[Codec] \u89E3\u7801\u5931\u8D25:", e);
      return null;
    }
  }

  // assets/scripts/network/MessageRouter.ts
  var MessageRouter = class {
    static {
      this._handlers = /* @__PURE__ */ new Map();
    }
    /** 注册消息处理器 */
    static register(msgType, handler) {
      this._handlers.set(msgType, handler);
    }
    /** 注销消息处理器 */
    static unregister(msgType) {
      this._handlers.delete(msgType);
    }
    /** 分发二进制消息 */
    static dispatch(data) {
      const pkt = decode(data);
      if (!pkt) return;
      this._dispatchPacket(pkt);
    }
    /** 分发 JSON 文本消息 */
    static dispatchJSON(jsonStr) {
      try {
        const pkt = JSON.parse(jsonStr);
        this._dispatchPacket(pkt);
      } catch (e) {
        console.error("[MessageRouter] JSON \u89E3\u6790\u5931\u8D25:", e);
      }
    }
    /** 内部分发 */
    static _dispatchPacket(pkt) {
      const handler = this._handlers.get(pkt.msg_type);
      if (handler) {
        handler(pkt.payload);
      } else {
        console.warn(`[MessageRouter] \u672A\u6CE8\u518C\u7684\u6D88\u606F\u7C7B\u578B: ${pkt.msg_type}`);
      }
    }
  };

  // assets/scripts/protocol/MsgType.ts
  var MSG_PING = 9001;
  var MSG_PONG = 9002;
  var MSG_C2S_GUEST_LOGIN = 1001;
  var MSG_S2C_LOGIN_RESULT = 2001;
  var MSG_C2S_QUICK_MATCH = 1101;
  var MSG_C2S_CANCEL_MATCH = 1102;
  var MSG_C2S_LEAVE_ROOM = 1105;
  var MSG_C2S_READY = 1106;
  var MSG_C2S_CANCEL_READY = 1107;
  var MSG_S2C_MATCH_UPDATE = 2101;
  var MSG_S2C_ROOM_JOINED = 2102;
  var MSG_S2C_PLAYER_JOINED = 2103;
  var MSG_S2C_PLAYER_LEFT = 2104;
  var MSG_S2C_READY_UPDATE = 2105;
  var MSG_C2S_BID = 1202;
  var MSG_C2S_PASS_BID = 1203;
  var MSG_C2S_SET_BOTTOM = 1205;
  var MSG_C2S_CALL_PARTNER = 1206;
  var MSG_C2S_PLAY_CARD = 1207;
  var MSG_S2C_DEAL_CARDS = 2202;
  var MSG_S2C_FLIP_RESULT = 2203;
  var MSG_S2C_BID_UPDATE = 2204;
  var MSG_S2C_BID_RESULT = 2205;
  var MSG_S2C_ALL_PASSED = 2206;
  var MSG_S2C_BOTTOM_CARDS = 2207;
  var MSG_S2C_PARTNER_CALLED = 2208;
  var MSG_S2C_TURN = 2209;
  var MSG_S2C_CARD_PLAYED = 2210;
  var MSG_S2C_ROUND_RESULT = 2211;
  var MSG_S2C_GAME_RESULT = 2212;
  var MSG_S2C_GAME_START = 2213;
  var MSG_S2C_ERROR = 2999;

  // assets/scripts/stores/GameStore.ts
  var SUIT_SYMBOLS = {
    1: "\u2660",
    2: "\u2665",
    3: "\u2666",
    4: "\u2663",
    5: "\u{1F0CF}"
  };
  var RANK_NAMES = {
    1: "A",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
    14: "\u5C0F\u738B",
    15: "\u5927\u738B"
  };
  function cardToString(card) {
    if (card.rank >= 14) return RANK_NAMES[card.rank] || "?";
    return (SUIT_SYMBOLS[card.suit] || "?") + (RANK_NAMES[card.rank] || "?");
  }
  var GameStore = class _GameStore {
    constructor() {
      // 用户
      this.userId = "";
      this.nickname = "";
      this.token = "";
      this.coins = 0;
      // 房间
      this.roomId = "";
      this.tier = 10;
      this.players = [];
      // 游戏
      this.phase = "login";
      this.myHand = [];
      this.selectedCards = /* @__PURE__ */ new Set();
      // 选中的手牌索引
      this.trumpSuit = 0;
      this.bidScore = 0;
      this.dealerId = "";
      this.partnerCard = null;
      this.isSolo = false;
      this.currentTurnId = "";
      this.turnTimeout = 0;
      this.turnDeadlineAt = 0;
      this.playerCardCounts = {};
      this.currentRoundPlays = [];
      this.catcherScore = 0;
      // 结算
      this.settlements = [];
      this.winner = "";
    }
    static get instance() {
      if (!this._instance) {
        this._instance = new _GameStore();
        this._instance.registerHandlers();
      }
      return this._instance;
    }
    /** 注册所有 S2C 消息处理器 */
    registerHandlers() {
      MessageRouter.register(MSG_S2C_LOGIN_RESULT, (p) => this.onLoginResult(p));
      MessageRouter.register(MSG_S2C_MATCH_UPDATE, (p) => this.onMatchUpdate(p));
      MessageRouter.register(MSG_S2C_ROOM_JOINED, (p) => this.onRoomJoined(p));
      MessageRouter.register(MSG_S2C_PLAYER_JOINED, (p) => this.onPlayerJoined(p));
      MessageRouter.register(MSG_S2C_PLAYER_LEFT, (p) => this.onPlayerLeft(p));
      MessageRouter.register(MSG_S2C_READY_UPDATE, (p) => this.onReadyUpdate(p));
      MessageRouter.register(MSG_S2C_GAME_START, (p) => this.onGameStart(p));
      MessageRouter.register(MSG_S2C_DEAL_CARDS, (p) => this.onDealCards(p));
      MessageRouter.register(MSG_S2C_FLIP_RESULT, (p) => this.onFlipResult(p));
      MessageRouter.register(MSG_S2C_BID_UPDATE, (p) => this.onBidUpdate(p));
      MessageRouter.register(MSG_S2C_BID_RESULT, (p) => this.onBidResult(p));
      MessageRouter.register(MSG_S2C_ALL_PASSED, (p) => this.onAllPassed(p));
      MessageRouter.register(MSG_S2C_BOTTOM_CARDS, (p) => this.onBottomCards(p));
      MessageRouter.register(MSG_S2C_PARTNER_CALLED, (p) => this.onPartnerCalled(p));
      MessageRouter.register(MSG_S2C_TURN, (p) => this.onTurn(p));
      MessageRouter.register(MSG_S2C_CARD_PLAYED, (p) => this.onCardPlayed(p));
      MessageRouter.register(MSG_S2C_ROUND_RESULT, (p) => this.onRoundResult(p));
      MessageRouter.register(MSG_S2C_GAME_RESULT, (p) => this.onGameResult(p));
      MessageRouter.register(MSG_S2C_ERROR, (p) => this.onError(p));
      MessageRouter.register(MSG_PONG, () => {
      });
    }
    // === S2C 消息处理 ===
    onLoginResult(data) {
      if (data.success) {
        this.userId = data.player.user_id;
        this.nickname = data.player.nickname;
        this.token = data.token;
        this.coins = data.coins;
        this.phase = "lobby";
      }
      EventManager.instance.emit("LOGIN_RESULT", data);
    }
    onMatchUpdate(data) {
      EventManager.instance.emit("MATCH_UPDATE", data);
    }
    onRoomJoined(data) {
      this.roomId = data.room_id;
      this.tier = data.tier;
      this.players = data.players || [];
      this.playerCardCounts = {};
      this.phase = "room";
      EventManager.instance.emit("ROOM_JOINED", data);
    }
    onPlayerJoined(data) {
      if (data.player) {
        this.players.push(data.player);
        this.playerCardCounts[data.player.user_id] = 0;
      }
      EventManager.instance.emit("PLAYER_JOINED", data);
    }
    onPlayerLeft(data) {
      this.players = this.players.filter((p) => p.user_id !== data.user_id);
      delete this.playerCardCounts[data.user_id];
      EventManager.instance.emit("PLAYER_LEFT", data);
    }
    onReadyUpdate(data) {
      const p = this.players.find((p2) => p2.user_id === data.user_id);
      if (p) p.is_ready = data.is_ready;
      EventManager.instance.emit("READY_UPDATE", data);
    }
    onGameStart(data) {
      this.phase = "dealing";
      this.myHand = [];
      this.selectedCards.clear();
      this.playerCardCounts = {};
      this.currentRoundPlays = [];
      this.catcherScore = 0;
      EventManager.instance.emit("GAME_START", data);
    }
    onDealCards(data) {
      this.myHand = data.cards || [];
      this.players.forEach((player) => {
        this.playerCardCounts[player.user_id] = 10;
      });
      this.playerCardCounts[this.userId] = this.myHand.length;
      this.phase = "bidding";
      EventManager.instance.emit("DEAL_CARDS", data);
    }
    onFlipResult(data) {
      EventManager.instance.emit("FLIP_RESULT", data);
    }
    onBidUpdate(data) {
      EventManager.instance.emit("BID_UPDATE", data);
    }
    onBidResult(data) {
      this.dealerId = data.dealer_id;
      this.bidScore = data.score;
      this.trumpSuit = data.suit;
      this.phase = "bottom";
      EventManager.instance.emit("BID_RESULT", data);
    }
    onAllPassed(data) {
      EventManager.instance.emit("ALL_PASSED", data);
    }
    onBottomCards(data) {
      if (data.cards) {
        this.myHand = [...this.myHand, ...data.cards];
        this.playerCardCounts[this.userId] = this.myHand.length;
      }
      EventManager.instance.emit("BOTTOM_CARDS", data);
    }
    onPartnerCalled(data) {
      this.partnerCard = data.card;
      this.isSolo = data.is_solo;
      this.phase = "playing";
      this.currentRoundPlays = [];
      EventManager.instance.emit("PARTNER_CALLED", data);
    }
    onTurn(data) {
      this.currentTurnId = data.player_id;
      this.turnTimeout = data.timeout;
      this.turnDeadlineAt = Date.now() + Math.max(data.timeout || 0, 0) * 1e3;
      EventManager.instance.emit("TURN", data);
    }
    onCardPlayed(data) {
      this.currentRoundPlays.push({
        player_id: data.player_id,
        card: data.card
      });
      if (data.player_id === this.userId) {
        const idx = this.myHand.findIndex(
          (c) => c.suit === data.card.suit && c.rank === data.card.rank
        );
        if (idx >= 0) this.myHand.splice(idx, 1);
        this.selectedCards.clear();
        this.playerCardCounts[this.userId] = this.myHand.length;
      } else if (this.playerCardCounts[data.player_id] !== void 0) {
        this.playerCardCounts[data.player_id] = Math.max(this.playerCardCounts[data.player_id] - 1, 0);
      }
      EventManager.instance.emit("CARD_PLAYED", data);
    }
    onRoundResult(data) {
      this.catcherScore = data.total_catcher_score;
      this.currentRoundPlays = [];
      EventManager.instance.emit("ROUND_RESULT", data);
    }
    onGameResult(data) {
      this.phase = "result";
      this.settlements = data.settlements || [];
      this.winner = data.winner;
      EventManager.instance.emit("GAME_RESULT", data);
    }
    onError(data) {
      console.error("[GameStore] \u670D\u52A1\u7AEF\u9519\u8BEF:", data.message);
      EventManager.instance.emit("SERVER_ERROR", data);
    }
    // === 辅助方法 ===
    /** 是否轮到自己操作 */
    get isMyTurn() {
      return this.currentTurnId === this.userId;
    }
    /** 是否是庄家 */
    get isDealer() {
      return this.dealerId === this.userId;
    }
    /** 获取指定玩家数据 */
    getPlayer(userId) {
      return this.players.find((p) => p.user_id === userId);
    }
    /** 获取自己的座位索引 */
    get mySeatIdx() {
      const me = this.players.find((p) => p.user_id === this.userId);
      return me ? me.seat_idx : -1;
    }
    /** 当前剩余操作秒数 */
    get remainingTurnSeconds() {
      if (this.turnDeadlineAt <= 0) {
        return this.turnTimeout;
      }
      return Math.max(Math.ceil((this.turnDeadlineAt - Date.now()) / 1e3), 0);
    }
  };

  // assets/scripts/network/NetworkManager.ts
  var NetworkManager = class _NetworkManager {
    constructor() {
      this._ws = null;
      this._url = "";
      this._token = "";
      this._reconnectAttempts = 0;
      this._maxReconnect = 5;
      this._heartbeatTimer = null;
      this._msgQueue = [];
      this._isConnected = false;
      this._manualClose = false;
    }
    static get instance() {
      if (!this._instance) {
        this._instance = new _NetworkManager();
      }
      return this._instance;
    }
    get isConnected() {
      return this._isConnected;
    }
    /** 连接服务器 */
    connect(url, token) {
      this._url = url;
      this._token = token;
      this._manualClose = false;
      return new Promise((resolve, reject) => {
        const queryJoin = url.includes("?") ? "&" : "?";
        this._ws = getPlatform().createWebSocket(`${url}${queryJoin}token=${encodeURIComponent(token)}`);
        this._ws.binaryType = "arraybuffer";
        this._ws.onopen = () => {
          this._isConnected = true;
          this._reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushQueue();
          EventManager.instance.emit("NETWORK_CONNECTED");
          resolve();
        };
        this._ws.onclose = () => {
          this._isConnected = false;
          this.stopHeartbeat();
          EventManager.instance.emit("NETWORK_CLOSED");
          if (!this._manualClose) {
            this.autoReconnect();
          }
        };
        this._ws.onmessage = (event) => {
          const data = event.data;
          if (typeof data === "string") {
            MessageRouter.dispatchJSON(data);
          } else {
            MessageRouter.dispatch(data);
          }
        };
        this._ws.onerror = (error) => {
          console.error("[Network] WebSocket error:", error);
          reject(new Error("WebSocket connection failed"));
        };
      });
    }
    /** 发送二进制消息 */
    send(data) {
      if (this._isConnected && this._ws) {
        this._ws.send(data);
      } else {
        this._msgQueue.push(data);
      }
    }
    /** 发送协议消息 */
    sendMsg(msgType, payload) {
      const data = encode(msgType, payload);
      this.send(data);
    }
    /** 断开连接 */
    disconnect() {
      this._manualClose = true;
      if (this._ws) {
        this._ws.close();
        this._ws = null;
      }
      this.stopHeartbeat();
      this._isConnected = false;
    }
    /** 指数退避重连 */
    autoReconnect() {
      if (this._reconnectAttempts >= this._maxReconnect) {
        EventManager.instance.emit("NETWORK_DISCONNECT");
        return;
      }
      const delay = Math.min(1e3 * Math.pow(2, this._reconnectAttempts), 3e4);
      this._reconnectAttempts++;
      console.log(`[Network] \u91CD\u8FDE\u4E2D... \u7B2C${this._reconnectAttempts}\u6B21\uFF0C${delay}ms\u540E\u91CD\u8BD5`);
      setTimeout(() => {
        this.connect(this._url, this._token).catch(() => {
        });
      }, delay);
    }
    /** 心跳保活 */
    startHeartbeat() {
      this._heartbeatTimer = window.setInterval(() => {
        this.sendMsg(MSG_PING);
      }, 3e4);
    }
    stopHeartbeat() {
      if (this._heartbeatTimer !== null) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = null;
      }
    }
    /** 刷新缓冲队列 */
    flushQueue() {
      while (this._msgQueue.length > 0) {
        const data = this._msgQueue.shift();
        this.send(data);
      }
    }
  };

  // assets/scripts/ui/Theme.ts
  var THEME_STYLE_ID = "sankaer-theme-style";
  function ensureTheme() {
    if (typeof document === "undefined" || document.getElementById(THEME_STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = THEME_STYLE_ID;
    style.textContent = `
        @font-face {
            font-family: 'SankaerDisplay';
            src: url('assets/resources/fonts/Kenney Future.ttf') format('truetype');
            font-display: swap;
        }

        :root {
            --bg-night: #08141d;
            --bg-panel: rgba(10, 28, 40, 0.74);
            --bg-panel-strong: rgba(8, 22, 31, 0.9);
            --line-soft: rgba(255, 255, 255, 0.12);
            --text-main: #f4efe6;
            --text-muted: #b9c6d1;
            --accent-gold: #f4b860;
            --accent-red: #d85a52;
            --accent-green: #55b683;
            --accent-blue: #3f6fb6;
            --shadow-strong: 0 18px 56px rgba(0, 0, 0, 0.32);
        }

        html, body {
            margin: 0;
            min-height: 100%;
            background:
                radial-gradient(circle at top, rgba(255, 205, 120, 0.16), transparent 34%),
                linear-gradient(180deg, #132532 0%, #09131b 100%);
            color: var(--text-main);
            font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
            overflow: hidden;
        }

        body {
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background:
                linear-gradient(135deg, rgba(19, 59, 49, 0.24), rgba(10, 18, 26, 0.78)),
                url('assets/resources/bg/more-leaves.png') center/480px repeat;
            opacity: 0.18;
            pointer-events: none;
        }

        .sk-screen {
            position: fixed;
            inset: 0;
            box-sizing: border-box;
            padding: var(--safe-gap, 18px);
            display: flex;
            justify-content: center;
            align-items: stretch;
        }

        .sk-shell {
            width: min(100%, 1400px);
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .sk-panel {
            box-sizing: border-box;
            background: linear-gradient(180deg, rgba(19, 45, 59, 0.82), rgba(7, 18, 26, 0.94));
            border: 1px solid var(--line-soft);
            border-radius: 24px;
            box-shadow: var(--shadow-strong);
            backdrop-filter: blur(12px);
        }

        .sk-felt {
            background:
                radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 32%),
                linear-gradient(180deg, rgba(24, 76, 54, 0.95), rgba(8, 36, 23, 0.98));
        }

        .sk-wood {
            background:
                linear-gradient(180deg, rgba(82, 49, 30, 0.88), rgba(30, 18, 11, 0.94)),
                linear-gradient(90deg, rgba(255,255,255,0.05), transparent 14%, rgba(0,0,0,0.12) 28%);
        }

        .sk-title {
            font-family: 'SankaerDisplay', 'Segoe UI Semibold', sans-serif;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .sk-muted {
            color: var(--text-muted);
        }

        .sk-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            color: var(--text-main);
            font-size: 13px;
        }

        .sk-btn {
            border: none;
            border-radius: 18px;
            padding: 14px 24px;
            font-family: 'Segoe UI Semibold', 'Microsoft YaHei', sans-serif;
            font-size: 15px;
            letter-spacing: 0.03em;
            cursor: pointer;
            color: #fff8ef;
            transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
        }

        .sk-btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.05);
        }

        .sk-btn:active {
            transform: translateY(1px) scale(0.99);
        }

        .sk-btn-primary { background: linear-gradient(180deg, #e4a34d, #b56d2f); }
        .sk-btn-secondary { background: linear-gradient(180deg, #5878b8, #314c7f); }
        .sk-btn-success { background: linear-gradient(180deg, #5fc08d, #2d8c61); }
        .sk-btn-warning { background: linear-gradient(180deg, #d97263, #9d4438); }
        .sk-btn-ghost {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: none;
        }

        .sk-card-fan {
            display: flex;
            align-items: flex-end;
            justify-content: center;
            flex-wrap: nowrap;
        }

        .sk-scroll {
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
        }

        .sk-countdown {
            font-family: 'Segoe UI Semibold', sans-serif;
            color: var(--accent-gold);
        }

        .sk-pop-in {
            animation: sk-pop-in 0.28s ease;
        }

        @keyframes sk-pop-in {
            from {
                opacity: 0;
                transform: translateY(10px) scale(0.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
    `;
    document.head.appendChild(style);
  }
  function createScreenRoot(id, shellClass = "") {
    ensureTheme();
    const root = document.createElement("div");
    root.id = id;
    root.className = "sk-screen";
    const shell = document.createElement("div");
    shell.className = `sk-shell ${shellClass}`.trim();
    root.appendChild(shell);
    return root;
  }
  function getScreenShell(root) {
    return root.firstElementChild;
  }
  function createButton(text, variant, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sk-btn sk-btn-${variant}`;
    button.textContent = text;
    button.onclick = onClick;
    return button;
  }

  // assets/scripts/views/LoginView.ts
  var LoginView = class {
    constructor() {
      this.container = null;
      this.handleResize = () => {
        if (!this.container) {
          return;
        }
        this.hide();
        this.show();
      };
    }
    show() {
      this.container = createScreenRoot("login-view");
      const shell = getScreenShell(this.container);
      const layout = LayoutManager.instance.mode;
      shell.style.justifyContent = "center";
      shell.style.alignItems = "center";
      const hero = document.createElement("div");
      hero.className = "sk-panel sk-wood sk-pop-in";
      hero.style.cssText = `
            width: min(100%, ${layout === "portrait" ? "520px" : "960px"});
            min-height: ${layout === "portrait" ? "540px" : "420px"};
            display: grid;
            grid-template-columns: ${layout === "portrait" ? "1fr" : "1.05fr 0.95fr"};
            gap: 24px;
            padding: 28px;
            box-sizing: border-box;
        `;
      const intro = document.createElement("div");
      intro.style.cssText = "display:flex;flex-direction:column;justify-content:center;gap:16px;";
      const eyebrow = document.createElement("div");
      eyebrow.className = "sk-chip";
      eyebrow.textContent = "Phase 4 Multi-Platform Build";
      intro.appendChild(eyebrow);
      const title = document.createElement("h1");
      title.className = "sk-title";
      title.style.cssText = "font-size: clamp(44px, 8vw, 76px); margin: 0; color: #ffe7c2;";
      title.textContent = "\u4E09\u5361\u4E8C";
      intro.appendChild(title);
      const subtitle = document.createElement("p");
      subtitle.className = "sk-muted";
      subtitle.style.cssText = "margin:0; font-size:16px; line-height:1.8;";
      subtitle.textContent = "\u4E94\u4EBA\u5347\u7EA7\u6251\u514B\u724C\u5728\u7EBF\u5BF9\u5C40\uFF0C\u73B0\u5DF2\u63A5\u5165\u52A8\u6001\u5E03\u5C40\u3001\u6B63\u5F0F\u724C\u9762\u7EC4\u4EF6\u4E0E\u591A\u7AEF\u5E73\u53F0\u9002\u914D\u3002";
      intro.appendChild(subtitle);
      const tips = document.createElement("div");
      tips.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;";
      ["5\u4EBA\u540C\u684C", "\u53EB\u5206/\u6263\u5E95/\u53EB\u642D\u6863", "H5/\u5FAE\u4FE1\u9002\u914D"].forEach((text) => {
        const chip = document.createElement("div");
        chip.className = "sk-chip";
        chip.textContent = text;
        tips.appendChild(chip);
      });
      intro.appendChild(tips);
      const actionPanel = document.createElement("div");
      actionPanel.className = "sk-panel sk-felt";
      actionPanel.style.cssText = `
            display:flex;flex-direction:column;justify-content:center;gap:18px;
            padding: 24px; box-sizing: border-box;
        `;
      const actionTitle = document.createElement("div");
      actionTitle.className = "sk-title";
      actionTitle.style.cssText = "font-size: 24px; color: #f8e2ba;";
      actionTitle.textContent = "\u8FDB\u5165\u724C\u5C40";
      actionPanel.appendChild(actionTitle);
      const actionDesc = document.createElement("p");
      actionDesc.className = "sk-muted";
      actionDesc.style.cssText = "margin:0; line-height:1.7;";
      actionDesc.textContent = "\u5F53\u524D\u670D\u52A1\u7AEF\u4FDD\u6301\u6E38\u5BA2\u767B\u5F55\u517C\u5BB9\u6A21\u5F0F\uFF0CWeb \u548C\u5FAE\u4FE1\u7AEF\u90FD\u4F1A\u8D70\u7EDF\u4E00\u8FDE\u63A5\u6D41\u7A0B\u3002";
      actionPanel.appendChild(actionDesc);
      const btn = createButton("\u6E38\u5BA2\u767B\u5F55", "primary", () => {
        AudioManager.instance.playSfx("click");
        void this.doLogin();
      });
      btn.style.fontSize = "18px";
      btn.style.padding = "16px 26px";
      actionPanel.appendChild(btn);
      const status = document.createElement("p");
      status.id = "login-status";
      status.className = "sk-muted";
      status.style.cssText = "margin:0; font-size:14px; min-height:20px;";
      actionPanel.appendChild(status);
      hero.appendChild(intro);
      hero.appendChild(actionPanel);
      shell.appendChild(hero);
      if (this.container) {
        document.body.appendChild(this.container);
      }
      LayoutManager.instance.init();
      window.addEventListener("resize", this.handleResize);
    }
    hide() {
      window.removeEventListener("resize", this.handleResize);
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
    async doLogin() {
      const statusEl = document.getElementById("login-status");
      if (statusEl) statusEl.textContent = "\u8FDE\u63A5\u670D\u52A1\u5668\u4E2D...";
      try {
        const platform = getPlatform();
        const loginResult = await platform.login();
        let deviceId = StorageManager.instance.get("device_id");
        if (!deviceId) {
          deviceId = "dev_" + Math.random().toString(36).substring(2, 10);
          StorageManager.instance.set("device_id", deviceId);
        }
        if (loginResult.code) {
          StorageManager.instance.set("wechat_login_code", loginResult.code);
        }
        const wsUrl = "ws://127.0.0.1:8080/ws";
        await NetworkManager.instance.connect(wsUrl, "guest:" + deviceId);
        if (statusEl) statusEl.textContent = "\u767B\u5F55\u4E2D...";
        NetworkManager.instance.sendMsg(MSG_C2S_GUEST_LOGIN, {
          device_id: deviceId,
          platform: platform.getSystemInfo().platform
        });
      } catch (e) {
        if (statusEl) statusEl.textContent = "\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
        console.error("[LoginView] \u767B\u5F55\u5931\u8D25:", e);
      }
    }
  };

  // assets/scripts/views/LobbyView.ts
  var LobbyView = class {
    constructor() {
      this.container = null;
      this.selectedTier = 10;
      this.isMatching = false;
      this.render = () => {
        const store = GameStore.instance;
        const layout = LayoutManager.instance.mode;
        const root = createScreenRoot("lobby-view");
        const shell = getScreenShell(root);
        const topBar = document.createElement("div");
        topBar.className = "sk-panel sk-wood";
        topBar.style.cssText = `
            padding: 18px 22px;
            display:flex;
            flex-wrap:wrap;
            justify-content:space-between;
            align-items:center;
            gap: 12px;
        `;
        topBar.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:30px;color:#ffe4ba;">\u4E09\u5361\u4E8C</div>
                <div class="sk-muted" style="font-size:13px;">\u6B63\u5F0F\u5927\u5385\u89C6\u89C9 / \u591A\u7AEF\u9002\u914D\u5927\u5385</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
                <div class="sk-chip">\u73A9\u5BB6 ${store.nickname || "\u6E38\u5BA2"}</div>
                <div class="sk-chip">\u91D1\u5E01 ${store.coins}</div>
                <div class="sk-chip">\u9ED8\u8BA4\u573A ${this.selectedTier} \u500D</div>
            </div>
        `;
        shell.appendChild(topBar);
        const content = document.createElement("div");
        content.style.cssText = `
            flex:1;
            display:grid;
            grid-template-columns:${layout === "portrait" ? "1fr" : "1.1fr 0.9fr"};
            gap:18px;
            min-height:0;
        `;
        const tierPanel = document.createElement("div");
        tierPanel.className = "sk-panel sk-felt";
        tierPanel.style.cssText = "padding:26px;display:flex;flex-direction:column;gap:18px;";
        tierPanel.innerHTML = `
            <div class="sk-title" style="font-size:26px;color:#f7e2bb;">\u9009\u62E9\u573A\u6B21</div>
            <div class="sk-muted" style="line-height:1.7;">\u5927\u5385\u5DF2\u5347\u7EA7\u4E3A\u6B63\u5F0F\u5E03\u5C40\uFF0C\u4F18\u5148\u4FDD\u7559\u73B0\u6709\u5FEB\u901F\u5339\u914D\u6D41\u7A0B\uFF0C\u540E\u7EED\u53EF\u4EE5\u7EE7\u7EED\u6302\u63A5\u521B\u623F\u4E0E\u7EC3\u4E60\u573A\u3002</div>
        `;
        const tierGrid = document.createElement("div");
        tierGrid.style.cssText = `
            display:grid;
            grid-template-columns:repeat(${layout === "portrait" ? 2 : 4}, minmax(0, 1fr));
            gap:12px;
        `;
        [10, 100, 1e3, 1e4].forEach((tier) => {
          const card = document.createElement("button");
          card.type = "button";
          card.style.cssText = `
                border:${tier === this.selectedTier ? "1px solid rgba(244,184,96,0.9)" : "1px solid rgba(255,255,255,0.08)"};
                background:${tier === this.selectedTier ? "linear-gradient(180deg, rgba(244,184,96,0.22), rgba(134,80,36,0.28))" : "rgba(255,255,255,0.05)"};
                border-radius:18px;
                padding:18px 14px;
                color:#fff7ea;
                cursor:pointer;
                text-align:left;
            `;
          card.innerHTML = `
                <div class="sk-title" style="font-size:24px;color:#ffe5bb;">${tier}x</div>
                <div class="sk-muted" style="font-size:13px;">${tier === 10 ? "\u65B0\u624B\u70ED\u8EAB" : tier === 100 ? "\u6807\u51C6\u8282\u594F" : tier === 1e3 ? "\u9AD8\u500D\u51B2\u523A" : "\u8C6A\u534E\u724C\u684C"}</div>
            `;
          card.onclick = () => {
            AudioManager.instance.playSfx("switch", 0.6);
            this.selectedTier = tier;
            this.render();
          };
          tierGrid.appendChild(card);
        });
        tierPanel.appendChild(tierGrid);
        const actionPanel = document.createElement("div");
        actionPanel.className = "sk-panel";
        actionPanel.style.cssText = "padding:26px;display:flex;flex-direction:column;gap:18px;justify-content:center;";
        const quickAction = createButton(this.isMatching ? "\u53D6\u6D88\u5339\u914D" : "\u5FEB\u901F\u5339\u914D", this.isMatching ? "warning" : "primary", () => {
          AudioManager.instance.playSfx("click");
          this.toggleMatch();
        });
        quickAction.id = "match-btn";
        quickAction.style.fontSize = "22px";
        quickAction.style.padding = "20px 28px";
        const matchStatus = document.createElement("div");
        matchStatus.id = "match-status";
        matchStatus.className = "sk-chip";
        matchStatus.style.width = "fit-content";
        matchStatus.textContent = this.isMatching ? "\u5339\u914D\u4E2D..." : "\u7B49\u5F85\u5F00\u59CB";
        actionPanel.innerHTML = `
            <div class="sk-title" style="font-size:26px;color:#f7e2bb;">\u5F00\u59CB\u4E00\u5C40</div>
            <div class="sk-muted" style="line-height:1.8;">\u5F53\u524D\u7248\u672C\u4FDD\u7559\u7A33\u5B9A\u7684\u5FEB\u901F\u5339\u914D\u4E3B\u6D41\u7A0B\u3002\u521B\u623F\u548C\u7EC3\u4E60\u573A\u5165\u53E3\u53EF\u5728\u7B2C\u4E94\u9636\u6BB5 AI \u4E0E\u7EC3\u4E60\u573A\u4E2D\u7EE7\u7EED\u8865\u9F50\u3002</div>
        `;
        actionPanel.appendChild(quickAction);
        actionPanel.appendChild(matchStatus);
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;";
        ["\u6B63\u5F0F\u724C\u9762", "\u52A8\u6001\u5206\u8FA8\u7387", "\u5FAE\u4FE1/H5"].forEach((label) => {
          const chip = document.createElement("div");
          chip.className = "sk-chip";
          chip.textContent = label;
          footer.appendChild(chip);
        });
        actionPanel.appendChild(footer);
        content.appendChild(tierPanel);
        content.appendChild(actionPanel);
        shell.appendChild(content);
        if (this.container) {
          this.container.replaceWith(root);
        }
        this.container = root;
      };
      this.onMatchUpdate = (data) => {
        const status = document.getElementById("match-status");
        if (status) {
          status.textContent = `\u5339\u914D\u4E2D... \u6392\u961F\u4EBA\u6570: ${data.waiting_count}  \u7B49\u5F85: ${data.elapsed_sec}\u79D2`;
        }
      };
    }
    show() {
      this.render();
      if (this.container) {
        document.body.appendChild(this.container);
      }
      EventManager.instance.on("MATCH_UPDATE", this.onMatchUpdate);
      EventManager.instance.on("LAYOUT_CHANGED", this.render);
    }
    hide() {
      EventManager.instance.off("MATCH_UPDATE", this.onMatchUpdate);
      EventManager.instance.off("LAYOUT_CHANGED", this.render);
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
    toggleMatch() {
      const btn = document.getElementById("match-btn");
      if (this.isMatching) {
        NetworkManager.instance.sendMsg(MSG_C2S_CANCEL_MATCH);
        this.isMatching = false;
        if (btn) {
          btn.textContent = "\u5FEB\u901F\u5339\u914D";
          btn.className = "sk-btn sk-btn-primary";
        }
        const status = document.getElementById("match-status");
        if (status) status.textContent = "";
      } else {
        NetworkManager.instance.sendMsg(MSG_C2S_QUICK_MATCH, { tier: this.selectedTier });
        this.isMatching = true;
        if (btn) {
          btn.textContent = "\u53D6\u6D88\u5339\u914D";
          btn.className = "sk-btn sk-btn-warning";
        }
        const status = document.getElementById("match-status");
        if (status) status.textContent = "\u5339\u914D\u4E2D...";
      }
    }
  };

  // assets/scripts/views/RoomView.ts
  var SEAT_COLORS = ["#e94560", "#0f3460", "#533483", "#16c79a", "#f7b731"];
  var RoomView = class {
    constructor() {
      this.container = null;
      this.refresh = () => {
        this.render();
      };
    }
    show() {
      this.render();
      if (this.container) {
        document.body.appendChild(this.container);
      }
      EventManager.instance.on("PLAYER_JOINED", this.refresh);
      EventManager.instance.on("PLAYER_LEFT", this.refresh);
      EventManager.instance.on("READY_UPDATE", this.refresh);
      EventManager.instance.on("LAYOUT_CHANGED", this.refresh);
    }
    hide() {
      EventManager.instance.off("PLAYER_JOINED", this.refresh);
      EventManager.instance.off("PLAYER_LEFT", this.refresh);
      EventManager.instance.off("READY_UPDATE", this.refresh);
      EventManager.instance.off("LAYOUT_CHANGED", this.refresh);
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
    render() {
      const store = GameStore.instance;
      const root = createScreenRoot("room-view");
      const shell = getScreenShell(root);
      const layout = LayoutManager.instance.mode;
      const header = document.createElement("div");
      header.className = "sk-panel sk-wood";
      header.style.cssText = `
            padding:18px 22px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap: 12px;
            flex-wrap: wrap;
        `;
      header.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:26px;color:#ffe0b4;">\u623F\u95F4 ${store.roomId}</div>
                <div class="sk-muted" style="font-size:13px;">${store.tier} \u500D\u573A \xB7 \u7B49\u5F85\u4E94\u4EBA\u5168\u90E8\u51C6\u5907</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="sk-chip">\u5F53\u524D\u4EBA\u6570 ${store.players.length}/5</div>
                <div class="sk-chip">\u6A21\u5F0F \u623F\u95F4\u51C6\u5907</div>
            </div>
        `;
      shell.appendChild(header);
      const seatPanel = document.createElement("div");
      seatPanel.className = "sk-panel sk-felt";
      seatPanel.style.cssText = "position:relative;flex:1;min-height:360px;overflow:hidden;";
      const seatStage = document.createElement("div");
      seatStage.id = "room-seats";
      seatStage.style.cssText = "position:relative;width:100%;height:100%;";
      for (let i = 0; i < 5; i++) {
        const player = store.players.find((p) => p.seat_idx === i);
        const pos = LayoutManager.instance.getRoomSeatPosition(i);
        const seat = document.createElement("div");
        seat.style.cssText = `
                position:absolute;
                top:${pos.top};
                left:${pos.left};
                transform:translate(-50%, -50%) scale(${pos.scale});
                width:${layout === "portrait" ? "120px" : "136px"};
                padding:14px 12px;
                box-sizing:border-box;
                border-radius:20px;
                text-align:center;
                border:1px solid rgba(255,255,255,0.14);
                background:${player ? `linear-gradient(180deg, ${SEAT_COLORS[i]}cc, rgba(7, 17, 24, 0.78))` : "rgba(255,255,255,0.06)"};
                transition:top 0.28s ease,left 0.28s ease,transform 0.28s ease;
            `;
        if (player) {
          const isMe = player.user_id === store.userId;
          seat.innerHTML = `
                    <div style="width:46px;height:46px;border-radius:50%;margin:0 auto 10px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.18);"></div>
                    <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;color:#fff7ed;">${player.nickname || player.user_id.slice(0, 8)}${isMe ? " \xB7 \u6211" : ""}</div>
                    <div class="sk-muted" style="font-size:12px;margin-top:6px;">${player.is_ready ? "\u5DF2\u51C6\u5907" : "\u7B49\u5F85\u4E2D"} \xB7 \u5EA7\u4F4D${i + 1}</div>
                `;
        } else {
          seat.innerHTML = `
                    <div style="width:46px;height:46px;border-radius:50%;margin:0 auto 10px;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.12);"></div>
                    <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;color:#d4dce4;">\u7A7A\u5EA7\u4F4D</div>
                    <div class="sk-muted" style="font-size:12px;margin-top:6px;">\u5EA7\u4F4D${i + 1}</div>
                `;
        }
        seatStage.appendChild(seat);
      }
      seatPanel.appendChild(seatStage);
      shell.appendChild(seatPanel);
      const btnBar = document.createElement("div");
      btnBar.style.cssText = "display:flex;gap:14px;justify-content:center;flex-wrap:wrap;";
      const me = store.getPlayer(store.userId);
      const readyBtn = createButton(me?.is_ready ? "\u53D6\u6D88\u51C6\u5907" : "\u51C6\u5907", me?.is_ready ? "warning" : "success", () => {
        AudioManager.instance.playSfx("click");
        if (me && me.is_ready) {
          NetworkManager.instance.sendMsg(MSG_C2S_CANCEL_READY);
        } else {
          NetworkManager.instance.sendMsg(MSG_C2S_READY);
        }
      });
      readyBtn.id = "ready-btn";
      const leaveBtn = createButton("\u79BB\u5F00\u623F\u95F4", "ghost", () => {
        AudioManager.instance.playSfx("switch");
        NetworkManager.instance.sendMsg(MSG_C2S_LEAVE_ROOM);
      });
      btnBar.appendChild(readyBtn);
      btnBar.appendChild(leaveBtn);
      shell.appendChild(btnBar);
      if (this.container) {
        this.container.replaceWith(root);
      }
      this.container = root;
    }
  };

  // assets/scripts/ui/CardNode.ts
  var CARD_STYLE_ID = "sankaer-card-style";
  var CardNode = class {
    static create(card, options = {}) {
      ensureTheme();
      ensureCardStyles();
      const width = options.width ?? 86;
      const height = Math.round(width * 1.42);
      const root = document.createElement("div");
      root.className = `sk-card sk-pop-in${options.selected ? " is-selected" : ""}${options.disabled ? " is-disabled" : ""}`;
      root.style.width = `${width}px`;
      root.style.height = `${height}px`;
      root.style.setProperty("--card-lift", options.selected ? "-18px" : "0px");
      if (options.onClick) {
        root.style.cursor = options.disabled ? "default" : "pointer";
        root.onclick = () => {
          if (!options.disabled) {
            options.onClick?.();
          }
        };
      }
      const img = document.createElement("img");
      img.alt = cardToString(card);
      img.src = resolveCardAsset(card, options.faceDown === true);
      img.draggable = false;
      img.onerror = () => {
        img.style.display = "none";
        fallback.style.display = "flex";
      };
      root.appendChild(img);
      const fallback = document.createElement("div");
      fallback.className = "sk-card-fallback";
      fallback.textContent = options.faceDown ? "\u724C\u80CC" : cardToString(card);
      fallback.style.display = "none";
      root.appendChild(fallback);
      if (options.ownerLabel) {
        const label = document.createElement("div");
        label.className = "sk-card-owner";
        label.textContent = options.ownerLabel;
        root.appendChild(label);
      }
      return root;
    }
  };
  function ensureCardStyles() {
    if (typeof document === "undefined" || document.getElementById(CARD_STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = CARD_STYLE_ID;
    style.textContent = `
        .sk-card {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            border-radius: 16px;
            overflow: hidden;
            transform: translateY(var(--card-lift, 0px));
            transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
            box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
            background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(232, 224, 214, 0.98));
            border: 1px solid rgba(82, 54, 34, 0.25);
        }

        .sk-card img,
        .sk-card-fallback {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .sk-card.is-selected {
            box-shadow: 0 22px 34px rgba(0, 0, 0, 0.32), 0 0 0 3px rgba(244, 184, 96, 0.45);
        }

        .sk-card.is-disabled {
            filter: grayscale(0.14) brightness(0.92);
        }

        .sk-card-fallback {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            box-sizing: border-box;
            color: #24313b;
            font-family: 'Segoe UI Semibold', sans-serif;
            font-size: 16px;
            text-align: center;
            background: linear-gradient(180deg, #fff6e6, #efe4d2);
        }

        .sk-card-owner {
            position: absolute;
            left: 8px;
            right: 8px;
            bottom: 8px;
            padding: 3px 6px;
            border-radius: 999px;
            background: rgba(7, 17, 24, 0.62);
            color: #f7eee2;
            font-size: 10px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    `;
    document.head.appendChild(style);
  }
  function resolveCardAsset(card, faceDown) {
    if (faceDown) {
      return "assets/resources/cards/card_back.png";
    }
    if (card.rank === 14) {
      return "assets/resources/cards/card_joker_black.png";
    }
    if (card.rank === 15) {
      return "assets/resources/cards/card_joker_red.png";
    }
    const suit = getSuitName(card.suit);
    const rank = getRankName(card.rank);
    return `assets/resources/cards/card_${suit}_${rank}.png`;
  }
  function getSuitName(suit) {
    const suitMap = {
      1: "spades",
      2: "hearts",
      3: "diamonds",
      4: "clubs"
    };
    return suitMap[suit] || "spades";
  }
  function getRankName(rank) {
    if (rank === 1) return "A";
    if (rank === 11) return "J";
    if (rank === 12) return "Q";
    if (rank === 13) return "K";
    if (rank >= 2 && rank <= 9) return `0${rank}`;
    return String(rank);
  }

  // assets/scripts/views/GameView.ts
  var SEAT_COLORS2 = ["#d76c5b", "#4c72aa", "#6b5db8", "#3ba177", "#d69a42"];
  var GameView = class {
    constructor() {
      this.container = null;
      this.countdownTimer = null;
      this.selectedBidSuit = 1;
      this.refresh = () => {
        this.render();
      };
    }
    show() {
      this.render();
      if (this.container) {
        document.body.appendChild(this.container);
      }
      const events = [
        "DEAL_CARDS",
        "FLIP_RESULT",
        "BID_UPDATE",
        "BID_RESULT",
        "BOTTOM_CARDS",
        "PARTNER_CALLED",
        "TURN",
        "CARD_PLAYED",
        "ROUND_RESULT",
        "SERVER_ERROR",
        "LAYOUT_CHANGED"
      ];
      events.forEach((eventName) => EventManager.instance.on(eventName, this.refresh));
      this.startCountdownTicker();
    }
    hide() {
      const events = [
        "DEAL_CARDS",
        "FLIP_RESULT",
        "BID_UPDATE",
        "BID_RESULT",
        "BOTTOM_CARDS",
        "PARTNER_CALLED",
        "TURN",
        "CARD_PLAYED",
        "ROUND_RESULT",
        "SERVER_ERROR",
        "LAYOUT_CHANGED"
      ];
      events.forEach((eventName) => EventManager.instance.off(eventName, this.refresh));
      this.stopCountdownTicker();
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
    render() {
      const store = GameStore.instance;
      const layout = LayoutManager.instance.mode;
      const root = createScreenRoot("game-view");
      const shell = getScreenShell(root);
      const header = document.createElement("div");
      header.className = "sk-panel sk-wood";
      header.style.cssText = `
            padding: 16px 20px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            flex-wrap:wrap;
        `;
      const dealerName = store.getPlayer(store.dealerId)?.nickname || (store.dealerId ? store.dealerId.slice(0, 8) : "-");
      header.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:24px;color:#ffe0b5;">\u724C\u5C40\u8FDB\u884C\u4E2D</div>
                <div class="sk-muted" style="font-size:13px;">\u623F\u95F4 ${store.roomId} \xB7 ${store.tier} \u500D\u573A \xB7 ${phaseLabel(store.phase)}</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="sk-chip">\u53EB\u5206 ${store.bidScore || "-"}</div>
                <div class="sk-chip">\u4E3B\u82B1\u8272 ${suitSymbol(store.trumpSuit)}</div>
                <div class="sk-chip">\u5E84\u5BB6 ${dealerName}</div>
                <div class="sk-chip">\u6293\u5206 ${store.catcherScore}</div>
                <div class="sk-chip sk-countdown">\u5012\u8BA1\u65F6 ${store.remainingTurnSeconds}s</div>
            </div>
        `;
      shell.appendChild(header);
      const content = document.createElement("div");
      content.style.cssText = `
            flex:1;
            min-height:0;
            display:grid;
            grid-template-columns:${layout === "portrait" ? "1fr" : "minmax(0, 1fr) 330px"};
            gap:16px;
        `;
      const tablePanel = document.createElement("div");
      tablePanel.className = "sk-panel sk-felt";
      tablePanel.style.cssText = "position:relative;min-height:420px;overflow:hidden;";
      const tableStage = document.createElement("div");
      tableStage.style.cssText = "position:relative;width:100%;height:100%;min-height:420px;";
      this.renderSeats(tableStage);
      this.renderCenterStage(tableStage);
      tablePanel.appendChild(tableStage);
      content.appendChild(tablePanel);
      const sidePanel = document.createElement("div");
      sidePanel.style.cssText = `
            display:flex;
            flex-direction:${layout === "portrait" ? "row" : "column"};
            gap:16px;
            min-width:0;
        `;
      sidePanel.appendChild(this.renderActionPanel());
      sidePanel.appendChild(this.renderInfoPanel());
      content.appendChild(sidePanel);
      shell.appendChild(content);
      const handPanel = document.createElement("div");
      handPanel.className = "sk-panel";
      handPanel.style.cssText = "padding:16px 18px;display:flex;flex-direction:column;gap:12px;";
      const handHeader = document.createElement("div");
      handHeader.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;";
      handHeader.innerHTML = `
            <div>
                <div class="sk-title" style="font-size:22px;color:#ffe0b5;">\u6211\u7684\u624B\u724C</div>
                <div class="sk-muted" style="font-size:13px;">\u5171 ${store.myHand.length} \u5F20\uFF0C${selectionHint(store.phase, store.selectedCards.size)}</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${store.partnerCard ? `<div class="sk-chip">\u642D\u6863\u724C ${cardToString(store.partnerCard)}</div>` : ""}
                ${store.isMyTurn ? '<div class="sk-chip">\u5F53\u524D\u8F6E\u5230\u4F60</div>' : ""}
            </div>
        `;
      handPanel.appendChild(handHeader);
      handPanel.appendChild(this.renderHandArea());
      shell.appendChild(handPanel);
      if (this.container) {
        this.container.replaceWith(root);
      }
      this.container = root;
    }
    renderSeats(stage) {
      const store = GameStore.instance;
      for (let seatIdx = 0; seatIdx < 5; seatIdx++) {
        const player = store.players.find((item) => item.seat_idx === seatIdx);
        if (!player) {
          continue;
        }
        const pos = LayoutManager.instance.getGameSeatPosition(seatIdx, store.mySeatIdx);
        const seat = document.createElement("div");
        const isTurn = store.currentTurnId === player.user_id;
        const isMe = player.user_id === store.userId;
        const cardCount = store.playerCardCounts[player.user_id];
        seat.style.cssText = `
                position:absolute;
                top:${pos.top};
                left:${pos.left};
                transform:translate(-50%, -50%) scale(${pos.scale});
                width:${isMe ? "180px" : "148px"};
                padding:12px;
                box-sizing:border-box;
                border-radius:22px;
                background:linear-gradient(180deg, ${SEAT_COLORS2[seatIdx]}dd, rgba(9, 18, 24, 0.86));
                border:${isTurn ? "2px solid rgba(244,184,96,0.95)" : "1px solid rgba(255,255,255,0.14)"};
                box-shadow:${isTurn ? "0 0 0 4px rgba(244,184,96,0.18)" : "0 14px 28px rgba(0,0,0,0.18)"};
                transition:top 0.28s ease,left 0.28s ease,transform 0.28s ease,border 0.18s ease;
            `;
        const badges = [
          player.user_id === store.dealerId ? "\u5E84" : "",
          player.platform === "ai" ? "AI" : "",
          isTurn ? "\u51FA\u724C\u4E2D" : ""
        ].filter(Boolean).join(" \xB7 ");
        seat.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.16);border:2px solid rgba(255,255,255,0.18);flex-shrink:0;"></div>
                    <div style="min-width:0;">
                        <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;color:#fff7e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${player.nickname || player.user_id.slice(0, 8)}${isMe ? " \xB7 \u6211" : ""}
                        </div>
                        <div class="sk-muted" style="font-size:12px;margin-top:4px;">
                            \u5EA7\u4F4D${seatIdx + 1} \xB7 ${typeof cardCount === "number" ? `\u5269\u4F59 ${cardCount} \u5F20` : "\u724C\u6570\u5F85\u540C\u6B65"}
                        </div>
                    </div>
                </div>
                ${badges ? `<div class="sk-chip" style="margin-top:10px;">${badges}</div>` : ""}
            `;
        stage.appendChild(seat);
      }
    }
    renderCenterStage(stage) {
      const store = GameStore.instance;
      const ring = document.createElement("div");
      ring.style.cssText = `
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
            width:min(58vw, 420px);
            height:min(58vw, 420px);
            border-radius:50%;
            border:1px dashed rgba(255,255,255,0.18);
            opacity:0.55;
        `;
      stage.appendChild(ring);
      const info = document.createElement("div");
      info.style.cssText = `
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
            text-align:center;
            pointer-events:none;
        `;
      info.innerHTML = `
            <div class="sk-title" style="font-size:18px;color:#f6e0b7;">${phaseLabel(store.phase)}</div>
            <div class="sk-muted" style="font-size:13px;margin-top:6px;">${store.isMyTurn ? "\u8F6E\u5230\u4F60\u884C\u52A8" : "\u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6"}</div>
        `;
      stage.appendChild(info);
      if (store.currentRoundPlays.length === 0) {
        return;
      }
      store.currentRoundPlays.forEach((play, index) => {
        const player = store.getPlayer(play.player_id);
        const pos = LayoutManager.instance.getGameSeatPosition(player?.seat_idx ?? index, store.mySeatIdx);
        const card = CardNode.create(play.card, {
          width: 86,
          ownerLabel: player?.nickname || play.player_id.slice(0, 6)
        });
        card.style.position = "absolute";
        card.style.top = interpolateToCenter(pos.top, 50, index * 2);
        card.style.left = interpolateToCenter(pos.left, 50, index * -3);
        card.style.transform = "translate(-50%, -50%)";
        stage.appendChild(card);
      });
    }
    renderActionPanel() {
      const panel = document.createElement("div");
      panel.className = "sk-panel";
      panel.style.cssText = "padding:18px;display:flex;flex-direction:column;gap:14px;flex:1;";
      const store = GameStore.instance;
      const title = document.createElement("div");
      title.className = "sk-title";
      title.style.cssText = "font-size:22px;color:#ffe0b5;";
      title.textContent = "\u884C\u52A8\u9762\u677F";
      panel.appendChild(title);
      switch (store.phase) {
        case "bidding":
          this.renderBidPanel(panel);
          break;
        case "bottom":
          if (store.isDealer) {
            this.renderBottomPanel(panel);
          } else {
            panel.appendChild(this.createNotice("\u7B49\u5F85\u5E84\u5BB6\u6263\u5E95..."));
          }
          break;
        case "calling":
          if (store.isDealer) {
            this.renderCallPanel(panel);
          } else {
            panel.appendChild(this.createNotice("\u7B49\u5F85\u5E84\u5BB6\u53EB\u642D\u6863..."));
          }
          break;
        case "playing":
          this.renderPlayPanel(panel);
          break;
        default:
          panel.appendChild(this.createNotice(`\u5F53\u524D\u9636\u6BB5\uFF1A${phaseLabel(store.phase)}`));
          break;
      }
      return panel;
    }
    renderInfoPanel() {
      const store = GameStore.instance;
      const panel = document.createElement("div");
      panel.className = "sk-panel";
      panel.style.cssText = "padding:18px;display:flex;flex-direction:column;gap:12px;flex:1;";
      panel.innerHTML = `
            <div class="sk-title" style="font-size:20px;color:#ffe0b5;">\u724C\u684C\u72B6\u6001</div>
            <div class="sk-chip">\u4E3B\u82B1\u8272 ${suitSymbol(store.trumpSuit)}</div>
            <div class="sk-chip">\u53EB\u5206 ${store.bidScore || "-"}</div>
            <div class="sk-chip">\u6293\u5206 ${store.catcherScore}</div>
            <div class="sk-chip">\u5F53\u524D\u884C\u52A8 ${store.currentTurnId ? store.getPlayer(store.currentTurnId)?.nickname || store.currentTurnId.slice(0, 8) : "-"}</div>
            ${store.partnerCard ? `<div class="sk-chip">\u642D\u6863\u724C ${cardToString(store.partnerCard)}</div>` : '<div class="sk-chip">\u642D\u6863\u724C \u5F85\u516C\u5E03</div>'}
        `;
      return panel;
    }
    renderBidPanel(panel) {
      const store = GameStore.instance;
      panel.appendChild(this.createNotice(store.isMyTurn ? "\u8F6E\u5230\u4F60\u53EB\u5206\u5E76\u9009\u62E9\u4E3B\u82B1\u8272\u3002" : `\u7B49\u5F85 ${store.currentTurnId.slice(0, 8)} \u53EB\u5206...`));
      if (!store.isMyTurn) {
        return;
      }
      const suitRow = document.createElement("div");
      suitRow.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;";
      [1, 2, 3, 4].forEach((suit) => {
        const button = createButton(suitSymbol(suit), suit === this.selectedBidSuit ? "primary" : "ghost", () => {
          AudioManager.instance.playSfx("switch", 0.6);
          this.selectedBidSuit = suit;
          this.refresh();
        });
        button.style.minWidth = "68px";
        suitRow.appendChild(button);
      });
      panel.appendChild(suitRow);
      const scoreGrid = document.createElement("div");
      scoreGrid.style.cssText = "display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;";
      [75, 80, 85, 90, 95, 100].forEach((score) => {
        const button = createButton(`${score} \u5206`, "secondary", () => {
          AudioManager.instance.playSfx("click");
          NetworkManager.instance.sendMsg(MSG_C2S_BID, { score, suit: this.selectedBidSuit });
        });
        scoreGrid.appendChild(button);
      });
      panel.appendChild(scoreGrid);
      panel.appendChild(createButton("\u4E0D\u53EB", "ghost", () => {
        AudioManager.instance.playSfx("switch");
        NetworkManager.instance.sendMsg(MSG_C2S_PASS_BID);
      }));
    }
    renderBottomPanel(panel) {
      const store = GameStore.instance;
      panel.appendChild(this.createNotice(`\u8BF7\u9009\u62E9 4 \u5F20\u724C\u6263\u5E95\uFF0C\u5F53\u524D\u5DF2\u9009 ${store.selectedCards.size}/4\u3002`));
      panel.appendChild(createButton("\u786E\u8BA4\u6263\u5E95", "success", () => {
        if (store.selectedCards.size !== 4) {
          alert("\u8BF7\u9009\u62E9\u6070\u597D 4 \u5F20\u724C");
          return;
        }
        AudioManager.instance.playSfx("click");
        const selectedIndexes = Array.from(store.selectedCards).sort((a, b) => a - b);
        const cards = selectedIndexes.map((index) => store.myHand[index]);
        NetworkManager.instance.sendMsg(MSG_C2S_SET_BOTTOM, { cards });
        for (let i = selectedIndexes.length - 1; i >= 0; i--) {
          store.myHand.splice(selectedIndexes[i], 1);
        }
        store.selectedCards.clear();
        store.playerCardCounts[store.userId] = store.myHand.length;
        this.refresh();
      }));
    }
    renderCallPanel(panel) {
      const store = GameStore.instance;
      panel.appendChild(this.createNotice("\u9009\u62E9\u4E00\u5F20\u724C\u4F5C\u4E3A\u642D\u6863\u724C\uFF0C\u72EC\u5E84\u53EF\u9009\u62E9\u81EA\u5DF1\u624B\u91CC\u6CA1\u6709\u7684\u9AD8\u4F4D\u724C\u3002"));
      panel.appendChild(createButton("\u786E\u8BA4\u53EB\u642D\u6863", "secondary", () => {
        if (store.selectedCards.size !== 1) {
          alert("\u8BF7\u9009\u62E9\u6070\u597D 1 \u5F20\u724C");
          return;
        }
        AudioManager.instance.playSfx("click");
        const index = Array.from(store.selectedCards)[0];
        const card = store.myHand[index];
        NetworkManager.instance.sendMsg(MSG_C2S_CALL_PARTNER, { card });
      }));
    }
    renderPlayPanel(panel) {
      const store = GameStore.instance;
      panel.appendChild(this.createNotice(store.isMyTurn ? "\u8BF7\u9009\u62E9 1 \u5F20\u724C\u5E76\u6253\u51FA\u3002" : `\u7B49\u5F85 ${store.currentTurnId.slice(0, 8)} \u51FA\u724C...`));
      if (!store.isMyTurn) {
        return;
      }
      panel.appendChild(createButton("\u51FA\u724C", "warning", () => {
        if (store.selectedCards.size !== 1) {
          alert("\u8BF7\u9009\u62E9 1 \u5F20\u724C\u51FA\u724C");
          return;
        }
        AudioManager.instance.playSfx("play");
        const index = Array.from(store.selectedCards)[0];
        const card = store.myHand[index];
        NetworkManager.instance.sendMsg(MSG_C2S_PLAY_CARD, { card });
      }));
    }
    renderHandArea() {
      const store = GameStore.instance;
      const wrap = document.createElement("div");
      wrap.className = "sk-scroll";
      wrap.style.cssText = "padding: 12px 4px 4px;";
      const row = document.createElement("div");
      row.className = "sk-card-fan";
      row.style.justifyContent = store.myHand.length > 9 ? "flex-start" : "center";
      wrap.appendChild(row);
      const width = LayoutManager.instance.getHandCardWidth(store.myHand.length);
      store.myHand.forEach((card, index) => {
        const isSelected = store.selectedCards.has(index);
        const node = CardNode.create(card, {
          width,
          selected: isSelected,
          disabled: !isSelectablePhase(store.phase),
          onClick: () => this.toggleHandSelection(index)
        });
        node.style.marginLeft = index === 0 ? "0" : `-${Math.min(Math.round(width * 0.26), 24)}px`;
        row.appendChild(node);
      });
      return wrap;
    }
    toggleHandSelection(index) {
      const store = GameStore.instance;
      if (!isSelectablePhase(store.phase)) {
        return;
      }
      if (store.selectedCards.has(index)) {
        store.selectedCards.delete(index);
      } else {
        if (store.phase === "playing" || store.phase === "calling") {
          store.selectedCards.clear();
        }
        if (store.phase === "bottom" && store.selectedCards.size >= 4) {
          return;
        }
        store.selectedCards.add(index);
      }
      AudioManager.instance.playSfx("switch", 0.35);
      this.refresh();
    }
    createNotice(text) {
      const notice = document.createElement("div");
      notice.className = "sk-muted";
      notice.style.cssText = "line-height:1.8;font-size:14px;";
      notice.textContent = text;
      return notice;
    }
    startCountdownTicker() {
      this.stopCountdownTicker();
      this.countdownTimer = window.setInterval(() => {
        if (GameStore.instance.phase === "playing" || GameStore.instance.phase === "bidding" || GameStore.instance.phase === "bottom" || GameStore.instance.phase === "calling") {
          if (GameStore.instance.remainingTurnSeconds <= 3 && GameStore.instance.remainingTurnSeconds > 0) {
            AudioManager.instance.playSfx("warning", 0.18);
          }
          this.render();
        }
      }, 1e3);
    }
    stopCountdownTicker() {
      if (this.countdownTimer !== null) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    }
  };
  function suitSymbol(suit) {
    const map = { 1: "\u2660", 2: "\u2665", 3: "\u2666", 4: "\u2663" };
    return map[suit] || "-";
  }
  function phaseLabel(phase) {
    const map = {
      dealing: "\u53D1\u724C\u4E2D",
      bidding: "\u53EB\u5206\u9636\u6BB5",
      bottom: "\u6263\u5E95\u9636\u6BB5",
      calling: "\u53EB\u642D\u6863",
      playing: "\u51FA\u724C\u9636\u6BB5",
      settling: "\u7ED3\u7B97\u4E2D"
    };
    return map[phase] || phase;
  }
  function selectionHint(phase, count) {
    if (phase === "bottom") {
      return `\u6263\u5E95\u5DF2\u9009 ${count}/4`;
    }
    if (phase === "calling") {
      return count === 1 ? "\u5DF2\u9009\u62E9\u642D\u6863\u724C" : "\u8BF7\u9009\u62E9 1 \u5F20\u642D\u6863\u724C";
    }
    if (phase === "playing") {
      return count === 1 ? "\u5DF2\u9009\u62E9\u51FA\u724C" : "\u8BF7\u9009\u62E9 1 \u5F20\u8981\u51FA\u7684\u724C";
    }
    return count > 0 ? `\u5DF2\u9009 ${count} \u5F20` : "\u7B49\u5F85\u4E0B\u4E00\u6B65\u64CD\u4F5C";
  }
  function isSelectablePhase(phase) {
    return phase === "bottom" || phase === "calling" || phase === "playing";
  }
  function interpolateToCenter(position, center, offset) {
    const numeric = parseInt(position.replace("%", ""), 10);
    const next = numeric + (center - numeric) * 0.42 + offset;
    return `${next}%`;
  }

  // assets/scripts/views/ResultView.ts
  var ResultView = class {
    constructor() {
      this.container = null;
      this.render = () => {
        const store = GameStore.instance;
        const layout = LayoutManager.instance.mode;
        const root = createScreenRoot("result-view");
        const shell = getScreenShell(root);
        shell.style.justifyContent = "center";
        shell.style.alignItems = "center";
        const panel = document.createElement("div");
        panel.className = "sk-panel sk-wood sk-pop-in";
        panel.style.cssText = `
            width:min(100%, ${layout === "portrait" ? "560px" : "980px"});
            padding:28px;
            box-sizing:border-box;
            display:grid;
            grid-template-columns:${layout === "portrait" ? "1fr" : "0.95fr 1.05fr"};
            gap:22px;
        `;
        const titleBlock = document.createElement("div");
        titleBlock.style.cssText = "display:flex;flex-direction:column;gap:14px;justify-content:center;";
        const winText = store.winner === "dealer" ? "\u5E84\u5BB6\u65B9\u80DC" : store.winner === "catcher" ? "\u6293\u5206\u65B9\u80DC" : "\u5F03\u5C40";
        titleBlock.innerHTML = `
            <div class="sk-chip">${store.isSolo ? "\u72EC\u5E84\u7ED3\u7B97" : "\u56E2\u961F\u7ED3\u7B97"}</div>
            <div class="sk-title" style="font-size: clamp(34px, 6vw, 56px); color:${store.winner === "dealer" ? "#ffe1ba" : "#d9ffe8"};">${winText}</div>
            <div class="sk-muted" style="line-height:1.8;">
                \u53EB\u5206 ${store.bidScore} \xB7 \u6293\u5206\u65B9\u5F97\u5206 ${store.catcherScore}
                ${store.partnerCard ? `\xB7 \u642D\u6863\u724C ${cardToString(store.partnerCard)}` : ""}
                ${store.isSolo ? " \xB7 \u72EC\u5E84 1v4" : ""}
            </div>
        `;
        const table = document.createElement("div");
        table.className = "sk-panel";
        table.style.cssText = "padding:18px;";
        store.settlements.forEach((settlement) => {
          if (!settlement.player_id) {
            return;
          }
          const row = document.createElement("div");
          const isMe = settlement.player_id === store.userId;
          const roleText = settlement.role === "dealer" ? "\u5E84\u5BB6" : settlement.role === "partner" ? "\u642D\u6863" : "\u6293\u5206";
          const amountColor = settlement.amount >= 0 ? "#80efac" : "#ff9986";
          const sign = settlement.amount >= 0 ? "+" : "";
          row.style.cssText = `
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                padding:14px 10px;
                border-bottom:1px solid rgba(255,255,255,0.08);
                color:${isMe ? "#fff0cb" : "#d8e0e7"};
            `;
          row.innerHTML = `
                <div>
                    <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:14px;">${settlement.player_id.slice(0, 12)}${isMe ? " \xB7 \u6211" : ""}</div>
                    <div class="sk-muted" style="font-size:12px;">${roleText} \xB7 \u500D\u7387 ${settlement.multiplier}x</div>
                </div>
                <div style="font-family:'Segoe UI Semibold',sans-serif;font-size:22px;color:${amountColor};">${sign}${settlement.amount}</div>
            `;
          table.appendChild(row);
        });
        const btnArea = document.createElement("div");
        btnArea.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;margin-top:16px;";
        const againBtn = createButton("\u518D\u6765\u4E00\u5C40", "primary", () => {
          AudioManager.instance.playSfx("click");
          NetworkManager.instance.sendMsg(MSG_C2S_READY);
          store.phase = "room";
          EventManager.instance.emit("PHASE_CHANGE", "room");
        });
        const backBtn = createButton("\u8FD4\u56DE\u5927\u5385", "ghost", () => {
          AudioManager.instance.playSfx("switch");
          store.phase = "lobby";
          EventManager.instance.emit("PHASE_CHANGE", "lobby");
        });
        btnArea.appendChild(againBtn);
        btnArea.appendChild(backBtn);
        titleBlock.appendChild(btnArea);
        panel.appendChild(titleBlock);
        panel.appendChild(table);
        shell.appendChild(panel);
        if (this.container) {
          this.container.replaceWith(root);
        }
        this.container = root;
      };
    }
    show() {
      this.render();
      if (this.container) {
        document.body.appendChild(this.container);
      }
      EventManager.instance.on("LAYOUT_CHANGED", this.render);
    }
    hide() {
      EventManager.instance.off("LAYOUT_CHANGED", this.render);
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
  };

  // assets/scripts/views/App.ts
  var App = class {
    constructor() {
      this.currentView = null;
      this.loginView = new LoginView();
      this.lobbyView = new LobbyView();
      this.roomView = new RoomView();
      this.gameView = new GameView();
      this.resultView = new ResultView();
    }
    start() {
      void GameManager.instance.init();
      GameStore.instance;
      EventManager.instance.on("LOGIN_RESULT", (data) => {
        if (data.success) this.switchView("lobby");
      });
      EventManager.instance.on("ROOM_JOINED", () => {
        this.switchView("room");
      });
      EventManager.instance.on("GAME_START", () => {
        AudioManager.instance.playSfx("deal", 0.55);
        this.switchView("dealing");
      });
      EventManager.instance.on("DEAL_CARDS", () => {
        AudioManager.instance.playSfx("deal", 0.65);
        this.switchView("playing");
      });
      EventManager.instance.on("GAME_RESULT", () => {
        const mySettlement = GameStore.instance.settlements.find((settlement) => settlement.player_id === GameStore.instance.userId);
        AudioManager.instance.playSfx(mySettlement && mySettlement.amount >= 0 ? "win" : "lose");
        this.switchView("result");
      });
      EventManager.instance.on("PHASE_CHANGE", (phase) => {
        this.switchView(phase);
      });
      EventManager.instance.on("PLAYER_LEFT", () => {
        const store = GameStore.instance;
        if (!store.players.find((p) => p.user_id === store.userId)) {
          store.phase = "lobby";
          this.switchView("lobby");
        }
      });
      this.switchView("login");
    }
    switchView(phase) {
      if (this.currentView) {
        this.currentView.hide();
        this.currentView = null;
      }
      switch (phase) {
        case "login":
          this.currentView = this.loginView;
          this.loginView.show();
          break;
        case "lobby":
          this.currentView = this.lobbyView;
          this.lobbyView.show();
          break;
        case "room":
          this.currentView = this.roomView;
          this.roomView.show();
          break;
        case "dealing":
        case "bidding":
        case "bottom":
        case "calling":
        case "playing":
        case "settling":
          this.currentView = this.gameView;
          this.gameView.show();
          break;
        case "result":
          this.currentView = this.resultView;
          this.resultView.show();
          break;
      }
    }
  };
  function startApp() {
    const app = new App();
    app.start();
  }

  // assets/scripts/main.ts
  startApp();
})();
//# sourceMappingURL=app.js.map
