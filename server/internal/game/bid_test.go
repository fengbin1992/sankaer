package game

import "testing"

func TestBidNormalFlow(t *testing.T) {
	bm := NewBidManager(0)

	// 玩家0叫75 ♠
	if err := bm.Bid(0, 75, SuitSpade); err != nil {
		t.Fatal(err)
	}
	if bm.HighestBid != 75 || bm.HighestIdx != 0 {
		t.Error("叫分状态不正确")
	}

	// 玩家1叫80 ♥
	if err := bm.Bid(1, 80, SuitHeart); err != nil {
		t.Fatal(err)
	}
	if bm.HighestBid != 80 || bm.HighestIdx != 1 {
		t.Error("叫分状态不正确")
	}

	// 玩家2不叫
	if err := bm.Bid(2, 0, SuitNone); err != nil {
		t.Fatal(err)
	}

	// 玩家3不叫
	if err := bm.Bid(3, 0, SuitNone); err != nil {
		t.Fatal(err)
	}

	// 玩家4不叫
	if err := bm.Bid(4, 0, SuitNone); err != nil {
		t.Fatal(err)
	}

	// 玩家0不叫（循环回来）
	if err := bm.Bid(0, 0, SuitNone); err != nil {
		t.Fatal(err)
	}

	if !bm.Finished {
		t.Error("叫分应已结束")
	}
	if bm.HighestBid != 80 || bm.HighestIdx != 1 {
		t.Errorf("最终庄家应为玩家1叫80，got bid=%d idx=%d", bm.HighestBid, bm.HighestIdx)
	}
}

func TestBidAllPass(t *testing.T) {
	bm := NewBidManager(2) // 首家=座位2

	for i := 0; i < MaxPlayers; i++ {
		seat := (2 + i) % MaxPlayers
		if err := bm.Bid(seat, 0, SuitNone); err != nil {
			t.Fatalf("seat %d pass failed: %v", seat, err)
		}
	}

	if !bm.Finished {
		t.Error("叫分应已结束")
	}
	if !bm.IsForced() {
		t.Error("应为强制叫分")
	}
	if bm.HighestBid != 75 {
		t.Errorf("强制叫分应为75，got %d", bm.HighestBid)
	}
	if bm.HighestIdx != 2 {
		t.Errorf("强制庄家应为首家(座位2)，got %d", bm.HighestIdx)
	}
}

func TestBidTo100(t *testing.T) {
	bm := NewBidManager(0)

	// 玩家0叫95
	if err := bm.Bid(0, 95, SuitSpade); err != nil {
		t.Fatal(err)
	}

	// 玩家1叫100 → 立即结束
	if err := bm.Bid(1, 100, SuitHeart); err != nil {
		t.Fatal(err)
	}

	if !bm.Finished {
		t.Error("叫到100应立即结束")
	}
	if bm.HighestBid != 100 || bm.HighestIdx != 1 {
		t.Error("庄家应为叫100的玩家1")
	}
}

func TestBidInvalidScore(t *testing.T) {
	bm := NewBidManager(0)

	// 叫70（低于最低75）
	if err := bm.Bid(0, 70, SuitSpade); err == nil {
		t.Error("should reject score < 75")
	}

	// 叫77（不是5的倍数）
	if err := bm.Bid(0, 77, SuitSpade); err == nil {
		t.Error("should reject non-multiple of 5")
	}

	// 正常叫75
	if err := bm.Bid(0, 75, SuitSpade); err != nil {
		t.Fatal(err)
	}

	// 玩家1叫75（不高于当前最高）
	if err := bm.Bid(1, 75, SuitHeart); err == nil {
		t.Error("should reject bid <= highest")
	}
}

func TestBidCyclic(t *testing.T) {
	bm := NewBidManager(0)

	// 玩家0叫75
	if err := bm.Bid(0, 75, SuitSpade); err != nil {
		t.Fatal(err)
	}

	// 玩家1叫80
	if err := bm.Bid(1, 80, SuitHeart); err != nil {
		t.Fatal(err)
	}

	// 玩家2, 3, 4不叫
	if err := bm.Bid(2, 0, SuitNone); err != nil {
		t.Fatal(err)
	}
	if err := bm.Bid(3, 0, SuitNone); err != nil {
		t.Fatal(err)
	}
	if err := bm.Bid(4, 0, SuitNone); err != nil {
		t.Fatal(err)
	}

	// 循环回来，玩家0加叫85
	if err := bm.Bid(0, 85, SuitDiamond); err != nil {
		t.Fatal(err)
	}

	// 玩家1不叫 → 结束
	if err := bm.Bid(1, 0, SuitNone); err != nil {
		t.Fatal(err)
	}

	if !bm.Finished {
		t.Error("叫分应已结束")
	}
	if bm.HighestBid != 85 || bm.HighestIdx != 0 {
		t.Errorf("庄家应为玩家0叫85，got bid=%d idx=%d", bm.HighestBid, bm.HighestIdx)
	}
}
