# Ainz Toolkit

An unofficial userscript toolkit for NovelAI Image Generation, Danbooru, Gelbooru and e621.

Ainz Toolkit provides a local prompt library, character profiles, reusable tag sets, Booru imports, locally stored image previews, style-tag extraction, smart collections and direct prompt insertion into NovelAI.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Click **[Install Ainz Toolkit](https://raw.githubusercontent.com/Ainz-sama120/Ainz-Unofficial-NAI-Toolkit/main/Ainz_Toolkit.user.js)**.
3. Confirm the installation in Tampermonkey.
4. Open NovelAI Image Generation or one of the supported Booru websites.

## Supported websites

- NovelAI Image Generation
- Danbooru
- Gelbooru
- e621

## Main features

### Prompt library and NovelAI workflow

- Character profiles with separate positive and negative prompts
- Positive, negative and combined tag sets
- Reusable Base Tag profiles
- Style and artist profiles with optional negative prompts
- Full Image snapshots containing Main Prompt, Main Undesired Content and every active character prompt
- Save new library entries directly from the current NovelAI prompt
- Append or replace content in supported NovelAI fields
- Insert tags at the cursor, beginning or end of a field
- Skip exact duplicate tags or allow duplicates
- Add saved character profiles directly as NovelAI character prompts
- Selectively restore individual parts of a Full Image snapshot
- Quick Access for favorites, recently used entries and prompt actions
- Usage history and manually saved prompt history states
- Smart views for recently used, created, modified and most-used entries

### Booru integration

- Integrated support for Danbooru, Gelbooru and e621
- Import tags and image metadata from the currently opened post
- Select and batch-import multiple posts from listing pages
- Per-website import profiles
- Choose which tag categories are imported or copied
- Keep underscores or convert them to spaces
- Optional inclusion of censorship tags, disabled by default
- Optional `+` buttons beside individual tags
- Copy presets for artist, character and copyright, general tags, text tags, scene/action/style tags and all enabled profile tags
- Automatic filtering of technical request tags and non-prompt metadata
- Special scene-tag handling for human, animal and furry content
- Configurable delay for batch imports

### Imported images and variants

- Store imported posts as reusable prompt entries
- Keep original Booru tag categories and available source metadata
- Group related images together as variants
- Browse and switch variants from cards and detail views
- Compare variants side by side or as an opacity-adjustable overlay
- Copy or insert all tags or individual tag categories from a variant
- Filter imported entries by website, artist, character, copyright, tags, favorites, variant count and local image availability
- Sort and group imported entries by several metadata fields
- Customizable automatic naming templates
- Preview mass renaming before applying it
- Protection for manually edited names
- Undo support for supported larger changes

### Local image storage

- Store compressed local preview images inside Tampermonkey
- Multiple selectable image quality levels
- Shared local images for lists, details and comparisons
- Web access only after an explicit import, detail, refresh or repair action
- Verified image storage with read-back checks
- Recovery of matching unreferenced image records when possible
- Detection of missing and orphaned local images
- Manual thumbnail replacement
- Reload individual images from their stored source
- Rebuild or refresh image data in bulk
- Pause or cancel longer batch operations
- Local Image Storage statistics

### Duplicate and similarity handling

- Exact source and post-ID duplicate detection
- File metadata and hash-based matching where available
- Visual similarity suggestions using perceptual image fingerprints
- Configurable visual matching sensitivity
- Recognition of close variants such as edits and recolors
- Suggested matches are never merged automatically
- Choose whether to skip, update an entry, add a variant or store a separate entry

### Style tag extraction and library

- Dedicated Style and Artist section for reusable style tags
- Import NovelAI-generated PNG files and read embedded generation metadata
- Extract style-related tags from the embedded positive prompt
- Recognize art styles, movements, media, techniques, lighting, color treatments and visual effects
- Review, add or remove detected tags before saving
- Store the original PNG locally alongside its extracted style tags
- Browse and favorite images by recognized style tags
- Copy or insert all extracted tags or individual style categories
- No network request is required for local NovelAI PNG imports
- This feature only extracts and organizes prompt tags
- It does not create, import or use NovelAI Precise Reference data

### Tag Collection

- Automatically indexed tag collection from saved image entries
- Search tags across the local imported-image library
- Frequency count for each indexed tag
- View every saved image containing a selected tag
- Copy or insert a selected tag
- Repair malformed or duplicated tag values
- Prevent complete prompts from being indexed as one tag

### Collections and organization

- Manual Collections for hand-picked entries
- Smart Collections generated from configurable rules
- Search across imported images, characters, tag sets, base tags, styles, Full Images, saved tags or the entire library
- Match all rules or any rule
- Rules for tags, artists, characters, copyrights, species, sources, categories, favorites, variants and image status
- Live match preview before saving
- Include and exclude exceptions for Smart Collections
- Up to three levels of automatic virtual folders
- Group results by artist, character, copyright, website, category, year and other fields
- Global library search
- Favorites across profiles, sets, styles, imports, Full Images and tags
- Configurable start page and sidebar
- Grid and list layouts
- Multiple accent colors

### Data safety and maintenance

- JSON export of the portable library
- Optional inclusion of local preview images in exports
- Merge with or replace existing library data
- Transaction-verified imports, migrations and replacements
- Revision-aware saving
- Multi-tab synchronization
- Patch-based Undo for supported changes
- Local Library Health Check
- Detection of damaged entries, invalid references and image-storage inconsistencies
- Review issues before starting a repair
- Manual NovelAI field diagnostic scan
- Local performance diagnostics
- Complete local data reset from settings

## Privacy

Ainz Toolkit stores its library, settings and local preview images inside Tampermonkey.

It does not store NovelAI credentials, cookies or authentication tokens.

Network requests are limited to supported websites and are used only when required for the currently opened post, an image import or an explicitly started refresh or repair action.

## Data and updates

Toolkit data is stored separately from the userscript itself.

Installing an update through the same installation link normally preserves the existing library, settings and local images.

For additional safety, users can export their toolkit data as a JSON file from the settings menu.

## Reporting problems

Please use the repository's **Issues** section and include:

- Browser and browser version
- Tampermonkey version
- Website where the problem occurred
- Steps required to reproduce the issue
- Screenshots or console errors, when available
- Whether the issue also occurs with a new entry

Please do not include account credentials, cookies or private toolkit exports.

## Disclaimer

Ainz Toolkit is an unofficial community project.

It is not affiliated with, endorsed by or maintained by NovelAI, Danbooru, Gelbooru or e621.

Users are responsible for complying with the terms, rules and content policies of the websites they use.

## License

Ainz Toolkit is available under the [MIT License](LICENSE).
