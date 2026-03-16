package game

// SettleResult 结算结果
type SettleResult struct {
	CatcherScore    int           // 抓分方最终得分
	BidScore        int           // 叫分值
	CatcherWin      bool          // 抓分方是否赢
	IsZeroClear     bool          // 是否清零双倍
	IsLastHandBonus bool          // 是否关底双倍
	SpecialMulti    int           // 特殊倍数 (1/2/4)
	BaseScore       int           // 基础分
	IsSolo          bool          // 是否1v4
	IsAbandoned     bool          // 是否弃局
	PlayerCoins     [MaxPlayers]int // 每个玩家的金币变化
}

// bidBaseScore 叫分对应基础分
var bidBaseScore = map[int]int{
	75:  10,
	80:  30,
	85:  40,
	90:  50,
	95:  60,
	100: 70,
}

// GetBaseScore 获取叫分对应的基础分
func GetBaseScore(bidScore int) int {
	if base, ok := bidBaseScore[bidScore]; ok {
		return base
	}
	return 0
}

// Settle 执行结算
func Settle(room *Room, roomMultiplier int) SettleResult {
	scoreResult := CalcFinalScore(room)

	result := SettleResult{
		CatcherScore: scoreResult.CatcherScore,
		BidScore:     room.BidScore,
		IsSolo:       room.IsSolo,
		IsAbandoned:  room.IsAbandoned,
		BaseScore:    GetBaseScore(room.BidScore),
	}

	// 弃局处理
	if room.IsAbandoned {
		return settleAbandoned(room, result, roomMultiplier)
	}

	// 胜负判定
	result.CatcherWin = scoreResult.CatcherScore >= room.BidScore

	// 清零双倍
	result.IsZeroClear = scoreResult.CatcherScore == 0

	// 关底双倍
	result.IsLastHandBonus = scoreResult.LastHandCatcher

	// 特殊倍数计算
	result.SpecialMulti = 1
	if result.IsZeroClear {
		result.SpecialMulti *= 2
	}
	if result.IsLastHandBonus {
		result.SpecialMulti *= 2
	}

	// 计算金币变化
	effectiveBase := result.BaseScore * result.SpecialMulti
	coinUnit := effectiveBase * roomMultiplier

	if result.CatcherWin {
		// 抓分方赢
		for i := 0; i < MaxPlayers; i++ {
			if room.Teams[i] {
				// 庄家方输
				multi := dealerMultiplier(room, i)
				result.PlayerCoins[i] = -coinUnit * multi
			} else {
				// 抓分方赢
				result.PlayerCoins[i] = coinUnit * 1
			}
		}
	} else {
		// 庄家方赢
		for i := 0; i < MaxPlayers; i++ {
			if room.Teams[i] {
				// 庄家方赢
				multi := dealerMultiplier(room, i)
				result.PlayerCoins[i] = coinUnit * multi
			} else {
				// 抓分方输
				result.PlayerCoins[i] = -coinUnit * 1
			}
		}
	}

	return result
}

// dealerMultiplier 返回庄家方角色倍数
func dealerMultiplier(room *Room, seatIdx int) int {
	if room.IsSolo {
		// 1v4: 庄家=4
		if seatIdx == room.DealerIdx {
			return 4
		}
		return 1
	}
	// 2v3: 庄家=2, 暗家=1
	if seatIdx == room.DealerIdx {
		return 2
	}
	return 1 // 暗家
}

// settleAbandoned 弃局结算
func settleAbandoned(room *Room, result SettleResult, roomMultiplier int) SettleResult {
	result.SpecialMulti = 1
	coinUnit := result.BaseScore * roomMultiplier

	// 庄家输一半, 搭档输一半, 抓分方不赢不输
	for i := 0; i < MaxPlayers; i++ {
		result.PlayerCoins[i] = 0
	}

	if room.IsSolo {
		// 叫自己弃局: 庄家输 4份 的一半 = 2份
		result.PlayerCoins[room.DealerIdx] = -coinUnit * 2
		// 抓分方不赢不输，但要凑零和
		// 4人各 +coinUnit/2... 但需整除
		// 根据规则：庄家和搭档各输一半，抓分方不赢不输
		// 1v4弃局：庄家输一半（正常是4份→输2份），没有搭档
		// 零和需要其他人分摊 → 4人各得 coinUnit*2/4 = coinUnit/2
		perCatcher := coinUnit * 2 / 4
		for i := 0; i < MaxPlayers; i++ {
			if i != room.DealerIdx {
				result.PlayerCoins[i] = perCatcher
			}
		}
	} else {
		// 2v3弃局：庄家输一半(正常2份→1份)，搭档输一半(正常1份→0.5份)
		// 为简化计算，用整数：庄家输 coinUnit, 搭档输 coinUnit/2
		dealerLoss := coinUnit      // 2份的一半=1份
		partnerLoss := coinUnit / 2 // 1份的一半

		result.PlayerCoins[room.DealerIdx] = -dealerLoss
		if room.PartnerIdx >= 0 {
			result.PlayerCoins[room.PartnerIdx] = -partnerLoss
		}

		// 抓分方平分（凑零和）
		totalLoss := dealerLoss + partnerLoss
		catcherCount := 0
		for i := 0; i < MaxPlayers; i++ {
			if !room.Teams[i] {
				catcherCount++
			}
		}
		if catcherCount > 0 {
			perCatcher := totalLoss / catcherCount
			for i := 0; i < MaxPlayers; i++ {
				if !room.Teams[i] {
					result.PlayerCoins[i] = perCatcher
				}
			}
		}
	}

	return result
}

// VerifyZeroSum 验证结算零和
func VerifyZeroSum(coins [MaxPlayers]int) bool {
	sum := 0
	for _, c := range coins {
		sum += c
	}
	return sum == 0
}
