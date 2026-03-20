# 第三阶段：前后端联调与基础 UI

> 本文档为"三卡二"项目第三阶段开发任务清单。
> 目标：打通 WebSocket 通信全流程，实现基础 UI（色块/文字代替美术），玩家可完成一局完整游戏。
> 依赖：第一阶段（骨架）+ 第二阶段（游戏逻辑）已完成。

---

## 任务清单

### 一、WebSocket 网关实现

- [ ] **1.1** 实现 `server/internal/gateway/server.go` — WebSocket 服务器
  - 基于 gorilla/websocket 的 HTTP 升级
  - JWT Token 鉴权（握手阶段校验）
  - goroutine-per-connection 模型
  - 📎 参考：[三卡二小程序.md - §5.1 整体架构 + §5.3 分层职责](../三卡二小程序.md#51-整体架构)

- [ ] **1.2** 实现 `server/internal/gateway/connection.go` — 连接管理
  - 连接池（userId ↔ conn 映射）
  - 单用户单连接（互踢）
  - 连接关闭时自动清理
  - 📎 参考：[三卡二小程序.md - §5.5 Redis 数据结构设计（online:{userId}）](../三卡二小程序.md#55-redis-数据结构设计)

- [ ] **1.3** 实现 `server/internal/gateway/router.go` — 消息路由
  - Protobuf Packet 解包（msg_type → handler 分发）
  - 网关层消息转发到游戏逻辑服务（通过 NATS）
  - 📎 参考：[三卡二小程序.md - §4.5 消息序列号与可靠性](../三卡二小程序.md#45-消息序列号与可靠性)

- [ ] **1.4** 实现 `server/internal/gateway/heartbeat.go` — 心跳检测
  - 30 秒心跳间隔
  - 超时 90 秒无心跳断开连接
  - 📎 参考：[三卡二小程序.md - §4.3 网络层设计（心跳保活）](../三卡二小程序.md#43-网络层设计websocket--protobuf)

---

### 二、匹配服务实现

- [ ] **2.1** 实现 `server/internal/match/queue.go` — 匹配队列
  - Redis Sorted Set 按等待时间排序
  - 按场次（10/100/1000/10000 倍）分池
  - 📎 参考：[三卡二小程序.md - §5.5 Redis（match:queue:{tier}）](../三卡二小程序.md#55-redis-数据结构设计)

- [ ] **2.2** 实现 `server/internal/match/matcher.go` — 5 人匹配算法
  - 队列满 5 人时触发匹配
  - 创建房间，通知所有玩家
  - 取消匹配处理
  - 📎 参考：[三卡二小程序.md - §5.3 匹配服务](../三卡二小程序.md#53-分层职责)

---

### 三、用户服务实现

- [ ] **3.1** 实现 `server/internal/user/auth.go` — 登录鉴权
  - 游客登录（设备 ID，MVP 阶段优先）
  - JWT Token 签发与校验
  - 📎 参考：[三卡二小程序.md - §9.1 登录方式](../三卡二小程序.md#91-登录方式)

- [ ] **3.2** 实现 `server/internal/user/coin.go` — 金币管理
  - 查询余额 / 加币 / 扣币
  - 入场资格校验（金币 ≥ 最低入场要求）
  - 事务保证扣币原子性
  - 📎 参考：[三卡二规则.md - §6.1 房间场次](../三卡二规则.md#61-房间场次)

---

### 四、游戏逻辑服务与网关打通

- [ ] **4.1** 实现游戏服务 NATS 消息监听与处理
  - 网关 → 游戏服务：C2S 消息转发
  - 游戏服务 → 网关：S2C 消息回推（单播/广播）
  - 房间状态存储 Redis（room:{roomId}）
  - 📎 参考：[三卡二小程序.md - §5.5 Redis 数据结构设计](../三卡二小程序.md#55-redis-数据结构设计)

- [ ] **4.2** 实现断线重连
  - 玩家重连后推送 S2C_RoomState 全量同步
  - 断线 30 秒未重连 → 自动 AI 托管
  - 📎 参考：[三卡二小程序.md - §4.5 消息序列号与可靠性](../三卡二小程序.md#45-消息序列号与可靠性)

---

### 五、客户端 Protobuf 编解码

- [ ] **5.1** 客户端集成 protobufjs，实现 `ProtobufCodec.ts`
  - 编码：msgType + payload → 二进制 Packet
  - 解码：二进制 → Packet → 提取 msgType 和 payload
  - 📎 参考：[三卡二小程序.md - §4.3 网络层设计（ProtobufCodec）](../三卡二小程序.md#43-网络层设计websocket--protobuf)

- [ ] **5.2** 完善 `MessageRouter.ts` 实际消息分发
  - 注册各 S2C 消息处理器
  - 连接 NetworkManager 和各 View 层

---

### 六、客户端基础 UI（色块/文字版）

- [ ] **6.1** 实现登录页 `LoginView.ts`
  - 游客一键登录按钮
  - 登录成功后跳转大厅
  - 📎 参考：[三卡二小程序.md - §7.2 启动页/首页大厅](../三卡二小程序.md#72-启动页--首页大厅)

- [ ] **6.2** 实现大厅页 `LobbyView.ts`
  - 快速匹配按钮（选场次）
  - 显示金币余额和昵称
  - 📎 参考：[三卡二小程序.md - §7.2 启动页/首页大厅](../三卡二小程序.md#72-启动页--首页大厅)

- [ ] **6.3** 实现房间等待页 `RoomView.ts`
  - 5 人座位显示（色块+昵称）
  - 准备/取消准备按钮
  - 5 人就绪后自动开始
  - 📎 参考：[三卡二小程序.md - §7.2.1 房间等待页](../三卡二小程序.md#721-房间等待页五人座位)

- [ ] **6.4** 实现游戏牌桌页 `GameView.ts` — 手牌与出牌
  - 五边形座位布局（色块代替头像）
  - 手牌区：文字显示牌面（如 "♠A"），点击选中高亮
  - 出牌区：显示每人本轮出的牌
  - 出牌/不出按钮
  - 📎 参考：[三卡二小程序.md - §7.3 游戏牌桌（竖屏）](../三卡二小程序.md#73-游戏牌桌竖屏)

- [ ] **6.5** 实现叫分/扣底/叫搭档面板
  - 叫分面板：显示可选分值按钮（75~100）+ 花色选择 + 不叫
  - 扣底面板：手牌中选 4 张扣回 + 确认按钮
  - 叫搭档面板：选择一张牌作为搭档 + 确认
  - 📎 参考：[三卡二小程序.md - §7.5 叫分/扣底/叫搭档面板](../三卡二小程序.md#75-叫分面板--扣底面板--叫搭档面板--结算页面)

- [ ] **6.6** 实现结算页 `ResultView.ts`
  - 显示胜负结果、搭档揭晓
  - 5 人金币变化列表
  - 再来一局 / 返回大厅按钮
  - 📎 参考：[三卡二小程序.md - §7.5](../三卡二小程序.md#75-叫分面板--扣底面板--叫搭档面板--结算页面)

---

### 七、端到端联调测试

- [ ] **7.1** 本地联调：启动全部后端服务 + 客户端，完成一局完整游戏
  - 验证：登录 → 匹配 → 进房 → 发牌 → 叫分 → 扣底 → 叫搭档 → 出牌×10 → 结算
  - 验证断线重连恢复正确
  - 📎 参考：[三卡二小程序.md - §13.8 开发流程](../三卡二小程序.md#138-开发流程)

---

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| V1 | WebSocket 连接 | 客户端能连接网关，心跳保活正常 |
| V2 | 登录成功 | 游客登录拿到 Token，进入大厅 |
| V3 | 匹配成功 | 5 人匹配成功，全部进入同一房间 |
| V4 | 对局完整 | 能从发牌打到结算，无中断 |
| V5 | 断线重连 | 断线后重连，牌桌状态恢复正确 |
| V6 | 结算正确 | 金币变化符合规则，零和验证通过 |

---

## 实施记录

| 日期 | 任务编号 | 完成内容 | 备注 |
|------|----------|----------|------|
| 2026-03-16 | 1.1~1.4 | WebSocket 网关服务完整实现 | server/internal/gateway/ (server.go, connection.go, router.go, heartbeat.go) |
| 2026-03-16 | 2.1~2.2 | 匹配服务完整实现 | server/internal/match/ (service.go, queue.go, matcher.go) |
| 2026-03-16 | 3.1~3.2 | 用户服务完整实现 | server/internal/user/ (service.go, auth.go, coin.go, model.go) |
| 2026-03-16 | 4.1~4.2 | 游戏逻辑服务与网关打通 | server/internal/gameservice/ (service.go, handler.go, broadcast.go) |
| 2026-03-16 | 5.1~5.2 | 客户端协议层（JSON Packet编解码） | client/assets/scripts/protocol/ (MsgType.ts, ProtobufCodec.ts), 更新 NetworkManager.ts, MessageRouter.ts |
| 2026-03-16 | 6.1~6.6 | 客户端基础UI（色块/文字版） | client/assets/scripts/views/ (LoginView, LobbyView, RoomView, GameView, ResultView, App.ts), stores/GameStore.ts |
| 2026-03-16 | - | 编译验证通过 | Go build ./... 通过，26个单元测试全部PASS |

### 技术决策

- **序列化方案**: MVP 阶段使用 JSON 编码（非 Protobuf 二进制），后续可平滑迁移
- **客户端 UI**: 使用纯 HTML DOM 创建色块+文字版 UI，不依赖 Cocos Creator 编辑器
- **NATS 主题设计**: `user.c2s` / `match.c2s` / `game.{roomId}.c2s` / `gateway.s2c.{userId}` / `gateway.broadcast`
- **网关鉴权**: 支持 `guest:{userId}` 简易模式 + JWT 标准模式
