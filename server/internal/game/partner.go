package game

import "errors"

// CallPartner 庄家叫搭档
func CallPartner(room *Room, partnerCard Card) error {
	if room.State != StateCalling {
		return errors.New("当前状态不是叫搭档阶段")
	}

	dealer := room.GetPlayer(room.DealerIdx)
	if dealer == nil {
		return errors.New("庄家不存在")
	}

	// 校验叫搭档限制：80~95 不能叫大王/小王
	if room.BidScore >= 80 && room.BidScore <= 95 {
		if partnerCard.IsJoker() {
			return errors.New("叫分80~95时不能叫大王或小王做搭档")
		}
	}

	room.PartnerCard = partnerCard

	// 判断是否叫自己（庄家手中有这张牌）
	if CardsContain(dealer.Hand, partnerCard) {
		room.IsSolo = true
		room.PartnerIdx = room.DealerIdx
	} else {
		room.IsSolo = false
		// 找到持有搭档牌的玩家
		room.PartnerIdx = -1
		for i, p := range room.Players {
			if p != nil && i != room.DealerIdx && CardsContain(p.Hand, partnerCard) {
				room.PartnerIdx = i
				break
			}
		}
	}

	// 设置阵营
	room.SetTeams()

	return nil
}
