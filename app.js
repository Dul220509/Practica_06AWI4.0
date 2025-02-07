//se importan las libtrerias
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import mongoose from "mongoose";
//import mongoose,{mongo} from "mongoose";

//inicializo la aplicacción
const app= express();
const PORT=3000;
const sesiones = {};//guarda todas las sesiones

//MIDLEWARES
app.use(express.json());//midleware para manejar datos json
app.use(express.urlencoded({extended:true}));//Midleware para manejar datos codificados en URL
app.use(
    session({
        secret:'P4-DYSA#Bee-SesionesHTTP',
        resave:false,
        saveUninitialized:true,
        cookie:{ maxAge: 15 * 60 * 1000 }//tiempo de la expiracion de la sesion 15 minutos
    })
 );

const sessionId = uuidv4();// Genera un ID único para la sesión
const now = new Date();// Obtiene la fecha y hora actual
const xicoTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Restamos 6 horas

// Formatea la fecha actual para mayor legibilidad
const formattedDate= new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "UTC", // Puedes cambiar la zona horaria si es necesario
}).format(xicoTime);

//console.log("la hora es:",xicoTime.toString());

//funcion de utilidad que nos permite accerder a la informacion no se usa aun 
const getClientIpp = (request) =>{
    return(
        request.header["x-forwarded-for"] ||
        request.connection.remoteAddress ||
        request.socket.remoteAddress ||
        request.connection.socket?.remoteAddress
    );
};

 // Función para obtener la IP del cliente
 const getClientIp = (request) => request.ip.replace(/^.*:/, '');
 
 // Función para obtener la IP del servidor
 const getServerIP = () => {
     const interfaces = os.networkInterfaces();
     for (const iface of Object.values(interfaces).flat()) {
         if (iface.family === "IPv4" && !iface.internal) {
             return iface.address;
         }
     }
     return "IP no disponible";
 };

 // Función para obtener la dirección MAC del servidor
const getServerMacAddress = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const iface = networkInterfaces[interfaceName];
        for (const details of iface) {
            if (details.mac && details.mac !== "00:00:00:00:00:00") {
                return details.mac; // Devuelve la primera MAC válida
            }
        }
    }
    return "MAC no disponible";
};

// Función para eliminar sesiones inactivas
const limpiarSesionesInactivas = () => {
    const ahora = Date.now();
    for (const sessionId in sesiones) {
        const { lastAccessed } = sesiones[sessionId];
        if (ahora - lastAccessed > 5 * 60 * 1000) { // Si han pasado 5 min sin actividad
            delete sesiones[sessionId];
        }
    }
};
setInterval(limpiarSesionesInactivas, 60 * 1000); // Revisa cada minuto

//crear endpoint para dar la bienvenida
app.get('/',(request,response)=>{
    return response.status(200).json({
        message: "Bienvenido al API de Controles de Sesiones",
        author: "Dulce Yadira Salvador Antonio"
    })
});

//Endpoint para iniciar sesion
app.post("/login", (request, response) => {
    const { email, nickname, macClient } = request.body;// Extrae las variables necesarias del cuerpo de la solicitud
    if (!email || !nickname || !macClient) {// Verifica que los campos requeridos estén presentes
        return response.status(400).json({ 
            message: "Missing required fields" });
    }

    const sessionId = uuidv4(); // Generar un nuevo ID de sesión
    const timestamp = Date.now();
    // Guarda la información de la sesión en el objeto "sesion"
    sesiones[sessionId] = {
        sessionId, // ID único de la sesión
        email, // Correo electrónico del usuario
        nickname, // Apodo del usuario
        macClient, // Dirección MAC del usuario
        ipClient: getClientIp(request), // IP del cliente
        ipServer: getServerIP(), // IP del servidor
        macServer: getServerMacAddress(), // MAC del servidor // IP del cliente que realiza la solicitud
        dateCreated: timestamp.toString(), // Guardamos el timestamp
        lastAccessed: timestamp.toString(), // Fecha del último acceso formateada
    };

    // Responde con un mensaje de éxito y el ID de la sesión
    response.status(200).json({
        message: "Se ha logueado de manera exitosa",
        sessionId,
    });
    
    //status
    app.get("/status", (request, response) => {
        const  sessionId  = request.query.sessionId;
        if (!sessionId || !sesiones[sessionId]) {
            return response.status(404).json({ message: "No hay sesión activa" });
        }
    
        const sesion = sesiones[sessionId];
        const ahora = moment();
        const dateCreated = moment(sesion.dateCreated);
        const lastAccessed = moment(sesion.lastAccessed);
    
        const tiempoActivo = moment.duration(ahora.diff(dateCreated)).humanize();
        const tiempoInactividad = moment.duration(ahora.diff(lastAccessed)).humanize();
    
        response.status(200).json({
            message: "Sesión activa",
            session: {
                ...sesiones,
                tiempoActivo,
                tiempoInactividad,
            }
        });
    });
    
    //logout endpoint
    app.post("/logout",(request,response)=>{
        const {sessionId}=request.body;
        if(!sessionId || !sesiones[sessionId]){
            return response.status(404).json({message:"No se ha encontrado una sesion activa"});
        }
        delete sesiones[sessionId];
        request.session.destroy((err)=>{
            if(err){
                return response.status(500).send('Error al cerrar la sesion');
            }
        })
        response.status(200).json({message:"Logout successeful"})
    })

    //endpoint actualizar la sesion// Update
    app.put("/update", (request, response) => {
        const { sessionId, email, nickname } = request.body;
        if (!sessionId || !sesiones[sessionId]) {
            return response.status(404).json({ message: "No hay sesión activa" });
        }
        if (email) sesiones[sessionId].email = email;
        if (nickname) sesiones[sessionId].nickname = nickname;
        sesiones[sessionId].lastAccessed
        response.status(200).json({ 
            message: "Sesión actualizada", 
            session: sesiones[sessionId]
        });
    });
    
});

//const moment = require("moment");

app.get("/sessions", (request, response) => {
    // Verifica si hay sesiones activas
    if (Object.keys(sesiones).length === 0) {
        return response.status(404).json({ message: "No hay sesiones activas" });
    }

    const ahora = Date.now();

    // 🔹 Obtener todas las sesiones activas con formato correcto
    const sesionesFormateadas = Object.values(sesiones).map(sesion => ({
        ...sesion, // Copiamos los datos originales de la sesión
         ipClient: sesion.ipClient || request.ip.replace(/^.*:/, ''), // Corregimos la IP del cliente si no está almacenada
         tiempoActivo: moment.duration(ahora - moment(sesion.dateCreated, "dddd, D [de] MMMM [de] YYYY, HH:mm:ss")).humanize(),
         tiempoInactividad: moment.duration(ahora - moment(sesion.lastAccessed, "dddd, D [de] MMMM [de] YYYY, HH:mm:ss")).humanize()
    }));

    response.status(200).json({
        message: "Lista de sesiones activas",
        sessions: sesionesFormateadas
    });
});


// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
//aqui va la conexion de la base de datos a mongoDB

mongoose.connect('mongodb+srv://Dulce:dul230493@cluster0.ql2zu.mongodb.net/API-AWI140-230493?retryWrites=true&w=majority&appName=Cluster0')
.then((db)=>console.log('mongodb atlas conected'))
.catch((error)=>console.error(error));
//export default mongoose: