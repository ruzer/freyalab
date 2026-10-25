// Proceso auxiliar como hijo de Node: adapta process.send/on('message') a la interfaz de lib/worker-core.mjs.
import {attach} from './lib/worker-core.mjs'
attach({on: (event, fn) => process.on(event, message => fn({data: message})), postMessage: message => process.send(message)})
