#!/bin/bash

# Script de inicio para Wordle tRPC con Cloudflare Tunnel
# Uso: ./start.sh [build|start|stop|restart|logs|status]

set -e

PROJECT_NAME="wordle-trpc"
COMPOSE_FILE="docker-compose.simple.yml"
DOCKERFILE="Dockerfile.simple"
PORT=53880
DOMAIN="trustlabwordle.alvarohr.es"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════╗"
    echo "║          Wordle tRPC Deploy           ║"
    echo "║      🎯 Minipc + Cloudflare Tunnel   ║"
    echo "╚═══════════════════════════════════════╝"
    echo -e "${NC}"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    print_info "Verificando dependencias..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose no está instalado"
        exit 1
    fi

    print_info "✅ Dependencias verificadas"
}

build_images() {
    print_info "Construyendo imágenes Docker..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    print_info "✅ Imágenes construidas"
}

start_services() {
    print_info "Iniciando servicios..."
    docker-compose -f $COMPOSE_FILE up -d

    print_info "⏳ Esperando que los servicios estén listos..."
    sleep 10

    if docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
        print_info "✅ Servicios iniciados correctamente"
        show_status
    else
        print_error "❌ Error al iniciar servicios"
        docker-compose -f $COMPOSE_FILE logs
        exit 1
    fi
}

stop_services() {
    print_info "Deteniendo servicios..."
    docker-compose -f $COMPOSE_FILE down
    print_info "✅ Servicios detenidos"
}

restart_services() {
    print_info "Reiniciando servicios..."
    stop_services
    start_services
}

show_logs() {
    print_info "Mostrando logs..."
    docker-compose -f $COMPOSE_FILE logs -f
}

show_status() {
    print_info "Estado de los servicios:"
    docker-compose -f $COMPOSE_FILE ps

    echo ""
    print_info "🌐 URLs de acceso:"
    echo "  • Local: http://localhost:$PORT"
    echo "  • Cloudflare: https://$DOMAIN"
    echo ""
    print_info "📊 Para ver logs en tiempo real:"
    echo "  ./start.sh logs"
    echo ""
    print_info "🔄 Para reiniciar:"
    echo "  ./start.sh restart"
}

show_help() {
    print_banner
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  build     - Construir imágenes Docker"
    echo "  start     - Iniciar servicios"
    echo "  stop      - Detener servicios"
    echo "  restart   - Reiniciar servicios"
    echo "  logs      - Mostrar logs en tiempo real"
    echo "  status    - Mostrar estado de servicios"
    echo "  help      - Mostrar esta ayuda"
    echo ""
    echo "Si no se especifica comando, se ejecutará 'start'"
}

main() {
    print_banner
    check_dependencies

    case "${1:-start}" in
        build)
            build_images
            ;;
        start)
            build_images
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Comando no reconocido: $1"
            show_help
            exit 1
            ;;
    esac
}

# Ejecutar función principal
main "$@"
