#!/bin/bash

# Script de verificación del sistema Wordle tRPC
# Verifica que todos los componentes estén funcionando correctamente

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
LOCAL_URL="http://localhost:53880"
CLOUDFLARE_URL="https://trustlabwordle.alvarohr.es"
HEALTH_ENDPOINT="/health"
COMPOSE_FILE="docker-compose.simple.yml"

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════╗"
    echo "║         Wordle tRPC Health Check         ║"
    echo "║            Sistema de Verificación       ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}  ✅ $1${NC}"
    ((TESTS_PASSED++))
}

print_failure() {
    echo -e "${RED}  ❌ $1${NC}"
    ((TESTS_FAILED++))
}

print_warning() {
    echo -e "${YELLOW}  ⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}  ℹ️  $1${NC}"
}

# Test 1: Verificar Docker
test_docker() {
    print_test "Verificando Docker..."

    if command -v docker &> /dev/null; then
        print_success "Docker está instalado"
    else
        print_failure "Docker no está instalado"
        return 1
    fi

    if docker info &> /dev/null; then
        print_success "Docker daemon está corriendo"
    else
        print_failure "Docker daemon no está corriendo"
        return 1
    fi

    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose está instalado"
    else
        print_failure "Docker Compose no está instalado"
        return 1
    fi
}

# Test 2: Verificar servicios Docker
test_docker_services() {
    print_test "Verificando servicios Docker..."

    if [ -f "$COMPOSE_FILE" ]; then
        print_success "Archivo docker-compose encontrado"
    else
        print_failure "Archivo docker-compose no encontrado"
        return 1
    fi

    # Verificar si los servicios están corriendo
    if docker-compose -f $COMPOSE_FILE ps 2>/dev/null | grep -q "Up"; then
        print_success "Servicios Docker están corriendo"

        # Mostrar estado detallado
        print_info "Estado de contenedores:"
        docker-compose -f $COMPOSE_FILE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    else
        print_failure "Servicios Docker no están corriendo"
        print_info "Usa './start.sh start' para iniciar los servicios"
        return 1
    fi
}

# Test 3: Verificar conectividad local
test_local_connectivity() {
    print_test "Verificando conectividad local..."

    # Verificar si el puerto está abierto
    if nc -z localhost 53880 2>/dev/null; then
        print_success "Puerto 53880 está abierto"
    else
        print_failure "Puerto 53880 no está disponible"
        return 1
    fi

    # Verificar respuesta HTTP
    if curl -s -f "$LOCAL_URL" &> /dev/null; then
        print_success "Servicio responde en localhost:53880"
    else
        print_failure "Servicio no responde en localhost:53880"
        return 1
    fi
}

# Test 4: Verificar health endpoint
test_health_endpoint() {
    print_test "Verificando endpoint de salud..."

    local health_url="${LOCAL_URL}${HEALTH_ENDPOINT}"

    if curl -s -f "$health_url" &> /dev/null; then
        print_success "Health endpoint responde correctamente"

        # Mostrar detalles del health check
        local health_response=$(curl -s "$health_url" 2>/dev/null)
        if [ ! -z "$health_response" ]; then
            print_info "Respuesta: $health_response"
        fi
    else
        print_failure "Health endpoint no responde"
        return 1
    fi
}

# Test 5: Verificar Cloudflare Tunnel
test_cloudflare_tunnel() {
    print_test "Verificando Cloudflare Tunnel..."

    # Verificar si cloudflared está instalado
    if command -v cloudflared &> /dev/null; then
        print_success "cloudflared está instalado"

        # Verificar versión
        local cf_version=$(cloudflared version 2>/dev/null | head -1)
        print_info "Versión: $cf_version"
    else
        print_warning "cloudflared no está instalado"
    fi

    # Verificar conectividad con el dominio
    if curl -s -f "$CLOUDFLARE_URL" --connect-timeout 10 &> /dev/null; then
        print_success "Dominio Cloudflare responde correctamente"
    else
        print_failure "Dominio Cloudflare no responde"
        print_info "Verifica que el tunnel esté corriendo"
        return 1
    fi
}

# Test 6: Verificar recursos del sistema
test_system_resources() {
    print_test "Verificando recursos del sistema..."

    # Verificar uso de memoria
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    print_info "Uso de memoria: ${memory_usage}%"

    # Verificar uso de disco
    local disk_usage=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
    print_info "Uso de disco: ${disk_usage}%"

    # Verificar carga del sistema
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    print_info "Carga promedio: $load_avg"

    # Verificar contenedores Docker
    local docker_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
    if [ ! -z "$docker_containers" ]; then
        print_success "Contenedores Docker activos encontrados"
    else
        print_warning "No se encontraron contenedores Docker activos"
    fi
}

# Test 7: Verificar logs recientes
test_recent_logs() {
    print_test "Verificando logs recientes..."

    if docker-compose -f $COMPOSE_FILE logs --tail=10 2>/dev/null | grep -i error; then
        print_warning "Se encontraron errores en logs recientes"
    else
        print_success "No se encontraron errores en logs recientes"
    fi
}

# Test 8: Verificar base de datos
test_database() {
    print_test "Verificando base de datos..."

    if [ -f "apps/server/local.db" ]; then
        print_success "Archivo de base de datos encontrado"

        local db_size=$(du -h apps/server/local.db | cut -f1)
        print_info "Tamaño de BD: $db_size"
    else
        print_warning "Archivo de base de datos no encontrado"
    fi

    # Verificar directorio de datos
    if [ -d "data" ]; then
        print_success "Directorio de datos encontrado"
    else
        print_warning "Directorio de datos no encontrado"
    fi
}

# Función principal
main() {
    print_banner

    echo "Iniciando verificación del sistema..."
    echo ""

    # Ejecutar todos los tests
    test_docker
    echo ""

    test_docker_services
    echo ""

    test_local_connectivity
    echo ""

    test_health_endpoint
    echo ""

    test_cloudflare_tunnel
    echo ""

    test_system_resources
    echo ""

    test_recent_logs
    echo ""

    test_database
    echo ""

    # Mostrar resumen
    echo "╔══════════════════════════════════════════╗"
    echo "║                 RESUMEN                  ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ¡Todos los tests pasaron exitosamente!${NC}"
        echo -e "${GREEN}✅ Tests exitosos: $TESTS_PASSED${NC}"
        echo ""
        echo "🌐 URLs de acceso:"
        echo "  • Local: $LOCAL_URL"
        echo "  • Cloudflare: $CLOUDFLARE_URL"
        echo ""
        echo "📊 Para monitorear en tiempo real:"
        echo "  ./start.sh logs"

        exit 0
    else
        echo -e "${RED}❌ Algunos tests fallaron${NC}"
        echo -e "${GREEN}✅ Tests exitosos: $TESTS_PASSED${NC}"
        echo -e "${RED}❌ Tests fallidos: $TESTS_FAILED${NC}"
        echo ""
        echo "🔧 Comandos útiles para resolver problemas:"
        echo "  ./start.sh restart    # Reiniciar servicios"
        echo "  ./start.sh logs       # Ver logs"
        echo "  ./start.sh status     # Ver estado"
        echo ""

        exit 1
    fi
}

# Ejecutar verificación
main "$@"
