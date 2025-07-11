#!/bin/bash

# Deployment Test Script for Wordle tRPC
# Tests all endpoints and services to verify deployment is working correctly

set -e

# Configuration
LOCAL_URL="http://localhost:53880"
CLOUDFLARE_URL="https://trustlabwordle.alvarohr.es"
BACKEND_PORT=3000
FRONTEND_PORT=80

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════╗"
    echo "║       Wordle tRPC Deployment Test     ║"
    echo "║           🧪 Testing Suite           ║"
    echo "╚═══════════════════════════════════════╝"
    echo -e "${NC}"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Test if a URL is reachable
test_url() {
    local url="$1"
    local description="$2"
    local expected_code="${3:-200}"

    print_test "Testing $description: $url"

    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null); then
        if [ "$response" = "$expected_code" ]; then
            print_pass "$description responded with $response"
            return 0
        else
            print_fail "$description responded with $response (expected $expected_code)"
            return 1
        fi
    else
        print_fail "$description is not reachable"
        return 1
    fi
}

# Test if a URL returns JSON
test_json_endpoint() {
    local url="$1"
    local description="$2"

    print_test "Testing JSON endpoint $description: $url"

    if response=$(curl -s --max-time 10 "$url" 2>/dev/null); then
        if echo "$response" | jq . >/dev/null 2>&1; then
            print_pass "$description returned valid JSON"
            return 0
        else
            print_fail "$description did not return valid JSON"
            echo "Response: $response"
            return 1
        fi
    else
        print_fail "$description is not reachable"
        return 1
    fi
}

# Test Docker services
test_docker_services() {
    print_test "Checking Docker services status"

    if docker compose -f docker-compose.simple.yml ps | grep -q "Up"; then
        print_pass "Docker services are running"

        # List running services
        print_info "Running services:"
        docker compose -f docker-compose.simple.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

        return 0
    else
        print_fail "Docker services are not running properly"
        docker compose -f docker-compose.simple.yml ps
        return 1
    fi
}

# Test individual Docker containers
test_individual_containers() {
    local services=("nginx" "server" "web")

    for service in "${services[@]}"; do
        print_test "Testing $service container"

        if docker compose -f docker-compose.simple.yml ps "$service" | grep -q "Up"; then
            print_pass "$service container is running"
        else
            print_fail "$service container is not running"
        fi
    done
}

# Test tRPC endpoints
test_trpc_endpoints() {
    print_test "Testing tRPC endpoints"

    # Test batch endpoint (common tRPC pattern)
    local trpc_url="$LOCAL_URL/trpc/word.getTodaysWord?batch=1&input={}"

    if response=$(curl -s --max-time 10 "$trpc_url" 2>/dev/null); then
        if echo "$response" | jq . >/dev/null 2>&1; then
            print_pass "tRPC batch endpoint is working"
        else
            print_fail "tRPC batch endpoint returned invalid JSON"
            echo "Response: $response"
        fi
    else
        print_fail "tRPC batch endpoint is not reachable"
    fi
}

# Test CORS configuration
test_cors() {
    print_test "Testing CORS configuration"

    if response=$(curl -s -H "Origin: https://trustlabwordle.alvarohr.es" \
                     -H "Access-Control-Request-Method: POST" \
                     -H "Access-Control-Request-Headers: Content-Type" \
                     -X OPTIONS \
                     "$LOCAL_URL/trpc/word.getTodaysWord" 2>/dev/null); then
        print_pass "CORS preflight request successful"
    else
        print_fail "CORS preflight request failed"
    fi
}

# Test main application endpoints
test_main_endpoints() {
    print_test "Testing main application endpoints"

    # Test main page
    test_url "$LOCAL_URL" "Main page"

    # Test nginx health check
    test_url "$LOCAL_URL/nginx-health" "Nginx health check"

    # Test backend health check
    test_json_endpoint "$LOCAL_URL/health" "Backend health check"

    # Test API health check (alternative route)
    test_json_endpoint "$LOCAL_URL/api/health" "API health check"
}

# Test Cloudflare tunnel (if accessible)
test_cloudflare_tunnel() {
    print_test "Testing Cloudflare tunnel"

    if test_url "$CLOUDFLARE_URL" "Cloudflare tunnel" 200; then
        print_pass "Cloudflare tunnel is accessible"

        # Test tRPC through Cloudflare
        local cf_trpc_url="$CLOUDFLARE_URL/trpc/word.getTodaysWord?batch=1&input={}"
        if response=$(curl -s --max-time 15 "$cf_trpc_url" 2>/dev/null); then
            if echo "$response" | jq . >/dev/null 2>&1; then
                print_pass "tRPC through Cloudflare tunnel is working"
            else
                print_fail "tRPC through Cloudflare tunnel returned invalid JSON"
            fi
        else
            print_fail "tRPC through Cloudflare tunnel is not reachable"
        fi
    else
        print_fail "Cloudflare tunnel is not accessible"
        print_info "Make sure cloudflared tunnel is running"
    fi
}

# Test ports
test_ports() {
    print_test "Testing port accessibility"

    if netstat -tuln | grep -q ":53880"; then
        print_pass "Port 53880 is open and listening"
    else
        print_fail "Port 53880 is not accessible"
    fi
}

# Show logs for debugging
show_recent_logs() {
    print_info "Recent logs (last 20 lines):"
    echo "----------------------------------------"
    docker compose -f docker-compose.simple.yml logs --tail=20
    echo "----------------------------------------"
}

# Main test execution
main() {
    print_banner

    print_info "Starting deployment tests..."
    echo ""

    # Prerequisites check
    if ! command -v curl &> /dev/null; then
        print_fail "curl is not installed - required for tests"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_fail "jq is not installed - required for JSON tests"
        exit 1
    fi

    # Run tests
    test_docker_services
    echo ""

    test_individual_containers
    echo ""

    test_ports
    echo ""

    test_main_endpoints
    echo ""

    test_trpc_endpoints
    echo ""

    test_cors
    echo ""

    test_cloudflare_tunnel
    echo ""

    # Show summary
    echo "════════════════════════════════════════"
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo "════════════════════════════════════════"

    if [ $TESTS_FAILED -eq 0 ]; then
        print_pass "All tests passed! 🎉"
        print_info "Your Wordle tRPC deployment is working correctly"
        echo ""
        print_info "Access URLs:"
        echo "  • Local: $LOCAL_URL"
        echo "  • Cloudflare: $CLOUDFLARE_URL"
        exit 0
    else
        print_fail "Some tests failed. Check the output above."
        print_info "Run './start.sh logs' to see detailed logs"
        echo ""

        if [ "$1" = "--show-logs" ]; then
            show_recent_logs
        fi

        exit 1
    fi
}

# Help message
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Wordle tRPC Deployment Test Suite"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --show-logs    Show recent logs if tests fail"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "This script tests:"
    echo "  • Docker services status"
    echo "  • Port accessibility"
    echo "  • Main application endpoints"
    echo "  • tRPC API endpoints"
    echo "  • CORS configuration"
    echo "  • Cloudflare tunnel (if accessible)"
    echo ""
    exit 0
fi

# Run main function
main "$@"
