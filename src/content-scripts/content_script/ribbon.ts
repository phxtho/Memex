import { browser } from 'webextension-polyfill-ts'
import { ContentScriptRegistry, RibbonScriptMain } from './types'
import { RibbonController } from 'src/in-page-ui/ribbon'
import { setupRibbonUI } from 'src/in-page-ui/ribbon/react'
import { createInPageUI } from 'src/in-page-ui/utils'

export const main: RibbonScriptMain = async options => {
    const cssFile = browser.extension.getURL(`/content_script_ribbon.css`)
    const ribbonController = new RibbonController()
    createInPageUI('ribbon', cssFile, async element => {
        setupRibbonUI(element, {
            containerDependencies: options,
            ribbonController,
            inPageUI: options.inPageUI,
        })
    })
    return { ribbonController }
}

const registry = window['contentScriptRegistry'] as ContentScriptRegistry
registry.registerRibbonScript(main)