package gameservice

import (
	"encoding/json"
	"math/rand"
	"time"

	"go.uber.org/zap"
	"sankaer/internal/game"
	"sankaer/internal/pkg/pb"
)

// handleFlipCard 翻牌定首家
func (s *Service) handleFlipCard(roomID, userID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		sendError(userID, 1, "房间不存在")
		return
	}

	if room.State != game.StateFlipping {
		s.mu.Unlock()
		sendError(userID, 2, "当前状态不能翻牌")
		return
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	firstIdx, flippedCard := game.DetermineFirstPlayer(rng)
	room.FirstIdx = firstIdx
	room.State = game.StateDealing
	s.mu.Unlock()

	// 广播翻牌结果
	playerIDs := getRoomPlayerIDs(s, roomID)
	firstPlayer := room.GetPlayer(firstIdx)
	broadcastToRoom(playerIDs, pb.MsgS2CFlipResult, &pb.S2CFlipResult{
		Card:          cardToDTO(flippedCard),
		FirstDealerID: firstPlayer.ID,
	})

	// 自动发牌
	s.doDeal(roomID)
}

// handleReady 准备
func (s *Service) handleReady(roomID, userID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	if err := room.SetReady(userID, true); err != nil {
		s.mu.Unlock()
		sendError(userID, 2, err.Error())
		return
	}
	s.mu.Unlock()

	// 广播准备状态
	playerIDs := getRoomPlayerIDs(s, roomID)
	broadcastToRoom(playerIDs, pb.MsgS2CReadyUpdate, &pb.S2CReadyUpdate{
		UserID:  userID,
		IsReady: true,
	})

	// 检查是否全部就绪
	if room.AllReady() {
		s.startGame(roomID)
	}
}

// handleCancelReady 取消准备
func (s *Service) handleCancelReady(roomID, userID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}
	room.SetReady(userID, false)
	s.mu.Unlock()

	playerIDs := getRoomPlayerIDs(s, roomID)
	broadcastToRoom(playerIDs, pb.MsgS2CReadyUpdate, &pb.S2CReadyUpdate{
		UserID:  userID,
		IsReady: false,
	})
}

// startGame 开始游戏
func (s *Service) startGame(roomID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	if err := room.StartGame(); err != nil {
		s.mu.Unlock()
		zap.L().Error("开始游戏失败", zap.String("roomId", roomID), zap.Error(err))
		return
	}
	s.mu.Unlock()

	playerIDs := getRoomPlayerIDs(s, roomID)
	broadcastToRoom(playerIDs, pb.MsgS2CGameStart, &pb.S2CGameStart{
		RoomID: roomID,
	})

	if room.State == game.StateFlipping {
		// 首局：自动翻牌
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		firstIdx, flippedCard := game.DetermineFirstPlayer(rng)
		room.FirstIdx = firstIdx
		room.State = game.StateDealing

		firstPlayer := room.GetPlayer(firstIdx)
		broadcastToRoom(playerIDs, pb.MsgS2CFlipResult, &pb.S2CFlipResult{
			Card:          cardToDTO(flippedCard),
			FirstDealerID: firstPlayer.ID,
		})
	}

	// 发牌
	s.doDeal(roomID)
}

// doDeal 执行发牌
func (s *Service) doDeal(roomID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	game.Deal(room, rng)

	room.State = game.StateBidding
	room.BidManager = game.NewBidManager(room.FirstIdx)
	s.mu.Unlock()

	// 给每个玩家发送手牌
	for _, p := range room.Players {
		if p == nil {
			continue
		}
		cards := make([]pb.CardDTO, len(p.Hand))
		for i, c := range p.Hand {
			cards[i] = cardToDTO(c)
		}
		sendToPlayer(p.ID, pb.MsgS2CDealCards, &pb.S2CDealCards{
			Cards: cards,
		})
	}

	// 通知当前叫分玩家
	currentPlayer := room.GetPlayer(room.BidManager.CurrentIdx)
	if currentPlayer != nil {
		playerIDs := getRoomPlayerIDs(s, roomID)
		broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
			PlayerID: currentPlayer.ID,
			Timeout:  15, // 叫分超时
		})
	}

	// 启动叫分倒计时
	s.startTimer(room, roomID)
}

