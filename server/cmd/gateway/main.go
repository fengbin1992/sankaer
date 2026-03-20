package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"
	"sankaer/internal/gateway"
	"sankaer/internal/pkg/config"
	"sankaer/internal/pkg/logger"
	pkgRedis "sankaer/internal/pkg/redis"
	pkgNats "sankaer/internal/pkg/nats"
)

func main() {
	configPath := flag.String("config", "configs/gateway.yaml", "配置文件路径")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	if err := logger.Init(cfg.Log.Level, cfg.Log.Output); err != nil {
		fmt.Fprintf(os.Stderr, "初始化日志失败: %v\n", err)
		os.Exit(1)
	}

	if err := pkgRedis.Init(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB); err != nil {
		zap.L().Fatal("Redis 连接失败", zap.Error(err))
	}
	defer pkgRedis.Close()

	if err := pkgNats.Init(cfg.Nats.Addr); err != nil {
		zap.L().Fatal("NATS 连接失败", zap.Error(err))
	}
	defer pkgNats.Close()

	zap.L().Info("WebSocket 网关启动", zap.Int("port", cfg.Server.Port))

	// 启动 WebSocket 服务器
	srv := gateway.NewServer(cfg)
	go func() {
		if err := srv.Start(); err != nil {
			zap.L().Fatal("网关启动失败", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	srv.Stop()
	zap.L().Info("网关正在关闭...")
}
