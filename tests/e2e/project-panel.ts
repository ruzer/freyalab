import {expect,type Locator,type Page} from '@playwright/test'
import {t,type Language} from '../../src/shared/i18n'

const panel=(page:Page,locale:Language)=>page.getByRole('tabpanel',{name:t('project.tab',{},locale),exact:true})
export const projectTreeRow=(page:Page,name:string,locale:Language='es')=>panel(page,locale).getByRole('tree').getByRole('treeitem',{name,exact:true})

export async function openProjectMenu(page:Page,locale:Language='es'){
 await panel(page,locale).getByRole('button',{name:t('project.actions',{},locale),exact:true}).press('Enter')
 const menu=panel(page,locale).getByRole('menu');await expect(menu).toBeVisible();return menu
}

export async function openProjectRowMenu(row:Locator,locale:Language='es'){
 await row.press('Shift+F10')
 const menu=panel(row.page(),locale).getByRole('menu');await expect(menu).toBeVisible();return menu
}

export async function chooseProjectAction(menu:Locator,key:string,locale:Language='es'){
 await menu.getByRole('menuitem',{name:t(key,{},locale),exact:true}).press('Enter')
}