// handleBid 叫分
func (s *Service) handleBid(roomID, userID string, payload json.RawMessage) {
	var req pb.C2SBid
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	player := room.FindPlayer(userID)
	if player == nil {
		s.mu.Unlock()
		return
	}

	if room.State != game.StateBidding || room.BidManager == nil {
		s.mu.Unlock()
		sendError(userID, 2, "当前不是叫分阶段")
		return
	}

	err := room.BidManager.Bid(player.SeatIdx, int(req.Score), game.Suit(req.Suit))
	s.mu.Unlock()

	if err != nil {
		sendError(userID, 3, err.Error())
		return
	}

	playerIDs := getRoomPlayerIDs(s, roomID)

	// 广播叫分更新
	broadcastToRoom(playerIDs, pb.MsgS2CBidUpdate, &pb.S2CBidUpdate{
		PlayerID: userID,
		Score:    req.Score,
		Suit:     req.Suit,
	})

	if room.BidManager.Finished {
		s.finishBid(roomID)
		return
	}

	// 通知下一个叫分
	nextPlayer := room.GetPlayer(room.BidManager.CurrentIdx)
	if nextPlayer != nil {
		broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
			PlayerID: nextPlayer.ID,
			Timeout:  15,
		})
	}
}

// handlePassBid 不叫
func (s *Service) handlePassBid(roomID, userID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	player := room.FindPlayer(userID)
	if player == nil || room.BidManager == nil {
		s.mu.Unlock()
		return
	}

	err := room.BidManager.Bid(player.SeatIdx, 0, game.SuitNone)
	s.mu.Unlock()

	if err != nil {
		sendError(userID, 3, err.Error())
		return
	}

	playerIDs := getRoomPlayerIDs(s, roomID)
	broadcastToRoom(playerIDs, pb.MsgS2CBidUpdate, &pb.S2CBidUpdate{
		PlayerID: userID,
		Score:    0,
	})

	if room.BidManager.Finished {
		s.finishBid(roomID)
		return
	}

	nextPlayer := room.GetPlayer(room.BidManager.CurrentIdx)
	if nextPlayer != nil {
		broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
			PlayerID: nextPlayer.ID,
			Timeout:  15,
		})
	}
}

// finishBid 叫分结束
func (s *Service) finishBid(roomID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	bm := room.BidManager
	room.DealerIdx = bm.HighestIdx
	room.BidScore = bm.HighestBid
	room.TrumpSuit = bm.HighestSuit
	room.IsForced = bm.IsForced()

	// 发底牌给庄家
	game.GiveBottomToDealer(room)
	room.State = game.StateBottom
	s.mu.Unlock()

	playerIDs := getRoomPlayerIDs(s, roomID)
	dealer := room.GetPlayer(room.DealerIdx)

	// 广播叫分结果
	broadcastToRoom(playerIDs, pb.MsgS2CBidResult, &pb.S2CBidResult{
		DealerID: dealer.ID,
		Score:    uint32(room.BidScore),
		Suit:     uint32(room.TrumpSuit),
	})

	// 发送底牌给庄家
	bottomCards := make([]pb.CardDTO, len(room.Bottom))
	for i, c := range room.Bottom {
		bottomCards[i] = cardToDTO(c)
	}
	sendToPlayer(dealer.ID, pb.MsgS2CBottomCards, &pb.S2CBottomCards{
		Cards: bottomCards,
	})

	// 通知庄家扣底
	broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
		PlayerID: dealer.ID,
		Timeout:  30,
	})
}

