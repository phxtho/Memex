import React from 'react'

import ShareAnnotationMenu from './components/ShareAnnotationMenu'
import { executeReactStateUITask } from 'src/util/ui-logic'
import { getListShareUrl } from 'src/content-sharing/utils'
import type { ShareMenuCommonProps, ShareMenuCommonState } from './types'
import { runInBackground } from 'src/util/webextensionRPC'
import { getKeyName } from '@worldbrain/memex-common/lib/utils/os-specific-key-names'
import type { RemoteCollectionsInterface } from 'src/custom-lists/background/types'
import { SPECIAL_LIST_IDS } from '@worldbrain/memex-common/lib/storage/modules/lists/constants'

interface State extends ShareMenuCommonState {
    showLink: boolean
}

export interface Props extends ShareMenuCommonProps {
    openListShareModal: () => void
    customListsBG?: RemoteCollectionsInterface
    shareImmediately: boolean
    listId: number
}

export default class ListShareMenu extends React.Component<Props, State> {
    static MOD_KEY = getKeyName({ key: 'mod' })
    static ALT_KEY = getKeyName({ key: 'alt' })
    static defaultProps: Pick<
        Props,
        'contentSharingBG' | 'annotationsBG' | 'customListsBG'
    > = {
        contentSharingBG: runInBackground(),
        annotationsBG: runInBackground(),
        customListsBG: runInBackground(),
    }

    private annotationUrls: string[]

    state: State = {
        link: '',
        showLink: false,
        loadState: 'pristine',
        shareState: 'pristine',
    }

    private get isListSharable(): boolean {
        return !Object.values(SPECIAL_LIST_IDS).includes(this.props.listId)
    }

    async componentDidMount() {
        await executeReactStateUITask<State, 'loadState'>(
            this,
            'loadState',
            async () => {
                await this.setListUrlsForSharing()
                const linkExists = await this.setRemoteLinkIfExists()
                if (!linkExists && this.props.shareImmediately) {
                    this.shareList()
                }
            },
        )
    }

    private handlePlusBtnClick: React.MouseEventHandler = (e) => {
        this.props.openListShareModal()
    }

    private shareList = async () => {
        const { contentSharingBG, listId } = this.props

        const { remoteListId } = await contentSharingBG.shareList({ listId })

        this.setState({
            link: getListShareUrl({ remoteListId }),
            showLink: true,
        })
    }

    private setListUrlsForSharing = async () => {
        const { annotationsBG, customListsBG, listId } = this.props

        const listEntries = await customListsBG.fetchListPagesById({
            id: listId,
        })

        const pageUrlsSet = new Set(listEntries.map((entry) => entry.pageUrl))
        const annotationUrlsSet = new Set<string>()

        for (const pageUrl of pageUrlsSet) {
            const annotations = await annotationsBG.listAnnotationsByPageUrl({
                pageUrl,
            })
            annotations.forEach((a) => annotationUrlsSet.add(a.url))
        }

        this.annotationUrls = [...annotationUrlsSet]
    }

    private handleLinkCopy = () => this.props.copyLink(this.state.link)

    private setRemoteLinkIfExists = async (): Promise<boolean> => {
        const { listId, contentSharingBG } = this.props

        if (!this.isListSharable) {
            return false
        }

        const remoteListId = await contentSharingBG.getRemoteListId({
            localListId: listId,
        })

        if (!remoteListId) {
            return false
        }

        this.setState({
            link: getListShareUrl({ remoteListId }),
            showLink: true,
        })
        return true
    }

    private shareAllAnnotations = async () => {
        if (this.state.loadState !== 'success') {
            throw new Error('Share attempted before dependencies have loaded')
        }

        let success = false
        try {
            // Share list if it hasn't been shared already
            if (!this.state.showLink && this.isListSharable) {
                await this.shareList()
                await this.setRemoteLinkIfExists()
            }

            await this.props.contentSharingBG.shareAnnotations({
                annotationUrls: this.annotationUrls,
                shareToLists: true,
            })
            success = true
        } catch (err) {}

        this.props.postShareHook?.({
            isShared: true,
        })
    }

    private unshareAllAnnotations = async () => {
        let success = false
        try {
            await this.props.contentSharingBG.unshareAnnotations({
                annotationUrls: this.annotationUrls,
            })
            success = true
        } catch (err) {}

        this.props.postShareHook?.({
            isShared: false,
        })
    }

    private handleSetShared = async () => {
        await executeReactStateUITask<State, 'shareState'>(
            this,
            'shareState',
            async () => {
                await this.shareAllAnnotations()
            },
        )
    }

    private handleSetPrivate = async () => {
        await executeReactStateUITask<State, 'shareState'>(
            this,
            'shareState',
            async () => {
                await this.unshareAllAnnotations()
            },
        )
    }

    render() {
        return (
            <ShareAnnotationMenu
                link={this.state.link}
                showLink={this.state.showLink}
                onCopyLinkClick={this.handleLinkCopy}
                onPlusBtnClick={this.handlePlusBtnClick}
                onClickOutside={this.props.closeShareMenu}
                linkTitleCopy="Link to collection and shared notes"
                privacyOptionsTitleCopy="Set privacy for all notes in this collection"
                isLoading={
                    this.state.shareState === 'running' ||
                    this.state.loadState === 'running'
                }
                privacyOptions={[
                    {
                        title: 'Shared',
                        shortcut: `shift+${ListShareMenu.MOD_KEY}+enter`,
                        description: 'Shared in collections this page is in',
                        icon: 'shared',
                        onClick: this.handleSetShared,
                    },
                    {
                        title: 'Private',
                        shortcut: `${ListShareMenu.MOD_KEY}+enter`,
                        description: 'Only locally available to you',
                        icon: 'person',
                        onClick: this.handleSetPrivate,
                    },
                ]}
                shortcutHandlerDict={{
                    'mod+shift+enter': this.handleSetShared,
                    'mod+enter': this.handleSetPrivate,
                }}
            />
        )
    }
}
