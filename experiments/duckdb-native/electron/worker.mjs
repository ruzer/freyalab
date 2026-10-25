// Proceso auxiliar de Electron (utilityProcess): el mismo núcleo que el hijo de Node, con process.parentPort.
import {attach} from '../lib/worker-core.mjs'
attach(process.parentPort)