// handleSetBottom 扣底
func (s *Service) handleSetBottom(roomID, userID string, payload json.RawMessage) {
	var req pb.C2SSetBottom
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	if room.State != game.StateBottom {
		s.mu.Unlock()
		sendError(userID, 2, "当前不是扣底阶段")
		return
	}

	dealer := room.GetPlayer(room.DealerIdx)
	if dealer == nil || dealer.ID != userID {
		s.mu.Unlock()
		sendError(userID, 3, "只有庄家能扣底")
		return
	}

	cards := make([]game.Card, len(req.Cards))
	for i, c := range req.Cards {
		cards[i] = dtoToCard(c)
	}

	if err := game.HandleBottom(room, cards); err != nil {
		s.mu.Unlock()
		sendError(userID, 4, err.Error())
		return
	}

	room.State = game.StateCalling
	s.mu.Unlock()

	// 通知庄家叫搭档
	playerIDs := getRoomPlayerIDs(s, roomID)
	broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
		PlayerID: userID,
		Timeout:  20,
	})
}

// handleCallPartner 叫搭档
func (s *Service) handleCallPartner(roomID, userID string, payload json.RawMessage) {
	var req pb.C2SCallPartner
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	if room.State != game.StateCalling {
		s.mu.Unlock()
		sendError(userID, 2, "当前不是叫搭档阶段")
		return
	}

	partnerCard := dtoToCard(req.Card)
	if err := game.CallPartner(room, partnerCard); err != nil {
		s.mu.Unlock()
		sendError(userID, 4, err.Error())
		return
	}

	room.State = game.StatePlaying
	room.CurrentRound = 0
	room.LeadIdx = room.DealerIdx
	s.mu.Unlock()

	playerIDs := getRoomPlayerIDs(s, roomID)

	// 广播叫搭档结果
	broadcastToRoom(playerIDs, pb.MsgS2CPartnerCalled, &pb.S2CPartnerCalled{
		Card:   cardToDTO(room.PartnerCard),
		IsSolo: room.IsSolo,
	})

	// 通知庄家出牌（庄家先出）
	dealer := room.GetPlayer(room.DealerIdx)
	broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
		PlayerID: dealer.ID,
		Timeout:  20,
	})
}

// handlePlayCard 出牌
func (s *Service) handlePlayCard(roomID, userID string, payload json.RawMessage) {
	var req pb.C2SPlayCard
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	if room.State != game.StatePlaying {
		s.mu.Unlock()
		sendError(userID, 2, "当前不是出牌阶段")
		return
	}

	player := room.FindPlayer(userID)
	if player == nil {
		s.mu.Unlock()
		return
	}

	card := dtoToCard(req.Card)
	roundBefore := room.CurrentRound
	err := game.PlayCard(room, player.SeatIdx, card)
	roundAfter := room.CurrentRound
	s.mu.Unlock()

	if err != nil {
		sendError(userID, 4, err.Error())
		return
	}

	playerIDs := getRoomPlayerIDs(s, roomID)

	// 广播出牌
	broadcastToRoom(playerIDs, pb.MsgS2CCardPlayed, &pb.S2CCardPlayed{
		PlayerID: userID,
		Card:     cardToDTO(card),
	})

	// 检查本轮是否结束
	if roundAfter != roundBefore || room.State == game.StateSettling {
		// 一轮结束
		winner := room.GetPlayer(room.LastWinnerIdx)
		winnerID := ""
		if winner != nil {
			winnerID = winner.ID
		}

		broadcastToRoom(playerIDs, pb.MsgS2CRoundResult, &pb.S2CRoundResult{
			WinnerID:          winnerID,
			Points:            uint32(room.PointsTaken[1]),
			TotalCatcherScore: uint32(room.PointsTaken[1]),
		})

		if room.State == game.StateSettling {
			// 游戏结束
			s.doSettle(roomID)
			return
		}
	}

	// 通知下一个出牌
	nextSeat := game.GetCurrentPlaySeat(room)
	if nextSeat >= 0 {
		nextPlayer := room.GetPlayer(nextSeat)
		if nextPlayer != nil {
			broadcastToRoom(playerIDs, pb.MsgS2CTurn, &pb.S2CTurn{
				PlayerID: nextPlayer.ID,
				Timeout:  20,
			})
		}
	}
}

