# sankaer/Makefile - Monorepo 聚合命令

# ========== Proto 生成 ==========
.PHONY: proto
proto:
	@echo ">>> 生成 Protobuf 代码..."
	bash scripts/proto-gen.sh

# ========== Server ==========
.PHONY: server-build server-run server-test
server-build:
	cd server && go build -o bin/gateway ./cmd/gateway/
	cd server && go build -o bin/game ./cmd/game/
	cd server && go build -o bin/match ./cmd/match/
	cd server && go build -o bin/user ./cmd/user/

server-test:
	cd server && go test ./...

server-run: server-build
	cd server && ./bin/gateway &
	cd server && ./bin/game &
	cd server && ./bin/match &
	cd server && ./bin/user &

# ========== Docker ==========
.PHONY: docker-dev docker-build
docker-dev:
	docker compose -f deploy/docker/docker-compose.dev.yaml up -d

docker-stop:
	docker compose -f deploy/docker/docker-compose.dev.yaml down

docker-build:
	docker build -f deploy/docker/Dockerfile.gateway -t sankaer/gateway:latest ./server
	docker build -f deploy/docker/Dockerfile.game -t sankaer/game:latest ./server
	docker build -f deploy/docker/Dockerfile.match -t sankaer/match:latest ./server
	docker build -f deploy/docker/Dockerfile.user -t sankaer/user:latest ./server

# ========== 全量 ==========
.PHONY: setup
setup:
	@echo ">>> 初始化开发环境..."
	bash scripts/dev-setup.sh
	$(MAKE) proto
	@echo ">>> 完成！前端请用 Cocos Creator 打开 client/ 目录"
