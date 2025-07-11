# 🔧 Deployment Fixes - Wordle tRPC

## 📋 Issues Identified

### 1. **Frontend API URLs showing as `/undefined/trpc/`**
**Problem**: The frontend was trying to access `/undefined/trpc/` instead of `/trpc/`
**Root Cause**: `VITE_SERVER_URL` environment variable was not properly defined during build time
**Impact**: All tRPC API calls were failing with 404 errors

### 2. **Health Check Endpoint Mismatch**
**Problem**: Health checks were failing because nginx was looking for `/health` but only `/api/health` was configured
**Root Cause**: Inconsistent endpoint mapping in nginx configuration
**Impact**: Container health checks were failing

### 3. **CORS Configuration Issues**
**Problem**: Environment variable `CORS_ORIGIN` vs `cors_origin` inconsistency
**Root Cause**: Backend was looking for lowercase `cors_origin` but docker-compose had `CORS_ORIGIN`
**Impact**: CORS errors when accessing from Cloudflare domain

### 4. **405 Method Not Allowed Errors**
**Problem**: POST requests to `/undefined/trpc/word.tryWord` were returning 405 errors
**Root Cause**: Combination of undefined URLs and incorrect routing
**Impact**: Users couldn't submit word guesses

## ✅ Solutions Implemented

### 1. **Fixed Frontend URL Configuration**
```diff
# apps/web/src/utils/trpc.ts
- url: `${import.meta.env.VITE_SERVER_URL}/trpc`,
+ url: `/trpc`,

# apps/web/src/lib/auth-client.ts  
- baseURL: import.meta.env.VITE_SERVER_URL,
+ baseURL: "",
```

**Why this works**: Uses relative URLs that work with the nginx proxy configuration

### 2. **Added Health Check Endpoint**
```diff
# nginx.conf
+ # Health check endpoint - proxy to backend
+ location /health {
+     proxy_pass http://backend/health;
+     # ... proxy headers
+ }
```

**Why this works**: Provides both `/health` and `/api/health` endpoints for flexibility

### 3. **Fixed CORS Environment Variable**
```diff
# docker-compose.simple.yml
- CORS_ORIGIN=https://trustlabwordle.alvarohr.es,...
+ cors_origin=https://trustlabwordle.alvarohr.es,...
```

**Why this works**: Matches the variable name the backend code expects

### 4. **Simplified Docker Configuration**
```diff
# docker-compose.simple.yml
- environment:
-   - VITE_SERVER_URL=""
+ environment:
+   - NODE_ENV=production
```

**Why this works**: Removes unnecessary environment variables that were causing issues

### 5. **Updated Dockerfile.web**
```diff
# Dockerfile.web
- # Variables de entorno para build
- ARG VITE_SERVER_URL=""
- ENV VITE_SERVER_URL=$VITE_SERVER_URL
+ # (removed unnecessary environment variable handling)
```

**Why this works**: Simplifies the build process and avoids environment variable conflicts

## 🧪 Testing

Created comprehensive test script: `test-deployment.sh`

**Features**:
- Tests Docker services status
- Verifies port accessibility  
- Tests main application endpoints
- Tests tRPC API endpoints
- Tests CORS configuration
- Tests Cloudflare tunnel connectivity

**Usage**:
```bash
./test-deployment.sh                # Run all tests
./test-deployment.sh --show-logs    # Show logs if tests fail
./test-deployment.sh --help         # Show help
```

## 🚀 Deployment Flow

### Before Fixes:
1. ❌ Frontend tries to call `/undefined/trpc/` → 404
2. ❌ Health checks fail → Container restart loops
3. ❌ CORS errors → API calls blocked
4. ❌ 405 Method Not Allowed → POST requests fail

### After Fixes:
1. ✅ Frontend calls `/trpc/` → nginx proxies to backend
2. ✅ Health checks pass → Containers stable
3. ✅ CORS properly configured → API calls work
4. ✅ All HTTP methods work → Full functionality

## 📊 Key Changes Summary

| Component | Issue | Fix |
|-----------|--------|-----|
| **Frontend** | Undefined API URLs | Use relative URLs |
| **Nginx** | Missing health endpoint | Add `/health` location |
| **Backend** | CORS env var mismatch | Fix variable name |
| **Docker** | Unnecessary env vars | Simplify configuration |
| **Testing** | No verification | Add comprehensive tests |

## 🔍 Verification Steps

1. **Check Services**:
   ```bash
   ./start.sh status
   ```

2. **Run Tests**:
   ```bash
   ./test-deployment.sh
   ```

3. **Manual Verification**:
   - Local: http://localhost:53880
   - Cloudflare: https://trustlabwordle.alvarohr.es
   - API: http://localhost:53880/trpc/word.getTodaysWord?batch=1&input={}

## 🎯 Expected Results

- **Frontend**: Loads correctly, no undefined URLs
- **API**: tRPC calls work, proper JSON responses
- **Health Checks**: All containers show as healthy
- **CORS**: Cross-origin requests work from Cloudflare domain
- **Cloudflare Tunnel**: External access works without errors

## 📝 Notes

- All changes maintain backward compatibility
- No breaking changes to existing functionality
- Simplified configuration reduces complexity
- Added comprehensive testing for future deployments
- Ready for production use with Cloudflare Tunnel

## 🚨 Important

Make sure to:
1. Run `./start.sh restart` after applying fixes
2. Verify Cloudflare tunnel is running: `cloudflared tunnel run wordle-tunnel`
3. Check that port 53880 is accessible through firewall
4. Run tests to verify everything works: `./test-deployment.sh`