// handleForfeit 弃局
func (s *Service) handleForfeit(roomID, userID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	room.IsAbandoned = true
	room.State = game.StateSettling
	s.mu.Unlock()

	s.doSettle(roomID)
}

// doSettle 结算
func (s *Service) doSettle(roomID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	// 获取场次倍率
	tier, _ := s.roomTiers[roomID]
	if tier == 0 {
		tier = 10
	}

	result := game.Settle(room, int(tier))
	room.State = game.StateFinished
	room.GameCount++
	s.mu.Unlock()

	// 构建结算消息
	settlements := make([]pb.SettlementDTO, game.MaxPlayers)
	for i := 0; i < game.MaxPlayers; i++ {
		p := room.GetPlayer(i)
		if p == nil {
			continue
		}
		role := "catcher"
		if i == room.DealerIdx {
			role = "dealer"
		} else if i == room.PartnerIdx {
			role = "partner"
		}
		settlements[i] = pb.SettlementDTO{
			PlayerID:   p.ID,
			Role:       role,
			Multiplier: int32(game.MaxPlayers), // 简化
			Amount:     int64(result.PlayerCoins[i]),
		}
	}

	// 广播结算结果
	playerIDs := getRoomPlayerIDs(s, roomID)
	dealer := room.GetPlayer(room.DealerIdx)
	dealerID := ""
	if dealer != nil {
		dealerID = dealer.ID
	}
	partnerID := ""
	if room.PartnerIdx >= 0 {
		partner := room.GetPlayer(room.PartnerIdx)
		if partner != nil {
			partnerID = partner.ID
		}
	}

	winner := "dealer"
	if result.IsDraw {
		winner = "draw"
	} else if result.CatcherWin {
		winner = "catcher"
	}
	if result.IsAbandoned {
		winner = "forfeit"
	}

	gameResult := &pb.S2CGameResult{
		BidScore:        uint32(result.BidScore),
		CatcherScore:    uint32(result.CatcherScore),
		BottomDoubled:   result.IsBottomDoubled,
		Winner:          winner,
		IsSolo:          result.IsSolo,
		IsZeroClear:     result.IsZeroClear,
		IsLastHandBonus: result.IsBottomDoubled,
		DealerID:        dealerID,
		PartnerID:       partnerID,
		PartnerCard:     ptrCardDTO(room.PartnerCard),
		Settlements:     settlements,
	}
	broadcastToRoom(playerIDs, pb.MsgS2CGameResult, gameResult)

	// 重置准备状态
	for _, p := range room.Players {
		if p != nil {
			p.Ready = false
		}
	}
	room.State = game.StateWaiting
}

// handleLeaveRoom 离开房间
func (s *Service) handleLeaveRoom(roomID, userID string) {
	s.mu.Lock()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return
	}

	if err := room.Leave(userID); err != nil {
		s.mu.Unlock()
		return
	}

	playerIDs := getRoomPlayerIDs(s, roomID)
	s.mu.Unlock()

	broadcastToRoom(playerIDs, pb.MsgS2CPlayerLeft, &pb.S2CPlayerLeft{
		UserID: userID,
	})

	// 房间为空则删除
	if room.PlayerCount() == 0 {
		s.mu.Lock()
		delete(s.rooms, roomID)
		delete(s.roomTiers, roomID)
		s.mu.Unlock()
	}
}

// startTimer 启动倒计时（简化版，后续接入 TimerManager）
func (s *Service) startTimer(room *game.Room, roomID string) {
	// MVP 阶段暂不启动倒计时自动操作
	// 后续会接入 room.Timer
}

// === 数据转换辅助函数 ===

func cardToDTO(c game.Card) pb.CardDTO {
	return pb.CardDTO{Suit: uint32(c.Suit), Rank: uint32(c.Rank)}
}

func dtoToCard(d pb.CardDTO) game.Card {
	return game.Card{Suit: game.Suit(d.Suit), Rank: game.Rank(d.Rank)}
}

func ptrCardDTO(c game.Card) *pb.CardDTO {
	dto := cardToDTO(c)
	return &dto
}
