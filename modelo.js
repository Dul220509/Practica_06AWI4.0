//aqui va el modelo de los datos de sesiones
import {model,Schema} from "mongoose";
// Definir el esquema de la sesión
const sesionesSchema = new Schema({
    sessionId:{
        require:true,
        unique:true,
        type:String
    },
    email: String,
    nickname: String,
    ipClient: String,
    ipServer: String,
    macServer: String,
    macClient: String,
    dateCreated: String,
    lastAccessed: String,
},{
    versionKey:false,
    timestamps:true
});
export default model ('sesiones',sesionesSchema);