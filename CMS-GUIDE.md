# Updating the Lakeland Cabaret website

**Clients can update content. Whimsy handles design, layout, and functionality.**

The browser editor is [Pages CMS](https://app.pagescms.org). Website content lives in `src/content/*.json`, and photos live in `public/images` in this GitHub repository. There is no CMS database or API dependency in the public website. This site currently uses Angular; the content files are also portable to React or another framework.

## One-time setup for the repository owner

1. Commit and push the CMS integration, including `.pages.yml`, the content files, scripts, and application changes, to the branch you want to edit. The working branch when this was added was `develop`; do not assume that it is the production branch.
2. Open [Pages CMS](https://app.pagescms.org), sign in with GitHub, and install its GitHub App for **JohnBieniek/LakelandCabaretUI**. Limit repository access to this site. Select the repository and the appropriate branch. The forms come from the existing `.pages.yml`; you do not need to create a new configuration.
3. In Cloudflare Pages, verify the repository connection, production branch, and automatic Git deployments. Keep the build command **`npm run build`** and output directory **`dist/cloudflare`**. The repository pins Node.js **22.22.3**. Any build watch paths must include `src/content/**`, `public/images/**`, and `.pages.yml`.
4. Invite the client as a **Pages CMS collaborator** using the app's collaborator management. Collaborators can edit content and media without a GitHub account and cannot manage `.pages.yml`. A GitHub user with repository permissions may still edit code or configuration outside these forms, so use collaborator access for the client handoff.
5. Test a small text edit on a preview branch, save it, and verify the Cloudflare preview. Test a photo upload too. Confirm the production branch and publishing workflow with the client before handing it over.

The repository integration is local until it is committed and pushed. GitHub App authorization, collaborator invitations, and Cloudflare account settings must be completed by someone with account access; adding these files does not perform those account actions.

## Everyday editing

1. Sign in to Pages CMS and open the site and agreed editing branch.
2. Choose a form from the sidebar:

| Form | What you can change |
| --- | --- |
| Business details & hours | Name, phone, email, address, hours, and footer tagline |
| Page headings, text & main photos | Intro text, section labels, headings, paragraphs, hero/about photos and alternative text |
| Service cards | Names, descriptions, short supporting text, and photo/officiant card images |
| Services & prices | Pricing groups, descriptions, service names, prices, and notes |
| Slideshow photos | The 10 music photos and 8 fire photos, with alternative text |
| Staff profiles | Names, roles, biographies, portraits, and alternative text |
| Testimonials | Quotes, names, and optional event/context |
| FAQs | Questions and answers |
| Announcements | Titles and announcement text |
| Search engine title & description | The home page's browser/search title and description |

3. Edit the fields and click **Save**. Use ordinary text; HTML and scripts are displayed as text. Heading parts follow the existing design: for example, the hero has a first line, a second line, and an emphasized ending.
4. For photos, upload or choose an image in its image field and fill in the alternative text with a short description of what it shows. Use JPG, PNG, WebP, or AVIF. Keep replacement subjects near the center because the design crops images to fit. Compress large photos before uploading. Replacing a slideshow slot preserves the fixed animation timing.
5. Wait for the Cloudflare deployment to succeed, then check the page on desktop and mobile. A CMS save commits to GitHub; it is not an instant live-site update. On the production branch, a successful automatic deployment publishes the edit. On a preview branch, it updates the preview; Whimsy merges the approved change to publish it.

Empty staff, testimonial, FAQ, and announcement lists do not show sections on the site. Add an entry to show a section; remove all its entries to hide it. Empty address and hours fields are hidden too. Announcements stay visible until removed; they do not automatically expire. No unverified staff profiles or customer quotes have been added.

The editor has no controls for colors, spacing, navigation behavior, layouts, arbitrary components, or page creation. Ask Whimsy for those changes. The sidebar's Media area manages repository images: upload a replacement, update its content reference, and check the deployment before deleting an old image that might still be used elsewhere.

## Fixing a mistake

For a typo, correct the field and save again. For a larger mistake, ask Whimsy to revert the specific content or image commit in GitHub and let Cloudflare rebuild. Git history preserves previous content, but an older file state still needs to be deployed to restore the live site.

If the edit does not appear, check that you edited the intended branch, then check its deployment status. `npm run build` validates required fields, photo references, slideshow counts, and contact formats before building. A failed build leaves the previous successful deployment available. Whimsy can run `npm run validate:content` to identify the file and field that needs fixing.

## Developer checks

Use the pinned Node.js version, then run:

```sh
npm ci
npm run test:content
npm test -- --watch=false
npm run build
```

Content is imported during the build, including SEO metadata in prerendered HTML. Content changes require a rebuild. Keep `.pages.yml`, the template bindings, and content validation aligned when adding new fields. Keep the GitHub repository and its assets backed up; changing CMS providers does not require exporting a separate content database.

Local verification at implementation: the content and component tests passed, and prerendered SEO was checked. The full Windows build encountered `EPERM` while copying timestamps for existing media files; compilation and prerendering succeeded with asset copying temporarily disabled. The original asset configuration was restored. There is also a component stylesheet size warning. Confirm a complete Cloudflare build and a CMS save/upload before the client handoff.

References: [Pages CMS setup](https://pagescms.org/docs/quick-start/), [collaborator permissions](https://pagescms.org/docs/configuration/collaborators/), and [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).
