Estimator feedback patch:
- Enter/Numpad Enter moves to next field in the piece editor.
- F1 adds a new line, selects it, and focuses the editor immediately.
- Line-items table scrolls independently; editor panel stays sticky and scrollable.
- Export downloads as .xls instead of .xml so it opens in Excel instead of browser XML.
- Weight parsing fixed for PL, FB, L, HSS, pipe, round bar, channels, MC, and W shapes.

Install:
1. Copy app/ and lib/ into the project root.
2. Choose Replace files in destination.
3. Run npm run dev.
4. Test estimating tab and export.
