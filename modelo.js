//aqui va el modelo de los datos de sesiones
import {model,Schema} from "mongoose";
// Definir el esquema de la sesión
const sesionesSchema = new Schema({
    sessionId:{
        require:true,
        unique:true,
        type:Number
    },
    email: String,
    nickname: String,
    ipClient: String,
    ipServer: String,
    macServer: String,
    serverMac: String,
    dateCreated: Date,
    lastAccessed: Date,
},{
    versionKey:false,
    timestamps:true
});
export default model ('sesiones',sesionesSchema);
