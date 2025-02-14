import { ContentScriptRegistry, TooltipScriptMain } from './types'

import { bodyLoader } from 'src/util/loader'
import { runOnScriptShutdown } from 'src/in-page-ui/tooltip/utils'
import {
    removeTooltip,
    insertTooltip,
    showContentTooltip,
} from 'src/in-page-ui/tooltip/content_script/interactions'
import { conditionallyShowOnboardingNotifications } from 'src/in-page-ui/tooltip/onboarding-interactions'
import { insertTutorial } from 'src/in-page-ui/tooltip/content_script/tutorialInteractions'

export const main: TooltipScriptMain = async (options) => {
    runOnScriptShutdown(() => removeTooltip())
    await conditionallyShowOnboardingNotifications({
        toolbarNotifications: options.toolbarNotifications,
    })

    options.inPageUI.events.on('componentShouldSetUp', async (event) => {
        if (event.component === 'tooltip') {
            await bodyLoader()
            await insertTooltip(options)
            await insertTutorial()
        }
    })
    options.inPageUI.events.on('componentShouldDestroy', async (event) => {
        if (event.component === 'tooltip') {
            await removeTooltip()
        }
    })
    options.inPageUI.events.on('stateChanged', async (event) => {
        if (!('tooltip' in event.changes)) {
            return
        }
        if (event.newState.tooltip) {
            showContentTooltip(options)
        }
    })
}

const registry = window['contentScriptRegistry'] as ContentScriptRegistry
registry.registerTooltipScript(main)
