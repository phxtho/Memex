import {
    StorageModule,
    StorageModuleConfig,
} from '@worldbrain/storex-pattern-modules'
import {
    COLLECTION_DEFINITIONS,
    COLLECTION_NAMES,
} from '@worldbrain/memex-common/lib/storage/modules/tags/constants'
import { normalizeUrl } from '@worldbrain/memex-url-utils'
import { VALID_TAG_PATTERN } from '@worldbrain/memex-common/lib/storage/constants'

export default class TagStorage extends StorageModule {
    static TAGS_COLL = COLLECTION_NAMES.tag

    getConfig = (): StorageModuleConfig => ({
        collections: {
            ...COLLECTION_DEFINITIONS,
        },
        operations: {
            findAllTagsOfPage: {
                collection: TagStorage.TAGS_COLL,
                operation: 'findObjects',
                args: { url: '$url:string' },
            },
            createTag: {
                collection: TagStorage.TAGS_COLL,
                operation: 'createObject',
            },
            deleteTag: {
                collection: TagStorage.TAGS_COLL,
                operation: 'deleteObjects',
                args: { name: '$name:string', url: '$url:string' },
            },
            deleteAllTagsForPage: {
                collection: TagStorage.TAGS_COLL,
                operation: 'deleteObjects',
                args: { url: '$url:string' },
            },
            deleteTagsForPage: {
                collection: TagStorage.TAGS_COLL,
                operation: 'deleteObjects',
                args: { url: '$url:string', name: { $in: '$tags:string[]' } },
            },
        },
    })

    async fetchAnnotationTags({ url }: { url: string }): Promise<string[]> {
        const tags: Array<{
            name: string
        }> = await this.operation('findAllTagsOfPage', { url })

        return tags.map(({ name }) => name)
    }

    async fetchPageTags({ url }: { url: string }): Promise<string[]> {
        const tags: Array<{
            name: string
        }> = await this.operation('findAllTagsOfPage', {
            url: normalizeUrl(url, {}),
        })
        return tags.map(({ name }) => name)
    }

    async addTag({ name, url }: { name: string; url: string }) {
        if (!VALID_TAG_PATTERN.test(name)) {
            throw new Error(`Attempted to create a badly shaped tag: ${name}`)
        }

        url = normalizeUrl(url, {})
        return this.operation('createTag', { name, url })
    }

    async addAnnotationTag({ name, url }: { name: string; url: string }) {
        if (!VALID_TAG_PATTERN.test(name)) {
            throw new Error(`Attempted to create a badly shaped tag: ${name}`)
        }

        return this.operation('createTag', { name, url })
    }

    async addTags({ name, urls }: { name: string; urls: Array<string> }) {
        await Promise.all(urls.map((url) => this.addTag({ name, url })))
    }

    async delTag({ name, url }: { name: string; url: string }) {
        url = normalizeUrl(url, {})
        return this.operation('deleteTag', { name, url })
    }

    async delTags({ name, urls }: { name: string; urls: Array<string> }) {
        await Promise.all(urls.map((url) => this.delTag({ name, url })))
    }

    async deleteAllTagsForPage({ url }: { url: string }) {
        return this.operation('deleteAllTagsForPage', { url })
    }

    async deleteTagsForPage({ url, tags }: { url: string; tags: string[] }) {
        return this.operation('deleteTagsForPage', { url, tags })
    }
}
