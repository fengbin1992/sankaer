package nats

import (
	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
)

var Conn *nats.Conn

func Init(addr string) error {
	var err error
	Conn, err = nats.Connect(addr)
	if err != nil {
		return err
	}

	zap.L().Info("nats connected", zap.String("addr", addr))
	return nil
}

func Close() {
	if Conn != nil {
		Conn.Close()
	}
}
