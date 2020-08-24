import React, { Component, MouseEventHandler } from 'react'
import cx from 'classnames'

import AnnotationBox from 'src/sidebar-overlay/annotation-box'
import { Annotation as AnnotationFlawed } from 'src/annotations/types'
import {
    AnnotationSharingInfo,
    AnnotationSharingAccess,
} from 'src/content-sharing/ui/types'
import { runInBackground } from 'src/util/webextensionRPC'
import { RemoteCollectionsInterface } from 'src/custom-lists/background/types'
import { ContentSharingInterface } from 'src/content-sharing/background/types'
import { HoverBoxDashboard as HoverBox } from 'src/common-ui/components/design-library/HoverBox'
import CopyPaster from 'src/overview/copy-paster'

const styles = require('./annotation-list.css')

// TODO (sidebar-refactor): somewhere this type regressed and `isBookmarked` got
//  changed to `hasBookmark`
type Annotation = Omit<AnnotationFlawed, 'isBookmarked'> & {
    hasBookmark: boolean
}

export interface Props {
    activeCopyPasterAnnotationId: string | undefined
    /** Override for expanding annotations by default */
    isExpandedOverride: boolean
    /** Array of matched annotations, limited to 3 */
    annotations: Annotation[]
    /** URL of the page to which these annotations belong */
    pageUrl: string
    /** Opens the annotation sidebar with all of the annotations */
    openAnnotationSidebar: MouseEventHandler
    goToAnnotation: (annotation: Annotation) => void
    handleEditAnnotation: (url: string, comment: string, tags: string[]) => void
    handleDeleteAnnotation: (url: string) => void
    handleBookmarkToggle: (url: string) => void
    setActiveCopyPasterAnnotationId?: (id: string) => void
}

interface SharingInfo {
    [annotationUrl: string]: AnnotationSharingInfo
}

interface State {
    /** Boolean to denote whether the list is expanded or not */
    isExpanded: boolean
    /** The previous prop to compare in getDerivedStateFromProps */
    prevIsExpandedOverride: boolean
    /** Received annotations are stored and manipulated through edit/delete */
    annotations: Annotation[]
    annotationsSharingInfo: SharingInfo
    sharingAccess: AnnotationSharingAccess
}

class AnnotationList extends Component<Props, State> {
    private customListsBG = runInBackground<RemoteCollectionsInterface>()
    private contentShareBG = runInBackground<ContentSharingInterface>()

    state: State = {
        /* The initial value is set to the isExpandedOverride which is
        fetched from localStorage. */
        isExpanded: this.props.isExpandedOverride,
        prevIsExpandedOverride: this.props.isExpandedOverride,
        annotations: this.props.annotations,
        sharingAccess: 'feature-disabled',
        annotationsSharingInfo: {},
    }

    /**
     * We compare if the previous isExpandedOverride prop is different from
     * the current isExpandedOverride, then we set the state accordingly.
     */
    static getDerivedStateFromProps(props: Props, state: State): State {
        if (props.isExpandedOverride !== state.prevIsExpandedOverride) {
            return {
                ...state,
                isExpanded: props.isExpandedOverride,
                prevIsExpandedOverride: props.isExpandedOverride,
            }
        }
        return state
    }

    async componentDidMount() {
        await this.detectPageSharingStatus()
        await this.detectSharedAnnotations()
    }

    private async detectPageSharingStatus() {
        const listIds = await this.customListsBG.fetchListIdsByUrl({
            url: this.props.pageUrl,
        })
        const areListsShared = await this.contentShareBG.areListsShared({
            localListIds: listIds,
        })

        const isPageSharedOnSomeList = Object.values(areListsShared).reduce(
            (val, acc) => acc || val,
            false,
        )

        this.setState(() => ({
            sharingAccess: isPageSharedOnSomeList
                ? 'sharing-allowed'
                : 'page-not-shared',
        }))
    }

    private async detectSharedAnnotations() {
        const annotationSharingInfo: SharingInfo = {}
        const annotationUrls = this.props.annotations.map((a) => a.url)
        const remoteIds = await this.contentShareBG.getRemoteAnnotationIds({
            annotationUrls,
        })
        for (const localId of Object.keys(remoteIds)) {
            annotationSharingInfo[localId] = {
                status: 'shared',
                taskState: 'pristine',
            }
        }
        this.setState(() => ({
            annotationsSharingInfo: annotationSharingInfo,
        }))
    }

    private updateAnnotationShareState = (annotationUrl: string) => (
        info: AnnotationSharingInfo,
    ) =>
        this.setState((state) => ({
            annotationsSharingInfo: {
                ...state.annotationsSharingInfo,
                [annotationUrl]: info,
            },
        }))

    private toggleIsExpanded = () => {
        this.setState(
            (prevState: State): State => ({
                ...prevState,
                isExpanded: !prevState.isExpanded,
            }),
        )
    }

