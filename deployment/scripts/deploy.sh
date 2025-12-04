#!/bin/bash
# 统一部署脚本 - Resume Optimizer
# 支持开发环境和生产环境的一键部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

# 显示使用说明
show_usage() {
    cat << EOF
Resume Optimizer - 统一部署脚本

用法:
    $0 [选项]

选项:
    -e, --env <ENV>         部署环境: dev (开发) 或 prod (生产), 默认: dev
    -s, --skip-build        跳过 Docker 镜像构建
    -m, --skip-migration    跳过数据库迁移
    -b, --backup            部署前备份数据库
    -h, --help              显示此帮助信息

示例:
    # 开发环境部署
    $0 --env dev

    # 生产环境部署（带备份）
    $0 --env prod --backup

    # 快速重启（跳过构建）
    $0 --env prod --skip-build

EOF
}

# 默认参数
ENV="dev"
SKIP_BUILD=false
SKIP_MIGRATION=false
BACKUP=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -m|--skip-migration)
            SKIP_MIGRATION=true
            shift
            ;;
        -b|--backup)
            BACKUP=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "未知参数: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 验证环境参数
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    print_error "无效的环境: $ENV (必须是 dev 或 prod)"
    exit 1
fi

# 设置环境相关变量
if [ "$ENV" = "prod" ]; then
    COMPOSE_FILE="deployment/docker-compose.prod.yml"
    ENV_FILE=".env.production"
    print_step "Resume Optimizer - 生产环境部署"
else
    COMPOSE_FILE="docker-compose.yml"
    ENV_FILE=".env"
    print_step "Resume Optimizer - 开发环境部署"
fi

# 检查环境文件
if [ ! -f "$ENV_FILE" ]; then
    print_error "环境配置文件不存在: $ENV_FILE"
    if [ "$ENV" = "prod" ]; then
        print_info "请复制 .env.production.example 到 .env.production 并配置"
    else
        print_info "请复制 .env.example 到 .env 并配置"
    fi
    exit 1
fi

# 加载环境变量
set -a
source "$ENV_FILE"
set +a

print_step "步骤 1: 环境检查"

# 检查必需的环境变量（生产环境）
if [ "$ENV" = "prod" ]; then
    REQUIRED_VARS=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "DOMAIN"
    )

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "必需的环境变量未设置: ${var}"
            exit 1
        fi
    done
    print_info "✓ 环境变量验证通过"
fi

# 检查 Docker
if ! docker info > /dev/null 2>&1; then
    print_error "Docker 未运行!"
    exit 1
fi
print_info "✓ Docker 运行正常"

# 检查 docker-compose
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose 未安装!"
    exit 1
fi
print_info "✓ docker-compose 可用"

# 数据库备份
if [ "$BACKUP" = true ]; then
    print_step "步骤 2: 数据库备份"
    if docker-compose -f $COMPOSE_FILE ps | grep -q "postgres.*Up"; then
        print_info "正在备份数据库..."
        ./deployment/scripts/backup-database.sh
        print_info "✓ 数据库备份完成"
    else
        print_warn "数据库服务未运行，跳过备份"
    fi
fi

# 构建镜像
if [ "$SKIP_BUILD" = false ]; then
    print_step "步骤 3: 构建 Docker 镜像"
    if [ "$ENV" = "prod" ]; then
        docker-compose -f $COMPOSE_FILE build --no-cache
    else
        docker-compose -f $COMPOSE_FILE build
    fi
    print_info "✓ Docker 镜像构建完成"
else
    print_step "步骤 3: 跳过镜像构建"
fi

# 启动数据库服务
print_step "步骤 4: 启动数据库服务"
docker-compose -f $COMPOSE_FILE up -d postgres redis

print_info "等待数据库就绪..."
sleep 10
print_info "✓ 数据库服务已启动"

# 数据库迁移
if [ "$SKIP_MIGRATION" = false ]; then
    print_step "步骤 5: 数据库迁移"
    docker-compose -f $COMPOSE_FILE run --rm backend npx prisma migrate deploy
    print_info "✓ 数据库迁移完成"
    
    # 仅在开发环境或首次部署时执行种子数据
    if [ "$ENV" = "dev" ]; then
        print_info "执行数据库种子..."
        docker-compose -f $COMPOSE_FILE run --rm backend npx prisma db seed || true
        print_info "✓ 数据库种子完成"
    fi
else
    print_step "步骤 5: 跳过数据库迁移"
fi

# 启动应用服务
print_step "步骤 6: 启动应用服务"
docker-compose -f $COMPOSE_FILE up -d backend frontend

print_info "等待服务就绪..."
sleep 15
print_info "✓ 应用服务已启动"

# 启动 Nginx（生产环境）
if [ "$ENV" = "prod" ]; then
    print_step "步骤 7: 启动 Nginx 负载均衡器"
    docker-compose -f $COMPOSE_FILE up -d nginx
    print_info "✓ Nginx 已启动"
    
    print_step "步骤 8: 启动备份服务"
    docker-compose -f $COMPOSE_FILE up -d postgres-backup
    print_info "✓ 备份服务已启动"
fi

# 健康检查
print_step "健康检查"

MAX_RETRIES=30
RETRY_COUNT=0
HEALTH_URL="http://localhost/health"

if [ "$ENV" = "dev" ]; then
    HEALTH_URL="http://localhost:3000/health"
fi

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f $HEALTH_URL > /dev/null 2>&1; then
        print_info "✓ 健康检查通过"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "等待服务健康... (${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "健康检查失败，已重试 ${MAX_RETRIES} 次"
    print_info "查看日志: docker-compose -f $COMPOSE_FILE logs"
    exit 1
fi

# 显示服务状态
print_step "服务状态"
docker-compose -f $COMPOSE_FILE ps

# 部署完成
print_step "部署完成!"

if [ "$ENV" = "prod" ]; then
    cat << EOF

服务访问地址:
  HTTP:  http://localhost
  HTTPS: https://${DOMAIN} (需要先配置 SSL)

下一步操作:
  1. 配置 SSL: ./deployment/scripts/setup-ssl.sh
  2. 配置 DNS 指向此服务器
  3. 监控日志: docker-compose -f $COMPOSE_FILE logs -f

常用命令:
  查看日志:    docker-compose -f $COMPOSE_FILE logs -f [service]
  停止服务:    docker-compose -f $COMPOSE_FILE down
  重启服务:    docker-compose -f $COMPOSE_FILE restart [service]
  备份数据库:  ./deployment/scripts/backup-database.sh
  恢复数据库:  ./deployment/scripts/restore-database.sh <backup_file>

EOF
else
    cat << EOF

服务访问地址:
  前端:      http://localhost:5173
  后端:      http://localhost:3000
  API 文档:  http://localhost:3000/api/docs

常用命令:
  查看日志:    docker-compose logs -f [service]
  停止服务:    docker-compose down
  重启服务:    docker-compose restart [service]

EOF
fi
