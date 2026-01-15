#!/usr/bin/env node
const blessed = require('neo-neo-blessed');
import chalk from 'chalk';
import { spawn } from 'child_process';
import { GitHandler, FileStatus } from './utils/git';
import { formatDiffWithDiff2Html } from './utils/diff-formatter';

async function main() {
  const gitHandler = new GitHandler();

  if (!(await gitHandler.isRepo())) {
    console.log(chalk.red('Error: Current directory is not a git repository.'));
    process.exit(1);
  }

  const screen = blessed.screen({
    smartCSR: true,
    title: 'diffwatch',
  });

  const fileList = blessed.list({
    top: 0,
    left: 0,
    width: '30%',
    height: '100%',
    label: ' Files (0) ',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'white' },
      style: { bg: 'blue' },
    },
    style: {
      selected: { fg: 'black', bg: 'white' },
      border: { fg: 'white' },
    },
    border: { type: 'line' },
  });

  const diffView = blessed.scrollabletext({
    top: 0,
    left: '30%',
    width: '70%',
    height: '100%',
    label: ' Diff () ',
    keys: true,
    vi: true,
    mouse: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'white' },
      style: { bg: 'blue' },
    },
    style: {
      border: { fg: 'white' },
    },
    border: { type: 'line' },
    tags: false,
  });

  screen.append(fileList);
  screen.append(diffView);

  const updateBorders = () => {
    fileList.style.border.fg = screen.focused === fileList ? 'yellow' : 'white';
    diffView.style.border.fg = screen.focused === diffView ? 'yellow' : 'white';
    screen.render();
  };

  let currentFiles: FileStatus[] = [];
  let lastSelectedPath: string | null = null;
  let diffUpdateTimeout: NodeJS.Timeout | null = null;

  const scheduleDiffUpdate = () => {
    if (diffUpdateTimeout) clearTimeout(diffUpdateTimeout);
    diffUpdateTimeout = setTimeout(async () => {
      await updateDiff();
    }, 150); // 150ms debounce
  };

  const openInEditor = (filePath: string) => {
    try {
      if (process.platform === 'win32') {
        // On Windows, use 'start' to open with default program
        spawn('cmd', ['/c', 'start', '', filePath], { stdio: 'ignore', detached: true }).unref();
      } else {
        // On Unix-like systems, try EDITOR, fallback to xdg-open
        const editor = process.env.EDITOR || process.env.VISUAL || 'xdg-open';
        spawn(editor, [filePath], { stdio: 'ignore', detached: true }).unref();
      }
    } catch (error) {
      console.error(`Failed to open ${filePath}: ${error}`);
    }
  };

  const updateDiff = async () => {
    const selectedIndex = fileList.selected;
    const selectedFile = currentFiles[selectedIndex];
    if (selectedFile) {
      const diff = await gitHandler.getDiff(selectedFile.path);
      const formattedDiff = formatDiffWithDiff2Html(diff);
      const newLabel = ` Diff (${selectedFile.path}) `;
      const currentContent = diffView.content;
      const currentLabel = diffView.label;

      // Only update if content or label changed to reduce flickering
      if (formattedDiff !== currentContent || newLabel !== currentLabel) {
        const savedScroll = diffView.scrollTop;
        const isNewFile = selectedFile.path !== lastSelectedPath;

        diffView.setContent(formattedDiff);
        diffView.setLabel(newLabel);

        if (isNewFile) {
          diffView.scrollTo(0);
        } else {
          diffView.scrollTop = savedScroll;
        }
      }
      lastSelectedPath = selectedFile.path;
    } else {
      const newContent = 'Select a file to view diff.';
      const newLabel = ' Diff () ';
      if (diffView.content !== newContent || diffView.label !== newLabel) {
        diffView.setContent(newContent);
        diffView.setLabel(newLabel);
        diffView.scrollTo(0);
      }
      lastSelectedPath = null;
    }
    screen.render();
  };

  const updateFileList = async () => {
    // Preserve selected file path and scroll positions
    const selectedPath = currentFiles[fileList.selected]?.path;
    const fileListScroll = fileList.scroll;
    const diffScroll = diffView.scrollTop;

    const files = await gitHandler.getStatus();
    currentFiles = files;

    const items = files.map(f => {
      let color = '{white-fg}';
      if (f.status === 'added') color = '{green-fg}';
      else if (f.status === 'deleted') color = '{red-fg}';
      else if (f.status === 'modified') color = '{blue-fg}';
      else if (f.status === 'unstaged') color = '{white-fg}';

      return `${color}${f.path}{/}`;
    });

    fileList.setItems(items);
    fileList.setLabel(` Files (${files.length}) `);

    if (items.length > 0) {
      // Restore selection by path if possible
      const newSelectedIndex = selectedPath ? currentFiles.findIndex(f => f.path === selectedPath) : -1;
      fileList.select(newSelectedIndex >= 0 ? newSelectedIndex : 0);
      // Cancel any pending diff update and update immediately
      if (diffUpdateTimeout) {
        clearTimeout(diffUpdateTimeout);
        diffUpdateTimeout = null;
      }
      await updateDiff();
    } else {
      diffView.setContent('No changes detected.');
      diffView.setLabel(' Diff () ');
    }

    // Restore scroll positions
    fileList.scroll = fileListScroll;
    diffView.scrollTop = diffScroll;

    screen.render();
  };

  fileList.on('select item', () => {
    scheduleDiffUpdate();
  });

  fileList.key(['up', 'down'], () => {
    scheduleDiffUpdate();
  });

  screen.key(['escape', 'q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key(['tab'], () => {
    if (screen.focused === fileList) {
      diffView.focus();
    } else {
      fileList.focus();
    }
    updateBorders();
  });

  screen.key(['left'], () => {
    fileList.focus();
    updateBorders();
  });

  screen.key(['right'], () => {
    diffView.focus();
    updateBorders();
  });

  screen.key(['enter'], () => {
    const selectedIndex = fileList.selected;
    const selectedFile = currentFiles[selectedIndex];
    if (selectedFile) {
      openInEditor(selectedFile.path);
    }
  });

  setInterval(async () => {
    await updateFileList();
  }, 5000);

  await updateFileList();
  fileList.focus();
  updateBorders();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