    private handleEditAnnotation = (
        url: string,
        comment: string,
        tags: string[],
    ) => {
        // Find the annotation in state and update it
        const { annotations } = this.state

        const index = annotations.findIndex((annot) => annot.url === url)
        const annotation: Annotation = annotations[index]

        if (
            !annotation ||
            (!annotation.body && !comment.length && !tags.length)
        ) {
            return
        }

        const newAnnotations: Annotation[] = [
            ...annotations.slice(0, index),
            { ...annotation, comment, tags, lastEdited: new Date() },
            ...annotations.slice(index + 1),
        ]

        this.props.handleEditAnnotation(url, comment, tags)

        this.setState({
            annotations: newAnnotations,
        })
    }

    private handleDeleteAnnotation = (url: string) => {
        this.props.handleDeleteAnnotation(url)

        // Delete the annotation in the state too
        const { annotations } = this.state
        const index = this.state.annotations.findIndex(
            (annot) => annot.url === url,
        )
        const newAnnotations = [
            ...annotations.slice(0, index),
            ...annotations.slice(index + 1),
        ]
        this.setState({
            annotations: newAnnotations,
        })
    }

    private handleBookmarkToggle = (url: string) => {
        this.props.handleBookmarkToggle(url)

        const { annotations } = this.state

        const index = annotations.findIndex((annot) => annot.url === url)
        const annotation: Annotation = annotations[index]
        const newAnnotations: Annotation[] = [
            ...annotations.slice(0, index),
            { ...annotation, hasBookmark: !annotation.hasBookmark },
            ...annotations.slice(index + 1),
        ]

        this.setState({
            annotations: newAnnotations,
        })
    }

    private handleGoToAnnotation = (annotation: Annotation) => (
        e: React.MouseEvent<HTMLElement>,
    ) => {
        e.preventDefault()
        e.stopPropagation()
        this.props.goToAnnotation(annotation)
    }

    private renderCopyPasterManager(annot: Annotation) {
        if (this.props.activeCopyPasterAnnotationId !== annot.url) {
            return null
        }

        return (
            <HoverBox>
                <CopyPaster
                    onClick={(id) => console.log('onClick', id)}
                    onClickCancel={() => console.log('onClickCancel')}
                    onClickDelete={() => console.log('onClickDelete')}
                    onClickEdit={(id) => console.log('onClickEdit', id)}
                    onClickHowto={() => console.log('onClickHowTo')}
                    onClickNew={() => console.log('onClickNew')}
                    onClickSave={() => console.log('onClickSave')}
                    onTitleChange={() => console.log('onTitleChange')}
                    onCodeChange={() => console.log('onCodeChange')}
                    onSetIsFavourite={() => console.log('onSetIsFavorite')}
                    onClickOutside={() =>
                        this.props.setActiveCopyPasterAnnotationId?.(undefined)
                    }
                    templates={[]}
                />
            </HoverBox>
        )
    }

    private renderAnnotations() {
        return this.state.annotations.map((annot) => (
            <AnnotationBox
                env="overview"
                key={annot.url}
                pageUrl={this.props.pageUrl}
                className={styles.annotation}
                handleGoToAnnotation={this.handleGoToAnnotation(annot)}
                handleDeleteAnnotation={this.handleDeleteAnnotation}
                handleEditAnnotation={this.handleEditAnnotation}
                handleBookmarkToggle={this.handleBookmarkToggle}
                {...annot}
                hasBookmark={annot.hasBookmark}
                lastEdited={annot.lastEdited?.valueOf()}
                createdWhen={annot.createdWhen?.valueOf()}
                sharingAccess={this.state.sharingAccess}
                sharingInfo={this.state.annotationsSharingInfo[annot.url]}
                updateSharingInfo={this.updateAnnotationShareState(annot.url)}
                copyPasterManager={this.renderCopyPasterManager(annot)}
                handleCopyPasterClick={
                    this.props.setActiveCopyPasterAnnotationId != null
                        ? () =>
                              this.props.setActiveCopyPasterAnnotationId(
                                  annot.url,
                              )
                        : undefined
                }
            />
        ))
    }

    render() {
        const { isExpanded } = this.state
        return (
            <div
                className={cx({
                    [styles.parentExpanded]: isExpanded,
                })}
            >
                {/* Annotation count text and toggle arrow */}
                <div
                    className={cx(styles.resultCount, {
                        [styles.expandedCount]: this.state.isExpanded,
                    })}
                    onClick={this.toggleIsExpanded}
                >
                    <b>{this.props.annotations.length}</b>{' '}
                    <span className={styles.resultsText}>results</span>
                    <span
                        className={cx(styles.icon, {
                            [styles.inverted]: this.state.isExpanded,
                        })}
                    />
                </div>

                {/* Container for displaying AnnotationBox */}
                <div className={styles.annotationList}>
                    {isExpanded ? this.renderAnnotations() : null}
                </div>
            </div>
        )
    }
}

export default AnnotationList
