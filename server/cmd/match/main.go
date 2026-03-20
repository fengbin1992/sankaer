package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"
	"sankaer/internal/match"
	"sankaer/internal/pkg/config"
	"sankaer/internal/pkg/logger"
	pkgRedis "sankaer/internal/pkg/redis"
	pkgNats "sankaer/internal/pkg/nats"
)

func main() {
	configPath := flag.String("config", "configs/match.yaml", "配置文件路径")
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

	zap.L().Info("匹配服务启动", zap.Int("port", cfg.Server.Port))

	// 启动匹配服务
	svc := match.NewService(cfg)
	if err := svc.Start(); err != nil {
		zap.L().Fatal("匹配服务启动失败", zap.Error(err))
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	svc.Stop()
	zap.L().Info("匹配服务正在关闭...")
}
