# Usar imagen oficial de Node.js
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el código de la aplicación
COPY . .

# Exponer el puerto
EXPOSE 3303

# Comando para iniciar la aplicación
CMD ["npm", "start"]
