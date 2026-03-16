package game

import "errors"

// PlayCard 玩家出牌
func PlayCard(room *Room, seatIdx int, card Card) error {
	if room.State != StatePlaying {
		return errors.New("当前状态不是出牌阶段")
	}

	player := room.GetPlayer(seatIdx)
	if player == nil {
		return errors.New("玩家不存在")
	}

	// 校验是否轮到该玩家
	if err := ValidateTurn(room, seatIdx); err != nil {
		return err
	}

	// 校验牌是否在手牌中
	if !CardsContain(player.Hand, card) {
		return errors.New("出的牌不在手牌中")
	}

	// 校验跟牌规则
	if err := ValidateFollow(room, seatIdx, card); err != nil {
		return err
	}

	// 出牌
	player.Hand, _ = CardsRemove(player.Hand, card)
	room.RoundCards[seatIdx] = card
	room.RoundPlayed[seatIdx] = true

	// 检查本轮是否所有人都出完
	allPlayed := true
	for i := 0; i < MaxPlayers; i++ {
		if !room.RoundPlayed[i] {
			allPlayed = false
			break
		}
	}

	if allPlayed {
		// 本轮结束，判定赢家
		resolveRound(room)
	} else {
		// 下一个出牌的人由 GetCurrentPlaySeat 动态计算
	}

	return nil
}

// resolveRound 结算当前轮
func resolveRound(room *Room) {
	winnerIdx := room.LeadIdx
	leadCard := room.RoundCards[room.LeadIdx]
	leadSuit := getEffectiveSuit(leadCard, room.TrumpSuit)

	// 比较5张牌，找最大的
	for i := 0; i < MaxPlayers; i++ {
		if i == room.LeadIdx {
			continue
		}
		if CompareCards(room.RoundCards[i], room.RoundCards[winnerIdx], leadSuit, room.TrumpSuit) > 0 {
			winnerIdx = i
		}
	}

	// 计算本轮分值
	roundPoints := 0
	for i := 0; i < MaxPlayers; i++ {
		roundPoints += room.RoundCards[i].PointValue()
	}

	// 分值归入赢家阵营
	room.TricksTaken[winnerIdx]++
	if room.Teams[winnerIdx] {
		room.PointsTaken[0] += roundPoints // 庄家方
	} else {
		room.PointsTaken[1] += roundPoints // 抓分方
	}

	room.LastWinnerIdx = winnerIdx
	room.CurrentRound++

	if room.CurrentRound >= TotalRounds {
		// 10轮打完，进入结算
		return
	}

	// 赢家领出下一轮
	room.LeadIdx = winnerIdx
	room.RoundCards = [MaxPlayers]Card{}
	room.RoundPlayed = [MaxPlayers]bool{}
}

// getEffectiveSuit 获取牌的有效花色（主牌视为统一的"主花色"类别）
func getEffectiveSuit(card Card, trumpSuit Suit) Suit {
	if card.IsTrump(trumpSuit) {
		return trumpSuit // 所有主牌归为主花色类别
	}
	return card.Suit
}

// GetCurrentPlaySeat 获取当前应出牌的座位号
func GetCurrentPlaySeat(room *Room) int {
	// 从领出者开始，逆时针找第一个未出牌的
	for i := 0; i < MaxPlayers; i++ {
		seat := (room.LeadIdx + i) % MaxPlayers
		if !room.RoundPlayed[seat] {
			return seat
		}
	}
	return -1
}
