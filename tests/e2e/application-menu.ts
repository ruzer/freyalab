import {expect,type ElectronApplication} from '@playwright/test'

// CDP no genera una pulsación del sistema macOS. Esta ayuda prueba el elemento
// del menú, sin atribuir a click() una comprobación del acelerador físico.
export async function runApplicationMenu(app:ElectronApplication,id:string):Promise<void>{
 await expect.poll(()=>app.evaluate(({Menu},id)=>Menu.getApplicationMenu()?.getMenuItemById(id)?.enabled??false,id)).toBe(true)
 await app.evaluate(({Menu,BrowserWindow},id)=>{const item=Menu.getApplicationMenu()?.getMenuItemById(id);if(!item?.enabled)throw new Error(`Comando no disponible: ${id}`);item.click(item,BrowserWindow.getFocusedWindow()??undefined,{} as Electron.KeyboardEvent)},id)
}
