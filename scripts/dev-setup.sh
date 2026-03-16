#!/bin/bash
# scripts/dev-setup.sh
# 开发环境初始化

set -e

echo "=== 检查依赖 ==="

# 检查 Go
if ! command -v go &> /dev/null; then
    echo "ERROR: Go 未安装，请先安装 Go 1.22+"
    exit 1
fi
echo "Go: $(go version)"

# 检查 protoc
if ! command -v protoc &> /dev/null; then
    echo "WARNING: protoc 未安装，请安装 Protocol Buffers 编译器"
    echo "  下载：https://github.com/protocolbuffers/protobuf/releases"
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "WARNING: Docker 未安装，无法启动本地开发环境"
fi

echo ""
echo "=== 安装 Go 依赖 ==="
cd server
go mod download
echo "Go 依赖安装完成"

echo ""
echo "=== 安装 protoc Go 插件 ==="
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

echo ""
echo "=== 开发环境初始化完成 ==="
echo "  1. 运行 'make proto' 生成协议代码"
echo "  2. 运行 'make docker-dev' 启动 Redis + MySQL + NATS"
echo "  3. 运行 'make server-run' 启动后端服务"
echo "  4. 用 Cocos Creator 打开 client/ 目录"
