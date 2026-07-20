// ==UserScript==
// @name         Ainz Toolkit
// @namespace    ainz.local.ainz-toolkit
// @version      3.5.0
// @description  NovelAI prompt library with fast Main Prompt insertion, categorized Booru tags, combined Tag Sets, local images and collections.
// @author       Ainz
// @match        https://novelai.net/*
// @match        https://danbooru.donmai.us/*
// @match        https://gelbooru.com/*
// @match        https://*.gelbooru.com/*
// @match        https://e621.net/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      danbooru.donmai.us
// @connect      donmai.us
// @connect      cdn.donmai.us
// @connect      static.donmai.us
// @connect      safebooru.donmai.us
// @connect      *.donmai.us
// @connect      e621.net
// @connect      *.e621.net
// @connect      gelbooru.com
// @connect      *.gelbooru.com
// ==/UserScript==

(() => {
    'use strict';

    /*
     * Ainz Toolkit
     *
     * Local data storage:
     * - Library, settings and usage data: this userscript's Tampermonkey storage
     * - Full replacements use a verified temporary transaction and recovery generation
     * - No NovelAI credentials, cookies or tokens are stored or exported.
     */

    const SCRIPT_VERSION = '3.5.0';
    const SCHEMA_VERSION = 18;
    const DATA_KEY = 'ainz_toolkit_data_v1';
    const UI_KEY = 'ainz_toolkit_ui_v1';
    const SETTINGS_KEY = 'ainz_toolkit_settings_v1';
    const FAVORITES_KEY = 'ainz_toolkit_favorites_v1';
    const USAGE_KEY = 'ainz_toolkit_usage_v1';
    const TRANSACTION_KEY = 'ainz_toolkit_transaction_v1';
    const PREVIOUS_DATA_KEY = 'ainz_toolkit_previous_data_v1';
    const VIEW_SESSION_KEY = 'ainz_toolkit_view_v2';
    const THUMBNAIL_KEY_PREFIX = 'ainz_toolkit_thumbnail_v1_';

    // Preserve data created by releases that used the previous storage namespace.
    // The former prefix is reconstructed so the retired personal name is not retained in source text.
    const LEGACY_STORAGE_PREFIX = `${String.fromCharCode(115, 105, 109, 111, 110)}_nai_toolkit_`;
    const LEGACY_DATA_KEY = `${LEGACY_STORAGE_PREFIX}data_v1`;
    const LEGACY_UI_KEY = `${LEGACY_STORAGE_PREFIX}ui_v1`;
    const LEGACY_VIEW_SESSION_KEY = `${LEGACY_STORAGE_PREFIX}view_v2`;
    const LEGACY_THUMBNAIL_KEY_PREFIX = `${LEGACY_STORAGE_PREFIX}thumbnail_v1_`;

    migrateLegacyStorage();

    const MAX_RECENT = 24;
    const SITE = detectSite();
    const IS_NAI = SITE === 'novelai';
    const IS_BOORU = ['danbooru', 'gelbooru', 'e621'].includes(SITE);
    const BOORU_SITES = ['danbooru', 'gelbooru', 'e621'];
    const SIDEBAR_SECTION_IDS = ['quick', 'booru', 'characters', 'sets', 'bases', 'styles', 'full-images', 'tags', 'imported', 'collections', 'smart', 'history'];
    const DEFAULT_SIDEBAR_ORDER = [...SIDEBAR_SECTION_IDS];
    const ALL_BOORU_GROUPS = ['general', 'character', 'copyright', 'artist', 'species', 'lore', 'meta', 'text', 'invalid'];
    const DEFAULT_BOORU_PROFILES = {
        danbooru: { includeGroups: ['general', 'character', 'copyright', 'artist', 'meta', 'text'], copyGroups: ['general', 'character', 'copyright', 'artist', 'text'], tagFormat: 'spaces', includeCensorshipTags: false },
        gelbooru: { includeGroups: ['general', 'character', 'copyright', 'artist', 'meta', 'text'], copyGroups: ['general', 'character', 'copyright', 'artist', 'text'], tagFormat: 'spaces', includeCensorshipTags: false },
        e621: { includeGroups: ['general', 'species', 'character', 'copyright', 'artist', 'lore', 'meta', 'text'], copyGroups: ['general', 'species', 'character', 'copyright', 'artist', 'lore', 'text'], tagFormat: 'spaces', includeCensorshipTags: false }
    };

    const SMART_VIEW_LABELS = {
        'recent-used': 'Recently Used',
        'recent-created': 'Recently Created',
        'recent-modified': 'Recently Modified',
        'most-used': 'Most Used'
    };

    const TEXT_TAGS = new Set([
        'text', 'english_text', 'japanese_text', 'chinese_text', 'korean_text',
        'translated', 'translation', 'caption', 'subtitle', 'subtitles',
        'speech_bubble', 'thought_bubble', 'dialogue', 'narration',
        'signature', 'artist_signature', 'watermark', 'username',
        'character_name', 'name_tag', 'title', 'logo', 'sound_effects',
        'onomatopoeia', 'comic_sound_effects', 'written_sound_effects',
        'sign', 'notice', 'label', 'letter', 'handwriting', 'calligraphy'
    ]);

    const TEXT_TAG_PATTERNS = [
        /(?:^|_)(?:text|caption|subtitle|signature|watermark|speech_bubble|thought_bubble)(?:$|_)/i,
        /(?:^|_)(?:sound_effects?|onomatopoeia|dialogue|narration|handwriting|calligraphy)(?:$|_)/i,
        /^(?:english|japanese|chinese|korean|translated)_(?:text|commentary)$/i
    ];

    const TECHNICAL_TAGS = new Set([
        'commentary_request',
        'translation_request',
        'source_request',
        'tagme',
        'artist_request',
        'character_request',
        'copyright_request',
        'species_request',
        'invalid_tag',
        'duplicate',
        'bad_id',
        'conditional_dnp',
        'avoid_posting',
        'third-party_edit',
        'third_party_edit'
    ]);

    const CENSOR_EXACT = new Set([
        'censored',
        'censor_bar',
        'bar_censor',
        'black_bar_censor',
        'white_bar_censor',
        'mosaic_censoring',
        'mosaic_censor',
        'pixel_censoring',
        'pixelated_censoring',
        'convenient_censoring',
        'identity_censoring',
        'fake_censorship',
        'blank_censor',
        'light_censor',
        'steam_censor',
        'object_censoring',
        'foreground_censoring',
        'out-of-frame_censoring',
        'out_of_frame_censoring',
        'hair_censor',
        'hand_censor',
        'heart_censor',
        'flower_censor',
        'food_censor',
        'emoji_censor',
        'text_censor',
        'symbol_censor',
        'censored_nipples',
        'censored_genitalia',
        'censored_penis',
        'censored_vulva',
        'censored_anus',
        'censored_breasts'
    ]);

    const NON_PROMPT_METADATA_TAGS = new Set([
        'danbooru', 'gelbooru', 'e621', 'pixiv', 'pixiv_id', 'pixiv_sample',
        'twitter', 'x.com', 'deviantart', 'artstation', 'source', 'source_link',
        'md5_mismatch', 'parent_post', 'child_post'
    ]);

    const URLISH_RE = /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|jp|tv|ru|de|co)(?:\/|$)|\/artworks\/|\/posts\/\d+)/i;

    const ANIMAL_HINT_TAGS = new Set([
        'anthro', 'feral', 'furry', 'kemono', 'animal', 'animal focus', 'animal_focus',
        'canine', 'feline', 'fox', 'wolf', 'dog', 'cat', 'rabbit', 'bunny', 'horse',
        'dragon', 'reptile', 'bird', 'avian', 'bear', 'deer', 'otter', 'mouse', 'rat',
        'pokemon', 'digimon', 'scalie', 'taur', 'quadruped'
    ]);

    const ANIMAL_APPEARANCE_PATTERNS = [
        /(?:^| )(?:fur|furry|fluffy|mane|muzzle|snout|whiskers?|paws?|pawpads?|claws?|talons?|hooves?|horns?|antlers?|beak|wings?|tail|ears?|scales?|feathers?|countershading|markings?|spots?|stripes?)(?:$| )/i,
        /(?:^| )(?:canine|feline|vulpine|equine|ursine|avian|reptilian|dragon|fox|wolf|dog|cat|rabbit|bunny|horse|bear|deer|otter)(?:$| )/i,
        /(?:^| )(?:anthro|feral|kemono|scalie|taur|quadruped)(?:$| )/i
    ];

    const ANIMAL_SCENE_EXCLUDE_PATTERNS = [
        /^(?:[1-9]\+?(?:girl|boy|woman|man|other|female|male|anthro|feral)s?|solo|multiple (?:girls|boys|characters))$/i,
        /(?:^| )(?:shirt|dress|skirt|pants|shorts|jacket|coat|uniform|swimsuit|bikini|lingerie|underwear|panties|bra|stockings?|thighhighs?|socks?|shoes?|boots?|gloves?|hat|headdress|ribbon|bow|necklace|earrings?|bracelet|glasses|eyewear|clothes|clothing|outfit|costume)(?:$| )/i,
        /(?:^| )(?:black|white|red|blue|green|brown|blonde|blond|pink|purple|orange|silver|grey|gray|golden) (?:dress|shirt|skirt|stockings?|thighhighs?|clothes|outfit|hat|gloves?|boots?|shoes?)(?:$| )/i
    ];

    const HUMAN_APPEARANCE_PATTERNS = [
        /^(?:[1-9]\+?(?:girl|boy|woman|man|other|female|male)s?|solo|multiple (?:girls|boys))$/i,
        /(?:^| )(?:hair|bangs|ponytail|twintails?|braid|bob cut|ahoge|sidelocks?|hair ornament|hairclip|hairband)(?:$| )/i,
        /(?:^| )(?:eyes?|eyebrows?|eyelashes?|pupils?|heterochromia|colored sclera)(?:$| )/i,
        /(?:^| )(?:skin|complexion|tan|dark-skinned|pale skin|freckles|mole|birthmark|scar|tattoo)(?:$| )/i,
        /(?:^| )(?:breasts?|chest|waist|hips?|thighs?|legs?|arms?|hands?|feet|navel|ass|butt|muscular|curvy|petite|slender|fat|chubby|tall|short|body)(?:$| )/i,
        /(?:^| )(?:shirt|dress|skirt|pants|shorts|jacket|coat|uniform|swimsuit|bikini|lingerie|underwear|panties|bra|stockings?|thighhighs?|socks?|shoes?|boots?|gloves?|hat|headdress|ribbon|bow|necklace|earrings?|bracelet|glasses|eyewear|clothes|clothing|outfit|costume)(?:$| )/i,
        /(?:^| )(?:elf|demon|angel|vampire|oni|human|pointy ears|halo|fangs?|horns?|wings?|tail)(?:$| )/i,
        /(?:^| )(?:black|white|red|blue|green|brown|blonde|blond|pink|purple|orange|silver|grey|gray|golden) (?:hair|eyes?|skin|dress|shirt|skirt|stockings?|thighhighs?|clothes|outfit)(?:$| )/i
    ];

    const CATEGORY_LABELS = {
        general: 'General',
        character: 'Character',
        copyright: 'Copyright',
        artist: 'Artist',
        meta: 'Meta',
        species: 'Species',
        lore: 'Lore',
        text: 'Text',
        invalid: 'Invalid',
        unknown: 'Other'
    };

    let data = loadData();
    let favoriteState = loadFavoriteState(data);
    applyFavoriteState(data, favoriteState);
    let usageState = loadUsageState(data);
    applyUsageState(data, usageState);
    let lastSyncedData = deepClone(data);
    let uiPrefs = loadUiPrefs();
    let sessionView = loadSessionView();
    let host = null;
    let root = null;
    let state = {
        open: false,
        activeTab: resolveVisibleStartTab(sessionView.activeTab || data.settings.homePage || 'quick'),
        smartView: SMART_VIEW_LABELS[data.settings.homePage?.replace(/^smart-/, '')] ? data.settings.homePage.replace(/^smart-/, '') : 'recent-used',
        smartKindFilter: 'all',
        search: sessionView.tabs?.[sessionView.activeTab]?.search || '',
        modal: null,
        modalPayload: null,
        toastTimer: null,
        selectedPositiveFieldId: uiPrefs.selectedPositiveFieldId || '',
        selectedNegativeFieldId: uiPrefs.selectedNegativeFieldId || '',
        selectedCharacterIndex: uiPrefs.selectedCharacterIndex || '',
        focusedFieldId: '',
        booruLoading: false,
        booruPost: null,
        booruPreviewSelection: new Set(),
        booruRemoved: [],
        booruPreviewGroups: {},
        booruDraft: {
            name: '',
            category: 'Imported',
            favorite: false,
            saveSource: uiPrefs.booruSaveSource !== false,
            saveThumbnail: uiPrefs.booruSaveThumbnail !== false
        },
        booruAnimalMode: uiPrefs.booruAnimalMode || 'auto',
        importPreview: null,
        collapsedGroups: new Set(),
        currentNotice: '',
        fullScreen: Boolean(uiPrefs.fullScreen),
        fullImageCapturing: false,
        operationBusy: false,
        selectionMode: false,
        selectedItems: new Set(),
        openMenu: '',
        thumbnailStats: null
        ,tagQuery: ''
        ,selectedTag: ''
        ,tagScrollTop: 0
        ,tagResultsScrollTop: 0
        ,naiDiagnosticScan: null
        ,detailReturn: null
        ,detailVariantId: ''
        ,compareVariants: false
        ,compareLeftId: ''
        ,compareRightId: ''
        ,compareMode: 'side'
        ,compareOpacity: 50
        ,profileSite: SITE === 'novelai' ? 'danbooru' : SITE
        ,booruPageMenuOpen: false
        ,booruSelectionMode: false
        ,booruSelectedPosts: new Set()
        ,booruBatchQueue: []
        ,booruBatchProgress: null
        ,booruImportThumbnail: null
        ,visibleLimit: 120
        ,diagnostics: []
        ,resetContentScroll: false
        ,pendingContentScroll: Number(sessionView.tabs?.[sessionView.activeTab]?.scrollTop) || 0
        ,modalReturn: null
        ,healthReport: null
        ,settingsSection: sessionView.settingsSection || 'general'
        ,importFilters: {
            site: '', artist: '', character: '', copyright: '', imageStatus: '',
            favorite: 'all', minVariants: 1, includeTags: '', excludeTags: ''
        }
        ,importSort: 'modified-desc'
        ,importGroup: 'none'
        ,importFiltersOpen: false
        ,importQuery: ''
        ,fullImageQuery: ''
        ,activeCollectionId: ''
        ,collectionPath: []
        ,collectionQuery: ''
        ,bulkImageRefresh: null
        ,renamePreview: null
        ,healthIssueFilter: ''
        ,collectionPickerQuery: ''
        ,collectionPickerSelection: new Set()
        ,searchFocusId: ''
        ,styleTypeFilter: 'all'
        ,styleQuery: ''
        ,styleSort: 'name'
        ,styleTagQuery: ''
        ,styleSelectedProfileId: ''
        ,styleUploadDraft: null
        ,cardVariantIds: deepClone(sessionView.tabs?.[sessionView.activeTab]?.cardVariantIds || {})
        ,stylePillMode: sessionView.tabs?.[sessionView.activeTab]?.stylePillMode || 'browse'
        ,styleSelectedImageKey: ''
        ,styleTagBrowse: null
    };
    const initialViewState = sessionView.tabs?.[state.activeTab] || {};
    state.search = initialViewState.search || state.search || '';
    state.tagQuery = initialViewState.tagQuery || '';
    state.selectedTag = state.activeTab === 'tags' ? (initialViewState.selectedTag || '') : '';
    state.tagScrollTop = Number(initialViewState.tagScrollTop) || 0;
    state.tagResultsScrollTop = Number(initialViewState.tagResultsScrollTop) || 0;
    state.smartKindFilter = initialViewState.smartKindFilter || state.smartKindFilter;
    state.visibleLimit = Number(initialViewState.visibleLimit) || state.visibleLimit;
    state.pendingContentScroll = Number(initialViewState.scrollTop) || 0;
    state.importFilters = { ...state.importFilters, ...(initialViewState.importFilters || {}) };
    state.importSort = initialViewState.importSort || state.importSort;
    state.importGroup = initialViewState.importGroup || state.importGroup;
    state.importFiltersOpen = Boolean(initialViewState.importFiltersOpen);
    state.importQuery = initialViewState.importQuery || '';
    state.fullImageQuery = initialViewState.fullImageQuery || '';
    state.activeCollectionId = initialViewState.activeCollectionId || '';
    state.collectionPath = Array.isArray(initialViewState.collectionPath) ? initialViewState.collectionPath : [];
    state.cardVariantIds = initialViewState.cardVariantIds && typeof initialViewState.cardVariantIds === 'object' ? deepClone(initialViewState.cardVariantIds) : {};
    state.stylePillMode = ['browse', 'copy', 'insert'].includes(initialViewState.stylePillMode) ? initialViewState.stylePillMode : 'browse';

    const editableRegistry = new Map();
    let fieldCounter = 0;
    let characterPanelCounter = 0;
    let saveTimer = null;
    let renderTimer = null;
    let mutationTimer = null;
    let collectionPreviewTimer = null;
    let valueListenerId = null;
    let longPressTimer = null;
    let longPressTriggered = false;
    let thumbnailObserver = null;
    let detailImageObserver = null;
    let tagIndexCache = null;
    let dataRevision = 0;
    let usageSaveTimer = null;
    let favoriteSaveTimer = null;
    let usageValueListenerId = null;
    let favoriteValueListenerId = null;
    let settingsValueListenerId = null;
    const pendingSaveScopes = new Set();
    let mainPromptDescriptorCache = { positive: null, negative: null, route: '' };
    let styleProfilesDirty = true;
    const searchTextCache = new Map();
    const collectionResultCache = new Map();
    let styleImageRecordCache = { revision: '', records: [] };
    const wrapperIndexCache = { revision: -1, wrappers: [], byRef: new Map(), byId: new Map() };
    const duplicateIndexCache = { revision: -1, bySource: new Map(), byMd5: new Map(), byImageHash: new Map() };
    const performanceMetrics = new Map();
    const thumbnailLruCache = new Map();
    const THUMBNAIL_LRU_LIMIT = 48;
    const revisions = { library: 0, tags: 0, images: 0, styles: 0, collections: 0, settings: 0, usage: 0 };
    let integrationObserver = null;
    const detailImageCache = new Map();
    const sourcePostCache = new Map();
    let openToolkitMenu = null;
    let undoRecord = null;
    let undoTimer = null;
    let viewSaveTimer = null;
    let listImageNetworkActive = 0;
    let naiImageRouteActive = false;
    let naiHeaderLauncher = null;
    let navigationSentinel = null;
    let launcherDragState = null;
    let suppressLauncherClick = false;
    let booruSelectionClickInstalled = false;
    let closedRenderDirty = false;
    const listImageNetworkQueue = [];

    function migrateLegacyStorage() {
        try {
            const existingKeys = new Set(typeof GM_listValues === 'function' ? GM_listValues() : []);
            const mappings = [
                [LEGACY_DATA_KEY, DATA_KEY],
                [LEGACY_UI_KEY, UI_KEY]
            ];
            for (const [legacyKey, currentKey] of mappings) {
                if (!existingKeys.has(currentKey) && existingKeys.has(legacyKey)) {
                    GM_setValue(currentKey, GM_getValue(legacyKey));
                    existingKeys.add(currentKey);
                }
            }
            // Gelbooru credentials were retired in v3.5.0. Remove both current and pre-rename keys.
            for (const retiredKey of ['ainz_toolkit_api_auth_v1', `${LEGACY_STORAGE_PREFIX}api_auth_v1`]) {
                if (existingKeys.has(retiredKey)) GM_deleteValue(retiredKey);
            }
            for (const legacyKey of existingKeys) {
                if (!legacyKey.startsWith(LEGACY_THUMBNAIL_KEY_PREFIX)) continue;
                const currentKey = `${THUMBNAIL_KEY_PREFIX}${legacyKey.slice(LEGACY_THUMBNAIL_KEY_PREFIX.length)}`;
                const legacyValue = GM_getValue(legacyKey, '');
                if (!existingKeys.has(currentKey)) {
                    GM_setValue(currentKey, legacyValue);
                    existingKeys.add(currentKey);
                }
                const currentValue = GM_getValue(currentKey, '');
                if (typeof currentValue === 'string' && currentValue.startsWith('data:image/')
                    && currentValue === legacyValue) {
                    GM_deleteValue(legacyKey);
                }
            }
            if (!sessionStorage.getItem(VIEW_SESSION_KEY)) {
                const legacyView = sessionStorage.getItem(LEGACY_VIEW_SESSION_KEY);
                if (legacyView) sessionStorage.setItem(VIEW_SESSION_KEY, legacyView);
            }
        } catch (error) {
            console.warn('[Ainz Toolkit] Previous storage could not be migrated:', error);
        }
    }

    function init() {
        try {
            persistSchemaMigration();
            const recoveredThumbnailReferences = recoverDetachedThumbnailReferences();
            createUi();
            if (recoveredThumbnailReferences) {
                scheduleSave(`Recovered ${recoveredThumbnailReferences} detached local image reference${recoveredThumbnailReferences === 1 ? '' : 's'}`, ['images','library']);
            }
            installGlobalListeners();
            installValueSync();
            installNavigationObserver();
            scheduleIdleWarmup();
            if (IS_NAI) {
                syncNaiRouteLifecycle(true);
            } else {
                installMutationObserver();
            }
            if (IS_BOORU) {
                installBooruSelectionCardHandler();
                syncBooruPageEnhancements();
                if (getPostId()) void loadBooruPost(false);
                render();
            }
        } catch (error) {
            console.error('[Ainz Toolkit] Initialization failed:', error);
            reportDiagnostic('initialization', error);
        }
    }

    function scheduleIdleWarmup() {
        const run = () => {
            try {
                measureOperation('idle-warmup', () => {
                    getWrapperIndex();
                    warmSearchIndexIncrementally();
                    if (state.activeTab === 'quick') {
                        collectFavoriteItems();
                        resolveRecentItems();
                    }
                });
            } catch (error) {
                reportDiagnostic('idle-warmup', error, false);
            }
        };
        if ('requestIdleCallback' in globalThis) requestIdleCallback(run, { timeout: 1800 });
        else setTimeout(run, 600);
    }

    function warmSearchIndexIncrementally() {
        const wrappers = getWrapperIndex().wrappers;
        let index = 0;
        const revision = dataRevision;
        const step = deadline => {
            if (revision !== dataRevision || document.hidden) return;
            let processed = 0;
            while (index < wrappers.length && processed < 240 && (!deadline?.timeRemaining || deadline.timeRemaining() > 2)) {
                searchableText(wrappers[index++].item);
                processed++;
            }
            if (index < wrappers.length) {
                if ('requestIdleCallback' in globalThis) requestIdleCallback(step, { timeout: 1200 });
                else setTimeout(() => step(null), 40);
            }
        };
        if ('requestIdleCallback' in globalThis) requestIdleCallback(step, { timeout: 1200 });
        else setTimeout(() => step(null), 40);
    }

    function detectSite() {
        const hostname = location.hostname.toLowerCase();
        if (hostname === 'novelai.net' || hostname.endsWith('.novelai.net')) return 'novelai';
        if (hostname === 'danbooru.donmai.us') return 'danbooru';
        if (hostname === 'e621.net') return 'e621';
        if (hostname === 'gelbooru.com' || hostname.endsWith('.gelbooru.com')) return 'gelbooru';
        return 'other';
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function uid(prefix = 'id') {
        if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function deepClone(value) {
        if (typeof globalThis.structuredClone === 'function') {
            try { return globalThis.structuredClone(value); } catch { /* JSON-compatible fallback below */ }
        }
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeCharacterType(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'female' || normalized === 'male' || normalized === 'other') return normalized;
        return 'unknown';
    }

    function characterTypeLabel(value) {
        const type = normalizeCharacterType(value);
        return type === 'male' ? 'Male' : type === 'other' ? 'Other' : type === 'female' ? 'Female' : 'Unknown';
    }


    function normalizeTagSetType(value) {
        const type = String(value || '').trim().toLowerCase();
        if (['combined', 'both', 'positive+negative', 'positive_negative'].includes(type)) return 'combined';
        return type === 'negative' ? 'negative' : 'positive';
    }

    function tagSetParts(item) {
        const type = normalizeTagSetType(item?.type);
        const legacy = cleanPromptText(item?.tags || '');
        const positive = cleanPromptText(item?.positiveTags ?? item?.positive ?? (type === 'positive' ? legacy : ''));
        const negative = cleanPromptText(item?.negativeTags ?? item?.negative ?? (type === 'negative' ? legacy : ''));
        return { type, positive, negative };
    }

    function normalizeManualTagSet(item) {
        const parts = tagSetParts(item);
        return {
            ...item,
            type: parts.type,
            positiveTags: parts.positive,
            negativeTags: parts.negative,
            tags: parts.type === 'negative' ? parts.negative : parts.positive,
            entryType: 'set'
        };
    }

    function defaultData() {
        const timestamp = nowIso();
        return {
            schemaVersion: SCHEMA_VERSION,
            scriptVersion: SCRIPT_VERSION,
            meta: {
                createdAt: timestamp,
                updatedAt: timestamp,
                revision: 0
            },
            settings: {
                maxHistory: 50,
                insertPosition: 'cursor',
                duplicateMode: 'skip',
                filterTechnicalTags: true,
                keepBooruGroups: true,
                showTagPlusButtons: false,
                autoOpenAfterImport: false,
                animalAppearanceMode: 'auto',
                homePage: 'quick',
                thumbnailDisplay: 'all',
                thumbnailQuality: 'local',
                allowOnlineListFallback: false,
                hiddenSidebarSections: [],
                sidebarOrder: deepClone(DEFAULT_SIDEBAR_ORDER),
                accent: 'violet',
                cardLayout: 'grid',
                booruProfiles: deepClone(DEFAULT_BOORU_PROFILES),
                batchImportDelay: 350,
                similarityThreshold: 10
                ,similarityProfile: 'balanced'
                ,importNameTemplate: '{character} ({source} - {artist})'
                ,closeAfterInsertion: true
                ,confirmReplaceActions: false
                ,closeOnOutsideClick: true
                ,naiLauncherPosition: 'header'
                ,naiFloatingButtonPosition: { right: 18, top: 120 }
            },
            characters: [],
            sets: [],
            bases: [],
            styleArtists: [],
            styleImages: [],
            styleFavorites: [],
            fullImages: [],
            favoriteTags: [],
            collections: [],
            history: [],
            recent: []
        };
    }

    function normalizeSource(source) {
        if (!source || typeof source !== 'object') return null;
        const rawSite = String(source.site || source.platform || '').trim().toLowerCase();
        const site = rawSite.includes('e621') ? 'e621' : rawSite.includes('gelbooru') ? 'gelbooru' : rawSite.includes('danbooru') || rawSite.includes('donmai') ? 'danbooru' : rawSite;
        let postId = String(source.postId || source.id || '').trim();
        const url = String(source.url || source.postUrl || '').trim();
        if (!postId && url) {
            try {
                const parsed = new URL(url);
                postId = site === 'gelbooru' ? String(parsed.searchParams.get('id') || '') : String(parsed.pathname.match(/\/posts\/(\d+)/)?.[1] || '');
            } catch { /* keep missing legacy ID */ }
        }
        if (!site && !postId && !url) return null;
        return {
            site,
            postId,
            url: absoluteBooruUrl(url, site),
            imageUrl: absoluteBooruUrl(source.imageUrl || source.sampleUrl || source.previewUrl || source.fileUrl || '', site),
            previewUrl: absoluteBooruUrl(source.previewUrl || '', site),
            sampleUrl: absoluteBooruUrl(source.sampleUrl || '', site),
            fileUrl: absoluteBooruUrl(source.fileUrl || source.originalImageUrl || '', site),
            originalSourceUrl: String(source.originalSourceUrl || source.artistSourceUrl || '').trim(),
            artist: Array.isArray(source.artist) ? source.artist.map(String) : words(source.artist || source.artists || ''),
            tagGroups: compactGroups(source.tagGroups || source.groups || {}),
            width: Math.max(0, Number(source.width) || 0),
            height: Math.max(0, Number(source.height) || 0),
            fileSize: Math.max(0, Number(source.fileSize || source.sizeBytes) || 0),
            fileExt: String(source.fileExt || source.format || '').trim().toLowerCase(),
            md5: String(source.md5 || source.fileHash || '').trim().toLowerCase(),
            rating: String(source.rating || '').trim(),
            parentId: String(source.parentId || '').trim(),
            childIds: (Array.isArray(source.childIds) ? source.childIds : []).map(String),
            uploadedAt: source.uploadedAt || source.createdAt || '',
            sourceUpdatedAt: source.sourceUpdatedAt || source.updatedAt || '',
            importedAt: source.importedAt || source.savedAt || nowIso(),
            lastCheckedAt: source.lastCheckedAt || ''
        };
    }

    function absoluteBooruUrl(value, site = SITE) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^data:/i.test(raw)) return raw;
        if (raw.startsWith('//')) return `https:${raw}`;
        const origins = { danbooru: 'https://danbooru.donmai.us', gelbooru: 'https://gelbooru.com', e621: 'https://e621.net' };
        try { return new URL(raw, origins[site] || location.origin).href; }
        catch { return raw; }
    }

    function uniqueNormalizedSources(values) {
        const result = [];
        const seen = new Set();
        for (const value of values || []) {
            const source = normalizeSource(value);
            if (!source) continue;
            const key = `${source.site}|${source.postId}|${source.url}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(source);
        }
        return result;
    }

    function normalizeThumbnailStorageKey(value) {
        const key = String(value || '').trim();
        if (!key) return '';
        if (key.startsWith(LEGACY_THUMBNAIL_KEY_PREFIX)) {
            return `${THUMBNAIL_KEY_PREFIX}${key.slice(LEGACY_THUMBNAIL_KEY_PREFIX.length)}`;
        }
        return key;
    }

    function normalizeThumbnailMetadata(value) {
        if (!value || typeof value !== 'object') return undefined;
        const metadata = { ...value };
        metadata.key = normalizeThumbnailStorageKey(metadata.key);
        return metadata;
    }

    function normalizeVariant(variant, item, fallbackTimestamp, index = 0) {
        const sourceSeed = [
            ...(Array.isArray(variant?.sources) ? variant.sources : []),
            ...(variant?.source ? [variant.source] : []),
            ...(index === 0 && Array.isArray(item?.sources) ? item.sources : []),
            ...(index === 0 && item?.source ? [item.source] : [])
        ];
        const sources = uniqueNormalizedSources(sourceSeed);
        const primarySource = sources[0] || null;
        const image = variant?.image && typeof variant.image === 'object' ? variant.image : {};
        const thumbnail = normalizeThumbnailMetadata(
            variant?.thumbnail && typeof variant.thumbnail === 'object'
                ? variant.thumbnail
                : index === 0 && item?.thumbnail && typeof item.thumbnail === 'object' ? item.thumbnail : undefined
        );
        const legacyGroups = compactGroups(variant?.tagGroups || (index === 0 ? item?.tagGroups : {}) || {});
        if (sources.length && !sources.some(source => Object.keys(source.tagGroups || {}).length)) sources[0].tagGroups = deepClone(legacyGroups);
        const sourceGroups = mergeTagGroups(sources.map(source => source.tagGroups || {}));
        const sourceTags = [...new Set(Object.values(sourceGroups).flat().map(normalizeBooruTag).filter(Boolean))];
        const legacyTags = splitPrompt(variant?.tags || (index === 0 ? item?.tags : '') || '');
        const sourceKeys = new Set(sourceTags.map(canonicalTag));
        const hasStoredOverlays = Array.isArray(variant?.manualAddedTags) || Array.isArray(variant?.manualRemovedTags);
        const manualAddedTags = (hasStoredOverlays ? (variant?.manualAddedTags || []) : legacyTags.filter(tag => !sourceKeys.has(canonicalTag(tag)))).map(normalizeBooruTag).filter(Boolean);
        const manualRemovedTags = (Array.isArray(variant?.manualRemovedTags) ? variant.manualRemovedTags : []).map(canonicalTag).filter(Boolean);
        const effectiveTags = sourceTags.length
            ? applyVariantTagOverlays(sourceTags, manualAddedTags, manualRemovedTags)
            : legacyTags;
        const effectiveGroups = sourceTags.length
            ? reconcileVariantGroups(effectiveTags, sourceGroups, legacyGroups)
            : legacyGroups;
        return {
            id: String(variant?.id || (index === 0 && item?.primaryVariantId) || uid('variant')),
            label: String(variant?.label || `Variant ${index + 1}`),
            createdAt: variant?.createdAt || item?.createdAt || fallbackTimestamp || nowIso(),
            updatedAt: variant?.updatedAt || item?.updatedAt || fallbackTimestamp || nowIso(),
            sources,
            tags: effectiveTags.join(', '),
            tagGroups: effectiveGroups,
            manualAddedTags,
            manualRemovedTags,
            image: {
                previewUrl: absoluteBooruUrl(image.previewUrl || primarySource?.previewUrl || '', primarySource?.site),
                sampleUrl: absoluteBooruUrl(image.sampleUrl || primarySource?.sampleUrl || primarySource?.imageUrl || '', primarySource?.site),
                fileUrl: absoluteBooruUrl(image.fileUrl || primarySource?.fileUrl || '', primarySource?.site),
                width: Math.max(0, Number(image.width || primarySource?.width) || 0),
                height: Math.max(0, Number(image.height || primarySource?.height) || 0),
                fileSize: Math.max(0, Number(image.fileSize || primarySource?.fileSize) || 0),
                fileExt: String(image.fileExt || primarySource?.fileExt || '').toLowerCase(),
                md5: String(image.md5 || primarySource?.md5 || '').toLowerCase(),
                originalSourceUrl: String(image.originalSourceUrl || primarySource?.originalSourceUrl || ''),
                rating: String(image.rating || primarySource?.rating || ''),
                parentId: String(image.parentId || primarySource?.parentId || ''),
                childIds: Array.isArray(image.childIds) ? image.childIds.map(String) : (primarySource?.childIds || []),
                uploadedAt: image.uploadedAt || primarySource?.uploadedAt || '',
                sourceUpdatedAt: image.sourceUpdatedAt || primarySource?.sourceUpdatedAt || '',
                artist: Array.isArray(image.artist) ? image.artist.map(String) : (primarySource?.artist || [])
            },
            thumbnail,
            imageHash: String(variant?.imageHash || thumbnail?.hash || (index === 0 ? item?.imageHash : '') || ''),
            fingerprints: normalizeFingerprints(variant?.fingerprints || (index === 0 ? item?.fingerprints : null), variant?.imageHash || thumbnail?.hash || (index === 0 ? item?.imageHash : ''))
        };
    }

    function mergeTagGroups(groupsList) {
        const merged = {};
        for (const groups of groupsList || []) for (const [group, tags] of Object.entries(groups || {})) (merged[group] ||= []).push(...(tags || []));
        return compactGroups(merged);
    }

    function applyVariantTagOverlays(sourceTags, added, removed) {
        const removedSet = new Set((removed || []).map(canonicalTag));
        const result = [];
        const seen = new Set();
        for (const tag of [...(sourceTags || []), ...(added || [])]) {
            const key = canonicalTag(tag);
            if (!key || removedSet.has(key) || seen.has(key)) continue;
            seen.add(key);
            result.push(normalizeBooruTag(tag));
        }
        return result.filter(Boolean);
    }

    function reconcileVariantGroups(tags, sourceGroups, fallbackGroups = {}) {
        const byTag = new Map();
        for (const groups of [fallbackGroups, sourceGroups]) for (const [group, values] of Object.entries(groups || {})) for (const tag of values || []) byTag.set(canonicalTag(tag), group);
        const result = {};
        for (const tag of tags || []) (result[byTag.get(canonicalTag(tag)) || 'general'] ||= []).push(tag);
        return compactGroups(result);
    }

    function refreshVariantEffectiveTags(variant) {
        if (!variant) return variant;
        const sourceGroups = mergeTagGroups((variant.sources || []).map(source => source.tagGroups || {}));
        const sourceTags = [...new Set(Object.values(sourceGroups).flat().map(normalizeBooruTag).filter(Boolean))];
        if (!sourceTags.length) return variant;
        const tags = applyVariantTagOverlays(sourceTags, variant.manualAddedTags || [], variant.manualRemovedTags || []);
        variant.tags = tags.join(', ');
        variant.tagGroups = reconcileVariantGroups(tags, sourceGroups, variant.tagGroups || {});
        return variant;
    }

    function setVariantManualTags(variant, tagsText) {
        if (!variant) return;
        const wanted = splitPrompt(tagsText);
        const sourceGroups = mergeTagGroups((variant.sources || []).map(source => source.tagGroups || {}));
        const sourceTags = [...new Set(Object.values(sourceGroups).flat())];
        const sourceKeys = new Set(sourceTags.map(canonicalTag));
        const wantedKeys = new Set(wanted.map(canonicalTag));
        variant.manualAddedTags = wanted.filter(tag => !sourceKeys.has(canonicalTag(tag)));
        variant.manualRemovedTags = sourceTags.filter(tag => !wantedKeys.has(canonicalTag(tag))).map(canonicalTag);
        variant.tags = wanted.join(', ');
        variant.tagGroups = reconcileVariantGroups(wanted, sourceGroups, variant.tagGroups || {});
    }

    function normalizeCollectionDefinition(value, index = 0) {
        const collection = value && typeof value === 'object' ? value : {};
        const allowedScopes = ['all', 'imported', 'character', 'set', 'base', 'style', 'fullImage', 'tag'];
        const allowedGroups = ['none', 'artist', 'character', 'copyright', 'source', 'category', 'year', 'favorite', 'variants', 'imageStatus', 'initial'];
        return {
            id: String(collection.id || uid('collection')),
            name: String(collection.name || `Collection ${index + 1}`).trim().slice(0, 100),
            description: String(collection.description || '').trim().slice(0, 500),
            type: collection.type === 'smart' ? 'smart' : 'manual',
            scope: allowedScopes.includes(collection.scope) ? collection.scope : 'imported',
            match: collection.match === 'any' ? 'any' : 'all',
            itemRefs: (Array.isArray(collection.itemRefs) ? collection.itemRefs : []).map(ref => ({ kind: String(ref?.kind || ''), id: String(ref?.id || '') })).filter(ref => ref.kind && ref.id),
            alwaysInclude: (Array.isArray(collection.alwaysInclude) ? collection.alwaysInclude : []).map(ref => ({ kind: String(ref?.kind || ''), id: String(ref?.id || '') })).filter(ref => ref.kind && ref.id),
            excluded: (Array.isArray(collection.excluded) ? collection.excluded : []).map(ref => ({ kind: String(ref?.kind || ''), id: String(ref?.id || '') })).filter(ref => ref.kind && ref.id),
            rules: (Array.isArray(collection.rules) ? collection.rules : []).slice(0, 12).map(rule => ({ field: String(rule?.field || 'tag'), operator: String(rule?.operator || 'contains'), value: String(rule?.value || '') })),
            groupBy: (Array.isArray(collection.groupBy) ? collection.groupBy : []).filter(group => allowedGroups.includes(group) && group !== 'none').slice(0, 3),
            sort: String(collection.sort || 'name-asc'),
            pinned: Boolean(collection.pinned),
            createdAt: collection.createdAt || nowIso(),
            updatedAt: collection.updatedAt || collection.createdAt || nowIso()
        };
    }

    function normalizeStyleProfile(value, index = 0) {
        const item = normalizeItemMetadata(value || {}, nowIso());
        const allowedTypes = ['artist', 'copyright', 'style'];
        const inferredType = allowedTypes.includes(value?.profileType) ? value.profileType : 'style';
        const canonical = canonicalTag(value?.canonicalTag || value?.name || value?.positive || `style-${index + 1}`);
        return {
            ...item,
            profileType: inferredType,
            canonicalTag: canonical,
            styleFavorite: Boolean(value?.styleFavorite),
            coverRef: value?.coverRef && typeof value.coverRef === 'object' ? { ...value.coverRef } : null
        };
    }

    function normalizeStyleImage(value, index = 0) {
        const timestamp = value?.createdAt || nowIso();
        return {
            id: String(value?.id || uid('style-image')),
            filename: String(value?.filename || `NovelAI style image ${index + 1}.png`),
            createdAt: timestamp,
            updatedAt: value?.updatedAt || timestamp,
            prompt: cleanPromptText(value?.prompt || ''),
            negativePrompt: cleanPromptText(value?.negativePrompt || ''),
            characters: (Array.isArray(value?.characters) ? value.characters : []).map((character, characterIndex) => ({
                name: String(character?.name || `Character ${characterIndex + 1}`),
                positive: cleanPromptText(character?.positive || character?.prompt || ''),
                negative: cleanPromptText(character?.negative || character?.uc || ''),
                center: character?.center && typeof character.center === 'object' ? { ...character.center } : null
            })),
            tags: [...new Set((Array.isArray(value?.tags) ? value.tags : splitPrompt(value?.tags || value?.prompt || '')).map(normalizeBooruTag).filter(Boolean))],
            styleTags: [...new Set((Array.isArray(value?.styleTags) ? value.styleTags : []).map(canonicalTag).filter(Boolean))],
            fileHash: String(value?.fileHash || '').trim().toLowerCase(),
            metadata: value?.metadata && typeof value.metadata === 'object' ? { ...value.metadata } : {},
            thumbnail: normalizeThumbnailMetadata(value?.thumbnail)
        };
    }

    function normalizeItemMetadata(item, fallbackTimestamp) {
        const rawSources = [
            ...(Array.isArray(item?.sources) ? item.sources : []),
            ...(item?.source ? [item.source] : [])
        ];
        const uniqueSources = uniqueNormalizedSources(rawSources);
        const createdAt = item?.createdAt || item?.updatedAt || fallbackTimestamp || nowIso();
        const hasImportData = uniqueSources.length || item?.thumbnail || item?.imageHash || item?.variants;
        const variantSeeds = Array.isArray(item?.variants) && item.variants.length ? item.variants : (hasImportData ? [{}] : []);
        const variants = variantSeeds.map((variant, index) => normalizeVariant(variant, item, fallbackTimestamp, index));
        const primaryVariantId = String(item?.primaryVariantId || variants[0]?.id || '');
        const primaryVariant = variants.find(variant => variant.id === primaryVariantId) || variants[0] || null;
        const combinedSources = uniqueNormalizedSources([...uniqueSources, ...variants.flatMap(variant => variant.sources || [])]);
        return {
            ...item,
            createdAt,
            updatedAt: item?.updatedAt || createdAt,
            lastUsed: item?.lastUsed || '',
            usageCount: Math.max(0, Number(item?.usageCount) || 0),
            nameMode: ['auto', 'manual', 'legacy'].includes(item?.nameMode) ? item.nameMode : (hasImportData ? 'legacy' : ''),
            nameTemplate: String(item?.nameTemplate || ''),
            sources: combinedSources,
            source: undefined,
            variants,
            primaryVariantId,
            tags: primaryVariant?.tags ?? item?.tags,
            tagGroups: primaryVariant?.tagGroups ? deepClone(primaryVariant.tagGroups) : item?.tagGroups,
            imageHash: String(primaryVariant?.imageHash || item?.imageHash || item?.thumbnail?.hash || ''),
            fingerprints: normalizeFingerprints(primaryVariant?.fingerprints || item?.fingerprints, primaryVariant?.imageHash || item?.imageHash || item?.thumbnail?.hash || ''),
            thumbnail: primaryVariant?.thumbnail || (item?.thumbnail && typeof item.thumbnail === 'object' ? { ...item.thumbnail } : undefined)
        };
    }

    function normalizeFingerprints(value, legacyHash = '') {
        const source = value && typeof value === 'object' ? value : {};
        return {
            version: Math.max(1, Number(source.version) || 1),
            dHash: String(source.dHash || legacyHash || ''),
            pHash: String(source.pHash || ''),
            edgeHash: String(source.edgeHash || '')
        };
    }

    function isImportedItem(item) {
        if (!item || typeof item !== 'object') return false;
        if (item.entryType === 'imported') return true;
        if (item.entryType === 'set') return false;
        return String(item.category || '').trim().toLowerCase() === 'imported'
            || Boolean(item.sources?.length)
            || getItemVariants(item).some(variant => variant.sources?.length || variant.thumbnail?.key || bestVariantImageUrl(variant));
    }

    function normalizeData(candidate) {
        const base = defaultData();
        if (!candidate || typeof candidate !== 'object') return base;
        const legacyCharacterTypesUntrusted = Number(candidate.schemaVersion || 1) < 13;

        const migrateCategory = value => {
            const category = String(value || '');
            return ({
                'Importiert': 'Imported',
                'Charaktere': 'Characters',
                'Künstler': 'Style/Artist',
                'Stil/Künstler': 'Style/Artist',
                'Vollständiges Bild': 'Full Image'
            })[category] || category;
        };
        const fallbackTimestamp = candidate?.meta?.createdAt || base.meta.createdAt;
        const migrateCollection = value => (Array.isArray(value) ? value : []).reduce((result, item, index) => {
            try {
                if (!item || typeof item !== 'object') throw new Error('Entry is not an object');
                result.push(normalizeItemMetadata({ ...item, category: migrateCategory(item?.category) }, fallbackTimestamp));
            } catch (error) {
                console.warn(`[Ainz Toolkit] Isolated damaged entry at index ${index}:`, error);
            }
            return result;
        }, []);
        const migratedCharacters = migrateCollection(candidate.characters).map(item => ({
            ...item,
            naiCharacterType: legacyCharacterTypesUntrusted ? 'unknown' : normalizeCharacterType(item?.naiCharacterType)
        }));
        const migratedFullImages = migrateCollection(candidate.fullImages).map(item => ({
            ...item,
            characters: (Array.isArray(item?.characters) ? item.characters : []).map((character, index) => ({
                ...character,
                name: String(character?.name || `Character ${index + 1}`),
                positive: cleanPromptText(character?.positive || ''),
                negative: cleanPromptText(character?.negative || ''),
                naiCharacterType: legacyCharacterTypesUntrusted ? 'unknown' : normalizeCharacterType(character?.naiCharacterType)
            }))
        }));
        const migratedSets = migrateCollection(candidate.sets).map(item => {
            if (isImportedItem(item)) return { ...item, entryType: 'imported' };
            return normalizeManualTagSet(item);
        });

        const normalized = {
            ...base,
            ...candidate,
            meta: { ...base.meta, ...(candidate.meta || {}) },
            settings: {
                ...base.settings,
                ...(candidate.settings || {}),
                booruProfiles: BOORU_SITES.reduce((result, site) => {
                    const incoming = candidate.settings?.booruProfiles?.[site] || {};
                    result[site] = { ...deepClone(DEFAULT_BOORU_PROFILES[site]), ...incoming };
                    result[site].includeGroups = [...new Set(Array.isArray(result[site].includeGroups) ? result[site].includeGroups : DEFAULT_BOORU_PROFILES[site].includeGroups)].filter(group => ALL_BOORU_GROUPS.includes(group));
                    result[site].copyGroups = [...new Set(Array.isArray(result[site].copyGroups) ? result[site].copyGroups : DEFAULT_BOORU_PROFILES[site].copyGroups)].filter(group => ALL_BOORU_GROUPS.includes(group));
                    result[site].includeCensorshipTags = Boolean(result[site].includeCensorshipTags);
                    delete result[site].includeRating;
                    return result;
                }, {})
            },
            characters: migratedCharacters,
            sets: migratedSets,
            bases: migrateCollection(candidate.bases),
            styleArtists: (Array.isArray(candidate.styleArtists) ? candidate.styleArtists : []).map(normalizeStyleProfile),
            styleImages: (Array.isArray(candidate.styleImages) ? candidate.styleImages : []).map(normalizeStyleImage),
            styleFavorites: [...new Set((Array.isArray(candidate.styleFavorites) ? candidate.styleFavorites : []).map(String).filter(Boolean))],
            fullImages: migratedFullImages,
            favoriteTags: migrateCollection(candidate.favoriteTags),
            collections: (Array.isArray(candidate.collections) ? candidate.collections : []).map(normalizeCollectionDefinition),
            history: Array.isArray(candidate.history) ? candidate.history : [],
            recent: Array.isArray(candidate.recent) ? candidate.recent : []
        };

        normalized.schemaVersion = SCHEMA_VERSION;
        normalized.scriptVersion = SCRIPT_VERSION;
        normalized.meta.revision = Math.max(0, Number(normalized.meta.revision) || 0);
        normalized.settings.hiddenSidebarSections = [...new Set((Array.isArray(normalized.settings.hiddenSidebarSections) ? normalized.settings.hiddenSidebarSections : []).filter(id => SIDEBAR_SECTION_IDS.includes(id) && id !== 'settings'))];
        normalized.settings.sidebarOrder = [...new Set([...(Array.isArray(normalized.settings.sidebarOrder) ? normalized.settings.sidebarOrder : []), ...DEFAULT_SIDEBAR_ORDER].filter(id => SIDEBAR_SECTION_IDS.includes(id)))];
        delete normalized.settings['auto' + 'Backups'];
        for (const obsoleteKey of ['density', 'motion', 'cardSize', 'compactCards', 'thumbnailSize']) delete normalized.settings[obsoleteKey];
        if (!['grid', 'list'].includes(normalized.settings.cardLayout)) normalized.settings.cardLayout = 'grid';
        if (!['violet', 'blue', 'cyan', 'teal', 'emerald', 'amber', 'orange', 'rose', 'red'].includes(normalized.settings.accent)) normalized.settings.accent = 'violet';
        normalized.settings.allowOnlineListFallback = false;
        normalized.settings.closeAfterInsertion = normalized.settings.closeAfterInsertion !== false;
        normalized.settings.confirmReplaceActions = Boolean(normalized.settings.confirmReplaceActions);
        normalized.settings.closeOnOutsideClick = normalized.settings.closeOnOutsideClick !== false;
        if (!['strict', 'balanced', 'sensitive'].includes(normalized.settings.similarityProfile)) {
            const legacyThreshold = Number(normalized.settings.similarityThreshold) || 10;
            normalized.settings.similarityProfile = legacyThreshold <= 7 ? 'strict' : legacyThreshold >= 13 ? 'sensitive' : 'balanced';
        }
        normalized.settings.importNameTemplate = String(normalized.settings.importNameTemplate || '{character} ({source} - {artist})').trim().slice(0, 180) || '{character} ({source} - {artist})';
        if (!['header', 'floating'].includes(normalized.settings.naiLauncherPosition)) normalized.settings.naiLauncherPosition = 'header';
        const floatingPosition = normalized.settings.naiFloatingButtonPosition || {};
        normalized.settings.naiFloatingButtonPosition = {
            right: Math.max(8, Number(floatingPosition.right) || 18),
            top: Math.max(72, Number(floatingPosition.top) || 120)
        };
        if (Number(candidate.schemaVersion || 1) < 5) normalized.settings.showTagPlusButtons = false;
        if (Number(candidate.schemaVersion || 1) < 9) {
            normalized.settings.thumbnailQuality = 'local';
            normalized.settings.allowOnlineListFallback = false;
        }
        if (!['compact', 'local', 'sharp'].includes(normalized.settings.thumbnailQuality)) normalized.settings.thumbnailQuality = 'local';
        return normalized;
    }

    function prepareCurrentData(candidate) {
        if (!dataLooksUsable(candidate) || Number(candidate.schemaVersion) !== SCHEMA_VERSION) return normalizeData(candidate);
        const base = defaultData();
        const prepared = {
            ...base,
            ...candidate,
            meta: { ...base.meta, ...(candidate.meta || {}) },
            settings: {
                ...base.settings,
                ...(candidate.settings || {}),
                booruProfiles: BOORU_SITES.reduce((result, site) => {
                    result[site] = { ...deepClone(DEFAULT_BOORU_PROFILES[site]), ...(candidate.settings?.booruProfiles?.[site] || {}) };
                    result[site].includeGroups = [...new Set(result[site].includeGroups || [])].filter(group => ALL_BOORU_GROUPS.includes(group));
                    result[site].copyGroups = [...new Set(result[site].copyGroups || [])].filter(group => ALL_BOORU_GROUPS.includes(group));
                    result[site].includeCensorshipTags = Boolean(result[site].includeCensorshipTags);
                    delete result[site].includeRating;
                    return result;
                }, {})
            }
        };
        prepared.schemaVersion = SCHEMA_VERSION;
        prepared.scriptVersion = SCRIPT_VERSION;
        prepared.settings.hiddenSidebarSections = [...new Set((prepared.settings.hiddenSidebarSections || []).filter(id => SIDEBAR_SECTION_IDS.includes(id) && id !== 'settings'))];
        prepared.settings.sidebarOrder = [...new Set([...(prepared.settings.sidebarOrder || []), ...DEFAULT_SIDEBAR_ORDER].filter(id => SIDEBAR_SECTION_IDS.includes(id)))];
        delete prepared.settings['auto' + 'Backups'];
        for (const obsoleteKey of ['density', 'motion', 'cardSize', 'compactCards', 'thumbnailSize']) delete prepared.settings[obsoleteKey];
        if (!['grid', 'list'].includes(prepared.settings.cardLayout)) prepared.settings.cardLayout = 'grid';
        if (!['violet', 'blue', 'cyan', 'teal', 'emerald', 'amber', 'orange', 'rose', 'red'].includes(prepared.settings.accent)) prepared.settings.accent = 'violet';
        prepared.settings.allowOnlineListFallback = false;
        return prepared;
    }

    function dataLooksUsable(value) {
        return Boolean(value && typeof value === 'object'
            && ['characters','sets','bases','styleArtists','fullImages','favoriteTags','collections','history','recent']
                .every(key => Array.isArray(value[key])));
    }

    function dataChecksum(value) {
        const text = JSON.stringify(value);
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `${text.length}:${(hash >>> 0).toString(16)}`;
    }

    function recoverPendingTransaction() {
        try {
            const transaction = GM_getValue(TRANSACTION_KEY, null);
            if (!transaction || typeof transaction !== 'object') return;
            const current = GM_getValue(DATA_KEY, null);
            const candidate = transaction.candidate;
            const candidateValid = dataLooksUsable(candidate) && dataChecksum(candidate) === transaction.checksum;
            if (candidateValid && (!dataLooksUsable(current) || Number(current?.meta?.revision || 0) < Number(candidate?.meta?.revision || 0))) {
                GM_setValue(DATA_KEY, candidate);
            }
            GM_deleteValue(TRANSACTION_KEY);
        } catch (error) {
            console.warn('[Ainz Toolkit] Pending transaction could not be recovered:', error);
        }
    }

    function applyStoredSettings(targetData) {
        if (!targetData) return targetData;
        try {
            const stored = GM_getValue(SETTINGS_KEY, null);
            if (stored && typeof stored === 'object') targetData.settings = { ...targetData.settings, ...stored };
        } catch { /* The library copy remains a safe fallback. */ }
        return targetData;
    }

    function loadData() {
        recoverPendingTransaction();
        try {
            const current = GM_getValue(DATA_KEY, null);
            if (dataLooksUsable(current)) return applyStoredSettings(prepareCurrentData(current));
            const previous = GM_getValue(PREVIOUS_DATA_KEY, null);
            if (dataLooksUsable(previous)) {
                console.warn('[Ainz Toolkit] Current library data was invalid; the previous committed generation was restored.');
                GM_setValue(DATA_KEY, previous);
                return applyStoredSettings(prepareCurrentData(previous));
            }
            return applyStoredSettings(defaultData());
        } catch (error) {
            console.error('[Ainz Toolkit] Data could not be loaded:', error);
            return applyStoredSettings(defaultData());
        }
    }

    function transactionalReplaceData(nextValue, reason = 'Data replacement') {
        const candidate = normalizeData(nextValue);
        candidate.meta.updatedAt = nowIso();
        candidate.meta.revision = Math.max(Number(candidate.meta?.revision) || 0, Number(data?.meta?.revision) || 0) + 1;
        const snapshot = deepClone(candidate);
        const checksum = dataChecksum(snapshot);
        const previous = GM_getValue(DATA_KEY, null);
        GM_setValue(TRANSACTION_KEY, { reason, preparedAt: nowIso(), checksum, candidate: snapshot });
        const prepared = GM_getValue(TRANSACTION_KEY, null);
        if (!prepared || prepared.checksum !== checksum || dataChecksum(prepared.candidate) !== checksum) throw new Error('Prepared transaction verification failed');
        if (dataLooksUsable(previous)) GM_setValue(PREVIOUS_DATA_KEY, previous);
        GM_setValue(DATA_KEY, snapshot);
        const committed = GM_getValue(DATA_KEY, null);
        if (!dataLooksUsable(committed) || dataChecksum(committed) !== checksum) throw new Error('Committed transaction verification failed');
        GM_deleteValue(TRANSACTION_KEY);
        GM_setValue(SETTINGS_KEY, deepClone(candidate.settings));
        data = candidate;
        resetFavoriteOverlay();
        lastSyncedData = deepClone(candidate);
        return candidate;
    }

    function persistSchemaMigration() {
        try {
            const raw = GM_getValue(DATA_KEY, null);
            if (!raw || typeof raw !== 'object') return;
            const needsMigration = Number(raw.schemaVersion || 1) < SCHEMA_VERSION
                || !Array.isArray(raw.styleArtists)
                || !Array.isArray(raw.fullImages)
                || (Array.isArray(raw.characters) && raw.characters.some(item => !item?.naiCharacterType))
                || (Array.isArray(raw.sets) && raw.sets.some(item => !['set', 'imported'].includes(item?.entryType)))
                || ['characters', 'sets', 'bases', 'styleArtists', 'fullImages', 'favoriteTags']
                    .some(key => Array.isArray(raw[key]) && raw[key].some(item => item?.source || !Array.isArray(item?.sources) || item?.usageCount == null));
            if (!needsMigration) return;
            transactionalReplaceData(data, `Schema migration to ${SCHEMA_VERSION}`);
            console.info(`[Ainz Toolkit] Data migrated to schema ${SCHEMA_VERSION}`);
        } catch (error) {
            console.warn('[Ainz Toolkit] Automatic data migration could not be persisted:', error);
        }
    }

    function favoriteStateKey(kind, id) {
        return `${kind}:${id}`;
    }

    function loadFavoriteState() {
        try {
            const stored = GM_getValue(FAVORITES_KEY, null);
            if (stored && typeof stored === 'object') return {
                entries: stored.entries && typeof stored.entries === 'object' ? stored.entries : {},
                styleFavorites: Array.isArray(stored.styleFavorites) ? stored.styleFavorites : null
            };
        } catch { /* The library values remain canonical. */ }
        return { entries: {}, styleFavorites: null };
    }

    function applyFavoriteState(targetData, stateValue = favoriteState) {
        if (!targetData || !stateValue) return targetData;
        for (const wrapper of allLibraryWrappersFromData(targetData)) {
            const entry = stateValue.entries?.[favoriteStateKey(wrapper.kind, wrapper.item.id)];
            if (!entry) continue;
            if ('favorite' in entry) wrapper.item.favorite = Boolean(entry.favorite);
            if (wrapper.kind === 'style' && 'styleFavorite' in entry) wrapper.item.styleFavorite = Boolean(entry.styleFavorite);
        }
        if (Array.isArray(stateValue.styleFavorites)) targetData.styleFavorites = [...new Set(stateValue.styleFavorites)];
        return targetData;
    }

    function updateFavoriteOverlay(targets = [], includeStyleFavorites = false) {
        favoriteState.entries ||= {};
        for (const target of targets || []) {
            const item = target?.item || target;
            if (!item?.id) continue;
            const kind = target?.kind || getWrapperIndex().byId.get(item.id)?.kind || 'set';
            favoriteState.entries[favoriteStateKey(kind, item.id)] = {
                favorite: Boolean(item.favorite),
                ...(kind === 'style' ? { styleFavorite:Boolean(item.styleFavorite) } : {})
            };
        }
        if (includeStyleFavorites) favoriteState.styleFavorites = [...new Set(data.styleFavorites || [])];
    }

    function scheduleFavoriteSave(targets = [], includeStyleFavorites = false) {
        updateFavoriteOverlay(targets, includeStyleFavorites);
        revisions.library++;
        collectionResultCache.clear();
        clearTimeout(favoriteSaveTimer);
        favoriteSaveTimer = setTimeout(flushFavoriteState, 220);
    }

    function flushFavoriteState() {
        clearTimeout(favoriteSaveTimer);
        favoriteSaveTimer = null;
        try { GM_setValue(FAVORITES_KEY, deepClone(favoriteState)); }
        catch (error) { console.warn('[Ainz Toolkit] Favorite state could not be saved:', error); }
    }

    function resetFavoriteOverlay() {
        clearTimeout(favoriteSaveTimer);
        favoriteSaveTimer = null;
        favoriteState = { entries:{}, styleFavorites:null };
        try { GM_deleteValue(FAVORITES_KEY); } catch { /* The main library already contains the committed values. */ }
    }

    function loadUsageState(seedData = null) {
        try {
            const stored = GM_getValue(USAGE_KEY, null);
            if (stored && typeof stored === 'object') return {
                entries: stored.entries && typeof stored.entries === 'object' ? stored.entries : {},
                recent: Array.isArray(stored.recent) ? stored.recent.slice(0, MAX_RECENT) : []
            };
        } catch { /* Seed from library below. */ }
        const entries = {};
        for (const wrapper of allLibraryWrappersFromData(seedData || defaultData())) {
            const count = Number(wrapper.item?.usageCount) || 0;
            const lastUsed = String(wrapper.item?.lastUsed || '');
            if (count || lastUsed) entries[`${wrapper.kind}:${wrapper.item.id}`] = { usageCount: count, lastUsed };
        }
        return { entries, recent: Array.isArray(seedData?.recent) ? seedData.recent.slice(0, MAX_RECENT) : [] };
    }

    function applyUsageState(targetData, stateValue = usageState) {
        if (!targetData || !stateValue) return targetData;
        for (const wrapper of allLibraryWrappersFromData(targetData)) {
            const entry = stateValue.entries?.[`${wrapper.kind}:${wrapper.item.id}`];
            if (!entry) continue;
            wrapper.item.usageCount = Math.max(Number(wrapper.item.usageCount) || 0, Number(entry.usageCount) || 0);
            if (entry.lastUsed && (!wrapper.item.lastUsed || Date.parse(entry.lastUsed) > Date.parse(wrapper.item.lastUsed))) wrapper.item.lastUsed = entry.lastUsed;
        }
        targetData.recent = Array.isArray(stateValue.recent) ? stateValue.recent.slice(0, MAX_RECENT) : (targetData.recent || []);
        return targetData;
    }

    function scheduleUsageSave() {
        revisions.usage++;
        clearTimeout(usageSaveTimer);
        usageSaveTimer = setTimeout(flushUsageState, 1200);
    }

    function flushUsageState() {
        clearTimeout(usageSaveTimer);
        usageSaveTimer = null;
        try { GM_setValue(USAGE_KEY, deepClone(usageState)); }
        catch (error) { console.warn('[Ainz Toolkit] Usage state could not be saved:', error); }
    }

    function loadUiPrefs() {
        try {
            const value = GM_getValue(UI_KEY, {});
            return value && typeof value === 'object' ? value : {};
        } catch {
            return {};
        }
    }

    function loadSessionView() {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(VIEW_SESSION_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? { ...parsed, activeTab: String(parsed.activeTab || ''), tabs: parsed.tabs && typeof parsed.tabs === 'object' ? parsed.tabs : {} } : { activeTab: '', tabs: {} };
        } catch {
            return { activeTab: '', tabs: {} };
        }
    }

    function saveSessionView() {
        try { sessionStorage.setItem(VIEW_SESSION_KEY, JSON.stringify(sessionView)); }
        catch { /* Per-tab view persistence is non-critical. */ }
    }

    function sidebarSectionForTab(tab) {
        return String(tab || '').startsWith('smart-') ? 'smart' : String(tab || 'quick');
    }

    function isSidebarSectionVisible(id) {
        if (id === 'settings') return true;
        if (id === 'booru' && !IS_BOORU) return false;
        return !(data?.settings?.hiddenSidebarSections || []).includes(id);
    }

    function resolveVisibleStartTab(preferred = '') {
        const candidate = String(preferred || '').trim();
        if (candidate === 'settings' || (candidate && isSidebarSectionVisible(sidebarSectionForTab(candidate)))) return candidate;
        const configured = [...new Set([...(data?.settings?.sidebarOrder || []), ...DEFAULT_SIDEBAR_ORDER])];
        const order = configured.map(id => id === 'smart' ? 'smart-recent-used' : id).filter(id => id !== 'booru' || IS_BOORU);
        return order.find(tab => isSidebarSectionVisible(sidebarSectionForTab(tab))) || 'settings';
    }

    function rememberCurrentViewState(persist = true) {
        if (!state?.activeTab) return;
        const content = root?.querySelector?.('.content');
        const modalBody = root?.querySelector?.('.modal-body');
        sessionView.activeTab = state.activeTab;
        sessionView.settingsSection = state.settingsSection || 'general';
        sessionView.tabs[state.activeTab] = {
            ...(sessionView.tabs[state.activeTab] || {}),
            scrollTop: Number(content?.scrollTop) || 0,
            search: state.search || '',
            visibleLimit: Number(state.visibleLimit) || 120,
            tagQuery: state.tagQuery || '',
            selectedTag: state.selectedTag || '',
            tagScrollTop: Number(root?.querySelector?.('#tag-list-scroll')?.scrollTop ?? state.tagScrollTop) || 0,
            tagResultsScrollTop: Number(root?.querySelector?.('#tag-results-panel')?.scrollTop ?? state.tagResultsScrollTop) || 0,
            smartKindFilter: state.smartKindFilter || 'all',
            smartView: state.smartView || 'recent-used',
            collapsedGroups: [...state.collapsedGroups],
            profileSite: state.profileSite || '',
            detailVariantId: state.detailVariantId || '',
            modalScrollTop: Number(modalBody?.scrollTop) || 0,
            importFilters: deepClone(state.importFilters || {}),
            importSort: state.importSort || 'modified-desc',
            importGroup: state.importGroup || 'none',
            importFiltersOpen: Boolean(state.importFiltersOpen),
            importQuery: state.importQuery || '',
            fullImageQuery: state.fullImageQuery || '',
            activeCollectionId: state.activeCollectionId || '',
            collectionPath: deepClone(state.collectionPath || []),
            cardVariantIds: deepClone(state.cardVariantIds || {}),
            stylePillMode: state.stylePillMode || 'browse'
        };
        if (persist) saveSessionView();
    }

    function scheduleViewStatePersistence() {
        rememberCurrentViewState(false);
        clearTimeout(viewSaveTimer);
        viewSaveTimer = setTimeout(saveSessionView, 450);
    }

    function activateToolkitTab(tab) {
        rememberCurrentViewState();
        const next = resolveVisibleStartTab(tab);
        const saved = sessionView.tabs[next] || {};
        state.activeTab = next;
        if (next.startsWith('smart-')) state.smartView = next.replace(/^smart-/, '');
        state.search = saved.search || '';
        state.visibleLimit = Number(saved.visibleLimit) || 120;
        state.tagQuery = saved.tagQuery || '';
        state.selectedTag = next === 'tags' ? (saved.selectedTag || '') : '';
        state.tagScrollTop = Number(saved.tagScrollTop) || 0;
        state.tagResultsScrollTop = Number(saved.tagResultsScrollTop) || 0;
        state.smartKindFilter = saved.smartKindFilter || state.smartKindFilter || 'all';
        state.collapsedGroups = new Set(Array.isArray(saved.collapsedGroups) ? saved.collapsedGroups : []);
        state.profileSite = saved.profileSite || state.profileSite;
        state.importQuery = saved.importQuery || '';
        state.fullImageQuery = saved.fullImageQuery || '';
        state.cardVariantIds = saved.cardVariantIds && typeof saved.cardVariantIds === 'object' ? deepClone(saved.cardVariantIds) : {};
        state.stylePillMode = ['browse', 'copy', 'insert'].includes(saved.stylePillMode) ? saved.stylePillMode : 'browse';
        state.pendingContentScroll = Number(saved.scrollTop) || 0;
        sessionView.activeTab = next;
        saveSessionView();
        render();
    }

    function inferRevisionScopes(reason = '') {
        const text = String(reason || '').toLowerCase();
        if (/button position|setting|sidebar|scheme/.test(text)) return ['settings'];
        if (/thumbnail|image data|image variant|online fallback|web fallback/.test(text)) return ['library','images'];
        if (/style/.test(text)) return ['library','styles','tags'];
        if (/collection/.test(text)) return ['library','collections'];
        if (/history/.test(text)) return ['library'];
        if (/tag|import|source|character|base|full image|entry|variant|favorite/.test(text)) return ['library','tags','collections'];
        return ['library','tags','images','styles','collections'];
    }

    function markDerivedDataDirty(scopes = ['library']) {
        for (const scope of new Set(scopes || [])) if (scope in revisions) revisions[scope]++;
        if (scopes.includes('library') || scopes.includes('tags')) {
            tagIndexCache = null;
            searchTextCache.clear();
            wrapperIndexCache.revision = -1;
            duplicateIndexCache.revision = -1;
        }
        if (scopes.includes('images')) state.thumbnailStats = null;
        if (scopes.includes('collections') || scopes.includes('library') || scopes.includes('tags')) collectionResultCache.clear();
        if (scopes.includes('styles') || scopes.includes('tags')) styleProfilesDirty = true;
    }

    function measureOperation(name, callback) {
        const started = performance.now();
        try { return callback(); }
        finally {
            const duration = performance.now() - started;
            const metric = performanceMetrics.get(name) || { count: 0, total: 0, max: 0, last: 0 };
            metric.count++;
            metric.total += duration;
            metric.max = Math.max(metric.max, duration);
            metric.last = duration;
            performanceMetrics.set(name, metric);
        }
    }

    async function measureOperationAsync(name, callback) {
        const started = performance.now();
        try { return await callback(); }
        finally {
            const duration = performance.now() - started;
            const metric = performanceMetrics.get(name) || { count: 0, total: 0, max: 0, last: 0 };
            metric.count++;
            metric.total += duration;
            metric.max = Math.max(metric.max, duration);
            metric.last = duration;
            performanceMetrics.set(name, metric);
        }
    }

    function scheduleSave(reason = 'Change', scopes = null) {
        data.meta.updatedAt = nowIso();
        data.scriptVersion = SCRIPT_VERSION;
        dataRevision++;
        const effectiveScopes = scopes || inferRevisionScopes(reason);
        markDerivedDataDirty(effectiveScopes);
        for (const scope of effectiveScopes) pendingSaveScopes.add(scope);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveNow(reason), 180);
    }

    function saveNow(reason = 'Change') {
        clearTimeout(saveTimer);
        saveTimer = null;
        try {
            const saveScopes = new Set(pendingSaveScopes);
            pendingSaveScopes.clear();
            if (saveScopes.size === 1 && saveScopes.has('settings')) {
                measureOperation('save-settings', () => GM_setValue(SETTINGS_KEY, deepClone(data.settings)));
                lastSyncedData.settings = deepClone(data.settings);
                saveUiPrefs();
                console.debug(`[Ainz Toolkit] Saved small settings state: ${reason}`);
                return;
            }
            measureOperation('save', () => {
                const rawLatest = GM_getValue(DATA_KEY, null);
                const latestRevision = Number(rawLatest?.meta?.revision) || 0;
                const knownRevision = Number(lastSyncedData?.meta?.revision) || 0;
                if (dataLooksUsable(rawLatest) && latestRevision !== knownRevision) {
                    const latest = prepareCurrentData(rawLatest);
                    data = mergeConcurrentData(lastSyncedData, data, latest, true);
                }
                data.meta.updatedAt = nowIso();
                data.meta.revision = Math.max(latestRevision, Number(data.meta?.revision) || 0) + 1;
                GM_setValue(DATA_KEY, data);
                const verified = GM_getValue(DATA_KEY, null);
                const sameShape = dataLooksUsable(verified)
                    && Number(verified.meta?.revision) === Number(data.meta?.revision)
                    && ['characters','sets','bases','styleArtists','styleImages','fullImages','favoriteTags','collections','history'].every(key => verified[key].length === data[key].length);
                if (!sameShape) throw new Error('Save verification failed');
                lastSyncedData = verified;
                GM_setValue(SETTINGS_KEY, deepClone(data.settings));
                resetFavoriteOverlay();
                try { if (GM_getValue(PREVIOUS_DATA_KEY, null)) GM_deleteValue(PREVIOUS_DATA_KEY); } catch { /* Temporary recovery generation is non-critical after a verified edit. */ }
            });
            saveUiPrefs();
            console.debug(`[Ainz Toolkit] Saved: ${reason}`);
        } catch (error) {
            console.error('[Ainz Toolkit] Save failed:', error);
            toast('Saving failed', 'error');
        }
    }

    function jsonSame(left, right) {
        try { return JSON.stringify(left) === JSON.stringify(right); }
        catch { return left === right; }
    }

    function mergeCollectionDelta(baseValues, localValues, latestValues, collectionKey = '') {
        const identity = item => collectionKey === 'recent' ? `${item?.kind || ''}:${item?.id || ''}` : String(item?.id || item?.signature || '');
        const base = new Map((baseValues || []).filter(Boolean).map(item => [identity(item), item]));
        const local = new Map((localValues || []).filter(Boolean).map(item => [identity(item), item]));
        const output = new Map((latestValues || []).filter(Boolean).map(item => [identity(item), deepClone(item)]));
        for (const [id, baseItem] of base) {
            if (!local.has(id)) output.delete(id);
            else if (!jsonSame(baseItem, local.get(id))) output.set(id, deepClone(local.get(id)));
        }
        for (const [id, localItem] of local) if (!base.has(id)) output.set(id, deepClone(localItem));
        const preferredOrder = [...(localValues || []), ...(latestValues || [])].map(identity);
        const rank = new Map();
        for (const id of preferredOrder) if (!rank.has(id)) rank.set(id, rank.size);
        return [...output.values()].sort((a, b) => (rank.get(identity(a)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(identity(b)) ?? Number.MAX_SAFE_INTEGER));
    }

    function mergeConcurrentData(baseValue, localValue, latestValue, alreadyNormalized = false) {
        const base = alreadyNormalized ? baseValue : normalizeData(baseValue);
        const local = alreadyNormalized ? localValue : normalizeData(localValue);
        const latest = alreadyNormalized ? latestValue : normalizeData(latestValue);
        const merged = deepClone(latest);
        for (const key of ['characters', 'sets', 'bases', 'styleArtists', 'styleImages', 'fullImages', 'favoriteTags', 'collections', 'history']) {
            merged[key] = mergeCollectionDelta(base[key], local[key], latest[key], key);
        }
        const baseStyleFavorites = new Set(base.styleFavorites || []);
        const localStyleFavorites = new Set(local.styleFavorites || []);
        const mergedStyleFavorites = new Set(latest.styleFavorites || []);
        for (const key of baseStyleFavorites) if (!localStyleFavorites.has(key)) mergedStyleFavorites.delete(key);
        for (const key of localStyleFavorites) if (!baseStyleFavorites.has(key)) mergedStyleFavorites.add(key);
        merged.styleFavorites = [...mergedStyleFavorites];
        for (const [key, value] of Object.entries(local.settings || {})) {
            if (!jsonSame(value, base.settings?.[key])) merged.settings[key] = deepClone(value);
        }
        merged.meta = { ...latest.meta, ...local.meta, revision: Math.max(Number(latest.meta?.revision) || 0, Number(local.meta?.revision) || 0) };
        merged.schemaVersion = SCHEMA_VERSION;
        merged.scriptVersion = SCRIPT_VERSION;
        applyFavoriteState(merged);
        applyUsageState(merged);
        return alreadyNormalized ? prepareCurrentData(merged) : normalizeData(merged);
    }

    function saveUiPrefs() {
        uiPrefs = {
            selectedPositiveFieldId: state.selectedPositiveFieldId,
            selectedNegativeFieldId: state.selectedNegativeFieldId,
            selectedCharacterIndex: state.selectedCharacterIndex,
            booruAnimalMode: state.booruAnimalMode,
            booruSaveSource: state.booruDraft.saveSource,
            booruSaveThumbnail: state.booruDraft.saveThumbnail,
            fullScreen: state.fullScreen
        };
        try { GM_setValue(UI_KEY, uiPrefs); }
        catch { /* UI preferences are non-critical. */ }
    }

    function installValueSync() {
        if (typeof GM_addValueChangeListener !== 'function') return;
        valueListenerId = GM_addValueChangeListener(DATA_KEY, (_name, _oldValue, newValue, remote) => {
            if (!remote || !dataLooksUsable(newValue)) return;
            const incoming = prepareCurrentData(newValue);
            if (saveTimer) data = mergeConcurrentData(lastSyncedData, data, incoming, true);
            else data = incoming;
            applyFavoriteState(data);
            applyUsageState(data);
            lastSyncedData = deepClone(data);
            dataRevision++;
            markDerivedDataDirty(['library','tags','images','styles','collections']);
            scheduleRender();
            toast('Library updated from another tab', 'info');
        });
        settingsValueListenerId = GM_addValueChangeListener(SETTINGS_KEY, (_name, _oldValue, newValue, remote) => {
            if (!remote || !newValue || typeof newValue !== 'object') return;
            data.settings = { ...data.settings, ...newValue };
            lastSyncedData.settings = deepClone(data.settings);
            revisions.settings++;
            if (state.open) scheduleRender();
        });
        favoriteValueListenerId = GM_addValueChangeListener(FAVORITES_KEY, (_name, _oldValue, newValue, remote) => {
            if (!remote) return;
            if (!newValue || typeof newValue !== 'object') { favoriteState = { entries:{}, styleFavorites:null }; return; }
            favoriteState = { entries:newValue.entries || {}, styleFavorites:Array.isArray(newValue.styleFavorites) ? newValue.styleFavorites : null };
            applyFavoriteState(data, favoriteState);
            revisions.library++;
            collectionResultCache.clear();
            if (state.open) scheduleRender();
        });
        usageValueListenerId = GM_addValueChangeListener(USAGE_KEY, (_name, _oldValue, newValue, remote) => {
            if (!remote || !newValue || typeof newValue !== 'object') return;
            usageState = { entries: newValue.entries || {}, recent: Array.isArray(newValue.recent) ? newValue.recent.slice(0, MAX_RECENT) : [] };
            applyUsageState(data, usageState);
            revisions.usage++;
            if (state.open && ['quick','smart-recent-used','smart-most-used'].includes(state.activeTab)) scheduleRender();
        });

        const flushBeforeExit = () => {
            flushUsageState();
            flushFavoriteState();
            rememberCurrentViewState(true);
            if (valueListenerId && typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(valueListenerId);
            if (settingsValueListenerId && typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(settingsValueListenerId);
            if (favoriteValueListenerId && typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(favoriteValueListenerId);
            if (usageValueListenerId && typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(usageValueListenerId);
        };
        window.addEventListener('pagehide', flushBeforeExit);
        window.addEventListener('beforeunload', flushBeforeExit, { once: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) { flushUsageState(); flushFavoriteState(); saveSessionView(); } });
    }
    function createUi() {
        host = document.createElement('div');
        host.id = 'ainz-toolkit-host';
        if (IS_NAI && !isNaiImageRoute()) host.style.display = 'none';
        document.documentElement.appendChild(host);
        root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>${styles()}</style><div id="mount"></div><div id="ainz-menu-layer"></div>`;
    }

    function styles() {
        return `
            :host { all: initial; }
            *, *::before, *::after { box-sizing: border-box; }
            button, input, textarea, select { font: inherit; }

            .ainz-fab {
                position: fixed;
                right: 18px;
                bottom: 18px;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 46px;
                height: 46px;
                padding: 0;
                border: 1px solid rgba(255,255,255,.16);
                border-radius: 999px;
                background: linear-gradient(135deg, #1b1e29, #282d3d);
                color: #fff;
                box-shadow: 0 12px 38px rgba(0,0,0,.42);
                cursor: pointer;
                font: 800 19px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                transition: transform .15s ease, background .15s ease;
                touch-action: none;
            }
            .ainz-fab:hover { transform: translateY(-2px); background: linear-gradient(135deg, #252a39, #343b50); }
            .ainz-fab.active { border-color: #9383ff; color: #fff; }
            .ainz-fab[hidden] { display: none !important; }

            .ainz-panel {
                position: fixed;
                right: 18px;
                bottom: 76px;
                z-index: 2147483647;
                display: none;
                width: min(920px, calc(100vw - 36px));
                height: min(790px, calc(100vh - 102px));
                overflow: hidden;
                border: 1px solid rgba(255,255,255,.13);
                border-radius: 17px;
                background: #11131a;
                color: #eceef5;
                box-shadow: 0 26px 90px rgba(0,0,0,.62);
                font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .ainz-panel.open { display: grid; grid-template-rows: auto 1fr; }
            .ainz-panel.full { inset: 12px; width: auto; height: auto; }

            .topbar { display: grid; grid-template-columns: auto minmax(180px, 1fr) auto; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.09); background: #171a23; }
            .brand { display: flex; align-items: center; gap: 9px; font-weight: 800; font-size: 15px; white-space: nowrap; }
            .brand-badge { display: inline-grid; place-items: center; width: 29px; height: 29px; border-radius: 9px; background: linear-gradient(135deg, #725cff, #4ca7ff); font-size: 15px; }
            .search-wrap { position: relative; }
            .search-wrap input { width: 100%; min-height: 36px; padding: 8px 34px 8px 11px; border: 1px solid rgba(255,255,255,.13); border-radius: 9px; outline: none; background: #0e1016; color: #fff; }
            .search-wrap input:focus { border-color: #7668ff; box-shadow: 0 0 0 3px rgba(118,104,255,.14); }
            .search-clear { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); border: 0; background: transparent; color: #8f93a3; padding: 5px; cursor: pointer; }
            .top-actions { display: flex; gap: 6px; }

            .layout { min-height: 0; display: grid; grid-template-columns: 158px minmax(0, 1fr); }
            .sidebar { min-height: 0; overflow-y: auto; padding: 10px 8px; border-right: 1px solid rgba(255,255,255,.08); background: #141720; }
            .nav { width: 100%; display: flex; align-items: center; gap: 9px; margin: 2px 0; padding: 9px 10px; border: 0; border-radius: 8px; background: transparent; color: #b9bdca; cursor: pointer; text-align: left; }
            .nav:hover { background: rgba(255,255,255,.06); color: #fff; }
            .nav.active { background: rgba(113,94,255,.18); color: #fff; box-shadow: inset 3px 0 #7562ff; }
            .nav .n { margin-left: auto; color: #858a9a; font-size: 11px; }
            .sidebar-sep { height: 1px; margin: 9px 5px; background: rgba(255,255,255,.08); }

            .content { min-width: 0; min-height: 0; overflow-y: auto; padding: 14px; }
            .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
            .section-title { margin: 0; font-size: 19px; line-height: 1.2; }
            .section-subtitle { margin-top: 4px; color: #9297a7; font-size: 12px; }
            .actions { display: flex; flex-wrap: wrap; gap: 7px; }

            .btn { min-height: 33px; padding: 7px 10px; border: 1px solid rgba(255,255,255,.13); border-radius: 8px; background: #232735; color: #f5f6fa; cursor: pointer; font-weight: 650; }
            .btn:hover { background: #303647; }
            .btn.primary { border-color: #7769ff; background: #6657e8; }
            .btn.primary:hover { background: #7467ed; }
            .btn.danger { color: #ffb7bd; }
            .btn.ghost { border-color: transparent; background: transparent; color: #aeb2c0; }
            .btn.small { min-height: 28px; padding: 5px 8px; font-size: 11px; }
            .btn.icon { width: 33px; padding: 5px; border-color: transparent; background: transparent; }
            .btn.icon:hover, .btn.icon:focus-visible { border-color: transparent; background: rgba(147,131,255,.13); color: #eeeaff; }
            .btn:disabled { opacity: .45; cursor: not-allowed; }
            .icon-action { display: inline-grid; place-items: center; flex: 0 0 auto; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 11px; outline: 0; background: transparent; color: #aaa7b6; cursor: pointer; font: 750 18px/1 system-ui, sans-serif; transition: background .15s ease, color .15s ease, transform .15s ease; }
            .icon-action:hover, .icon-action:focus-visible { background: rgba(147,131,255,.13); color: #eeeaff; }
            .icon-action:active { transform: scale(.94); }
            .icon-action.small { width: 30px; height: 30px; font-size: 15px; }
            .icon-action:disabled { opacity: .38; cursor: not-allowed; transform: none; }

            .target-bar { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 9px; margin-bottom: 13px; padding: 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 11px; background: #171a23; }
            .field label { display: block; margin-bottom: 5px; color: #a5a9b8; font-size: 11px; font-weight: 700; }
            .field input, .field textarea, .field select { width: 100%; border: 1px solid rgba(255,255,255,.13); border-radius: 8px; outline: none; background: #0d0f15; color: #f1f2f6; padding: 8px 9px; }
            .field textarea { min-height: 112px; resize: vertical; line-height: 1.45; }
            .field input:focus, .field textarea:focus, .field select:focus { border-color: #7565ff; box-shadow: 0 0 0 3px rgba(117,101,255,.13); }
            .field-help { margin-top: 4px; color: #7f8493; font-size: 10px; }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 11px; }
            .form-grid > * { min-width: 0; }
            .form-grid .wide { grid-column: 1 / -1; }
            .check-row { display: flex; align-items: center; gap: 8px; color: #c5c8d2; }

            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
            .card { min-width: 0; padding: 11px; border: 1px solid rgba(255,255,255,.085); border-radius: 11px; background: #171a23; content-visibility: auto; contain-intrinsic-size: 170px; }
            .card:hover { border-color: rgba(122,105,255,.38); }
            .card.selectable { position: relative; cursor: pointer; user-select: none; }
            .card.selected { border-color: #7769ff; box-shadow: 0 0 0 2px rgba(119,105,255,.2); }
            .card-head { display: flex; align-items: flex-start; gap: 8px; }
            .card-title-wrap { min-width: 0; flex: 1; }
            .card-title-line { display:flex; align-items:center; gap:7px; min-width:0; }
            .card-title-line .variant-badge { flex:0 0 auto; margin-left:0; }
            .card-title { min-width:0; flex:1 1 auto; overflow: hidden; font-weight: 760; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
            .card-meta { margin-top: 3px; color: #898e9e; font-size: 10px; }
            .star { flex: 0 0 auto; border: 0; background: transparent; color: #626777; cursor: pointer; font-size: 18px; line-height: 1; }
            .star.on { color: #ffd66b; }
            .card-top-actions { display:flex; align-items:center; gap:2px; flex:0 0 auto; }
            .card-menu-dots { width:30px; height:30px; font-size:18px; }
            .preview { display: -webkit-box; overflow: hidden; margin-top: 8px; color: #b9bdc8; font-size: 11px; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
            .preview.negative { color: #d1aeb3; }
            .card-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
            .card-facts { display:grid; gap:5px; margin-top:10px; }
            .card-fact-row { display:flex; align-items:center; flex-wrap:wrap; gap:6px; min-width:0; color:#aeb2c0; font-size:10px; }
            .card-fact { display:inline-flex; align-items:center; min-width:0; max-width:100%; padding:3px 7px; border-radius:999px; background:rgba(255,255,255,.055); color:#bdc1ce; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .card-fact.accent { background:rgba(118,101,255,.16); color:#d7d0ff; }
            .card-fact.warn { background:rgba(255,184,77,.13); color:#ffd89b; }
            .card-fact.error { background:rgba(255,102,117,.13); color:#ffc0c7; }
            .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
            .chip { max-width: 100%; padding: 3px 7px; border-radius: 999px; background: #242938; color: #bdc1ce; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .chip.pos { background: rgba(73,151,255,.12); color: #a8cdfd; }
            .chip.neg { background: rgba(255,105,120,.11); color: #ffc0c7; }
            .chip.import { background: rgba(162,111,255,.13); color: #d2b9ff; }

            .card-with-thumb { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; }
            .card-media { display:flex; flex-direction:column; align-items:center; gap:6px; min-width:0; }
            .card-variant-navigation { display:grid; grid-template-columns:26px auto 26px; align-items:center; gap:5px; color:#aaaec0; font-size:9px; }
            .card-variant-arrow { display:grid; place-items:center; width:26px; height:26px; padding:0; border:0; border-radius:999px; background:#7769ff; color:#fff; cursor:pointer; font-weight:850; box-shadow:0 4px 12px rgba(70,54,190,.24); }
            .card-variant-arrow:hover, .card-variant-arrow:focus-visible { background:#8a7dff; outline:2px solid rgba(151,137,255,.28); }
            .thumb-frame { display: grid; place-items: center; flex: 0 0 auto; overflow: hidden; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: #0d0f15; }
            .thumb-frame.small { width: 62px; height: 62px; }
            .thumb-frame.medium { width: 92px; height: 92px; }
            .thumb-frame.detail { width: min(310px, 100%); height: 250px; margin: 0 auto 14px; }
            .thumb-frame img { grid-area: 1 / 1; display: block; width: 100%; height: 100%; object-fit: contain; }
            .thumb-placeholder { grid-area: 1 / 1; color: #666c7d; font-size: 10px; text-align: center; }

            .selection-check { display: grid; place-items: center; width: 24px; height: 24px; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.2); border-radius: 6px; background: #0e1016; color: transparent; cursor: pointer; }
            .selection-check.on { border-color: #7b6dff; background: #6859e9; color: #fff; }
            .selection-bar { position: sticky; top: -14px; z-index: 12; display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin: -14px -14px 13px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.12); background: rgba(23,26,35,.97); box-shadow: 0 7px 22px rgba(0,0,0,.25); }
            .selection-bar .selection-count { margin-right: auto; font-weight: 750; }

            .menu-wrap { position: relative; flex: 0 0 auto; }
            #ainz-menu-layer { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; }
            .overflow-menu { position: fixed; z-index: 2147483647; min-width: 205px; max-width: min(290px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 5px; border: 1px solid rgba(255,255,255,.13); border-radius: 9px; background: #232735; box-shadow: 0 15px 42px rgba(0,0,0,.55); pointer-events: auto; }
            .overflow-menu[hidden] { display: none !important; }
            .menu-item { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 9px; border: 0; border-radius: 6px; background: transparent; color: #edf0f7; cursor: pointer; text-align: left; }
            .menu-item:hover { background: rgba(255,255,255,.08); }
            .menu-item.danger { color: #ffb4bd; }

            .smart-toolbar { display: flex; align-items: end; flex-wrap: wrap; gap: 9px; margin-bottom: 13px; }
            .smart-toolbar .field { min-width: 190px; }
            .detail-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(240px,.65fr); gap: 14px; }
            .detail-meta { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 7px 12px; margin: 0; }
            .detail-meta dt { color: #858a9a; }
            .detail-meta dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
            .source-row { padding: 9px; border: 1px solid rgba(255,255,255,.08); border-radius: 9px; background: rgba(255,255,255,.035); }
            .source-row + .source-row { margin-top: 7px; }
            .duplicate-images { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .duplicate-images .thumb-frame { width: 100%; height: clamp(280px, 48vh, 560px); }
            .duplicate-images .thumb-frame img { width:auto!important; height:auto!important; max-width:100%!important; max-height:100%!important; object-fit:contain!important; }
            .detail-image { position: relative; display: grid; place-items: center; width: 100%; min-height: 280px; max-height: 58vh; overflow: hidden; margin-bottom: 13px; border: 1px solid rgba(255,255,255,.09); border-radius: 12px; background: radial-gradient(circle at 50% 30%, #1c2230, #0b0d13 72%); }
            .detail-image img { display: block; width: 100%; height: 100%; max-height: 58vh; object-fit: contain; }
            .variant-strip { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin: 0 0 12px; padding: 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; background: #131721; }
            .variant-strip .variant-position { min-width: 72px; color: #9da3b4; text-align: center; font-size: 11px; }
            .variant-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 2px 7px; border-radius: 999px; background: rgba(118,101,255,.17); color: #c8c0ff; font-size: 10px; }
            .compare-stage { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 11px; }
            .compare-stage.overlay { display: grid; grid-template-columns: 1fr; }
            .compare-pane { position: relative; display: grid; place-items: center; min-height: 340px; height:min(58vh,680px); overflow: hidden; border: 1px solid rgba(255,255,255,.09); border-radius: 11px; background: #0c0e14; }
            .compare-pane img { grid-area: 1/1; display:block; width:auto!important; height:auto!important; max-width:100%!important; max-height:100%!important; object-fit:contain!important; }
            .tag-browser { display: grid; grid-template-columns: minmax(220px,.72fr) minmax(0,1.28fr); gap: 12px; min-height: 0; }
            .tag-list-panel { min-height: 420px; max-height: calc(100vh - 245px); overflow: auto; }
            .tag-results-panel { min-width: 0; min-height: 420px; align-self: stretch; }
            .tag-results-panel .thumb-frame.small { width: 92px; height: 92px; }
            .tag-results-panel .thumb-frame.medium { width: 118px; height: 118px; }
            .tag-results-panel .preview { -webkit-line-clamp: 2; }
            .tag-index-row { width: 100%; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 8px 9px; border: 0; border-radius: 7px; background: transparent; color: #d8dbe5; cursor: pointer; text-align: left; }
            .tag-index-row:hover, .tag-index-row.active { background: rgba(119,105,255,.14); color: #fff; }
            .tag-index-row > span:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .tag-count { padding: 2px 7px; border-radius: 999px; background: #252a39; color: #aeb4c4; font-size: 10px; }
            .import-summary { display: grid; grid-template-columns: repeat(auto-fit,minmax(125px,1fr)); gap: 7px; margin: 10px 0 13px; }
            .import-summary .summary-card { padding: 9px; border: 1px solid rgba(255,255,255,.08); border-radius: 9px; background: rgba(255,255,255,.035); }
            .summary-value { font-size: 18px; font-weight: 800; }
            .summary-label { color: #9298a9; font-size: 10px; }
            .diagnostic-row { padding: 7px 0; border-top: 1px solid rgba(255,255,255,.07); }
            .storage-meter { height: 8px; overflow: hidden; margin: 9px 0; border-radius: 999px; background: #0e1016; }
            .storage-meter > span { display: block; height: 100%; width: 100%; background: linear-gradient(90deg,#6558e6,#4ca7ff); }

            .quick-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(260px, .65fr); gap: 12px; }
            .box { padding: 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 11px; background: #171a23; }
            .box + .box { margin-top: 10px; }
            .box-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; font-weight: 760; }
            .empty { padding: 25px 12px; border: 1px dashed rgba(255,255,255,.13); border-radius: 10px; color: #858a9a; text-align: center; }
            .list { display: flex; flex-direction: column; gap: 7px; }
            .list-row { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 8px; background: rgba(255,255,255,.035); }
            .list-row:hover { background: rgba(255,255,255,.06); }
            .list-name { overflow: hidden; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
            .list-meta { color: #858a99; font-size: 10px; }

            .history-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 10px; border-bottom: 1px solid rgba(255,255,255,.07); }
            .history-time { color: #838898; font-size: 10px; white-space: nowrap; }
            .history-title { font-weight: 700; }
            .history-preview { margin-top: 4px; color: #aeb2bf; font-size: 11px; overflow-wrap: anywhere; }

            .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
            .sidebar-setting-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:3px 12px; margin-top:9px; }
            .setting { padding: 11px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; background: #171a23; }
            .setting h4 { margin: 0 0 8px; font-size: 13px; }
            .setting p { margin: 5px 0; color: #9196a6; font-size: 11px; }

            .modal-backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 22px; background: rgba(3,4,8,.72); backdrop-filter: blur(4px); }
            .modal { width: min(760px, 100%); max-height: min(86vh, 850px); overflow: hidden; display: grid; grid-template-rows: auto minmax(0,1fr) auto; border: 1px solid rgba(255,255,255,.14); border-radius: 15px; background: #151821; color: #eef0f6; box-shadow: 0 30px 100px rgba(0,0,0,.72); font: 13px/1.45 system-ui, sans-serif; }
            .modal.large { width: min(1000px, 100%); }
            .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 15px; border-bottom: 1px solid rgba(255,255,255,.09); }
            .modal-title { font-size: 16px; font-weight: 800; }
            .modal-body { min-height: 0; overflow-y: auto; padding: 14px 15px; }
            .modal-foot { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; padding: 11px 15px; border-top: 1px solid rgba(255,255,255,.09); }

            .booru-box { padding: 11px; border: 1px solid rgba(137,111,255,.25); border-radius: 11px; background: linear-gradient(135deg, rgba(102,83,232,.13), rgba(48,110,190,.08)); }
            .booru-stats { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
            .stat { padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.07); color: #c5c8d3; font-size: 10px; }
            .tag-group { margin: 0 0 11px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; }
            .tag-group-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; background: #1d202b; cursor: pointer; }
            .tag-grid { display: flex; flex-wrap: wrap; gap: 6px; padding: 9px; }
            .tag-toggle { border: 1px solid rgba(255,255,255,.1); border-radius: 999px; background: #242835; color: #b8bdc9; padding: 5px 8px; cursor: pointer; font-size: 11px; }
            .tag-toggle.selected { border-color: #6e83ff; background: rgba(94,105,238,.19); color: #fff; }
            .tag-toggle.filtered { border-color: rgba(255,112,125,.25); background: rgba(255,92,108,.08); color: #d99ea5; text-decoration: line-through; }
            .removed-box { margin-top: 11px; padding: 10px; border: 1px solid rgba(255,104,118,.18); border-radius: 9px; background: rgba(255,80,100,.06); color: #cf9da3; }

            .notice { margin-bottom: 11px; padding: 9px 10px; border: 1px solid rgba(91,160,255,.22); border-radius: 9px; background: rgba(71,135,235,.08); color: #b8d5ff; }
            .notice.warn { border-color: rgba(255,191,87,.25); background: rgba(255,180,67,.08); color: #ffd595; }
            .notice.error { border-color: rgba(255,101,117,.25); background: rgba(255,80,98,.08); color: #ffb2bb; }

            .toast { position: fixed; left: 50%; bottom: 24px; z-index: 2147483647; max-width: min(620px, calc(100vw - 32px)); padding: 10px 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; background: #090a0e; color: #fff; box-shadow: 0 12px 45px rgba(0,0,0,.5); font: 650 13px/1.35 system-ui, sans-serif; opacity: 0; pointer-events: none; transform: translate(-50%, 12px); transition: opacity .16s ease, transform .16s ease; }
            .toast.show { opacity: 1; transform: translate(-50%, 0); }
            .toast.show.has-action { pointer-events:auto; display:flex; align-items:center; gap:14px; }
            .toast-action { border:0; border-radius:7px; padding:5px 9px; background:#6d5ce7; color:#fff; cursor:pointer; font:inherit; white-space:nowrap; }
            .toast.success { border-color: rgba(77,219,142,.35); }
            .toast.error { border-color: rgba(255,103,118,.4); }

            .booru-floating, .nai-quick-floating { position: fixed; right: 18px; bottom: 74px; z-index: 2147483645; display: flex; gap: 7px; }
            .booru-mini { border: 1px solid rgba(255,255,255,.16); border-radius: 10px; background: #242838; color: #fff; padding: 8px 10px; box-shadow: 0 8px 28px rgba(0,0,0,.35); cursor: pointer; font: 700 12px/1.2 system-ui, sans-serif; }

            .ainz-inline-add { display: inline-grid !important; place-items: center !important; width: 17px !important; height: 17px !important; margin-left: 4px !important; padding: 0 !important; border: 1px solid rgba(115,96,255,.48) !important; border-radius: 50% !important; background: rgba(96,78,225,.16) !important; color: #8e80ff !important; font: 800 12px/1 system-ui, sans-serif !important; cursor: pointer !important; vertical-align: middle !important; }
            .ainz-inline-add:hover { background: rgba(96,78,225,.35) !important; color: #fff !important; }
            .image-state-badge { position:absolute; right:7px; bottom:7px; z-index:2; padding:3px 6px; border:1px solid rgba(255,255,255,.18); border-radius:999px; background:rgba(9,10,14,.88); color:#ffd48c; font:800 9px/1 system-ui,sans-serif; letter-spacing:.04em; }
            .thumb-frame, .detail-image, .compare-pane { position:relative; }

            /* v2.9 Material dark surface system */
            #mount { --accent:#9383ff; --accent-soft:rgba(147,131,255,.16); --surface:#101116; --surface-1:#17181f; --surface-2:#202129; --surface-3:#292a34; --outline:rgba(231,225,255,.12); --text:#f0edf6; --muted:#aaa6b5; --danger:#ffb4ab; color-scheme:dark; }
            #mount.accent-blue { --accent:#8bc5ff; --accent-soft:rgba(90,164,236,.17); }
            #mount.accent-cyan { --accent:#72d9f4; --accent-soft:rgba(70,190,222,.17); }
            #mount.accent-teal { --accent:#74d7c4; --accent-soft:rgba(76,187,164,.16); }
            #mount.accent-emerald { --accent:#78dfa5; --accent-soft:rgba(72,190,124,.16); }
            #mount.accent-amber { --accent:#f2cf72; --accent-soft:rgba(215,166,53,.17); }
            #mount.accent-orange { --accent:#ffad72; --accent-soft:rgba(224,120,51,.17); }
            #mount.accent-rose { --accent:#ffafcf; --accent-soft:rgba(225,94,151,.16); }
            #mount.accent-red { --accent:#ff908f; --accent-soft:rgba(224,76,75,.17); }
            @media (prefers-reduced-motion: reduce) {
                #mount *, #mount *::before, #mount *::after { transition-duration:.01ms !important; animation-duration:.01ms !important; }
            }
            #mount .ainz-panel { width:min(1220px,calc(100vw - 36px)); height:min(860px,calc(100vh - 98px)); border-color:var(--outline); border-radius:28px; background:var(--surface); color:var(--text); box-shadow:0 24px 90px rgba(0,0,0,.65); }
            #mount .ainz-panel.full { inset:12px; width:auto; height:auto; }
            #mount .topbar { min-height:68px; padding:12px 18px; background:rgba(26,27,34,.97); border-color:var(--outline); }
            #mount .brand-badge { border-radius:14px; background:var(--accent); color:#16131d; }
            #mount .layout { grid-template-columns:210px minmax(0,1fr); }
            #mount .sidebar { display:flex; flex-direction:column; padding:14px 10px; background:#15161c; border-color:var(--outline); }
            #mount .sidebar-brand { padding:4px 13px 10px; color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.14em; }
            #mount .sidebar-spacer { flex:1; min-height:14px; }
            #mount .sidebar-utility { display:grid; grid-template-columns:1fr 1fr; gap:4px; }
            #mount .sidebar-utility .nav { justify-content:center; padding-inline:5px; }
            #mount .nav { min-height:42px; padding:10px 13px; border-radius:999px; color:var(--muted); transition:background .18s ease,color .18s ease,transform .18s ease; }
            #mount .nav:hover { background:var(--surface-2); transform:translateX(2px); }
            #mount .nav.active { background:var(--accent-soft); color:var(--text); box-shadow:none; }
            #mount .nav-icon { width:20px; color:var(--accent); text-align:center; }
            #mount .content { padding:22px 24px 28px; }
            #mount .section-title { font-size:26px; letter-spacing:-.025em; }
            #mount .section-subtitle { color:var(--muted); font-size:12px; }
            #mount .btn { min-height:38px; padding:8px 14px; border-color:var(--outline); border-radius:999px; background:var(--surface-2); color:var(--text); }
            #mount .btn:hover { background:var(--surface-3); }
            #mount .btn.primary { border-color:transparent; background:var(--accent); color:#19151f; }
            #mount .btn.ghost { background:transparent; }
            #mount .btn.icon { min-height:36px; width:36px; padding:0; border:0; border-radius:12px; background:transparent; box-shadow:none; }
            #mount .btn.icon:hover, #mount .btn.icon:focus-visible { border:0; background:var(--accent-soft); color:var(--text); }
            #mount .icon-action { color:var(--muted); }
            #mount .icon-action:hover, #mount .icon-action:focus-visible { background:var(--accent-soft); color:var(--text); }
            #mount .field input, #mount .field textarea, #mount .field select, #mount .search-wrap input { min-height:44px; border-color:var(--outline); border-radius:13px; background:#111218; color:var(--text); }
            #mount .field input:focus, #mount .field textarea:focus, #mount .field select:focus, #mount .search-wrap input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
            #mount .box, #mount .setting, #mount .card, #mount .filter-panel { border-color:var(--outline); border-radius:20px; background:var(--surface-1); }
            #mount .grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
            #mount.card-layout-list .grid { grid-template-columns:1fr; }
            #mount .card { padding:14px; transition:transform .18s ease,border-color .18s ease,background .18s ease; }
            #mount .imported-card { min-height:176px; display:flex; flex-direction:column; }
            #mount .imported-card > .card-with-thumb { flex:1; min-height:0; }
            #mount .card.compact .preview { margin-top:5px; -webkit-line-clamp:1; }
            #mount .card.compact .card-actions { margin-top:7px; }
            #mount .card:hover { transform:translateY(-2px); border-color:color-mix(in srgb,var(--accent) 45%,transparent); background:#1b1c24; }
            #mount .chip { background:var(--surface-3); }
            #mount .modal-backdrop { backdrop-filter:blur(10px); background:rgba(4,5,9,.76); }
            #mount .modal { max-height:92vh; border-color:var(--outline); border-radius:26px; background:var(--surface-1); color:var(--text); }
            #mount .modal.large { width:min(1420px,calc(100vw - 40px)); height:min(900px,calc(100vh - 40px)); }
            #mount .modal.no-foot { grid-template-rows:auto minmax(0,1fr); }
            #mount .modal-head, #mount .modal-foot { padding:15px 20px; border-color:var(--outline); }
            #mount .modal-title { font-size:20px; letter-spacing:-.02em; }
            #mount .overflow-menu { border-color:var(--outline); border-radius:16px; background:var(--surface-3); }
            #mount .menu-item { min-height:40px; border-radius:11px; }
            #mount .settings-shell { display:grid; grid-template-columns:190px minmax(0,1fr); gap:18px; min-height:560px; }
            #mount .settings-nav { display:flex; flex-direction:column; gap:4px; padding:8px; border:1px solid var(--outline); border-radius:22px; background:var(--surface-1); align-self:start; position:sticky; top:0; }
            #mount .settings-nav button { min-height:42px; padding:9px 13px; border:0; border-radius:999px; background:transparent; color:var(--muted); text-align:left; cursor:pointer; }
            #mount .settings-nav button.active { background:var(--accent-soft); color:var(--text); }
            #mount .settings-page-head h3 { margin:0; font-size:22px; }
            #mount .settings-page-head p { margin:4px 0 16px; color:var(--muted); }
            #mount .setting.wide { grid-column:1/-1; }
            #mount .settings-grid > .setting { min-width:0; }
            #mount .setting > .field + .field, #mount .setting > .check-row + .field, #mount .setting > .field + .check-row { margin-top:10px; }
            #mount .setting .form-grid > .field, #mount .setting .form-grid > .check-row { margin-top:0; }
            #mount .sidebar-order-list { display:flex; flex-direction:column; gap:5px; }
            #mount .sidebar-order-row { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:43px; padding:5px 7px 5px 11px; border:1px solid var(--outline); border-radius:14px; background:#121319; }
            #mount .choice-row { display:flex; flex-wrap:wrap; gap:9px; }
            #mount .color-choice { display:flex; align-items:center; gap:6px; color:var(--muted); text-transform:capitalize; cursor:pointer; }
            #mount .color-choice input { position:absolute; opacity:0; }
            #mount .color-choice span { width:24px; height:24px; border:2px solid transparent; border-radius:50%; background:#9383ff; }
            #mount .color-choice.blue span { background:#8bc5ff; }
            #mount .color-choice.cyan span { background:#72d9f4; }
            #mount .color-choice.teal span { background:#74d7c4; }
            #mount .color-choice.emerald span { background:#78dfa5; }
            #mount .color-choice.amber span { background:#f2cf72; }
            #mount .color-choice.orange span { background:#ffad72; }
            #mount .color-choice.rose span { background:#ffafcf; }
            #mount .color-choice.red span { background:#ff908f; }
            #mount .color-choice input:checked + span { outline:2px solid var(--text); outline-offset:2px; }
            #mount .collection-toolbar { display:flex; align-items:end; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
            #mount .collection-toolbar .inline { min-width:175px; }
            #mount .local-view-search { min-width:min(320px,100%); margin-left:auto; }
            #mount .result-count { color:var(--muted); white-space:nowrap; }
            #mount .filter-panel { margin-bottom:16px; padding:16px; border:1px solid var(--outline); }
            #mount .import-filter-grid { grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
            #mount .filter-actions { margin-top:12px; }
            #mount .collection-grid, #mount .folder-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
            #mount .collection-card { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; border:1px solid var(--outline); border-radius:20px; background:var(--surface-1); }
            #mount .collection-open, #mount .folder-card, #mount .picker-row { display:flex; align-items:center; gap:12px; width:100%; padding:16px; border:0; background:transparent; color:var(--text); text-align:left; cursor:pointer; }
            #mount .collection-open small, #mount .folder-card small, #mount .picker-row small { display:block; margin-top:3px; color:var(--muted); }
            #mount .collection-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:14px; background:var(--accent-soft); color:var(--accent); font-size:20px; }
            #mount .folder-card { display:grid; grid-template-columns:auto minmax(0,1fr); border:1px solid var(--outline); border-radius:18px; background:var(--surface-1); }
            #mount .folder-card small { grid-column:2; }
            #mount .breadcrumbs { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:12px; color:var(--muted); }
            #mount .breadcrumbs button { border:0; background:transparent; color:var(--accent); cursor:pointer; }
            #mount .grouped-section + .grouped-section { margin-top:14px; }
            #mount .collection-editor { width:min(900px,100%); }
            #mount .collection-editor { grid-template-rows:auto minmax(0,1fr); }
            #mount .collection-editor > form { min-height:0; overflow:hidden; display:grid; grid-template-rows:minmax(0,1fr) auto; }
            #mount .editor-section { margin-top:14px; }
            #mount .rule-row { display:grid; grid-template-columns:minmax(130px,.8fr) minmax(145px,.8fr) minmax(180px,1.4fr); gap:8px; margin-top:8px; }
            #mount .rule-row input, #mount .rule-row select { min-height:40px; border:1px solid var(--outline); border-radius:11px; background:#111218; color:var(--text); padding:7px 9px; }
            #mount .collection-type-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
            #mount .collection-type-option { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:start; gap:9px; padding:11px; border:1px solid var(--outline); border-radius:14px; background:#121319; cursor:pointer; }
            #mount .collection-type-option:has(input:checked) { border-color:var(--accent); background:var(--accent-soft); }
            #mount .collection-type-option input { margin-top:2px; accent-color:var(--accent); }
            #mount .collection-type-option small { display:block; margin-top:3px; color:var(--muted); line-height:1.35; }
            #mount .collection-smart-settings[hidden] { display:none !important; }
            #mount .collection-grouping summary { cursor:pointer; font-weight:750; }
            #mount .collection-grouping > p { margin:9px 0 12px; color:var(--muted); }
            #mount .collection-preview { margin-top:10px; color:var(--muted); }
            #mount .collection-preview strong { color:var(--accent); }
            #mount .compact-modal { width:min(560px,100%); }
            #mount .progress-track { height:10px; overflow:hidden; border-radius:999px; background:#0d0e13; }
            #mount .progress-track span { display:block; height:100%; background:var(--accent); transition:width .2s ease; }
            #mount .picker-row { border-bottom:1px solid var(--outline); }
            #mount .collection-entry-picker { width:min(760px,100%); }
            #mount .picker-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:7px; }
            #mount .picker-check { display:flex; align-items:flex-start; gap:10px; min-height:54px; padding:10px; border:1px solid var(--outline); border-radius:14px; background:#121319; cursor:pointer; }
            #mount .picker-check small { display:block; margin-top:3px; color:var(--muted); }
            #mount .rename-list { display:flex; flex-direction:column; gap:7px; }
            #mount .rename-row { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--outline); border-radius:14px; background:#121319; }
            #mount .rename-row span { min-width:0; overflow-wrap:anywhere; }
            #mount .rename-old { color:var(--muted); }
            #mount .rename-new { color:var(--text); font-weight:700; }
            #mount .health-group-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px; margin:13px 0 16px; }
            #mount .health-group { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:48px; padding:10px 13px; border:1px solid var(--outline); border-radius:15px; background:#121319; color:var(--text); cursor:pointer; text-align:left; }
            #mount .health-group:hover, #mount .health-group.active { border-color:color-mix(in srgb,var(--accent) 55%,var(--outline)); background:var(--accent-soft); }
            #mount .health-group strong { display:grid; place-items:center; min-width:27px; height:27px; padding:0 7px; border-radius:999px; background:var(--surface-3); color:var(--accent); }
            #mount .health-issue-list { display:flex; flex-direction:column; gap:7px; }
            #mount .health-issue-row { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:58px; padding:11px 13px; border:1px solid var(--outline); border-radius:15px; background:#121319; color:var(--text); cursor:pointer; text-align:left; }
            #mount .health-issue-row:hover { background:var(--surface-2); }
            #mount .health-issue-row.static { cursor:default; }
            #mount .health-issue-row small { display:block; margin-top:3px; color:var(--muted); }

            #mount .style-toolbar { display:flex; align-items:end; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
            #mount .segmented { display:inline-flex; gap:3px; padding:4px; border:1px solid var(--outline); border-radius:16px; background:#111218; }
            #mount .segmented button { min-height:36px; padding:7px 13px; border:0; border-radius:12px; background:transparent; color:var(--muted); cursor:pointer; font:inherit; font-weight:700; }
            #mount .segmented button.active { background:var(--accent-soft); color:var(--text); }
            #mount .style-profile-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
            #mount .style-image-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
            #mount .style-image-card { display:grid; grid-template-columns:132px minmax(0,1fr); gap:14px; height:188px; min-height:188px; padding:14px; overflow:hidden; cursor:pointer; }
            #mount .style-image-card-visual { position:relative; display:grid; place-items:center; min-width:0; overflow:hidden; border:1px solid var(--outline); border-radius:16px; background:#0d0e13; }
            #mount .style-image-card-visual img { width:100%; height:100%; object-fit:contain; }
            #mount .style-image-card-copy { min-width:0; display:flex; flex-direction:column; gap:7px; }
            #mount .style-image-card-copy .style-card-stats { margin-top:auto; }
            #mount .style-profile-card { display:grid; grid-template-columns:132px minmax(0,1fr); gap:14px; height:188px; min-height:188px; padding:14px; overflow:visible; }
            #mount .style-cover { position:relative; display:grid; place-items:center; min-width:0; overflow:hidden; border:1px solid var(--outline); border-radius:16px; background:#0d0e13; }
            #mount .style-cover img { display:block; width:100%; height:100%; object-fit:contain; }
            #mount .style-card-copy { min-width:0; display:flex; flex-direction:column; gap:7px; }
            #mount .style-card-copy .card-title { flex:1; }
            #mount .style-card-stats { display:flex; align-items:flex-start; align-content:flex-start; flex-wrap:wrap; gap:6px; margin-top:auto; }
            #mount .style-reference-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
            #mount .style-reference-tile { position:relative; min-width:0; overflow:hidden; border:1px solid var(--outline); border-radius:18px; background:#121319; }
            #mount .style-reference-open { display:block; width:100%; padding:0; border:0; background:transparent; color:var(--text); cursor:pointer; text-align:left; }
            #mount .style-reference-visual { position:relative; display:grid; place-items:center; height:190px; overflow:hidden; background:#0c0e14; }
            #mount .style-reference-visual img { width:100%; height:100%; object-fit:contain; }
            #mount .style-reference-name { display:block; overflow:hidden; padding:10px 12px; text-overflow:ellipsis; white-space:nowrap; font-weight:700; }
            #mount .style-cover-action { position:absolute; top:7px; right:7px; background:rgba(12,13,18,.78); }
            #mount .style-cover-action.active { color:var(--accent); }
            #mount .local-reference-label { position:absolute; left:8px; top:8px; padding:4px 7px; border-radius:999px; background:rgba(12,13,18,.82); color:var(--accent); font-size:10px; font-weight:800; }
            #mount .style-tag-family + .style-tag-family { margin-top:10px; }
            #mount .style-tag-collection-tools { position:sticky; top:-14px; z-index:3; display:grid; grid-template-columns:minmax(260px,1fr) auto; align-items:end; gap:12px; padding:8px 0 12px; background:var(--surface-1); }
            #mount .style-tag-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(245px,1fr)); gap:6px; }
            #mount .style-tag-row { display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0; min-height:52px; padding:9px 11px; border:0; border-radius:13px; background:#121319; color:var(--text); cursor:pointer; text-align:left; }
            #mount .style-tag-row:hover { background:var(--surface-2); }
            #mount .style-tag-row small { display:block; overflow:hidden; margin-top:2px; color:var(--muted); text-overflow:ellipsis; white-space:nowrap; }
            #mount .style-upload-layout, #mount .style-local-detail { display:grid; grid-template-columns:minmax(280px,.8fr) minmax(320px,1.2fr); gap:14px; }
            #mount .style-upload-preview { display:grid; place-items:center; min-height:360px; overflow:hidden; border:1px solid var(--outline); border-radius:18px; background:#0c0e14; }
            #mount .style-upload-preview img { max-width:100%; max-height:58vh; object-fit:contain; }
            #mount .style-upload-tag-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:6px; max-height:280px; overflow:auto; margin-top:10px; }
            #mount .style-local-detail .detail-image { height:min(68vh,720px); max-height:none; }
            #mount .style-image-detail-layout { display:grid; grid-template-columns:minmax(300px,.95fr) minmax(360px,1.05fr); gap:14px; min-height:0; height:100%; }
            #mount .style-image-detail-visual { position:relative; display:grid; place-items:center; min-height:0; overflow:hidden; border:1px solid var(--outline); border-radius:18px; background:#0c0e14; }
            #mount .style-image-detail-visual img { display:block; width:100%; height:100%; max-height:calc(100vh - 170px); object-fit:contain; }
            #mount .style-image-data { min-height:0; overflow:auto; padding-right:3px; }
            #mount .style-image-global-actions { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:9px; padding:0 0 10px; background:var(--surface-1); }
            #mount .style-pill-mode { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:11px; font-weight:700; }
            #mount .segmented.compact { padding:3px; border-radius:13px; }
            #mount .segmented.compact button { min-height:30px; padding:5px 10px; border-radius:10px; font-size:11px; }
            #mount .style-image-category { padding:11px; border:1px solid var(--outline); border-radius:16px; background:#121319; }
            #mount .style-image-category + .style-image-category { margin-top:8px; }
            #mount .style-image-sources { margin-top:10px; }
            #mount .style-tag-image-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:10px; }
            #mount .style-tag-image-card { min-width:0; overflow:hidden; padding:0; border:1px solid var(--outline); border-radius:16px; background:#121319; color:var(--text); cursor:pointer; text-align:left; }
            #mount .style-tag-image-card > span { position:relative; display:grid; place-items:center; aspect-ratio:1; overflow:hidden; background:#0c0e14; }
            #mount .style-tag-image-card img { width:100%; height:100%; object-fit:contain; }
            #mount .style-tag-image-card strong { display:block; overflow:hidden; padding:9px 11px; text-overflow:ellipsis; white-space:nowrap; }
            #mount .full-image-detail-modal { width:min(1040px,calc(100vw - 40px)); max-height:min(820px,calc(100vh - 40px)); }
            #mount .full-image-detail-modal .modal-body { overflow:auto; }
            #mount .full-image-base-grid, #mount .full-image-character-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
            #mount .full-image-character-grid { margin-top:10px; }
            #mount .full-image-character { min-width:0; padding:13px; border:1px solid var(--outline); border-radius:16px; background:#121319; }
            #mount .full-image-character p { max-height:150px; overflow:auto; margin:8px 0 0; color:#d5d1df; line-height:1.45; white-space:pre-wrap; overflow-wrap:anywhere; }
            #mount .prompt-pair { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            #mount .prompt-pair strong { color:var(--muted); font-size:11px; }
            #mount .grid-imported .imported-card { height:196px; min-height:196px; }
            #mount .grid-characters .card { min-height:188px; }
            #mount .grid-bases .card, #mount .grid-full-images .card { min-height:176px; }
            #mount .tag-image-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-top:12px; }
            #mount .tag-image-card { display:block; aspect-ratio:1; height:auto; min-height:0; padding:8px; overflow:hidden; cursor:pointer; }
            #mount .tag-image-card .thumb-frame { width:100%; height:100%; border:0; background:#0c0e14; }
            #mount .tag-image-card .thumb-frame img { width:100%; height:100%; object-fit:contain; }

            #mount .modal.item-detail-modal .modal-body { overflow:hidden; padding:14px 18px 18px; }
            #mount .item-detail-modal .modal-title { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
            #mount .detail-workspace { display:grid; grid-template-columns:minmax(320px,1.15fr) minmax(260px,.85fr) minmax(260px,.75fr); gap:14px; height:100%; min-height:0; }
            #mount .detail-pane { min-width:0; min-height:0; overflow:auto; padding:12px; border:1px solid var(--outline); border-radius:18px; background:#121319; }
            #mount .detail-pane.visual { display:grid; grid-template-rows:auto minmax(0,1fr); }
            #mount .detail-pane .detail-image { min-height:0; height:100%; max-height:none; margin:0; }
            #mount .detail-pane .detail-image img { max-height:none; }
            #mount .detail-tags { white-space:pre-wrap; overflow-wrap:anywhere; color:#d5d1df; line-height:1.55; }
            #mount .variant-tag-toolbar { position:sticky; top:-12px; z-index:2; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:8px 0 10px; background:#121319; }
            #mount .variant-tag-groups { display:flex; flex-direction:column; gap:8px; }
            #mount .variant-tag-section { padding:10px; border:1px solid var(--outline); border-radius:15px; background:#17181f; }
            #mount .variant-tag-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; font-weight:750; }
            #mount .variant-tag-pills { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
            #mount .tag-pill { max-width:100%; padding:6px 9px; border:1px solid transparent; border-radius:999px; background:var(--surface-3); color:#d9d6e2; cursor:pointer; font:inherit; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #mount .tag-pill:hover, #mount .tag-pill:focus-visible { border-color:color-mix(in srgb,var(--accent) 55%,transparent); background:var(--accent-soft); color:var(--text); outline:0; }

            /* v3.3 focused interaction refinements */
            #mount .check-row { position:relative; min-height:34px; padding:6px 8px; border-radius:11px; cursor:pointer; user-select:none; }
            #mount .check-row:hover { background:rgba(255,255,255,.035); }
            #mount .check-row input[type="checkbox"], #mount .compact-check input[type="checkbox"] { appearance:none !important; -webkit-appearance:none !important; box-sizing:border-box !important; flex:0 0 16px !important; width:16px !important; height:16px !important; min-width:16px !important; min-height:16px !important; max-width:16px !important; max-height:16px !important; margin:0 !important; padding:0 !important; border:1px solid rgba(255,255,255,.32); border-radius:4px; background:#0d0e13; display:inline-grid !important; place-items:center; align-self:center; line-height:1 !important; cursor:pointer; }
            #mount .check-row input[type="checkbox"]::after, #mount .compact-check input[type="checkbox"]::after { content:'✓'; color:#17131e; font:900 11px/1 system-ui,sans-serif; transform:scale(0); transition:transform .12s ease; }
            #mount .check-row input[type="checkbox"]:checked, #mount .compact-check input[type="checkbox"]:checked { border-color:var(--accent); background:var(--accent); }
            #mount .check-row input[type="checkbox"]:checked::after, #mount .compact-check input[type="checkbox"]:checked::after { transform:scale(1); }
            #mount .booru-profile-controls { align-items:start; }
            #mount .booru-profile-controls > .field { align-self:start; }
            #mount .booru-profile-option .check-row { margin-top:0; }
            #mount .booru-profile-grid { display:flex; flex-direction:column; gap:5px; }
            #mount .booru-profile-row { display:grid; grid-template-columns:minmax(130px,1fr) minmax(94px,.55fr) minmax(94px,.55fr); align-items:center; gap:8px; min-height:40px; padding:4px 7px 4px 11px; border:1px solid var(--outline); border-radius:12px; background:#121319; }
            #mount .compact-check { display:inline-flex; align-items:center; justify-content:flex-start; gap:7px; min-width:0; min-height:31px; padding:5px 7px; border-radius:9px; color:var(--muted); cursor:pointer; }
            #mount .compact-check:hover { background:var(--surface-2); color:var(--text); }
            #mount .grid-imported { align-items:stretch; grid-auto-rows:196px; }
            #mount .grid-imported .imported-card { height:196px; min-height:196px; overflow:visible; }
            #mount .imported-card .card-with-thumb { height:100%; }
            #mount .imported-card .card-with-thumb > div:last-child { min-width:0; min-height:0; display:flex; flex-direction:column; }
            #mount .imported-card .card-facts { margin-top:9px; }
            #mount .imported-card-actions { margin-top:auto; padding-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px; }
            #mount .imported-card-actions .btn { width:100%; }
            #mount .tag-browser { height:calc(100vh - 190px); max-height:700px; overflow:hidden; align-items:stretch; }
            #mount .tag-list-panel { min-height:0; max-height:none; overflow:hidden; padding:0; display:grid; grid-template-rows:auto minmax(0,1fr); }
            #mount .tag-list-search { position:relative; z-index:3; margin:0; padding:13px 13px 10px; border-bottom:1px solid var(--outline); background:var(--surface-1); }
            #mount .tag-list-scroll { min-height:0; overflow:auto; padding:8px; overscroll-behavior:contain; }
            #mount .tag-results-panel { min-height:0; max-height:none; overflow:auto; overscroll-behavior:contain; scrollbar-width:none; }
            #mount .tag-results-panel::-webkit-scrollbar { width:0; height:0; }
            #mount .tag-results-empty { min-height:100%; display:grid; place-items:center; }
            #mount [data-tag-set-field][hidden] { display:none !important; }

            @media (max-width: 1040px) {
                #mount .grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #mount .style-profile-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #mount .style-image-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
            }

            @media (max-width: 720px) {
                .ainz-panel { right: 8px; bottom: 68px; width: calc(100vw - 16px); height: calc(100vh - 78px); }
                .layout { grid-template-columns: 58px minmax(0, 1fr); }
                .nav { justify-content: center; padding: 10px 4px; }
                .nav .label, .nav .n { display: none; }
                .topbar { grid-template-columns: auto 1fr auto; }
                .brand span:last-child { display: none; }
                .quick-grid, .form-grid, .target-bar, .detail-grid, .duplicate-images, .tag-browser, .compare-stage, #mount .settings-shell, #mount .detail-workspace { grid-template-columns: 1fr; }
                #mount .grid { grid-template-columns:1fr; }
                #mount .style-profile-grid, #mount .style-image-grid, #mount .style-upload-layout, #mount .style-local-detail, #mount .style-image-detail-layout, #mount .full-image-base-grid, #mount .full-image-character-grid, #mount .prompt-pair { grid-template-columns:1fr; }
                #mount .layout { grid-template-columns:64px minmax(0,1fr); }
                #mount .settings-nav { position:static; flex-direction:row; overflow:auto; }
                #mount .modal.item-detail-modal .modal-body { overflow:auto; }
                #mount .detail-workspace { height:auto; }
                .target-bar > .actions { align-self: end; }
                .duplicate-images .thumb-frame { height: 220px; }
            }
        `;
    }

    function installGlobalListeners() {
        root.addEventListener('click', onRootClick);
        root.addEventListener('input', onRootInput);
        root.addEventListener('change', onRootChange);
        root.addEventListener('submit', onRootSubmit);
        root.addEventListener('keydown', onRootKeydown);
        root.addEventListener('scroll', event => {
            if (event.target?.id === 'tag-list-scroll') state.tagScrollTop = event.target.scrollTop;
            if (event.target?.id === 'tag-results-panel') state.tagResultsScrollTop = event.target.scrollTop;
            if (openToolkitMenu && event.target !== openToolkitMenu.panel && !openToolkitMenu.panel.contains?.(event.target)) closeToolkitOverflowMenu();
            scheduleViewStatePersistence();
        }, true);
        root.addEventListener('pointerdown', onLauncherPointerDown);
        root.addEventListener('pointerdown', onCardPointerDown);
        root.addEventListener('pointerup', cancelCardLongPress);
        root.addEventListener('pointercancel', cancelCardLongPress);
        document.addEventListener('pointerup', cancelCardLongPress, true);
        document.addEventListener('pointercancel', cancelCardLongPress, true);
        document.addEventListener('pointermove', onLauncherPointerMove, true);
        document.addEventListener('pointerup', finishLauncherDrag, true);
        document.addEventListener('pointercancel', finishLauncherDrag, true);

        document.addEventListener('pointerdown', event => {
            if (!openToolkitMenu) return;
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (path.includes(openToolkitMenu.panel) || path.includes(openToolkitMenu.anchor)) return;
            closeToolkitOverflowMenu();
        }, true);
        window.addEventListener('resize', closeToolkitOverflowMenu);
        window.addEventListener('beforeunload', rememberCurrentViewState);

        document.addEventListener('pointerdown', event => {
            if (!data.settings.closeOnOutsideClick || !event.isTrusted || !state.open || state.modal || event.button !== 0) return;
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (path.includes(host) || path.includes(naiHeaderLauncher) || event.target === host || event.target === naiHeaderLauncher || host?.contains?.(event.target)) return;
            closeToolkitPanel();
        }, true);

        document.addEventListener('focusin', event => {
            if (IS_NAI && !naiImageRouteActive) return;
            if (isEditable(event.target)) {
                const info = registerEditable(event.target);
                state.focusedFieldId = info.id;
                if (info.polarity === 'negative') state.selectedNegativeFieldId = info.id;
                else state.selectedPositiveFieldId = info.id;
                if (info.scope === 'character') state.selectedCharacterIndex = String(info.characterIndex || '');
                saveUiPrefs();
            }
        }, true);

        document.addEventListener('keydown', event => {
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
                if (IS_NAI && !naiImageRouteActive) return;
                event.preventDefault();
                toggleToolkitPanel();
            }
            const keyTarget = typeof event.composedPath === 'function' ? event.composedPath()[0] : event.target;
            if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && undoRecord && !isTextInputTarget(keyTarget)) {
                event.preventDefault();
                void undoLastAction();
                return;
            }
            if (event.key === 'Escape' && openToolkitMenu) closeToolkitOverflowMenu();
            else if (event.key === 'Escape' && state.modal) closeModal();
            else if (event.key === 'Escape' && state.selectionMode) exitSelectionMode();
            else if (event.key === 'Escape' && state.open) {
                closeToolkitPanel();
            }
        }, true);
    }

    function onLauncherPointerDown(event) {
        const button = event.target.closest?.('.ainz-fab[data-launcher-floating="true"]');
        if (!button || !IS_NAI || event.button !== 0) return;
        const rect = button.getBoundingClientRect();
        launcherDragState = {
            pointerId: event.pointerId,
            button,
            startX: event.clientX,
            startY: event.clientY,
            startRight: Math.max(8, innerWidth - rect.right),
            startTop: Math.max(72, rect.top),
            right: Math.max(8, innerWidth - rect.right),
            top: Math.max(72, rect.top),
            moved: false
        };
    }

    function onLauncherPointerMove(event) {
        const drag = launcherDragState;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
        drag.moved = true;
        event.preventDefault();
        drag.right = Math.max(8, Math.min(innerWidth - 54, drag.startRight - deltaX));
        drag.top = Math.max(72, Math.min(innerHeight - 54, drag.startTop + deltaY));
        drag.button.style.right = `${drag.right}px`;
        drag.button.style.top = `${drag.top}px`;
        drag.button.style.bottom = 'auto';
        drag.button.style.transform = 'none';
    }

    function finishLauncherDrag(event) {
        const drag = launcherDragState;
        if (!drag || drag.pointerId !== event.pointerId) return;
        launcherDragState = null;
        if (!drag.moved) return;
        data.settings.naiFloatingButtonPosition = { right: Math.round(drag.right), top: Math.round(drag.top) };
        suppressLauncherClick = true;
        setTimeout(() => { suppressLauncherClick = false; }, 350);
        scheduleSave('Ainz Toolkit button position changed');
    }

    function findIntegrationObservationRoot() {
        if (IS_NAI) {
            return document.querySelector('.image-generation,.image-generation-interface,[class*="image-generation"],main')
                || document.querySelector('#app,#root') || document.body || document.documentElement;
        }
        return document.querySelector('#posts-container,#post-view,#tag-list,main') || document.body || document.documentElement;
    }

    function installMutationObserver() {
        integrationObserver?.disconnect?.();
        const target = findIntegrationObservationRoot();
        const observer = new MutationObserver(records => {
            if (!records.some(mutationMayAffectIntegration)) return;
            if (IS_NAI) mainPromptDescriptorCache = { positive: null, negative: null, route: location.href };
            clearTimeout(mutationTimer);
            mutationTimer = setTimeout(() => {
                const run = () => {
                    if (IS_NAI) {
                        refreshEditableFields();
                        installNaiFieldButtons();
                        syncNaiLauncher();
                    }
                    if (IS_BOORU) syncBooruPageEnhancements();
                };
                if ('requestIdleCallback' in globalThis) requestIdleCallback(run, { timeout: 700 });
                else setTimeout(run, 0);
            }, 180);
        });
        observer.observe(target, { childList: true, subtree: true });
        integrationObserver = observer;
    }

    function mutationMayAffectIntegration(record) {
        if (!record.addedNodes?.length && !record.removedNodes?.length) return false;
        const nodes = [...record.addedNodes, ...record.removedNodes].filter(node => node.nodeType === Node.ELEMENT_NODE);
        if (!nodes.length) return false;
        const selectors = IS_NAI
            ? '.character-prompt-input,.prompt-input-box-character-prompts-1,.prompt-input-box-character-prompts-2,.ainz-save-character-inline,[data-ainz-character-panel="true"],textarea,[contenteditable="true"],[role="textbox"]'
            : '#tag-list,.tag-list,a.search-tag,a[href*="tags="],a[href*="/posts?tags="],li[class*="tag-type-"],article.post-preview,.post-preview,.thumbnail-preview';
        return nodes.some(node => node.matches?.(selectors) || node.querySelector?.(selectors));
    }

    function installNavigationObserver() {
        let previousUrl = location.href;
        const check = () => {
            if (IS_NAI) {
                const changed = location.href !== previousUrl;
                if (changed) previousUrl = location.href;
                syncNaiRouteLifecycle();
                return;
            }
            if (location.href === previousUrl) return;
            previousUrl = location.href;
            state.booruPost = null;
            state.booruSelectedPosts.clear();
            state.booruSelectionMode = false;
            removeBooruToolbar();
            document.getElementById('ainz-booru-selection-bar')?.remove();
            removeBooruTagButtons();
            if (IS_BOORU) {
                syncBooruPageEnhancements();
                if (getPostId()) void loadBooruPost(false);
            }
        };
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            if (original?.__ainzWrapped) continue;
            const wrapped = function (...args) {
                const result = original.apply(this, args);
                queueMicrotask(check);
                return result;
            };
            wrapped.__ainzWrapped = true;
            history[method] = wrapped;
        }
        window.addEventListener('popstate', check);
        window.addEventListener('hashchange', check);
        if (globalThis.navigation?.addEventListener) globalThis.navigation.addEventListener('navigate', () => queueMicrotask(check));
        clearInterval(navigationSentinel);
        navigationSentinel = setInterval(() => { if (!document.hidden) check(); }, 1500);
        document.addEventListener('click', () => queueMicrotask(check), true);
        window.addEventListener('pageshow', check);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        window.addEventListener('beforeunload', () => clearInterval(navigationSentinel), { once: true });
    }

    function isNaiImageRoute() {
        if (!IS_NAI) return false;
        const path = String(location.pathname || '/').replace(/\/+$/, '') || '/';
        return path === '/image' || path.startsWith('/image/');
    }

    function syncNaiRouteLifecycle(force = false) {
        if (!IS_NAI) return;
        const active = isNaiImageRoute();
        if (!force && active === naiImageRouteActive) {
            if (active) {
                if (host) host.style.display = '';
                if (!integrationObserver) installMutationObserver();
                syncNaiLauncher();
            }
            return;
        }
        naiImageRouteActive = active;
        clearTimeout(mutationTimer);
        if (!active) {
            rememberCurrentViewState();
            state.open = false;
            state.modal = null;
            state.modalPayload = null;
            integrationObserver?.disconnect?.();
            integrationObserver = null;
            removeNaiFieldButtons();
            removeNaiHeaderLauncher();
            editableRegistry.clear();
            mainPromptDescriptorCache = { positive: null, negative: null, route: '' };
            if (host) host.style.display = 'none';
            refreshLauncherPresentation();
            return;
        }
        if (host) host.style.display = '';
        installMutationObserver();
        mainPromptDescriptorCache = { positive: null, negative: null, route: location.href };
        refreshEditableFields(true);
        installNaiFieldButtons();
        syncNaiLauncher();
        render();
    }

    function removeNaiFieldButtons() {
        document.querySelectorAll('.ainz-save-character-inline').forEach(button => button.remove());
    }

    function removeNaiHeaderLauncher() {
        const slot = naiHeaderLauncher?.closest?.('#ainz-nai-header-launcher-slot');
        if (slot) slot.remove(); else naiHeaderLauncher?.remove?.();
        naiHeaderLauncher = null;
    }

    function findNaiHeaderSlot() {
        const visibleTopButton = button => {
            if (!(button instanceof HTMLElement) || host?.contains?.(button)) return false;
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return rect.width >= 28 && rect.height >= 28 && rect.top >= -4 && rect.top < 110 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const candidates = [...document.querySelectorAll('button,[role="button"]')].filter(visibleTopButton);
        const semantic = candidates.find(button => {
            const label = [button.getAttribute('aria-label'), button.getAttribute('title'), buttonText(button)].filter(Boolean).join(' ').toLowerCase();
            return /(?:main |navigation )?menu|hamburger/.test(label);
        });
        const plus = candidates.find(button => {
            const label = [button.getAttribute('aria-label'), button.getAttribute('title'), buttonText(button)].filter(Boolean).join(' ').trim().toLowerCase();
            return label === '+' || /add anlas|buy anlas|add currency/.test(label);
        });
        const commonSlot = (menuButton, plusButton) => {
            if (!menuButton || !plusButton) return null;
            for (let parent = menuButton.parentElement, depth = 0; parent && depth < 8; parent = parent.parentElement, depth++) {
                if (!parent.contains(plusButton)) continue;
                let menuChild = menuButton;
                let plusChild = plusButton;
                while (menuChild.parentElement !== parent) menuChild = menuChild.parentElement;
                while (plusChild.parentElement !== parent) plusChild = plusChild.parentElement;
                if (menuChild === plusChild) continue;
                const children = [...parent.children];
                if (children.indexOf(plusChild) < children.indexOf(menuChild)) return { parent, before: menuChild, menuButton, plusButton };
            }
            return null;
        };
        const navbar = [...document.querySelectorAll('.image-gen-navbar,[class*="image-gen-navbar"]')].find(element => {
            const rect = element.getBoundingClientRect();
            return rect.width > 250 && rect.height > 35 && rect.top < 120;
        });
        if (navbar) {
            const navbarButtons = [...navbar.querySelectorAll('button,[role="button"]')].filter(visibleTopButton).sort((left,right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left);
            if (navbarButtons.length >= 2) {
                const menuButton = navbarButtons[navbarButtons.length - 1];
                const menuRect = menuButton.getBoundingClientRect();
                const plusButton = [...navbarButtons].reverse().find(button => {
                    if (button === menuButton) return false;
                    const rect = button.getBoundingClientRect();
                    return rect.right <= menuRect.left + 2 && menuRect.left - rect.right < 180;
                });
                const navbarSlot = commonSlot(menuButton, plusButton);
                if (navbarSlot) return navbarSlot;
                let menuBranch = menuButton;
                while (menuBranch.parentElement && menuBranch.parentElement !== navbar) menuBranch = menuBranch.parentElement;
                if (menuBranch.parentElement === navbar) return { parent:navbar, before:menuBranch, menuButton, plusButton };
            }
        }
        const slot = commonSlot(semantic, plus);
        if (slot) return slot;
        if (semantic?.parentElement) return { parent: semantic.parentElement, before: semantic, menuButton: semantic, plusButton: null };
        const anlas = [...document.querySelectorAll('button,div,span')].filter(element => {
            const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
            if (!/^anlas\s*:/i.test(text) || text.length > 40) return false;
            const rect = element.getBoundingClientRect();
            return rect.top >= -4 && rect.top < 110 && rect.width > 40;
        }).sort((a,b) => a.children.length - b.children.length)[0];
        let container = anlas;
        for (let depth = 0; container && depth < 7; depth++, container = container.parentElement) {
            const buttons = [...container.querySelectorAll(':scope > button,:scope > [role="button"],:scope > * > button')].filter(visibleTopButton);
            if (buttons.length >= 2 && buttons.length <= 8) {
                const menuButton = buttons[buttons.length - 1];
                return commonSlot(menuButton, buttons.find(button => buttonText(button).trim() === '+')) || { parent: menuButton.parentElement, before: menuButton, menuButton, plusButton: null };
            }
        }
        return null;
    }

    function syncNaiLauncher() {
        if (!IS_NAI || !naiImageRouteActive || data.settings.naiLauncherPosition !== 'header') {
            removeNaiHeaderLauncher();
            refreshLauncherPresentation();
            return false;
        }
        if (naiHeaderLauncher?.isConnected) {
            refreshLauncherPresentation();
            return true;
        }
        const slot = findNaiHeaderSlot();
        if (!slot?.parent || !slot?.before) {
            removeNaiHeaderLauncher();
            refreshLauncherPresentation();
            return false;
        }
        const wrapper = document.createElement('span');
        wrapper.id = 'ainz-nai-header-launcher-slot';
        wrapper.style.cssText = 'display:flex;align-self:stretch;align-items:center;justify-content:center;flex:0 0 48px;min-width:48px;height:auto;margin:0;padding:0;overflow:visible;';
        const button = document.createElement('button');
        button.id = 'ainz-nai-header-launcher';
        button.type = 'button';
        button.textContent = '✦';
        button.title = 'Ainz Toolkit';
        button.setAttribute('aria-label', 'Open Ainz Toolkit');
        button.style.cssText = 'display:inline-grid;place-items:center;flex:0 0 40px;width:40px;height:40px;margin:0;padding:0;border:0;border-radius:50%;background:#181a22;color:#ddd7ff;box-shadow:none;font:800 18px/1 system-ui,sans-serif;cursor:pointer;position:static;transform:none;';
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggleToolkitPanel(); });
        button.addEventListener('mouseenter', () => { button.style.background = 'rgba(147,131,255,.18)'; });
        button.addEventListener('mouseleave', refreshLauncherPresentation);
        wrapper.appendChild(button);
        slot.parent.insertBefore(wrapper, slot.before);
        naiHeaderLauncher = button;
        refreshLauncherPresentation();
        return true;
    }

    function refreshLauncherPresentation() {
        const shadowLauncher = root?.querySelector?.('.ainz-fab');
        const headerAvailable = Boolean(naiHeaderLauncher?.isConnected && data.settings.naiLauncherPosition === 'header');
        if (shadowLauncher && IS_NAI) shadowLauncher.hidden = headerAvailable;
        if (naiHeaderLauncher?.isConnected) {
            naiHeaderLauncher.style.background = state.open ? 'rgba(147,131,255,.28)' : '#181a22';
            naiHeaderLauncher.style.color = state.open ? '#fff' : '#ddd7ff';
        }
        if (shadowLauncher) shadowLauncher.classList.toggle('active', state.open);
    }

    function toggleToolkitPanel() {
        if (IS_NAI && !naiImageRouteActive) return;
        if (suppressLauncherClick) { suppressLauncherClick = false; return; }
        if (state.open) closeToolkitPanel();
        else {
            state.open = true;
            const panel = root?.querySelector?.('.ainz-panel');
            if (panel && !closedRenderDirty) {
                panel.classList.add('open');
                hydrateVisibleThumbnails();
                hydrateDetailImages();
                refreshLauncherPresentation();
            } else {
                state.pendingContentScroll = Number(sessionView.tabs?.[state.activeTab]?.scrollTop) || 0;
                render();
            }
        }
    }

    function closeToolkitPanel() {
        if (!state.open) return;
        rememberCurrentViewState();
        state.open = false;
        closeToolkitOverflowMenu();
        root?.querySelector?.('.ainz-panel')?.classList.remove('open');
        refreshLauncherPresentation();
    }

    function syncBooruPageEnhancements() {
        if (!IS_BOORU) return;
        if (data.settings.showTagPlusButtons) installBooruTagButtons();
        else removeBooruTagButtons();
        installBooruToolbar();
        syncBooruSelectionUi();
    }

    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(render, 50);
    }

    function render() {
        if (IS_NAI && !naiImageRouteActive) return;
        const mount = root.querySelector('#mount');
        if (!mount) return;
        if (!state.open && !state.modal && mount.childElementCount) {
            closedRenderDirty = true;
            refreshLauncherPresentation();
            return;
        }
        mount.className = `accent-${data.settings.accent || 'violet'} card-layout-${data.settings.cardLayout || 'grid'}`;
        const scrollState = captureScrollState();
        const retainedListImages = captureRetainedListImages(mount);
        closeToolkitOverflowMenu();
        const floatingPosition = data.settings.naiFloatingButtonPosition || { right:18, top:120 };
        const launcherStyle = IS_NAI ? `right:${Math.max(8, Number(floatingPosition.right) || 18)}px;top:${Math.max(72, Number(floatingPosition.top) || 120)}px;bottom:auto` : '';

        mount.innerHTML = `
            <button class="ainz-fab" data-action="toggle-panel" data-launcher-floating="${IS_NAI ? 'true' : 'false'}" style="${launcherStyle}" title="Ainz Toolkit · Ctrl+Shift+P" aria-label="Open Ainz Toolkit">
                <span>✦</span>
            </button>
            ${IS_BOORU ? renderBooruFloating() : ''}
            <section class="ainz-panel ${state.open ? 'open' : ''} ${state.fullScreen ? 'full' : ''}">
                ${renderTopbar()}
                <div class="layout">
                    ${renderSidebar()}
                    <main class="content">${renderSelectionBar()}${renderContent()}</main>
                </div>
            </section>
            ${renderModal()}
            <div class="toast" id="ainz-toast"></div>
        `;

        restoreRetainedListImages(mount, retainedListImages);
        preserveFocusAfterRender();
        hydrateCollectionEditor();
        hydrateVisibleThumbnails();
        hydrateDetailImages();
        restoreTagBrowserScroll();
        restoreScrollState(scrollState);
        rememberCurrentViewState(false);
        closedRenderDirty = false;
        refreshLauncherPresentation();
    }

    function renderContentOnly() {
        if (!state.open || state.modal) return render();
        const content = root?.querySelector?.('.content');
        if (!content) return render();
        const scrollTop = Number(content.scrollTop) || 0;
        const retainedListImages = captureRetainedListImages(content);
        closeToolkitOverflowMenu();
        content.innerHTML = `${renderSelectionBar()}${renderContent()}`;
        restoreRetainedListImages(content, retainedListImages);
        preserveFocusAfterRender();
        hydrateCollectionEditor();
        hydrateVisibleThumbnails();
        hydrateDetailImages();
        restoreTagBrowserScroll();
        const restoredScrollTop = state.resetContentScroll ? 0 : scrollTop;
        content.scrollTop = restoredScrollTop;
        requestAnimationFrame(() => { if (content.isConnected) content.scrollTop = restoredScrollTop; });
        state.resetContentScroll = false;
        rememberCurrentViewState(false);
    }

    function scheduleContentRender(delay = 80) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderContentOnly, delay);
    }

    function retainedListImageKey(image) {
        if (!image?.closest?.('.card')) return '';
        const thumbnail = image.dataset.thumbnailKey || '';
        const version = image.dataset.thumbnailVersion || '';
        const owner = image.dataset.thumbnailOwnerId || '';
        const variant = image.dataset.thumbnailVariantId || '';
        const urls = image.dataset.listImageUrls || '';
        return thumbnail ? `thumbnail:${thumbnail}:${version}:${owner}:${variant}` : urls ? `network:${owner}:${variant}:${urls}` : '';
    }

    function captureRetainedListImages(mount) {
        const retained = new Map();
        for (const image of mount.querySelectorAll('.card img[data-thumbnail-key],.card img[data-list-image-urls]')) {
            const key = retainedListImageKey(image);
            if (!key || image.dataset.loaded !== 'true' || !image.getAttribute('src')) continue;
            if (!retained.has(key)) retained.set(key, []);
            retained.get(key).push(image);
        }
        return retained;
    }

    function restoreRetainedListImages(mount, retained) {
        if (!retained?.size) return;
        for (const replacement of mount.querySelectorAll('.card img[data-thumbnail-key],.card img[data-list-image-urls]')) {
            const key = retainedListImageKey(replacement);
            const existing = retained.get(key)?.shift();
            if (!existing) continue;
            existing.dataset.thumbnailKey = replacement.dataset.thumbnailKey || '';
            existing.dataset.thumbnailVersion = replacement.dataset.thumbnailVersion || '';
            existing.dataset.listImageUrls = replacement.dataset.listImageUrls || '';
            existing.dataset.thumbnailOwnerId = replacement.dataset.thumbnailOwnerId || '';
            existing.dataset.thumbnailVariantId = replacement.dataset.thumbnailVariantId || '';
            replacement.replaceWith(existing);
            if (existing.dataset.loaded === 'true') existing.parentElement?.querySelector('.thumb-placeholder')?.remove();
            if (existing.dataset.imageMode === 'web') addImageStateBadge(existing, 'WEB');
        }
    }

    function captureScrollState() {
        return {
            content: root.querySelector('.content')?.scrollTop || 0,
            sidebar: root.querySelector('.sidebar')?.scrollTop || 0,
            modal: root.querySelector('.modal-body')?.scrollTop || 0
        };
    }

    function restoreScrollState(saved) {
        const resetContent = state.resetContentScroll;
        state.resetContentScroll = false;
        const content = root.querySelector('.content');
        const sidebar = root.querySelector('.sidebar');
        const modal = root.querySelector('.modal-body');
        const pendingContent = state.pendingContentScroll;
        state.pendingContentScroll = null;
        if (content) content.scrollTop = resetContent ? 0 : pendingContent != null ? Number(pendingContent) || 0 : Number(saved?.content) || 0;
        if (sidebar) sidebar.scrollTop = Number(saved?.sidebar) || 0;
        if (modal) modal.scrollTop = Number(saved?.modal) || 0;
    }

    function closeToolkitOverflowMenu() {
        const record = openToolkitMenu;
        if (!record) return;
        const { panel, anchor, home } = record;
        panel.hidden = true;
        panel.removeAttribute('style');
        if (home?.isConnected) home.appendChild(panel);
        else panel.remove();
        anchor?.setAttribute?.('aria-expanded', 'false');
        openToolkitMenu = null;
        state.openMenu = '';
    }

    function toggleToolkitOverflowMenu(anchor) {
        const key = String(anchor?.dataset?.menu || '');
        if (!key) return;
        if (openToolkitMenu?.key === key && openToolkitMenu.anchor === anchor) return closeToolkitOverflowMenu();
        closeToolkitOverflowMenu();
        const home = anchor.parentElement;
        const panel = [...(home?.querySelectorAll('[data-menu-panel]') || [])].find(candidate => candidate.dataset.menuPanel === key);
        const layer = root.querySelector('#ainz-menu-layer');
        if (!panel || !layer) return;
        layer.appendChild(panel);
        panel.hidden = false;
        panel.style.visibility = 'hidden';
        panel.style.left = '8px';
        panel.style.top = '8px';
        const anchorRect = anchor.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const margin = 8;
        const gap = 6;
        const width = Math.min(panelRect.width || 225, Math.max(0, innerWidth - margin * 2));
        const height = Math.min(panelRect.height || 180, Math.max(0, innerHeight - margin * 2));
        let left = anchorRect.right - width;
        let top = anchorRect.bottom + gap;
        if (top + height > innerHeight - margin && anchorRect.top - height - gap >= margin) top = anchorRect.top - height - gap;
        left = Math.max(margin, Math.min(left, innerWidth - width - margin));
        top = Math.max(margin, Math.min(top, innerHeight - height - margin));
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `${Math.max(90, Math.floor(innerHeight - top - margin))}px`;
        panel.style.visibility = 'visible';
        anchor.setAttribute('aria-expanded', 'true');
        state.openMenu = key;
        openToolkitMenu = { key, panel, anchor, home };
    }

    function renderSelectionBar() {
        if (!state.selectionMode) return '';
        const selected = getSelectedWrappers();
        const allFavorite = selected.length > 0 && selected.every(wrapper => wrapper.item.favorite);
        return `<div class="selection-bar"><span class="selection-count">${selected.length} selected</span><button class="btn small" data-action="bulk-category">Move</button><button class="btn small" data-action="bulk-favorite">${allFavorite ? 'Unfavorite' : 'Favorite'}</button><button class="btn small" data-action="select-all-visible">Select all</button><div class="menu-wrap"><button class="icon-action small" data-action="toggle-menu" data-menu="bulk" aria-expanded="false" title="More actions" aria-label="More actions">⋯</button><div class="overflow-menu" data-menu-panel="bulk" hidden><button class="menu-item" data-action="bulk-export">Export selected</button><button class="menu-item" data-action="bulk-rename-imports">Rename imports with standard scheme</button><button class="menu-item" data-action="merge-selected-variants">Merge selected imports as variants</button><button class="menu-item" data-action="bulk-remove-source">Remove source information</button><button class="menu-item danger" data-action="bulk-delete">Delete selected</button></div></div><button class="btn ghost small" data-action="exit-selection">Cancel</button></div>`;
    }

    function renderTopbar() {
        return `
            <header class="topbar">
                <div class="brand"><span class="brand-badge">✦</span><span>Ainz Toolkit</span></div>
                <div class="search-wrap">
                    <input id="global-search" type="search" autocomplete="off" placeholder="Search profiles, sets, tags and notes …" value="${escapeAttr(state.search)}">
                    ${state.search ? '<button class="search-clear" data-action="clear-search" title="Clear search">✕</button>' : ''}
                </div>
                <div class="top-actions">
                    <button class="icon-action" data-action="toggle-full" title="Toggle full view" aria-label="Toggle full view">${state.fullScreen ? '↙' : '↗'}</button>
                    <button class="icon-action" data-action="close-panel" title="Close" aria-label="Close">✕</button>
                </div>
            </header>
        `;
    }


    function renderContent() {
        if (state.search.trim()) return renderSearchResults();
        switch (state.activeTab) {
            case 'characters': return renderCharacters();
            case 'sets': return renderSets();
            case 'bases': return renderBases();
            case 'styles': return renderStyleArtists();
            case 'full-images': return renderFullImages();
            case 'tags': return renderFavoriteTags();
            case 'imported': return renderImported();
            case 'collections': return renderCollections();
            case 'smart-recent-used':
            case 'smart-recent-created':
            case 'smart-recent-modified':
            case 'smart-most-used': return renderSmartView();
            case 'history': return renderHistory();
            case 'settings': return renderSettings();
            case 'booru': return renderBooruTab();
            default: return renderQuick();
        }
    }

    function renderTargetBar() {
        return '';
    }


    function renderQuick() {
        const favorites = collectFavoriteItems();
        const recent = resolveRecentItems();
        return `
            ${renderTargetBar()}
            <div class="section-head">
                <div><h2 class="section-title">Quick Access</h2><div class="section-subtitle">Favorites, recently used entries and current NovelAI prompt actions.</div></div>
                <div class="actions">
                    ${IS_NAI ? '<button class="btn" data-action="snapshot">Save History State</button><button class="btn" data-action="save-full-image">Save Full Image</button><button class="btn primary" data-action="new-from-prompt">Save from Prompt</button>' : ''}
                </div>
            </div>
            ${state.currentNotice ? `<div class="notice">${escapeHtml(state.currentNotice)}</div>` : ''}
            <div class="quick-grid">
                <div>
                    <section class="box">
                        <div class="box-title"><span>★ Favorites</span><span class="list-meta">${favorites.length}</span></div>
                        ${favorites.length ? `<div class="grid">${favorites.slice(0, 12).map(item => renderAnyCard(item, true)).join('')}</div>` : '<div class="empty">No favorites yet. Mark profiles, sets, styles, full images or tags with ★.</div>'}
                    </section>
                    <section class="box">
                        <div class="box-title"><span>Recently Used</span><button class="btn ghost small" data-action="clear-recent">Clear</button></div>
                        ${recent.length ? `<div class="list">${recent.slice(0, 12).map(renderRecentRow).join('')}</div>` : '<div class="empty">Entries you use will appear here.</div>'}
                    </section>
                </div>
                <div>
                    ${IS_BOORU ? renderBooruQuickBox() : ''}
                    <section class="box">
                        <div class="box-title"><span>Create</span></div>
                        <div class="actions">
                            <button class="btn" data-action="new-item" data-kind="character">+ Character</button>
                            <button class="btn" data-action="new-item" data-kind="set">+ Tag Set</button>
                            <button class="btn" data-action="new-item" data-kind="base">+ Base</button>
                            <button class="btn" data-action="new-item" data-kind="style">+ Style/Artist</button>
                            <button class="btn" data-action="new-item" data-kind="tag">+ Tag</button>
                        </div>
                    </section>
                    <section class="box">
                        <div class="box-title"><span>Library</span></div>
                        <div class="list-meta">${data.characters.length} characters · ${getManualTagSets().length} sets · ${getImportedWrappers().length} imports · ${data.bases.length} bases · ${data.styleArtists.length} styles · ${data.fullImages.length} full images · ${data.favoriteTags.length} tags</div>
                        <div class="actions" style="margin-top:10px">
                            <button class="btn" data-action="export">Export JSON</button>
                            <button class="btn" data-action="import">Import JSON</button>
                        </div>
                    </section>
                </div>
            </div>
        `;
    }

    function renderCharacters() {
        return `
            ${renderTargetBar()}
            <div class="section-head">
                <div><h2 class="section-title">Character Profiles</h2><div class="section-subtitle">Named profiles with separate positive and negative character prompts.</div></div>
                <div class="actions">${IS_NAI ? '<button class="btn" data-action="import-nai-character">Import from NAI Character Field</button>' : ''}<button class="btn primary" data-action="new-item" data-kind="character">+ Character Profile</button></div>
            </div>
            ${data.characters.length ? renderWrapperGrid(sortItems(data.characters).map(item => ({ kind: 'character', item })), 'characters') : '<div class="empty">No character profiles yet.</div>'}
        `;
    }

    function renderSets() {
        const manualSets = getManualTagSets();
        const positive = sortItems(manualSets.filter(item => normalizeTagSetType(item.type) === 'positive'));
        const negative = sortItems(manualSets.filter(item => normalizeTagSetType(item.type) === 'negative'));
        const combined = sortItems(manualSets.filter(item => normalizeTagSetType(item.type) === 'combined'));
        return `
            <div class="section-head">
                <div><h2 class="section-title">Tag Sets</h2><div class="section-subtitle">Positive, negative and combined Main Prompt presets.</div></div>
                <div class="actions"><button class="btn primary" data-action="new-item" data-kind="set">+ Tag Set</button></div>
            </div>
            <section class="box">
                <div class="box-title"><span>Positive Sets</span><span class="list-meta">${positive.length}</span></div>
                ${positive.length ? renderWrapperGrid(positive.map(item => ({ kind: 'set', item })), 'positive-sets') : '<div class="empty">No positive sets.</div>'}
            </section>
            <section class="box">
                <div class="box-title"><span>Negative Sets</span><span class="list-meta">${negative.length}</span></div>
                ${negative.length ? renderWrapperGrid(negative.map(item => ({ kind: 'set', item })), 'negative-sets') : '<div class="empty">No negative sets.</div>'}
            </section>
            <section class="box">
                <div class="box-title"><span>Positive + Negative Sets</span><span class="list-meta">${combined.length}</span></div>
                ${combined.length ? renderWrapperGrid(combined.map(item => ({ kind: 'set', item })), 'combined-sets') : '<div class="empty">No combined sets.</div>'}
            </section>
            <section class="box">
                <div class="box-title"><span>Individually Saved Tags</span><span class="list-meta">${data.favoriteTags.length}</span></div>
                <div class="section-subtitle" style="margin-bottom:10px">Reusable single tags are inserted directly into the Main Prompt.</div>
                <div class="actions" style="margin-bottom:10px"><button class="btn primary" data-action="new-item" data-kind="tag">+ Saved Tag</button></div>
                ${data.favoriteTags.length ? renderWrapperGrid(sortItems(data.favoriteTags).map(item => ({ kind: 'tag', item })), 'saved-tags') : '<div class="empty">No individual tags saved yet.</div>'}
            </section>
        `;
    }

    function renderBases() {
        return `
            ${renderTargetBar()}
            <div class="section-head">
                <div><h2 class="section-title">Base Tags</h2><div class="section-subtitle">Reusable positive and negative prompt foundations.</div></div>
                <div class="actions"><button class="btn primary" data-action="new-item" data-kind="base">+ Base Profile</button></div>
            </div>
            ${data.bases.length ? renderWrapperGrid(sortItems(data.bases).map(item => ({ kind: 'base', item })), 'bases') : '<div class="empty">No base profiles yet.</div>'}
        `;
    }

    function renderStyleArtists() {
        return renderStyleLibrary();
    }

    function renderFullImages() {
        const query = state.fullImageQuery.trim().toLowerCase();
        const items = sortItems(data.fullImages.filter(item => !query || searchableText(item).includes(query)));
        return `
            ${renderTargetBar()}
            <div class="section-head">
                <div><h2 class="section-title">Full Image</h2><div class="section-subtitle">Complete NovelAI prompt snapshots: base positive, base negative and every character prompt.</div></div>
                <div class="actions"><div class="field view-search"><label>Search Full Images</label><input id="full-image-search" type="search" autocomplete="off" value="${escapeAttr(state.fullImageQuery)}" placeholder="Name, prompt, character or notes …"></div>${IS_NAI ? '<button class="btn primary" data-action="save-full-image">Save Current Full Image</button>' : ''}</div>
            </div>
            ${items.length ? renderWrapperGrid(items.map(item => ({ kind: 'fullImage', item })), 'full-images') : `<div class="empty">${query ? 'No Full Images match this search.' : 'No full image prompt snapshots yet.'}</div>`}
        `;
    }

    function renderFavoriteTags() {
        const index = getTagIndex();
        const query = canonicalTag(state.tagQuery);
        const matchRank = label => {
            const value = canonicalTag(label);
            if (!query) return 0;
            if (value === query) return 0;
            if (value.startsWith(query)) return 1;
            return 2;
        };
        const tags = [...index.values()]
            .filter(entry => !query || canonicalTag(entry.label).includes(query))
            .sort((a, b) => matchRank(a.label) - matchRank(b.label) || b.wrappers.length - a.wrappers.length || a.label.localeCompare(b.label, 'en'));
        const selected = state.selectedTag ? index.get(canonicalTag(state.selectedTag)) : null;
        const wrappers = selected?.wrappers || [];
        const selectedLabel = selected?.label || '';
        const results = selected
            ? `<div class="box-title"><div><strong>${escapeHtml(selectedLabel)}</strong><div class="section-subtitle">${wrappers.length} saved image entr${wrappers.length === 1 ? 'y contains' : 'ies contain'} this tag.</div></div><div class="actions"><button class="btn small" data-action="copy-index-tag" data-tag="${escapeAttr(selectedLabel)}">Copy</button>${IS_NAI ? `<button class="btn primary small" data-action="insert-index-tag" data-tag="${escapeAttr(selectedLabel)}">Insert</button>` : ''}<button class="btn ghost small" data-action="back-to-tag-list">Clear</button></div></div>${wrappers.length ? renderTagImageGrid(wrappers, selectedLabel) : '<div class="empty">No saved image currently contains this tag.</div>'}`
            : '<div class="empty tag-results-empty"><div><strong>Select a tag on the left</strong><div class="section-subtitle" style="margin-top:6px">Matching saved images will appear here.</div></div></div>';
        return `
            <div class="section-head">
                <div><h2 class="section-title">Tag Collection</h2><div class="section-subtitle">Browse indexed image tags and insert a selected tag directly into the Main Prompt.</div></div>
            </div>
            <div class="tag-browser">
                <section class="box tag-list-panel">
                    <div class="tag-list-search field"><label>Find a tag</label><input id="tag-collection-search" type="search" autocomplete="off" value="${escapeAttr(state.tagQuery)}" placeholder="Search ${index.size} indexed tags …"></div>
                    <div class="tag-list-scroll" id="tag-list-scroll">
                        ${tags.length ? tags.slice(0, state.visibleLimit).map(entry => `<button class="tag-index-row ${canonicalTag(state.selectedTag) === canonicalTag(entry.label) ? 'active' : ''}" data-action="open-index-tag" data-tag="${escapeAttr(entry.label)}" title="${escapeAttr(entry.label)}"><span>${escapeHtml(entry.label)}</span><span class="tag-count">${entry.wrappers.length}</span></button>`).join('') : '<div class="empty">No matching tags.</div>'}
                        ${tags.length > state.visibleLimit ? `<button class="btn ghost" style="width:100%;margin-top:8px" data-action="show-more">Show ${Math.min(120, tags.length - state.visibleLimit)} more</button>` : ''}
                    </div>
                </section>
                <section class="box tag-results-panel" id="tag-results-panel">${results}</section>
            </div>
        `;
    }

    function getTagIndex() {
        if (tagIndexCache?.revision === dataRevision) return tagIndexCache.map;
        const map = new Map();
        for (const wrapper of getImportedWrappers()) {
            if (!entryHasImage(wrapper.item)) continue;
            const seenForItem = new Set();
            const variants = getItemVariants(wrapper.item);
            for (const variant of variants.length ? variants : [null]) {
                for (const tag of getIndexedTags(wrapper.item, variant)) {
                    const key = canonicalTag(tag);
                    if (!key || seenForItem.has(key)) continue;
                    seenForItem.add(key);
                    if (!map.has(key)) map.set(key, { label: String(tag).trim(), wrappers: [] });
                    map.get(key).wrappers.push({ ...wrapper, matchVariantId: variant?.id || '' });
                }
            }
        }
        tagIndexCache = { revision: dataRevision, map };
        return map;
    }

    function renderTagImageGrid(wrappers, tag) {
        return `<div class="tag-image-grid">${wrappers.slice(0,state.visibleLimit).map(wrapper => {
            const variant = findVariant(wrapper.item, wrapper.matchVariantId || wrapper.item.primaryVariantId);
            const title = wrapper.item.name || wrapper.item.label || 'Imported image';
            return `<button class="card tag-image-card" data-action="open-tag-image" data-id="${escapeAttr(wrapper.item.id)}" data-variant-id="${escapeAttr(variant?.id || '')}" data-tag="${escapeAttr(tag)}" title="${escapeAttr(title)}" aria-label="Open ${escapeAttr(title)}">${renderThumbnailFrame(wrapper.item,'medium','No preview',variant)}</button>`;
        }).join('')}</div>`;
    }

    function cleanIndexedTagLabel(value) {
        const label = String(value || '').trim().replace(/^_+|_+$/g, '').trim();
        if (!label || label.length > 160 || /[\r\n,]/.test(label)) return '';
        if (/^[-+]?\d+(?:\.\d+)?::/.test(label) || /::{1,2}$/.test(label)) return '';
        const normalized = normalizeBooruTag(label);
        if (!normalized || !isPlausibleBooruTag(normalized)) return '';
        return label;
    }

    function indexedTagTokens(value) {
        return splitPrompt(value).map(cleanIndexedTagLabel).filter(Boolean);
    }

    function getIndexedTags(item, onlyVariant = undefined) {
        const values = [];
        const addValue = value => values.push(...indexedTagTokens(value));
        const addGroups = groups => Object.values(groups || {}).forEach(tags => (Array.isArray(tags) ? tags : [tags]).forEach(addValue));
        if (onlyVariant !== undefined) {
            addGroups(onlyVariant?.tagGroups);
            addValue(onlyVariant?.tags || item?.tags || '');
            return [...new Map(values.map(tag => [canonicalTag(tag), tag])).values()].filter(Boolean);
        }
        addGroups(item?.tagGroups);
        addValue(item?.tags || '');
        for (const variant of getItemVariants(item)) {
            addGroups(variant.tagGroups);
            addValue(variant.tags || '');
        }
        return [...new Map(values.map(tag => [canonicalTag(tag), tag])).values()].filter(Boolean);
    }

    function entryHasImage(item) {
        if (item?.thumbnail?.key) return true;
        return getItemVariants(item).some(variant => variant.thumbnail?.key || bestVariantImageUrl(variant) || variant.sources?.some(source => source.imageUrl || source.fileUrl || source.sampleUrl || source.previewUrl));
    }

    function renderWrapperGrid(wrappers, context = 'default') {
        const visible = wrappers.slice(0, state.visibleLimit);
        return `<div class="grid grid-${escapeAttr(context)}">${visible.map(wrapper => renderAnyCard(wrapper)).join('')}</div>${wrappers.length > visible.length ? `<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn" data-action="show-more" data-context="${escapeAttr(context)}">Show ${Math.min(120, wrappers.length - visible.length)} more</button></div>` : ''}`;
    }


    function getImportedWrappers() {
        return data.sets.filter(isImportedItem).map(item => ({ kind: 'imported', item }));
    }

    function getManualTagSets() {
        return data.sets.filter(item => !isImportedItem(item));
    }


    function renderSmartView() {
        const view = state.activeTab.replace(/^smart-/, '') || state.smartView;
        if (SMART_VIEW_LABELS[view]) state.smartView = view;
        const items = getSmartViewItems(view, state.smartKindFilter);
        return `
            ${renderTargetBar()}
            <div class="section-head"><div><h2 class="section-title">Smart Views</h2><div class="section-subtitle">Browse entries by activity and usage across the whole library.</div></div></div>
            <div class="smart-toolbar">
                <div class="field"><label>View</label><select data-setting="smart-view">${Object.entries(SMART_VIEW_LABELS).map(([id, label]) => `<option value="${id}" ${view === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>
                <div class="field"><label>Entry type</label><select data-setting="smart-kind-filter">${renderKindFilterOptions(state.smartKindFilter)}</select></div>
                <span class="list-meta">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span>
            </div>
            ${items.length ? renderWrapperGrid(items, 'smart') : '<div class="empty">No entries match this view yet.</div>'}
        `;
    }

    function renderKindFilterOptions(selected) {
        const options = [['all', 'All types'], ['imported', 'Imported'], ['character', 'Characters'], ['set', 'Tag Sets'], ['base', 'Base Profiles'], ['style', 'Styles/Artists'], ['fullImage', 'Full Images'], ['tag', 'Saved Tags']];
        return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
    }

    function getWrapperIndex() {
        if (wrapperIndexCache.revision === dataRevision) return wrapperIndexCache;
        const wrappers = [
            ...data.characters.map(item => ({ kind: 'character', item })),
            ...data.sets.map(item => ({ kind: isImportedItem(item) ? 'imported' : 'set', item })),
            ...data.bases.map(item => ({ kind: 'base', item })),
            ...data.styleArtists.map(item => ({ kind: 'style', item })),
            ...data.fullImages.map(item => ({ kind: 'fullImage', item })),
            ...data.favoriteTags.map(item => ({ kind: 'tag', item }))
        ];
        const byRef = new Map();
        const byId = new Map();
        for (const wrapper of wrappers) {
            byRef.set(`${wrapper.kind}:${wrapper.item.id}`, wrapper);
            if (!byId.has(wrapper.item.id)) byId.set(wrapper.item.id, wrapper);
        }
        wrapperIndexCache.revision = dataRevision;
        wrapperIndexCache.wrappers = wrappers;
        wrapperIndexCache.byRef = byRef;
        wrapperIndexCache.byId = byId;
        return wrapperIndexCache;
    }

    function allLibraryWrappers() {
        return getWrapperIndex().wrappers;
    }

    function getSmartViewItems(view, kindFilter = 'all') {
        const items = allLibraryWrappers().filter(wrapper => kindFilter === 'all' || wrapper.kind === kindFilter);
        const timestamp = (item, field) => {
            const value = Date.parse(item?.[field] || '');
            return Number.isFinite(value) ? value : 0;
        };
        if (view === 'recent-used') return items.filter(wrapper => wrapper.item.lastUsed).sort((a, b) => timestamp(b.item, 'lastUsed') - timestamp(a.item, 'lastUsed'));
        if (view === 'recent-created') return items.sort((a, b) => timestamp(b.item, 'createdAt') - timestamp(a.item, 'createdAt'));
        if (view === 'recent-modified') return items.sort((a, b) => timestamp(b.item, 'updatedAt') - timestamp(a.item, 'updatedAt'));
        return items.sort((a, b) => (Number(b.item.usageCount) || 0) - (Number(a.item.usageCount) || 0) || timestamp(b.item, 'lastUsed') - timestamp(a.item, 'lastUsed'));
    }

    function renderHistory() {
        return `
            ${renderTargetBar()}
            <div class="section-head">
                <div><h2 class="section-title">Prompt History</h2><div class="section-subtitle">Manual and automatic snapshots of detected NovelAI prompt fields.</div></div>
                <div class="actions">${IS_NAI ? '<button class="btn primary" data-action="snapshot">Save Current State</button>' : ''}<button class="btn danger" data-action="clear-history">Clear History</button></div>
            </div>
            ${data.history.length ? `<div class="box" style="padding:0">${data.history.map(renderHistoryRow).join('')}</div>` : '<div class="empty">No prompt history yet.</div>'}
        `;
    }


    function getBooruProfile(site = SITE) {
        const key = BOORU_SITES.includes(site) ? site : 'danbooru';
        const stored = data.settings.booruProfiles?.[key] || {};
        return { ...deepClone(DEFAULT_BOORU_PROFILES[key]), ...stored };
    }

    function renderBooruProfileSettings() {
        const site = BOORU_SITES.includes(state.profileSite) ? state.profileSite : 'danbooru';
        const profile = getBooruProfile(site);
        const categoryRows = ALL_BOORU_GROUPS.map(group => `<div class="booru-profile-row"><strong>${escapeHtml(CATEGORY_LABELS[group] || group)}</strong><label class="compact-check"><input type="checkbox" data-setting="profile-group:${site}:${group}" ${profile.includeGroups.includes(group) ? 'checked' : ''}><span>Import</span></label><label class="compact-check"><input type="checkbox" data-setting="profile-copy-group:${site}:${group}" ${(profile.copyGroups || []).includes(group) ? 'checked' : ''}><span>Copy all</span></label></div>`).join('');
        return `<section class="setting wide"><h4>Website Import Profiles</h4><div class="form-grid booru-profile-controls"><div class="field"><label>Website</label><select data-setting="profile-site">${BOORU_SITES.map(value => `<option value="${value}" ${site === value ? 'selected' : ''}>${escapeHtml(sourceSiteLabel(value))}</option>`).join('')}</select></div><div class="field"><label>Tag formatting</label><select data-setting="profile-format:${site}"><option value="spaces" ${profile.tagFormat !== 'underscores' ? 'selected' : ''}>Convert underscores to spaces</option><option value="underscores" ${profile.tagFormat === 'underscores' ? 'selected' : ''}>Keep underscores</option></select></div><div class="field wide booru-profile-option"><label>Content filtering</label><label class="check-row"><input type="checkbox" data-setting="profile-censorship:${site}" ${profile.includeCensorshipTags ? 'checked' : ''}><span>Include censorship tags in imports and copy actions</span></label><div class="field-help">Off by default. Tags such as censored, mosaic censoring and censor bars remain filtered unless this is enabled for the selected website.</div></div><div class="field wide"><label>Category rules</label><div class="booru-profile-grid">${categoryRows}</div></div></div><p>Each compact checkbox has a full clickable label. Metadata remains separate from prompt tags.</p></section>`;
    }

    function renderHomePageOptions(selected) {
        const options = [
            ['quick', 'Quick Access'], ['characters', 'Characters'], ['sets', 'Tag Sets'], ['bases', 'Base Tags'],
            ['styles', 'Style/Artist'], ['full-images', 'Full Image'], ['tags', 'Tag Collection'], ['imported', 'Imported'], ['collections', 'Collections'], ['history', 'History'],
            ['smart-recent-used', 'Recently Used'], ['smart-recent-created', 'Recently Created'],
            ['smart-recent-modified', 'Recently Modified'], ['smart-most-used', 'Most Used']
        ];
        if (IS_BOORU) options.splice(1, 0, ['booru', 'Booru Tools']);
        return options.filter(([value]) => isSidebarSectionVisible(sidebarSectionForTab(value))).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
    }


    function renderThumbnailStorageSetting() {
        const stats = state.thumbnailStats || getThumbnailStats();
        state.thumbnailStats = stats;
        return `<section class="setting"><div class="box-title"><h4 style="margin:0">Local Image Storage</h4><div class="menu-wrap"><button class="btn icon small" data-action="toggle-menu" data-menu="thumbnail-storage" aria-expanded="false">⋯</button><div class="overflow-menu" data-menu-panel="thumbnail-storage" hidden><button class="menu-item" data-action="regenerate-missing-thumbnails">Repair missing local images</button><button class="menu-item" data-action="regenerate-all-thumbnails">Rebuild all in selected quality</button><button class="menu-item" data-action="remove-category-thumbnails">Remove local images by category</button><button class="menu-item danger" data-action="remove-all-thumbnails">Remove all local images</button><button class="menu-item danger" data-action="remove-orphan-thumbnails">Remove orphaned local images</button></div></div></div><div class="storage-meter"><span></span></div><p>${stats.count} local image${stats.count === 1 ? '' : 's'} · ${formatBytes(stats.bytes)}<br>${stats.missing} missing · ${stats.orphaned} orphaned</p></section>`;
    }

    function settingCheckbox(key, label) {
        return `<label class="check-row"><input type="checkbox" data-setting="${escapeAttr(key)}" ${data.settings[key] ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
    }


    function renderSearchResults() {
        const query = state.search.trim().toLowerCase();
        const results = searchLibrary(query);
        return `
            ${renderTargetBar()}
            <div class="section-head"><div><h2 class="section-title">Search Results</h2><div class="section-subtitle">${results.length} result${results.length === 1 ? '' : 's'} for “${escapeHtml(state.search.trim())}”</div></div></div>
            ${results.length ? renderWrapperGrid(results, 'search') : '<div class="empty">No matching profiles, sets, tags or notes.</div>'}
        `;
    }

    function searchLibrary(query) {
        return measureOperation('search', () => getWrapperIndex().wrappers
            .filter(({ item }) => searchableText(item).includes(query))
            .sort((a, b) => Number(Boolean(b.item.favorite)) - Number(Boolean(a.item.favorite)) || String(a.item.name || a.item.label || a.item.tag).localeCompare(String(b.item.name || b.item.label || b.item.tag), 'en')));
    }

    function searchableText(item) {
        if (!item) return '';
        const cacheKey = `${item.updatedAt || ''}|${item.primaryVariantId || ''}|${getItemVariants(item).length}|${item.sources?.length || 0}`;
        const cached = searchTextCache.get(item.id);
        if (cached?.key === cacheKey) return cached.text;
        const text = [
            item.name, item.label, item.tag, item.positive, item.negative, item.tags, item.positiveTags, item.negativeTags,
            item.basePositive, item.baseNegative, item.category, item.notes,
            ...(item.sources || []).flatMap(source => [source.site, source.postId, source.url]),
            ...getItemVariants(item).flatMap(variant => [variant.label, variant.tags, ...Object.values(variant.tagGroups || {}).flat(), ...(variant.sources || []).flatMap(source => [source.site, source.postId, source.url, source.originalSourceUrl, ...(source.artist || [])])]),
            ...(item.characters || []).flatMap(character => [character.name, character.positive, character.negative]),
            ...Object.values(item.tagGroups || {}).flat()
        ].filter(Boolean).join(' ').toLowerCase();
        searchTextCache.set(item.id, { key: cacheKey, text });
        return text;
    }

    function renderAnyCard(wrapper, compact = false) {
        const rememberedVariant = wrapper.kind === 'imported' ? state.cardVariantIds?.[wrapper.item.id] : '';
        return renderItemCard(wrapper.kind, wrapper.item, compact, rememberedVariant || wrapper.matchVariantId || '');
    }

    function humanizeImportLabel(value, stripQualifier = false) {
        let label = String(value || '').trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
        if (stripQualifier) label = label.replace(/\s*\([^()]+\)\s*$/, '').trim();
        return label.replace(/(^|[\s/+-])([a-z])/g, (_match, lead, letter) => `${lead}${letter.toUpperCase()}`);
    }

    function compactImportNames(values, stripQualifier = false) {
        const names = [...new Set((values || []).map(value => humanizeImportLabel(value, stripQualifier)).filter(Boolean))];
        if (!names.length) return '';
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} & ${names[1]}`;
        return `${names[0]} + ${names.length - 1}`;
    }

    function importNamingParts(groups = {}, sources = []) {
        const sites = [...new Set((sources || []).map(source => sourceSiteLabel(source?.site)).filter(Boolean))];
        return {
            character: compactImportNames(groups.character || [], true),
            source: sites.length > 1 ? `${sites[0]} + ${sites.length - 1}` : (sites[0] || ''),
            artist: compactImportNames(groups.artist || [], false),
            post_id: String(sources?.[0]?.postId || '')
        };
    }

    function applyImportNameTemplate(template, parts, fallback = 'Imported') {
        let value = String(template || '{character} ({source} - {artist})');
        value = value.replace(/\{(character|source|artist|post_id)\}/g, (_match, key) => parts?.[key] || '');
        value = value
            .replace(/\(\s*-\s*/g, '(')
            .replace(/\s*-\s*\)/g, ')')
            .replace(/\(\s*\)/g, '')
            .replace(/^\s*\(([^()]+)\)\s*$/, '$1')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([),])/g, '$1')
            .replace(/\(\s+/g, '(')
            .replace(/\s*-\s*$/g, '')
            .trim();
        return value || String(fallback || 'Imported').trim() || 'Imported';
    }

    function suggestedImportName(item, variant = null, template = data.settings.importNameTemplate) {
        const target = variant || getPrimaryVariant(item);
        const groups = target?.tagGroups || item?.tagGroups || {};
        const sources = target?.sources?.length ? target.sources : (item?.sources || []);
        return applyImportNameTemplate(template, importNamingParts(groups, sources), item?.name || 'Imported');
    }

    function renderImportedCardFacts(item, variant) {
        const source = variant?.sources?.[0] || {};
        const sourceLabel = source.site
            ? `${sourceSiteLabel(source.site)}${source.postId ? ` #${source.postId}` : ''}`
            : (source.postId ? `Post #${source.postId}` : 'Source not stored');
        const tagCount = splitPrompt(variant?.tags || item?.tags || '').length;
        return `<div class="card-facts"><div class="card-fact-row"><span class="card-fact accent">${escapeHtml(sourceLabel)}</span><span class="card-fact">${tagCount} tag${tagCount === 1 ? '' : 's'}</span></div></div>`;
    }

    function renderItemCard(kind, item, compact = false, variantId = '') {
        const title = item.name || item.label || item.tag || 'Untitled';
        const typeLabel = kind === 'character' ? `Character · ${characterTypeLabel(item.naiCharacterType)}`
            : kind === 'imported' ? 'Imported Image'
            : kind === 'set' ? (normalizeTagSetType(item.type) === 'combined' ? 'Positive + Negative Set' : normalizeTagSetType(item.type) === 'negative' ? 'Negative Set' : 'Positive Set')
            : kind === 'base' ? 'Base Profile'
            : kind === 'style' ? 'Style/Artist'
            : kind === 'fullImage' ? `Full Image · ${(item.characters || []).length} character${(item.characters || []).length === 1 ? '' : 's'}`
            : (item.type === 'negative' ? 'Negative Tag' : 'Positive Tag');
        const displayVariant = kind === 'imported' ? findVariant(item, variantId || item.primaryVariantId) : null;
        const previews = kind === 'imported' ? [] : getItemPreviews(kind, item, displayVariant);
        const canApply = IS_NAI;
        const smartView = state.activeTab.startsWith('smart-') ? state.activeTab.replace(/^smart-/, '') : '';
        const smartMeta = smartView === 'most-used' ? ` · used ${Number(item.usageCount) || 0} time${Number(item.usageCount) === 1 ? '' : 's'}`
            : smartView === 'recent-used' && item.lastUsed ? ` · ${formatRelative(item.lastUsed)}`
            : smartView === 'recent-created' && item.createdAt ? ` · created ${formatRelative(item.createdAt)}`
            : smartView === 'recent-modified' && item.updatedAt ? ` · modified ${formatRelative(item.updatedAt)}` : '';
        const key = selectionKey(kind, item.id);
        const selected = state.selectedItems.has(key);
        const variants = getItemVariants(item);
        const primaryVariant = displayVariant || getPrimaryVariant(item);
        const showThumbnail = data.settings.thumbnailDisplay === 'all' && entryHasImage(item);
        const cardMenuKey = `card:${kind}:${item.id}`;
        const activeCollection = state.activeTab === 'collections' ? data.collections.find(collection => collection.id === state.activeCollectionId) : null;
        const collectionMenu = activeCollection ? (activeCollection.type === 'smart'
            ? `<button class="menu-item" data-action="exclude-from-active-collection" data-kind="${kind}" data-id="${escapeAttr(item.id)}">Exclude from this Smart Collection</button>`
            : `<button class="menu-item" data-action="remove-from-active-collection" data-kind="${kind}" data-id="${escapeAttr(item.id)}">Remove from this Collection</button>`) : '';
        const favoriteButton = `<button class="star ${item.favorite ? 'on' : ''}" data-action="toggle-favorite" data-kind="${kind}" data-id="${escapeAttr(item.id)}" title="Favorite" aria-label="Favorite">★</button>`;
        const overflowMenu = `<div class="menu-wrap"><button class="icon-action card-menu-dots" data-action="toggle-menu" data-menu="${escapeAttr(cardMenuKey)}" aria-expanded="false" title="More actions" aria-label="More actions">⋯</button><div class="overflow-menu" data-menu-panel="${escapeAttr(cardMenuKey)}" hidden><button class="menu-item" data-action="edit-item" data-kind="${kind}" data-id="${escapeAttr(item.id)}">Edit entry</button>${kind === 'imported' ? `<button class="menu-item" data-action="rename-import-from-primary" data-id="${escapeAttr(item.id)}" data-variant-id="${escapeAttr(primaryVariant?.id || '')}">Rename from primary variant</button>` : ''}<button class="menu-item" data-action="duplicate-item" data-kind="${kind}" data-id="${escapeAttr(item.id)}">Duplicate</button>${collectionMenu}<button class="menu-item danger" data-action="delete-item" data-kind="${kind}" data-id="${escapeAttr(item.id)}">Delete</button></div></div>`;
        const headerActions = state.selectionMode ? '' : kind === 'imported' ? `<div class="card-top-actions">${favoriteButton}${overflowMenu}</div>` : favoriteButton;
        const actionVariantAttr = kind === 'imported' && primaryVariant?.id ? ` data-variant-id="${escapeAttr(primaryVariant.id)}"` : '';
        const applyActions = canApply ? `${kind === 'character' ? `<button class="btn primary small" data-action="add-character" data-id="${escapeAttr(item.id)}">Add Character</button>` : ''}<button class="btn ${kind === 'character' ? '' : 'primary'} small" data-action="apply-item" data-kind="${kind}" data-id="${escapeAttr(item.id)}"${actionVariantAttr}>Append</button><button class="btn small" data-action="replace-item" data-kind="${kind}" data-id="${escapeAttr(item.id)}"${actionVariantAttr}>Replace</button>` : '';
        const lowerActions = state.selectionMode ? '' : `${applyActions}${kind === 'imported' ? '' : overflowMenu}`;
        const body = `<div class="card-head">
                ${state.selectionMode ? `<button class="selection-check ${selected ? 'on' : ''}" data-action="toggle-selected" data-kind="${kind}" data-id="${escapeAttr(item.id)}">✓</button>` : ''}
                <div class="card-title-wrap"><div class="card-title-line"><div class="card-title" title="${escapeAttr(title)}">${escapeHtml(title)}</div>${variants.length > 1 ? `<span class="variant-badge">${variants.length} variants</span>` : ''}</div><div class="card-meta">${escapeHtml(typeLabel)}${kind === 'imported' ? '' : item.category ? ` · ${escapeHtml(item.category)}` : ''}${escapeHtml(smartMeta)}</div></div>
                ${headerActions}
            </div>
            ${previews.map(preview => `<div class="preview ${preview.type === 'negative' ? 'negative' : ''}">${escapeHtml(preview.text)}</div>`).join('')}
            ${kind === 'imported' ? renderImportedCardFacts(item, primaryVariant) : ''}
            ${lowerActions ? `<div class="card-actions ${kind === 'imported' ? 'imported-card-actions' : ''}">${lowerActions}</div>` : ''}`;
        const variantNavigation = kind === 'imported' && variants.length > 1 ? `<div class="card-variant-navigation"><button class="card-variant-arrow" data-action="card-variant-previous" data-id="${escapeAttr(item.id)}" aria-label="Previous variant">←</button><span>${Math.max(1, variants.findIndex(entry => entry.id === primaryVariant?.id) + 1)} / ${variants.length}</span><button class="card-variant-arrow" data-action="card-variant-next" data-id="${escapeAttr(item.id)}" aria-label="Next variant">→</button></div>` : '';
        return `<article class="card selectable ${kind === 'imported' ? 'imported-card' : ''} ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}" data-card-kind="${kind}" data-card-id="${escapeAttr(item.id)}" data-card-compact="${compact ? 'true' : 'false'}" ${displayVariant?.id ? `data-open-variant-id="${escapeAttr(displayVariant.id)}"` : ''}>${showThumbnail ? `<div class="card-with-thumb"><div class="card-media">${renderThumbnailFrame(item, 'medium', 'No preview', primaryVariant)}${variantNavigation}</div><div>${body}</div></div>` : body}</article>`;
    }

    function getItemVariants(item) {
        return Array.isArray(item?.variants) ? item.variants.filter(Boolean) : [];
    }

    function getPrimaryVariant(item) {
        const variants = getItemVariants(item);
        return variants.find(variant => variant.id === item?.primaryVariantId) || variants[0] || null;
    }

    function findVariant(item, variantId) {
        return getItemVariants(item).find(variant => variant.id === variantId) || getPrimaryVariant(item);
    }

    function bestVariantImageUrl(variant) {
        return variantImageCandidates(variant)[0] || '';
    }

    function variantImageCandidates(variant, purpose = 'detail') {
        if (!variant) return [];
        const site = variant.sources?.[0]?.site || SITE;
        const sources = variant.sources || [];
        const sample = [variant.image?.sampleUrl, ...sources.map(source => source.sampleUrl), ...sources.map(source => source.imageUrl)];
        const preview = [variant.image?.previewUrl, ...sources.map(source => source.previewUrl)];
        const file = [variant.image?.fileUrl, ...sources.map(source => source.fileUrl)];
        const ordered = [...sample, ...file, ...preview];
        return [...new Set(ordered.map(url => absoluteBooruUrl(url, site)).filter(Boolean))];
    }

    function postImageCandidates(post, purpose = 'thumbnail') {
        if (!post) return [];
        const preview = [post.previewUrl];
        const sample = [post.sampleUrl, post.imageUrl];
        const file = [post.fileUrl];
        const ordered = [...sample, ...file, ...preview];
        return [...new Set(ordered.map(url => absoluteBooruUrl(url, post.site)).filter(Boolean))];
    }

    function renderThumbnailFrame(item, size = 'small', fallbackText = 'No preview', variant = null) {
        const thumbnail = variant?.thumbnail || (!variant ? getPrimaryVariant(item)?.thumbnail : null) || item?.thumbnail;
        const targetVariant = variant || getPrimaryVariant(item);
        const candidates = variantImageCandidates(targetVariant, 'thumbnail');
        const allowNetwork = size === 'detail';
        if (!thumbnail?.key && (!candidates.length || !allowNetwork)) return `<div class="thumb-frame ${size}"><span class="thumb-placeholder">${escapeHtml(candidates.length ? 'Local preview missing' : fallbackText)}</span>${candidates.length ? '<span class="image-state-badge">MISSING</span>' : ''}</div>`;
        return `<div class="thumb-frame ${size}"><img ${thumbnail?.key ? `data-thumbnail-key="${escapeAttr(thumbnail.key)}" data-thumbnail-version="${escapeAttr(thumbnail.createdAt || thumbnail.hash || thumbnail.sizeBytes || '')}"` : ''} ${allowNetwork && candidates.length ? `data-list-image-urls="${escapeAttr(JSON.stringify(candidates))}"` : ''} data-thumbnail-owner-id="${escapeAttr(item.id || '')}" data-thumbnail-variant-id="${escapeAttr(targetVariant?.id || '')}" alt="Thumbnail" loading="lazy"><span class="thumb-placeholder">Loading …</span></div>`;
    }

    function getItemPreviews(kind, item, variant = null) {
        if (kind === 'character' || kind === 'base' || kind === 'style') {
            return [
                item.positive ? { type: 'positive', text: `+ ${item.positive}` } : null,
                item.negative ? { type: 'negative', text: `− ${item.negative}` } : null
            ].filter(Boolean);
        }
        if (kind === 'fullImage') {
            const characterPreview = (item.characters || []).map((character, index) => `C${index + 1}: ${character.positive || ''}${character.negative ? ` / UC: ${character.negative}` : ''}`).join(' · ');
            return [
                item.basePositive ? { type: 'positive', text: `Base + ${item.basePositive}` } : null,
                item.baseNegative ? { type: 'negative', text: `Base − ${item.baseNegative}` } : null,
                characterPreview ? { type: 'positive', text: characterPreview } : null
            ].filter(Boolean);
        }
        if (kind === 'imported') return [{ type: item.type, text: variant?.tags || item.tags || '' }];
        if (kind === 'set') {
            const parts = tagSetParts(item);
            return [
                parts.positive ? { type: 'positive', text: `+ ${parts.positive}` } : null,
                parts.negative ? { type: 'negative', text: `− ${parts.negative}` } : null
            ].filter(Boolean);
        }
        return [{ type: item.type, text: item.tag || '' }];
    }

    function renderRecentRow(wrapper) {
        const item = wrapper.item;
        const title = item.name || item.label || item.tag || 'Untitled';
        return `<div class="list-row"><div><div class="list-name">${escapeHtml(title)}</div><div class="list-meta">${escapeHtml(kindLabel(wrapper.kind))} · ${formatRelative(wrapper.at)}</div></div><div class="actions">${IS_NAI ? `<button class="btn small" data-action="apply-item" data-kind="${wrapper.kind}" data-id="${escapeAttr(item.id)}">Append</button>` : ''}</div></div>`;
    }

    function renderHistoryRow(entry) {
        const preview = entry.fields.map(field => `${field.label}: ${field.value}`).join(' · ');
        return `<div class="history-row"><div class="history-time">${formatDate(entry.timestamp)}</div><div><div class="history-title">${escapeHtml(entry.label || 'Prompt State')}</div><div class="history-preview">${escapeHtml(preview.slice(0, 500))}</div></div><div class="actions"><button class="btn small" data-action="restore-history" data-id="${escapeAttr(entry.id)}">Restore</button><button class="btn ghost small" data-action="delete-history" data-id="${escapeAttr(entry.id)}">Delete</button></div></div>`;
    }

    function collectFavoriteItems() {
        return [
            ...data.characters.filter(item => item.favorite).map(item => ({ kind: 'character', item })),
            ...data.sets.filter(item => item.favorite).map(item => ({ kind: isImportedItem(item) ? 'imported' : 'set', item })),
            ...data.bases.filter(item => item.favorite).map(item => ({ kind: 'base', item })),
            ...data.styleArtists.filter(item => item.favorite || item.styleFavorite).map(item => ({ kind: 'style', item })),
            ...data.fullImages.filter(item => item.favorite).map(item => ({ kind: 'fullImage', item })),
            ...data.favoriteTags.filter(item => item.favorite !== false).map(item => ({ kind: 'tag', item }))
        ];
    }

    function resolveRecentItems() {
        return data.recent.map(record => {
            const item = findItem(record.kind, record.id);
            const kind = record.kind === 'set' && isImportedItem(item) ? 'imported' : record.kind;
            return item ? { kind, item, at: record.at } : null;
        }).filter(Boolean);
    }

    function sortItems(items) {
        return [...items].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || String(a.name || a.label || a.tag || '').localeCompare(String(b.name || b.label || b.tag || ''), 'en'));
    }

    function kindLabel(kind) {
        return ({ character: 'Character', set: 'Tag Set', imported: 'Imported Image', base: 'Base Profile', style: 'Style/Artist', fullImage: 'Full Image', tag: 'Tag' })[kind] || kind;
    }


    function renderBooruFloating() {
        return '';
    }

    function renderBooruQuickBox() {
        return `<section class="box booru-box"><div class="box-title"><span>${escapeHtml(siteDisplayName())} Tools</span></div>${state.booruPost ? `<div class="list-meta">Post ${escapeHtml(String(state.booruPost.postId))} · ${countPostTags(state.booruPost)} tags detected</div><div class="actions" style="margin-top:9px"><button class="btn primary" data-action="booru-import">Select / Save Tags</button><button class="btn" data-action="reload-booru">Reload</button></div>` : `<div class="list-meta">${state.booruLoading ? 'Loading tags …' : 'No post has been loaded on this page yet.'}</div><div class="actions" style="margin-top:9px"><button class="btn primary" data-action="reload-booru">Load Tags</button></div>`}</section>`;
    }

    function renderBooruTab() {
        return `
            <div class="section-head"><div><h2 class="section-title">${escapeHtml(siteDisplayName())} Tools</h2><div class="section-subtitle">Copy useful tag groups or save selected post tags to the shared NovelAI library.</div></div><div class="actions"><button class="btn" data-action="reload-booru">Reload</button></div></div>
            ${state.booruLoading ? '<div class="notice">Loading post data …</div>' : ''}
            ${state.booruPost ? renderBooruPostSummary() : '<div class="empty">No supported post detected. Open an individual image post.</div>'}
        `;
    }

    function renderBooruPostSummary() {
        const post = state.booruPost;
        return `<section class="booru-box"><div class="box-title"><strong>${escapeHtml(siteDisplayName())} Post ${escapeHtml(String(post.postId))}</strong><span class="list-meta">${post.width && post.height ? `${post.width} × ${post.height}` : `${countPostTags(post)} tags`}</span></div><div class="booru-stats">${Object.entries(post.groups).map(([key, tags]) => `<span class="stat">${escapeHtml(CATEGORY_LABELS[key] || key)}: ${tags.length}</span>`).join('')}</div><div class="actions" style="margin-top:12px"><button class="btn primary" data-action="booru-import">Select / Save Tags</button><button class="btn" data-action="copy-booru-tags">Copy Profile Tags</button><div class="menu-wrap"><button class="btn icon" data-action="toggle-menu" data-menu="booru-copy" aria-expanded="false" title="More copy actions">⋯</button><div class="overflow-menu" data-menu-panel="booru-copy" hidden><button class="menu-item" data-action="copy-booru-artist">Copy Artist</button><button class="menu-item" data-action="copy-booru-character-copyright">Copy Character + Copyright</button><button class="menu-item" data-action="copy-booru-general">Copy General</button><button class="menu-item" data-action="copy-booru-text">Copy Text</button><button class="menu-item" data-action="copy-booru-without-text">Copy All without Text</button><button class="menu-item" data-action="copy-booru-scene">Copy Scene / Action / Style</button></div></div></div></section>`;
    }

    function renderModal() {
        if (!state.modal) return '';
        if (state.modal === 'edit-item') return renderEditModal();
        if (state.modal === 'booru-import') return renderBooruImportModal();
        if (state.modal === 'import-data') return renderImportModal();
        if (state.modal === 'from-prompt') return renderFromPromptModal();
        if (state.modal === 'character-import') return renderCharacterImportModal();
        if (state.modal === 'item-details') return renderItemDetailsModalV3();
        if (state.modal === 'full-image-apply') return renderFullImageApplyModal();
        if (state.modal === 'export-options') return renderExportOptionsModal();
        if (state.modal === 'booru-duplicate') return renderBooruDuplicateModal();
        if (state.modal === 'source-tag-diff') return renderSourceTagDiffModal();
        if (state.modal === 'booru-batch-import') return renderBooruBatchImportModal();
        if (state.modal === 'attach-source') return renderAttachSourceModal();
        if (state.modal === 'bulk-category') return renderBulkCategoryModal();
        if (state.modal === 'thumbnail-category') return renderThumbnailCategoryModal();
        if (state.modal === 'health-check') return renderHealthCheckModalV3();
        if (state.modal === 'collection-edit') return renderCollectionEditModal();
        if (state.modal === 'collection-picker') return renderCollectionPickerModal();
        if (state.modal === 'collection-entry-picker') return renderCollectionEntryPickerModal();
        if (state.modal === 'bulk-image-refresh') return renderBulkImageRefreshModalV3();
        if (state.modal === 'import-rename') return renderImportRenameModal();
        if (state.modal === 'merge-variants') return renderMergeVariantsModal();
        if (state.modal === 'style-profile') return renderStyleProfileModal();
        if (state.modal === 'style-tags') return renderStyleTagCollectionModal();
        if (state.modal === 'style-upload-preview') return renderStyleUploadPreviewModal();
        if (state.modal === 'style-local-image') return renderLocalStyleImageModal();
        if (state.modal === 'style-image-detail') return renderStyleImageDetailModal();
        if (state.modal === 'style-tag-images') return renderStyleTagImagesModal();
        if (state.modal === 'confirm') return renderConfirmModal();
        return '';
    }



    function renderVariantComparison(item, variants) {
        const left = variants.find(variant => variant.id === state.compareLeftId) || variants[0];
        const right = variants.find(variant => variant.id === state.compareRightId) || variants.find(variant => variant.id !== left?.id) || variants[1];
        state.compareLeftId = left?.id || '';
        state.compareRightId = right?.id || '';
        const options = selected => variants.map((variant, index) => `<option value="${escapeAttr(variant.id)}" ${variant.id === selected?.id ? 'selected' : ''}>${escapeHtml(variant.label || `Variant ${index + 1}`)}</option>`).join('');
        const leftUrls = variantImageCandidates(left, 'detail');
        const rightUrls = variantImageCandidates(right, 'detail');
        const pane = (variant, urls, label, opacity = 100) => `<div class="compare-pane"><img data-detail-image-urls="${escapeAttr(JSON.stringify(urls))}" ${variant?.thumbnail?.key ? `data-detail-thumbnail-key="${escapeAttr(variant.thumbnail.key)}"` : ''} data-thumbnail-owner-id="${escapeAttr(item.id)}" data-thumbnail-variant-id="${escapeAttr(variant?.id || '')}" alt="${escapeAttr(label)}" style="opacity:${opacity / 100}"><span class="thumb-placeholder">Loading ${escapeHtml(label)} …</span></div>`;
        const overlay = `<div class="compare-pane"><img data-detail-image-urls="${escapeAttr(JSON.stringify(leftUrls))}" ${left?.thumbnail?.key ? `data-detail-thumbnail-key="${escapeAttr(left.thumbnail.key)}"` : ''} data-thumbnail-owner-id="${escapeAttr(item.id)}" data-thumbnail-variant-id="${escapeAttr(left?.id || '')}" alt="Left variant"><img data-detail-image-urls="${escapeAttr(JSON.stringify(rightUrls))}" ${right?.thumbnail?.key ? `data-detail-thumbnail-key="${escapeAttr(right.thumbnail.key)}"` : ''} data-thumbnail-owner-id="${escapeAttr(item.id)}" data-thumbnail-variant-id="${escapeAttr(right?.id || '')}" alt="Right variant" style="opacity:${Math.max(0, Math.min(100, state.compareOpacity)) / 100}"><span class="thumb-placeholder">Loading comparison …</span></div>`;
        return `<div class="variant-strip"><div class="field" style="flex:1;min-width:170px"><label>Left / base</label><select data-setting="compare-left">${options(left)}</select></div><div class="field" style="flex:1;min-width:170px"><label>Right / overlay</label><select data-setting="compare-right">${options(right)}</select></div><div class="field" style="min-width:150px"><label>Mode</label><select data-setting="compare-mode"><option value="side" ${state.compareMode === 'side' ? 'selected' : ''}>Side by side</option><option value="overlay" ${state.compareMode === 'overlay' ? 'selected' : ''}>Overlay</option></select></div><button class="btn small" data-action="toggle-variant-compare">Close</button></div>${state.compareMode === 'overlay' ? `<div class="field"><label>Overlay opacity: ${state.compareOpacity}%</label><input type="range" min="0" max="100" value="${state.compareOpacity}" data-setting="compare-opacity"></div><div class="compare-stage overlay">${overlay}</div>` : `<div class="compare-stage">${pane(left, leftUrls, 'left variant')}${pane(right, rightUrls, 'right variant')}</div>`}`;
    }

    function renderFullImageApplyModal() {
        const payload = state.modalPayload || {};
        const item = findItem('fullImage', payload.id);
        if (!item) return '';
        const part = (key, label, hasValue = true) => `<label class="check-row"><input type="checkbox" data-full-part="${escapeAttr(key)}" checked ${hasValue ? '' : 'disabled'}><span>${escapeHtml(label)}${hasValue ? '' : ' (empty)'}</span></label>`;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal"><div class="modal-head"><div class="modal-title">${payload.replace ? 'Replace with' : 'Append'} “${escapeHtml(item.name)}”</div><button class="icon-action" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice">Choose exactly which saved prompt fields should be applied. Unknown character types are reviewed once and saved.</div><section class="box"><div class="box-title"><span>Main fields</span></div>${part('basePositive', 'Main Prompt', Boolean(item.basePositive))}${part('baseNegative', 'Main Undesired Content', Boolean(item.baseNegative))}</section>${(item.characters || []).map((character, index) => `<section class="box"><div class="box-title"><span>${escapeHtml(character.name || `Character ${index + 1}`)}</span><span class="list-meta">Character ${index + 1}</span></div>${normalizeCharacterType(character.naiCharacterType) === 'unknown' ? `<div class="field"><label>NovelAI character type</label><select data-full-character-type="${index}"><option value="unknown">Choose…</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div>` : `<div class="list-meta">${characterTypeLabel(character.naiCharacterType)}</div>`}${part(`character:${index}:positive`, 'Prompt', Boolean(character.positive))}${part(`character:${index}:negative`, 'Undesired Content', Boolean(character.negative))}</section>`).join('')}</div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-full-image-apply">${payload.replace ? 'Replace selected fields' : 'Append selected fields'}</button></div></div></div>`;
    }

    function renderExportOptionsModal() {
        const selectedOnly = Boolean(state.modalPayload?.selectedOnly);
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal" style="width:min(520px,100%)"><div class="modal-head"><div class="modal-title">Export ${selectedOnly ? 'Selected Entries' : 'Ainz Toolkit Data'}</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice">All export options are enabled by default.</div><label class="check-row"><input id="export-source-info" type="checkbox" checked><span>Include source information</span></label><label class="check-row"><input id="export-thumbnails" type="checkbox" checked><span>Include local images</span></label></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="perform-export">Create JSON Export</button></div></div></div>`;
    }

    function renderBooruDuplicateModal() {
        const payload = state.modalPayload || {};
        const existing = findItem(payload.existingKind, payload.existingId);
        const candidate = payload.candidate;
        if (!existing || !candidate) return '';
        const existingTitle = existing.name || existing.label || existing.tag || 'Existing entry';
        const canAddSource = Boolean(candidate.saveSource && candidate.source) && !sourceExists(existing, candidate.source);
        const existingVariant = findVariant(existing, payload.existingVariantId);
        const existingPreview = payload.existingPreviewDataUrl
            ? `<div class="thumb-frame detail"><img src="${escapeAttr(payload.existingPreviewDataUrl)}" alt="Existing thumbnail"></div>`
            : renderThumbnailFrame(existing, 'detail', 'No available preview', existingVariant);
        const reasons = (payload.reasons || []).map(reason => `<span class="chip">${escapeHtml(reason)}</span>`).join('');
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div class="modal-title">${payload.matchType === 'source' ? 'This source is already saved' : payload.matchType === 'variant' ? 'Possible image variant found' : 'Visually similar image found'}</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice warn">Review both images before deciding. Similarity and metadata never merge entries automatically.</div>${reasons ? `<div class="chips" style="margin-bottom:11px">${reasons}</div>` : ''}<div class="duplicate-images"><div><strong>Existing: ${escapeHtml(existingTitle)}</strong>${existingPreview}</div><div><strong>New import</strong><div class="thumb-frame detail">${candidate.thumbnailDataUrl ? `<img src="${escapeAttr(candidate.thumbnailDataUrl)}" alt="New thumbnail">` : '<span class="thumb-placeholder">No preview</span>'}</div></div></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn" data-action="save-duplicate-separately">Save separately</button>${payload.matchType !== 'source' ? '<button class="btn primary" data-action="add-duplicate-variant">Add as variant</button>' : ''}${canAddSource ? '<button class="btn primary" data-action="add-duplicate-source">Add new source to existing variant</button>' : ''}</div></div></div>`;
    }

    function renderSourceTagDiffModal() {
        const payload = state.modalPayload || {};
        const diff = payload.diff || { added: [], removed: [], unchanged: [] };
        const group = (title, tags, className = '') => `<section class="box"><div class="box-title"><span>${title}</span><span class="list-meta">${tags.length}</span></div>${tags.length ? `<div class="tag-grid">${tags.map(tag => `<label class="tag-toggle ${className}"><input type="checkbox" data-diff-tag="${escapeAttr(tag)}" data-diff-kind="${title.toLowerCase().startsWith('new') ? 'added' : 'removed'}" ${title.toLowerCase().startsWith('new') ? 'checked' : ''}> ${escapeHtml(tag)}</label>`).join('')}</div>` : '<div class="list-meta">None</div>'}</section>`;
        const metadata = payload.metadataChanges || [];
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div class="modal-title">Source Update Preview</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice">Nothing changes until you apply the selected differences.</div><div class="import-summary"><div class="summary-card"><div class="summary-value">${diff.added.length}</div><div class="summary-label">New tags</div></div><div class="summary-card"><div class="summary-value">${diff.removed.length}</div><div class="summary-label">Removed tags</div></div><div class="summary-card"><div class="summary-value">${metadata.length}</div><div class="summary-label">Metadata changes</div></div></div>${group('New tags', diff.added)}${group('Removed tags', diff.removed, 'filtered')}${metadata.length ? `<section class="box"><div class="box-title"><span>Image and source information</span><span class="list-meta">${metadata.length}</span></div><label class="check-row"><input id="apply-source-metadata" type="checkbox" checked><span>Apply the metadata changes shown below</span></label>${metadata.map(change => `<div class="source-row" style="margin-top:7px"><strong>${escapeHtml(change.label)}</strong><div class="list-meta">${escapeHtml(change.before || 'Not stored')} → ${escapeHtml(change.after || 'Empty')}</div></div>`).join('')}</section>` : ''}<section class="box"><div class="box-title"><span>Unchanged tags</span><span class="list-meta">${diff.unchanged.length}</span></div><div class="chips">${diff.unchanged.slice(0, 120).map(tag => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}${diff.unchanged.length > 120 ? `<span class="chip">+${diff.unchanged.length - 120} more</span>` : ''}</div></section></div><div class="modal-foot"><button class="btn" data-action="close-modal">Keep saved data</button><button class="btn primary" data-action="apply-source-tag-diff">Apply selected changes</button></div></div></div>`;
    }

    function renderBulkCategoryModal() {
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal" style="width:min(480px,100%)"><div class="modal-head"><div class="modal-title">Move Selected Entries</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="field"><label>Category</label><input id="bulk-category-name" maxlength="100" placeholder="Category name"></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="apply-bulk-category">Move</button></div></div></div>`;
    }

    function renderThumbnailCategoryModal() {
        const categories = [...new Set(allLibraryWrappers().map(wrapper => wrapper.item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal" style="width:min(480px,100%)"><div class="modal-head"><div class="modal-title">Remove Category Local Images</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="field"><label>Category</label><select id="thumbnail-category-name">${categories.map(category => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join('')}</select></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="confirm-remove-category-thumbnails">Remove local images</button></div></div></div>`;
    }

    function renderEditModal() {
        const payload = state.modalPayload || {};
        const kind = payload.kind;
        const item = payload.item || blankItem(kind);
        const isEdit = Boolean(payload.editingId);
        const variant = kind === 'imported' && state.modalPayload?.variantId ? findVariant(findItem(kind, state.modalPayload.editingId), state.modalPayload.variantId) : null;
        const title = `${isEdit ? 'Edit' : 'New'}: ${kindLabel(kind)}${variant ? ` · ${variant.label}` : ''}`;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><form class="modal ${kind === 'fullImage' ? 'large' : ''}" data-form="edit-item"><div class="modal-head"><div class="modal-title">${escapeHtml(title)}</div><button type="button" class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body">${renderEditFields(kind, item)}</div><div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${isEdit ? 'Save' : 'Create'}</button></div></form></div>`;
    }

    function renderEditFields(kind, item) {
        const commonName = `<div class="field"><label>Name</label><input name="name" required maxlength="160" value="${escapeAttr(item.name || item.label || '')}" placeholder="Custom name"></div>`;
        const category = `<div class="field"><label>Category</label><input name="category" maxlength="100" value="${escapeAttr(item.category || '')}" placeholder="e.g. Characters, Lighting, Imported"></div>`;
        const notes = `<div class="field wide"><label>Notes</label><textarea name="notes" style="min-height:75px" placeholder="Optional and searchable">${escapeHtml(item.notes || '')}</textarea></div>`;
        const favorite = `<label class="check-row wide"><input type="checkbox" name="favorite" ${item.favorite ? 'checked' : ''}><span>Mark as favorite</span></label>`;

        if (kind === 'character' || kind === 'base' || kind === 'style') {
            const positiveLabel = kind === 'style' ? 'Style / Artist Tags' : 'Positive Tags';
            const characterType = kind === 'character'
                ? `<div class="field"><label>NovelAI Character Type</label><select name="naiCharacterType"><option value="unknown" ${normalizeCharacterType(item.naiCharacterType) === 'unknown' ? 'selected' : ''}>Unknown · choose before adding</option><option value="female" ${normalizeCharacterType(item.naiCharacterType) === 'female' ? 'selected' : ''}>Female</option><option value="male" ${normalizeCharacterType(item.naiCharacterType) === 'male' ? 'selected' : ''}>Male</option><option value="other" ${normalizeCharacterType(item.naiCharacterType) === 'other' ? 'selected' : ''}>Other</option></select><div class="field-help">NovelAI does not expose the type of existing panels. Unknown is kept instead of guessing Female.</div></div><div></div>`
                : '';
            return `<div class="form-grid">${commonName}${category}${characterType}<div class="field wide"><label>${positiveLabel}</label><textarea name="positive" placeholder="artist name, watercolor, painterly, …">${escapeHtml(item.positive || '')}</textarea></div><div class="field wide"><label>Negative Tags</label><textarea name="negative" placeholder="Optional negative tags">${escapeHtml(item.negative || '')}</textarea></div>${notes}${favorite}</div>`;
        }

        if (kind === 'set') {
            const parts = tagSetParts(item);
            return `<div class="form-grid">${commonName}${category}<div class="field"><label>Type</label><select name="type" id="tag-set-type"><option value="positive" ${parts.type === 'positive' ? 'selected' : ''}>Positive</option><option value="negative" ${parts.type === 'negative' ? 'selected' : ''}>Negative</option><option value="combined" ${parts.type === 'combined' ? 'selected' : ''}>Positive + Negative</option></select></div><div></div><div class="field wide" data-tag-set-field="positive" ${parts.type === 'negative' ? 'hidden' : ''}><label>Positive Tags</label><textarea name="positiveTags" placeholder="Tags for the Main Prompt">${escapeHtml(parts.positive)}</textarea></div><div class="field wide" data-tag-set-field="negative" ${parts.type === 'positive' ? 'hidden' : ''}><label>Negative Tags</label><textarea name="negativeTags" placeholder="Tags for Main Undesired Content">${escapeHtml(parts.negative)}</textarea></div>${notes}${favorite}</div>`;
        }

        if (kind === 'imported') {
            return `<div class="form-grid">${commonName}${category}<div class="field wide"><label>Tags</label><textarea name="tags" required placeholder="Separate tags with commas">${escapeHtml(item.tags || '')}</textarea></div>${notes}${favorite}</div>`;
        }

        if (kind === 'fullImage') {
            const characters = Array.isArray(item.characters) ? item.characters : [];
            return `<div class="form-grid">${commonName}${category}<div class="field wide"><label>Base Prompt</label><textarea name="basePositive" placeholder="Base positive prompt">${escapeHtml(item.basePositive || '')}</textarea></div><div class="field wide"><label>Base Undesired Content</label><textarea name="baseNegative" placeholder="Base negative prompt">${escapeHtml(item.baseNegative || '')}</textarea></div><div class="field wide"><label>Character Prompts</label><textarea name="charactersJson" style="min-height:210px" spellcheck="false">${escapeHtml(JSON.stringify(characters, null, 2))}</textarea><div class="field-help">Advanced field. Each character uses name, positive and negative. Keep valid JSON.</div></div>${notes}${favorite}</div>`;
        }

        return `<div class="form-grid"><div class="field"><label>Display Name / Alias</label><input name="name" maxlength="160" value="${escapeAttr(item.label || item.name || '')}" placeholder="e.g. Blunt Bangs"></div>${category}<div class="field"><label>Type</label><select name="type"><option value="positive" ${item.type !== 'negative' ? 'selected' : ''}>Positive</option><option value="negative" ${item.type === 'negative' ? 'selected' : ''}>Negative</option></select></div><div></div><div class="field wide"><label>Actual Tag</label><input name="tag" required value="${escapeAttr(item.tag || '')}" placeholder="blunt bangs"></div>${notes}${favorite}</div>`;
    }

    function renderBooruImportModal() {
        const post = state.booruPost;
        if (!post) return '';
        const selectedCount = state.booruPreviewSelection.size;
        const textCount = (state.booruPreviewGroups.text || []).filter(tag => state.booruPreviewSelection.has(tag)).length;
        const exactMatch = findSourceDuplicate(postToSource(post));
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div class="modal-title">Select Tags from ${escapeHtml(siteDisplayName())}</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body">
            <div class="form-grid" style="margin-bottom:12px"><div class="field"><label>Set Name</label><input id="booru-set-name" value="${escapeAttr(state.booruDraft.name || suggestBooruName(post))}"></div><div class="field"><label>Category</label><input id="booru-set-category" value="${escapeAttr(state.booruDraft.category || 'Imported')}"></div><label class="check-row"><input id="booru-favorite" type="checkbox" ${state.booruDraft.favorite ? 'checked' : ''}><span>Mark as favorite</span></label><div></div><label class="check-row"><input id="booru-save-source" type="checkbox" ${state.booruDraft.saveSource ? 'checked' : ''}><span>Save source information</span></label><label class="check-row"><input id="booru-save-thumbnail" type="checkbox" ${state.booruDraft.saveThumbnail ? 'checked' : ''}><span>Save local image</span></label><div class="actions wide" style="justify-content:flex-end"><button class="btn small" data-action="booru-select-all">Select All</button><button class="btn small" data-action="booru-select-none">Select None</button></div></div>
            <div class="import-summary"><div class="summary-card"><div class="summary-value">${selectedCount}</div><div class="summary-label">Selected tags</div></div><div class="summary-card"><div class="summary-value">${state.booruRemoved.length}</div><div class="summary-label">Filtered tags</div></div><div class="summary-card"><div class="summary-value">${textCount}</div><div class="summary-label">Text tags</div></div><div class="summary-card"><div class="summary-value">${post.width && post.height ? `${post.width}×${post.height}` : '—'}</div><div class="summary-label">Image resolution</div></div><div class="summary-card"><div class="summary-value">${state.booruImportThumbnail ? formatBytes(state.booruImportThumbnail.sizeBytes) : '…'}</div><div class="summary-label">Local image storage</div></div></div>
            <div class="notice ${exactMatch ? 'warn' : ''}">${exactMatch ? `This ${escapeHtml(siteDisplayName())} post already exists in “${escapeHtml(exactMatch.item.name || exactMatch.item.label || 'an entry')}”. You will choose what happens after Save.` : `Censorship tags are excluded automatically; <strong>uncensored</strong> remains included.`} The local image is generated only when you save.</div>
            ${Object.entries(state.booruPreviewGroups).map(([group, tags]) => renderBooruTagGroup(group, tags)).join('')}
            ${state.booruRemoved.length ? `<div class="removed-box"><strong>Automatically Removed (${state.booruRemoved.length})</strong><div class="chips">${state.booruRemoved.map(entry => `<span class="chip">${escapeHtml(entry.tag)} · ${escapeHtml(entry.reason)}</span>`).join('')}</div></div>` : ''}
        </div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn" data-action="copy-booru-selected" ${selectedCount ? '' : 'disabled'}>Copy Selected</button><button class="btn primary" data-action="save-booru-set" ${selectedCount ? '' : 'disabled'}>Save Import</button></div></div></div>`;
    }

    function renderBooruBatchImportModal() {
        const records = state.booruBatchQueue || [];
        const ready = records.filter(record => record.candidate).length;
        const duplicates = records.filter(record => record.match).length;
        const failed = records.filter(record => record.error).length;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div><div class="modal-title">Batch Import Preview</div><div class="list-meta">${escapeHtml(siteDisplayName())} · ${records.length} selected posts</div></div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice">Nothing is merged automatically. Review the proposed action for every possible duplicate or variant.</div><div class="import-summary"><div class="summary-card"><div class="summary-value">${ready}</div><div class="summary-label">Ready</div></div><div class="summary-card"><div class="summary-value">${duplicates}</div><div class="summary-label">Matches found</div></div><div class="summary-card"><div class="summary-value">${failed}</div><div class="summary-label">Could not load</div></div></div><label class="check-row"><input id="batch-save-source" type="checkbox" ${state.booruDraft.saveSource ? 'checked' : ''}><span>Save source information</span></label><label class="check-row"><input id="batch-save-thumbnail" type="checkbox" ${state.booruDraft.saveThumbnail ? 'checked' : ''}><span>Save local images</span></label><div class="list" style="margin-top:12px">${records.map((record, index) => {
            if (record.error) return `<div class="source-row"><strong>Post #${escapeHtml(record.postId)}</strong><div class="list-meta">${escapeHtml(record.error)}</div></div>`;
            const matchTitle = record.match ? record.match.item.name || record.match.item.label || 'existing entry' : '';
            const action = record.action || (record.match ? 'skip' : 'import');
            const matchedVariant = record.match ? findVariant(record.match.item, record.match.variantId) : null;
            const canAddSource = Boolean(record.match && record.candidate?.source && !matchedVariant?.sources?.some(source => sourceIdentityMatches(source, record.candidate.source)));
            return `<div class="source-row" style="display:grid;grid-template-columns:auto minmax(0,1fr) minmax(145px,.38fr);gap:10px;align-items:center"><div class="thumb-frame small">${record.candidate?.thumbnailDataUrl ? `<img src="${escapeAttr(record.candidate.thumbnailDataUrl)}" alt="Post ${escapeAttr(record.postId)}">` : '<span class="thumb-placeholder">No preview</span>'}</div><div><strong>${escapeHtml(record.candidate?.item?.name || `Post #${record.postId}`)}</strong><div class="list-meta">${record.candidate ? splitPrompt(record.candidate.item.tags).length : 0} tags${record.match ? ` · possible match: ${escapeHtml(matchTitle)}` : ' · new entry'}</div>${record.match?.reasons?.length ? `<div class="chips">${record.match.reasons.map(reason => `<span class="chip">${escapeHtml(reason)}</span>`).join('')}</div>` : ''}</div><div class="field"><label>Action</label><select data-batch-action="${index}"><option value="import" ${action === 'import' ? 'selected' : ''}>Save separately</option>${record.match ? `<option value="variant" ${action === 'variant' ? 'selected' : ''}>Add as variant</option>${canAddSource ? `<option value="source" ${action === 'source' ? 'selected' : ''}>Add source</option>` : ''}<option value="skip" ${action === 'skip' ? 'selected' : ''}>Skip</option>` : ''}</select></div></div>`;
        }).join('')}</div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="perform-booru-batch" ${ready ? '' : 'disabled'}>Run Batch Import</button></div></div></div>`;
    }

    function renderAttachSourceModal() {
        const entries = getImportedWrappers().filter(wrapper => wrapper.kind !== 'tag');
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal"><div class="modal-head"><div class="modal-title">Add Current Post to Existing Entry</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice">Choose whether the post is another source for the same image or a separate image variant.</div><div class="field"><label>Entry</label><select id="attach-source-entry">${entries.map(wrapper => `<option value="${escapeAttr(wrapper.kind)}:${escapeAttr(wrapper.item.id)}">${escapeHtml(wrapper.item.name || wrapper.item.label || 'Untitled')} · ${getItemVariants(wrapper.item).length || 1} variant(s)</option>`).join('')}</select></div><div class="field" style="margin-top:10px"><label>How to attach</label><select id="attach-source-mode"><option value="variant">Add as a new variant</option><option value="source">Add as another source to the primary variant</option></select></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-attach-source" ${entries.length ? '' : 'disabled'}>Add Post</button></div></div></div>`;
    }

    function renderBooruTagGroup(group, tags) {
        const collapsed = state.collapsedGroups.has(group);
        const selectedInGroup = tags.filter(tag => state.booruPreviewSelection.has(tag)).length;
        return `<section class="tag-group"><div class="tag-group-head" data-action="toggle-booru-group" data-group="${escapeAttr(group)}"><strong>${escapeHtml(CATEGORY_LABELS[group] || group)}</strong><span class="list-meta">${selectedInGroup}/${tags.length} ${collapsed ? '▸' : '▾'}</span></div>${collapsed ? '' : `<div class="tag-grid">${tags.map(tag => `<button class="tag-toggle ${state.booruPreviewSelection.has(tag) ? 'selected' : ''}" data-action="toggle-booru-tag" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>`}</section>`;
    }

    function renderImportModal() {
        const preview = state.importPreview;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal"><div class="modal-head"><div class="modal-title">Import Library Data</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body">${preview ? `<div class="notice">File checked · data schema ${escapeHtml(String(preview.data.schemaVersion || '?'))}</div><div class="booru-stats"><span class="stat">${preview.data.characters.length} characters</span><span class="stat">${preview.data.sets.length} sets</span><span class="stat">${preview.data.bases.length} bases</span><span class="stat">${preview.data.styleArtists.length} styles</span><span class="stat">${preview.data.fullImages.length} full images</span><span class="stat">${preview.data.favoriteTags.length} tags</span><span class="stat">${preview.data.history.length} history entries</span></div><div class="field" style="margin-top:13px"><label>Import mode</label><select id="import-mode"><option value="merge">Merge with current library</option><option value="replace">Replace the entire current library</option></select><div class="field-help">The replacement is verified transactionally before it becomes active.</div></div>` : `<div class="empty">Choose a previously exported JSON file.</div><div class="actions" style="justify-content:center;margin-top:12px"><button class="btn primary" data-action="pick-import-file">Choose JSON File</button></div>`}</div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button>${preview ? '<button class="btn primary" data-action="perform-import">Import</button>' : ''}</div></div></div>`;
    }

    function renderFromPromptModal() {
        const payload = state.modalPayload || {};
        const hasPositive = Boolean(payload.positive?.trim());
        const hasNegative = Boolean(payload.negative?.trim());
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal" style="width:min(620px,100%)"><div class="modal-head"><div class="modal-title">Save from Current Prompt</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice">${hasPositive ? 'A positive target is filled.' : 'The positive target is empty.'} ${hasNegative ? 'A negative target is filled.' : 'The negative target is empty.'}</div><div class="grid"><button class="btn" data-action="choose-from-prompt" data-kind="character">👤 Character Profile<br><span class="list-meta">Positive and negative together</span></button><button class="btn" data-action="choose-from-prompt" data-kind="base">◆ Base Profile<br><span class="list-meta">Positive and negative together</span></button><button class="btn" data-action="choose-from-prompt" data-kind="style">✎ Style/Artist<br><span class="list-meta">Positive and optional negative</span></button><button class="btn" data-action="choose-from-prompt" data-kind="set-positive" ${hasPositive ? '' : 'disabled'}>▤ Positive Set<br><span class="list-meta">Positive target only</span></button><button class="btn" data-action="choose-from-prompt" data-kind="set-negative" ${hasNegative ? '' : 'disabled'}>▤ Negative Set<br><span class="list-meta">Negative target only</span></button><button class="btn" data-action="choose-from-prompt" data-kind="set-combined" ${hasPositive || hasNegative ? '' : 'disabled'}>▤ Positive + Negative Set<br><span class="list-meta">Separate Main Prompt fields</span></button></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button></div></div></div>`;
    }

    function renderCharacterImportModal() {
        const characters = state.modalPayload?.characters || [];
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div class="modal-title">Import Character from NovelAI</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body">${characters.length ? `<div class="grid">${characters.map((character, index) => `<article class="card"><div class="card-title">${escapeHtml(character.name || `Character ${index + 1}`)}</div><div class="preview">+ ${escapeHtml(character.positive || '(empty)')}</div>${character.negative ? `<div class="preview negative">− ${escapeHtml(character.negative)}</div>` : ''}<div class="card-actions"><button class="btn primary small" data-action="choose-nai-character" data-index="${index}">Save as Profile</button></div></article>`).join('')}</div>` : '<div class="empty">No filled NovelAI character prompts were detected. Open a character prompt and try again.</div>'}</div><div class="modal-foot"><button class="btn" data-action="close-modal">Close</button></div></div></div>`;
    }

    function renderConfirmModal() {
        const payload = state.modalPayload || {};
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal" style="width:min(480px,100%)"><div class="modal-head"><div class="modal-title">${escapeHtml(payload.title || 'Confirm')}</div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="notice ${payload.danger ? 'error' : 'warn'}">${escapeHtml(payload.message || '')}</div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn ${payload.danger ? 'danger' : 'primary'}" data-action="confirm-action">${escapeHtml(payload.confirmLabel || 'Confirm')}</button></div></div></div>`;
    }


    function healthIssueLabel(type) {
        return ({ missingThumbnail: 'Missing thumbnails', corruptThumbnail: 'Corrupt thumbnails', metadataMismatch: 'Thumbnail metadata', orphanThumbnail: 'Orphaned thumbnail data', duplicateId: 'Duplicate IDs', invalidPrimary: 'Invalid primary variants', damagedEntry: 'Damaged entries', invalidSource: 'Invalid sources', legacyFingerprint: 'Missing visual fingerprints', entryType: 'Entry type mismatch' })[type] || type;
    }
    function renderSidebar() {
        const definitions = {
            quick: ['quick', '✦', 'Quick Access', ''],
            booru: ['booru', '↓', 'Booru Tools', state.booruPost ? countPostTags(state.booruPost) : ''],
            characters: ['characters', '●', 'Characters', data.characters.length],
            sets: ['sets', '▤', 'Tag Sets', getManualTagSets().length + data.favoriteTags.length],
            bases: ['bases', '◆', 'Base Tags', data.bases.length],
            styles: ['styles', '✎', 'Style / Artist', data.styleArtists.length],
            'full-images': ['full-images', '▣', 'Full Image', data.fullImages.length],
            tags: ['tags', '#', 'Tag Collection', getTagIndex().size],
            imported: ['imported', '↓', 'Imported', getImportedWrappers().length],
            collections: ['collections', '▰', 'Collections', data.collections.length],
            smart: [`smart-${state.smartView}`, '◷', 'Smart Views', ''],
            history: ['history', '↶', 'History', data.history.length]
        };
        const order = [...new Set([...(data.settings.sidebarOrder || []), ...DEFAULT_SIDEBAR_ORDER])];
        const tabs = order.filter(id => id !== 'booru' || IS_BOORU).map(id => definitions[id]).filter(Boolean);
        const visibleTabs = tabs.filter(([id]) => isSidebarSectionVisible(sidebarSectionForTab(id)));
        return `<nav class="sidebar"><div class="sidebar-brand">LIBRARY</div>${visibleTabs.map(([id, icon, label, count]) => `<button class="nav ${state.activeTab === id || (id.startsWith('smart-') && state.activeTab.startsWith('smart-')) ? 'active' : ''}" data-action="tab" data-tab="${id}"><span class="nav-icon">${icon}</span><span class="label">${escapeHtml(label)}</span>${count !== '' ? `<span class="n">${count}</span>` : ''}</button>`).join('')}<div class="sidebar-spacer"></div><button class="nav ${state.activeTab === 'settings' ? 'active' : ''}" data-action="tab" data-tab="settings"><span class="nav-icon">⚙</span><span class="label">Settings</span></button><div class="sidebar-sep"></div><div class="sidebar-utility"><button class="nav" data-action="export"><span>⇩</span><span class="label">Export</span></button><button class="nav" data-action="import"><span>⇧</span><span class="label">Import</span></button></div></nav>`;
    }

    function renderSidebarVisibilitySetting() {
        const labels = { quick:'Quick Access', booru:'Booru Tools', characters:'Characters', sets:'Tag Sets', bases:'Base Tags', styles:'Style / Artist', 'full-images':'Full Image', tags:'Tag Collection', imported:'Imported', collections:'Collections', smart:'Smart Views', history:'History' };
        const order = [...new Set([...(data.settings.sidebarOrder || []), ...DEFAULT_SIDEBAR_ORDER])].filter(id => id !== 'booru' || IS_BOORU);
        return `<section class="setting wide"><div class="box-title"><div><h4 style="margin:0">Sidebar areas</h4><p>Hide or reorder the fixed areas. Settings always remains visible.</p></div><button class="btn ghost small" data-action="show-all-sidebar">Show all</button></div><div class="sidebar-order-list">${order.map((id,index) => `<div class="sidebar-order-row"><label class="check-row"><input type="checkbox" data-setting="sidebar-section:${escapeAttr(id)}" ${isSidebarSectionVisible(id) ? 'checked' : ''}><span>${escapeHtml(labels[id] || id)}</span></label><div class="actions"><button class="btn icon ghost small" data-action="move-sidebar-section" data-id="${escapeAttr(id)}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button class="btn icon ghost small" data-action="move-sidebar-section" data-id="${escapeAttr(id)}" data-direction="1" ${index === order.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('')}</div></section>`;
    }

    function moveSidebarSection(id, direction) {
        const order = [...new Set([...(data.settings.sidebarOrder || []), ...DEFAULT_SIDEBAR_ORDER])];
        const visible = order.filter(value => value !== 'booru' || IS_BOORU);
        const visibleIndex = visible.indexOf(id);
        const targetVisibleIndex = visibleIndex + Number(direction || 0);
        if (visibleIndex < 0 || targetVisibleIndex < 0 || targetVisibleIndex >= visible.length) return;
        const index = order.indexOf(id);
        const target = order.indexOf(visible[targetVisibleIndex]);
        [order[index], order[target]] = [order[target], order[index]];
        data.settings.sidebarOrder = order;
        scheduleSave('Sidebar order changed');
        render();
    }

    function openCollectionEditor(id = '') {
        state.modal = 'collection-edit';
        state.modalPayload = { id };
        state.openMenu = '';
        render();
    }

    function collectionFormRules(form) {
        const fd = new FormData(form);
        const rules = [];
        for (let index = 0; index < 6; index++) {
            const field = String(fd.get(`ruleField${index}`) || 'tag');
            const operator = String(fd.get(`ruleOperator${index}`) || 'contains');
            const value = String(fd.get(`ruleValue${index}`) || '').trim();
            if (!value && !['exists', 'not-exists'].includes(operator)) continue;
            rules.push({ field, operator, value });
        }
        return rules;
    }

    function collectionDefinitionFromForm(form, existing = null) {
        const fd = new FormData(form);
        const type = String(fd.get('type') || 'smart') === 'manual' ? 'manual' : 'smart';
        const rules = type === 'smart' ? collectionFormRules(form) : [];
        const groupBy = [0, 1, 2]
            .map(index => String(fd.get(`group${index}`) || 'none'))
            .filter(value => value !== 'none');
        return normalizeCollectionDefinition({
            ...(existing || {}),
            id: existing?.id || uid('collection'),
            name: String(fd.get('name') || '').trim(),
            description: String(fd.get('description') || '').trim(),
            type,
            scope: String(fd.get('scope') || 'imported'),
            match: String(fd.get('match') || 'all'),
            rules,
            groupBy,
            sort: String(fd.get('sort') || 'name-asc'),
            updatedAt: nowIso()
        });
    }

    function collectionRuleValueControl(rule, index) {
        const field = String(rule?.field || 'tag');
        const value = String(rule?.value || '');
        const attributes = `name="ruleValue${index}" data-collection-rule-value="${index}"`;
        if (field === 'favorite') {
            return `<select ${attributes}><option value="yes" ${canonicalTag(value) === 'yes' ? 'selected' : ''}>Favorite</option><option value="no" ${canonicalTag(value) === 'no' ? 'selected' : ''}>Not favorite</option></select>`;
        }
        if (field === 'source') {
            return `<select ${attributes}><option value="">Choose website</option>${BOORU_SITES.map(site => `<option value="${site}" ${canonicalTag(value) === site ? 'selected' : ''}>${escapeHtml(sourceSiteLabel(site))}</option>`).join('')}</select>`;
        }
        if (field === 'imageStatus') {
            return `<select ${attributes}><option value="local" ${canonicalTag(value) === 'local' ? 'selected' : ''}>Stored locally</option><option value="web" ${canonicalTag(value) === 'web' ? 'selected' : ''}>Web fallback</option><option value="missing" ${canonicalTag(value) === 'missing' ? 'selected' : ''}>No image</option></select>`;
        }
        if (field === 'variants') {
            const count = Number(value);
            return `<input type="number" min="1" max="999" ${attributes} value="${Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1}" placeholder="Count">`;
        }
        return `<input ${attributes} value="${escapeAttr(value)}" placeholder="Value">`;
    }

    function collectionRuleOperatorOptions(rule) {
        const field = String(rule?.field || 'tag');
        const current = String(rule?.operator || (field === 'variants' ? 'gte' : 'contains'));
        const options = field === 'variants'
            ? [['gte', 'at least'], ['equals', 'equals']]
            : [['contains', 'contains'], ['equals', 'equals'], ['not-contains', 'does not contain'], ['exists', 'exists'], ['not-exists', 'does not exist']];
        return options.map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
    }

    function renderCollectionRuleRow(rule, index, fields) {
        return `<div class="rule-row" data-collection-rule-row="${index}"><select name="ruleField${index}" data-collection-rule-field="${index}">${fields.map(([value, label]) => `<option value="${value}" ${rule.field === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select name="ruleOperator${index}" data-collection-rule-operator="${index}">${collectionRuleOperatorOptions(rule)}</select><span data-collection-rule-value-wrap="${index}">${collectionRuleValueControl(rule, index)}</span></div>`;
    }

    function updateCollectionRuleRow(row) {
        if (!(row instanceof Element)) return;
        const index = Number(row.dataset.collectionRuleRow);
        const fieldSelect = row.querySelector(`[name="ruleField${index}"]`);
        const operatorSelect = row.querySelector(`[name="ruleOperator${index}"]`);
        const valueWrap = row.querySelector(`[data-collection-rule-value-wrap="${index}"]`);
        if (!fieldSelect || !operatorSelect || !valueWrap) return;
        const previousValue = String(row.querySelector(`[name="ruleValue${index}"]`)?.value || '');
        const field = fieldSelect.value || 'tag';
        const previousOperator = operatorSelect.value || 'contains';
        const rule = { field, operator: previousOperator, value: previousValue };
        operatorSelect.innerHTML = collectionRuleOperatorOptions(rule);
        if (![...operatorSelect.options].some(option => option.value === previousOperator)) operatorSelect.value = field === 'variants' ? 'gte' : 'contains';
        valueWrap.innerHTML = collectionRuleValueControl({ field, value: previousValue }, index);
        const valueControl = valueWrap.querySelector(`[name="ruleValue${index}"]`);
        const noValue = ['exists', 'not-exists'].includes(operatorSelect.value);
        if (valueControl) {
            valueControl.disabled = noValue;
            valueControl.hidden = noValue;
        }
    }

    function updateCollectionRuleValueVisibility(operatorSelect) {
        if (!(operatorSelect instanceof Element)) return;
        const index = Number(operatorSelect.dataset.collectionRuleOperator);
        const valueControl = operatorSelect.closest('[data-collection-rule-row]')?.querySelector(`[name="ruleValue${index}"]`);
        if (!valueControl) return;
        const noValue = ['exists', 'not-exists'].includes(operatorSelect.value);
        valueControl.disabled = noValue;
        valueControl.hidden = noValue;
    }

    function evaluateCollectionPreview(collection) {
        if (collection.type === 'manual') return collection.itemRefs?.length || 0;
        const activeRules = (collection.rules || []).filter(rule => rule.value || ['exists', 'not-exists'].includes(rule.operator));
        return collectionScopeWrappers(collection.scope).filter(wrapper => {
            const previewWrapper = { ...wrapper, matchVariantId: '' };
            const checks = activeRules.map(rule => collectionRuleMatches(previewWrapper, rule));
            return !checks.length || (collection.match === 'any' ? checks.some(Boolean) : checks.every(Boolean));
        }).length;
    }

    function refreshCollectionPreview(form) {
        if (!(form instanceof HTMLFormElement) || !form.isConnected) return;
        const preview = form.querySelector('#collection-rule-preview');
        if (!preview) return;
        const type = form.querySelector('[name="type"]:checked')?.value || 'smart';
        if (type !== 'smart') {
            preview.innerHTML = 'Manual Collections contain only entries you add yourself.';
            return;
        }
        preview.textContent = 'Checking rules…';
        clearTimeout(collectionPreviewTimer);
        collectionPreviewTimer = setTimeout(() => {
            if (!form.isConnected) return;
            try {
                const existing = data.collections.find(collection => collection.id === String(new FormData(form).get('id') || ''));
                const candidate = collectionDefinitionFromForm(form, existing);
                const count = measureOperation('collection-preview', () => evaluateCollectionPreview(candidate));
                preview.innerHTML = `<strong>${count}</strong> matching entr${count === 1 ? 'y' : 'ies'} in the selected scope`;
            } catch (error) {
                preview.textContent = `Preview unavailable: ${error.message || 'invalid rule'}`;
            }
        }, 220);
    }

    function updateCollectionEditorMode(form) {
        if (!(form instanceof HTMLFormElement)) return;
        const type = form.querySelector('[name="type"]:checked')?.value || 'smart';
        const smartSettings = form.querySelector('[data-collection-smart-settings]');
        if (smartSettings) smartSettings.hidden = type !== 'smart';
        refreshCollectionPreview(form);
    }

    function hydrateCollectionEditor() {
        const form = root?.querySelector?.('form[data-form="collection-edit"]');
        if (!form) return;
        form.querySelectorAll('[data-collection-rule-row]').forEach(row => {
            const operator = row.querySelector('[data-collection-rule-operator]');
            updateCollectionRuleValueVisibility(operator);
        });
        updateCollectionEditorMode(form);
    }

    function saveCollectionForm(form) {
        const fd = new FormData(form);
        const id = String(fd.get('id') || '');
        const existing = data.collections.find(collection => collection.id === id);
        const saved = collectionDefinitionFromForm(form, existing);
        if (!saved.name) return toast('Please enter a collection name', 'error');
        if (saved.type === 'smart' && !saved.rules.length) {
            return toast('Add at least one Smart Collection rule, or choose Manual Collection', 'error');
        }
        if (existing) data.collections[data.collections.indexOf(existing)] = saved;
        else data.collections.push(saved);
        state.activeCollectionId = saved.id;
        state.collectionPath = [];
        scheduleSave('Collection saved', ['library', 'collections']);
        closeModal();
        state.activeTab = 'collections';
        render();
        toast(saved.type === 'smart' ? 'Smart Collection saved' : 'Manual Collection saved', 'success');
    }

    function confirmDeleteCollection(id) {
        const collection = data.collections.find(entry => entry.id === id);
        if (!collection) return;
        state.modal = 'confirm';
        state.modalPayload = { title:'Delete Collection', message:`Delete “${collection.name}”? The referenced library entries remain untouched.`, confirmLabel:'Delete Collection', danger:true, action:'delete-collection', id };
        render();
    }

    function openCollectionPicker(kind = '', id = '') {
        state.modal = 'collection-picker';
        state.modalPayload = { refs: kind && id ? [{ kind, id }] : getSelectedWrappers().map(wrapper => ({ kind:wrapper.kind, id:wrapper.item.id })) };
        state.openMenu = '';
        render();
    }

    function addSelectedToCollection(collectionId) {
        const refs = getSelectedWrappers().map(wrapper => ({ kind:wrapper.kind, id:wrapper.item.id }));
        if (!refs.length) return toast('Select entries first, then use Add Entries again', 'info');
        addRefsToCollection(collectionId, refs);
        exitSelectionMode();
    }

    function confirmAddToCollection(collectionId) {
        const refs = state.modalPayload?.refs || [];
        addRefsToCollection(collectionId, refs);
        closeModal();
    }

    function addRefsToCollection(collectionId, refs) {
        const collection = data.collections.find(entry => entry.id === collectionId);
        if (!collection) return toast('Collection not found', 'error');
        const target = collection.type === 'smart' ? collection.alwaysInclude : collection.itemRefs;
        const seen = new Set((target || []).map(ref => `${ref.kind}:${ref.id}`));
        const excluded = new Set((collection.excluded || []).map(ref => `${ref.kind}:${ref.id}`));
        let added = 0;
        for (const ref of refs || []) {
            const key = `${ref.kind}:${ref.id}`;
            if (seen.has(key) || !findItem(ref.kind, ref.id)) continue;
            seen.add(key);
            target.push({ kind:ref.kind, id:ref.id });
            if (collection.type === 'smart' && excluded.has(key)) {
                collection.excluded = collection.excluded.filter(entry => `${entry.kind}:${entry.id}` !== key);
                excluded.delete(key);
            }
            added++;
        }
        collection.updatedAt = nowIso();
        scheduleSave('Entries added to collection');
        render();
        const destination = collection.type === 'smart' ? 'included as a Smart Collection exception' : 'added';
        toast(added ? `${added} entr${added === 1 ? 'y' : 'ies'} ${destination}` : 'These entries are already included', added ? 'success' : 'info');
    }

    function removeFromActiveCollection(kind, id, excludeFromSmart = false) {
        const collection = data.collections.find(entry => entry.id === state.activeCollectionId);
        if (!collection || !kind || !id) return;
        const key = `${kind}:${id}`;
        if (collection.type === 'smart' && excludeFromSmart) {
            collection.alwaysInclude = (collection.alwaysInclude || []).filter(ref => `${ref.kind}:${ref.id}` !== key);
            if (!(collection.excluded || []).some(ref => `${ref.kind}:${ref.id}` === key)) collection.excluded.push({ kind, id });
            collection.updatedAt = nowIso();
            scheduleSave('Entry excluded from Smart Collection');
            state.openMenu = '';
            render();
            toast('Entry excluded from this Smart Collection', 'success');
            return;
        }
        if (collection.type !== 'manual') return;
        const before = collection.itemRefs.length;
        collection.itemRefs = collection.itemRefs.filter(ref => `${ref.kind}:${ref.id}` !== key);
        if (collection.itemRefs.length === before) return;
        collection.updatedAt = nowIso();
        scheduleSave('Entry removed from collection');
        state.openMenu = '';
        render();
        toast('Entry removed from this Collection', 'success');
    }

    function saveImportFiltersAsCollection() {
        const f = state.importFilters;
        const map = [['artist','artist'],['character','character'],['copyright','copyright'],['site','source'],['imageStatus','imageStatus']];
        const rules = map.filter(([key]) => f[key]).map(([key,field]) => ({ field, operator:'contains', value:String(f[key]) }));
        for (const tag of splitPrompt(f.includeTags || '')) rules.push({ field:'tag', operator:'equals', value:tag });
        for (const tag of splitPrompt(f.excludeTags || '')) rules.push({ field:'tag', operator:'not-contains', value:tag });
        if (f.favorite !== 'all') rules.push({ field:'favorite', operator:'equals', value:f.favorite });
        if (Number(f.minVariants) > 1) rules.push({ field:'variants', operator:'gte', value:String(f.minVariants) });
        state.modal = 'collection-edit';
        state.modalPayload = { fromFilters:true, rules };
        render();
    }

    function getBulkImageRefreshRecords(site = 'all') {
        const grouped = new Map();
        for (const wrapper of getImportedWrappers()) for (const variant of getItemVariants(wrapper.item)) for (const source of variant.sources || []) {
            if (!source.postId || !BOORU_SITES.includes(source.site) || (site !== 'all' && source.site !== site)) continue;
            const key = `${source.site}:${source.postId}`;
            if (!grouped.has(key)) grouped.set(key, { key, source, targets:[] });
            grouped.get(key).targets.push({ item:wrapper.item, variant, source });
        }
        return [...grouped.values()];
    }

    function openBulkImageRefresh() {
        state.bulkImageRefresh = null;
        state.modal = 'bulk-image-refresh';
        state.modalPayload = {};
        render();
    }

    async function startBulkImageRefresh() {
        const site = root.querySelector('#bulk-refresh-site')?.value || 'all';
        const records = getBulkImageRefreshRecords(site);
        if (!records.length) return toast('No source-backed variants match this scope', 'info');
        const options = {
            updateTags:root.querySelector('#bulk-refresh-tags')?.checked !== false,
            updateMetadata:root.querySelector('#bulk-refresh-metadata')?.checked !== false,
            repairImages:Boolean(root.querySelector('#bulk-refresh-images')?.checked)
        };
        await runBulkImageRefresh(records, options);
    }

    async function retryFailedBulkImageRefresh() {
        const previous = state.bulkImageRefresh;
        const records = Array.isArray(previous?.failedRecords) ? previous.failedRecords : [];
        if (!records.length) return toast('There are no failed requests to retry', 'info');
        await runBulkImageRefresh(records, previous.options || { updateTags:true, updateMetadata:true, repairImages:false });
    }

    async function runBulkImageRefresh(records, options) {
        const before = await captureUndoState('Variant image data updated', [], [...new Map(records.flatMap(record => record.targets || []).map(target => [target.item.id, { kind:'imported', id:target.item.id }])).values()]);
        const run = state.bulkImageRefresh = { running:true, finished:false, paused:false, cancelled:false, done:0, total:records.length, success:0, failed:0, failedRecords:[], current:'', options:{ ...options } };
        render();
        for (const record of records) {
            if (run.cancelled) break;
            while (run.paused && !run.cancelled) await wait(120);
            if (run.cancelled) break;
            run.current = `${sourceSiteLabel(record.source.site)} #${record.source.postId}`;
            render();
            try {
                const post = await fetchSourcePost(record.source, true);
                const remoteGroups = compactGroups(cleanBooruGroups(post.groups || {}, post.site));
                for (const target of record.targets) {
                    if (options.updateTags) target.source.tagGroups = deepClone(remoteGroups);
                    if (options.updateMetadata) mergePostMetadataIntoSource(target.source, post);
                    target.source.lastCheckedAt = nowIso();
                    if (options.updateTags) refreshVariantEffectiveTags(target.variant);
                    if (options.updateMetadata) target.variant.image = { ...target.variant.image, ...postToImageMetadata(post, target.variant.image || {}) };
                    if (options.repairImages && (!target.variant.thumbnail?.key || !getStoredThumbnail(target.variant.thumbnail.key))) {
                        try {
                            const thumbnail = await createThumbnailFromPost(post);
                            if (thumbnail) await storeThumbnailForItemAsync(target.item, thumbnail, target.variant);
                        } catch (error) { reportDiagnostic('bulk-image-repair', error, false); }
                    }
                    target.item.updatedAt = nowIso();
                    syncPrimaryVariantAliases(target.item);
                }
                run.success++;
            } catch (error) {
                run.failed++;
                run.failedRecords.push(record);
                reportDiagnostic('bulk-image-data-refresh', error, false, { source:record.key });
            }
            run.done++;
            render();
            if (!run.cancelled && data.settings.batchImportDelay) await wait(Math.max(100, Number(data.settings.batchImportDelay) || 350));
        }
        run.running = false; run.finished = true; run.current = run.cancelled ? 'Cancelled; completed changes were kept.' : 'Image data refresh complete.';
        data.meta.lastImageDataRefreshAt = nowIso();
        scheduleSave(run.cancelled ? 'Partial bulk image data refresh saved' : 'Bulk image data refresh finished');
        render();
        registerUndo(before);
    }

    function toggleBulkImageRefreshPause() {
        if (!state.bulkImageRefresh?.running) return;
        state.bulkImageRefresh.paused = !state.bulkImageRefresh.paused;
        render();
    }

    function cancelBulkImageRefresh() {
        if (!state.bulkImageRefresh) return;
        state.bulkImageRefresh.cancelled = true;
        state.bulkImageRefresh.paused = false;
        state.bulkImageRefresh.current = 'Stopping after the current request…';
        render();
    }

    function importRenameTargets(scope = 'all') {
        const wrappers = scope === 'selected' ? getSelectedWrappers() : getImportedWrappers();
        return wrappers.filter(wrapper => wrapper.kind === 'imported' || isImportedItem(wrapper.item));
    }

    function buildImportRenameRecords(scope = 'all', includeManual = false) {
        return importRenameTargets(scope).map(wrapper => {
            const item = wrapper.item;
            const variant = getPrimaryVariant(item);
            const nextName = suggestedImportName(item, variant);
            return { id:item.id, oldName:item.name || 'Untitled', newName:nextName, mode:item.nameMode || 'legacy', variantId:variant?.id || '' };
        }).filter(record => (includeManual || record.mode !== 'manual') && record.newName && record.newName !== record.oldName);
    }

    function openImportRenamePreview(scope = 'all') {
        const available = importRenameTargets(scope);
        if (!available.length) return toast('No imported entries are available in this selection', 'info');
        state.renamePreview = { scope, includeManual:false, total:available.length, records:buildImportRenameRecords(scope, false) };
        state.modal = 'import-rename';
        state.modalPayload = {};
        state.openMenu = '';
        render();
    }

    function refreshImportRenamePreview() {
        if (!state.renamePreview) return;
        const includeManual = Boolean(root.querySelector('#rename-include-manual')?.checked);
        state.renamePreview.includeManual = includeManual;
        state.renamePreview.records = buildImportRenameRecords(state.renamePreview.scope, includeManual);
        render();
    }

    async function applyImportRenames() {
        const preview = state.renamePreview;
        if (!preview?.records?.length) return toast('No names need to be changed', 'info');
        const before = await captureUndoState('Import names updated', [], preview.records.map(record => ({ kind:'imported', id:record.id })));
        let renamed = 0;
        for (const record of preview.records) {
            const item = findItem('imported', record.id);
            if (!item) continue;
            item.name = record.newName;
            item.nameMode = 'auto';
            item.nameTemplate = data.settings.importNameTemplate;
            item.updatedAt = nowIso();
            renamed++;
        }
        const selectedScope = preview.scope === 'selected';
        state.renamePreview = null;
        scheduleSave('Import names updated');
        closeModal();
        if (selectedScope) exitSelectionMode();
        else render();
        registerUndo(before);
        toast(`${renamed} import name${renamed === 1 ? '' : 's'} updated`, renamed ? 'success' : 'info');
    }

    function resetImportNameTemplate() {
        data.settings.importNameTemplate = '{character} ({source} - {artist})';
        scheduleSave('Import naming scheme reset');
        render();
    }

    async function renameImportFromVariant(id = '', variantId = '') {
        const payload = state.modalPayload || {};
        const item = findItem('imported', id || payload.id);
        if (!item) return toast('Imported entry was not found', 'error');
        const variant = findVariant(item, variantId || item.primaryVariantId);
        const name = suggestedImportName(item, variant);
        if (!name || name === item.name) return toast('The name already matches the standard scheme', 'info');
        const before = await captureUndoState('Import name updated', [], [{ kind:'imported', id:item.id }]);
        item.name = name;
        item.nameMode = 'auto';
        item.nameTemplate = data.settings.importNameTemplate;
        item.updatedAt = nowIso();
        scheduleSave('Import name updated from variant');
        state.openMenu = '';
        render();
        registerUndo(before);
    }

    async function detachCurrentVariant() {
        const payload = state.modalPayload || {};
        const item = findItem('imported', payload.id);
        const variant = findVariant(item, state.detailVariantId);
        const variants = getItemVariants(item);
        if (!item || !variant || variants.length < 2) return toast('This entry has no detachable variant', 'info');
        const before = await captureUndoState('Variant moved to a separate entry', [], [{ collection:'sets' }]);
        item.variants = variants.filter(entry => entry.id !== variant.id);
        if (item.primaryVariantId === variant.id) item.primaryVariantId = item.variants[0].id;
        syncPrimaryVariantAliases(item);
        item.updatedAt = nowIso();
        const newItem = normalizeItemMetadata({
            id:uid('set'), name:'Imported', nameMode:'auto', nameTemplate:data.settings.importNameTemplate,
            type:'positive', tags:variant.tags || '', category:item.category || 'Imported', entryType:'imported', notes:item.notes || '', favorite:false,
            variants:[variant], primaryVariantId:variant.id, createdAt:nowIso(), updatedAt:nowIso(), usageCount:0, lastUsed:''
        }, nowIso());
        newItem.name = suggestedImportName(newItem, variant);
        data.sets.push(newItem);
        scheduleSave('Variant moved to a separate entry');
        state.modalPayload = { kind:'imported', id:newItem.id };
        state.detailVariantId = variant.id;
        state.compareVariants = false;
        render();
        registerUndo(before);
        toast('Variant moved to its own entry', 'success');
    }

    function openMergeSelectedVariants() {
        const imports = getSelectedWrappers().filter(wrapper => wrapper.kind === 'imported');
        if (imports.length < 2) return toast('Select at least two imported entries', 'info');
        state.modal = 'merge-variants';
        state.modalPayload = { ids:imports.map(wrapper => wrapper.item.id) };
        state.openMenu = '';
        render();
    }

    async function applyMergeSelectedVariants() {
        const ids = state.modalPayload?.ids || [];
        const targetId = root.querySelector('#merge-variant-target')?.value || ids[0];
        const target = findItem('imported', targetId);
        const sources = ids.filter(id => id !== targetId).map(id => findItem('imported', id)).filter(Boolean);
        if (!target || !sources.length) return toast('The merge selection is no longer available', 'error');
        const before = await captureUndoState('Imports merged as variants', [], [{ collection:'sets' }]);
        const targetVariants = ensureItemVariants(target);
        let added = 0;
        for (const sourceItem of sources) {
            for (const sourceVariant of getItemVariants(sourceItem)) {
                const variant = deepClone(sourceVariant);
                if (targetVariants.some(entry => entry.id === variant.id)) variant.id = uid('variant');
                targetVariants.push(variant);
                added++;
            }
            data.sets = data.sets.filter(item => item.id !== sourceItem.id);
            data.recent = data.recent.map(record => record.id === sourceItem.id ? { ...record, kind:'imported', id:target.id } : record);
            for (const collection of data.collections || []) {
                for (const key of ['itemRefs','alwaysInclude','excluded']) collection[key] = (collection[key] || []).map(ref => ref.kind === 'imported' && ref.id === sourceItem.id ? { kind:'imported', id:target.id } : ref).filter((ref,index,list) => list.findIndex(other => other.kind === ref.kind && other.id === ref.id) === index);
            }
        }
        target.updatedAt = nowIso();
        syncPrimaryVariantAliases(target);
        scheduleSave('Imports merged as variants');
        closeModal();
        exitSelectionMode();
        openItemDetails('imported', target.id, target.primaryVariantId);
        registerUndo(before);
        toast(`${added} variant${added === 1 ? '' : 's'} added`, 'success');
    }

    function importVariantSearchText(item, variant) {
        return canonicalTag([
            item?.name, item?.category, item?.notes,
            variant?.label, variant?.tags,
            ...Object.values(variant?.tagGroups || {}).flat(),
            ...(variant?.sources || []).flatMap(source => [source.site, sourceSiteLabel(source.site), source.postId, source.url, source.originalSourceUrl, ...(source.artist || [])])
        ].filter(Boolean).join(' '));
    }

    function importVariantMatches(item, variant, filters = state.importFilters, query = state.importQuery) {
        const sources = variant?.sources || [];
        const groups = variant?.tagGroups || {};
        const tags = splitPrompt(variant?.tags || '');
        const has = (group, value) => !value || (groups[group] || []).some(tag => canonicalTag(tag).includes(canonicalTag(value)));
        if (filters.site && !sources.some(source => source.site === filters.site)) return false;
        if (!has('artist', filters.artist) || !has('character', filters.character) || !has('copyright', filters.copyright)) return false;
        if (filters.favorite === 'yes' && !item.favorite) return false;
        if (filters.favorite === 'no' && item.favorite) return false;
        if (getItemVariants(item).length < Math.max(1, Number(filters.minVariants) || 1)) return false;
        const local = Boolean(variant?.thumbnail?.key);
        const online = Boolean(bestVariantImageUrl(variant));
        if (filters.imageStatus === 'local' && !local) return false;
        if (filters.imageStatus === 'web' && (local || !online)) return false;
        if (filters.imageStatus === 'missing' && (local || online)) return false;
        const keys = new Set(tags.map(canonicalTag));
        const include = splitPrompt(filters.includeTags || '');
        const exclude = splitPrompt(filters.excludeTags || '');
        if (include.some(tag => !keys.has(canonicalTag(tag)))) return false;
        if (exclude.some(tag => keys.has(canonicalTag(tag)))) return false;
        const wanted = canonicalTag(query);
        if (wanted && !importVariantSearchText(item, variant).includes(wanted)) return false;
        return true;
    }

    function filteredImportedWrappers() {
        const wrappers = [];
        for (const wrapper of getImportedWrappers()) {
            const variants = getItemVariants(wrapper.item);
            const match = variants.find(variant => importVariantMatches(wrapper.item, variant));
            if (!match && variants.length) continue;
            if (!variants.length && !importVariantMatches(wrapper.item, null)) continue;
            wrappers.push({ ...wrapper, matchVariantId: match?.id || '' });
        }
        const value = wrapper => {
            const item = wrapper.item;
            if (state.importSort === 'created-desc') return item.createdAt || '';
            if (state.importSort === 'modified-desc') return item.updatedAt || '';
            if (state.importSort === 'used-desc') return item.lastUsed || '';
            if (state.importSort === 'usage-desc') return Number(item.usageCount) || 0;
            return String(item.name || '').toLowerCase();
        };
        return wrappers.sort((a, b) => state.importSort === 'name-asc' ? String(value(a)).localeCompare(String(value(b)), 'en') : value(a) < value(b) ? 1 : value(a) > value(b) ? -1 : 0);
    }

    function renderImported() {
        const items = filteredImportedWrappers();
        const f = state.importFilters;
        const activeCount = ['site','artist','character','copyright','imageStatus','includeTags','excludeTags'].filter(key => f[key]).length + (f.favorite !== 'all' ? 1 : 0) + (Number(f.minVariants) > 1 ? 1 : 0);
        const filterPanel = state.importFiltersOpen ? `<section class="filter-panel"><div class="form-grid import-filter-grid"><div class="field"><label>Website</label><select data-import-filter="site"><option value="">All websites</option>${BOORU_SITES.map(site => `<option value="${site}" ${f.site === site ? 'selected' : ''}>${sourceSiteLabel(site)}</option>`).join('')}</select></div><div class="field"><label>Artist contains</label><input data-import-filter="artist" value="${escapeAttr(f.artist)}"></div><div class="field"><label>Character contains</label><input data-import-filter="character" value="${escapeAttr(f.character)}"></div><div class="field"><label>Copyright contains</label><input data-import-filter="copyright" value="${escapeAttr(f.copyright)}"></div><div class="field"><label>Image data</label><select data-import-filter="imageStatus"><option value="">Any status</option><option value="local" ${f.imageStatus === 'local' ? 'selected' : ''}>Stored locally</option><option value="web" ${f.imageStatus === 'web' ? 'selected' : ''}>Web fallback only</option><option value="missing" ${f.imageStatus === 'missing' ? 'selected' : ''}>No image available</option></select></div><div class="field"><label>Favorite</label><select data-import-filter="favorite"><option value="all">All</option><option value="yes" ${f.favorite === 'yes' ? 'selected' : ''}>Favorites only</option><option value="no" ${f.favorite === 'no' ? 'selected' : ''}>Not favorite</option></select></div><div class="field"><label>Minimum variants</label><input type="number" min="1" max="99" data-import-filter="minVariants" value="${Number(f.minVariants) || 1}"></div><div class="field"><label>Must include tags</label><input data-import-filter="includeTags" value="${escapeAttr(f.includeTags)}" placeholder="tag one, tag two"></div><div class="field"><label>Exclude tags</label><input data-import-filter="excludeTags" value="${escapeAttr(f.excludeTags)}"></div></div><div class="actions filter-actions"><button class="btn ghost" data-action="clear-import-filters">Clear filters</button><button class="btn" data-action="save-import-filter-collection">Save as Smart Collection</button></div></section>` : '';
        const toolbar = `<div class="collection-toolbar"><button class="btn ${activeCount ? 'primary' : ''}" data-action="toggle-import-filters">Filters${activeCount ? ` · ${activeCount}` : ''}</button><div class="field inline"><label>Sort</label><select data-import-view="sort"><option value="modified-desc" ${state.importSort === 'modified-desc' ? 'selected' : ''}>Recently modified</option><option value="created-desc" ${state.importSort === 'created-desc' ? 'selected' : ''}>Recently created</option><option value="used-desc" ${state.importSort === 'used-desc' ? 'selected' : ''}>Recently used</option><option value="usage-desc" ${state.importSort === 'usage-desc' ? 'selected' : ''}>Most used</option><option value="name-asc" ${state.importSort === 'name-asc' ? 'selected' : ''}>Name A–Z</option></select></div><div class="field inline"><label>Group</label><select data-import-view="group"><option value="none">No grouping</option>${['artist','character','copyright','source'].map(value => `<option value="${value}" ${state.importGroup === value ? 'selected' : ''}>${value[0].toUpperCase() + value.slice(1)}</option>`).join('')}</select></div><div class="field inline local-view-search"><label>Search Imported</label><input id="imported-search" type="search" autocomplete="off" value="${escapeAttr(state.importQuery)}" placeholder="Name, tag, artist, source or post ID …"></div><span class="result-count">${items.length} result${items.length === 1 ? '' : 's'}</span></div>`;
        return `${renderTargetBar()}<div class="section-head"><div><h2 class="section-title">Imported</h2><div class="section-subtitle">Filter every variant by source, tags and image data. A matching variant opens directly.</div></div></div>${toolbar}${filterPanel}${items.length ? renderImportedGroups(items) : '<div class="empty">No imported entries match these filters.</div>'}`;
    }

    function renderImportedGroups(wrappers) {
        if (state.importGroup === 'none') return renderWrapperGrid(wrappers, 'imported');
        const groups = new Map();
        for (const wrapper of wrappers) {
            const variant = findVariant(wrapper.item, wrapper.matchVariantId);
            const values = collectionGroupValues(wrapper, state.importGroup, variant);
            for (const value of values.length ? values : ['Other']) (groups.get(value) || groups.set(value, []).get(value)).push(wrapper);
        }
        return [...groups].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([label, entries]) => `<section class="box grouped-section"><div class="box-title"><span>${escapeHtml(label)}</span><span class="list-meta">${entries.length}</span></div>${renderWrapperGrid(entries, `imported-${state.importGroup}`)}</section>`).join('');
    }

    function renderCollections() {
        const collection = data.collections.find(entry => entry.id === state.activeCollectionId);
        if (!collection) return `<div class="section-head"><div><h2 class="section-title">Collections</h2><div class="section-subtitle">Manual folders and live Smart Collections without duplicating library data.</div></div><button class="btn primary" data-action="new-collection">+ New Collection</button></div>${data.collections.length ? `<div class="collection-grid">${[...data.collections].sort((a,b) => Number(b.pinned)-Number(a.pinned) || a.name.localeCompare(b.name,'en')).map(entry => `<article class="collection-card"><button class="collection-open" data-action="open-collection" data-id="${escapeAttr(entry.id)}"><span class="collection-icon">${entry.type === 'smart' ? '✦' : '▰'}</span><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.type === 'smart' ? 'Smart Collection' : `${entry.itemRefs.length} saved reference${entry.itemRefs.length === 1 ? '' : 's'}`}${entry.groupBy.length ? ` · grouped by ${entry.groupBy.join(' → ')}` : ''}</small></span></button><div class="menu-wrap"><button class="btn icon ghost small" data-action="toggle-menu" data-menu="collection:${escapeAttr(entry.id)}">⋯</button><div class="overflow-menu" data-menu-panel="collection:${escapeAttr(entry.id)}" hidden><button class="menu-item" data-action="edit-collection" data-id="${escapeAttr(entry.id)}">Edit collection</button><button class="menu-item danger" data-action="delete-collection" data-id="${escapeAttr(entry.id)}">Delete collection</button></div></div></article>`).join('')}</div>` : '<div class="empty">Create a manual folder or a Smart Collection with rules and automatic subfolders.</div>'}`;
        const evaluated = evaluateCollection(collection);
        const depth = state.collectionPath.length;
        const groupField = collection.groupBy[depth];
        const breadcrumbs = `<div class="breadcrumbs"><button data-action="collection-root">Collections</button><span>›</span><button data-action="collection-path" data-depth="0">${escapeHtml(collection.name)}</button>${state.collectionPath.map((part,index) => `<span>›</span><button data-action="collection-path" data-depth="${index + 1}">${escapeHtml(part.value)}</button>`).join('')}</div>`;
        let entries = evaluated;
        for (const part of state.collectionPath) entries = entries.filter(wrapper => collectionGroupValues(wrapper, part.field, findVariant(wrapper.item, wrapper.matchVariantId)).some(value => canonicalTag(value) === canonicalTag(part.value)));
        const folders = new Map();
        if (groupField) for (const wrapper of entries) for (const value of collectionGroupValues(wrapper, groupField, findVariant(wrapper.item, wrapper.matchVariantId))) (folders.get(value) || folders.set(value, []).get(value)).push(wrapper);
        return `${breadcrumbs}<div class="section-head"><div><h2 class="section-title">${escapeHtml(collection.name)}</h2><div class="section-subtitle">${escapeHtml(collection.description || (collection.type === 'smart' ? 'Updates automatically when library data changes.' : 'Manual collection.'))}</div></div><div class="actions"><button class="btn" data-action="edit-collection" data-id="${escapeAttr(collection.id)}">Edit</button>${collection.type === 'manual' ? `<button class="btn primary" data-action="open-collection-entry-picker" data-id="${escapeAttr(collection.id)}">Add Entries</button>` : ''}</div></div>${groupField ? `<div class="folder-grid">${[...folders].sort(([a],[b]) => a.localeCompare(b,'en')).map(([label,values]) => `<button class="folder-card" data-action="open-collection-folder" data-field="${escapeAttr(groupField)}" data-value="${escapeAttr(label)}"><span>▰</span><strong>${escapeHtml(label)}</strong><small>${values.length} entries</small></button>`).join('')}</div>` : entries.length ? renderWrapperGrid(sortCollectionWrappers(entries, collection.sort), 'collection') : '<div class="empty">This collection is empty.</div>'}`;
    }

    function collectionScopeWrappers(scope) {
        const all = allLibraryWrappers();
        if (scope === 'all') return all;
        if (scope === 'imported') return getImportedWrappers();
        return all.filter(wrapper => wrapper.kind === scope);
    }

    function evaluateCollection(collection) {
        const cacheKey = `${collection.id}|${collection.updatedAt || ''}|${revisions.library}|${revisions.tags}|${revisions.collections}`;
        const cached = collectionResultCache.get(cacheKey);
        if (cached) return cached.map(ref => {
            const wrapper = getWrapperIndex().byRef.get(`${ref.kind}:${ref.id}`);
            if (wrapper && ref.matchVariantId) wrapper.matchVariantId = ref.matchVariantId;
            return wrapper;
        }).filter(Boolean);
        const index = getWrapperIndex();
        const byRef = ref => index.byRef.get(`${ref.kind}:${ref.id}`) || null;
        let wrappers = collection.type === 'manual' ? collection.itemRefs.map(byRef).filter(Boolean) : collectionScopeWrappers(collection.scope).filter(wrapper => {
            const checks = (collection.rules || []).filter(rule => rule.value || ['exists','not-exists'].includes(rule.operator)).map(rule => collectionRuleMatches(wrapper, rule));
            return !checks.length || (collection.match === 'any' ? checks.some(Boolean) : checks.every(Boolean));
        });
        wrappers.push(...(collection.alwaysInclude || []).map(byRef).filter(Boolean));
        const excluded = new Set((collection.excluded || []).map(ref => `${ref.kind}:${ref.id}`));
        const seen = new Set();
        const result = wrappers.filter(wrapper => { const key = `${wrapper.kind}:${wrapper.item.id}`; if (excluded.has(key) || seen.has(key)) return false; seen.add(key); return true; });
        collectionResultCache.set(cacheKey, result.map(wrapper => ({ kind: wrapper.kind, id: wrapper.item.id, matchVariantId: wrapper.matchVariantId || '' })));
        return result;
    }

    function collectionRuleMatches(wrapper, rule) {
        const variants = getItemVariants(wrapper.item);
        const valuesFor = variant => collectionFieldValues(wrapper, rule.field, variant);
        const matchValues = values => {
            const wanted = canonicalTag(rule.value);
            if (rule.operator === 'gte') return values.some(value => Number(value) >= Number(rule.value));
            if (rule.operator === 'equals') return values.some(value => canonicalTag(value) === wanted);
            if (rule.operator === 'not-contains') return values.every(value => !canonicalTag(value).includes(wanted));
            if (rule.operator === 'exists') return values.some(Boolean);
            if (rule.operator === 'not-exists') return !values.some(Boolean);
            return values.some(value => canonicalTag(value).includes(wanted));
        };
        if (!variants.length) return matchValues(valuesFor(null));
        const negative = ['not-contains','not-exists'].includes(rule.operator);
        if (negative) return variants.every(variant => matchValues(valuesFor(variant)));
        const match = variants.find(variant => matchValues(valuesFor(variant)));
        if (match) wrapper.matchVariantId = match.id;
        return Boolean(match);
    }

    function collectionFieldValues(wrapper, field, variant) {
        const item = wrapper.item;
        const groups = variant?.tagGroups || item.tagGroups || {};
        if (field === 'tag') return splitPrompt(variant?.tags || item.tags || item.tag || '');
        if (['artist','character','copyright','species','text'].includes(field)) return groups[field] || [];
        if (field === 'source') return (variant?.sources || item.sources || []).map(source => source.site);
        if (field === 'rating') return [];
        if (field === 'category') return [item.category || ''];
        if (field === 'name') return [item.name || item.label || item.tag || ''];
        if (field === 'favorite') return [item.favorite ? 'yes' : 'no'];
        if (field === 'variants') return [String(Math.max(1, getItemVariants(item).length))];
        if (field === 'imageStatus') return [variant?.thumbnail?.key ? 'local' : bestVariantImageUrl(variant) ? 'web' : 'missing'];
        return [];
    }

    function collectionGroupValues(wrapper, field, variant) {
        if (field === 'initial') return [(wrapper.item.name || wrapper.item.label || '#').trim().charAt(0).toUpperCase() || '#'];
        if (field === 'year') return [String(new Date(wrapper.item.createdAt || 0).getFullYear() || 'Unknown')];
        if (field === 'variants') return [`${Math.max(1, getItemVariants(wrapper.item).length)} variant${getItemVariants(wrapper.item).length === 1 ? '' : 's'}`];
        return collectionFieldValues(wrapper, field, variant).map(value => sourceSiteLabel(value) || String(value)).filter(Boolean);
    }

    function sortCollectionWrappers(wrappers, sort) {
        return [...wrappers].sort((a,b) => sort === 'created-desc' ? String(b.item.createdAt).localeCompare(String(a.item.createdAt)) : sort === 'modified-desc' ? String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)) : String(a.item.name || a.item.label || '').localeCompare(String(b.item.name || b.item.label || ''),'en'));
    }

    function renderCollectionEditModal() {
        const existing = data.collections.find(entry => entry.id === state.modalPayload?.id);
        const item = existing || normalizeCollectionDefinition({ name: '', type: 'smart', rules: state.modalPayload?.rules || [], groupBy: [] });
        const rules = [...(item.rules || [])];
        while (rules.length < 3) rules.push({ field: 'tag', operator: 'contains', value: '' });
        const fields = [['tag','Any tag'],['artist','Artist'],['character','Character'],['copyright','Copyright'],['species','Species'],['text','Text tag'],['source','Website'],['category','Category'],['name','Name'],['favorite','Favorite'],['variants','Variant count'],['imageStatus','Image status']];
        const groupOptions = [['none','No grouping'],['artist','Artist'],['character','Character'],['copyright','Copyright'],['source','Website'],['category','Category'],['year','Created year'],['favorite','Favorite'],['variants','Variant count'],['imageStatus','Image status'],['initial','Initial letter']];
        const type = item.type === 'manual' ? 'manual' : 'smart';
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal collection-editor"><div class="modal-head"><div><div class="modal-title">${existing ? 'Edit' : 'New'} Collection</div><div class="list-meta">Collections reference existing entries; nothing is duplicated.</div></div><button class="btn icon ghost" data-action="close-modal">✕</button></div><form data-form="collection-edit"><div class="modal-body"><input type="hidden" name="id" value="${escapeAttr(existing?.id || '')}"><div class="form-grid"><div class="field"><label>Name</label><input name="name" required maxlength="100" value="${escapeAttr(item.name)}"></div><div class="field wide"><label>Description</label><input name="description" value="${escapeAttr(item.description)}"></div><div class="field wide"><label>Collection type</label><div class="collection-type-grid"><label class="collection-type-option"><input type="radio" name="type" value="smart" ${type === 'smart' ? 'checked' : ''}><span><strong>Smart Collection</strong><small>Automatically includes entries that match the rules below.</small></span></label><label class="collection-type-option"><input type="radio" name="type" value="manual" ${type === 'manual' ? 'checked' : ''}><span><strong>Manual Collection</strong><small>Contains only entries you add yourself. Rules are not used.</small></span></label></div></div></div><section class="box editor-section collection-smart-settings" data-collection-smart-settings ${type === 'manual' ? 'hidden' : ''}><div class="box-title"><span>Smart rules</span><span class="list-meta">Blank rules are ignored</span></div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Search in</label><select name="scope">${[['imported','Imported images'],['all','Entire library'],['character','Characters'],['set','Tag Sets'],['base','Bases'],['style','Styles'],['fullImage','Full Images'],['tag','Saved Tags']].map(([value,label]) => `<option value="${value}" ${item.scope === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label>Rule matching</label><select name="match"><option value="all" ${item.match !== 'any' ? 'selected' : ''}>All rules must match</option><option value="any" ${item.match === 'any' ? 'selected' : ''}>Any rule may match</option></select></div></div>${rules.slice(0,6).map((rule,index) => renderCollectionRuleRow(rule,index,fields)).join('')}<div id="collection-rule-preview" class="collection-preview">Checking rules…</div></section><details class="box editor-section collection-grouping" ${item.groupBy.length ? 'open' : ''}><summary>Group results into folders (optional)</summary><p>This only organizes the Collection view. Example: Level 1 Character and Level 2 Artist creates character folders with artist subfolders; entries are not moved or duplicated.</p><div class="form-grid">${[0,1,2].map(index => `<div class="field"><label>Folder level ${index + 1}</label><select name="group${index}">${groupOptions.map(([value,label]) => `<option value="${value}" ${(item.groupBy[index] || 'none') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`).join('')}<div class="field"><label>Sort entries</label><select name="sort"><option value="name-asc" ${item.sort === 'name-asc' ? 'selected' : ''}>Name A–Z</option><option value="modified-desc" ${item.sort === 'modified-desc' ? 'selected' : ''}>Recently modified</option><option value="created-desc" ${item.sort === 'created-desc' ? 'selected' : ''}>Recently created</option></select></div></div></details></div><div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Collection</button></div></form></div></div>`;
    }

    function renderCollectionPickerModal() {
        const collections = [...data.collections].sort((a,b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'en'));
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal compact-modal"><div class="modal-head"><div><div class="modal-title">Add to Collection</div><div class="list-meta">Smart Collections use an explicit always-include exception.</div></div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body">${collections.length ? collections.map(collection => `<button class="picker-row" data-action="confirm-add-to-collection" data-id="${escapeAttr(collection.id)}"><span>${collection.type === 'smart' ? '✦' : '▰'}</span><span><strong>${escapeHtml(collection.name)}</strong><small>${collection.type === 'smart' ? `Always include · ${collection.alwaysInclude.length} exception${collection.alwaysInclude.length === 1 ? '' : 's'}` : `${collection.itemRefs.length} entr${collection.itemRefs.length === 1 ? 'y' : 'ies'}`}</small></span></button>`).join('') : '<div class="empty">Create a Collection first.</div>'}</div><div class="modal-foot"><button class="btn" data-action="new-collection">New Collection</button></div></div></div>`;
    }

    function renderCollectionEntryPickerModal() {
        const collection = data.collections.find(entry => entry.id === state.modalPayload?.collectionId);
        if (!collection) return '';
        const query = canonicalTag(state.collectionPickerQuery || '');
        const existing = new Set((collection.itemRefs || []).map(ref => `${ref.kind}:${ref.id}`));
        const wrappers = allLibraryWrappers().filter(wrapper => !existing.has(`${wrapper.kind}:${wrapper.item.id}`) && (!query || searchableText(wrapper.item).includes(query))).slice(0, 300);
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal collection-entry-picker"><div class="modal-head"><div><div class="modal-title">Add Entries to ${escapeHtml(collection.name)}</div><div class="list-meta">${state.collectionPickerSelection.size} selected · up to 300 matching entries shown</div></div><button class="btn icon ghost" data-action="close-modal">✕</button></div><div class="modal-body"><div class="field" style="position:sticky;top:0;z-index:2;background:var(--surface-1);padding-bottom:10px"><label>Search library</label><input id="collection-entry-search" value="${escapeAttr(state.collectionPickerQuery)}" placeholder="Name, tag, artist, source…"></div><div class="picker-list">${wrappers.length ? wrappers.map(wrapper => { const key = `${wrapper.kind}:${wrapper.item.id}`; const title = wrapper.item.name || wrapper.item.label || wrapper.item.tag || 'Untitled'; return `<label class="picker-check"><input type="checkbox" data-collection-entry="${escapeAttr(key)}" ${state.collectionPickerSelection.has(key) ? 'checked' : ''}><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(kindLabel(wrapper.kind))}${wrapper.item.category ? ` · ${escapeHtml(wrapper.item.category)}` : ''}</small></span></label>`; }).join('') : '<div class="empty">No matching entries outside this collection.</div>'}</div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="apply-collection-entry-picker" ${state.collectionPickerSelection.size ? '' : 'disabled'}>Add Selected</button></div></div></div>`;
    }

    function openCollectionEntryPicker(collectionId) {
        state.collectionPickerQuery = '';
        state.collectionPickerSelection = new Set();
        state.modal = 'collection-entry-picker';
        state.modalPayload = { collectionId };
        render();
    }

    function applyCollectionEntryPicker() {
        const collectionId = state.modalPayload?.collectionId;
        const refs = [...state.collectionPickerSelection].map(key => { const split = key.indexOf(':'); return { kind:key.slice(0,split), id:key.slice(split + 1) }; }).filter(ref => ref.kind && ref.id);
        addRefsToCollection(collectionId, refs);
        closeModal();
    }

    function renderSettings() {
        const sections = [['general','General'],['appearance','Appearance'],['navigation','Navigation'],['library','Library'],['image-data','Image Data'],['booru','Booru'],['data','Data & Export'],['diagnostics','Diagnostics']];
        return `<div class="section-head"><div><h2 class="section-title">Settings</h2><div class="section-subtitle">Organized by task with only settings that have a clear effect.</div></div></div><div class="settings-shell"><nav class="settings-nav">${sections.map(([id,label]) => `<button data-action="settings-section" data-section="${id}" class="${state.settingsSection === id ? 'active' : ''}">${label}</button>`).join('')}</nav><div class="settings-page">${renderSettingsPageV3(state.settingsSection)}</div></div>`;
    }

    function renderSettingsPage(section) {
        if (section === 'appearance') return `<div class="settings-page-head"><h3>Appearance</h3><p>Choose an accent and whether cards are shown as a grid or a list.</p></div><div class="settings-grid"><section class="setting wide"><h4>Accent color</h4><div class="choice-row">${['violet','blue','cyan','teal','emerald','amber','orange','rose','red'].map(value => `<label class="color-choice ${value}"><input type="radio" name="accent" data-setting="accent" value="${value}" ${data.settings.accent === value ? 'checked' : ''}><span></span>${value}</label>`).join('')}</div></section><section class="setting"><h4>Card layout</h4><div class="field"><label>Layout</label><select data-setting="cardLayout"><option value="grid" ${data.settings.cardLayout !== 'list' ? 'selected' : ''}>Grid</option><option value="list" ${data.settings.cardLayout === 'list' ? 'selected' : ''}>List</option></select></div></section></div>`;
        if (section === 'navigation') return `<div class="settings-page-head"><h3>Navigation</h3><p>Choose the start page, launcher and visible sidebar areas.</p></div><div class="settings-grid"><section class="setting"><h4>Start page</h4><div class="field"><select data-setting="homePage">${renderHomePageOptions(data.settings.homePage)}</select></div></section><section class="setting"><h4>Panel behavior</h4>${settingCheckbox('closeOnOutsideClick','Close Ainz Toolkit when clicking outside')}${IS_NAI ? `<div class="field"><label>Ainz Toolkit button position</label><select data-setting="naiLauncherPosition"><option value="header" ${data.settings.naiLauncherPosition !== 'floating' ? 'selected' : ''}>NovelAI header · recommended</option><option value="floating" ${data.settings.naiLauncherPosition === 'floating' ? 'selected' : ''}>Movable button</option></select></div>` : '<p>The compact Ainz Toolkit button remains in the lower-right corner on Booru websites.</p>'}</section>${renderSidebarVisibilitySetting()}</div>`;
        if (section === 'library') return `<div class="settings-page-head"><h3>Library</h3><p>Prompt behavior, matching and tag interpretation.</p></div><div class="settings-grid"><section class="setting"><h4>Insertion</h4><div class="field"><label>Append position</label><select data-setting="insertPosition"><option value="cursor" ${data.settings.insertPosition === 'cursor' ? 'selected' : ''}>Cursor position</option><option value="end" ${data.settings.insertPosition === 'end' ? 'selected' : ''}>End of field</option><option value="start" ${data.settings.insertPosition === 'start' ? 'selected' : ''}>Start of field</option></select></div><div class="field"><label>Duplicates</label><select data-setting="duplicateMode"><option value="skip" ${data.settings.duplicateMode === 'skip' ? 'selected' : ''}>Skip exact duplicates</option><option value="allow" ${data.settings.duplicateMode === 'allow' ? 'selected' : ''}>Always append</option></select></div>${settingCheckbox('closeAfterInsertion','Close Ainz Toolkit after successful insertion')}${settingCheckbox('confirmReplaceActions','Confirm Replace actions')}</section><section class="setting"><h4>Recognition</h4>${settingCheckbox('filterTechnicalTags','Filter technical request tags')}${settingCheckbox('keepBooruGroups','Preserve original tag categories')}<div class="field"><label>Animal appearance in Scene copy</label><select data-setting="animalAppearanceMode"><option value="auto" ${data.settings.animalAppearanceMode === 'auto' ? 'selected' : ''}>Auto detect</option><option value="keep" ${data.settings.animalAppearanceMode === 'keep' ? 'selected' : ''}>Always keep</option><option value="remove" ${data.settings.animalAppearanceMode === 'remove' ? 'selected' : ''}>Always remove</option></select></div></section><section class="setting"><h4>Visual similarity</h4><div class="field"><label>Detection threshold</label><input type="number" min="1" max="40" data-setting="similarityThreshold" value="${Number(data.settings.similarityThreshold) || 10}"></div><p>Uses perceptual, edge and luminance fingerprints. A match is always a suggestion.</p></section></div>`;
        if (section === 'image-data') return `<div class="settings-page-head"><h3>Image Data</h3><p>Local images, per-variant source metadata and manually triggered updates.</p></div><div class="settings-grid"><section class="setting"><h4>Display</h4><div class="field"><label>Show images</label><select data-setting="thumbnailDisplay"><option value="all" ${data.settings.thumbnailDisplay === 'all' ? 'selected' : ''}>Lists and details</option><option value="details" ${data.settings.thumbnailDisplay === 'details' ? 'selected' : ''}>Details only</option><option value="off" ${data.settings.thumbnailDisplay === 'off' ? 'selected' : ''}>Hidden</option></select></div><p>List thumbnails use one fixed, readable size so card layouts remain consistent.</p></section><section class="setting"><h4>Stored image</h4><div class="field"><label>Local quality</label><select data-setting="thumbnailQuality"><option value="compact" ${data.settings.thumbnailQuality === 'compact' ? 'selected' : ''}>Compact · 768 px</option><option value="local" ${data.settings.thumbnailQuality === 'local' ? 'selected' : ''}>Local Detail · 1024 px</option><option value="sharp" ${data.settings.thumbnailQuality === 'sharp' ? 'selected' : ''}>Sharp · 1280 px</option></select></div><p>List views use local images only. Web access occurs only after an explicit detail, refresh or repair action.</p><p>One WebP is shared by lists, details and comparisons. Existing files change only after a manually started rebuild or reload.</p></section>${renderThumbnailStorageSetting()}<section class="setting wide"><div class="box-title"><div><h4>Refresh all variant data</h4><p>Checks tags and metadata only when you start it. The preview shows the exact number of source requests.</p></div><button class="btn primary" data-action="open-bulk-image-refresh">Prepare Update</button></div></section><section class="setting wide"><div class="box-title"><div><h4>Library Health Check</h4><p>Local-only validation; no network requests.</p></div><button class="btn" data-action="run-health-check">Run Check</button></div></section></div>`;
        if (section === 'booru') return `<div class="settings-page-head"><h3>Booru Integrations</h3><p>Only the adapter for the current website runs.</p></div><div class="settings-grid"><section class="setting"><h4>Page tools</h4>${settingCheckbox('showTagPlusButtons','Show + button beside individual tags')}${settingCheckbox('autoOpenAfterImport','Open entry after importing')}<div class="field"><label>Batch delay (ms)</label><input type="number" min="100" max="5000" data-setting="batchImportDelay" value="${Number(data.settings.batchImportDelay) || 350}"></div></section>${renderBooruProfileSettings()}</div>`;
        if (section === 'data') return `<div class="settings-page-head"><h3>Data & Export</h3><p>Portable JSON exports and transaction-safe imports.</p></div><div class="settings-grid"><section class="setting"><h4>Portable library</h4><p>Exports can include source metadata and locally stored preview images.</p><div class="actions"><button class="btn" data-action="export">Export JSON</button><button class="btn" data-action="import">Import JSON</button></div></section><section class="setting"><h4>Reset library</h4><p>Large replacements are verified before the committed generation changes.</p><button class="btn danger" data-action="reset-data">Delete All Ainz Toolkit Data</button></section><section class="setting wide"><h4>Data safety</h4><p>Normal edits use revision-aware saving. Imports, migrations and full resets use a prepared transaction plus the previous committed generation as a temporary recovery point.</p></section></div>`;
        if (section === 'diagnostics') {
            const scan = state.naiDiagnosticScan;
            const scanResult = !IS_NAI ? '<div class="list-meta">The NAI field scan is available only on NovelAI Image Generation.</div>'
                : scan?.running ? '<div class="notice">Scanning NAI fields and restoring the previous panel state…</div>'
                : scan ? `<div class="notice ${scan.error ? 'error' : ''}">${scan.error ? escapeHtml(scan.error) : `${scan.fieldCount || 0} filled field${scan.fieldCount === 1 ? '' : 's'} detected in ${scan.durationMs || 0} ms · ${(scan.characters || []).length} character panel${(scan.characters || []).length === 1 ? '' : 's'}`}</div>${(scan.characters || []).length ? `<div class="chips">${scan.characters.map(character => `<span class="chip">Character ${character.index} · ${character.positive ? 'Prompt' : 'No Prompt'} · ${character.negative ? 'UC' : 'No UC'} · ${characterTypeLabel(character.type)}</span>`).join('')}</div>` : ''}` : '<div class="list-meta">No manual NAI field scan has been run in this session.</div>';
            const timings = performanceDiagnosticLines();
            return `<div class="settings-page-head"><h3>Diagnostics</h3><p>Manual checks, local performance timings and recoverable integration errors from this browser session.</p></div><div class="settings-grid"><section class="setting"><h4>Version</h4><p>Script ${SCRIPT_VERSION}<br>Data schema ${SCHEMA_VERSION}<br>Site: ${escapeHtml(SITE)}</p></section><section class="setting"><h4>Session diagnostics</h4><div class="actions"><button class="btn" data-action="copy-diagnostics">Copy</button><button class="btn ghost" data-action="clear-diagnostics" ${state.diagnostics.length ? '' : 'disabled'}>Clear Errors</button></div></section><section class="setting wide"><div class="box-title"><div><h4 style="margin:0">Measured operations</h4><p style="margin-top:5px">Prompt text is never included. Timings accumulate only while this page is open.</p></div></div>${timings.length ? timings.map(line => `<div class="diagnostic-row"><span>${escapeHtml(line)}</span></div>`).join('') : '<div class="list-meta">No measured operation has run in this session yet.</div>'}</section><section class="setting wide"><div class="box-title"><div><h4 style="margin:0">Manual NAI field scan</h4><p style="margin-top:5px">Runs only when pressed. It may switch through all NAI fields and then restores the previous character and tab.</p></div>${IS_NAI ? `<button class="btn primary" data-action="run-nai-diagnostic-scan" ${scan?.running ? 'disabled' : ''}>${scan?.running ? 'Scanning…' : 'Run Field Scan'}</button>` : ''}</div>${scanResult}</section><section class="setting wide">${state.diagnostics.length ? state.diagnostics.slice(-20).reverse().map(entry => `<div class="diagnostic-row"><strong>${escapeHtml(entry.area)}</strong><div class="list-meta">${escapeHtml(entry.message)}${entry.context ? ` · ${escapeHtml(entry.context)}` : ''} · ${formatDate(entry.at)}</div></div>`).join('') : '<div class="empty">No errors recorded in this session.</div>'}</section></div>`;
        }
        return `<div class="settings-page-head"><h3>General</h3><p>Start behavior and local history.</p></div><div class="settings-grid"><section class="setting"><h4>History</h4><div class="field"><label>Maximum states</label><input type="number" min="5" max="200" data-setting="maxHistory" value="${Number(data.settings.maxHistory) || 50}"></div><p>Snapshots are created manually and before Character or Full Image operations.</p></section><section class="setting"><h4>Start page</h4><div class="field"><select data-setting="homePage">${renderHomePageOptions(data.settings.homePage)}</select></div></section><section class="setting wide"><h4>Storage</h4><p>Library, settings and local images stay in this Tampermonkey script storage. No NovelAI credentials or cookies are read.</p></section></div>`;
    }


    function renderImportRenameModal() {
        const preview = state.renamePreview || { scope:'all', total:0, records:[], includeManual:false };
        const protectedCount = importRenameTargets(preview.scope).filter(wrapper => wrapper.item.nameMode === 'manual').length;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div><div class="modal-title">Rename Imported Entries</div><div class="list-meta">${preview.records.length} change${preview.records.length === 1 ? '' : 's'} · ${preview.total} import${preview.total === 1 ? '' : 's'} checked</div></div><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div><div class="modal-body"><div class="notice">Names are generated from the primary variant using <strong>${escapeHtml(data.settings.importNameTemplate)}</strong>. No source requests are made.</div><label class="check-row" style="margin:12px 0"><input id="rename-include-manual" type="checkbox" ${preview.includeManual ? 'checked' : ''}><span>Include ${protectedCount} manually named entr${protectedCount === 1 ? 'y' : 'ies'}</span><button class="btn small" data-action="refresh-import-rename-preview">Refresh preview</button></label>${preview.records.length ? `<div class="rename-list">${preview.records.slice(0,120).map(record => `<div class="rename-row"><span class="rename-old">${escapeHtml(record.oldName)}</span><span>→</span><span class="rename-new">${escapeHtml(record.newName)}</span></div>`).join('')}</div>${preview.records.length > 120 ? `<div class="list-meta" style="margin-top:8px">+ ${preview.records.length - 120} additional changes</div>` : ''}` : '<div class="empty">No names need to be changed with the current protection setting.</div>'}</div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="apply-import-renames" ${preview.records.length ? '' : 'disabled'}>Rename ${preview.records.length || ''}</button></div></div></div>`;
    }

    function renderMergeVariantsModal() {
        const items = (state.modalPayload?.ids || []).map(id => findItem('imported', id)).filter(Boolean);
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal compact-modal"><div class="modal-head"><div><div class="modal-title">Merge Imports as Variants</div><div class="list-meta">Manual correction · never performed automatically</div></div><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div><div class="modal-body"><div class="notice warn">All variants and local images are moved into the chosen target entry. The other cards are removed.</div><div class="field"><label>Keep this card and its name</label><select id="merge-variant-target">${items.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name || 'Untitled')} · ${getItemVariants(item).length} variant(s)</option>`).join('')}</select></div><div class="list" style="margin-top:12px">${items.map(item => `<div class="list-row"><span>${escapeHtml(item.name || 'Untitled')}</span><span class="list-meta">${getItemVariants(item).length}</span></div>`).join('')}</div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="apply-merge-selected-variants" ${items.length >= 2 ? '' : 'disabled'}>Merge as Variants</button></div></div></div>`;
    }

    /* Combined, conservative style vocabulary used by Danbooru-family tag sets.
     * Exact aliases are accepted; arbitrary "*_style" guesses are deliberately
     * avoided so characters, copyrights and artists do not become style cards.
     */
    const STYLE_TAG_DEFINITIONS = [
        ['line_art','Line art','Drawing','primary',['lineart','line art']],
        ['sketch','Sketch','Drawing','primary',['rough_sketch','rough sketch']],
        ['monochrome','Monochrome','Drawing','primary',['black_and_white','black and white']],
        ['watercolor','Watercolor','Traditional media','primary',['watercolor_(medium)','watercolor_(artwork)','watercolor painting']],
        ['oil_painting','Oil painting','Traditional media','primary',['oil painting','oil_on_canvas']],
        ['acrylic_painting','Acrylic painting','Traditional media','primary',['acrylic_paint','acrylic painting']],
        ['gouache','Gouache','Traditional media','primary',[]],
        ['ink','Ink','Traditional media','primary',['inked','ink drawing']],
        ['ink_wash','Ink wash','Traditional media','primary',['ink wash painting','wash painting']],
        ['sumi_e','Sumi-e','Traditional media','primary',['sumi-e','sumie']],
        ['colored_pencil','Colored pencil','Traditional media','primary',['colour_pencil','colored pencil']],
        ['graphite','Graphite','Traditional media','primary',['pencil_(medium)','pencil drawing']],
        ['charcoal','Charcoal','Traditional media','primary',['charcoal drawing']],
        ['pastel','Pastel','Traditional media','primary',['pastel_(medium)']],
        ['chalk','Chalk','Traditional media','primary',['chalk drawing']],
        ['crayon','Crayon','Traditional media','primary',['crayon drawing']],
        ['marker','Marker','Traditional media','primary',['marker_(medium)','marker drawing']],
        ['airbrush','Airbrush','Traditional media','primary',['airbrushed']],
        ['traditional_media','Traditional media','Traditional media','primary',['traditional media']],
        ['faux_traditional_media','Faux traditional media','Digital media','primary',['fake traditional media']],
        ['woodblock_print','Woodblock print','Printmaking','primary',['woodblock print','woodcut']],
        ['engraving','Engraving','Printmaking','primary',[]],
        ['etching','Etching','Printmaking','primary',[]],
        ['lithograph','Lithograph','Printmaking','primary',['lithography']],
        ['collage','Collage','Craft','primary',[]],
        ['paper_cutout','Paper cutout','Craft','primary',['paper cutout']],
        ['papercraft','Papercraft','Craft','primary',['paper craft']],
        ['stained_glass','Stained glass','Craft','primary',['stained glass']],
        ['mosaic','Mosaic','Craft','primary',[]],
        ['nihonga','Nihonga','Traditional media','primary',[]],
        ['ukiyo_e','Ukiyo-e','Printmaking','primary',['ukiyo-e','ukiyoe']],
        ['digital_painting','Digital painting','Digital media','primary',['digital painting']],
        ['digital_media','Digital media','Digital media','primary',['digital media','digital_art']],
        ['pixel_art','Pixel art','Digital media','primary',['pixel art','pixelart']],
        ['vector_art','Vector art','Digital media','primary',['vector art','vector']],
        ['oekaki','Oekaki','Digital media','primary',[]],
        ['tegaki','Tegaki','Digital media','primary',[]],
        ['3d_cg','3D CG','3D','primary',['3d','3dcg','cgi','3d render']],
        ['low_poly','Low poly','3D','primary',['low-poly','low poly']],
        ['voxel_art','Voxel art','3D','primary',['voxel art']],
        ['cel_shading','Cel shading','Rendering','primary',['cell_shading','cel shaded']],
        ['lineless','Lineless','Rendering','primary',['lineless_art']],
        ['flat_color','Flat color','Rendering','primary',['flat_colors','flat colour','flat colors']],
        ['anime_coloring','Anime coloring','Rendering','primary',['anime_colouring','anime coloring']],
        ['anime_screencap','Anime screencap','Screen media','primary',['anime_screenshot','anime screencap','anime screenshot']],
        ['manga','Manga','Screen media','primary',['manga_style']],
        ['comic','Comic','Screen media','primary',['comic_style','comic panel']],
        ['game_cg','Game CG','Screen media','primary',['game cg','visual_novel_cg']],
        ['storybook_illustration','Storybook illustration','Illustration','primary',['storybook illustration','children_book_illustration']],
        ['scientific_illustration','Scientific illustration','Illustration','primary',['scientific illustration']],
        ['technical_drawing','Technical drawing','Illustration','primary',['technical drawing']],
        ['silhouette','Silhouette','Rendering','primary',['silhouette art']],
        ['abstract','Abstract','Art movement','primary',['abstract_art']],
        ['art_deco','Art Deco','Art movement','primary',['art deco']],
        ['art_nouveau','Art Nouveau','Art movement','primary',['art nouveau']],
        ['baroque','Baroque','Art movement','primary',[]],
        ['rococo','Rococo','Art movement','primary',[]],
        ['cubism','Cubism','Art movement','primary',['cubist']],
        ['expressionism','Expressionism','Art movement','primary',['expressionist']],
        ['impressionism','Impressionism','Art movement','primary',['impressionist']],
        ['minimalism','Minimalism','Art movement','primary',['minimalist']],
        ['pointillism','Pointillism','Art movement','primary',['pointillist']],
        ['pop_art','Pop art','Art movement','primary',['pop art']],
        ['surrealism','Surrealism','Art movement','primary',['surreal','surrealist']],
        ['ligne_claire','Ligne claire','Art movement','primary',['ligne claire']],
        ['realistic','Realistic','Aesthetic','primary',['realism','semi_realistic']],
        ['photorealistic','Photorealistic','Aesthetic','primary',['photorealism','photo_realistic']],
        ['fake_photograph','Fake photograph','Aesthetic','primary',['fake photo','faux photograph']],
        ['retro_artstyle','Retro artstyle','Aesthetic','primary',['retro artstyle','retro_style']],
        ['vintage','Vintage','Aesthetic','primary',['vintage_style']],
        ['fine_art_parody','Fine art parody','Aesthetic','primary',['fine art parody']],
        ['chiaroscuro','Chiaroscuro','Lighting style','primary',[]],
        ['noir','Noir','Lighting style','primary',['film_noir','noir_style']],
        ['halftone','Halftone','Texture / effect','modifier',['halftone_dots']],
        ['dithering','Dithering','Texture / effect','modifier',['dithered']],
        ['film_grain','Film grain','Texture / effect','modifier',['film grain','grainy']],
        ['scanlines','Scanlines','Texture / effect','modifier',['scan_lines']],
        ['glitch','Glitch','Texture / effect','modifier',['glitch_art','glitch effect']],
        ['chromatic_aberration','Chromatic aberration','Optical effect','modifier',['chromatic aberration']],
        ['bloom','Bloom','Optical effect','modifier',['bloom effect']],
        ['bokeh','Bokeh','Optical effect','modifier',[]],
        ['depth_of_field','Depth of field','Optical effect','modifier',['depth of field']],
        ['lens_flare','Lens flare','Optical effect','modifier',['lens flare']],
        ['motion_blur','Motion blur','Optical effect','modifier',['motion blur']],
        ['high_contrast','High contrast','Color / tone','modifier',['high contrast']],
        ['muted_colors','Muted colors','Color / tone','modifier',['muted color','muted colours']],
        ['pastel_colors','Pastel colors','Color / tone','modifier',['pastel color','pastel colours']],
        ['limited_palette','Limited palette','Color / tone','modifier',['limited palette']],
        ['multiple_monochrome','Multiple monochrome','Color / tone','modifier',['multiple monochrome']]
    ].map(([id,label,family,kind,aliases]) => ({ id, label, family, kind, aliases }));

    const STYLE_TAG_BY_ALIAS = (() => {
        const map = new Map();
        for (const definition of STYLE_TAG_DEFINITIONS) {
            for (const value of [definition.id, definition.label, ...(definition.aliases || [])]) {
                const key = canonicalTag(value);
                if (key) map.set(key, definition);
            }
        }
        return map;
    })();

    function detectStyleTagDefinitions(tags, primaryOnly = false) {
        const found = new Map();
        for (const tag of tags || []) {
            const definition = STYLE_TAG_BY_ALIAS.get(canonicalTag(tag));
            if (!definition || (primaryOnly && definition.kind !== 'primary')) continue;
            found.set(definition.id, definition);
        }
        return [...found.values()];
    }

    function stableTextHash(value) {
        let hash = 2166136261;
        for (const character of String(value || '')) {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function styleProfileId(type, canonical) {
        return `style-profile-${type}-${stableTextHash(`${type}|${canonical}`)}`;
    }

    function ensureStyleProfile(type, tag, options = {}) {
        const canonical = canonicalTag(tag);
        if (!canonical) return null;
        let profile = data.styleArtists.find(item => item.profileType === type && canonicalTag(item.canonicalTag || item.name || item.positive) === canonical);
        if (profile) return profile;
        const createdAt = nowIso();
        profile = normalizeStyleProfile({
            id: styleProfileId(type, canonical),
            name: options.label || humanizeImportLabel(tag),
            positive: normalizeBooruTag(tag),
            negative: '',
            category: type === 'artist' ? 'Artists' : type === 'copyright' ? 'Copyrights' : 'Styles',
            profileType: type,
            canonicalTag: canonical,
            styleFavorite: false,
            createdAt,
            updatedAt: createdAt
        });
        data.styleArtists.push(profile);
        return profile;
    }

    function syncStyleProfilesFromLibrary(save = true) {
        let added = 0;
        const before = data.styleArtists.length;
        for (const wrapper of getImportedWrappers()) {
            for (const variant of getItemVariants(wrapper.item)) {
                const groups = variant.tagGroups || {};
                for (const tag of groups.artist || []) if (!data.styleArtists.some(item => item.profileType === 'artist' && canonicalTag(item.canonicalTag) === canonicalTag(tag))) { ensureStyleProfile('artist', tag); added++; }
                for (const tag of groups.copyright || []) if (!data.styleArtists.some(item => item.profileType === 'copyright' && canonicalTag(item.canonicalTag) === canonicalTag(tag))) { ensureStyleProfile('copyright', tag); added++; }
                for (const definition of detectStyleTagDefinitions(splitPrompt(variant.tags || ''), true)) {
                    if (!data.styleArtists.some(item => item.profileType === 'style' && canonicalTag(item.canonicalTag) === canonicalTag(definition.id))) { ensureStyleProfile('style', definition.id, { label: definition.label }); added++; }
                }
            }
        }
        for (const image of data.styleImages || []) for (const styleTag of image.styleTags || []) {
            const definition = STYLE_TAG_DEFINITIONS.find(entry => canonicalTag(entry.id) === canonicalTag(styleTag));
            if (!data.styleArtists.some(item => item.profileType === 'style' && canonicalTag(item.canonicalTag) === canonicalTag(styleTag))) { ensureStyleProfile('style', styleTag, { label: definition?.label }); added++; }
        }
        if (save && data.styleArtists.length !== before) scheduleSave('Style profiles synchronized');
        return added;
    }

    function getStyleProfileReferences(profile) {
        const canonical = canonicalTag(profile?.canonicalTag || profile?.positive || profile?.name);
        const imported = [];
        for (const wrapper of getImportedWrappers()) {
            for (const variant of getItemVariants(wrapper.item)) {
                const groups = variant.tagGroups || {};
                const matches = profile?.profileType === 'artist'
                    ? (groups.artist || []).some(tag => canonicalTag(tag) === canonical)
                    : profile?.profileType === 'copyright'
                        ? (groups.copyright || []).some(tag => canonicalTag(tag) === canonical)
                        : detectStyleTagDefinitions(splitPrompt(variant.tags || ''), true).some(definition => canonicalTag(definition.id) === canonical);
                if (matches) imported.push({ type:'imported', item:wrapper.item, variant });
            }
        }
        const local = profile?.profileType === 'style'
            ? (data.styleImages || []).filter(image => (image.styleTags || []).some(tag => canonicalTag(tag) === canonical)).map(image => ({ type:'local', image }))
            : [];
        return [...imported, ...local];
    }
    /* v3 UI composition. Legacy renderers stay available as compatibility fallbacks. */

    function renderSettingsPageV3(section) {
        if (section === 'library') {
            return `<div class="settings-page-head"><h3>Library</h3><p>Prompt insertion and tag interpretation.</p></div><div class="settings-grid">
                <section class="setting"><h4>Insertion</h4><div class="field"><label>Append position</label><select data-setting="insertPosition"><option value="cursor" ${data.settings.insertPosition === 'cursor' ? 'selected' : ''}>Cursor position</option><option value="end" ${data.settings.insertPosition === 'end' ? 'selected' : ''}>End of field</option><option value="start" ${data.settings.insertPosition === 'start' ? 'selected' : ''}>Start of field</option></select></div><div class="field"><label>Duplicates</label><select data-setting="duplicateMode"><option value="skip" ${data.settings.duplicateMode === 'skip' ? 'selected' : ''}>Skip exact duplicates</option><option value="allow" ${data.settings.duplicateMode === 'allow' ? 'selected' : ''}>Always append</option></select></div>${settingCheckbox('closeAfterInsertion','Close Ainz Toolkit after successful insertion')}${settingCheckbox('confirmReplaceActions','Confirm Replace actions')}</section>
                <section class="setting"><h4>Recognition</h4>${settingCheckbox('filterTechnicalTags','Filter technical request tags')}${settingCheckbox('keepBooruGroups','Preserve original tag categories')}<div class="field"><label>Animal appearance in Scene copy</label><select data-setting="animalAppearanceMode"><option value="auto" ${data.settings.animalAppearanceMode === 'auto' ? 'selected' : ''}>Auto detect</option><option value="keep" ${data.settings.animalAppearanceMode === 'keep' ? 'selected' : ''}>Always keep</option><option value="remove" ${data.settings.animalAppearanceMode === 'remove' ? 'selected' : ''}>Always remove</option></select></div><p>Facial expressions remain available when appearance tags are removed.</p></section>
            </div>`;
        }
        if (section === 'image-data') {
            const profile = data.settings.similarityProfile || 'balanced';
            const example = applyImportNameTemplate(data.settings.importNameTemplate, { character:'Cynthia', source:'Danbooru', artist:'Mituyota 76', post_id:'11802199' });
            return `<div class="settings-page-head"><h3>Image Data</h3><p>Local images, per-variant metadata, visual matching and import names.</p></div><div class="settings-grid">
                <section class="setting"><h4>Display</h4><div class="field"><label>Show images</label><select data-setting="thumbnailDisplay"><option value="all" ${data.settings.thumbnailDisplay === 'all' ? 'selected' : ''}>Lists and details</option><option value="details" ${data.settings.thumbnailDisplay === 'details' ? 'selected' : ''}>Details only</option><option value="off" ${data.settings.thumbnailDisplay === 'off' ? 'selected' : ''}>Hidden</option></select></div><p>List thumbnails use one fixed, readable size. Local images have no badge; <strong>WEB</strong> and <strong>MISSING</strong> appear only for fallback states.</p></section>
                <section class="setting"><h4>Stored local image</h4><div class="field"><label>Quality</label><select data-setting="thumbnailQuality"><option value="compact" ${data.settings.thumbnailQuality === 'compact' ? 'selected' : ''}>Compact · up to 768 px</option><option value="local" ${data.settings.thumbnailQuality === 'local' ? 'selected' : ''}>Local Detail · up to 1024 px · recommended</option><option value="sharp" ${data.settings.thumbnailQuality === 'sharp' ? 'selected' : ''}>Sharp · up to 1280 px</option></select></div><p>List views use local images only. Web access occurs only after an explicit detail, refresh or repair action.</p><p>One adaptively compressed WebP is shared by lists, details and comparisons. Existing files change only after a manually started rebuild or reload.</p></section>
                ${renderThumbnailStorageSetting()}
                <section class="setting"><h4>Visual matching</h4><div class="field"><label>Sensitivity</label><select data-setting="similarityProfile"><option value="strict" ${profile === 'strict' ? 'selected' : ''}>Strict</option><option value="balanced" ${profile === 'balanced' ? 'selected' : ''}>Balanced · recommended</option><option value="sensitive" ${profile === 'sensitive' ? 'selected' : ''}>Sensitive</option></select></div><p>${profile === 'strict' ? 'Best for duplicates and almost identical exports; fewest suggestions.' : profile === 'sensitive' ? 'Also suggests stronger edits and recolors; review false positives carefully.' : 'Recognizes close variants such as recolors while keeping unrelated matches restrained.'} Matches are suggestions and never merge automatically.</p></section>
                <section class="setting wide"><div class="box-title"><div><h4>Import naming</h4><p>Only imported Booru images use this scheme. Character and Full Image names from NovelAI remain untouched.</p></div></div><div class="field"><label>Default scheme</label><input id="import-name-template" value="${escapeAttr(data.settings.importNameTemplate)}" maxlength="180" autocomplete="off"></div><div class="chips"><span class="chip">{character}</span><span class="chip">{source}</span><span class="chip">{artist}</span><span class="chip">{post_id}</span></div><div class="notice" style="margin-top:10px">Preview: <strong id="import-name-example">${escapeHtml(example)}</strong><br><span class="list-meta">Source means Danbooru, Gelbooru or e621. Two characters become A &amp; B; larger groups become A + n.</span></div><div class="actions" style="margin-top:12px"><button class="btn" data-action="reset-import-name-template">Reset scheme</button><button class="btn primary" data-action="preview-import-renames">Preview library rename</button></div><p>Manually edited names are protected by default. Existing names start as Legacy; generated names are marked Auto. Every mass rename supports Undo.</p></section>
                <section class="setting wide"><div class="box-title"><div><h4>Refresh all variant data</h4><p>Updates each variant's own tags and metadata sequentially. Nothing runs in the background.</p></div><button class="btn primary" data-action="open-bulk-image-refresh">Prepare Update</button></div></section>
                <section class="setting wide"><div class="box-title"><div><h4>Library Health Check</h4><p>Inspection is local-only. Repairs run automatically only after you review and start them.</p></div><button class="btn" data-action="run-health-check">Run Check</button></div></section>
            </div>`;
        }
        return renderSettingsPage(section);
    }

    function importedVariantTagGroups(item, variant) {
        const groups = [];
        const seen = new Set();
        const sourceGroups = variant?.tagGroups || item?.tagGroups || {};
        for (const key of [...ALL_BOORU_GROUPS, 'unknown']) {
            const tags = [];
            for (const rawTag of Array.isArray(sourceGroups[key]) ? sourceGroups[key] : []) {
                const tag = String(rawTag || '').trim();
                const canonical = canonicalTag(tag);
                if (!tag || !canonical || seen.has(canonical)) continue;
                seen.add(canonical);
                tags.push(tag);
            }
            if (tags.length) groups.push({ key, label:CATEGORY_LABELS[key] || humanizeImportLabel(key), tags });
        }
        const other = [];
        for (const rawTag of splitPrompt(variant?.tags || item?.tags || '')) {
            const tag = String(rawTag || '').trim();
            const canonical = canonicalTag(tag);
            if (!tag || !canonical || seen.has(canonical)) continue;
            seen.add(canonical);
            other.push(tag);
        }
        if (other.length) {
            const existing = groups.find(group => group.key === 'unknown');
            if (existing) existing.tags.push(...other);
            else groups.push({ key:'unknown', label:CATEGORY_LABELS.unknown, tags:other });
        }
        return groups;
    }

    function renderImportedVariantTagPanel(item, variant) {
        const groups = importedVariantTagGroups(item, variant);
        const allTags = groups.flatMap(group => group.tags);
        const id = escapeAttr(item.id);
        const variantId = escapeAttr(variant?.id || '');
        const allRaw = escapeAttr(allTags.join(', '));
        if (!allTags.length) return '<div class="empty">No tags are stored for this variant.</div>';
        return `<div class="variant-tag-toolbar"><span class="list-meta">${allTags.length} tags in ${groups.length} categor${groups.length === 1 ? 'y' : 'ies'}</span><div class="actions"><button class="btn small" data-action="copy-variant-tag" data-id="${id}" data-variant-id="${variantId}" data-tags="${allRaw}">Copy all</button>${IS_NAI ? `<button class="btn primary small" data-action="insert-active-variant-tags" data-id="${id}" data-variant-id="${variantId}" data-tags="${allRaw}">Insert all</button><button class="btn small" data-action="replace-active-variant-tags" data-id="${id}" data-variant-id="${variantId}">Replace all</button>` : ''}</div></div><div class="variant-tag-groups">${groups.map(group => {
            const raw = escapeAttr(group.tags.join(', '));
            return `<section class="variant-tag-section" data-tag-category="${escapeAttr(group.key)}"><div class="variant-tag-section-head"><span>${escapeHtml(group.label)}</span><div class="actions"><span class="list-meta">${group.tags.length}</span><button class="btn small" data-action="copy-variant-tag" data-id="${id}" data-variant-id="${variantId}" data-tags="${raw}">Copy</button>${IS_NAI ? `<button class="btn primary small" data-action="insert-variant-group" data-id="${id}" data-variant-id="${variantId}" data-tags="${raw}">Insert</button>` : ''}</div></div><div class="variant-tag-pills">${group.tags.map(tag => `<button class="tag-pill" data-action="copy-variant-tag" data-id="${id}" data-variant-id="${variantId}" data-tags="${escapeAttr(tag)}" title="Copy ${escapeAttr(formatBooruTagForNai(tag))}">${escapeHtml(formatBooruTagForNai(tag))}</button>`).join('')}</div></section>`;
        }).join('')}</div>`;
    }

    function renderItemDetailsModalV3() {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        if (!item) return '';
        if (payload.kind === 'fullImage') return renderFullImageTextDetailsModal(item);
        const title = item.name || item.label || item.tag || 'Untitled';
        const variants = getItemVariants(item);
        const variant = findVariant(item, state.detailVariantId || item.primaryVariantId);
        if (variant && state.detailVariantId !== variant.id) state.detailVariantId = variant.id;
        const variantIndex = Math.max(0, variants.findIndex(entry => entry.id === variant?.id));
        const sources = variant?.sources?.length ? variant.sources : (payload.kind === 'imported' ? [] : item.sources || []);
        const thumbnail = variant?.thumbnail || item.thumbnail;
        const imageUrls = variantImageCandidates(variant, 'detail');
        const hasImage = Boolean(thumbnail?.key || imageUrls.length);
        const backButton = state.detailReturn?.tag ? `<button class="btn ghost small" data-action="back-to-tag-result">← ${escapeHtml(state.detailReturn.tag)}</button>` : state.detailReturn?.health ? '<button class="btn ghost small" data-action="back-to-health-check">← Health Check</button>' : state.detailReturn?.styleProfile ? '<button class="btn ghost small" data-action="back-to-style-profile">← Style profile</button>' : '';
        const variantStrip = variants.length > 1 ? `<div class="variant-strip"><button class="icon-action small" data-action="previous-variant" title="Previous variant" aria-label="Previous variant">←</button><span class="variant-position">${variantIndex + 1} / ${variants.length}</span><button class="icon-action small" data-action="next-variant" title="Next variant" aria-label="Next variant">→</button><div class="field" style="min-width:190px;flex:1"><select data-setting="detail-variant">${variants.map((entry,index) => `<option value="${escapeAttr(entry.id)}" ${entry.id === variant?.id ? 'selected' : ''}>${escapeHtml(entry.label || `Variant ${index + 1}`)}${entry.id === item.primaryVariantId ? ' · Primary' : ''}</option>`).join('')}</select></div><button class="btn small ${state.compareVariants ? 'primary' : ''}" data-action="toggle-variant-compare">${state.compareVariants ? 'Close comparison' : 'Compare'}</button></div>` : '';
        const menu = `<div class="menu-wrap"><button class="icon-action" data-action="toggle-menu" data-menu="details" aria-expanded="false" title="More actions" aria-label="More actions">⋯</button><div class="overflow-menu" data-menu-panel="details" hidden><button class="menu-item" data-action="edit-item" data-kind="${escapeAttr(payload.kind)}" data-id="${escapeAttr(item.id)}">Edit entry</button><button class="menu-item" data-action="open-collection-picker" data-kind="${escapeAttr(payload.kind)}" data-id="${escapeAttr(item.id)}">Add to Collection…</button>${payload.kind === 'imported' ? '<button class="menu-item" data-action="rename-import-from-current-variant">Rename from this variant</button>' : ''}${variant && variant.id !== item.primaryVariantId ? '<button class="menu-item" data-action="set-primary-variant">Use this as primary variant</button>' : ''}${sources[0]?.url ? '<button class="menu-item" data-action="open-source" data-index="0">Open original post</button><button class="menu-item" data-action="copy-source-link" data-index="0">Copy source link</button><button class="menu-item" data-action="check-source-tags" data-index="0">Check source for updated tags</button>' : ''}${sources.length > 1 ? '<button class="menu-item" data-action="check-all-source-tags">Check all sources</button>' : ''}${sources.length ? '<button class="menu-item" data-action="reload-item-thumbnail">Reload local image from source</button>' : ''}<button class="menu-item" data-action="set-thumbnail-file">Set local image from file…</button>${payload.kind === 'imported' && variants.length > 1 ? '<button class="menu-item" data-action="detach-current-variant">Move this variant to a new card</button><button class="menu-item danger" data-action="remove-current-variant">Remove current variant</button>' : ''}${sources.length ? '<button class="menu-item danger" data-action="remove-item-sources">Remove source information</button>' : ''}${thumbnail?.key ? '<button class="menu-item danger" data-action="remove-item-thumbnail">Remove local image</button>' : ''}</div></div>`;
        const visual = state.compareVariants && variants.length > 1
            ? renderVariantComparison(item, variants)
            : `${variantStrip}${hasImage ? `<div class="detail-image"><img data-detail-image-urls="${escapeAttr(JSON.stringify(imageUrls))}" ${thumbnail?.key ? `data-detail-thumbnail-key="${escapeAttr(thumbnail.key)}"` : ''} data-thumbnail-owner-id="${escapeAttr(item.id)}" data-thumbnail-variant-id="${escapeAttr(variant?.id || '')}" alt="${escapeAttr(title)}"><span class="thumb-placeholder">Loading image…</span></div>` : '<div class="empty">No image is available for this variant.</div>'}`;
        const tagText = payload.kind === 'imported' ? (variant?.tags || item.tags || '') : getItemPreviews(payload.kind, item, variant).map(preview => preview.text).join('\n\n');
        const importedTagPanel = payload.kind === 'imported' ? renderImportedVariantTagPanel(item, variant) : '';
        const image = variant?.image || {};
        const firstSource = sources[0] || {};
        const infoRows = [
            ['Created',formatDate(item.createdAt)], ['Modified',formatDate(item.updatedAt)], ['Last used',item.lastUsed ? formatDate(item.lastUsed) : 'Never'], ['Times used',String(Number(item.usageCount) || 0)],
            ['Resolution',image.width && image.height ? `${image.width} × ${image.height}` : ''], ['Format',image.fileExt ? String(image.fileExt).toUpperCase() : ''], ['File size',image.fileSize ? formatBytes(image.fileSize) : ''], ['File hash',image.md5 || ''],
            ['Artist',(image.artist || firstSource.artist || []).join(', ')], ['Parent post',image.parentId || firstSource.parentId || '']
        ].filter(([,value]) => value !== '');
        const sourcesHtml = sources.map((source,index) => `<div class="source-row"><strong>${escapeHtml(sourceSiteLabel(source.site))}${source.postId ? ` #${escapeHtml(source.postId)}` : ''}</strong><div class="list-meta">${source.lastCheckedAt ? `Checked ${formatRelative(source.lastCheckedAt)}` : 'Not checked in this version'}</div><div class="actions" style="margin-top:7px">${source.url ? `<button class="btn small" data-action="open-source" data-index="${index}">Open</button><button class="btn ghost small" data-action="copy-source-link" data-index="${index}">Copy link</button>` : ''}<button class="btn ghost small" data-action="check-source-tags" data-index="${index}">Check tags</button></div></div>`).join('');
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large item-detail-modal no-foot"><div class="modal-head"><div><div class="actions">${backButton}</div><div class="modal-title"><span>${escapeHtml(title)}</span>${variants.length > 1 ? `<span class="variant-badge">${variants.length} variants</span>` : ''}</div><div class="list-meta">${escapeHtml(kindLabel(payload.kind))}${item.category ? ` · ${escapeHtml(item.category)}` : ''}${variant?.label ? ` · ${escapeHtml(variant.label)}` : ''}</div></div><div class="actions">${menu}<button class="icon-action" data-action="close-modal" title="Close" aria-label="Close">✕</button></div></div><div class="modal-body"><div class="detail-workspace"><section class="detail-pane visual">${visual}</section><section class="detail-pane"><div class="box-title"><span>Tags</span><span class="list-meta">${payload.kind === 'imported' ? importedVariantTagGroups(item, variant).flatMap(group => group.tags).length : splitPrompt(tagText).length}</span></div>${payload.kind === 'imported' ? importedTagPanel : `<div class="detail-tags">${escapeHtml(tagText) || 'No tags stored.'}</div>`}${item.notes ? `<details class="box"><summary>Notes</summary><div class="detail-tags">${escapeHtml(item.notes)}</div></details>` : ''}</section><section class="detail-pane"><div class="box-title"><span>Information</span><span class="list-meta">Variant data</span></div><dl class="detail-meta">${infoRows.map(([label,value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl>${sourcesHtml ? `<div class="box-title" style="margin-top:14px"><span>Sources</span><span class="list-meta">${sources.length}</span></div>${sourcesHtml}` : ''}</section></div></div></div></div>`;
    }

    function renderFullImageTextDetailsModal(item) {
        const characters = Array.isArray(item.characters) ? item.characters : [];
        const menuKey = `full-image-detail:${item.id}`;
        const menu = `<div class="menu-wrap"><button class="icon-action" data-action="toggle-menu" data-menu="${escapeAttr(menuKey)}" aria-label="More actions">⋯</button><div class="overflow-menu" data-menu-panel="${escapeAttr(menuKey)}" hidden><button class="menu-item" data-action="edit-item" data-kind="fullImage" data-id="${escapeAttr(item.id)}">Edit entry</button><button class="menu-item" data-action="open-collection-picker" data-kind="fullImage" data-id="${escapeAttr(item.id)}">Add to Collection…</button><button class="menu-item" data-action="duplicate-item" data-kind="fullImage" data-id="${escapeAttr(item.id)}">Duplicate</button><button class="menu-item danger" data-action="delete-item" data-kind="fullImage" data-id="${escapeAttr(item.id)}">Delete</button></div></div>`;
        const characterCards = characters.map((character,index) => `<section class="full-image-character"><div class="box-title"><span>${escapeHtml(character.name || `Character ${index + 1}`)}</span><span class="list-meta">${characterTypeLabel(character.naiCharacterType)}</span></div><div class="prompt-pair"><div><strong>Prompt</strong><p>${escapeHtml(character.positive || 'Empty')}</p></div><div><strong>Undesired</strong><p>${escapeHtml(character.negative || 'Empty')}</p></div></div></section>`).join('');
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal full-image-detail-modal"><div class="modal-head"><div><div class="modal-title">${escapeHtml(item.name || 'Full Image')}</div><div class="list-meta">Full Image · ${characters.length} character${characters.length === 1 ? '' : 's'} · created ${formatDate(item.createdAt)}</div></div><div class="actions">${menu}<button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div></div><div class="modal-body"><div class="full-image-base-grid"><section class="full-image-character"><div class="box-title"><span>Main Prompt</span></div><p>${escapeHtml(item.basePositive || 'Empty')}</p></section><section class="full-image-character"><div class="box-title"><span>Main Undesired Content</span></div><p>${escapeHtml(item.baseNegative || 'Empty')}</p></section></div>${characterCards ? `<div class="full-image-character-grid">${characterCards}</div>` : ''}${item.notes ? `<details class="box"><summary>Notes</summary><div class="detail-tags">${escapeHtml(item.notes)}</div></details>` : ''}</div><div class="modal-foot"><button class="btn" data-action="apply-item" data-kind="fullImage" data-id="${escapeAttr(item.id)}">Append selected…</button><button class="btn primary" data-action="replace-item" data-kind="fullImage" data-id="${escapeAttr(item.id)}">Replace selected…</button></div></div></div>`;
    }

    function renderBulkImageRefreshModalV3() {
        const run = state.bulkImageRefresh;
        if (run?.running || run?.finished) {
            const failed = run.failedRecords?.length || 0;
            return `<div class="modal-backdrop"><div class="modal compact-modal"><div class="modal-head"><div><div class="modal-title">${run.finished ? 'Image Data Update' : 'Refreshing Image Data'}</div><div class="list-meta">Sequential requests · safe to pause or cancel</div></div>${run.finished ? '<button class="icon-action" data-action="close-bulk-refresh" aria-label="Close">✕</button>' : ''}</div><div class="modal-body"><div class="progress-track"><span style="width:${run.total ? Math.round(run.done / run.total * 100) : 0}%"></span></div><p>${run.done} / ${run.total} sources · ${run.success} updated · ${run.failed} failed</p><div class="list-meta">${escapeHtml(run.current || (run.finished ? 'Finished' : 'Preparing…'))}</div>${failed ? `<div class="notice warn" style="margin-top:12px">${failed} failed source${failed === 1 ? '' : 's'} can be retried without repeating successful requests.</div>` : ''}</div><div class="modal-foot">${run.finished ? `${failed ? '<button class="btn" data-action="retry-failed-bulk-refresh">Retry failed only</button>' : ''}<button class="btn primary" data-action="close-bulk-refresh">Done</button>` : `<button class="btn" data-action="toggle-bulk-refresh-pause">${run.paused ? 'Resume' : 'Pause'}</button><button class="btn danger" data-action="cancel-bulk-refresh">Cancel</button>`}</div></div></div>`;
        }
        const sourceCount = getBulkImageRefreshRecords('all').length;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal compact-modal"><div class="modal-head"><div><div class="modal-title">Refresh Variant Image Data</div><div class="list-meta">Manual operation · no background checks</div></div><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div><div class="modal-body"><div class="notice">Up to ${sourceCount} source requests will be made one at a time. Every variant keeps its own tags and metadata.</div><div class="field"><label>Website</label><select id="bulk-refresh-site"><option value="all">All websites · ${sourceCount} requests</option>${BOORU_SITES.map(site => `<option value="${site}">${sourceSiteLabel(site)} · ${getBulkImageRefreshRecords(site).length}</option>`).join('')}</select></div><label class="check-row"><input id="bulk-refresh-tags" type="checkbox" checked><span>Update tags for every variant</span></label><label class="check-row"><input id="bulk-refresh-metadata" type="checkbox" checked><span>Update source and image metadata</span></label><label class="check-row"><input id="bulk-refresh-images" type="checkbox"><span>Repair missing local images</span></label></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="start-bulk-image-refresh">Start Update</button></div></div></div>`;
    }

    function renderHealthCheckModalV3() {
        const report = state.healthReport || { issues:[], checked:0, repairable:0 };
        const groups = report.issues.reduce((map,issue) => ((map[issue.type] ||= []).push(issue), map), {});
        const filter = state.healthIssueFilter || '';
        const visible = filter ? (groups[filter] || []) : report.issues;
        const repairableVisible = visible.filter(issue => issue.repair).length;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large"><div class="modal-head"><div><div class="modal-title">Library Health Check</div><div class="list-meta">${report.checked || 0} entries checked · inspection is local only</div></div><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div><div class="modal-body">${report.running ? '<div class="empty">Checking local library data…</div>' : report.issues.length ? `<div class="notice warn">${report.issues.length} issue${report.issues.length === 1 ? '' : 's'} found. Opening an issue never repairs it; repair starts only after confirmation.</div><div class="health-group-grid">${Object.entries(groups).map(([type,issues]) => `<button class="health-group ${filter === type ? 'active' : ''}" data-action="filter-health-issues" data-type="${escapeAttr(type)}"><span>${escapeHtml(healthIssueLabel(type))}</span><strong>${issues.length}</strong></button>`).join('')}</div>${filter ? `<div class="box-title"><button class="btn ghost small" data-action="clear-health-filter">← All issue groups</button><span>${escapeHtml(healthIssueLabel(filter))}</span></div>` : ''}<div class="health-issue-list">${visible.map(issue => issue.id ? `<button class="health-issue-row" data-action="open-health-entry" data-kind="${escapeAttr(issue.kind || 'imported')}" data-id="${escapeAttr(issue.id)}" data-variant-id="${escapeAttr(issue.variantId || '')}"><span><strong>${escapeHtml(issue.title || 'Library item')}</strong><small>${escapeHtml(issue.message)}</small></span><span>↗</span></button>` : `<div class="health-issue-row static"><span><strong>${escapeHtml(issue.title || 'Local data')}</strong><small>${escapeHtml(issue.message)}</small></span></div>`).join('')}</div>` : '<div class="notice">No consistency problems were found.</div>'}</div><div class="modal-foot"><button class="btn" data-action="close-modal">Close</button><button class="btn" data-action="run-health-check">Check again</button>${repairableVisible ? `<button class="btn primary" data-action="prepare-health-repair">Review &amp; repair ${repairableVisible}</button>` : ''}</div></div></div>`;
    }

    function openHealthIssueEntry(kind, id, variantId = '') {
        const item = findItem(kind, id);
        if (!item) return toast('The affected entry is no longer available', 'info');
        state.detailReturn = { health:true, filter:state.healthIssueFilter || '' };
        state.detailVariantId = findVariant(item, variantId || item.primaryVariantId)?.id || '';
        state.compareVariants = false;
        state.modal = 'item-details';
        state.modalPayload = { kind, id };
        state.openMenu = '';
        render();
    }
    function ensureStyleProfilesCurrent() {
        if (!styleProfilesDirty) return;
        styleProfilesDirty = false;
        const added = measureOperation('style-profile-sync', () => syncStyleProfilesFromLibrary(false));
        if (added) {
            scheduleSave('Style profiles synchronized', ['library','tags']);
            styleProfilesDirty = false;
        }
    }

    function renderStyleLibrary() {
        ensureStyleProfilesCurrent();
        const type = state.styleTypeFilter || 'all';
        const query = String(state.styleQuery || '').trim().toLowerCase();
        let records = getStyleImageRecords().filter(record => styleImageRecordMatchesType(record, type)
            && (!query || record.searchText.includes(query)));
        const favorites = new Set(data.styleFavorites || []);
        records = [...records].sort((left, right) => {
            if (state.styleSort === 'references') return right.references.length - left.references.length || String(left.title).localeCompare(String(right.title), 'en');
            if (state.styleSort === 'favorites') return Number(favorites.has(right.key)) - Number(favorites.has(left.key)) || String(left.title).localeCompare(String(right.title), 'en');
            return String(left.title || '').localeCompare(String(right.title || ''), 'en');
        });
        return `
            ${renderTargetBar()}
            <div class="section-head style-section-head">
                <div><h2 class="section-title">Style / Artist</h2><div class="section-subtitle">Each imported variant or local NovelAI reference appears once, with all of its style data together.</div></div>
                <div class="actions"><button class="btn ghost" data-action="open-style-tags">Style tags</button><button class="btn primary" data-action="upload-nai-style-image">Upload NAI PNG</button></div>
            </div>
            <div class="style-toolbar">
                <div class="segmented">${[['all','All'],['artist','Artists'],['copyright','Copyrights'],['style','Styles']].map(([value,label]) => `<button class="${type === value ? 'active' : ''}" data-action="style-type-filter" data-value="${value}">${label}</button>`).join('')}</div>
                <div class="field local-view-search"><label>Search this section</label><input id="style-search" type="search" autocomplete="off" value="${escapeAttr(state.styleQuery)}" placeholder="Artist, copyright or style …"></div>
                <div class="field"><label>Sort</label><select data-style-view="sort"><option value="name" ${state.styleSort === 'name' ? 'selected' : ''}>Name</option><option value="references" ${state.styleSort === 'references' ? 'selected' : ''}>Most references</option><option value="favorites" ${state.styleSort === 'favorites' ? 'selected' : ''}>Style favorites</option></select></div>
                <span class="result-count">${records.length} image${records.length === 1 ? '' : 's'} · ${(data.styleImages || []).length} local NAI</span>
            </div>
            ${records.length ? `<div class="style-image-grid">${records.slice(0, state.visibleLimit).map(renderStyleImageCard).join('')}</div>${records.length > state.visibleLimit ? `<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn" data-action="show-more">Show more</button></div>` : ''}` : '<div class="empty">No matching style images yet. Imported variants with Artist, Copyright or recognized style tags appear automatically; NovelAI PNGs can be added locally.</div>'}
        `;
    }

    function styleTaxonomySection(family) {
        if (['Drawing','Traditional media','Digital media','Printmaking','Craft','3D'].includes(family)) return 'medium';
        if (['Rendering','Lighting style'].includes(family)) return 'rendering';
        if (family === 'Color / tone') return 'color';
        if (['Texture / effect','Optical effect'].includes(family)) return 'effects';
        return 'style';
    }

    function styleSectionLabel(key) {
        return ({ artist:'Artist', copyright:'Copyright', medium:'Medium / Technique', style:'Style', rendering:'Rendering', color:'Color / Tone', effects:'Effects' })[key] || humanizeImportLabel(key);
    }

    function createStyleCategoryMap() {
        return new Map(['artist','copyright','medium','style','rendering','color','effects'].map(key => [key, new Map()]));
    }

    function addStyleCategoryTag(categories, key, rawTag, label = '') {
        const tag = String(rawTag || '').trim();
        const canonical = canonicalTag(tag);
        if (!canonical || !categories.has(key)) return;
        const bucket = categories.get(key);
        if (!bucket.has(canonical)) bucket.set(canonical, { raw:tag, label:label || humanizeImportLabel(tag) });
    }

    function populateStyleTaxonomy(categories, tags) {
        for (const definition of detectStyleTagDefinitions(tags || [], false)) {
            addStyleCategoryTag(categories, styleTaxonomySection(definition.family), definition.id, definition.label);
        }
    }

    function finalizedStyleCategories(categories) {
        return [...categories.entries()].map(([key,values]) => ({ key, label:styleSectionLabel(key), tags:[...values.values()] })).filter(group => group.tags.length);
    }

    function styleImportedRecord(item, variant) {
        const categories = createStyleCategoryMap();
        for (const tag of variant?.tagGroups?.artist || []) addStyleCategoryTag(categories, 'artist', tag);
        for (const tag of variant?.tagGroups?.copyright || []) addStyleCategoryTag(categories, 'copyright', tag);
        populateStyleTaxonomy(categories, splitPrompt(variant?.tags || ''));
        const finalCategories = finalizedStyleCategories(categories);
        if (!finalCategories.length) return null;
        const md5 = String(variant?.image?.md5 || variant?.sources?.find(source => source.md5)?.md5 || '').toLowerCase();
        const key = md5 ? `md5:${md5}` : `imported:${item.id}:${variant.id}`;
        const reference = { type:'imported', item, variant };
        const sites = [...new Set((variant.sources || []).map(source => sourceSiteLabel(source.site)).filter(Boolean))];
        return {
            key, title:item.name || variant.label || 'Imported style image', createdAt:variant.createdAt || item.createdAt || '',
            categories:finalCategories, references:[reference], cover:reference, sourceLabels:sites,
            searchText:[item.name,variant.label,...sites,...finalCategories.flatMap(group => group.tags.flatMap(tag => [tag.raw,tag.label]))].filter(Boolean).join(' ').toLowerCase()
        };
    }

    function styleLocalRecord(image) {
        const categories = createStyleCategoryMap();
        populateStyleTaxonomy(categories, [...(image.tags || []), ...(image.styleTags || [])]);
        const finalCategories = finalizedStyleCategories(categories);
        if (!finalCategories.length) return null;
        const reference = { type:'local', image };
        return {
            key:image.fileHash ? `sha256:${image.fileHash}` : `local:${image.id}`, title:image.filename || 'NovelAI style image', createdAt:image.createdAt || '',
            categories:finalCategories, references:[reference], cover:reference, sourceLabels:['Local NAI'],
            searchText:[image.filename,...finalCategories.flatMap(group => group.tags.flatMap(tag => [tag.raw,tag.label]))].filter(Boolean).join(' ').toLowerCase()
        };
    }

    function mergeStyleImageRecord(target, incoming) {
        target.references.push(...incoming.references);
        target.sourceLabels = [...new Set([...target.sourceLabels, ...incoming.sourceLabels])];
        const categories = createStyleCategoryMap();
        for (const record of [target,incoming]) for (const group of record.categories) for (const tag of group.tags) addStyleCategoryTag(categories, group.key, tag.raw, tag.label);
        target.categories = finalizedStyleCategories(categories);
        target.searchText = `${target.searchText} ${incoming.searchText}`.trim();
        return target;
    }

    function getStyleImageRecords() {
        const revision = `${revisions.library}|${revisions.styles}|${revisions.tags}|${data.styleImages?.length || 0}`;
        if (styleImageRecordCache.revision === revision) return styleImageRecordCache.records;
        const records = new Map();
        for (const wrapper of getImportedWrappers()) for (const variant of getItemVariants(wrapper.item)) {
            const record = styleImportedRecord(wrapper.item, variant);
            if (!record) continue;
            if (records.has(record.key)) mergeStyleImageRecord(records.get(record.key), record);
            else records.set(record.key, record);
        }
        for (const image of data.styleImages || []) {
            const record = styleLocalRecord(image);
            if (!record) continue;
            if (records.has(record.key)) mergeStyleImageRecord(records.get(record.key), record);
            else records.set(record.key, record);
        }
        styleImageRecordCache = { revision, records: [...records.values()] };
        return styleImageRecordCache.records;
    }

    function findStyleImageRecord(key) {
        return getStyleImageRecords().find(record => record.key === key) || null;
    }

    function styleImageRecordMatchesType(record, type) {
        if (type === 'all') return true;
        if (type === 'artist' || type === 'copyright') return record.categories.some(group => group.key === type);
        return record.categories.some(group => !['artist','copyright'].includes(group.key));
    }

    function styleImageRecordTags(record, groupKey = '') {
        return (record?.categories || []).filter(group => !groupKey || group.key === groupKey).flatMap(group => group.tags.map(tag => tag.raw));
    }

    function renderStyleImageCard(record) {
        const favorite = (data.styleFavorites || []).includes(record.key);
        const highlights = record.categories.flatMap(group => group.tags.slice(0, 1).map(tag => tag.label)).slice(0, 3);
        return `<article class="card style-image-card" data-action="open-style-gallery-image" data-key="${escapeAttr(record.key)}"><div class="style-image-card-visual">${renderStyleReferenceImage(record.cover, record.title)}</div><div class="style-image-card-copy"><div class="card-title-line"><div class="card-title" title="${escapeAttr(record.title)}">${escapeHtml(record.title)}</div><button class="star ${favorite ? 'on' : ''}" data-action="toggle-style-image-favorite" data-key="${escapeAttr(record.key)}" aria-label="Favorite in Style section">★</button></div><div class="card-meta">${escapeHtml(record.sourceLabels.join(' · ') || 'Style reference')}</div><div class="style-card-stats">${highlights.map(label => `<span class="card-fact">${escapeHtml(label)}</span>`).join('')}${record.references.length > 1 ? `<span class="card-fact accent">${record.references.length} identical references</span>` : ''}</div></div></article>`;
    }

    function renderStylePillMode() {
        return `<div class="style-pill-mode"><span>Tag click</span><div class="segmented compact">${[['browse','Browse'],['copy','Copy'],['insert','Insert']].map(([value,label]) => `<button class="${state.stylePillMode === value ? 'active' : ''}" data-action="set-style-pill-mode" data-value="${value}">${label}</button>`).join('')}</div></div>`;
    }

    function renderStyleImageDetailModal() {
        const record = findStyleImageRecord(state.styleSelectedImageKey || state.modalPayload?.key);
        if (!record) return '';
        const allTags = styleImageRecordTags(record);
        const returnToBrowse = Boolean(state.modalPayload?.returnToTagBrowse);
        const sourceRows = record.references.flatMap(reference => reference.type === 'local'
            ? [`<div class="source-row"><strong>Local NovelAI PNG</strong><div class="list-meta">${escapeHtml(reference.image.filename || 'Local style image')}</div></div>`]
            : (reference.variant.sources || []).map(source => `<div class="source-row"><strong>${escapeHtml(sourceSiteLabel(source.site))}${source.postId ? ` #${escapeHtml(source.postId)}` : ''}</strong>${source.url ? `<div class="actions"><button class="btn small" data-action="open-style-source" data-url="${escapeAttr(source.url)}">Open</button><button class="btn small" data-action="copy-style-source" data-url="${escapeAttr(source.url)}">Copy link</button></div>` : ''}</div>`));
        const localImage = record.references.find(reference => reference.type === 'local')?.image;
        const categorySections = record.categories.map(group => `<section class="style-image-category"><div class="variant-tag-section-head"><span>${escapeHtml(group.label)}</span><div class="actions"><span class="list-meta">${group.tags.length}</span><button class="btn small" data-action="copy-style-tags" data-tags="${escapeAttr(group.tags.map(tag => tag.raw).join(', '))}">Copy</button>${IS_NAI ? `<button class="btn primary small" data-action="insert-style-tags" data-tags="${escapeAttr(group.tags.map(tag => tag.raw).join(', '))}">Insert</button>` : ''}</div></div><div class="variant-tag-pills">${group.tags.map(tag => `<button class="tag-pill" data-action="style-tag-pill" data-tag="${escapeAttr(tag.raw)}" data-label="${escapeAttr(tag.label)}">${escapeHtml(tag.label)}</button>`).join('')}</div></section>`).join('');
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large style-image-detail-modal"><div class="modal-head"><div><div class="modal-title">${escapeHtml(record.title)}</div><div class="list-meta">${record.sourceLabels.map(escapeHtml).join(' · ')} · ${allTags.length} style tag${allTags.length === 1 ? '' : 's'}</div></div><div class="actions">${returnToBrowse ? '<button class="icon-action" data-action="return-to-style-tag-gallery" aria-label="Back to tag results">←</button>' : ''}<button class="star ${(data.styleFavorites || []).includes(record.key) ? 'on' : ''}" data-action="toggle-style-image-favorite" data-key="${escapeAttr(record.key)}" aria-label="Favorite in Style section">★</button><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div></div><div class="modal-body"><div class="style-image-detail-layout"><section class="style-image-detail-visual">${renderStyleReferenceImage(record.cover, record.title)}</section><section class="style-image-data"><div class="style-image-global-actions">${renderStylePillMode()}<div class="actions"><button class="btn" data-action="copy-style-tags" data-tags="${escapeAttr(allTags.join(', '))}">Copy all</button>${IS_NAI ? `<button class="btn primary" data-action="insert-style-tags" data-tags="${escapeAttr(allTags.join(', '))}">Insert all</button>` : ''}</div></div><div class="style-image-category-list">${categorySections}</div>${sourceRows.length ? `<details class="box style-image-sources"><summary>Sources · ${sourceRows.length}</summary>${sourceRows.join('')}</details>` : ''}${localImage ? `<button class="btn danger" data-action="delete-style-image" data-id="${escapeAttr(localImage.id)}">Delete local style image</button>` : ''}</section></div></div></div></div>`;
    }

    function styleRecordsForTag(tag) {
        const canonical = canonicalTag(tag);
        return getStyleImageRecords().filter(record => record.categories.some(group => group.tags.some(entry => canonicalTag(entry.raw) === canonical || canonicalTag(entry.label) === canonical)));
    }

    function renderStyleTagImagesModal() {
        const browse = state.styleTagBrowse || {};
        const tag = browse.tag || '';
        const label = browse.label || humanizeImportLabel(tag);
        const records = styleRecordsForTag(tag);
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large style-tag-images-modal"><div class="modal-head"><div><div class="modal-title">${escapeHtml(label)}</div><div class="list-meta">${records.length} image${records.length === 1 ? '' : 's'} with this style tag</div></div><div class="actions"><button class="btn" data-action="copy-style-tags" data-tags="${escapeAttr(tag)}">Copy</button>${IS_NAI ? `<button class="btn primary" data-action="insert-style-tags" data-tags="${escapeAttr(tag)}">Insert</button>` : ''}<button class="icon-action" data-action="close-style-tag-browse" aria-label="Back">←</button><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div></div><div class="modal-body">${records.length ? `<div class="style-tag-image-grid">${records.map(record => `<button class="style-tag-image-card" data-action="open-style-gallery-image" data-key="${escapeAttr(record.key)}" data-return="tag-browse"><span>${renderStyleReferenceImage(record.cover, record.title)}</span><strong>${escapeHtml(record.title)}</strong></button>`).join('')}</div>` : '<div class="empty">No saved style image currently contains this tag.</div>'}</div></div></div>`;
    }

    function styleProfileTypeLabel(type) {
        return type === 'artist' ? 'Artist' : type === 'copyright' ? 'Copyright' : 'Style';
    }

    function styleReferenceIdentity(reference) {
        return reference?.type === 'local' ? `local:${reference.image?.id || ''}` : `imported:${reference.item?.id || ''}:${reference.variant?.id || ''}`;
    }


    function renderStyleReferenceImage(reference, label = 'Style reference') {
        if (!reference) return '<span class="thumb-placeholder">No reference image</span>';
        if (reference.type === 'local') {
            const image = reference.image;
            const thumbnail = image?.thumbnail;
            return thumbnail?.key
                ? `<img data-thumbnail-key="${escapeAttr(thumbnail.key)}" data-thumbnail-version="${escapeAttr(thumbnail.createdAt || thumbnail.sizeBytes || '')}" data-thumbnail-owner-id="style-${escapeAttr(image.id)}" alt="${escapeAttr(label)}" loading="lazy"><span class="thumb-placeholder">Loading …</span>`
                : '<span class="thumb-placeholder">Local image missing</span>';
        }
        const variant = reference.variant;
        const thumbnail = variant?.thumbnail;
        if (!thumbnail?.key) return '<span class="thumb-placeholder">Local image missing</span><span class="image-state-badge">MISSING</span>';
        return `<img data-thumbnail-key="${escapeAttr(thumbnail.key)}" data-thumbnail-version="${escapeAttr(thumbnail.createdAt || thumbnail.sizeBytes || '')}" data-thumbnail-owner-id="${escapeAttr(reference.item?.id || '')}" data-thumbnail-variant-id="${escapeAttr(variant?.id || '')}" alt="${escapeAttr(label)}" loading="lazy"><span class="thumb-placeholder">Loading …</span>`;
    }


    function renderStyleProfileModal() {
        const profile = data.styleArtists.find(item => item.id === state.modalPayload?.id);
        if (!profile) return '';
        const references = getStyleProfileReferences(profile);
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large style-profile-modal"><div class="modal-head"><div><div class="modal-title">${escapeHtml(profile.name || profile.canonicalTag)}</div><div class="list-meta">${styleProfileTypeLabel(profile.profileType)} · ${references.length} references</div></div><div class="actions"><button class="star ${profile.styleFavorite ? 'on' : ''}" data-action="toggle-style-favorite" data-id="${escapeAttr(profile.id)}" aria-label="Favorite in Style section">★</button><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div></div><div class="modal-body">${references.length ? `<div class="style-reference-grid">${references.map(reference => renderStyleReferenceTile(profile, reference)).join('')}</div>` : '<div class="empty">No image reference currently contains this profile tag.</div>'}</div></div></div>`;
    }

    function renderStyleReferenceTile(profile, reference) {
        const identity = styleReferenceIdentity(reference);
        const isCover = profile.coverRef?.identity === identity;
        const local = reference.type === 'local';
        const title = local ? reference.image.filename : (reference.item.name || 'Imported image');
        return `<article class="style-reference-tile"><button class="style-reference-open" data-action="${local ? 'open-style-image' : 'open-style-import'}" data-image-id="${local ? escapeAttr(reference.image.id) : ''}" data-id="${local ? '' : escapeAttr(reference.item.id)}" data-variant-id="${local ? '' : escapeAttr(reference.variant.id)}"><span class="style-reference-visual">${renderStyleReferenceImage(reference, title)}</span><span class="style-reference-name">${escapeHtml(title)}</span></button><button class="icon-action small style-cover-action ${isCover ? 'active' : ''}" data-action="set-style-cover" data-profile-id="${escapeAttr(profile.id)}" data-identity="${escapeAttr(identity)}" title="Use as profile cover" aria-label="Use as profile cover">◆</button>${local ? '<span class="local-reference-label">LOCAL NAI</span>' : ''}</article>`;
    }

    function renderStyleTagCollectionModal() {
        const query = String(state.styleTagQuery || '').trim().toLowerCase();
        const definitions = STYLE_TAG_DEFINITIONS.filter(definition => !query || [definition.id,definition.label,definition.family,...definition.aliases].join(' ').toLowerCase().includes(query));
        const families = definitions.reduce((map, definition) => ((map[definition.family] ||= []).push(definition), map), {});
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large style-tag-modal"><div class="modal-head"><div><div class="modal-title">Style Tag Collection</div><div class="list-meta">Combined conservative vocabulary for Danbooru, Gelbooru and e621 imports</div></div><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div><div class="modal-body"><div class="style-tag-collection-tools"><div class="field"><label>Search style tags</label><input id="style-tag-search" type="search" autocomplete="off" value="${escapeAttr(state.styleTagQuery)}" placeholder="Watercolor, line art, anime screencap …"></div>${renderStylePillMode()}</div>${Object.entries(families).map(([family,items]) => `<section class="box style-tag-family"><div class="box-title"><span>${escapeHtml(family)}</span><span class="list-meta">${items.length}</span></div><div class="style-tag-list">${items.map(definition => `<button class="style-tag-row" data-action="style-tag-pill" data-tag="${escapeAttr(definition.id)}" data-label="${escapeAttr(definition.label)}"><span><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(definition.id)}${definition.aliases.length ? ` · ${escapeHtml(definition.aliases.join(', '))}` : ''}</small></span><span class="chip">${definition.kind === 'primary' ? 'Style' : 'Modifier'}</span></button>`).join('')}</div></section>`).join('') || '<div class="empty">No style tags match this search.</div>'}</div></div></div>`;
    }

    function renderStyleUploadPreviewModal() {
        const draft = state.styleUploadDraft;
        if (!draft) return '';
        const selected = new Set((draft.detectedStyleTags || []).map(canonicalTag));
        const availableDefinitions = STYLE_TAG_DEFINITIONS;
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large style-upload-modal"><div class="modal-head"><div><div class="modal-title">Import NovelAI Style Reference</div><div class="list-meta">Local to the Style section · no network request</div></div><button class="icon-action" data-action="cancel-style-upload" aria-label="Close">✕</button></div><div class="modal-body"><div class="style-upload-layout"><div class="style-upload-preview"><img src="${escapeAttr(draft.previewUrl)}" alt="NovelAI PNG preview"></div><div><div class="box-title"><span>${escapeHtml(draft.filename)}</span><span class="list-meta">${draft.width || '—'} × ${draft.height || '—'}</span></div><dl class="detail-meta">${[['Model',draft.metadata.source || draft.metadata.model],['Seed',draft.metadata.seed],['Sampler',draft.metadata.sampler],['Steps',draft.metadata.steps],['Guidance',draft.metadata.scale]].filter(([,value]) => value !== '' && value != null).map(([label,value]) => `<dt>${label}</dt><dd>${escapeHtml(String(value))}</dd>`).join('')}</dl><details class="box" open><summary>Embedded positive prompt · ${draft.tags.length} tags</summary><div class="detail-tags">${escapeHtml(draft.prompt || 'No positive prompt found.')}</div></details></div></div><section class="box"><div class="box-title"><div><strong>Assign recognized style tags</strong><div class="list-meta">Detected styles and modifiers are selected. You can add or remove exact catalog matches.</div></div><span>${selected.size} detected</span></div><div class="style-upload-tag-grid">${availableDefinitions.map(definition => `<label class="tag-toggle"><input type="checkbox" data-style-upload-tag="${escapeAttr(definition.id)}" ${selected.has(canonicalTag(definition.id)) ? 'checked' : ''}> ${escapeHtml(definition.label)}</label>`).join('')}</div></section></div><div class="modal-foot"><button class="btn" data-action="cancel-style-upload">Cancel</button><button class="btn primary" data-action="confirm-style-upload">Save locally in Style section</button></div></div></div>`;
    }

    function renderLocalStyleImageModal() {
        const image = (data.styleImages || []).find(entry => entry.id === state.modalPayload?.id);
        if (!image) return '';
        const stored = getStoredThumbnail(image.thumbnail?.key);
        const styles = (image.styleTags || []).map(id => STYLE_TAG_DEFINITIONS.find(definition => canonicalTag(definition.id) === canonicalTag(id))?.label || humanizeImportLabel(id));
        return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal large style-local-image-modal"><div class="modal-head"><div><div class="modal-title">${escapeHtml(image.filename)}</div><div class="list-meta">Local NovelAI style reference</div></div><div class="actions"><button class="icon-action" data-action="back-to-style-profile" aria-label="Back">←</button><button class="icon-action" data-action="close-modal" aria-label="Close">✕</button></div></div><div class="modal-body"><div class="style-local-detail"><div class="detail-image">${stored ? `<img src="${escapeAttr(stored)}" alt="${escapeAttr(image.filename)}">` : '<span class="thumb-placeholder">Local image data is missing</span>'}</div><div><div class="box-title"><span>Styles</span><span>${styles.length}</span></div><div class="chips">${styles.map(style => `<span class="chip">${escapeHtml(style)}</span>`).join('')}</div><details class="box" open><summary>Positive prompt</summary><div class="detail-tags">${escapeHtml(image.prompt || '')}</div></details>${image.negativePrompt ? `<details class="box"><summary>Undesired content</summary><div class="detail-tags">${escapeHtml(image.negativePrompt)}</div></details>` : ''}<button class="btn danger" data-action="delete-style-image" data-id="${escapeAttr(image.id)}">Delete local style image</button></div></div></div></div></div>`;
    }

    async function readPngTextChunks(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length < 8 || bytes.slice(0,8).some((value,index) => value !== [137,80,78,71,13,10,26,10][index])) throw new Error('The selected file is not a valid PNG');
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const latin1 = new TextDecoder('latin1');
        const utf8 = new TextDecoder('utf-8');
        const chunks = new Map();
        const put = (key,value) => { if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(value); };
        const inflate = async payload => {
            if (typeof DecompressionStream !== 'function') throw new Error('Compressed PNG metadata is not supported by this browser');
            const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate'));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        };
        for (let offset = 8; offset + 12 <= bytes.length;) {
            const length = view.getUint32(offset); offset += 4;
            const type = latin1.decode(bytes.slice(offset, offset + 4)); offset += 4;
            if (offset + length + 4 > bytes.length) break;
            const payload = bytes.slice(offset, offset + length); offset += length + 4;
            if (type === 'tEXt') {
                const separator = payload.indexOf(0); if (separator > 0) put(latin1.decode(payload.slice(0,separator)), latin1.decode(payload.slice(separator + 1)));
            } else if (type === 'zTXt') {
                const separator = payload.indexOf(0); if (separator > 0) put(latin1.decode(payload.slice(0,separator)), latin1.decode(await inflate(payload.slice(separator + 2))));
            } else if (type === 'iTXt') {
                const keywordEnd = payload.indexOf(0); if (keywordEnd < 1) continue;
                const keyword = latin1.decode(payload.slice(0,keywordEnd));
                const compressed = payload[keywordEnd + 1] === 1;
                let cursor = keywordEnd + 3;
                const languageEnd = payload.indexOf(0,cursor); if (languageEnd < 0) continue; cursor = languageEnd + 1;
                const translatedEnd = payload.indexOf(0,cursor); if (translatedEnd < 0) continue; cursor = translatedEnd + 1;
                const textBytes = compressed ? await inflate(payload.slice(cursor)) : payload.slice(cursor);
                put(keyword, utf8.decode(textBytes));
            }
            if (type === 'IEND') break;
        }
        return chunks;
    }

    function safeJsonObject(value) {
        try { const parsed = JSON.parse(String(value || '')); return parsed && typeof parsed === 'object' ? parsed : {}; }
        catch { return {}; }
    }

    function cleanNaiTagToken(value) {
        return normalizeBooruTag(String(value || '').trim().replace(/^[-+]?[\d.]+::/,'').replace(/::{1,2}$/,'').replace(/^[{}\[\]()]+|[{}\[\]()]+$/g,''));
    }

    async function parseNovelAiPng(file) {
        const chunks = await readPngTextChunks(file);
        const first = key => String(chunks.get(key)?.[0] || '');
        const comment = safeJsonObject(first('Comment') || first('comment'));
        const v4Positive = comment.v4_prompt?.caption || comment.v4_prompt || {};
        const v4Negative = comment.v4_negative_prompt?.caption || comment.v4_negative_prompt || {};
        const prompt = cleanPromptText(comment.prompt || v4Positive.base_caption || first('Description'));
        const negativePrompt = cleanPromptText(comment.uc || comment.negative_prompt || v4Negative.base_caption || '');
        const positiveCharacters = Array.isArray(v4Positive.char_captions) ? v4Positive.char_captions : [];
        const negativeCharacters = Array.isArray(v4Negative.char_captions) ? v4Negative.char_captions : [];
        const characters = positiveCharacters.map((character,index) => ({
            name:`Character ${index + 1}`,
            positive:cleanPromptText(character?.char_caption || character?.caption || character?.prompt || ''),
            negative:cleanPromptText(negativeCharacters[index]?.char_caption || negativeCharacters[index]?.caption || negativeCharacters[index]?.prompt || ''),
            center:character?.centers?.[0] || character?.center || null
        }));
        const allPositive = [prompt, ...characters.map(character => character.positive)].filter(Boolean).join(', ');
        const tags = [...new Set(splitPrompt(allPositive).map(cleanNaiTagToken).filter(Boolean))];
        const detected = detectStyleTagDefinitions(tags, false).map(definition => definition.id);
        const source = first('Source') || comment.source || comment.model || '';
        const software = first('Software');
        if (!/novelai/i.test([first('Title'), source, software].join(' ')) && !Object.keys(comment).length) throw new Error('No NovelAI metadata was found in this PNG');
        return {
            filename:file.name,
            prompt, negativePrompt, characters, tags,
            detectedStyleTags:[...new Set(detected)],
            width:Number(comment.width) || 0,
            height:Number(comment.height) || 0,
            metadata:{
                title:first('Title'), description:first('Description'), software, source,
                generationTime:first('Generation time') || first('Generation Time'),
                seed:comment.seed ?? '', sampler:comment.sampler || '', steps:comment.steps ?? '',
                scale:comment.scale ?? comment.cfg_scale ?? '', noiseSchedule:comment.noise_schedule || '',
                model:comment.model || '', signedHash:comment.signed_hash || ''
            }
        };
    }

    async function chooseNaiStylePng() {
        if (state.activeTab !== 'styles') return;
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/png,.png';
        input.addEventListener('change', async () => {
            const file = input.files?.[0]; if (!file) return;
            try {
                toast('Reading NovelAI PNG metadata …','info');
                const parsed = await parseNovelAiPng(file);
                let fileHash = '';
                try {
                    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
                    fileHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,'0')).join('');
                } catch { /* Exact deduplication remains optional on older engines. */ }
                const thumbnail = await createThumbnailFromBlob(file);
                state.styleUploadDraft = { ...parsed, fileHash, thumbnail, previewUrl:URL.createObjectURL(file) };
                state.modal = 'style-upload-preview'; state.modalPayload = {}; state.open = true; render();
            } catch (error) {
                reportDiagnostic('nai-style-png', error);
                toast(error.message || 'NovelAI PNG metadata could not be read','error');
            }
        }, { once:true });
        input.click();
    }

    function cancelStyleUpload() {
        if (state.styleUploadDraft?.previewUrl) URL.revokeObjectURL(state.styleUploadDraft.previewUrl);
        state.styleUploadDraft = null;
        closeModal();
    }

    async function confirmStyleUpload() {
        const draft = state.styleUploadDraft; if (!draft) return;
        const styleTags = [...root.querySelectorAll('[data-style-upload-tag]:checked')].map(input => canonicalTag(input.dataset.styleUploadTag)).filter(Boolean);
        if (!styleTags.length) return toast('Select at least one style profile for this image','error');
        const id = uid('style-image');
        const key = thumbnailStorageKey('style-image', id);
        try {
            const verified = await writeVerifiedThumbnailValue(key, draft.thumbnail.dataUrl);
            rememberThumbnailCache(key, verified);
            const thumbnail = { key, mime:draft.thumbnail.mime, width:draft.thumbnail.width, height:draft.thumbnail.height, sizeBytes:draft.thumbnail.sizeBytes, qualityProfile:draft.thumbnail.qualityProfile, encodingQuality:draft.thumbnail.encodingQuality, compressionPasses:draft.thumbnail.compressionPasses, hash:draft.thumbnail.hash, fingerprints:draft.thumbnail.fingerprints, createdAt:nowIso() };
            data.styleImages.push(normalizeStyleImage({ ...draft, id, styleTags, thumbnail, previewUrl:undefined }));
            for (const tag of styleTags) ensureStyleProfile('style', tag, { label:STYLE_TAG_DEFINITIONS.find(definition => canonicalTag(definition.id) === canonicalTag(tag))?.label });
            scheduleSave('NovelAI style image imported');
            URL.revokeObjectURL(draft.previewUrl); state.styleUploadDraft = null; state.modal = null; state.modalPayload = null; render();
            toast('NovelAI image saved locally in the Style section','success');
        } catch (error) { reportDiagnostic('style-image-storage',error); toast(error.message || 'The local style image could not be stored','error'); }
    }

    function deleteStyleImage(id) {
        const image = data.styleImages.find(entry => entry.id === id); if (!image) return;
        if (image.thumbnail?.key) {
            thumbnailLruCache.delete(image.thumbnail.key);
            try { GM_deleteValue(image.thumbnail.key); } catch { /* already missing */ }
        }
        data.styleImages = data.styleImages.filter(entry => entry.id !== id);
        data.styleFavorites = (data.styleFavorites || []).filter(key => key !== `local:${id}` && key !== `sha256:${image.fileHash || ''}`);
        scheduleSave('Local style image deleted');
        state.modal = null; state.modalPayload = null; state.styleSelectedImageKey = ''; render(); toast('Local style image deleted','success');
    }

    function openStyleTagBrowse(tag, label = '', options = {}) {
        state.styleTagBrowse = {
            tag:String(tag || ''),
            label:String(label || humanizeImportLabel(tag)),
            returnImageKey:String(options.returnImageKey || ''),
            returnModal:String(options.returnModal || '')
        };
        state.modal = 'style-tag-images';
        state.modalPayload = {};
        render();
    }

    function copyStyleTags(rawTags, message = 'Style tag copied') {
        const value = formatBooruPromptForNai(rawTags);
        if (!value) return toast('No style tags are stored in this selection', 'info');
        GM_setClipboard(value);
        toast(message, 'success');
    }

    async function insertStyleTags(rawTags) {
        const value = formatBooruPromptForNai(rawTags);
        if (!value) return toast('No style tags are stored in this selection', 'info');
        if (!IS_NAI) return toast('Prompt insertion is only available on NovelAI', 'error');
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
        state.operationBusy = true;
        try {
            const result = await writeMainPositivePrompt(value, false);
            if (result.failed) return toast('The NovelAI Main Prompt could not be detected', 'error');
            if (data.settings.closeAfterInsertion) closeToolkitPanel();
            else rememberCurrentViewState();
            toast(`${result.inserted || 0} style tag${result.inserted === 1 ? '' : 's'} appended to Main Prompt${result.skipped ? ` · ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped` : ''}`, 'success');
        } finally {
            state.operationBusy = false;
        }
    }

    function handleStyleAction(action, element) {
        if (action === 'open-style-tags') { state.modal='style-tags'; state.modalPayload={}; render(); return true; }
        if (action === 'upload-nai-style-image') { void chooseNaiStylePng(); return true; }
        if (action === 'style-type-filter') { state.styleTypeFilter=element.dataset.value || 'all'; state.visibleLimit=120; render(); return true; }
        if (action === 'open-style-gallery-image') { state.styleSelectedImageKey=element.dataset.key || ''; state.modal='style-image-detail'; state.modalPayload={key:state.styleSelectedImageKey,returnToTagBrowse:element.dataset.return === 'tag-browse'}; render(); return true; }
        if (action === 'toggle-style-image-favorite') { const key=element.dataset.key || ''; const favorites=new Set(data.styleFavorites || []); favorites.has(key) ? favorites.delete(key) : favorites.add(key); data.styleFavorites=[...favorites]; scheduleFavoriteSave([], true); render(); return true; }
        if (action === 'set-style-pill-mode') { state.stylePillMode=['browse','copy','insert'].includes(element.dataset.value) ? element.dataset.value : 'browse'; rememberCurrentViewState(); root.querySelectorAll('[data-action="set-style-pill-mode"]').forEach(button => button.classList.toggle('active',button.dataset.value === state.stylePillMode)); return true; }
        if (action === 'style-tag-pill') { const tag=element.dataset.tag || ''; const label=element.dataset.label || humanizeImportLabel(tag); if (state.stylePillMode === 'copy') copyStyleTags(tag); else if (state.stylePillMode === 'insert') void insertStyleTags(tag); else openStyleTagBrowse(tag,label,{returnImageKey:state.modal === 'style-image-detail' ? state.styleSelectedImageKey : '',returnModal:state.modal === 'style-tags' ? 'style-tags' : ''}); return true; }
        if (action === 'copy-style-tags') { copyStyleTags(element.dataset.tags || '', splitPrompt(element.dataset.tags || '').length === 1 ? 'Style tag copied' : 'Style tags copied'); return true; }
        if (action === 'insert-style-tags') { void insertStyleTags(element.dataset.tags || ''); return true; }
        if (action === 'open-style-source') { if (element.dataset.url) window.open(element.dataset.url,'_blank','noopener,noreferrer'); return true; }
        if (action === 'copy-style-source') { if (element.dataset.url) { GM_setClipboard(element.dataset.url); toast('Source link copied','success'); } return true; }
        if (action === 'return-to-style-tag-gallery') { state.modal='style-tag-images'; state.modalPayload={}; render(); return true; }
        if (action === 'close-style-tag-browse') { const browse=state.styleTagBrowse || {}; if (browse.returnImageKey) { state.styleSelectedImageKey=browse.returnImageKey; state.modal='style-image-detail'; state.modalPayload={key:browse.returnImageKey}; } else if (browse.returnModal === 'style-tags') { state.modal='style-tags'; state.modalPayload={}; } else { state.modal=null; state.modalPayload=null; } render(); return true; }
        if (action === 'open-style-profile') { state.styleSelectedProfileId=element.dataset.id || ''; state.modal='style-profile'; state.modalPayload={id:state.styleSelectedProfileId}; render(); return true; }
        if (action === 'toggle-style-favorite') { const profile=data.styleArtists.find(item=>item.id===element.dataset.id); if (profile) { profile.styleFavorite=!profile.styleFavorite; profile.updatedAt=nowIso(); scheduleFavoriteSave([{ kind:'style', item:profile }]); render(); } return true; }
        if (action === 'open-style-tag-profile') { const definition=STYLE_TAG_DEFINITIONS.find(entry=>entry.id===element.dataset.tag); openStyleTagBrowse(definition?.id || element.dataset.tag || '',definition?.label || humanizeImportLabel(element.dataset.tag),{returnModal:'style-tags'}); return true; }
        if (action === 'open-style-import') { state.detailReturn={styleProfile:state.styleSelectedProfileId}; state.detailVariantId=element.dataset.variantId || ''; state.modal='item-details'; state.modalPayload={kind:'imported',id:element.dataset.id}; render(); return true; }
        if (action === 'open-style-image') { state.modal='style-local-image'; state.modalPayload={id:element.dataset.imageId}; render(); return true; }
        if (action === 'back-to-style-profile') { state.modal='style-profile'; state.modalPayload={id:state.styleSelectedProfileId}; render(); return true; }
        if (action === 'set-style-cover') { const profile=data.styleArtists.find(item=>item.id===element.dataset.profileId); if (profile) { profile.coverRef={identity:element.dataset.identity}; profile.updatedAt=nowIso(); scheduleSave('Style cover changed'); render(); } return true; }
        if (action === 'cancel-style-upload') { cancelStyleUpload(); return true; }
        if (action === 'confirm-style-upload') { void confirmStyleUpload(); return true; }
        if (action === 'delete-style-image') { deleteStyleImage(element.dataset.id); return true; }
        return false;
    }

    function handleStyleInput(event) {
        if (event.target.id === 'style-search') { state.styleQuery=event.target.value; state.searchFocusId='style-search'; state.visibleLimit=120; scheduleContentRender(140); return true; }
        if (event.target.id === 'style-tag-search') { state.styleTagQuery=event.target.value; state.searchFocusId='style-tag-search'; scheduleContentRender(140); return true; }
        return false;
    }

    function handleStyleChange(event) {
        if (event.target.dataset.styleView === 'sort') { state.styleSort=event.target.value; render(); return true; }
        return false;
    }
    function blankItem(kind) {
        if (kind === 'character') return { name: '', positive: '', negative: '', naiCharacterType: 'unknown', category: '', notes: '', favorite: false };
        if (kind === 'base' || kind === 'style') return { name: '', positive: '', negative: '', category: '', notes: '', favorite: false };
        if (kind === 'set') return { name: '', type: 'positive', positiveTags: '', negativeTags: '', tags: '', category: '', notes: '', favorite: false, entryType: 'set' };
        if (kind === 'imported') return { name: '', type: 'positive', tags: '', category: 'Imported', notes: '', favorite: false, entryType: 'imported' };
        if (kind === 'fullImage') return { name: '', basePositive: '', baseNegative: '', characters: [], category: 'Full Image', notes: '', favorite: false };
        return { label: '', type: 'positive', tag: '', category: '', notes: '', favorite: true };
    }

    function onRootClick(event) {
        const element = event.target.closest('[data-action]');
        if (!element) {
            const card = event.target.closest('[data-card-kind][data-card-id]');
            if (card) {
                if (longPressTriggered) {
                    longPressTriggered = false;
                    return;
                }
                if (state.selectionMode) toggleSelectedItem(card.dataset.cardKind, card.dataset.cardId);
                else openItemDetails(card.dataset.cardKind, card.dataset.cardId, card.dataset.openVariantId || '');
                return;
            }
            if (state.selectionMode) exitSelectionMode();
            return;
        }
        const action = element.dataset.action;

        if (handleStyleAction(action, element, event)) return;

        if (action !== 'toggle-menu' && element.closest('[data-menu-panel]')) closeToolkitOverflowMenu();

        if (action === 'modal-backdrop' && event.target === element) return closeModal();

        const handlers = {
            'toggle-panel': toggleToolkitPanel,
            'close-panel': closeToolkitPanel,
            'toggle-full': () => { state.fullScreen = !state.fullScreen; saveUiPrefs(); render(); },
            'clear-search': () => { state.search = ''; state.searchFocusId = 'global-search'; render(); },
            'close-modal': closeModal,
            'tab': () => activateToolkitTab(element.dataset.tab),
            'new-item': () => openEditModal(element.dataset.kind),
            'edit-item': () => openEditModal(element.dataset.kind, element.dataset.id),
            'duplicate-item': () => duplicateItem(element.dataset.kind, element.dataset.id),
            'delete-item': () => confirmDeleteItem(element.dataset.kind, element.dataset.id),
            'toggle-favorite': () => toggleFavorite(element.dataset.kind, element.dataset.id),
            'apply-item': () => requestApplyItem(element.dataset.kind, element.dataset.id, false, element.dataset.variantId || ''),
            'replace-item': () => requestApplyItem(element.dataset.kind, element.dataset.id, true, element.dataset.variantId || ''),
            'card-variant-previous': () => cycleImportedCardVariant(element, -1),
            'card-variant-next': () => cycleImportedCardVariant(element, 1),
            'copy-variant-tag': () => copyImportedVariantTags(element.dataset.id, element.dataset.variantId, element.dataset.tags || '', 'Tag copied'),
            'insert-variant-group': () => void insertImportedVariantTags(element.dataset.id, element.dataset.variantId, element.dataset.tags || '', false),
            'insert-active-variant-tags': () => void insertImportedVariantTags(element.dataset.id, element.dataset.variantId, element.dataset.tags || '', false),
            'replace-active-variant-tags': () => requestApplyItem('imported', element.dataset.id, true, element.dataset.variantId || ''),
            'add-character': () => void addSavedCharacter(element.dataset.id),
            'refresh-fields': () => { refreshEditableFields(true); render(); toast('Prompt fields rescanned', 'info'); },
            'snapshot': () => snapshotPrompt('Manual state', true),
            'save-full-image': () => void saveCurrentFullImage(),
            'new-from-prompt': openFromPromptModal,
            'choose-from-prompt': () => chooseFromPrompt(element.dataset.kind),
            'import-nai-character': () => void openNaiCharacterImport(),
            'choose-nai-character': () => chooseNaiCharacter(Number(element.dataset.index)),
            'clear-recent': clearRecent,
            'clear-history': confirmClearHistory,
            'restore-history': () => restoreHistory(element.dataset.id),
            'delete-history': () => deleteHistory(element.dataset.id),
            'export': () => openExportModal(false),
            'perform-export': () => void performExport(),
            'import': openImportModal,
            'pick-import-file': pickImportFile,
            'perform-import': () => void performImport(),
            'reset-data': confirmResetData,
            'confirm-action': () => void performConfirmedAction(),
            'booru-import': openBooruImport,
            'reload-booru': () => void loadBooruPost(true),
            'copy-booru-tags': copyFilteredBooruTags,
            'copy-booru-artist': () => copyBooruPreset('artist'),
            'copy-booru-character-copyright': () => copyBooruPreset('characterCopyright'),
            'copy-booru-general': () => copyBooruPreset('general'),
            'copy-booru-text': () => copyBooruPreset('text'),
            'copy-booru-without-text': () => copyBooruPreset('withoutText'),
            'copy-booru-scene': () => copyBooruPreset('scene'),
            'copy-booru-selected': copySelectedBooruTags,
            'booru-select-all': booruSelectAll,
            'booru-select-none': booruSelectNone,
            'toggle-booru-tag': () => toggleBooruTag(element.dataset.tag),
            'toggle-booru-group': () => toggleBooruGroup(element.dataset.group),
            'save-booru-set': () => void saveBooruSet(),
            'confirm-full-image-apply': () => void confirmFullImageApply(),
            'toggle-menu': () => toggleToolkitOverflowMenu(element),
            'toggle-selected': () => toggleSelectedItem(element.dataset.kind, element.dataset.id),
            'exit-selection': exitSelectionMode,
            'select-all-visible': selectAllVisible,
            'bulk-category': openBulkCategoryModal,
            'apply-bulk-category': applyBulkCategory,
            'bulk-favorite': toggleBulkFavorite,
            'bulk-export': () => openExportModal(true),
            'bulk-remove-source': confirmBulkRemoveSources,
            'bulk-delete': confirmBulkDelete,
            'open-source': () => openSourceFromDetails(Number(element.dataset.index || 0)),
            'copy-source-link': () => copySourceFromDetails(Number(element.dataset.index || 0)),
            'remove-item-sources': confirmRemoveItemSources,
            'remove-item-thumbnail': confirmRemoveItemThumbnail,
            'check-source-tags': () => void checkSourceTags(Number(element.dataset.index || 0)),
            'check-all-source-tags': () => void checkSourceTags('all'),
            'apply-source-tag-diff': applySourceTagDiff,
            'save-duplicate-separately': () => void resolveBooruDuplicate('separate'),
            'add-duplicate-source': () => void resolveBooruDuplicate('add-source'),
            'add-duplicate-variant': () => void resolveBooruDuplicate('add-variant'),
            'remove-all-thumbnails': confirmRemoveAllThumbnails,
            'remove-orphan-thumbnails': () => void removeOrphanThumbnails(),
            'remove-category-thumbnails': () => { state.modal = 'thumbnail-category'; state.modalPayload = {}; state.openMenu = ''; render(); },
            'confirm-remove-category-thumbnails': () => void removeCategoryThumbnails(),
            'regenerate-missing-thumbnails': () => void regenerateMissingThumbnails()
            ,'regenerate-all-thumbnails': confirmRegenerateAllThumbnails
            ,'open-index-tag': () => { state.tagScrollTop = root.querySelector('#tag-list-scroll')?.scrollTop || state.tagScrollTop; state.tagResultsScrollTop = root.querySelector('#tag-results-panel')?.scrollTop || state.tagResultsScrollTop; state.selectedTag = element.dataset.tag || ''; state.visibleLimit = 120; render(); }
            ,'open-tag-image': () => { state.detailReturn = { tag:element.dataset.tag || state.selectedTag }; state.detailVariantId = element.dataset.variantId || ''; state.modal='item-details'; state.modalPayload={kind:'imported',id:element.dataset.id}; render(); }
            ,'back-to-tag-list': () => { state.selectedTag = ''; state.detailReturn = null; state.visibleLimit = 120; render(); }
            ,'back-to-tag-result': () => { clearDetailImageCache(); state.modal = null; state.modalPayload = null; state.openMenu = ''; render(); }
            ,'copy-index-tag': () => copyBooruText([element.dataset.tag], 'tag')
            ,'insert-index-tag': () => void insertDirectMainPromptTag(element.dataset.tag || '')
            ,'show-more': () => { state.visibleLimit += 120; render(); }
            ,'previous-variant': () => switchDetailVariant(-1)
            ,'next-variant': () => switchDetailVariant(1)
            ,'toggle-variant-compare': () => { state.compareVariants = !state.compareVariants; state.openMenu = ''; render(); }
            ,'set-primary-variant': setCurrentVariantPrimary
            ,'reload-item-thumbnail': () => void reloadCurrentVariantThumbnail()
            ,'set-thumbnail-file': () => void setCurrentThumbnailFromFile()
            ,'remove-current-variant': confirmRemoveCurrentVariant
            ,'clear-diagnostics': () => { state.diagnostics = []; render(); }
            ,'copy-diagnostics': copyDiagnostics
            ,'run-nai-diagnostic-scan': () => void runManualNaiDiagnosticScan()
            ,'show-all-sidebar': () => { data.settings.hiddenSidebarSections = []; scheduleSave('Sidebar sections shown'); render(); }
            ,'undo-action': () => void undoLastAction()
            ,'run-health-check': () => void runLibraryHealthCheck()
            ,'repair-health-issues': () => void repairLibraryHealthIssues()
            ,'perform-booru-batch': () => void performBooruBatch()
            ,'confirm-attach-source': () => void confirmAttachSource()
            ,'settings-section': () => { state.settingsSection = element.dataset.section || 'general'; render(); }
            ,'move-sidebar-section': () => moveSidebarSection(element.dataset.id, element.dataset.direction)
            ,'toggle-import-filters': () => { state.importFiltersOpen = !state.importFiltersOpen; render(); }
            ,'clear-import-filters': () => { state.importFilters = { site:'', artist:'', character:'', copyright:'', imageStatus:'', favorite:'all', minVariants:1, includeTags:'', excludeTags:'' }; render(); }
            ,'save-import-filter-collection': saveImportFiltersAsCollection
            ,'new-collection': () => openCollectionEditor()
            ,'edit-collection': () => openCollectionEditor(element.dataset.id)
            ,'open-collection': () => { state.activeCollectionId = element.dataset.id || ''; state.collectionPath = []; render(); }
            ,'collection-root': () => { state.activeCollectionId = ''; state.collectionPath = []; render(); }
            ,'collection-path': () => { state.collectionPath = state.collectionPath.slice(0, Number(element.dataset.depth) || 0); render(); }
            ,'open-collection-folder': () => { state.collectionPath.push({ field: element.dataset.field || '', value: element.dataset.value || '' }); render(); }
            ,'delete-collection': () => confirmDeleteCollection(element.dataset.id)
            ,'open-collection-picker': () => openCollectionPicker(element.dataset.kind, element.dataset.id)
            ,'add-selected-to-collection': () => addSelectedToCollection(element.dataset.id)
            ,'confirm-add-to-collection': () => confirmAddToCollection(element.dataset.id)
            ,'remove-from-active-collection': () => removeFromActiveCollection(element.dataset.kind, element.dataset.id, false)
            ,'exclude-from-active-collection': () => removeFromActiveCollection(element.dataset.kind, element.dataset.id, true)
            ,'open-collection-entry-picker': () => openCollectionEntryPicker(element.dataset.id)
            ,'apply-collection-entry-picker': applyCollectionEntryPicker
            ,'open-bulk-image-refresh': openBulkImageRefresh
            ,'start-bulk-image-refresh': () => void startBulkImageRefresh()
            ,'toggle-bulk-refresh-pause': toggleBulkImageRefreshPause
            ,'cancel-bulk-refresh': cancelBulkImageRefresh
            ,'close-bulk-refresh': () => { state.bulkImageRefresh = null; closeModal(); }
            ,'retry-failed-bulk-refresh': () => void retryFailedBulkImageRefresh()
            ,'preview-import-renames': () => openImportRenamePreview('all')
            ,'bulk-rename-imports': () => openImportRenamePreview('selected')
            ,'refresh-import-rename-preview': refreshImportRenamePreview
            ,'apply-import-renames': () => void applyImportRenames()
            ,'reset-import-name-template': resetImportNameTemplate
            ,'rename-import-from-primary': () => void renameImportFromVariant(element.dataset.id || '', element.dataset.variantId || '')
            ,'rename-import-from-current-variant': () => void renameImportFromVariant('', state.detailVariantId)
            ,'detach-current-variant': () => void detachCurrentVariant()
            ,'merge-selected-variants': openMergeSelectedVariants
            ,'apply-merge-selected-variants': () => void applyMergeSelectedVariants()
            ,'filter-health-issues': () => { state.healthIssueFilter = element.dataset.type || ''; render(); }
            ,'clear-health-filter': () => { state.healthIssueFilter = ''; render(); }
            ,'open-health-entry': () => openHealthIssueEntry(element.dataset.kind, element.dataset.id, element.dataset.variantId || '')
            ,'back-to-health-check': () => { state.detailReturn = null; state.modal = 'health-check'; state.modalPayload = {}; render(); }
            ,'prepare-health-repair': prepareHealthRepair
        };

        handlers[action]?.();
    }

    function onRootInput(event) {
        if (handleStyleInput(event)) return;
        if (event.target.id === 'global-search') {
            state.search = event.target.value;
            state.searchFocusId = 'global-search';
            scheduleContentRender(140);
            return;
        }
        if (event.target.id === 'imported-search') {
            state.importQuery = event.target.value;
            state.searchFocusId = 'imported-search';
            state.visibleLimit = 120;
            scheduleContentRender(140);
            return;
        }
        if (event.target.id === 'full-image-search') {
            state.fullImageQuery = event.target.value;
            state.searchFocusId = 'full-image-search';
            state.visibleLimit = 120;
            scheduleContentRender(140);
            return;
        }
        if (event.target.id === 'booru-set-name') state.booruDraft.name = event.target.value;
        if (event.target.id === 'booru-set-category') state.booruDraft.category = event.target.value;
        if (event.target.id === 'tag-collection-search') {
            state.tagQuery = event.target.value;
            state.searchFocusId = 'tag-collection-search';
            state.visibleLimit = 120;
            scheduleContentRender();
        }
        if (event.target.dataset.importFilter != null) {
            const key = event.target.dataset.importFilter;
            state.importFilters[key] = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
            state.visibleLimit = 120;
            scheduleContentRender();
        }
        if (event.target.id === 'collection-entry-search') {
            state.collectionPickerQuery = event.target.value;
            scheduleRender();
            return;
        }
        if (event.target.id === 'import-name-template') {
            data.settings.importNameTemplate = String(event.target.value || '').slice(0, 180);
            const example = root.querySelector('#import-name-example');
            if (example) example.textContent = applyImportNameTemplate(data.settings.importNameTemplate, { character:'Cynthia', source:'Danbooru', artist:'Mituyota 76', post_id:'11802199' });
            scheduleSave('Import naming scheme changed');
        }
        const collectionForm = event.target.closest?.('form[data-form="collection-edit"]');
        if (collectionForm && (event.target.name?.startsWith('ruleValue') || event.target.name === 'name' || event.target.name === 'description')) {
            refreshCollectionPreview(collectionForm);
        }
    }

    function onRootChange(event) {
        if (handleStyleChange(event)) return;
        const collectionForm = event.target.closest?.('form[data-form="collection-edit"]');
        if (collectionForm) {
            if (event.target.name === 'type') {
                updateCollectionEditorMode(collectionForm);
                return;
            }
            if (event.target.dataset.collectionRuleField != null) {
                updateCollectionRuleRow(event.target.closest('[data-collection-rule-row]'));
                refreshCollectionPreview(collectionForm);
                return;
            }
            if (event.target.dataset.collectionRuleOperator != null) {
                updateCollectionRuleValueVisibility(event.target);
                refreshCollectionPreview(collectionForm);
                return;
            }
            if (event.target.name === 'scope' || event.target.name === 'match' || event.target.name?.startsWith('ruleValue')) {
                refreshCollectionPreview(collectionForm);
                return;
            }
        }
        if (state.modalPayload?.kind === 'set' && event.target?.name === 'type') {
            const type = normalizeTagSetType(event.target.value);
            const form = event.target.closest('form[data-form="edit-item"]');
            const positive = form?.querySelector('[data-tag-set-field="positive"]');
            const negative = form?.querySelector('[data-tag-set-field="negative"]');
            if (positive) positive.hidden = type === 'negative';
            if (negative) negative.hidden = type === 'positive';
            return;
        }
        if (event.target.dataset.batchAction != null) {
            const record = state.booruBatchQueue[Number(event.target.dataset.batchAction)];
            if (record) record.action = event.target.value;
            return;
        }
        if (event.target.id === 'batch-save-source') {
            state.booruDraft.saveSource = event.target.checked;
            saveUiPrefs();
            return;
        }
        if (event.target.id === 'batch-save-thumbnail') {
            state.booruDraft.saveThumbnail = event.target.checked;
            saveUiPrefs();
            return;
        }
        if (event.target.id === 'booru-favorite') {
            state.booruDraft.favorite = event.target.checked;
            return;
        }
        if (event.target.id === 'booru-save-source') {
            state.booruDraft.saveSource = event.target.checked;
            saveUiPrefs();
            return;
        }
        if (event.target.id === 'booru-save-thumbnail') {
            state.booruDraft.saveThumbnail = event.target.checked;
            saveUiPrefs();
            return;
        }
        if (event.target.dataset.importView === 'sort') { state.importSort = event.target.value; render(); return; }
        if (event.target.dataset.importView === 'group') { state.importGroup = event.target.value; render(); return; }
        if (event.target.dataset.collectionEntry != null) {
            const key = event.target.dataset.collectionEntry;
            if (event.target.checked) state.collectionPickerSelection.add(key); else state.collectionPickerSelection.delete(key);
            const button = root.querySelector('[data-action="apply-collection-entry-picker"]');
            if (button) button.disabled = !state.collectionPickerSelection.size;
            return;
        }
        const key = event.target.dataset.setting;
        if (!key) return;

        if (key === 'positive-target') {
            state.selectedPositiveFieldId = event.target.value;
            const field = editableRegistry.get(event.target.value);
            if (field?.scope === 'character') selectCharacterTarget(field.characterIndex);
            saveUiPrefs();
            render();
            return;
        }
        if (key === 'negative-target') {
            state.selectedNegativeFieldId = event.target.value;
            const field = editableRegistry.get(event.target.value);
            if (field?.scope === 'character') selectCharacterTarget(field.characterIndex);
            saveUiPrefs();
            render();
            return;
        }
        if (key === 'character-target') {
            selectCharacterTarget(event.target.value);
            saveUiPrefs();
            render();
            return;
        }
        if (key === 'smart-view') {
            activateToolkitTab(`smart-${event.target.value}`);
            return;
        }
        if (key === 'smart-kind-filter') {
            state.smartKindFilter = event.target.value;
            render();
            return;
        }
        if (key === 'detail-variant') {
            state.detailVariantId = event.target.value;
            state.openMenu = '';
            render();
            return;
        }
        if (key === 'compare-left') {
            state.compareLeftId = event.target.value;
            render();
            return;
        }
        if (key === 'compare-right') {
            state.compareRightId = event.target.value;
            render();
            return;
        }
        if (key === 'compare-mode') {
            state.compareMode = event.target.value;
            render();
            return;
        }
        if (key === 'compare-opacity') {
            state.compareOpacity = Number(event.target.value) || 0;
            render();
            return;
        }
        if (key === 'profile-site') {
            state.profileSite = event.target.value;
            render();
            return;
        }
        if (key.startsWith('profile-group:')) {
            const [, site, group] = key.split(':');
            const profile = getBooruProfile(site);
            const groups = new Set(profile.includeGroups || []);
            if (event.target.checked) groups.add(group); else groups.delete(group);
            data.settings.booruProfiles[site] = { ...profile, includeGroups: [...groups] };
            scheduleSave(`Updated ${site} import profile`, ['settings']);
            return;
        }
        if (key.startsWith('profile-copy-group:')) {
            const [, site, group] = key.split(':');
            const profile = getBooruProfile(site);
            const groups = new Set(profile.copyGroups || []);
            if (event.target.checked) groups.add(group); else groups.delete(group);
            data.settings.booruProfiles[site] = { ...profile, copyGroups: [...groups] };
            scheduleSave(`Updated ${site} copy profile`, ['settings']);
            return;
        }
        if (key.startsWith('profile-format:')) {
            const site = key.split(':')[1];
            data.settings.booruProfiles[site] = { ...getBooruProfile(site), tagFormat: event.target.value };
            scheduleSave(`Updated ${site} tag format`, ['settings']);
            return;
        }
        if (key.startsWith('profile-censorship:')) {
            const site = key.split(':')[1];
            data.settings.booruProfiles[site] = { ...getBooruProfile(site), includeCensorshipTags: Boolean(event.target.checked) };
            scheduleSave(`Updated ${site} censorship filter`, ['settings']);
            if (site === SITE && state.booruPost) {
                prepareBooruSelection();
                render();
            }
            return;
        }
        if (key.startsWith('sidebar-section:')) {
            const id = key.slice('sidebar-section:'.length);
            const hidden = new Set(data.settings.hiddenSidebarSections || []);
            if (event.target.checked) hidden.delete(id); else hidden.add(id);
            data.settings.hiddenSidebarSections = [...hidden].filter(value => SIDEBAR_SECTION_IDS.includes(value));
            if (!isSidebarSectionVisible(sidebarSectionForTab(state.activeTab))) state.activeTab = resolveVisibleStartTab(data.settings.homePage);
            if (!isSidebarSectionVisible(sidebarSectionForTab(data.settings.homePage))) data.settings.homePage = resolveVisibleStartTab('');
            scheduleSave('Sidebar visibility changed');
            render();
            return;
        }

        let value;
        if (event.target.type === 'checkbox') value = event.target.checked;
        else if (event.target.type === 'number') value = Number(event.target.value);
        else value = event.target.value;

        data.settings[key] = value;
        if (key === 'maxHistory') data.history = data.history.slice(0, Math.max(5, Math.min(200, Number(value) || 50)));
        if (key === 'showTagPlusButtons') {
            if (value) installBooruTagButtons();
            else removeBooruTagButtons();
        }
        if (key === 'animalAppearanceMode') state.booruAnimalMode = value;
        scheduleSave(`Setting ${key}`);
        if (key === 'naiLauncherPosition') {
            syncNaiLauncher();
            render();
            return;
        }
        if (['accent','cardLayout','thumbnailDisplay','similarityProfile'].includes(key)) render();
    }

    function onRootSubmit(event) {
        const form = event.target.closest('form[data-form]');
        if (!form) return;
        event.preventDefault();
        if (form.dataset.form === 'edit-item') saveEditForm(form);
        if (form.dataset.form === 'collection-edit') saveCollectionForm(form);
    }

    function onRootKeydown(event) {
        if (event.key === 'Escape' && openToolkitMenu) closeToolkitOverflowMenu();
        else if (event.key === 'Escape' && state.modal) closeModal();
        if (event.key === 'Enter' && ['global-search','imported-search','full-image-search'].includes(event.target.id)) event.preventDefault();
    }

    function preserveFocusAfterRender() {
        const id = state.searchFocusId;
        state.searchFocusId = '';
        if (!id) return;
        const input = root.querySelector(`#${id}`);
        if (!input) return;
        try { input.focus({ preventScroll:true }); } catch { input.focus(); }
        input.setSelectionRange?.(input.value.length, input.value.length);
    }

    function selectionKey(kind, id) {
        return `${kind}:${id}`;
    }

    function onCardPointerDown(event) {
        if (event.button !== 0 || event.target.closest('button,input,a,select,textarea')) return;
        const card = event.target.closest('[data-card-kind][data-card-id]');
        if (!card) return;
        cancelCardLongPress();
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            longPressTriggered = true;
            state.selectionMode = true;
            state.selectedItems.add(selectionKey(card.dataset.cardKind, card.dataset.cardId));
            state.openMenu = '';
            render();
        }, 500);
    }

    function cancelCardLongPress() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    function toggleSelectedItem(kind, id) {
        const key = selectionKey(kind, id);
        state.selectionMode = true;
        if (state.selectedItems.has(key)) state.selectedItems.delete(key);
        else state.selectedItems.add(key);
        if (!state.selectedItems.size) return exitSelectionMode();
        render();
    }

    function exitSelectionMode() {
        state.selectionMode = false;
        state.selectedItems.clear();
        state.openMenu = '';
        render();
    }

    function getSelectedWrappers() {
        return allLibraryWrappers().filter(wrapper => state.selectedItems.has(selectionKey(wrapper.kind, wrapper.item.id)));
    }

    function getVisibleLibraryWrappers() {
        if (state.search.trim()) return searchLibrary(state.search.trim().toLowerCase());
        if (state.activeTab.startsWith('smart-')) return getSmartViewItems(state.activeTab.replace(/^smart-/, ''), state.smartKindFilter);
        const map = {
            characters: data.characters.map(item => ({ kind: 'character', item })),
            sets: getManualTagSets().map(item => ({ kind: 'set', item })),
            bases: data.bases.map(item => ({ kind: 'base', item })),
            styles: data.styleArtists.map(item => ({ kind: 'style', item })),
            'full-images': data.fullImages.map(item => ({ kind: 'fullImage', item })),
            tags: data.favoriteTags.map(item => ({ kind: 'tag', item })),
            imported: getImportedWrappers()
        };
        if (map[state.activeTab]) return map[state.activeTab];
        if (state.activeTab === 'quick') {
            const combined = [...collectFavoriteItems()];
            const seen = new Set();
            return combined.filter(wrapper => {
                const key = selectionKey(wrapper.kind, wrapper.item.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        return [];
    }

    function selectAllVisible() {
        for (const wrapper of getVisibleLibraryWrappers()) state.selectedItems.add(selectionKey(wrapper.kind, wrapper.item.id));
        render();
    }

    function openBulkCategoryModal() {
        if (!state.selectedItems.size) return;
        state.modal = 'bulk-category';
        state.modalPayload = {};
        state.openMenu = '';
        render();
    }

    function applyBulkCategory() {
        const category = String(root.querySelector('#bulk-category-name')?.value || '').trim();
        if (!category) return toast('Enter a category name', 'error');
        const selected = getSelectedWrappers();
        for (const wrapper of selected) {
            wrapper.item.category = category;
            wrapper.item.updatedAt = nowIso();
        }
        scheduleSave('Selected entries moved');
        closeModal();
        exitSelectionMode();
        toast(`${selected.length} entries moved`, 'success');
    }

    function toggleBulkFavorite() {
        const selected = getSelectedWrappers();
        if (!selected.length) return;
        const favorite = !selected.every(wrapper => wrapper.item.favorite);
        for (const wrapper of selected) {
            wrapper.item.favorite = favorite;
            wrapper.item.updatedAt = nowIso();
        }
        scheduleFavoriteSave(selected);
        render();
    }

    function confirmBulkRemoveSources() {
        const count = getSelectedWrappers().filter(wrapper => wrapper.item.sources?.length).length;
        if (!count) return toast('The selected entries have no source information', 'info');
        state.modal = 'confirm';
        state.modalPayload = { title: 'Remove Source Information', message: `Remove source information from ${count} selected entr${count === 1 ? 'y' : 'ies'}? Stored thumbnails remain available.`, confirmLabel: 'Remove Sources', danger: true, action: 'bulk-remove-sources' };
        render();
    }

    function confirmBulkDelete() {
        const count = getSelectedWrappers().length;
        if (!count) return;
        state.modal = 'confirm';
        state.modalPayload = { title: 'Delete Selected Entries', message: `Delete ${count} selected entr${count === 1 ? 'y' : 'ies'} and their thumbnails?`, confirmLabel: 'Delete Selected', danger: true, action: 'bulk-delete' };
        render();
    }

    function openItemDetails(kind, id, variantId = '') {
        const item = findItem(kind, id);
        if (!item) return;
        state.detailReturn = state.activeTab === 'tags' && state.selectedTag ? { tag: state.selectedTag } : null;
        state.detailVariantId = findVariant(item, variantId || item.primaryVariantId)?.id || '';
        state.compareVariants = false;
        state.compareLeftId = '';
        state.compareRightId = '';
        state.modal = 'item-details';
        state.modalPayload = { kind, id };
        state.openMenu = '';
        render();
    }

    function switchDetailVariant(direction) {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        const variants = getItemVariants(item);
        if (variants.length < 2) return;
        const index = Math.max(0, variants.findIndex(variant => variant.id === state.detailVariantId));
        state.detailVariantId = variants[(index + direction + variants.length) % variants.length].id;
        state.openMenu = '';
        render();
    }

    function setCurrentVariantPrimary() {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        const variant = findVariant(item, state.detailVariantId);
        if (!item || !variant) return;
        item.primaryVariantId = variant.id;
        item.updatedAt = nowIso();
        syncPrimaryVariantAliases(item);
        scheduleSave('Primary variant changed');
        state.openMenu = '';
        render();
        toast('Primary variant updated', 'success');
    }

    async function reloadCurrentVariantThumbnail() {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        const variant = findVariant(item, state.detailVariantId);
        if (!item || !variant) return toast('No image variant is available', 'error');
        const source = variant.sources?.find(entry => entry.fileUrl || entry.sampleUrl || entry.imageUrl || entry.previewUrl) || variant.sources?.[0];
        if (!source) return toast('No source is stored for this variant', 'error');
        state.openMenu = '';
        toast('Reloading thumbnail …', 'info');
        try {
            const before = await captureUndoState('Thumbnail reloaded', [variant.thumbnail?.key].filter(Boolean), [{ kind:payload.kind, id:item.id }]);
            let post = null;
            let refreshError = null;
            try {
                post = await fetchSourcePost(source, true);
                mergePostMetadataIntoSource(source, post);
                variant.image = { ...variant.image, ...postToImageMetadata(post, variant.image || {}) };
            } catch (error) {
                refreshError = error;
                reportDiagnostic('thumbnail-source-refresh', error, false);
            }
            const fallbackPost = {
                site: source.site,
                url: source.url || '',
                previewUrl: variant.image?.previewUrl || source.previewUrl || '',
                sampleUrl: variant.image?.sampleUrl || source.sampleUrl || source.imageUrl || '',
                imageUrl: source.imageUrl || '',
                fileUrl: variant.image?.fileUrl || source.fileUrl || ''
            };
            const candidates = postImageCandidates(post || fallbackPost, 'thumbnail');
            if (!candidates.length) throw refreshError || new Error('The source returned no usable image URL');
            let thumbnail = null;
            let lastError = refreshError;
            for (const imageUrl of candidates) {
                try {
                    thumbnail = await createThumbnail(imageUrl, {
                        site: (post || fallbackPost).site || source.site,
                        referer: (post || fallbackPost).url || source.url || ''
                    });
                    break;
                }
                catch (error) { lastError = error; reportDiagnostic('thumbnail-reload-candidate', error, false); }
            }
            if (!thumbnail) throw lastError || new Error('All image candidates failed');
            if (!await storeThumbnailForItemAsync(item, thumbnail, variant)) throw new Error('Thumbnail storage failed');
            item.updatedAt = nowIso();
            scheduleSave('Thumbnail manually reloaded');
            render();
            registerUndo(before);
        } catch (error) {
            reportDiagnostic('thumbnail-reload', error);
            toast(`Thumbnail could not be reloaded: ${friendlyRequestError(error, source.site)}`, 'error');
        }
    }

    async function setCurrentThumbnailFromFile() {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        const variant = findVariant(item, state.detailVariantId);
        if (!item || !variant) return toast('No image variant is available', 'error');
        state.openMenu = '';
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.hidden = true;
        document.body.appendChild(input);
        try {
            const file = await new Promise(resolve => {
                let settled = false;
                const finish = value => { if (settled) return; settled = true; resolve(value); };
                input.addEventListener('change', () => finish(input.files?.[0] || null), { once: true });
                input.addEventListener('cancel', () => finish(null), { once: true });
                input.click();
            });
            if (!file) return;
            toast('Preparing local thumbnail …', 'info');
            const before = await captureUndoState('Thumbnail replaced', [variant.thumbnail?.key].filter(Boolean), [{ kind:payload.kind, id:item.id }]);
            const thumbnail = await createThumbnailFromBlob(file);
            if (!await storeThumbnailForItemAsync(item, thumbnail, variant)) throw new Error('Thumbnail storage verification failed');
            item.updatedAt = nowIso();
            scheduleSave('Thumbnail selected from file');
            render();
            registerUndo(before);
        } catch (error) {
            reportDiagnostic('thumbnail-file', error);
            toast(`Thumbnail could not be stored: ${error.message}`, 'error');
        } finally {
            input.remove();
        }
    }

    function confirmRemoveCurrentVariant() {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        const variant = findVariant(item, state.detailVariantId);
        if (!item || !variant || getItemVariants(item).length < 2) return;
        state.modal = 'confirm';
        state.modalPayload = { title: 'Remove Variant', message: `Remove “${variant.label || 'this variant'}” and its thumbnail from “${item.name || item.label || item.tag}”?`, confirmLabel: 'Remove Variant', danger: true, action: 'remove-current-variant', kind: payload.kind, id: item.id, variantId: variant.id };
        render();
    }

    function sourceSiteLabel(site) {
        return ({ danbooru: 'Danbooru', gelbooru: 'Gelbooru', e621: 'e621' })[String(site || '').toLowerCase()] || String(site || 'Source');
    }

    function sourceExists(item, source) {
        return (item?.sources || []).some(existing => {
            const sameIdentity = String(existing.site) === String(source?.site) && String(existing.postId) && String(existing.postId) === String(source?.postId);
            return sameIdentity || (existing.url && source?.url && existing.url === source.url);
        });
    }

    function getDetailItemAndSource(index = 0) {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        const variant = findVariant(item, state.detailVariantId);
        const sources = variant?.sources?.length ? variant.sources : (item?.sources || []);
        return { item, variant, source: sources[index] || null, sources, kind: payload.kind };
    }

    function openSourceFromDetails(index) {
        const { source } = getDetailItemAndSource(index);
        if (!source?.url) return toast('No source link is stored', 'error');
        window.open(source.url, '_blank', 'noopener,noreferrer');
    }

    function copySourceFromDetails(index) {
        const { source } = getDetailItemAndSource(index);
        if (!source?.url) return toast('No source link is stored', 'error');
        try { GM_setClipboard(source.url, 'text'); }
        catch { navigator.clipboard?.writeText(source.url); }
        toast('Source link copied', 'success');
    }

    function confirmRemoveItemSources() {
        const { item, variant, sources, kind } = getDetailItemAndSource(0);
        if (!sources?.length) return;
        state.modal = 'confirm';
        state.modalPayload = { title: 'Remove Source Information', message: `Remove every source from the current variant of “${item.name || item.label || item.tag}”? The thumbnail remains stored.`, confirmLabel: 'Remove Sources', danger: true, action: 'remove-item-sources', kind, id: item.id, variantId: variant?.id || '' };
        render();
    }

    function removeAllItemThumbnails(item) {
        const variants = getItemVariants(item);
        if (variants.length) {
            for (const variant of variants) removeThumbnailFromItem(item, variant);
            return;
        }
        removeThumbnailFromItem(item);
    }

    function confirmRemoveItemThumbnail() {
        const { item, variant, kind } = getDetailItemAndSource(0);
        const thumbnail = variant?.thumbnail || item?.thumbnail;
        if (!thumbnail?.key) return;
        state.modal = 'confirm';
        state.modalPayload = { title: 'Remove Thumbnail', message: `Remove the locally stored thumbnail from “${item.name || item.label || item.tag}”?`, confirmLabel: 'Remove Thumbnail', danger: true, action: 'remove-item-thumbnail', kind, id: item.id, variantId: variant?.id || '' };
        render();
    }

    function openEditModal(kind, id = null, prefill = null) {
        const existing = id ? findItem(kind, id) : null;
        const editVariant = kind === 'imported' && existing ? findVariant(existing, state.detailVariantId || existing.primaryVariantId) : null;
        const editableItem = deepClone(prefill || existing || blankItem(kind));
        if (editVariant) {
            editableItem.tags = editVariant.tags || '';
            editableItem.tagGroups = deepClone(editVariant.tagGroups || {});
        }
        state.modal = 'edit-item';
        state.modalPayload = {
            kind,
            editingId: id,
            variantId: editVariant?.id || '',
            item: editableItem
        };
        render();
        setTimeout(() => root.querySelector('.modal input[name="name"], .modal input[name="tag"]')?.focus(), 0);
    }

    function openFromPromptModal() {
        state.modal = 'from-prompt';
        state.modalPayload = {
            positive: readTargetValue('positive'),
            negative: readTargetValue('negative')
        };
        render();
    }

    function chooseFromPrompt(choice) {
        const positive = state.modalPayload?.positive || '';
        const negative = state.modalPayload?.negative || '';
        if (choice === 'character' || choice === 'base' || choice === 'style') {
            const names = { character: 'New Character Profile', base: 'New Base Profile', style: 'New Style/Artist' };
            state.modal = 'edit-item';
            state.modalPayload = {
                kind: choice,
                editingId: null,
                item: { ...blankItem(choice), positive, negative, name: names[choice] }
            };
        } else {
            const type = choice === 'set-negative' ? 'negative' : choice === 'set-combined' ? 'combined' : 'positive';
            state.modal = 'edit-item';
            state.modalPayload = {
                kind: 'set',
                editingId: null,
                item: {
                    ...blankItem('set'),
                    type,
                    positiveTags: type === 'negative' ? '' : positive,
                    negativeTags: type === 'positive' ? '' : negative,
                    tags: type === 'negative' ? negative : positive,
                    name: type === 'negative' ? 'New Negative Set' : type === 'combined' ? 'New Positive + Negative Set' : 'New Positive Set'
                }
            };
        }
        render();
    }

    function saveEditForm(form) {
        const kind = state.modalPayload.kind;
        const editingId = state.modalPayload.editingId;
        const existingItem = editingId ? findItem(kind, editingId) : null;
        const metadataSeed = existingItem || state.modalPayload.item || {};
        const fd = new FormData(form);
        const timestamp = nowIso();
        let item;

        if (kind === 'character' || kind === 'base' || kind === 'style') {
            item = {
                id: editingId || uid(kind),
                name: String(fd.get('name') || '').trim(),
                positive: cleanPromptText(fd.get('positive')),
                negative: cleanPromptText(fd.get('negative')),
                ...(kind === 'character' ? { naiCharacterType: normalizeCharacterType(fd.get('naiCharacterType')) } : {}),
                category: String(fd.get('category') || '').trim(),
                notes: String(fd.get('notes') || '').trim(),
                favorite: fd.get('favorite') === 'on',
                createdAt: editingId ? (existingItem?.createdAt || timestamp) : timestamp,
                updatedAt: timestamp
            };
        } else if (kind === 'set') {
            const type = normalizeTagSetType(fd.get('type'));
            const positiveTags = type === 'negative' ? '' : cleanPromptText(fd.get('positiveTags'));
            const negativeTags = type === 'positive' ? '' : cleanPromptText(fd.get('negativeTags'));
            item = {
                id: editingId || uid('set'),
                name: String(fd.get('name') || '').trim(),
                type,
                positiveTags,
                negativeTags,
                tags: type === 'negative' ? negativeTags : positiveTags,
                category: String(fd.get('category') || '').trim(),
                notes: String(fd.get('notes') || '').trim(),
                favorite: fd.get('favorite') === 'on',
                createdAt: editingId ? (existingItem?.createdAt || timestamp) : timestamp,
                updatedAt: timestamp,
                entryType: 'set'
            };
        } else if (kind === 'imported') {
            item = {
                id: editingId || uid('imported'),
                name: String(fd.get('name') || '').trim(),
                type: 'positive',
                tags: cleanPromptText(fd.get('tags')),
                category: String(fd.get('category') || 'Imported').trim(),
                notes: String(fd.get('notes') || '').trim(),
                favorite: fd.get('favorite') === 'on',
                createdAt: editingId ? (existingItem?.createdAt || timestamp) : timestamp,
                updatedAt: timestamp,
                tagGroups: editingId ? existingItem?.tagGroups : undefined,
                entryType: 'imported'
            };
        } else if (kind === 'fullImage') {
            let characters;
            try {
                characters = JSON.parse(String(fd.get('charactersJson') || '[]'));
                if (!Array.isArray(characters)) throw new Error('Character data must be an array');
                characters = characters.map((character, index) => ({
                    name: String(character?.name || `Character ${index + 1}`),
                    positive: cleanPromptText(character?.positive || ''),
                    negative: cleanPromptText(character?.negative || ''),
                    naiCharacterType: normalizeCharacterType(character?.naiCharacterType)
                }));
            } catch (error) {
                return toast(`Invalid character JSON: ${error.message}`, 'error');
            }
            item = {
                id: editingId || uid('fullImage'),
                name: String(fd.get('name') || '').trim(),
                basePositive: cleanPromptText(fd.get('basePositive')),
                baseNegative: cleanPromptText(fd.get('baseNegative')),
                characters,
                category: String(fd.get('category') || 'Full Image').trim(),
                notes: String(fd.get('notes') || '').trim(),
                favorite: fd.get('favorite') === 'on',
                createdAt: editingId ? (existingItem?.createdAt || timestamp) : timestamp,
                updatedAt: timestamp
            };
        } else {
            item = {
                id: editingId || uid('tag'),
                label: String(fd.get('name') || '').trim(),
                type: fd.get('type') === 'negative' ? 'negative' : 'positive',
                tag: cleanPromptText(fd.get('tag')),
                category: String(fd.get('category') || '').trim(),
                notes: String(fd.get('notes') || '').trim(),
                favorite: fd.get('favorite') === 'on',
                createdAt: editingId ? (existingItem?.createdAt || timestamp) : timestamp,
                updatedAt: timestamp,
                usageCount: editingId ? (existingItem?.usageCount || 0) : 0
            };
        }

        item.sources = deepClone(metadataSeed.sources || []);
        item.variants = deepClone(metadataSeed.variants || []);
        item.primaryVariantId = metadataSeed.primaryVariantId || item.variants[0]?.id || '';
        item.thumbnail = metadataSeed.thumbnail ? deepClone(metadataSeed.thumbnail) : undefined;
        item.imageHash = metadataSeed.imageHash || metadataSeed.thumbnail?.hash || '';
        item.usageCount = Number(metadataSeed.usageCount) || 0;
        item.lastUsed = metadataSeed.lastUsed || '';
        if (kind === 'imported') {
            const previousMode = ['auto', 'manual', 'legacy'].includes(metadataSeed.nameMode) ? metadataSeed.nameMode : 'legacy';
            item.nameMode = existingItem && item.name === existingItem.name ? previousMode : 'manual';
            item.nameTemplate = metadataSeed.nameTemplate || data.settings.importNameTemplate;
        }
        if (kind === 'imported' && item.variants.length) {
            const target = kind === 'imported'
                ? (item.variants.find(variant => variant.id === state.modalPayload.variantId) || item.variants.find(variant => variant.id === item.primaryVariantId) || item.variants[0])
                : (item.variants.find(variant => variant.id === item.primaryVariantId) || item.variants[0]);
            if (kind === 'imported') setVariantManualTags(target, item.tags);
            else {
                target.tags = item.tags;
                target.tagGroups = deepClone(item.tagGroups || target.tagGroups || {});
            }
        }
        if (item.variants.length) syncPrimaryVariantAliases(item);

        if (!item.name && kind !== 'tag') return toast('Please enter a name', 'error');
        if (kind === 'tag' && !item.tag) return toast('Please enter a tag', 'error');
        if (kind === 'set' && !item.positiveTags && !item.negativeTags) return toast('This set does not contain any tags', 'error');
        if (kind === 'imported' && !item.tags) return toast('This import does not contain any tags', 'error');
        if (kind === 'fullImage' && !item.basePositive && !item.baseNegative && !item.characters.some(character => character.positive || character.negative)) return toast('The full image entry is empty', 'error');

        const collection = getCollection(kind);
        const index = collection.findIndex(entry => entry.id === item.id);
        if (index >= 0) collection[index] = item;
        else collection.push(item);

        scheduleSave(`${kindLabel(kind)} saved`);
        closeModal();
        toast(`${kindLabel(kind)} saved`, 'success');
    }

    function duplicateItem(kind, id) {
        const original = findItem(kind, id);
        if (!original) return;
        const copy = deepClone(original);
        copy.id = uid(kind);
        if (kind === 'tag') copy.label = `${copy.label || copy.tag} (Copy)`;
        else copy.name = `${copy.name} (Copy)`;
        if (kind === 'imported') copy.nameMode = 'manual';
        copy.favorite = false;
        copy.createdAt = nowIso();
        copy.updatedAt = copy.createdAt;
        delete copy.source;
        copy.sources = [];
        delete copy.thumbnail;
        const originalPrimaryId = copy.primaryVariantId;
        for (const variant of getItemVariants(copy)) {
            const wasPrimary = variant.id === originalPrimaryId;
            variant.id = uid('variant');
            variant.sources = [];
            variant.image = {};
            variant.imageHash = '';
            delete variant.thumbnail;
            if (wasPrimary) copy.primaryVariantId = variant.id;
        }
        copy.imageHash = '';
        copy.usageCount = 0;
        copy.lastUsed = '';
        getCollection(kind).push(copy);
        scheduleSave(`${kindLabel(kind)} duplicated`);
        render();
        toast('Copy created', 'success');
    }

    function confirmDeleteItem(kind, id) {
        const item = findItem(kind, id);
        if (!item) return;
        state.modal = 'confirm';
        state.modalPayload = {
            title: `Delete ${kindLabel(kind)}`,
            message: `Delete “${item.name || item.label || item.tag}”?`,
            confirmLabel: 'Delete',
            danger: true,
            action: 'delete-item',
            kind,
            id
        };
        render();
    }

    function toggleFavorite(kind, id) {
        const item = findItem(kind, id);
        if (!item) return;
        item.favorite = !item.favorite;
        item.updatedAt = nowIso();
        scheduleFavoriteSave([{ kind, item }]);
        render();
    }

    function findItem(kind, id) {
        const indexed = getWrapperIndex().byRef.get(`${kind}:${id}`)?.item;
        if (indexed) return indexed;
        return getCollection(kind).find(item => item.id === id) || null;
    }

    function getCollection(kind) {
        if (kind === 'character') return data.characters;
        if (kind === 'set' || kind === 'imported') return data.sets;
        if (kind === 'base') return data.bases;
        if (kind === 'style') return data.styleArtists;
        if (kind === 'fullImage') return data.fullImages;
        if (kind === 'tag') return data.favoriteTags;
        return [];
    }

    function formatBooruTagForNai(value) {
        return String(value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function formatBooruPromptForNai(value) {
        return splitPrompt(value).map(formatBooruTagForNai).filter(Boolean).join(', ');
    }

    function variantRawTags(item, variantId = '', override = '') {
        if (String(override || '').trim()) return cleanPromptText(override);
        const variant = findVariant(item, variantId || item?.primaryVariantId);
        return cleanPromptText(variant?.tags || item?.tags || '');
    }

    function recordItemUse(kind, item) {
        if (!item) return;
        const timestamp = nowIso();
        const key = `${kind}:${item.id}`;
        const previous = usageState.entries[key] || {};
        item.lastUsed = timestamp;
        item.usageCount = Math.max(Number(item.usageCount) || 0, Number(previous.usageCount) || 0) + 1;
        usageState.entries[key] = { usageCount: item.usageCount, lastUsed: timestamp };
        addRecent(kind, item.id, timestamp);
        scheduleUsageSave();
    }

    function cycleImportedCardVariant(element, direction) {
        const card = element?.closest?.('[data-card-kind="imported"][data-card-id]');
        const item = findItem('imported', element?.dataset?.id || card?.dataset?.cardId || '');
        const variants = getItemVariants(item);
        if (!card || !item || variants.length < 2) return;
        const currentId = state.cardVariantIds?.[item.id] || card.dataset.openVariantId || item.primaryVariantId;
        const currentIndex = Math.max(0, variants.findIndex(variant => variant.id === currentId));
        const next = variants[(currentIndex + Number(direction || 0) + variants.length) % variants.length];
        state.cardVariantIds[item.id] = next.id;
        rememberCurrentViewState();

        const template = document.createElement('template');
        template.innerHTML = renderItemCard('imported', item, card.dataset.cardCompact === 'true', next.id).trim();
        const replacement = template.content.firstElementChild;
        if (!replacement) return;
        card.replaceWith(replacement);
        hydrateVisibleThumbnails();
    }

    function copyImportedVariantTags(id, variantId = '', rawTags = '', message = 'Tags copied') {
        const item = findItem('imported', id);
        if (!item) return;
        const formatted = formatBooruPromptForNai(variantRawTags(item, variantId, rawTags));
        if (!formatted) return toast('No tags are stored in this selection', 'info');
        GM_setClipboard(formatted);
        recordItemUse('imported', item);
        rememberCurrentViewState();
        toast(message, 'success');
    }

    async function insertImportedVariantTags(id, variantId = '', rawTags = '', replace = false) {
        const item = findItem('imported', id);
        if (!item) return;
        if (!IS_NAI) return toast('Prompt insertion is only available on NovelAI', 'error');
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
        const formatted = formatBooruPromptForNai(variantRawTags(item, variantId, rawTags));
        if (!formatted && !replace) return toast('No tags are stored in this selection', 'info');
        state.operationBusy = true;
        try {
            const result = await writeMainPositivePrompt(formatted, replace);
            if (result.failed) return toast('The NovelAI Main Prompt could not be detected', 'error');
            recordItemUse('imported', item);
            if (data.settings.closeAfterInsertion) closeToolkitPanel();
            else rememberCurrentViewState();
            toast(`${result.inserted || 0} tag${result.inserted === 1 ? '' : 's'} ${replace ? 'replaced' : 'appended'} in Main Prompt${result.skipped ? ` · ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped` : ''}`, 'success');
        } finally {
            state.operationBusy = false;
        }
    }

    async function insertDirectMainPromptTag(rawTag) {
        const value = formatBooruPromptForNai(rawTag);
        if (!value) return toast('No tag is available to insert', 'info');
        if (!IS_NAI) return toast('Prompt insertion is only available on NovelAI', 'error');
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
        state.operationBusy = true;
        try {
            const result = await writeMainPositivePrompt(value, false);
            if (result.failed) return toast('The NovelAI Main Prompt could not be detected', 'error');
            if (data.settings.closeAfterInsertion) closeToolkitPanel();
            else rememberCurrentViewState();
            toast(`${result.inserted || 0} tag${result.inserted === 1 ? '' : 's'} appended to Main Prompt${result.skipped ? ` · ${result.skipped} duplicate skipped` : ''}`, 'success');
        } finally {
            state.operationBusy = false;
        }
    }

    function requestApplyItem(kind, id, replace = false, variantId = '') {
        if (kind === 'fullImage') {
            state.modal = 'full-image-apply';
            state.modalPayload = { id, replace };
            state.openMenu = '';
            render();
            return;
        }
        if (replace && data.settings.confirmReplaceActions) {
            const item = findItem(kind, id);
            if (!item) return;
            state.modal = 'confirm';
            state.modalPayload = {
                title: 'Replace NovelAI Prompt',
                message: `Replace the selected NovelAI prompt field with “${item.name || item.label || item.tag || 'this entry'}”?`,
                confirmLabel: 'Replace Prompt',
                action: 'replace-item', kind, id, variantId
            };
            state.openMenu = '';
            render();
            return;
        }
        void applyItem(kind, id, replace, null, variantId);
    }

    async function confirmFullImageApply() {
        const payload = state.modalPayload || {};
        const selected = new Set([...root.querySelectorAll('[data-full-part]:checked')].map(input => input.dataset.fullPart));
        if (!selected.size) return toast('Select at least one prompt field', 'error');
        const id = payload.id;
        const reviewedItem = findItem('fullImage', id);
        const selectedCharacterIndexes = (reviewedItem?.characters || []).map((_character, index) => index)
            .filter(index => selected.has(`character:${index}:positive`) || selected.has(`character:${index}:negative`));
        const requiredCharacterCount = selectedCharacterIndexes.length ? Math.max(...selectedCharacterIndexes) + 1 : 0;
        for (const [index, character] of (reviewedItem?.characters || []).entries()) {
            if (index >= requiredCharacterCount) continue;
            if (normalizeCharacterType(character.naiCharacterType) !== 'unknown') continue;
            const chosen = normalizeCharacterType(root.querySelector(`[data-full-character-type="${index}"]`)?.value);
            if (chosen === 'unknown') return toast(`Choose a NovelAI type for ${character.name || `Character ${index + 1}`}`, 'error');
            character.naiCharacterType = chosen;
        }
        if (reviewedItem) scheduleSave('Full Image character types reviewed');
        const replace = Boolean(payload.replace);
        if (replace && data.settings.confirmReplaceActions) {
            const item = findItem('fullImage', id);
            state.modal = 'confirm';
            state.modalPayload = {
                title: 'Replace NovelAI Prompts',
                message: `Replace the ${selected.size} selected NovelAI prompt field${selected.size === 1 ? '' : 's'} with “${item?.name || 'this Full Image'}”?`,
                confirmLabel: 'Replace Selected Fields',
                action: 'replace-full-image',
                id,
                parts: [...selected]
            };
            render();
            return;
        }
        closeModal();
        await applyItem('fullImage', id, replace, selected);
    }

    async function applyItem(kind, id, replace = false, fullImageParts = null, variantId = '') {
        const item = findItem(kind, id);
        if (!item) return;
        if (!IS_NAI) return toast('Prompt insertion is only available on NovelAI', 'error');
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');

        state.operationBusy = true;
        try {
            let inserted = 0;
            let skipped = 0;
            let failed = 0;

            if (kind === 'fullImage') {
                await snapshotPrompt(`Before ${replace ? 'Replace' : 'Append'}: ${item.name || 'Full Image'}`, false);
                const result = await applyFullImage(item, replace, fullImageParts);
                inserted += result.inserted;
                skipped += result.skipped;
                failed += result.failed || 0;
            } else if (kind === 'character') {
                await snapshotPrompt(`Before ${replace ? 'Replace' : 'Append'}: ${item.name || 'Character'}`, false);
                const result = await applyCharacterToSelected(item, replace);
                inserted += result.inserted;
                skipped += result.skipped;
                failed += result.failed || 0;
            } else if (kind === 'set') {
                const parts = tagSetParts(item);
                if (parts.type !== 'negative') {
                    const result = await writeMainPositivePrompt(parts.positive, replace);
                    inserted += result.inserted || 0;
                    skipped += result.skipped || 0;
                    failed += Number(Boolean(result.failed));
                }
                if (parts.type !== 'positive') {
                    const result = await writeMainNegativePrompt(parts.negative, replace);
                    inserted += result.inserted || 0;
                    skipped += result.skipped || 0;
                    failed += Number(Boolean(result.failed));
                }
            } else if (kind === 'base') {
                if (cleanPromptText(item.positive || '')) {
                    const result = await writeMainPositivePrompt(item.positive, replace);
                    inserted += result.inserted || 0;
                    skipped += result.skipped || 0;
                    failed += Number(Boolean(result.failed));
                }
                if (cleanPromptText(item.negative || '')) {
                    const result = await writeMainNegativePrompt(item.negative, replace);
                    inserted += result.inserted || 0;
                    skipped += result.skipped || 0;
                    failed += Number(Boolean(result.failed));
                }
            } else {
                const value = kind === 'imported' ? formatBooruPromptForNai(variantRawTags(item, variantId))
                    : kind === 'style' ? item.positive || ''
                    : item.tag || '';
                const result = await writeMainPositivePrompt(value, replace);
                inserted += result.inserted || 0;
                skipped += result.skipped || 0;
                failed += Number(Boolean(result.failed));
            }

            if (!inserted && !skipped && !replace && !failed) return;
            recordItemUse(kind, item);
            if (data.settings.closeAfterInsertion) closeToolkitPanel();
            else rememberCurrentViewState();
            toast(`${inserted} tag${inserted === 1 ? '' : 's'} ${replace ? 'replaced' : 'appended'}${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}${failed ? ` · ${failed} Main field${failed === 1 ? '' : 's'} unavailable` : ''}`, failed ? 'info' : 'success');
        } finally {
            state.operationBusy = false;
        }
    }

    function addRecent(kind, id, at = nowIso()) {
        const next = (usageState.recent || []).filter(record => !(record.kind === kind && record.id === id));
        next.unshift({ kind, id, at });
        usageState.recent = next.slice(0, MAX_RECENT);
        data.recent = deepClone(usageState.recent);
    }

    function clearRecent() {
        usageState.recent = [];
        data.recent = [];
        scheduleUsageSave();
        render();
    }



    function mergePrompt(current, incomingTags, element, position, duplicateMode) {
        const currentTags = splitPrompt(current);
        const existing = new Set(currentTags.map(canonicalTag));
        const accepted = [];
        let skipped = 0;

        for (const tag of incomingTags) {
            const canonical = canonicalTag(tag);
            if (duplicateMode === 'skip' && existing.has(canonical)) {
                skipped++;
                continue;
            }
            accepted.push(tag.trim());
            existing.add(canonical);
        }

        if (!accepted.length) return { value: current, inserted: 0, skipped, selectionStart: null };
        const chunk = accepted.join(', ');
        let value;
        let cursor = null;

        if (position === 'start') {
            value = joinPromptParts(chunk, current);
            cursor = chunk.length;
        } else if (position === 'cursor' && supportsSelection(element)) {
            const start = element.selectionStart ?? current.length;
            const end = element.selectionEnd ?? start;
            const before = current.slice(0, start);
            const after = current.slice(end);
            const left = before.trimEnd();
            const right = after.trimStart();
            const insertion = `${left && !/[,{\s]$/.test(left) ? ', ' : ''}${chunk}${right && !/^[,}\]\s]/.test(right) ? ', ' : ''}`;
            value = before + insertion + after;
            cursor = before.length + insertion.length;
        } else {
            value = joinPromptParts(current, chunk);
            cursor = value.length;
        }

        return { value, inserted: accepted.length, skipped, selectionStart: cursor };
    }

    function joinPromptParts(left, right) {
        const a = String(left || '').trim();
        const b = String(right || '').trim();
        if (!a) return b;
        if (!b) return a;
        return `${a.replace(/,\s*$/, '')}, ${b.replace(/^\s*,/, '')}`;
    }

    function splitPrompt(text) {
        const input = String(text || '').trim();
        if (!input) return [];
        const result = [];
        let buffer = '';
        let quote = '';
        let round = 0;
        let square = 0;
        let curly = 0;

        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            const previous = input[i - 1];
            if ((char === '"' || char === "'") && previous !== '\\') {
                quote = quote === char ? '' : quote || char;
                buffer += char;
                continue;
            }
            if (!quote) {
                if (char === '(') round++;
                else if (char === ')') round = Math.max(0, round - 1);
                else if (char === '[') square++;
                else if (char === ']') square = Math.max(0, square - 1);
                else if (char === '{') curly++;
                else if (char === '}') curly = Math.max(0, curly - 1);
                else if (char === ',' && round === 0 && square === 0 && curly === 0) {
                    if (buffer.trim()) result.push(buffer.trim());
                    buffer = '';
                    continue;
                }
            }
            buffer += char;
        }
        if (buffer.trim()) result.push(buffer.trim());
        return result;
    }

    function canonicalTag(tag) {
        return String(tag || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function cleanPromptText(value) {
        return splitPrompt(String(value || '')).join(', ');
    }

    async function snapshotPrompt(label = 'Prompt State', notify = false) {
        if (!IS_NAI) return;
        let semantic = null;
        try { semantic = await captureNaiPromptStructure(true); }
        catch (error) { reportDiagnostic('history-capture-semantic', error, false); }
        const fields = [];
        if (semantic?.basePositive) fields.push({ fieldId: '', label: 'Main Prompt', kind: 'base-positive', value: semantic.basePositive });
        if (semantic?.baseNegative) fields.push({ fieldId: '', label: 'Main Undesired Content', kind: 'base-negative', value: semantic.baseNegative });
        (semantic?.characters || []).forEach((character, index) => {
            const characterIndex = Number(character.index) || index + 1;
            if (character.positive) fields.push({ fieldId: '', label: `Character ${characterIndex} Prompt`, kind: `character-${characterIndex}-positive`, value: character.positive });
            if (character.negative) fields.push({ fieldId: '', label: `Character ${characterIndex} Undesired Content`, kind: `character-${characterIndex}-negative`, value: character.negative });
        });
        if (!fields.length) fields.push(...getRegisteredFields().map(info => ({ fieldId: info.id, label: info.label, kind: info.kind, value: readEditable(info.element) })).filter(field => field.value.trim()));

        if (!fields.length) {
            if (notify) toast('No filled prompt fields were detected', 'error');
            return;
        }

        const signature = JSON.stringify(fields.map(field => [field.label, field.value]));
        if (data.history[0]?.signature === signature) {
            if (notify) toast('This is already the newest prompt state', 'info');
            return;
        }

        data.history.unshift({ id: uid('history'), timestamp: nowIso(), label, fields, semantic, signature });
        const max = Math.max(5, Math.min(200, Number(data.settings.maxHistory) || 50));
        data.history = data.history.slice(0, max);
        scheduleSave('Prompt state saved');
        if (notify) {
            render();
            toast('Prompt state saved', 'success');
        }
    }

    async function restoreHistory(id) {
        const entry = data.history.find(item => item.id === id);
        if (!entry) return;
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
        state.operationBusy = true;
        let restored = 0;
        let missing = 0;
        const uiState = captureNaiCharacterUiState();
        try {
            await snapshotPrompt(`Before restoring: ${entry.label || 'history state'}`, false);
            const semantic = entry.semantic || semanticFromLegacyHistory(entry.fields || []);
            refreshEditableFields(true);
            const descriptors = collectPromptPanelDescriptors();
            const base = descriptors.find(descriptor => descriptor.scope === 'base');
            if (base) {
                const positive = await writeDescriptorValue(base, 'positive', semantic.basePositive || '', true);
                const negative = await writeDescriptorValue(base, 'negative', semantic.baseNegative || '', true);
                restored += positive.failed ? 0 : 1;
                restored += negative.failed ? 0 : 1;
                missing += Number(Boolean(positive.failed && semantic.basePositive)) + Number(Boolean(negative.failed && semantic.baseNegative));
            } else missing += Number(Boolean(semantic.basePositive)) + Number(Boolean(semantic.baseNegative));
            const characters = getCharacterPanelDescriptors();
            for (let index = 0; index < (semantic.characters || []).length; index++) {
                const saved = semantic.characters[index];
                const wantedIndex = Number(saved.index) || index + 1;
                const descriptor = characters.find(character => Number(character.index) === wantedIndex) || characters[index];
                if (!descriptor) { missing += Number(Boolean(saved.positive)) + Number(Boolean(saved.negative)); continue; }
                const positive = await writeDescriptorValue(descriptor, 'positive', saved.positive || '', true);
                const negative = await writeDescriptorValue(descriptor, 'negative', saved.negative || '', true);
                restored += positive.failed ? 0 : 1;
                restored += negative.failed ? 0 : 1;
                missing += Number(Boolean(positive.failed && saved.positive)) + Number(Boolean(negative.failed && saved.negative));
            }
            await restoreNaiCharacterUiState(uiState);
            toast(`${restored} prompt field${restored === 1 ? '' : 's'} restored${missing ? ` · ${missing} unavailable` : ''}`, restored ? 'success' : 'error');
        } catch (error) {
            reportDiagnostic('history-restore', error);
            toast(`History could not be restored: ${error.message}`, 'error');
        } finally {
            state.operationBusy = false;
        }
    }

    function semanticFromLegacyHistory(fields) {
        const result = { basePositive: '', baseNegative: '', characters: [] };
        for (const field of fields || []) {
            const clue = `${field.kind || ''} ${field.label || ''}`.toLowerCase();
            const negative = /negative|undesired|\buc\b/.test(clue);
            const characterMatch = clue.match(/character[^0-9]*(\d+)/);
            if (characterMatch || /character/.test(clue)) {
                const index = Math.max(0, Number(characterMatch?.[1] || 1) - 1);
                result.characters[index] ||= { name: `Character ${index + 1}`, index: index + 1, positive: '', negative: '' };
                result.characters[index][negative ? 'negative' : 'positive'] = field.value || '';
            } else result[negative ? 'baseNegative' : 'basePositive'] = field.value || '';
        }
        return result;
    }

    function deleteHistory(id) {
        data.history = data.history.filter(item => item.id !== id);
        scheduleSave('History entry deleted');
        render();
    }

    function confirmClearHistory() {
        state.modal = 'confirm';
        state.modalPayload = { title: 'Clear Prompt History', message: 'Delete every saved prompt state?', confirmLabel: 'Clear History', danger: true, action: 'clear-history' };
        render();
    }
    function refreshEditableFields(force = false) {
        if (!IS_NAI) return;
        const candidates = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')]
            .filter(element => isEditable(element) && isVisible(element) && !host.contains(element));
        for (const element of candidates) registerEditable(element);

        for (const [id, info] of editableRegistry) {
            if (!info.element.isConnected || !isVisible(info.element)) editableRegistry.delete(id);
            else registerEditable(info.element);
        }

        const fields = getRegisteredFields();
        if (!fields.some(field => field.id === state.selectedPositiveFieldId)) {
            state.selectedPositiveFieldId = fields.find(field => field.scope === 'base' && field.polarity === 'positive')?.id
                || fields.find(field => field.polarity === 'positive')?.id || '';
        }
        if (!fields.some(field => field.id === state.selectedNegativeFieldId)) {
            state.selectedNegativeFieldId = fields.find(field => field.scope === 'base' && field.polarity === 'negative')?.id
                || fields.find(field => field.polarity === 'negative')?.id || '';
        }
        const characterGroups = getCharacterFieldGroups();
        if (!characterGroups.some(group => String(group.index) === String(state.selectedCharacterIndex))) {
            state.selectedCharacterIndex = characterGroups[0] ? String(characterGroups[0].index) : '';
        }
        if (force) saveUiPrefs();
    }

    function registerEditable(element) {
        let id = element.dataset?.ainzFieldId;
        if (!id) {
            id = `field_${++fieldCounter}`;
            try { element.dataset.ainzFieldId = id; } catch { /* exotic contenteditable */ }
        }
        const analysis = analyzeField(element);
        const info = {
            id,
            element,
            label: deriveFieldLabel(element, id, analysis),
            kind: analysis.scope === 'character' ? `character-${analysis.polarity}` : analysis.polarity,
            scope: analysis.scope,
            polarity: analysis.polarity,
            characterIndex: analysis.characterIndex,
            container: analysis.container
        };
        editableRegistry.set(id, info);
        return info;
    }

    function getRegisteredFields() {
        return [...editableRegistry.values()].filter(info => info.element.isConnected && isVisible(info.element));
    }

    function isEditable(element) {
        if (!(element instanceof Element)) return false;
        if (element.disabled || element.readOnly) return false;
        if (element.matches('textarea')) return true;
        if (element.matches('input[type="text"]')) {
            const semantic = [element.getAttribute('aria-label'), element.getAttribute('placeholder'), element.getAttribute('name'), element.id].filter(Boolean).join(' ').toLowerCase();
            return /prompt|undesired|negative|character|description|tags|content/.test(semantic);
        }
        if (element.getAttribute('contenteditable') === 'true') return true;
        if (element.getAttribute('role') === 'textbox') {
            const semantic = [element.getAttribute('aria-label'), element.getAttribute('data-placeholder'), element.getAttribute('placeholder'), element.textContent].filter(Boolean).join(' ').toLowerCase();
            return element.isContentEditable || /prompt|undesired|negative|character|description|tags|content/.test(semantic);
        }
        return false;
    }

    function isVisible(element) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 20 && rect.height > 12;
    }

    function deriveFieldLabel(element, fallbackId, analysis = analyzeField(element)) {
        const candidates = [
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
            element.getAttribute('name'),
            element.id ? document.querySelector(`label[for="${cssEscape(element.id)}"]`)?.textContent : '',
            element.closest('label')?.textContent,
            element.parentElement?.querySelector(':scope > label')?.textContent,
            findNearbyHeading(element)
        ].map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        const best = candidates.find(value => value.length <= 90) || candidates[0];
        if (best) return best.slice(0, 90);
        if (analysis.scope === 'character') return `Character ${analysis.characterIndex || '?'} ${analysis.polarity === 'negative' ? 'Undesired Content' : 'Prompt'}`;
        return `${analysis.polarity === 'negative' ? 'Undesired Content' : 'Prompt'} ${fallbackId.replace('field_', '')}`;
    }

    function findNearbyHeading(element) {
        let current = element.parentElement;
        for (let depth = 0; current && depth < 4; depth++, current = current.parentElement) {
            const heading = current.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > [role="heading"]');
            if (heading?.textContent) return heading.textContent;
        }
        return '';
    }

    function analyzeField(element) {
        const directText = [
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
            element.getAttribute('data-placeholder'),
            element.getAttribute('name'),
            element.id,
            element.id ? document.querySelector(`label[for="${cssEscape(element.id)}"]`)?.textContent : '',
            element.closest('label')?.textContent
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        const container = findPromptContainer(element);
        const nearbyText = [
            findNearbyHeading(element),
            container?.getAttribute?.('aria-label'),
            container?.getAttribute?.('data-testid'),
            container?.getAttribute?.('class'),
            getElementOwnText(container, 520)
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        const combined = `${directText} ${nearbyText}`.toLowerCase();

        const activeTab = findActivePromptTab(container);
        const activeText = String(activeTab?.textContent || activeTab?.getAttribute?.('aria-label') || activeTab?.getAttribute?.('title') || '').toLowerCase();
        const polarity = /undesired|negative|\buc\b|exclude|unwanted|avoid/.test(directText.toLowerCase())
            || /undesired|negative|\buc\b/.test(activeText)
            ? 'negative'
            : 'positive';

        const markedPanel = container?.closest?.('[data-ainz-character-panel="true"]') || (container?.matches?.('[data-ainz-character-panel="true"]') ? container : null);
        const structuralText = [
            container?.id,
            container?.className,
            container?.getAttribute?.('data-testid'),
            container?.getAttribute?.('aria-label')
        ].filter(value => typeof value === 'string').join(' ').toLowerCase();
        const scope = markedPanel
            || /character|char(?:acter)?[_-]?prompt|multi[_-]?character/.test(structuralText)
            || /character\s*(?:#|no\.?\s*)?\d+|character prompt|character undesired|character positioning/.test(combined)
            ? 'character'
            : 'base';

        const markedIndex = Number(markedPanel?.dataset?.ainzCharacterIndex || container?.dataset?.ainzCharacterIndex || 0);
        const indexMatch = combined.match(/character\s*(?:#|no\.?\s*)?(\d+)/i) || combined.match(/char\s*(\d+)/i);
        let characterIndex = markedIndex || (indexMatch ? Number(indexMatch[1]) : null);
        if (scope === 'character' && !characterIndex) characterIndex = inferCharacterIndexFromDom(markedPanel || container || element);
        return { polarity, scope, characterIndex, container: markedPanel || container };
    }

    function promptContainerScore(node, element, depth) {
        if (!(node instanceof Element) || node === document.body || host?.contains(node)) return -Infinity;
        const selector = 'textarea, input[type="text"], [contenteditable="true"], [role="textbox"]';
        const editables = [...node.querySelectorAll(selector)].filter(candidate => isEditable(candidate) && !host?.contains(candidate));
        const visibleEditors = editables.filter(isVisible);
        const tabs = findPromptTabs(node);
        const ownText = getElementOwnText(node, 520).toLowerCase();
        const structuralText = [node.id, node.className, node.getAttribute('data-testid'), node.getAttribute('aria-label')]
            .filter(value => typeof value === 'string').join(' ').toLowerCase();

        let score = 0;
        if (node.hasAttribute('data-ainz-character-panel')) score += 80;
        if (node.querySelector(':scope > .ainz-save-character-inline')) score += 55;
        if (tabs.prompt && tabs.negative) score += 36;
        else if (tabs.prompt || tabs.negative) score += 18;
        if (/character|char(?:acter)?[_-]?prompt|multi[_-]?character/.test(structuralText)) score += 28;
        if (/character\s*(?:#|no\.?\s*)?\d+|character prompt|character positioning/.test(ownText)) score += 24;
        if (/base prompt|undesired content|negative prompt/.test(ownText)) score += 12;
        if (visibleEditors.length === 1) score += 18;
        else if (visibleEditors.length === 2) score += 12;
        else if (visibleEditors.length <= 4) score += 4;
        if (editables.length > 6) score -= (editables.length - 6) * 14;
        if (node.contains(element)) score += 8;
        score -= depth * 1.5;
        return score;
    }

    function findPromptContainer(element) {
        let node = element?.parentElement || null;
        let best = node;
        let bestScore = -Infinity;
        for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
            if (node === document.body || node === document.documentElement) break;
            const score = promptContainerScore(node, element, depth);
            if (score > bestScore) {
                bestScore = score;
                best = node;
            }
            // Once a compact panel with both Prompt and UC tabs is found, a much
            // broader ancestor is almost always the whole image sidebar.
            const tabs = findPromptTabs(node);
            const editorCount = node.querySelectorAll?.('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')?.length || 0;
            if (tabs.prompt && tabs.negative && editorCount <= 4 && score >= 40) break;
        }
        return best || element?.parentElement || null;
    }

    function expandCharacterPanel(container, editor = null) {
        const nativeRoot = getNaiNativeCharacterRoot(editor || container);
        if (nativeRoot) return nativeRoot;
        let node = container || editor?.parentElement || null;
        let best = node;
        let bestScore = -Infinity;
        for (let depth = 0; node && depth < 9; depth++, node = node.parentElement) {
            if (node === document.body || node === document.documentElement || host?.contains(node)) break;
            const score = promptContainerScore(node, editor || container, depth)
                + (/character/i.test(getElementOwnText(node, 420)) ? 18 : 0)
                + (node.hasAttribute('data-ainz-character-panel') ? 60 : 0);
            if (score > bestScore) {
                bestScore = score;
                best = node;
            }
            const tabs = findPromptTabs(node);
            const editorCount = node.querySelectorAll?.('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')?.length || 0;
            if (tabs.prompt && tabs.negative && editorCount <= 4) break;
        }
        return best || container || editor?.parentElement || null;
    }

    function getElementOwnText(element, maxLength = 300) {
        if (!element) return '';
        const clone = element.cloneNode(true);
        clone.querySelectorAll?.('textarea,input,script,style,svg').forEach(node => node.remove());
        return String(clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    }

    function findActivePromptTab(container) {
        if (!container) return null;
        const tabs = [...container.querySelectorAll('button,[role="tab"]')];
        return tabs.find(tab => tab.getAttribute('aria-selected') === 'true' || tab.dataset.state === 'active' || tab.classList.contains('active')) || null;
    }

    function getMarkedCharacterPanels() {
        const panels = [];
        const seen = new Set();
        const add = container => {
            if (!(container instanceof Element) || !container.isConnected || host?.contains(container) || seen.has(container)) return;
            seen.add(container);
            panels.push({
                container,
                index: Number(container.dataset.ainzCharacterIndex || 0),
                panelId: container.dataset.ainzCharacterPanelId || ''
            });
        };
        document.querySelectorAll('[data-ainz-character-panel="true"]').forEach(add);
        document.querySelectorAll('.ainz-save-character-inline').forEach(button => add(button.closest('[data-ainz-character-panel="true"]') || button.parentElement));
        panels.sort((a, b) => compareDomOrder(a.container, b.container));
        const used = new Set();
        panels.forEach((panel, position) => {
            let index = panel.index || position + 1;
            while (used.has(index)) index++;
            panel.index = index;
            used.add(index);
        });
        return panels;
    }

    function markCharacterPanel(container, index = null) {
        if (!(container instanceof Element) || host?.contains(container)) return null;
        const panel = getNaiNativeCharacterRoot(container) || expandCharacterPanel(container) || container;
        if (!panel.dataset.ainzCharacterPanelId) panel.dataset.ainzCharacterPanelId = `character_panel_${++characterPanelCounter}`;
        panel.dataset.ainzCharacterPanel = 'true';
        if (index) panel.dataset.ainzCharacterIndex = String(index);
        return panel;
    }

    function inferCharacterIndexFromDom(container) {
        const marked = container?.closest?.('[data-ainz-character-panel="true"]') || (container?.matches?.('[data-ainz-character-panel="true"]') ? container : null);
        const markedIndex = Number(marked?.dataset?.ainzCharacterIndex || 0);
        if (markedIndex) return markedIndex;

        const panels = getMarkedCharacterPanels();
        const markedPosition = panels.findIndex(entry => entry.container === marked || entry.container.contains(container) || container?.contains?.(entry.container));
        if (markedPosition >= 0) return panels[markedPosition].index || markedPosition + 1;

        const containers = [];
        for (const element of document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')) {
            if (!isEditable(element) || host?.contains(element)) continue;
            const candidate = findPromptContainer(element);
            if (!candidate) continue;
            const semantic = [candidate.id, candidate.className, candidate.getAttribute('data-testid'), getElementOwnText(candidate, 420)]
                .filter(value => typeof value === 'string').join(' ').toLowerCase();
            if (!/character|char(?:acter)?[_-]?prompt|multi[_-]?character/.test(semantic)) continue;
            if (!containers.includes(candidate)) containers.push(candidate);
        }
        containers.sort(compareDomOrder);
        const index = containers.findIndex(candidate => candidate === container || candidate.contains(container) || container?.contains?.(candidate));
        return index >= 0 ? index + 1 : 1;
    }


    function getCharacterFieldGroups() {
        const groups = new Map();
        const fields = getRegisteredFields().filter(field => field.scope === 'character');
        let fallbackIndex = 1;
        for (const field of fields) {
            const panel = expandCharacterPanel(field.container, field.element) || field.container;
            const markedIndex = Number(panel?.dataset?.ainzCharacterIndex || 0);
            const index = markedIndex || Number(field.characterIndex) || fallbackIndex++;
            if (!groups.has(index)) groups.set(index, { index, positive: null, negative: null, container: panel });
            const group = groups.get(index);
            group[field.polarity] = field;
            if (!group.container) group.container = panel;
        }

        for (const marked of getMarkedCharacterPanels()) {
            if (!groups.has(marked.index)) groups.set(marked.index, { index: marked.index, positive: null, negative: null, container: marked.container });
            const group = groups.get(marked.index);
            group.container = marked.container;
            for (const field of getRegisteredFields()) {
                if (!marked.container.contains(field.element)) continue;
                group[field.polarity] = field;
            }
        }

        const result = [...groups.values()].sort((a, b) => compareDomOrder(a.container, b.container));
        const used = new Set();
        result.forEach((group, position) => {
            let index = Number(group.container?.dataset?.ainzCharacterIndex || group.index || position + 1);
            while (used.has(index)) index++;
            group.index = index;
            used.add(index);
            if (group.container) {
                group.container.dataset.ainzCharacterIndex = String(index);
                group.container.dataset.ainzCharacterPanel = 'true';
            }
        });
        return result.sort((a, b) => a.index - b.index);
    }

    function descriptorFromCharacterPanel(container, index = null) {
        const panel = getNaiNativeCharacterRoot(container) || expandCharacterPanel(container) || container;
        if (!panel) return null;
        const resolvedIndex = Number(index || panel.dataset.ainzCharacterIndex || inferCharacterIndexFromDom(panel) || 1);
        const descriptor = {
            container: panel,
            scope: 'character',
            index: resolvedIndex,
            positive: null,
            negative: null,
            tabs: findPromptTabs(panel)
        };
        for (const field of getRegisteredFields()) {
            if (!panel.contains(field.element)) continue;
            const polarity = field.polarity || analyzeField(field.element).polarity;
            descriptor[polarity] = field;
        }
        const current = currentEditableIn(panel);
        if (current) {
            const activeText = buttonText(findActivePromptTab(panel)).toLowerCase();
            const polarity = /undesired|negative|\buc\b/.test(activeText) ? 'negative' : 'positive';
            const info = registerEditable(current);
            info.scope = 'character';
            info.characterIndex = resolvedIndex;
            info.container = panel;
            info.kind = `character-${polarity}`;
            info.polarity = polarity;
            descriptor[polarity] = info;
        }
        return descriptor;
    }

    function getCharacterPanelDescriptors() {
        refreshEditableFields(false);
        const descriptors = [];
        const seen = new Set();
        const add = (container, index = null) => {
            const panel = expandCharacterPanel(container) || container;
            if (!(panel instanceof Element) || !panel.isConnected || seen.has(panel)) return;
            const descriptor = descriptorFromCharacterPanel(panel, index);
            if (!descriptor) return;
            seen.add(panel);
            descriptors.push(descriptor);
        };

        getNaiNativeCharacterPanels().forEach((panel, position) => add(panel, getNaiNativeCharacterIndex(panel, position + 1)));
        getMarkedCharacterPanels().forEach(panel => add(panel.container, panel.index));
        getCharacterFieldGroups().forEach(group => add(group.container, group.index));
        collectPromptPanelDescriptors().filter(item => item.scope === 'character').forEach(item => add(item.container, item.index));

        descriptors.sort((a, b) => compareDomOrder(a.container, b.container));
        descriptors.forEach((descriptor, position) => {
            descriptor.index = position + 1;
            markCharacterPanel(descriptor.container, descriptor.index);
        });
        return descriptors;
    }

    function selectCharacterTarget(index) {
        const group = getCharacterFieldGroups().find(entry => String(entry.index) === String(index));
        state.selectedCharacterIndex = group ? String(group.index) : '';
        if (group?.positive) state.selectedPositiveFieldId = group.positive.id;
        if (group?.negative) state.selectedNegativeFieldId = group.negative.id;
    }

    function getBaseField(polarity) {
        refreshEditableFields(false);
        return getRegisteredFields().find(field => field.scope === 'base' && field.polarity === polarity)
            || getRegisteredFields().find(field => field.polarity === polarity) || null;
    }

    function getTargetField(type) {
        refreshEditableFields(false);
        const selectedId = type === 'negative' ? state.selectedNegativeFieldId : state.selectedPositiveFieldId;
        const selected = editableRegistry.get(selectedId);
        if (selected?.element?.isConnected && selected.polarity === type) return selected;
        const focused = editableRegistry.get(state.focusedFieldId);
        if (focused && focused.polarity === type) return focused;
        return getRegisteredFields().find(field => field.polarity === type) || null;
    }

    function readTargetValue(type) {
        const field = getTargetField(type);
        return field ? readEditable(field.element) : '';
    }

    function readEditable(element) {
        if (element.matches('textarea, input')) return element.value || '';
        return element.textContent || '';
    }

    function writeEditable(element, value, selectionStart = null) {
        element.focus();
        if (element.matches('textarea, input')) {
            const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            setter?.call(element, value);
            if (!setter) element.value = value;
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            if (selectionStart != null && supportsSelection(element)) {
                try { element.setSelectionRange(selectionStart, selectionStart); } catch { /* ignore */ }
            }
        } else {
            let written = false;
            try {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(element);
                selection.removeAllRanges();
                selection.addRange(range);
                written = document.execCommand?.('insertText', false, value) === true;
            } catch {
                written = false;
            }
            if (!written) element.textContent = value;
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function supportsSelection(element) {
        return typeof element.selectionStart === 'number' && typeof element.setSelectionRange === 'function';
    }

    function wait(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    function buttonText(button) {
        return String(button?.getAttribute?.('aria-label') || button?.getAttribute?.('title') || button?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function findPromptTabs(container) {
        const buttons = [...(container?.querySelectorAll?.('button,[role="tab"]') || [])]
            .filter(button => !host?.contains(button));
        const negative = buttons.find(button => {
            const text = buttonText(button).toLowerCase();
            return /undesired content|negative prompt|character uc|(^|\s)uc($|\s)/i.test(text);
        }) || null;
        const prompt = buttons.find(button => {
            const text = buttonText(button).toLowerCase();
            if (button === negative || /undesired|negative|\buc\b|add character|save character/.test(text)) return false;
            return /(^|\s)prompt($|\s)|positive prompt|character prompt/.test(text);
        }) || null;
        return { prompt, negative };
    }

    /*
     * Native NovelAI V4/V4.5 character adapter.
     *
     * NovelAI currently exposes stable character roots such as:
     *   .character-prompt-input.character-prompt-input-1
     * and a ProseMirror editor inside:
     *   .prompt-input-box-character-prompts-1
     *
     * The Prompt / Undesired Content buttons do not expose aria-selected,
     * data-state or a reliable active class. The generic detector therefore
     * cannot infer which side is active. For real NovelAI character panels we
     * deliberately click the requested tab, wait for React/ProseMirror to
     * settle, and then read or write the visible editor inside that exact
     * character root.
     */
    function getNaiNativeCharacterRoot(element) {
        if (!IS_NAI) return null;
        const candidate = element?.element instanceof Element ? element.element : element;
        if (!(candidate instanceof Element)) return null;
        const root = candidate.matches?.('.character-prompt-input')
            ? candidate
            : candidate.closest?.('.character-prompt-input');
        return root instanceof Element && !host?.contains(root) ? root : null;
    }

    function getNaiNativeCharacterIndex(panel, fallback = 1) {
        if (!(panel instanceof Element)) return fallback;
        const classText = typeof panel.className === 'string' ? panel.className : '';
        const match = classText.match(/(?:^|\s)character-prompt-input-(\d+)(?:\s|$)/);
        return Number(match?.[1] || panel.dataset?.ainzCharacterIndex || fallback) || fallback;
    }

    function getNaiNativeCharacterPanels() {
        if (!IS_NAI) return [];
        const panels = [...document.querySelectorAll('.character-prompt-input')]
            .filter(panel => {
                if (!(panel instanceof Element) || host?.contains(panel) || !panel.isConnected) return false;
                const style = getComputedStyle(panel);
                const rect = panel.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 40 && rect.height > 35;
            });
        panels.sort(compareDomOrder);
        return panels;
    }

    function detectNaiCharacterType(panel, positiveText = '') {
        const promptTokens = new Set(splitPrompt(positiveText).map(canonicalTag).filter(Boolean));
        const hasGirl = promptTokens.has('girl');
        const hasBoy = promptTokens.has('boy');
        if (hasGirl && !hasBoy) return 'female';
        if (hasBoy && !hasGirl) return 'male';
        if (!hasGirl && !hasBoy && arguments.length >= 2) return 'other';
        if (hasGirl && hasBoy) return 'unknown';

        const root = getNaiNativeCharacterRoot(panel) || panel;
        if (!(root instanceof Element)) return 'unknown';
        if (root.dataset?.ainzCharacterType) return normalizeCharacterType(root.dataset.ainzCharacterType);

        const searchable = [
            root.getAttribute('aria-label'),
            root.getAttribute('title'),
            ...[...root.querySelectorAll('[aria-label],[title],[data-character-type]')].flatMap(element => [
                element.getAttribute('aria-label'),
                element.getAttribute('title'),
                element.getAttribute('data-character-type')
            ])
        ].filter(Boolean).join(' ').toLowerCase();

        if (/\bmale\b/.test(searchable) && !/\bfemale\b/.test(searchable)) return 'male';
        if (/\bother\b/.test(searchable)) return 'other';
        return 'unknown';
    }

    function exactVisibleText(element) {
        if (!(element instanceof Element) || host?.contains(element) || !isVisible(element)) return '';
        return String(element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function clickableChoiceElement(element) {
        if (!(element instanceof Element)) return null;
        let current = element;
        for (let depth = 0; current && depth < 5; depth++, current = current.parentElement) {
            if (host?.contains(current)) return null;
            const role = String(current.getAttribute?.('role') || '').toLowerCase();
            const tag = String(current.tagName || '').toLowerCase();
            const text = String(current.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!['female', 'male', 'other'].includes(text)) continue;
            if (tag === 'button' || ['button', 'menuitem', 'option', 'radio'].includes(role) || current.tabIndex >= 0 || getComputedStyle(current).cursor === 'pointer') return current;
        }
        return element;
    }

    function findNaiCharacterTypeChoice(type) {
        const wanted = normalizeCharacterType(type);
        const candidates = [...document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="option"],[role="radio"],li,div,span')]
            .filter(element => exactVisibleText(element) === wanted)
            .map(clickableChoiceElement)
            .filter(Boolean);
        candidates.sort((a, b) => {
            const aInteractive = a.matches?.('button,[role="button"],[role="menuitem"],[role="option"],[role="radio"]') ? 0 : 1;
            const bInteractive = b.matches?.('button,[role="button"],[role="menuitem"],[role="option"],[role="radio"]') ? 0 : 1;
            if (aInteractive !== bInteractive) return aInteractive - bInteractive;
            const ar = a.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            return (ar.width * ar.height) - (br.width * br.height);
        });
        return candidates[0] || null;
    }

    function getNaiCharacterTypeMenuChoices() {
        const choices = {
            female: findNaiCharacterTypeChoice('female'),
            male: findNaiCharacterTypeChoice('male'),
            other: findNaiCharacterTypeChoice('other')
        };
        return Object.values(choices).filter(Boolean).length >= 2 ? choices : null;
    }

    function clickNaiChoice(element) {
        if (!(element instanceof Element)) return false;
        try { element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ }
        try {
            const options = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 };
            if (globalThis.PointerEvent) element.dispatchEvent(new PointerEvent('pointerdown', options));
            element.dispatchEvent(new MouseEvent('mousedown', options));
            if (globalThis.PointerEvent) element.dispatchEvent(new PointerEvent('pointerup', options));
            element.dispatchEvent(new MouseEvent('mouseup', options));
            element.click();
            return true;
        } catch {
            try { element.click(); return true; } catch { return false; }
        }
    }

    function getNaiNativeCharacterTab(panel, polarity) {
        if (!(panel instanceof Element)) return null;
        const wantedNegative = polarity === 'negative';
        return [...panel.querySelectorAll('button,[role="tab"]')].find(button => {
            if (host?.contains(button)) return false;
            const text = buttonText(button).toLowerCase().replace(/\s+/g, ' ').trim();
            if (wantedNegative) return text === 'undesired content' || text === 'negative prompt' || text === 'character uc' || text === 'uc';
            return text === 'prompt' || text === 'positive prompt' || text === 'character prompt';
        }) || null;
    }

    function getNaiNativeCharacterEditor(panel) {
        if (!(panel instanceof Element)) return null;
        const candidates = [...panel.querySelectorAll([
            '[class*="prompt-input-box-character-prompts-"] .ProseMirror[contenteditable="true"]',
            '.ProseMirror[contenteditable="true"]',
            '[contenteditable="true"]',
            '[role="textbox"]',
            'textarea'
        ].join(','))].filter(element => isEditable(element) && !host?.contains(element));
        return candidates.find(isVisible) || null;
    }


    function getNaiNativeCharacterActivePanel() {
        if (!IS_NAI) return null;
        const focusedRoot = getNaiNativeCharacterRoot(document.activeElement);
        if (focusedRoot && getNaiNativeCharacterEditor(focusedRoot)) return focusedRoot;
        return getNaiNativeCharacterPanels().find(panel => getNaiNativeCharacterEditor(panel)) || null;
    }

    function naiCharacterHeaderLabel(panel) {
        const index = getNaiNativeCharacterIndex(panel, 1);
        return new RegExp(`^character\\s*${index}$`, 'i');
    }

    function directNodeText(element) {
        if (!(element instanceof Element)) return '';
        return [...element.childNodes]
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeNaiSwitchText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[“”‘’]/g, '')
            .replace(/\s+/g, '')
            .replace(/[^\p{L}\p{N}:,._+\-]/gu, '');
    }

    function getNaiNativeCharacterCardActivator(panel) {
        if (!(panel instanceof Element)) return null;
        const panelRect = panel.getBoundingClientRect();

        /*
         * Confirmed on the live NovelAI V4.5 interface:
         * the collapsed character card is opened by a large direct child
         * with role="button" and tabindex="0". The small blank header
         * buttons are the move-up / move-down controls and must never be
         * clicked by the toolkit.
         */
        const directCandidates = [...panel.children].filter(element => {
            if (!(element instanceof Element) || !isVisible(element) || host?.contains(element)) return false;
            if (String(element.getAttribute('role') || '').toLowerCase() !== 'button') return false;
            if (element.getAttribute('tabindex') !== '0' && element.tabIndex !== 0) return false;
            const rect = element.getBoundingClientRect();
            return rect.width >= panelRect.width * 0.72 && rect.height >= 70;
        });
        if (directCandidates.length) {
            directCandidates.sort((a, b) => {
                const ar = a.getBoundingClientRect();
                const br = b.getBoundingClientRect();
                return (br.width * br.height) - (ar.width * ar.height);
            });
            return directCandidates[0];
        }

        const descendants = [...panel.querySelectorAll('[role="button"][tabindex="0"]')]
            .filter(element => {
                if (!isVisible(element) || host?.contains(element)) return false;
                const rect = element.getBoundingClientRect();
                return rect.width >= panelRect.width * 0.68 && rect.height >= 65;
            })
            .sort((a, b) => {
                const ar = a.getBoundingClientRect();
                const br = b.getBoundingClientRect();
                return (br.width * br.height) - (ar.width * ar.height);
            });
        return descendants[0] || null;
    }

    function getNaiNativeCharacterOpenTargets(panel) {
        const activator = getNaiNativeCharacterCardActivator(panel);
        if (activator) return [activator];

        /*
         * Conservative fallback only: walk from the visible character label
         * to a large role=button ancestor. Never inspect or click the compact
         * header buttons because those reorder or delete characters.
         */
        const expected = naiCharacterHeaderLabel(panel);
        const labels = [...panel.querySelectorAll('div,span')].filter(element => {
            if (!isVisible(element) || host?.contains(element)) return false;
            const own = directNodeText(element);
            return expected.test(own);
        });
        for (const label of labels) {
            let current = label.parentElement;
            for (let depth = 0; current && current !== panel && depth < 5; depth++, current = current.parentElement) {
                if (String(current.getAttribute?.('role') || '').toLowerCase() !== 'button') continue;
                const rect = current.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                if (isVisible(current) && rect.width >= panelRect.width * 0.68 && rect.height >= 65) return [current];
            }
        }
        return [];
    }

    function naiTabVisualScore(button) {
        if (!(button instanceof Element) || !isVisible(button)) return -100;
        let score = 0;
        if (button.getAttribute('aria-selected') === 'true' || button.dataset.state === 'active' || button.classList.contains('active')) score += 100;
        const style = getComputedStyle(button);
        const background = String(style.backgroundColor || '').replace(/\\s+/g, '').toLowerCase();
        if (background && !['transparent', 'rgba(0,0,0,0)'].includes(background)) score += 8;
        const weight = Number.parseInt(style.fontWeight, 10);
        if (Number.isFinite(weight) && weight >= 600) score += 3;
        if (Number.parseFloat(style.opacity || '1') >= 0.95) score += 1;
        return score;
    }

    function getNaiNativeCharacterActivePolarity(panel) {
        if (!(panel instanceof Element)) return 'positive';
        const prompt = getNaiNativeCharacterTab(panel, 'positive');
        const negative = getNaiNativeCharacterTab(panel, 'negative');
        if (!prompt && !negative) return 'positive';
        if (!prompt) return 'negative';
        if (!negative) return 'positive';
        return naiTabVisualScore(negative) > naiTabVisualScore(prompt) ? 'negative' : 'positive';
    }

    async function ensureNaiNativeCharacterPanelOpen(panel) {
        let root = getNaiNativeCharacterRoot(panel) || panel;
        if (!(root instanceof Element) || !root.isConnected) throw new Error('NovelAI character panel is no longer available');

        const index = getNaiNativeCharacterIndex(root, 1);
        const reacquire = () => getNaiNativeCharacterPanels()
            .find(candidate => getNaiNativeCharacterIndex(candidate, 0) === index) || root;

        root = reacquire();
        if (getNaiNativeCharacterEditor(root)) return root;

        const previouslyActive = getNaiNativeCharacterActivePanel();
        const previousIndex = previouslyActive ? getNaiNativeCharacterIndex(previouslyActive, 0) : null;
        const previousEditorText = previouslyActive
            ? cleanPromptText(readNaiProseMirror(getNaiNativeCharacterEditor(previouslyActive)))
            : '';
        const collapsedSummary = normalizeNaiSwitchText(root.innerText || root.textContent || '');
        const targets = getNaiNativeCharacterOpenTargets(root);
        if (!targets.length) throw new Error(`NovelAI Character ${index} has no safe card activator`);

        for (const target of targets) {
            if (!(target instanceof Element) || !target.isConnected) continue;
            clickNaiChoice(target);

            const deadline = Date.now() + 3200;
            let lastSignature = null;
            let stableSince = 0;

            while (Date.now() < deadline) {
                await wait(55);
                root = reacquire();
                const activePanel = getNaiNativeCharacterActivePanel();
                const activeIndex = activePanel ? getNaiNativeCharacterIndex(activePanel, 0) : null;
                const editor = getNaiNativeCharacterEditor(root);
                if (!editor || activeIndex !== index) {
                    lastSignature = null;
                    stableSince = 0;
                    continue;
                }

                const rawText = cleanPromptText(readNaiProseMirror(editor));
                const signature = rawText;
                if (signature !== lastSignature) {
                    lastSignature = signature;
                    stableSince = Date.now();
                    continue;
                }

                const normalizedEditor = normalizeNaiSwitchText(rawText);
                const summaryMatches = !normalizedEditor
                    || collapsedSummary.includes(normalizedEditor.slice(0, Math.min(120, normalizedEditor.length)));
                const differsFromPrevious = previousIndex === index
                    || rawText !== previousEditorText
                    || summaryMatches;

                if (Date.now() - stableSince >= 180 && differsFromPrevious) return root;
            }
        }

        throw new Error(`NovelAI Character ${index} could not be expanded safely`);
    }

    function captureNaiCharacterUiState() {
        const panel = getNaiNativeCharacterActivePanel();
        return {
            panel,
            index: panel ? getNaiNativeCharacterIndex(panel, 1) : null,
            polarity: panel ? getNaiNativeCharacterActivePolarity(panel) : 'positive',
            scrollX: window.scrollX,
            scrollY: window.scrollY
        };
    }

    async function restoreNaiCharacterUiState(savedState, fallbackPanel = null, polarityOverride = '') {
        if (!IS_NAI) return;
        const panels = getNaiNativeCharacterPanels();
        let panel = savedState?.panel?.isConnected ? savedState.panel : null;
        if (!panel && savedState?.index) panel = panels.find(item => getNaiNativeCharacterIndex(item, 0) === Number(savedState.index)) || null;
        if (!panel && fallbackPanel?.isConnected) panel = fallbackPanel;
        if (panel) {
            try {
                await ensureNaiNativeCharacterPanelOpen(panel);
                await activateNaiNativeCharacterTab(panel, polarityOverride || savedState?.polarity || 'positive');
            } catch (error) {
                console.warn('[Ainz Toolkit] Could not restore the previously active character panel:', error);
            }
        }
        if (Number.isFinite(savedState?.scrollX) && Number.isFinite(savedState?.scrollY)) {
            try { window.scrollTo(savedState.scrollX, savedState.scrollY); } catch { /* ignore */ }
        }
    }

    function readNaiProseMirror(element) {
        if (!element) return '';
        if (element.matches?.('textarea,input')) return element.value || '';
        return element.innerText || element.textContent || '';
    }

    async function activateNaiNativeCharacterTab(panel, polarity) {
        let root = getNaiNativeCharacterRoot(panel) || panel;
        if (!(root instanceof Element) || !root.isConnected) return null;
        try {
            root = await ensureNaiNativeCharacterPanelOpen(root);
        } catch {
            return null;
        }

        const index = getNaiNativeCharacterIndex(root, 1);
        const reacquire = () => getNaiNativeCharacterPanels()
            .find(candidate => getNaiNativeCharacterIndex(candidate, 0) === index) || root;
        root = reacquire();

        const wanted = polarity === 'negative' ? 'negative' : 'positive';
        const target = getNaiNativeCharacterTab(root, wanted);
        if (!target || target.disabled) return null;

        /*
         * NovelAI's Character Prompt tabs currently expose no dependable
         * aria-selected or active class. Always click the requested tab,
         * even when visual heuristics think it is already active. This avoids
         * reading the visible UC editor as Prompt when the scorer guessed wrong.
         */
        const editorBefore = getNaiNativeCharacterEditor(root);
        const signatureBefore = cleanPromptText(readNaiProseMirror(editorBefore));
        if (!clickNaiChoice(target)) return null;

        const deadline = Date.now() + 2600;
        const started = Date.now();
        let stableEditor = null;
        let stableSignature = null;
        let stableSince = 0;

        while (Date.now() < deadline) {
            await wait(55);
            root = reacquire();
            const editor = getNaiNativeCharacterEditor(root);
            if (!editor) {
                stableEditor = null;
                stableSignature = null;
                stableSince = 0;
                continue;
            }

            const promptTab = getNaiNativeCharacterTab(root, 'positive');
            const negativeTab = getNaiNativeCharacterTab(root, 'negative');
            const targetNow = wanted === 'negative' ? negativeTab : promptTab;
            const otherNow = wanted === 'negative' ? promptTab : negativeTab;
            const explicit = targetNow?.getAttribute('aria-selected') === 'true'
                || targetNow?.dataset.state === 'active'
                || targetNow?.classList.contains('active');
            const visuallyActive = Boolean(targetNow && (explicit || naiTabVisualScore(targetNow) > naiTabVisualScore(otherNow)));
            const signature = cleanPromptText(readNaiProseMirror(editor));

            if (editor !== stableEditor || signature !== stableSignature) {
                stableEditor = editor;
                stableSignature = signature;
                stableSince = Date.now();
                continue;
            }

            const changedAfterClick = editor !== editorBefore || signature !== signatureBefore;
            const fallbackElapsed = Date.now() - started >= 550;
            if (Date.now() - stableSince >= 180 && (visuallyActive || changedAfterClick || fallbackElapsed)) return editor;
        }

        return null;
    }

    async function readNaiNativeCharacterValue(panel, polarity, strict = false) {
        const editor = await activateNaiNativeCharacterTab(panel, polarity);
        if (!editor) {
            if (strict) throw new Error(`NovelAI did not confirm the ${polarity === 'negative' ? 'Undesired Content' : 'Prompt'} tab`);
            return '';
        }
        await wait(45);
        return cleanPromptText(readNaiProseMirror(editor));
    }

    async function writeNaiNativeCharacterValue(panel, polarity, incomingText, replace) {
        const editor = await activateNaiNativeCharacterTab(panel, polarity);
        if (!editor) return { inserted: 0, skipped: 0, failed: true };
        const value = cleanPromptText(incomingText);
        if (replace) {
            writeEditable(editor, value, value.length);
            return { inserted: splitPrompt(value).length, skipped: 0 };
        }
        if (!value) return { inserted: 0, skipped: 0 };
        const tags = splitPrompt(value);
        const current = readNaiProseMirror(editor);
        const result = mergePrompt(current, tags, editor, data.settings.insertPosition, data.settings.duplicateMode);
        writeEditable(editor, result.value, result.selectionStart);
        return { inserted: result.inserted, skipped: result.skipped };
    }

    async function captureNaiNativeCharacterPanel(panel, index = null) {
        const root = getNaiNativeCharacterRoot(panel);
        if (!root) throw new Error('NovelAI character root was not found');
        const resolvedIndex = Number(index || getNaiNativeCharacterIndex(root, 1)) || 1;
        const originalEditor = getNaiNativeCharacterEditor(root);
        const originalVisibleValue = cleanPromptText(readNaiProseMirror(originalEditor));
        const originalPolarityGuess = getNaiNativeCharacterActivePolarity(root);
        let positive = '';
        let negative = '';
        try {
            positive = await readNaiNativeCharacterValue(root, 'positive', true);
            negative = await readNaiNativeCharacterValue(root, 'negative', true);
        } finally {
            const restorePolarity = originalVisibleValue === negative && originalVisibleValue !== positive
                ? 'negative'
                : originalVisibleValue === positive && originalVisibleValue !== negative
                    ? 'positive'
                    : originalPolarityGuess;
            const restored = await activateNaiNativeCharacterTab(root, restorePolarity);
            if (!restored) console.warn(`[Ainz Toolkit] Character ${resolvedIndex} was scanned, but its previously active tab could not be restored.`);
        }
        return {
            scope: 'character',
            index: resolvedIndex,
            name: `Character ${resolvedIndex}`,
            positive: cleanPromptText(positive),
            negative: cleanPromptText(negative),
            naiCharacterType: detectNaiCharacterType(root, positive)
        };
    }

    function currentEditableIn(container) {
        if (!container) return null;
        return [...container.querySelectorAll('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')]
            .find(element => isEditable(element) && isVisible(element) && !host.contains(element)) || null;
    }

    function collectPromptPanelDescriptors() {
        refreshEditableFields(false);
        const map = new Map();
        for (const field of getRegisteredFields()) {
            const container = field.container || findPromptContainer(field.element) || field.element.parentElement;
            if (!container) continue;
            if (!map.has(container)) {
                map.set(container, {
                    container,
                    scope: field.scope,
                    index: field.characterIndex,
                    positive: null,
                    negative: null,
                    tabs: findPromptTabs(container)
                });
            }
            const descriptor = map.get(container);
            descriptor.scope = field.scope === 'character' || container.matches?.('[data-ainz-character-panel="true"]') ? 'character' : descriptor.scope;
            descriptor.index = Number(container.dataset?.ainzCharacterIndex || field.characterIndex || descriptor.index || 0) || null;
            descriptor[field.polarity] = field;
        }

        const descriptors = [...map.values()];
        const characters = descriptors.filter(item => item.scope === 'character');
        characters.sort((a, b) => (Number(a.index) || 999) - (Number(b.index) || 999) || compareDomOrder(a.container, b.container));
        characters.forEach((item, index) => { if (!item.index) item.index = index + 1; });
        return descriptors.sort((a, b) => a.scope === b.scope ? compareDomOrder(a.container, b.container) : a.scope === 'base' ? -1 : 1);
    }

    function compareDomOrder(a, b) {
        if (a === b) return 0;
        if (!a?.compareDocumentPosition || !b) return 0;
        const position = a.compareDocumentPosition(b);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    }

    function descriptorActivePolarity(descriptor) {
        const active = findActivePromptTab(descriptor.container);
        const text = buttonText(active).toLowerCase();
        return /undesired|negative|\buc\b/.test(text) ? 'negative' : 'positive';
    }

    async function activatePromptTab(descriptor, polarity) {
        if (!descriptor?.container?.isConnected) return false;
        const nativeRoot = descriptor.scope === 'character' ? getNaiNativeCharacterRoot(descriptor.container) : null;
        if (nativeRoot) return Boolean(await activateNaiNativeCharacterTab(nativeRoot, polarity));
        const tabs = findPromptTabs(descriptor.container);
        descriptor.tabs = tabs;
        const target = polarity === 'negative' ? tabs.negative : tabs.prompt;
        if (!target || target.disabled) return false;
        const active = findActivePromptTab(descriptor.container);
        if (active === target || target.getAttribute('aria-selected') === 'true' || target.dataset.state === 'active') return true;
        target.click();
        const deadline = Date.now() + 1200;
        while (Date.now() < deadline) {
            await wait(60);
            const currentActive = findActivePromptTab(descriptor.container);
            if (currentActive === target || target.getAttribute('aria-selected') === 'true' || target.dataset.state === 'active') break;
        }
        refreshEditableFields(false);
        descriptor.tabs = findPromptTabs(descriptor.container);
        return true;
    }

    async function readDescriptorValue(descriptor, polarity) {
        if (!descriptor?.container?.isConnected) return '';
        const nativeRoot = descriptor.scope === 'character' ? getNaiNativeCharacterRoot(descriptor.container) : null;
        if (nativeRoot) return readNaiNativeCharacterValue(nativeRoot, polarity);
        descriptor.tabs = findPromptTabs(descriptor.container);
        const hasTabs = Boolean(descriptor.tabs.prompt || descriptor.tabs.negative);
        const direct = descriptor[polarity];
        if (!hasTabs && direct?.element?.isConnected) return readEditable(direct.element);

        if (hasTabs) await activatePromptTab(descriptor, polarity);
        let editable = currentEditableIn(descriptor.container);
        if (!editable && direct?.element?.isConnected) editable = direct.element;
        if (!editable) return '';

        const info = registerEditable(editable);
        info.scope = descriptor.scope;
        info.characterIndex = descriptor.index || info.characterIndex;
        info.container = descriptor.container;
        info.polarity = polarity;
        info.kind = descriptor.scope === 'character' ? `character-${polarity}` : polarity;
        descriptor[polarity] = info;
        return readEditable(editable);
    }

    async function writeDescriptorValue(descriptor, polarity, incomingText, replace) {
        const nativeRoot = descriptor?.scope === 'character' ? getNaiNativeCharacterRoot(descriptor.container) : null;
        if (nativeRoot) return writeNaiNativeCharacterValue(nativeRoot, polarity, incomingText, replace);
        const tabs = findPromptTabs(descriptor?.container);
        const targetTab = polarity === 'negative' ? tabs.negative : tabs.prompt;
        if (!descriptor?.[polarity]?.element?.isConnected && !targetTab) return { inserted: 0, skipped: 0, failed: true };
        await activatePromptTab(descriptor, polarity);
        let field = descriptor[polarity];
        if (!field?.element?.isConnected || !isVisible(field.element)) {
            const editable = currentEditableIn(descriptor.container);
            if (editable) field = registerEditable(editable);
        }
        if (!field?.element) return { inserted: 0, skipped: 0, failed: true };
        const value = cleanPromptText(incomingText);
        if (replace) {
            writeEditable(field.element, value, value.length);
            return { inserted: splitPrompt(value).length, skipped: 0 };
        }
        if (!value) return { inserted: 0, skipped: 0 };
        const tags = splitPrompt(value);
        const current = readEditable(field.element);
        const result = mergePrompt(current, tags, field.element, data.settings.insertPosition, data.settings.duplicateMode);
        writeEditable(field.element, result.value, result.selectionStart);
        return { inserted: result.inserted, skipped: result.skipped };
    }

    function mainPromptDescriptorIsUsable(descriptor) {
        return Boolean(descriptor?.container?.isConnected && !host?.contains(descriptor.container));
    }

    function resolveMainPromptDescriptor(polarity = 'positive') {
        const cached = mainPromptDescriptorCache[polarity];
        if (mainPromptDescriptorCache.route === location.href && mainPromptDescriptorIsUsable(cached)) return cached;
        refreshEditableFields(false);
        const descriptors = collectPromptPanelDescriptors();
        const characterContainers = descriptors.filter(entry => entry.scope === 'character').map(entry => entry.container);
        const descriptor = descriptors.find(entry => entry.scope === 'base' && !characterContainers.some(container => container === entry.container || container?.contains?.(entry.container) || entry.container?.contains?.(container)))
            || descriptors.find(entry => entry.scope === 'base')
            || null;
        mainPromptDescriptorCache.route = location.href;
        mainPromptDescriptorCache.positive = descriptor;
        mainPromptDescriptorCache.negative = descriptor;
        return descriptor;
    }

    function mainPositivePromptDescriptor() {
        return resolveMainPromptDescriptor('positive');
    }

    async function writeMainPositivePrompt(incomingText, replace = false) {
        const value = cleanPromptText(incomingText);
        if (!value && !replace) return { inserted: 0, skipped: 0 };
        const descriptor = mainPositivePromptDescriptor();
        if (descriptor) {
            const result = await writeDescriptorValue(descriptor, 'positive', value, replace);
            await activatePromptTab(descriptor, 'positive');
            return result;
        }
        const field = getBaseField('positive');
        if (!field?.element) return { inserted: 0, skipped: 0, failed: true };
        if (replace) {
            writeEditable(field.element, value, value.length);
            return { inserted: splitPrompt(value).length, skipped: 0 };
        }
        const tags = splitPrompt(value);
        const current = readEditable(field.element);
        const result = mergePrompt(current, tags, field.element, data.settings.insertPosition, data.settings.duplicateMode);
        writeEditable(field.element, result.value, result.selectionStart);
        return { inserted: result.inserted, skipped: result.skipped };
    }

    function mainNegativePromptDescriptor() {
        return resolveMainPromptDescriptor('negative');
    }

    async function writeMainNegativePrompt(incomingText, replace = false) {
        const value = cleanPromptText(incomingText);
        if (!value && !replace) return { inserted: 0, skipped: 0 };
        const descriptor = mainNegativePromptDescriptor();
        if (descriptor) return writeDescriptorValue(descriptor, 'negative', value, replace);
        const field = getBaseField('negative');
        if (!field?.element) return { inserted: 0, skipped: 0, failed: true };
        if (replace) {
            writeEditable(field.element, value, value.length);
            return { inserted: splitPrompt(value).length, skipped: 0 };
        }
        const tags = splitPrompt(value);
        const current = readEditable(field.element);
        const result = mergePrompt(current, tags, field.element, data.settings.insertPosition, data.settings.duplicateMode);
        writeEditable(field.element, result.value, result.selectionStart);
        return { inserted: result.inserted, skipped: result.skipped };
    }


    async function capturePromptDescriptor(descriptor) {
        if (!descriptor?.container?.isConnected) return {
            scope: descriptor?.scope || 'base',
            index: descriptor?.index || null,
            name: descriptor?.scope === 'character' ? `Character ${descriptor?.index || ''}`.trim() : 'Base',
            positive: '',
            negative: ''
        };
        const originalPolarity = descriptorActivePolarity(descriptor);
        const positive = await readDescriptorValue(descriptor, 'positive');
        const negative = await readDescriptorValue(descriptor, 'negative');
        await activatePromptTab(descriptor, originalPolarity || 'positive');
        return {
            scope: descriptor.scope,
            index: descriptor.index,
            name: descriptor.scope === 'character' ? `Character ${descriptor.index || ''}`.trim() : 'Base',
            positive: cleanPromptText(positive),
            negative: cleanPromptText(negative)
        };
    }

    async function captureCharacterPanel(container, index = null) {
        const nativeRoot = getNaiNativeCharacterRoot(container);
        if (nativeRoot) return captureNaiNativeCharacterPanel(nativeRoot, index || getNaiNativeCharacterIndex(nativeRoot, 1));
        const panel = markCharacterPanel(expandCharacterPanel(container) || container, index);
        if (!panel) throw new Error('Character panel is no longer available');
        const descriptor = descriptorFromCharacterPanel(panel, index || Number(panel.dataset.ainzCharacterIndex || 0));
        if (!descriptor) throw new Error('Character field could not be resolved');
        const originalPolarity = descriptorActivePolarity(descriptor);
        let positive = '';
        let negative = '';
        try {
            positive = await readDescriptorValue(descriptor, 'positive');
            negative = await readDescriptorValue(descriptor, 'negative');
        } finally {
            await activatePromptTab(descriptor, originalPolarity || 'positive');
        }
        return {
            scope: 'character',
            index: descriptor.index,
            name: `Character ${descriptor.index || ''}`.trim(),
            positive: cleanPromptText(positive),
            negative: cleanPromptText(negative),
            naiCharacterType: detectNaiCharacterType(panel, positive)
        };
    }

    async function captureNaiPromptStructure(quiet = false) {
        refreshEditableFields(true);
        installNaiFieldButtons();

        const genericDescriptors = collectPromptPanelDescriptors();
        const markedPanels = new Set(getMarkedCharacterPanels().map(entry => entry.container));
        const baseCandidates = genericDescriptors.filter(entry => {
            if (entry.scope !== 'base') return false;
            return ![...markedPanels].some(panel => panel === entry.container || panel.contains(entry.container) || entry.container.contains(panel));
        });
        const baseDescriptor = baseCandidates[0] || genericDescriptors.find(entry => entry.scope === 'base') || null;

        let basePositive = '';
        let baseNegative = '';
        if (baseDescriptor) {
            const capturedBase = await capturePromptDescriptor(baseDescriptor);
            basePositive = capturedBase.positive || '';
            baseNegative = capturedBase.negative || '';
        } else {
            const positiveField = getBaseField('positive');
            const negativeField = getBaseField('negative');
            basePositive = cleanPromptText(positiveField ? readEditable(positiveField.element) : '');
            baseNegative = cleanPromptText(negativeField ? readEditable(negativeField.element) : '');
        }

        const characters = [];
        const nativeCharacterPanels = getNaiNativeCharacterPanels();
        if (nativeCharacterPanels.length) {
            const originalCharacterUi = captureNaiCharacterUiState();
            try {
                for (let position = 0; position < nativeCharacterPanels.length; position++) {
                    const panel = nativeCharacterPanels[position];
                    try {
                        if (!quiet) toast(`Reading Character ${position + 1} of ${nativeCharacterPanels.length} …`, 'info');
                        await ensureNaiNativeCharacterPanelOpen(panel);
                        const captured = await captureNaiNativeCharacterPanel(panel, getNaiNativeCharacterIndex(panel, position + 1));
                        characters.push({
                            name: captured.name || `Character ${position + 1}`,
                            index: Number(captured.index) || position + 1,
                            positive: captured.positive || '',
                            negative: captured.negative || '',
                            naiCharacterType: normalizeCharacterType(captured.naiCharacterType)
                        });
                    } catch (error) {
                        console.warn(`[Ainz Toolkit] Native Character ${position + 1} could not be captured:`, error);
                    }
                }
            } finally {
                await restoreNaiCharacterUiState(originalCharacterUi, nativeCharacterPanels[0] || null, 'positive');
            }
        } else {
            let characterDescriptors = getCharacterPanelDescriptors();
            if (!characterDescriptors.length) characterDescriptors = genericDescriptors.filter(entry => entry.scope === 'character');
            for (let position = 0; position < characterDescriptors.length; position++) {
                const descriptor = characterDescriptors[position];
                try {
                    const captured = descriptor.container?.matches?.('[data-ainz-character-panel="true"]')
                        ? await captureCharacterPanel(descriptor.container, position + 1)
                        : await capturePromptDescriptor({ ...descriptor, scope: 'character', index: position + 1 });
                    characters.push({
                        name: captured.name || `Character ${position + 1}`,
                        index: Number(captured.index) || position + 1,
                        positive: captured.positive || '',
                        negative: captured.negative || '',
                        naiCharacterType: normalizeCharacterType(captured.naiCharacterType)
                    });
                } catch (error) {
                    console.warn(`[Ainz Toolkit] Character ${position + 1} could not be captured:`, error);
                }
            }
        }

        return { basePositive, baseNegative, characters };
    }

    async function saveCurrentFullImage() {
        if (!IS_NAI || state.fullImageCapturing) return;
        state.fullImageCapturing = true;
        render();
        toast('Reading every NovelAI prompt field …', 'info');
        try {
            const snapshot = await captureNaiPromptStructure();
            const hasContent = snapshot.basePositive || snapshot.baseNegative || snapshot.characters.some(character => character.positive || character.negative);
            if (!hasContent) return toast('No filled NovelAI prompt fields were detected', 'error');
            const name = `Full Image · ${new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`;
            openEditModal('fullImage', null, { ...blankItem('fullImage'), ...snapshot, name, category: 'Full Image' });
        } catch (error) {
            console.error('[Ainz Toolkit] Full image capture failed:', error);
            toast(`Could not read all prompt fields: ${error.message}`, 'error');
        } finally {
            state.fullImageCapturing = false;
            render();
        }
    }

    async function openNaiCharacterImport() {
        if (!IS_NAI) return;
        toast('Reading NovelAI character prompts …', 'info');
        try {
            const snapshot = await captureNaiPromptStructure();
            state.modal = 'character-import';
            state.modalPayload = { characters: snapshot.characters.filter(character => character.positive || character.negative) };
            state.open = true;
            render();
        } catch (error) {
            toast(`Could not read character prompts: ${error.message}`, 'error');
        }
    }

    function chooseNaiCharacter(index) {
        const character = state.modalPayload?.characters?.[index];
        if (!character) return;
        openEditModal('character', null, {
            ...blankItem('character'),
            name: character.name || `Character ${index + 1}`,
            positive: character.positive || '',
            negative: character.negative || '',
            naiCharacterType: normalizeCharacterType(character.naiCharacterType),
            category: 'Characters'
        });
    }

    async function applyCharacterToSelected(item, replace) {
        const descriptors = getCharacterPanelDescriptors();
        const descriptor = descriptors.find(entry => String(entry.index) === String(state.selectedCharacterIndex)) || descriptors[0];
        if (!descriptor) {
            toast('No NovelAI character field is open. Use Add Character instead.', 'error');
            return { inserted: 0, skipped: 0, failed: 1 };
        }
        const pos = await writeDescriptorValue(descriptor, 'positive', item.positive || '', replace);
        const neg = await writeDescriptorValue(descriptor, 'negative', item.negative || '', replace);
        await activatePromptTab(descriptor, 'positive');
        return { inserted: pos.inserted + neg.inserted, skipped: pos.skipped + neg.skipped, failed: Number(Boolean(pos.failed)) + Number(Boolean(neg.failed)) };
    }

    function findAddCharacterButton() {
        return [...document.querySelectorAll('button,[role="button"]')].find(button => {
            if (host.contains(button) || button.disabled) return false;
            const text = buttonText(button).toLowerCase().replace(/\s+/g, ' ').trim();
            if (/reference|vibe|director|style/.test(text)) return false;
            return /^(?:\+\s*)?add (?:a )?character$/.test(text) || /\badd (?:a )?character\b/.test(text);
        }) || null;
    }

    async function clickAddCharacterAndWait(characterType = 'female') {
        installNaiFieldButtons();
        const wantedType = normalizeCharacterType(characterType);
        if (wantedType === 'unknown') throw new Error('Choose Female, Male or Other for this saved character before adding it to NovelAI');
        const before = getCharacterPanelDescriptors();
        const beforeContainers = new Set(before.map(item => item.container));
        const button = findAddCharacterButton();
        if (!button) throw new Error('NovelAI Add Character button was not found');

        clickNaiChoice(button);

        let typeSelected = false;
        const selectionDeadline = Date.now() + 3500;
        while (Date.now() < selectionDeadline) {
            await wait(80);
            refreshEditableFields(false);
            const earlyPanels = getCharacterPanelDescriptors();
            const earlyAdded = earlyPanels.find(item => !beforeContainers.has(item.container)) || (earlyPanels.length > before.length ? earlyPanels[earlyPanels.length - 1] : null);
            if (earlyAdded) {
                const root = getNaiNativeCharacterRoot(earlyAdded.container);
                if (root) root.dataset.ainzCharacterType = wantedType;
                return earlyAdded;
            }

            const choices = getNaiCharacterTypeMenuChoices();
            if (!choices) continue;
            const choice = choices[wantedType] || choices.female || choices.male || choices.other;
            if (!choice) continue;
            if (!clickNaiChoice(choice)) throw new Error(`NovelAI's ${characterTypeLabel(wantedType)} character option could not be clicked`);
            typeSelected = true;
            break;
        }

        if (!typeSelected && getNaiCharacterTypeMenuChoices()) {
            throw new Error(`NovelAI's character type menu opened, but ${characterTypeLabel(wantedType)} could not be selected`);
        }

        const deadline = Date.now() + 7000;
        while (Date.now() < deadline) {
            await wait(120);
            refreshEditableFields(false);
            installNaiFieldButtons();
            const after = getCharacterPanelDescriptors();
            const added = after.find(item => !beforeContainers.has(item.container)) || (after.length > before.length ? after[after.length - 1] : null);
            if (added) {
                const root = getNaiNativeCharacterRoot(added.container);
                if (root) root.dataset.ainzCharacterType = wantedType;
                return added;
            }
        }
        throw new Error(`NovelAI did not create a readable ${characterTypeLabel(wantedType)} character field in time`);
    }

    async function addSavedCharacter(id) {
        const item = findItem('character', id);
        if (!item || !IS_NAI) return;
        if (normalizeCharacterType(item.naiCharacterType) === 'unknown') {
            openEditModal('character', item.id);
            render();
            return toast('NovelAI does not expose the type of existing character panels. Choose the correct type once, then add the character again.', 'info');
        }
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
        state.operationBusy = true;
        toast(`Adding ${item.name} to NovelAI …`, 'info');
        try {
            await snapshotPrompt(`Before Add Character: ${item.name}`, false);
            const descriptor = await clickAddCharacterAndWait(item.naiCharacterType);
            const pos = await writeDescriptorValue(descriptor, 'positive', item.positive || '', true);
            const neg = await writeDescriptorValue(descriptor, 'negative', item.negative || '', true);
            await activatePromptTab(descriptor, 'positive');
            refreshEditableFields(true);
            selectCharacterTarget(descriptor.index);
            recordItemUse('character', item);
            if (data.settings.closeAfterInsertion) closeToolkitPanel();
            else rememberCurrentViewState();
            if (item.negative && neg.failed) toast(`${item.name} was added, but NovelAI's Character UC field could not be opened`, 'info');
            else toast(`${item.name} added as ${characterTypeLabel(item.naiCharacterType)} Character ${descriptor.index || ''} · ${pos.inserted + neg.inserted} tags`, 'success');
        } catch (error) {
            console.error('[Ainz Toolkit] Add Character failed:', error);
            toast(error.message, 'error');
        } finally {
            state.operationBusy = false;
        }
    }

    async function ensureCharacterDescriptors(count, characterTypes = []) {
        installNaiFieldButtons();
        let descriptors = getCharacterPanelDescriptors();
        while (descriptors.length < count) {
            const nextType = normalizeCharacterType(characterTypes[descriptors.length]);
            await clickAddCharacterAndWait(nextType);
            installNaiFieldButtons();
            descriptors = getCharacterPanelDescriptors();
        }
        return descriptors.sort((a, b) => Number(a.index) - Number(b.index));
    }

    async function applyFullImage(item, replace, selectedParts = null) {
        let inserted = 0;
        let skipped = 0;
        let failed = 0;
        const originalCharacterUi = captureNaiCharacterUiState();
        let firstAppliedCharacterPanel = null;
        const includes = key => !selectedParts || selectedParts.has(key);

        try {
            const descriptors = collectPromptPanelDescriptors();
            const characterPanels = new Set(getCharacterPanelDescriptors().map(entry => entry.container));
            const baseDescriptor = descriptors.find(entry => entry.scope === 'base' && ![...characterPanels].some(panel => panel === entry.container || panel.contains(entry.container) || entry.container.contains(panel)))
                || descriptors.find(entry => entry.scope === 'base');
            if (baseDescriptor) {
                const pos = includes('basePositive') ? await writeDescriptorValue(baseDescriptor, 'positive', item.basePositive || '', replace) : { inserted: 0, skipped: 0 };
                const neg = includes('baseNegative') ? await writeDescriptorValue(baseDescriptor, 'negative', item.baseNegative || '', replace) : { inserted: 0, skipped: 0 };
                inserted += pos.inserted + neg.inserted;
                skipped += pos.skipped + neg.skipped;
                failed += Number(Boolean(pos.failed)) + Number(Boolean(neg.failed));
                if (includes('basePositive') || includes('baseNegative')) await activatePromptTab(baseDescriptor, 'positive');
            } else {
                const pos = includes('basePositive') ? (replace ? replaceSpecificField(getBaseField('positive'), item.basePositive || '') : appendSpecificField(getBaseField('positive'), item.basePositive || '')) : { inserted: 0, skipped: 0 };
                const neg = includes('baseNegative') ? (replace ? replaceSpecificField(getBaseField('negative'), item.baseNegative || '') : appendSpecificField(getBaseField('negative'), item.baseNegative || '')) : { inserted: 0, skipped: 0 };
                inserted += pos.inserted + neg.inserted;
                skipped += pos.skipped + neg.skipped;
            }

            const savedCharacters = Array.isArray(item.characters) ? item.characters : [];
            const selectedCharacterIndexes = savedCharacters.map((_character, index) => index).filter(index => includes(`character:${index}:positive`) || includes(`character:${index}:negative`));
            const requiredCount = selectedCharacterIndexes.length ? Math.max(...selectedCharacterIndexes) + 1 : 0;
            const characterDescriptors = requiredCount ? await ensureCharacterDescriptors(requiredCount, savedCharacters.slice(0, requiredCount).map(character => character.naiCharacterType)) : [];
            for (let index = 0; index < savedCharacters.length; index++) {
                const usePositive = includes(`character:${index}:positive`);
                const useNegative = includes(`character:${index}:negative`);
                if (!usePositive && !useNegative) continue;
                const saved = savedCharacters[index];
                const descriptor = characterDescriptors[index];
                const nativePanel = getNaiNativeCharacterRoot(descriptor?.container);
                if (nativePanel) {
                    await ensureNaiNativeCharacterPanelOpen(nativePanel);
                    if (!firstAppliedCharacterPanel) firstAppliedCharacterPanel = nativePanel;
                }
                const pos = usePositive ? await writeDescriptorValue(descriptor, 'positive', saved.positive || '', replace) : { inserted: 0, skipped: 0 };
                const neg = useNegative ? await writeDescriptorValue(descriptor, 'negative', saved.negative || '', replace) : { inserted: 0, skipped: 0 };
                inserted += pos.inserted + neg.inserted;
                skipped += pos.skipped + neg.skipped;
                failed += Number(Boolean(pos.failed)) + Number(Boolean(neg.failed));
                await activatePromptTab(descriptor, 'positive');
            }
            return { inserted, skipped, failed };
        } finally {
            await restoreNaiCharacterUiState(originalCharacterUi, firstAppliedCharacterPanel);
        }
    }

    function appendSpecificField(field, text) {
        if (!field?.element || !text) return { inserted: 0, skipped: 0 };
        const tags = splitPrompt(text);
        const result = mergePrompt(readEditable(field.element), tags, field.element, data.settings.insertPosition, data.settings.duplicateMode);
        writeEditable(field.element, result.value, result.selectionStart);
        return { inserted: result.inserted, skipped: result.skipped };
    }

    function replaceSpecificField(field, text) {
        if (!field?.element) return { inserted: 0, skipped: 0 };
        const value = cleanPromptText(text);
        writeEditable(field.element, value, value.length);
        return { inserted: splitPrompt(value).length, skipped: 0 };
    }

    function installNaiFieldButtons() {
        if (!IS_NAI) return;
        refreshEditableFields(false);
        const panels = getNaiNativeCharacterPanels();
        for (let position = 0; position < panels.length; position++) {
            const container = markCharacterPanel(panels[position], getNaiNativeCharacterIndex(panels[position], position + 1));
            if (!container) continue;
            const index = getNaiNativeCharacterIndex(container, position + 1);
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            let button = container.querySelector(':scope > .ainz-save-character-inline');
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'ainz-save-character-inline';
                button.textContent = 'Save';
                button.title = 'Save this exact NovelAI character prompt to the Ainz Toolkit';
                button.addEventListener('click', async event => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
                    const liveContainer = button.closest('.character-prompt-input');
                    if (!liveContainer) return toast('This NovelAI character panel is no longer available', 'error');
                    state.operationBusy = true;
                    button.disabled = true;
                    button.textContent = '…';
                    try {
                        const liveIndex = getNaiNativeCharacterIndex(liveContainer, Number(button.dataset.ainzCharacterIndex) || 1);
                        const captured = await captureCharacterPanel(liveContainer, liveIndex);
                        if (!captured.positive && !captured.negative) throw new Error('Both Prompt and Undesired Content were empty or inaccessible');
                        openEditModal('character', null, {
                            ...blankItem('character'), name: `Character ${liveIndex}`,
                            positive: captured.positive, negative: captured.negative,
                            naiCharacterType: normalizeCharacterType(captured.naiCharacterType), category: 'Characters'
                        });
                        state.open = true;
                        render();
                    } catch (error) {
                        console.error('[Ainz Toolkit] Save Character failed:', error);
                        toast(error.message || 'Character field could not be read', 'error');
                    } finally {
                        state.operationBusy = false;
                        if (button.isConnected) { button.disabled = false; button.textContent = 'Save'; }
                    }
                });
                container.appendChild(button);
            }
            button.dataset.ainzCharacterIndex = String(index);
            button.style.cssText = 'position:absolute;z-index:8;top:5px;right:92px;display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 9px;border:0;border-radius:9px;background:rgba(147,131,255,.16);color:#eeeaff;font:750 11px/1 system-ui,sans-serif;cursor:pointer;box-shadow:none;white-space:nowrap;';
        }
    }
    function thumbnailStorageKey(itemId, variantId = '') {
        return `${THUMBNAIL_KEY_PREFIX}${itemId}${variantId ? `_${variantId}` : ''}`;
    }

    function rememberThumbnailCache(key, value) {
        if (!key || !value) return value || '';
        thumbnailLruCache.delete(key);
        thumbnailLruCache.set(key, value);
        while (thumbnailLruCache.size > THUMBNAIL_LRU_LIMIT) thumbnailLruCache.delete(thumbnailLruCache.keys().next().value);
        return value;
    }

    async function gmGetValueAsync(key, fallback = null) {
        if (globalThis.GM?.getValue) return globalThis.GM.getValue(key, fallback);
        return GM_getValue(key, fallback);
    }

    async function gmSetValueAsync(key, value) {
        if (globalThis.GM?.setValue) return globalThis.GM.setValue(key, value);
        GM_setValue(key, value);
    }

    async function gmDeleteValueAsync(key) {
        thumbnailLruCache.delete(key);
        if (globalThis.GM?.deleteValue) return globalThis.GM.deleteValue(key);
        GM_deleteValue(key);
    }

    function getStoredThumbnail(key) {
        if (!key) return '';
        const cached = thumbnailLruCache.get(key);
        if (cached) return rememberThumbnailCache(key, cached);
        try {
            const value = GM_getValue(key, '');
            return typeof value === 'string' && value.startsWith('data:image/') ? rememberThumbnailCache(key, value) : '';
        } catch {
            return '';
        }
    }

    async function getStoredThumbnailWithRetry(key) {
        if (!key) return '';
        const cached = thumbnailLruCache.get(key);
        if (cached) return rememberThumbnailCache(key, cached);
        for (const delay of [0, 45, 140]) {
            if (delay) await wait(delay);
            try {
                const value = await gmGetValueAsync(key, '');
                if (typeof value === 'string' && value.startsWith('data:image/')) return rememberThumbnailCache(key, value);
            } catch { /* Retry below. */ }
        }
        return '';
    }

    function ensureItemVariants(item) {
        if (!item) return [];
        if (!Array.isArray(item.variants)) item.variants = [];
        if (!item.variants.length) {
            const variant = normalizeVariant({}, item, item.createdAt || nowIso(), 0);
            item.variants.push(variant);
            item.primaryVariantId = variant.id;
        }
        if (!item.primaryVariantId || !item.variants.some(variant => variant.id === item.primaryVariantId)) item.primaryVariantId = item.variants[0].id;
        return item.variants;
    }

    function syncPrimaryVariantAliases(item) {
        const primary = getPrimaryVariant(item);
        if (!primary) return;
        item.thumbnail = primary.thumbnail;
        item.imageHash = primary.imageHash || primary.thumbnail?.hash || '';
        item.fingerprints = normalizeFingerprints(primary.fingerprints || primary.thumbnail?.fingerprints, item.imageHash);
        item.sources = uniqueNormalizedSources(getItemVariants(item).flatMap(variant => variant.sources || []));
        if (typeof primary.tags === 'string') item.tags = primary.tags;
        if (primary.tagGroups && typeof primary.tagGroups === 'object') item.tagGroups = deepClone(primary.tagGroups);
    }

    function attachThumbnailMetadata(item, thumbnail, targetVariant, key) {
        const variants = ensureItemVariants(item);
        const variant = targetVariant || getPrimaryVariant(item) || variants[0];
        const metadata = {
            key,
            mime: thumbnail.mime || 'image/webp',
            width: Number(thumbnail.width) || 0,
            height: Number(thumbnail.height) || 0,
            sizeBytes: Number(thumbnail.sizeBytes) || estimateDataUrlBytes(thumbnail.dataUrl),
            qualityProfile: String(thumbnail.qualityProfile || data.settings.thumbnailQuality || 'local'),
            encodingQuality: Math.max(0, Math.min(1, Number(thumbnail.encodingQuality) || 0)),
            compressionPasses: Math.max(0, Number(thumbnail.compressionPasses) || 0),
            hash: thumbnail.hash || '',
            fingerprints: normalizeFingerprints(thumbnail.fingerprints, thumbnail.hash),
            createdAt: nowIso()
        };
        if (variant) {
            variant.thumbnail = metadata;
            variant.imageHash = thumbnail.hash || variant.imageHash || '';
            variant.fingerprints = normalizeFingerprints(thumbnail.fingerprints, thumbnail.hash);
            variant.updatedAt = nowIso();
        }
        if (!variant || variant.id === item.primaryVariantId) item.thumbnail = metadata;
        syncPrimaryVariantAliases(item);
        state.thumbnailStats = null;
        return true;
    }

    function isStoredImageValue(value) {
        return typeof value === 'string' && value.startsWith('data:image/') && value.includes(',');
    }

    function thumbnailValueMatches(value, thumbnailOrDataUrl) {
        const expected = typeof thumbnailOrDataUrl === 'string' ? thumbnailOrDataUrl : thumbnailOrDataUrl?.dataUrl;
        return isStoredImageValue(value) && typeof expected === 'string' && value === expected;
    }

    async function writeVerifiedThumbnailValue(key, dataUrl) {
        if (!key || !isStoredImageValue(dataUrl)) throw new Error('No valid local image data was provided');
        let previousValue = '';
        try { previousValue = await gmGetValueAsync(key, ''); }
        catch { /* A missing previous value is harmless. */ }

        try {
            await gmSetValueAsync(key, dataUrl);
            let verified = '';
            for (const delay of [0, 25, 75, 180, 400, 800]) {
                if (delay) await wait(delay);
                try { verified = await gmGetValueAsync(key, ''); }
                catch { verified = ''; }
                if (thumbnailValueMatches(verified, dataUrl)) return verified;

                /*
                 * Tampermonkey's legacy synchronous API can become visible a little
                 * earlier than the Promise API in some Firefox versions. Checking it
                 * as a fallback avoids rejecting a write that has already succeeded.
                 */
                try {
                    const synchronous = GM_getValue(key, '');
                    if (thumbnailValueMatches(synchronous, dataUrl)) return synchronous;
                } catch { /* Continue the bounded retry loop. */ }
            }
            throw new Error('Local image read-back verification failed');
        } catch (error) {
            thumbnailLruCache.delete(key);
            try {
                if (isStoredImageValue(previousValue)) await gmSetValueAsync(key, previousValue);
                else await gmDeleteValueAsync(key);
            } catch (rollbackError) {
                reportDiagnostic('thumbnail-storage-rollback', rollbackError, false, { key });
            }
            throw error;
        }
    }

    async function storeThumbnailForItemAsync(item, thumbnail, targetVariant = null) {
        if (!item || !thumbnail?.dataUrl) return false;
        const variants = ensureItemVariants(item);
        const variant = targetVariant || getPrimaryVariant(item) || variants[0];
        const key = thumbnailStorageKey(item.id, variant?.id || '');
        try {
            const verified = await writeVerifiedThumbnailValue(key, thumbnail.dataUrl);
            rememberThumbnailCache(key, verified);
        } catch (error) {
            console.warn('[Ainz Toolkit] Async thumbnail storage failed:', error);
            toast('The entry was saved, but its local image could not be stored', 'info');
            return false;
        }
        return attachThumbnailMetadata(item, thumbnail, variant, key);
    }

    function removeThumbnailFromItem(item, targetVariant = null) {
        const variant = targetVariant || getPrimaryVariant(item);
        const thumbnail = variant?.thumbnail || item?.thumbnail;
        if (!thumbnail?.key) return false;
        thumbnailLruCache.delete(thumbnail.key);
        try { GM_deleteValue(thumbnail.key); } catch { /* already absent */ }
        if (variant) delete variant.thumbnail;
        if (!variant || variant.id === item.primaryVariantId) delete item.thumbnail;
        item.updatedAt = nowIso();
        syncPrimaryVariantAliases(item);
        state.thumbnailStats = null;
        return true;
    }

    function estimateDataUrlBytes(dataUrl) {
        const raw = String(dataUrl || '');
        const comma = raw.indexOf(',');
        if (comma < 0) return 0;
        const header = raw.slice(0, comma).toLowerCase();
        const body = raw.slice(comma + 1).replace(/\s+/g, '');
        if (!body) return 0;
        if (!header.includes(';base64')) {
            try { return new TextEncoder().encode(decodeURIComponent(body)).byteLength; }
            catch { return body.length; }
        }
        const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.floor(body.length * 3 / 4) - padding);
    }

    function inferredThumbnailFromStoredValue(key, value, fallback = {}) {
        const mime = String(value || '').match(/^data:([^;,]+)/i)?.[1] || fallback.mime || 'image/webp';
        return {
            dataUrl: value,
            mime,
            width: Math.max(0, Number(fallback.width) || 0),
            height: Math.max(0, Number(fallback.height) || 0),
            sizeBytes: estimateDataUrlBytes(value),
            qualityProfile: String(fallback.qualityProfile || data.settings.thumbnailQuality || 'local'),
            encodingQuality: Math.max(0, Math.min(1, Number(fallback.encodingQuality) || 0)),
            compressionPasses: Math.max(0, Number(fallback.compressionPasses) || 0),
            hash: String(fallback.hash || ''),
            fingerprints: normalizeFingerprints(fallback.fingerprints, fallback.hash || '')
        };
    }

    function recoverDetachedThumbnailReferences() {
        const available = new Set(thumbnailKeys());
        if (!available.size) return 0;
        let repaired = 0;

        for (const wrapper of allLibraryWrappers()) {
            const item = wrapper.item;
            for (const variant of getItemVariants(item)) {
                if (variant.thumbnail?.key) continue;
                const key = thumbnailStorageKey(item.id, variant.id || '');
                if (!available.has(key)) continue;
                const value = getStoredThumbnail(key);
                if (!isStoredImageValue(value)) continue;
                attachThumbnailMetadata(item, inferredThumbnailFromStoredValue(key, value, variant.thumbnail || item.thumbnail || {}), variant, key);
                repaired++;
            }
            if (getItemVariants(item).length) syncPrimaryVariantAliases(item);
        }

        for (const image of data.styleImages || []) {
            if (image.thumbnail?.key) continue;
            const key = thumbnailStorageKey('style-image', image.id);
            if (!available.has(key)) continue;
            const value = getStoredThumbnail(key);
            if (!isStoredImageValue(value)) continue;
            const inferred = inferredThumbnailFromStoredValue(key, value, image.thumbnail || {});
            image.thumbnail = {
                key,
                mime: inferred.mime,
                width: inferred.width,
                height: inferred.height,
                sizeBytes: inferred.sizeBytes,
                qualityProfile: inferred.qualityProfile,
                encodingQuality: inferred.encodingQuality,
                compressionPasses: inferred.compressionPasses,
                hash: inferred.hash,
                fingerprints: inferred.fingerprints,
                createdAt: image.updatedAt || image.createdAt || nowIso()
            };
            repaired++;
        }

        if (repaired) {
            state.thumbnailStats = null;
            markDerivedDataDirty(['images','library','styles']);
            console.info(`[Ainz Toolkit] Recovered ${repaired} detached local image reference${repaired === 1 ? '' : 's'}.`);
        }
        return repaired;
    }

    function thumbnailKeys() {
        try {
            const values = GM_listValues();
            return Array.isArray(values) ? values.filter(key => String(key).startsWith(THUMBNAIL_KEY_PREFIX)) : [];
        } catch {
            return [];
        }
    }

    function getThumbnailStats() {
        const wrappers = allLibraryWrappers();
        const records = [];
        let missingWithoutReference = 0;

        for (const wrapper of wrappers) {
            const variants = getItemVariants(wrapper.item);
            if (variants.length) {
                for (const variant of variants) {
                    if (variant.thumbnail?.key) {
                        const normalizedKey = normalizeThumbnailStorageKey(variant.thumbnail.key);
                        if (normalizedKey !== variant.thumbnail.key) variant.thumbnail.key = normalizedKey;
                        records.push({ thumbnail: variant.thumbnail });
                    } else if (variant.sources?.length) {
                        missingWithoutReference++;
                    }
                }
            } else if (wrapper.item.thumbnail?.key) {
                const normalizedKey = normalizeThumbnailStorageKey(wrapper.item.thumbnail.key);
                if (normalizedKey !== wrapper.item.thumbnail.key) wrapper.item.thumbnail.key = normalizedKey;
                records.push({ thumbnail: wrapper.item.thumbnail });
            }
        }

        for (const image of data.styleImages || []) {
            if (!image.thumbnail?.key) continue;
            const normalizedKey = normalizeThumbnailStorageKey(image.thumbnail.key);
            if (normalizedKey !== image.thumbnail.key) image.thumbnail.key = normalizedKey;
            records.push({ thumbnail: image.thumbnail });
        }

        const keys = thumbnailKeys();
        const available = new Set(keys);
        const referenced = new Map();
        for (const record of records) {
            const key = normalizeThumbnailStorageKey(record.thumbnail.key);
            if (!key || referenced.has(key)) continue;
            referenced.set(key, record.thumbnail);
        }

        let bytes = 0;
        let count = 0;
        let missingReferences = 0;
        for (const [key, metadata] of referenced) {
            if (!available.has(key)) {
                missingReferences++;
                continue;
            }
            count++;
            bytes += Number(metadata.sizeBytes) || estimateDataUrlBytes(getStoredThumbnail(key));
        }

        return {
            count,
            bytes,
            missing: missingWithoutReference + missingReferences,
            orphaned: keys.filter(key => !referenced.has(key)).length
        };
    }

    async function runLibraryHealthCheck() {
        state.healthReport = { running: true, issues: [], checked: 0, repairable: 0 };
        state.modal = 'health-check';
        state.modalPayload = {};
        state.open = true;
        render();
        const issues = [];
        const wrappers = allLibraryWrappers();
        const seenIds = new Map();
        const referenced = new Set();
        for (const wrapper of wrappers) {
            const item = wrapper.item;
            const title = item.name || item.label || item.tag || 'Untitled entry';
            const addIssue = issue => issues.push({ ...issue, kind:wrapper.kind, id:item.id || '', variantId:issue.variantRef?.id || '' });
            if (!item.id || typeof item !== 'object') addIssue({ type: 'damagedEntry', title, message: 'Entry is missing a stable ID.', repair: 'entry', itemRef: item });
            if (seenIds.has(item.id)) addIssue({ type: 'duplicateId', title, message: `ID ${item.id} is used by more than one entry.`, repair: 'duplicate-id', itemRef: item });
            else seenIds.set(item.id, item);
            if (wrapper.kind === 'imported' && item.entryType !== 'imported') addIssue({ type: 'entryType', title, message: 'Imported image has an inconsistent entry type.', repair: 'entry-type', itemRef: item });
            const variants = getItemVariants(item);
            if (variants.length && !variants.some(variant => variant.id === item.primaryVariantId)) addIssue({ type: 'invalidPrimary', title, message: 'Primary variant does not point to an existing variant.', repair: 'primary', itemRef: item });
            for (const variant of variants) {
                const validSources = (variant.sources || []).filter(source => BOORU_SITES.includes(source?.site) && (source.postId || source.url));
                if (validSources.length !== (variant.sources || []).length) addIssue({ type: 'invalidSource', title, message: `${(variant.sources || []).length - validSources.length} invalid source record(s).`, repair: 'sources', itemRef: item, variantRef: variant });
                const thumbnail = variant.thumbnail;
                if (!thumbnail?.key) {
                    if (validSources.length) addIssue({ type:'missingThumbnail', title, message:'This source-backed variant has no local image.', repair:'reload-thumbnail', itemRef:item, variantRef:variant });
                    continue;
                }
                referenced.add(thumbnail.key);
                let raw = '';
                try { raw = GM_getValue(thumbnail.key, ''); } catch { /* reported as missing */ }
                if (!raw) { addIssue({ type: 'missingThumbnail', title, message: 'Local image metadata exists, but its stored image is missing.', repair: validSources.length ? 'reload-thumbnail' : 'drop-thumbnail-meta', itemRef: item, variantRef: variant, key: thumbnail.key }); continue; }
                if (typeof raw !== 'string' || !raw.startsWith('data:image/')) { addIssue({ type: 'corruptThumbnail', title, message: 'Stored local image data is not a valid image data URL.', repair: validSources.length ? 'reload-thumbnail' : 'drop-corrupt-thumbnail', itemRef: item, variantRef: variant, key: thumbnail.key }); continue; }
                try { await verifyLocalThumbnailDecode(raw); }
                catch { addIssue({ type: 'corruptThumbnail', title, message: 'Stored local image data cannot be decoded.', repair: validSources.length ? 'reload-thumbnail' : 'drop-corrupt-thumbnail', itemRef: item, variantRef: variant, key: thumbnail.key }); continue; }
                const actualBytes = estimateDataUrlBytes(raw);
                if (Math.abs(actualBytes - (Number(thumbnail.sizeBytes) || 0)) > 16) addIssue({ type: 'metadataMismatch', title, message: `Stored size says ${formatBytes(thumbnail.sizeBytes)}, actual size is ${formatBytes(actualBytes)}.`, repair: 'thumbnail-size', itemRef:item, variantRef:variant, thumbnailRef: thumbnail, actualBytes });
                const fingerprints = normalizeFingerprints(variant.fingerprints || thumbnail.fingerprints, variant.imageHash || thumbnail.hash || '');
                if (!fingerprints.pHash || !fingerprints.edgeHash) addIssue({ type: 'legacyFingerprint', title, message: 'Visual fingerprint can be upgraded from the local image.', repair: 'fingerprint', itemRef: item, variantRef: variant, key: thumbnail.key });
            }
        }
        for (const image of data.styleImages || []) {
            const thumbnail = image.thumbnail;
            if (!thumbnail?.key) continue;
            referenced.add(thumbnail.key);
            let raw = '';
            try { raw = GM_getValue(thumbnail.key, ''); } catch { /* reported below */ }
            if (!raw) issues.push({ type:'missingThumbnail', title:image.filename || 'NovelAI style image', message:'The Style reference still has metadata, but its local image is missing.', repair:'remove-style-image', imageId:image.id, key:thumbnail.key });
            else if (typeof raw !== 'string' || !raw.startsWith('data:image/')) issues.push({ type:'corruptThumbnail', title:image.filename || 'NovelAI style image', message:'The stored Style image is not a valid image data URL.', repair:'remove-style-image', imageId:image.id, key:thumbnail.key });
            else {
                try { await verifyLocalThumbnailDecode(raw); }
                catch { issues.push({ type:'corruptThumbnail', title:image.filename || 'NovelAI style image', message:'The stored Style image cannot be decoded.', repair:'remove-style-image', imageId:image.id, key:thumbnail.key }); }
            }
        }
        for (const key of thumbnailKeys()) if (!referenced.has(key)) issues.push({ type: 'orphanThumbnail', title: key, message: 'Local image data is not referenced by any entry.', repair: 'orphan', key });
        state.healthReport = { running: false, issues, checked: wrappers.length + (data.styleImages || []).length, repairable: issues.filter(issue => issue.repair).length };
        render();
    }

    function prepareHealthRepair() {
        const report = state.healthReport;
        if (!report?.issues?.length) return toast('No health issues are available to repair', 'info');
        const issueTypes = state.healthIssueFilter ? [state.healthIssueFilter] : [];
        const selected = report.issues.filter(issue => issue.repair && (!issueTypes.length || issueTypes.includes(issue.type)));
        if (!selected.length) return toast('No repairable issues are visible', 'info');
        const networkRequests = selected.filter(issue => issue.repair === 'reload-thumbnail').length;
        state.modal = 'confirm';
        state.modalPayload = {
            title:'Repair Library Issues',
            message:`Repair ${selected.length} issue${selected.length === 1 ? '' : 's'} automatically and sequentially?${networkRequests ? ` Up to ${networkRequests} source image request${networkRequests === 1 ? '' : 's'} will be made.` : ' No network requests are required.'}`,
            confirmLabel:`Repair ${selected.length}`,
            action:'health-repair',
            issueTypes
        };
        render();
    }

    async function repairLibraryHealthIssues(issueTypes = []) {
        const report = state.healthReport;
        if (!report?.issues?.length) return;
        const selected = report.issues.filter(issue => issue.repair && (!issueTypes.length || issueTypes.includes(issue.type)));
        const affectedThumbnailKeys = [...new Set(selected.map(issue => issue.key).filter(Boolean))];
        const before = await captureUndoState('Library health repairs', affectedThumbnailKeys, [...selected.map(issue => undoTargetForItem(issue.itemRef, issue.kind || 'imported')).filter(Boolean), ...(selected.some(issue => issue.repair === 'remove-style-image') ? [{ collection:'styleImages' }] : [])]);
        let repaired = 0;
        let failed = 0;
        for (const issue of selected) {
            try {
                if (issue.repair === 'reload-thumbnail') {
                    const source = issue.variantRef?.sources?.find(entry => entry.postId || entry.url);
                    if (!source) throw new Error('No usable source is stored for this variant');
                    const post = await fetchSourcePost(source, true);
                    const thumbnail = await createThumbnailFromPost(post);
                    if (!thumbnail || !await storeThumbnailForItemAsync(issue.itemRef, thumbnail, issue.variantRef)) throw new Error('The replacement local image could not be stored');
                } else if (issue.repair === 'drop-thumbnail-meta' || issue.repair === 'drop-corrupt-thumbnail') {
                    if (issue.key) { thumbnailLruCache.delete(issue.key); GM_deleteValue(issue.key); }
                    if (issue.variantRef) delete issue.variantRef.thumbnail;
                    syncPrimaryVariantAliases(issue.itemRef);
                } else if (issue.repair === 'thumbnail-size') issue.thumbnailRef.sizeBytes = issue.actualBytes;
                else if (issue.repair === 'orphan') { thumbnailLruCache.delete(issue.key); GM_deleteValue(issue.key); }
                else if (issue.repair === 'remove-style-image') {
                    if (issue.key) { thumbnailLruCache.delete(issue.key); GM_deleteValue(issue.key); }
                    data.styleImages = (data.styleImages || []).filter(image => image.id !== issue.imageId);
                }
                else if (issue.repair === 'primary') { issue.itemRef.primaryVariantId = getItemVariants(issue.itemRef)[0]?.id || ''; syncPrimaryVariantAliases(issue.itemRef); }
                else if (issue.repair === 'sources') { issue.variantRef.sources = uniqueNormalizedSources(issue.variantRef.sources).filter(source => BOORU_SITES.includes(source.site) && (source.postId || source.url)); syncPrimaryVariantAliases(issue.itemRef); }
                else if (issue.repair === 'entry-type') issue.itemRef.entryType = 'imported';
                else if (issue.repair === 'entry') issue.itemRef.id ||= uid('entry');
                else if (issue.repair === 'duplicate-id') await repairDuplicateItemId(issue.itemRef);
                else if (issue.repair === 'fingerprint') await upgradeVariantFingerprint(issue.itemRef, issue.variantRef, issue.key);
                else continue;
                issue.itemRef && (issue.itemRef.updatedAt = nowIso());
                repaired++;
            } catch (error) { failed++; reportDiagnostic('health-repair', error, false, { type: issue.type, key: issue.key || '' }); }
        }
        state.thumbnailStats = null;
        scheduleSave('Library health repairs applied');
        await runLibraryHealthCheck();
        registerUndo(before);
        if (!repaired) toast('No issues could be repaired', 'info');
        else if (failed) toast(`${repaired} repaired · ${failed} failed`, 'info');
    }

    async function verifyLocalThumbnailDecode(dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        const image = await decodeImageBlob(blob);
        const valid = Number(image.width || image.naturalWidth) > 0 && Number(image.height || image.naturalHeight) > 0;
        image.close?.();
        if (image.__objectUrl) URL.revokeObjectURL(image.__objectUrl);
        if (!valid) throw new Error('Decoded thumbnail has no dimensions');
        return true;
    }

    async function repairDuplicateItemId(item) {
        const oldId = item.id;
        item.id = uid('entry');
        for (const variant of getItemVariants(item)) {
            const oldKey = variant.thumbnail?.key;
            if (!oldKey) continue;
            const value = getStoredThumbnail(oldKey);
            const newKey = thumbnailStorageKey(item.id, variant.id);
            if (value) GM_setValue(newKey, value);
            variant.thumbnail.key = newKey;
        }
        if (item.thumbnail?.key && getPrimaryVariant(item)?.thumbnail) item.thumbnail = getPrimaryVariant(item).thumbnail;
        data.recent = data.recent.map(record => record.id === oldId ? { ...record, id: item.id } : record);
    }

    async function upgradeVariantFingerprint(item, variant, key) {
        const dataUrl = getStoredThumbnail(key);
        if (!dataUrl) throw new Error('Local thumbnail is unavailable');
        const blob = await (await fetch(dataUrl)).blob();
        const image = await decodeImageBlob(blob);
        const width = Number(image.width || image.naturalWidth) || 0;
        const height = Number(image.height || image.naturalHeight) || 0;
        const fingerprints = createImageFingerprints(image, width, height);
        image.close?.();
        if (image.__objectUrl) URL.revokeObjectURL(image.__objectUrl);
        variant.fingerprints = fingerprints;
        variant.imageHash = fingerprints.dHash;
        if (variant.thumbnail) { variant.thumbnail.hash = fingerprints.dHash; variant.thumbnail.fingerprints = fingerprints; }
        syncPrimaryVariantAliases(item);
    }

    function formatBytes(bytes) {
        const value = Math.max(0, Number(bytes) || 0);
        if (value < 1024) return `${value} B`;
        if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
        return `${(value / 1024 ** 2).toFixed(1)} MB`;
    }

    function hydrateVisibleThumbnails() {
        thumbnailObserver?.disconnect?.();
        const images = [...root.querySelectorAll('img[data-thumbnail-key],img[data-list-image-urls]')];
        const hydrate = async image => {
            if (image.dataset.loaded === 'true') return;
            const stored = image.dataset.thumbnailKey ? await getStoredThumbnailWithRetry(image.dataset.thumbnailKey) : '';
            const candidates = parseImageCandidateDataset(image.dataset.listImageUrls);
            try {
                let loaded = false;
                if (stored) {
                    try {
                        await setImageSource(image, stored);
                        loaded = true;
                        image.dataset.imageMode = 'local';
                        clearImageStateBadge(image);
                    }
                    catch (error) { reportDiagnostic('stored-thumbnail-decode', error, false); }
                }
                if (!loaded && candidates.length) {
                    if (!image.isConnected) return;
                    const result = await runListImageNetworkTask(() => image.isConnected ? loadImageFromCandidates(image, candidates, {
                            directFirst: false,
                            cache: false,
                            retainBlob: true,
                            requestContext: imageRequestContextForElement(image)
                        }) : null);
                    if (!result || !image.isConnected) return;
                    loaded = true;
                    if (result?.blob) {
                        const owner = findLibraryItemById(image.dataset.thumbnailOwnerId);
                        const variant = owner ? findVariant(owner, image.dataset.thumbnailVariantId) : null;
                        try {
                            const thumbnail = await createThumbnailFromBlob(result.blob);
                            if (owner && await storeThumbnailForItemAsync(owner, thumbnail, variant)) {
                                await setImageSource(image, thumbnail.dataUrl);
                                image.dataset.thumbnailKey = variant?.thumbnail?.key || owner.thumbnail?.key || '';
                                image.dataset.imageMode = 'local';
                                clearImageStateBadge(image);
                                scheduleSave('Online fallback cached locally');
                            } else {
                                image.dataset.imageMode = 'web';
                                addImageStateBadge(image, 'WEB');
                            }
                        } catch (error) {
                            image.dataset.imageMode = 'web';
                            addImageStateBadge(image, 'WEB');
                            reportDiagnostic('online-fallback-cache', error, false, { url: result.url, method: result.mode });
                        }
                    } else {
                        image.dataset.imageMode = 'web';
                        addImageStateBadge(image, 'WEB');
                    }
                }
                if (!loaded) throw new Error('No preview URL is stored');
                image.dataset.loaded = 'true';
                image.style.visibility = '';
                image.parentElement?.querySelector('.thumb-placeholder')?.remove();
                if (image.dataset.imageMode === 'local' && image.dataset.nearViewport === 'false') releaseLocalListImage(image);
            } catch (error) {
                reportDiagnostic('list-image', error, false);
                const placeholder = image.parentElement?.querySelector('.thumb-placeholder');
                if (placeholder) placeholder.textContent = image.dataset.thumbnailKey ? 'Local preview missing' : 'Preview unavailable';
                image.dataset.imageMode = 'missing';
                addImageStateBadge(image.parentElement, 'MISSING');
                image.remove();
            }
        };
        if (!('IntersectionObserver' in globalThis)) {
            images.forEach(image => void hydrate(image));
            return;
        }
        thumbnailObserver = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const image = entry.target;
                image.dataset.nearViewport = entry.isIntersecting ? 'true' : 'false';
                if (entry.isIntersecting) {
                    void hydrate(image);
                } else if (image.dataset.loaded === 'true' && image.dataset.imageMode === 'local') {
                    releaseLocalListImage(image);
                }
            }
        }, { root: null, rootMargin: '260px 0px' });
        images.forEach(image => thumbnailObserver.observe(image));
    }

    function releaseLocalListImage(image) {
        if (!image || image.dataset.imageMode !== 'local') return;
        image.removeAttribute('src');
        image.style.visibility = 'hidden';
        image.dataset.loaded = 'false';
        image.dataset.imageMode = 'unloaded';
    }

    function runListImageNetworkTask(task) {
        return new Promise((resolve, reject) => {
            listImageNetworkQueue.push({ task, resolve, reject });
            pumpListImageNetworkQueue();
        });
    }

    function pumpListImageNetworkQueue() {
        while (listImageNetworkActive < 2 && listImageNetworkQueue.length) {
            const job = listImageNetworkQueue.shift();
            listImageNetworkActive++;
            Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
                listImageNetworkActive--;
                pumpListImageNetworkQueue();
            });
        }
    }

    function hydrateDetailImages() {
        detailImageObserver?.disconnect?.();
        const images = [...root.querySelectorAll('img[data-detail-image-urls]')];
        const hydrate = async image => {
            if (image.dataset.loaded === 'true') return;
            const urls = parseImageCandidateDataset(image.dataset.detailImageUrls);
            const stored = image.dataset.detailThumbnailKey ? await getStoredThumbnailWithRetry(image.dataset.detailThumbnailKey) : '';
            if (stored) {
                try {
                    await setImageSource(image, stored);
                    if (!image.isConnected) return;
                    image.dataset.loaded = 'true';
                    image.dataset.imageMode = 'local';
                    clearImageStateBadge(image);
                    image.parentElement?.querySelector('.thumb-placeholder')?.remove();
                    return;
                } catch (error) {
                    reportDiagnostic('detail-local-image-decode', error, false);
                }
            }
            if (!urls.length) {
                image.dataset.imageMode = 'missing';
                image.parentElement?.querySelector('.thumb-placeholder')?.replaceChildren('Local image unavailable');
                addImageStateBadge(image, 'MISSING');
                return;
            }
            try {
                const result = await loadImageFromCandidates(image, urls, {
                    directFirst: false,
                    cache: true,
                    retainBlob: true,
                    requestContext: imageRequestContextForElement(image)
                });
                if (!image.isConnected) return;
                image.dataset.loaded = 'true';
                if (result?.blob && image.dataset.thumbnailOwnerId) {
                    try {
                        const owner = findLibraryItemById(image.dataset.thumbnailOwnerId);
                        const variant = owner ? findVariant(owner, image.dataset.thumbnailVariantId) : null;
                        const thumbnail = await createThumbnailFromBlob(result.blob);
                        if (owner && await storeThumbnailForItemAsync(owner, thumbnail, variant)) {
                            await setImageSource(image, thumbnail.dataUrl);
                            image.dataset.detailThumbnailKey = variant?.thumbnail?.key || owner.thumbnail?.key || '';
                            image.dataset.imageMode = 'local';
                            clearImageStateBadge(image);
                            scheduleSave('Web fallback cached as local image');
                        } else {
                            image.dataset.imageMode = 'web';
                            addImageStateBadge(image, 'WEB');
                        }
                    } catch (error) {
                        image.dataset.imageMode = 'web';
                        addImageStateBadge(image, 'WEB');
                        reportDiagnostic('detail-image-cache', error, false, { url: result.url, method: result.mode });
                    }
                } else {
                    image.dataset.imageMode = 'web';
                    addImageStateBadge(image, 'WEB');
                }
                image.parentElement?.querySelector('.thumb-placeholder')?.remove();
            } catch (error) {
                reportDiagnostic('detail-image', error, false);
                image.dataset.imageMode = 'missing';
                image.parentElement?.querySelector('.thumb-placeholder')?.replaceChildren('Image could not be loaded');
                addImageStateBadge(image, 'MISSING');
            }
        };
        if (!('IntersectionObserver' in globalThis)) return void images.forEach(image => void hydrate(image));
        detailImageObserver = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                void hydrate(entry.target);
                detailImageObserver?.unobserve(entry.target);
            }
        }, { root: root.querySelector('.modal-body'), rootMargin: '160px' });
        images.forEach(image => detailImageObserver.observe(image));
    }

    function parseImageCandidateDataset(value) {
        try {
            const parsed = JSON.parse(String(value || '[]'));
            return Array.isArray(parsed) ? [...new Set(parsed.map(url => absoluteBooruUrl(url)).filter(Boolean))] : [];
        } catch {
            return [];
        }
    }

    function setImageSource(image, source) {
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                image.removeEventListener('load', onload);
                image.removeEventListener('error', onerror);
            };
            const onload = () => { cleanup(); resolve(); };
            const onerror = () => { cleanup(); reject(new Error('Browser image decoding failed')); };
            image.addEventListener('load', onload, { once: true });
            image.addEventListener('error', onerror, { once: true });
            image.src = source;
            if (image.complete && image.naturalWidth > 0) { cleanup(); resolve(); }
        });
    }

    async function loadImageFromCandidates(image, candidates, options = {}) {
        let lastError = null;
        for (const rawUrl of candidates) {
            const url = absoluteBooruUrl(rawUrl);
            if (!url) continue;
            let retainedBlob = null;
            const attempts = options.directFirst ? ['direct', 'blob'] : ['blob', 'direct'];
            for (const attempt of attempts) {
                try {
                    if (attempt === 'direct') {
                        await setImageSource(image, url);
                        return { url, mode: retainedBlob ? 'direct-with-blob' : 'direct', blob: options.retainBlob ? retainedBlob : null };
                    }
                    let objectUrl = options.cache ? detailImageCache.get(url) : '';
                    if (!objectUrl) {
                        const blob = await gmRequestBlob(url, options.requestContext || {});
                        retainedBlob = blob;
                        objectUrl = URL.createObjectURL(blob);
                        if (options.cache) detailImageCache.set(url, objectUrl);
                        if (options.retainBlob) image.__ainzLoadedBlob = blob;
                    }
                    try {
                        await setImageSource(image, objectUrl);
                        if (!options.cache) URL.revokeObjectURL(objectUrl);
                        return { url, mode: 'blob', blob: options.retainBlob ? retainedBlob || image.__ainzLoadedBlob : null };
                    } catch (error) {
                        if (options.cache && detailImageCache.get(url) === objectUrl) detailImageCache.delete(url);
                        URL.revokeObjectURL(objectUrl);
                        throw error;
                    }
                } catch (error) {
                    lastError = error;
                    reportDiagnostic(`image-${attempt}`, error, false, { url, method: attempt });
                }
            }
        }
        throw lastError || new Error('No usable image candidate was available');
    }

    function imageRequestContextForElement(image) {
        const owner = findLibraryItemById(image?.dataset?.thumbnailOwnerId);
        const variant = owner ? findVariant(owner, image?.dataset?.thumbnailVariantId) : null;
        const sources = variant?.sources?.length ? variant.sources : owner?.sources || [];
        const source = sources.find(entry => entry?.site === 'gelbooru') || sources[0] || null;
        return source ? { site: source.site || '', referer: source.url || '' } : {};
    }

    function findLibraryItemById(id) {
        if (!id) return null;
        return allLibraryWrappers().find(wrapper => String(wrapper.item.id) === String(id))?.item || null;
    }

    function addImageStateBadge(target, label) {
        const container = target?.closest?.('.thumb-frame,.detail-image,.compare-pane') || target;
        if (!container || !label) return;
        container.querySelector?.('.image-state-badge')?.remove();
        const badge = document.createElement('span');
        badge.className = 'image-state-badge';
        badge.textContent = label;
        container.appendChild(badge);
    }

    function clearImageStateBadge(target) {
        const container = target?.closest?.('.thumb-frame,.detail-image,.compare-pane') || target;
        container?.querySelector?.('.image-state-badge')?.remove();
    }

    function clearDetailImageCache() {
        detailImageObserver?.disconnect?.();
        for (const url of detailImageCache.values()) {
            try { URL.revokeObjectURL(url); } catch { /* already released */ }
        }
        detailImageCache.clear();
    }

    function restoreTagBrowserScroll() {
        if (state.activeTab !== 'tags') return;
        const list = root.querySelector('#tag-list-scroll');
        const results = root.querySelector('#tag-results-panel');
        if (list) list.scrollTop = Number(state.tagScrollTop) || 0;
        if (results) results.scrollTop = Number(state.tagResultsScrollTop) || 0;
    }

    function confirmRemoveAllThumbnails() {
        const count = getThumbnailStats().count;
        if (!count) return toast('No thumbnails are stored', 'info');
        state.modal = 'confirm';
        state.modalPayload = { title: 'Remove All Thumbnails', message: `Remove all ${count} locally stored thumbnails? Source information and tags remain unchanged.`, confirmLabel: 'Remove All', danger: true, action: 'remove-all-thumbnails' };
        render();
    }

    async function removeOrphanThumbnails() {
        const referenced = new Set(allLibraryWrappers().flatMap(wrapper => {
            const variants = getItemVariants(wrapper.item);
            return variants.length ? variants.map(variant => variant.thumbnail?.key) : [wrapper.item.thumbnail?.key];
        }).filter(Boolean).concat((data.styleImages || []).map(image => image.thumbnail?.key).filter(Boolean)));
        const orphans = thumbnailKeys().filter(key => !referenced.has(key));
        const before = await captureUndoState('Orphaned thumbnails removed', orphans);
        orphans.forEach(key => { thumbnailLruCache.delete(key); GM_deleteValue(key); });
        state.thumbnailStats = null;
        state.openMenu = '';
        render();
        if (orphans.length) registerUndo(before);
        else toast('No orphaned thumbnails were found', 'info');
    }

    async function removeCategoryThumbnails() {
        const category = root.querySelector('#thumbnail-category-name')?.value || '';
        const items = allLibraryWrappers().filter(wrapper => wrapper.item.category === category && (wrapper.item.thumbnail?.key || getItemVariants(wrapper.item).some(variant => variant.thumbnail?.key)));
        const before = await captureUndoState('Category thumbnails removed', items.flatMap(wrapper => itemThumbnailKeys(wrapper.item)), items.map(wrapper => ({ kind:wrapper.kind, id:wrapper.item.id })));
        let removed = 0;
        for (const wrapper of items) {
            const variants = getItemVariants(wrapper.item);
            if (variants.length) {
                for (const variant of variants) if (removeThumbnailFromItem(wrapper.item, variant)) removed++;
            } else if (removeThumbnailFromItem(wrapper.item)) removed++;
        }
        scheduleSave('Category thumbnails removed');
        closeModal();
        if (removed) registerUndo(before);
        else toast('No thumbnails were removed', 'info');
    }

    async function regenerateMissingThumbnails() {
        const missing = allLibraryWrappers().flatMap(wrapper => getItemVariants(wrapper.item)
            .filter(variant => (!variant.thumbnail?.key || !getStoredThumbnail(variant.thumbnail.key)) && variant.sources?.length)
            .map(variant => ({ wrapper, variant })));
        if (!missing.length) return toast('No regeneratable thumbnails are missing', 'info');
        await regenerateThumbnailRecords(missing, 'Missing thumbnails regenerated');
    }

    function confirmRegenerateAllThumbnails() {
        const count = allLibraryWrappers().reduce((total, wrapper) => total + getItemVariants(wrapper.item).filter(variant => variant.sources?.length).length, 0);
        if (!count) return toast('No source-backed thumbnails can be rebuilt', 'info');
        state.modal = 'confirm';
        state.modalPayload = { title: 'Rebuild All Local Images', message: `Download and rebuild ${count} local image${count === 1 ? '' : 's'} using the selected ${data.settings.thumbnailQuality || 'local'} quality? This runs only once after confirmation.`, confirmLabel: 'Rebuild', action: 'regenerate-all-thumbnails' };
        render();
    }

    async function regenerateAllThumbnails() {
        const records = allLibraryWrappers().flatMap(wrapper => getItemVariants(wrapper.item)
            .filter(variant => variant.sources?.length)
            .map(variant => ({ wrapper, variant })));
        await regenerateThumbnailRecords(records, 'All thumbnails rebuilt');
    }

    async function regenerateThumbnailRecords(records, saveReason) {
        if (!records.length) return;
        closeToolkitOverflowMenu();
        toast(`Regenerating ${records.length} thumbnail${records.length === 1 ? '' : 's'} …`, 'info');
        let restored = 0;
        for (const record of records) {
            const { wrapper, variant } = record;
            const source = variant.sources.find(entry => entry.fileUrl || entry.sampleUrl || entry.imageUrl || entry.previewUrl) || variant.sources[0];
            try {
                let refreshed = null;
                try {
                    refreshed = await fetchSourcePost(source, true);
                    mergePostMetadataIntoSource(source, refreshed);
                    variant.image = { ...variant.image, ...postToImageMetadata(refreshed, variant.image || {}) };
                } catch (error) {
                    reportDiagnostic('thumbnail-regeneration-refresh', error, false);
                }
                const post = refreshed || { site: source.site, ...source, ...variant.image };
                const thumbnail = await createThumbnailFromPost(post);
                if (thumbnail && await storeThumbnailForItemAsync(wrapper.item, thumbnail, variant)) restored++;
            } catch (error) {
                reportDiagnostic('thumbnail-regeneration', error, false);
            }
        }
        scheduleSave(saveReason);
        render();
        toast(`${restored}/${records.length} thumbnails regenerated`, restored ? 'success' : 'error');
    }
    function openExportModal(selectedOnly = false) {
        if (selectedOnly && !state.selectedItems.size) return toast('No entries are selected', 'info');
        state.modal = 'export-options';
        state.modalPayload = { selectedOnly };
        state.openMenu = '';
        render();
    }

    async function performExport() {
        const selectedOnly = Boolean(state.modalPayload?.selectedOnly);
        const includeSources = root.querySelector('#export-source-info')?.checked !== false;
        const includeThumbnails = root.querySelector('#export-thumbnails')?.checked !== false;
        const exportData = selectedOnly ? defaultData() : deepClone(data);

        if (selectedOnly) {
            exportData.settings = deepClone(data.settings);
            for (const wrapper of getSelectedWrappers()) getCollectionFromData(exportData, wrapper.kind).push(deepClone(wrapper.item));
            exportData.history = [];
            exportData.recent = [];
        }

        const thumbnails = {};
        for (const wrapper of allLibraryWrappersFromData(exportData)) {
            const item = wrapper.item;
            const variants = getItemVariants(item);
            if (!includeSources) {
                item.sources = [];
                for (const variant of variants) {
                    variant.sources = [];
                    variant.image = {};
                }
            }
            const thumbnailOwners = variants.length ? variants : [item];
            for (const owner of thumbnailOwners) {
                if (includeThumbnails && owner.thumbnail?.key) {
                    const stored = getStoredThumbnail(owner.thumbnail.key);
                    if (stored) thumbnails[owner.thumbnail.key] = stored;
                    else delete owner.thumbnail;
                } else if (!includeThumbnails) {
                    delete owner.thumbnail;
                }
            }
            const primary = variants.find(variant => variant.id === item.primaryVariantId) || variants[0];
            item.thumbnail = includeThumbnails ? primary?.thumbnail || item.thumbnail : undefined;
        }
        for (const image of exportData.styleImages || []) {
            if (includeThumbnails && image.thumbnail?.key) {
                const stored = getStoredThumbnail(image.thumbnail.key);
                if (stored) thumbnails[image.thumbnail.key] = stored;
                else delete image.thumbnail;
            } else if (!includeThumbnails) delete image.thumbnail;
        }

        const exportObject = {
            application: 'Ainz Toolkit',
            exportedAt: nowIso(),
            scriptVersion: SCRIPT_VERSION,
            schemaVersion: SCHEMA_VERSION,
            options: { includesSourceInformation: includeSources, includesThumbnails: includeThumbnails },
            data: exportData,
            thumbnails: includeThumbnails ? thumbnails : {}
        };
        const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Ainz-Toolkit-Export_${new Date().toISOString().slice(0, 10)}.json`;
        document.documentElement.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        closeModal();
        toast(`JSON export created${selectedOnly ? ' for selected entries' : ''}`, 'success');
    }

    function getCollectionFromData(targetData, kind) {
        if (kind === 'character') return targetData.characters;
        if (kind === 'set' || kind === 'imported') return targetData.sets;
        if (kind === 'base') return targetData.bases;
        if (kind === 'style') return targetData.styleArtists;
        if (kind === 'fullImage') return targetData.fullImages;
        return targetData.favoriteTags;
    }

    function allLibraryWrappersFromData(targetData) {
        return [
            ...targetData.characters.map(item => ({ kind: 'character', item })),
            ...targetData.sets.map(item => ({ kind: isImportedItem(item) ? 'imported' : 'set', item })),
            ...targetData.bases.map(item => ({ kind: 'base', item })),
            ...targetData.styleArtists.map(item => ({ kind: 'style', item })),
            ...targetData.fullImages.map(item => ({ kind: 'fullImage', item })),
            ...targetData.favoriteTags.map(item => ({ kind: 'tag', item }))
        ];
    }

    function openImportModal() {
        state.modal = 'import-data';
        state.importPreview = null;
        render();
    }

    function pickImportFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const parsed = JSON.parse(await file.text());
                const imported = normalizeData(parsed.data || parsed);
                const thumbnails = parsed.thumbnails && typeof parsed.thumbnails === 'object' ? parsed.thumbnails : {};
                state.importPreview = { filename: file.name, data: imported, thumbnails };
                render();
            } catch (error) {
                console.error('[Ainz Toolkit] Import validation failed:', error);
                toast('This file is not a valid Ainz Toolkit export', 'error');
            }
        }, { once: true });
        input.click();
    }

    async function performImport() {
        if (!state.importPreview) return;
        const mode = root.querySelector('#import-mode')?.value || 'merge';
        const imported = state.importPreview.data;
        const importedThumbnails = state.importPreview.thumbnails || {};

        if (mode === 'replace') {
            data = normalizeData(imported);
        } else {
            const importedIdMap = new Map();
            data.characters = mergeCollections(data.characters, imported.characters, 'name', importedIdMap, 'character');
            data.sets = mergeCollections(data.sets, imported.sets, 'name', importedIdMap, item => isImportedItem(item) ? 'imported' : 'set');
            data.bases = mergeCollections(data.bases, imported.bases, 'name', importedIdMap, 'base');
            data.styleArtists = mergeCollections(data.styleArtists, imported.styleArtists, 'name', importedIdMap, 'style');
            data.styleImages = mergeCollections(data.styleImages || [], imported.styleImages || [], 'filename');
            data.styleFavorites = [...new Set([...(data.styleFavorites || []), ...(imported.styleFavorites || [])])];
            data.fullImages = mergeCollections(data.fullImages, imported.fullImages, 'name', importedIdMap, 'fullImage');
            data.favoriteTags = mergeCollections(data.favoriteTags, imported.favoriteTags, 'tag', importedIdMap, 'tag');
            const remappedCollections = (imported.collections || []).map(collection => {
                const result = deepClone(collection);
                for (const key of ['itemRefs', 'alwaysInclude', 'excluded']) result[key] = (result[key] || []).map(ref => ({ ...ref, id: importedIdMap.get(`${ref.kind}:${ref.id}`) || ref.id }));
                return result;
            });
            data.collections = mergeCollections(data.collections || [], remappedCollections, 'name').map(normalizeCollectionDefinition);
            data.history = mergeCollections(data.history, imported.history, 'signature').slice(0, Math.max(5, Number(data.settings.maxHistory) || 50));
            data.settings = { ...data.settings, ...imported.settings };
        }

        for (const [key, value] of Object.entries(importedThumbnails)) {
            if (!String(key).startsWith(THUMBNAIL_KEY_PREFIX) || typeof value !== 'string' || !value.startsWith('data:image/')) continue;
            await gmSetValueAsync(key, value);
            rememberThumbnailCache(key, value);
        }

        transactionalReplaceData(data, `JSON import (${mode})`);
        usageState = loadUsageState(data);
        applyUsageState(data, usageState);
        flushUsageState();
        dataRevision++;
        markDerivedDataDirty(['library','tags','images','styles','collections']);
        closeModal();
        render();
        toast('Import completed', 'success');
    }

    function mergeCollections(current, incoming, nameKey, idMap = null, kindResolver = '') {
        const result = deepClone(current);
        const ids = new Map(result.map((item, index) => [item.id, index]));
        const names = new Set(result.map(item => String(item[nameKey] || item.name || item.label || '').toLowerCase()));

        for (const source of incoming || []) {
            const item = deepClone(source);
            const originalId = String(item.id || '');
            const resolvedKind = typeof kindResolver === 'function' ? kindResolver(source) : kindResolver;
            if (item.id && ids.has(item.id)) {
                result[ids.get(item.id)] = item;
                if (idMap && resolvedKind && originalId) idMap.set(`${resolvedKind}:${originalId}`, String(item.id));
                continue;
            }
            let key = String(item[nameKey] || item.name || item.label || '').toLowerCase();
            if (key && names.has(key)) {
                if (item.name) item.name = uniqueImportedName(item.name, names);
                else if (item.label) item.label = uniqueImportedName(item.label, names);
                item.id = uid('import');
                key = String(item[nameKey] || item.name || item.label || '').toLowerCase();
            }
            if (!item.id) item.id = uid('import');
            result.push(item);
            if (idMap && resolvedKind && originalId) idMap.set(`${resolvedKind}:${originalId}`, String(item.id));
            if (key) names.add(key);
        }
        return result;
    }

    function uniqueImportedName(name, occupied) {
        let number = 2;
        let candidate = `${name} (Imported)`;
        while (occupied.has(candidate.toLowerCase())) candidate = `${name} (Imported ${number++})`;
        return candidate;
    }

    function confirmResetData() {
        state.modal = 'confirm';
        state.modalPayload = { title: 'Reset Ainz Toolkit', message: 'Delete all character profiles, sets, base profiles, styles, full images, tags, history and settings?', confirmLabel: 'Delete Everything', danger: true, action: 'reset-data' };
        render();
    }

    async function performConfirmedAction() {
        const payload = state.modalPayload || {};
        if (payload.action === 'health-repair') {
            const issueTypes = Array.isArray(payload.issueTypes) ? payload.issueTypes : [];
            closeModal();
            await repairLibraryHealthIssues(issueTypes);
            return;
        }
        if (payload.action === 'replace-item') {
            const { kind, id, variantId } = payload;
            closeModal();
            await applyItem(kind, id, true, null, variantId || '');
            return;
        }
        if (payload.action === 'replace-full-image') {
            const { id, parts } = payload;
            closeModal();
            await applyItem('fullImage', id, true, new Set(Array.isArray(parts) ? parts : []));
            return;
        }
        if (payload.action === 'delete-item') {
            const collection = getCollection(payload.kind);
            const index = collection.findIndex(item => item.id === payload.id);
            const before = await captureUndoState('Entry deleted', index >= 0 ? itemThumbnailKeys(collection[index]) : [], [{ kind:payload.kind, id:payload.id }]);
            if (index >= 0) {
                removeAllItemThumbnails(collection[index]);
                collection.splice(index, 1);
            }
            data.recent = data.recent.filter(record => !(record.kind === payload.kind && record.id === payload.id));
            for (const collection of data.collections || []) {
                collection.itemRefs = (collection.itemRefs || []).filter(ref => !(ref.kind === payload.kind && ref.id === payload.id));
                collection.alwaysInclude = (collection.alwaysInclude || []).filter(ref => !(ref.kind === payload.kind && ref.id === payload.id));
                collection.excluded = (collection.excluded || []).filter(ref => !(ref.kind === payload.kind && ref.id === payload.id));
            }
            scheduleSave(`${kindLabel(payload.kind)} deleted`);
            closeModal();
            render();
            toast('Entry deleted', 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'remove-item-sources') {
            const item = findItem(payload.kind, payload.id);
            const before = await captureUndoState('Source information removed', [], [{ kind:payload.kind, id:payload.id }]);
            if (item) {
                const variant = findVariant(item, payload.variantId);
                if (variant) variant.sources = [];
                item.sources = uniqueNormalizedSources(getItemVariants(item).flatMap(entry => entry.sources || []));
                item.updatedAt = nowIso();
                scheduleSave('Source information removed');
            }
            closeModal();
            toast('Source information removed', 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'remove-item-thumbnail') {
            const item = findItem(payload.kind, payload.id);
            const variant = item ? findVariant(item, payload.variantId) : null;
            const before = await captureUndoState('Thumbnail removed', [variant?.thumbnail?.key || item?.thumbnail?.key].filter(Boolean), [{ kind:payload.kind, id:payload.id }]);
            if (item) {
                removeThumbnailFromItem(item, variant);
                scheduleSave('Thumbnail removed');
            }
            closeModal();
            toast('Thumbnail removed', 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'bulk-remove-sources') {
            const selected = getSelectedWrappers();
            const before = await captureUndoState('Source information removed', [], selected.map(wrapper => ({ kind:wrapper.kind, id:wrapper.item.id })));
            selected.forEach(wrapper => {
                wrapper.item.sources = [];
                getItemVariants(wrapper.item).forEach(variant => { variant.sources = []; });
                wrapper.item.updatedAt = nowIso();
            });
            scheduleSave('Selected source information removed');
            closeModal();
            exitSelectionMode();
            toast(`Source information removed from ${selected.length} entries`, 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'bulk-delete') {
            const selected = getSelectedWrappers();
            const before = await captureUndoState('Entries deleted', selected.flatMap(wrapper => itemThumbnailKeys(wrapper.item)), selected.map(wrapper => ({ kind:wrapper.kind, id:wrapper.item.id })));
            for (const wrapper of selected) {
                removeAllItemThumbnails(wrapper.item);
                const collection = getCollection(wrapper.kind);
                const index = collection.findIndex(item => item.id === wrapper.item.id);
                if (index >= 0) collection.splice(index, 1);
                data.recent = data.recent.filter(record => !(record.kind === wrapper.kind && record.id === wrapper.item.id));
                for (const collectionRecord of data.collections || []) {
                    collectionRecord.itemRefs = (collectionRecord.itemRefs || []).filter(ref => !(ref.kind === wrapper.kind && ref.id === wrapper.item.id));
                    collectionRecord.alwaysInclude = (collectionRecord.alwaysInclude || []).filter(ref => !(ref.kind === wrapper.kind && ref.id === wrapper.item.id));
                    collectionRecord.excluded = (collectionRecord.excluded || []).filter(ref => !(ref.kind === wrapper.kind && ref.id === wrapper.item.id));
                }
            }
            scheduleSave('Selected entries deleted');
            closeModal();
            exitSelectionMode();
            toast(`${selected.length} entries deleted`, 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'delete-collection') {
            const before = await captureUndoState('Collection deleted', [], [{ collection:'collections' }]);
            data.collections = (data.collections || []).filter(collection => collection.id !== payload.id);
            if (state.activeCollectionId === payload.id) { state.activeCollectionId = ''; state.collectionPath = []; }
            scheduleSave('Collection deleted');
            closeModal();
            render();
            toast('Collection deleted; library entries were kept', 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'remove-all-thumbnails') {
            const before = await captureUndoState('All thumbnails removed', thumbnailKeys(), [...allLibraryWrappers().map(wrapper => ({ kind:wrapper.kind, id:wrapper.item.id })), { collection:'styleImages' }]);
            allLibraryWrappers().forEach(wrapper => removeAllItemThumbnails(wrapper.item));
            for (const image of data.styleImages || []) delete image.thumbnail;
            thumbnailKeys().forEach(key => { thumbnailLruCache.delete(key); GM_deleteValue(key); });
            state.thumbnailStats = null;
            scheduleSave('All thumbnails removed');
            closeModal();
            toast('All thumbnails removed', 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'regenerate-all-thumbnails') {
            closeModal();
            await regenerateAllThumbnails();
            return;
        }
        if (payload.action === 'remove-current-variant') {
            const item = findItem(payload.kind, payload.id);
            const targetVariant = item ? findVariant(item, payload.variantId) : null;
            const before = await captureUndoState('Image variant removed', [targetVariant?.thumbnail?.key].filter(Boolean), [{ kind:payload.kind, id:payload.id }]);
            if (item) {
                const variants = getItemVariants(item);
                const index = variants.findIndex(variant => variant.id === payload.variantId);
                if (index >= 0 && variants.length > 1) {
                    removeThumbnailFromItem(item, variants[index]);
                    variants.splice(index, 1);
                    if (item.primaryVariantId === payload.variantId) item.primaryVariantId = variants[0].id;
                    syncPrimaryVariantAliases(item);
                    item.updatedAt = nowIso();
                    scheduleSave('Image variant removed');
                }
            }
            closeModal();
            toast('Variant removed', 'success');
            registerUndo(before);
            return;
        }
        if (payload.action === 'clear-history') {
            const before = await captureUndoState('History cleared', [], [{ collection:'history' }]);
            data.history = [];
            scheduleSave('History cleared');
            closeModal();
            render();
            registerUndo(before);
            return;
        }
        if (payload.action === 'reset-data') {
            thumbnailKeys().forEach(key => { thumbnailLruCache.delete(key); GM_deleteValue(key); });
            const resetData = defaultData();
            transactionalReplaceData(resetData, 'Ainz Toolkit reset');
            usageState = { entries: {}, recent: [] };
            flushUsageState();
            state.thumbnailStats = null;
            dataRevision++;
            markDerivedDataDirty(['library','tags','images','styles','collections','settings']);
            closeModal();
            render();
            toast('Ainz Toolkit data reset', 'success');
        }
    }

    function closeModal() {
        if (state.modal === 'source-tag-diff' && state.modalReturn?.modal === 'item-details') return restoreReturnedDetail();
        clearDetailImageCache();
        state.modal = null;
        state.modalPayload = null;
        state.importPreview = null;
        state.booruImportThumbnail = null;
        state.collectionPickerQuery = '';
        state.collectionPickerSelection = new Set();
        state.modalReturn = null;
        state.openMenu = '';
        render();
    }

    function restoreReturnedDetail() {
        const record = state.modalReturn;
        if (!record) return closeModal();
        state.modalReturn = null;
        clearDetailImageCache();
        state.modal = 'item-details';
        state.modalPayload = deepClone(record.payload || {});
        state.detailVariantId = record.detailVariantId || state.detailVariantId;
        state.pendingContentScroll = Number(record.contentScroll) || 0;
        state.openMenu = '';
        render();
        const body = root.querySelector('.modal-body');
        if (body) body.scrollTop = Number(record.modalScroll) || 0;
    }
    async function checkSourceTags(sourceIndex = 0) {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        if (!item) return;
        if (payload.kind !== 'imported') return toast('Source tag updates are available for imported image entries', 'info');
        const variant = findVariant(item, state.detailVariantId);
        const variantSources = variant?.sources?.length ? variant.sources : (item.sources || []);
        const indexes = sourceIndex === 'all' ? variantSources.map((_source, index) => index) : [sourceIndex];
        const sources = indexes.map(index => variantSources[index]).filter(Boolean);
        if (!sources.length) return toast('No usable source is stored', 'error');
        rememberCurrentViewState();
        state.modalReturn = {
            modal: 'item-details', payload: deepClone(payload), detailVariantId: state.detailVariantId,
            contentScroll: root.querySelector('.content')?.scrollTop || 0,
            modalScroll: root.querySelector('.modal-body')?.scrollTop || 0
        };
        toast(`Checking ${sources.length} source${sources.length === 1 ? '' : 's'} …`, 'info');
        try {
            const fetched = [];
            for (let offset = 0; offset < sources.length; offset++) {
                const source = sources[offset];
                const post = await fetchSourcePost(source, true);
                fetched.push({ post, sourceIndex: indexes[offset] });
            }
            const remoteGroups = compactGroups(fetched.reduce((result, record) => {
                for (const [group, tags] of Object.entries(cleanBooruGroups(record.post.groups || {}, record.post.site))) result[group] = [...(result[group] || []), ...tags];
                return result;
            }, {}));
            const remoteTags = [...new Set(Object.values(remoteGroups).flat())];
            const currentTags = splitPrompt(variant?.tags || item.tags || '');
            const remoteMap = new Map(remoteTags.map(tag => [canonicalTag(tag), tag]));
            const currentMap = new Map(currentTags.map(tag => [canonicalTag(tag), tag]));
            const added = [...remoteMap].filter(([key]) => !currentMap.has(key)).map(([, tag]) => tag);
            const removed = [...currentMap].filter(([key]) => !remoteMap.has(key)).map(([, tag]) => tag);
            const unchanged = [...remoteMap].filter(([key]) => currentMap.has(key)).map(([, tag]) => tag);
            const metadataChanges = collectSourceMetadataChanges(sources[0], fetched[0]?.post);
            state.modal = 'source-tag-diff';
            state.modalPayload = { kind: payload.kind, id: item.id, variantId: variant?.id || '', sourceIndexes: indexes, fetchedPosts: fetched.map(record => ({ sourceIndex: record.sourceIndex, post: record.post })), remoteGroups, metadataChanges, diff: { added, removed, unchanged } };
            render();
        } catch (error) {
            console.error('[Ainz Toolkit] Source refresh failed:', error);
            const site = sources[0]?.site || '';
            toast(`Source could not be checked: ${friendlyRequestError(error, site)}`, 'error');
        }
    }

    async function applySourceTagDiff() {
        const payload = state.modalPayload || {};
        const item = findItem(payload.kind, payload.id);
        if (!item || payload.kind !== 'imported') return closeModal();
        const before = await captureUndoState('Source tag changes applied', [], [{ kind:payload.kind, id:payload.id }]);
        const selectedAdded = new Set([...root.querySelectorAll('[data-diff-kind="added"]:checked')].map(input => canonicalTag(input.dataset.diffTag)));
        const selectedRemoved = new Set([...root.querySelectorAll('[data-diff-kind="removed"]:checked')].map(input => canonicalTag(input.dataset.diffTag)));
        const variant = findVariant(item, payload.variantId);
        const tags = splitPrompt(variant?.tags || item.tags || '').filter(tag => !selectedRemoved.has(canonicalTag(tag)));
        const existing = new Set(tags.map(canonicalTag));
        for (const tag of payload.diff?.added || []) {
            const key = canonicalTag(tag);
            if (selectedAdded.has(key) && !existing.has(key)) {
                tags.push(tag);
                existing.add(key);
            }
        }
        item.updatedAt = nowIso();
        const applyMetadata = root.querySelector('#apply-source-metadata')?.checked !== false;
        const sources = variant?.sources?.length ? variant.sources : item.sources;
        for (const record of payload.fetchedPosts || []) {
            const source = sources?.[record.sourceIndex];
            if (!source) continue;
            source.tagGroups = compactGroups(cleanBooruGroups(record.post.groups || {}, record.post.site));
            if (applyMetadata) mergePostMetadataIntoSource(source, record.post);
            source.lastCheckedAt = nowIso();
        }
        if (variant) {
            setVariantManualTags(variant, tags.join(', '));
            refreshVariantEffectiveTags(variant);
        }
        if (!variant || variant.id === item.primaryVariantId) {
            item.tags = variant?.tags || tags.join(', ');
            item.tagGroups = deepClone(variant?.tagGroups || reconcileTagGroups(tags, payload.remoteGroups || {}, item.tagGroups || {}));
        }
        if (variant && applyMetadata && payload.fetchedPosts?.[0]?.post) variant.image = { ...variant.image, ...postToImageMetadata(payload.fetchedPosts[0].post, variant.image || {}) };
        syncPrimaryVariantAliases(item);
        scheduleSave('Source tag differences applied');
        restoreReturnedDetail();
        registerUndo(before);
    }

    function collectSourceMetadataChanges(source, post) {
        if (!source || !post) return [];
        const fields = [
            ['fileUrl', 'Direct image'], ['originalSourceUrl', 'Artist source'], ['width', 'Width'], ['height', 'Height'], ['fileSize', 'File size'],
            ['fileExt', 'Format'], ['md5', 'File hash'], ['parentId', 'Parent post'], ['uploadedAt', 'Upload date'], ['sourceUpdatedAt', 'Source update date']
        ];
        return fields.map(([key, label]) => {
            const remote = post[key];
            if (remote === undefined || remote === null || remote === '' || remote === 0) return null;
            const before = key === 'fileSize' && source[key] ? formatBytes(source[key]) : String(source[key] || '');
            const after = key === 'fileSize' ? formatBytes(remote) : String(remote);
            return before !== after ? { key, label, before, after } : null;
        }).filter(Boolean);
    }

    function reconcileTagGroups(tags, remoteGroups, existingGroups) {
        const result = {};
        const groupByTag = new Map();
        for (const [group, values] of Object.entries(existingGroups || {})) for (const tag of values || []) groupByTag.set(canonicalTag(tag), group);
        for (const [group, values] of Object.entries(remoteGroups || {})) for (const tag of values || []) groupByTag.set(canonicalTag(tag), group);
        for (const tag of tags || []) (result[groupByTag.get(canonicalTag(tag)) || 'general'] ||= []).push(tag);
        return compactGroups(result);
    }

    async function fetchSourcePost(source, force = false) {
        const cacheKey = `${String(source?.site || '').toLowerCase()}:${String(source?.postId || '')}`;
        const cached = sourcePostCache.get(cacheKey);
        if (!force && cached && Date.now() - cached.at < 2 * 60 * 1000) return deepClone(cached.post);
        const post = await fetchSourcePostUncached(source);
        sourcePostCache.set(cacheKey, { at: Date.now(), post: deepClone(post) });
        if (sourcePostCache.size > 250) sourcePostCache.delete(sourcePostCache.keys().next().value);
        return post;
    }

    async function fetchSourcePostUncached(source) {
        const site = String(source?.site || '').toLowerCase();
        const postId = encodeURIComponent(String(source?.postId || ''));
        if (!postId) throw new Error('The source has no post ID');
        try {
            return await fetchSourcePostApi(site, postId, source);
        } catch (apiError) {
            reportDiagnostic(`${site}-api-fallback`, apiError, false);
            try { return await fetchSourcePostHtmlFallback({ ...source, site, postId: decodeURIComponent(postId) }); }
            catch (htmlError) {
                reportDiagnostic(`${site}-html-fallback`, htmlError, false);
                throw apiError;
            }
        }
    }

    async function fetchSourcePostApi(site, postId, fallbackSource = null) {
        if (site === 'danbooru') {
            const json = await gmRequestJson(`https://danbooru.donmai.us/posts/${postId}.json`);
            return normalizeBooruPost({
                site, postId, url: `https://danbooru.donmai.us/posts/${postId}`,
                groups: compactGroups({
                    artist: words(json.tag_string_artist), copyright: words(json.tag_string_copyright),
                    character: words(json.tag_string_character), general: words(json.tag_string_general),
                    meta: words(json.tag_string_meta)
                }),
                imageUrl: json.preview_file_url || json.large_file_url || json.file_url || '', previewUrl: json.preview_file_url || '', sampleUrl: json.large_file_url || '', fileUrl: json.file_url || '',
                width: json.image_width, height: json.image_height, fileSize: json.file_size, fileExt: json.file_ext, md5: json.md5,
                originalSourceUrl: json.source, rating: json.rating, parentId: json.parent_id, childIds: [], uploadedAt: json.created_at, sourceUpdatedAt: json.updated_at,
                artist: words(json.tag_string_artist)
            }, site, postId, `https://danbooru.donmai.us/posts/${postId}`);
        }
        if (site === 'e621') {
            const json = await gmRequestJson(`https://e621.net/posts/${postId}.json`, { 'User-Agent': `AinzToolkit/${SCRIPT_VERSION}` });
            const post = json.post || json;
            const tags = post.tags || {};
            return normalizeBooruPost({
                site, postId, url: `https://e621.net/posts/${postId}`,
                groups: compactGroups({ artist: tags.artist || [], copyright: tags.copyright || [], character: tags.character || [], species: tags.species || [], general: tags.general || [], meta: tags.meta || [], lore: tags.lore || [] }),
                imageUrl: post.preview?.url || post.sample?.url || post.file?.url || '', previewUrl: post.preview?.url || '', sampleUrl: post.sample?.url || '', fileUrl: post.file?.url || '',
                width: post.file?.width, height: post.file?.height, fileSize: post.file?.size, fileExt: post.file?.ext, md5: post.file?.md5,
                originalSourceUrl: Array.isArray(post.sources) ? post.sources[0] || '' : '', rating: post.rating, parentId: post.relationships?.parent_id,
                childIds: post.relationships?.children || [], uploadedAt: post.created_at, sourceUpdatedAt: post.updated_at, artist: tags.artist || []
            }, site, postId, `https://e621.net/posts/${postId}`);
        }
        if (site === 'gelbooru') {
            const endpoint = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&id=${encodeURIComponent(postId)}`;
            const json = await gmRequestJson(endpoint);
            const record = Array.isArray(json) ? json[0] : json.post?.[0] || json.post || json;
            if (!record) throw new Error('The Gelbooru post no longer exists');
            const metadata = normalizeGelbooruApiRecord(record, fallbackSource || {});
            return normalizeBooruPost({ site, postId, url: `https://gelbooru.com/index.php?page=post&s=view&id=${postId}`, groups: compactGroups({ general: words(metadata.tags) }),
                imageUrl: metadata.previewUrl || metadata.sampleUrl || metadata.fileUrl || fallbackSource?.imageUrl || '', previewUrl: metadata.previewUrl, sampleUrl: metadata.sampleUrl, fileUrl: metadata.fileUrl,
                width: metadata.width, height: metadata.height, fileSize: metadata.fileSize, fileExt: metadata.fileExt, md5: metadata.md5,
                originalSourceUrl: metadata.originalSourceUrl, rating: metadata.rating, parentId: metadata.parentId, childIds: metadata.childIds, uploadedAt: metadata.uploadedAt, sourceUpdatedAt: metadata.sourceUpdatedAt
            }, site, postId, `https://gelbooru.com/index.php?page=post&s=view&id=${postId}`);
        }
        throw new Error(`Unsupported source: ${site || 'unknown'}`);
    }

    async function fetchSourcePostHtmlFallback(source) {
        const site = String(source?.site || '').toLowerCase();
        const postId = String(source?.postId || '');
        const pageUrl = source?.url || ({
            danbooru: `https://danbooru.donmai.us/posts/${postId}`,
            e621: `https://e621.net/posts/${postId}`,
            gelbooru: `https://gelbooru.com/index.php?page=post&s=view&id=${postId}`
        })[site];
        if (!pageUrl) throw new Error('No source page URL is stored');
        const html = await gmRequestText(pageUrl);
        const documentCopy = new DOMParser().parseFromString(html, 'text/html');
        const groups = {};
        const selector = site === 'gelbooru'
            ? '#tag-list li[class*="tag-type-"] a[href*="tags="],#tag-list li[class*="category-"] a[href*="tags="],#tag-list a.search-tag[href*="tags="]'
            : '#tag-list a.search-tag,#tag-list li[class*="tag-type-"] a[href*="tags="],.tag-list a.search-tag';
        for (const anchor of documentCopy.querySelectorAll(selector)) {
            const tag = extractTagFromHtmlAnchor(anchor, pageUrl);
            if (!tag || !isPlausibleBooruTag(tag)) continue;
            const group = inferBooruGroup(anchor);
            (groups[group] ||= []).push(tag);
        }
        if (!Object.keys(groups).length) throw new Error('The public post page contained no readable tags');
        const displayed = documentCopy.querySelector('#image,#image-container img,.post-content img,article img,video[poster]');
        const originalLink = documentCopy.querySelector('#image-link[href],a[href*="/data/"],a[href*="/images/"]');
        const metaImage = documentCopy.querySelector('meta[property="og:image"],meta[name="twitter:image"]');
        const sampleUrl = absoluteBooruUrl(displayed?.getAttribute('src') || displayed?.getAttribute('poster') || metaImage?.getAttribute('content') || '', site);
        const fileUrl = absoluteBooruUrl(originalLink?.getAttribute('href') || '', site);
        return normalizeBooruPost({
            site, postId, url: pageUrl, groups: compactGroups(groups), imageUrl: sampleUrl || fileUrl,
            previewUrl: absoluteBooruUrl(metaImage?.getAttribute('content') || '', site), sampleUrl, fileUrl,
            artist: groups.artist || []
        }, site, postId, pageUrl);
    }

    function extractTagFromHtmlAnchor(anchor, baseUrl) {
        let tag = anchor.dataset?.tagName || anchor.dataset?.tag || '';
        try {
            const url = new URL(anchor.getAttribute('href') || '', baseUrl);
            const queryTag = url.searchParams.get('tags') || '';
            if (queryTag && !/[\s,+]/.test(queryTag.trim()) && !/^[~-]/.test(queryTag.trim())) tag = queryTag.trim();
        } catch { /* fall back to visible text */ }
        if (!tag) tag = anchor.textContent || '';
        return normalizeBooruTag(String(tag).replace(/^[-+?]+/, '').trim());
    }

    async function gmRequestJson(url, headers = {}) {
        let lastError = null;
        const strategies = [
            { Accept: 'application/json,text/plain;q=0.9,*/*;q=0.5', ...headers },
            { ...requestHeadersForUrl(url, false), ...headers }
        ];
        for (let strategy = 0; strategy < strategies.length; strategy++) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try { return await gmRequestJsonOnce(url, strategies[strategy]); }
                catch (error) {
                    lastError = error;
                    reportDiagnostic('source-json-request', error, false, { url, method: strategy ? 'site-headers' : 'minimal-headers' });
                    if (/HTTP (?:401|403|404)/.test(error.message) || attempt === 1) break;
                    await wait(350 * (attempt + 1));
                }
            }
        }
        throw lastError || new Error('Network request failed');
    }

    function gmRequestJsonOnce(url, headers = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url, headers, responseType: 'json', timeout: 20000,
                onload: response => {
                    if (response.status < 200 || response.status >= 300) {
                        const error = new Error(`HTTP ${response.status}`);
                        error.status = response.status;
                        return reject(error);
                    }
                    try {
                        const raw = response.response ?? response.responseText;
                        const value = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw;
                        resolve(value);
                    } catch (error) { reject(error); }
                },
                onerror: () => reject(new Error('Network request failed')),
                ontimeout: () => reject(new Error('Network request timed out'))
            });
        });
    }

    function gmRequestText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url, headers: { ...requestHeadersForUrl(url, false), Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.6' }, responseType: 'text', timeout: 20000,
                onload: response => {
                    if (response.status < 200 || response.status >= 300) {
                        const error = new Error(`HTTP ${response.status}`);
                        error.status = response.status;
                        return reject(error);
                    }
                    const value = String(response.responseText ?? response.response ?? '');
                    if (!value) return reject(new Error('The source page response was empty'));
                    resolve(value);
                },
                onerror: () => reject(new Error('Source page download failed')),
                ontimeout: () => reject(new Error('Source page download timed out'))
            });
        });
    }

    // -------------------- Booru Import --------------------
    function siteDisplayName() {
        return ({ danbooru: 'Danbooru', gelbooru: 'Gelbooru', e621: 'e621' })[SITE] || SITE;
    }

    function getBooruAdapter(site = SITE) {
        const adapters = {
            danbooru: {
                label: 'Danbooru',
                postId: () => location.pathname.match(/\/posts\/(\d+)/)?.[1] || '',
                fetchCurrent: fetchDanbooruPost,
                tagSelector: '#tag-list a.search-tag, #tag-list li[class*="tag-type-"] a[href*="tags="]',
                listingSelector: 'article.post-preview, article[data-id], .post-preview'
            },
            gelbooru: {
                label: 'Gelbooru',
                postId: () => new URL(location.href).searchParams.get('id') || '',
                fetchCurrent: fetchGelbooruPost,
                tagSelector: '#tag-list li[class*="tag-type-"] a[href*="tags="], #tag-list li[class*="category-"] a[href*="tags="], #tag-list a.search-tag[href*="tags="]',
                listingSelector: '.thumbnail-preview, article.thumbnail-preview, .thumbnail-container, .thumb'
            },
            e621: {
                label: 'e621',
                postId: () => location.pathname.match(/\/posts\/(\d+)/)?.[1] || '',
                fetchCurrent: fetchE621Post,
                tagSelector: '#tag-list a.search-tag, #tag-list a[href*="/posts?tags="], #tag-list a[href*="tags="], .tag-list a.search-tag, .tag-list a[href*="tags="]',
                listingSelector: 'article.post-preview, article[data-id], .post-preview'
            }
        };
        return adapters[site] || null;
    }

    function getPostId() {
        return getBooruAdapter()?.postId?.() || '';
    }

    async function loadBooruPost(notify = true) {
        const postId = getPostId();
        if (!postId) {
            state.booruPost = null;
            if (notify) toast('No post ID was found on this page', 'error');
            render();
            return;
        }

        state.booruLoading = true;
        render();
        try {
            const adapter = getBooruAdapter();
            const post = await adapter.fetchCurrent(postId);
            if (!post || !countPostTags(post)) throw new Error('The API returned no tags');
            state.booruPost = post;
            if (notify) toast(`${countPostTags(post)} tags loaded`, 'success');
        } catch (error) {
            console.warn('[Ainz Toolkit] API import failed, using DOM fallback:', error);
            const fallback = scrapeBooruDom(postId);
            if (countPostTags(fallback)) {
                state.booruPost = fallback;
                if (notify) toast(`${countPostTags(fallback)} tags read from the page`, 'success');
            } else {
                state.booruPost = null;
                if (notify) toast('Tags could not be loaded', 'error');
            }
        } finally {
            state.booruLoading = false;
            installBooruToolbar();
            render();
        }
    }

    async function fetchDanbooruPost(postId) {
        const response = await fetch(`/posts/${postId}.json`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Danbooru HTTP ${response.status}`);
        const json = await response.json();
        return normalizeBooruPost({
            site: SITE,
            postId: String(postId),
            url: location.href,
            imageUrl: json.preview_file_url || json.large_file_url || json.file_url || '',
            previewUrl: json.preview_file_url || '',
            sampleUrl: json.large_file_url || '',
            fileUrl: json.file_url || '',
            width: json.image_width,
            height: json.image_height,
            fileSize: json.file_size,
            fileExt: json.file_ext,
            md5: json.md5,
            originalSourceUrl: json.source,
            rating: json.rating,
            parentId: json.parent_id,
            childIds: [],
            uploadedAt: json.created_at,
            sourceUpdatedAt: json.updated_at,
            artist: words(json.tag_string_artist),
            groups: compactGroups({
                general: words(json.tag_string_general),
                character: words(json.tag_string_character),
                copyright: words(json.tag_string_copyright),
                artist: words(json.tag_string_artist),
                meta: words(json.tag_string_meta)
            })
        }, SITE, postId, location.href);
    }

    async function fetchE621Post(postId) {
        const response = await fetch(`/posts/${postId}.json`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`e621 HTTP ${response.status}`);
        const json = await response.json();
        const apiPost = json.post || json;
        const tags = apiPost.tags || {};
        return normalizeBooruPost({
            site: SITE,
            postId: String(postId),
            url: location.href,
            imageUrl: apiPost.preview?.url || apiPost.sample?.url || apiPost.file?.url || '',
            previewUrl: apiPost.preview?.url || '',
            sampleUrl: apiPost.sample?.url || '',
            fileUrl: apiPost.file?.url || '',
            width: apiPost.file?.width,
            height: apiPost.file?.height,
            fileSize: apiPost.file?.size,
            fileExt: apiPost.file?.ext,
            md5: apiPost.file?.md5,
            originalSourceUrl: Array.isArray(apiPost.sources) ? apiPost.sources[0] || '' : '',
            rating: apiPost.rating,
            parentId: apiPost.relationships?.parent_id,
            childIds: apiPost.relationships?.children || [],
            uploadedAt: apiPost.created_at,
            sourceUpdatedAt: apiPost.updated_at,
            artist: tags.artist || [],
            groups: compactGroups({
                general: tags.general || [],
                species: tags.species || [],
                character: tags.character || [],
                copyright: tags.copyright || [],
                artist: tags.artist || [],
                lore: tags.lore || [],
                meta: tags.meta || [],
                invalid: tags.invalid || []
            })
        }, SITE, postId, location.href);
    }

    function normalizeGelbooruApiRecord(record, fallback = {}) {
        const raw = record && typeof record === 'object' ? record : {};
        const fileUrl = raw.file_url || raw.fileUrl || fallback.fileUrl || '';
        const sampleUrl = raw.sample_url || raw.sampleUrl || fallback.sampleUrl || fallback.imageUrl || '';
        const previewUrl = raw.preview_url || raw.previewUrl || fallback.previewUrl || '';
        const extensionMatch = String(fileUrl || sampleUrl || previewUrl).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
        return {
            tags: raw.tags || raw.tag_string || '',
            previewUrl,
            sampleUrl,
            fileUrl,
            width: Number(raw.width || raw.image_width || raw.file_width || fallback.width) || 0,
            height: Number(raw.height || raw.image_height || raw.file_height || fallback.height) || 0,
            fileSize: Number(raw.file_size || raw.filesize || raw.size || fallback.fileSize) || 0,
            fileExt: String(raw.file_ext || raw.extension || extensionMatch?.[1] || fallback.fileExt || '').toLowerCase(),
            md5: String(raw.md5 || raw.hash || fallback.md5 || '').toLowerCase(),
            originalSourceUrl: String(raw.source || raw.source_url || fallback.originalSourceUrl || ''),
            rating: String(raw.rating || fallback.rating || ''),
            parentId: String(raw.parent_id || raw.parent || fallback.parentId || ''),
            childIds: Array.isArray(raw.children) ? raw.children.map(String) : (fallback.childIds || []),
            uploadedAt: raw.created_at || raw.createdAt || raw.date || fallback.uploadedAt || '',
            sourceUpdatedAt: raw.change || raw.updated_at || raw.updatedAt || fallback.sourceUpdatedAt || ''
        };
    }

    async function fetchGelbooruPost(postId) {
        const endpoint = `/index.php?page=dapi&s=post&q=index&json=1&id=${encodeURIComponent(postId)}`;
        const response = await fetch(endpoint, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Gelbooru HTTP ${response.status}`);
        const json = await response.json();
        const record = Array.isArray(json) ? json[0] : Array.isArray(json.post) ? json.post[0] : json.post || json;
        if (!record) throw new Error('No Gelbooru post was returned');

        const dom = scrapeBooruDom(postId);
        const metadata = normalizeGelbooruApiRecord(record, dom);
        const apiGeneral = words(metadata.tags).filter(isPlausibleBooruTag);
        const groups = countPostTags(dom) ? { ...dom.groups } : {};
        groups.general = [...new Set([...(groups.general || []), ...apiGeneral])];
        return normalizeBooruPost({ site: SITE, postId: String(postId), url: location.href,
            imageUrl: metadata.previewUrl || metadata.sampleUrl || metadata.fileUrl || dom.imageUrl || '', previewUrl: metadata.previewUrl, sampleUrl: metadata.sampleUrl, fileUrl: metadata.fileUrl,
            width: metadata.width, height: metadata.height, fileSize: metadata.fileSize, fileExt: metadata.fileExt, md5: metadata.md5, originalSourceUrl: metadata.originalSourceUrl,
            rating: metadata.rating, parentId: metadata.parentId, childIds: metadata.childIds, uploadedAt: metadata.uploadedAt, sourceUpdatedAt: metadata.sourceUpdatedAt,
            groups: compactGroups(groups), artist: groups.artist || []
        }, SITE, postId, location.href);
    }

    function normalizeBooruPost(post, site = post?.site || SITE, postId = post?.postId || '', url = post?.url || '') {
        const groups = compactGroups(post?.groups || {});
        return {
            ...post,
            site,
            postId: String(postId || ''),
            url: absoluteBooruUrl(url, site),
            imageUrl: absoluteBooruUrl(post?.imageUrl || post?.sampleUrl || post?.previewUrl || post?.fileUrl || '', site),
            previewUrl: absoluteBooruUrl(post?.previewUrl || '', site),
            sampleUrl: absoluteBooruUrl(post?.sampleUrl || '', site),
            fileUrl: absoluteBooruUrl(post?.fileUrl || '', site),
            width: Math.max(0, Number(post?.width) || 0),
            height: Math.max(0, Number(post?.height) || 0),
            fileSize: Math.max(0, Number(post?.fileSize) || 0),
            fileExt: String(post?.fileExt || '').toLowerCase(),
            md5: String(post?.md5 || '').toLowerCase(),
            originalSourceUrl: String(post?.originalSourceUrl || ''),
            rating: String(post?.rating || ''),
            parentId: String(post?.parentId || ''),
            childIds: (Array.isArray(post?.childIds) ? post.childIds : []).map(String),
            uploadedAt: post?.uploadedAt || '',
            sourceUpdatedAt: post?.sourceUpdatedAt || '',
            artist: Array.isArray(post?.artist) ? post.artist.map(String) : words(post?.artist || ''),
            groups
        };
    }

    function postToSource(post) {
        const site = post?.site || SITE;
        return normalizeSource({ ...post, tagGroups: cleanBooruGroups(post?.groups || {}, site, 'import'), importedAt: nowIso() });
    }

    function postToImageMetadata(post, fallback = {}) {
        const pick = (value, previous = '') => value !== undefined && value !== null && value !== '' && value !== 0 ? value : previous;
        return {
            previewUrl: pick(post?.previewUrl, fallback.previewUrl || ''),
            sampleUrl: pick(post?.sampleUrl || post?.imageUrl, fallback.sampleUrl || ''),
            fileUrl: pick(post?.fileUrl, fallback.fileUrl || ''),
            width: Number(pick(Number(post?.width) || 0, Number(fallback.width) || 0)) || 0,
            height: Number(pick(Number(post?.height) || 0, Number(fallback.height) || 0)) || 0,
            fileSize: Number(pick(Number(post?.fileSize) || 0, Number(fallback.fileSize) || 0)) || 0,
            fileExt: String(pick(post?.fileExt, fallback.fileExt || '') || '').toLowerCase(),
            md5: String(pick(post?.md5, fallback.md5 || '') || '').toLowerCase(),
            originalSourceUrl: String(pick(post?.originalSourceUrl, fallback.originalSourceUrl || '') || ''),
            rating: String(pick(post?.rating, fallback.rating || '') || ''),
            parentId: String(pick(post?.parentId, fallback.parentId || '') || ''),
            childIds: Array.isArray(post?.childIds) && post.childIds.length ? post.childIds.map(String) : (fallback.childIds || []),
            uploadedAt: pick(post?.uploadedAt, fallback.uploadedAt || ''),
            sourceUpdatedAt: pick(post?.sourceUpdatedAt, fallback.sourceUpdatedAt || ''),
            artist: Array.isArray(post?.artist) && post.artist.length ? post.artist.map(String) : (fallback.artist || [])
        };
    }

    function mergePostMetadataIntoSource(source, post) {
        if (!source || !post) return source;
        const meaningful = postToImageMetadata(post, source);
        const normalized = normalizeSource({
            ...source,
            ...meaningful,
            imageUrl: meaningful.sampleUrl || meaningful.previewUrl || meaningful.fileUrl || source.imageUrl || '',
            tagGroups: cleanBooruGroups(post.groups || source.tagGroups || {}, post.site || source.site || SITE, 'import'),
            importedAt: source.importedAt || nowIso(),
            lastCheckedAt: source.lastCheckedAt || ''
        });
        if (normalized) Object.assign(source, normalized);
        return source;
    }

    function words(value) {
        if (Array.isArray(value)) return value.map(String).filter(Boolean);
        return String(value || '').split(/\s+/).map(tag => tag.trim()).filter(Boolean);
    }

    function compactGroups(groups) {
        const result = {};
        for (const [group, tags] of Object.entries(groups || {})) {
            const values = Array.isArray(tags) ? tags : [tags];
            const unique = [...new Set(values.flatMap(value => splitPrompt(value))
                .map(tag => String(tag || '').trim().replace(/^_+|_+$/g, '').trim())
                .filter(Boolean))];
            if (unique.length) result[group] = unique;
        }
        return result;
    }

    function isTextRelatedTag(tag) {
        const normalized = normalizeBooruTag(tag);
        return TEXT_TAGS.has(normalized) || TEXT_TAG_PATTERNS.some(pattern => pattern.test(normalized));
    }

    function categorizeTextGroups(groups) {
        const result = {};
        for (const [group, tags] of Object.entries(groups || {})) {
            for (const tag of tags || []) {
                const target = isTextRelatedTag(tag) ? 'text' : group;
                (result[target] ||= []).push(tag);
            }
        }
        return compactGroups(result);
    }

    function cleanBooruGroups(groups, site = SITE, mode = 'import') {
        const result = {};
        const profile = getBooruProfile(site);
        const enabledGroups = mode === 'copy' ? profile.copyGroups : profile.includeGroups;
        for (const [group, tags] of Object.entries(categorizeTextGroups(groups || {}))) {
            if (!enabledGroups.includes(group)) continue;
            for (const rawTag of tags) {
                const filtered = filterImportedTag(rawTag, site);
                if (filtered.keep) (result[group] ||= []).push(filtered.tag);
            }
        }
        return compactGroups(result);
    }

    function scrapeBooruDom(postId) {
        const groups = {};
        const selectors = SITE === 'gelbooru'
            ? '#tag-list li[class*="tag-type-"] a[href*="tags="], #tag-list li[class*="category-"] a[href*="tags="], #tag-list a.search-tag[href*="tags="]'
            : '#tag-list li[class*="tag-type-"] a[href*="tags="], #tag-list li[class*="category-"] a[href*="tags="], #tag-list a.search-tag, .tag-list li[class*="tag-type-"] a.search-tag';
        const anchors = [...document.querySelectorAll(selectors)];
        for (const anchor of anchors) {
            const raw = extractTagFromAnchor(anchor);
            if (!raw || !isPlausibleBooruTag(raw)) continue;
            const group = inferBooruGroup(anchor);
            (groups[group] ||= []).push(raw);
        }
        const image = document.querySelector('#image, #image-container img, #gelcomVideoPlayer, video source, article img, .post-content img');
        const imageUrl = image?.currentSrc || image?.src || image?.getAttribute?.('src') || '';
        return { site: SITE, postId: String(postId), url: location.href, imageUrl, groups: compactGroups(groups) };
    }

    function extractTagFromAnchor(anchor) {
        const href = anchor.getAttribute('href') || '';
        let tag = '';
        try {
            const url = new URL(href, location.href);
            const queryTag = url.searchParams.get('tags') || '';
            if (queryTag && !/[\s,+]/.test(queryTag.trim()) && !/^[~-]/.test(queryTag.trim())) tag = queryTag.trim();
        } catch { /* ignore malformed links */ }
        if (!tag) tag = anchor.dataset.tagName || anchor.dataset.tag || '';
        if (!tag && anchor.matches('a.search-tag, a[href*="tags="]')) tag = anchor.textContent || '';
        tag = String(tag).replace(/^[-+?]+/, '').replace(/\s+/g, ' ').trim();
        if (!tag || /^\d+$/.test(tag) || ['?', '+', '-', 'wiki', 'edit'].includes(tag.toLowerCase())) return '';
        if (!isPlausibleBooruTag(tag)) return '';
        return normalizeBooruTag(tag);
    }

    function isPlausibleBooruTag(tag) {
        const value = String(tag || '').trim();
        if (!value || value.length > 180 || URLISH_RE.test(value)) return false;
        if (/[/\\]/.test(value) || /^https?:/i.test(value) || /@/.test(value)) return false;
        const normalized = normalizeBooruTag(value);
        if (!normalized || NON_PROMPT_METADATA_TAGS.has(normalized)) return false;
        return /^[\p{L}\p{N}_\-.'():!]+$/u.test(normalized);
    }

    function inferBooruGroup(anchor) {
        const parent = anchor.closest('li,ul,div');
        const classes = `${anchor.className || ''} ${parent?.className || ''}`.toLowerCase();
        const categoryMap = [
            ['artist', /artist|tag-type-1|category-1/],
            ['copyright', /copyright|tag-type-3|category-3/],
            ['character', /character|tag-type-4|category-4/],
            ['species', /species/],
            ['lore', /lore/],
            ['meta', /meta|tag-type-5|category-5/],
            ['invalid', /invalid/]
        ];
        for (const [group, pattern] of categoryMap) if (pattern.test(classes)) return group;
        const heading = parent?.querySelector?.('h3,h4,strong')?.textContent?.toLowerCase() || '';
        for (const key of Object.keys(CATEGORY_LABELS)) if (heading.includes(key)) return key;
        return 'general';
    }

    function countPostTags(post) {
        return post ? Object.values(post.groups || {}).reduce((sum, tags) => sum + tags.length, 0) : 0;
    }

    function isCensorshipTag(tag) {
        const normalized = normalizeBooruTag(tag);
        if (!normalized || normalized === 'uncensored') return false;
        return CENSOR_EXACT.has(normalized)
            || /(^|_)(?:censor|censored|censoring|censorship)(?:$|_)/i.test(normalized)
            || /(^|_)(?:bar|black_bar|white_bar|mosaic|pixel|pixelated|pixelation|identity|blank|light|steam|object|foreground|out_of_frame|convenient)_(?:censor|censored|censoring)(?:$|_)/i.test(normalized)
            || /(^|_)(?:censor|censored|censoring)_(?:bar|mosaic|pixel|pixelated|identity|face|eyes|nipples|breasts|genitalia|genitals|penis|vulva|pussy|anus)(?:$|_)/i.test(normalized)
            || /(^|_)(?:mosaic|pixel|pixelated|pixelation)_(?:genitalia|genitals|penis|vulva|pussy|anus|nipples|breasts)(?:$|_)/i.test(normalized)
            || /(^|_)(?:genitalia|genitals|penis|vulva|pussy|anus|nipples|breasts)_(?:mosaic|pixel|pixelated|pixelation)(?:$|_)/i.test(normalized);
    }

    function filterImportedTag(tag, site = SITE) {
        const raw = String(tag || '').trim();
        const normalized = normalizeBooruTag(raw);
        if (!normalized) return { keep: false, reason: 'Empty' };
        if (URLISH_RE.test(raw) || URLISH_RE.test(normalized) || !isPlausibleBooruTag(normalized)) return { keep: false, reason: 'Invalid / source metadata' };
        if (normalized === 'uncensored') return { keep: true, tag: 'uncensored', sourceTag: normalized };

        const profile = getBooruProfile(site);
        if (isCensorshipTag(normalized) && !profile.includeCensorshipTags) return { keep: false, reason: 'Censorship' };
        if (data.settings.filterTechnicalTags && TECHNICAL_TAGS.has(normalized)) return { keep: false, reason: 'Technical' };
        if (NON_PROMPT_METADATA_TAGS.has(normalized)) return { keep: false, reason: 'Source metadata' };
        return { keep: true, tag: profile.tagFormat === 'underscores' ? normalized : normalized.replace(/_/g, ' '), sourceTag: normalized };
    }

    function normalizeBooruTag(tag) {
        return String(tag || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
    }

    function prepareBooruSelection() {
        const keptGroups = {};
        const removed = [];
        const selected = new Set();
        const profile = getBooruProfile(SITE);
        for (const [group, tags] of Object.entries(categorizeTextGroups(state.booruPost?.groups || {}))) {
            if (!profile.includeGroups.includes(group)) {
                for (const tag of tags || []) removed.push({ tag: normalizeBooruTag(tag), reason: 'Import profile' });
                continue;
            }
            for (const rawTag of tags) {
                const result = filterImportedTag(rawTag, SITE);
                if (!result.keep) {
                    removed.push({ tag: normalizeBooruTag(rawTag), reason: result.reason });
                    continue;
                }
                (keptGroups[group] ||= []).push(result.tag);
                selected.add(result.tag);
            }
        }
        state.booruPreviewGroups = compactGroups(keptGroups);
        state.booruPreviewSelection = selected;
        state.booruRemoved = removed;
    }

    function openBooruImport() {
        if (!state.booruPost) {
            void loadBooruPost(true).then(() => { if (state.booruPost) openBooruImport(); });
            return;
        }
        prepareBooruSelection();
        state.booruDraft = {
            name: suggestBooruName(state.booruPost),
            category: 'Imported',
            favorite: false,
            saveSource: state.booruDraft.saveSource !== false,
            saveThumbnail: state.booruDraft.saveThumbnail !== false
        };
        state.modal = 'booru-import';
        state.modalPayload = null;
        state.booruImportThumbnail = null;
        state.open = true;
        render();
        const expectedPostId = String(state.booruPost.postId || '');
        void createThumbnailFromPost(state.booruPost).then(thumbnail => {
            if (state.modal !== 'booru-import' || String(state.booruPost?.postId || '') !== expectedPostId) return;
            state.booruImportThumbnail = thumbnail;
            render();
        }).catch(error => reportDiagnostic('import-preview-thumbnail', error, false));
    }

    function booruSelectAll() {
        state.booruPreviewSelection = new Set(Object.values(state.booruPreviewGroups).flat());
        render();
    }

    function booruSelectNone() {
        state.booruPreviewSelection.clear();
        render();
    }

    function toggleBooruTag(tag) {
        if (state.booruPreviewSelection.has(tag)) state.booruPreviewSelection.delete(tag);
        else state.booruPreviewSelection.add(tag);
        render();
    }

    function toggleBooruGroup(group) {
        if (state.collapsedGroups.has(group)) state.collapsedGroups.delete(group);
        else state.collapsedGroups.add(group);
        render();
    }

    async function buildBooruCandidateFromPost(post, options = {}) {
        const groups = cleanBooruGroups(post.groups || {}, post.site || SITE);
        const tags = [...new Set(Object.values(groups).flat())];
        if (!tags.length) throw new Error('No tags remain after applying the import profile');
        const source = postToSource(post);
        const variantId = uid('variant');
        const suggestedName = suggestBooruName({ ...post, groups });
        const name = options.name || suggestedName;
        const variant = {
            id: variantId, label: `${sourceSiteLabel(post.site)} #${post.postId}`, createdAt: nowIso(), updatedAt: nowIso(),
            sources: options.saveSource === false ? [] : [source], tags: tags.join(', '), tagGroups: groups,
            image: options.saveSource === false ? {} : postToImageMetadata(post), imageHash: ''
        };
        const item = {
            id: uid('set'), name, nameMode: name === suggestedName ? 'auto' : 'manual', nameTemplate: data.settings.importNameTemplate, type: 'positive', tags: tags.join(', '), category: options.category || 'Imported', entryType: 'imported', notes: '', favorite: false,
            sources: options.saveSource === false ? [] : [source], tagGroups: groups, variants: [variant], primaryVariantId: variantId,
            createdAt: nowIso(), updatedAt: nowIso(), lastUsed: '', usageCount: 0
        };
        const candidate = { item, variant, source, post, saveSource: options.saveSource !== false, saveThumbnail: options.saveThumbnail !== false, thumbnail: null, thumbnailDataUrl: '' };
        if (options.createThumbnail !== false) {
            try {
                candidate.thumbnail = await createThumbnailFromPost(post);
                candidate.thumbnailDataUrl = candidate.thumbnail?.dataUrl || '';
                variant.imageHash = candidate.thumbnail?.hash || '';
            } catch (error) {
                reportDiagnostic('batch-thumbnail', error, false);
            }
        }
        return candidate;
    }

    async function prepareBooruBatch() {
        const ids = [...state.booruSelectedPosts].slice(0, 100);
        if (!ids.length || state.operationBusy) return;
        state.operationBusy = true;
        state.booruBatchQueue = [];
        toast(`Preparing ${ids.length} selected post${ids.length === 1 ? '' : 's'} …`, 'info');
        try {
            for (let index = 0; index < ids.length; index++) {
                const postId = ids[index];
                state.booruBatchProgress = { current: index + 1, total: ids.length };
                try {
                    const post = await fetchSourcePost({ site: SITE, postId });
                    const candidate = await buildBooruCandidateFromPost(post, { saveSource: true, saveThumbnail: true });
                    let match = findSourceDuplicate(candidate.source);
                    if (match) match = { ...match, matchType: 'source' };
                    else match = findRelatedVariantCandidate(candidate);
                    state.booruBatchQueue.push({ postId, post, candidate, match, action: match ? 'skip' : 'import' });
                } catch (error) {
                    state.booruBatchQueue.push({ postId, error: error.message || String(error) });
                    reportDiagnostic('batch-import', error, false);
                }
                if (index < ids.length - 1) await wait(Math.max(100, Number(data.settings.batchImportDelay) || 350));
            }
            state.modal = 'booru-batch-import';
            state.modalPayload = {};
            state.open = true;
            render();
        } finally {
            state.operationBusy = false;
            state.booruBatchProgress = null;
        }
    }

    async function performBooruBatch() {
        if (state.operationBusy) return;
        state.operationBusy = true;
        const saveSource = root.querySelector('#batch-save-source')?.checked !== false;
        const saveThumbnail = root.querySelector('#batch-save-thumbnail')?.checked !== false;
        let saved = 0;
        let skipped = 0;
        try {
            for (const record of state.booruBatchQueue) {
                if (!record.candidate || record.error || record.action === 'skip') { skipped++; continue; }
                const candidate = record.candidate;
                candidate.saveSource = saveSource;
                candidate.saveThumbnail = saveThumbnail;
                candidate.variant.sources = saveSource ? [candidate.source] : [];
                candidate.variant.image = saveSource ? postToImageMetadata(candidate.post) : {};
                candidate.item.sources = saveSource ? [candidate.source] : [];
                if (record.action === 'source' && !saveSource) { skipped++; continue; }
                if (record.action === 'import' || !record.match) {
                    await commitBooruCandidate(candidate, { silent: true, keepModal: true });
                    saved++;
                } else if (await applyCandidateToExisting(candidate, record.match, record.action)) saved++;
            }
            scheduleSave('Booru batch import completed');
            state.booruSelectionMode = false;
            state.booruSelectedPosts.clear();
            state.booruBatchQueue = [];
            closeModal();
            state.activeTab = 'imported';
            state.open = true;
            syncBooruPageEnhancements();
            render();
            toast(`${saved} imported · ${skipped} skipped`, saved ? 'success' : 'info');
        } finally {
            state.operationBusy = false;
        }
    }

    async function applyCandidateToExisting(candidate, match, mode) {
        const existing = findItem(match.kind, match.item.id);
        if (!existing) return false;
        const existingVariant = findVariant(existing, match.variantId);
        if (mode === 'source') {
            if (!existingVariant || existingVariant.sources.some(source => sourceIdentityMatches(source, candidate.source))) return false;
            if (candidate.saveSource) existingVariant.sources.push(normalizeSource(candidate.source));
            if (!existingVariant.thumbnail?.key && candidate.saveThumbnail && candidate.thumbnail) await storeThumbnailForItemAsync(existing, candidate.thumbnail, existingVariant);
        } else if (mode === 'variant') {
            const variant = deepClone(candidate.variant);
            ensureItemVariants(existing).push(variant);
            if (candidate.saveThumbnail && candidate.thumbnail) await storeThumbnailForItemAsync(existing, candidate.thumbnail, variant);
        } else return false;
        existing.updatedAt = nowIso();
        syncPrimaryVariantAliases(existing);
        return true;
    }

    async function saveCurrentBooruAs(kind) {
        if (!state.booruPost) await loadBooruPost(true);
        if (!state.booruPost) return;
        const groups = cleanBooruGroups(state.booruPost.groups, SITE);
        const tags = [...new Set(Object.values(groups).flat())].join(', ');
        const source = postToSource(state.booruPost);
        const variantId = uid('variant');
        const variant = { id: variantId, label: `${sourceSiteLabel(SITE)} #${source.postId}`, sources: [source], tags, tagGroups: groups, image: postToImageMetadata(state.booruPost), imageHash: '', createdAt: nowIso(), updatedAt: nowIso() };
        const common = { name: suggestBooruName({ ...state.booruPost, groups }), category: 'Imported', notes: `Source: ${sourceSiteLabel(SITE)} #${source.postId}`, favorite: false, sources: [source], variants: [variant], primaryVariantId: variantId };
        const prefill = kind === 'character'
            ? { ...common, positive: tags, negative: '', naiCharacterType: 'female' }
            : { ...common, basePositive: tags, baseNegative: '', characters: [] };
        state.open = true;
        openEditModal(kind, null, prefill);
    }

    function openAttachSourceModal() {
        const open = () => { state.modal = 'attach-source'; state.modalPayload = {}; state.open = true; render(); };
        if (state.booruPost) open();
        else void loadBooruPost(true).then(() => { if (state.booruPost) open(); });
    }

    async function confirmAttachSource() {
        const value = root.querySelector('#attach-source-entry')?.value || '';
        const separator = value.indexOf(':');
        const kind = separator > 0 ? value.slice(0, separator) : '';
        const id = separator > 0 ? value.slice(separator + 1) : '';
        const existing = findItem(kind, id);
        if (!existing || !state.booruPost) return;
        try {
            const candidate = await buildBooruCandidateFromPost(state.booruPost, { saveSource: true, saveThumbnail: state.booruDraft.saveThumbnail });
            const mode = root.querySelector('#attach-source-mode')?.value || 'variant';
            const match = { kind, item: existing, variantId: getPrimaryVariant(existing)?.id || '' };
            if (!await applyCandidateToExisting(candidate, match, mode)) throw new Error('The selected source is already attached');
            scheduleSave('Current Booru post attached');
            closeModal();
            toast(mode === 'variant' ? 'Post added as a variant' : 'Post added as another source', 'success');
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    async function searchCurrentPostSimilar() {
        if (!state.booruPost) await loadBooruPost(true);
        if (!state.booruPost) return;
        toast('Comparing the current image …', 'info');
        try {
            const candidate = await buildBooruCandidateFromPost(state.booruPost, { saveSource: true, saveThumbnail: false });
            const match = findRelatedVariantCandidate(candidate);
            if (!match) return toast('No similar saved image was found', 'info');
            state.open = true;
            openItemDetails(match.kind, match.item.id);
            state.detailVariantId = match.variantId || state.detailVariantId;
            render();
            toast(`Possible match found: ${match.reasons?.join(', ') || 'visual similarity'}`, 'success');
        } catch (error) {
            toast(`Similarity check failed: ${error.message}`, 'error');
        }
    }

    async function saveBooruSet() {
        const suggestedName = suggestBooruName({ ...state.booruPost, groups: state.booruPreviewGroups });
        const name = state.booruDraft.name.trim() || suggestedName;
        const category = state.booruDraft.category.trim() || 'Imported';
        const favorite = Boolean(state.booruDraft.favorite);
        const selected = [...state.booruPreviewSelection];
        if (!selected.length) return toast('No tags selected', 'error');

        const tagGroups = {};
        for (const [group, tags] of Object.entries(state.booruPreviewGroups)) {
            const chosen = tags.filter(tag => state.booruPreviewSelection.has(tag));
            if (chosen.length) tagGroups[group] = chosen;
        }

        if (state.operationBusy) return toast('Another import operation is still running', 'info');
        state.operationBusy = true;
        try {
        const source = postToSource(state.booruPost);
        const variantId = uid('variant');
        const variant = {
            id: variantId,
            label: `${siteDisplayName()} #${state.booruPost.postId || 'import'}`,
            createdAt: nowIso(), updatedAt: nowIso(),
            sources: state.booruDraft.saveSource ? [source] : [],
            tags: selected.join(', '),
            tagGroups: data.settings.keepBooruGroups ? tagGroups : {},
            image: state.booruDraft.saveSource ? postToImageMetadata(state.booruPost) : {},
            imageHash: ''
        };
        const item = {
            id: uid('set'), name, nameMode: name === suggestedName ? 'auto' : 'manual', nameTemplate: data.settings.importNameTemplate, type: 'positive', tags: selected.join(', '), category, entryType: 'imported',
            notes: '',
            favorite,
            sources: state.booruDraft.saveSource ? [source] : [],
            tagGroups: data.settings.keepBooruGroups ? tagGroups : undefined,
            variants: [variant],
            primaryVariantId: variantId,
            createdAt: nowIso(), updatedAt: nowIso(), lastUsed: '', usageCount: 0
        };

        const candidate = { item, variant, source, post: state.booruPost, saveSource: Boolean(state.booruDraft.saveSource), saveThumbnail: Boolean(state.booruDraft.saveThumbnail), thumbnail: null, thumbnailDataUrl: '' };
        toast('Checking source and image …', 'info');
        if (state.booruPost.imageUrl || state.booruPost.previewUrl || state.booruPost.sampleUrl || state.booruPost.fileUrl) {
            try {
                candidate.thumbnail = state.booruImportThumbnail || await createThumbnailFromPost(state.booruPost);
                candidate.thumbnailDataUrl = candidate.thumbnail?.dataUrl || '';
            } catch (error) {
                console.warn('[Ainz Toolkit] Thumbnail creation failed:', error);
                if (candidate.saveThumbnail) toast('The tags can be saved, but the thumbnail could not be created', 'info');
            }
        }

        const sourceDuplicate = findSourceDuplicate(source);
        if (sourceDuplicate) return await openBooruDuplicate(candidate, sourceDuplicate, 'source');
        const related = findRelatedVariantCandidate(candidate);
        if (related) return await openBooruDuplicate(candidate, related, related.matchType || 'variant');
        await commitBooruCandidate(candidate);
        } finally {
            state.operationBusy = false;
        }
    }

    async function commitBooruCandidate(candidate, options = {}) {
        const item = candidate.item;
        if (candidate.thumbnail?.hash) {
            item.imageHash = candidate.thumbnail.hash;
            candidate.variant.imageHash = candidate.thumbnail.hash;
        }
        if (candidate.saveThumbnail && candidate.thumbnail) await storeThumbnailForItemAsync(item, candidate.thumbnail, candidate.variant);
        syncPrimaryVariantAliases(item);
        data.sets.push(item);
        scheduleSave('Booru set imported');
        if (!options.keepModal) closeModal();
        if (!options.silent) {
            state.activeTab = 'imported';
            state.open = data.settings.autoOpenAfterImport || state.open;
            render();
            toast(`${splitPrompt(item.tags).length} tags saved as an import`, 'success');
        }
    }

    function duplicateSourceKeys(source) {
        const keys = [];
        const site = String(source?.site || '').trim().toLowerCase();
        const postId = String(source?.postId || '').trim();
        const url = String(source?.url || '').trim();
        if (site && postId) keys.push(`post:${site}:${postId}`);
        if (url) keys.push(`url:${url}`);
        return keys;
    }

    function getDuplicateIndex() {
        if (duplicateIndexCache.revision === dataRevision) return duplicateIndexCache;
        const bySource = new Map();
        const byMd5 = new Map();
        const byImageHash = new Map();
        for (const wrapper of allLibraryWrappers()) {
            const variants = getItemVariants(wrapper.item);
            const candidates = variants.length ? variants : [{ id: '', sources: wrapper.item.sources || [], imageHash: wrapper.item.imageHash, image: {}, thumbnail: wrapper.item.thumbnail }];
            for (const variant of candidates) {
                const indexed = { ...wrapper, variantId: variant.id || '' };
                for (const source of variant.sources || []) {
                    for (const key of duplicateSourceKeys(source)) if (!bySource.has(key)) bySource.set(key, indexed);
                    const md5 = String(source?.md5 || '').trim().toLowerCase();
                    if (md5 && !byMd5.has(md5)) byMd5.set(md5, indexed);
                }
                const imageMd5 = String(variant.image?.md5 || '').trim().toLowerCase();
                if (imageMd5 && !byMd5.has(imageMd5)) byMd5.set(imageMd5, indexed);
                const imageHash = String(variant.imageHash || variant.thumbnail?.hash || '').trim();
                if (imageHash && !byImageHash.has(imageHash)) byImageHash.set(imageHash, indexed);
            }
        }
        duplicateIndexCache.revision = dataRevision;
        duplicateIndexCache.bySource = bySource;
        duplicateIndexCache.byMd5 = byMd5;
        duplicateIndexCache.byImageHash = byImageHash;
        return duplicateIndexCache;
    }

    function findSourceDuplicate(source) {
        const index = getDuplicateIndex();
        for (const key of duplicateSourceKeys(source)) {
            const match = index.bySource.get(key);
            if (match) return { ...match, reasons: [key.startsWith('post:') ? 'Same website and post ID' : 'Same source'] };
        }
        const md5 = String(source?.md5 || '').trim().toLowerCase();
        const hashMatch = md5 ? index.byMd5.get(md5) : null;
        if (hashMatch) return { ...hashMatch, reasons: ['Identical file hash'] };
        return null;
    }

    function findVisualDuplicate(fingerprintInput) {
        const incoming = normalizeFingerprints(typeof fingerprintInput === 'object' ? fingerprintInput : null, typeof fingerprintInput === 'string' ? fingerprintInput : '');
        const profileName = ['strict','balanced','sensitive'].includes(data.settings.similarityProfile) ? data.settings.similarityProfile : 'balanced';
        const profile = {
            strict: { combined:.09, structural:.10, tonal:.12 },
            balanced: { combined:.18, structural:.20, tonal:.25 },
            sensitive: { combined:.27, structural:.31, tonal:.36 }
        }[profileName];
        const exact = incoming.dHash ? getDuplicateIndex().byImageHash.get(incoming.dHash) : null;
        if (exact) return { ...exact, distance: 0, structuralDistance: 0, tonalDistance: 0, reasons: ['100% visual similarity', 'Identical image hash'], matchType: 'visual' };
        let best = null;
        for (const wrapper of allLibraryWrappers()) {
            const variants = getItemVariants(wrapper.item);
            const candidates = variants.length ? variants : [{ id: '', imageHash: wrapper.item.imageHash, thumbnail: wrapper.item.thumbnail }];
            for (const variant of candidates) {
                const other = normalizeFingerprints(variant.fingerprints || variant.thumbnail?.fingerprints, variant.imageHash || variant.thumbnail?.hash || '');
                if (!incoming.dHash || !other.dHash) continue;
                const dDistance = normalizedHashDistance(incoming.dHash, other.dHash);
                const hasPHash = Boolean(incoming.pHash && other.pHash && incoming.pHash.length === other.pHash.length);
                const hasEdgeHash = Boolean(incoming.edgeHash && other.edgeHash && incoming.edgeHash.length === other.edgeHash.length);
                const pDistance = hasPHash ? normalizedHashDistance(incoming.pHash, other.pHash) : dDistance;
                const edgeDistance = hasEdgeHash ? normalizedHashDistance(incoming.edgeHash, other.edgeHash) : dDistance;
                const tonalDistance = dDistance * .58 + pDistance * .42;
                const structuralDistance = hasEdgeHash ? edgeDistance * .72 + dDistance * .28 : dDistance;
                const distance = hasEdgeHash ? structuralDistance * .62 + tonalDistance * .38 : tonalDistance;
                const qualifies = distance <= profile.combined || (structuralDistance <= profile.structural && tonalDistance <= profile.tonal);
                if (qualifies && (!best || distance < best.distance)) {
                    const similarity = Math.round((1 - distance) * 100);
                    const reasons = [`${similarity}% visual similarity`, `${profileName[0].toUpperCase() + profileName.slice(1)} matching`];
                    if (hasEdgeHash && structuralDistance + .035 < tonalDistance) reasons.push('Matching composition despite color changes');
                    best = { ...wrapper, variantId: variant.id, distance, structuralDistance, tonalDistance, reasons, matchType: distance <= .065 ? 'visual' : 'variant' };
                }
            }
        }
        return best;
    }

    function normalizedHashDistance(left, right) {
        if (!left || !right || left.length !== right.length) return 1;
        return hashDistance(left, right) / Math.max(1, left.length);
    }

    function sourceIdentityMatches(left, right) {
        const sameIdentity = String(left?.site) === String(right?.site) && String(left?.postId) && String(left?.postId) === String(right?.postId);
        return sameIdentity || (left?.url && right?.url && left.url === right.url);
    }

    function findRelatedVariantCandidate(candidate) {
        const candidateFingerprints = candidate.thumbnail?.fingerprints || candidate.variant?.fingerprints || candidate.thumbnail?.hash;
        const visual = candidateFingerprints ? findVisualDuplicate(candidateFingerprints) : null;
        let best = visual ? { ...visual, score: visual.distance <= .065 ? 90 : 72 } : null;
        const newSource = candidate.source || {};
        const newTags = new Set(getIndexedTags(candidate.item).map(canonicalTag));
        for (const wrapper of allLibraryWrappers()) {
            for (const variant of getItemVariants(wrapper.item)) {
                const source = variant.sources?.[0] || {};
                const reasons = [];
                let score = 0;
                if (newSource.md5 && source.md5 && newSource.md5 === source.md5) { score += 100; reasons.push('Identical file hash'); }
                const relatedIds = new Set([newSource.parentId, ...(newSource.childIds || [])].filter(Boolean).map(String));
                if (relatedIds.has(String(source.postId)) || [source.parentId, ...(source.childIds || [])].map(String).includes(String(newSource.postId))) { score += 85; reasons.push('Parent/child post relationship'); }
                if (newSource.originalSourceUrl && source.originalSourceUrl && newSource.originalSourceUrl === source.originalSourceUrl) { score += 55; reasons.push('Same original artist source'); }
                const artists = new Set((newSource.artist || []).map(canonicalTag));
                if (artists.size && (source.artist || []).some(artist => artists.has(canonicalTag(artist)))) { score += 18; reasons.push('Same artist'); }
                if (newSource.width && source.width && newSource.width === source.width && newSource.height === source.height) { score += 10; reasons.push('Same dimensions'); }
                const existingTags = new Set(getIndexedTags({ tags: variant.tags, tagGroups: variant.tagGroups, variants: [] }).map(canonicalTag));
                const overlap = newTags.size ? [...newTags].filter(tag => existingTags.has(tag)).length / Math.max(newTags.size, existingTags.size, 1) : 0;
                if (overlap >= .72) { score += Math.round(overlap * 25); reasons.push(`${Math.round(overlap * 100)}% tag overlap`); }
                if (score >= 70 && (!best || score > best.score)) best = { ...wrapper, variantId: variant.id, score, reasons, matchType: score >= 100 ? 'visual' : 'variant' };
            }
        }
        return best;
    }

    async function openBooruDuplicate(candidate, wrapper, matchType) {
        let existingPreviewDataUrl = '';
        const matchedVariant = findVariant(wrapper.item, wrapper.variantId);
        const matchedThumbnail = matchedVariant?.thumbnail || wrapper.item.thumbnail;
        if (!matchedThumbnail?.key || !getStoredThumbnail(matchedThumbnail.key)) {
            const source = matchedVariant?.sources?.find(entry => entry.fileUrl || entry.sampleUrl || entry.imageUrl || entry.previewUrl) || matchedVariant?.sources?.[0] || wrapper.item.sources?.[0];
            if (source) {
                try {
                    if (!bestVariantImageUrl(matchedVariant)) {
                        const post = await fetchSourcePost(source);
                        mergePostMetadataIntoSource(source, post);
                        if (matchedVariant) matchedVariant.image = { ...matchedVariant.image, ...postToImageMetadata(post, matchedVariant.image || {}) };
                    }
                    const imageUrl = bestVariantImageUrl(matchedVariant) || source.fileUrl || source.sampleUrl || source.imageUrl || source.previewUrl;
                    if (imageUrl) existingPreviewDataUrl = (await createThumbnail(imageUrl, { site: source.site || '', referer: source.url || '' }))?.dataUrl || '';
                } catch { /* comparison can still proceed without a stored preview */ }
            }
        }
        state.modal = 'booru-duplicate';
        state.modalPayload = { candidate, existingKind: wrapper.kind, existingId: wrapper.item.id, existingVariantId: wrapper.variantId || matchedVariant?.id || '', matchType, distance: wrapper.distance, reasons: wrapper.reasons || [], existingPreviewDataUrl };
        render();
    }

    async function resolveBooruDuplicate(mode) {
        const payload = state.modalPayload || {};
        const candidate = payload.candidate;
        const existing = findItem(payload.existingKind, payload.existingId);
        if (!candidate || !existing) return closeModal();
        if (mode === 'separate') return await commitBooruCandidate(candidate);
        const existingVariant = findVariant(existing, payload.existingVariantId);
        if (mode === 'add-source') {
            if (existingVariant && !existingVariant.sources.some(source => sourceIdentityMatches(source, candidate.source))) existingVariant.sources.push(normalizeSource(candidate.source));
            if (!existing.imageHash && candidate.thumbnail?.hash) existing.imageHash = candidate.thumbnail.hash;
            if (existingVariant && !existingVariant.thumbnail?.key && candidate.saveThumbnail && candidate.thumbnail) await storeThumbnailForItemAsync(existing, candidate.thumbnail, existingVariant);
            syncPrimaryVariantAliases(existing);
            existing.updatedAt = nowIso();
            scheduleSave('Additional source added');
            closeModal();
            state.activeTab = payload.existingKind === 'imported' ? 'imported' : state.activeTab;
            render();
            toast('New source added to the existing entry', 'success');
        }
        if (mode === 'add-variant') {
            const variant = deepClone(candidate.variant);
            if (!candidate.saveSource) variant.sources = [];
            ensureItemVariants(existing).push(variant);
            if (candidate.thumbnail?.hash) variant.imageHash = candidate.thumbnail.hash;
            if (candidate.saveThumbnail && candidate.thumbnail) await storeThumbnailForItemAsync(existing, candidate.thumbnail, variant);
            existing.updatedAt = nowIso();
            syncPrimaryVariantAliases(existing);
            scheduleSave('Image variant added');
            closeModal();
            state.activeTab = 'imported';
            render();
            toast(`Variant added to “${existing.name || existing.label || 'entry'}”`, 'success');
        }
    }

    async function createThumbnailFromPost(post) {
        const urls = postImageCandidates(post, 'thumbnail');
        let lastError = null;
        for (const url of urls) {
            try { return await createThumbnail(url, { site: post?.site || '', referer: post?.url || '' }); }
            catch (error) { lastError = error; reportDiagnostic('thumbnail-source', error, false); }
        }
        throw lastError || new Error('No usable thumbnail URL was returned');
    }

    function hashDistance(left, right) {
        if (!left || !right || left.length !== right.length) return Infinity;
        let distance = 0;
        for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) distance++;
        return distance;
    }

    async function createThumbnail(imageUrl, requestContext = {}) {
        if (!imageUrl) return null;
        const blob = await gmRequestBlob(imageUrl, requestContext);
        return createThumbnailFromBlob(blob);
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Blob could not be converted to a data URL'));
            reader.readAsDataURL(blob);
        });
    }

    async function encodeCanvasBlob(canvas, mime, quality) {
        if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: mime, quality });
        if (typeof canvas.toBlob === 'function') {
            const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Canvas encoding failed')), mime, quality));
            return blob;
        }
        const dataUrl = canvas.toDataURL(mime, quality);
        return (await fetch(dataUrl)).blob();
    }

    async function createThumbnailFromBlob(blob) {
        return measureOperationAsync('thumbnail-create', async () => {
            await validateDownloadedImage(blob);
            const image = await decodeImageBlob(blob);
            const sourceWidth = Number(image.width || image.naturalWidth) || 0;
            const sourceHeight = Number(image.height || image.naturalHeight) || 0;
            if (!sourceWidth || !sourceHeight) throw new Error('Image dimensions could not be read');
            const qualityName = ['compact', 'local', 'sharp'].includes(data.settings.thumbnailQuality) ? data.settings.thumbnailQuality : 'local';
            const profile = {
                compact: { maxSide: 768, minSide: 576, webp: 0.82, jpeg: 0.84, minQuality: 0.68, softMaxBytes: 160 * 1024 },
                local: { maxSide: 1024, minSide: 720, webp: 0.85, jpeg: 0.87, minQuality: 0.70, softMaxBytes: 250 * 1024 },
                sharp: { maxSide: 1280, minSide: 896, webp: 0.87, jpeg: 0.89, minQuality: 0.72, softMaxBytes: 380 * 1024 }
            }[qualityName];
            const sourceMaxSide = Math.max(sourceWidth, sourceHeight);
            let targetMaxSide = Math.min(sourceMaxSide, profile.maxSide);
            const minimumMaxSide = Math.min(sourceMaxSide, profile.minSide);
            let encoding = 'image/webp';
            let encodingQuality = profile.webp;
            let encodedBlob = null;
            let width = 0;
            let height = 0;
            let compressionPasses = 0;
            const canvas = typeof globalThis.OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
            for (let pass = 0; pass < 7; pass++) {
                const scale = Math.min(1, targetMaxSide / sourceMaxSide);
                width = Math.max(1, Math.round(sourceWidth * scale));
                height = Math.max(1, Math.round(sourceHeight * scale));
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d', { alpha: false });
                if (!context) throw new Error('Canvas rendering is not available');
                context.fillStyle = '#11131a';
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);
                encodedBlob = await encodeCanvasBlob(canvas, encoding, encodingQuality);
                if (encoding === 'image/webp' && encodedBlob.type !== 'image/webp') {
                    encoding = 'image/jpeg';
                    encodingQuality = profile.jpeg;
                    encodedBlob = await encodeCanvasBlob(canvas, encoding, encodingQuality);
                }
                compressionPasses = pass;
                if (encodedBlob.size <= profile.softMaxBytes) break;
                if (encodingQuality > profile.minQuality + 0.01) encodingQuality = Math.max(profile.minQuality, encodingQuality - 0.06);
                else if (targetMaxSide > minimumMaxSide) targetMaxSide = Math.max(minimumMaxSide, Math.round(targetMaxSide * 0.88));
                else break;
            }
            if (!encodedBlob) throw new Error('Thumbnail encoding produced no data');
            const dataUrl = await blobToDataUrl(encodedBlob);
            const fingerprints = createImageFingerprints(image, sourceWidth, sourceHeight);
            const hash = fingerprints.dHash;
            image.close?.();
            if (image.__objectUrl) URL.revokeObjectURL(image.__objectUrl);
            return {
                dataUrl,
                mime: encodedBlob.type || encoding,
                width,
                height,
                sizeBytes: encodedBlob.size,
                qualityProfile: qualityName,
                encodingQuality: Number(encodingQuality.toFixed(2)),
                compressionPasses,
                hash,
                fingerprints
            };
        });
    }

    async function gmRequestBlob(url, requestContext = {}) {
        let lastError = null;
        const absolute = absoluteBooruUrl(url);
        const minimalHeaders = { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.9,*/*;q=0.5' };
        const siteHeaders = requestHeadersForUrl(absolute, true, requestContext);
        const hasExactGelbooruReferer = String(requestContext.site || '').toLowerCase() === 'gelbooru' && Boolean(requestContext.referer);
        const headerStrategies = hasExactGelbooruReferer ? [siteHeaders, minimalHeaders] : [minimalHeaders, siteHeaders];
        for (const headers of headerStrategies) {
            for (const responseType of ['blob', 'arraybuffer']) {
                try {
                    const blob = await gmRequestBinaryOnce(absolute, responseType, headers);
                    await validateDownloadedImage(blob);
                    return blob;
                } catch (error) {
                    lastError = error;
                    reportDiagnostic(`image-download-${responseType}`, error, false, { url: absolute, method: Object.keys(headers).includes('Referer') ? 'site-headers' : 'minimal-headers' });
                    if (error?.status === 404) break;
                }
            }
        }
        if (canUseNativeImageFetch(absolute)) {
            try {
                const response = await fetch(absolute, { credentials: 'same-origin', cache: 'no-store' });
                if (!response.ok) { const error = new Error(`Image HTTP ${response.status}`); error.status = response.status; throw error; }
                const blob = await response.blob();
                await validateDownloadedImage(blob);
                return blob;
            } catch (error) {
                lastError = error;
                reportDiagnostic('image-download-native', error, false, { url: absolute, method: 'same-site fetch' });
            }
        }
        throw lastError || new Error('Image download failed');
    }

    function gmRequestBinaryOnce(url, responseType, headers = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url: absoluteBooruUrl(url), headers, responseType, timeout: 30000,
                onload: response => {
                    if (response.status < 200 || response.status >= 300) {
                        const error = new Error(`Image HTTP ${response.status}`);
                        error.status = response.status;
                        return reject(error);
                    }
                    const mime = response.responseHeaders?.match(/content-type:\s*([^;\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
                    const body = response.response ?? response.responseText;
                    if (!body || (body.byteLength === 0 && !body.size)) return reject(new Error('Image response was empty'));
                    if (body instanceof Blob) return resolve(body.type ? body : body.slice(0, body.size, mime));
                    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return resolve(new Blob([body], { type: mime }));
                    if (body?.buffer instanceof ArrayBuffer) return resolve(new Blob([body.buffer], { type: mime }));
                    if (typeof body?.arrayBuffer === 'function') {
                        return body.arrayBuffer().then(buffer => resolve(new Blob([buffer], { type: body.type || mime })), reject);
                    }
                    reject(new Error(`Firefox/Tampermonkey returned an unsupported ${responseType} response`));
                },
                onerror: () => reject(new Error('Image download failed')),
                ontimeout: () => reject(new Error('Image download timed out'))
            });
        });
    }

    function canUseNativeImageFetch(rawUrl) {
        try {
            const hostName = new URL(rawUrl).hostname.toLowerCase();
            if (SITE === 'danbooru') return hostName.endsWith('donmai.us');
            if (SITE === 'gelbooru') return hostName.endsWith('gelbooru.com');
            if (SITE === 'e621') return hostName.endsWith('e621.net');
        } catch { /* invalid URL */ }
        return false;
    }

    async function validateDownloadedImage(blob) {
        if (!blob?.size) throw new Error('Downloaded image was empty');
        const mime = String(blob.type || '').toLowerCase();
        if (/^(?:text\/|application\/(?:json|xml|xhtml\+xml))/.test(mime)) {
            throw new Error(`The server returned ${mime} instead of an image`);
        }
        if (mime.startsWith('image/')) return;
        const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        const ascii = String.fromCharCode(...bytes);
        const valid = (bytes[0] === 0xff && bytes[1] === 0xd8)
            || (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG')
            || ascii.startsWith('GIF8')
            || (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP')
            || ascii.slice(4, 12).includes('ftypavif');
        if (!valid) throw new Error(`The downloaded response is not a supported image${mime ? ` (${mime})` : ''}`);
    }

    function requestHeadersForUrl(rawUrl, image = false, requestContext = {}) {
        const url = absoluteBooruUrl(rawUrl);
        const inferredSite = url.includes('e621.net') ? 'e621' : url.includes('gelbooru.com') ? 'gelbooru' : url.includes('donmai.us') ? 'danbooru' : '';
        const site = String(requestContext.site || inferredSite).toLowerCase();
        const headers = { Accept: image ? 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.9,*/*;q=0.5' : 'application/json,text/plain;q=0.9,*/*;q=0.5' };
        if (site === 'e621') headers['User-Agent'] = `AinzToolkit/${SCRIPT_VERSION}`;
        const storedReferer = absoluteBooruUrl(requestContext.referer || '', site);
        if (site) headers.Referer = storedReferer || ({ e621: 'https://e621.net/', gelbooru: 'https://gelbooru.com/', danbooru: 'https://danbooru.donmai.us/' })[site];
        return headers;
    }

    function friendlyRequestError(error, site = '') {
        if (Number(error?.status) === 401 || /HTTP 401/.test(error?.message || '')) {
            if (site === 'gelbooru') return 'HTTP 401 · Gelbooru requires a valid User ID and API key';
            return 'HTTP 401 · the source rejected this request';
        }
        return error?.message || String(error || 'Unknown request error');
    }

    async function decodeImageBlob(blob) {
        if (typeof createImageBitmap === 'function') {
            try { return await createImageBitmap(blob); }
            catch { /* fall back to HTMLImageElement */ }
        }
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.__objectUrl = url;
            image.onload = () => resolve(image);
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decoding failed')); };
            image.src = url;
        });
    }

    function perceptualDifferenceHash(image, sourceWidth, sourceHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = 9;
        canvas.height = 8;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, 9, 8);
        const pixels = context.getImageData(0, 0, 9, 8).data;
        let hash = '';
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const leftIndex = (y * 9 + x) * 4;
                const rightIndex = leftIndex + 4;
                const left = pixels[leftIndex] * 0.299 + pixels[leftIndex + 1] * 0.587 + pixels[leftIndex + 2] * 0.114;
                const right = pixels[rightIndex] * 0.299 + pixels[rightIndex + 1] * 0.587 + pixels[rightIndex + 2] * 0.114;
                hash += left > right ? '1' : '0';
            }
        }
        return hash;
    }

    function createImageFingerprints(image, sourceWidth, sourceHeight) {
        return {
            version: 2,
            dHash: perceptualDifferenceHash(image, sourceWidth, sourceHeight),
            pHash: perceptualAverageHash(image, sourceWidth, sourceHeight),
            edgeHash: perceptualEdgeHash(image, sourceWidth, sourceHeight)
        };
    }

    function perceptualAverageHash(image, sourceWidth, sourceHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, 16, 16);
        const pixels = context.getImageData(0, 0, 16, 16).data;
        const values = [];
        for (let index = 0; index < pixels.length; index += 4) values.push(pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        return values.map(value => value >= average ? '1' : '0').join('');
    }

    function perceptualEdgeHash(image, sourceWidth, sourceHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = 17; canvas.height = 16;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, 17, 16);
        const pixels = context.getImageData(0, 0, 17, 16).data;
        let result = '';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const left = (y * 17 + x) * 4;
            const right = left + 4;
            const a = pixels[left] * .299 + pixels[left + 1] * .587 + pixels[left + 2] * .114;
            const b = pixels[right] * .299 + pixels[right + 1] * .587 + pixels[right + 2] * .114;
            result += a > b ? '1' : '0';
        }
        return result;
    }

    function suggestBooruName(post) {
        const groups = post?.groups || {};
        const sources = [{ site: post?.site || SITE, postId: post?.postId || '' }];
        const fallback = (groups.character || [])[0] || (groups.artist || [])[0] || 'Imported';
        return applyImportNameTemplate(data.settings.importNameTemplate, importNamingParts(groups, sources), humanizeImportLabel(fallback, true));
    }

    function copyFilteredBooruTags() {
        copyBooruText(Object.values(getCleanBooruGroups()).flat(), 'filtered tags');
    }

    function getCleanBooruGroups(mode = 'copy') {
        return cleanBooruGroups(state.booruPost?.groups || {}, SITE, mode);
    }

    function isAnimalBooruPost(groups = state.booruPost?.groups || {}) {
        if ((groups.species || []).length) return true;
        const normalized = Object.values(groups).flat().map(tag => normalizeBooruTag(tag).replace(/_/g, ' '));
        return normalized.some(tag => ANIMAL_HINT_TAGS.has(tag) || ANIMAL_APPEARANCE_PATTERNS.some(pattern => pattern.test(tag)));
    }

    function shouldKeepAnimalAppearance(groups) {
        const mode = data.settings.animalAppearanceMode || state.booruAnimalMode || 'auto';
        if (mode === 'keep') return true;
        if (mode === 'remove') return false;
        return isAnimalBooruPost(groups);
    }

    function isAppearanceTag(tag, keepAnimalAppearance) {
        const normalized = canonicalTag(tag);
        if (keepAnimalAppearance) return ANIMAL_SCENE_EXCLUDE_PATTERNS.some(pattern => pattern.test(normalized));
        return HUMAN_APPEARANCE_PATTERNS.some(pattern => pattern.test(normalized));
    }

    function getSceneActionStyleTags() {
        const groups = getCleanBooruGroups();
        const keepAnimalAppearance = shouldKeepAnimalAppearance(state.booruPost?.groups || {});
        const candidates = [...(groups.general || []), ...(groups.meta || [])];
        return [...new Set(candidates.filter(tag => !isAppearanceTag(tag, keepAnimalAppearance)))];
    }

    function getBooruPresetTags(preset) {
        const groups = getCleanBooruGroups();
        if (preset === 'artist') return groups.artist || [];
        if (preset === 'characterCopyright') return [...new Set([...(groups.character || []), ...(groups.copyright || [])])];
        if (preset === 'general') return groups.general || [];
        if (preset === 'text') return groups.text || [];
        if (preset === 'withoutText') return Object.entries(groups).filter(([group]) => group !== 'text').flatMap(([, tags]) => tags);
        if (preset === 'scene') return getSceneActionStyleTags();
        return Object.values(groups).flat();
    }

    function copyBooruText(tags, label = 'tags') {
        const unique = [...new Set((tags || []).filter(Boolean))];
        const text = unique.join(', ');
        if (!text) return toast(`No ${label} were found`, 'error');
        try { GM_setClipboard(text, 'text'); }
        catch { navigator.clipboard?.writeText(text); }
        toast(`Copied ${unique.length} ${label}`, 'success');
    }

    function copyBooruPreset(preset) {
        if (!state.booruPost) {
            void loadBooruPost(true).then(() => { if (state.booruPost) copyBooruPreset(preset); });
            return;
        }
        const labels = { artist: 'artist tag(s)', characterCopyright: 'character/copyright tag(s)', general: 'general tag(s)', text: 'text-related tag(s)', withoutText: 'tag(s) without text', scene: 'scene/action/style tag(s)' };
        copyBooruText(getBooruPresetTags(preset), labels[preset] || 'tags');
    }

    function copySelectedBooruTags() {
        copyBooruText([...state.booruPreviewSelection], 'selected tag(s)');
    }
    function findBooruTagContainer() {
        return document.querySelector('#tag-list, #tag-listing, .tag-list');
    }

    function getBooruListingCards() {
        if (!IS_BOORU) return [];
        const selector = SITE === 'gelbooru'
            ? 'a[href*="page=post"][href*="s=view"][href*="id="]'
            : 'a[href*="/posts/"]';
        const seen = new Set();
        const result = [];
        for (const link of document.querySelectorAll(selector)) {
            let id = '';
            try {
                const url = new URL(link.href, location.href);
                id = SITE === 'gelbooru' ? url.searchParams.get('id') || '' : url.pathname.match(/\/posts\/(\d+)/)?.[1] || '';
            } catch { /* ignore invalid links */ }
            if (!id || id === getPostId() || seen.has(id)) continue;
            const element = link.closest('article.post-preview, article[data-id], .post-preview, .thumbnail-preview, .thumbnail-container, .thumb, span.thumb') || link.parentElement;
            if (!element || element.closest('#ainz-booru-page-toolbar,#ainz-booru-selection-bar')) continue;
            seen.add(id);
            result.push({ id, element, link });
        }
        return result;
    }

    function toggleBooruSelectionMode(enabled) {
        state.booruSelectionMode = Boolean(enabled);
        if (!enabled) state.booruSelectedPosts.clear();
        removeBooruToolbar();
        syncBooruPageEnhancements();
    }

    function installBooruSelectionCardHandler() {
        if (!IS_BOORU || booruSelectionClickInstalled) return;
        booruSelectionClickInstalled = true;
        document.addEventListener('click', event => {
            if (!state.booruSelectionMode || event.button !== 0) return;
            if (event.target.closest('#ainz-booru-selection-bar,#ainz-booru-page-toolbar,.ainz-booru-select')) return;
            const card = getBooruListingCards().find(record => record.element === event.target.closest('article.post-preview,article[data-id],.post-preview,.thumbnail-preview,.thumbnail-container,.thumb,span.thumb') || record.element.contains(event.target));
            if (!card) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (state.booruSelectedPosts.has(card.id)) state.booruSelectedPosts.delete(card.id);
            else state.booruSelectedPosts.add(card.id);
            syncBooruSelectionUi();
        }, true);
    }

    function syncBooruSelectionUi() {
        document.querySelectorAll('.ainz-booru-select').forEach(element => element.remove());
        document.getElementById('ainz-booru-selection-bar')?.remove();
        for (const card of getBooruListingCards()) {
            card.element.style.outline = '';
            card.element.style.outlineOffset = '';
            card.element.style.cursor = '';
        }
        if (!state.booruSelectionMode) return;
        for (const card of getBooruListingCards()) {
            const style = getComputedStyle(card.element);
            if (style.position === 'static') card.element.style.position = 'relative';
            card.element.style.cursor = 'pointer';
            card.element.style.outline = state.booruSelectedPosts.has(card.id) ? '3px solid #9b8cff' : '2px solid transparent';
            card.element.style.outlineOffset = '3px';
            const label = document.createElement('label');
            label.className = 'ainz-booru-select';
            label.style.cssText = 'position:absolute;z-index:9998;top:6px;left:6px;display:grid;place-items:center;width:25px;height:25px;border:1px solid rgba(255,255,255,.5);border-radius:7px;background:rgba(15,17,24,.88);box-shadow:0 3px 12px rgba(0,0,0,.35);cursor:pointer;';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = state.booruSelectedPosts.has(card.id);
            checkbox.style.cssText = 'width:15px;height:15px;margin:0;accent-color:#7564ee;';
            checkbox.addEventListener('click', event => event.stopPropagation());
            checkbox.addEventListener('change', event => {
                if (event.target.checked) state.booruSelectedPosts.add(card.id); else state.booruSelectedPosts.delete(card.id);
                updateBooruSelectionBar();
            });
            label.addEventListener('click', event => event.stopPropagation());
            label.appendChild(checkbox);
            card.element.appendChild(label);
        }
        updateBooruSelectionBar();
    }

    function updateBooruSelectionBar() {
        document.getElementById('ainz-booru-selection-bar')?.remove();
        if (!state.booruSelectionMode) return;
        const bar = document.createElement('div');
        bar.id = 'ainz-booru-selection-bar';
        bar.style.cssText = 'position:fixed;z-index:2147483645;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:10px 12px;border:1px solid rgba(235,228,255,.16);border-radius:24px;background:rgba(28,29,37,.97);color:#f2eef8;box-shadow:0 18px 58px rgba(0,0,0,.52);backdrop-filter:blur(12px);font:650 12px/1.2 system-ui,sans-serif;';
        const make = (label, action, primary = false) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = primary && !state.booruSelectedPosts.size; button.style.cssText = `padding:8px 12px;border:1px solid ${primary ? 'transparent' : 'rgba(235,228,255,.14)'};border-radius:999px;background:${primary ? '#9b8cff' : '#292a34'};color:${primary ? '#17131d' : '#f2eef8'};cursor:${button.disabled ? 'not-allowed' : 'pointer'};opacity:${button.disabled ? '.5' : '1'};font:inherit;`; button.addEventListener('click', action); return button; };
        const count = document.createElement('strong');
        count.textContent = `${state.booruSelectedPosts.size} selected`;
        bar.append(count, make('Import …', () => void prepareBooruBatch(), true), make('Clear', () => { state.booruSelectedPosts.clear(); syncBooruSelectionUi(); }), make('Exit', () => toggleBooruSelectionMode(false)));
        document.documentElement.appendChild(bar);
    }

    function removeBooruToolbar() {
        const menu = document.getElementById('ainz-booru-page-menu');
        menu?.__ainzCleanup?.();
        menu?.remove();
        document.getElementById('ainz-booru-page-toolbar')?.remove();
    }

    function positionBooruPageMenu(trigger, menu) {
        menu.hidden = false;
        menu.style.visibility = 'hidden';
        const anchor = trigger.getBoundingClientRect();
        const measured = menu.getBoundingClientRect();
        const margin = 8;
        const gap = 6;
        const width = Math.min(measured.width || 250, Math.max(0, innerWidth - margin * 2));
        const height = Math.min(measured.height || 420, Math.max(0, innerHeight - margin * 2));
        let left = anchor.right - width;
        let top = anchor.bottom + gap;
        if (top + height > innerHeight - margin && anchor.top - height - gap >= margin) top = anchor.top - height - gap;
        left = Math.max(margin, Math.min(left, innerWidth - width - margin));
        top = Math.max(margin, Math.min(top, innerHeight - height - margin));
        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
        menu.style.maxHeight = `${Math.max(100, Math.floor(innerHeight - top - margin))}px`;
        menu.style.visibility = 'visible';
    }

    function installBooruToolbar() {
        if (!IS_BOORU || document.getElementById('ainz-booru-page-toolbar')) return;
        const hasPost = Boolean(getPostId());
        const hasListing = getBooruListingCards().length > 0;
        if (!hasPost && !hasListing) return;
        const container = findBooruTagContainer();
        const toolbar = document.createElement('div');
        toolbar.id = 'ainz-booru-page-toolbar';
        toolbar.style.cssText = container
            ? 'position:relative;display:inline-flex;align-items:center;margin:0 0 10px;z-index:99999;font:600 12px/1.25 system-ui,sans-serif;'
            : 'position:fixed;right:18px;bottom:78px;z-index:2147483644;font:600 12px/1.25 system-ui,sans-serif;';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.textContent = '⋯';
        trigger.title = 'Ainz Toolkit actions';
        trigger.setAttribute('aria-label', 'Ainz Toolkit actions');
        trigger.style.cssText = 'width:38px;height:38px;padding:0;border:0;border-radius:11px;background:transparent;color:#bdb6cf;box-shadow:none;cursor:pointer;font:800 20px/1 system-ui,sans-serif;';
        trigger.addEventListener('mouseenter', () => { trigger.style.background = 'rgba(145,126,255,.14)'; trigger.style.color = '#f2eef8'; });
        trigger.addEventListener('mouseleave', () => { trigger.style.background = 'transparent'; trigger.style.color = '#bdb6cf'; });
        const menu = document.createElement('div');
        menu.id = 'ainz-booru-page-menu';
        menu.hidden = true;
        menu.style.cssText = 'position:fixed;z-index:2147483647;width:270px;max-width:calc(100vw - 16px);overflow:auto;padding:8px;border:1px solid rgba(235,228,255,.16);border-radius:20px;background:#24252d;color:#f2eef8;box-shadow:0 22px 70px rgba(0,0,0,.58);backdrop-filter:blur(12px);font:600 12px/1.3 system-ui,sans-serif;';
        const addItem = (label, action, options = {}) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = `display:block;width:100%;min-height:40px;padding:9px 12px;border:0;border-radius:12px;background:transparent;color:${options.danger ? '#ffb4ab' : '#f2eef8'};cursor:pointer;text-align:left;font:inherit;`;
            button.addEventListener('mouseenter', () => { button.style.background = 'rgba(255,255,255,.08)'; });
            button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; });
            button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); action(); });
            menu.appendChild(button);
        };
        const addSeparator = () => { const line = document.createElement('div'); line.style.cssText = 'height:1px;margin:5px;background:rgba(255,255,255,.1)'; menu.appendChild(line); };
        if (hasPost) {
            addItem('Save current post …', openBooruImport);
            addItem('Save as Character', () => void saveCurrentBooruAs('character'));
            addItem('Save as Full Image', () => void saveCurrentBooruAs('fullImage'));
            addItem('Add to existing entry …', openAttachSourceModal);
            addItem('Find similar saved image', () => void searchCurrentPostSimilar());
            addSeparator();
            addItem('Copy Artist', () => copyBooruPreset('artist'));
            addItem('Copy Character + Copyright', () => copyBooruPreset('characterCopyright'));
            addItem('Copy General', () => copyBooruPreset('general'));
            addItem('Copy Text', () => copyBooruPreset('text'));
            addItem('Copy All without Text', () => copyBooruPreset('withoutText'));
            addItem('Copy Scene / Action / Style', () => copyBooruPreset('scene'));
            addItem('Copy All', () => copyBooruPreset('all'));
        }
        if (hasListing) {
            if (hasPost) addSeparator();
            addItem(state.booruSelectionMode ? 'Exit selection mode' : 'Select posts from this page', () => toggleBooruSelectionMode(!state.booruSelectionMode));
        }
        addSeparator();
        addItem(`${data.settings.showTagPlusButtons ? '✓ ' : ''}Show + beside tags`, () => {
            data.settings.showTagPlusButtons = !data.settings.showTagPlusButtons;
            if (data.settings.showTagPlusButtons) installBooruTagButtons(); else removeBooruTagButtons();
            scheduleSave('Booru tag + buttons toggled', ['settings']);
            removeBooruToolbar();
            installBooruToolbar();
        });
        addItem('Open Ainz Toolkit', () => { state.open = true; state.activeTab = hasPost ? 'booru' : 'imported'; render(); });
        trigger.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation();
            if (!menu.hidden) {
                menu.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                positionBooruPageMenu(trigger, menu);
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
        const closeMenu = event => {
            if (menu.hidden) return;
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (path.includes(menu) || path.includes(trigger)) return;
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        };
        const closeOnViewportChange = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
        document.addEventListener('pointerdown', closeMenu, true);
        window.addEventListener('resize', closeOnViewportChange);
        window.addEventListener('scroll', closeOnViewportChange, true);
        menu.__ainzCleanup = () => {
            document.removeEventListener('pointerdown', closeMenu, true);
            window.removeEventListener('resize', closeOnViewportChange);
            window.removeEventListener('scroll', closeOnViewportChange, true);
        };
        toolbar.append(trigger);
        document.documentElement.appendChild(menu);
        if (container?.parentElement) container.parentElement.insertBefore(toolbar, container);
        else document.documentElement.appendChild(toolbar);
    }

    function installBooruTagButtons() {
        if (!IS_BOORU || !data.settings.showTagPlusButtons) return;
        const selectors = getBooruAdapter()?.tagSelector || '#tag-list a.search-tag';
        const anchors = [...document.querySelectorAll(selectors)];
        for (const anchor of anchors) {
            if (anchor.dataset.ainzDecorated || anchor.closest('#ainz-toolkit-host')) continue;
            const tag = extractTagFromAnchor(anchor);
            if (!tag) continue;
            anchor.dataset.ainzDecorated = '1';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ainz-inline-add';
            button.style.cssText = 'display:inline-grid;place-items:center;width:17px;height:17px;margin-left:4px;padding:0;border:1px solid rgba(115,96,255,.55);border-radius:50%;background:rgba(96,78,225,.16);color:#7d6cff;font:800 12px/1 system-ui,sans-serif;cursor:pointer;vertical-align:middle;';
            button.textContent = '+';
            button.title = `Save “${tag.replace(/_/g, ' ')}” to Ainz Toolkit`;
            button.dataset.ainzTag = tag;
            button.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation(); saveSingleBooruTag(tag);
            });
            anchor.insertAdjacentElement('afterend', button);
        }
    }

    function removeBooruTagButtons() {
        document.querySelectorAll('.ainz-inline-add').forEach(button => button.remove());
        document.querySelectorAll('[data-ainz-decorated]').forEach(anchor => delete anchor.dataset.ainzDecorated);
    }

    function saveSingleBooruTag(rawTag) {
        const result = filterImportedTag(rawTag);
        if (!result.keep) return toast(`Tag was not saved: ${result.reason}`, 'error');
        const existing = data.favoriteTags.find(item => canonicalTag(item.tag) === canonicalTag(result.tag));
        if (existing) {
            existing.favorite = true;
            existing.updatedAt = nowIso();
            scheduleSave('Imported tag marked as favorite');
            return toast('This tag already existed and is now a favorite', 'info');
        }
        data.favoriteTags.push({
            id: uid('tag'), label: result.tag, tag: result.tag, type: 'positive', category: isTextRelatedTag(rawTag) ? 'Text' : 'Imported',
            notes: '',
            favorite: true, usageCount: 0,
            sources: state.booruDraft.saveSource ? [{ site: SITE, postId: getPostId(), url: location.href, imageUrl: state.booruPost?.imageUrl || '', importedAt: nowIso() }] : [],
            createdAt: nowIso(), updatedAt: nowIso(), lastUsed: ''
        });
        scheduleSave('Individual Booru tag imported');
        render();
        toast(`“${result.tag}” saved`, 'success');
    }

    // -------------------- Utilities --------------------
    async function runManualNaiDiagnosticScan() {
        if (!IS_NAI || !naiImageRouteActive) return toast('Open NovelAI Image Generation before running the field scan', 'info');
        if (state.operationBusy) return toast('Another prompt operation is still running', 'info');
        const previousUi = captureNaiCharacterUiState();
        state.operationBusy = true;
        state.naiDiagnosticScan = { running: true, startedAt: nowIso() };
        render();
        try {
            const started = performance.now();
            const snapshot = await captureNaiPromptStructure(true);
            const baseFields = Number(Boolean(snapshot.basePositive)) + Number(Boolean(snapshot.baseNegative));
            const characterFields = snapshot.characters.reduce((sum, character) => sum + Number(Boolean(character.positive)) + Number(Boolean(character.negative)), 0);
            state.naiDiagnosticScan = {
                running: false,
                finishedAt: nowIso(),
                durationMs: Math.round(performance.now() - started),
                basePositive: Boolean(snapshot.basePositive),
                baseNegative: Boolean(snapshot.baseNegative),
                characters: snapshot.characters.map((character, index) => ({
                    index: Number(character.index) || index + 1,
                    positive: Boolean(character.positive),
                    negative: Boolean(character.negative),
                    type: normalizeCharacterType(character.naiCharacterType)
                })),
                fieldCount: baseFields + characterFields,
                error: ''
            };
            toast(`NAI scan finished · ${snapshot.characters.length} character panel${snapshot.characters.length === 1 ? '' : 's'}`, 'success');
        } catch (error) {
            state.naiDiagnosticScan = { running: false, finishedAt: nowIso(), fieldCount: 0, characters: [], error: String(error?.message || error) };
            reportDiagnostic('manual-nai-field-scan', error, false);
            toast(`NAI field scan failed: ${error.message || error}`, 'error');
        } finally {
            try { await restoreNaiCharacterUiState(previousUi); } catch (error) { reportDiagnostic('manual-nai-state-restore', error, false); }
            state.operationBusy = false;
            render();
        }
    }

    function reportDiagnostic(area, error, warn = true, contextData = null) {
        const message = error?.message || String(error || 'Unknown error');
        const context = contextData && typeof contextData === 'object' ? redactDiagnosticContext(contextData) : '';
        state.diagnostics.push({ area: String(area || 'unknown'), message, context, at: nowIso() });
        state.diagnostics = state.diagnostics.slice(-30);
        if (warn) console.warn(`[Ainz Toolkit] ${area}:`, error);
    }

    function redactDiagnosticContext(value) {
        const text = Object.entries(value || {}).map(([key, entry]) => `${key}=${String(entry ?? '')}`).join(' · ');
        return text.replace(/([?&](?:api[_-]?key|login|user[_-]?id)=)[^&\s]+/gi, '$1[redacted]').replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]');
    }

    function performanceDiagnosticLines() {
        return [...performanceMetrics.entries()].sort(([left],[right]) => left.localeCompare(right)).map(([name, metric]) =>
            `Timing ${name}: last=${metric.last.toFixed(1)}ms avg=${(metric.total / Math.max(1, metric.count)).toFixed(1)}ms max=${metric.max.toFixed(1)}ms runs=${metric.count}`
        );
    }

    function copyDiagnostics() {
        const lines = state.diagnostics.map(entry => `[${entry.at}] ${entry.area}: ${entry.message}${entry.context ? ` (${entry.context})` : ''}`);
        const libraryLine = `Library: ${allLibraryWrappers().length} entries · ${getImportedWrappers().reduce((sum, wrapper) => sum + getItemVariants(wrapper.item).length, 0)} imported variants · ${thumbnailKeys().length} local images`;
        const text = [`Ainz Toolkit ${SCRIPT_VERSION}`, `Site: ${SITE}`, `Browser: ${navigator.userAgent}`, libraryLine, ...performanceDiagnosticLines(), ...lines].join('\n');
        try { GM_setClipboard(text, 'text'); }
        catch { navigator.clipboard?.writeText(text); }
        toast('Diagnostics copied', 'success');
    }

    function itemThumbnailKeys(item) {
        return [...new Set([item?.thumbnail?.key, ...getItemVariants(item).map(variant => variant.thumbnail?.key)].filter(Boolean))];
    }

    function undoCollectionKeyForKind(kind) {
        return ({ character:'characters', set:'sets', imported:'sets', base:'bases', style:'styleArtists', fullImage:'fullImages', tag:'favoriteTags' })[kind] || '';
    }

    function undoTargetForItem(item, fallbackKind = 'imported') {
        const wrapper = item?.id ? getWrapperIndex().byId.get(item.id) : null;
        return item?.id ? { kind:wrapper?.kind || fallbackKind, id:item.id } : null;
    }

    function normalizeUndoTargets(targets = []) {
        const result = [];
        const seen = new Set();
        for (const target of targets || []) {
            if (!target) continue;
            if (target.collection) {
                const key = `collection:${target.collection}`;
                if (!seen.has(key)) { seen.add(key); result.push({ collection:String(target.collection) }); }
                continue;
            }
            const kind = String(target.kind || '');
            const id = String(target.id || target.item?.id || '');
            if (!kind || !id) continue;
            const key = `${kind}:${id}`;
            if (!seen.has(key)) { seen.add(key); result.push({ kind, id }); }
        }
        return result;
    }

    async function captureUndoState(label, keys = [], targets = []) {
        const normalizedTargets = normalizeUndoTargets(targets);
        const itemSnapshots = [];
        const collectionSnapshots = [];
        const trackedThumbnailKeys = new Set(keys.filter(Boolean));
        for (const target of normalizedTargets) {
            if (target.collection) {
                if (Array.isArray(data[target.collection])) {
                    collectionSnapshots.push({ key:target.collection, before:deepClone(data[target.collection]) });
                    if (target.collection === 'styleImages') for (const image of data.styleImages || []) if (image.thumbnail?.key) trackedThumbnailKeys.add(image.thumbnail.key);
                }
                continue;
            }
            const collectionKey = undoCollectionKeyForKind(target.kind);
            const collection = Array.isArray(data[collectionKey]) ? data[collectionKey] : [];
            const index = collection.findIndex(item => item.id === target.id);
            const before = index >= 0 ? deepClone(collection[index]) : null;
            itemSnapshots.push({ kind:target.kind, id:target.id, collectionKey, index, before });
            if (before) itemThumbnailKeys(before).forEach(key => trackedThumbnailKeys.add(key));
        }
        const thumbnails = {};
        for (const key of trackedThumbnailKeys) {
            const value = await getStoredThumbnailWithRetry(key);
            if (value) thumbnails[key] = value;
        }
        return { label, itemSnapshots, collectionSnapshots, thumbnails, trackedThumbnailKeys:[...trackedThumbnailKeys], targets:normalizedTargets, at:Date.now() };
    }

    function registerUndo(record) {
        if (!record) return;
        const beforeKeys = new Set(record.trackedThumbnailKeys || []);
        const currentKeys = new Set();
        for (const target of record.targets || []) {
            if (target.collection === 'styleImages') for (const image of data.styleImages || []) if (image.thumbnail?.key) currentKeys.add(image.thumbnail.key);
            else if (target.kind && target.id) {
                const item = findItem(target.kind, target.id);
                if (item) itemThumbnailKeys(item).forEach(key => currentKeys.add(key));
            }
        }
        record.createdThumbnailKeys = [...currentKeys].filter(key => !beforeKeys.has(key));
        undoRecord = record;
        clearTimeout(undoTimer);
        undoTimer = setTimeout(() => { undoRecord = null; }, 10000);
        toastWithAction(record.label, 'Undo', () => void undoLastAction());
    }

    async function undoLastAction() {
        const record = undoRecord;
        if (!record) return;
        undoRecord = null;
        clearTimeout(undoTimer);
        clearTimeout(saveTimer);
        for (const key of record.createdThumbnailKeys || []) await gmDeleteValueAsync(key);
        for (const snapshot of record.collectionSnapshots || []) data[snapshot.key] = deepClone(snapshot.before);
        for (const snapshot of record.itemSnapshots || []) {
            const collection = Array.isArray(data[snapshot.collectionKey]) ? data[snapshot.collectionKey] : null;
            if (!collection) continue;
            const currentIndex = collection.findIndex(item => item.id === snapshot.id);
            if (currentIndex >= 0) collection.splice(currentIndex, 1);
            if (snapshot.before) collection.splice(Math.max(0, Math.min(snapshot.index, collection.length)), 0, deepClone(snapshot.before));
        }
        for (const [key, value] of Object.entries(record.thumbnails || {})) {
            await gmSetValueAsync(key, value);
            rememberThumbnailCache(key, value);
        }
        dataRevision++;
        markDerivedDataDirty(['library','tags','images','styles','collections']);
        saveNow(`Undo: ${record.label}`);
        render();
        toast('Action undone', 'success');
    }

    function isTextInputTarget(target) {
        return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
        } catch {
            return String(value || '');
        }
    }

    function formatRelative(value) {
        const difference = Date.now() - new Date(value).getTime();
        if (!Number.isFinite(difference)) return '';
        const minutes = Math.floor(difference / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hr ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    function toast(message, type = 'info') {
        let element = root.querySelector('#ainz-toast');
        if (!element) {
            render();
            element = root.querySelector('#ainz-toast');
        }
        if (!element) return;
        element.textContent = message;
        element.className = `toast show ${type}`;
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
    }

    function toastWithAction(message, actionLabel, callback) {
        let element = root.querySelector('#ainz-toast');
        if (!element) { render(); element = root.querySelector('#ainz-toast'); }
        if (!element) return;
        element.replaceChildren();
        const text = document.createElement('span');
        text.textContent = message;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toast-action';
        button.dataset.action = 'undo-action';
        button.textContent = actionLabel;
        button.addEventListener('click', event => { event.stopPropagation(); callback(); }, { once: true });
        element.append(text, button);
        element.className = 'toast show has-action';
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => element.classList.remove('show'), 10000);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function cssEscape(value) {
        if (globalThis.CSS?.escape) return CSS.escape(value);
        return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    // Start only after every concatenated module and constant has initialized.
    init();
})();
