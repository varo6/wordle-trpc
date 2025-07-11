# 🚀 Deploy Guide - Wordle tRPC

Guía completa para hacer deploy de Wordle tRPC en tu minipc con Cloudflare Tunnel.

## 📋 Prerequisitos

- Docker con soporte para compose instalado
- Puerto 53880 disponible en tu minipc
- Cloudflare Tunnel configurado hacia `trustlabwordle.alvarohr.es`
- Git (para clonar el proyecto)

## 🎯 Configuración Inicial

### 1. Clonar el proyecto
```bash
git clone <tu-repo-url>
cd wordle-trpc
```

### 2. Verificar configuración
El proyecto ya viene configurado para tu setup:
- Puerto: `53880`
- Dominio: `trustlabwordle.alvarohr.es`
- CORS configurado para Cloudflare Tunnel

### 3. Configurar variables de entorno (opcional)
Si necesitas cambiar algo, edita `.env.production`:
```bash
nano .env.production
```

## 🚀 Comandos de Deploy

### Inicio rápido
```bash
./start.sh
```

### Comandos disponibles
```bash
# Construir e iniciar (recomendado)
./start.sh start

# Solo construir imágenes
./start.sh build

# Detener servicios
./start.sh stop

# Reiniciar servicios
./start.sh restart

# Ver logs en tiempo real
./start.sh logs

# Ver estado de servicios
./start.sh status

# Mostrar ayuda
./start.sh help
```

## 🌐 URLs de Acceso

Una vez iniciado el servicio:

- **Local**: http://localhost:53880
- **Cloudflare**: https://trustlabwordle.alvarohr.es

## 🔧 Cloudflare Tunnel Setup

### 1. Instalar cloudflared
```bash
# En tu minipc
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### 2. Configurar tunnel
```bash
# Autenticarse
cloudflared tunnel login

# Crear tunnel
cloudflared tunnel create wordle-tunnel

# Configurar DNS
cloudflared tunnel route dns wordle-tunnel trustlabwordle.alvarohr.es
```

### 3. Archivo de configuración
Crea `~/.cloudflared/config.yml`:
```yaml
tunnel: wordle-tunnel
credentials-file: /home/tu-usuario/.cloudflared/wordle-tunnel.json

ingress:
  - hostname: trustlabwordle.alvarohr.es
    service: http://localhost:53880
  - service: http_status:404
```

### 4. Iniciar tunnel
```bash
# Como servicio
cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# O manualmente
cloudflared tunnel run wordle-tunnel
```

## 🔍 Monitoreo

### Ver logs de la aplicación
```bash
./start.sh logs
```

### Ver estado del contenedor
```bash
./start.sh status
```

### Verificar salud del servicio
```bash
curl http://localhost:53880/health
```

## 🔧 Troubleshooting

### Problema: Puerto 53880 ocupado
```bash
# Verificar qué usa el puerto
sudo lsof -i :53880
sudo netstat -tulpn | grep 53880

# Detener proceso si es necesario
sudo kill -9 <PID>
```

### Problema: Docker no funciona
```bash
# Verificar estado de Docker
sudo systemctl status docker

# Reiniciar Docker
sudo systemctl restart docker

# Verificar permisos
sudo usermod -aG docker $USER
# (requiere logout/login)

# Verificar soporte para compose
docker compose version
```

### Problema: CORS errors
- Verifica que el dominio esté correctamente configurado en `.env.production`
- Asegúrate de que Cloudflare Tunnel esté funcionando
- Revisa los logs: `./start.sh logs`

### Problema: Base de datos
```bash
# Verificar archivos de base de datos
ls -la apps/server/local.db
ls -la data/

# Reiniciar aplicación
./start.sh restart
```

## 🔄 Actualizaciones

### Actualizar código
```bash
git pull origin main
./start.sh restart
```

### Reconstruir completamente
```bash
./start.sh stop
docker system prune -a
./start.sh build
./start.sh start
```

## 📊 Mantenimiento

### Limpieza de Docker
```bash
# Limpiar imágenes no utilizadas
docker image prune

# Limpiar todo (cuidado!)
docker system prune -a

# Ver uso de espacio
docker system df
```

### Backup de datos
```bash
# Backup manual
cp apps/server/local.db backup/local.db.$(date +%Y%m%d_%H%M%S)

# Backup automático (crontab)
# 0 2 * * * cd /path/to/wordle-trpc && cp apps/server/local.db backup/local.db.$(date +\%Y\%m\%d_\%H\%M\%S)
```

### Logs del sistema
```bash
# Ver logs de cloudflared
journalctl -u cloudflared -f

# Ver logs de Docker
docker logs <container_name>

# Ver logs del sistema
tail -f /var/log/syslog
```

## 🚦 Estados de Servicio

### ✅ Todo funcionando
- `./start.sh status` muestra servicios "Up"
- `curl http://localhost:53880/health` devuelve 200
- La web responde en ambas URLs

### ⚠️ Problemas parciales
- Servicio levantado pero no responde
- CORS errors
- Problemas de conectividad

### ❌ Servicio caído
- Contenedor no inicia
- Puerto no disponible
- Errores de construcción

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `./start.sh logs`
2. Verifica el estado: `./start.sh status`
3. Prueba reiniciar: `./start.sh restart`
4. Verifica Cloudflare Tunnel: `cloudflared tunnel list`

## 🔐 Seguridad

- Cambia `SESSION_SECRET` en `.env.production`
- Considera usar un proxy reverso adicional
- Mantén Docker actualizado
- Monitorea los logs regularmente

---

¡Listo para usar! 🎉

El deploy debería ser tan simple como ejecutar `./start.sh` y esperar a que esté todo listo.

**Nota:** Este setup utiliza `docker compose` (la nueva sintaxis) en lugar de `docker-compose`. Si tu sistema solo tiene la versión antigua, puedes instalar la nueva versión siguiendo las instrucciones oficiales de Docker.