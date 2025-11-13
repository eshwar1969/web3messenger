# 🔐 XMTP V3 + MetaMask - Chat Descentralizado

Demo de mensajería descentralizada usando XMTP V3, Ethers v6 y **MetaMask**.

## ✨ Características

- 🦊 **Conexión con MetaMask** - Usa tu wallet real
- 🔐 **Encriptación E2E** - Protocolo MLS (más seguro que Signal)
- 📬 **Inbox-based identity** - Tu identidad es portable entre apps
- 💬 **DMs en tiempo real** - Mensajes instantáneos


## 📁 Estructura del Proyecto

```
xmtp-demo/
├── package.json          # Dependencias del proyecto
├── vite.config.js        # Configuración de Vite
├── index.html            # Interfaz HTML
├── style.css             # Estilos CSS
├── main.js               # Lógica JavaScript principal
└── README.md             # Este archivo
```

## 🚀 Instalación

```bash
# 1. Crear carpeta del proyecto
mkdir xmtp-demo
cd xmtp-demo

# 2. Copiar todos los archivos a esta carpeta
# - package.json
# - vite.config.js
# - index.html
# - style.css
# - main.js

# 3. Instalar dependencias
npm install

# 4. Ejecutar en modo desarrollo
npm run dev
```

## 🌐 Abrir en el navegador

Una vez ejecutado `npm run dev`, abre:
```
http://localhost:5173
```

## 🧪 Cómo Probar

### Opción 1: Dos Navegadores
1. Abre la app en Chrome normal
2. Abre la app en Chrome incógnito (o Brave)
3. Conecta la metamask
4. Copia la invox id de uno de ellos.
5. Pégala en el otro para crear DM
6. ¡Envía mensajes encriptados!

### Opción 2: Dos consolas
1. Ejecuta `npm run dev` en ambas
2. Conecta con metamask en cada localhost con diferente puerto y diferente tipo de navegador.
3. Comparte tu invox
4. Inicia conversación

## 📦 Dependencias

- **@xmtp/browser-sdk** `^4.0.0`: SDK oficial XMTP V3
- **ethers** `^6.13.0`: Biblioteca para interactuar con Ethereum
- **vite** `^5.4.0`: Bundler y servidor de desarrollo

## 🔑 Características

- ✅ Mensajería end-to-end encriptada (MLS Protocol)
- ✅ Identidad basada en Inbox (no solo direcciones)
- ✅ Soporte para DMs (Direct Messages)
- ✅ Base de datos local automática (SQLite en OPFS)
- ✅ Stream en tiempo real de mensajes
- ✅ Logs detallados de actividad

## 🌍 Redes XMTP

- **dev**: Red de desarrollo (para testing, mensajes pueden borrarse)
- **production**: Red de producción (mensajes persistentes, usar para apps reales)

Cambiar en `main.js` línea ~82:
```javascript
xmtpClient = await Client.create(xmtpSigner, {
    env: 'production' // Cambiar aquí de 'dev' a 'production'
});
```

## 📚 Recursos

- 📖 Documentación: https://docs.xmtp.org
- 🐙 GitHub: https://github.com/xmtp/xmtp-js
- 💬 Discord: https://discord.gg/xmtp
- 🎮 Demo App: https://xmtp.chat

## ⚠️ Importante

- **V2 deprecado**: XMTP V2 será deprecado el 23 de junio 2025
- **Red DEV**: Los mensajes en red dev pueden borrarse sin aviso
- **Conecta con el inbox id en dev**: Si buscas a tu contertulio con su EOA parece no funcionar en dev. Usa su inbox id. 


## 📝 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Compilar para producción
npm run preview  # Vista previa de build
```



---

