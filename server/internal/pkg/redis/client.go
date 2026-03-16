package redis

import (
	"context"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

var Client *redis.Client

func Init(addr, password string, db int) error {
	Client = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx := context.Background()
	if err := Client.Ping(ctx).Err(); err != nil {
		return err
	}

	zap.L().Info("redis connected", zap.String("addr", addr))
	return nil
}

func Close() {
	if Client != nil {
		Client.Close()
	}
}
