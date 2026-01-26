import * as cheerio from 'cheerio';
const Diff2Html = require('diff2html');

export function formatDiffWithDiff2Html(diffString: string, searchTerm?: string): string {
  if (!diffString || diffString.trim() === '') {
    return '';
  }

  try {
    const html = Diff2Html.html(diffString, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'line-by-line',
      colorScheme: 'dark',
    });

    const $ = cheerio.load(html);

    let blessedText = '';

    $('.d2h-diff-tbody tr').each((_, row) => {
      const $row = $(row);

        if ($row.find('.d2h-code-line').length > 0) {
          const $lineNumberCell = $row.find('td.d2h-code-linenumber');
          const isAdded = $row.find('td.d2h-ins').length > 0;
          const isDeleted = $row.find('td.d2h-del').length > 0;
          const $lineContent = $row.find('.d2h-code-line-ctn');
          const $linePrefix = $row.find('.d2h-code-line-prefix');
          const $lineWrapper = $row.find('.d2h-code-line');

          let prefix = '';
          let content = '';
          let lineNumber = '';

          if ($lineNumberCell.length > 0) {
            lineNumber = $lineNumberCell.text().trim();
          }
          if ($linePrefix.length > 0) {
            prefix = $linePrefix.text();
          }
          if ($lineContent.length > 0) {
            content = $lineContent.text();
          } else {
            content = $lineWrapper.text().trim();
          }

          let fullLine = prefix + content;

          // Add line number with proper formatting
          const formattedLineNumber = lineNumber ? `${lineNumber}: ` : '    ';

          // Highlight search term if present
          if (searchTerm && fullLine.toLowerCase().includes(searchTerm.toLowerCase())) {
             const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
             // We need to know the base color to restore it.
             // Added: 32, Deleted: 31, Normal: 37
             const baseColor = isAdded ? '32' : (isDeleted ? '31' : '37');
             fullLine = fullLine.replace(regex, `\x1b[43m\x1b[30m$1\x1b[0m\x1b[${baseColor}m`);
          }

          if (isAdded) {
             blessedText += `\x1b[90m${formattedLineNumber}\x1b[0m\x1b[32m${fullLine}\x1b[0m\n`;
           } else if (isDeleted) {
             blessedText += `\x1b[90m${formattedLineNumber}\x1b[0m\x1b[31m${fullLine}\x1b[0m\n`;
           } else {
             blessedText += `\x1b[90m${formattedLineNumber}\x1b[0m\x1b[37m${fullLine}\x1b[0m\n`;
           }
        }

      if ($row.find('.d2h-info').length > 0) {
        const hunkText = $row.find('.d2h-info').text().trim();
        blessedText += `\x1b[36m${hunkText}\x1b[0m\n`;
      }
    });

    return blessedText.trim();
  } catch (error) {
    return `Error formatting diff: ${error}`;
  }
}
