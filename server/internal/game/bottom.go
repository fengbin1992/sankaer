package game

import "errors"

// HandleBottom 庄家扣底
// 庄家获得4张底牌后，从14张手牌中选4张扣回
func HandleBottom(room *Room, discards []Card) error {
	if room.State != StateBottom {
		return errors.New("当前状态不是扣底阶段")
	}

	dealer := room.GetPlayer(room.DealerIdx)
	if dealer == nil {
		return errors.New("庄家不存在")
	}

	if len(discards) != BottomSize {
		return errors.New("必须恰好扣4张牌")
	}

	// 庄家应该有14张牌（10+4底牌）
	if len(dealer.Hand) != HandSize+BottomSize {
		return errors.New("庄家手牌数量异常")
	}

	// 校验扣的牌都在手牌中
	tempHand := make([]Card, len(dealer.Hand))
	copy(tempHand, dealer.Hand)

	for _, d := range discards {
		var ok bool
		tempHand, ok = CardsRemove(tempHand, d)
		if !ok {
			return errors.New("扣的牌不在手牌中")
		}
	}

	// 执行扣底
	dealer.Hand = tempHand
	room.Bottom = make([]Card, BottomSize)
	copy(room.Bottom, discards)

	return nil
}

// GiveBottomToDealer 将底牌发给庄家
func GiveBottomToDealer(room *Room) error {
	dealer := room.GetPlayer(room.DealerIdx)
	if dealer == nil {
		return errors.New("庄家不存在")
	}

	dealer.Hand = append(dealer.Hand, room.Bottom...)
	return nil
}
