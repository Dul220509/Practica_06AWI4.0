// Importación de las librerías necesarias
import express from "express";
import session from "express-session";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import mongoose from "mongoose";
import crypto from "crypto";
import sesionesSchema from "./modelo.js";

// Inicialización de la aplicación Express
const app = express();
const PORT = 3000;

// Middleware para manejar JSON y datos en formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones con express-session
app.use(
  session({
    secret: "P4-DYSA#Bee-SesionesHTTP", // Clave secreta para firmar las cookies de sesión
    resave: false, // Evita guardar la sesión si no hubo cambios
    saveUninitialized: true, // Guarda sesiones vacías
    cookie: { maxAge: 5 * 60 * 1000 }, // Expiración de la sesión en 5 minutos
  })
);

// Obtiene la dirección IP del cliente
const getClientIp = (request) => request.ip.replace(/^.*:/, "");

// Obtiene la dirección IP del servidor
const getServerIP = () => {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces).flat()) {
    if (iface.family === "IPv4" && !iface.internal) return iface.address;
  }
  return "IP no disponible";
};

// Obtiene la dirección MAC del servidor
const getServerMacAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces).flat()) {
    if (iface.mac && iface.mac !== "00:00:00:00:00:00") return iface.mac;
  }
  return "MAC no disponible";
};

// Conexión a la base de datos MongoDB Atlas
mongoose.connect("mongodb+srv://Dulce:dul230493@cluster0.ql2zu.mongodb.net/API-AWI140-230493")
  .then(() => console.log("MongoDB Atlas conectado"))
  .catch((error) => console.error("Error conectando a MongoDB:", error));

// Genera un par de claves RSA (pública y privada) para encriptación
const generateRSAKeys = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return { 
    publicKey: publicKey.export({ type: "pkcs1", format: "pem" }), 
    privateKey: privateKey.export({ type: "pkcs1", format: "pem" }) 
  };
};
const { publicKey, privateKey } = generateRSAKeys();

// Función para encriptar datos con la clave pública
const encryptData = (data) => {
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(data)
  ).toString("base64");
};

// Función para desencriptar datos con la clave privada
const decryptData = (data) => {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(data, "base64")
  ).toString();
};

// Ruta de bienvenida
app.get("/", (request, response) => {
  response.status(200).json({
    message: "Bienvenido al API de Control de Sesiones",
    author: "Dulce Yadira Salvador Antonio",
  });
});

// Endpoint para iniciar sesión
app.post("/login", async (req, res) => {
  const { email, nickname, macClient } = req.body;
  if (!email || !nickname || !macClient) return res.status(400).json({ message: "Missing required fields" });

  const sessionId = uuidv4();
  const dateCreated = moment().format("DD-MM-YYYY HH:mm:ss");
  const lastAccessed = dateCreated;
  const status = "Activa";

  // Crea una nueva sesión y la guarda en la base de datos
  const sesion = new sesionesSchema({
    sessionId,
    email: encryptData(email), // Encripta el email
    nickname,
    macClient,
    ipClient: getClientIp(req),
    ipServer: getServerIP(),
    macServer: getServerMacAddress(),
    dateCreated,
    lastAccessed,
    status,
  });

  await sesion.save();
  res.status(200).json({ message: "Inicio de sesión exitoso", sessionId });
});

// Endpoint para obtener el estado de una sesión
app.get("/status", async (request, response) => {
  const { sessionId } = request.query;
  if (!sessionId) return response.status(400).json({ message: "Falta sessionId" });

  const sesion = await sesionesSchema.findOne({ sessionId });
  if (!sesion) return response.status(404).json({ message: "Sesión no encontrada" });

  const tiempoActivo = moment.duration(moment().diff(moment(sesion.dateCreated))).humanize();
  const tiempoInactividad = moment.duration(moment().diff(moment(sesion.lastAccessed))).humanize();

  response.status(200).json({
    message: "Sesión activa",
    session: { 
      ...sesion._doc,
      tiempoActivo, 
      tiempoInactividad 
    },
  });
});

// Endpoint para cerrar sesión
app.post("/logout", async (request, response) => {
  const { sessionId } = request.body;
  if (!sessionId) return response.status(400).json({ message: "Falta sessionId" });

  const sesion = await sesionesSchema.findOneAndDelete({ sessionId });
  if (!sesion) return response.status(404).json({ message: "Sesión no encontrada" });

  response.status(200).json({ message: "Sesión cerrada correctamente" });
});

// Endpoint para obtener todas las sesiones activas
app.get("/allCurrentSessions", async (req, res) => {
  const sesiones = await sesionesSchema.find({ status: "Activa" });
  if (!sesiones.length) return res.status(404).json({ message: "No hay sesiones activas" });

  res.status(200).json({ sessions: sesiones.map(sesion => ({ ...sesion._doc, email: decryptData(sesion.email) })) });
});

// Endpoint para eliminar todas las sesiones
app.delete("/deleteAllSessions", async (req, res) => {
  await sesionesSchema.deleteMany({});
  res.status(200).json({ message: "Todas las sesiones han sido eliminadas" });
});

// Inicia el servidor en el puerto especificado
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
