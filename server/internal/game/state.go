package game

import "fmt"

// GameState 房间/游戏状态
type GameState int

const (
	StateWaiting  GameState = iota // 等待玩家加入
	StateFlipping                   // 翻牌定首家
	StateDealing                    // 发牌
	StateBidding                    // 叫分竞拍
	StateBottom                     // 扣底
	StateCalling                    // 叫搭档
	StatePlaying                    // 出牌
	StateSettling                   // 结算中
	StateFinished                   // 本局结束
)

var stateNames = map[GameState]string{
	StateWaiting:  "WAITING",
	StateFlipping: "FLIPPING",
	StateDealing:  "DEALING",
	StateBidding:  "BIDDING",
	StateBottom:   "BOTTOM",
	StateCalling:  "CALLING",
	StatePlaying:  "PLAYING",
	StateSettling: "SETTLING",
	StateFinished: "FINISHED",
}

func (s GameState) String() string {
	if name, ok := stateNames[s]; ok {
		return name
	}
	return fmt.Sprintf("UNKNOWN(%d)", int(s))
}

// validTransitions 定义合法的状态转移
var validTransitions = map[GameState][]GameState{
	StateWaiting:  {StateFlipping, StateDealing}, // 首局需翻牌，后续局直接发牌
	StateFlipping: {StateDealing},
	StateDealing:  {StateBidding},
	StateBidding:  {StateBottom},
	StateBottom:   {StateCalling},
	StateCalling:  {StatePlaying, StateSettling}, // 叫搭档后可出牌，也可弃局直接结算
	StatePlaying:  {StateSettling},
	StateSettling: {StateFinished},
	StateFinished: {StateWaiting}, // 再来一局
}

// CanTransit 检查状态转移是否合法
func CanTransit(from, to GameState) bool {
	targets, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, t := range targets {
		if t == to {
			return true
		}
	}
	return false
}
