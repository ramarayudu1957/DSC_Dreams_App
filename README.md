# DSC Dreams

DSC Dreams is a static progressive web app for practising English grammar and vocabulary questions from DSC and TET papers. The current question bank contains 1,424 questions.

## Files required for GitHub Pages

- `index.html`
- `style.css`
- `app.js`
- `sw.js`
- `manifest.json`
- `question_bank.json`
- `icon-192.png`
- `icon-512.png`

Keep these files together in the published folder. GitHub Pages serves the app over HTTPS, which allows the service worker and offline installation to work.

## Publish with GitHub Pages

1. Upload the files to the repository's default branch.
2. In the repository, open **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the default branch and the `/ (root)` folder, then save.
5. Open the Pages URL after deployment. Existing users should refresh once so the updated service worker replaces the old cache.

## Rebuild the question bank

Run the converter whenever the Excel source changes:

```powershell
python build_question_bank.py
```

The converter reads `1DSC&TET_SGT_Full_Final_for_App.xlsx`, validates question IDs and answers, and rewrites `question_bank.json` using the current column names.
