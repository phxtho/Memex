import { HighlightInteractionsInterface } from 'src/highlighting/types'
import AnnotationsManager from 'src/annotations/annotations-manager'
import { BookmarksInterface } from 'src/bookmarks/background/types'
import { RemoteCollectionsInterface } from 'src/custom-lists/background/types'
import { RemoteTagsInterface } from 'src/tags/background/types'
import { AnnotationInterface } from 'src/annotations/background/types'
import { AnnotationsCacheInterface } from 'src/annotations/annotations-cache'
import { ContentSharingInterface } from 'src/content-sharing/background/types'
import { MaybePromise } from 'src/util/types'

interface FlagSetterInterface {
    getState(): Promise<boolean>
    setState(value: boolean): Promise<void>
}

export interface RibbonContainerDependencies {
    currentTab: { id?: number; url?: string }
    getPageUrl: () => MaybePromise<string>
    getRemoteFunction: (name: string) => (...args: any[]) => Promise<any>
    highlighter: HighlightInteractionsInterface
    annotationsManager: AnnotationsManager
    setSidebarEnabled: (value: boolean) => Promise<void>
    getSidebarEnabled: () => Promise<boolean>
    bookmarks: BookmarksInterface
    customLists: RemoteCollectionsInterface
    tags: RemoteTagsInterface
    contentSharing: ContentSharingInterface
    annotations: AnnotationInterface<'caller'>
    annotationsCache: AnnotationsCacheInterface
    tooltip: FlagSetterInterface
    highlights: FlagSetterInterface
}
