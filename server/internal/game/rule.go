package game

import "errors"

// ValidateTurn 校验是否轮到该玩家出牌
func ValidateTurn(room *Room, seatIdx int) error {
	expected := GetCurrentPlaySeat(room)
	if seatIdx != expected {
		return errors.New("未轮到该玩家出牌")
	}
	return nil
}

// ValidateFollow 校验跟牌规则
// 1. 领出者可出任意牌
// 2. 跟牌者：领出主牌 → 有主牌必须跟主牌
// 3. 跟牌者：领出副牌 → 有同花色必须跟同花色
// 4. 无法跟牌时可出任意牌（杀牌或垫牌）
func ValidateFollow(room *Room, seatIdx int, card Card) error {
	// 领出者可出任意牌
	if seatIdx == room.LeadIdx && !room.RoundPlayed[room.LeadIdx] {
		return nil
	}

	leadCard := room.RoundCards[room.LeadIdx]
	player := room.GetPlayer(seatIdx)
	hand := player.Hand

	if leadCard.IsTrump(room.TrumpSuit) {
		// 领出的是主牌 → 有主牌必须跟主牌
		hasTrump := false
		for _, c := range hand {
			if c.IsTrump(room.TrumpSuit) {
				hasTrump = true
				break
			}
		}
		if hasTrump && !card.IsTrump(room.TrumpSuit) {
			return errors.New("有主牌必须跟主牌")
		}
	} else {
		// 领出的是副牌 → 有同花色必须跟同花色
		leadSuit := leadCard.Suit
		hasSameSuit := false
		for _, c := range hand {
			if !c.IsTrump(room.TrumpSuit) && c.Suit == leadSuit {
				hasSameSuit = true
				break
			}
		}
		if hasSameSuit && (card.IsTrump(room.TrumpSuit) || card.Suit != leadSuit) {
			return errors.New("有同花色必须跟同花色")
		}
	}

	return nil
}
