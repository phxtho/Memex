import React from 'react'
import styled from 'styled-components'
import { normalizeUrl } from '@worldbrain/memex-url-utils'

import { ClickAway } from 'src/util/click-away-wrapper'
import { extractIdFromUrl, isUrlYTVideo } from 'src/util/youtube-url'
import {
    MarkdownPreview,
    Props as MarkdownPreviewProps,
} from './markdown-preview'
import { isLoggable } from 'src/activity-logger'

interface MenuItemProps {
    name: string
    isDisabled?: boolean
    getTextToInsert: () => string
}

export interface Props extends MarkdownPreviewProps {
    menuItems: MenuItemProps[]
    updateInputValue: (value: string) => void
}

interface State {
    isOpen: boolean
}

export class MarkdownPreviewAnnotationInsertMenu extends React.PureComponent<
    Props,
    State
> {
    markdownPreviewRef = React.createRef<MarkdownPreview>()
    private lastToggleCall = 0

    state: State = { isOpen: false }

    private toggleMenu = () => {
        // This check covers the case when the menu is open and you click the button to close it:
        //  It also triggers the "ClickAway" call of this method, which results in flickering between the 2 states
        const now = Date.now()
        if (now - this.lastToggleCall < 300) {
            return
        }
        this.lastToggleCall = now

        this.setState((state) => ({ isOpen: !state.isOpen }))
    }

    private handleItemClick: (
        props: MenuItemProps,
    ) => React.MouseEventHandler = ({ getTextToInsert, isDisabled }) => (e) => {
        if (isDisabled) {
            e.preventDefault()
            return
        }

        const newValue = getTextInsertedAtInputSelection(
            getTextToInsert(),
            this.markdownPreviewRef.current.mainInputRef.current,
        )

        this.props.updateInputValue(newValue)
        this.toggleMenu()
    }

    private renderInsertMenu = () => (
        <MenuContainer>
            <MenuBtn
                theme={{ isMenuOpen: this.state.isOpen }}
                onClick={this.toggleMenu}
            >
                Insert
            </MenuBtn>
            {this.state.isOpen && (
                <ClickAway onClickAway={this.toggleMenu}>
                    <Menu>
                        {this.props.menuItems.map((props, i) => (
                            <MenuItem
                                key={i}
                                onClick={this.handleItemClick(props)}
                                theme={{
                                    isDisabled: props.isDisabled,
                                }}
                            >
                                {props.name}
                            </MenuItem>
                        ))}
                    </Menu>
                </ClickAway>
            )}
        </MenuContainer>
    )

    render() {
        return (
            <MarkdownPreview
                ref={this.markdownPreviewRef}
                {...this.props}
                renderSecondaryBtn={this.renderInsertMenu}
            />
        )
    }
}

const MenuContainer = styled.div`
    position: relative;
    flex: 1;
`

const MenuItem = styled.li`
    ${({ theme }) =>
        theme.isDisabled
            ? 'color: #97b2b8;'
            : '&:hover { background: #97b2b8; cursor: pointer; }'}
    padding: 10px 20px;
`

const MenuBtn = styled.button`
    font-weight: ${({ theme }) => (theme.isMenuOpen ? 'bold' : 'normal')};
    box-sizing: border-box;
    cursor: pointer;
    font-size: 14px;
    border: none;
    outline: none;
    padding: 3px 5px;
    margin: 5px 5px -5px 0;
    background: transparent;
    border-radius: 3px;

    &:focus {
        background-color: grey;
    }

    &:hover {
        background-color: #e0e0e0;
    }

    &:focus {
        background-color: #79797945;
    }
`

const Menu = styled.ul`
    position: absolute;
    list-style: none;
    padding: 10px 0;
    background: white;
    border: black 1px solid;
    border-radius: 5px;
`

export const annotationMenuItems: MenuItemProps[] = [
    {
        name: 'YouTube Timestamp',
        isDisabled: !isUrlYTVideo(document.location.href),
        getTextToInsert() {
            const videoEl = document.querySelector<HTMLVideoElement>(
                '.video-stream',
            )

            const timestampSecs = Math.trunc(videoEl?.currentTime ?? 0)
            const humanTimestamp = `${Math.floor(timestampSecs / 60)}:${(
                timestampSecs % 60
            )
                .toString()
                .padStart(2, '0')}`

            const videoId = extractIdFromUrl(document.location.href)

            return `[${humanTimestamp}](https://youtu.be/${videoId}?t=${timestampSecs})`
        },
    },
    {
        name: 'Link',
        isDisabled: !isLoggable({ url: document.location.href }),
        getTextToInsert() {
            return `[${normalizeUrl(document.location.href)}](${
                document.location.href
            })`
        },
    },
]

// TODO: Move this somewhere where it can be more useful
export const getTextInsertedAtInputSelection = (
    toInsert: string,
    {
        value,
        selectionStart,
        selectionEnd,
    }: HTMLInputElement | HTMLTextAreaElement,
): string =>
    value.substring(0, selectionStart) +
    toInsert +
    value.substring(selectionEnd, value.length)
